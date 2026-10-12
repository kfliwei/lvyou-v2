/* tools/smoke-story-landing.js — 批次 39-B 常驻腿：旅程叙事翻页落点必须落在「可读带」里
 *
 * 用户报的事（逐字，2026-10-11 前后）：「旅程叙事翻页后正文被底下那条半透明的条糊住」。
 * 39-A 的地基读数在 tools/out/b39-probe-backlog.txt：改前每翻一站，当前卡的正文最多被浮条盖
 * 1.75 行、被顶栏盖 2.58 行，而且糊住的正是当前这一张；当前卡的照片条整个在带外，按中心点不着
 * （实测 5 枚次）。39-B 把落点与 scroll-spy 都改成读同一个「可读带」（顶栏下缘→翻页条上缘），
 * 这一腿钉住改后的现场。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-story-landing.js
 * 口径：328×723 dpr2；每腿独立 IndexedDB（createBrowserContext）；证据由脚本自己写盘。
 * 期望值取自 tools/out/b39-probe-after.txt 的 U'/V' 两段（不是像素常数，是关系与计数）。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const LOG = path.join(ROOT, 'tools', 'out', 'b39-smoke-story-landing.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const out = [];
let fails = 0, total = 0;
const ERRS = [];
function say(s) { out.push(s); console.log(s); }
function ok(id, name, cond, extra) {
  total++;
  say((cond ? 'PASS  ' : 'FAIL  ') + id + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T07:40:00+08:00').getTime();
const PIX = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='90' height='90' fill='%23AE5738'/%3E%3C/svg%3E";
function dd(i, site, lat, lng, city, txt, pics) {
  const ts = T0 + i * D;
  return {
    id: 'l39b_' + site, title: site + '·记', siteName: site, siteIndex: -1,
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
/* 第 1 篇故意写到比可读带还高：focusCard 那支「贴带上缘」的写法只有这一档能选中，
   种子不给高卡，这一支就没人量（读数为 0 不等于合格）。 */
const HUGE = LONG + LONG + LONG + LONG + LONG;
const DAT = [
  dd(0, '云冈石窟', 40.032, 113.135, '大同', HUGE, [PIX, PIX]),
  dd(1, '华严寺', 40.091, 113.259, '大同', '薄伽教藏殿里的辽代彩塑一排站过去，窗光照在背面那堵壁上。', [PIX, PIX, PIX]),
  dd(2, '大同博物馆', 40.083, 113.310, '大同', '北魏俑阵占了整整一面墙，说明牌写的是平城时期。'),
  dd(3, '晋祠', 37.712, 112.455, '太原', '难老泉的水还是绿的，圣母殿那圈柱子斜得厉害。', [PIX]),
  dd(4, '山西博物院', 37.869, 112.449, '太原', '鸟尊在第一展柜，旁边讲晋侯墓地九组被盗的事。')
];

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => ERRS.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  return { ctx, page };
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

/* 与 39-A 同一把尺子：落在某条带内的正文块、被盖住的像素高、折算成几行 */
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
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      hiddenPx: Math.round(hidden), rows: Number(rws.toFixed(2)),
      active: !!(el.closest('.story-card') && el.closest('.story-card').classList.contains('active'))
    });
  });
  return { band: { top: Math.round(b.top), bottom: Math.round(b.bottom) }, blocks: rows,
    area: Math.round(area), maxRows: Number(maxRows.toFixed(2)) };
};

/* 两把尺子并排放：产品自己的 geo()/bandAt() 与只用 DOM 矩形独立算出来的带，逐发对账 */
const READ = function () {
  var bar = document.querySelector('.story-bar').getBoundingClientRect();
  var nav = document.querySelector('.story-nav').getBoundingClientRect();
  var mp = document.getElementById('storyMap').offsetHeight;
  var y = window.scrollY;
  var a = document.querySelector('.story-card.active');
  var idx = Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), a);
  var bandTop = Math.max(mp - y, 0) + bar.height;
  var r = a ? a.getBoundingClientRect() : null;
  return {
    y: Math.round(y), idx: idx,
    card: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) } : null,
    band: { top: Math.round(bandTop), bottom: Math.round(nav.top), h: Math.round(nav.top - bandTop) },
    fits: r ? (r.top >= bandTop - 1 && r.bottom <= nav.top + 1) : null,
    tall: r ? (r.height > nav.top - bar.height) : null,
    overNavPx: r ? Math.round(Math.max(0, r.bottom - nav.top)) : null,
    underBarPx: r ? Math.round(Math.max(0, bar.bottom - r.top)) : null,
    prod: (function () {
      if (!(window.geo && window.bandAt)) return null;
      var g = geo(), b = bandAt(y);
      return { mp: Math.round(g.mp), barH: Math.round(g.barH), navTop: Math.round(g.navTop), band: [Math.round(b.top), Math.round(b.bottom)] };
    })()
  };
};

/* 等滚动落定（不写死等待毫秒：平滑滚动收尾时刻随帧率漂） */
async function settle(page) {
  let prev = -1, same = 0, guard = 0, last = null;
  while (guard++ < 30) {
    last = await page.evaluate(() => ({ y: Math.round(window.scrollY),
      a: Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), document.querySelector('.story-card.active')) }));
    if (last.y === prev) { if (++same >= 2) break; } else { same = 0; prev = last.y; }
    await sleep(110);
  }
  return last;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 39-B 常驻腿：叙事翻页落点＝可读带内（328×723）===');

  const A = await newPage(browser);
  await seedNotes(A.page, DAT);
  await A.page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await A.page.waitForFunction(() => document.querySelectorAll('.story-card').length > 0, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);

  const nCards = await A.page.evaluate(() => document.querySelectorAll('.story-card').length);
  const nNotes = await A.page.evaluate(() => (window.TravelNotes ? TravelNotes.list().length : -1));
  ok('L00', '种子自校准：5 篇全带坐标 → 5 张卡', nNotes === 5 && nCards === 5, '游记 ' + nNotes + ' 篇，卡 ' + nCards + ' 张');

  /* ---- L01/L02：带只有一把尺子。产品读数与独立读数必须逐发一致，且两档滚动态都要被量到 ---- */
  const g0 = await A.page.evaluate(function () {
    const q = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    return { nav: q('.story-nav'), bar: q('.story-bar'), tab: q('.bottom-nav'), mapH: document.getElementById('storyMap').offsetHeight };
  });
  const e0 = await A.page.evaluate(READ);
  ok('L01', '产品那把尺子在场：geo()/bandAt() 读得到 mp/barH/navTop 三个正数',
    !!e0.prod && e0.prod.mp > 0 && e0.prod.barH > 0 && e0.prod.navTop > 0, '产品 geo ' + JSON.stringify(e0.prod));
  ok('L02', '带顶缘的两个滚动态都被量到：地图还露着那一档（顶缘＝bar.bottom）与顶栏钉住那一档（顶缘＝barH）',
    !!e0.prod && e0.prod.band[0] === e0.band.top && e0.band.top === g0.bar.bottom && e0.band.top > g0.bar.h,
    'scrollY=0 时带 ' + e0.band.top + '–' + e0.band.bottom + '（顶栏高 ' + g0.bar.h + '，地图 ' + g0.mapH + '）');

  let badFit = 0, badSpy = 0, coverBad = 0, coverTall = 0, tallN = 0, deadActive = 0, thumbSeen = 0, bandMismatch = 0;
  async function measure(tag, want) {
    const st = await settle(A.page);
    const r = await A.page.evaluate(READ);
    const on = await A.page.evaluate(OVERLAP, '.story-nav');
    const ob = await A.page.evaluate(OVERLAP, '.story-bar');
    const activeCovered = on.blocks.some(b => b.active) || ob.blocks.some(b => b.active);
    if (r.tall) tallN++;
    const okFit = r.tall ? (r.card.top >= r.band.top - 2 && r.underBarPx <= 0) : r.fits;
    if (!okFit) badFit++;
    if (r.idx !== want) badSpy++;
    /* 比整条带还高的卡做不到「无块被盖」：贴带上缘之后下面必然溢出，这是产品注释里写明的取舍
       （读到哪算哪），所以判据只量装得下的那些卡。高卡那一发单独计数并在下面要求它确实被量到。 */
    if (activeCovered) { if (r.tall) coverTall++; else coverBad++; }
    if (!r.prod || r.prod.band[0] !== r.band.top || r.prod.band[1] !== r.band.bottom) bandMismatch++;
    const v = await A.page.evaluate(function () {
      var a = document.querySelector('.story-card.active');
      if (!a) return { none: true, rows: [] };
      var rows = [];
      a.querySelectorAll('.sc-pics img').forEach(function (img, i) {
        var rc = img.getBoundingClientRect();
        var vis = Math.min(rc.bottom, window.innerHeight) - Math.max(rc.top, 0);
        var cx = Math.round(rc.left + rc.width / 2), cy = Math.round(rc.top + rc.height / 2);
        var top = document.elementsFromPoint(cx, cy)[0] || null;
        rows.push({ i: i + 1, vis: Math.round(vis), cy: cy,
          inVp: cy > 0 && cy < window.innerHeight ? 1 : 0,
          topHit: top ? (top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '')) : 'null',
          self: top === img ? 1 : 0 });
      });
      return { none: false, rows: rows };
    });
    const dead = v.rows.filter(x => x.inVp && x.vis >= 12 && !x.self);
    deadActive += dead.length;
    thumbSeen += v.rows.length;
    say('  ' + tag + '：应当第 ' + (want + 1) + ' 张，spy 认第 ' + (r.idx + 1) + ' 张' + (r.idx === want ? '' : '  ★判给别人') +
      '｜卡 ' + r.card.top + '–' + r.card.bottom + ' 高 ' + r.card.h + '｜带 ' + r.band.top + '–' + r.band.bottom + '（' + r.band.h + 'px）' +
      (r.tall ? '·比带还高' : '') + (okFit ? '｜合格' : '★不合格 下溢 ' + r.overNavPx + '／上盖 ' + r.underBarPx) +
      (activeCovered ? (r.tall ? '（高卡，贴带上缘后下面必然溢出＝设计内取舍）' : '★糊住当前卡') : '当前卡无块被盖') +
      '｜浮条' + on.maxRows + '行 顶栏' + ob.maxRows + '行' +
      '｜缩略图 ' + v.rows.length + ' 枚，点不着 ' + dead.length + (dead.length ? ' ★' + JSON.stringify(dead.map(x => x.i + ':' + x.topHit)) : '') +
      '｜scrollY=' + r.y + ' 落定 active 第 ' + (st.a + 1) + ' 张');
    return r;
  }

  say('');
  say('【L03–L10 逐站翻：正着 4 发 + 往回 4 发（往回必须走满到高卡那一支）】');
  for (let i = 1; i < nCards; i++) {
    await A.page.evaluate(() => document.getElementById('snNext').click());
    await measure('正着第 ' + i + ' 发', i);
  }
  for (let k = 1; k <= nCards - 1; k++) {
    await A.page.evaluate(() => document.getElementById('snPrev').click());
    await measure('往回第 ' + k + ' 发', nCards - 1 - k);
  }
  say('  合计 ' + (2 * (nCards - 1)) + ' 发：落点不合格 ' + badFit + '｜spy 判给别人 ' + badSpy + '｜装得下的卡被盖 ' + coverBad +
    '｜带两把尺子分歧 ' + bandMismatch + '｜高卡档 ' + tallN + ' 发（被盖 ' + coverTall + ' 发，几何上躲不开）｜当前卡缩略图 ' + thumbSeen + ' 枚次，点不着 ' + deadActive);

  ok('L03', '落点不合格 0 处（改前每站都被浮条或顶栏切走，最多 1.75/2.58 行）', badFit === 0, '不合格 ' + badFit + ' 处');
  ok('L04', '装得进带的那些卡：当前卡正文块没有被浮条／顶栏盖住 0 处', coverBad === 0, '盖住 ' + coverBad + ' 处');
  ok('L05', '刚落定就被 scroll-spy 判给邻站：0 处（落点与判据读同一个带中心）', badSpy === 0, '判给别人 ' + badSpy + ' 处');
  ok('L06', '产品 geo/bandAt 与独立 DOM 读数逐发一致：分歧 0 处', bandMismatch === 0, '分歧 ' + bandMismatch + ' 处');
  ok('L07', '当前卡缩略图按中心点不着：0 枚次（改前 5 枚次，中心落进底导航那一档）', deadActive === 0, '点不着 ' + deadActive + ' 枚次');
  ok('L08', '缩略图这一族确实被量到了：当前卡缩略图 ≥3 枚次（种子没选中被测对象时这条要红）', thumbSeen >= 3, '实测 ' + thumbSeen + ' 枚次');
  ok('L09', '「比可读带还高」那一支被选中：高卡 ≥1 发且它落点走的是贴带上缘（不贴就等着被顶栏切）', tallN >= 1 && coverTall === tallN,
    '高卡 ' + tallN + ' 发，被盖 ' + coverTall + ' 发');

  /* 带顶缘必须随滚动态变：地图（44vh）还露着时顶栏压在地图下面，滚过地图后钉回 0，同一条带上缘
     在两种态里是两个值。这里在地图还露着的那一档现量一次，若写成恒 63 或恒 381 就会红。 */
  const mid = await A.page.evaluate(function (y) {
    window.scrollTo(0, y);
    var bar = document.querySelector('.story-bar').getBoundingClientRect();
    var mp = document.getElementById('storyMap').offsetHeight;
    var r = { y: Math.round(window.scrollY), indep: Math.round(Math.max(mp - window.scrollY, 0) + bar.height),
      prod: window.bandAt ? Math.round(bandAt(window.scrollY).top) : -1, barH: Math.round(bar.height), mp: Math.round(mp) };
    return r;
  }, 100);
  await sleep(200);
  ok('L10', '带顶缘是现量的：地图还露着那一档（y=100）顶缘 = 地图下缘−y+顶栏高，且两把尺子同数',
    mid.prod === mid.indep && mid.indep === mid.mp - 100 + mid.barH && mid.indep > mid.barH && mid.indep < mid.mp,
    'y=100 顶缘 产品 ' + mid.prod + '／独立 ' + mid.indep + '（地图 ' + mid.mp + '，顶栏 ' + mid.barH + '）');

  await A.page.evaluate(() => window.scrollTo(0, 0));

  const bad = out.filter(l => /^FAIL/.test(l)).length;
  ok('L11', '全程零未捕获报错', ERRS.length === 0, ERRS.slice(0, 3).join(' | '));
  ok('L12', '本腿条数守卫（≥12 条前置判据，且没有 FAIL 行）', total >= 12 && bad === 0, '实际执行 ' + total + ' 条，FAIL ' + bad);

  await A.ctx.close();
  say('');
  say(fails ? ('=== ' + fails + ' 项失败 ===') : '=== 全部通过 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => {
  say('腿异常：' + e.message);
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(2);
});
