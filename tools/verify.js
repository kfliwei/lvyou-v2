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

/* 7. UI 层 emoji 棘轮：只许减、不许增（2026-10 图标体系上线后的防回潮闸门）。
   白名单 = 数据层与纯文本场景：travel-notes 的 WMO 天气表（持久化进游记）、
   topic-common 的 FTYPE_ICON 美食类目与 🧭 下拉项（select 无法渲染 SVG）、
   review 的 moods 数组（data-m 持久值）、planner 的剪贴板/导出文档文本、
   wishlist 的 ⭐ 剪贴板文本。预算只准下调；新文件出现 emoji 即 FAIL。 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
const EMOJI_SKIP = f => f.startsWith('test-') || f.includes('-data.js') || f.startsWith('topic-meta') || f === 'icons.js' || f === 'icons-demo.html';
const EMOJI_BUDGET = { 'planner.js': 2, 'review.html': 15, 'topic-common.js': 9, 'travel-notes.js': 30, 'wishlist.html': 1 };
{
  let emojiFail = 0;
  for (const f of fs.readdirSync('.').filter(f => /\.(js|html)$/.test(f) && !EMOJI_SKIP(f))) {
    const n = (fs.readFileSync(f, 'utf8').match(EMOJI_RE) || []).length;
    const budget = EMOJI_BUDGET[f] || 0;
    if (n > budget) { console.log('emoji 棘轮 FAIL: ' + f + ' = ' + n + ' > 预算 ' + budget); emojiFail++; }
    else if (n < budget) console.log('emoji 棘轮: ' + f + ' ' + n + '/' + budget + '（可下调预算）');
  }
  if (emojiFail) fail += emojiFail;
}

console.log(fail ? '=== FAIL: ' + fail + ' issue(s) ===' : '=== ALL CHECKS PASSED ===');
process.exit(fail ? 1 : 0);
