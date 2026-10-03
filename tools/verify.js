/* tools/verify.js — 全站改动验证：编码 / JS 语法 / 残留 alert 检查 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['ui.js','index.html','search.html','wishlist.html','travel-map.html','md-manager.html','settings.html','me.html','explore-map.html','topic.html','review.html','story.html','test-data.html','node-manager.html','topic-common.js','design.css','nation-index.js','travel-notes.js','results.js','poster.js','node-lod.js','wishlist.js','geo.js','quotes.js','vault.js','theme.js'].filter(f => fs.existsSync(f));

let fail = 0;

/* 1. UTF-8 有效性 + 无 BOM */
for (const f of FILES) {
  const buf = fs.readFileSync(f);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) { console.log('BOM FOUND:', f); fail++; }
  const s = buf.toString('utf8');
  if (s.includes('\uFFFD')) { console.log('UTF8 CORRUPT:', f); fail++; }
}

/* 2. 内联脚本语法检查（HTML 文件） */
function checkInline(f) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(s))) {
    i++;
    const code = m[1];
    try { new vm.Script(code, { filename: f + '#inline' + i }); }
    catch (e) { console.log('SYNTAX FAIL:', f, 'inline#' + i, ':', e.message); fail++; }
  }
  return i;
}
for (const f of FILES.filter(x => x.endsWith('.html'))) checkInline(f);

/* 3. 独立 JS 语法检查 */
for (const f of FILES.filter(x => x.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { console.log('SYNTAX FAIL:', f, ':', e.message); fail++; }
}

/* 4. 残留原生 alert/confirm（页面级） */
for (const f of FILES.filter(x => x.endsWith('.html'))) {
  const s = fs.readFileSync(f, 'utf8');
  const al = (s.match(/[^.\w]alert\(/g) || []).length;
  const co = (s.match(/[^.\w]confirm\(/g) || []).length;
  if (al || co) { console.log('NATIVE ALERT/CONFIRM LEFT:', f, 'alert:', al, 'confirm:', co); fail++; }
}

/* 5. nation-index 数据完整性（格式 ≥9 列；与各省源数据文件动态对比） */
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ctx);
const raw = ctx.window.NATION_SITES_RAW;
const rows = raw.split('\n').filter(Boolean);
const n = rows.length;
const bad = rows.filter(l => { const p = l.split('|'); return p.length < 9 || !isFinite(parseFloat(p[7])) || !isFinite(parseFloat(p[8])); }).length;
let srcCount = -1, coverMiss = -1;
try {
  const c2 = { window: {}, console };
  vm.createContext(c2);
  const PROV_FILES = ['ah','bj','cq','data','fj','gd','gs','gxyn','gz','ha','hb','he','hi','hk','hlj','hn','jl','js','jx','ln','mo','nmg','nx','qh','sc','sd','sh','sx','tj','tw','xj','xz','zj'];
  const idxNames = new Set(rows.flatMap(l => { const p = l.split('|'); return [p[0], ...(p[1] || '').split(/[、,，]/)]; }).filter(Boolean));   /* 别名也算覆盖（去重后被并名进 alias 列） */
  let tot = 0, missN = 0;
  PROV_FILES.forEach(pf => {
    try {
      vm.runInContext(fs.readFileSync(pf + '-data.js', 'utf8'), c2);
      const arr = c2.window.SITES || [];
      if (Array.isArray(arr)) { tot += arr.length; arr.forEach(x => { if (x && x.name && !idxNames.has(x.name)) missN++; }); }
    } catch (e) {}
  });
  srcCount = tot; coverMiss = missN;
} catch (e) {}
console.log('nation-index sites:', n, '| source sites:', srcCount, '| malformed rows:', bad, '| cover miss:', coverMiss);
if (bad || (coverMiss > 0)) fail++;

/* 7. UI 层 emoji 闸门（2026-10 图标体系上线后的防回潮）。
   口径从"每文件预算"换成"逐处显式登记"：预算制只说"这个文件可以有 30 个"，说不出这 30 个各是谁、
   凭什么留下——review.html 曾把预算 15 用满，其中 9 个是早已该换字形的 UI 装饰，没人看得出来。
   现在每一处 emoji 必须待在同一行带 `emoji-ok: 理由` 的注释里；没有理由即 FAIL，
   反过来写了理由却该行没有 emoji（豁免失效）也 FAIL。总数字不再单独维护，避免两处真相。 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
const EMOJI_SKIP = f => f.startsWith('test-') || f.includes('-data.js') || f.startsWith('topic-meta') || f === 'icons.js' || f === 'icons-demo.html';
const EMOJI_MARK = 'emoji-ok:';
{
  const unmarked = [], stale = [];
  let total = 0, marked = 0;
  for (const f of fs.readdirSync('.').filter(x => /\.(js|html)$/.test(x) && !EMOJI_SKIP(x))) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const m = line.match(EMOJI_RE);
      const has = m && m.length;
      if (has) total += m.length;
      if (has && !line.includes(EMOJI_MARK)) { unmarked.push(f + ':' + (i + 1) + '  ' + m.join('') + '  ' + line.trim().slice(0, 64)); return; }
      if (line.includes(EMOJI_MARK)) { if (has) marked += m.length; else stale.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 64)); }
    });
  }
  unmarked.forEach(l => console.log('emoji 未登记 FAIL: ' + l + '  ← 换 sprite 图标，或补 /* emoji-ok: 为什么必须留 */'));
  stale.forEach(l => console.log('emoji 豁免失效 FAIL（该行已无 emoji）: ' + l));
  console.log('emoji 登记: 共 ' + total + ' 处，已登记 ' + marked + ' 处，未登记 ' + unmarked.length + '，失效豁免 ' + stale.length);
  fail += unmarked.length + stale.length;
}

/* 8. 文案里的站点数必须等于 nation-index 实际条数。首页/探索页/引导页把数字写死在 HTML 里
   （首页不加载 1.4MB 的 nation-index，没法运行时算），数据一扩充就悄悄说谎，所以拿权威源钉住。 */
{
  let bad = 0;
  for (const f of fs.readdirSync('.').filter(x => x.endsWith('.html') && x !== 'icons-demo.html')) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/7,?(\d{3})(?![\d])(?:\s*<\/b>)?\s*处/g);
      if (!m) return;
      m.forEach(x => {
        const v = +x.replace(/[^\d]/g, '');
        if (v !== n) { console.log('站点数文案 FAIL: ' + f + ':' + (i + 1) + ' 写的是 ' + v + '，nation-index 实际 ' + n); bad++; }
      });
    });
  }
  console.log(bad ? '站点数文案: ' + bad + ' 处与数据源不符' : '站点数文案: 与 nation-index(' + n + ') 一致');
  fail += bad;
}

/* 9. 图标依赖闸门：sprite 由 icons.js 注入并提供 window.TI()。
   a) 页面（自身或它加载的本地脚本）用到 TI()/#ti- 就必须加载 icons.js——漏了就是「图标整片空白」，
      而且只在运行时暴露，语法检查抓不到；
   b) icons.js 必须排在 nav.js 前面。nav.js 现在靠 DOMContentLoaded 延后挂载所以暂时不炸，
      但一旦 nav.js 改成立即挂载或 icons.js 加上 defer/async 就会静默消失，所以按依赖关系钉死顺序。 */
{
  let bad = 0;
  const cache = {};
  const read = j => { if (cache[j] === undefined) cache[j] = fs.readFileSync(j, 'utf8'); return cache[j]; };
  const srcOf = s => (s.match(/src="([^"?#]+\.js)"/g) || []).map(x => x.slice(5, -1));
  for (const f of fs.readdirSync('.').filter(x => x.endsWith('.html') && x !== 'icons-demo.html')) {
    const s = fs.readFileSync(f, 'utf8');
    const lines = s.split(/\r?\n/);
    const at = name => {
      for (let i = 0; i < lines.length; i++) if (lines[i].includes('src="' + name + '"')) return i;
      return -1;
    };
    const tag = '<script src="icons.js"></script>';
    let iconUser = /TI\(|#ti-/.test(s.replace(tag, ''));
    if (!iconUser) {
      for (const j of srcOf(s)) {
        if (j === 'icons.js' || !fs.existsSync(j)) continue;
        if (/TI\(|#ti-/.test(read(j))) { iconUser = true; break; }
      }
    }
    const ic = at('icons.js');
    if (iconUser && ic < 0) { console.log('图标依赖 FAIL: ' + f + ' 用到 TI()/#ti- 但未加载 icons.js'); bad++; }
    const nav = at('nav.js');
    if (nav >= 0) {
      if (ic < 0) { console.log('图标依赖 FAIL: ' + f + ' 加载 nav.js 却没有 icons.js'); bad++; }
      else if (ic > nav) { console.log('图标依赖 FAIL: ' + f + ':' + (ic + 1) + ' icons.js 排在 nav.js(' + (nav + 1) + ') 之后'); bad++; }
    }
  }
  /* c) 幽灵 API：icons.js 导出的是 window.TI()，但文档早期写作 TraceIcon()。
     写成 TraceIcon 的页面语法检查照样过，运行时才 ReferenceError——正是本节想抓的那类"只在运行时暴露"。 */
  for (const f of fs.readdirSync('.').filter(x => /\.js$/.test(x) && !/^(test-|icons\.js)/.test(x) && !/-data\.js$/.test(x))) {
    const ln = read(f).split(/\r?\n/);
    ln.forEach((t, i) => { if (/TraceIcon\s*\(/.test(t)) { console.log('图标依赖 FAIL: ' + f + ':' + (i + 1) + ' 用了不存在的 TraceIcon()，真实 API 是 TI()'); bad++; } });
  }
  console.log(bad ? '图标依赖: ' + bad + ' 处不满足' : '图标依赖: icons.js 就位且先于 nav.js');
  fail += bad;
}

/* 10. sw.js 离线壳完整性。三条都是真踩过的：
   - 生成器把注释当数组元素拼进去，两个逗号之间成了空位（hole），addAll 拿到 undefined 直接 reject；
   - 清单里的文件被改名/删掉 → 安装期整批预缓存失败，离线变成空壳；
   - 同一文件重复登记 → 白占体积且掩盖分组错误。 */
{
  const sw = fs.readFileSync('sw.js', 'utf8');
  const blk = sw.match(/var SHELL = \[[\s\S]*?\];/);
  if (!blk) { console.log('离线壳 FAIL: sw.js 找不到 SHELL 数组'); fail++; }
  else {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(blk[0], ctx);
    const shell = ctx.SHELL || [];
    const holes = shell.length - Object.keys(shell).length;
    const dup = shell.filter((x, i) => shell.indexOf(x) !== i);
    /* './' 是站点根 URL（SW 里合法），不对应磁盘路径 */
    const missing = shell.filter(x => typeof x === 'string' && x !== './' && !fs.existsSync(x.replace(/^\.\//, '')));
    if (holes) { console.log('离线壳 FAIL: SHELL 有 ' + holes + ' 个空位（注释被拼成了元素）'); fail++; }
    if (dup.length) { console.log('离线壳 FAIL: SHELL 重复登记 ' + dup.join(' ')); fail++; }
    if (missing.length) { console.log('离线壳 FAIL: SHELL 里 ' + missing.length + ' 项在磁盘上不存在: ' + missing.slice(0, 8).join(' ')); fail++; }
    if (!holes && !dup.length && !missing.length) console.log('离线壳: SHELL ' + shell.length + ' 项，无空位/重复/悬空');
  }
}

console.log(fail ? '=== FAIL: ' + fail + ' issue(s) ===' : '=== ALL CHECKS PASSED ===');
process.exit(fail ? 1 : 0);
