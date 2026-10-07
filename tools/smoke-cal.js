/* tools/smoke-cal.js — 批次 26「游记按日期分组」浏览器闸门
 *
 * 用户报的是「我的游记—日期 tab 没有内容显示，只有 1234567……」。定性结论（tools/out/probe26-cal2.js）：
 * 日历渲染本身没坏，坏在三处口径——① calState.ym 硬默认当前月，笔记都在往月时就只剩一串裸日号，
 * 且 #calDay 是一块纯空白（没有「本月没有」的说明，也没有任何去别处的出口）；
 * ② 格子亮不亮用「正则补零后的键」，点开后过滤用「原始 date 字符串 indexOf」，两套口径
 * → 日期一旦不是补零的 YYYY-MM-DD（2026-10-8 / 2026.10.08 / 2026年10月8日 / 空 / 没有 date 字段），
 * 要么格子根本不亮，要么亮了点开的回答是「当天没有游记」；
 * ③ n.date.slice(...) 在 5 处裸用，date 字段整个缺失时 openList 直接抛
 * Cannot read properties of undefined，列表一栏都出不来。
 * 修法是一个归一单点 TravelNotes.noteDay(n)（day → date 里任意分隔符的年月日 → ts 反推，一律出补零键），
 * 日历默认落在「最近有记录的那个月」，空月给「最近有记录的一天是 X + 跳过去」。
 * 所以这一节钉的不是「日历有没有画出来」，而是**坏形状与好形状必须得到同一个结果**：
 * 每一腿都用畸形日期跑，断言它与对照腿读数一致。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-cal.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;                 /* 一加 Ace 6T 真机档（批次 23-D 改判） */
const sleep = ms => new Promise(r => setTimeout(r, ms));

let checks = 0, fails = 0;
function ok(name, cond, extra) {
  checks++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']'));
  if (!cond) fails++;
}

function note(ts, dateStr, title, day) {
  return {
    id: 'sc_' + title.replace(/\W/g, '') + '_' + ts,
    title: title, siteName: '鹳雀楼', siteIndex: -1,
    lat: 34.84, lng: 110.49, ts: ts,
    date: dateStr, day: day || '',
    province: '山西', city: '运城', county: '永济',
    raw: '正文·' + title, text: '正文·' + title, style: 'plain',
    photos: [], audio: '', tags: ['古建']
  };
}

async function openCtx(browser, rows, errs) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(function () { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
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
        os.clear(); rs.forEach(r => os.put(r));
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) { return window.TravelNotes && TravelNotes.list().length === n; }, { timeout: 20000, polling: 150 }, rows.length)
    .catch(function () { console.log('  (笔记没按条数到货，按现状读)'); });
  return { ctx: ctx, page: page };
}

/* 面板：进日历 tab，读格子与 #calDay，点指定的一天 */
const CAL = function (dayToClick) {
  const q = s => document.querySelector(s);
  const txt = e => ((e && e.textContent) || '').trim();
  TravelNotes.openList();
  q('#tnViewCal').click();
  const cells = Array.prototype.slice.call(document.querySelectorAll('.tn-cal-d[data-day]'));
  const out = {
    head: txt(q('.tn-cal-head b')),
    cells: cells.length,
    has: cells.filter(c => c.classList.contains('has')).length,
    tip: txt(q('#calDay')),
    clicked: '', item: ''
  };
  let target = null;
  if (dayToClick) target = cells.filter(c => c.getAttribute('data-day') === dayToClick)[0];
  if (!target) target = cells.filter(c => c.classList.contains('has'))[0];
  if (target) {
    target.click();
    out.clicked = target.getAttribute('data-day');
    out.item = txt(q('#calDay'));
  }
  return out;
};

const TL = function () {         /* 时间线视图的分组标签 */
  document.querySelector('#tnViewTime').click();
  return Array.prototype.slice.call(document.querySelectorAll('.tn-tl-year, .tn-tl-month, .tn-tl-date'))
    .map(e => ((e.textContent || '').trim().split(' ')[0]));
};

(async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  const now = new Date();
  const Y = now.getFullYear(), M = now.getMonth();
  const pad = n => (n < 10 ? '0' : '') + n;
  const dayKey = d => Y + '-' + pad(M + 1) + '-' + pad(d);            /* 本月·补零 */
  const ts = (mo, d) => new Date(Y, mo, d, 9, 12).getTime();

  /* ---- ① 五种坏形状都要和对照腿得到同一个结果：格子亮、点开有正文 ---- */
  const SHAPES = [
    ['C01 对照·补零 YYYY-MM-DD', note(ts(M, 8), dayKey(8) + ' 09:12', '补零', dayKey(8)), dayKey(8)],
    ['C02 未补零 2026-10-8', note(ts(M, 8), Y + '-' + (M + 1) + '-8 09:12', '未补零', Y + '-' + (M + 1) + '-8'), dayKey(8)],
    ['C03 点号 2026.10.08', note(ts(M, 8), Y + '.' + pad(M + 1) + '.08 15:30', '点号', ''), dayKey(8)],
    ['C04 中文 2026年10月8日', note(ts(M, 8), Y + '年' + (M + 1) + '月8日 09:12', '中文', ''), dayKey(8)],
    ['C05 date 是空串（只剩 ts）', note(ts(M, 8), '', '空串', ''), dayKey(8)],
    ['C06 date 字段整个不存在', (function () { const n = note(ts(M, 8), '', '无字段'); delete n.date; delete n.day; return n; })(), dayKey(8)]
  ];
  for (const [name, row, key] of SHAPES) {
    const { ctx, page } = await openCtx(browser, [row], errs);
    const r = await page.evaluate(CAL, key);
    ok(name + '：日历高亮 1 格（不是满屏裸日号）', r.has === 1, 'head=' + r.head + ' has=' + r.has + '/' + r.cells);
    ok(name + '：点开该格出正文，不是「当天没有游记」', r.item.indexOf('正文·') >= 0 && r.item.indexOf('当天没有游记') < 0, r.item.slice(0, 40));
    await ctx.close();
  }

  /* ---- ② 默认落月：本月一篇都没有时，停在最近有记录的那个月 ---- */
  {
    const dA = new Date(Y, M - 1, 8, 9, 12);      /* 上月 8 日（Date 自己处理跨年） */
    const dB = new Date(Y, M - 2, 8, 9, 12);      /* 两月前 8 日 */
    const rows = [note(dA.getTime(), '', '上月', ''), note(dB.getTime(), '', '两月前', '')];
    const expHead = dA.getFullYear() + ' 年 ' + (dA.getMonth() + 1) + ' 月';
    const { ctx, page } = await openCtx(browser, rows, errs);
    const r = await page.evaluate(CAL);
    ok('C07 笔记都在往月：日历头落在最近有记录的月（不是当前月）', r.head === expHead, 'head=' + r.head + ' 期望 ' + expHead);
    ok('C08 该月有高亮格（症状「只有 1234567」不再出现）', r.has >= 1, 'has=' + r.has);
    ok('C09 一进这一栏就有一句话说明（#calDay 不再是纯空白）', r.tip.length > 0, r.tip.slice(0, 40));
    await ctx.close();
  }

  /* ---- ③ 空月出口：翻到没有记录的月，要说明并给一条跳回去的路 ---- */
  {
    const { ctx, page } = await openCtx(browser, [note(ts(M, 8), dayKey(8) + ' 09:12', '本月八日', dayKey(8))], errs);
    const r = await page.evaluate(CAL);
    ok('C10 有记录的月：提示直接说清本月几篇、要点哪天', r.tip.indexOf('点上面带色的日期看当天') >= 0, r.tip.slice(0, 46));
    const nav = await page.evaluate(function () {
      const q = s => document.querySelector(s), txt = e => ((e && e.textContent) || '').trim();
      q('#calPrev').click();
      const tip = txt(q('#calDay'));
      const g = q('#calGoto');
      let after = null;
      if (g) { g.click(); after = { head: txt(q('.tn-cal-head b')), has: document.querySelectorAll('.tn-cal-d.has').length }; }
      return { prevHead: txt(q('.tn-cal-head b')), tip: tip, hasGoto: !!g, after: after };
    });
    ok('C11 翻到空月：说明「这个月还没有游记」并给出最近有记录的一天', nav.tip.indexOf('这个月还没有游记') >= 0 && /20\d\d-\d\d-\d\d/.test(nav.tip), nav.prevHead + ' / ' + nav.tip.slice(0, 46));
    ok('C12 空月里有「跳过去」这颗钮（只有话没有出口＝还得用户自己逐月翻）', nav.hasGoto === true);
    ok('C13 点「跳过去」回到有记录的月且高亮还在', !!nav.after && nav.after.has >= 1, nav.after ? nav.after.head + ' has=' + nav.after.has : '没有 after');
    await ctx.close();
  }

  /* ---- ④ 另两个视图共用同一口径（时间线分组标签 / 统计天数 / 旅程日档） ---- */
  {
    const bad = note(ts(M, 8), Y + '.' + pad(M + 1) + '.08 15:30', '点号', '');
    const { ctx, page } = await openCtx(browser, [bad], errs);
    await page.evaluate(CAL);
    const labels = await page.evaluate(TL);
    ok('C14 时间线月档用归一键 2026-10（不是照抄原文的 2026.10）', labels.indexOf(Y + '-' + pad(M + 1)) >= 0 && labels.indexOf(Y + '.' + pad(M + 1)) < 0, labels.join(','));
    ok('C15 时间线日档用补零键（同一条笔记在日历与时间线指向同一个键）', labels.indexOf(dayKey(8)) >= 0, labels.join(','));
    const stats = await page.evaluate(function () {
      document.querySelector('#tnStatsBtn').click();
      const cells = Array.prototype.slice.call(document.querySelectorAll('.statgrid > div'));
      const box = cells.filter(function (c) { return ((c.textContent || '').indexOf('天数') >= 0); })[0];
      const v = box ? (box.querySelector('b') || {}).textContent : '';
      const x = document.querySelector('#tnStX'); if (x) x.click();
      return (v || '').trim();
    });
    ok('C16 统计里坏形状这条仍算一天（天数 = 1，不是 0）', stats === '1', '天数=' + stats);
    await ctx.close();
  }

  /* ---- ⑤ 归一口径对外只有一个出口：外部页面不许再自己拼一份解析 ---- */
  {
    const bad = note(ts(M, 8), Y + '年' + (M + 1) + '月8日 09:12', '中文', '');
    const { ctx, page } = await openCtx(browser, [bad], errs);
    const rv = await page.evaluate(function () {
      return { nd: typeof TravelNotes.noteDay, a: TravelNotes.noteDay({ date: '2026.1.9 08:00' }), b: TravelNotes.noteDay({ ts: new Date(2026, 0, 9, 8).getTime() }), c: TravelNotes.noteDay({}) };
    });
    ok('C17 noteDay 对外可见（外部页面复用同一个函数）', rv.nd === 'function');
    ok('C18 noteDay 把 2026.1.9 归一成 2026-01-09（补零）', rv.a === '2026-01-09', rv.a);
    ok('C19 没有日期只给 ts 时由 ts 反推（同一天同一条）', rv.b === '2026-01-09', rv.b);
    ok('C20 既没日期也没 ts 时出空串而不是抛错', rv.c === '', JSON.stringify(rv.c));
    await ctx.close();
    /* review.html 与 index.html 走同一个键 */
    const c2 = await openCtx(browser, [bad], errs);
    await c2.page.goto(U('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(700);
    const rr = await c2.page.evaluate(function () {
      const q = s => document.querySelector(s);
      const has = Array.prototype.slice.call(document.querySelectorAll('.cal-cell.has'));
      let box = '';
      if (has.length) { has[0].click(); box = ((document.getElementById('dayBox') || {}).textContent || '').trim(); }
      return { head: (document.getElementById('calTitle') || {}).textContent, has: has.length, box: box.slice(0, 60) };
    });
    ok('C21 回顾页月历认坏形状（有 .has，不再是一串裸日号）', rr.has >= 1, rr.head + ' has=' + rr.has);
    ok('C22 回顾页点开该天出正文（与面板同一口径）', rr.box.indexOf('正文·中文') >= 0, rr.box.slice(0, 44));
    await c2.ctx.close();

    const c3 = await openCtx(browser, [bad], errs);
    await c3.page.goto(U('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(900);
    const ix = await c3.page.evaluate(function () {
      const e = document.getElementById('tripDates');
      return { txt: ((e && e.textContent) || '').trim(), shown: e ? getComputedStyle(e).display : 'none' };
    });
    ok('C23 首页「我的旅程」那行日期用补零键（不是照抄 2026年10月8日）', /^\d{4}-\d{2}-\d{2} 起 · 历 \d+ 日$/.test(ix.txt), ix.txt);
    await c3.ctx.close();
  }

  /* ---- ⑥ 分组顺序：新→旧、兜底档压最后（源码锚钉的是 sortDays 在场，顺序与形状只有真渲染一次才知道） ---- */
  {
    const rec = note(ts(M, 20), dayKey(20) + ' 09:12', '近期', dayKey(20));
    const old = note(ts(M, 5), dayKey(5) + ' 09:12', '较早', dayKey(5));
    const nod = (function () { const n = note(ts(M, 12), '', '没日期'); delete n.ts; delete n.date; delete n.day; return n; })();
    const { ctx, page } = await openCtx(browser, [rec, old, nod], errs);
    await page.evaluate(CAL);
    const labels = await page.evaluate(TL);
    const iR = labels.indexOf(dayKey(20)), iO = labels.indexOf(dayKey(5)), iU = labels.indexOf('未填日期');
    ok('C26 时间线日档按新→旧排（20 日排在 5 日之前）', iR >= 0 && iO >= 0 && iR < iO, labels.join(','));
    ok('C27 既没日期也没 ts 的那条压在最后（「未填日期」不许冒充最近那一趟）', iU > iO, labels.join(','));
    await ctx.close();
  }

  ok('C24 全程零未捕获报错（坏形状不再让 openList 抛 undefined.slice）', errs.length === 0, errs.slice(0, 3).join(' | '));
  ok('C25 判据条数 ≥ 25（这一节自己也是会被删的）', checks >= 25, 'checks=' + checks);

  console.log('=== smoke-cal: ' + checks + ' 项，失败 ' + fails + ' ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
