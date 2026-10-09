/* tools/out/probe45-mutlines2.js — 第二批 from 串真值（浏览器腿那几条 + node-manager 弹窗那一行）
 * 用法: node tools/out/probe45-mutlines2.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const Q = [
  ['tools/smoke-coord.js', `ok('CO0`],
  ['tools/smoke-coord.js', `ok('CO1`],
  ['tools/smoke-coord.js', `ok('CO2`],
  ['tools/smoke-coord.js', `checks >=`],
  ['tools/smoke-coord.js', `tnViewTime`],
  ['tools/smoke-coord.js', `h.click()`],
  ['tools/smoke-coord.js', `const VW`],
  ['node-manager.html', `nm-coord`],
  ['travel-notes.js', `(n.style ?`],
];
Q.forEach(function (p) {
  const s = fs.readFileSync(path.join(ROOT, p[0]), 'utf8');
  s.split(/\r?\n/).forEach(function (ln, i) {
    if (ln.indexOf(p[1]) < 0) return;
    console.log(p[0] + ':' + (i + 1) + '  ' + JSON.stringify(ln.slice(0, 200)));
  });
});
