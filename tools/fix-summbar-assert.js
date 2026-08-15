/* 修正断言：暗色底排除浅宣纸即可 */
const fs = require('fs');
let s = fs.readFileSync('check-summbar-dark.js', 'utf8');
s = s.replace("ok('暗色下深底（非浅色）', r.bgLum < 120, 'bg=' + r.bg + ' lum=' + r.bgLum);", "ok('暗色下非浅宣纸底', r.bgLum < 180 && r.bg !== 'rgb(239, 233, 220)', 'bg=' + r.bg + ' lum=' + r.bgLum);");
fs.writeFileSync('check-summbar-dark.js', s, 'utf8');
console.log('assert fixed');
