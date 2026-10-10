/* 批次 33-E 地基探针 第二支：换刀的安全性
   §39 的 flat39 用 naive 正则剥块注释；§41/42/43/44/45 已改用字符串感知的 stripBlockComments。
   要把 travel-notes.js（注入串里 108 处 CSS 注释）纳入 FILES39，先要回答两个问题：
     K1 对现有 FILES39 的非 html 文件，两把刀读出来的视图是否逐字相同？
        相同 ⇒ 换刀不动任何一根既有锚的命中数（换刀是安全动作）；
        不同 ⇒ 必须逐处看清分歧在哪，否则换完刀一片红/一片绿都不是证据。
     K2 naive 那把刀在 travel-notes.js 里具体吞掉了什么？把「被吞掉且含 width/height 的片段」数出来。
        这才是「各页只留皮肤」这条判据的假绿面积。
   只读数，不改盘。 */
const fs = require('fs');

const ws = s => s.replace(/\s+/g, ' ').trim();
function stripSmart(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === q) { out += q; i++; break; }
        out += src[i++];
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? src.length : e + 2;
      continue;
    }
    if (c === '/' && src[i + 1] === '/' && src[i + 2] !== '*') {
      // 只处理 JS 行注释到行尾：保持与 verify.js 那把刀的差异最小，这里只比块注释
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
const naive = s => ws(s.replace(/\/\*[\s\S]*?\*\//g, ''));
const smart = s => ws(stripSmart(s));

/* ---------- K1 ---------- */
const FILES = ['design.css', 'map.css', 'tools/smoke-topbar.js', 'README.md', 'travel-notes.js', 'me.html'];
console.log('K1 两把刀逐字等价性（现有 FILES39 的非 html 文件 + 待纳入的两个）');
FILES.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  const a = naive(s), b = smart(s);
  const same = a === b;
  console.log('  ' + f.padEnd(24) + (same ? '逐字相同【换刀不动锚】' : '不同：smart 比 naive 多 ' + (b.length - a.length) + ' 字符'));
  if (!same) {
    let k = 0;
    while (k < Math.min(a.length, b.length) && a[k] === b[k]) k++;
    console.log('     首个分歧 @' + k);
    console.log('     naive : …' + a.slice(Math.max(0, k - 24), k + 60) + '…');
    console.log('     smart : …' + b.slice(Math.max(0, k - 24), k + 60) + '…');
  }
});

/* ---------- K2 ---------- */
const src = fs.readFileSync('travel-notes.js', 'utf8');
const a = naive(src), b = smart(src);
const GEO = /(?:min-|max-)?(?:width|height)\s*:/g;
const na = (a.match(GEO) || []).length, sm = (b.match(GEO) || []).length;
console.log('\nK2 travel-notes.js 尺寸声明计数：naive 视图 ' + na + ' 处 / 智能视图 ' + sm + ' 处，naive 少读 ' + (sm - na) + ' 处');
const DCLA = /(?:^|[;{ ])color\s*:/g;
console.log('   对照：color: 计数 naive ' + (a.match(DCLA) || []).length + ' / smart ' + (b.match(DCLA) || []).length);
// 被吞掉的片段里，哪些是「规则体」？把 smart 视图里有而 naive 视图里没有的选择器列出来
function bodySet(v) {
  const set = new Set();
  const re = /([.#][A-Za-z0-9_-][^{ }]*)\{[^}]*\}/g;
  let m;
  while ((m = re.exec(v))) set.add(m[1] + '{' + m[0].slice(m[1].length + 1));
  return set;
}
const missing = [...bodySet(b)].filter(x => !a.includes(x.slice(0, 46)));
console.log('   smart 视图抽到 ' + bodySet(b).size + ' 条规则，naive 视图看不见前 46 字符相同的有 ' + missing.length + ' 条');
missing.slice(0, 12).forEach(x => console.log('     吞: ' + x.slice(0, 88)));
const missingGeo = missing.filter(x => GEO.test(x));
console.log('   其中被吞掉的规则里含尺寸声明的：' + missingGeo.length + ' 条');
missingGeo.slice(0, 8).forEach(x => console.log('     吞(含尺寸): ' + x.slice(0, 88)));
