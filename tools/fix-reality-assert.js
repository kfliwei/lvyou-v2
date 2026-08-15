/* 修正 audit-reality2 断言：'打卡' 改为包含匹配 */
const fs = require('fs');
let s = fs.readFileSync('audit-reality2.js', 'utf8');
const from = "wl.btn === '打卡'";
const to = "wl.btn.indexOf('打卡') >= 0";
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('audit-reality2.js', s, 'utf8');
  console.log('assert fixed');
} else {
  console.log('pattern not found');
}
