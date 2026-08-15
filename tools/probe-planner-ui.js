/* 探查 planner.html：summbar 结构、弹层容器、useLoc */
const fs = require('fs');
const s = fs.readFileSync('planner.html', 'utf8').replace(/\r\n/g, '\n');
const lines = s.split('\n');
console.log('=== summbar HTML ===');
lines.forEach((l, i) => { if (l.includes('summbar')) console.log((i + 1) + ': ' + l.trim().slice(0, 130)); });
console.log('=== popup/sheet/mask 容器 ===');
lines.forEach((l, i) => { if (/popup|sheet|mask|modal|dialog|overlay/.test(l) && i < 400) console.log((i + 1) + ': ' + l.trim().slice(0, 110)); });
console.log('=== useLoc / geolocation ===');
const js = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const j = js.indexOf('useLoc');
console.log(js.slice(Math.max(0, j - 200), j + 500));
