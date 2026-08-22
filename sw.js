/* sw.js — 行迹 TRACE 离线缓存（应用壳预缓存 + 数据文件运行时缓存 + 地图瓦片按需缓存） */
var CACHE = 'trace-v22';
var TILES = 'trace-tiles-v1';
var TILE_MAX_ENTRIES = 800;   /* 瓦片缓存上限（约 800 张，防爆 Storage） */
var TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'tile.opentopomap.org', 'is.autonavi.com'];
var SHELL = [
  './',
  './explore-map.html',
  './index.html',
  './md-manager.html',
  './me.html',
  './node-manager.html',
  './review.html',
  './search.html',
  './settings.html',
  './story.html',
  './test-data.html',
  './topic.html',
  './travel-map.html',
  './wishlist.html',
  './planner.html',
  './album.html',
  './album-edit.html',
  './album.js',
  './planner.js',
  './theme.js',
  './travel-notes.js',
  './results.js',
  './vault.js',
  './quotes.js',
  './topic-meta.js',
  './topic-common.js',
  './wishlist.js',
  './geo.js',
  './poster.js',
  './topic-counts.js',
  './routes-data.js',
  './food.js',
  './food-gxyn.js',
  './ui.js',
  './node-lod.js',
  './nation-index.js',
  './design.css',
  './map.css',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './images/icon.svg',
  './manifest.webmanifest',
  /* ---- 各省数据/美食（预缓存，离线开箱可用） ---- */
  './ah-data.js', './bj-data.js', './changzheng-data.js', './cq-data.js', './cq-food.js',
  './fj-data.js', './gd-data.js', './gs-data.js', './gs-food.js', './gxyn-data.js',
  './gz-data.js', './gz-food.js', './ha-data.js', './hb-data.js', './hb-food.js',
  './he-data.js', './hi-data.js', './hk-data.js', './hlj-data.js', './hn-data.js', './hn-food.js',
  './jl-data.js', './js-data.js', './jx-data.js', './ln-data.js', './mo-data.js',
  './nmg-data.js', './nmg-food.js', './nx-data.js', './nx-food.js', './qh-data.js', './qh-food.js',
  './qingzang-data.js', './sc-data.js', './sc-food.js', './sd-data.js', './sh-data.js',
  './sx-data.js', './sx-food.js', './tj-data.js', './tw-data.js', './xj-data.js', './xj-food.js',
  './xz-data.js', './xz-food.js', './zj-data.js',
  /* ---- 主题插图 ---- */
  './art/empty-journey.svg',
  './art/empty-md.svg',
  './art/empty-memory.svg',
  './art/empty-voice.svg',
  './art/hero-journey.svg',
  './art/topic-ah.svg',
  './art/topic-bj.svg',
  './art/topic-changzheng.svg',
  './art/topic-cq.svg',
  './art/topic-fj.svg',
  './art/topic-gd.svg',
  './art/topic-gs.svg',
  './art/topic-gz.svg',
  './art/topic-ha.svg',
  './art/topic-he.svg',
  './art/topic-hi.svg',
  './art/topic-hk.svg',
  './art/topic-hlj.svg',
  './art/topic-jl.svg',
  './art/topic-js.svg',
  './art/topic-jx.svg',
  './art/topic-ln.svg',
  './art/topic-mo.svg',
  './art/topic-nmg.svg',
  './art/topic-nx.svg',
  './art/topic-qh.svg',
  './art/topic-sc.svg',
  './art/topic-sd.svg',
  './art/topic-sh.svg',
  './art/topic-shanxi.svg',
  './art/topic-sx2.svg',
  './art/topic-tibet.svg',
  './art/topic-tj.svg',
  './art/topic-tw.svg',
  './art/topic-xj.svg',
  './art/topic-xz.svg',
  './art/topic-yunnan.svg',
  './art/topic-zj.svg'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* 瓦片缓存清理：超过上限时删除最早写入的条目 */
function trimTiles(c) {
  c.keys().then(function (ks) {
    if (ks.length <= TILE_MAX_ENTRIES) return;
    var drop = ks.slice(0, ks.length - TILE_MAX_ENTRIES);
    Promise.all(drop.map(function (k) { return c.delete(k); }));
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  /* 地图瓦片：cache-first + 后台更新 + 离线回退 */
  if (TILE_HOSTS.some(function (h) { return url.hostname.indexOf(h) >= 0; })) {
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(req).then(function (hit) {
        var f = fetch(req).then(function (res) {
          if (res && res.ok) { c.put(req, res.clone()); trimTiles(c); }
          return res;
        }).catch(function () { return hit; });
        return hit || f;
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;              /* 跨域非瓦片（天气/实景照/API）不拦截 */
  if (req.mode === 'navigate') {                           /* 页面：网络优先，离线回退缓存/首页 */
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (c) {      /* 静态资源：stale-while-revalidate */
    return c.match(req).then(function (hit) {
      var f = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || f;
    });
  }));
});
