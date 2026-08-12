/* sw.js — 行迹 TRACE 离线缓存（应用壳预缓存 + 数据文件运行时缓存） */
var CACHE = 'trace-v8';
var TILE_CACHE = 'trace-tiles';   /* 离线瓦片包（tiles.js 写入） */
var SHELL = [
  './',
  './changzheng.html',
  './explore-map.html',
  './gx-yn.html',
  './index.html',
  './md-manager.html',
  './nation-map.html',
  './qinghai-tibet.html',
  './review.html',
  './settings.html',
  './shanxi-ancient-architecture.html',
  './shanxi.html',
  './story.html',
  './test-data.html',
  './topic.html',
  './travel-map.html',
  './wishlist.html',
  './workshop.html',
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
  './tiles.js',
  './topic-counts.js',
  './routes-data.js',
  './food.js',
  './food-gxyn.js',
  './design.css',
  './map.css',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './images/icon.svg',
  './manifest.webmanifest',
  './art/empty-journey.svg',
  './art/empty-md.svg',
  './art/empty-memory.svg',
  './art/empty-voice.svg',
  './art/hero-journey.svg',
  './art/topic-changzheng.svg',
  './art/topic-gs.svg',
  './art/topic-gz.svg',
  './art/topic-sc.svg',
  './art/topic-shanxi.svg',
  './art/topic-tibet.svg',
  './art/topic-xj.svg',
  './art/topic-yunnan.svg'
];
var RUNTIME = /(data\.js|gxyn-data\.js|qz-data\.js|changzheng-data\.js|sc-data\.js|sc-food\.js|gs-data\.js|gs-food\.js|xj-data\.js|xj-food\.js|gz-data\.js|gz-food\.js|food\.js|food-gxyn\.js)$/;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    /* 逐条 add + catch：单个文件缺失不影响整体安装 */
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;              /* 第三方（瓦片/API）不缓存 */
  if (/is\.autonavi\.com|tile\.openstreetmap\.org/.test(url.hostname)) {  /* 离线瓦片：缓存优先，子域归一化去重 */
    e.respondWith(caches.open(TILE_CACHE).then(function (c) {
      var key = url.hostname.indexOf('is.autonavi.com') >= 0 ? url.href.replace(/wprd0\d/, 'wprd00') : url.href;
      return c.match(key).then(function (hit) {
        if (hit) return hit;
        var f = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) c.put(key, res.clone());
          return res;
        }).catch(function () { return hit; });
        return f;
      });
    }));
    return;
  }
  if (req.mode === 'navigate') {                            /* 导航：网络优先；断网回退到已缓存页/首页 */
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
  if (RUNTIME.test(url.pathname)) {                         /* 数据文件：stale-while-revalidate */
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var f = fetch(req).then(function (res) {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        });
        return hit || f;
      });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (c) {      /* 其余同源：stale-while-revalidate */
    return c.match(req).then(function (hit) {
      var f = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || f;
    });
  }));
});
