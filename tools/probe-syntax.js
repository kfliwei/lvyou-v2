/* 显示 plannerAmapPlan 区域代码找语法问题 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
console.log(L.slice(726, 760).join('\n'));
