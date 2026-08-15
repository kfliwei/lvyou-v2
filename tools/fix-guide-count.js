/* 修正首启引导文案：34 省 · 36 专题 分列 */
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = "d:'7833 处景点 · 36 省专题地图 · 搜索直达，山川湖海一键抵达'";
const to = "d:'7833 处景点 · 34 省 · 36 专题地图 · 搜索直达，山川湖海一键抵达'";
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('index.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('guide text fixed');
} else console.log('miss');
