/* tools/out/probe39-after.js — 批次 39 改后复量（只读产品码，一行都不改）

 * 39-A 那六把尺子原样再量一遍，量的是改后的屏：
 *   U' 腿＝旅程叙事翻页落点（39-B：浮条/顶栏压正文）→ 期望「当前卡整张落在可读带内」+ spy 认同一张
 *   V' 腿＝同一落点下当前卡缩略图的中心点 → 期望按得着
 *   W' 腿＝排期结果页触控档（39-C：.mv 移除钮 / 「记一笔」/「导航」）→ 期望 44 且行宽不撞破
 *   X'/Y'/Z' 腿＝三处裸关层（39-D）→ 期望返回键先问一句、干净层直接摘、屏上那扇门走同一条路
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe39-after.js
 *
 * 三处口径（上一版读数错在这里，不是产品错）：
 *   ①「压了几条」的基线取进本页时那一格，不取「开层之后」（开层自己就压了，取晚了读成 0）
 *   ②「历史收没收回」读 history.state，不读 history.length——back 只移动 index，length 永不减
 *   ③ 每一步开始前 rewind：上一层／上一个确认框没清场，后面几步的读数全是污染
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = path.join(ROOT, 'tools', 'out', 'b39-probe-after.txt');
const out = [];
function say(s) { out.push(s); console.log(s); }

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T07:40:00+08:00').getTime();
const PIX = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='90' height='90' fill='%23AE5738'/%3E%3C/svg%3E";
function dd(i, site, lat, lng, city, txt, pics) {
  const ts = T0 + i * D;
  return {
    id: 'p39b_' + site, title: site + '·记', siteName: site, siteIndex: -1,
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
      inCard: Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), el.closest('.story-card')) + 1,
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      hiddenPx: Math.round(hidden), rows: Number(rws.toFixed(2)),
      active: !!(el.closest('.story-card') && el.closest('.story-card').classList.contains('active'))
    });
  });
  return { band: { top: Math.round(b.top), bottom: Math.round(b.bottom) }, blocks: rows,
    area: Math.round(area), maxRows: Number(maxRows.toFixed(2)) };
};

/* 产品自己的落点读数：带用 DOM 矩形独立算一遍，产品那套 geo()/bandAt() 的读数并排放着对账 */
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

/* 等滚动落定（不写死等待毫秒：平滑滚动收尾时刻随帧率漂），顺带记录动画期间 active 被改判了几次 */
async function settle(page) {
  let prev = -1, same = 0, guard = 0;
  const seen = [];
  while (guard++ < 30) {
    const st = await page.evaluate(() => ({ y: Math.round(window.scrollY),
      a: Array.prototype.indexOf.call(document.querySelectorAll('.story-card'), document.querySelector('.story-card.active')) }));
    seen.push(st);
    if (st.y === prev) { if (++same >= 2) break; } else { same = 0; prev = st.y; }
    await sleep(110);
  }
  const seq = [];
  seen.forEach(function (s) { if (seq[seq.length - 1] !== s.a) seq.push(s.a); });
  return { frames: seen.length, churn: seq.map(i => '第' + (i + 1) + '张').join('→'), final: seen[seen.length - 1] };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });

  say('=== 批次 39 改后复量（视口 ' + VW + '×' + VH + '，真机档）===');

  /* ============ U' / V' 腿：旅程叙事 ============ */
  const S = await newPage(browser);
  await seedNotes(S.page, DAT);
  await S.page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await S.page.waitForFunction(() => document.querySelectorAll('.story-card').length > 0, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);

  say('');
  say("【U'1 几何（与 39-A 的 U1 同一档）】");
  const g0 = await S.page.evaluate(function () {
    const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    return { nav: g('.story-nav'), tab: g('.bottom-nav'), bar: g('.story-bar'), mapH: document.getElementById('storyMap').offsetHeight,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight };
  });
  say('  顶栏 ' + JSON.stringify(g0.bar) + '｜翻页浮条 ' + JSON.stringify(g0.nav) + '｜底导航 ' + JSON.stringify(g0.tab) +
    '｜地图高 ' + g0.mapH + '｜可滚范围 0–' + g0.maxScroll);
  say('  带（地图让开后）= ' + g0.bar.bottom + '–' + g0.nav.top + '，' + (g0.nav.top - g0.bar.bottom) + 'px；带（scrollY=0，地图还全露）= ' +
    (g0.mapH + g0.bar.h) + '–' + g0.nav.top + '，' + (g0.nav.top - g0.mapH - g0.bar.h) + 'px');

  const nCards = await S.page.evaluate(() => document.querySelectorAll('.story-card').length);
  await S.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  let badFit = 0, badSpy = 0, coverAct = 0, deadActive = 0, tallN = 0, entryCover = 0;
  const row0 = [];
  say('');
  say("【U'2 进屏第一屏（scrollY=0，产品在这一档不调 focusCard）】");
  {
    const r = await S.page.evaluate(READ);
    const on = await S.page.evaluate(OVERLAP, '.story-nav');
    const act = on.blocks.filter(b => b.active);
    if (act.length) entryCover++;
    say('  卡 ' + (r.card ? r.card.top + '–' + r.card.bottom + ' 高 ' + r.card.h : 'null') + '｜带 ' + r.band.top + '–' + r.band.bottom +
      '｜整张在带内？' + r.fits + (r.fits ? '' : '（下溢 ' + r.overNavPx + 'px 被浮条盖住）') +
      '｜浮条盖住当前卡的正文块 ' + act.length + ' 枚' + (act.length ? '：' + act.map(b => b.cls + ' ' + b.hiddenPx + 'px≈' + b.rows + '行').join('、') : ''));
  }
  say('');
  say("【U'3 按「下一站」逐站翻（产品自己的落点，从第 2 站起每一站都真点）】");
  for (let i = 0; i < nCards; i++) {
    if (i > 0) await S.page.evaluate(() => document.getElementById('snNext').click());
    const st = i > 0 ? await settle(S.page) : { frames: 0, churn: '没点', final: {} };
    const r = await S.page.evaluate(READ);
    const on = await S.page.evaluate(OVERLAP, '.story-nav');
    const ob = await S.page.evaluate(OVERLAP, '.story-bar');
    const activeCovered = on.blocks.some(b => b.active) || ob.blocks.some(b => b.active);
    if (i === 0) continue;
    if (r.tall) tallN++;
    const okFit = r.tall ? (r.card.top >= r.band.top - 2 && r.underBarPx <= 0) : r.fits;
    if (!okFit) badFit++;
    if (r.idx !== i) badSpy++;
    if (activeCovered) coverAct++;
    say('  第 ' + (i + 1) + '/' + nCards + ' 站：spy 认第 ' + (r.idx + 1) + ' 张' + (r.idx === i ? '' : '  ★刚落定就被判给别人') +
      '｜卡 ' + (r.card ? r.card.top + '–' + r.card.bottom + ' 高 ' + r.card.h : 'null') +
      '｜带 ' + r.band.top + '–' + r.band.bottom + '（' + r.band.h + 'px）' + (r.tall ? '·比带还高' : '') +
      (okFit ? '｜落点合格' : '｜★不合格：下溢 ' + r.overNavPx + 'px / 上被顶栏盖 ' + r.underBarPx + 'px') +
      '｜浮条盖块 ' + on.blocks.length + '/最多 ' + on.maxRows + ' 行，顶栏盖块 ' + ob.blocks.length + '/最多 ' + ob.maxRows + ' 行' +
      (activeCovered ? '  ★糊住的正是当前这一张' : ''));
    say('      scrollY=' + r.y + ' 落定用 ' + st.frames + ' 帧，动画里 active 序列 ' + st.churn +
      '｜产品 geo ' + JSON.stringify(r.prod) + '（独立读数 带 ' + r.band.top + '/' + r.band.bottom + '，顶栏高 ' + (r.band.top - Math.max(g0.mapH - r.y, 0)) + '）');
    const v = await S.page.evaluate(function () {
      var a = document.querySelector('.story-card.active');
      if (!a) return { none: true };
      var rows = [];
      a.querySelectorAll('.sc-pics img').forEach(function (img, i) {
        var rc = img.getBoundingClientRect();
        var vis = Math.min(rc.bottom, window.innerHeight) - Math.max(rc.top, 0);
        var cx = Math.round(rc.left + rc.width / 2), cy = Math.round(rc.top + rc.height / 2);
        var top = document.elementsFromPoint(cx, cy)[0] || null;
        rows.push({ i: i + 1, vis: Math.round(vis), rect: [Math.round(rc.top), Math.round(rc.bottom)], cy: cy,
          inVp: cy > 0 && cy < window.innerHeight ? 1 : 0,
          topHit: top ? (top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '')) : 'null',
          self: top === img ? 1 : 0 });
      });
      return { rows: rows };
    });
    if (!v.none && v.rows.length) {
      const dead = v.rows.filter(x => x.inVp && x.vis >= 12 && !x.self);
      deadActive += dead.length;
      say('      当前卡缩略图：' + v.rows.map(function (x) { return '第' + x.i + '枚 ' + x.rect.join('–') + ' 中心 ' + x.cy + (x.inVp ? '' : '(屏外)') + ' 最上层 ' + x.topHit + (x.self ? '' : ' ★点不着'); }).join('；') +
        ' ⇒ 点不着 ' + dead.length + ' 枚');
    }
  }
  /* 往回翻一发（上一站）：往上跳是「贴带上缘」那一支最容易和 spy 打架的方向 */
  say('');
  say("【U'4 往回翻（点「上一站」）】");
  {
    const n = await S.page.evaluate(() => document.querySelectorAll('.story-card').length);
    for (let k = 0; k < 2; k++) {
      await S.page.evaluate(() => document.getElementById('snPrev').click());
      const st = await settle(S.page);
      const r = await S.page.evaluate(READ);
      const on = await S.page.evaluate(OVERLAP, '.story-nav');
      const ob = await S.page.evaluate(OVERLAP, '.story-bar');
      const activeCovered = on.blocks.some(b => b.active) || ob.blocks.some(b => b.active);
      const want = n - 2 - k;
      if (r.tall) tallN++;
      const okFit = r.tall ? (r.card.top >= r.band.top - 2 && r.underBarPx <= 0) : r.fits;
      if (!okFit) badFit++;
      if (r.idx !== want) badSpy++;
      if (activeCovered) coverAct++;
      say('  往回第 ' + (k + 1) + ' 发（应当到第 ' + (want + 1) + ' 张）：spy 认第 ' + (r.idx + 1) + ' 张' + (r.idx === want ? '' : '  ★被判给别人') +
        '｜卡 ' + r.card.top + '–' + r.card.bottom + ' 高 ' + r.card.h + '｜带 ' + r.band.top + '–' + r.band.bottom +
        (r.tall ? '·比带还高' : '') + (okFit ? '｜落点合格' : '｜★下溢 ' + r.overNavPx + 'px / 上盖 ' + r.underBarPx + 'px') +
        '｜' + (activeCovered ? '★糊住的正是当前这一张' : '当前卡无块被盖') + '｜动画里 active 序列 ' + st.churn);
      row0.push('prev' + k);
    }
  }
  say('');
  say("【U'/V' 合计】翻页落点（含往回两发）共 " + (nCards - 1 + 2) + ' 发：不合格 ' + badFit + ' 处｜spy 判给别人 ' + badSpy + ' 处｜糊住当前卡 ' + coverAct +
    ' 处（39-A 改前：每站最多 1.75/2.58/1.69 行，★糊住的正是当前这一张）｜当前卡缩略图点不着 ' + deadActive + ' 枚次（改前 5 枚次）');
  say('  进屏第一屏（scrollY=0，产品不调 focusCard）当前卡被浮条盖住？' + (entryCover ? '是——这一档的带只有 ' + (g0.nav.top - g0.mapH - g0.bar.h) + 'px，比任何一张卡都矮，是设计内的取舍' : '否'));
  say('  页内报错：' + JSON.stringify(S.errs));

  /* ============ W' 腿：排期结果页触控档 ============ */
  say('');
  say("【W' 排期结果页：改后的触控档与行宽】");
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
  const WCENS = function () {
    var sel = '#resultBody button, #resultBody a, #resultBody input, #resultBody [role="button"], #resultBody .chip';
    var seen = {}, list = [];
    document.querySelectorAll(sel).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var cls = String(el.className || el.tagName).split(' ')[0] + (el.classList && el.classList.contains('mv-del') ? '-del' : '');
      var key = cls + '|' + Math.round(r.height) + '|' + Math.round(r.width);
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
    var opsRows = [].map.call(document.querySelectorAll('.stop-acts'), function (a) {
      var o = a.querySelector('.ops'), r = o ? o.getBoundingClientRect() : null;
      var ar = a.getBoundingClientRect();
      var del = o ? o.querySelector('.mv-del') : null;
      return {
        opsNeed: r ? Math.round(r.width) : null,
        delW: del ? Math.round(del.getBoundingClientRect().width) : null,
        delH: del ? Math.round(del.getBoundingClientRect().height) : null,
        opsScroll: o ? o.scrollWidth : null, opsClient: o ? Math.round(o.clientWidth) : null,
        actsH: Math.round(ar.height),
        spill: r ? Math.round(r.right - ar.right) : null
      };
    });
    var cards = [].map.call(document.querySelectorAll('.day-card'), function (c) { return c.scrollWidth - c.clientWidth; });
    var mini = document.querySelector('.stop-acts .btn.mini');
    var nav = document.querySelector('.day-card .dhead .btn');
    return {
      all: list,
      dayCards: document.querySelectorAll('#resultBody .day-card').length,
      stopRows: document.querySelectorAll('#resultBody .stop').length,
      travelOn: !!mini,
      actsBoxW: arect ? Math.round(arect.width) : null,
      actsPad: acs ? acs.paddingLeft : null,
      contentW: arect ? Math.round(arect.width - parseFloat(acs.paddingLeft) - parseFloat(acs.paddingRight)) : null,
      opsRows: opsRows,
      spillAny: opsRows.some(function (x) { return x.spill > 1; }),
      delAll: opsRows.every(function (x) { return x.delW === 44 && x.delH === 44; }),
      cardSpillMax: cards.length ? Math.max.apply(null, cards) : null,
      pageScrollW: document.documentElement.scrollWidth, pageClientW: document.documentElement.clientWidth,
      miniW: mini ? Math.round(mini.getBoundingClientRect().width) : null,
      miniH: mini ? Math.round(mini.getBoundingClientRect().height) : null,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      navInline: nav ? (nav.getAttribute('style') || '').slice(0, 46) : null
    };
  };
  function wreport(tag, w) {
    say('  ┌ ' + tag);
    say('  │ 日卡 ' + w.dayCards + ' 张 / 站点行 ' + w.stopRows + ' 行；「记一笔」' + (w.travelOn ? '在场 宽 ' + w.miniW + '×高 ' + w.miniH : '不在场') +
      '｜「导航」钮高 ' + w.navH + '（内联写死：' + w.navInline + '）');
    say('  │ .stop-acts 盒宽 ' + w.actsBoxW + 'px，左内衬 ' + w.actsPad + ' ⇒ 可用宽 ' + w.contentW + 'px');
    w.opsRows.forEach(function (r, i) {
      say('  │   第 ' + (i + 1) + ' 行：.ops 实占 ' + r.opsNeed + 'px，移除钮 ' + r.delW + '×' + r.delH + '，行高 ' + r.actsH + 'px，右缘越界 ' + r.spill + 'px，ops scrollW/clientW=' + r.opsScroll + '/' + r.opsClient);
    });
    say('  │ 移除钮是否每行都 44×44？' + (w.delAll ? '是' : '★否') + '｜任何一行挤出盒外？' + (w.spillAny ? '★是' : '否') +
      '｜日卡内横向溢出最大 ' + w.cardSpillMax + 'px｜文档 scrollW/clientW=' + w.pageScrollW + '/' + w.pageClientW);
    say('  │ 低于 44 的一族：' + (w.all.filter(function (x) { return x.h < 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n + '枚「' + x.label + '」'; }).join(' | ') || '无'));
    say('  │ ≥44 的一族：' + (w.all.filter(function (x) { return x.h >= 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n + '枚「' + x.label + '」'; }).join(' | ') || '无'));
  }
  const w0 = await P.page.evaluate(WCENS);
  wreport("W'1 未出行态", w0);
  await P.page.evaluate(() => { window.plannerStartTrip(); });
  await sleep(1200);
  const w1 = await P.page.evaluate(WCENS);
  wreport("W'2 出行态（多一枚「记一笔」，行最挤）", w1);
  say('  ⇒ 判据：移除钮 44×44、「记一笔」/「导航」高 ≥44、右缘越界 0、日卡内横向溢出 0、文档 scrollW=clientW；上移/下移/锁定留 30（可逆轻操作那一档，39-A 定的口径，不许被顺手抬上去）');
  say('  页内报错：' + JSON.stringify(P.errs));

  /* ============ X'/Y'/Z' 腿：三处层的返回键 ============ */
  const LAY = [
    { k: 'X', page: 'node-manager.html', load: 3000, api: '!!(window.NM&&NM.map)',
      open: function (page) { return page.evaluate(function () { NM.map.fire('touchstart', { latlng: NM.map.getCenter() }); }).then(() => sleep(900)); },
      type: function (page) { return page.type('#nmName', '鹳雀楼（试验）').then(() => sleep(200)); },
      /* 机器填的那两格（逆地理城市 / 海拔）走异步请求：不等它们落地就发返回，测到的是「请求还没回来」
         那一档，判出来的「没内容也拦」是竞态不是缺陷。这里轮询到数值稳定再走下一步。 */
      afterOpen: function (page) {
        return page.evaluate(function () {
          return new Promise(function (res) {
            var last = null, same = 0, guard = 0;
            (function tick() {
              var c = ((document.querySelector('#nmCity') || {}).value) || '';
              var e = ((document.querySelector('#nmElev') || {}).value) || '';
              var cur = c + '|' + e;
              if (cur === last) { if (++same >= 4) return res({ city: c, elev: e, frames: guard }); }
              else { same = 0; last = cur; }
              if (guard++ > 60) return res({ city: c, elev: e, frames: guard, to: 1 });
              setTimeout(tick, 150);
            })();
          });
        }).then(function (v) { return sleep(500).then(function () { return v; }); });
      },
      field: '#nmName', door: '#nmCancel',
      read: function () {
        var m = document.querySelector('.ui-modal-mask:not(.nm-mask)');
        return { hist: history.length, st: histState(), alive: !!document.querySelector('#nmName'),
          typed: ((document.querySelector('#nmName') || {}).value || '').slice(0, 12) || null,
          ask: !!m, askText: m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
      },
      ok: function () { const b = document.querySelector('.ui-modal-mask:not(.nm-mask) .ui-btn-primary'); if (b) b.click(); },
      no: function () { const b = document.querySelector('.ui-modal-mask:not(.nm-mask) .ui-btn-ghost'); if (b) b.click(); },
      doorClick: function () { const b = document.getElementById('nmCancel'); if (b) b.click(); } },
    { k: 'Y', page: 'review.html', load: 2600, api: '!!(window.Results&&Results.itinerary)',
      open: function (page) {
        return page.evaluate(function () {
          Results.itinerary([{ name: '云冈石窟', lat: 40.032, lng: 113.135 }, { name: '华严寺', lat: 40.091, lng: 113.259 }], '山西');
        }).then(() => sleep(900));
      },
      type: function (page) { return page.type('#ipref', '不看博物馆，只看地上文物').then(() => sleep(200)); },
      field: '#ipref', door: '#ix',
      read: function () {
        var m = document.querySelector('.ui-modal-mask');
        return { hist: history.length, st: histState(), alive: !!document.querySelector('#igo'),
          typed: ((document.querySelector('#ipref') || {}).value || '').slice(0, 12) || null,
          ask: !!m, askText: m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
      },
      ok: function () { const b = document.querySelector('.ui-modal-mask .ui-btn-primary'); if (b) b.click(); },
      no: function () { const b = document.querySelector('.ui-modal-mask .ui-btn-ghost'); if (b) b.click(); },
      doorClick: function () { const b = document.getElementById('ix'); if (b) b.click(); } },
    { k: 'Z', page: 'travel-map.html', load: 2400, api: '!!(window.TravelNotes&&TravelNotes.openPanel)',
      open: function (page) {
        return page.evaluate(function () { TravelNotes.openPanel({ label: '云冈石窟', name: '云冈石窟', lat: 40.032, lng: 113.135 }); }).then(() => sleep(1000));
      },
      type: function (page) {
        return page.evaluate(function () {
          var ta = document.querySelector('#tnRawEdit');
          if (ta) { ta.value = '先说一段话试试：今天风很大，护栏还在修。'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }).then(() => sleep(250));
      },
      field: '#tnRawEdit', door: '#tnX',
      read: function () {
        var p = document.querySelector('.tn-panel'), c = document.querySelector('.tn-cfm');
        return { hist: history.length, st: histState(), alive: !!p && getComputedStyle(p).display !== 'none',
          typed: ((document.querySelector('#tnRawEdit') || {}).value || '').slice(0, 14) || null,
          ask: !!c, askText: c ? (c.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
      },
      ok: function () { const b = document.querySelector('.tn-cfm .tc-ok'); if (b) b.click(); },
      no: function () { const b = document.querySelector('.tn-cfm .tc-no'); if (b) b.click(); },
      doorClick: function () { const b = document.getElementById('tnX'); if (b) b.click(); } }
  ];

  /* 探针自己往页面挂一个读数器：history.length 证明不了「历史收掉了」（back 只移动 index，不减 length，
     上一轮就是拿它判 ③ 才把三条都读成假红），能观测的是 history.state 落回哪一格。产品码一行不改。 */
  async function injectHistState(page) {
    await page.evaluate(function () {
      window.histState = function () { try { return history.state ? JSON.stringify(history.state).slice(0, 24) : 'null'; } catch (e) { return 'err'; } };
    });
  }
  /* 每一步开始前清场：确认框挂着就点「关掉不存」，层还开着就走屏上那扇门（脏的话下一轮变确认框）。
     上一轮 ③④⑤⑥ 的失真全是「上一步的遗留层/框没清」。 */
  async function rewind(A, cfg) {
    for (let i = 0; i < 4; i++) {
      const s = await A.page.evaluate(cfg.read);
      if (s.ask) { await A.page.evaluate(cfg.ok); await sleep(700); continue; }
      if (s.alive) { await A.page.evaluate(cfg.doorClick); await sleep(600); continue; }
      break;
    }
    await sleep(300);
  }

  const SUM = {};
  for (const cfg of LAY) {
    say('');
    say('【' + cfg.k + "' " + cfg.page + '：①开层压历史 ②脏着返回先问 ③确认关掉 ④干净层直接摘 ⑤屏上那扇门同一条路 ⑥「继续填」不许收层】');
    const A = await newPage(browser);
    const base = await A.page.evaluate(() => history.length);
    await A.page.goto(U(cfg.page), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(cfg.load);
    await injectHistState(A.page);
    const hIn = await A.page.evaluate(() => ({ hist: history.length, st: histState() }));
    const avail = await A.page.evaluate(function (fn) {
      try { return { v: !!((new Function('return (' + fn + ')'))()) }; } catch (e) { return { v: false, err: String(e.message).slice(0, 50) }; }
    }, cfg.api);
    if (!avail.v) { say('  ★入口不在场：' + JSON.stringify(avail) + ' ⇒ 这一条腿没量到，不能算过'); await A.ctx.close(); continue; }
    const r = {};
    await cfg.open(A.page);
    r.fill1 = cfg.afterOpen ? await cfg.afterOpen(A.page) : null;
    r.openClean = await A.page.evaluate(cfg.read);
    await cfg.type(A.page);
    {
      const q = await A.page.evaluate(cfg.read);
      r.push = r.openClean.hist - hIn.hist;
      r.pushedState = r.openClean.st;
      r.dirty = q;
      say('  ① 开层（进本页 hist=' + hIn.hist + '）→ 开完 hist=' + r.openClean.hist + '｜打字后 hist=' + q.hist + '（打字不压条）' +
        '｜这一层压了 ' + r.push + ' 条（改前 0 条：新开页时返回键＝退出应用）｜state 落点 ' + r.openClean.st +
        (r.fill1 ? '｜机器填的 city=「' + r.fill1.city + '」elev=「' + r.fill1.elev + '」' : '') +
        '｜打字读数 ' + JSON.stringify(q));
    }
    await A.page.evaluate(() => history.back());
    await sleep(1400);
    r.ask = await A.page.evaluate(cfg.read);
    say('  ② 脏着发一发返回：' + JSON.stringify({ hist: r.ask.hist, st: r.ask.st, alive: r.ask.alive, ask: r.ask.ask, typed: r.ask.typed }) +
      ' ⇒ ' + (r.ask.ask && r.ask.alive ? '落回这一层并问出口「' + r.ask.askText + '」，字还在' : (r.ask.alive ? '★层还在但没问＝popstate 没接上' : '★层裸关／整页走掉，字没了')));
    await A.page.evaluate(cfg.ok);
    await sleep(1300);
    r.closed = await A.page.evaluate(cfg.read);
    const back1 = r.closed.st === hIn.st;
    say('  ③ 确认框点「关掉不存」：' + JSON.stringify({ hist: r.closed.hist, st: r.closed.st, alive: r.closed.alive, ask: r.closed.ask, typed: r.closed.typed }) +
      ' ⇒ ' + (!r.closed.alive ? '层摘掉' : '★层还开着') + '｜确认框自己摘干净？' + (r.closed.ask ? '★否：同一发返回被问了两次' : '是') +
      '｜历史收回：state 从 ' + r.pushedState + ' 落回 ' + r.closed.st + '（进本页时 ' + hIn.st + '）⇒ ' + (back1 ? '收回了' : '★没收回'));
    await rewind(A, cfg);
    const pre4 = await A.page.evaluate(cfg.read);
    await cfg.open(A.page);
    const fill4 = cfg.afterOpen ? await cfg.afterOpen(A.page) : null;
    const r4a = await A.page.evaluate(cfg.read);
    await A.page.evaluate(() => history.back());
    await sleep(1400);
    r.clean = await A.page.evaluate(cfg.read);
    say('  ④ 干净层（没打一个字；开层前 state ' + pre4.st + '／' + (fill4 ? '机器填完 city=「' + fill4.city + '」elev=「' + fill4.elev + '」用了 ' + fill4.frames + ' 次轮询' + (fill4.to ? '，★到上限没收' : '') : '这一层没有机器异步填的格') + '，state ' + r4a.st + '）发返回：' + JSON.stringify({ hist: r.clean.hist, st: r.clean.st, alive: r.clean.alive, ask: r.clean.ask }) +
      ' ⇒ ' + (!r.clean.alive && !r.clean.ask ? '直接摘，不白问一句' : (r.clean.ask ? '★没内容也拦（脏检查把机器写的字算进去了）' : '★层还开着（返回键把这一发吞了却没关）')));
    await rewind(A, cfg);
    const pre5 = await A.page.evaluate(cfg.read);
    await cfg.open(A.page);
    await cfg.type(A.page);
    await A.page.evaluate(cfg.doorClick);
    await sleep(1000);
    r.door = await A.page.evaluate(cfg.read);
    say('  ⑤ 脏着点屏上那扇门 ' + cfg.door + '（开层前 state ' + pre5.st + '）：' + JSON.stringify({ alive: r.door.alive, ask: r.door.ask, typed: r.door.typed, st: r.door.st }) +
      ' ⇒ ' + (r.door.ask && r.door.alive ? '与返回键走同一条脏检查（「' + r.door.askText + '」）' : '★没问＝两扇门两条路'));
    await A.page.evaluate(cfg.no);
    await sleep(800);
    r.stay = await A.page.evaluate(cfg.read);
    say('  ⑥ 确认框点「继续填」：' + JSON.stringify({ alive: r.stay.alive, ask: r.stay.ask, typed: r.stay.typed, hist: r.stay.hist, st: r.stay.st }) +
      ' ⇒ ' + (r.stay.alive && !r.stay.ask ? '层留着、字留着（' + r.stay.typed + '）' : '★这一发把层收了') +
      '｜这一层的条目还在场？' + (r.stay.st === r.door.st ? '是（' + r.stay.st + '，不收就会叠＝批次 37 那把尺子）' : '★否：' + r.door.st + '→' + r.stay.st));
    say('  全程 hist 只增不减（' + hIn.hist + '→' + r.stay.hist + '）——它证明不了任何事，判据一律读 state');
    say('  页内报错：' + JSON.stringify(A.errs));
    SUM[cfg.k] = { push: r.push, ask: r.ask.ask && r.ask.alive, noDoubleAsk: !r.closed.ask, back: back1,
      clean: !r.clean.alive && !r.clean.ask, door: r.door.ask && r.door.alive, stay: r.stay.alive && !r.stay.ask,
      entryKept: r.stay.st === r.door.st, errs: A.errs };
    await A.ctx.close();
  }

  say('');
  say('=== 判据汇总（§54 的期望值从这里取）===');
  say("  U' 翻页落点：不合格 " + badFit + ' 处（期望 0）｜spy 判给别人 ' + badSpy + ' 处（期望 0）｜糊住当前卡 ' + coverAct + ' 处（期望 0）');
  say("  V' 当前卡缩略图按中心点不着：" + deadActive + ' 枚次（期望 0）');
  say("  U' 进屏第一屏：当前卡被浮条盖 " + (entryCover ? '是（' + (g0.nav.top - g0.mapH - g0.bar.h) + 'px 的带装不下任何一张卡，设计内取舍，§54 不把这一档算进判据）' : '否'));
  say("  W' 触控档：未出行态 移除钮 44×44？" + (w0.delAll ? '是' : '否') + '｜越界 ' + (w0.spillAny ? '★有' : '0') + '｜日卡溢出 ' + w0.cardSpillMax + '｜文档宽 ' + w0.pageScrollW + '/' + w0.pageClientW);
  say("     出行态 「记一笔」高 " + w1.miniH + '｜「导航」高 ' + w1.navH + '｜移除钮 44×44？' + (w1.delAll ? '是' : '否') + '｜越界 ' + (w1.spillAny ? '★有' : '0') + '｜日卡溢出 ' + w1.cardSpillMax + '｜文档宽 ' + w1.pageScrollW + '/' + w1.pageClientW);
  Object.keys(SUM).forEach(function (k) {
    const s = SUM[k];
    say('  ' + k + "'：开层压历史 +" + s.push + '（要 1）｜脏返回先问 ' + (s.ask ? '是' : '★否') + '｜确认后不重复问 ' + (s.noDoubleAsk ? '是' : '★否') +
      '｜确认后 state 落回进本页那一格 ' + (s.back ? '是' : '★否') + '｜干净层直接摘 ' + (s.clean ? '是' : '★否') +
      '｜屏上门同路 ' + (s.door ? '是' : '★否') + '｜继续填不收层 ' + (s.stay ? '是' : '★否') + '（条目还在场 ' + (s.entryKept ? '是' : '★否') + '）｜报错 ' + JSON.stringify(s.errs));
  });

  say('');
  say('=== 探针结束 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
  await browser.close();
})().catch(async e => {
  say('探针异常：' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n'));
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(1);
});
