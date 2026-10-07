/* 一次性只读探针（批次 28 定性腿之一）：不碰产品代码，只回答三个问题
   ① 这两站在索引里叫什么、坐标在哪、属于哪个市；
   ② 站间直线里程是多少（决定自动档选哪把尺子）；
   ③ 按产品自己那把尺子（MODE/AUTO_WALK_KM/AUTO_BIKE_KM/playH/splitIntoDays 的判据）手算
      maxStops / tH，看「2 站被拆成 2 天」到底是哪一项造成的。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const raw = fs.readFileSync(path.join(ROOT, 'nation-index.js'), 'utf8');
const body = /window\.NATION_SITES_RAW\s*=\s*"([\s\S]*?)";/.exec(raw)[1];
const lines = body.split('\\n').map(function (l) { return l.split('|'); });
function find(kw) {
  return lines.filter(function (p) { return p[0] === kw || p[1] === kw; })
    .map(function (p) { return { name: p[0], disp: p[1], region: p[2], city: p[3], county: p[4], theme: p[5], flag: p[6], lat: +p[7], lng: +p[8] }; });
}
const a = find('应县木塔'), b = find('悬空寺');
const out = [];
out.push('应县木塔: ' + JSON.stringify(a));
out.push('悬空寺: ' + JSON.stringify(b));

function hav(la1, lo1, la2, lo2) {
  const R = 6371, dLat = (la2 - la1) * Math.PI / 180, dLng = (lo2 - lo1) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const datong = find('大同')[0] || find('大同市')[0];
out.push('大同: ' + JSON.stringify(datong));
if (a[0] && b[0]) {
  const k1 = hav(a[0].lat, a[0].lng, b[0].lat, b[0].lng);
  out.push('两站直线 km = ' + k1.toFixed(1));
  if (datong) out.push('大同→应县木塔 ' + hav(datong.lat, datong.lng, a[0].lat, a[0].lng).toFixed(1) +
    ' / 大同→悬空寺 ' + hav(datong.lat, datong.lng, b[0].lat, b[0].lng).toFixed(1));
}
/* 手算 splitIntoDays 的两条判据（MODE 与阈值从 planner.js 源码里取，不抄文档） */
const pj = fs.readFileSync(path.join(ROOT, 'planner.js'), 'utf8');
out.push('源码锚：MAX_KM/MAX_H/MAX_STOPS = ' + (/var MAX_KM = (\d+), MAX_H = (\d+), MAX_STOPS = (\d+);/.exec(pj) || [0, '未命中'].join('/')).slice(1).join('/'));
out.push('源码锚：DRIVE_H/DAY_CAP_H = ' + (/var DRIVE_H = (\d+), DAY_CAP_H = (\d+);/.exec(pj) || [0, '未命中']).slice(1).join('/'));
out.push('playH 函数体 = ' + (/function playH\(s\) \{[\s\S]*?\n  \}/.exec(pj) || ['未命中'])[0].replace(/\n\s*/g, ' '));
console.log(out.join('\n'));
