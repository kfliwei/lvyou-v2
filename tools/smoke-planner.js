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
  await p.click('#wDone');
  await sleep(1600);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
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

  await browser.close();
  console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
