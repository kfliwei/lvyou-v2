/* UI-5 取数：动 design.css 之前先把「两族阴影 / 毛玻璃 / 颗粒 / 字面量双写」的真实挂点全列出来。
   只读，不改任何文件。注释一律剥成等长空白，行号才是真行号。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);

const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
const files = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
const lines = f => strip(fs.readFileSync(f, 'utf8')).split('\n');

/* 找某一行所处的选择器：往上找最近一条以 { 结尾的行 */
function ctx(fl, i) {
  for (let j = i; j >= 0; j--) {
    const t = fl[j].trim();
    if (j === i && /\{/.test(t) && !/^@/.test(t)) return t.replace(/\{.*$/, '').trim();
    if (/[^{}]*\{[^{}]*$/.test(fl[j])) {
      const m = fl[j].match(/([^{};]*)\{([^{}]*)$/);
      if (m) return (m[1].trim() || ('(inline) ' + m[2].trim().slice(0, 40))).slice(0, 60);
    }
    if (i !== j && /\{/.test(t) && !/^@/.test(t)) return t.replace(/\{.*$/, '').trim().slice(0, 60);
  }
  return '?';
}

function scan(label, re, opts) {
  const out = [];
  let n = 0;
  files.forEach(f => {
    const fl = lines(f);
    fl.forEach((L, i) => {
      if (!re.test(L)) return;
      const c = (L.match(re) || []).length;
      n += c;
      if (opts && opts.perLine) return;
      out.push(f + ':' + (i + 1) + ' [' + ctx(fl, i) + '] ' + L.trim().slice(0, opts && opts.cut || 110));
    });
  });
  console.log('\n=== ' + label + ' 共 ' + n + ' 处 ===');
  out.forEach(o => console.log(o));
  return n;
}

scan('--sh-sm', /var\(--sh-sm\)/);
scan('--sh-md', /var\(--sh-md\)/);
scan('--sh-lg', /var\(--sh-lg\)/);
scan('--shadow-soft', /var\(--shadow-soft\)/);
scan('--shadow-medium', /var\(--shadow-medium\)/);
scan('--shadow-float', /var\(--shadow-float\)/);
scan('--shadow-pop', /var\(--shadow-pop\)/);
scan('backdrop-filter', /backdrop-filter\s*:/);
scan('--grain 引用', /var\(--grain\)/);
scan('阴影字面量（box-shadow 里直接写 rgba，不走 token）', /box-shadow[^;\n]*rgba\(/);
scan('遮罩字面量 rgba(0,0,0', /rgba\(0,0,0/);
scan('遮罩字面量 rgba(20,16,12', /rgba\(20,16,12/);
scan('暖墨字面量 rgba(33,26,19', /rgba\(33,26,19/);
scan('夜墨字面量 rgba(32,32,29', /rgba\(32,32,29/);
scan('rgba(27,23,19', /rgba\(27,23,19/);

/* backdrop-filter 的取值分布 + 是否有 -webkit- 前缀配对 */
console.log('\n=== backdrop-filter 取值聚合 ===');
const vals = {};
let noWebkit = [];
files.forEach(f => {
  const fl = lines(f);
  fl.forEach((L, i) => {
    const m = L.match(/(-webkit-)?backdrop-filter\s*:\s*([^;}]+)/);
    if (!m) return;
    if (m[1]) return;
    const v = m[2].trim();
    vals[v] = (vals[v] || 0) + 1;
    if (!/(-webkit-)backdrop-filter/.test(fl.slice(Math.max(0, i - 2), i + 1).join('\n'))) noWebkit.push(f + ':' + (i + 1) + ' ' + v);
  });
});
Object.keys(vals).sort((a, b) => vals[b] - vals[a]).forEach(v => console.log(vals[v] + '×  ' + v));
console.log('--- 缺 -webkit- 配制的（iOS/旧安卓可能整条不生效）: ' + noWebkit.length + ' 处');
noWebkit.forEach(x => console.log('  ' + x));

/* 每个文件用了哪些阴影族，判断合流的迁移面 */
console.log('\n=== 按文件聚合：阴影两族 + 毛玻璃 ===');
files.forEach(f => {
  const t = strip(fs.readFileSync(f, 'utf8'));
  const a = (t.match(/var\(--sh-(sm|md|lg)\)/g) || []).length;
  const b = (t.match(/var\(--shadow-(soft|medium|float|pop)\)/g) || []).length;
  const c = (t.match(/[^-]backdrop-filter\s*:/g) || []).length;
  const d = (t.match(/box-shadow[^;\n]*rgba\(/g) || []).length;
  if (a || b || c || d) console.log((f + '                 ').slice(0, 22) + ' sh族=' + a + '  shadow族=' + b + '  blur=' + c + '  裸rgba阴影=' + d);
});
