/* 查 doSearch 定义 */
const fs = require('fs');
const s = fs.readFileSync('search.html', 'utf8').replace(/\r\n/g, '\n');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('function doSearch') || l.includes('oninput') || l.includes('onkeydown')) console.log((i + 1) + ': ' + l.trim().slice(0, 100));
});
