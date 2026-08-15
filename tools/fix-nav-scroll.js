/* 修复：pageIn opacity-only（CRLF 兼容） */
const fs = require('fs');
let s = fs.readFileSync('design.css', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = '@keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';
const to = '@keyframes pageIn{from{opacity:0}to{opacity:1}}';
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('design.css', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('pageIn opacity-only');
} else {
  console.log('pattern not found');
}
