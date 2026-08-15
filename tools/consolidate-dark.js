/* 深色收敛 v2：三页共有的 dark 行 → design.css，页面删除（逐行交集） */
const fs = require('fs');

function darkLines(f) {
  const s = fs.readFileSync(f, 'utf8');
  return new Set(s.split('\n').filter(l => l.includes('.theme-dark')).map(l => l.trim()));
}
const [r, st, sy] = ['review.html', 'settings.html', 'story.html'].map(darkLines);
/* 三页交集 */
const common = [...r].filter(l => st.has(l) && sy.has(l));
console.log('三页共有 dark 行:', common.length, '（review:', r.size, 'settings:', st.size, 'story:', sy.size, '）');

/* 1. design.css 追加（逐行去重） */
let d = fs.readFileSync('design.css', 'utf8');
const dcrlf = d.includes('\r\n');
if (dcrlf) d = d.replace(/\r\n/g, '\n');
const marker = '\n/* 深色收敛 2026-08-15：review/settings/story 公共深色规则（原三页内联重复） */\n';
let added = 0;
let body = '';
common.forEach(l => {
  if (!d.includes(l)) { body += l + '\n'; added++; }
});
if (added) {
  fs.writeFileSync('design.css', dcrlf ? (d + marker + body).replace(/\n/g, '\r\n') : d + marker + body, 'utf8');
  console.log('design.css 追加', added, '行');
} else console.log('design.css 无需追加（全部已存在）');

/* 2. 三页删除共有行 */
['review.html', 'settings.html', 'story.html'].forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  const lines = s.split('\n');
  const before = lines.length;
  const filtered = lines.filter(l => !common.includes(l.trim()) || !l.includes('.theme-dark'));
  fs.writeFileSync(f, crlf ? filtered.join('\n').replace(/\n/g, '\r\n') : filtered.join('\n'), 'utf8');
  console.log(f, '删除', before - filtered.length, '行');
});
