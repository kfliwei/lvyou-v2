/* 批次 11-A 对账：全站第一方文件里「CSS 声明内的裸时序」还剩多少 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DECL = /(?:^|[\s;{"])(transition|animation)(-duration|-delay)?:[^;}]*/g;
const RAW = /(^|[^A-Za-z0-9_.-])\d*\.?\d+(ms|s)\b/;
const SKIP = { vendor: 1, node_modules: 1, docs: 1, tools: 1, assets: 1, images: 1, '.git': 1 };
const files = [];
(function walk(d) {
  fs.readdirSync(d).forEach(n => {
    if (SKIP[n]) return;
    const p = path.join(d, n), st = fs.statSync(p);
    if (st.isDirectory()) return walk(p);
    if (/\.(css|html|js)$/.test(n)) files.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  });
})(ROOT);
let tot = 0;
files.forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hits = [];
  src.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(DECL);
    if (m) m.forEach(seg => { if (RAW.test(seg)) hits.push((i + 1) + ': ' + seg.trim().slice(0, 90)); });
  });
  if (hits.length) { tot += hits.length; console.log(f + ' — ' + hits.length + ' 处'); hits.slice(0, 4).forEach(h => console.log('   ' + h)); }
});
console.log('=== 扫 ' + files.length + ' 个第一方文件，声明内裸时序合计 ' + tot + ' 处 ===');
