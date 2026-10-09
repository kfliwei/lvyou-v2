/* 批次 30-A 现场标定二：全站把经纬度真的画到屏上的落点，穷举而不是只数 toFixed(4|5)。
 * 上一轮的「8 处」漏掉了 node-manager.html 的 (+s.lat).toFixed(5) 形状，因为模式要求 lat 紧接 toFixed。
 * 这一份改成：任意一行里同时出现 lat 与 lng（或 latitude/longitude），再判它有没有 DOM 拼串信号。
 * 用法: node tools/out/probe45-coord-all.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f));
const DOM = ['<div', '<span', '<p', '<b', '<li', '<td', 'innerHTML', 'fillText', 'bindPopup', 'textContent', 'insertAdjacent', 'createElement'];
let a = 0, b = 0;
files.forEach(f => {
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((ln, i) => {
    const L = ln.toLowerCase();
    if (!(L.includes('lat') && L.includes('lng'))) return;
    if (!/tofixed|lat\s*[,，]\s*|\.lat\b|\.lng\b/.test(L)) return;
    const dom = DOM.some(k => ln.includes(k));
    if (!dom) return;
    a++;
    console.log((ln.includes('坐标') ? 'KEEP-LABELED  ' : 'BARE-ON-SCREEN ') + f + ':' + (i + 1) + '  ' + ln.trim().slice(0, 150));
  });
});
console.log('=== 有 DOM 信号的坐标行 ' + a + ' 行，其中裸串 ' + (a - b) + '（上列 BARE） ===');
