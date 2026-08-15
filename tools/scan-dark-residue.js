/* 扫描：各页面 .theme-dark 内联规则分布 */
const fs = require('fs');
const files = fs.readdirSync('.').filter(f => /\.html$/.test(f) && !f.startsWith('test-'));
let total = 0;
files.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  const count = (s.match(/\.theme-dark\b/g) || []).length;
  total += count;
  if (count) console.log(f.padEnd(22), count, '处');
});
console.log('合计:', total);
/* 各页面 dark 规则的选择器前缀（判断通用性） */
files.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  const sels = [];
  const re = /\.theme-dark\s+([^{,]+)/g;
  let m;
  while ((m = re.exec(s))) sels.push(m[1].trim().split(/\s+/).pop());
  if (sels.length) console.log('---', f, ':', sels.slice(0, 14).join(' '));
});
