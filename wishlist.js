/* =========================================================
 * wishlist.js — 想去清单（全局心愿单）v1
 * 存储：localStorage 'tn_wishlist' = [{ id, label, theme, region, city, lat, lng, ts, visited }]
 *   visited=0 未打卡；>0 为打卡时间戳
 * 接口：Wish.toggle(s) / Wish.isWished(s) / Wish.checkin(s) /
 *       Wish.list() / Wish.remove(id) / Wish.count()
 * 被 topic.html（专题详情）、nation-map.html（全国详情）、wishlist.html（清单页）引用
 * 设计要点：条目存景点快照（label/坐标/主题），跨页面通用，不依赖任何页面的 SITES 索引
 * ========================================================= */
window.Wish = (function () {
  var KEY = 'tn_wishlist';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function uid(s) { return String((s.name || s.label || '') + '|' + (s.lat || 0) + '|' + (s.lng || 0)); }
  /* 添加/移除，返回是否已加入 */
  function toggle(s) {
    var list = load(), id = uid(s);
    if (find(list, id)) { save(list.filter(function (x) { return x.id !== id; })); return false; }
    list.push({
      id: id,
      label: s.label || s.name || '',
      theme: s.theme || s.ty || '',
      region: s.region || s.province || '',
      city: s.city || '',
      lat: s.lat, lng: s.lng,
      ts: Date.now(), visited: 0
    });
    save(list); return true;
  }
  function isWished(s) { return !!find(load(), uid(s)); }
  /* 打卡：标记已访问并返回条目（无则先加入） */
  function checkin(s) {
    var list = load(), id = uid(s), hit = find(list, id);
    if (!hit) { toggle(s); list = load(); hit = find(list, id); }
    if (hit) { hit.visited = Date.now(); save(list); }
    return hit;
  }
  /* 列表：未打卡在前（按加入时间倒序），已打卡在后 */
  function list() {
    return load().slice().sort(function (a, b) {
      return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || b.ts - a.ts;
    });
  }
  function remove(id) { save(load().filter(function (x) { return x.id !== id; })); }
  function count() { return load().length; }
  return { toggle: toggle, isWished: isWished, checkin: checkin, list: list, remove: remove, count: count, uid: uid };
})();
