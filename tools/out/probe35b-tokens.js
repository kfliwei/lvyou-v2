/* probe35b-tokens.js — 批次 35-B 第一腿：把 travel-notes.js 注入串里的每条 :root 声明逐一定性
 * 用法: node tools/out/probe35b-tokens.js
 * 要回答的问题：摘掉这枚串里的哪些声明是安全的（串内没人用 + 全站没人靠它），
 *   哪些是「同名覆盖」必须改名而不是删除（串内自己在用），哪些根本不用动。
 * 三个口径：
 *   collide  = design.css 的 :root/.theme-dark 里是否声明过同名令牌（同名⇒注入串一定覆盖全站值）
 *   inCss    = 注入串自己内部引用 var(--x) 的次数
 *   outUse   = 全站其余文件（design.css / *.html / *.js）引用 var(--x) 的行数
 * 两把自校准：① 已知会覆盖的 --bg / --fd 必须 collide=是 且 outUse>0；② 一个不存在的名字必须全 0。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
/* 证据由脚本自己写盘（shell 重定向留过 0 字节的坑）：把 console.log 当分叉用 */
const out = [];
const _log = console.log.bind(console);
console.log = s => { out.push(String(s)); _log(s); };
const TN = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
const DESIGN = fs.readFileSync(path.join(ROOT, 'design.css'), 'utf8');

/* 1) 取出注入串：按行扫（`var CSS = '` 起，吃到下一行以 '; 结尾的那一行）
 *    注：写成正则 ((?:[^\n]*\n[^\n]*)*?) 会灾难性回溯，这一支探针就因此挂过一次 */
const lines = TN.split('\n');
const s = lines.findIndex(l => /var CSS = '/.test(l));
let e = -1;
for (let i = s; i < lines.length; i++) { if (/';\s*$/.test(lines[i])) { e = i; break; } }
if (s < 0 || e < 0) { console.log('THROW 没吃到注入串 s=' + s + ' e=' + e); process.exit(1); }
const STR_BLOCK = lines.slice(s, e + 1).join('\n');
const CSS = STR_BLOCK.replace(/^\s*var CSS = '/).replace(/';\s*$/, '').replace(/\\\n/g, '');
console.log('注入串跨行 ' + (e - s + 1) + ' 行（travel-notes.js:' + (s + 1) + '-' + (e + 1) + '），合并后 ' + CSS.length + ' 字符');

/* 2) 枚举串里所有 { } 块中的声明（只取自定义属性） */
const decls = [];
const blockRe = /([^{}]+)\{([^{}]*)\}/g;
let b;
while ((b = blockRe.exec(CSS))) {
  const sel = b[1].trim().replace(/\s+/g, ' ');
  if (!/:root/.test(sel)) continue;
  const body = b[2];
  const dRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+)/g;
  let d;
  while ((d = dRe.exec(body))) decls.push({ sel, name: d[1], val: d[2].trim() });
}
console.log(':root 族块内自定义属性声明 ' + decls.length + ' 条\n');

/* 3) design.css 的同名声明 */
const designNames = new Set();
(function () {
  const dr = /--([a-zA-Z0-9-]+)\s*:/g;
  let x;
  while ((x = dr.exec(DESIGN))) designNames.add('--' + x[1]);
})();

/* 4) 引用计数 */
const countIn = (hay, name) => (hay.match(new RegExp('var\\(\\s*' + name.replace(/-/g, '\\-') + '\\s*[,)]', 'g')) || []).length;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tools' || e.name === 'fonts') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (/\.(js|html|css)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const SRC = {};
for (const f of files) {
  const base = path.basename(f);
  if (base === 'travel-notes.js') continue;
  SRC[base] = fs.readFileSync(f, 'utf8');
}
const TN_OUTSIDE = TN.replace(STR_BLOCK, '');

const rows = Object.keys(SRC).length ? decls.map(dc => {
  let outUse = 0, outFiles = {};
  for (const base of Object.keys(SRC)) {
    const n = countIn(SRC[base], dc.name);
    if (n) { outUse += n; outFiles[base] = n; }
  }
  return {
    ...dc,
    collide: designNames.has(dc.name),
    inCss: countIn(CSS, dc.name),
    outUse,
    outFiles,
    tnUse: countIn(TN_OUTSIDE, dc.name),   /* travel-notes.js 里除注入串以外的引用 */
  };
}) : [];

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log(pad('名字', 10) + pad('design.css同名', 14) + pad('串内引用', 10) + pad('tn.js其他处', 12) + pad('全站引用', 10) + '判定');
for (const r of rows) {
  const verdict = !r.collide && r.inCss === 0 && r.outUse === 0 && r.tnUse === 0
    ? '死声明（串外串内都没人用）'
    : r.collide && r.outUse === 0 && r.tnUse === 0 && r.inCss === 0
      ? '覆盖全站令牌但无人引用 ⇒ 可摘'
      : r.collide && r.inCss === 0 && r.outUse === 0 && r.tnUse > 0
        ? '只 travel-notes.js 自己用 ⇒ 改本地名'
        : r.collide && r.inCss > 0
          ? '覆盖全站令牌 + 串内自用 ⇒ 改本地名（不能摘）'
          : r.collide
            ? '覆盖全站令牌 + 站外/别处自用 ⇒ 改本地名'
            : '不撞名（安全）';
  console.log(pad(r.name, 10) + pad(r.collide ? '是' : '否', 14) + pad(String(r.inCss), 10) + pad(String(r.tnUse), 12) + pad(String(r.outUse), 10) + verdict
    + (Object.keys(r.outFiles).length ? '  站外=' + JSON.stringify(r.outFiles) : ''));
}

const collide = rows.filter(r => r.collide);
console.log('\n与 design.css 同名（＝注入串覆盖全站值）的共 ' + collide.length + ' 条：' + collide.map(r => r.name).join(' '));
console.log('其中站外确有使用者（改这些会动到别的页面）：' + collide.filter(r => r.outUse > 0).map(r => r.name + '(' + r.outUse + ')').join(' '));
console.log('其中串内自己也在用（不能直接摘）：' + collide.filter(r => r.inCss > 0).map(r => r.name + '(' + r.inCss + ')').join(' '));

/* 5) 两把自校准 */
const bg = rows.find(r => r.name === '--bg'), fd = rows.find(r => r.name === '--fd');
console.log('\n自校准：');
console.log('  ① 已知覆盖项 --bg collide=' + (bg && bg.collide) + ' outUse=' + (bg && bg.outUse)
  + ' ｜ --fd collide=' + (fd && fd.collide) + ' outUse=' + (fd && fd.outUse) + '  ⇒ ' + ((bg && bg.collide && fd && fd.collide) ? '过' : '不过（尺子坏了）'));
const ghost = '--zz-not-a-token';
console.log('  ② 不存在的名字 ' + ghost + ' 在 design.css 集合里=' + designNames.has(ghost)
  + ' 全站引用=' + Object.keys(SRC).reduce((s2, k) => s2 + countIn(SRC[k], ghost), 0) + '  ⇒ ' + ((!designNames.has(ghost)) ? '过' : '不过'));
console.log('  ③ design.css 声明过的自定义属性名共 ' + designNames.size + ' 个');
console.log('  ④ 站外受检文件数=' + Object.keys(SRC).length + '（travel-notes.js 已排除）');
fs.writeFileSync(path.join(__dirname, 'b35b-tokens.txt'), out.join('\n') + '\n');
