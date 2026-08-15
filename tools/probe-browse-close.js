/* 查实际内容 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('browseSheet');
console.log(JSON.stringify(s.slice(i - 120, i + 220)));
