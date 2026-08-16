/* 查看 aiAddNode 与 220-240 行 */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
const L = h.split('\n');
console.log('--- 331 aiAddNode ---');
console.log(L.slice(330, 400).join('\n'));
console.log('--- 220-240 ---');
console.log(L.slice(219, 242).join('\n'));
