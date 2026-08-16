/* 查看 aiAddNode run 函数 + node-manager 索引解析 */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
const L = h.split('\n');
/* 找 run 函数（aiAddNode 内） */
L.forEach((l, i) => { if (/function run\(\)/.test(l)) console.log('run 在 L' + (i + 1)); });
console.log('--- 120-160 索引解析 ---');
console.log(L.slice(119, 160).join('\n'));
console.log('--- 搜索函数 ---');
L.forEach((l, i) => { if (/function .*[Ss]earch|place\/text|amapPlace|高德/.test(l) && i > 100 && i < 700) console.log((i + 1) + ': ' + l.trim().slice(0, 110)); });
