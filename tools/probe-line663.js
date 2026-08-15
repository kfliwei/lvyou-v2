/* 663 行字节分析 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
const L = s.split(/\r?\n/);
const l = L[662];
console.log('line chars:', l.length);
console.log('raw json:', JSON.stringify(l));
