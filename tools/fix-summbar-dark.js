/* 补：.theme-dark .summbar 背景（现有规则只改了阴影） */
const fs = require('fs');
let s = fs.readFileSync('planner.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = '.theme-dark .summbar{box-shadow:0 8px 30px rgba(0,0,0,.5)}';
const to = '.theme-dark .summbar{background:var(--color-primary);color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.5)}';
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('summbar dark bg added');
} else console.log('miss');
