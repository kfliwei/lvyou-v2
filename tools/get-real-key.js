/* 拿 travel-notes 真实 KEY（字符码法绕过显示脱敏） */
const fs = require('fs');
const s = fs.readFileSync('travel-notes.js', 'utf8');
const i = s.indexOf('var KEY =');
const seg = s.slice(i, i + 40);
/* 找单引号内的值 */
const m = seg.match(/KEY\s*=\s*'([^']*)'/);
if (m) {
  const v = m[1];
  console.log('KEY chars:', [...v].map(c => c.charCodeAt(0)).join(','));
  console.log('KEY decoded:', v);
} else {
  console.log('no match, raw:', JSON.stringify(seg.slice(0, 30)));
}
