/* 查 USER_KEY 真实值（字节级） */
const fs = require('fs');
const s = fs.readFileSync('node-manager.html', 'utf8');
const i = s.indexOf('var USER_KEY');
console.log(JSON.stringify(s.slice(i, i + 60)));
/* 测试也读这个键 */
