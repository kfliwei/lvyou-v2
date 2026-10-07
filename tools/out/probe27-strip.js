const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 从 verify.js 里 eval 出真身，不手抄（抄一份就会和闸门里那份漂移） */
const V = fs.readFileSync(path.join(ROOT, 'tools/verify.js'), 'utf8');
const start = V.indexOf('function stripBlockComments(s) {');
const end = V.indexOf('\n}\n', start) + 3;
if (start < 0) { console.log('中止：verify.js 里没有 stripBlockComments'); process.exit(2); }
const stripBlockComments = eval('(' + V.slice(start, end).replace('function stripBlockComments(s) {', 'function(s) {') + ')');

const naive = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const ws = s => s.replace(/\s+/g, ' ');

const FILES = ['travel-notes.js', 'results.js', 'design.css', 'map.css', 'ui.js'];
const PROBES = ['id="tnQuotes"', 'id="tnFile"', 'accept="image/*"', 'id="tnExpense"',
  'function zoomPhoto(src) {', 'zoomPhotoIdx: zoomPhotoIdx,', 'class="ui-modal-x"',
  'id="tnConfirm"', '@keyframes tnPickFade'];

FILES.forEach(f => {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const a = ws(naive(raw)), b = ws(stripBlockComments(raw));
  console.log('--- ' + f + '  raw=' + raw.length + ' naive=' + a.length + ' stripped=' + b.length +
    '  被吃=' + (raw.length - a.length) + ' vs ' + (raw.length - b.length));
  PROBES.forEach(p => {
    const inA = a.indexOf(p) >= 0, inB = b.indexOf(p) >= 0;
    if (inA !== inB || !inB) {
      if (p !== 'id="tnConfirm"') console.log('   探针「' + p + '」 naive=' + inA + ' new=' + inB);
    }
  });
});

// 假注释区间定位（naive 版在 travel-notes.js 上从哪吃到哪）
const src = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
const re = /\/\*[\s\S]*?\*\//g;
let m, spans = [];
while ((m = re.exec(src))) spans.push([src.slice(0, m.index).split(/\r?\n/).length,
  src.slice(0, m.index + m[0].length).split(/\r?\n/).length, m[0].length]);
const big = spans.filter(s => s[2] > 200);
console.log('naive 在 travel-notes.js 里剥掉的超长区间（>200 字符）：');
big.forEach(s => console.log('   行 ' + s[0] + ' → ' + s[1] + '，' + s[2] + ' 字符'));
console.log('新剥法在同一文件里剥掉的超长区间（>200 字符）：');
const re2 = /[\s\S]/g;
// 直接比对：新法留下的长度 vs 原法
console.log('   naive 保留 ' + ws(naive(src)).length + '，新法保留 ' + ws(stripBlockComments(src)).length +
  '，原文 ' + ws(src).length);
