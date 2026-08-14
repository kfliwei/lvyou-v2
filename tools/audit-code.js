/* 静态审核：核心文件问题模式扫描 */
const fs = require('fs');
const path = require('path');
const dir = 'F:/MyAi/trace/lvyou-v2';
const targets = ['topic-common.js', 'node-lod.js', 'travel-notes.js', 'wishlist.html', 'wishlist.js', 'index.html', 'settings.html', 'review.html', 'search.html', 'me.html', 'ui.js', 'theme.js', 'poster.js', 'results.js', 'vault.js', 'geo.js', 'explore-map.html', 'story.html', 'travel-map.html', 'node-manager.html', 'md-manager.html', 'test-data.html', 'sw.js'];
const issues = [];

targets.forEach(f => {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) return;
  const s = fs.readFileSync(fp, 'utf8');
  const lines = s.split('\n');
  const file = f;
  const add = (line, msg) => issues.push({ file, line: line + 1, msg });

  lines.forEach((l, i) => {
    // console.log 残留
    if (/console\.(log|debug)\(/.test(l)) add(i, 'console.log 残留');
    // TODO/FIXME/HACK
    if (/TODO|FIXME|HACK|XXX:/.test(l)) add(i, 'TODO/FIXME: ' + l.trim().slice(0, 60));
    // 重复 id（HTML）
    if (f.endsWith('.html') && /id="([^"]+)"/.test(l)) {
      const id = l.match(/id="([^"]+)"/)[1];
      const cnt = (s.match(new RegExp('id="' + id + '"', 'g')) || []).length;
      if (cnt > 1) add(i, '重复 id: ' + id);
    }
  });
  // 重复函数定义
  const fnNames = [...s.matchAll(/function\s+(\w+)\s*\(/g)].map(m => m[1]);
  const dupFns = fnNames.filter((n, i) => fnNames.indexOf(n) !== i);
  if (dupFns.length) add(0, '重复函数定义: ' + [...new Set(dupFns)].join(', '));
  // 未使用的 var（粗检：声明了但全文只出现一次）
  const varNames = [...s.matchAll(/var\s+(\w+)\s*=/g)].map(m => m[1]);
  varNames.forEach(n => {
    const cnt = (s.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
    if (cnt <= 1) add(0, '疑似未使用变量: ' + n);
  });
});

console.log('=== 审核结果 ===');
const byFile = {};
issues.forEach(i => { (byFile[i.file] = byFile[i.file] || []).push(i); });
Object.keys(byFile).forEach(f => {
  console.log('\n--- ' + f + ' (' + byFile[f].length + ') ---');
  byFile[f].forEach(i => console.log('  L' + i.line + ': ' + i.msg));
});
console.log('\n总计:', issues.length);
