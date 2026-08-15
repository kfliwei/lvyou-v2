/* 补：topic tabbar(nav) role + 按钮 role=tab */
const fs = require('fs');
let s = fs.readFileSync('topic.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
if (s.includes('<nav class="tabbar">')) {
  s = s.split('<nav class="tabbar">').join('<nav class="tabbar" role="tablist" aria-label="页面视图">');
  n++;
}
/* tabbar 内直接 button 加 role=tab（data-tab 按钮） */
s = s.replace(/(<button)([^>]*data-tab="[^"]+")/g, function (m, a, b) {
  if (!m.includes('role=')) { n++; return a + ' role="tab"' + b; }
  return m;
});
fs.writeFileSync('topic.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('topic tabbar a11y:', n);
