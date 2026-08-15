/* 查 state 初始定义与四川默认来源 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('var state');
console.log('=== state 定义 ===');
console.log(s.slice(i, i + 500));
console.log('=== 四川/川西 相关初始化 ===');
const L = s.split('\n');
L.forEach((l, k) => { if (/四川|川西/.test(l) && k < 100) console.log((k + 1) + ': ' + l.trim().slice(0, 110)); });
