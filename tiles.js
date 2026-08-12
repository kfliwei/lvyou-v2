/* =========================================================
 * tiles.js — 离线地图瓦片包 v1
 * 高德街道瓦片（国内快、中文标注）写入 Cache API 'trace-tiles'
 * 瓦片无 CORS 头 → no-cors fetch（opaque 响应可存可取）
 * sw.js 对瓦片请求先查该缓存（子域归一化去重，4 子域只存一份）
 * 用法：
 *   Tiles.downloadChina(onProg, onDone, isCancelled)  // 全国概览 z8
 *   Tiles.downloadView(map, [10,11,12], onProg, onDone, isCancelled) // 当前视野
 *   Tiles.size(cb) / Tiles.clear(cb)
 * 被 settings.html / nation-map.html 引用
 * ========================================================= */
window.Tiles = (function () {
  var CACHE = 'trace-tiles';
  var CN = { lat1: 18, lat2: 54, lng1: 73, lng2: 135 };   /* 中国概览范围 */
  function norm(u) { return u.replace(/wprd0\d/, 'wprd00'); }  /* 子域归一化 */
  function tileXY(lat, lng, z) {
    var n = Math.pow(2, z);
    var x = Math.floor((lng + 180) / 360 * n);
    var latR = lat * Math.PI / 180;
    var y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
    return { x: x, y: y };
  }
  function url(x, y, z) {
    return 'https://wprd0' + ((x + y) % 4) + '.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x=' + x + '&y=' + y + '&z=' + z;
  }
  function tilesIn(lat1, lng1, lat2, lng2, z) {
    var a = tileXY(Math.max(lat1, lat2), lng1, z);
    var b = tileXY(Math.min(lat1, lat2), lng2, z);
    var list = [];
    for (var x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
      for (var y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) list.push(url(x, y, z));
    return list;
  }
  /* 并发池下载：pool=6，逐批推进，支持取消 */
  function download(list, onProg, onDone, isCancelled) {
    var pool = 6, i = 0, ok = 0, total = list.length;
    if (!total) { if (onDone) onDone(0, 0); return; }
    function next() {
      if (isCancelled && isCancelled()) { if (onDone) onDone(ok, total, true); return; }
      if (i >= total) { if (onDone) onDone(ok, total, false); return; }
      var u = list[i++];
      fetch(u, { mode: 'no-cors' }).then(function (r) {
        return caches.open(CACHE).then(function (c) { return c.put(norm(u), r); }).then(function () { ok++; });
      }).catch(function () {}).then(function () {
        if (onProg) onProg(ok, total);
        next();
      });
    }
    for (var p = 0; p < pool; p++) next();
  }
  function downloadChina(onProg, onDone, isCancelled) {
    download(tilesIn(CN.lat1, CN.lng1, CN.lat2, CN.lng2, 8), onProg, onDone, isCancelled);
  }
  function downloadView(map, zs, onProg, onDone, isCancelled) {
    var b = map.getBounds(), list = [];
    zs.forEach(function (z) {
      list = list.concat(tilesIn(b.getNorth(), b.getWest(), b.getSouth(), b.getEast(), z));
    });
    download(list, onProg, onDone, isCancelled);
  }
  function size(onDone) {
    caches.open(CACHE).then(function (c) { return c.keys().then(function (ks) { onDone(ks.length); }); })
      .catch(function () { onDone(0); });
  }
  function clear(onDone) {
    caches.open(CACHE).then(function (c) { return c.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return c.delete(k); })); }); })
      .then(function () { if (onDone) onDone(); })
      .catch(function () { if (onDone) onDone(); });
  }
  return { downloadChina: downloadChina, downloadView: downloadView, size: size, clear: clear, CACHE: CACHE };
})();
