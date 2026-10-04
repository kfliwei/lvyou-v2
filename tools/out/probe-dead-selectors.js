/* 一次性体检：把 tools/ 里所有冒烟与审计脚本写死的元素选择器抠出来，逐个回第一方源码里找。
   找不到的就是「死的断言」——它永远拿到 null / 空数组，断言要么恒真要么恒假，没人会察觉。
   （本轮就是这么抓到 smoke.js 的 #wlPlanBtn：批次 6 把入口换成直链锚点后断言再没绿过。）
   跑法：node tools/out/probe-dead-selectors.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const SRC_EXT = ['.html', '.js', '.css'];
const srcFiles = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (f === 'node_modules' || f === '.git' || f === 'out' || f === 'android_app' || f === 'docs') continue;
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (SRC_EXT.includes(path.extname(f))) srcFiles.push(p);
  }
})(ROOT);
const SRC = srcFiles.map(f => ({ f: path.relative(ROOT, f).replace(/\\/g, '/'), s: fs.readFileSync(f, 'utf8') }));

const toolFiles = fs.readdirSync(path.join(ROOT, 'tools'))
  .filter(f => /^(smoke|audit|visual|gen-sw)/.test(f) && f.endsWith('.js'));

/* 只认字面量：变量拼出来的选择器（模板串里带 ${}）跳过，那种没法静态对账 */
const PATTERNS = [
  { re: /getElementById\(\s*'([^'"]+)'\s*\)/g, kind: 'id' },
  { re: /getElementById\(\s*"([^'"]+)"\s*\)/g, kind: 'id' },
  { re: /querySelector(?:All)?\(\s*'([.#][A-Za-z0-9_-]+)'\s*\)/g, kind: 'cls' },
  { re: /querySelector(?:All)?\(\s*"([.#][A-Za-z0-9_-]+)"\s*\)/g, kind: 'cls' }
];

const found = new Map();
for (const t of toolFiles) {
  const s = fs.readFileSync(path.join(ROOT, 'tools', t), 'utf8');
  for (const p of PATTERNS) {
    let m;
    while ((m = p.re.exec(s))) {
      const sel = m[1];
      if (/\$\{|\|/.test(sel)) continue;
      const key = p.kind + ':' + sel;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(t + ':' + ((s.slice(0, m.index).match(/\n/g) || []).length + 1));
    }
  }
}

let dead = 0;
for (const [key, where] of [...found.entries()].sort()) {
  const kind = key.split(':')[0];
  const sel = key.slice(kind.length + 1);
  const needle = kind === 'id' ? 'id="' + sel + '"' : sel;
  const hit = SRC.filter(x => x.s.indexOf(needle) >= 0);
  if (!hit.length) { dead++; console.log('✗ ' + needle + '  ← ' + where.join(', ') + '（第一方源码里找不到）'); }
}
console.log('对账：静态抠出 ' + found.size + ' 个字面量选择器，源码里找不到的 ' + dead + ' 个');
process.exit(dead ? 1 : 0);
