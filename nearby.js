/* nearby.js — 「这一带还有什么」：内置库优先，Overpass 只做补位
 *
 * 设计判断（写死在代码里，§34 用源码顺序锚守住）：
 * 第一答案永远是包内的全国轻量索引（nation-index.js，免 Key / 离线 / 秒回 / 无第三方配额），
 * 实时查询只在「内置凑不满 4 条」且「设备有网」时发一次，且失败一律静默降级。
 * 顺序不许换：queryNearby 里 nearbySites 必须出现在 overpassNearby 之前。
 */
(function (global) {
  'use strict';

  var OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  var OVERPASS_TIMEOUT_MS = 8000;   /* 该服务限流是常态：8s 到点就放弃，不排队重试 */
  var BUILTIN_ENOUGH = 4;           /* 内置够这几条就不联网 */
  var MAX_OSM = 12;                 /* 补位结果上限，避免淹掉内置答案 */
  var LIVE_NOTE = '以下为实时查询（OSM），离线不可用';

  var FLAG_WEIGHT = { m: 2, h: 1 };
  var DEFAULT_RKM = 30;

  /* ---------- 内置索引：nation-index 优先，页面自带 SITES 兜底 ---------- */
  var _rows = null, _rowsFrom = '';

  function rows() {
    var from = global.NATION_SITES_RAW ? 'nation' : (Array.isArray(global.SITES) ? 'page' : 'none');
    if (_rows && _rowsFrom === from) return _rows;
    _rowsFrom = from;
    _rows = from === 'nation' ? parseNation(global.NATION_SITES_RAW) : parsePage(global.SITES);
    return _rows;
  }

  function parseNation(raw) {
    var out = [], seen = {};
    String(raw || '').split('\n').forEach(function (line) {
      if (!line) return;
      var p = line.split('|');
      var lat = +p[7], lng = +p[8];
      if (!p[0] || !isFinite(lat) || !isFinite(lng) || seen[p[0]]) return;
      seen[p[0]] = 1;
      out.push({ name: p[0], label: p[1] || p[0], region: p[2] || '', city: p[3] || '', county: p[4] || '', theme: p[5] || '', flag: p[6] || '', lat: lat, lng: lng });
    });
    return out;
  }

  function parsePage(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (s) {
      var lat = +s.lat, lng = +s.lng;
      if (!s.name || !isFinite(lat) || !isFinite(lng) || seen[s.name]) return;
      seen[s.name] = 1;
      out.push({ name: s.name, label: s.label || s.name, region: s.region || '', city: s.city || '', county: s.county || '', theme: s.theme || '', flag: s.flag || '', lat: lat, lng: lng });
    });
    return out;
  }

  function byFlagThenDist(a, b) {
    var w = (FLAG_WEIGHT[b.flag] || 0) - (FLAG_WEIGHT[a.flag] || 0);
    return w !== 0 ? w : a.d - b.d;
  }

  /* ---------- 第一腿：内置半径过滤（纯本地，无任何网络） ---------- */
  function nearbySites(lat, lng, rKm, cats, exclude) {
    var hav = global.Geo && global.Geo.hav;
    if (!hav || !isFinite(+lat) || !isFinite(+lng)) return [];
    var r = +rKm > 0 ? +rKm : DEFAULT_RKM;
    var skip = {};
    (Array.isArray(exclude) ? exclude : (exclude ? [exclude] : [])).forEach(function (n) { skip[n] = 1; });
    var out = [];
    rows().forEach(function (s) {
      if (skip[s.name]) return;
      if (cats && cats.length && cats.indexOf(s.theme) < 0) return;
      var d = hav(+lat, +lng, s.lat, s.lng);
      if (d <= r) out.push({ name: s.name, label: s.label, region: s.region, city: s.city, county: s.county, theme: s.theme, flag: s.flag, lat: s.lat, lng: s.lng, d: d, src: '内置' });
    });
    out.sort(byFlagThenDist);
    return out;
  }

  /* ---------- 第二腿：Overpass 补位（有网才走到这里） ---------- */
  function overpassQuery(lat, lng, rKm) {
    var radius = Math.round((+rKm > 0 ? +rKm : DEFAULT_RKM) * 1000);
    var around = 'around:' + radius + ',' + (+lat).toFixed(5) + ',' + (+lng).toFixed(5);
    return '[out:json][timeout:8];(' +
      'node["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|zoo)$"](' + around + ');' +
      'way["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|zoo)$"](' + around + ');' +
      ');out center ' + (MAX_OSM * 2) + ';';
  }

  function overpassNearby(lat, lng, rKm, cb) {
    var hav = global.Geo && global.Geo.hav;
    var settled = false;
    function done(list) { if (settled) return; settled = true; clearTimeout(timer); cb(list || null); }
    if (!hav || !isFinite(+lat) || !isFinite(+lng) || typeof global.fetch !== 'function') { cb(null); return; }
    var ctl = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var timer = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } done(null); }, OVERPASS_TIMEOUT_MS);
    try {
      global.fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'data=' + encodeURIComponent(overpassQuery(lat, lng, rKm)),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        /* 429 / 504 等一律当「这次问不到」：限流是常态，不弹错、不重试 */
        if (!r || !r.ok) { done(null); return null; }
        return r.json();
      }).then(function (j) {
        var list = ((j && j.elements) || []).map(function (e) {
          var la = typeof e.lat === 'number' ? e.lat : (e.center && e.center.lat);
          var ln = typeof e.lon === 'number' ? e.lon : (e.center && e.center.lon);
          if (!isFinite(la) || !isFinite(ln)) return null;
          var t = e.tags || {};
          var nm = t.name || t['name:zh'] || '';
          if (!nm) return null;
          return { name: nm, label: nm, region: '', city: t['addr:city'] || '', county: '', theme: t.tourism || '兴趣点', flag: '', lat: la, lng: ln, d: hav(+lat, +lng, la, ln), src: '实时查询' };
        }).filter(Boolean).sort(function (a, b) { return a.d - b.d; }).slice(0, MAX_OSM);
        done(list);
      }).catch(function () { done(null); });
    } catch (e) { done(null); }
  }

  /* ---------- 合流：内置先跑，凑不满才补位（顺序＝§34 灵魂锚） ---------- */
  function queryNearby(lat, lng, rKm, cats, cb, exclude) {
    var hits = nearbySites(lat, lng, rKm, cats, exclude);
    var offline = !global.navigator || global.navigator.onLine === false;
    if (hits.length >= BUILTIN_ENOUGH || offline) {
      cb({ items: hits, builtin: hits.length, osm: 0, live: false, offline: offline });
      return;
    }
    overpassNearby(lat, lng, rKm, function (osm) {
      var extra = osm || [];
      cb({ items: hits.concat(extra), builtin: hits.length, osm: extra.length, live: extra.length > 0, offline: false });
    });
  }

  global.Nearby = {
    nearbySites: nearbySites,
    overpassNearby: overpassNearby,
    overpassQuery: overpassQuery,
    queryNearby: queryNearby,
    OVERPASS_URL: OVERPASS_URL,
    OVERPASS_TIMEOUT_MS: OVERPASS_TIMEOUT_MS,
    BUILTIN_ENOUGH: BUILTIN_ENOUGH,
    LIVE_NOTE: LIVE_NOTE
  };
})(window);
