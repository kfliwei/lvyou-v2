/* 批次 30-B 现场标定三：§45 那条动态扫描器「按将要写进 verify.js 的同一口径」先跑一遍全站根目录。
 * 为什么全量而不只数我点单那 8 处：上一轮的「8 处」就是被窄文件名单 + 窄模式坑出来的
 * （(+s.lat).toFixed(5) 这种带括号的形状、以及 node-manager.html 这个没进名单的文件，两个都漏）。
 * 用法: node tools/out/probe45-scan-rule.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const RENDER = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'textContent', 'rows.push('];
const GEO = ['L.marker(', 'divIcon(', 'setLatLng', 'circleMarker'];
const isCoordLine = ln => ln.indexOf('.toFixed(') >= 0 && /lat/i.test(ln) && /lng/i.test(ln);
const SCAN = src => {
  const r = { sites: 0, kept: 0, out: [] };
  src.split('\n').forEach((ln, i) => {
    if (!isCoordLine(ln)) return;
    r.sites++;
    if (ln.indexOf('坐标') >= 0) { r.kept++; return; }          /* 显式标签：这一行说的是「这是坐标」，放行 */
    if (GEO.some(k => ln.indexOf(k) >= 0)) { r.kept++; return; } /* 几何行：坐标是拿来定位的，不是拿来读的 */
    if (!RENDER.some(k => ln.indexOf(k) >= 0)) { r.kept++; return; } /* 键 / URL / 缓存：不在屏上 */
    r.out.push('第 ' + (i + 1) + ' 行  ' + ln.replace(/\s+/g, ' ').trim().slice(0, 110));
  });
  return r;
};

const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f));
let S = 0, K = 0, O = 0;
files.forEach(f => {
  const r = SCAN(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  S += r.sites; K += r.kept; O += r.out.length;
  r.out.forEach(o => console.log('BARE  ' + f + ':' + o));
});
console.log('=== 根目录 ' + files.length + ' 个文件：坐标行 ' + S + '，放行 ' + K + '，越界 ' + O + ' ===');

/* 自校准：同一把刀必须能在改前原件上读出 1，在三种放行形状上读出 0 */
const BAD = "      + '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>'";
const OK1 = "    if (n.lat != null) rows.push(['坐标', n.lat.toFixed(4) + ', ' + n.lng.toFixed(4)]);";
const OK2 = "  const k = n.lat.toFixed(4)+','+n.lng.toFixed(4);";
const OK3 = "    var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: '<span class=\"map-pin\"><b>' + (i + 1) + '</b></span>' }) });";
const OK4 = "      '<div class=\"is-coord\">坐标 · ' + (+s.lat).toFixed(5) + ', ' + (+s.lng).toFixed(5) + '</div>' +";
[[BAD, 1, '坏样本'], [OK1, 0, '带「坐标」标签'], [OK2, 0, '去重键'], [OK3, 0, 'divIcon 几何行'], [OK4, 0, '补了标签的面板行']].forEach(function (p) {
  const r = SCAN(p[0]);
  console.log((r.out.length === p[1] ? '校准 OK   ' : '校准 FAIL ') + p[2] + ' → sites=' + r.sites + ' 越界=' + r.out.length + '（期望 ' + p[1] + '）');
});
