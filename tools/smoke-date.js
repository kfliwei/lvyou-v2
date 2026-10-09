/* tools/smoke-date.js — 批次 31「同一个日期键，屏上能印出五种写法」浏览器闸门
 *
 * 用户点单（逐字）：「日期显示统一」。
 * 地基实测（tools/out/b31-divergence.txt 与 b31-mdm.txt，328×723 真浏览器腿）：五条种子全部归一到同一个键
 * 2026-10-08，日历格与点开都对，可屏上那行日期却读成 `2026-10-8`、`2026.10.08`、`2026年10月8日`、空串、
 * `十月八号` 五种——因为 §41 只把「键」收进 noteDay()，显示那一路各页面还在各自抄 n.date / slice(0,10) / 拼年月日。
 *
 * 这一节断言的三件事（源码腿 §46 断言不了的部分）：
 *   ① 同一个键在**每一个页面**印成同一个串：只有真把七个页面都打开、真读 innerText 才知道有没有漏网的落点；
 *      源码腿能钉住「写了什么」，钉不住「渲染出来是什么」（天气、标签、坏数据兜底都会改变那一行的文字）。
 *   ② 坏数据不许伪装成好数据，也不许把原始坏串直接吐到屏上：形状全坏的那条读空，而不是印 `十月八号`／`NaN`。
 *   ③ 时刻那一族不再跟系统 locale 走：`生成于/记录于/上次同步/抽屉那行` 必须是 `YYYY-MM-DD`（+ `HH:MM`），
 *      而不是 en-US 的 10/8/2026 或 zh-CN 的 2026/10/8。
 *
 * 名字前缀 D（date）。用法: NODE_PATH=tools/node_modules node tools/smoke-date.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;                 /* 一加 Ace 6T 真机档（§37 口径） */
const sleep = ms => new Promise(r => setTimeout(r, ms));

const DAY = '2026-10-08';

/* 屏上日期形状的刀（只写一次，正判据与反证共用）：抓「四位年 + 任意分隔 + 月 + 任意分隔 + 日」。
   抓到之后逐枚判形状：只有 `-` 分隔且月日都补零才算统一档，其余（点号 / 斜杠 / 年月日汉字 / 没补零）一律算 divergent。
   另外单独抓中文数字日期与 NaN——那是「坏数据直接吐上屏」的两种形态。 */
const SHAPE_SRC = '(\\d{4})([.\\-/年])(\\d{1,2})([.\\-/月])(\\d{1,2})日?';
const BAD_CN = /[一二三四五六七八九十]+月[一二三四五六七八九十]+号/;
const DIVERGENT = function (text) {
  const out = [];
  const re = new RegExp(SHAPE_SRC, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const sep1 = m[2], sep2 = m[4], mm = m[3], dd = m[5];
    if (m[0] === DAY) continue;
    if (sep1 === '-' && sep2 === '-' && mm.length === 2 && dd.length === 2) continue;
    out.push(m[0]);
  }
  if (BAD_CN.test(text)) out.push(text.match(BAD_CN)[0]);
  if (/NaN/.test(text)) out.push('NaN');
  return out;
};
/* 页面上所有「日期可能出现在的地方」：可见文本 + 读屏会念的属性 */
const PAGE_DATE_TEXT = () => {
  let t = document.body.innerText || '';
  document.querySelectorAll('[aria-label],[title]').forEach(function (el) {
    t += '\n' + (el.getAttribute('aria-label') || '') + '\n' + (el.getAttribute('title') || '');
  });
  return t;
};

let checks = 0, fails = 0;
const lines = [];
function ok(name, cond, extra) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']');
  console.log(s); lines.push(s);
  if (!cond) fails++;
}

/* 五条记录全落 2026-10-08 这个键，但**存进去的形状各不相同**（这就是历史数据/导入/备份恢复的真实样子）：
   A 缺尾零的点缺失形、B 齐整的点号形、C 汉字形、D 只有 ts（date 字段整个坏掉）、E 日期与 ts 全坏。
   ts 全部给具体数字（不再有 `if (!p.ts) p.ts = DAY` 那种把 ts:0 覆盖掉的取样缺陷——上一批地基证据栽在这里）。
   注意：SEED 会被序列化后在页面里执行，Node 侧的常量它一个都读不到——所以那一串数字必须写在函数体里。 */
const SEED = () => {
  const DAY_TS = new Date(2026, 9, 8, 14, 23).getTime();
  const mk = o => Object.assign({
    province: '山西', city: '大同', photos: [], audio: '', tags: ['古城'], weather: '晴 18℃',
  }, o);
  const list = [
    mk({ id: 'dA', title: '形状A点号缺', siteName: '测试点A', lat: 39.5606, lng: 114.0862, ts: DAY_TS, date: '2026-10-8', text: 'A 的正文', raw: 'A 的正文' }),
    mk({ id: 'dB', title: '形状B点号齐', siteName: '测试点B', lat: 39.5606, lng: 114.0862, ts: DAY_TS + 3600e3, date: '2026.10.08', text: 'B 的正文', raw: 'B 的正文' }),
    mk({ id: 'dC', title: '形状C中文', siteName: '测试点C', lat: 39.6605, lng: 113.7086, ts: DAY_TS + 7200e3, date: '2026年10月8日', text: 'C 的正文', raw: 'C 的正文' }),
    mk({ id: 'dD', title: '形状D只有ts', siteName: '测试点D', lat: 39.6605, lng: 113.7086, ts: DAY_TS + 10800e3, date: '十月八号', text: 'D 的正文', raw: 'D 的正文' }),
    mk({ id: 'dE', title: '形状E日期全坏', siteName: '测试点E', lat: 40.0, lng: 113.0, date: '十月八号', text: 'E 的正文', raw: 'E 的正文' }),
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

(async () => {
  /* ⓪ 先给这把刀自己做正反自校准：判据若抓不到坏形状，后面每一发「0 命中」都不是证据 */
  {
    const synth = ['2026-10-8', '2026.10.08', '2026年10月8日', '2026/10/08', '十月八号', DAY, 'NaN'].join(' ｜ ');
    const hit = DIVERGENT(synth);
    ok('D00 形状刀自校准：六种坏形状全抓到、统一档不误伤（实得 ' + hit.length + ' 条）',
      hit.length === 6 && hit.indexOf(DAY) < 0, hit.join(','));
  }

  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  /* ---------- 一 足迹页：列表卡（两个视图）+ 抽屉 + 聚合列表 + 时间线 ---------- */
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  /* 心愿单的「已打卡 · 日期」和搜索页的结果都要有数据才读得到日期。这里写的是那两个模块自己写的同一份
     localStorage 形状（wishlist.js 头注释里的 v1 结构），不是往 DOM 里伪造节点。 */
  await page.evaluate(() => {
    const T = new Date(2026, 9, 8, 14, 23).getTime();
    try {
      localStorage.setItem('tn_wishlist', JSON.stringify([{
        id: '测试点A|39.5606|114.0862', label: '测试点A', theme: '古建寺院', region: '山西', city: '大同',
        lat: 39.5606, lng: 114.0862, ts: T, visited: T,
      }]));
    } catch (e) {}
  });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 5, { timeout: 20000, polling: 150 });
  await sleep(2200);
  lines.push('=== smoke-date · 视口 ' + VW + 'x' + VH + ' · 播种 5 篇（同一天 2026-10-08 的五种存储形状）===');

  /* 键本身先对一遍：五条里有四条该归一到 DAY，全坏那条读空（§41 的口径，本节的分母靠它） */
  const KEYS = await page.evaluate(() => TravelNotes.list().sort(function (a, b) { return a.id < b.id ? -1 : 1; })
    .map(n => TravelNotes.dayText(n)));
  ok('D01 五条种子的显示读数（=归一键）：前四条同为 ' + DAY + '，全坏那条读空',
    KEYS.join('|') === [DAY, DAY, DAY, DAY, ''].join('|'), JSON.stringify(KEYS));

  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(500);
  /* 五颗种子会落成两档旅程（A/B/C/D 同一天连续，E 没有 ts 单独一档），时间视图里 E 又落在「未填日期」那年
     ——只点第一个头会漏掉后面几档，判据就在看不见的卡上空跑。所以每轮只点一枚（点开会把整块重画），
     直到没有折叠项为止。 */
  const expandAll = async () => {
    let clicked = 0;
    for (let pass = 0; pass < 8; pass++) {
      const did = await page.evaluate(() => {
        const h = document.querySelector('#tnListBody .tn-trip:not(.open) > .tn-trip-head');
        if (h) { h.click(); return 1; }
        const y = document.querySelector('#tnListBody .tn-tl-year.collapsed');
        if (y) { y.click(); return 1; }
        const m = document.querySelector('#tnListBody .tn-tl-month.collapsed');
        if (m) { m.click(); return 1; }
        return 0;
      });
      if (!did) break;
      clicked++;
      await sleep(280);
    }
    return clicked;
  };
  const HEAD = await page.evaluate(() => ({
    trips: document.querySelectorAll('#tnListBody .tn-trip').length,
    open: document.querySelectorAll('#tnListBody .tn-trip.open').length,
  }));
  const EXP = await expandAll();
  await page.waitForFunction(() => document.querySelectorAll('#tnListBody .tn-item').length > 0,
    { timeout: 4000, polling: 150 }).catch(() => {});
  await sleep(250);
  const TMS = await page.evaluate(() => Array.from(document.querySelectorAll('#tnListBody .tn-item .tm')).map(x => (x.textContent || '').trim()));
  ok('D02 列表卡 .tm 那一行：同一个键的五张卡读数一致（改前是五种写法各印各的）',
    TMS.length === 5 && TMS.filter(function (v) { return v === DAY; }).length === 4 && TMS.filter(function (v) { return v === ''; }).length === 1,
    JSON.stringify(TMS) + ' 旅程卡=' + HEAD.trips + ' 起手已展开=' + HEAD.open + ' 本腿点开=' + EXP);
  ok('D03 列表卡整屏可见文本里没有任何坏形状日期（点号/斜杠/汉字/没补零都不许出现）',
    DIVERGENT(TMS.join(' ')).length === 0, DIVERGENT(TMS.join(' ')).join(','));

  /* 时间视图那一支：renderItem 两个视图共用，只验聚合那一支＝另一支没人守 */
  const TSV = await page.evaluate(() => {
    const b = document.getElementById('tnViewTime');
    if (b) b.click();
    return !!b;
  });
  await sleep(500);
  const EXP2 = await expandAll();
  await sleep(300);
  const TMS2 = await page.evaluate(() => Array.from(document.querySelectorAll('#tnListBody .tn-item .tm')).map(x => (x.textContent || '').trim()));
  ok('D04 切到时间视图那一支（同一批卡片重画一次），读数与聚合视图完全一致',
    TSV && TMS2.length === 5 && TMS2.slice().sort().join('|') === TMS.slice().sort().join('|'),
    JSON.stringify(TMS2) + ' 本支点开=' + EXP2);

  /* 单篇抽屉的 ms-time：日 + 时刻，日期段必须是统一档，时刻必须是 HH:MM（改前是 2026.10.08 · 14:23）
     取样按 id 点名，不按 list() 的顺序猜——猜中「未填日期」那条会让判据读空而照样绿。 */
  await page.evaluate(() => {
    try {
      const n = TravelNotes.list().filter(function (x) { return x.id === 'dA'; })[0];
      if (n) openMemSheet(n);
    } catch (e) {}
  });
  await sleep(450);
  const MST = await page.evaluate(() => {
    const el = document.querySelector('#memSheet .ms-time');
    return el ? (el.textContent || '').trim() : '';
  });
  ok('D05 单篇抽屉那一行是「' + DAY + ' · HH:MM」：日期段走显示单点、时刻走固定档（改前那行印 2026.10.08 · 14:23）',
    new RegExp('^' + DAY + ' · \\d{2}:\\d{2}$').test(MST), MST);

  /* 聚合列表那一支（同地点多篇） */
  await page.evaluate(() => {
    try {
      const g = TravelNotes.list().filter(function (n) { return n.siteName === '测试点A'; });
      openGroupSheet(TravelNotes.list().slice(0, 2));
    } catch (e) {}
  });
  await sleep(450);
  const MSMETA = await page.evaluate(() => Array.from(document.querySelectorAll('#memSheet .ms-item__meta')).map(x => (x.textContent || '').trim()));
  ok('D06 聚合列表每一行的日期段也读 ' + DAY + '（这一支与单篇共用同一把刀）',
    MSMETA.length >= 2 && MSMETA.every(function (v) { return v.indexOf(DAY + ' · ') === 0; }), JSON.stringify(MSMETA));

  /* 时间线胶囊：短档 MM-DD + HH:MM（点号形 10.08 不许回来）。
     这一档此前读到过空串：空串既不是「统一」也不是「坏形状」，它只是没渲染出来。所以判据要连分母一起收：
     一枚胶囊都没有 = 这一腿什么都没验，必须红，而不是让正则在一个不存在的字符串上「读不到坏形状」。 */
  const CHIP = await page.evaluate(() => ({
    tl: !!document.getElementById('mmTimeline'),
    n: document.querySelectorAll('#mmTimeline .tl-chip').length,
    spans: Array.from(document.querySelectorAll('#mmTimeline .tl-chip span:not(.tl-name)')).map(x => (x.textContent || '').trim()),
    trips: Array.from(document.querySelectorAll('#mmTimeline .tl-trip')).map(x => (x.textContent || '').trim()),
    names: Array.from(document.querySelectorAll('#mmTimeline .tl-name')).map(x => (x.textContent || '').trim()),
  }));
  ok('D07 时间线胶囊那格是 MM-DD HH:MM 短档（不出现 10.08 那种点号形，也不出现 NaN）',
    CHIP.n >= 1 && CHIP.spans.length === CHIP.n && CHIP.spans.every(function (v) { return /^\d{2}-\d{2} \d{2}:\d{2}$/.test(v); }),
    '胶囊 ' + CHIP.n + ' 枚 时间条存在=' + CHIP.tl + ' 读数=' + CHIP.spans.slice(0, 4).join(' | ')
    + ' 旅程档=' + CHIP.trips.slice(0, 4).join(' / ') + ' 站名=' + CHIP.names.slice(0, 4).join(' / '));

  /* 整页普查：足迹页屏上（含 aria-label/title）不该有任何坏形状 */
  const PMAP = await page.evaluate(PAGE_DATE_TEXT);
  ok('D08 足迹页整页（可见文本 + 读屏属性）日期形状普查：坏形状 0 命中',
    DIVERGENT(PMAP).length === 0, DIVERGENT(PMAP).slice(0, 4).join(','));

  /* ---------- 二 其余页面：逐页整屏普查 ----------
     这里不用 for 循环生成判据：循环里的标签是拼出来的，§46 的齐备检按字面串认领不到任何一条，
     于是「删掉一页」在源码腿上是静默的。十条各写一行，少一行就少一个证据。
     分母另算一条（D18b）：十页全读不到日期也能十个 0 命中全绿，那是空跑不是证据。
     搜索页要带 ?q= 才有结果、心愿单那一档要有打卡记录，所以这两页的入口数据在播种阶段一起写进它们自己读的那份
     localStorage；行程规划（候选是行程的 createdAt）、纪念册编辑（要一本纪念册）、设置页（要真同步过一次）
     这三页光有游记种子读不到日期，它们的读数由 EXTRA 里的「统一档命中=」如实印出来，不靠这条分母遮。 */
  const censusPage = async function (file, qs) {
    await page.goto(P(file) + (qs || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1500);
    const t = await page.evaluate(PAGE_DATE_TEXT);
    /* DAY 在这一行是 Node 侧用的（censusPage 本体跑在 Node，只有 evaluate 里那段进页面），不是跨作用域引用 */
    return { bad: DIVERGENT(t), key: (t.match(new RegExp(DAY, 'g')) || []).length,
      sample: (t.match(/\d{4}[-.\/年]\d{1,2}/g) || []).slice(0, 3).join('|') };
  };
  const EXTRA = r => '坏形状=' + r.bad.slice(0, 4).join(',') + ' 统一档命中=' + r.key + ' 读数样本=' + r.sample;
  let R46;
  R46 = await censusPage('review.html'); ok('D09 旅程回顾页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46));
  let KEYED = R46.key > 0 ? 1 : 0;
  R46 = await censusPage('me.html'); ok('D10 我的页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('md-manager.html'); ok('D11 数据管理页（这页曾经没有加载单点、自己抄了一份解析）整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('story.html'); ok('D12 旅程故事页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('search.html', '?q=' + encodeURIComponent('测试点')); ok('D13 搜索页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('album-edit.html'); ok('D14 相册编辑页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('index.html'); ok('D15 首页 整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('settings.html'); ok('D16 设置页（云同步那行「上次同步」的时刻）整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('planner.html'); ok('D17 行程规划页（候选那一行的创建日期）整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  R46 = await censusPage('wishlist.html'); ok('D18 心愿单页（「已打卡 · 日期」那一档）整屏日期普查：坏形状 0 命中', R46.bad.length === 0, EXTRA(R46)); KEYED += R46.key > 0 ? 1 : 0;
  ok('D18b 十页普查的分母：至少 6 页真的读到 ' + DAY + '（全 0 命中不等于统一，可能只是那页压根没渲染日期）',
    KEYED >= 6, '读到统一档的页数=' + KEYED + '／10');

  /* ---------- 三 坏数据不许伪装：E 那条（日期与 ts 全坏）在屏上读空而不是吐出原始坏串 ---------- */
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1600);
  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(500);
  const EXP3 = await expandAll();
  await sleep(300);
  const BADLINE = await page.evaluate(() => {
    const it = Array.from(document.querySelectorAll('#tnListBody .tn-item')).filter(function (x) {
      return (x.innerText || '').indexOf('形状E') >= 0;
    })[0];
    if (!it) return null;
    const tm = it.querySelector('.tm');
    return { tm: tm ? (tm.textContent || '').trim() : '(无 .tm)', all: (it.innerText || '') };
  });
  ok('D19 全坏那条的卡片：日期那一格读空（既不吐「十月八号」也不吐 NaN），其余字段照常渲染',
    BADLINE && BADLINE.tm === '' && !/十月八号|NaN|undefined/.test(BADLINE.all), BADLINE ? JSON.stringify(BADLINE.tm) + ' | ' + BADLINE.all.slice(0, 40).replace(/\n/g, ' ') : 'E 那张卡没找到（本腿展开过 ' + EXP3 + ' 个折叠档；判据不许空跑）');

  /* ---------- 四 导出口径：复制文本与导出文档仍带坐标（用户口径里的保留支），但日期段必须是统一档 ---------- */
  /* 复制那条没有对外出口（copyNoteText 是私有的），所以走真点 + 拦 clipboard：
     直接调内部函数＝验一个不存在的出口，点了没反应用户才知道。 */
  await page.evaluate(() => {
    window.__CAP = [];
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__CAP.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
    document.execCommand = function (c) { const a = document.activeElement; if (c === 'copy' && a && a.tagName === 'TEXTAREA') window.__CAP.push(a.value); return true; };
    const it = Array.from(document.querySelectorAll('#tnListBody .tn-item')).filter(function (x) {
      return (x.innerText || '').indexOf('形状A') >= 0;
    })[0];
    const btn = it && it.querySelector('[data-a=copy]');
    if (btn) btn.click();
    return !!btn;
  });
  await sleep(400);
  const CAP = await page.evaluate(() => window.__CAP.slice());
  const TXT = CAP[0] || '';
  const VAULT = await page.evaluate(() => {
    try {
      const n = TravelNotes.list().filter(function (x) { return x.id === 'dB'; })[0];
      return window.Vault && Vault.mdFor && n ? Vault.mdFor(n) : '';
    } catch (e) { return ''; }
  });
  ok('D20 复制/导出文本里的日期段读 ' + DAY + '（界面统一了而导出的还是 2026.10.08 也算没统一）',
    CAP.length === 1 && (TXT + '\n' + VAULT).split('\n').some(function (l) { return l.indexOf(DAY) >= 0; }) && VAULT.indexOf(DAY) >= 0 && DIVERGENT(TXT + '\n' + VAULT).length === 0,
    '拦到 ' + CAP.length + ' 条 | copy=' + String(TXT).slice(0, 46).replace(/\n/g, ' ') + ' | fm=' + String(VAULT).slice(0, 46).replace(/\n/g, ' '));
  ok('D20b 复制那条文本仍带着坐标（§45 的保留支，不许跟着卡面一起砍）',
    /39\.5606,\s*114\.0862/.test(TXT), JSON.stringify(String(TXT).slice(0, 70)));

  ok('D21 全程零页面报错（把库引进别的页面、换读数出口最容易在这里红）',
    errs.length === 0, errs.slice(0, 3).join(' | '));

  ok('D22 判据条数 ≥ 24（这一节自己也是会被删的）', checks >= 24, 'checks=' + checks + '（本条自身是第 ' + (checks + 1) + ' 条）');

  lines.push('=== smoke-date: ' + checks + ' 项，失败 ' + fails + ' ===');
  console.log('=== smoke-date: ' + checks + ' 项，失败 ' + fails + ' ===');
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b31-smoke-date.txt'), lines.join('\n') + '\n'); } catch (e) { console.log('读数落盘失败：' + e.message); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => {
  lines.push('FATAL ' + ((e && e.stack) || e));
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b31-smoke-date.txt'), lines.join('\n') + '\n'); } catch (x) {}
  console.log('FATAL ' + ((e && e.message) || e));
  process.exit(1);
});
