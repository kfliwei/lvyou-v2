/* 查 init 尾部：川西示例触发条件 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
console.log(L.slice(828, 860).join('\n'));
