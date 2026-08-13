/* sw.js 鈥?琛岃抗 TRACE 绂荤嚎缂撳瓨锛堝簲鐢ㄥ３棰勭紦瀛?+ 鏁版嵁鏂囦欢杩愯鏃剁紦瀛橈級 */
var CACHE = 'trace-v10';
var TILE_CACHE = 'trace-tiles';   /* 绂荤嚎鐡︾墖鍖咃紙tiles.js 鍐欏叆锛?*/
var SHELL = [
  './',
  './explore-map.html',
  './index.html',
  './md-manager.html',
  './nation-map.html',
  './review.html',
  './search.html',
  './settings.html',
  './story.html',
  './test-data.html',
  './topic.html',
  './travel-map.html',
  './wishlist.html',
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
    /* 閫愭潯 add + catch锛氬崟涓枃浠剁己澶变笉褰卞搷鏁翠綋瀹夎 */
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
  if (url.origin !== location.origin) return;              /* 绗笁鏂癸紙鐡︾墖/API锛変笉缂撳瓨 */
  if (/is\.autonavi\.com|tile\.openstreetmap\.org/.test(url.hostname)) {  /* 绂荤嚎鐡︾墖锛氱紦瀛樹紭鍏堬紝瀛愬煙褰掍竴鍖栧幓閲?*/
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
  if (req.mode === 'navigate') {                            /* 瀵艰埅锛氱綉缁滀紭鍏堬紱鏂綉鍥為€€鍒板凡缂撳瓨椤?棣栭〉 */
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
  if (RUNTIME.test(url.pathname)) {                         /* 鏁版嵁鏂囦欢锛歴tale-while-revalidate */
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
  e.respondWith(caches.open(CACHE).then(function (c) {      /* 鍏朵綑鍚屾簮锛歴tale-while-revalidate */
    return c.match(req).then(function (hit) {
      var f = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || f;
    });
  }));
});
