/* 查 643 行及后续（字符串结构） */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
const L = s.split(/\r?\n/);
for (let i = 640; i < 648; i++) console.log((i + 1) + ': ' + JSON.stringify(L[i]));
