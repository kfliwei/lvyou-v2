/* ② 机制：site-images 映射优先显示实景照（buildSheet img 处） */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!t.includes(from)) { console.log('SKIP', tag); return; }
  t = t.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
/* 1. imgSrc 工具（SITE_IMAGES 映射优先）——插在 nodeIcon 前 */
rep(
  '  function nodeIcon(s, active, dim) {',
  `  /* 实景照映射（tools/gen-site-images.js 生成，高德 POI 图源） */
  function imgSrc(s) {
    try {
      var m = window.SITE_IMAGES || {};
      var u = m[s.id] || m[s.name];
      if (u) return u;
    } catch (e) {}
    return s.img || '';
  }
  function nodeIcon(s, active, dim) {`,
  '2a imgSrc util'
);
/* 2. buildSheet 图片行用 imgSrc（找 img 行） */
const imgLine = "      '<img loading=\"lazy\" src=\"' + s.img + '\" alt=\"' + esc(s.label) + '\" onerror";
if (t.includes(imgLine)) {
  t = t.split(imgLine).join("      '<img loading=\"lazy\" src=\"' + imgSrc(s) + '\" alt=\"' + esc(s.label) + '\" onerror");
  n++;
  console.log('OK  2b buildSheet img');
} else console.log('SKIP 2b');
fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('② patches:', n);
