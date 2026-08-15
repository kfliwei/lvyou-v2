/* 查 search.html 结构 */
const fs = require('fs');
const s = fs.readFileSync('search.html', 'utf8').replace(/\r\n/g, '\n');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (/function doSearch|function render|skel|骨架|\.empty/.test(l) && i < 210) console.log((i + 1) + ': ' + l.trim().slice(0, 90));
});
