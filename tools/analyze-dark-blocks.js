/* 分析三页深色块是否一致 */
const fs = require('fs');
function darkBlock(f) {
  const s = fs.readFileSync(f, 'utf8');
  const i = s.indexOf('.theme-dark');
  const j = s.lastIndexOf('.theme-dark');
  if (i < 0) return '';
  /* 从第一个 .theme-dark 前的换行到最后一个规则结束（简单：整个内联 style 区） */
  return s.slice(i, j + 4000);
}
const r = darkBlock('review.html');
const st = darkBlock('settings.html');
const sy = darkBlock('story.html');
console.log('review dark len:', r.length, '| settings:', st.length, '| story:', sy.length);
console.log('review == settings:', r === st);
console.log('settings == story:', st === sy);
/* 逐行 diff review vs settings */
if (r !== st) {
  const rl = r.split('\n'), sl = st.split('\n');
  const max = Math.max(rl.length, sl.length);
  let diffs = 0;
  for (let i = 0; i < max && diffs < 8; i++) {
    if (rl[i] !== sl[i]) { console.log('DIFF L' + (i + 1) + ':\n  R: ' + (rl[i] || '').slice(0, 70) + '\n  S: ' + (sl[i] || '').slice(0, 70)); diffs++; }
  }
  if (!diffs) console.log('前段一致（后续不同）');
}
