/* 看 643 行完整内容（patch 1 写法是否正常） */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
const L = s.split(/\r?\n/);
console.log('643:', JSON.stringify(L[642]));
