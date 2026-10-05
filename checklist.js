/* =========================================================
 * checklist.js — 行前清单（按行程分组，勾选态存本机）
 * 存储：localStorage 'tn_checklist' = [{ id, tripId, text, cat, by, done, src, ts }]
 *   by='auto' 由本文件末尾的规则表从内置字段推出，每次同步整组重算；
 *   by='user' 只有用户能增删，重算永不触碰。
 * 为什么存平铺数组、而不是 { tripId: [...] } 的分桶对象：
 *   backup.js 的 m:'id' 是「按条目 id 求并集」，分桶对象只能整桶择优（m:'dict'）——
 *   两台手机各自往同一趟行程补几条，pull 回来会被覆盖掉一半。
 * id 由 tripId+text 散列而来（不是时间戳）：同一趟同一句话在两台机上算出同一个 id，
 *   合并时天然去重，syncAuto 也因此是幂等的。
 * 规则表是「建议」，不是「事实声明」：每条 auto 条目带 src（推导用的原文），
 * UI 必须把 src 印出来；内置字段里没有的（无海拔/无季节原文）就不生成，不猜。
 * ========================================================= */
window.Checklist = (function () {
  var KEY = 'tn_checklist';
  var CATS = ['证件', '衣物', '健康', '装备', '预约', '其他'];
  /* 阈值是规则表的骨架，改动必须同步 tools/verify.js §29 的四条锚点（防「顺手微调」在闸门视野外漂移） */
  var ELEV_HIGH = 3000, ELEV_MID = 2000, ELEV_LOW = 1000;
  var MON_RAIN = [6, 7, 8];
  var MON_COLD = [11, 12, 1, 2, 3];
  var SEASON_MON = { '春': [3, 4, 5], '夏': [6, 7, 8], '秋': [9, 10, 11], '冬': [12, 1, 2] };
  /* 通识四件：不是事实声明，所以 src 一律留空（UI 不给它们印来源后缀） */
  var BASE = [
    { text: '身份证', cat: '证件' },
    { text: '少量现金', cat: '装备' },
    { text: '充电宝', cat: '装备' },
    { text: '常用药', cat: '健康' }
  ];

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，行前清单本次未保存成功'); return false; }
  }
  function ckId(tripId, text) {
    var s = String(tripId) + '|' + String(text), h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'c' + h.toString(36);
  }
  function uniq(a) { var o = {}, r = []; for (var i = 0; i < a.length; i++) if (!o[a[i]]) { o[a[i]] = 1; r.push(a[i]); } return r; }
  function num(x) { var n = Number(x); return isFinite(n) && n > 0 ? n : null; }

  /* best 是自由文本（实测 294 种写法），只认三种能可靠读出的形态：数字月份区间、单月、四季字。
     「全年」= 没有季节信息，返回空集而不是 1..12——否则每个季节规则都会被它点亮。 */
  function monthsOf(best) {
    var s = String(best || '');
    if (!s || s.indexOf('全年') >= 0) return [];
    var out = [], m = s.match(/(\d{1,2})\s*月?\s*(?:-|~|—|至|到)\s*(?:次年)?\s*(\d{1,2})\s*月/);
    if (m) {
      var a = +m[1], b = +m[2];
      if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
        for (var k = a, i = 0; i < 12; i++, k = k % 12 + 1) { out.push(k); if (k === b) break; }
        return uniq(out);
      }
      return [];
    }
    var one = s.match(/(\d{1,2})\s*月/);
    if (one) { var n = +one[1]; return n >= 1 && n <= 12 ? [n] : []; }
    ['春', '夏', '秋', '冬'].forEach(function (w) { if (s.indexOf(w) >= 0) out = out.concat(SEASON_MON[w]); });
    return uniq(out);
  }
  function monthLabel(ms) { return ms.slice().sort(function (a, b) { return a - b; }).join('·') + '月'; }
  function hit(ms, want) { for (var i = 0; i < want.length; i++) if (ms.indexOf(want[i]) >= 0) return true; return false; }

  /* 出行月份：出发日期优先（这才是「你这趟什么时候走」），没填才退回各站最佳季的并集。 */
  function tripMonths(startDate, days) {
    if (startDate && /^\d{4}-\d{2}/.test(startDate)) {
      var sm = +startDate.slice(5, 7);
      if (sm >= 1 && sm <= 12) {
        var n = Math.max(1, days || 1), d = +startDate.slice(8, 10) || 1;
        /* 末日按真实日期算，不是「起始月 + 天数」：7-31 出发玩 3 天会跨进 8 月 */
        var em = new Date(+startDate.slice(0, 4), sm - 1, d + (n - 1)).getMonth() + 1;
        var out = [];
        for (var k = sm, i = 0; i < 12; i++, k = k % 12 + 1) { out.push(k); if (k === em) break; }
        return uniq(out);
      }
    }
    return [];
  }

  /* ---------- 规则表（单点函数，闸门 §29 钉的就是这个形状） ----------
     input = { stops: [{ name }], details: { 站名: { elev, best } }, startDate, days } */
  function autoPlan(input) {
    var stops = (input && input.stops) || [], det = (input && input.details) || {};
    var maxE = null, bests = [], texts = [];
    stops.forEach(function (s) {
      var d = det[s.name];
      if (!d) return;
      var e = num(d.elev);
      if (e != null && (maxE == null || e > maxE)) maxE = e;
      if (d.best && bests.indexOf(d.best) < 0) bests.push(d.best);
    });
    var fact = maxE != null ? '海拔 ' + maxE + ' m' : '';
    var mon = tripMonths(input && input.startDate, input && input.days);
    var from = '出发日期';
    if (!mon.length) {
      mon = [];
      bests.forEach(function (b) { mon = mon.concat(monthsOf(b)); });
      mon = uniq(mon);
      from = '最佳季';
    }
    var season = mon.length ? from + ' ' + monthLabel(mon) : '';
    var src = [fact, season].filter(Boolean).join(' · ');
    function push(text, cat, s) { texts.push({ text: text, cat: cat, src: s || src }); }

    if (maxE != null && maxE >= ELEV_HIGH) {
      push('高原反应药', '健康'); push('便携氧气瓶', '健康');
      push('保温杯', '装备'); push('唇膏面霜（干燥）', '装备');
    } else if (maxE != null && maxE >= ELEV_MID) {
      push('冲锋衣（昼夜温差）', '衣物'); push('防晒 SPF50', '装备');
    }
    if (maxE != null && maxE < ELEV_LOW && hit(mon, MON_RAIN)) push('折叠伞', '装备');
    if (maxE != null && maxE < ELEV_LOW && hit(mon, MON_RAIN)) push('驱蚊液', '健康');
    if (hit(mon, MON_COLD)) {
      push('羽绒/厚外套', '衣物'); push('暖手宝', '装备'); push('防滑鞋', '衣物');
    }
    /* 预约/门票两条不看季节：信号来自内置原文（best 里写「需预约」或票价记录含「预约」），
       种子只有 9 条、best 里只有莫高窟一条提到预约，所以今天绝大多数行程这里不出条目——
       这是数据的真实覆盖度，不为凑条目把「有票价」写成「要预约」。
       只读 SITE_TICKETS_SEED 这一层，不碰 SiteTickets.get：那条高德异步腿会把 syncAuto
       变成「先落一版、过一会儿再落一版」，结果页每次重渲染都可能长回不同的条目。 */
    stops.forEach(function (s) {
      var d = det[s.name] || {};
      var t = window.SITE_TICKETS_SEED && window.SITE_TICKETS_SEED[s.name];
      var upd = t && t.u ? ' · 更新于 ' + t.u : '';
      /* 印出来的「原文」自己就得含触发词：先前是在 p+h 的拼接串上判命中，再挑 p 整串印出去，
         于是只有 h 写着「需预约」的站点，依据一栏显示的是一句票价——建议没错，依据是假的。 */
      var quote = [d.best, t && t.h, t && t.p].filter(function (x) { return x && /预约/.test(x); })[0] || '';
      if (quote) {
        push('「' + s.name + '」预约凭据', '预约', '原文「' + quote + '」' + upd);
      } else if (t && t.p && t.p !== '免费') {
        push('「' + s.name + '」门票', '预约', '票价记录「' + t.p + '」' + upd);
      }
    });
    BASE.forEach(function (b) { texts.push({ text: b.text, cat: b.cat, src: '' }); });
    return texts;
  }

  /* 同步 auto 组：按 id 保留已勾状态，规则不再命中的 auto 条目随站点变化一起消失。
     用户条目原样留下——重算只对自己那一半有所有权。
     prune=false（站点事实还没到齐时调用方必须传）：只生长、不剪枝。
     因为 autoPlan 在「没数据」时只会给出通识四件，此时剪枝等于把上一轮的高原/冬季建议
     连用户勾上的 done 一起删掉，到货后再长回来就是全未勾——刷新一次掉一半进度。 */
  function syncAuto(tripId, input, prune) {
    if (!tripId) return { added: 0, removed: 0 };
    prune = prune !== false;
    var list = load(), doneMap = {}, added = 0, removed = 0;
    list.forEach(function (x) { if (x.tripId === tripId && x.by === 'auto') doneMap[x.id] = x.done; });
    var want = autoPlan(input), ids = {}, fresh = [];
    want.forEach(function (w) {
      var id = ckId(tripId, w.text);
      if (ids[id]) return;
      ids[id] = 1;
      if (!(id in doneMap)) added++;
      fresh.push({ id: id, tripId: tripId, text: w.text, cat: w.cat, by: 'auto', done: doneMap[id] || 0, src: w.src, ts: Date.now() });
    });
    var rest = list.filter(function (x) {
      if (x.tripId !== tripId || x.by !== 'auto') return true;
      if (x.id in ids) return false;
      if (prune) { removed++; return false; }
      return true;
    });
    save(rest.concat(fresh));
    return { added: added, removed: removed };
  }

  function catRank(c) { var i = CATS.indexOf(c); return i < 0 ? CATS.length : i; }
  function listOf(tripId) {
    return load().filter(function (x) { return x.tripId === tripId; })
      .sort(function (a, b) { return catRank(a.cat) - catRank(b.cat) || (a.by === b.by ? a.ts - b.ts : (a.by === 'auto' ? -1 : 1)); });
  }
  function statsOf(tripId) {
    var l = listOf(tripId), done = 0;
    l.forEach(function (x) { if (x.done) done++; });
    return { total: l.length, done: done };
  }
  function add(tripId, text, cat) {
    var t = String(text || '').trim();
    if (!tripId || !t) return null;
    var list = load(), id = ckId(tripId, t);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    var it = { id: id, tripId: tripId, text: t, cat: CATS.indexOf(cat) >= 0 ? cat : '其他', by: 'user', done: 0, src: '', ts: Date.now() };
    list.push(it); save(list);
    return it;
  }
  function toggle(tripId, id) {
    var list = load(), hitItem = null;
    list.forEach(function (x) { if (x.id === id && x.tripId === tripId) { x.done = x.done ? 0 : 1; hitItem = x; } });
    if (!hitItem) return null;
    save(list);
    return hitItem;
  }
  function remove(tripId, id) {
    var list = load();
    save(list.filter(function (x) { return !(x.id === id && x.tripId === tripId); }));
  }
  /* 撤销「移除」用的原样回灌：勾过的条目不能因为撤销就变回未勾，
     auto 条目也不走 syncAuto——重算要等到下次进结果页，那时 doneMap 已经把这个 id 收回来了。 */
  function restoreItem(it) {
    if (!it || !it.id || !it.tripId) return null;
    var list = load();
    for (var j = 0; j < list.length; j++) if (list[j].id === it.id) return list[j];
    var copy = { id: it.id, tripId: it.tripId, text: it.text, cat: CATS.indexOf(it.cat) >= 0 ? it.cat : '其他', by: it.by === 'auto' ? 'auto' : 'user', done: it.done ? 1 : 0, src: it.src || '', ts: it.ts || Date.now() };
    list.push(copy); save(list);
    return copy;
  }
  /* 行程删除时调用：清单跟着行程走，否则孤儿桶会无界攒在 localStorage 里 */
  function clearTrip(tripId) {
    if (!tripId) return 0;
    var list = load(), keep = list.filter(function (x) { return x.tripId !== tripId; });
    var n = list.length - keep.length;
    if (n) save(keep);
    return n;
  }

  return {
    KEY: KEY, CATS: CATS,
    ELEV_HIGH: ELEV_HIGH, ELEV_MID: ELEV_MID, ELEV_LOW: ELEV_LOW,
    BASE: BASE,
    monthsOf: monthsOf, tripMonths: tripMonths, autoPlan: autoPlan,
    syncAuto: syncAuto, listOf: listOf, statsOf: statsOf,
    add: add, toggle: toggle, remove: remove, restoreItem: restoreItem, clearTrip: clearTrip, ckId: ckId
  };
})();
