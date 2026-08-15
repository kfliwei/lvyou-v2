/* 确认 643/663 两行修复后结构完整 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
const L = s.split(/\r?\n/);
[642, 662].forEach(i => console.log((i + 1) + ': ' + JSON.stringify(L[i])));
