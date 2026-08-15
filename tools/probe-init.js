/* init 全貌：川西示例触发条件 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('function init');
const L = s.split('\n');
console.log('init 在 L' + (i > 0 ? s.slice(0, i).split('\n').length : '?'));
const start = i > 0 ? s.slice(0, i).split('\n').length - 1 : 0;
console.log(L.slice(start, start + 60).join('\n'));
