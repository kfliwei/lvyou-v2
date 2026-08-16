/* 查 verify.js nation-index 校验段 */
const fs = require('fs');
const s = fs.readFileSync('tools/verify.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('nation-index 数据完整性');
console.log(s.slice(i - 50, i + 700));
