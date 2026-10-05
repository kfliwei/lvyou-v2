/* tools/smoke-planner.js — 行程规划页真实浏览器冒烟测试（puppeteer-core + 本机 Chrome）
 * 覆盖：页面无 JS 报错、AI 开关渲染、目的地 chips、一句话生成→候选→排期→结果全链路
 * 用法: node tools/smoke-planner.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* 向导 4 步（起终点 → 环线 → 排序 → 排期）：排序方式按钮在第 3 步才进 DOM */
async function wizardTo(p, step) {
  await p.click('#scheduleBtn');
  await sleep(400);
  for (let s = 1; s < step; s++) { await p.click('#wNext'); await sleep(300); }
}
async function wizardDone(p) {
  await p.click('#wNext');
  await sleep(300);
  /* 记下「末步点击 → 第一张 .day-card 进 DOM」的真实耗时（自断开，零成本）。
     没有这个数，dayN 读到 0 时无法区分"取样早了"和"产品真没渲染出来"。 */
  await p.evaluate(() => {
    window.__dcLat = document.querySelector('#resultBody .day-card') ? 0 : null;
    const t0 = Date.now();
    const ob = new MutationObserver(() => {
      if (window.__dcLat === null && document.querySelector('#resultBody .day-card')) {
        window.__dcLat = Date.now() - t0; ob.disconnect();
      }
    });
    if (window.__dcLat === null) ob.observe(document.body, { subtree: true, childList: true });
  });
  await p.click('#wDone');
  await sleep(1600);
}

/* ===== 批次 14：结果页地图（只在测试侧注入，生产零改动） =====
   用户报的三条症状：① 地图显示不全 ② 只有节点没有路线 ③ 点节点不出信息。
   根因一条：showStage 把 display 翻转放进 UI.vt 的回调里（View Transition 把 DOM 更新推到下一帧），
   紧随其后的 renderMap 量到的是切换前的 display:none = 0×0。对着 0×0 建图，Leaflet 的瓦片视口
   和 SVG 渲染器永久停在 0×0，fitBounds 同时退化成 maxZoom=18。事后 invalidateSize 只救得回尺寸
   （瓦片 100%）救不回视图（path 仍 0×0）——所以判据必须钉在「建图那一刻容器有没有尺寸」上。
   读数全部取自 DOM 几何与 Leaflet 实例，一个都不依赖瓦片下载成功：没网的机器也要判得出同一条退化。 */
const MAP_HOOK = () => {
  let real;
  window.__mapLog = [];
  try {
    Object.defineProperty(window, 'L', {
      configurable: true,
      get() { return real; },
      set(v) {
        try {
          const orig = v.map;
          v.map = function (el, o) {
            const c = typeof el === 'string' ? document.getElementById(el) : el;
            const r = c ? c.getBoundingClientRect() : null;
            const st = document.getElementById('stageResult');
            window.__mapLog.push({
              rect: r ? Math.round(r.width) + '×' + Math.round(r.height) : 'no-el',
              boxDisp: c ? getComputedStyle(c).display : null,
              stageDisp: st ? getComputedStyle(st).display : null
            });
            const m = orig.call(v, el, o);
            window.__plannerMap = m;
            return m;
          };
        } catch (e) {}
        real = v;
      }
    });
  } catch (e) {}
};

const MAP_GEOM = () => {
  const box = document.getElementById('mapBox');
  if (!box) return { missing: '没有 #mapBox' };
  const br = box.getBoundingClientRect();
  const overlaps = r => r.right > br.left + 1 && r.left < br.right - 1 && r.bottom > br.top + 1 && r.top < br.bottom - 1;
  const rects = Array.from(box.querySelectorAll('.leaflet-overlay-pane path')).map(p => p.getBoundingClientRect());
  const marks = Array.from(box.querySelectorAll('.leaflet-marker-icon .map-pin'));
  const svg = box.querySelector('.leaflet-overlay-pane svg');
  const m = window.__plannerMap;
  const created = (window.__mapLog || [])[0] || null;
  return {
    createdWhen: created ? created.rect : null,
    createdBoxDisp: created ? created.boxDisp : null,
    createdStageDisp: created ? created.stageDisp : null,
    mapSize: m ? Math.round(m.getSize().x) + '×' + Math.round(m.getSize().y) : null,
    clientSize: box.clientWidth + '×' + box.clientHeight,
    zoom: m ? m.getZoom() : null,
    svgSize: svg ? svg.getAttribute('width') + 'x' + svg.getAttribute('height') : null,
    paths: rects.length,
    pathsZero: rects.filter(r => r.width < 1 || r.height < 1).length,
    pathsInBox: rects.filter(r => r.width > 1 && r.height > 1 && overlaps(r)).length,
    pins: marks.length,
    pinsInBox: marks.filter(x => { const r = x.getBoundingClientRect(); return r.width > 1 && overlaps(r); }).length,
    tiles: box.querySelectorAll('.leaflet-tile').length,
    tileLoaded: box.querySelectorAll('.leaflet-tile-loaded').length
  };
};

const MAP_TAP = () => {
  const box = document.getElementById('mapBox').getBoundingClientRect();
  const mk = document.querySelector('#mapBox .leaflet-marker-icon');
  if (!mk) return { none: '没有针脚可点' };
  const r = mk.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (mk.textContent || '').trim() };
};

const MAP_POPUP = () => {
  const box = document.getElementById('mapBox').getBoundingClientRect();
  const p = document.querySelector('#mapBox .leaflet-popup');
  if (!p) return { popup: false };
  const r = p.getBoundingClientRect();
  const c = getComputedStyle(p);
  return {
    popup: true,
    text: (p.innerText || '').replace(/\s+/g, ' ').trim(),
    size: Math.round(r.width) + '×' + Math.round(r.height),
    style: 'op' + c.opacity + '/' + c.visibility + '/' + c.display,
    clipped: (r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.right > box.right + 1)
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.evaluateOnNewDocument(MAP_HOOK);
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  ok('页面加载', true);
  ok('AI 开关渲染', !!(await page.$('#aiSwitch')));
  ok('目的地 chips 渲染', !!(await page.$('#destChips .chip')));

  // 一句话生成
  await page.type('#promptInput', '我想去川西玩5天，喜欢自然风光');
  await page.click('#genBtn');
  await sleep(1200);
  ok('进入选点阶段', await page.evaluate(() => document.getElementById('stagePick').style.display === 'block'));
  const candN = await page.$$eval('#candList .cand', els => els.length);
  ok('候选列表非空', candN > 0, '候选 ' + candN + ' 处');
  ok('意图卡显示目的地', await page.evaluate(() => (document.getElementById('intentRegions').textContent || '').length > 0));

  // 候选内筛选
  await page.type('#candFilter', 'zzzz');
  await sleep(300);
  const filteredN = await page.$$eval('#candList .cand', els => els.length);
  ok('候选筛选生效', filteredN === 0, '筛选后 ' + filteredN + ' / ' + candN);
  await page.evaluate(() => { const f = document.getElementById('candFilter'); f.value = ''; f.dispatchEvent(new Event('input')); });
  await sleep(300);

  // 选 5 个候选（每次重新查询 DOM，避免重渲染后句柄失效）
  for (let i = 0; i < 5; i++) {
    await page.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await sleep(400);
  const summ = await page.$eval('#summbar', el => el.style.display).catch(() => 'none');
  ok('汇总条出现', summ === 'flex');
  const estDays = await page.evaluate(() => {
    const m = /预计 <b>(\d+)<\/b> 天/.exec(document.getElementById('summInfo').innerHTML);
    return m ? +m[1] : -1;
  });

  // 排期：#scheduleBtn 打开向导，向导第 4 步「开始排期」才出行程
  await wizardTo(page, 3);
  ok('无 Key 时向导默认地理最近邻', await page.evaluate(() => /primary/.test((document.getElementById('wSortGeo') || {}).className || '')));
  await wizardDone(page);
  ok('进入结果阶段', await page.evaluate(() => document.getElementById('stageResult').style.display === 'block'));
  const dayN = await page.$$eval('#resultBody .day-card', els => els.length);
  ok('每日安排生成', dayN >= 1, dayN + ' 天');
  ok('选点页预计天数=实际排期天数', estDays === dayN, '预计 ' + estDays + ' / 实际 ' + dayN);
  ok('落地动作条', !!(await page.$('#actRow .btn')));

  /* --- G1–G11：地图三症状判据（见文件头 MAP_HOOK 那段） --- */
  const g = await page.evaluate(MAP_GEOM);
  ok('G1 建图时容器已有尺寸（不是 0×0）', !!g.createdWhen && /^0×|^no-el/.test(g.createdWhen) === false,
    '建图时 ' + g.createdWhen + '，那一刻 #mapBox display=' + g.createdBoxDisp + ' / stageResult display=' + g.createdStageDisp);
  ok('G2 Leaflet 内部尺寸＝容器尺寸', !!g.mapSize && g.mapSize === g.clientSize, 'map ' + g.mapSize + ' / 容器 ' + g.clientSize + '（瓦片 ' + g.tileLoaded + '/' + g.tiles + ' 块，只作参考不参与判定）');
  ok('G3 折线渲染器画布不是 0×0', !!g.svgSize && g.svgSize !== '0x0', 'overlay svg ' + g.svgSize);
  ok('G4 站站有线相连（path 条数 ≥ 2×(针脚数−1)）', g.pins >= 2 && g.paths >= 2 * (g.pins - 1), g.paths + ' 条 path / ' + g.pins + ' 枚针脚');
  ok('G5 没有画成 0×0 的折线', g.paths > 0 && g.pathsZero === 0, g.pathsZero + ' 条零尺寸 / 共 ' + g.paths + ' 条');
  ok('G6 折线全部落在地图框内', g.paths > 0 && g.pathsInBox === g.paths, g.pathsInBox + '/' + g.paths + ' 在框内');
  ok('G7 针脚全部落在地图框内', g.pins > 0 && g.pinsInBox === g.pins, g.pinsInBox + '/' + g.pins + ' 在框内');
  ok('G8 fitBounds 没退化成最大缩放（症状：底图只剩一块瓦片）', g.zoom !== null && g.zoom < 17, '缩放 ' + g.zoom);
  await page.evaluate(() => { const b = document.getElementById('mapBox'); if (b.scrollIntoView) b.scrollIntoView({ block: 'center' }); });
  await sleep(500);
  const pin = await page.evaluate(MAP_TAP);
  if (!pin.none) { await page.mouse.click(pin.x, pin.y); await sleep(900); }
  const pop = pin.none ? { popup: false } : await page.evaluate(MAP_POPUP);
  ok('G9 点针脚弹出该站信息（症状：点了没反应）', !!pop.popup && pop.text.length > 0,
    pin.none || ('针脚「' + pin.label + '」→ ' + (pop.popup ? pop.text.slice(0, 40) + ' [' + pop.size + ' ' + pop.style + ']' : '没有弹窗')));
  ok('G10 信息卡完整落在地图框内（症状：弹窗甩到框外被裁）', !!pop.popup && pop.clipped === false,
    pop.popup ? ('clipped=' + pop.clipped + ' ' + pop.size) : '没有弹窗');

  /* ---- 批次 9：分享入口在真浏览器里点一遍（按钮 → 确认卡 → 无基址讲清 / 有基址出链接 → 复制到的确实是链接）
     §17 闸门的接线断言只证明代码在，跑不到"点下去真出东西"；载荷与渲染由 smoke-share 验，
     这一段专门验 planner 这一侧的用户路径。剪贴板与 navigator.share 都在页面里换成可控桩：
     交付壳（WebView）本来就没有 navigator.share，走的就是"复制链接"那条路。 */
  await page.evaluate(() => {
    window.__copied = '';
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: t => { window.__copied = String(t); return Promise.resolve(); } }, configurable: true
      });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    } catch (e) {}
  });
  const shareBtn = await page.$('#actRow button[onclick="window.plannerShare()"]');
  ok('结果区挂了「分享行程」按钮', !!shareBtn);
  const shareTxt = shareBtn ? await shareBtn.evaluate(el => el.textContent.trim()) : '';
  const shareIco = shareBtn ? await shareBtn.evaluate(el => !!el.querySelector('svg')) : false;
  ok('按钮文案「分享行程」且带图标', shareTxt === '分享行程' && shareIco, JSON.stringify(shareTxt));
  const nDays = await page.$$eval('#resultBody .day-card', e => e.length);
  const nStops = await page.$$eval('#resultBody .stop', e => e.length);
  const errBefore = errors.length;

  /* 没填基址：宁可只给文字，也不发一条对方打不开的链接 */
  await page.evaluate(() => localStorage.removeItem('tn_share_base'));
  await page.evaluate(() => window.plannerShare());
  await sleep(400);
  const card1 = await page.$eval('.ui-modal-text', el => el.innerText).catch(() => '');
  ok('无基址时确认卡讲明没有可点开的网址', /打不开|文字版/.test(card1), card1.slice(-46));
  const mm = /(\d+) 天 \/ (\d+) 站/.exec(card1);
  ok('确认卡的天数/站数与屏上行程一致', !!mm && +mm[1] === nDays && +mm[2] === nStops, mm ? mm[0] : '没抓到数字');
  ok('确认卡写明不会分享什么', /不会分享：游记正文、照片、录音、任何 API Key/.test(card1));
  await page.click('.ui-modal-mask .ui-btn-ghost');
  await sleep(250);
  ok('取消后卡关掉且没复制任何东西',
    (await page.$('.ui-modal-mask')) === null && (await page.evaluate(() => window.__copied)) === '');

  /* 填了基址：出链接，且复制到的确实是 share.html#v1.*，解回来干净 */
  await page.evaluate(() => localStorage.setItem('tn_share_base', 'http://example.org/trace'));
  await page.evaluate(() => window.plannerShare());
  await sleep(400);
  const card2 = await page.$eval('.ui-modal-text', el => el.innerText).catch(() => '');
  const okLabel = await page.$eval('.ui-modal-mask .ui-btn-primary', el => el.textContent.trim()).catch(() => '');
  ok('填基址后确认卡给出 share.html 落点', /http:\/\/example\.org\/trace\/share\.html/.test(card2), card2.slice(-46));
  ok('确定键文案随分支变（生成链接）', okLabel === '生成链接', okLabel);
  await page.click('.ui-modal-mask .ui-btn-primary');
  await sleep(700);
  const copied = await page.evaluate(() => window.__copied);
  ok('真复制出一条 share.html#v1 链接', /^http:\/\/example\.org\/trace\/share\.html#v1\./.test(copied), copied.slice(0, 50));
  ok('链接长度在聊天软件上限内', copied.length > 40 && copied.length <= 7000, copied.length + ' 字符');
  const toast2 = await page.$eval('.ui-toast', el => el.innerText).catch(() => '');
  ok('复制后 toast 说清去哪粘贴', /链接已复制/.test(toast2), toast2);
  const back = await page.evaluate(u => {
    const p = window.Share.decodePayload(u.split('#')[1]);
    return p ? JSON.stringify(p) : '__解不开__';
  }, copied);
  ok('链接解回来不含游记/照片/密钥字段',
    back !== '__解不开__' && !/photo|"note"|story|aiKey|游记|备注|tn_/.test(back), back.slice(0, 56));
  ok('分享全程没改坏行程也没报错',
    (await page.$$eval('#resultBody .day-card', e => e.length)) === nDays
    && (await page.$$eval('#resultBody .stop', e => e.length)) === nStops && errors.length === errBefore,
    errors.slice(errBefore).join(' | '));

  // 移除一站
  const beforeStop = await page.$$eval('#resultBody .stop', els => els.length);
  await page.evaluate(() => { const b = document.querySelector('#resultBody .mv[aria-label="移除"]'); if (b) b.click(); });
  await sleep(500);
  const afterStop = await page.$$eval('#resultBody .stop', els => els.length);
  ok('移除站点生效', afterStop < beforeStop, beforeStop + ' -> ' + afterStop);

  // 上下移 + 重新排期
  await page.evaluate(() => { const b = document.querySelector('#resultBody .mv[aria-label="上移"]'); if (b) b.click(); });
  await sleep(400);
  await page.evaluate(() => { window.plannerReschedule(); });
  await sleep(800);
  ok('重新排期无报错', await page.$$eval('#resultBody .day-card', els => els.length >= 1));

  /* G11：重新排期是「回到选点页开向导」（plannerReschedule 里 showStage('stagePick')，并把选点页的
     卡片整排藏掉，只留向导盒），结果页此刻本就 display:none——所以必须像用户那样把向导走完再量，
     量到的才是重画后的图。不能走 wizardTo()：它第一下点 #scheduleBtn，而那个按钮这时已被藏起来
     （实测报 "Node is either not clickable"）。这一条复测证明第二次进结果页（renderMap 的第二轮、
     mapGen 已 +1）几何仍然健康，不是只有首屏那一次对。 */
  await page.click('#wNext'); await sleep(400);
  await page.click('#wNext'); await sleep(400);
  await wizardDone(page);
  const g2 = await page.evaluate(MAP_GEOM);
  ok('G11 走完第二次排期后地图几何仍然健康',
    !!g2.svgSize && g2.svgSize !== '0x0' && g2.paths > 0 && g2.pathsZero === 0 &&
    g2.pathsInBox === g2.paths && g2.pins > 0 && g2.pinsInBox === g2.pins && !!g2.mapSize && g2.mapSize === g2.clientSize,
    'svg ' + g2.svgSize + ' / path ' + g2.pathsInBox + '/' + g2.paths + '（零尺寸 ' + g2.pathsZero + '）/ 针脚 ' + g2.pinsInBox + '/' + g2.pins + ' / map ' + g2.mapSize + ' vs 容器 ' + g2.clientSize);

  // 季节校验懒加载（四川 → sc-data.js）不报错
  await sleep(2500);
  const hasBest = await page.evaluate(() => /最佳|月|封路|全年/.test(document.getElementById('resultBody').innerText));
  ok('季节字段回填', hasBest);

  const real = errors.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile/.test(e));
  ok('无 JS 报错', real.length === 0, real.slice(0, 3).join(' | '));

  /* ===== 阶段二：一把尺子（桩掉高德：每段固定回 700 km 真实里程） =====
     桩值刻意与直线折算不同且长到必然拆段，用来判红旧行为：
     ① 日卡里程跟着矩阵走（旧写法日卡恒为 hav×1.35，排线与日卡两本账）；
     ② 长途段另起转场日，任何一天都不超过 14 小时（旧模型能排出 27h 的一天）；
     ③ 向导「按高德路线」真的取数（旧写法只置 preserveOrder，一个请求都不发）；
     ④ 选点阶段取过的矩阵在排期时复用，不再重复打网络。 */
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors2 = [];
  page2.on('pageerror', e => errors2.push('pageerror: ' + e.message));
  page2.on('console', m => { if (m.type() === 'error') errors2.push('console: ' + m.text().slice(0, 200)); });
  await page2.evaluateOnNewDocument(() => {
    window.__TN_AMAP_KEY__ = 'SMOKE_FAKE_KEY';
    window.__distCalls = 0;
    try {
      Object.keys(localStorage)
        .filter(k => /^tn_d_|^tn_rt_/.test(k))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    const realFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (url) {
      const u = String(url || '');
      if (u.indexOf('restapi.amap.com') >= 0 && u.indexOf('direction/driving') >= 0) {
        if (u.indexOf('extensions=base') >= 0) window.__distCalls++;
        return Promise.resolve({ json: () => Promise.resolve({ status: '1', infocode: '10000', route: { paths: [{ distance: '700000', steps: [] }] } }) });
      }
      return realFetch ? realFetch.apply(window, arguments) : Promise.reject(new Error('fetch unavailable'));
    };
  });
  await page2.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  await page2.type('#promptInput', '我想去川西玩5天，喜欢自然风光');
  await page2.click('#genBtn');
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    await page2.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await sleep(400);

  const distCalls = () => page2.evaluate(() => window.__distCalls);
  const tripProbe = () => page2.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem('tn_planner_state') || '{}').trip || null; } catch (e) { return null; }
  });

  await page2.evaluate(() => window.plannerAmapPlan());
  const got3Pairs = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 25000) { if (await distCalls() >= 3) return true; await sleep(200); } return false; })();
  ok('真实里程矩阵按站数取足段数', got3Pairs, '取数 ' + await distCalls() + ' 次（3 站应 3 段）');
  await sleep(1200);
  const estDays2 = await page2.evaluate(() => {
    const m = /预计 <b>(\d+)<\/b> 天/.exec(document.getElementById('summInfo').innerHTML);
    return m ? +m[1] : -1;
  });
  await page2.evaluate(() => window.plannerCloseBrowse());
  await wizardTo(page2, 3);
  ok('有 Key 时向导默认按高德路线', await page2.evaluate(() => /primary/.test((document.getElementById('wSortAmap') || {}).className || '')));
  await page2.click('#wNext');
  await sleep(300);
  const callsBefore = await distCalls();
  await page2.click('#wDone');
  await sleep(1600);
  ok('进入结果阶段（矩阵档）', await page2.evaluate(() => document.getElementById('stageResult').style.display === 'block'));
  ok('排期复用已取矩阵，不重复取数', await distCalls() === callsBefore, '取数 ' + callsBefore + ' → ' + await distCalls());

  const trip2 = await tripProbe();
  ok('行程带真实里程矩阵', !!(trip2 && trip2.dist && Object.keys(trip2.dist).length >= 3), trip2 ? Object.keys(trip2.dist || {}).length + ' 段' : 'trip 未落盘');
  const matrixAll700 = !!(trip2 && trip2.dist && Object.keys(trip2.dist).every(k => Math.abs(trip2.dist[k] - 700) < 0.01));
  ok('矩阵里程来自高德（桩值 700km）', matrixAll700);
  const dayN2 = await page2.$$eval('#resultBody .day-card', els => els.length);
  ok('预计天数=真实里程排期天数', estDays2 === dayN2 && dayN2 >= 2, '预计 ' + estDays2 + ' / 实际 ' + dayN2);
  const maxH = trip2 ? Math.max(...trip2.days.map(d => d.totalH)) : 999;
  ok('没有任何一天超过 14 小时', maxH <= 14.01, '最长 ' + maxH.toFixed(1) + 'h');
  ok('长途段独立成转场日', !!(trip2 && trip2.days.some(d => d.transit)), trip2 ? trip2.days.filter(d => d.transit).length + ' 个转场日' : '');
  /* 日卡里程必须等于矩阵里程（700km 拆成 350 的整数份），旧口径的 hav×1.35 不可能整除 */
  const rulerOk = !!(trip2 && trip2.days.length && trip2.days.every(d => {
    const r = d.driveKm % 350;
    return r < 0.01 || 350 - r < 0.01;
  }));
  ok('日卡里程与排线同一把尺子', rulerOk, trip2 ? trip2.days.map(d => Math.round(d.driveKm)).join('/') + ' km' : '');
  ok('转场日渲染为赶路日且不给导航按钮', await page2.evaluate(() => {
    const t = document.querySelector('#resultBody .day-card.transit');
    return !!t && /赶路日/.test(t.innerText) && !t.querySelector('button');
  }));

  const real2 = errors2.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile/.test(e));
  ok('矩阵档无 JS 报错', real2.length === 0, real2.slice(0, 3).join(' | '));

  /* 单站日：起点若照抄唯一点位，高德会报「起点与终点相同」而无法导航 */
  const single = await page2.evaluate(() => {
    const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? m[1] : null; };
    const t = JSON.parse(sessionStorage.getItem('tn_planner_state') || '{}').trip;
    if (!t) return null;
    for (let i = 0; i < t.days.length; i++) {
      const d = t.days[i];
      if (d.stops && d.stops.length === 1) {
        const u = window.plannerNavUrls(i);
        if (!u) return null;
        return { slat: q(u.deep, 'slat'), dlat: q(u.deep, 'dlat') };
      }
    }
    return null;
  });
  ok('单站日不出现起终点同点', !single || single.slat === null || single.slat !== single.dlat,
    single ? 'slat=' + single.slat + ' dlat=' + single.dlat : '无单站日，跳过');

  /* ===== 阶段三：发送至高德的链接必须能被高德接受 =====
     高德文档要求 vian/vialons/vialats/vianames 四个参数数量一致，缺一即整组途经点被丢弃
     （表现就是「多站的一天发到高德后不显示途经地」）；新版 web URI 的途经点参数叫 via，
     waypoints 这个参数名根本不存在，会被静默忽略。
     桩里程刻意取 20km（一天塞得下 6 站），保证一定出现多站日，不依赖候选的地理分布。 */
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors3 = [];
  page3.on('pageerror', e => errors3.push('pageerror: ' + e.message));
  page3.on('console', m => { if (m.type() === 'error') errors3.push('console: ' + m.text().slice(0, 200)); });
  await page3.evaluateOnNewDocument(() => {
    window.__TN_AMAP_KEY__ = 'SMOKE_FAKE_KEY';
    try { Object.keys(localStorage).filter(k => /^tn_d_|^tn_rt_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    const realFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (url) {
      const u = String(url || '');
      if (u.indexOf('restapi.amap.com') >= 0 && u.indexOf('direction/driving') >= 0) {
        return Promise.resolve({ json: () => Promise.resolve({ status: '1', infocode: '10000', route: { paths: [{ distance: '20000', steps: [] }] } }) });
      }
      return realFetch ? realFetch.apply(window, arguments) : Promise.reject(new Error('fetch unavailable'));
    };
  });
  await page3.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  await page3.type('#promptInput', '我想去川西玩1天，喜欢自然风光');
  await page3.click('#genBtn');
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    await page3.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await sleep(400);
  await wizardTo(page3, 3);
  await wizardDone(page3);
  await page3.waitForFunction(() => {
    const t = JSON.parse(sessionStorage.getItem('tn_planner_state') || '{}').trip;
    return !!(t && t.days && t.days.length);
  }, { timeout: 20000 }).catch(() => {});
  const navProbe = await page3.evaluate(() => {
    const t = JSON.parse(sessionStorage.getItem('tn_planner_state') || '{}').trip;
    if (!t) return null;
    const out = [];
    t.days.forEach((d, i) => {
      const u = window.plannerNavUrls(i);
      if (u && d.stops) out.push({ n: d.stops.length, names: d.stops.slice(1, -1).map(s => String(s.name)), deep: u.deep, web: u.web });
    });
    return out.length ? out : null;
  });
  const maxN = navProbe ? Math.max.apply(null, navProbe.map(p => p.n)) : 0;
  ok('造出多站日' + (navProbe ? '（最多 ' + maxN + ' 站 / 共 ' + navProbe.length + ' 天可导航）' : ''), !!(navProbe && maxN >= 3));
  if (navProbe) {
    const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? m[1] : null; };
    const list = v => (v == null || v === '' ? [] : v.split('|'));
    /* 逐日全查：vian 等于中间站数，且 lon/lat/name 三条队列与它同长、名字逐一对得上 */
    const bad = navProbe.filter(p => {
      const vian = +(q(p.deep, 'vian') || 0);
      const names = list(q(p.deep, 'vianames'));
      const lens = [list(q(p.deep, 'vialons')).length, list(q(p.deep, 'vialats')).length, names.length];
      const mid = Math.max(0, p.n - 2);
      return vian !== mid || !lens.every(x => x === vian) ||
        names.map(decodeURIComponent).join(',') !== p.names.join(',');
    });
    ok('每日深链的四参数数量一致且名称对应', bad.length === 0,
      navProbe.length + ' 天，异常 ' + bad.length + ' 天 [vian=' + bad.map(p => q(p.deep, 'vian')).join(',') + ']');
    const noViaWeb = navProbe.filter(p => p.n > 2 && (p.web.indexOf('waypoints') >= 0 || !/[?&]via=/.test(p.web)));
    ok('网页兜底用文档参数 via，不用 waypoints', noViaWeb.length === 0, noViaWeb.length + ' 天异常');
    ok('链接不含未编码空格或裸中文', navProbe.every(p => !/[ \u4e00-\u9fa5]/.test(p.deep) && !/[ \u4e00-\u9fa5]/.test(p.web)));
    const sameXY = navProbe.filter(p => { const s = q(p.deep, 'slat'), e = q(p.deep, 'dlat'); return s && s === e; });
    ok('不存在起终点同点的一天', sameXY.length === 0, sameXY.length + ' 天');
  }
  const real3 = errors3.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile/.test(e));
  ok('导航档无 JS 报错', real3.length === 0, real3.slice(0, 3).join(' | '));

  /* ===== 阶段四（批次 10 · P1-6）：日卡天气位 =====
     三种网络口径各开一个页面，因为「静默降级」最容易骗人的地方就是只测取到数的那一次：
     取不到时到底是不显示，还是留一个空位、弹一个 toast，只有真断网那天看得出来。
     缓存必须逐页清：file:// 同源共享 localStorage，不清的话后一个页面直接命中前一个页面
     取回的天气，「一天到底发几个请求」这条就永远数不出来。 */
  const wxDay = n => {
    const d = new Date(); d.setHours( 0, 0, 0, 0); d.setDate(d.getDate() + n);
    const z = x => (x < 10 ? '0' : '') + x;
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  };
  async function wxOpen(mode, offset) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await p.evaluateOnNewDocument(m => {
      try {
        Object.keys(localStorage)
          .filter(k => /^tn_weather_|^tn_d_|^tn_rt_/.test(k))
          .forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('tn_planner_weather');
      } catch (e) {}
      window.__wxCalls = 0; window.__wxUrls = []; window.__wxMode = m;
      const realFetch = window.fetch ? window.fetch.bind(window) : null;
      window.fetch = function (url) {
        const u = String(url || '');
        if (u.indexOf('api.open-meteo.com') >= 0) {
          window.__wxCalls++; window.__wxUrls.push(u);
          if (window.__wxMode === 'down') return Promise.reject(new TypeError('Failed to fetch'));
          if (window.__wxMode === 'junk') return Promise.resolve({ json: () => Promise.resolve({ daily: {} }) });
          if (window.__wxMode === 'rate') {
            const seen = window.__wxSeen || (window.__wxSeen = {});
            seen[u] = (seen[u] || 0) + 1;
            if (seen[u] === 1) return Promise.resolve({ status: 429, json: () => Promise.resolve({}) });
          }
          const day = (/start_date=([\d-]+)/.exec(u) || [])[1] || '';
          return Promise.resolve({
            json: () => Promise.resolve({
              daily: { time: [day], weathercode: [61], temperature_2m_max: [19.4], temperature_2m_min: [8.2] }
            })
          });
        }
        return realFetch ? realFetch.apply(window, arguments) : Promise.reject(new Error('fetch unavailable'));
      };
    }, mode);
    await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    await p.type('#promptInput', '我想去川西玩3天，喜欢自然风光');
    await p.click('#genBtn');
    await sleep(1500);
    for (let i = 0; i < 3; i++) {
      await p.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
      await sleep(150);
    }
    await sleep(400);
    await p.evaluate(d => { const el = document.getElementById('intentDate'); el.value = d; }, wxDay(offset));
    await wizardTo(p, 3);
    await wizardDone(p);   /* 它尾部那 1600ms 固定睡眠留着（历史行为），但取样正确性不再依赖它——见下面 dayN 的 poll */
    /* dayN 是下面一串阈值的分母（calls >= dayN、cacheKeys.length === dayN、wxN === dayN），
       所以它必须是「渲染落定之后」的计数，不能是 wizardDone 那个固定 1600ms 之后的一次性读数。
       实测（tools/out/b13-smoke-planner.txt）同一份代码两次跑出 0 和 3：读到 0 那次
       「排好行程后按天发起天气请求」变成「请求 0 次 / 0 天」的**假绿**，而 0>=0 恒真，
       后面 4 条全红才被看见。与批次 12／13-E 同一条教训：取样 poll 到两轮相等，
       并且阈值分母自己要带下界——「没东西可测」永远不许是绿。 */
    const dayFirst = await p.$$eval('#resultBody .day-card', els => els.length);
    let dayN = dayFirst, dayPrev = -1;
    for (let t = 0; t < 50; t++) {
      dayPrev = dayN;
      dayN = await p.$$eval('#resultBody .day-card', els => els.length);
      if (dayN > 0 && dayN === dayPrev) break;
      await sleep(200);
    }
    const calls = () => p.evaluate(() => window.__wxCalls);
    const wxN = () => p.$$eval('#resultBody .day-card .wx', els => els.length);
    const slotN = () => p.$$eval('#resultBody .day-card .wxh', els => els.length);
    const clean = () => errs.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile|Failed to fetch/.test(e));
    const dcLat = await p.evaluate(() => window.__dcLat);
    return { p, errs, dayN, dayFirst, dcLat, calls, wxN, slotN, clean };
  }

  /* --- 口径①：日期在预报窗口内，一天一个请求，取回来就落在当天日卡上 --- */
  const w1 = await wxOpen('ok', 0);
  const gotWx = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 20000) { if (await w1.calls() >= w1.dayN) return true; await sleep(200); } return false; })();
  ok('排好行程后按天发起天气请求', w1.dayN >= 1 && gotWx && (await w1.calls()) >= w1.dayN, '请求 ' + await w1.calls() + ' 次 / ' + w1.dayN + ' 天（落定前首读 ' + w1.dayFirst + '，首张日卡在末步点击后 ' + w1.dcLat + 'ms 进 DOM）');
  await sleep(800);
  const wxCells = await w1.wxN();
  ok('每个日卡都有天气位', wxCells === w1.dayN && wxCells >= 1, wxCells + ' 个 .wx / ' + w1.dayN + ' 张日卡');
  ok('天气位取数完不留空槽', await w1.slotN() === 0, '残留 .wxh ' + await w1.slotN() + ' 个');
  const wxText = await w1.p.evaluate(() => {
    const e = document.querySelector('#resultBody .day-card .wx');
    return e ? { txt: e.textContent.trim(), title: e.getAttribute('title'), svg: !!e.querySelector('svg'), label: e.getAttribute('aria-label') } : null;
  });
  ok('温度文案为「最低~最高°」（19.4/8.2 取整）', !!wxText && wxText.txt === '8~19°', wxText ? JSON.stringify(wxText.txt) : '无天气位');
  ok('title 带 WMO 61 的中文口径', !!wxText && wxText.title === '小雨 8~19°', wxText ? wxText.title : '');
  ok('字形走 SVG 图标，不是 emoji', !!wxText && wxText.svg === true);
  const wxUrls = await w1.p.evaluate(() => window.__wxUrls);
  ok('请求参数是三字段 + 同一天首尾 + 免 Key', wxUrls.length >= 1 && wxUrls.every(u =>
    u.indexOf('api.open-meteo.com') >= 0 &&
    u.indexOf('daily=weathercode,temperature_2m_max,temperature_2m_min') >= 0 &&
    u.indexOf('timezone=auto') >= 0 && /key=|appid=/i.test(u) === false &&
    /&start_date=[\d-]+&end_date=\d{4}-\d{2}-\d{2}/.test(u) &&
    (() => { const s = /start_date=([\d-]+)/.exec(u)[1], e = /end_date=([\d-]+)/.exec(u)[1]; return s === e; })()
  ), wxUrls.length ? wxUrls[0].slice(0, 150) : '一个请求都没发');
  const daysSent = await w1.p.evaluate(() => window.__wxUrls.map(u => /start_date=([\d-]+)/.exec(u)[1]).sort());
  const daysWant = []; for (let i = 0; i < w1.dayN; i++) daysWant.push(wxDay(i));
  ok('逐日按出发日期往后推，不是每天都问同一天', daysSent.length >= 1 && daysSent.length === w1.dayN && daysSent.join(',') === daysWant.sort().join(','), daysSent.join(','));
  const cacheKeys = await w1.p.evaluate(() => Object.keys(localStorage).filter(k => /^tn_weather_d_/.test(k)));
  ok('缓存键含坐标与日期（跨日不会复用昨天的数）', cacheKeys.length >= 1 && cacheKeys.length === w1.dayN && cacheKeys.every(k => /^tn_weather_d_-?\d+\.\d+_-?\d+\.\d+_\d{4}-\d{2}-\d{2}$/.test(k)), cacheKeys[0] || '无缓存键');
  /* 重渲染走旅行模式开关：它只调 renderDaysBody，不像增删站点那样换掉首站坐标，
     换了坐标就等于换了缓存键，「命中缓存不再打网络」这条会被悄悄测歪 */
  const c1 = await w1.calls();
  await w1.p.evaluate(() => window.plannerStartTrip());
  await sleep(700);
  ok('重渲染命中缓存，不再打网络', await w1.calls() === c1 && await w1.wxN() === w1.dayN, '请求 ' + c1 + ' → ' + await w1.calls());
  await w1.p.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });
  await sleep(400);
  const fit = await w1.p.evaluate(() => {
    const boxes = [...document.querySelectorAll('#resultBody .day-card .wx')].map(e => {
      const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width };
    });
    return { pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth, n: boxes.length, inView: boxes.filter(b => b.w > 0 && b.l >= -0.5 && b.r <= window.innerWidth + 0.5).length };
  });
  ok('320px 窄屏：日卡不横向溢出且天气位不挤出屏幕', fit.pageOver <= 0 && fit.n === fit.inView && fit.n > 0, '溢出 ' + fit.pageOver + 'px，天气位 ' + fit.inView + '/' + fit.n + ' 在屏内');
  /* 开关关掉：一个槽都不该铺，一个请求都不该发（关掉功能还偷偷打网络是最难查的那种） */
  const c2 = await w1.calls();
  await w1.p.evaluate(() => { localStorage.setItem('tn_planner_weather', '0'); window.plannerStartTrip(); });
  await sleep(700);
  ok('关掉开关后无天气位也无请求', await w1.wxN() === 0 && await w1.slotN() === 0 && await w1.calls() === c2, '.wx ' + await w1.wxN() + ' / .wxh ' + await w1.slotN() + ' / 请求 ' + c2 + ' → ' + await w1.calls());
  ok('天气正常态无 JS 报错', w1.clean().length === 0, w1.clean().slice(0, 2).join(' | '));

  /* --- 口径②：日期超出预报窗口，不猜、不问、不留位 --- */
  const w2 = await wxOpen('ok', 40);
  await sleep(1500);
  ok('超出预报期：一个天气请求都不发', w2.dayN >= 1 && await w2.calls() === 0, '发了 ' + await w2.calls() + ' 次 / ' + w2.dayN + ' 张日卡（首读 ' + w2.dayFirst + '）');
  ok('超出预报期：日卡既不显示也不留空位', await w2.wxN() === 0 && await w2.slotN() === 0, '.wx ' + await w2.wxN() + ' / .wxh ' + await w2.slotN());
  ok('没到窗口内的日子不出现「天气」话术', await w2.p.evaluate(() => (document.getElementById('resultBody').innerText || '').indexOf('天气') < 0));
  ok('超预报期档无 JS 报错', w2.clean().length === 0, w2.clean().slice(0, 2).join(' | '));

  /* --- 口径③：坏包与断网都必须当这件事没发生 --- */
  const w3 = await wxOpen('junk', 1);
  await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { if (await w3.calls() >= w3.dayN) break; await sleep(200); } })();
  await sleep(800);
  ok('接口回坏包时会铺槽而不是硬留空', w3.dayN >= 1 && await w3.slotN() === w3.dayN && await w3.wxN() === 0, '.wxh ' + await w3.slotN() + ' / .wx ' + await w3.wxN() + ' / ' + w3.dayN + ' 张日卡（首读 ' + w3.dayFirst + '）');
  const hidden = await w3.p.evaluate(() => [...document.querySelectorAll('#resultBody .day-card .wxh')]
    .map(e => getComputedStyle(e).display + ':' + e.offsetWidth));
  ok('未取到的槽不占位（display:none / 宽 0）', hidden.length > 0 && hidden.every(h => h === 'none:0'), hidden.slice(0, 2).join(' | '));
  const c3 = await w3.calls();
  await w3.p.evaluate(() => {
    window.__wxMode = 'down';
    Object.keys(localStorage).filter(k => /^tn_weather_/.test(k)).forEach(k => localStorage.removeItem(k));
    window.plannerStartTrip();
  });
  await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { if (await w3.calls() >= c3 + w3.dayN) break; await sleep(200); } })();
  await sleep(800);
  ok('断网时按天各试一次（说明确实在取，不是压根没接线）', w3.dayN >= 1 && await w3.calls() >= c3 + w3.dayN, '请求 ' + c3 + ' → ' + await w3.calls() + ' / ' + w3.dayN + ' 天');
  const quietMsg = await w3.p.evaluate(() => (document.getElementById('resultBody').innerText || '').match(/天气|重试|失败|加载/g));
  ok('断网后日卡不出温度、不出「重试/加载失败」话术', await w3.wxN() === 0 && !quietMsg, quietMsg ? quietMsg.join(',') : '零话术');
  ok('坏包/断网档无 JS 报错', w3.clean().length === 0, w3.clean().slice(0, 2).join(' | '));

  /* --- 口径④：被限流（429）要退避重试，而不是那天就没天气了 --- */
  const w4 = await wxOpen('rate', 2);
  await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 25000) { if (await w4.wxN() >= w4.dayN) break; await sleep(300); } })();
  const w4n = await w4.wxN();
  ok('429 退避后天气仍然补上了', w4.dayN >= 1 && w4n === w4.dayN, '.wx ' + w4n + ' / ' + w4.dayN + ' 张日卡（首读 ' + w4.dayFirst + '）');
  const w4c = await w4.calls();
  ok('限流是真重试（每天至少再试一次），不是只发一次就放弃', w4.dayN >= 1 && w4c >= w4.dayN * 2, '请求 ' + w4c + ' 次 / ' + w4.dayN + ' 天');
  ok('限流档不留残槽', await w4.slotN() === 0, '.wxh ' + await w4.slotN());
  ok('限流档无 JS 报错', w4.clean().length === 0, w4.clean().slice(0, 2).join(' | '));

  /* ===== 阶段五（批次 11 · P2-8）：用户画像进 AI 精选路线 =====
     判据落在「真发出去的请求体」上，而不是 prefSummary() 的返回值上——返回值对、
     拼串时漏了是看不出来的。桩只写在测试里（拦 fetch），生产代码零注入点。
     三口径：有历史+默认开 / 关掉开关 / 新用户零历史。 */
  const SECRET = '酸汤鱼的具体味道只有我自己知道';   // 游记正文里的独有句子，用来钉「正文不出门」
  const SEED = {
    trips: [{ id: 'p2-8', name: '画像验证一日', createdAt: 1759000000000, dest: '山西', startDate: '2026-09-28',
      days: [{ date: '2026-09-28', driveKm: 30, driveH: 0.6, playH: 5, totalH: 5.6, stops: [
        { name: '鹳雀楼', city: '运城市', lat: 34.84, lng: 110.49 },
        { name: '普救寺', city: '运城市', lat: 34.85, lng: 110.46 }] }] }],
    wish: [
      { id: 'w1', label: '黄山', theme: '名山大川', region: '安徽', city: '黄山市', lat: 30.1, lng: 118.16, ts: 1759100000000, visited: 0 },
      { id: 'w2', label: '华山', theme: '名山大川', region: '陕西', city: '渭南市', lat: 34.48, lng: 110.09, ts: 1759100000100, visited: 0 },
      { id: 'w3', label: '武当山', theme: '名山大川', region: '湖北', city: '十堰市', lat: 32.4, lng: 111.0, ts: 1759100000200, visited: 0 },
      { id: 'w4', label: '平遥古城', theme: '古城古镇', region: '山西', city: '晋中市', lat: 37.2, lng: 112.18, ts: 1759100000300, visited: 0 },
      { id: 'w5', label: '镇远古镇', theme: '古城古镇', region: '贵州', city: '黔东南', lat: 27.05, lng: 108.4, ts: 1759100000400, visited: 0 },
      { id: 'w6', label: '五台山', theme: '宗教圣地', region: '山西', city: '忻州市', lat: 39.08, lng: 113.55, ts: 1759100000500, visited: 1759100099000 },
      { id: 'w7', label: '鼓浪屿', theme: '海岛海滩', region: '福建', city: '厦门市', lat: 24.44, lng: 118.06, ts: 1759100000600, visited: 0 }
    ],
    notes: [
      { id: 'n1', title: '鹳雀楼看日落', siteName: '鹳雀楼', ts: 1759200000000, date: '2026-09-29', province: '山西省', city: '运城市', tags: ['日落', '徒步'], text: SECRET, raw: '口述' },
      { id: 'n2', title: '永济闲走', siteName: '普救寺', ts: 1759100000000, date: '2026-09-28', province: '山西省', city: '运城市', tags: ['古建'], text: '另一篇正文' }
    ]
  };

  async function aiOpen(withData) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await p.evaluateOnNewDocument(seed => {
      /* 有 Key 才走 AI 分支：Key 是假的，请求在下面被拦掉，一个字节都不出门 */
      localStorage.setItem('tn_aiSite', 'deepseek');
      localStorage.setItem('tn_key_deepseek', 'sk-smoke-fake-never-sent');
      localStorage.removeItem('tn_plan_pref');
      localStorage.setItem('tn_planner_weather', '0');
      /* file:// 同源共享 localStorage 与 IDB：新用户档必须真清场，
         否则上一档的种子数据会跟着过来，「画像省略」那条永远测不出来 */
      if (seed) {
        localStorage.setItem('tn_trips', JSON.stringify(seed.trips));
        localStorage.setItem('tn_wishlist', JSON.stringify(seed.wish));
      } else {
        localStorage.removeItem('tn_trips');
        localStorage.removeItem('tn_wishlist');
      }
      window.__aiBodies = [];
      const realFetch = window.fetch ? window.fetch.bind(window) : null;
      window.fetch = function (url, opt) {
        const u = String(url || '');
        if (u.indexOf('chat/completions') >= 0) {
          window.__aiBodies.push(String((opt && opt.body) || ''));
          const payload = { routes: [1, 2, 3, 4, 5].map(i => ({ name: '线路' + i, why: '亮点' + i, days: [['鹳雀楼'], ['普救寺']] })) };
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
        }
        return realFetch ? realFetch.apply(window, arguments) : Promise.reject(new Error('fetch unavailable'));
      };
    }, withData ? SEED : null);
    await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    /* 游记走 sanctioned 的全量替换口（backup.js 恢复用的就是它），内存立刻可见，不用等 IDB 回读 */
    await p.evaluate(n => { window.TravelNotes.replaceNotes(n); }, withData ? SEED.notes : []);
    const clean = () => errs.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile|Failed to fetch/.test(e));
    /* 生成一次并把请求体捞回来（#arBtn 在输入阶段里，直接 .click() 免得受视口/滚动影响） */
    async function gen() {
      await p.evaluate(() => {
        window.__aiBodies.length = 0;
        document.getElementById('arDest').value = '山西';
        document.getElementById('arDays').value = '3';
        document.getElementById('arBtn').click();
      });
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) { if (await p.evaluate(() => window.__aiBodies.length > 0)) break; await sleep(200); }
      await sleep(500);
      return {
        body: await p.evaluate(() => window.__aiBodies[0] || ''),
        n: await p.evaluate(() => document.querySelectorAll('#aiRouteOut .aroute').length)
      };
    }
    return { p, errs, clean, gen };
  }

  const a1 = await aiOpen(true);
  const r1 = await a1.gen();
  ok('有历史数据时 AI 请求体带上「用户画像」段', /用户画像/.test(r1.body), r1.body ? '请求体 ' + r1.body.length + ' 字' : '一个请求都没发出去');
  const inBody = ['山西', '运城市', '名山大川', '日落'].filter(w => r1.body.indexOf(w) >= 0);
  ok('画像是聚合出来的：省 / 市 / 心愿单主题 / 近期关键词逐个在体里', inBody.length === 4, '命中 ' + inBody.join('、'));
  ok('画像只出门送关键词，游记正文一个字都不发', r1.body.indexOf(SECRET) < 0 && r1.body.indexOf('另一篇正文') < 0);
  ok('画像进了 prompt，5 条备选照样出得来', r1.n === 5, '.aroute ' + r1.n + ' 张');
  await a1.p.evaluate(() => localStorage.setItem('tn_plan_pref', '0'));
  const r2 = await a1.gen();
  ok('关掉开关：请求体里一个画像字都没有', /用户画像/.test(r2.body) === false && r2.body.indexOf(SECRET) < 0, r2.body ? '请求体 ' + r2.body.length + ' 字' : '无请求');
  ok('关开关只砍画像，目的地/天数/偏好照旧在', r2.body.indexOf('为「山西」设计 5 条互相不重复的 3 天') >= 0 && /景点偏好/.test(r2.body));
  ok('开关档无 JS 报错', a1.clean().length === 0, a1.clean().slice(0, 2).join(' | '));

  const a2 = await aiOpen(false);
  const r3 = await a2.gen();
  ok('新用户零历史：画像段整段省略（不写「去过 无」这种废话）', r3.body && /用户画像/.test(r3.body) === false, r3.body.slice(0, 40));
  ok('新用户零历史：生成不报错且出满 5 条', a2.clean().length === 0 && r3.n === 5, '.aroute ' + r3.n + ' 张 / 报错 ' + a2.clean().length + ' 条');

  await browser.close();
  console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
