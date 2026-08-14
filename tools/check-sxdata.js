const fs = require('fs');
const s = fs.readFileSync('F:/MyAi/trace/lvyou-v2/data.js', 'utf8');
const m = [...s.matchAll(/"flag"\s*:\s*"([mh]+)"/g)];
console.log('data.js(山西古建) flag 数量:', m.length);
// 每个 flag 对应的 name
const items = s.match(/\{"name":"[^"]+".*?\}/g) || [];
let fm = 0, fh = 0;
items.forEach(it => { if (/"flag"\s*:\s*"m"/.test(it)) fm++; if (/"flag"\s*:\s*"h"/.test(it)) fh++; });
console.log('条目数:', items.length, 'm:', fm, 'h:', fh);
