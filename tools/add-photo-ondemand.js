/* 详情实景照按需拉取：静态映射优先 → 未命中实时调高德(JSONP) → 7天缓存 */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!t.includes(from)) { console.log('SKIP', tag); return; }
  t = t.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. JSONP 工具 + loadSitePhoto（插在 loadWeather 前） */
rep(
  '  function loadWeather(lat, lng, cb) {',
  `  /* 高德 JSONP（详情实景照按需拉取用） */
  function amapJsonp(url, cb) {
    var cbName = 'amapPhotoCb' + Date.now().toString(36) + Math.floor(Math.random() * 9999);
    window[cbName] = function (data) { delete window[cbName]; cb(data); };
    var sc = document.createElement('script');
    sc.src = url + '&callback=' + cbName;
    sc.onerror = function () { delete window[cbName]; cb(null); };
    document.head.appendChild(sc);
  }
  /* 实景照三级获取：静态映射(SITE_IMAGES) → localStorage 7天缓存 → 高德实时拉取 */
  function loadSitePhoto(s, cb) {
    if (!s) { cb && cb(null); return; }
    var u = imgSrc(s);
    if (u && u.indexOf('http') === 0 && u.indexOf('autonavi') >= 0) { cb && cb(u); return; }
    try {
      var c = JSON.parse(localStorage.getItem('tn_photo_' + s.name) || 'null');
      if (c && c.u && Date.now() - c.ts < 7 * 24 * 3600 * 1000) { cb && cb(c.u); return; }
    } catch (e) {}
    var key = '';
    try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb && cb(null); return; }
    amapJsonp('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(key) +
      '&keywords=' + encodeURIComponent(s.name) +
      '&city=' + encodeURIComponent(s.city || '') +
      '&offset=1&page=1&extensions=all', function (d) {
      var ph = '';
      try { if (d && d.status === '1' && d.pois && d.pois[0] && d.pois[0].photos && d.pois[0].photos[0]) ph = d.pois[0].photos[0].url; } catch (e) {}
      if (ph) { try { localStorage.setItem('tn_photo_' + s.name, JSON.stringify({ ts: Date.now(), u: ph })); } catch (e) {} cb && cb(ph); }
      else cb && cb(null);
    });
  }

  function loadWeather(lat, lng, cb) {`,
  '1 loadSitePhoto'
);

/* 2. openSheet：详情打开后按需拉实景照 */
rep(
  `    /* 节点天气 */
    if (_s0 && _s0.lat != null) {
      loadWeather(+_s0.lat, +_s0.lng, function (w) {
        var el = document.getElementById('lsWeather');
        if (!el) return;
        if (!w) { el.style.display = 'none'; return; }
        el.innerHTML = weatherIcon(w.code) + ' ' + (WMO[w.code] || '未知') + ' · ' + w.temp + '°C · 风 ' + w.wind + 'km/h';
        el.style.display = 'block';
      });
    }`,
  `    /* 节点天气 */
    if (_s0 && _s0.lat != null) {
      loadWeather(+_s0.lat, +_s0.lng, function (w) {
        var el = document.getElementById('lsWeather');
        if (!el) return;
        if (!w) { el.style.display = 'none'; return; }
        el.innerHTML = weatherIcon(w.code) + ' ' + (WMO[w.code] || '未知') + ' · ' + w.temp + '°C · 风 ' + w.wind + 'km/h';
        el.style.display = 'block';
      });
    }
    /* 实景照按需拉取（静态映射未命中时） */
    if (_s0) {
      loadSitePhoto(_s0, function (u) {
        var img = document.querySelector('#locSheet .ls-img img');
        if (!img || !u) return;
        if (img.getAttribute('src') !== u) {
          img.src = u;
          img.onerror = function () { img.style.display = 'none'; };
        }
      });
    }`,
  '2 sheet photo'
);

fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('photo-on-demand patches:', n);
