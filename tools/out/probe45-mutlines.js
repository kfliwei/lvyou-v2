/* tools/out/probe45-mutlines.js — 变异网 from 串取真值：把要改的那几行原样打出来（JSON 串，含缩进）
 * 用法: node tools/out/probe45-mutlines.js
 * 为什么要有这个：变异网的 from 串只要缩进差一格，preflight 就会数到 0 命中；
 * 而「0 命中」在运行时表现为「这条变异打不红」，读起来像闸门失灵，实际是串漂了。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const Q = [
  ['results.js', `<div class="m">`],
  ['review.html', `<div class="meta">`],
  ['review.html', `sites[n.lat.toFixed(4)`],
  ['travel-notes.js', `<div class="tm">`],
  ['travel-notes.js', `margin-bottom:8px`],
  ['travel-notes.js', `ctx.fillText(n.date`],
  ['travel-notes.js', `esc(n.style)`],
  ['travel-notes.js', `var txt = (n.title`],
  ['travel-notes.js', `} else legacy();`],
  ['travel-map.html', `chip.setAttribute('aria-label'`],
  ['travel-map.html', `'<div class="ms-time">'`],
  ['travel-map.html', `.ms-place{`],
  ['travel-map.html', `ms-photos`],
  ['topic-common.js', `途经点随手记`],
  ['node-manager.html', `is-coord`],
  ['md-manager.html', `rows.push(['坐标'`],
  ['vault.js', `坐标 ·`],
  ['tools/smoke-coord.js', `if (h) h.click();`],
  ['tools/smoke-coord.js', `const BARE_SRC`],
];
Q.forEach(function (p) {
  const s = fs.readFileSync(path.join(ROOT, p[0]), 'utf8');
  s.split(/\r?\n/).forEach(function (ln, i) {
    if (ln.indexOf(p[1]) < 0) return;
    console.log(p[0] + ':' + (i + 1) + '  ' + JSON.stringify(ln));
  });
});
