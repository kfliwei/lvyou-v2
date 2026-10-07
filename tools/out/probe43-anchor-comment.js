/* 一次性探针：§43 的 A43 锚里有没有哪条与注释文本重叠（决定 ⓪ 那段注释该怎么如实写） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const v = fs.readFileSync(path.join(ROOT, 'tools/verify.js'), 'utf8');
const m = v.match(/const A43 = \[[\s\S]*?\n  \];/);
const Q43 = String.fromCharCode(39);
const TBL = m[0].slice(m[0].indexOf('=') + 1).replace(/;\s*$/, '');
const A43 = eval('(' + TBL + ')');

function strip(s) {
  let o = '', i = 0; const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; o += c; i++;
      while (i < n) { if (s[i] === '\\') { o += s[i] + (s[i + 1] || ''); i += 2; continue; } if (s[i] === q) { o += q; i++; break; } o += s[i]; i++; }
      continue;
    }
    if (c === '/' && s[i + 1] === '*') { const k = s.indexOf('*/', i + 2); i = k < 0 ? n : k + 2; continue; }
    if (c === '/' && s[i + 1] === '/') { const k = s.indexOf('\n', i); i = k < 0 ? n : k; continue; }
    o += c; i++;
  }
  return o;
}
const src = fs.readFileSync(path.join(ROOT, 'planner.js'), 'utf8');
const flat = src.replace(/\s+/g, ' ');
const f2 = strip(src).replace(/\s+/g, ' ');

const pl = A43.filter(a => a[0] === 'planner.js');
let overlap = 0;
pl.forEach(a => {
  const nd = a[1];
  const c1 = flat.split(nd).length - 1, c2 = f2.split(nd).length - 1;
  if (c1 !== c2) { overlap++; console.log('注释里也出现：' + JSON.stringify(nd.slice(0, 44)) + ' 未剥=' + c1 + ' 剥后=' + c2 + ' 期望=' + a[2]); }
});
console.log('A43 的 planner.js 锚 ' + pl.length + ' 条，与注释重叠 ' + overlap + ' 条');
['（可不填，缺省=当前位置）', 'state.days || 5', 'state.end = state.start;', 'var lastStop'].forEach(s =>
  console.log('ZERO 串 ' + JSON.stringify(s) + ' 未剥=' + (flat.split(s).length - 1) + ' 剥后=' + (f2.split(s).length - 1)));
