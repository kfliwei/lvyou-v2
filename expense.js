/* =========================================================
 * expense.js — 旅行开销记账（按行程分桶，做事后记账，不做行程前估算）
 * 存储：localStorage
 *   'tn_expense' = [{ id, tripId, day(1 起), date('YYYY-MM-DD' 或 ''), cents, cat, who, note, ts }]
 *   'tn_budget'  = { [tripId]: cents }
 *
 * 为什么「date 是权威、day 只是对齐锚」（批次 24 的地基）：
 *   用户把排期当参考，实际路线与天数常常和计划完全不同。钱一旦只挂「第几天」，
 *   那么「重新排期 / 上下移站点 / 换出行档」这条重切分链就会把 D3 的那笔悄悄搬进新的 D3——
 *   一分不丢，但归错了天，而且界面上零提示。所以条目自带真实日期，按天汇总与 CSV 以 date 为准；
 *   day 只留给「按计划看」的日卡视图当对齐锚。旧账（批次 19 那批没有 date 的）用 startDate+(day-1)
 *   在**读取时**反推，反推不出就留空进「日期未知」组——绝不拿 ts 冒充花钱那天，ts 是记账动作的时刻。
 *
 * 为什么金额存「整数分」而不是「元」：
 *   0.1 在二进制浮点里存不住。三笔 33.33 / 33.33 / 33.34 相加得到的是
 *   100.00000000000001，再 toFixed(2) 就把误差藏进了「看上去对」的读数里——
 *   而对账这件事的本质就是复算，用户下次按计算器还是不平。
 *   所以浮点只许在录入那一刻进账本（add / setBudget 各一处 Math.round(元*100)），
 *   此后求和、比较、超预算全部整数域，只有输出时才除回 100。
 *
 * id 为什么不像 checklist.js 那样由 tripId+text 散列：
 *   同一天、同分类、同金额的两笔是**两笔真实开销**，散列会把第二笔并掉，那是丢钱。
 *   所以 id 是本机此刻生成的唯一号；backup 的 m:'id' 并集只负责跨机不重复搬运。
 *
 * 预算为什么单独一个键、不塞进 trip 对象：
 *   trip 是分享载荷的来源（share.js 走 ALLOWED 白名单），钱是隐私数据，
 *   宁可让它待在自己的键里，也别指望白名单永远不漏。
 * ========================================================= */
window.Expense = (function () {
  var KEY = 'tn_expense';
  var BKEY = 'tn_budget';
  var CATS = ['交通', '住宿', '餐饮', '门票', '购物', '其他'];
  /* 「未编排行程」桶：完全不用规划功能的人也要能记一笔。
     这是 add 那条「没有 tripId 就不落账」的唯一豁免口——豁免的是桶名，不是账本本身。 */
  var FREE_ID = 'free';
  var FREE_NAME = '未编排行程';

  function load() {
    try { var l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，这笔账本次没有记上'); return false; }
  }
  function loadBudget() {
    try { var d = JSON.parse(localStorage.getItem(BKEY) || '{}'); return d && typeof d === 'object' ? d : {}; }
    catch (e) { return {}; }
  }
  /* 唯一号：时间戳 + 本机随机后缀。同一毫秒内连点两次也要分得开。 */
  function uniqId() { return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); }
  function catOf(c) { var i = CATS.indexOf(c); return i >= 0 ? CATS[i] : '其他'; }
  function dayOf(d) { var n = Math.round(Number(d)); return isFinite(n) && n >= 1 ? n : 1; }
  function centsOf(x) { var c = Math.round(Number(x && x.cents)); return isFinite(c) ? c : 0; }
  function sumCents(arr) { var t = 0; for (var i = 0; i < arr.length; i++) t += centsOf(arr[i]); return t; }

  /* ---------- 日期口径（全模块唯一的日期入口） ----------
     判定按形状而不是「能不能 new 出来」：'2026-1-5' 也能解析，但它在字符串序里
     会排到 '2026-11-02' 前面，按天倒序的账单就乱了。只认零补齐的 YYYY-MM-DD。 */
  function isoOf(v) { var s = String(v || ''); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  /* 按「日历日」加减，不用毫秒除法：跨夏令时的那一天会差出 1 小时，毫秒除法在边界上给出 n-1。 */
  function addDays(start, n) {
    var s = isoOf(start); if (!s) return '';
    var d = new Date(s + 'T00:00:00'); if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (Math.round(Number(n)) || 0));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /* 真实日期 → 计划里的第几天；对不上（没出发日期／早于出发）返回 0，由调用方决定怎么办。 */
  function dayFromStart(start, date) {
    var s = isoOf(start), d = isoOf(date);
    if (!s || !d || d < s) return 0;
    var a = new Date(s + 'T00:00:00'), b = new Date(d + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.round((b - a) / 86400000) + 1;
  }
  /* 读视图用的有效日期：条目自带的优先，旧账按 startDate+(day-1) 反推，反推不出留空。
     纯函数、不落盘——账本里没写过的东西，程序不许偷偷替用户写一个日期进去。 */
  function effDate(x, start) {
    var own = isoOf(x && x.date);
    return own || addDays(start, dayOf(x && x.day) - 1);
  }

  /* 金额显示的唯一出口：整数分 → 「100.00」「12.50」「0.00」。
     记账一律两位小数（对账时「100」和「100.00」看着不一样，人会把后者当成缺了一笔）；
     全程整数运算，不碰 toFixed；调用方负责补单位字（" 元"）。 */
  function fmtMoney(cents) {
    var c = centsOf({ cents: cents });
    var sign = c < 0 ? '-' : '', a = Math.abs(c), y = Math.floor(a / 100), f = a % 100;
    return sign + y + '.' + (f < 10 ? '0' : '') + f;
  }

  function listOf(tripId) {
    return load().filter(function (x) { return x && x.tripId === tripId; })
      .sort(function (a, b) { return (a.day - b.day) || (a.ts - b.ts); });
  }
  function daySum(tripId, day) {
    return sumCents(listOf(tripId).filter(function (x) { return x.day === day; }));
  }
  function dayCount(tripId, day) {
    var n = 0;
    listOf(tripId).forEach(function (x) { if (x.day === day) n++; });
    return n;
  }
  function totalCents(tripId) { return sumCents(listOf(tripId)); }
  /* 固定六个分类、固定顺序（CSV 与条形图都靠这个顺序稳定，零钱的分类也照样占一行） */
  function catTotals(tripId) {
    var m = {};
    CATS.forEach(function (c) { m[c] = 0; });
    listOf(tripId).forEach(function (x) { m[catOf(x.cat)] += centsOf(x); });
    return CATS.map(function (c) { return { cat: c, cents: m[c] }; });
  }

  /* ---------- 按真实日期看账（批次 24：入口不再依赖日卡数量） ----------
     分组键是 effDate，与 trip.days 的长度无关：计划 3 天、实际走了 5 天，
     第 4、5 天照样成组（界面上标「计划外」），不需要往行程里补空白天。
     空串（日期未知）在倒序里天然落最后，别把它洗成某个日期去"排整齐"。 */
  function byDate(tripId, start) {
    var g = [], idx = {};
    migrate(listOf(tripId), start).list.forEach(function (x) {
      var d = isoOf(x.date);
      if (!(d in idx)) { idx[d] = g.length; g.push({ date: d, cents: 0, count: 0, items: [] }); }
      var b = g[idx[d]];
      b.cents += centsOf(x); b.count++; b.items.push(x);
    });
    g.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return g;
  }
  /* 重排期前必须问一句的那批：没有 date 的条目会跟着新的 day 走（钱不丢，但归错天）。 */
  function undated(tripId) {
    var n = 0, c = 0;
    listOf(tripId).forEach(function (x) { if (!isoOf(x.date)) { n++; c += centsOf(x); } });
    return { n: n, cents: c };
  }
  /* 「今年已花」这类跨桶合计：反推不出日期的条目不进任何年份——
     宁可少算，也别把去年的账算进今年的年总（少算看得见，多算是对账时才发现的）。 */
  function yearCents(year, tripOf) {
    var y = String(year), c = 0, n = 0;
    load().forEach(function (x) {
      if (!x) return;
      var t = tripOf ? tripOf(x.tripId) : null;
      var d = effDate(x, t && (t.logStart || t.startDate));
      if (d.slice(0, 4) === y) { c += centsOf(x); n++; }
    });
    return { cents: c, count: n };
  }
  /* 进行中判定：实际口径（logStart/realDays）优先于计划口径（startDate/days.length）。
     多趟重叠取最近开始的那趟；判不出返回 null 让调用方落到行程选择器——
     猜错行程等于把钱记到另一趟头上，那比让用户多点一下严重得多。 */
  function activeTripOf(trips, today) {
    var t = isoOf(today) || todayISO(), best = null, bestStart = '';
    (trips || []).forEach(function (tr) {
      if (!tr || !tr.id) return;
      var s = isoOf(tr.logStart) || isoOf(tr.startDate); if (!s) return;
      var n = Math.max(Math.round(Number(tr.realDays)) || 0, (tr.days || []).length);
      if (n < 1) return;
      var e = addDays(s, n - 1);
      if (!e || t < s || t > e) return;
      if (s > bestStart) { bestStart = s; best = tr; }
    });
    return best;
  }
  function activeDayOf(trip, today) {
    if (!trip) return 0;
    return dayFromStart(isoOf(trip.logStart) || isoOf(trip.startDate), isoOf(today) || todayISO());
  }

  /* date 是第 7 个参数且可省：日卡流（按计划记）传计划日期，行中流（FAB／记账页）传今天。
     day 与 date 谁给谁对齐由调用方负责——本模块只保证存进去的两样各自形状合法。 */
  /* 迁移：给一份账目按 startDate+(day-1) 补齐 date。**纯内存、不落盘**——
     旧版本读到这份数据仍然完整（多一个字段无害），而替用户写一个他没记过的日期进账本，
     是对账时发现「这笔我什么时候花的」最坏的一种。幂等：已有 date 的条目原样返回，
     跑第二遍一个字节也不动。 */
  function migrate(list, start) {
    var out = [], filled = 0;
    (list || []).forEach(function (x) {
      if (!x) return;
      if (isoOf(x.date)) { out.push(x); return; }
      var d = effDate(x, start);
      if (!d) { out.push(x); return; }
      var copy = {};
      Object.keys(x).forEach(function (k) { copy[k] = x[k]; });
      copy.date = d; out.push(copy); filled++;
    });
    return { list: out, filled: filled };
  }

  function add(tripId, day, yuan, cat, who, note, date) {
    if (!tripId) return null;
    var n = Number(yuan);
    if (!isFinite(n) || n <= 0) return null;
    /* 元 → 分：账本唯一的浮点入口 */
    var cents = Math.round(n * 100);
    var list = load();
    var it = {
      id: uniqId(), tripId: tripId, day: dayOf(day), date: isoOf(date), cents: cents, cat: catOf(cat),
      who: String(who || '').trim().slice(0, 20), note: String(note || '').trim().slice(0, 60),
      ts: Date.now()
    };
    list.push(it);
    return save(list) ? it : null;
  }
  function remove(tripId, id) {
    var list = load(), hit = null;
    var keep = list.filter(function (x) {
      if (x.id === id && x.tripId === tripId) { hit = x; return false; }
      return true;
    });
    if (!hit) return null;
    return save(keep) ? hit : null;
  }
  /* 行程删除时调用：账目跟着行程走，否则孤儿桶无界攒在 localStorage 里 */
  function clearTrip(tripId) {
    if (!tripId) return 0;
    var list = load(), keep = list.filter(function (x) { return x.tripId !== tripId; });
    var n = list.length - keep.length;
    if (n) save(keep);
    var bd = loadBudget();
    if (Object.prototype.hasOwnProperty.call(bd, tripId)) {
      delete bd[tripId];
      try { localStorage.setItem(BKEY, JSON.stringify(bd)); } catch (e) {}
    }
    return n;
  }

  function budgetOf(tripId) {
    var c = Math.round(Number(loadBudget()[tripId]));
    return isFinite(c) && c > 0 ? c : 0;
  }
  function setBudget(tripId, yuan) {
    if (!tripId) return 0;
    var n = Number(yuan);
    /* 预算同样只在这一处从浮点进整数域；清空（0 或负数）＝删键，不留 0 分档 */
    var cents = (!isFinite(n) || n <= 0) ? 0 : Math.round(n * 100);
    var d = loadBudget();
    if (cents) d[tripId] = cents; else delete d[tripId];
    try { localStorage.setItem(BKEY, JSON.stringify(d)); } catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，预算这次没存上'); }
    return cents;
  }
  function overCents(tripId) {
    var b = budgetOf(tripId);
    if (!b) return 0;
    var t = totalCents(tripId);
    return t > b ? t - b : 0;
  }

  /* ---------- CSV ----------
     转义纪律与 ICS 同源：凡是可能带分隔符的字段一律保守处理。
     RFC 4180 只认半角逗号做分隔符，所以中文「，」不需要引号，但英文逗号、
     引号、换行需要——判定按这三个字符，不按「看着像不像」。 */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvRow(arr) { return arr.map(csvCell).join(','); }
  function buildCsv(tripId, opts) {
    var o = opts || {};
    var name = String(o.name || '行程');
    var dateOf = typeof o.dateOf === 'function' ? o.dateOf : function () { return ''; };
    var rows = listOf(tripId);
    var L = ['开销记账 - ' + name, csvRow(['日期', '第几天', '分类', '金额(元)', '垫付人', '备注'])];
    rows.forEach(function (x) {
      /* 日期列优先条目自带的真实日期，回落到「计划第几天算出来的那天」：
         旧账（批次 19 那批只有 day 的）导出来跟以前一模一样，新账不再拿计划日期冒充实际。 */
      L.push(csvRow([isoOf(x.date) || dateOf(x.day), '第' + x.day + '天', x.cat, fmtMoney(x.cents), x.who || '', x.note || '']));
    });
    L.push('');
    L.push(csvRow(['分类小计', '金额(元)']));
    catTotals(tripId).forEach(function (c) { L.push(csvRow([c.cat, fmtMoney(c.cents)])); });
    var total = totalCents(tripId), budget = budgetOf(tripId), over = overCents(tripId);
    L.push(csvRow(['合计', fmtMoney(total)]));
    L.push(csvRow(['预算', budget ? fmtMoney(budget) : '未设']));
    if (budget) L.push(csvRow([over ? '超支' : '结余', fmtMoney(over ? over : budget - total)]));
    L.push(csvRow(['笔记条数', rows.length]));
    /* Excel 在 Windows 上按本地代码页猜编码：没有 BOM 的 UTF-8 中文 CSV 会开成一屏乱码 */
    return '\ufeff' + L.join('\r\n') + '\r\n';
  }

  return {
    KEY: KEY, BKEY: BKEY, CATS: CATS, FREE_ID: FREE_ID, FREE_NAME: FREE_NAME,
    fmtMoney: fmtMoney, listOf: listOf, daySum: daySum, dayCount: dayCount,
    totalCents: totalCents, catTotals: catTotals,
    isoOf: isoOf, todayISO: todayISO, addDays: addDays, dayFromStart: dayFromStart, effDate: effDate,
    byDate: byDate, migrate: migrate, undated: undated, yearCents: yearCents,
    activeTripOf: activeTripOf, activeDayOf: activeDayOf,
    add: add, remove: remove, clearTrip: clearTrip,
    budgetOf: budgetOf, setBudget: setBudget, overCents: overCents,
    csvCell: csvCell, buildCsv: buildCsv, uniqId: uniqId
  };
})();
