/* sw.js — 行迹 TRACE 离线缓存（应用壳预缓存 + 数据文件运行时缓存） */
var CACHE = 'trace-v20';
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
    /* 闁劖娼� add + catch閿涙艾宕熸稉顏呮瀮娴犲墎宸辨径鍙樼瑝瑜板崬鎼烽弫缈犵秼鐎瑰顥� */
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
  if (url.origin !== location.origin) return;              /* 缁楊兛绗侀弬鐧哥礄閻★妇澧�/API閿涘绗夌紓鎾崇摠 */
    if (req.mode === 'navigate') {                            /* 鐎佃壈鍩呴敍姘辩秹缂佹粈绱崗鍫幢閺傤厾缍夐崶鐐衡偓鈧崚鏉垮嚒缂傛挸鐡ㄦい?妫ｆ牠銆� */
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
  e.respondWith(caches.open(CACHE).then(function (c) {      /* 閸忔湹缍戦崥灞剧爱閿涙tale-while-revalidate */
    return c.match(req).then(function (hit) {
      var f = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || f;
    });
  }));
});
