/* 显示 amapDriveDist/orderByMatrix 区域 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
console.log(L.slice(660, 726).join('\n'));
