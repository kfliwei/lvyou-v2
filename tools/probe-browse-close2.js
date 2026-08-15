/* 找关闭按钮实际文本 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('关闭</button>');
console.log('--- 关闭按钮上下文 ---');
console.log(s.slice(i - 260, i + 40));
