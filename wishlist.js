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
  /* 撤销打卡：visited 清零（恢复为未打卡） */
  function uncheckin(s) {
    var list = load(), id = uid(s), hit = find(list, id);
    if (hit) { hit.visited = 0; save(list); }
    return hit;
  }
  /* 列表：未打卡在前（按加入时间倒序），已打卡在后 */
  function list() {
    return load().slice().sort(function (a, b) {
      return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || b.ts - a.ts;
    });
  }
  function remove(id) {
    var list = load();
    if (find(list, id)) { save(list.filter(function (x) { return x.id !== id; })); return; }
    /* 兼容旧数据：条目无 id 字段时，按 label|lat|lng 内容匹配删除 */
    var parts = String(id).split('|');
    if (parts.length === 3) {
      save(list.filter(function (x) {
        return !(String(x.label) === parts[0] && String(x.lat) === parts[1] && String(x.lng) === parts[2]);
      }));
    }
  }
  function count() { return load().length; }

  /* 到达提醒：当前位置 3km 内是否有未打卡的心愿节点 */
  function checkNearby(cb) {
    if (!navigator.geolocation) return;
    var list = load().filter(function (x) { return !x.visited; });
    if (!list.length) return;
    navigator.geolocation.getCurrentPosition(function (p) {
      var lat = p.coords.latitude, lng = p.coords.longitude;
      var near = list.filter(function (x) {
        return x.lat != null && x.lng != null && window.Geo.hav(lat, lng, x.lat, x.lng) < 3;
      });
      if (near.length && cb) cb(near);
    }, function () {}, { timeout: 8000, maximumAge: 60000 });
  }
  return { toggle: toggle, isWished: isWished, checkin: checkin, uncheckin: uncheckin, list: list, remove: remove, count: count, uid: uid, checkNearby: checkNearby };
})();
