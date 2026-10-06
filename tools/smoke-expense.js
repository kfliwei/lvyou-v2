/* tools/smoke-expense.js — 开销记账真实浏览器冒烟（批次 19）
 * 全部判据走产品自己的入口：排期 → 结果页 → 日卡底部「记开销」→ 汇总卡 → 导出 CSV。
 * 金额这一段的关键是「存进 localStorage 的到底是什么」：fmtMoney 与 centsOf 在读侧也做
 * 四舍五入，所以只看界面读数的断言会被「写入侧去掉 Math.round」那类变异放过——这里逐笔
 * 直接断言落盘值是整数分且精确等于 3333/3333/3334。
 * 判据取自 DOM 与 localStorage 实况 + 真调 Expense 的结果；源码锚点是 verify.js §32 的活。
 * 视口 452×995 = 一加 Ace 6T 真机档；末尾另验 1440×900 双栏档。
 * A64–A104 是批次 24：A64–A83 验数据层（date 权威、只读派生迁移、free 桶、进行中推断），
 * A84–A104 验 expense.html 这张独立主页——它不开规划页也能走完「选桶 → 记一笔 → 按日期看 →
 * 预算 → 导出 CSV → 删除」，并在 328×723 真机主档下量几何；A95 那一条盯的是页面自己的同步：
 * 记完一笔顶部年总必须跟着走，停在 0.00 就等于告诉用户「这页没记住」。
 * A105–A118 是批次 24-C：随手记 FAB 面板顶部的「记开销」档（行中入口）。这一档最容易被写歪的
 * 两件事各有一条判据：默认档一点没被动过（A105/A107/A115：录音三屏状态机的类一位不动，切档只
 * 做显隐），以及站在这个点上花钱的人真能把钱按真实日期记上（A108/A111：进行中那趟自动落桶、
 * 日期就是今天、落盘整数分）；A110/A114 盯读数说真话（free 桶不说「这趟」），A116 盯门控
 * （没载 expense.js 的页面不许出现一条点了没反应的分段控件）。
 * 取样口径：index.html 的首启引导蒙层 .ob-mask（z 9990）盖在面板（9001）上，freshPage 清了 LS
 * 就会每次重放引导，真鼠标点击全打在蒙层上——所以这一段先打 tn_onboarded 再 reload，
 * 站到「引导已看过」的状态（与 tools/visual-check.js、smoke-usable.js 同一口径）。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-expense.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const START = '2026-11-08';            /* 出发日期：CSV 的日期列与它同源 */
const CATS = '交通,住宿,餐饮,门票,购物,其他';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* file:// 同源共享 localStorage：开新页前先在一次性页面里清场，否则本批的桶会带上上一轮残留。
   顺带把原生 window.confirm 变成计数器：记账的删除必须走 UI.confirm，
   这条断言只有「它一次都没被调过」才算证据，光读 UI 的 DOM 是证不出来的。 */
async function freshPage(browser, url, errs) {
  const wipe = await browser.newPage();
  await wipe.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wipe.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    try { navigator.serviceWorker.getRegistrations().then(a => a.forEach(x => x.unregister())); } catch (e) {}
  });
  await wipe.close();
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.evaluateOnNewDocument(() => {
    window.__cap = []; window.__dl = []; window.__native = 0;
    window.confirm = function () { window.__native++; return true; };
    window.alert = function () { window.__native++; };
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { window.__cap.push(b); return real(b); };
    const rc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__dl.push(String(this.download));
      return rc.apply(this, arguments);
    };
  });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return p;
}

/* 走真实交互排一趟 3 天川西，并把出发日期填进 #intentDate（doSchedule 读它，CSV 日期列才有着落） */
async function planOnce(page) {
  await sleep(3000);                                    /* nation-index.js 是 defer 的 1.4MB */
  await page.type('#promptInput', '我想去川西玩3天');
  await page.click('#genBtn');
  await sleep(1400);
  if (!await page.evaluate(() => document.getElementById('stagePick').style.display === 'block')) return false;
  const n = await page.$$eval('#candList .cand', els => els.length);
  if (!n) return false;
  for (let i = 0; i < Math.min(4, n); i++) {
    await page.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await page.evaluate(d => { const el = document.getElementById('intentDate'); if (el) el.value = d; }, START);
  await page.click('#scheduleBtn'); await sleep(400);
  for (let s = 1; s < 3; s++) { await page.click('#wNext'); await sleep(300); }
  await page.click('#wNext'); await sleep(300);
  await page.click('#wDone');
  await sleep(2800);
  return await page.evaluate(() => document.getElementById('stageResult').style.display === 'block');
}

const tidOf = p => p.evaluate(() => {
  const s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null');
  return s && s.trip ? s.trip.id : '';
});
/* 读盘上原始插入序（不是模块排好的 listOf）：本批要钉的就是「写进去的那个字节」 */
const bucket = (p, tid) => p.evaluate(t =>
  JSON.parse(localStorage.getItem('tn_expense') || '[]').filter(x => x.tripId === t)
    .map(x => ({ cents: x.cents, day: x.day, cat: x.cat, who: x.who, note: x.note, id: x.id })), tid);
const lastToast = p => p.evaluate(() => {
  const t = [].slice.call(document.querySelectorAll('.ui-toast')).pop();
  return t ? t.textContent : '';
});
/* 底脚入口按 onclick 找：打卡按钮与记账按钮都是 .btn.mini，靠文字会撞 */
const openFoot = async (p, di, lump) => {
  await p.evaluate(o => {
    const card = document.querySelector('.day-card[data-day="' + o.d + '"]');
    const sel = o.lump ? 'plannerExpLump' : 'plannerExpEdit';
    card.querySelector('.exfoot button[onclick*="' + sel + '"]').click();
  }, { d: di, lump: !!lump });
  await sleep(220);
};
const closeFoot = async (p, di) => {
  await p.evaluate(d => { document.querySelector('.day-card[data-day="' + d + '"] .exacts .btn.ghost').click(); }, di);
  await sleep(220);
};
const fill = (p, o) => p.evaluate(x => {
  document.getElementById('exAmt').value = x.yuan;
  if (x.cat) {
    const c = [].find.call(document.querySelectorAll('#exCats .chip'), el => el.getAttribute('data-cat') === x.cat);
    if (c) c.click();
  }
  if (x.who != null) document.getElementById('exWho').value = x.who;
  if (x.note != null) document.getElementById('exNote').value = x.note;
}, o);
const commit = async (p, di) => {
  await p.evaluate(d => { document.querySelector('.day-card[data-day="' + d + '"] .exacts .btn.primary').click(); }, di);
  await sleep(320);
};
/* 记一笔 = 开编辑器 → 填 → 提交（提交后整段重渲染，编辑器自己收起） */
async function addOne(p, di, f) { await openFoot(p, di, f.lump); await fill(p, f); await sleep(120); await commit(p, di); }
const footText = (p, di) => p.evaluate(d => {
  const el = document.querySelector('.day-card[data-day="' + d + '"] .exfoot .extot');
  return el ? el.textContent : 'no-foot';
}, di);
const rowsOf = (p, di) => p.evaluate(d => [].map.call(
  document.querySelectorAll('.day-card[data-day="' + d + '"] .exrows .ex'),
  el => ({ cat: el.querySelector('.cat').textContent, money: el.querySelector('.money').textContent, txt: el.querySelector('.txt').textContent })
), di);
const bars = p => p.evaluate(() => [].map.call(document.querySelectorAll('#expBars .b'), el => ({
  cat: el.querySelector('.n').textContent, w: el.querySelector('i').style.width, v: el.querySelector('.v').textContent
})));
const setBudget = async (p, v) => {
  await p.evaluate(x => { const el = document.getElementById('exBudget'); el.value = x; el.dispatchEvent(new Event('change')); }, v);
  await sleep(320);
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const errs = [];
  const page = await freshPage(browser, U('planner.html'), errs);

  /* ================= 0. 链路 + 模块新鲜度 ================= */
  ok('A01 排期链路跑通（结果页在场）', await planOnce(page));
  const tid = await tidOf(page);
  ok('A02 行程有 id 且已进快照（账按这个 id 建桶）', /^p\d+$/.test(String(tid)), String(tid));

  const MOD = await page.evaluate(() => ({
    has: !!window.Expense,
    cats: window.Expense ? Expense.CATS.join(',') : '',
    fmt: window.Expense ? [Expense.fmtMoney(5), Expense.fmtMoney(100000), Expense.fmtMoney(0), Expense.fmtMoney(-1250)] : [],
    esc: window.Expense ? [Expense.csvCell('a,b'), Expense.csvCell('说"好"的'), Expense.csvCell('中文，逗号'), Expense.csvCell('两\n行')] : []
  }));
  ok('A03 模块在场且六分类整串对得上（页面吃的是本轮 expense.js，不是缓存里的旧壳）',
    MOD.has && MOD.cats === CATS, MOD.cats);
  ok('A04 分→元读数固定两位小数（0.05 / 1000.00 / 0.00 / 负数带负号），全程不碰 toFixed',
    MOD.fmt.join('|') === '0.05|1000.00|0.00|-12.50', MOD.fmt.join('|'));
  ok('A05 csvCell 口径：半角逗号与引号进引号加倍，中文逗号不进，换行也进（RFC 4180）',
    MOD.esc.join('§') === '"a,b"§"说""好""的"§中文，逗号§"两\n行"', JSON.stringify(MOD.esc));

  /* ================= 1. 底脚结构与入口命名 ================= */
  const S = await page.evaluate(() => {
    const b = document.querySelector('.day-card[data-day="0"] .exfoot button[onclick*="plannerExpEdit"]');
    return {
      cards: document.querySelectorAll('.day-card').length,
      foots: document.querySelectorAll('.day-card .exfoot').length,
      label: b ? b.textContent : 'no-btn',
      glyph: b ? !!b.querySelector('svg use[href="#ti-budget"]') : false,
      clash: [].reduce.call(document.querySelectorAll('.day-card'), function (n, c) {
        var foot = [].map.call(c.querySelectorAll('.exfoot button'), el => el.textContent.trim());
        [].forEach.call(c.querySelectorAll('button'), function (el) {
          if (el.closest('.exfoot')) return;
          if (foot.indexOf(el.textContent.trim()) >= 0) n++;
        });
        return n;
      }, 0),
      unpaid: [].map.call(document.querySelectorAll('.day-card .exfoot .extot'), el => el.textContent)
    };
  });
  ok('A06 每张日卡都挂底脚（转场日那条分支也算在内）', S.cards === S.foots && S.foots >= 3, S.cards + ' 张日卡 / ' + S.foots + ' 个底脚');
  ok('A07 记账入口叫「记开销」且带 budget 字形', /记开销/.test(S.label) && S.glyph, S.label);
  ok('A08 底脚按钮名在整张日卡里唯一：卡内另有打卡按钮叫「记一笔」，同名两颗各指一件事，点错就记错账',
    S.clash === 0, S.clash + ' 个同名撞车');
  ok('A09 没记账时脚注说「今日未记账」，不摆一个 0.00 让人以为记过了',
    S.unpaid.length === S.foots && S.unpaid.every(t => t === '今日未记账'), S.unpaid.join(' / '));

  await openFoot(page, 0);
  const ED = await page.evaluate(() => {
    const amt = document.getElementById('exAmt');
    return {
      edit: !!document.querySelector('.day-card[data-day="0"] .exedit'),
      type: amt ? amt.type : 'none', imode: amt ? amt.getAttribute('inputmode') : '',
      step: amt ? amt.getAttribute('step') : '',
      chips: [].map.call(document.querySelectorAll('#exCats .chip'), el => el.textContent),
      on: [].filter.call(document.querySelectorAll('#exCats .chip'), el => el.classList.contains('on')).map(el => el.getAttribute('data-cat')),
      who: !!document.getElementById('exWho'), note: !!document.getElementById('exNote'),
      save: (document.querySelector('.day-card[data-day="0"] .exacts .btn.primary') || {}).textContent || '',
      aria: amt ? amt.getAttribute('aria-label') : ''
    };
  });
  ok('A10 编辑器：金额框是 number + inputmode=decimal（手机直接上数字键盘），另有垫付人与备注两个可空框',
    ED.edit && ED.type === 'number' && ED.imode === 'decimal' && ED.step === '0.01' && ED.who && ED.note,
    ED.type + '/' + ED.imode + '/' + ED.step + ' 垫付人=' + ED.who + ' 备注=' + ED.note);
  ok('A11 分类六选一整串＝模块 CATS（UI 不自己另立一套分类，两边会漂）', ED.chips.join(',') === CATS, ED.chips.join(','));
  ok('A12 默认选中且只选中「餐饮」（旅行开销的大头，也是唯一预置的一档）', ED.on.join(',') === '餐饮', ED.on.join(','));
  ok('A13 主操作动词是「记上」，金额框有无障碍名', ED.save.trim() === '记上' && ED.aria === '金额（元）', ED.save.trim() + ' / ' + ED.aria);

  await fill(page, { yuan: '0' });
  await commit(page, 0);
  const G = await page.evaluate(t => ({
    toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || '',
    still: !!document.querySelector('.day-card[data-day="0"] .exedit'),
    n: JSON.parse(localStorage.getItem('tn_expense') || '[]').filter(x => x.tripId === t).length
  }), tid);
  ok('A14 金额 0 被挡：出提示、不落盘、编辑器不关（关掉就把刚敲的备注一起吞了）',
    /大于 0 的金额/.test(G.toast) && G.still && G.n === 0, JSON.stringify(G));

  await fill(page, { yuan: '12.50', note: '地铁，机场线', who: '阿明' });
  await page.evaluate(() => {
    [].find.call(document.querySelectorAll('#exCats .chip'), el => el.getAttribute('data-cat') === '交通').click();
  });
  await sleep(200);
  const CHIP = await page.evaluate(() => ({
    amt: document.getElementById('exAmt').value,
    note: document.getElementById('exNote').value,
    who: document.getElementById('exWho').value,
    on: [].filter.call(document.querySelectorAll('#exCats .chip'), el => el.classList.contains('on')).map(el => el.getAttribute('data-cat'))
  }));
  ok('A15 点分类是原地改 .on：已敲的金额/垫付人/备注一个都没被抹（整段重渲染就抹了）',
    CHIP.amt === '12.50' && CHIP.who === '阿明' && CHIP.note === '地铁，机场线' && CHIP.on.join(',') === '交通',
    JSON.stringify(CHIP));
  await closeFoot(page, 0);
  const STOW = await page.evaluate(() => ({
    edit: !!document.querySelector('.day-card[data-day="0"] .exedit'),
    foot: document.querySelector('.day-card[data-day="0"] .exfoot .extot').textContent
  }));
  ok('A16 「收起」真的收起且不落盘（收起不是记账，未提交的 12.50 不该进账本）',
    !STOW.edit && STOW.foot === '今日未记账', JSON.stringify(STOW));

  await openFoot(page, 0);
  const STICK = await page.evaluate(() => [].filter.call(
    document.querySelectorAll('#exCats .chip'), el => el.classList.contains('on')).map(el => el.getAttribute('data-cat')));
  ok('A16b 编辑器重开仍高亮上次选的「交通」：连记同几笔同类的人不该每笔重点一次分类',
    STICK.join(',') === '交通', STICK.join(','));
  await closeFoot(page, 0);

  /* 新会话（expCat 不在快照里，刷新即归零）：高亮的那一档必须就是存进去的那一档。
     首跑就是在这里红的——高亮兜到「餐饮」、提交兜到「其他」，第一笔静默记错类。 */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3400);
  await openFoot(page, 0);
  const SHOW = await page.evaluate(() => [].filter.call(
    document.querySelectorAll('#exCats .chip'), el => el.classList.contains('on')).map(el => el.getAttribute('data-cat')));
  ok('A16c 新会话默认高亮「餐饮」', SHOW.join(',') === '餐饮', SHOW.join(','));
  await fill(page, { yuan: '33.33' });
  await commit(page, 0);
  const S1 = await bucket(page, tid);
  ok('A16d 显示即存入：没碰分类时存进去的分类＝屏幕上高亮的那一档，不是另兜一套默认',
    S1.length === 1 && S1[0].cat === SHOW[0] && S1[0].cents === 3333, JSON.stringify(S1[0] || {}));

  /* ================= 2. 三笔 33.33 复算 ================= */
  for (const y of ['33.33', '33.34']) await addOne(page, 0, { yuan: y });
  const L = await bucket(page, tid);
  ok('A17 逐笔落盘是整数分且精确＝3333/3333/3334（读侧也四舍五入，光看界面抓不到写入侧的退化）',
    L.length === 3 && L.map(x => x.cents).join(',') === '3333,3333,3334' && L.every(x => Number.isInteger(x.cents)),
    L.map(x => x.cents).join(','));
  ok('A18 三笔的 id 互不相同（同天同分类同金额是两笔真实开销，散列 id 会把第二笔并掉＝丢钱）',
    new Set(L.map(x => x.id)).size === 3, L.map(x => x.id).join(','));
  ok('A19 今日汇总＝100.00 元 · 3 笔（33.33+33.33+33.34 复算零误差）',
    await footText(page, 0) === '今日 100.00 元 · 3 笔', await footText(page, 0));
  await openFoot(page, 0);
  const R1 = await rowsOf(page, 0);
  ok('A20 明细三行逐笔两位小数、按录入序排，行里分类/金额/备注各就各位',
    R1.map(r => r.money).join(',') === '33.33,33.33,33.34' && R1.every(r => r.cat === '餐饮'),
    JSON.stringify(R1.map(r => r.cat + ':' + r.money)));
  await closeFoot(page, 0);

  const SUM = await page.evaluate(() => ({
    disp: document.getElementById('expCard').style.display,
    sumcard: document.getElementById('expCard').classList.contains('sumcard'),
    count: document.getElementById('expCount').textContent,
    barW: document.getElementById('expBar').style.width,
    barH: Math.round(document.getElementById('expBar').getBoundingClientRect().height),
    wrapW: Math.round(document.getElementById('expBarWrap').getBoundingClientRect().width),
    over: document.getElementById('expOver').innerHTML
  }));
  ok('A21 汇总卡读数＝共 100.00 元 · 3 笔（与日卡同一把尺子，不是各算一遍）',
    SUM.disp === 'block' && SUM.count === '共 100.00 元 · 3 笔', SUM.count);
  ok('A22 卡片挂 sumcard 且进度条真有像素尺寸（批次 17 把样式挂在 .pretrip 上，这张条一直是隐形的）',
    SUM.sumcard && SUM.barH > 2 && SUM.wrapW > 40, 'i 高 ' + SUM.barH + 'px / 槽宽 ' + SUM.wrapW + 'px');
  ok('A23 没设预算时条占满但不装出「快超了」的样子（超支块与 .over 都不许在场）',
    SUM.barW === '100%' && SUM.over === '', SUM.barW + ' / ' + JSON.stringify(SUM.over).slice(0, 30));

  const B1 = await bars(page);
  ok('A24 条形只列金额>0 的分类；单类时它就是那一类且宽 100%',
    B1.length === 1 && B1[0].cat === '餐饮' && B1[0].v === '100.00' && B1[0].w === '100%', JSON.stringify(B1));

  /* ================= 3. 补三笔：交通带备注 / 住宿带引号 / 第二天一笔带过 ================= */
  await addOne(page, 0, { yuan: '12.50', cat: '交通', who: '阿明', note: '地铁，机场线' });
  const L4 = await bucket(page, tid);
  ok('A25 交通那笔记全分类/垫付人/备注，中文逗号原样进库（没被谁当成分隔符切掉）',
    L4.length === 4 && L4[3].cents === 1250 && L4[3].cat === '交通' && L4[3].who === '阿明' && L4[3].note === '地铁，机场线',
    JSON.stringify(L4[3] || {}));
  await addOne(page, 0, { yuan: '839.50', cat: '住宿', note: '纪念品，两件套"套"' });
  await openFoot(page, 1, true);
  const LUMP = await page.evaluate(() => ({
    chips: document.querySelectorAll('#exCats').length,
    hint: (document.querySelector('.day-card[data-day="1"] .exhint') || {}).textContent || '',
    ph: document.getElementById('exAmt').placeholder,
    who: !!document.getElementById('exWho')
  }));
  ok('A26 「一笔带过」不给分类/垫付人，只问今天一共花了多少（拆不开账的时候别逼人填表）',
    LUMP.chips === 0 && !LUMP.who && LUMP.ph === '今天一共花了多少' && /不分类/.test(LUMP.hint), JSON.stringify(LUMP));
  await fill(page, { yuan: '88' });
  await commit(page, 1);
  const L6 = await bucket(page, tid);
  ok('A27 一笔带过落成「其他 · 全天一笔带过 · 8800 分」且记在第 2 天（各天各算，不串账）',
    L6.length === 6 && L6[5].cents === 8800 && L6[5].cat === '其他' && L6[5].day === 2 && L6[5].note === '全天一笔带过',
    JSON.stringify(L6[5] || {}));
  ok('A28 第 1 天 952.00/5 笔、第 2 天 88.00/1 笔，两条页脚各算各的',
    await footText(page, 0) === '今日 952.00 元 · 5 笔' && await footText(page, 1) === '今日 88.00 元 · 1 笔',
    await footText(page, 0) + ' | ' + await footText(page, 1));
  const B2 = await bars(page);
  ok('A29 条形按金额降序、最大的占满、最小的夹到 4% 下限、零钱分类不占行（六类只出四类）',
    B2.length === 4 && B2.map(x => x.cat).join(',') === '住宿,餐饮,其他,交通' &&
    B2[0].w === '100%' && B2[3].w === '4%', JSON.stringify(B2));

  /* ================= 4. 预算：超支分支 ================= */
  await setBudget(page, '1000');
  const OV = await page.evaluate(t => {
    const raw = JSON.parse(localStorage.getItem('tn_budget') || '{}');
    return {
      stored: raw[t], keys: Object.keys(raw),
      toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || '',
      count: document.getElementById('expCount').textContent,
      warn: (document.querySelector('#expOver .warnline') || {}).textContent || '',
      warnIc: !!document.querySelector('#expOver .warnline svg'),
      over: document.getElementById('expBarWrap').classList.contains('over'),
      barW: document.getElementById('expBar').style.width,
      back: document.getElementById('exBudget').value
    };
  }, tid);
  ok('A30 预算 1000 元落盘是整数分 100000（元→分只在这两处发生），且只动本趟的键',
    OV.stored === 100000 && Number.isInteger(OV.stored) && OV.keys.length === 1 && /预算设为 1000\.00 元/.test(OV.toast),
    JSON.stringify(OV.stored) + ' 键=' + OV.keys.join(','));
  ok('A31 花到 1040.00 时汇总整串是「共 1040.00 元 · 6 笔」，超支行是「已超预算 40.00 元」（不只换颜色）',
    OV.count === '共 1040.00 元 · 6 笔' && OV.warn === '已超预算 40.00 元', OV.count + ' / ' + OV.warn);
  ok('A32 超支时 .over 同时挂上，条宽夹在 100% 不冲出卡片',
    OV.over && OV.barW === '100%' && OV.warnIc, 'over=' + OV.over + ' w=' + OV.barW + ' 图标=' + OV.warnIc);
  ok('A33 预算框回写成两位小数读数（1000.00），不是把输入原样晾着', OV.back === '1000.00', OV.back);

  /* ================= 5. CSV 逐字对账 ================= */
  await page.evaluate(() => document.getElementById('expCsvBtn').click());
  await sleep(500);
  const CSV = await page.evaluate(async () => {
    const b = window.__cap[window.__cap.length - 1];
    /* BOM 必须从 arrayBuffer 看：Blob.text() 按规范会把前导 BOM 剥掉，
       用 text() 判 BOM 的判据无论有没有 BOM 都是红的，等于没有这条闸门。 */
    const buf = b ? new Uint8Array(await b.arrayBuffer()) : [];
    return {
      name: window.__dl[window.__dl.length - 1] || 'no-download',
      mime: b ? b.type : '',
      bom: buf.length >= 3 ? [buf[0], buf[1], buf[2]].join(',') : 'none',
      text: b ? await b.text() : '',
      toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || ''
    };
  });
  const rows = CSV.text.split('\r\n');
  const tripName = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tn_planner_state')).trip.name);
  const expName = await page.evaluate(n => String(n).replace(/[\\/:*?"<>|]/g, '·').slice(0, 60) || '行程', tripName);
  ok('A34 导出真走下载通道一次：MIME 是 text/csv，文件名＝icsFileSafe(行程名)+「-开销.csv」',
    CSV.name === expName + '-开销.csv' && CSV.mime.indexOf('text/csv') === 0, CSV.name + ' / ' + CSV.mime);
  ok('A35 首三字节 EF BB BF（无 BOM 的 UTF-8 中文 CSV 在 Windows Excel 里开成一屏乱码），且只有一个 BOM，行结束符只有 CRLF',
    CSV.bom === '239,187,191' && CSV.text.charCodeAt(0) !== 0xFEFF && CSV.text.slice(-2) === '\r\n' &&
    CSV.text.replace(/\r\n/g, '').indexOf('\n') < 0, '首三字节=' + CSV.bom + ' 行数=' + rows.length);
  ok('A36 首行带行程名、表头整串固定（谁改列名谁负责通知所有旧账单）',
    rows[0] === '开销记账 - ' + tripName && rows[1] === '日期,第几天,分类,金额(元),垫付人,备注', rows[0] + ' | ' + rows[1]);
  const d1 = rows.filter(r => r.indexOf('2026-11-08,第1天,') === 0);
  const d2 = rows.filter(r => r.indexOf('2026-11-09,第2天,') === 0);
  ok('A37 日期列与出发日期逐日同源：第 1 天 5 行都是 11-08，第 2 天那行是 11-09（不是把 di 当日期写死）',
    d1.length === 5 && d2.length === 1, '第1天 ' + d1.length + ' 行 / 第2天 ' + d2.join(',').slice(0, 46));
  ok('A38 只有中文逗号的字段整行不加引号（判定按 RFC 那三个字符，不按「看着像不像」）',
    d1.indexOf('2026-11-08,第1天,交通,12.50,阿明,地铁，机场线') >= 0,
    JSON.stringify(d1.filter(r => /交通/.test(r))));
  ok('A39 含英文双引号的字段整格加引号且引号加倍（表格软件按 RFC 还原成原样）',
    d1.indexOf('2026-11-08,第1天,住宿,839.50,,"纪念品，两件套""套"""') >= 0,
    JSON.stringify(d1.filter(r => /住宿/.test(r))));
  ok('A40 分类小计固定六行、固定顺序，门票/购物这类零钱也照样占行（缺席与 0.00 是两回事）',
    rows.join('|').indexOf('|交通,12.50|住宿,839.50|餐饮,100.00|门票,0.00|购物,0.00|其他,88.00|') >= 0,
    rows.slice(rows.indexOf('分类小计,金额(元)'), 9).join(' / '));
  ok('A41 合计/预算/超支/条数四行齐备，金额两位小数、条数是整数',
    /合计,1040\.00/.test(CSV.text) && /预算,1000\.00/.test(CSV.text) &&
    /超支,40\.00/.test(CSV.text) && /笔记条数,6/.test(CSV.text),
    rows.filter(r => /^(合计|预算|超支|笔记条数)/.test(r)).join(' / '));

  /* ================= 6. 刷新存活 ================= */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3400);
  const RS = await page.evaluate(t => {
    const b = JSON.parse(localStorage.getItem('tn_expense') || '[]').filter(x => x.tripId === t);
    return {
      stage: document.getElementById('stageResult').style.display,
      n: b.length, cents: b.map(x => x.cents).join(','),
      count: document.getElementById('expCount').textContent,
      warn: (document.querySelector('#expOver .warnline') || {}).textContent || '',
      foot: document.querySelector('.day-card[data-day="0"] .exfoot .extot').textContent,
      bud: document.getElementById('exBudget').value
    };
  }, tid);
  ok('A42 刷新重进不翻倍不丢笔（6 笔 / 分位串逐笔一致），且仍停在结果页',
    RS.stage === 'block' && RS.n === 6 && RS.cents === '3333,3333,3334,1250,83950,8800',
    RS.n + ' 笔 / ' + RS.cents);
  ok('A43 刷新后汇总、日脚、超支行、预算框全部从盘上重算（不是内存里的旧读数）',
    RS.count === '共 1040.00 元 · 6 笔' && RS.warn === '已超预算 40.00 元' &&
    RS.foot === '今日 952.00 元 · 5 笔' && RS.bud === '1000.00',
    RS.count + ' / ' + RS.warn + ' / ' + RS.foot + ' / ' + RS.bud);

  /* ================= 7. 删除一笔：确认 / 取消 / 确认 ================= */
  await openFoot(page, 0);
  await page.evaluate(() => {
    const r = [].find.call(document.querySelectorAll('.day-card[data-day="0"] .exrows .ex'),
      el => el.querySelector('.money').textContent === '12.50');
    r.querySelector('button.mv').click();
  });
  await sleep(350);
  const CF = await page.evaluate(() => {
    const m = document.querySelector('.ui-modal');
    return {
      has: !!m, native: window.__native,
      title: m ? m.querySelector('.ui-modal-title').textContent : '',
      text: m ? m.querySelector('.ui-modal-text').textContent : '',
      danger: !!(m && m.querySelector('.ui-btn-primary').classList.contains('danger')),
      label: m ? m.querySelector('.ui-btn-primary').textContent : ''
    };
  });
  ok('A44 删除走 UI.confirm（原生 confirm/alert 全程零调用），文案点名这笔是什么并讲清「删了就找不回来」',
    CF.has && CF.native === 0 && CF.title === '删除这笔' && /交通 12\.50 元/.test(CF.text) &&
    /删了就找不回来/.test(CF.text) && CF.danger && CF.label === '删除', JSON.stringify(CF).slice(0, 150));
  await page.evaluate(() => document.querySelector('.ui-modal .ui-btn-ghost').click());
  await sleep(250);
  const KEPT = await page.evaluate(t => JSON.parse(localStorage.getItem('tn_expense')).filter(x => x.tripId === t).length, tid);
  ok('A45 点取消一笔没删（6 笔还在盘上）', KEPT === 6, KEPT + ' 笔');

  await page.evaluate(() => {
    const r = [].find.call(document.querySelectorAll('.day-card[data-day="0"] .exrows .ex'),
      el => el.querySelector('.money').textContent === '12.50');
    r.querySelector('button.mv').click();
  });
  await sleep(300);
  await page.evaluate(() => document.querySelector('.ui-modal .ui-btn-primary').click());
  await sleep(350);
  const DEL = await page.evaluate(t => {
    const b = JSON.parse(localStorage.getItem('tn_expense')).filter(x => x.tripId === t);
    return {
      n: b.length, cents: b.map(x => x.cents).join(','),
      toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || '',
      count: document.getElementById('expCount').textContent,
      warn: (document.querySelector('#expOver .warnline') || {}).textContent || '',
      foot: document.querySelector('.day-card[data-day="0"] .exfoot .extot').textContent
    };
  }, tid);
  ok('A46 确认后这笔真从盘上没了，汇总/日脚/超支一起重算（不是只把行藏起来）',
    DEL.n === 5 && DEL.cents === '3333,3333,3334,83950,8800' && /已删除这笔/.test(DEL.toast) &&
    DEL.count === '共 1027.50 元 · 5 笔' && DEL.warn === '已超预算 27.50 元' && DEL.foot === '今日 939.50 元 · 4 笔',
    DEL.n + ' 笔 / ' + DEL.count + ' / ' + DEL.warn + ' / ' + DEL.foot);

  /* 结余分支 */
  await setBudget(page, '2000');
  const UN = await page.evaluate(t => ({
    warn: document.getElementById('expOver').innerHTML,
    over: document.getElementById('expBarWrap').classList.contains('over'),
    barW: document.getElementById('expBar').style.width,
    toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || '',
    csv: Expense.buildCsv(t, { name: 'X', dateOf: function () { return ''; } })
  }), tid);
  ok('A47 预算抬到 2000 后超支卡整块退场（留个空 div 也算没清干净）',
    UN.warn === '' && !UN.over, JSON.stringify(UN.warn).slice(0, 40));
  ok('A48 条宽＝round(合计/预算×100)＝51%（1027.50/2000），不是随手拉满',
    UN.barW === Math.round(102750 / 200000 * 100) + '%', UN.barW);
  ok('A49 没超支时 CSV 走「结余」分支且金额＝预算减合计（972.50），「超支」字样整行退场',
    /结余,972\.50/.test(UN.csv) && !/超支/.test(UN.csv),
    UN.csv.split('\r\n').filter(r => /^(结余|超支)/.test(r)).join(' / '));

  /* ================= 8. 空账的导出出口 ================= */
  const RAW = await page.evaluate(() => localStorage.getItem('tn_expense'));
  const dlBefore = await page.evaluate(() => window.__dl.length);
  await page.evaluate(t => Expense.clearTrip(t), tid);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3400);
  await page.evaluate(() => document.getElementById('expCsvBtn').click());
  await sleep(400);
  const EMP = await page.evaluate(dl => ({
    toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop()) || {}).textContent || '',
    grew: window.__dl.length > dl,
    count: document.getElementById('expCount').textContent,
    bars: document.getElementById('expBars').textContent,
    op: document.getElementById('expCsvBtn').style.opacity,
    foot: document.querySelector('.day-card[data-day="0"] .exfoot .extot').textContent
  }), dlBefore);
  ok('A50 空账点导出不下载文件，只把用户领去「日卡底部记开销」（按钮只降透明度不 disabled 才有这句话）',
    /这笔账还是空的/.test(EMP.toast) && !EMP.grew && Number(EMP.op) === 0.55, EMP.toast + ' / 下载' + (EMP.grew ? '发生了' : '没发生'));
  ok('A51 空账态三处一起归位：汇总「还没记账」、条形区给出去哪记的说明、日脚回到未记账',
    EMP.count === '还没记账' && /日卡底部点「记开销」/.test(EMP.bars) && EMP.foot === '今日未记账',
    EMP.count + ' / ' + EMP.foot);
  await page.evaluate(raw => localStorage.setItem('tn_expense', raw), RAW);

  /* ================= 9. 行程删除带走账 / 撤销按字节还原 ================= */
  await page.evaluate(() => window.plannerSaveTrip());
  await sleep(400);
  const BEFORE = await page.evaluate(() => ({
    exp: localStorage.getItem('tn_expense'), bud: localStorage.getItem('tn_budget'),
    trips: JSON.parse(localStorage.getItem('tn_trips') || '[]').length
  }));
  ok('A52 保存行程这一腿先跑通（后面删行程要有索引可删）', BEFORE.trips === 1, BEFORE.trips + ' 趟');
  await page.evaluate(() => window.plannerDelTrip(0));
  await sleep(350);
  const DT = await page.evaluate(() => ({
    has: !!document.querySelector('.ui-modal'),
    text: ((document.querySelector('.ui-modal-text') || {}).textContent) || ''
  }));
  ok('A53 删行程的确认卡讲清「清单勾选与开销记账也会一并删除」（不许静默连带删钱）',
    DT.has && /开销记账也会一并删除/.test(DT.text), DT.text.slice(0, 70));
  await page.evaluate(() => document.querySelector('.ui-modal .ui-btn-primary').click());
  await sleep(400);
  const GONE = await page.evaluate(t => {
    const raw = JSON.parse(localStorage.getItem('tn_expense') || '[]');
    const bd = JSON.parse(localStorage.getItem('tn_budget') || '{}');
    const last = [].slice.call(document.querySelectorAll('.ui-toast')).pop() || {};
    return {
      orphan: raw.filter(x => x.tripId === t).length,
      bud: Object.prototype.hasOwnProperty.call(bd, t),
      count: document.getElementById('expCount').textContent,
      warn: document.getElementById('expOver').innerHTML,
      bars: document.getElementById('expBars').textContent,
      toast: last.textContent || '', act: !!last.querySelector('.ui-toast-act')
    };
  }, tid);
  ok('A54 行程没了账与预算也没了（不留孤儿桶，localStorage 无界攒着就是泄漏），汇总卡当场归零',
    GONE.orphan === 0 && !GONE.bud && GONE.count === '还没记账' && GONE.warn === '' && /记开销/.test(GONE.bars),
    '残留 ' + GONE.orphan + ' 条 / 预算键在=' + GONE.bud + ' / ' + GONE.count);
  ok('A55 删除出带撤销按钮的 toast', /已删除/.test(GONE.toast) && GONE.act, GONE.toast.slice(0, 40));
  await page.evaluate(() => [].slice.call(document.querySelectorAll('.ui-toast')).pop().querySelector('.ui-toast-act').click());
  await sleep(400);
  const RST = await page.evaluate(() => ({
    exp: localStorage.getItem('tn_expense'), bud: localStorage.getItem('tn_budget'),
    trips: JSON.parse(localStorage.getItem('tn_trips') || '[]').length,
    count: document.getElementById('expCount').textContent
  }));
  ok('A56 撤销把账与预算按原字节还原，汇总卡跟着回来（重算一遍会丢 ts/顺序细节）',
    RST.exp === BEFORE.exp && RST.bud === BEFORE.bud && RST.trips === 1 && RST.count === '共 1027.50 元 · 5 笔',
    '账还原=' + (RST.exp === BEFORE.exp) + ' 预算还原=' + (RST.bud === BEFORE.bud) + ' / ' + RST.count);

  /* ================= 10. 隐私 / 几何 / 双栏档 ================= */
  const PRIV = await page.evaluate(() => {
    const t = JSON.parse(sessionStorage.getItem('tn_planner_state')).trip;
    const p = JSON.parse(JSON.stringify(t));
    p.expense = [{ cents: 9988776 }]; p.budget = 9988776; p.money = '绝不该出现在分享里';
    const out = window.Share.payloadOf(p);
    return {
      hit: Object.keys(Share.ALLOWED).filter(k => /exp|budget|cents|money|who|note|paid/i.test(k)),
      s: JSON.stringify(out), stray: window.Share.strayKeys(out)
    };
  });
  ok('A57 钱不出分享：白名单里没有金额类字段，载荷里搜不到任何一笔分位，也没有游离键',
    PRIV.hit.length === 0 && PRIV.s.indexOf('9988776') < 0 && PRIV.s.indexOf('绝不该出现在分享里') < 0 && PRIV.stray.length === 0,
    '白名单命中=[' + PRIV.hit.join(',') + '] 游离=[' + PRIV.stray.join(',') + ']');

  await addOne(page, 0, { yuan: '6.80', cat: '门票' });
  const GEO = await page.evaluate(() => {
    const card = document.querySelector('.day-card[data-day="0"]');
    card.querySelector('.exfoot button[onclick*="plannerExpEdit"]').click();
    return null;
  });
  await sleep(250);
  const GM = await page.evaluate(() => {
    const amt = document.getElementById('exAmt');
    const btn = document.querySelector('.day-card .exacts .btn.primary');
    const chip = document.querySelector('#exCats .chip');
    const mv = document.querySelector('.day-card .exrows .ex .mv');
    const foot = document.querySelector('.day-card[data-day="0"] .exfoot');
    return {
      over: document.documentElement.scrollWidth - window.innerWidth,
      amtH: Math.round(amt.getBoundingClientRect().height),
      btnH: Math.round(btn.getBoundingClientRect().height),
      chipH: Math.round(chip.getBoundingClientRect().height),
      mvH: mv ? Math.round(mv.getBoundingClientRect().height) : 0,
      csvH: Math.round(document.getElementById('expCsvBtn').getBoundingClientRect().height),
      budH: Math.round(document.getElementById('exBudget').getBoundingClientRect().height),
      footBtns: [].map.call(foot.querySelectorAll('button'), el => Math.round(el.getBoundingClientRect().height)),
      offRight: Math.round(window.innerWidth - foot.getBoundingClientRect().right)
    };
  });
  ok('A58 452 真机档不产生横向溢出（底脚一行排两个按钮加一段汇总，最容易顶出去）', GM.over <= 0, '溢出 ' + GM.over + 'px');
  ok('A59 记账这条路上每个可点可输的都够 44px：金额框、「记上」、导出键、预算框',
    GM.amtH >= 44 && GM.btnH >= 44 && GM.csvH >= 44 && GM.budH >= 44,
    'amt ' + GM.amtH + ' / 记上 ' + GM.btnH + ' / 导出 ' + GM.csvH + ' / 预算 ' + GM.budH);
  ok('A60 分类 chip、底脚两个入口、明细的删除方块也都够 44px：chip 是这笔账归哪一类的判定，删除是销毁真实记录',
    GM.chipH >= 44 && GM.mvH >= 44 && GM.footBtns.every(h => h >= 44),
    'chip ' + GM.chipH + ' / 删除 ' + GM.mvH + ' / 底脚 ' + GM.footBtns.join(','));

  await page.setViewport({ width: 1440, height: 900, isMobile: false });
  await sleep(800);
  const WIDE = await page.evaluate(() => {
    const box = document.getElementById('expCard').getBoundingClientRect();
    return {
      w: Math.round(box.width), right: Math.round(box.right), vw: window.innerWidth,
      over: document.documentElement.scrollWidth - window.innerWidth,
      count: document.getElementById('expCount').textContent
    };
  });
  ok('A61 1440 双栏档汇总卡仍在视口内且读数没掉（批次 18 的侧栏不许把它挤出去）',
    WIDE.w > 120 && WIDE.right <= WIDE.vw + 1 && WIDE.over <= 0 && WIDE.count === '共 1034.30 元 · 6 笔',
    JSON.stringify(WIDE));

  /* ================= 12. 批次 24 数据层：真实日期 / 迁移 / free 桶 / 进行中判定 =================
     这一段全走 window.Expense 本身（不复制实现、不在 node 侧另算一遍）。
     构造的旧形状条目只在内存里过 migrate；byDate 那两条用一次性假桶，跑完按字节还原盘。 */
  const RAW24 = await page.evaluate(() => localStorage.getItem('tn_expense'));
  const M24 = await page.evaluate(o => {
    const raw = o.raw, START = o.start;
    const E = window.Expense;
    const old = [
      { id: 'o1', tripId: 'zz', day: 1, cents: 3333, cat: '交通', who: '', note: '', ts: 1700000000000 },
      { id: 'o2', tripId: 'zz', day: 2, cents: 3333, cat: '住宿', who: '', note: '', ts: 1700000001000 },
      { id: 'o3', tripId: 'zz', day: 3, cents: 3334, cat: '餐饮', who: '', note: '', ts: 1700000002000 }
    ];
    const key = l => l.map(x => x.id + ':' + x.cents).join('|');
    const one = E.migrate(old, START);
    const two = E.migrate(one.list, START);
    const nog = E.migrate(old, '');
    return {
      sumBefore: old.reduce((t, x) => t + x.cents, 0),
      sumAfter: one.list.reduce((t, x) => t + x.cents, 0),
      centsSame: key(old) === key(one.list),
      filled: one.filled,
      dates: one.list.map(x => x.date),
      idempotent: E.migrate(one.list, START).filled === 0 && JSON.stringify(two.list) === JSON.stringify(one.list),
      secondFilled: two.filled,
      oldUntouched: old.every(x => x.date === undefined),
      nogFilled: nog.filled,
      nogDates: nog.list.map(x => x.date || ''),
      /* ts=1700000000000 → 2023-11-14；反推不出时宁可留空，也不许拿记账动作的时刻冒充花钱那天 */
      noTsLie: nog.list.every(x => !/2023/.test(String(x.date || ''))),
      onDisk: localStorage.getItem('tn_expense') === raw,
      badAddDays: E.addDays('2026-13-40', 3),
      badShape: E.isoOf('2026-1-5'),
      padOk: E.isoOf('2026-01-05'),
      addDaysCross: E.addDays('2026-02-27', 2),
      dayFrom: E.dayFromStart(START, '2026-11-10'),
      dayBefore: E.dayFromStart(START, '2026-11-07'),
      freeId: E.FREE_ID, freeName: E.FREE_NAME
    };
  }, { raw: RAW24, start: START });
  ok('A64 迁移前后逐条金额求和相等、逐条 id:cents 一致（钱只认整数分，这条能精确比）',
    M24.sumBefore === M24.sumAfter && M24.sumBefore === 10000 && M24.centsSame,
    M24.sumBefore + ' → ' + M24.sumAfter);
  ok('A65 缺 date 的旧条目按 startDate+(day-1) 反推：第 1/2/3 天钉在出发日往后三天',
    M24.filled === 3 && M24.dates.join(',') === '2026-11-08,2026-11-09,2026-11-10',
    M24.dates.join(','));
  ok('A66 migrate 幂等（跑第二遍一笔也不补、输出字节相同），且不许就地改用户传进来的那份数组',
    M24.idempotent && M24.oldUntouched && M24.secondFilled === 0,
    '第二遍 filled=' + M24.secondFilled + ' / 原数组被改=' + !M24.oldUntouched);
  ok('A67 推不出就留空：行程没有出发日期时 date 仍是空串，绝不拿 ts（2023-11-14）冒充花钱那天',
    M24.nogFilled === 0 && M24.nogDates.every(d => d === '') && M24.noTsLie,
    JSON.stringify(M24.nogDates));
  ok('A68 迁移只在内存派生视图，跑完盘上还是原来那串字节（替用户写日期＝对账时最坏的一种）',
    M24.onDisk, '盘上未变=' + M24.onDisk);
  ok('A69 日期只认零补齐的 YYYY-MM-DD：\'2026-1-5\' 不收（字符串序会排到 \'2026-11-02\' 前面），越界的 2026-13-40 也不编',
    M24.badShape === '' && M24.padOk === '2026-01-05' && M24.badAddDays === '',
    'bad=' + JSON.stringify(M24.badAddDays) + ' shape=' + JSON.stringify(M24.badShape));
  ok('A70 按日历日加减、不按毫秒除法：跨到月底那两天照样对；真实日期→计划第几天可反推，早于出发返回 0',
    M24.addDaysCross === '2026-03-01' && M24.dayFrom === 3 && M24.dayBefore === 0,
    M24.addDaysCross + ' / day=' + M24.dayFrom + ' / 早于出发=' + M24.dayBefore);

  const B24 = await page.evaluate(o => {
    const raw = o.raw, START = o.start;
    const E = window.Expense, T = 'zz-plan24';
    const mk = (id, day, date, cents) => ({ id: id, tripId: T, day: day, date: date, cents: cents, cat: '其他', who: '', note: '', ts: 1 });
    const synth = [mk('s1', 1, '2026-11-08', 100), mk('s2', 2, '2026-11-09', 200), mk('s3', 5, '2026-11-12', 300), mk('s4', 3, '', 400)];
    localStorage.setItem('tn_expense', JSON.stringify(synth));
    const g = E.byDate(T, START);
    const gNo = E.byDate(T, '');
    const und = E.undated(T);
    /* tripOf 故意给不出出发日期：反推不出的那笔（s4）就不许进任何年份 */
    const y26 = E.yearCents('2026', () => ({ startDate: '' }));
    const y27 = E.yearCents('2027', () => ({ startDate: START }));
    localStorage.setItem('tn_expense', raw);
    return {
      groups: g.map(x => x.date + ':' + x.cents + ':' + x.count),
      order: g.map(x => x.date).join(','),
      orderNoStart: gNo.map(x => x.date).join(','),
      overPlan: g.filter(x => E.dayFromStart(START, x.date) > 3).map(x => x.date),
      undated: und, y26: y26, y27: y27,
      restored: localStorage.getItem('tn_expense') === raw
    };
  }, { raw: RAW24, start: START });
  ok('A71 byDate 按真实日期分组、与 days.length 无关：计划 3 天而钱在第 5 天，照样独立成一行（多走的天不再没有入口）',
    B24.groups.length === 4 && B24.overPlan.join(',') === '2026-11-12',
    B24.groups.join(' | ') + ' / 计划外: ' + B24.overPlan.join(','));
  ok('A72 按日期倒序；有出发日期时空串被反推补齐，没出发日期时「日期未知」那组落最后（不洗成某个日期去「排整齐」）',
    B24.order === '2026-11-12,2026-11-10,2026-11-09,2026-11-08' &&
    B24.orderNoStart === '2026-11-12,2026-11-09,2026-11-08,',
    '有档: ' + B24.order + ' / 无档: ' + JSON.stringify(B24.orderNoStart));
  ok('A73 undated 数出「重排期会跟着新序号搬走」的那批：1 笔 4.00 元（只看条目自己写没写过日期，不看能不能反推）',
    B24.undated.n === 1 && B24.undated.cents === 400, JSON.stringify(B24.undated));
  ok('A74 yearCents 反推不出的条目不进任何年份：2026 只算到 3 笔 6.00 元，宁可少算也不多算',
    B24.y26.count === 3 && B24.y26.cents === 600 && B24.y27.cents === 0,
    JSON.stringify(B24.y26) + ' / ' + JSON.stringify(B24.y27));
  ok('A75 假桶跑完按字节还原，真账一个字节没动', B24.restored, 'restored=' + B24.restored);

  const RAWB24 = await page.evaluate(() => localStorage.getItem('tn_budget'));
  const F24 = await page.evaluate(raw => {
    const E = window.Expense, T = 'zz-plan24';
    const free = E.add(E.FREE_ID, 3, '12.34', '餐饮', '阿明', '没排行程也能记', '2026-12-01');
    const bad = E.add(T, 1, '9.99', '交通', '', '日期形状不合法', '2026-1-5');
    const out = {
      freeId: free && free.tripId, freeCents: free && free.cents, freeDate: free && free.date, freeDay: free && free.day,
      freeTotal: E.totalCents(E.FREE_ID),
      tripTotal: E.totalCents(T),
      badDate: bad && bad.date, badCents: bad && bad.cents,
      budget: E.setBudget(E.FREE_ID, '50'), budgetOf: E.budgetOf(E.FREE_ID),
      over: E.overCents(E.FREE_ID),
      cleared: E.clearTrip(E.FREE_ID), gone: E.totalCents(E.FREE_ID),
      budgetGone: Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('tn_budget') || '{}'), E.FREE_ID)
    };
    localStorage.setItem('tn_expense', raw);
    return out;
  }, RAW24);
  ok('A76 未编排行程桶（free）：没有 trip 也能记上一笔，金额照样进整数分、日期照形状落盘，显示名是「未编排行程」',
    F24.freeId === 'free' && F24.freeCents === 1234 && F24.freeDate === '2026-12-01' && F24.freeDay === 3 &&
    M24.freeId === 'free' && M24.freeName === '未编排行程',
    JSON.stringify([F24.freeId, F24.freeCents, F24.freeDate, F24.freeDay, M24.freeName]));
  ok('A77 free 桶单独成账：它的合计只有它自己那笔，另一趟的合计也只有那一趟的（入口豁免 ≠ 账混桶）',
    F24.freeTotal === 1234 && F24.tripTotal === 999, 'free ' + F24.freeTotal + ' / 另一桶 ' + F24.tripTotal);
  ok('A78 非法形状的第 7 参不落盘：date 记空串进「日期未知」，而不是硬凑一个日期',
    F24.badDate === '' && F24.badCents === 999, JSON.stringify([F24.badDate, F24.badCents]));
  ok('A79 预算与超支对 free 桶同样成立（这是「从不规划的人」唯一的口径），清桶时预算键跟着走不留档',
    F24.budget === 5000 && F24.budgetOf === 5000 && F24.over === 0 && F24.cleared >= 1 && F24.gone === 0 && !F24.budgetGone,
    '预算 ' + F24.budget + ' / 清掉 ' + F24.cleared + ' 笔 / 残留 ' + F24.gone + ' / 预算键在=' + F24.budgetGone);
  await page.evaluate(o => {
    localStorage.setItem('tn_expense', o.exp); localStorage.setItem('tn_budget', o.bud);
  }, { exp: RAW24, bud: RAWB24 });

  const A24 = await page.evaluate(() => {
    const E = window.Expense;
    const tr = id => ({ id: id, name: id, startDate: '2026-11-08', days: [[], [], []] });
    const inRange = E.activeTripOf([tr('a')], '2026-11-09');
    const lastDay = E.activeTripOf([tr('a')], '2026-11-10');
    const outRange = E.activeTripOf([tr('a')], '2026-11-11');
    const beforeStart = E.activeTripOf([tr('a')], '2026-11-07');
    const overlap = E.activeTripOf([tr('a'), { id: 'b', startDate: '2026-11-09', days: [[], []] }], '2026-11-09');
    const noStart = E.activeTripOf([{ id: 'c', days: [[], []] }], '2026-11-09');
    const empty = E.activeTripOf([], '2026-11-09');
    const real = E.activeTripOf([{ id: 'd', startDate: '2026-11-08', days: [[], [], []], realDays: 6 }], '2026-11-13');
    const log = E.activeTripOf([{ id: 'e', startDate: '2026-11-08', days: [[], [], []], logStart: '2026-11-10' }], '2026-11-09');
    const logIn = E.activeTripOf([{ id: 'e', startDate: '2026-11-08', days: [[], [], []], logStart: '2026-11-10' }], '2026-11-10');
    const dayNum = E.activeDayOf({ id: 'f', logStart: '2026-11-10', startDate: '2026-11-08', days: [[], [], []] }, '2026-11-11');
    const dayNull = E.activeDayOf(null, '2026-11-11');
    const dayNo = E.activeDayOf({ id: 'g', days: [[], []] }, '2026-11-11');
    return {
      inRange: inRange && inRange.id, lastDay: lastDay && lastDay.id,
      outRange: !!outRange, beforeStart: !!beforeStart, overlap: overlap && overlap.id,
      noStart: !!noStart, empty: !!empty, real: real && real.id, log: !!log, logIn: logIn && logIn.id,
      dayNum: dayNum, dayNull: dayNull, dayNo: dayNo
    };
  });
  ok('A80 进行中判定按区间闭合：出发日与最后一天都算在内，早于出发和结束次日一律判不出',
    A24.inRange === 'a' && A24.lastDay === 'a' && !A24.outRange && !A24.beforeStart,
    JSON.stringify([A24.inRange, A24.lastDay, A24.outRange, A24.beforeStart]));
  ok('A81 多趟重叠取最近开始的那趟；猜错行程＝把钱记到另一趟头上，判不出（无出发日／空列表）返回空让调用方落到选择器',
    A24.overlap === 'b' && !A24.noStart && !A24.empty,
    '重叠→' + A24.overlap + ' / 无出发日→' + A24.noStart + ' / 空列表→' + A24.empty);
  ok('A82 实际口径优先于计划口径：logStart 存在时按它判（计划 11-08 出发、实际 11-10 才走，11-09 不算进行中）；realDays 比 days.length 长时按实走天数',
    !A24.log && A24.logIn === 'e' && A24.real === 'd',
    JSON.stringify([A24.log, A24.logIn, A24.real]));
  ok('A83 activeDayOf 反推第几天按 logStart 不按 startDate；没有行程／没有出发日返回 0 而不是 1',
    A24.dayNum === 2 && A24.dayNull === 0 && A24.dayNo === 0,
    A24.dayNum + ' / ' + A24.dayNull + ' / ' + A24.dayNo);

  /* ================= 批次 24-B：expense.html 独立记账主页 =================
     这一段验的是「页面」不是数据层：两态怎么切、认不出的 trip 会不会建桶、
     记完一笔顶部年总有没有跟着走。年总那条是实测补的回归——renderTrip 原先不叫 renderYear，
     记完一笔页面下方全变了、头顶那张卡还停在 0.00，看着就像「这页没记住」。 */
  const PG = 'zz-page24';
  const pg = await freshPage(browser, U('expense.html'), errs);
  await sleep(200);
  const P0 = await pg.evaluate(P => {
    const q = s => document.querySelector(s);
    const disp = s => getComputedStyle(q(s)).display;
    return {
      label: q('#tripLabel').textContent,
      year: q('#yearSum').textContent,
      pick: disp('#pickCard'), trip: disp('#tripWrap'), foot: disp('#xFoot'), empty: disp('#xEmpty'),
      picks: Array.prototype.map.call(document.querySelectorAll('.trip-pick'), r => r.getAttribute('data-id')),
      keys: Object.keys(localStorage).filter(k => /^tn_/.test(k)).sort()
    };
  });
  ok('A84 本机一台行程也没有：选择器态照样给得出「未编排行程」这一行（不排行程的人也有入口），单趟卡／底栏／整页空态都收着',
    P0.pick === 'block' && P0.trip === 'none' && P0.foot === 'none' && P0.empty === 'none' &&
    P0.picks.length === 1 && P0.picks[0] === 'free' && P0.year === '0.00',
    JSON.stringify(P0));
  /* 造一趟 3 天行程 + 四笔账：老账只带 day、出发前一笔、计划内一笔、多走两天一笔 */
  await pg.evaluate(P => {
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: P, name: '页面趟', startDate: '2026-11-08', days: [{}, {}, {}] }
    ]));
    localStorage.setItem('tn_expense', JSON.stringify([
      { id: 'o1', tripId: P, day: 1, date: '', cents: 1500, cat: '交通', who: '', note: '老账没日期', ts: 1 },
      { id: 'p1', tripId: P, day: 1, date: '2026-11-05', cents: 2000, cat: '其他', who: '我', note: '买装备', ts: 2 },
      { id: 'r1', tripId: P, day: 2, date: '2026-11-09', cents: 4000, cat: '门票', who: '', note: '', ts: 3 },
      { id: 'q1', tripId: P, day: 5, date: '2026-11-12', cents: 3000, cat: '餐饮', who: '', note: '多走的那天', ts: 4 }
    ]));
  }, PG);
  const SEED24 = await pg.evaluate(() => localStorage.getItem('tn_expense'));
  /* 认不出的 trip：绝不拿它建桶（孤儿桶在 localStorage 里是无界攒的） */
  await pg.goto(U('expense.html?trip=zz-nope-404'), { waitUntil: 'domcontentloaded' });
  await sleep(180);
  const U404 = await pg.evaluate(() => ({
    label: document.getElementById('tripLabel').textContent,
    empty: getComputedStyle(document.getElementById('xEmpty')).display,
    foot: getComputedStyle(document.getElementById('xFoot')).display,
    switch_: getComputedStyle(document.getElementById('xSwitchWrap')).display,
    raw: localStorage.getItem('tn_expense')
  }));
  ok('A85 URL 上的 ?trip= 在这台机认不出来：走整页空态＋给「换一趟」，底栏收着，盘上一个字节没动（不拿陌生 id 建桶）',
    U404.label === '没找到这趟行程' && U404.empty === 'block' && U404.foot === 'none' &&
    U404.switch_ === 'block' && U404.raw === SEED24, 'raw变了=' + (U404.raw !== SEED24));

  await pg.goto(U('expense.html?trip=' + PG), { waitUntil: 'domcontentloaded' });
  await sleep(200);
  const T1 = await pg.evaluate(() => {
    const days = Array.prototype.map.call(document.querySelectorAll('.x-day'), d => {
      const h = d.querySelector('.x-dayh');
      return { date: h.querySelector('b').textContent, tag: h.querySelector('em') ? h.querySelector('em').textContent : '', sum: h.querySelector('span').textContent };
    });
    return {
      trip: getComputedStyle(document.getElementById('tripWrap')).display,
      foot: getComputedStyle(document.getElementById('xFoot')).display,
      pick: getComputedStyle(document.getElementById('pickCard')).display,
      label: document.getElementById('tripLabel').textContent,
      days: days,
      hint: document.querySelector('#xDays .x-hint') ? document.querySelector('#xDays .x-hint').textContent : '',
      year: document.getElementById('yearSum').textContent,
      ycount: document.getElementById('yearCount').textContent,
      ynote: document.getElementById('yearNote').textContent,
      bars: Array.prototype.map.call(document.querySelectorAll('.xbars .b'), b => b.innerText.replace(/\s+/g, ' ')),
      count: document.getElementById('xCount').textContent
    };
  });
  ok('A86 进单趟态：单趟卡与底栏出现、选择器收起、标题带上出发日期',
    T1.trip === 'block' && T1.foot === 'block' && T1.pick === 'none' && /出发 2026-11-08/.test(T1.label),
    JSON.stringify([T1.trip, T1.foot, T1.pick, T1.label]));
  ok('A87 按真实日期成行、与排期排了几天无关：倒序四组，标签分别是「计划外／第2天／第1天／出发前」（早于出发≠记错地方）',
    T1.days.length === 4 &&
    T1.days.map(d => d.date).join(',') === '2026-11-12,2026-11-09,2026-11-08,2026-11-05' &&
    T1.days.map(d => d.tag).join(',') === '计划外,第2天,第1天,出发前',
    JSON.stringify(T1.days.map(d => d.date + ':' + d.tag)));
  ok('A88 只带 day 的老账按出发日反推成组（2026-11-08），并在列尾如实说明「重排期会跟着挪天」',
    T1.days[2].date === '2026-11-08' && /1 笔共 15\.00 元没写日期/.test(T1.hint) && /重排期会跟着挪天/.test(T1.hint),
    T1.hint.slice(0, 70));
  ok('A89 今年卡实时反映这一趟（4 笔 105.00），且没有「没写日期」的笔时如实说与排期无关',
    T1.year === '105.00' && T1.ycount === '4 笔' && T1.count.indexOf('105.00') >= 0 &&
    /与「排期排到第几天」无关/.test(T1.ynote) && !/没写日期/.test(T1.ynote),
    JSON.stringify([T1.year, T1.ycount, T1.count, T1.ynote.slice(0, 40)]));
  ok('A90 分类条形图六类固定顺序占位（零钱的分类也占一行，看着才像「确实没花在这一类」而不是漏了一类）',
    T1.bars.length === 6 && /餐饮 30\.00/.test(T1.bars.join(' | ')) && /交通 15\.00/.test(T1.bars.join(' | ')),
    T1.bars.join(' / '));

  /* 预算：50 元 → 进度条顶满 + 改判超支（带 warn 图标） */
  await pg.evaluate(() => {
    var b = document.getElementById('xBud');
    b.focus(); b.value = '50';
    b.dispatchEvent(new Event('change'));
  });
  await sleep(200);
  const BUD = await pg.evaluate(() => ({
    w: document.getElementById('xBar').style.width,
    over: document.getElementById('xOver').textContent,
    cls: document.querySelector('#xOver .x-over') ? document.querySelector('#xOver .x-over').className : '',
    svg: document.querySelectorAll('#xOver svg').length,
    stored: localStorage.getItem('tn_budget')
  }));
  ok('A91 预算设 50 元：进度条顶到 100%、改判「已超预算 55.00 元」并挂 warn（不是默默变红），预算进账本是整数分',
    BUD.w === '100%' && /已超预算 55\.00 元/.test(BUD.over) && /warn/.test(BUD.cls) && BUD.svg >= 1 &&
    JSON.parse(BUD.stored)['zz-page24'] === 5000,
    JSON.stringify(BUD));

  /* 记一笔：弹层结构由 UI.sheet 单点补齐（页面没写 data-sheet-x，X 该由单点注入） */
  await pg.click('#fAdd'); await sleep(350);
  const SH = await pg.evaluate(() => {
    const s = document.getElementById('addSheet');
    return {
      disp: getComputedStyle(s).display, role: s.getAttribute('role'),
      modal: s.getAttribute('aria-modal'), label: s.getAttribute('aria-label'),
      x: s.querySelectorAll('.ui-sheet-x').length,
      own: s.getAttribute('data-sheet-x'),
      chips: Array.prototype.map.call(document.querySelectorAll('#adCats .chip'), c => c.textContent + (c.className.indexOf('on') >= 0 ? '*' : '')),
      date: document.getElementById('adDate').value,
      hint: document.getElementById('adHint').textContent
    };
  });
  ok('A92 记一笔弹层走 UI.sheet 单点：role=dialog + aria-modal + 右上角 X 由单点注入一枚（页面没自行认领关闭控件）',
    SH.disp === 'block' && SH.role === 'dialog' && SH.modal === 'true' && SH.label === '记一笔开销' &&
    SH.x === 1 && SH.own === null, JSON.stringify(SH));
  ok('A93 弹层里六枚分类 chip、只有默认那一枚选中（选中态是「餐饮」），日期默认今天——这一屏不需要先懂「第几天」也能记',
    SH.chips.length === 6 && SH.chips.filter(c => /\*$/.test(c)).join('') === '餐饮*',
    SH.chips.join(',') + ' / 日期=' + SH.date);

  await pg.type('#adAmt', '38.5');
  await pg.click('#adSave'); await sleep(350);
  const ADD = await pg.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('tn_expense'));
    const it = l[l.length - 1];
    return {
      disp: getComputedStyle(document.getElementById('addSheet')).display,
      it: it, n: l.length,
      year: document.getElementById('yearSum').textContent,
      ycount: document.getElementById('yearCount').textContent,
      count: document.getElementById('xCount').textContent,
      dates: Array.prototype.map.call(document.querySelectorAll('.x-dayh b'), b => b.textContent)
    };
  });
  ok('A94 记上一笔 38.5 元：落盘是整数分 3850 + 真实日期就是表单里那天（date 才是权威，day 只是对齐锚）',
    ADD.n === 5 && ADD.it.cents === 3850 && /^\d{4}-\d{2}-\d{2}$/.test(ADD.it.date) &&
    ADD.it.tripId === 'zz-page24' && ADD.it.cat === '餐饮', JSON.stringify(ADD.it));
  ok('A95 记完弹层收起、按日期那一列立刻多出一行、顶部年总跟着走（停在 0.00 就是「这页没记住」）',
    ADD.disp === 'none' && ADD.dates.length === 5 && ADD.year === '143.50' &&
    ADD.ycount === '5 笔' && /143\.50/.test(ADD.count),
    JSON.stringify([ADD.disp, ADD.dates.length, ADD.year, ADD.ycount, ADD.count]));

  /* 删除：必须走 UI.confirm，原生 confirm 一次都不许被调 */
  const NAT0 = await pg.evaluate(() => window.__native);
  await pg.click('.x-row .del[data-id="r1"]'); await sleep(300);
  const MODAL = await pg.evaluate(() => {
    const m = document.querySelector('.ui-modal-mask .ui-modal');
    return m ? { label: m.getAttribute('aria-label'), text: m.querySelector('.ui-modal-text').textContent,
      ok: m.querySelector('.ui-btn-primary').textContent } : null;
  });
  await pg.click('.ui-modal-mask .ui-btn-primary'); await sleep(300);
  const DELP = await pg.evaluate(() => ({
    ids: JSON.parse(localStorage.getItem('tn_expense')).map(x => x.id).join(','),
    year: document.getElementById('yearSum').textContent,
    rows: document.querySelectorAll('.x-row').length,
    native: window.__native
  }));
  ok('A96 删除这一笔走 UI.confirm（原生 confirm 全程 0 次），文案如实说「删了就找不回来」，确认钮写着「删除」',
    !!MODAL && MODAL.label === '删除这笔' && /删了就找不回来/.test(MODAL.text) && MODAL.ok === '删除' &&
    NAT0 === 0 && DELP.native === 0, JSON.stringify(MODAL) + ' native=' + DELP.native);
  ok('A97 删完这一笔：账本里没 r1 了、按日期少一行、年总跟着减 40.00（三处读数必须来自同一份账）',
    DELP.ids.indexOf('r1') < 0 && DELP.rows === 4 && DELP.year === '103.50',
    JSON.stringify([DELP.ids, DELP.rows, DELP.year]));

  /* Esc 关闭：UI.sheet 单点的职责，但只有真页面上才验得出「这一页确实把弹层交给了单点」 */
  await pg.click('#fAdd'); await sleep(350);
  await pg.keyboard.press('Escape'); await sleep(300);
  const ESC = await pg.evaluate(() => ({
    disp: getComputedStyle(document.getElementById('addSheet')).display,
    expanded: (document.querySelector('#fAdd') || {}).getAttribute ? document.querySelector('#fAdd').getAttribute('aria-expanded') : null
  }));
  ok('A98 Esc 能关掉记一笔（弹层交给了 UI.sheet 单点，不是页面自己 classList 一塞了之），开过的触发元素 aria-expanded 已回收',
    ESC.disp === 'none' && ESC.expanded !== 'true', JSON.stringify(ESC));

  /* CSV：浏览器走 Blob 腿；文件名带行程名，日期列是每笔自己那个真实日期 */
  await pg.click('#fCsv'); await sleep(300);
  const CSVP = await pg.evaluate(async () => {
    const b = window.__cap[window.__cap.length - 1];
    const txt = b ? await new Response(b).text() : '';
    return { dl: window.__dl.slice(-1)[0] || '', txt: txt };
  });
  ok('A99 导出 CSV 走 Blob 腿：文件名是「页面趟-开销.csv」，日期列优先条目自带的真实日期（2026-11-12 那一笔不再写成计划第几天）',
    CSVP.dl === '页面趟-开销.csv' && /日期,第几天,分类,金额\(元\),垫付人,备注/.test(CSVP.txt) &&
    /^2026-11-12,第5天,餐饮,30\.00,/m.test(CSVP.txt) && /合计,103\.50/.test(CSVP.txt),
    CSVP.dl + ' | ' + CSVP.txt.replace(/^﻿/, '').split('\r\n').slice(0, 3).join(' ⏎ ').slice(0, 150));

  /* 未编排行程桶：这一页最短路径（本机零行程也能记） */
  await pg.goto(U('expense.html'), { waitUntil: 'domcontentloaded' }); await sleep(200);
  await pg.click('.trip-pick[data-id="free"]'); await sleep(200);
  const FSTATE = await pg.evaluate(() => ({
    label: document.getElementById('tripLabel').textContent,
    url: location.search,
    hint: (document.querySelector('#xNone') || {}).textContent || ''
  }));
  ok('A100 点「未编排行程」直接进单趟态：标题写着桶名、URL 带上 trip=free、空桶提示明说不用先排行程',
    FSTATE.label === '未编排行程' && FSTATE.url === '?trip=free' &&
    /不用先排行程/.test(FSTATE.hint), JSON.stringify(FSTATE));
  await pg.click('#fAdd'); await sleep(350);
  const FHINT = await pg.evaluate(() => document.getElementById('adHint').textContent);
  await pg.type('#adAmt', '20');
  await pg.click('#adSave'); await sleep(350);
  const FREE = await pg.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('tn_expense'));
    return { last: l[l.length - 1], year: document.getElementById('yearSum').textContent,
      ycount: document.getElementById('yearCount').textContent };
  });
  ok('A101 没排行程的人在这一页记上第 N 笔：落进 free 桶、带着今天的真实日期，年总把两桶一起算（103.50 + 20.00）',
    FREE.last.tripId === 'free' && FREE.last.cents === 2000 && /^\d{4}-\d{2}-\d{2}$/.test(FREE.last.date) &&
    /没有行程也能记/.test(FHINT) && FREE.year === '123.50' && FREE.ycount === '5 笔',
    JSON.stringify([FREE.last, FREE.year, FREE.ycount, FHINT.slice(0, 30)]));
  /* 反推不出日期的笔不进任何年份，但页面上必须如实报有多少（宁可少算，少算要看得见） */
  await pg.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('tn_expense'));
    l.push({ id: 'z1', tripId: 'free', day: 2, date: '', cents: 7700, cat: '购物', who: '', note: '忘了哪天', ts: 9 });
    localStorage.setItem('tn_expense', JSON.stringify(l));
  });
  await pg.goto(U('expense.html'), { waitUntil: 'domcontentloaded' }); await sleep(200);
  const UNP = await pg.evaluate(() => ({
    year: document.getElementById('yearSum').textContent,
    note: document.getElementById('yearNote').textContent,
    und: Array.prototype.map.call(document.querySelectorAll('.x-dayh b'), b => b.textContent)
  }));
  ok('A102 年总不拿记账那天冒充花钱那天：那笔没日期的 free 账不进年份（123.50 不动），但年卡如实报「1 笔共 77.00 元没写日期」',
    UNP.year === '123.50' && /1 笔共 77\.00 元没写日期/.test(UNP.note),
    JSON.stringify([UNP.year, UNP.note.slice(0, 60)]));

  /* 真机主档 328×723：横向零溢出，触控目标除共享顶栏返回键外不小于 44px */
  await pg.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  await pg.goto(U('expense.html?trip=' + PG), { waitUntil: 'domcontentloaded' }); await sleep(250);
  await pg.click('#fAdd'); await sleep(400);
  const GEOP = await pg.evaluate(() => {
    const de = document.documentElement;
    const over = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if (r.right > de.clientWidth + 1 || r.left < -1) over.push((el.id || el.className) + '@' + Math.round(r.right));
    });
    /* 44px 只审这一页自己的控件：顶栏那枚 40px 返回键与圆钮是全站同一个 .topbar，
       要改是全站一起改（不在这批顺手改一个页面造成两种顶栏），这里单独读数、单独断言。 */
    const own = [];
    document.querySelectorAll('.wrap button, .wrap input, #xFoot button, #addSheet button, #addSheet input, #addSheet .chip').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) own.push((el.id || el.className) + '=' + Math.round(r.height));
    });
    const tb = [];
    document.querySelectorAll('.topbar button, .topbar a').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) tb.push(Math.round(r.height));
    });
    const s = document.getElementById('addSheet').getBoundingClientRect();
    return { sw: de.scrollWidth, cw: de.clientWidth, over: over.slice(0, 6), own: own.slice(0, 6), tb: tb,
      sheetTop: Math.round(s.top), sheetBottom: Math.round(s.bottom), vh: window.innerHeight };
  });
  ok('A103 真机主档 328×723：记一笔弹层升起后横向零溢出、弹层不越出视口（顶满到屏外＝按不到「记上」）',
    GEOP.sw === GEOP.cw && GEOP.over.length === 0 && GEOP.sheetTop >= 0 && GEOP.sheetBottom <= GEOP.vh + 1,
    JSON.stringify(GEOP));
  ok('A104 这一页自己的控件在 328 档没有一个矮于 44px（金额框 56 / chip 与钮 44 是设计口径；顶栏仍是全站同一个 40 圆钮，不在这页私改）',
    GEOP.own.length === 0 && GEOP.tb.join(',') === '40,40', JSON.stringify([GEOP.own, GEOP.tb]));

  /* ================= 批次 24-C：随手记面板顶部的「记开销」档（行中入口） =================
     这一档新不新不重要，重要的是两件事：默认档一点没被动过（A105/A107/A112），
     以及站在这个点上花钱的人真的能把这笔钱按真实日期记上（A109/A110/A111）。
     表单实现与 expense.html 同源（expense-form.js），金额算法那边已经审过，这里审的是面板这一屏。 */
  const padC = n => (n < 10 ? '0' : '') + n;
  const isoC = d => d.getFullYear() + '-' + padC(d.getMonth() + 1) + '-' + padC(d.getDate());
  const TODAY = isoC(new Date()), YEST = isoC(new Date(Date.now() - 86400000)), FUT = isoC(new Date(Date.now() + 20 * 86400000));
  const tp = await freshPage(browser, U('index.html'), errs);
  /* 首启引导蒙层（index.html 的 .ob-mask，z-index 9990）盖在面板（9001）上面：freshPage 清了 LS，
     于是引导每次都从头放，真鼠标点击全打在蒙层上。真机用户走完引导就没这一层了，所以判据得先站到
     「引导已看过」这个状态——这不是产品缺陷，是取样口径。 */
  await tp.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await tp.reload({ waitUntil: 'domcontentloaded' });
  await tp.evaluate(seed => {
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: 'zz-live', name: '进行中趟', startDate: seed.yest, logStart: seed.yest, realDays: 3, days: [{}, {}, {}] },
      { id: 'zz-later', name: '以后的趟', startDate: seed.fut, days: [{}, {}] }
    ]));
  }, { yest: YEST, fut: FUT });

  const C0 = await tp.evaluate(async function () {
    const q = s => document.querySelector(s);
    TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' });
    await new Promise(r => setTimeout(r, 400));
    const panel = q('.tn-panel');
    return {
      opened: panel.style.display,
      hasExp: panel.classList.contains('has-exp'),
      seg: getComputedStyle(q('.tn-seg')).display,
      /* 录音三屏状态机只有 is-idle/is-done/is-editing 三个类；is-expense 是这一批新加的「档位」类，
         切档必然带上它，所以从状态机读数里剔出去——否则这条判据等于自己判自己红。 */
      sm: panel.className.split(/\s+/).filter(c => /^is-/.test(c) && c !== 'is-expense').sort().join(','),
      expCls: panel.classList.contains('is-expense'),
      notePressed: q('#tnTabNote').getAttribute('aria-pressed'),
      body: getComputedStyle(q('.tn-body')).display,
      segH: Array.prototype.map.call(q('.tn-seg').querySelectorAll('button'), b => Math.round(b.getBoundingClientRect().height))
    };
  });
  ok('A105 默认档没被这一批改动：面板开在「记此刻」（无 is-expense、录音屏照旧可见、aria-pressed 落在记此刻）',
    C0.opened === 'flex' && C0.hasExp && C0.seg === 'flex' && !C0.expCls &&
    C0.notePressed === 'true' && C0.body === 'flex', JSON.stringify(C0));
  ok('A106 两条档位钮各 44px（面板顶上的东西要用拇指点得中，不是给鼠标 hover 的）',
    C0.segH.join(',') === '44,44', C0.segH.join(','));

  const C1 = await tp.evaluate(async function () {
    const q = s => document.querySelector(s);
    q('#tnTabExp').click();
    await new Promise(r => setTimeout(r, 350));
    const panel = q('.tn-panel');
    return {
      sm: panel.className.split(/\s+/).filter(c => /^is-/.test(c) && c !== 'is-expense').sort().join(','),
      expDisp: getComputedStyle(q('.tn-expense')).display,
      body: getComputedStyle(q('.tn-body')).display,
      foot: getComputedStyle(q('.tn-foot')).display,
      pressed: q('#tnTabExp').getAttribute('aria-pressed'),
      pick: q('#tnExpPick').textContent,
      expanded: q('#tnExpPick').getAttribute('aria-expanded'),
      listDisp: q('#tnExpList').style.display,
      chips: Array.prototype.map.call(q('#tnExpForm').querySelectorAll('.chip'), c => c.textContent + (c.classList.contains('on') ? '*' : '')),
      date: q('#adDate').value,
      hint: q('#adHint').textContent,
      today: q('#tnExpToday').textContent,
      link: q('#tnExpToday a') ? q('#tnExpToday a').getAttribute('href') : '',
      amtH: Math.round(q('#adAmt').getBoundingClientRect().height),
      focus: document.activeElement ? document.activeElement.id : ''
    };
  });
  ok('A107 切档只做显隐：录音那三屏状态机的类一位没动（is-idle 还在），只是 body/foot 收起、这一屏放出',
    C1.sm === C0.sm && C1.expDisp === 'block' && C1.body === 'none' && C1.foot === 'none' && C1.pressed === 'true',
    JSON.stringify([C0.sm, C1.sm, C1.expDisp, C1.body, C1.foot]));
  ok('A108 进行中自动落到那一趟：不用先选行程也不用先懂「第几天」，日期默认就是今天，说明行按 logStart 说真话（昨天出发 → 今天第 2 天），列表保持收起',
    /进行中趟/.test(C1.pick) && C1.expanded === 'false' && C1.listDisp === 'none' && C1.date === TODAY &&
    /第 2 天/.test(C1.hint),
    JSON.stringify([C1.pick, C1.date, C1.hint]));
  ok('A109 表单是同一份实现（六枚分类同 Expense.CATS、默认选中「餐饮」、金额框 56px、焦点落在金额）',
    C1.chips.join(',') === '交通,住宿,餐饮*,门票,购物,其他' && C1.amtH === 56 && C1.focus === 'adAmt',
    JSON.stringify([C1.chips, C1.amtH, C1.focus]));
  ok('A110 今日读数与这趟读数是两条真话：还没记时明说「还没记账」，出口链到 expense.html?trip=这一趟',
    /今天 还没记账/.test(C1.today) && /这趟共 0\.00 元/.test(C1.today) &&
    C1.link === 'expense.html?trip=zz-live', JSON.stringify([C1.today, C1.link]));

  await tp.type('#adAmt', '66.6');
  await tp.click('#adSave'); await sleep(350);
  const C2 = await tp.evaluate(function () {
    const q = s => document.querySelector(s);
    const l = JSON.parse(localStorage.getItem('tn_expense') || '[]');
    return {
      it: l[l.length - 1], n: l.length,
      today: q('#tnExpToday').textContent,
      amt: q('#adAmt').value, date: q('#adDate').value,
      expCls: q('.tn-panel').classList.contains('is-expense'),
      toast: q('.ui-toast') ? q('.ui-toast').textContent : ''
    };
  });
  ok('A111 在面板里记上这一笔：落盘整数分 6660 + 真实日期就是今天 + 桶是进行中那趟（date 权威，day 只是对齐锚）',
    C2.n === 1 && C2.it.cents === 6660 && C2.it.tripId === 'zz-live' && C2.it.date === TODAY && C2.it.day === 2 && C2.it.cat === '餐饮',
    JSON.stringify(C2.it));
  ok('A112 记完不关面板、金额清空而日期停在刚那一笔（行中连着花三笔是常态，每笔重选日期就会漏记），今日读数当场跟着走',
    C2.expCls && C2.amt === '' && C2.date === TODAY &&
    /今天 已花 66\.60 元 · 1 笔/.test(C2.today) && /这趟共 66\.60 元/.test(C2.today),
    JSON.stringify([C2.amt, C2.date, C2.today]));

  const C3 = await tp.evaluate(async function () {
    const q = s => document.querySelector(s);
    q('#tnExpPick').click();
    await new Promise(r => setTimeout(r, 200));
    /* 摊开那一刻的读数要当场取：选完桶之后列表自己收回去，最后再读 aria-expanded 只会读到 'false' */
    const expanded = q('#tnExpPick').getAttribute('aria-expanded');
    const rows = Array.prototype.map.call(q('#tnExpList').querySelectorAll('button'), b => b.textContent);
    Array.prototype.filter.call(q('#tnExpList').querySelectorAll('button'), b => b.getAttribute('data-id') === 'free')[0].click();
    await new Promise(r => setTimeout(r, 250));
    q('#adAmt').value = '20';
    q('#adSave').click();
    await new Promise(r => setTimeout(r, 250));
    const l = JSON.parse(localStorage.getItem('tn_expense') || '[]');
    return {
      expanded: expanded, rows: rows,
      pick: q('#tnExpPick').textContent, listDisp: q('#tnExpList').style.display,
      hint: q('#adHint').textContent, today: q('#tnExpToday').textContent,
      buckets: l.map(x => x.tripId + '/' + x.cents + '/' + x.date)
    };
  });
  ok('A113 「记到」那一行摊开就是全部桶：每一趟 + 「未编排行程」常驻在最后（没排行程的人这一档照样能用）',
    C3.expanded === 'true' && C3.rows.length === 3 && /未编排行程/.test(C3.rows[2]) && /进行中趟/.test(C3.rows[0]),
    JSON.stringify(C3.rows));
  ok('A114 换桶把说明行与读数一起改口：free 桶不说「这趟」，第二笔落进 free 且带着同一天的真实日期',
    C3.listDisp === 'none' && /未编排行程/.test(C3.pick) && /没有行程也能记/.test(C3.hint) &&
    /这一桶共/.test(C3.today) && C3.buckets.join(',') === 'zz-live/6660/' + TODAY + ',free/2000/' + TODAY,
    JSON.stringify([C3.pick, C3.hint.slice(0, 40), C3.today, C3.buckets]));

  const C4 = await tp.evaluate(async function () {
    const q = s => document.querySelector(s);
    q('#tnTabNote').click();
    await new Promise(r => setTimeout(r, 200));
    const back = { expCls: q('.tn-panel').classList.contains('is-expense'), body: getComputedStyle(q('.tn-body')).display };
    q('#tnX').click();
    await new Promise(r => setTimeout(r, 250));
    TravelNotes.openPanel({ label: '第二次开', lat: 0, lng: 0, city: 'test' });
    await new Promise(r => setTimeout(r, 350));
    const reopened = {
      expCls: q('.tn-panel').classList.contains('is-expense'),
      notePressed: q('#tnTabNote').getAttribute('aria-pressed'),
      listDisp: q('#tnExpList').style.display
    };
    q('#tnTabExp').click();
    await new Promise(r => setTimeout(r, 300));
    return { back: back, reopened: reopened, pick: q('#tnExpPick').textContent };
  });
  ok('A115 切回「记此刻」立刻恢复录音屏；关掉再重开回到默认档，桶也重新按进行中推断（上一次手选的「未编排行程」不接走这一趟的钱）',
    !C4.back.expCls && C4.back.body === 'flex' && !C4.reopened.expCls &&
    C4.reopened.notePressed === 'true' && C4.reopened.listDisp === 'none' && /进行中趟/.test(C4.pick),
    JSON.stringify(C4));
  await tp.evaluate(() => { document.querySelector('#tnX').click(); });

  /* 门控的反证：没载 expense.js 的页面（专题页）不该出现一条点了没反应的分段控件 */
  const tq = await freshPage(browser, U('topic.html'), errs);
  const GT = await tq.evaluate(async function () {
    const q = s => document.querySelector(s);
    TravelNotes.openPanel({ label: '测试点', lat: 0, lng: 0, city: 'test' });
    await new Promise(r => setTimeout(r, 400));
    const seg = q('.tn-seg');
    return {
      noExpense: typeof window.Expense === 'undefined' && typeof window.ExpenseForm === 'undefined',
      hasExp: q('.tn-panel').classList.contains('has-exp'),
      segDisp: seg ? getComputedStyle(seg).display : 'no seg',
      noteOk: !!q('#tnNow') && getComputedStyle(q('.tn-body')).display === 'flex'
    };
  });
  ok('A116 门控：这一页没载 expense.js 时 has-exp 不打上、分段控件整条不出现（宁可少一个入口，也不留一个点了没反应的按钮）',
    GT.noExpense && !GT.hasExp && GT.segDisp === 'none' && GT.noteOk, JSON.stringify(GT));
  await tq.close();

  /* 真机主档 328×723：这一档自己的控件全过 44px，且开销屏不横向溢出 */
  await tp.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  const GEO24 = await tp.evaluate(async function () {
    const q = s => document.querySelector(s);
    TravelNotes.openPanel({ label: '窄屏点', lat: 0, lng: 0, city: 'test' });
    await new Promise(r => setTimeout(r, 300));
    q('#tnTabExp').click();
    await new Promise(r => setTimeout(r, 400));
    q('#tnExpPick').click();
    await new Promise(r => setTimeout(r, 200));
    const de = document.documentElement, low = [], over = [];
    document.querySelectorAll('#tnTabNote,#tnTabExp,#tnExpPick,#tnExpList button,#tnExpense button,#tnExpense input,#tnExpense .chip').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) low.push((el.id || el.className) + '=' + Math.round(r.height));
      if (r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1)) over.push((el.id || el.className) + '@' + Math.round(r.right));
    });
    const p = q('.tn-panel').getBoundingClientRect();
    return { sw: de.scrollWidth, cw: de.clientWidth, low: low.slice(0, 6), over: over.slice(0, 6),
      panelTop: Math.round(p.top), panelBottom: Math.round(p.bottom), vh: window.innerHeight,
      saveVisible: q('#adSave').getBoundingClientRect().top < window.innerHeight };
  });
  ok('A117 真机主档 328×723：这一档自己的控件没有一个矮于 44px，行程列表摊开也不横向溢出',
    GEO24.low.length === 0 && GEO24.over.length === 0 && GEO24.sw === GEO24.cw, JSON.stringify(GEO24));
  ok('A118 窄屏下「记上」那一钮仍在视口内（面板顶满到屏外＝记不上这笔）',
    GEO24.panelTop >= 0 && GEO24.panelBottom <= GEO24.vh + 1 && GEO24.saveVisible,
    JSON.stringify([GEO24.panelTop, GEO24.panelBottom, GEO24.vh, GEO24.saveVisible]));
  await tp.evaluate(() => { try { localStorage.removeItem('tn_expense'); localStorage.removeItem('tn_trips'); } catch (e) {} });
  await tp.close();

  await pg.evaluate(() => { try { localStorage.removeItem('tn_expense'); localStorage.removeItem('tn_budget'); localStorage.removeItem('tn_trips'); } catch (e) {} });
  await pg.evaluate(o => { localStorage.setItem('tn_expense', o.exp); localStorage.setItem('tn_budget', o.bud); }, { exp: RAW24, bud: RAWB24 });

  ok('A62 全程零页面报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  ok('A63 全程零原生 confirm/alert（所有破坏性操作都走 UI.confirm）',
    await page.evaluate(() => window.__native) === 0, String(await page.evaluate(() => window.__native)));

  await browser.close();
  console.log(fails ? '=== ' + fails + ' 条 FAIL ===' : '=== SMOKE EXPENSE ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CRASH: ' + e.stack); process.exit(1); });
