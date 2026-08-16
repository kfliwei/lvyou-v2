/* smoke.js 里 wishlist 测试段 */
const fs = require('fs');
const s = fs.readFileSync('tools/smoke.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
L.forEach((l, i) => { if (l.includes('wishlist') || l.includes('无数据')) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });
