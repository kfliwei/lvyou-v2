/* tools/out/probe45-uniq.js — 批次 30 变异网 preflight 前置探针
 * 目的：给 mut-verify45.js 的 from 串逐个数命中次数，并确认各文件 EOL。
 * 数「出现次数」不能用 grep -c（那数的是行）。这里用 split 计次。
 * 用法: node tools/out/probe45-uniq.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const F = [
  'results.js', 'review.html', 'travel-notes.js', 'travel-map.html', 'topic-common.js',
  'node-manager.html', 'md-manager.html', 'vault.js', 'tools/verify.js', 'tools/smoke-coord.js', 'README.md',
];
const NED = [
  ['results.js', `+ '<div class="m">' + esc(n.date)`],
  ['review.html', `'<div class="meta">'+esc(n.date)`],
  ['review.html', `sites[n.lat.toFixed(4)+','+n.lng.toFixed(4)]=1`],
  ['travel-notes.js', `'</h4><div class="tm">' + esc(n.date)`],
  ['travel-notes.js', `it.querySelector('[data-a=copy]').onclick`],
  ['travel-notes.js', `} else legacy();`],
  ['travel-notes.js', `ctx.fillText(n.date, 70, 285);`],
  ['travel-notes.js', `esc(n.style)`],
  ['travel-map.html', `chip.setAttribute('aria-label','这一篇：'`],
  ['travel-map.html', `fillSheet('<div class="ms-place">'+place+'</div>'`],
  ['travel-map.html', `if(map) map.flyTo(gxy(n.lat,n.lng)`],
  ['travel-map.html', `const locHtml=`],
  ['topic-common.js', `if (dy >= 1) { sheetRaised = Math.round(dy);`],
  ['node-manager.html', `'<div class="is-coord">坐标 · '`],
  ['md-manager.html', `rows.push(['坐标', n.lat.toFixed(4)`],
  ['vault.js', `'<p class="meta">坐标 · '`],
  ['tools/verify.js', `const flat45 = s => ws45(stripBlockComments(s));`],
  ['tools/verify.js', `if (CS45 < 20)`],
  ['tools/verify.js', `if (CL45 !== 5)`],
  ['tools/verify.js', `if (CO45 < 15)`],
];
F.forEach(f => {
  const p = path.join(ROOT, f);
  const s = fs.readFileSync(p, 'utf8');
  console.log(f + '  EOL=' + (s.indexOf('\r\n') >= 0 ? 'CRLF' : 'LF') + '  行数=' + s.split(/\r?\n/).length + '  §45出现=' + (s.split('§45').length - 1));
});
console.log('--- needle 命中次数（出现次数，不是行数）---');
NED.forEach(([f, n]) => {
  if (!f || !n) return;
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  console.log((s.split(n).length - 1) + '  ' + f + '  ⟦' + n.slice(0, 44) + '⟧');
});
