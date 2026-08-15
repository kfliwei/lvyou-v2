/* 探查 planner.js：useLocBtn 绑定、schedule、renderMap 全貌 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
console.log('=== useLocBtn 绑定 ===');
const i = s.indexOf('useLocBtn');
console.log(s.slice(i - 100, i + 600));
console.log('=== schedule 函数 ===');
const j = s.indexOf('function schedule(');
console.log(s.slice(j, j + 900));
