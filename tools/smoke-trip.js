/* tools/smoke-trip.js — 行程主页 trip.html 真实浏览器冒烟（批次 24-D）
 * 这一页的立意是「一趟行程是一等对象」，所以判据盯的是三件最容易写歪的事：
 *   ① 计划口径与实际口径不许互相冒充（双读数、logStart/realDays 落盘、清空是删键不是留 0）；
 *   ② 落盘只动这两个字段——tn_trips 那一条的其余部分逐字节不变（整表回写拍平结构的前科）；
 *   ③ 它是枢纽不是第二套实现：账走 expense-form.js 那一份表单、票只做页内横幅（禁 Notification）、
 *      三个链接都带上正确的 trip id，planner 结果页原有 12 颗按钮一颗不少。
 * 取样口径：trip.html 没有首启引导蒙层，不需要 tn_onboarded；planner.html 那两条判据走
 * ?trip=<id> 直达结果页（leaflet 是本地 vendor，瓦片离线失败的噪声按 smoke-planner 同一把筛子滤掉）。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-trip.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const NOISE = /Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile|Failed to fetch|favicon/;
/* 批次 25-C：trip.html?trip=free 那句「载入即转送」（trip.html:432 的 location.replace）会把
   「进入本页」那次跨文档转场打断，浏览器自己抛 InvalidStateError——design.css 开着
   @view-transition{navigation:auto}，而 ui.js 的 UI.vt 那三条 catch 只管我们自己起的转场，
   管不到浏览器内部那一次（JS 里没有任何 promise 可以挂 catch）。
   探针 tools/out/probe25c-vt-free.js 的 A/B（同一 free 入口，B 腿把重定向换成空块；各 15 轮）：
   空机 A 6/15、争用（6 个后台重页）A 4/15，B 腿两档都 0/15；两档除这一条外零其它真实报错，
   落点 30/30 都到 expense.html?trip=free ⇒ 争用不是成因、放大也不是它做的，且用户那半是对的。
   所以这条按「已定性的浏览器噪声」精确放行：放行只认下面这一整串（等串匹配，不用正则前缀），
   扩成 /Error/ 等于把这节的报错判据拆掉——T55 的对照专防这一步。 */
const VT_ABORT = 'InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled';
const isReal = e => !NOISE.test(e) && e.indexOf(VT_ABORT) < 0;

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function local(off) {
  const d = new Date(); d.setDate(d.getDate() + off);
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
const TODAY = local(0), YEST = local(-1), D3AGO = local(-3), D10AGO = local(-10), PLUS5 = local(5);
const atHour = h => {
  const d = new Date(Date.now() + h * 3600 * 1000), p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
};

/* 种子：四趟行程覆盖四种「今天怎么说」的分支（进行中 / 还没出发 / 说不出 / 已超出实际天数） */
const SEED = {
  today: TODAY,
  trips: [
    { id: 't-live', name: '川西小环线', createdAt: 1700000000000, startDate: D3AGO, logStart: YEST, realDays: 4, travelBy: 'drive', dist: 620, days: [
      { stops: [{ name: '都江堰', city: '成都', done: 1 }, { name: '映秀', city: '阿坝', done: 0 }], driveKm: 90, driveH: 1.6, playH: 3, totalH: 6 },
      { stops: [{ name: '四姑娘山', city: '阿坝', done: 0 }], driveKm: 120, driveH: 2.4, playH: 4, totalH: 8 },
      { stops: [{ name: '丹巴', city: '甘孜', done: 0 }, { name: '新都桥', city: '甘孜', done: 0 }], driveKm: 180, driveH: 3.5, playH: 2, totalH: 9 }
    ] },
    { id: 't-soon', name: '周末苏州', createdAt: 1700000001000, startDate: PLUS5, days: [
      { stops: [{ name: '拙政园', city: '苏州', done: 0 }], driveKm: 10, driveH: 0.3, playH: 3, totalH: 4 },
      { stops: [{ name: '平江路', city: '苏州', done: 0 }], driveKm: 4, driveH: 0.2, playH: 2, totalH: 3 }
    ] },
    { id: 't-nodate', name: '没填日期的那趟', createdAt: 1700000002000, days: [
      { stops: [{ name: ' somewhere', city: '', done: 0 }], driveKm: 0, driveH: 0, playH: 1, totalH: 1 },
      { stops: [], driveKm: 0, driveH: 0, playH: 0, totalH: 0, transit: true, from: 'A', to: 'B' }
    ] },
    { id: 't-over', name: '走超了的那趟', createdAt: 1700000003000, startDate: D10AGO, logStart: D10AGO, realDays: 3, days: [
      { stops: [{ name: '甲', city: '', done: 1 }], driveKm: 5, driveH: 0.2, playH: 2, totalH: 3 }
    ] }
  ],
  /* 五个分类各一笔：开销卡只列前三 + 一行「其余」，这条判据要有第四、第五类才验得出合计 */
  exp: [
    { id: 'e1', tripId: 't-live', day: 1, date: YEST, cents: 12050, cat: '交通', who: '我', note: '油费', ts: 1 },
    { id: 'e2', tripId: 't-live', day: 1, date: YEST, cents: 3333, cat: '餐饮', who: '', note: '', ts: 2 },
    { id: 'e3', tripId: 't-live', day: 2, date: TODAY, cents: 20000, cat: '住宿', who: '同伴', note: '两晚', ts: 3 },
    { id: 'e4', tripId: 't-live', day: 2, date: TODAY, cents: 8000, cat: '门票', who: '', note: '', ts: 4 },
    { id: 'e5', tripId: 't-live', day: 3, date: TODAY, cents: 1234, cat: '购物', who: '', note: '', ts: 5 }
  ],
  bud: { 't-live': 40000 },
  ck: [
    { id: 'c1', tripId: 't-live', text: '身份证', cat: '证件', by: 'auto', done: 1, src: '', ts: 1 },
    { id: 'c2', tripId: 't-live', text: '充电宝', cat: '装备', by: 'auto', done: 1, src: '', ts: 2 },
    { id: 'c3', tripId: 't-live', text: '防晒霜', cat: '健康', by: 'user', done: 0, src: '', ts: 3 },
    { id: 'c4', tripId: 't-live', text: '现金', cat: '装备', by: 'user', done: 0, src: '', ts: 4 }
  ]
};

async function freshPage(browser, url, errs, vp) {
  const wipe = await browser.newPage();
  await wipe.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wipe.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    try { navigator.serviceWorker.getRegistrations().then(a => a.forEach(x => x.unregister())); } catch (e) {}
    try { indexedDB.deleteDatabase('trace-attachments'); } catch (e) {}
  });
  await wipe.close();
  const p = await browser.newPage();
  const v = vp || { width: 452, height: 995 };
  await p.setViewport({ width: v.width, height: v.height, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.evaluateOnNewDocument(() => {
    window.__native = 0; window.__notif = 0;
    window.confirm = function () { window.__native++; return true; };
    window.alert = function () { window.__native++; };
    /* 系统通知的红线要用「它一次都没被调过」证：只读 DOM 证不出来 */
    try {
      window.Notification = function () { window.__notif++; };
      window.Notification.requestPermission = function () { window.__notif++; return Promise.resolve('denied'); };
      window.Notification.permission = 'denied';
    } catch (e) {}
  });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return p;
}
const seed = (p, o) => p.evaluate(s => {
  localStorage.setItem('tn_trips', JSON.stringify(s.trips));
  localStorage.setItem('tn_expense', JSON.stringify(s.exp));
  localStorage.setItem('tn_budget', JSON.stringify(s.bud));
  localStorage.setItem('tn_checklist', JSON.stringify(s.ck));
}, o || SEED);
const raw = (p, k) => p.evaluate(key => localStorage.getItem(key), k);
const go = async (p, url) => { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); };
/* change 事件要用原生 setter + 派发：直接赋值不冒泡，页面读不到（受控输入的老坑） */
const setField = (p, id, val) => p.evaluate((i, v) => {
  const el = document.getElementById(i);
  const proto = Object.getPrototypeOf(el);
  const d = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  d.set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
}, id, val);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const errs = [];
  const page = await freshPage(browser, U('trip.html'), errs);

  /* ============ 0. 模块在场 ============ */
  ok('T01 trip.html 载到四个数据层模块（少一个这页就只会印空读数）',
    await page.evaluate(() => !!(window.Expense && window.Checklist && window.TicketBox && window.ExpenseForm)));

  /* ============ 1. 列表态 ============ */
  await seed(page);
  /* 票先种进 IndexedDB：列表态那行小字与后面的票卡都读它，两次种子之间不再动 */
  await page.evaluate(async h => {
    await window.TicketBox.put({ tripId: 't-live', kind: '酒店', title: '日隆镇客栈', at: h.later });
    await window.TicketBox.put({ tripId: 't-live', kind: '车票', title: 'D2255', code: '07车12A', at: h.soon });
  }, { soon: atHour(2), later: atHour(72) });
  await go(page, U('trip.html')); await sleep(300);
  let g = await page.evaluate(() => ({
    pick: document.getElementById('pickCard').style.display,
    wrap: document.getElementById('tripWrap').style.display,
    label: document.getElementById('tripLabel').textContent,
    rows: document.querySelectorAll('#pickList .trip-pick').length,
    free: (document.querySelector('.free-line a') || {}).href || ''
  }));
  ok('T02 无 ?trip= 走列表态：选择器在场、单趟态收起、标题不谎称已选定',
    g.pick === 'block' && g.wrap === 'none' && /还没选定/.test(g.label) && g.rows === 4, JSON.stringify(g));
  ok('T03 列表态给「没排过期的人」留了豁免口，指向 free 桶的记账页',
    g.free.indexOf('expense.html?trip=free') >= 0, g.free);

  await seed(page); await go(page, U('trip.html')); await sleep(500);
  const rowsTxt = await page.$$eval('#pickList .trip-pick', els => els.map(e => e.textContent));
  ok('T04 每趟一行报计划/实际两个口径：实际与计划不同的那趟必须印出「实际 4 天」，相同的绝不硬凑一个',
    /计划 3 天/.test(rowsTxt[0]) && /实际 4 天/.test(rowsTxt[0]) && /计划 2 天/.test(rowsTxt[1]) && !/实际 2 天/.test(rowsTxt[1]),
    JSON.stringify(rowsTxt.slice(0, 2)));
  ok('T05 行里带上打卡/清单/已花三项汇总（这一页是枢纽，读数得能一眼看出哪块还空着）',
    /打卡 1\/5/.test(rowsTxt[0]) && /清单 2\/4/.test(rowsTxt[0]) && /446\.17 元/.test(rowsTxt[0]), rowsTxt[0]);
  await sleep(400);
  const rowsTxt2 = await page.$$eval('#pickList .trip-pick', els => els.map(e => e.textContent));
  ok('T06 票数是 IndexedDB 的异步读数：读到才补，读不到不印「票 0 张」骗人',
    /票 2 张/.test(rowsTxt2[0]) && !/票 \d/.test(rowsTxt2[1]), JSON.stringify(rowsTxt2.map(t => (t.match(/票 \d+ 张/) || [''])[0])));

  /* 空态 */
  await page.evaluate(() => localStorage.setItem('tn_trips', '[]'));
  await go(page, U('trip.html')); await sleep(200);
  g = await page.evaluate(() => ({
    empty: document.getElementById('tEmpty').style.display,
    pick: document.getElementById('pickCard').style.display,
    link: (document.querySelector('#tEmpty a[href="planner.html"]') || {}).href || '',
    free: (document.querySelector('#tEmpty a[href="expense.html?trip=free"]') || {}).href || ''
  }));
  ok('T07 零行程时收起空选择器、只出空态引导，两条指路都指着真能点到的地方（规划页 / free 桶记账页）',
    g.empty === 'block' && g.pick === 'none' && /planner\.html/.test(g.link) && /expense\.html\?trip=free/.test(g.free),
    JSON.stringify(g));

  /* ============ 2. 认不出的 id / free 桶 ============ */
  await seed(page);
  const before = await raw(page, 'tn_expense');
  await go(page, U('trip.html?trip=zz-nope')); await sleep(250);
  g = await page.evaluate(() => ({
    label: document.getElementById('tripLabel').textContent,
    empty: document.getElementById('tEmpty').style.display,
    wrap: document.getElementById('tripWrap').style.display,
    sw: document.getElementById('tSwitchWrap').style.display,
    orphan: window.Expense.listOf('zz-nope').length
  }));
  const after = await raw(page, 'tn_expense');
  ok('T08 URL 上认不出的 trip：绝不拿它建桶（账本逐字节不变、该 id 零条目），页面出空态 + 换一趟',
    g.orphan === 0 && before === after && g.empty === 'block' && g.wrap === 'none' && g.sw === 'block' && /没找到/.test(g.label),
    JSON.stringify(g));

  await go(page, U('trip.html?trip=free')); await sleep(300);
  /* 25-C 把这条从「URL 对」抬成「URL 对 + 那一页真画出来了」。摘掉转场中断那条噪声时，
     必须同时给「重定向后白屏」这个真实风险一个正身判据，否则放行一条噪声就等于瞎一双眼睛。 */
  const land = await page.evaluate(() => {
    const b = document.getElementById('yearSum');
    const r = b ? b.getBoundingClientRect() : null;
    return {
      href: location.href, has: !!b,
      h: r ? Math.round(r.height) : 0,
      txt: b ? b.textContent : '',
      bodyH: Math.round(document.body.getBoundingClientRect().height)
    };
  });
  ok('T09 free 桶没有主页可言：直接送到记账页、而且那一页真画出来了（落点 + #yearSum 有高度 + 文档有内容），不在这里造一个空壳 trip',
    land.href.indexOf('expense.html?trip=free') >= 0 && land.has && land.h > 0 && /\d/.test(land.txt) && land.bodyH > 300,
    JSON.stringify(land));

  /* ============ 3. 单趟态：双读数与实际口径落盘 ============ */
  await seed(page); await go(page, U('trip.html?trip=t-live')); await sleep(300);
  g = await page.evaluate(() => ({
    plan: document.getElementById('tPlanN').textContent,
    real: document.getElementById('tRealN').textContent,
    date: document.getElementById('tDate').textContent,
    rs: document.getElementById('tRealStart').value,
    rd: document.getElementById('tRealDays').value,
    wrap: document.getElementById('tripWrap').style.display,
    pick: document.getElementById('pickCard').style.display
  }));
  ok('T10 ?trip=<id> 走单趟态，双读数报「计划 3 · 实际 4」，日期行把两个口径都摊开',
    g.wrap === 'block' && g.pick === 'none' && g.plan === '3' && g.real === '4' &&
    /实际出发 /.test(g.date) && /多走 1 天/.test(g.date) && g.rs === YEST && g.rd === '4', JSON.stringify(g));

  const tripsRaw0 = await raw(page, 'tn_trips');
  await setField(page, 'tRealDays', '6'); await sleep(200);
  const tr1 = JSON.parse(await raw(page, 'tn_trips'));
  const o0 = JSON.parse(tripsRaw0)[0], o1 = tr1[0];
  const touched = Object.keys(o0).concat(Object.keys(o1)).filter((k, i, a) => a.indexOf(k) === i)
    .filter(k => JSON.stringify(o0[k]) !== JSON.stringify(o1[k]));
  ok('T11 改实际天数：realDays 落盘为整数 6、双读数跟着变',
    o1.realDays === 6 && (await page.evaluate(() => document.getElementById('tRealN').textContent)) === '6',
    JSON.stringify(o1.realDays));
  ok('T12 落盘只动那一个字段：tn_trips 那一条的其余部分逐字节不变（整表回写会拍平结构）',
    touched.length === 1 && touched[0] === 'realDays' && JSON.stringify(o1.days) === JSON.stringify(o0.days) &&
    o1.name === o0.name && o1.dist === o0.dist && o1.logStart === o0.logStart, JSON.stringify(touched));

  await setField(page, 'tRealStart', TODAY); await sleep(200);
  const o2 = JSON.parse(await raw(page, 'tn_trips'))[0];
  ok('T13 改实际出发日：logStart 落盘为 ISO 且当天读数改口（今天变成第 1 天）',
    o2.logStart === TODAY && /第 <b>1<\/b> 天|第 1 天/.test(await page.evaluate(() => document.getElementById('tToday').innerHTML)),
    o2.logStart);

  await setField(page, 'tRealDays', ''); await sleep(200);
  const o3 = JSON.parse(await raw(page, 'tn_trips'))[0];
  ok('T14 清空实际天数＝删键，回到计划口径（留一个 0 会让「实际 0 天」上屏）',
    !('realDays' in o3) && (await page.evaluate(() => document.getElementById('tRealN').textContent)) === '3',
    JSON.stringify(Object.keys(o3).filter(k => k === 'realDays')));
  await setField(page, 'tRealStart', ''); await sleep(200);
  const o4 = JSON.parse(await raw(page, 'tn_trips'))[0];
  ok('T15 清空实际出发日＝删键，日期行改口「按计划的算」',
    !('logStart' in o4) && /按计划的算/.test(await page.evaluate(() => document.getElementById('tDate').textContent)),
    JSON.stringify(Object.keys(o4).filter(k => k === 'logStart')));

  /* ============ 4. 概览：打卡进度与「今天走了哪」四种口径 ============ */
  await seed(page); await go(page, U('trip.html?trip=t-live')); await sleep(250);
  g = await page.evaluate(() => ({
    bar: document.getElementById('tBar').style.width,
    cnt: document.getElementById('tCount').textContent,
    today: document.getElementById('tToday').textContent,
    stops: Array.prototype.map.call(document.querySelectorAll('#tToday .t-stops li .nm'), e => e.textContent),
    live: document.getElementById('tToday').getAttribute('aria-live')
  }));
  ok('T16 打卡进度按 s.done 汇总（1/5 站 = 20%），不是按天算',
    g.cnt === '打卡 1/5 站' && g.bar === '20%', JSON.stringify(g));
  ok('T17 「今天走了哪」按 logStart 说真话：昨天出发 ⇒ 今天第 2 天，列的是计划第 2 天那一站',
    /第 2 天/.test(g.today) && /按实际出发日算/.test(g.today) && g.stops.join(',') === '四姑娘山' && g.live === 'polite',
    JSON.stringify(g.stops));

  await go(page, U('trip.html?trip=t-soon')); await sleep(250);
  const soonTxt = await page.evaluate(() => document.getElementById('tToday').textContent);
  ok('T18 还没出发的那趟：报「距 X 还有 5 天」，不假装今天该走哪',
    /还没出发/.test(soonTxt) && /还有 5 天/.test(soonTxt) && !/第 \d+ 天/.test(soonTxt), soonTxt);

  await go(page, U('trip.html?trip=t-nodate')); await sleep(250);
  const noTxt = await page.evaluate(() => document.getElementById('tToday').textContent);
  ok('T19 没填任何出发日期：明说不出「今天是第几天」并指路去填，绝不印一个假的第 1 天',
    /没填出发日期/.test(noTxt) && !/第 1 天/.test(noTxt), noTxt);

  await go(page, U('trip.html?trip=t-over')); await sleep(250);
  const overTxt = await page.evaluate(() => document.getElementById('tToday').textContent);
  ok('T20 今天已超出实际天数：提示补「实际天数」，并说清钱照样记得下（标「计划外」）',
    /超出这趟的3 天/.test(overTxt) && /计划外/.test(overTxt), overTxt);

  /* ============ 5. 开销 / 清单 / 票 三张卡与它们的链接 ============ */
  await seed(page); await go(page, U('trip.html?trip=t-live')); await sleep(350);
  g = await page.evaluate(() => ({
    sum: document.getElementById('tExpSum').textContent,
    cnt: document.getElementById('tExpCount').textContent,
    over: document.getElementById('tExpOver').textContent,
    bars: Array.prototype.map.call(document.querySelectorAll('#tExpBars .b'), e => [e.querySelector('.n').textContent, e.querySelector('.v').textContent]),
    hrefs: ['tExpAll', 'tCkAll', 'tTbAll', 'tOpenPlanner'].map(i => document.getElementById(i).getAttribute('href')),
    ck: document.getElementById('tCkCount').textContent,
    ckBar: document.getElementById('tCkBar').style.width,
    tbN: document.getElementById('tTbN').textContent,
    tbD: document.getElementById('tTbD').textContent
  }));
  const sumBars = g.bars.reduce((s, b) => s + Number(b[1].replace(/[^0-9.]/g, '')), 0);
  ok('T21 开销卡读数与账本一致（446.17 元 / 5 笔），预算 400 元 ⇒ 红字超支 46.17 元',
    g.sum === '446.17' && g.cnt === '5 笔' && /已超预算 46\.17 元/.test(g.over), JSON.stringify([g.sum, g.cnt, g.over]));
  ok('T22 分类只列前三 + 一行「其余」，四行加起来精确等于合计（少列一类不许少算一分钱）',
    g.bars.length === 4 && g.bars[3][0] === '其余' && Math.abs(sumBars - 446.17) < 1e-9, JSON.stringify(g.bars));
  ok('T23 三个链接都带上正确的 trip id（枢纽页指错地方＝功能等于没有）',
    g.hrefs[0] === 'expense.html?trip=t-live' && g.hrefs[1] === 'checklist.html?trip=t-live' &&
    g.hrefs[2] === 'checklist.html?trip=t-live' && g.hrefs[3] === 'planner.html?trip=t-live', JSON.stringify(g.hrefs));
  ok('T24 出发前卡 = Checklist.statsOf 的读数（2/4 = 50%）', g.ck === '已备 2/4 件' && g.ckBar === '50%', JSON.stringify([g.ck, g.ckBar]));
  await go(page, U('trip.html?trip=t-soon')); await sleep(450);
  const tb0 = await page.evaluate(() => [document.getElementById('tTbN').textContent, document.getElementById('tTbD').textContent]);
  ok('T25 没存票的那趟说「还没存票」，不拿一个空读数糊过去', tb0[0] === '0' && /还没存票/.test(tb0[1]), JSON.stringify(tb0));

  /* 票：两张（72 小时后 / 2 小时后，故意倒着放），最近那张要报出来，且只许页内横幅 */
  await page.evaluate(() => sessionStorage.removeItem('tb_nudged'));   /* 横幅一趟一次会话，前面几轮已经用掉了 */
  await go(page, U('trip.html?trip=t-live')); await sleep(600);
  g = await page.evaluate(() => ({
    n: document.getElementById('tTbN').textContent,
    d: document.getElementById('tTbD').textContent,
    nudge: !!document.querySelector('.ui-nudge'),
    nudgeTxt: (document.querySelector('.ui-nudge') || {}).textContent || '',
    notif: window.__notif
  }));
  ok('T26 票卡读数：2 张，下一张报 24 小时内那张（D2255），不是按录入顺序取第一行',
    g.n === '2' && /D2255/.test(g.d), JSON.stringify(g));
  ok('T27 24 小时内要用票 ⇒ 页内横幅提醒一次；系统通知一次都不许调（批次 17 红线）',
    g.nudge && /D2255/.test(g.nudgeTxt) && g.notif === 0, JSON.stringify([g.nudge, g.notif]));

  /* ============ 6. 记一笔：走 expense-form.js 那一份表单 ============ */
  const expBefore = JSON.parse(await raw(page, 'tn_expense'));
  /* 页内横幅是 10s 自移除的浮层，正压在底部：不先摘掉，这一下点击会落在横幅上而不是「记一笔」。
     这是取样口径（横幅本来就该自己走掉），不是产品缺陷。 */
  await page.evaluate(() => { const n = document.querySelector('.ui-nudge'); if (n) n.remove(); });
  await page.click('#tAdd'); await sleep(350);
  g = await page.evaluate(() => ({
    sheet: document.getElementById('addSheet').classList.contains('show'),
    hasForm: !!document.querySelector('#adForm .x-form #adSave'),
    date: document.getElementById('adDate').value,
    hint: document.getElementById('adHint').textContent
  }));
  ok('T28 「记一笔」开的是同一份表单实现（expense-form.js），日期默认今天，说明行按这趟的出发日算',
    g.sheet && g.hasForm && g.date === TODAY && /计划的第 2 天/.test(g.hint), JSON.stringify(g));
  await page.evaluate(() => { document.querySelector('#adCats .chip[data-c="餐饮"]').click(); });
  await page.evaluate(() => {
    const el = document.getElementById('adAmt');
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d.set.call(el, '33.33');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#adSave'); await sleep(400);
  const expAfter = JSON.parse(await raw(page, 'tn_expense'));
  const added = expAfter.filter(x => expBefore.every(y => y.id !== x.id));
  g = await page.evaluate(() => ({
    sum: document.getElementById('tExpSum').textContent,
    cnt: document.getElementById('tExpCount').textContent,
    sheet: document.getElementById('addSheet').classList.contains('show'),
    native: window.__native
  }));
  ok('T29 记上一笔：落盘整数分 3333（不是 33.33）、date=今天、day 由 logStart 反推为 2、分类是选中的餐饮',
    added.length === 1 && added[0].cents === 3333 && added[0].date === TODAY && added[0].day === 2 &&
    added[0].cat === '餐饮' && added[0].tripId === 't-live', JSON.stringify(added[0]));
  ok('T30 记完当场重画：合计从 446.17 走到 479.50、笔数 6 笔，弹层收起来，全程零原生 confirm/alert',
    g.sum === '479.50' && g.cnt === '6 笔' && !g.sheet && g.native === 0, JSON.stringify(g));

  /* ============ 7. 真机主档几何（328×723，一加 Ace 6T） ============ */
  const p2 = await freshPage(browser, U('trip.html'), errs, { width: 328, height: 723 });
  await seed(p2); await go(p2, U('trip.html?trip=t-live')); await sleep(400);
  const geo = await p2.evaluate(() => {
    const de = document.documentElement;
    const low = [], over = [];
    document.querySelectorAll('#tripWrap button, #tripWrap a.btn, #tripWrap input').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.height < 44) low.push((el.id || el.className) + ':' + Math.round(r.height));
      if (r.right > de.clientWidth + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.left) + ',' + Math.round(r.right));
    });
    return { sw: de.scrollWidth, cw: de.clientWidth, low: low.slice(0, 6), over: over.slice(0, 6) };
  });
  ok('T31 真机主档 328×723：这一页的控件没有一个矮于 44px，也不横向溢出',
    geo.low.length === 0 && geo.over.length === 0 && geo.sw === geo.cw, JSON.stringify(geo));
  const geo2 = await p2.evaluate(() => {
    const de = document.documentElement;
    return { sw: de.scrollWidth, cw: de.clientWidth };
  });
  await p2.evaluate(() => { history.replaceState(null, '', 'trip.html'); });
  await go(p2, U('trip.html')); await sleep(300);
  const geo3 = await p2.evaluate(() => {
    const de = document.documentElement, low = [];
    document.querySelectorAll('#pickList .trip-pick').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.height < 44) low.push(Math.round(r.height));
    });
    return { sw: de.scrollWidth, cw: de.clientWidth, low: low, rows: document.querySelectorAll('#pickList .trip-pick').length };
  });
  ok('T32 列表态在真机主档同样不溢出，每行触控高度 ≥44px',
    geo3.low.length === 0 && geo3.sw === geo3.cw && geo3.rows === 4 && geo2.sw === geo2.cw, JSON.stringify(geo3));
  await p2.close();

  /* ============ 8. planner 结果页：新增一行入口，旧按钮一颗不少 ============ */
  const errs2 = [];
  const p3 = await freshPage(browser, U('planner.html'), errs2);
  await seed(p3);
  await go(p3, U('planner.html?trip=t-live')); await sleep(2500);
  g = await p3.evaluate(() => ({
    stage: document.getElementById('stageResult').style.display,
    title: document.getElementById('resultTitle').textContent,
    slot: (document.querySelector('#tripHomeSlot a') || {}).getAttribute ? document.querySelector('#tripHomeSlot a').getAttribute('href') : '',
    slotTxt: (document.querySelector('#tripHomeSlot a') || {}).textContent || '',
    acts: Array.prototype.map.call(document.querySelectorAll('#actRow button'), b => b.textContent.trim())
  }));
  ok('T33 planner.html?trip=<id> 直接落到那一趟的结果页（不停在输入页让人再点一次）',
    g.stage === 'block' && /川西小环线/.test(g.title), JSON.stringify([g.stage, g.title]));
  ok('T34 结果页标题下新增一行「这趟的主页」，href 指向 trip.html?trip=<id>',
    g.slot === 'trip.html?trip=t-live' && /主页/.test(g.slotTxt), JSON.stringify([g.slot, g.slotTxt]));
  const MUST = ['开始旅行', '保存行程', '加入想去清单', '复制计划', '分享行程', '导出 GPX', '导出日历', '导出路书', '生成纪念册', '重新排期', '编辑选点', '足迹地图'];
  const missing = MUST.filter(m => !g.acts.some(a => a.indexOf(m) >= 0));
  ok('T35 原有 12 颗按钮一颗不少（新入口是加出来的，不是替换）',
    g.acts.length >= 12 && missing.length === 0, JSON.stringify([g.acts.length, missing]));
  const noise = errs2.filter(isReal);
  ok('T36 planner 结果页全程零真实报错（瓦片离线噪声已滤）', noise.length === 0, noise.slice(0, 2).join(' | '));
  await p3.close();

  /* ============ 9. me.html：两张常驻卡（24-E）============
     这一节的立意不是「多了两块 UI」，而是「不进规划页的人也看得见行程与账」——
     所以判据盯：口径不冒充（实际日期优先、往年账不进今年）、删光行程后账还在、
     空态给的是两条能走的路而不是白板，以及大数字真的比正文大（--fs-11 那次的教训：
     44px 触控高度与横向溢出都量不到字号，未定义令牌会静默退化成继承的 16px）。 */
  const errs3 = [];
  const p4 = await freshPage(browser, U('me.html'), errs3);
  await seed(p4);
  /* freshPage 会删掉 trace-attachments，所以票要在这一页自己种：E4 那行小字里有「票 n」 */
  await p4.evaluate(async h => {
    await window.TicketBox.put({ tripId: 't-live', kind: '酒店', title: '日隆镇客栈', at: h.later });
    await window.TicketBox.put({ tripId: 't-live', kind: '车票', title: 'D2255', code: '07车12A', at: h.soon });
  }, { soon: atHour(2), later: atHour(72) });
  await go(p4, U('me.html')); await sleep(800);
  const YR = TODAY.slice(0, 4);
  const fmtC = c => Math.floor(c / 100) + '.' + ('0' + (c % 100)).slice(-2);
  const seedYear = SEED.exp.filter(x => x.date.slice(0, 4) === YR);
  const seedSum = seedYear.reduce((a, b) => a + b.cents, 0);
  let mm = await p4.evaluate(() => ({
    mods: !!(window.Expense && window.Checklist),
    rows: Array.prototype.map.call(document.querySelectorAll('#meTrips .mrow'), a => ({
      href: a.getAttribute('href'),
      name: (a.querySelector('.mn b') || {}).textContent || '',
      sub: (a.querySelector('.mn small') || {}).textContent || '',
      amt: (a.querySelector('.mm') || {}).textContent || '',
      h: Math.round(a.getBoundingClientRect().height)
    })),
    hint: document.querySelectorAll('#meTrips .mbtn').length,
    sum: document.getElementById('meYearSum').textContent,
    cnt: document.getElementById('meYearCnt').textContent,
    cats: document.getElementById('meYearCats').textContent,
    fs: getComputedStyle(document.getElementById('meYearSum')).fontSize
  }));
  ok('T39 me.html 载到记账与清单两个数据层（少一个这两张卡就只会印空读数）', mm.mods === true);
  ok('T40 「我的行程」一行一趟：四趟都在，行本身跳 trip.html?trip=<id>',
    mm.rows.length === 4 && mm.rows[0].href === 'trip.html?trip=t-live' && /川西小环线/.test(mm.rows[0].name),
    JSON.stringify([mm.rows.length, mm.rows[0] && mm.rows[0].href]));
  ok('T41 有实际口径就用实际口径：t-live 印「实际 <昨天> · 计划 3 天 · 实际 4 天」，不拿计划日期冒充；票数是异步补进来的那格',
    mm.rows[0].sub.indexOf('实际 ' + YEST) === 0 && /计划 3 天 · 实际 4 天/.test(mm.rows[0].sub) &&
    mm.rows[0].sub.indexOf(D3AGO) < 0 && /打卡 1\/5/.test(mm.rows[0].sub) && /清单 2\/4/.test(mm.rows[0].sub) &&
    /* 恰一次：这一页会重画两遍，异步补字没有幂等标记时会印成「票 2 张 · 票 2 张」 */
    mm.rows[0].sub.split('票 2 张').length === 2,
    mm.rows[0].sub);
  ok('T42 只有计划日期的那趟老实印「计划 <日期>」，不许被染成「实际」',
    mm.rows[1].sub.indexOf('计划 ' + PLUS5) === 0 && mm.rows[1].sub.indexOf('实际') < 0, mm.rows[1].sub);
  ok('T43 行尾金额与账本一致（446.17 / 5 笔），没记账的印「还没记账」而不是 0.00',
    /446\.17/.test(mm.rows[0].amt) && /5 笔/.test(mm.rows[0].amt) && /还没记账/.test(mm.rows[1].amt),
    JSON.stringify([mm.rows[0].amt, mm.rows[1].amt]));
  ok('T44 「今年已花」= 今年那几笔之和（整数分 → 两位小数），笔数同口径',
    mm.sum === fmtC(seedSum) && mm.cnt === seedYear.length + ' 笔', JSON.stringify([mm.sum, mm.cnt, fmtC(seedSum)]));
  ok('T45 「今年已花」的大数字真的比正文大（≥20px，未定义令牌会静默退化成 16px）',
    parseFloat(mm.fs) >= 20, mm.fs);

  /* 往年一笔 + free 桶一笔：一条验「不进今年」，一条验「不用排期的人也在册」 */
  await p4.evaluate(y => {
    const l = JSON.parse(localStorage.getItem('tn_expense'));
    l.push({ id: 'e-old', tripId: 't-live', day: 1, date: (Number(y) - 1) + '-06-01', cents: 99999, cat: '购物', who: '', note: '', ts: 9 });
    l.push({ id: 'e-free', tripId: 'free', day: 1, date: y + '-03-02', cents: 5000, cat: '餐饮', who: '', note: '', ts: 10 });
    localStorage.setItem('tn_expense', JSON.stringify(l));
  }, YR);
  await go(p4, U('me.html')); await sleep(500);
  mm = await p4.evaluate(() => ({
    rows: Array.prototype.map.call(document.querySelectorAll('#meTrips .mrow'), a => ({
      href: a.getAttribute('href'), name: (a.querySelector('.mn b') || {}).textContent || '',
      amt: (a.querySelector('.mm') || {}).textContent || ''
    })),
    sum: document.getElementById('meYearSum').textContent,
    cnt: document.getElementById('meYearCnt').textContent,
    cats: document.getElementById('meYearCats').textContent
  }));
  ok('T46 去年那笔不进今年合计（宁可少算也不把去年的账算进今年），free 桶那笔进',
    mm.sum === fmtC(seedSum + 5000) && mm.cnt === (seedYear.length + 1) + ' 笔',
    JSON.stringify([mm.sum, mm.cnt, fmtC(seedSum + 5000)]));
  ok('T47 free 桶有账就多印一行「未编排行程」，跳 expense.html?trip=free（50.00 / 1 笔）',
    mm.rows.length === 5 && mm.rows[4].href === 'expense.html?trip=free' && /未编排行程/.test(mm.rows[4].name) &&
    /50\.00/.test(mm.rows[4].amt), JSON.stringify(mm.rows[4]));
  ok('T48 分类只列今年前二：住宿 200.00 · 交通 120.50，往年那笔 999.99 不出现在这行',
    /住宿 200\.00 元/.test(mm.cats) && /交通 120\.50 元/.test(mm.cats) &&
    mm.cats.indexOf('999.99') < 0 && mm.cats.indexOf('购物') < 0, mm.cats);

  /* 空态：把行程全删光（账留着）——这一页是「不用排期的人」唯一的落脚点，不许留白板 */
  await p4.evaluate(() => localStorage.setItem('tn_trips', '[]'));
  await go(p4, U('me.html')); await sleep(500);
  const em = await p4.evaluate(() => ({
    rows: document.querySelectorAll('#meTrips .mrow').length,
    hint: (document.querySelector('#meTrips .mhint') || {}).textContent || '',
    btns: Array.prototype.map.call(document.querySelectorAll('#meTrips .mbtn'), a => ({
      href: a.getAttribute('href'), t: a.textContent.trim(), h: Math.round(a.getBoundingClientRect().height)
    })),
    sum: document.getElementById('meYearSum').textContent,
    cats: document.getElementById('meYearCats').textContent
  }));
  ok('T49 零行程时不留白板：一句人话 + 两条 ≥44px 的指路（排一趟 / 不排行程直接记一笔）',
    em.rows === 0 && em.btns.length === 2 && em.btns[0].href === 'planner.html' &&
    em.btns[1].href === 'expense.html?trip=free' && em.btns.every(b => b.h >= 44) && /不排期也能记账/.test(em.hint),
    JSON.stringify(em.btns));
  ok('T50 行程删光了账还在：free 桶与孤儿旧账照样进「今年已花」，合计与分类前二同口径（不许合计认账、分类看不见）',
    em.sum === fmtC(seedSum + 5000) && /住宿 200\.00 元/.test(em.cats) && /交通 120\.50 元/.test(em.cats),
    JSON.stringify([em.sum, fmtC(seedSum + 5000), em.cats]));

  /* 真机主档几何 + 三处大数字的字号（trip.html 两处 / expense.html 一处，同一族读数） */
  const p5 = await freshPage(browser, U('me.html'), errs3, { width: 328, height: 723 });
  await seed(p5);
  await go(p5, U('me.html')); await sleep(500);
  const geo4 = await p5.evaluate(() => ({
    cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth,
    low: Array.prototype.filter.call(document.querySelectorAll('#meTrips .mrow, #meTrips .mbtn'),
      a => a.getBoundingClientRect().height < 44).map(a => a.className)
  }));
  ok('T51 me.html 在真机主档（328×723）不横向溢出，行程行与空态按钮触控高度都 ≥44px',
    geo4.sw === geo4.cw && geo4.low.length === 0, JSON.stringify(geo4));
  await p5.close();
  await go(p4, U('trip.html?trip=t-live')); await sleep(600);
  const fsT = await p4.evaluate(() => [
    getComputedStyle(document.getElementById('tPlanN')).fontSize,
    getComputedStyle(document.querySelector('.t-money b')).fontSize
  ]);
  await go(p4, U('expense.html')); await sleep(600);
  const fsX = await p4.evaluate(() => {
    const b = document.querySelector('.x-year b');
    return b ? getComputedStyle(b).fontSize : '';
  });
  ok('T52 三处主角数字都 ≥20px：trip 双读数 / trip 开销合计 / expense 今年合计（--fs-11 未定义令牌的回归网）',
    fsT.concat(fsX).every(v => parseFloat(v) >= 20), JSON.stringify(fsT.concat(fsX)));
  const noise3 = errs3.filter(isReal);
  ok('T53 me.html / trip.html / expense.html 三页全程零真实报错', noise3.length === 0, noise3.slice(0, 3).join(' | '));
  ok('T54 这三页全程零原生 confirm/alert，零系统通知调用',
    (await p4.evaluate(() => window.__native + window.__notif)) === 0,
    String(await p4.evaluate(() => window.__native + window.__notif)));
  await p4.close();

  /* ============ 10. 收场 ============ */
  await page.evaluate(() => {
    ['tn_trips', 'tn_expense', 'tn_budget', 'tn_checklist'].forEach(k => localStorage.removeItem(k));
  });
  const realErrs = errs.filter(isReal);
  ok('T37 trip.html 全程零真实报错', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
  /* 这条不测页面，测的是那把筛子本身：放行表一旦被人扩成 /Error/ 一类，上面三条「零真实报错」
     就全成了恒真。正向对照四路——真 TypeError 要红、同一条但后缀换了也要红、瓦片噪声不红、
     那一整串放行串不红。 */
  ok('T55 报错筛子口径：真报错与「同一句换了后缀」都还算真实报错，只有放行表里那一整串被放行（正向对照）',
    isReal('pageerror: TypeError: x is not a function') === true &&
    isReal('pageerror: InvalidStateError: Transition was aborted because of invalid state. 换了个后缀') === true &&
    isReal('console: Failed to load resource: net::ERR_FILE_NOT_FOUND') === false &&
    isReal('pageerror: ' + VT_ABORT) === false,
    '四路对照：真报错算红／近亲串算红／瓦片噪声不算红／放行串不算红');
  ok('T38 全程零原生 confirm/alert，零系统通知调用',
    (await page.evaluate(() => window.__native + window.__notif)) === 0,
    String(await page.evaluate(() => window.__native + window.__notif)));

  await browser.close();
  console.log(fails ? '=== ' + fails + ' 条 FAIL ===' : '=== SMOKE TRIP ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CRASH: ' + e.stack); process.exit(1); });
