/* ④ 节点详情天气（Open-Meteo 免费 API，30 分钟缓存） */
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

/* 1. 天气工具函数（插在 ensureDetail 前） */
rep(
  '  function ensureDetail(s, cb) {',
  `  /* ---------- 节点天气（Open-Meteo，免 Key，30 分钟缓存） ---------- */
  var WMO = { 0: '晴', 1: '多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻雨', 57: '冻雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴冰雹', 99: '雷暴冰雹' };
  function weatherIcon(code) { var c = +code; if (c === 0) return '☀️'; if (c <= 3) return '⛅'; if (c <= 48) return '🌫️'; if (c <= 67) return '🌧️'; if (c <= 77) return '🌨️'; if (c <= 86) return '🌦️'; return '⛈️'; }
  function loadWeather(lat, lng, cb) {
    try {
      var key = 'tn_weather_' + lat.toFixed(2) + '_' + lng.toFixed(2);
      var c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.ts < 30 * 60 * 1000) { cb && cb(c.d); return; }
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current_weather=true&timezone=auto')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var w = d && d.current_weather;
          if (!w) { cb && cb(null); return; }
          var out = { code: w.weathercode, temp: Math.round(w.temperature), wind: Math.round(w.windspeed) };
          try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), d: out })); } catch (e) {}
          cb && cb(out);
        }).catch(function () { cb && cb(null); });
    } catch (e) { cb && cb(null); }
  }

  function ensureDetail(s, cb) {`,
  '4a weather util'
);

/* 2. buildSheet：ls-loc 后加天气行 */
rep(
  `      '<div class="ls-loc">' + esc(loc) + '</div>' +`,
  `      '<div class="ls-loc">' + esc(loc) + '</div>' +
      '<div class="ls-weather" id="lsWeather" style="display:none;font-size:12px;color:var(--color-muted);margin-bottom:8px"></div>' +`,
  '4b weather row'
);

/* 3. openSheet：取天气填充 */
rep(
  `    /* 全国页：按省懒加载详情后刷新面板 */
    var _s0 = SITES[i];
    if (_s0 && window.SITES_LAZY && !_s0.desc) {
      ensureDetail(_s0, function () { refreshSheet(); });
    }`,
  `    /* 全国页：按省懒加载详情后刷新面板 */
    var _s0 = SITES[i];
    if (_s0 && window.SITES_LAZY && !_s0.desc) {
      ensureDetail(_s0, function () { refreshSheet(); });
    }
    /* 节点天气 */
    if (_s0 && _s0.lat != null) {
      loadWeather(+_s0.lat, +_s0.lng, function (w) {
        var el = document.getElementById('lsWeather');
        if (!el) return;
        if (!w) { el.style.display = 'none'; return; }
        el.innerHTML = weatherIcon(w.code) + ' ' + (WMO[w.code] || '未知') + ' · ' + w.temp + '°C · 风 ' + w.wind + 'km/h';
        el.style.display = 'block';
      });
    }`,
  '4c weather fetch'
);

fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('④ patches:', n);
