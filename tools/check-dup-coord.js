/* 检查 nx-data.js 同坐标条目 */
const fs = require('fs');
const s = fs.readFileSync('F:/MyAi/trace/lvyou-v2/nx-data.js', 'utf8');
const items = s.match(/\{"name":"[^"]+".*?\}/g) || [];
const byPos = {};
items.forEach(it => {
  const name = (it.match(/"name":"([^"]+)"/) || [])[1];
  const lat = (it.match(/"lat":([\d.+-]+)/) || [])[1];
  const lng = (it.match(/"lng":([\d.+-]+)/) || [])[1];
  const key = lat + ',' + lng;
  if (!byPos[key]) byPos[key] = [];
  byPos[key].push(name);
});
let dups = 0;
Object.keys(byPos).forEach(k => {
  if (byPos[k].length > 1) { dups++; console.log(k, '→', byPos[k].join(' | ')); }
});
console.log('同坐标组数:', dups, '/', Object.keys(byPos).length);
