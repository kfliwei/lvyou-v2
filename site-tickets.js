/* site-tickets.js — 景点票价与营业时间（三级：内置种子 → localStorage 30 天缓存 → 高德 v5 实时）
 * 营业时间来自高德 business.opentime_week（高德维护，分季节），实时可靠；
 * 票价高德无 API 源，靠本文件种子人工/AI 辅助维护——未收录就不显示价格行，绝不编造。
 * 种子格式: SITE_TICKETS_SEED[景点名] = { h: 营业时间原文, p: 票价文案（'免费' 或 '旺季 X 元'）, u: 'YYYY-MM' 更新年月 } */
(function () {
  var SEED = window.SITE_TICKETS_SEED = {
  "晋祠": {
    "h": "11月至3月 08:00-17:00,4月至10月 08:30-18:00,2026-02-16,09:00-14:00",
    "p": "公园免费 · 博物馆旺季 95 元 / 淡季 75 元",
    "u": "2026-10"
  },
  "平遥古城": {
    "h": "周一至周日 00:00-24:00",
    "p": "古城免费 · 景点通票 125 元",
    "u": "2026-10"
  },
  "云冈石窟": {
    "h": "9月1日至9月30日08:00-17:00",
    "p": "120 元",
    "u": "2026-10"
  },
  "故宫": {
    "h": "旺季4月1日至10月31日 周二至周日 08:30-17:00 16:00停止检票，淡季11月1日至3月31日 周二至周日 08:30-16:30 15:30停止检票，周一全天关闭，节假日营业时间以官方通知为准",
    "p": "旺季 60 元 / 淡季 40 元（周一闭馆，需提前预约）",
    "u": "2026-10"
  },
  "西湖": {
    "h": "周一至周日 00:00-24:00",
    "p": "免费",
    "u": "2026-10"
  },
  "外滩": {
    "h": "周一至周日 00:00-24:00",
    "p": "免费",
    "u": "2026-10"
  },
  "鼓浪屿": {
    "h": "",
    "p": "上岛免费 · 轮渡往返约 35 元",
    "u": "2026-10"
  },
  "黄山": {
    "h": "3月5日-11月30日:周一至周五:7:00-17:10；周六-周日及小长假6:30-17:40；12月1日-3月4日(含周六、周日及小长假):8:00-16:40",
    "p": "旺季 190 元 / 淡季 150 元",
    "u": "2026-10"
  },
  "九寨沟": {
    "h": "04-01至11-15 周一至周日 08:00-18:00 最晚进入14:00；11-16至03-31 周一至周日 08:30-18:00 最晚进入14:00",
    "p": "旺季 169 元 + 观光车 90 元 · 淡季 80 元 + 观光车 80 元",
    "u": "2026-10"
  }
};
  var DAY = 30 * 24 * 3600 * 1000;
  var inflight = {};
  function norm(s) { return (s || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim(); }
  function lsKey(n) { return 'tn_tk_' + n; }
  function amapKey() {
    try { var k = localStorage.getItem('tn_amap_key'); if (k) return k; } catch (e) {}
    return window.__TN_AMAP_KEY__ || '';
  }
  function fetchAmap(site, cb) {
    var key = amapKey();
    if (!key) return cb(null);
    var kw = encodeURIComponent(norm(site.label || site.name || ''));
    var cityQ = site.city ? '&city=' + encodeURIComponent(site.city) + '&citylimit=true' : (site.region ? '&city=' + encodeURIComponent(site.region) : '');
    fetch('https://restapi.amap.com/v5/place/text?keywords=' + kw + cityQ + '&key=' + key)
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s.status !== '1' || !s.pois || !s.pois.length) return cb(null);
        /* 同名异地保护：POI 坐标须落在景点附近（±0.2°），否则放弃 */
        var poi = s.pois.find(function (p) {
          var loc = (p.location || '').split(',').map(Number);
          return loc.length === 2 && isFinite(loc[0]) && Math.abs(loc[0] - (+site.lng || 0)) < 0.2 && Math.abs(loc[1] - (+site.lat || 0)) < 0.2;
        }) || null;
        if (!poi) return cb(null);
        return fetch('https://restapi.amap.com/v5/place/detail?id=' + poi.id + '&key=' + key + '&show_fields=business')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.status !== '1' || !d.pois || !d.pois[0]) return cb(null);
            var b = d.pois[0].business || {};
            cb({ h: b.opentime_week || b.opentime_today || '' });
          });
      })
      .catch(function () { cb(null); });
  }
  function get(site, cb) {
    var n = site.label || site.name || '';
    if (!n) return cb(null);
    var seed = SEED[n] || SEED[norm(n)];
    if (seed) { cb({ h: seed.h || '', p: seed.p || '', u: seed.u || '', src: 'seed' }); return; }
    try {
      var c = JSON.parse(localStorage.getItem(lsKey(n)) || 'null');
      if (c && c.h && Date.now() - c.t < DAY) { cb({ h: c.h, p: c.p || '', u: c.u || '', src: 'cache' }); return; }
    } catch (e) {}
    if (inflight[n]) { inflight[n].push(cb); return; }
    inflight[n] = [cb];
    fetchAmap(site, function (t) {
      var waiters = inflight[n]; delete inflight[n];
      var now = new Date().toISOString().slice(0, 7);
      if (t && t.h) {
        try { localStorage.setItem(lsKey(n), JSON.stringify({ h: t.h, p: (SEED[n] || {}).p || '', t: Date.now(), u: now })); } catch (e) {}
      }
      (waiters || []).forEach(function (w) { w(t && t.h ? { h: t.h, p: '', u: now, src: 'amap' } : null); });
    });
  }
  window.SiteTickets = { get: get };
})();
