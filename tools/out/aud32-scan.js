/* tools/out/aud32-scan.js — 批次32 审计（我自己写的静态扫描器，替代子代理结论）
 * 十族机器可核判据，逐条输出 file:line：
 *  A 页面用了某全局单点却没引对应脚本（review.html 用 TI 没引 icons.js 那类整块失效的根因）
 *  B 内联 onclick/onchange/oninput 里调的函数，在本页+所引脚本里找不到定义
 *  C getElementById('x') 的 x 在本页 HTML 里不存在（渲染落点丢失＝那块永远空白）
 *  D sw.js 预缓存清单 vs 根目录真实文件（漏页＝离线打开白屏）
 *  E 原生 alert/confirm/prompt 残留（项目口径要走 UI.*）
 *  F 屏上日期/时刻自拼（toLocale 系列与 getFullYear 连字符）——§41 只钉键没钉显示的那一族
 *  G 裸 emoji 当图标（应走 TI sprite）
 *  H <img> 缺 alt（读屏念不出）
 *  I catch 空吞（失败静默）
 *  J 写死 z-index 数字（有 --z-* token 不用）
 * 用法: node tools/out/aud32-scan.js   → 落盘 tools/out/aud32-scan.txt
 * 口径：会跳过纯注释行（以 // 或 * 开头）；其余一律按源码原文算，注释里藏的除外。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SKIP_FILE = /^(test-|icons-demo|share\.html$)/;      /* share.html 是只读外链页，独立口径另查 */
const htmls = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !SKIP_FILE.test(f));
const libs = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && !/^test-/.test(f) && f !== 'sw.js');
const cache = {};
function read(f) { const p = path.join(ROOT, f); if (!cache[f]) cache[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; return cache[f]; }
function rows(f) { return (read(f) || '').split(/\r?\n/); }
function isComment(s) { const t = s.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'); }
const out = [];
function sec(t) { out.push(''); out.push('======== ' + t + ' ========'); }

/* 每个 html 的脚本清单（含它自己内联的 script 内容） */
function scriptsOf(f) {
  const s = read(f) || '';
  const srcs = [];
  const re = /<script[^>]*\ssrc="([^"]+)"[^>]*>/g; let m;
  while ((m = re.exec(s))) srcs.push(m[1].replace(/^\.?\//, '').split(/[?#]/)[0]);
  const inline = [];
  const re2 = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
  while ((m = re2.exec(s))) inline.push(m[1]);
  return { srcs: srcs, inlineText: inline.join('\n') };
}
/* 库的顶层导出对象名 */
const OWNER = {
  'travel-notes.js': ['TravelNotes', 'TNStats'],
  'ui.js': ['UI'],
  'icons.js': ['TI'],
  'geo.js': ['Geo'],
  'wishlist.js': ['Wish'],
  'expense.js': ['Expense'],
  'checklist.js': ['Checklist'],
  'sync-webdav.js': ['SyncWebDAV'],
  'vault.js': ['Vault'],
  'share.js': ['Share'],
  'quotes.js': ['Quotes'],
  'nation-index.js': ['NationIndex'],
  'topic-meta.js': ['TopicMeta'],
  'topic-meta-lite.js': ['TopicMeta'],
  'site-tickets.js': ['SiteTickets'],
  'nearby.js': ['Nearby'],
  'node-lod.js': ['NodeLOD'],
  'poster.js': ['Poster'],
  'album.js': ['Album'],
  'backup.js': ['Backup'],
  'ai.js': ['Ai'],
  'results.js': ['Results'],
  'planner.js': ['Planner'],
  'nav.js': ['Nav'],
};

/* ---------- A ---------- */
sec('A 用了单点却没引脚本');
let aN = 0;
htmls.forEach(function (f) {
  const info = scriptsOf(f);
  const loaded = info.srcs.slice();
  /* nav.js / index 之类可能间接带进来？静态层按页面自身 script 标签算，报告里注明这是「疑似」 */
  const corpus = (info.srcs.map(s => read(s) || '').join('\n') + '\n' + read(f));
  const body = read(f) || '';
  Object.keys(OWNER).forEach(function (lib) {
    if (loaded.indexOf(lib) >= 0) return;
    OWNER[lib].forEach(function (sym) {
      const useRe = new RegExp('(^|[^\\w.$])' + sym + '\\s*[.\\(]', 'm');
      if (!useRe.test(body)) return;
      /* 该符号是否由别的已加载脚本提供 */
      const provided = loaded.some(s => (read(s) || '').indexOf('window.' + sym) >= 0);
      if (provided) return;
      const linesNo = rows(f).map((l, i) => (!isComment(l) && useRe.test(l) ? i + 1 : 0)).filter(Boolean);
      if (!linesNo.length) return;
      aN++;
      out.push('  ' + f + ':' + linesNo[0] + '  用 ' + sym + ' 但未引 ' + lib + '（已引: ' + (loaded.join(',') || '无') + '）');
    });
  });
});
out.push('  小计 ' + aN + ' 条');

/* ---------- B ---------- */
sec('B 内联事件里调的函数找不到定义');
let bN = 0;
const DEF_BUILD = {};
libs.forEach(function (l) { DEF_BUILD[l] = read(l) || ''; });
htmls.forEach(function (f) {
  const info = scriptsOf(f);
  const corpus = info.inlineText + '\n' + info.srcs.map(s => read(s) || '').join('\n');
  const body = read(f) || '';
  const re = /on(?:click|change|input|submit|focus|blur)="([^"]+)"/g; let m;
  const seen = {};
  while ((m = re.exec(body))) {
    const code = m[1];
    if (isComment(code)) continue;
    const fr = /(?:^|[;\s&|(])([A-Za-z_$][\w$]*)\s*\(/g; let fm;
    while ((fm = fr.exec(code))) {
      const fn = fm[1];
      if (/^(if|for|while|switch|return|typeof|confirm|alert|event|this|window|document|location|history|Math|JSON|Number|String|Boolean|Array|Object|setTimeout|setInterval|clearTimeout|parseInt|parseFloat|isNaN|decodeURIComponent|encodeURIComponent|fetch|scrollTo|stopPropagation|preventDefault)$/.test(fn)) continue;
      if (seen[f + fn]) continue; seen[f + fn] = 1;
      if (new RegExp('function\\s+' + fn + '\\b|' + fn + '\\s*[:=]\\s*(function|\\()|window\\.' + fn + '\\s*=').test(corpus)) continue;
      const ln = body.slice(0, m.index).split(/\r?\n/).length;
      bN++; out.push('  ' + f + ':' + ln + '  onclick 调 ' + fn + '() — 本页与其脚本里没有定义');
    }
  }
});
out.push('  小计 ' + bN + ' 条（含动态注入的字符串里定义的，需人工二验）');

/* ---------- C ---------- */
sec('C getElementById 落点在本页 HTML 不存在');
let cN = 0;
htmls.forEach(function (f) {
  const body = read(f) || '';
  const ids = {};
  let m, re = /\sid="([^"]+)"/g;
  while ((m = re.exec(body))) ids[m[1]] = 1;
  const created = {};
  let m2, re2 = /\.id\s*=\s*['"]([^'"]+)['"]|id\\?=[^>\s]*['"]?\$\{|id="([^"]+)"/g;
  /* 该页及其脚本里用字符串拼出来的 id（innerHTML 场景）也算存在 */
  const corpus = body + '\n' + scriptsOf(f).srcs.map(s => read(s) || '').join('\n');
  const used = {};
  let m3, re3 = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m3 = re3.exec(body))) {
    const id = m3[1];
    if (ids[id] || used[id]) continue; used[id] = 1;
    /* 拼串创建：形如 id="x" 在脚本字符串里 */
    if (corpus.indexOf('id="' + id + '"') >= 0 || corpus.indexOf("id='" + id + "'") >= 0) continue;
    const ln = body.slice(0, m3.index).split(/\r?\n/).length;
    cN++; out.push('  ' + f + ':' + ln + '  取 #' + id + ' — 本页无此 id（且脚本字符串里也没造过）');
  }
});
out.push('  小计 ' + cN + ' 条');

/* ---------- D ---------- */
sec('D sw.js 预缓存 vs 根目录真实文件');
const sw = read('sw.js') || '';
const listed = {};
let m4, re4 = /['"](\.\/)?([\w.\-]+\.(?:html|js|css))['"]/g;
while ((m4 = re4.exec(sw))) listed[m4[2]] = 1;
const precacheBlock = sw.indexOf('PRECACHE') >= 0 || sw.indexOf('precache') >= 0;
const allFiles = fs.readdirSync(ROOT).filter(f => /\.(html|css)$/.test(f) && !/^test-/.test(f));
const missing = allFiles.filter(f => !listed[f]);
out.push('  CACHE 版本串: ' + (sw.match(/trace-v\d+/g) || []).join(','));
out.push('  sw 里出现「precache」字样: ' + precacheBlock);
out.push('  根目录 html/css 共 ' + allFiles.length + ' 个，sw.js 未提及 ' + missing.length + ' 个 → ' + missing.join(', '));

/* ---------- E ---------- */
sec('E 原生 alert/confirm/prompt');
let eN = 0;
[...htmls, ...libs].forEach(function (f) {
  if (f === 'ui.js') return;
  rows(f).forEach(function (l, i) {
    if (isComment(l)) return;
    const m = /(^|[^.\w])(alert|confirm|prompt)\s*\(/.exec(l);
    if (!m) return;
    eN++; out.push('  ' + f + ':' + (i + 1) + '  ' + m[2] + '() — ' + l.trim().slice(0, 90));
  });
});
out.push('  小计 ' + eN + ' 条');

/* ---------- F ---------- */
sec('F 屏上日期/时刻自拼');
let fN = 0;
[...htmls, ...libs].forEach(function (f) {
  if (/^(tools|docs)/.test(f)) return;
  rows(f).forEach(function (l, i) {
    if (isComment(l)) return;
    const hit = /toLocaleDateString|toLocaleTimeString|toLocaleString\(/.test(l) ||
      /getFullYear\(\)\s*\+/.test(l) || /getMonth\(\)\s*\+\s*1/.test(l);
    if (!hit) return;
    fN++; out.push('  ' + f + ':' + (i + 1) + '  ' + l.trim().replace(/\s+/g, ' ').slice(0, 110));
  });
});
out.push('  小计 ' + fN + ' 条');

/* ---------- G ---------- */
sec('G 裸 emoji 当图标');
const EMO = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
let gN = 0;
[...htmls, ...libs].forEach(function (f) {
  rows(f).forEach(function (l, i) {
    if (isComment(l)) return;
    if (l.indexOf('emoji-ok') >= 0) return;
    if (!EMO.test(l)) return;
    gN++; out.push('  ' + f + ':' + (i + 1) + '  ' + l.trim().replace(/\s+/g, ' ').slice(0, 100));
  });
});
out.push('  小计 ' + gN + ' 条');

/* ---------- H ---------- */
sec('H <img> 缺 alt');
let hN = 0;
[...htmls, ...libs].forEach(function (f) {
  const s = read(f) || '';
  let m, re = /<img\b[^>]*>/g, base = 0;
  while ((m = re.exec(s))) {
    const tag = m[0];
    if (/\balt=/.test(tag)) continue;
    const ln = s.slice(0, m.index).split(/\r?\n/).length;
    hN++; out.push('  ' + f + ':' + ln + '  ' + tag.replace(/\s+/g, ' ').slice(0, 110));
  }
});
out.push('  小计 ' + hN + ' 条');

/* ---------- I ---------- */
sec('I catch 空吞');
let iN = 0;
[...htmls, ...libs].forEach(function (f) {
  rows(f).forEach(function (l, i) {
    if (isComment(l)) return;
    if (!/catch\s*\([^)]*\)\s*\{\s*\}/.test(l) && !/catch\s*\([^)]*\)\s*\{\s*return[^;}]*;\s*\}/.test(l)) return;
    iN++; if (iN <= 60) out.push('  ' + f + ':' + (i + 1) + '  ' + l.trim().replace(/\s+/g, ' ').slice(0, 100));
  });
});
out.push('  小计 ' + iN + ' 条（只列前 60）');

/* ---------- J ---------- */
sec('J 写死 z-index');
let jN = 0, jT = {};
[...htmls, ...libs].forEach(function (f) {
  rows(f).forEach(function (l, i) {
    if (isComment(l)) return;
    let m, re = /z-index:\s*(\d{3,})/g;
    while ((m = re.exec(l))) { jN++; jT[f] = (jT[f] || 0) + 1; if (jT[f] === 1) out.push('  ' + f + ':' + (i + 1) + '  z-index:' + m[1] + ' — ' + l.trim().replace(/\s+/g, ' ').slice(0, 90)); }
  });
});
out.push('  小计 ' + jN + ' 处，涉及 ' + Object.keys(jT).length + ' 个文件（每文件只列首处）');

fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'aud32-scan.txt'), out.join('\n'));
console.log('written A=' + aN + ' B=' + bN + ' C=' + cN + ' E=' + eN + ' F=' + fN + ' G=' + gN + ' H=' + hN + ' I=' + iN + ' J=' + jN);
