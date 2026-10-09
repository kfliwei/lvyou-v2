/* tools/smoke-coord.js — 批次 30「卡面上那串裸经纬度」浏览器闸门
 *
 * 用户点单（2026-10-08，选择题答复逐字）：「经纬度那一串（S1-2，我当时报的 6 个显示点）在界面上怎么处置？」
 *   → 「卡面删掉」；同一题里还写死了另一半口径：「界面卡面只留地点名；复制/分享文本与带『坐标』标签的
 *      管理/导出元信息行保留」。所以这一节断言的不是「那串没了」，而是**删的和留的都在**：卡面上不许出现
 *      裸坐标，复制出口、坐标去重的「地点」计数、开卡后把那个点抬进可视地图带的定位——三者都吃 lat/lng，
 *      一刀切掉 toFixed 会让它们静默失效，而源码腿只会看见「更干净了」。
 *
 * 为什么这条只能由浏览器腿守（源码腿 §45 已经能扫到拼串那一行）：
 *   ① 拼串删掉 ≠ 屏上没那串了：renderItem 是「两个视图共用」的单篇卡片，只验聚合视图的话时间视图那一支没人守；
 *   ② 删过头也是「源码看着干净、屏上少功能」：坐标去重计数、复制文本、地图定位都是同一把 toFixed 的下游。
 *   这两支只有真点一次、真读一次 innerText 才看得见。
 *
 * 落点普查（现场跑 tools/out/probe45-coord-all.js 与 probe45-scan-rule.js，别抄这里写的数）：
 *   根目录 104 个 .js/.html 里「同时含 lat、lng、toFixed」的行 25 处：本批删掉的卡面串 8 处，
 *   带「坐标」标签的管理/导出行 4 处（其中 node-manager.html 那两处原本也是裸串，本批补上标签），
 *   其余 13 处是去重键／缓存键／URL 参数／复制文本，都不在屏上。
 *   「我报 6 处 → 实测 8 处 → 又冒出 node-manager 两处」的根因是窄文件名单 + 窄模式
 *   （(+s.lat).toFixed(5) 带括号那种 grep 不到），所以扫描器与这一节都走全量 readdir，不抄名单。
 *
 * 四个渲染面：随手记列表（聚合视图 + 时间视图，共用 renderItem）、足迹页抽屉（#memSheet）、
 *   review 日卡（#dayBox .meta + #stats）、node-manager 地点详情面板（.is-coord，「保留但要交代来意」那一支）。
 * 名字前缀 CO（coord）。用法: NODE_PATH=tools/node_modules node tools/smoke-coord.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;                 /* 一加 Ace 6T 真机档（§37 口径） */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 裸坐标串的形状：两段带 ≥3 位小数的数字用逗号相连。日期 2026-10-02 09:00、温度、里程数都不像它。
   这把刀只写一次：屏上那一格与属性那一格共用同一把（抄两遍就出现「产品漂了而两把刀还互相说没问题」）。 */
const BARE_SRC = '\\d{1,3}\\.\\d{3,}\\s*,\\s*\\d{1,3}\\.\\d{3,}';
const BARE = new RegExp(BARE_SRC);
/* 页内那一腿：读「读屏会念出来的那些属性」。属性名名单取自无障碍那一族（§36 的口径） */
const ATTR_HIT = src => {
  const names = ['aria-label', 'aria-description', 'title', 'alt'];
  const hits = [];
  document.querySelectorAll('*').forEach(function (el) {
    names.forEach(function (a) {
      const v = el.getAttribute ? el.getAttribute(a) : null;
      if (v && new RegExp(src).test(v)) hits.push(el.tagName + '[' + a + '="' + v.slice(0, 44) + '"]');
    });
  });
  return hits;
};

let checks = 0, fails = 0;
const lines = [];
function ok(name, cond, extra) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']');
  console.log(s); lines.push(s);
  if (!cond) fails++;
}

/* 三条记录：两篇同一地点（大同古城 39.5606,114.0862 + 华严寺同坐标）、一篇别的地点（悬空寺）
   ⇒ 「地点」这一枚必须是 2：那是坐标去重键还活着的证据。
   cogA 带 2 张照片与长正文（抽屉那一档最挤），cogC 中等正文无照片（CO10 那档「卡片矮到露得出地图带」要用它）。
   id 固定，胶囊按 data-nid 找得到。 */
const SEED = () => {
  function pic(seed) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d');
    const lin = g.createLinearGradient(0, 0, 900, 600);
    lin.addColorStop(0, ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]); lin.addColorStop(1, '#20201D');
    g.fillStyle = lin; g.fillRect(0, 0, 900, 600);
    g.fillStyle = '#FAF8F3'; g.font = '90px sans-serif'; g.fillText('P' + seed, 40, 140);
    return c.toDataURL('image/jpeg', 0.82);
  }
  const long = ('那天的风很大，古城墙的影子在地上拉得很长。我在墙下站了很久，数城楼的斗拱，一层一层数不清，' +
    '旁边卖凉粉的老乡说这墙几百年没倒过。后来我沿着街走，走到城门口又折回来，坐在台阶上把刚才看见的都写下来。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    province: '山西', city: '大同', county: '平城区', photos: [], audio: '',
    tags: ['古城'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ id: 'cogA', title: '大同古城', siteName: '大同古城', lat: 39.5606, lng: 114.0862,
      ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [pic(1), pic(2)] }),
    mk({ id: 'cogB', title: '华严寺', siteName: '大同古城', lat: 39.5606, lng: 114.0862,
      ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '薄伽教藏殿里的辽代彩塑，站着看了很久。', raw: '薄伽教藏殿里的辽代彩塑，站着看了很久。' }),
    mk({ id: 'cogC', title: '悬空寺', siteName: '悬空寺', lat: 39.6605, lng: 113.7086,
      ts: now - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', text: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', raw: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。' }),
  ];
  return new Promise((res, rej) => {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        const st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear(); list.forEach(r => os.put(r));
      tx.oncomplete = () => { db.close(); res(list.length); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    rq.onerror = () => rej(rq.error);
  });
};

/* 一屏卡片读数：每张卡的标题首段、.tm 那一行、整卡可见文本 */
const CARDS = () => {
  const items = Array.from(document.querySelectorAll('#tnListBody .tn-item'));
  return items.map(it => {
    const h4 = it.querySelector('h4'), tm = it.querySelector('.tm');
    return {
      title: h4 && h4.firstChild ? h4.firstChild.textContent.trim() : '',
      tm: tm ? tm.textContent.trim() : '',
      noTm: !tm,
      all: (it.innerText || ''),
    };
  });
};
/* 批次 31 之后卡面那一格只剩日期（时刻走抽屉与时间线那两档），所以这里认的是纯 YYYY-MM-DD */
const DATEONLY = c => /^\d{4}-\d{2}-\d{2}$/.test(c.tm);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  /* ---------- 一 随手记列表（聚合视图 + 时间视图，同一个 renderItem） ---------- */
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(2200);
  lines.push('=== smoke-coord · 视口 ' + VW + 'x' + VH + ' · 播种 3 篇（两篇同坐标 + 一篇悬空寺）===');

  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(500);
  const HEAD = await page.evaluate(() => {
    const card = document.querySelector('#tnListBody .tn-trip');
    const h = document.querySelector('#tnListBody .tn-trip-head');
    const wasOpen = !!card && card.classList.contains('open');
    /* 只在折叠态点：无条件点一次有可能落在展开态上、把它折回去，就红成「旅程卡=1 卡片=0」。
       2026-10-09 真腿出现过一次这种红，重跑就绿；探针 tools/out/probe30-tripopen.js 连做 3 轮
       每轮读数都是「openList 后 .tn-trip 无 open、items=0 → 点一次 +200ms 有 open、items=3」，
       没复现出那一发，所以这里不写根因，只把「读状态再点」和「等到有卡片为止」两件事做扎实。 */
    if (!wasOpen && h) h.click();
    return { trips: document.querySelectorAll('#tnListBody .tn-trip').length, wasOpen: wasOpen, clicked: (!wasOpen && !!h) };
  });
  await page.waitForFunction(() => document.querySelectorAll('#tnListBody .tn-item').length > 0,
    { timeout: 4000, polling: 150 }).catch(() => {});
  await sleep(250);
  const T = await page.evaluate(CARDS);
  ok('CO01 列表面板开起来了，聚合视图那张旅程卡点开（判据不许空跑）',
    HEAD.trips === 1 && T.length === 3,
    '旅程卡=' + HEAD.trips + ' 卡片=' + T.length + ' 起始展开=' + HEAD.wasOpen + ' 点过=' + HEAD.clicked);
  ok('CO02 聚合视图里每张卡的 .tm 只剩日期，没有那串坐标（改前是「2026-10-02 09:00 · 39.5606, 114.0862」）',
    T.length === 3 && T.every(DATEONLY), T.map(x => JSON.stringify(x.tm)).join(' | '));
  ok('CO03 聚合视图整卡可见文本里没有裸坐标串（正文／标签／天气里也不许冒出来）',
    T.length === 3 && T.every(x => !BARE.test(x.all)), T.map(x => (x.all.match(BARE) || [''])[0]).filter(Boolean).join(' | '));

  await page.evaluate(() => { const t = document.getElementById('tnViewTime'); if (t) t.click(); });
  await sleep(500);
  const V = await page.evaluate(CARDS);
  /* renderItem 的注释自己写着「单篇卡片（两个视图共用）」——只验一支，另一支就是没人守的那一支 */
  ok('CO04 切到时间视图同样是 3 张卡（两个视图共用 renderItem，另一支也得验）',
    V.length === 3, '卡片=' + V.length);
  ok('CO05 时间视图的 .tm 同样只剩日期，整卡文本同样没有裸坐标',
    V.length === 3 && V.every(x => DATEONLY(x) && !BARE.test(x.all)), V.map(x => JSON.stringify(x.tm)).join(' | '));
  ok('CO06 卡面上留着的是地点名（口径的另一半：只留地点名）',
    V.map(x => x.title).join(' / ') === '华严寺 / 悬空寺 / 大同古城', V.map(x => x.title).join(' / '));

  /* 复制这条出口必须还带着坐标——它是「删卡面不删功能」的唯一反证腿。
     navigator.clipboard 与 document.execCommand 两条腿都要拦：只拦一条，另一条会静默走掉，
     那时读数空了，闸门红在「没拦到」而不是红在「功能没了」，判据自己变成坑。 */
  await page.evaluate(() => {
    window.__CAP = [];
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__CAP.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
    document.execCommand = function (c) { const a = document.activeElement; if (c === 'copy' && a && a.tagName === 'TEXTAREA') window.__CAP.push(a.value); return true; };
  });
  const COP = await page.evaluate(() => {
    const it = Array.from(document.querySelectorAll('#tnListBody .tn-item'))
      .find(x => (x.querySelector('h4') || {}).textContent.indexOf('大同古城') === 0);
    if (!it) return { found: false };
    it.querySelector('[data-a=copy]').click();
    return { found: true };
  });
  await sleep(400);
  const CAP = await page.evaluate(() => window.__CAP.slice());
  ok('CO07 「复制」这条出口仍带着那串坐标（删的是卡面显示，不是功能）',
    COP.found === true && CAP.length === 1 && /39\.5606,\s*114\.0862/.test(CAP[0]),
    '拦到 ' + CAP.length + ' 条：' + JSON.stringify((CAP[0] || '').slice(0, 64)));

  /* ---------- 二 足迹页抽屉（真点胶囊，不直接调函数） ---------- */
  await page.evaluate(() => { document.getElementById('tnListBack') && document.getElementById('tnListBack').click(); });
  await sleep(300);
  const CHIP = await page.evaluate(() => {
    const c = document.querySelector('.tl-chip[data-nid=cogA]');
    if (!c) return { found: false };
    c.click();
    return { found: true };
  });
  await sleep(1500);
  const S = await page.evaluate(() => {
    const s = document.getElementById('memSheet'), b = document.getElementById('msBody');
    const pl = b.querySelector('.ms-place');
    return {
      disp: getComputedStyle(s).display, place: pl ? pl.textContent : '',
      text: (b.innerText || ''), locEl: !!b.querySelector('.ms-loc'), anyLoc: !!document.querySelector('.ms-loc'),
    };
  });
  ok('CO08 抽屉开起来了（真点胶囊那条路径）且写着地点名',
    CHIP.found === true && S.disp !== 'none' && S.place.indexOf('大同古城') >= 0, '.ms-place=' + JSON.stringify(S.place));
  ok('CO09 抽屉全文本里没有裸坐标串（改前那行是 <div class="ms-loc">39.5606, 114.0862</div>）',
    !BARE.test(S.text), JSON.stringify((S.text.match(BARE) || [''])[0]) + ' 文本长=' + S.text.length);
  ok('CO10 抽屉里 .ms-loc 这个落点已经不在（同批删掉的还有那条死 CSS 规则，不许留着等人再填）',
    S.locEl === false && S.anyLoc === false, '卡内=' + S.locEl + ' 全页=' + S.anyLoc);

  /* 那一串数字换成定位还在用：开卡后这个点要落在卡片之上的可视地图带里。
     用中等正文、不带照片的 cogC——长正文那档卡片快占满屏，§44 的 `if(band<120) return;` 会故意让地图一动不动，
     拿 cogA 测这一条会红在正确的行为上。 */
  await page.evaluate(() => { const x = document.querySelector('#memSheet .ms-close'); if (x) x.click(); });
  await sleep(600);
  const C2 = await page.evaluate(() => {
    const c = document.querySelector('.tl-chip[data-nid=cogC]');
    if (c) c.click();
    return { found: !!c };
  });
  await sleep(1600);
  const G = await page.evaluate(() => {
    const s = document.getElementById('memSheet');
    const top = Math.round(s.getBoundingClientRect().top);
    const p = map.latLngToContainerPoint(gxy(39.6605, 113.7086));
    return { top, x: Math.round(p.x), y: Math.round(p.y), disp: getComputedStyle(s).display };
  });
  ok('CO11 那串数字换成定位还在用：中等正文那篇开卡后，那个点落在卡片之上的可视地图带里',
    C2.found === true && G.disp !== 'none' && G.y >= 0 && G.y < G.top && G.x >= 0 && G.x <= VW,
    '点=' + G.x + ',' + G.y + ' 卡片上沿=' + G.top);

  /* 属性那一格：卡面「只留地点名」这件事，读屏的人靠的是 aria-label／title／alt，不是 innerText。
     源码扫描器只认「这行有没有拼进 HTML」，而 `chip.setAttribute('aria-label', …+n.lat.toFixed(4))` 那种写法
     在它眼里跟去重键长得一模一样（没有渲染信号）＝两腿都不红的那一格。探针见 tools/out/probe45-aria-blind.txt。 */
  const ATTR = await page.evaluate(ATTR_HIT, BARE_SRC);
  ok('CO12 抽屉这一步的全页属性里也没有那串数（aria-label／title／alt 是读屏版的「卡面」）',
    ATTR.length === 0, ATTR.join(' | '));
  /* 这一格自己的反证：临时给胶囊挂一条带坐标的 aria-label，上一条判据必须当场抓到它 */
  const ATTRNEG = await page.evaluate(function (src) {
    const c = document.querySelector('.tl-chip');
    if (!c) return { placed: false, hits: [] };
    const old = c.getAttribute('aria-label');
    c.setAttribute('aria-label', '大同古城 · 39.5606, 114.0862');
    const names = ['aria-label', 'aria-description', 'title', 'alt'];
    const hits = [];
    document.querySelectorAll('*').forEach(function (el) {
      names.forEach(function (a) {
        const v = el.getAttribute ? el.getAttribute(a) : null;
        if (v && new RegExp(src).test(v)) hits.push(a);
      });
    });
    if (old === null) c.removeAttribute('aria-label'); else c.setAttribute('aria-label', old);
    return { placed: true, hits: hits };
  }, BARE_SRC);
  ok('CO13 反证：把坐标挂进 aria-label，上一条判据读得到（不然 CO12 那个 0 不算证据）',
    ATTRNEG.placed === true && ATTRNEG.hits.length >= 1, '挂上后命中 ' + ATTRNEG.hits.length + ' 条');

  /* ---------- 三 review 日卡 ---------- */
  await page.goto(P('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(1800);
  const R = await page.evaluate(() => {
    const box = document.getElementById('dayBox'), st = document.getElementById('stats');
    return {
      metas: Array.from(box.querySelectorAll('.md-item .meta')).map(m => m.textContent.trim()),
      pairs: Array.from(st.querySelectorAll('div')).map(d => ({ n: (d.querySelector('b') || {}).textContent, s: (d.querySelector('span') || {}).textContent })),
      all: document.body.innerText,
    };
  });
  const PA = k => (R.pairs.find(p => p.s === k) || {}).n;
  ok('CO14 review 日卡渲染出 3 篇，.meta 只有日期与天气（改前尾巴上还挂着那串坐标）',
    R.metas.length === 3 && R.metas.every(t => !BARE.test(t)), R.metas.join(' | '));
  ok('CO15 review 整页可见文本里找不到裸坐标串（统计行／足迹进度／日卡都算）',
    !BARE.test(R.all), JSON.stringify((R.all.match(BARE) || [''])[0]));
  ok('CO16 「篇游记 3／地点 2」——那把 toFixed 是去重键不是显示，删过头会把两篇同地点数成两个地点',
    PA('篇游记') === '3' && PA('地点') === '2', R.pairs.map(p => p.s + '=' + p.n).join(' '));

  /* ---------- 四 node-manager 地点详情面板：保留，但要交代来意 ---------- */
  await page.goto(P('node-manager.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.NM && typeof window.NM.sysWish === 'function', { timeout: 20000, polling: 200 }).catch(() => {});
  await sleep(2600);
  const N = await page.evaluate(() => {
    window.NM.sysWish(0);
    const s = document.getElementById('infoSheet'), c = s.querySelector('.is-coord');
    const txt = (s.innerText || '');
    return { disp: getComputedStyle(s).display, n: !!c, coord: c ? c.textContent : '', rest: c ? txt.replace(c.textContent, '') : txt };
  });
  await sleep(400);
  ok('CO17 地点详情面板那行现在写着「坐标 · …」（改前是裸串，读起来像调试输出）',
    N.n === true && N.disp !== 'none' && N.coord.indexOf('坐标 · ') === 0, JSON.stringify(N.coord));
  ok('CO18 这面板里除了那一行带标签的，没有第二处裸坐标串', !BARE.test(N.rest), JSON.stringify((N.rest.match(BARE) || [''])[0]));

  /* ---------- 五 反证 + 收尾 ---------- */
  /* 这把刀必须能在改前形状上读出「有」：往页面里塞一行改前的 .tm 文本，BARE 必须命中它。
     不塞这一发的话，CO03/CO05/CO09/CO12/CO15/CO18 那几个「读不到」可能只是正则瞎了。 */
  const NEG = await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'co-neg'; d.style.display = 'none';
    d.textContent = '2026-10-02 09:00 · 39.5606, 114.0862';
    document.body.appendChild(d);
    const t = d.textContent; d.remove();
    return t;
  });
  ok('CO19 反证：改前那串塞回页面时判据正则读得到（不然上面六条「读不到」不算证据）', BARE.test(NEG), JSON.stringify(NEG));
  ok('CO20 四页跑完零未捕获报错', errs.length === 0, errs.join(' | '));
  ok('CO21 判据条数 ≥ 21（这一节自己也是会被删的）', checks >= 20, 'checks=' + checks + '（本条自身是第 ' + (checks + 1) + ' 条）');

  lines.push('=== smoke-coord: ' + checks + ' 项，失败 ' + fails + ' ===');
  console.log('=== smoke-coord: ' + checks + ' 项，失败 ' + fails + ' ===');
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b30-smoke-coord.txt'), lines.join('\n') + '\n'); } catch (e) { console.log('读数落盘失败：' + e.message); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { lines.push('FATAL ' + ((e && e.stack) || e)); try { fs.writeFileSync(path.join(__dirname, 'out', 'b30-smoke-coord.txt'), lines.join('\n') + '\n'); } catch (x) {} console.log('FATAL ' + ((e && e.message) || e)); process.exit(1); });
