/* tools/smoke-nearby.js — 批次 21「这一带还有什么」浏览器闸门
 *
 * 钉的是四件事，不是「有没有列表」：
 *   ① 断网时第一答案必须来自包内索引，且**一次网络请求都不发**（这是本批的立论：
 *      Overpass 是补位不是主源；把它挪到内置腿之前，这条立刻红）；
 *   ② 结果面板的「来源口径」必须写在 DOM 里——内置就写内置，实时才写 LIVE_NOTE，
 *      失败/超时要写「没返回」，三者不许含糊（用户分不清「这一带真的没有」还是「没网没查」）；
 *   ③ 这颗 chip 不许改变地图的默认点击语义：没武装时点图仍是随手记，武装后取一次点自动复位；
 *   ④ 452×995 真机档下面板不溢出、行高 ≥44px、不压住刚点下去的圆心。
 *
 * 网络腿用桩 fetch 喂罐头 Overpass 响应（条数/来源/超时都能逐值断言，不靠公网运气），
 * 超时腿用挂起的 Promise 真等满 8s（时长读产品常量 Nearby.OVERPASS_TIMEOUT_MS，闸门不写死）。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-nearby.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TOPIC = 'file:///' + path.join(ROOT, 'topic.html').replace(/\\/g, '/');
const VW = 452, VH = 995;                 /* 一加 Ace 6T 真机档 */

let fails = 0, checks = 0, netNoise = 0;
function ok(name, cond, extra) {
  checks++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']'));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 观测点挂在产品自己的对象上：queryNearby 记录圆心与半径（点下去的 latlng 只有它知道），
   fetch 记录联网次数与请求体，__stub/__fail/__hang 控制网络腿的三种结局。
   另外先抹掉「地图视角按主题恢复」的落盘（tn_mappos_*）：产品确实会恢复上次视角，
   但闸门每一组都必须从页面自己的默认视角起步——否则东京那一组跑完，后一组就继承到
   zoom 12 的东京视野，内置索引在里面一条都命中不了（实测 N40b 就是这么取不到点的）。 */
const INIT = () => {
  try {
    Object.keys(localStorage).filter(k => k.indexOf('tn_mappos_') === 0).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  window.__spy = { calls: [], overpass: 0, bodies: [] };
  const rf = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (u, o) {
    if (String(u).indexOf('overpass') < 0) return rf ? rf(u, o) : Promise.reject(new Error('no fetch'));
    window.__spy.overpass++;
    window.__spy.bodies.push(o && o.body ? String(o.body) : '');
    if (window.__spy.hang) return new Promise(() => {});
    if (window.__spy.fail) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ elements: (window.__stub || []).map(e => ({ type: 'node', lat: e.lat, lon: e.lng, tags: { tourism: 'attraction', name: e.name } })) })
    });
  };
};

async function boot(browser, q, errs) {
  const p = await browser.newPage();
  await p.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  /* 断网腿与这台机器本就没有的外网瓦片一定会刷 net::ERR_* 的资源日志，那是环境噪声不是页面缺陷；
     但 404/5xx 这类「服务器答了但答错了」仍然算错误——闸门不许把它们一起滤掉。 */
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/^Failed to load resource: net::ERR_/.test(t)) { netNoise++; return; }
    errs.push('console: ' + t.slice(0, 160));
  });
  await p.evaluateOnNewDocument(INIT);
  await p.goto(TOPIC + '?p=' + q, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map && window.Nearby)', { timeout: 30000 });
  await p.evaluate(() => {
    const real = window.Nearby.queryNearby;
    window.Nearby.queryNearby = function (lat, lng, km, cats, cb, ex) {
      window.__spy.calls.push({ lat: +lat, lng: +lng, km: +km, ex: ex || null });
      return real.apply(null, arguments);
    };
    const m = document.getElementById('map');
    if (m && !m.classList.contains('active')) {
      const b = document.querySelector('.tabbar button[data-tab="map"]');
      if (b) b.click();
    }
  });
  await sleep(900);
  return p;
}

/* 取样：种子一律取自**产品自己那份索引**（Nearby.nearbySites 的 rows），不读 window.SITES——
   省页的 SITES 里 486 条只有 3 条带经纬度（上一版按步长抽样，正好把有坐标的三条全跳过了，
   于是 N24 永远取不到点）。种子先投影再筛：只有落在视野内、且满足 minHits 的才去试偏移像素。
   band=[下界比例,上界比例]（占地图容器高度）时只在该纵向带内取，用来自证下半屏的抬心逻辑。 */
const OFFS = [[0, 0], [26, -18], [-30, 22], [34, 30], [-22, -26], [52, 10], [-54, -6], [10, -48], [-14, 50], [70, -30], [-68, 40], [44, -62], [-46, -58]];
let lastScan = null;   /* 取不到点时把扫描实况打出来，否则「null」这条红下次还是查不下去 */
async function scan(p, km, minHits, band) {
  return p.evaluate((r, n, offs, bd) => {
    const m = window.TopicEngine._map, mc = m.getContainer(), cr = mc.getBoundingClientRect();
    const ctr = m.getCenter();
    const seeds = window.Nearby.nearbySites(ctr.lat, ctr.lng, 20000).slice(0, 1200);
    const blocked = {}; let onscreen = 0;
    for (let si = 0; si < seeds.length; si += 3) {
      const s = seeds[si];
      const cp = m.latLngToContainerPoint({ lat: s.lat, lng: s.lng });
      if (cp.x < 8 || cp.y < 8 || cp.x > cr.width - 8 || cp.y > cr.height - 8) continue;
      onscreen++;
      if (bd && (cp.y < cr.height * bd[0] || cp.y > cr.height * bd[1])) continue;
      for (let oi = 0; oi < offs.length; oi++) {
        const x = Math.round(cp.x + offs[oi][0]), y = Math.round(cp.y + offs[oi][1]);
        if (x < 8 || y < 8 || x > cr.width - 8 || y > cr.height - 8) continue;
        if (bd && (y < cr.height * bd[0] || y > cr.height * bd[1])) continue;
        const el = document.elementFromPoint(cr.left + x, cr.top + y);
        const cls = !el ? 'null' : (el.id ? '#' + el.id : (typeof el.className === 'string' ? el.className : el.tagName).slice(0, 30));
        /* 命中元素必须在地图容器内（含容器自身：本环境瓦片不加载，落点常是 #mapEl，
           而 Leaflet 的 click 就绑在容器上——实测照样出半径条。只认 .leaflet-map-pane 会在
           无瓦片时把整页取成 null，那是取样器的假阴性不是产品的缺陷）。
           外层的 tabbar / 统计卡 / 半径条要么容器外、要么走下面这张遮罩名单，两条都算「没点到地图」。 */
        if (!el || !mc.contains(el)) { blocked['out:' + cls] = (blocked['out:' + cls] || 0) + 1; continue; }
        const bad = el.closest('.leaflet-overlay-pane,.leaflet-marker-icon,.leaflet-interactive,.leaflet-popup-pane,.leaflet-control,.tabbar,.region-stats,.tripbar,.ui-toast,.near-sheet,#nearBar,button,a,input,select,canvas');
        if (bad) {
          const bc = bad.id ? '#' + bad.id : String(bad.className).slice(0, 30);
          blocked['ovl:' + bc] = (blocked['ovl:' + bc] || 0) + 1; continue;
        }
        const ll = m.containerPointToLatLng(window.L.point(x, y));
        if (window.Nearby.nearbySites(ll.lat, ll.lng, r).length < n) { blocked['lowhit'] = (blocked['lowhit'] || 0) + 1; continue; }
        return { pt: { x: cr.left + x, y: cr.top + y, lat: ll.lat, lng: ll.lng }, diag: null };
      }
    }
    return { pt: null, diag: { seeds: seeds.length, onscreen: onscreen, band: bd || '-', zoom: m.getZoom(), center: [+ctr.lat.toFixed(2), +ctr.lng.toFixed(2)], blocked: blocked } };
  }, km, (minHits === undefined ? 6 : minHits), OFFS, band || null);
}
async function pickPoint(p, km, minHits, band) {
  const r = await scan(p, km, minHits, band);
  lastScan = r && r.diag ? r.diag : null;
  return r ? r.pt : null;
}

function need(pt, label) {
  if (!pt) { ok(label, false, '找不到满足条件的取样点（先修取样，再谈判据）' + (lastScan ? ' ' + JSON.stringify(lastScan) : '')); throw new Error('no-sample'); }
  return pt;
}

/* 专挑「屏幕下半部」的落点：结果面板就开在那儿，用来自证 raiseCenterClear 真把圆心抬出来了 */
async function pickLow(p, km) {
  return pickPoint(p, km, 6, [0.62, 0.89]);
}

async function toOffline(p) {
  try { await p.setOfflineMode(true); } catch (e) { return 'setOfflineMode 不可用: ' + e.message; }
  return await p.evaluate(() => navigator.onLine === false) ? '' : 'navigator.onLine 仍为 true';
}

async function openSheet(p, ms) {
  /* 谓词必须是函数：puppeteer 把字符串当成**单个表达式** eval，多语句串（带 var/分号）会当场抛错，
     而 .catch(()=>{}) 把它吞掉 → 等待实际为 0ms，量到的永远是上一帧的旧 DOM。
     超时腿（面板 8s 后才出）就是这么被读成「面板没开」的。 */
  await p.waitForFunction(() => {
    const s = document.getElementById('nearSheet');
    return !!(s && s.classList.contains('open'));
  }, { timeout: ms || 6000 }).catch(() => {});
  /* 面板进场动画是 sheet-enter（translateY + scale(.98)）：动画没停就量，量到的是缩放中的盒子，
     行高会读成 43.x 的假阴性（批次 13/20 同一条坑）。先等动画停，再逐枚量。 */
  await p.evaluate(async () => {
    const sh = document.getElementById('nearSheet');
    if (!sh) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      let running = false;
      try { running = sh.getAnimations({ subtree: true }).some(a => a.playState === 'running'); } catch (e) { running = false; }
      if (!running) break;
      await new Promise(r => setTimeout(r, 60));
    }
  });
  return p.evaluate(() => {
    const sh = document.getElementById('nearSheet');
    if (!sh) return null;
    const r = sh.getBoundingClientRect();
    const rows = [].slice.call(sh.querySelectorAll('.ni'));
    return {
      open: sh.classList.contains('open'),
      rect: { l: Math.round(r.left), t: Math.round(r.top), rr: Math.round(r.right), b: Math.round(r.bottom) },
      role: sh.getAttribute('role'), aria: sh.getAttribute('aria-label'),
      head: (sh.querySelector('.nh b') || {}).textContent || '',
      src: (sh.querySelector('.nsrc') || {}).textContent || '',
      foot: (sh.querySelector('.nf') || {}).textContent || '',
      empty: !!sh.querySelector('.nz'),
      emptyText: (sh.querySelector('.nz') || {}).textContent || '',
      n: rows.length,
      osm: rows.filter(b => b.classList.contains('osm')).length,
      hs: rows.map(b => Math.round(b.getBoundingClientRect().height)),
      ohs: rows.map(b => b.offsetHeight),
      ds: rows.map(b => { const t = (b.querySelector('.nd') || {}).textContent || ''; return t.indexOf('km') < 0 ? parseFloat(t) / 1000 : parseFloat(t); })
    };
  });
}

(async () => {
  const errs = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });

  /* ============ 组 A：全国页 · 断网 ============ */
  const a = await boot(browser, 'nation', errs);
  const offA = await toOffline(a);
  ok('N01 断网生效（navigator.onLine===false）', offA === '', offA);
  ok('N02 数据层常量逐值（BUILTIN_ENOUGH=4 / 超时 8000 / LIVE_NOTE 整串）', await a.evaluate(() =>
    window.Nearby.BUILTIN_ENOUGH === 4 && window.Nearby.OVERPASS_TIMEOUT_MS === 8000 && window.Nearby.LIVE_NOTE === '以下为实时查询（OSM），离线不可用'));

  const pa = need(await pickPoint(a, 30), 'N03b 全国页取样（内置命中 ≥6 且无标记拦截）');
  ok('N03 找到可点的地图位置（该处内置命中 ≥6 且无标记拦截）', !!pa, pa && pa.x + ',' + pa.y);
  await a.mouse.click(pa.x, pa.y);
  await sleep(300);
  ok('N04 全国页点图即出半径条（#nearBar 可见）', await a.evaluate(() => { const b = document.getElementById('nearBar'); return !!b && getComputedStyle(b).display !== 'none'; }));
  ok('N05 半径档逐值 10/30/50/100km', await a.evaluate(() => [].slice.call(document.querySelectorAll('#nearBar .nk')).map(x => x.textContent).join(',') === '10km,30km,50km,100km'));

  await a.evaluate(() => document.querySelector('#nearBar .nk[data-k="30"]').click());
  const sA = await openSheet(a);
  const kmA = await a.evaluate(() => window.__spy.calls[0].km);
  ok('N06 30km 档出结果面板（.open）', !!sA && sA.open);
  ok('N07 面板头写「这一带 30km」', !!sA && sA.head === '这一带 ' + kmA + 'km', sA && sA.head);
  ok('N08 断网结果全来自包内（行 >0 且零 .osm 行）', !!sA && sA.n > 0 && sA.osm === 0, sA && (sA.n + ' 行/osm ' + sA.osm));
  ok('N09 断网期间 Overpass 请求数 0', await a.evaluate(() => window.__spy.overpass === 0));
  ok('N10 断网时 queryNearby 只调一次（没网也绝不二次补位）', await a.evaluate(() => window.__spy.calls.length === 1));
  ok('N11 来源口径＝内置行（脚注与 nsrc 都不许含糊）', !!sA && sA.foot === '来源：包内景点库，离线可用' && sA.src.indexOf('内置库 · ') === 0, sA && (sA.src + ' | ' + sA.foot));
  ok('N12 每行距离 ≤ 半径', !!sA && sA.ds.length > 0 && sA.ds.every(d => isFinite(d) && d <= kmA), 'r=' + kmA);
  ok('N13 排序＝必去/网红权重优先，同权重内距离升序', await a.evaluate(() => {
    const c = window.__spy.calls[0], W = { m: 2, h: 1 };
    const r = window.Nearby.nearbySites(c.lat, c.lng, c.km);
    let pw = 9, pd = -1, bad = 0;
    r.forEach(x => { const w = W[x.flag] || 0; if (w > pw || (w === pw && x.d < pd - 1e-9)) bad++; pw = w; pd = x.d; });
    return bad === 0 && r.length > 1;
  }));
  const zoomA = await a.evaluate(() => getComputedStyle(document.documentElement).zoom);
  const minOh = sA ? Math.min.apply(null, sA.ohs) : 0, minHs = sA ? Math.min.apply(null, sA.hs) : 0;
  ok('N14 行高全部 ≥44px（触控目标，按布局像素 offsetHeight）', !!sA && sA.ohs.length > 0 && minOh >= 44,
    'offsetHeight min=' + minOh + ' / rect min=' + minHs + ' / html zoom=' + zoomA);
  ok('N15 面板完整落在 452×995 视口内', !!sA && sA.rect.l >= 0 && sA.rect.rr <= VW && sA.rect.t >= 0 && sA.rect.b <= VH, sA && JSON.stringify(sA.rect));
  ok('N16 面板不压住刚点下的圆心', await a.evaluate(() => {
    const c = window.__spy.calls[0], m = window.TopicEngine._map, cr = m.getContainer().getBoundingClientRect();
    const y = m.latLngToContainerPoint({ lat: c.lat, lng: c.lng }).y;
    return cr.top + y < document.getElementById('nearSheet').getBoundingClientRect().top;
  }));
  ok('N17 role=dialog + aria-label「这一带还有什么」', !!sA && sA.role === 'dialog' && sA.aria === '这一带还有什么');

  /* 点在屏幕下半部＝面板一定会盖住它：产品侧 raiseCenterClear 要把圆心抬到面板上沿之上。
     先把上一段的面板与半径条收掉——取样谓词把 .near-sheet/#nearBar 算作遮罩（它们真的会吃掉点击），
     不收就等于要求「下半屏每一枚像素都不许被自己刚开的面板占着」，那永远取不到点。 */
  await a.evaluate(() => { const x = document.getElementById('nearSheetX'); if (x) x.click(); const b = document.getElementById('nearX'); if (b) b.click(); });
  await sleep(300);
  const pl = need(await pickLow(a, 30), 'N17b 下半屏取样点（0.6H 以下、tabbar 以上）');
  await a.mouse.click(pl.x, pl.y);
  await sleep(250);
  await a.evaluate(() => { const ks = [].slice.call(document.querySelectorAll('#nearBar .nk')); ks[ks.length - 1].click(); });
  const sL = await openSheet(a);
  ok('N17c 点在下半屏时圆心被抬到面板上沿之上（不被结果面板盖住）', await a.evaluate(() => {
    const c = window.__spy.calls[window.__spy.calls.length - 1], m = window.TopicEngine._map;
    const mr = m.getContainer().getBoundingClientRect();
    const y = m.latLngToContainerPoint({ lat: c.lat, lng: c.lng }).y;
    return (mr.top + y) < document.getElementById('nearSheet').getBoundingClientRect().top;
  }), sL && (sL.n + ' 行 / 面板上沿 y=' + (sL && sL.rect.t)));

  await a.evaluate(() => document.querySelector('#nearSheet .ni').click());
  await sleep(1000);
  ok('N18 点内置行 → 景点卡打开', await a.evaluate(() => document.getElementById('locSheet').classList.contains('show')));
  ok('N19 点内置行 → 这一带面板与半径条都收起（层级会浮在景点卡上）', await a.evaluate(() => {
    const sh = document.getElementById('nearSheet'), b = document.getElementById('nearBar');
    return !sh.classList.contains('open') && getComputedStyle(b).display === 'none';
  }));
  ok('N20 锚点排除：点在哪处景点就不重复列它', await a.evaluate(() => {
    const s = window.SITES.filter(x => x && x.name && isFinite(+x.lat))[7];
    const all = window.Nearby.nearbySites(s.lat, s.lng, 30);
    const near = window.Nearby.nearbySites(s.lat, s.lng, 0.2);
    if (!near.length) return false;
    const ex = window.Nearby.nearbySites(s.lat, s.lng, 30, null, near[0].name);
    return all.some(x => x.name === near[0].name) && !ex.some(x => x.name === near[0].name) && ex.length === all.length - 1;
  }));
  ok('N21 主题过滤 cats 只放行该主题', await a.evaluate(() => {
    const s = window.SITES.filter(x => x && x.name && isFinite(+x.lat))[7];
    const r = window.Nearby.nearbySites(s.lat, s.lng, 100);
    const th = r.length ? r[0].theme : null;
    const f = window.Nearby.nearbySites(s.lat, s.lng, 100, [th]);
    return !!th && f.length > 0 && f.every(x => x.theme === th);
  }));
  ok('N22 非法入参出空数组（不炸）', await a.evaluate(() => window.Nearby.nearbySites(NaN, 120, 30).length === 0 && window.Nearby.nearbySites(30, undefined, 30).length === 0));
  await a.close();

  /* ============ 组 B：省专题页 · chip 武装 ============ */
  const b = await boot(browser, 'sc', errs);
  ok('N23 省页也有「这一带」chip（紧跟必去/网红）', await b.evaluate(() => {
    const cs = [].slice.call(document.querySelectorAll('#dynChips .chip')).map(x => x.dataset.f);
    return cs[0] === '全部' && cs[1] === '必去' && cs[2] === '网红' && cs[3] === '这一带';
  }));
  const pb0 = need(await pickPoint(b, 30, 0), 'N24b 省页取样（无标记拦截即可）');
  await b.mouse.click(pb0.x, pb0.y);
  await sleep(400);
  ok('N24 未武装时点图仍是随手记（默认点击语义没被改）', await b.evaluate(() => {
    const t = document.querySelector('.leaflet-popup-content');
    return !!t && t.textContent.indexOf('途经点随手记') >= 0 && !document.getElementById('nearBar');
  }));
  ok('N25 未武装时 queryNearby 零调用', await b.evaluate(() => window.__spy.calls.length === 0));
  const toastText = () => b.evaluate(() => [].slice.call(document.querySelectorAll('.ui-toast')).map(t => t.textContent).join(' | '));
  await b.evaluate(() => document.getElementById('nearChip').click());
  await sleep(250);
  ok('N26 点 chip → 取点提示 toast + chip 亮起', (await toastText()).indexOf('点击地图任意位置作为圆心') >= 0 && await b.evaluate(() => document.getElementById('nearChip').classList.contains('on')));
  await b.evaluate(() => document.getElementById('nearChip').click());
  await sleep(250);
  ok('N27 再点 chip → 取消（toast + 亮态灭）', (await toastText()).indexOf('已取消「这一带」取点') >= 0 && await b.evaluate(() => !document.getElementById('nearChip').classList.contains('on')));
  await b.evaluate(() => document.getElementById('nearChip').click());
  await sleep(200);
  const pb1 = await pickPoint(b, 30, 1) || await pickPoint(b, 50, 1) || await pickPoint(b, 100, 1);
  const kmB = !pb1 ? 30 : (await b.evaluate(p => {
    /* 取样点带回的是像素，半径档要用「命中的那个档」：省页地广人稀时 30km 内可能一条都没有 */
    const m = window.TopicEngine._map, cr = m.getContainer().getBoundingClientRect();
    const ll = m.containerPointToLatLng(window.L.point(p.x - cr.left, p.y - cr.top));
    for (const k of [30, 50, 100]) if (window.Nearby.nearbySites(ll.lat, ll.lng, k).length >= 1) return k;
    return 30;
  }, pb1));
  ok('N28a 省页有可取样点与可用半径档', !!pb1, 'km=' + kmB);
  if (pb1) {
    await b.mouse.click(pb1.x, pb1.y);
    await sleep(300);
  }
  ok('N28 武装后点图出半径条，chip 自动复位（一次性取点）', await b.evaluate(() => {
    const nb = document.getElementById('nearBar');
    return !!nb && getComputedStyle(nb).display !== 'none' && !document.getElementById('nearChip').classList.contains('on');
  }));
  const offB = await toOffline(b);
  ok('N29 省页断网生效', offB === '', offB);
  await b.evaluate(k => document.querySelector('#nearBar .nk[data-k="' + k + '"]').click(), kmB);
  const sB = await openSheet(b);
  ok('N30 省页断网出结果且零联网', await b.evaluate(() => window.__spy.overpass === 0) && !!sB && sB.n > 0 && sB.osm === 0, sB && (sB.n + ' 行 / ' + kmB + 'km'));
  ok('N31 省页来源口径＝内置行', !!sB && sB.foot === '来源：包内景点库，离线可用');
  await b.close();

  /* ============ 组 C：有网 · 内置凑不满才补位（桩喂罐头 OSM） ============ */
  const c = await boot(browser, 'nation', errs);
  const TYO = { lat: 35.68, lng: 139.75 };
  await c.evaluate(t => {
    window.TopicEngine._map.setView({ lat: t.lat, lng: t.lng }, 12);
    window.__stub = [
      { name: '浅草寺', lat: 35.7148, lng: 139.7967 },
      { name: '东京晴空塔', lat: 35.712, lng: 139.8128 },
      { name: '上野公园', lat: 35.715, lng: 139.778 }
    ];
  }, TYO);
  await sleep(700);
  ok('N32 东京一带内置命中 0（补位该出场的条件）', await c.evaluate(t => window.Nearby.nearbySites(t.lat, t.lng, 10).length === 0, TYO), JSON.stringify(TYO));
  const pc = await c.evaluate(() => {
    const cr = window.TopicEngine._map.getContainer().getBoundingClientRect();
    return { x: cr.left + Math.round(cr.width * 0.5), y: cr.top + Math.round(cr.height * 0.4) };
  });
  await c.mouse.click(pc.x, pc.y);
  await sleep(250);
  await c.evaluate(() => document.querySelector('#nearBar .nk[data-k="10"]').click());
  const sC = await openSheet(c, 12000);
  ok('N33 内置 <4 且有网 → 恰好一次 Overpass 请求', await c.evaluate(() => window.__spy.overpass === 1));
  ok('N34 请求体是 data= 表单且 around 半径按 km 换算成米', await c.evaluate(() => {
    const bd = decodeURIComponent(window.__spy.bodies[0] || '');
    return (window.__spy.bodies[0] || '').indexOf('data=') === 0 && bd.indexOf('around:10000,') >= 0 && bd.indexOf('[out:json][timeout:8]') >= 0;
  }));
  ok('N35 实时行带 .osm 类（与内置行视觉区分）', !!sC && sC.n === 3 && sC.osm === 3, sC && (sC.n + ' 行/osm ' + sC.osm));
  ok('N36 实时来源口径＝LIVE_NOTE + 「内置 0 · 实时 3」', !!sC && sC.foot === '以下为实时查询（OSM），离线不可用' && sC.src === '内置 0 · 实时 3', sC && (sC.src + ' | ' + sC.foot));
  ok('N37 实时行距离按 haversine 算出且 ≤ 半径', !!sC && sC.ds.length === 3 && sC.ds.every(d => d > 0 && d <= 10), sC && sC.ds.map(x => x.toFixed(1)).join(','));
  await c.evaluate(() => document.querySelector('#nearSheet .ni.osm').click());
  await sleep(800);
  ok('N38 点实时行 → 地图弹层带 LIVE_NOTE 且不进景点卡', await c.evaluate(() => {
    const t = document.querySelector('.leaflet-popup-content');
    return !!t && t.textContent.indexOf('以下为实时查询（OSM），离线不可用') >= 0 && !document.getElementById('locSheet').classList.contains('show');
  }));
  ok('N39 实时腿全程零第二次联网', await c.evaluate(() => window.__spy.overpass === 1));
  await c.close();

  /* ============ 组 D：有网 · 内置够多时一次都不问 ============ */
  const d = await boot(browser, 'nation', errs);
  const pd = need(await pickPoint(d, 30), 'N40b 全国页取样（有网腿）');
  await d.mouse.click(pd.x, pd.y);
  await sleep(250);
  await d.evaluate(() => document.querySelector('#nearBar .nk[data-k="30"]').click());
  await openSheet(d);
  ok('N40 有网但内置 ≥4 → 联网次数 0', await d.evaluate(() => window.__spy.overpass === 0 && window.__spy.calls.length === 1));
  await d.evaluate(() => document.getElementById('nearSheetX').click());
  await sleep(250);
  ok('N41 关闭钮收起面板（不留在屏上）', await d.evaluate(() => !document.getElementById('nearSheet').classList.contains('open')));
  await d.close();

  /* ============ 组 E：有网 · 500 与超时都静默降级 ============ */
  const e = await boot(browser, 'nation', errs);
  await e.evaluate(t => {
    window.TopicEngine._map.setView({ lat: t.lat, lng: t.lng }, 12);
    window.__spy.fail = true;
  }, TYO);
  await sleep(700);
  const pe = await e.evaluate(() => {
    const cr = window.TopicEngine._map.getContainer().getBoundingClientRect();
    return { x: cr.left + Math.round(cr.width * 0.5), y: cr.top + Math.round(cr.height * 0.4) };
  });
  await e.mouse.click(pe.x, pe.y);
  await sleep(250);
  await e.evaluate(() => document.querySelector('#nearBar .nk[data-k="10"]').click());
  const sE = await openSheet(e);
  ok('N42 查询失败(500) → 空态说清「实时查询这次也没返回」且不出 LIVE_NOTE', !!sE && sE.empty && sE.emptyText.indexOf('实时查询这次也没返回') >= 0 && sE.foot.indexOf('以下为实时查询') < 0, sE && (sE.emptyText + ' | ' + sE.foot));
  ok('N43 失败静默：只发一次、零重试、无错误卡', await e.evaluate(() => window.__spy.overpass === 1 && !document.querySelector('.ui-errorbox')));
  const TO = await e.evaluate(() => window.Nearby.OVERPASS_TIMEOUT_MS);
  const t0 = Date.now();
  await e.evaluate(() => {
    window.__spy.fail = false; window.__spy.hang = true;
    document.getElementById('nearSheet').classList.remove('open');
    document.querySelector('#nearBar .nk[data-k="10"]').click();
  });
  await sleep(3000);
  ok('N44 挂起 3s 时面板仍未出（超时没提前）', await e.evaluate(() => !document.getElementById('nearSheet').classList.contains('open')));
  const sF = await openSheet(e, TO + 6000);
  const dt = Date.now() - t0;
  ok('N45 超时后静默降级（出内置空态，不吊死、不出 LIVE_NOTE）', !!sF && sF.open && sF.empty && sF.foot.indexOf('以下为实时查询') < 0, sF && (sF.emptyText + ' | ' + sF.foot));
  ok('N46 降级耗时落在常量 ' + TO + 'ms 附近（实测 ' + dt + 'ms）', dt >= TO - 1500 && dt <= TO + 4000, dt + 'ms');
  await e.close();

  ok('N47 全程零未捕获异常 / 零 console.error（' + errs.length + ' 条，另有 ' + netNoise + ' 条 net::ERR_* 资源噪声按环境计）', errs.length === 0, errs.slice(0, 3).join(' || '));

  await browser.close();
  console.log('smoke-nearby: ' + (checks - fails) + '/' + checks + ' 通过' + (fails ? '，失败 ' + fails : ''));
  process.exit(fails ? 1 : 0);
})().catch(async err => {
  console.log('SMOKE CRASH ' + (err && err.message));
  console.log('smoke-nearby（中断）: ' + (checks - fails) + '/' + checks + ' 已出，失败 ' + fails);
  process.exit(1);
});
