/* =========================================================
 * geo.js — 地理工具公共模块 v1
 * 收敛 8 个文件里重复的 GCJ-02 纠偏 / haversine 实现：
 *   topic-common.js / nation-map.html / travel-map.html /
 *   changzheng.html / gx-yn.html / qinghai-tibet.html / shanxi.html / story.html
 * 各页保留同名薄封装（function gcj02Of(...) { return window.Geo.gcj02Of(...); }），
 * 算法只在此文件维护一份，改算法只改这里。
 * 单测：node tools/test-geo.js
 * ========================================================= */
window.Geo = (function () {
  function _tlat(lng, lat) {
    var r = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    r += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function _tlng(lng, lat) {
    var r = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    r += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  var _A = 6378245.0, _EE = 0.00669342162296594323;
  /* WGS-84 → GCJ-02（火星坐标）。界外原样返回 */
  function gcj02Of(lat, lng) {
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
    var dlat = _tlat(lng - 105, lat - 35), dlng = _tlng(lng - 105, lat - 35);
    var rl = lat / 180 * Math.PI, m = Math.sin(rl), mm = 1 - _EE * m * m, sm = Math.sqrt(mm);
    dlat = (dlat * 180) / ((_A * (1 - _EE)) / (mm * sm) * Math.PI);
    dlng = (dlng * 180) / (_A / sm * Math.cos(rl) * Math.PI);
    return [lat + dlat, lng + dlng];
  }
  /* haversine 球面距离（km），标量参数 */
  function hav(lat1, lng1, lat2, lng2) {
    var R = 6371, r = Math.PI / 180;
    var dLa = (lat2 - lat1) * r, dLo = (lng2 - lng1) * r;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* haversine 数组参数版（兼容旧调用：[lat,lng] 对） */
  function havA(a, b) { return hav(a[0], a[1], b[0], b[1]); }
  return { _tlat: _tlat, _tlng: _tlng, gcj02Of: gcj02Of, hav: hav, havA: havA };
})();
