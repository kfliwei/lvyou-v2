/* =========================================================
 * expense.js — 旅行开销记账（按行程分桶，做事后记账，不做行程前估算）
 * 存储：localStorage
 *   'tn_expense' = [{ id, tripId, day(1 起), cents, cat, who, note, ts }]
 *   'tn_budget'  = { [tripId]: cents }
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

  function add(tripId, day, yuan, cat, who, note) {
    if (!tripId) return null;
    var n = Number(yuan);
    if (!isFinite(n) || n <= 0) return null;
    /* 元 → 分：账本唯一的浮点入口 */
    var cents = Math.round(n * 100);
    var list = load();
    var it = {
      id: uniqId(), tripId: tripId, day: dayOf(day), cents: cents, cat: catOf(cat),
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
      L.push(csvRow([dateOf(x.day), '第' + x.day + '天', x.cat, fmtMoney(x.cents), x.who || '', x.note || '']));
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
    KEY: KEY, BKEY: BKEY, CATS: CATS,
    fmtMoney: fmtMoney, listOf: listOf, daySum: daySum, dayCount: dayCount,
    totalCents: totalCents, catTotals: catTotals,
    add: add, remove: remove, clearTrip: clearTrip,
    budgetOf: budgetOf, setBudget: setBudget, overCents: overCents,
    csvCell: csvCell, buildCsv: buildCsv, uniqId: uniqId
  };
})();
