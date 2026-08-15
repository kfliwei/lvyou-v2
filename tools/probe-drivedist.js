/* 查 amapDriveDist key 获取 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('function amapDriveDist');
console.log(s.slice(i, i + 300));
