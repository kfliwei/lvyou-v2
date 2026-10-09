/* 批次 30-A 现场标定：全站还有多少行在拼坐标，各自住在什么上下文里。
 * §45 那条动态扫描的「放行 / 报警」口径要从这份读数里取，不能凭印象。
 * 用法: node tools/out/probe45-coord-scan.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const RX = /\.toFixed\(\s*[45]\s*\)/;
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && f !== 'sw.js');
let n = 0;
files.forEach(f => {
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((ln, i) => {
    if (!RX.test(ln)) return;
    n++;
    const ctx = ['<div', '<span', '<p', '<b', 'innerHTML', 'fillText', 'bindPopup', 'textContent', 'insertAdjacent', 'rows.push', '坐标'].filter(k => ln.indexOf(k) >= 0);
    console.log(f + ':' + (i + 1) + '  [' + (ctx.join(',') || 'NO-DOM-SIGNAL') + ']  ' + ln.trim().slice(0, 170));
  });
});
console.log('=== 合计 ' + n + ' 行 ===');
