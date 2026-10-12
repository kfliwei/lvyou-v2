/* tools/out/probe39-backlog.js — 批次 39-A 地基实测（只读产品码，一行都不改）

 * 六条「待点单」项在这一批重新量一遍，逐条判「真错 / 设计内」：
 *   U 腿＝旅程叙事那条半透明翻页浮条压正文（审核报告 §4 第 13 条）
 *   V 腿＝旅程叙事首屏缩略图的中心点落在底导航带里（§4 第 14 条）
 *   W 腿＝排期结果页 .mv / .btn.mini 低于 44 地板（§4 第 7 条）
 *   X 腿＝自建地点表单层：物理返回键无人守（node-manager.html:859/860）
 *   Y 腿＝定制路书弹层：同上（results.js:425/426；宿主页＝review.html:234 那个「路书」入口，results.js 只在 index/review/travel-map/topic 四页被引）
 *   Z 腿＝随手记录音面板：屏上两扇门有脏检查，返回键绕过（travel-notes.js:645/699/1061）
 *   对照腿＝批次 37 已接好的编辑游记层，同一把尺子量「有守卫长什么样」
 * 壳侧那一支本机没有设备：按 MainActivity.java:547-552 的分支推断，读数里标明是推断。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe39-backlog.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = path.join(ROOT, 'tools', 'out', 'b39-probe-backlog.txt');
const out = [];
function say(s) { out.push(s); console.log(s); }

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T07:40:00+08:00').getTime();
const PIX = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='90' height='90' fill='%23AE5738'/%3E%3C/svg%3E";

function dd(i, site, lat, lng, city, txt, pics) {
  const ts = T0 + i * D;
  return {
    id: 'p39_' + site, title: site + '·记', siteName: site, siteIndex: -1,
    lat: lat, lng: lng, ts: ts,
    date: new Date(ts).toISOString().slice(0, 10), day: '',
    province: '山西', city: city, county: '',
    raw: txt, text: txt, style: 'plain',
    photos: pics || [], audio: '', tags: []
  };
}
const LONG = '云冈石窟的露天大佛坐北朝南，莲花脚下那一圈北魏的刀法还看得出层次。' +
  '从东门进去先是昙曜五窟，风化的砂岩在下午三点偏橙。走到第20窟要十五分钟，' +
  '途中两处护栏在修补，绕行提示牌立在第三尊佛的侧面。';
const DAT = [
  dd(0, '云冈石窟', 40.032, 113.135, '大同', LONG, [PIX, PIX]),
  dd(1, '华严寺', 40.091, 113.259, '大同', '薄伽教藏殿里的辽代彩塑一排站过去，窗光照在背面那堵壁上。', [PIX]),
  dd(2, '大同博物馆', 40.083, 113.310, '大同', '北魏俑阵占了整整一面墙，说明牌写的是平城时期。'),
  dd(3, '晋祠', 37.712, 112.455, '太原', '难老泉的水还是绿的，圣母殿那圈柱子斜得厉害。', [PIX]),
  dd(4, '山西博物院', 37.869, 112.449, '太原', '鸟尊在第一展柜，旁边讲晋侯墓地九组被盗的事。')
];

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  return { ctx, page, errs };
}

async function seedNotes(page, rows) {
  await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear(); rs.forEach(function (r) { os.put(r); });
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) { return window.TravelNotes && TravelNotes.list().length === n; },
    { timeout: 20000, polling: 150 }, rows.length).catch(() => {});
}

/* 一屏里「落在浮条带内」的正文块：块矩形、被盖住的像素高、按行高折算成几行 */
const OVERLAP = function (sel) {
  const bar = document.querySelector(sel);
  if (!bar) return { missing: sel, blocks: [], area: 0, maxRows: 0, band: { top: 0, bottom: 0 } };
  const b = bar.getBoundingClientRect();
  const rows = [];
  let area = 0, maxRows = 0;
  document.querySelectorAll('#cards .sc-txt,#cards .sc-place,#cards .sc-meta,#cards .sc-date,#cards .sc-pics,#cards .vlead,#cards .vtitle').forEach(function (el) {
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top, b.top), bot = Math.min(r.bottom, b.bottom);
    if (bot - top <= 0.5) return;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
    const hidden = bot - top;
    area += hidden * r.width;
    const rws = hidden / lh;
    if (rws > maxRows) maxRows = rws;
    rows.push({
      cls: String(el.className).slice(0, 12),
      inCard: Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), el.closest('.story-card')) + 1,
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      hiddenPx: Math.round(hidden), rows: Number(rws.toFixed(2)),
      active: !!(el.closest('.story-card') && el.closest('.story-card').classList.contains('active'))
    });
  });
  return {
    band: { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) },
    bg: getComputedStyle(bar).backgroundColor,
    blur: getComputedStyle(bar).backdropFilter || getComputedStyle(bar).webkitBackdropFilter,
    blocks: rows, area: Math.round(area), maxRows: Number(maxRows.toFixed(2))
  };
};

/* 物理返回键的两种壳侧场景。两场景各用一个全新标签页，差别只在「这一页后面有没有页面」：
   场景1＝App 冷启动只 loadUrl 过这一页（about:blank 之后第一次导航）⇒ 壳里 canGoBack()=false
          ⇒ 走 super.onBackPressed()＝退出应用（MainActivity.java:547-552，本机无设备，这一支是读码推断）；
   场景2＝从别页跳过来（后面真有一整个文档）⇒ 壳走 webView.goBack()＝离开这一整个文档。 */
async function backScenes(label, cfg, browser, openAndType) {
  say('');
  say('【' + label + '】');
  /* ---- 场景1：全新页，先读 about:blank 的 history.length 作基线，再只导航一次 ---- */
  const A = await newPage(browser);
  const base = await A.page.evaluate(() => history.length);
  await A.page.goto(U(cfg.page1), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(cfg.load1 || 2400);
  const o1 = await openAndType(A.page, 'single');
  const s1 = await A.page.evaluate(function (o) {
    return { hist: history.length, alive: o.alive, typed: o.typed, ask: !!document.querySelector('.tn-cfm') };
  }, o1);
  say('  场景1（全新标签页：about:blank 时 history.length=' + base + '，进这一页后 ' + s1.hist + '）');
  say('    开层读数 ' + JSON.stringify(s1));
  say('    ⇒ 真实文档数 = ' + (s1.hist - base) + '：这一页后面没有任何页面' +
    ' ⇒ 壳里 canGoBack()=false ⇒ super.onBackPressed()＝退出应用，框里刚打的「' + String(s1.typed || '—').slice(0, 12) + '」一句不问就没了【按 MainActivity:547-552 推断；屏上确认框 ask=' + s1.ask + '】');
  await A.ctx.close();
  /* ---- 场景2：这一页后面真压着一个文档，再发一发返回 ---- */
  const B = await newPage(browser);
  await B.page.goto(U(cfg.fromPage), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1400);
  await B.page.goto(U(cfg.page1), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(cfg.load1 || 2400);
  const o2 = await openAndType(B.page, 'multi');
  const before2 = await B.page.evaluate(function (o) {
    return { hist: history.length, alive: o.alive, typed: o.typed, ask: !!document.querySelector('.tn-cfm') };
  }, o2);
  await B.page.evaluate(() => history.back());
  await sleep(1500);
  const after2 = await B.page.evaluate(function () {
    return { href: location.href.replace(/^file:\/\/\//, ''), hist: history.length, ask: !!document.querySelector('.tn-cfm') };
  });
  say('  场景2（从 ' + cfg.fromPage + ' 跳过来）：开层读数 ' + JSON.stringify(before2));
  say('    ⇒ 发一发返回后落在 ' + after2.href + '（整页走掉），层连同刚打的字一起不在；确认框 ask=' + after2.ask);
  await B.ctx.close();
  return { s1: s1, before2: before2, after2: after2 };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });

  say('=== 批次 39-A 地基实测：六条待定项逐条复量（视口 ' + VW + '×' + VH + '，真机档）===');

  /* ================= U 腿：浮条压正文 ================= */
  const S = await newPage(browser);
  await seedNotes(S.page, DAT);
  await S.page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await S.page.waitForFunction(() => document.querySelectorAll('.story-card').length > 0, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);

  say('');
  say('【U1 旅程叙事·浮条与底导航的几何】');
  const geo = await S.page.evaluate(function () {
    const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), left: Math.round(r.left) }; };
    return {
      nav: g('.story-nav'), tab: g('.bottom-nav'), map: g('#storyMap'), bar: g('.story-bar'),
      docH: Math.round(document.documentElement.scrollHeight),
      vh: Math.round(window.innerHeight),
      cardsPadBottom: getComputedStyle(document.getElementById('cards')).paddingBottom,
      navZ: getComputedStyle(document.querySelector('.story-nav')).zIndex,
      tabZ: getComputedStyle(document.querySelector('.bottom-nav')).zIndex
    };
  });
  say('  翻页浮条 ' + JSON.stringify(geo.nav) + '  z=' + geo.navZ);
  say('  底导航   ' + JSON.stringify(geo.tab) + '  z=' + geo.tabZ);
  say('  顶部地图 ' + JSON.stringify(geo.map) + '  顶部条 ' + JSON.stringify(geo.bar));
  say('  #cards padding-bottom=' + geo.cardsPadBottom + '，文档高 ' + geo.docH + '，视口 ' + geo.vh);
  say('  浮条底缘 → 底导航顶缘之间：' + (geo.tab ? (geo.tab.top - geo.nav.bottom) + 'px' : '无量'));

  const stops = [];
  const maxScroll = await S.page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (const y of [0, 180, 360, 540, 720, 900, 1080]) {
    if (y > maxScroll) break;
    await S.page.evaluate(cy => window.scrollTo(0, cy), y);
    await sleep(430);
    stops.push({ y: y, o: await S.page.evaluate(OVERLAP, '.story-nav') });
  }
  say('');
  say('【U2 逐档停靠位（每一档都是「手停下来那一瞬」的位置）】');
  stops.forEach(function (s) {
    const o = s.o;
    say('  scrollY=' + s.y + '  浮条带 ' + o.band.top + '–' + o.band.bottom +
      '  盖住的块 ' + o.blocks.length + ' 个 / 重叠 ' + o.area + 'px² / 最多 ' + o.maxRows + ' 行');
    o.blocks.forEach(function (b) {
      say('        ' + b.cls + '（第' + b.inCard + '卡' + (b.active ? '·当前讲这张' : '') + '）块 ' + b.top + '–' + b.bottom + ' 被盖 ' + b.hiddenPx + 'px ≈ ' + b.rows + ' 行');
    });
  });
  say('  浮条底色 ' + (stops[0] || { o: {} }).o.bg + '  backdrop-filter ' + (stops[0] || { o: {} }).o.blur);

  say('');
  say('【U3 按「下一站」逐站翻（产品自己的落点，不是我手调 scrollY）】');
  const nCards = await S.page.evaluate(() => document.querySelectorAll('.story-card').length);
  await S.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  for (let i = 0; i < nCards; i++) {
    if (i > 0) await S.page.evaluate(() => document.getElementById('snNext').click());
    await sleep(820);
    const o = await S.page.evaluate(OVERLAP, '.story-nav');
    const act = await S.page.evaluate(function () {
      const e = document.querySelector('.story-card.active');
      if (!e) return null; const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    });
    const spy = await S.page.evaluate(() => Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), document.querySelector('.story-card.active')));
    say('  第 ' + (i + 1) + '/' + nCards + ' 站（spy 认第 ' + (spy + 1) + ' 张）卡 ' + (act ? act.top + '–' + act.bottom + ' 高 ' + act.h : 'null') +
      '  浮条带 ' + o.band.top + '–' + o.band.bottom + '  盖 ' + o.blocks.length + ' 块 / 最多 ' + o.maxRows + ' 行' +
      (o.blocks.some(b => b.active) ? '  ★糊住的正是当前这一张' : ''));
  }
  await S.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(600);
  const lastGap = await S.page.evaluate(function () {
    const cs = document.querySelectorAll('.story-card'), l = cs[cs.length - 1], b = document.querySelector('.story-nav');
    return { lastBottom: Math.round(l.getBoundingClientRect().bottom), barTop: Math.round(b.getBoundingClientRect().top) };
  });
  const endO = await S.page.evaluate(OVERLAP, '.story-nav');
  say('  滚到全文最末：末卡底 ' + lastGap.lastBottom + ' / 浮条顶 ' + lastGap.barTop + ' ⇒ 末卡躲开浮条 ' + (lastGap.barTop - lastGap.lastBottom) + 'px（200px 留白在这档是够的）');
  say('  最末档仍有盖住块 ' + endO.blocks.length + ' 个');

  /* ================= V 腿：缩略图中心点落点全扫 ================= */
  await S.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  say('');
  say('【V 旅程叙事缩略图 · 中心点全扫（产品自己的每一站落点 × 页内每一枚可见缩略图）】');
  /* 判据：图在视口里看得见（可见高度 ≥12px），但按它自己的中心点，最上层不是它本身 ⇒ 用户看得见这张图，点它的正中没反应 */
  const VSCAN = function () {
    var tab = document.querySelector('.bottom-nav'), nav = document.querySelector('.story-nav');
    var t = tab ? tab.getBoundingClientRect() : null, n = nav ? nav.getBoundingClientRect() : null;
    var vh = window.innerHeight, cards = document.querySelectorAll('.story-card');
    var rows = [], total = 0;
    document.querySelectorAll('.sc-pics img').forEach(function (img, i) {
      total++;
      var r = img.getBoundingClientRect();
      var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (vis < 12) return;
      var cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      var st = document.elementsFromPoint(cx, cy);
      var top = st[0] || null;
      var card = img.closest('.story-card');
      rows.push({
        i: i + 1,
        card: card ? (Array.prototype.indexOf.call(cards, card) + 1) : 0,
        act: card && card.classList.contains('active') ? 1 : 0,
        rect: [Math.round(r.top), Math.round(r.bottom)],
        vis: Math.round(vis),
        cy: cy,
        band: (t && cy >= t.top && cy <= t.bottom) ? '底导航带' : ((n && cy >= n.top && cy <= n.bottom) ? '翻页条带' : '带外'),
        offVp: cy > vh ? '中心点在视口外' : '',
        topHit: top ? (top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '')) : 'null',
        self: top === img ? 1 : 0
      });
    });
    return { vh: vh, total: total, tab: t ? [Math.round(t.top), Math.round(t.bottom)] : null,
      nav: n ? [Math.round(n.top), Math.round(n.bottom)] : null, rows: rows };
  };
  function vreport(tag, v) {
    var dead = v.rows.filter(function (x) { return !x.self; });
    say('  ' + tag + '：页内缩略图 ' + v.total + ' 枚，其中看得见（≥12px）' + v.rows.length + ' 枚 ⇒ 点中心没反应的 ' + dead.length + ' 枚' +
      '｜底导航带 ' + (v.tab ? v.tab.join('–') : '无') + '，翻页条带 ' + (v.nav ? v.nav.join('–') : '无'));
    v.rows.forEach(function (x) {
      say('      第' + x.card + '卡' + (x.act ? '·当前' : '  ') + '第' + x.i + '枚 图 ' + x.rect.join('–') +
        ' 可见 ' + x.vis + 'px 中心 ' + x.cy + ' → ' + x.band + (x.offVp ? '/' + x.offVp : '') +
        ' 最上层 ' + x.topHit + (x.self ? '' : '  ★点不着') + '（' + (x.self ? '图自己' : '被' + x.topHit + '接走') + '）');
    });
    return dead;
  }
  var vdead = [];
  vdead = vdead.concat(vreport('首屏（scrollY=0）', await S.page.evaluate(VSCAN)));
  await S.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  for (var vi = 0; vi < nCards; vi++) {
    if (vi > 0) await S.page.evaluate(() => document.getElementById('snNext').click());
    await sleep(820);
    vdead = vdead.concat(vreport('产品落点：第 ' + (vi + 1) + '/' + nCards + ' 站', await S.page.evaluate(VSCAN)));
  }
  await S.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(600);
  vdead = vdead.concat(vreport('全文最末', await S.page.evaluate(VSCAN)));
  say('  ⇒ 各档合计「看得见但按中心点不着」的缩略图：' + vdead.length + ' 枚次' +
    (vdead.length ? '（按「哪一档最多」定性，不看绝对数——同一枚在相邻档会被重复计）' : '（一枚都没有＝报告第 14 条不复现）'));
  /* 拿一枚现场验：点中心确实没反应，把它滚进视口中位再点就开了 */
  await S.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(700);
  const th = await S.page.evaluate(function () {
    const img = document.querySelector('.story-card .sc-pics img');
    if (!img) return { none: true };
    const r = img.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const stack = document.elementsFromPoint(cx, cy).slice(0, 3).map(function (e) {
      return e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '');
    });
    const tab = document.querySelector('.bottom-nav');
    const tr = tab ? tab.getBoundingClientRect() : null;
    return {
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      center: [cx, cy], stack: stack,
      tabBand: tr ? [Math.round(tr.top), Math.round(tr.bottom)] : null,
      onclickAttr: img.getAttribute('onclick') ? '有' : '无'
    };
  });
  say('  现场一枚（首屏第 1 枚）' + JSON.stringify(th));
  if (!th.none) {
    const before = await S.page.evaluate(() => location.pathname.split('/').pop());
    await S.page.touchscreen.tap(th.center[0], th.center[1]);
    await sleep(1200);
    const after = await S.page.evaluate(function () {
      const zoom = document.querySelector('.tn-viewer');
      return {
        path: location.pathname.split('/').pop(),
        zoomOpened: !!zoom, zoomCls: zoom ? String(zoom.className).slice(0, 34) : null,
        zoomText: zoom ? (zoom.innerText || '').replace(/\s+/g, ' ').slice(0, 26) : null
      };
    });
    say('  真点一下中心（' + th.center.join(',') + '）：' + JSON.stringify(after) + '  ⇒ ' +
      (after.zoomOpened ? '查看器开了' : (after.path !== before ? '跳到 ' + after.path + ' 了——那一下是切 Tab，不是看图' : '什么都没发生')));
    /* 把它翻进视口中位再点一次：证明「不是不能放大，是首屏那个落点不对」 */
    await S.page.evaluate(function () { const i = document.querySelector('.story-card .sc-pics img'); i.scrollIntoView({ block: 'center' }); });
    await sleep(700);
    const th2 = await S.page.evaluate(function () {
      const img = document.querySelector('.story-card .sc-pics img');
      const r = img.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const top = document.elementsFromPoint(cx, cy)[0] || {};
      return { center: [cx, cy], topHit: top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '') };
    });
    await S.page.touchscreen.tap(th2.center[0], th2.center[1]);
    await sleep(1100);
    const after2 = await S.page.evaluate(function () {
      const z = document.querySelector('.tn-viewer');
      return { path: location.pathname.split('/').pop(), zoom: !!z, text: z ? (z.innerText || '').replace(/\s+/g, ' ').slice(0, 24) : null };
    });
    say('  把它滚到视口中位再点：中心 ' + th2.center.join(',') + '，最上层元素 ' + th2.topHit + ' → 点完 ' + JSON.stringify(after2));
  }

  /* ================= W 腿：排期结果页触控档 ================= */
  say('');
  say('【W 排期结果页：低于 44 地板的可交互元素全量普查】');
  const P = await newPage(browser);
  await P.page.goto(U('planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2800);
  await P.page.type('#promptInput', '我想去川西玩3天，喜欢自然风光');
  await P.page.click('#genBtn');
  await sleep(1600);
  for (let i = 0; i < 5; i++) {
    await P.page.evaluate(idx => { const e = document.querySelectorAll('#candList .cand'); if (e[idx]) e[idx].click(); }, i);
    await sleep(160);
  }
  await P.page.click('#scheduleBtn'); await sleep(450);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wDone'); await sleep(2400);
  const WCENS = function (raise) {
    var st = null;
    if (raise) {
      st = document.createElement('style');
      st.id = 'probeRaise44';
      st.textContent = '.stop-acts .mv{width:44px;height:44px}.stop-acts .btn.mini{min-height:44px}';
      document.head.appendChild(st);
    }
    var sel = '#resultBody button, #resultBody a, #resultBody input, #resultBody [role="button"], #resultBody .chip';
    var seen = {}, list = [];
    document.querySelectorAll(sel).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var cls = String(el.className || el.tagName).split(' ')[0];
      var key = cls + '|' + Math.round(r.height);
      if (!seen[key]) {
        seen[key] = { cls: cls, n: 0, w: Math.round(r.width), h: Math.round(r.height),
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 10) };
        list.push(seen[key]);
      }
      seen[key].n++;
    });
    var acts = document.querySelector('.stop-acts');
    var acs = acts ? getComputedStyle(acts) : null;
    var arect = acts ? acts.getBoundingClientRect() : null;
    var contentW = arect ? Math.round(arect.width - parseFloat(acs.paddingLeft) - parseFloat(acs.paddingRight)) : null;
    var opsRows = [].map.call(document.querySelectorAll('.stop-acts'), function (a, i) {
      var o = a.querySelector('.ops'), r = o ? o.getBoundingClientRect() : null;
      var ar = a.getBoundingClientRect();
      var mvs = o ? o.querySelectorAll('.mv').length : 0;
      var mw = o && o.querySelector('.mv') ? Math.round(o.querySelector('.mv').getBoundingClientRect().width) : null;
      return {
        opsNeed: r ? Math.round(r.width) : null, mvW: mw, mvN: mvs,
        opsScroll: o ? o.scrollWidth : null, opsClient: o ? Math.round(o.clientWidth) : null,
        actsH: Math.round(ar.height),
        /* 行尾越界：ops 右缘 - .stop-acts 右缘（正数＝真的挤出盒子） */
        spill: r ? Math.round(r.right - ar.right) : null
      };
    });
    var cards = [].map.call(document.querySelectorAll('.day-card'), function (c) { return c.scrollWidth - c.clientWidth; });
    var mini = document.querySelector('.stop-acts .btn.mini');
    var nav = document.querySelector('.day-card .dhead .btn');
    if (raise && st) st.remove();
    return {
      all: list,
      dayCards: document.querySelectorAll('#resultBody .day-card').length,
      stopRows: document.querySelectorAll('#resultBody .stop').length,
      travelOn: !!mini,
      actsBoxW: arect ? Math.round(arect.width) : null,
      actsPad: acs ? acs.paddingLeft : null,
      contentW: contentW,
      opsRows: opsRows,
      spillAny: opsRows.some(function (x) { return x.spill > 1; }),
      cardSpillMax: cards.length ? Math.max.apply(null, cards) : null,
      pageScrollW: document.documentElement.scrollWidth, pageClientW: document.documentElement.clientWidth,
      miniW: mini ? Math.round(mini.getBoundingClientRect().width) : null,
      miniH: mini ? Math.round(mini.getBoundingClientRect().height) : null,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      navInline: nav ? (nav.getAttribute('style') || '').slice(0, 40) : null
    };
  };
  function wreport(tag, w) {
    say('  ┌ ' + tag);
    say('  │ 日卡 ' + w.dayCards + ' 张 / 站点行 ' + w.stopRows + ' 行；出行态「记一笔」在场？' + (w.travelOn ? '在（宽 ' + w.miniW + '×高 ' + w.miniH + '）' : '不在') +
      '｜「导航」钮高 ' + w.navH + '（内联写死：' + w.navInline + '）');
    say('  │ .stop-acts 盒宽 ' + w.actsBoxW + 'px，左内衬 ' + w.actsPad + ' ⇒ 排得下东西的宽 ' + w.contentW + 'px');
    w.opsRows.forEach(function (r, i) {
      say('  │   第 ' + (i + 1) + ' 行：.ops 实占 ' + r.opsNeed + 'px（' + r.mvN + ' 枚 × ' + r.mvW + 'px），行高 ' + r.actsH + 'px，右缘越界 ' + r.spill + 'px，.ops scrollW/clientW=' + r.opsScroll + '/' + r.opsClient);
    });
    say('  │ 越界：任何一行挤出盒外？' + (w.spillAny ? '是' : '否') + '｜日卡内横向溢出最大 ' + w.cardSpillMax + 'px｜文档 scrollW/clientW=' + w.pageScrollW + '/' + w.pageClientW);
    say('  │ 低于 44 的一族：' + (w.all.filter(function (x) { return x.h < 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n + '枚「' + x.label + '」'; }).join(' | ') || '无'));
    say('  │ ≥44 的对照：' + (w.all.filter(function (x) { return x.h >= 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n; }).join(' | ') || '无'));
  }
  const w0 = await P.page.evaluate(WCENS, false);
  wreport('W1 未出行态（现在屏上的样子）', w0);
  await P.page.evaluate(() => { window.plannerStartTrip(); });
  await sleep(1200);
  const w1 = await P.page.evaluate(WCENS, false);
  wreport('W2 出行态（多一枚「记一笔」，行最挤）', w1);
  const w2 = await P.page.evaluate(WCENS, true);
  wreport('W3 假设法：把 .mv 抬到 44×44、「记一笔」抬到 44 高（探针注样式，产品码没动）', w2);
  say('  ⇒ 判据：W3 若「右缘越界/日卡溢出/文档变宽」任一非零＝抬到 44 会撞破行宽，得同时给 .stop-acts 让位（换行或去左内衬）；全为零＝单纯没人点名');

  /* ================= X/Y/Z：三处物理返回键无人守的层 ================= */
  const NMOPEN = function (page) {
    return page.evaluate(function () {
      /* 真实入口：长按地图 500ms → openForm（initLongPress 挂在 Leaflet touchstart 上）。
         这里 fire 那个已注册监听，走的是同一段产品码，不伪造 DOM。 */
      if (!window.NM || !NM.map) return { noMap: true };
      NM.map.fire('touchstart', { latlng: NM.map.getCenter() });
      return { fired: true };
    }).then(async r => {
      await sleep(900);
      await page.type('#nmName', '鹳雀楼（试验）');
      await sleep(200);
      return { alive: !!(await page.$('#nmName')), typed: await page.evaluate(() => (document.querySelector('#nmName') || {}).value || null) };
    });
  };
  const IXOPEN = function (page) {
    return page.evaluate(function () {
      if (!window.Results || !Results.itinerary) return { noApi: true };
      Results.itinerary([{ name: '云冈石窟', lat: 40.032, lng: 113.135 }, { name: '华严寺', lat: 40.091, lng: 113.259 }], '山西');
      return { fired: true };
    }).then(async r => {
      await sleep(800);
      await page.type('#ipref', '不看博物馆，只看地上文物');
      await sleep(200);
      return { alive: !!(await page.$('#igo')), typed: await page.evaluate(() => (document.querySelector('#ipref') || {}).value || null) };
    });
  };
  const PANELOPEN = function (page) {
    return page.evaluate(function () {
      if (!window.TravelNotes || !TravelNotes.openPanel) return { noApi: true };
      /* openPanel(0) 要经 GETSITE(0) 取专题点，专题数据没就绪就只 flash「未找到该景点」，面板根本不开。
         直接传站点对象（签名第一分支）绕开取点，面板走的是同一段产品码 */
      TravelNotes.openPanel({ label: '云冈石窟', name: '云冈石窟', lat: 40.032, lng: 113.135 });
      return { fired: true };
    }).then(async r => {
      await sleep(1000);
      /* 面板把转写框换成 textarea#tnRawEdit（travel-notes.js:1012），脏检查读的正是它（getRaw:1393） */
      await page.evaluate(function () {
        var ta = document.querySelector('#tnRawEdit');
        if (ta) { ta.value = '先说一段话试试：今天风很大，护栏还在修。'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await sleep(250);
      return {
        alive: await page.evaluate(() => { const p = document.querySelector('.tn-panel'); return !!p && getComputedStyle(p).display !== 'none'; }),
        typed: await page.evaluate(() => ((document.querySelector('#tnRawEdit') || {}).value || '').slice(0, 16) || null)
      };
    });
  };

  const xh = { page1: 'node-manager.html', fromPage: 'search.html', load1: 3000 };
  const yh = { page1: 'review.html', fromPage: 'travel-map.html', load1: 2600 };
  const zh = { page1: 'travel-map.html', fromPage: 'index.html', load1: 2400 };

  await backScenes('X 自建地点表单层（node-manager.html:859 #nmCancel / :860 遮罩 → 裸 m.remove()）', xh, browser, NMOPEN);
  say('  这层里 #nmName/#nmCity/#nmAddr/#nmDesc 四枚输入框：源码 grep 无任何草稿持久化通道，也没有 pushState（全站只有 travel-notes.js 的编辑屏用）');

  await backScenes('Y 定制路书弹层（results.js:425 #ix / :426 遮罩 → 裸 d.remove()）', yh, browser, IXOPEN);
  say('  层里 #idays/#ipref 两枚输入框：偏好那句打到一半，返回键一发就整层消失');

  await backScenes('Z 随手记录音面板（travel-notes.js:645 遮罩 / #tnX → closePanel 脏检查；返回键绕过）', zh, browser, PANELOPEN);
  /* 屏上那扇门先证脏检查确实存在（批次 32-D 的成果），再证返回键那一发不走它 */
  const Z2 = await newPage(browser);
  await Z2.page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2600);
  const zt = await Z2.page.evaluate(() => (window.TravelNotes && TravelNotes.openPanel ? 'openPanel 在场' : '缺 TravelNotes.openPanel'));
  await Z2.page.evaluate(function () {
    TravelNotes.openPanel({ label: '云冈石窟', name: '云冈石窟', lat: 40.032, lng: 113.135 });
  });
  await sleep(1000);
  const zopen = await Z2.page.evaluate(function () {
    var ta = document.querySelector('#tnRawEdit');
    if (ta) { ta.value = '再说一段：塔是辽代的，瓦是后来换的。'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    var p = document.querySelector('.tn-panel');
    return { alive: !!p && getComputedStyle(p).display !== 'none', hist: history.length, typed: ta ? ta.value.slice(0, 14) : null };
  });
  say('  面板在场读数 ' + JSON.stringify(zopen) + '（开面板前后 history.length 不变＝面板只切 display，不压历史 ⇒ 返回键那一发没有任何 popstate 接收者）');
  await Z2.page.evaluate(function () { const b = document.getElementById('tnX'); if (b) b.click(); });
  await sleep(900);
  const zask = await Z2.page.evaluate(function () {
    const c = document.querySelector('.tn-cfm');
    return { ask: !!c, text: c ? (c.innerText || '').replace(/\s+/g, ' ').slice(0, 56) : null };
  });
  say('  屏上那扇门 #tnX（对照，证明脏检查在）：' + JSON.stringify(zask) + '  开面板 API 在场＝' + zt);
  await Z2.ctx.close();

  /* ================= 对照腿：批次 37 的编辑游记层 ================= */
  say('');
  say('【对照 批次 37 已接好的编辑游记层（pushState 压历史 + popstate 接返回）】');
  const E = await newPage(browser);
  await seedNotes(E.page, DAT);
  await E.page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await E.page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length > 0, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(2000);
  const e0 = await E.page.evaluate(() => ({ histBefore: history.length, notes: TravelNotes.list().length }));
  /* 列表默认在「旅程聚合」视图，而行程卡是折叠的（travel-notes.js:1849 只有 tripOpen 为真
     才 renderItems）——上一遍就在这里量到「库里 5 篇 / 条目 0 枚」，把探针自己的取样没选中
     错当成了对照失效。这里走「时间线」那一档：最新年份默认展开（:1866），月份默认展开（:1874）。 */
  await E.page.evaluate(function () {
    TravelNotes.openList();
    var t = document.querySelector('#tnViewTime');
    if (t) t.click();
    var h = document.querySelector('.tn-trip-head');  /* 万一视图没切过来，把聚合视图的第一张行程卡点开 */
    if (!document.querySelector('.tn-item') && h) h.click();
  });
  await E.page.waitForSelector('.tn-item [data-a="edit"]', { timeout: 15000 }).catch(() => {});
  const e1 = await E.page.evaluate(function () {
    const b = document.querySelector('.tn-item [data-a="edit"]');
    if (b) b.click();
    return { clicked: !!b, histAfter: history.length, items: document.querySelectorAll('.tn-item').length,
      notes: TravelNotes.list().length,
      firstId: (TravelNotes.list()[0] || {}).id || null };
  });
  say('  列表：库里 ' + e1.notes + ' 篇 → 渲染条目 ' + e1.items + ' 枚 → 点第一枚「编辑」' + (e1.clicked ? '成功' : '没找到钮') +
    '；开层前后 history.length ' + e0.histBefore + ' → ' + e1.histAfter);
  await sleep(1300);
  const e1b = await E.page.evaluate(function () {
    return { editPage: !!document.querySelector('.tn-editpage'), hasTxt: !!document.querySelector('#tnEditTxt'), hist: history.length };
  });
  say('  编辑层在场？' + e1b.editPage + '，正文框在场？' + e1b.hasTxt + '，此时 history.length=' + e1b.hist + '（比开层前 ' + (e1b.hist - e0.histBefore) + '：+1＝这一层自己压了一条历史，返回键先落到这层）');
  if (e1b.editPage) {
    await E.page.type('#tnEditTxt', '补一句');
    await E.page.evaluate(() => history.back());
    await sleep(1200);
    const e2 = await E.page.evaluate(function () {
      const c = document.querySelector('.tn-cfm');
      return { ask: !!c, text: c ? (c.innerText || '').replace(/\s+/g, ' ').slice(0, 46) : null, typed: ((document.querySelector('#tnEditTxt') || {}).value || '').slice(-6) };
    }).catch(e => ({ err: String(e.message).slice(0, 50) }));
    say('  层开着发一发返回 → ' + JSON.stringify(e2) + '（这就是批次 37 那套「返回键先问一句」的应有形状，X/Y/Z 三处现在都没有它）');
  } else {
    say('  对照腿没能开层：' + JSON.stringify(e1) + ' —— 这一支只用来给 X/Y/Z 提供「有守卫长什么样」的对照，不影响那三条的结论');
  }
  await E.ctx.close();

  say('');
  say('S 腿页内报错：' + JSON.stringify(S.errs) + ' / W 腿：' + JSON.stringify(P.errs));
  await [S, P].forEach(async x => { try { await x.ctx.close(); } catch (e) {} });
  await browser.close();
  say('');
  say('=== 探针结束 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
})().catch(async e => {
  say('探针异常：' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n'));
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(1);
});
