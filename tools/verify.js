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

/* 11. 图片加载闸门（P0-2）：任何 <img 输出点必须懒加载 + 出错兜底，永不破图。
   - 每个含 `<img` 的行必须带 loading="lazy"；确属首屏 LCP 要提前加载的，在同一行注 `img-eager-ok: 理由`
     （沿用 §7 的显式登记思路：豁免必须留名，不许匿名通过）。
   - 每个 `<img` 必须带 onerror（品牌占位/切换占位类），裸挂远端图无兜底 = FAIL。
   - 比例系统 token（--ar-list/--ar-cover/--ar-square/--img-scrim）与 .imgbox/.img-fallback 必须在 design.css 定义，
     产品 CSS 不再手写 4/3、16/9 字面量。 */
{
  let bad = 0;
  const IMG_FILES = fs.readdirSync('.').filter(x => /\.(js|html)$/.test(x) && !/^test-/.test(x) && x !== 'icons-demo.html');
  let imgTotal = 0, lazyOk = 0, errOk = 0, registered = 0;
  const lazyBad = [], errBad = [];
  for (const f of IMG_FILES) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (!line.includes('<img')) return;
      imgTotal++;
      if (line.includes('img-eager-ok:')) { registered++; if (!/onerror=/.test(line)) errBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60)); return; }
      if (/loading="lazy"/.test(line)) lazyOk++; else lazyBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
      if (/onerror=/.test(line)) errOk++; else errBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
    });
  }
  lazyBad.forEach(l => console.log('图片闸门 FAIL（缺 loading="lazy" 或未登记 img-eager-ok）: ' + l));
  errBad.forEach(l => console.log('图片闸门 FAIL（缺 onerror 占位兜底）: ' + l));
  const dcss = fs.readFileSync('design.css', 'utf8');
  ['--ar-list:', '--ar-cover:', '--ar-square:', '--img-scrim:'].forEach(t => {
    if (!dcss.includes(t)) { console.log('图片闸门 FAIL: design.css 缺比例 token ' + t); bad++; }
  });
  if (!/\.imgbox\{/.test(dcss) || !/\.img-fallback\{/.test(dcss)) { console.log('图片闸门 FAIL: design.css 缺 .imgbox/.img-fallback 容器样式'); bad++; }
  /* 产品 CSS 内禁止裸写 4/3、16/9 字面量（token 定义行除外） */
  for (const f of ['design.css', 'map.css']) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/aspect-ratio:\s*(4\/3|16\/9|1\/1)/.test(line) && !/--ar-/.test(line)) {
        console.log('图片闸门 FAIL: ' + f + ':' + (i + 1) + ' 比例应走 var(--ar-*) token'); bad++;
      }
    });
  }
  console.log('图片闸门: <img 输出点 ' + imgTotal + '，lazy ' + (lazyOk + registered) + '，兜底 ' + (errOk + registered) + '，登记豁免 ' + registered);
  fail += bad + lazyBad.length + errBad.length;
}

/* 12. 对比度审计（P0-4 · WCAG AA）。从 design.css 真解析 token 值再算，不抄数字——
   谁改了色阶，这里立刻见真章。三档：
     body    正文/按钮标签/链接 ≥4.5:1   —— 不达标 FAIL
     graphic 图标/图形/地图线 ≥3:1        —— 不达标 FAIL
     decor   纯装饰（placeholder/箭头/空态大字符/禁用态）—— 必须写明豁免理由才放行，
             豁免表外的 decor 缺理由 = FAIL（防止"顺手标个 decor"溜过去）。
   配对表是"实际渲染组合"清单（fg 用在哪个底上），新增文字类 UI 时往表里加行，
   而不是在使用处写死颜色救急。 */
{
  const css = fs.readFileSync('design.css', 'utf8');
  function collectBlock(re) {
    const map = {}; let m; const rx = new RegExp(re, 'g');
    while ((m = rx.exec(css))) {
      for (const t of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) map[t[1]] = t[2].trim();
    }
    return map;
  }
  const light = collectBlock(':root\\s*\\{([\\s\\S]*?)\\}');   /* 合并全部 :root 块（v2 token 在后半段） */
  const dark = Object.assign({}, light, collectBlock('\\.theme-dark\\s*\\{([\\s\\S]*?)\\}'));
  function resolve(tok, map, depth) {
    depth = depth || 0;
    if (depth > 6 || !tok) return null;
    if (/^#/.test(tok)) return { hex: tok.length === 4 ? '#' + tok.slice(1).split('').map(c => c + c).join('') : tok };
    let m = tok.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(',').map(s => parseFloat(s));
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    }
    if (/^--/.test(tok)) return map[tok] ? resolve(map[tok], map, depth + 1) : null;  /* 直接给 token 名：查表再解析 */
    m = tok.match(/^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/);
    if (m) return resolve(map[m[1]] || (m[2] || '').trim(), map, depth + 1);
    return null;
  }
  const toRgb = c => c.rgb || [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)];
  function lum(c) {
    const v = toRgb(c).map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function over(fg, bg) {  /* 半透明 fg 压到 bg 上的合成色 */
    if (fg.a === undefined || fg.a === 1) return { rgb: toRgb(fg) };
    const f = toRgb(fg), b = toRgb(bg), a = fg.a;
    return { rgb: f.map((x, i) => Math.round(x * a + b[i] * (1 - a))) };
  }
  function cr(fgT, bgT, map) {
    const bg = resolve(bgT, map); const fg = resolve(fgT, map);
    if (!bg || !fg) return null;
    const B = { rgb: toRgb(bg) }; const F = over(fg, B);
    const l1 = lum(F), l2 = lum(B);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /* [主题, 前景, 背景, 档位, 用途/豁免理由] */
  const PAIRS = [
    ['L', '--color-ink', '--color-bg', 'body', '标题/正文'],
    ['L', '--color-ink-soft', '--color-bg', 'body', '次级正文'],
    ['L', '--color-ink-soft', '--color-bg-deep', 'body', '深底分区上的正文'],
    ['L', '--color-muted', '--color-bg', 'body', '说明文字'],
    ['L', '--color-muted', '--color-surface', 'body', '卡片说明文字'],
    ['L', '--color-muted', '--color-bg-soft', 'body', '软底 chip 文字'],
    ['L', '--color-faint', '--color-bg', 'decor', 'placeholder/箭头/空态大字符/图片占位框——placeholder 语义豁免'],
    ['L', '--color-faint', '--color-surface', 'decor', '同上（白底卡内装饰箭头）'],
    ['L', '--color-faint', '--color-bg-soft', 'decor', 'nmPhotoBox 空图占位提示（disabled 容器）'],
    ['L', '--color-primary', '--color-bg', 'body', '主色文字/链接'],
    ['L', '--color-primary-dark', '--color-bg', 'body', 'soft 底 pill 文字（行内色）'],
    ['L', '--color-primary-dark', 'rgba(174,87,56,.10) on --color-bg', 'body', 'primary-soft 复合底上的 pill 文字'],
    ['L', '--bg', '--color-primary', 'body', '主按钮标签（var(--bg) 统一口径，暗色自动翻深）'],
    ['L', '#ffffff', '#B25A3A', 'body', 'grad-primary 最亮档上的白标签（火纹按钮/激活 tab）'],
    ['L', '--ink-900', '--gold-500', 'body', '.btn-accent 标签（金底墨字）'],
    ['L', '--color-green', '#ECEFEA', 'body', 'wishlist 已完成标签'],
    ['L', '--teal-600', '--color-bg', 'body', '时间轴节点标题'],
    ['L', '--color-gold', '--color-surface', 'body', '序号/徽标金字（压深后）'],
    ['L', '--color-danger', '--color-surface', 'body', '破坏性操作文字'],
    ['D', '--color-ink', '--color-bg', 'body', '暗色正文'],
    ['D', '--color-ink-soft', '--color-bg', 'body', '暗色次级'],
    ['D', '--color-muted', '--color-surface', 'body', '暗色卡片说明文字'],
    ['D', '--color-primary', '--color-bg', 'body', '暗色主色文字+深标签按钮（同一配对）'],
    ['D', '--color-primary-dark', '--color-bg', 'body', '暗色强调文字'],
    ['D', '--color-primary-dark', 'rgba(216,123,86,.14) on --color-surface', 'body', '暗色 soft 底 pill 文字'],
    ['D', '--color-gold', '--color-surface', 'body', '暗色金字'],
    ['D', '--color-danger', '--color-surface', 'body', '暗色危险文字'],
    ['D', '--color-faint', '--color-bg', 'decor', '暗色 placeholder/空态大字符——placeholder 语义豁免'],
    ['L', '--route-color', '--map-bg', 'graphic', '地图路线色（图形档 3:1）'],
    ['L', '--color-blue', '--color-surface', 'graphic', '蓝灰图标（图形档）'],
    ['L', '#ffffff', '--color-blue', 'body', '.bdg-h 网红徽章白字（压深后 5.34）'],
    ['D', '#ffffff', '--color-blue', 'body', '暗色同上（blue 令牌两主题共用）'],
    ['D', '--bg', '#E08A64', 'body', '底部导航 FAB 渐变最亮端深标签（var(--bg) 翻转）'],
    ['D', '#ffffff', '--color-primary', 'graphic', 'boot 印章 40px 大字按大字/图形档 3:1 判（3.05）'],
    ['L', '--color-primary', '--bg', 'body', '.tn-style .rec 反色小徽标（米底上主色字）'],
    ['D', '--color-primary', '--bg', 'body', '暗色同上（#D87B56 on #1D1C19）'],
    ['L', '--bg', '--color-danger', 'body', 'UI.offlineBar 离线条文字（批次6·实底 danger+var(--bg)）'],
    ['D', '--bg', '--color-danger', 'body', '暗色离线条（#1D1C19 on #DA6E62）'],
    ['L', '--color-ink', '--color-surface', 'body', 'UI.errorBox 标题（批次6·卡片底）'],
    ['D', '--color-ink', '--color-surface', 'body', '暗色错误卡标题'],
    ['L', '--color-ink-soft', '--color-surface', 'body', 'UI.errorBox 描述'],
    ['D', '--color-ink-soft', '--color-surface', 'body', '暗色错误卡描述'],
    ['L', '--color-danger', 'rgba(179,74,63,.12) on --color-surface', 'graphic', 'UI.errorBox 图标（danger 压浅 tint，图形档 3:1）'],
    ['D', '--color-danger', 'rgba(179,74,63,.12) on --color-surface', 'graphic', '暗色错误卡图标']
  ];
  let bad = 0;
  console.log('对比度审计（WCAG AA：正文 4.5 · 图形 3 · 装饰须登记豁免）');
  for (const [th, fg, bg, tier, why] of PAIRS) {
    const map = th === 'L' ? light : dark;
    const isOn = / on /.test(bg);
    let ratio;
    if (isOn) {
      const mm = bg.match(/^(rgba?\([^)]+\)) on (--[\w-]+)$/);
      const base = resolve(mm[2], map); const softC = resolve(mm[1], map);
      if (!base || !softC) { console.log('对比度 FAIL: 复合底解析失败 ' + bg); bad++; continue; }
      const soft = over(softC, { rgb: toRgb(base) });
      const f = resolve(fg, map);
      if (!f) { console.log('对比度 FAIL: 配对解析不出颜色 ' + fg); bad++; continue; }
      const l1 = lum(f), l2 = lum(soft);
      ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    } else ratio = cr(fg, bg, map);
    if (ratio === null) { console.log('对比度 FAIL: 配对解析不出颜色 ' + fg + ' / ' + bg + '（token 改名了？）'); bad++; continue; }
    const lim = tier === 'body' ? 4.5 : 3;
    const r = ratio.toFixed(2);
    if (tier === 'decor') {
      if (!why || why.length < 6) { console.log('对比度 FAIL: decor 配对未写豁免理由 ' + fg + '/' + bg); bad++; }
      else console.log('  豁免 ' + th + ' ' + fg.padEnd(22) + '/' + bg.padEnd(14) + ' ' + r.padStart(5) + ':1  ' + why);
    } else if (ratio + 1e-9 < lim) {
      console.log('对比度 FAIL ' + th + ' ' + fg + ' / ' + bg + ' = ' + r + ':1 < ' + lim + '  [' + why + ']');
      bad++;
    } else console.log('  ' + (tier === 'body' ? '正文' : '图形') + ' ' + th + ' ' + fg.padEnd(22) + '/' + bg.padEnd(14) + ' ' + r.padStart(5) + ':1  ' + why);
  }
  console.log('对比度审计: ' + PAIRS.length + ' 组配对，' + (PAIRS.filter(p => p[3] === 'decor').length) + ' 组装饰豁免，不达标 ' + bad);
  fail += bad;
}

/* 13. 状态完备矩阵闸门（P1-8 · 批次6）。防"组件写了没接线""矩阵画了没落地"两类回潮：
   ① 三个标准件在 ui.js 真导出、离线条真自动安装；② design.css 真定义三样式；
   ③ 8 核心页都载 ui.js（离线能力全站覆盖）；④ 有远程资源的 4 页真调 UI.errorBox；
   ⑤ 文档矩阵 8 行 × 4 列满格、离线列全指 offlineBar、无"待设计"空口。 */
{
  const CORE = ['index.html','topic.html','search.html','wishlist.html','travel-map.html','planner.html','album.html','review.html'];
  const REMOTE = ['search.html','topic.html','planner.js','album.html'];   /* 有可重发起的远程/IDB 资源，须挂 errorBox */
  const DOC = '改进实施方案与验收标准.md';
  const ui = fs.readFileSync('ui.js','utf8');
  const dcss = fs.readFileSync('design.css','utf8');
  let bad = 0;
  console.log('状态矩阵闸门（P1-8）');
  const uiExportLine = (ui.match(/window\.UI\s*=\s*\{[^}]*\}/) || [''])[0];
  for (const fn of ['errorBox','offlineBar']) {
    if (!new RegExp('(^|[\\s,{])' + fn + '\\s*:').test(uiExportLine)) { console.log('状态矩阵 FAIL: ui.js 未导出 UI.' + fn); bad++; }
  }
  if (!/DOMContentLoaded[^;]*offlineBar|else\s+offlineBar\(\)/.test(ui)) { console.log('状态矩阵 FAIL: ui.js 缺 offlineBar 自动安装'); bad++; }
  for (const sel of ['ui-offlinebar','ui-tilewarn','ui-errorbox']) {
    if (!new RegExp('\\.' + sel + '\\s*\\{').test(dcss)) { console.log('状态矩阵 FAIL: design.css 缺样式 .' + sel); bad++; }
  }
  for (const f of CORE) {
    if (!fs.existsSync(f)) { console.log('状态矩阵 FAIL: 核心页缺失 ' + f); bad++; continue; }
    if (!/<script[^>]*src=["']ui\.js["']/.test(fs.readFileSync(f,'utf8'))) { console.log('状态矩阵 FAIL: ' + f + ' 未加载 ui.js（离线条不会自动出现）'); bad++; }
  }
  for (const f of REMOTE) {
    const s = fs.readFileSync(f,'utf8');
    if (!(s.match(/UI\.errorBox\s*\(/g) || []).length) { console.log('状态矩阵 FAIL: ' + f + ' 未挂 UI.errorBox（出错态无重试落点）'); bad++; }
  }
  let matrixRows = -1;
  if (fs.existsSync(DOC)) {
    const doc = fs.readFileSync(DOC,'utf8');
    const lines = doc.split('\n');
    const body = lines.filter(function (l) {
      if (!/^\s*\|/.test(l)) return false;
      const cells = l.split('|').map(c => c.trim());
      // 5 列表格体行 = ["", c1, c2, c3, c4, c5, ""] 长度 7；离线列（末列）必须含 UI.offlineBar
      return cells.length === 7 && /UI\.offlineBar/.test(cells[5]);
    });
    matrixRows = body.length;
    const hdr = lines.find(l => /^\s*\|/.test(l) && /加载中/.test(l) && /空数据/.test(l) && /出错/.test(l) && /离线/.test(l));
    if (!hdr) { console.log('状态矩阵 FAIL: 文档缺 {加载中|空数据|出错|离线} 表头行'); bad++; }
    else if (hdr.split('|').map(c => c.trim()).filter(Boolean).length !== 5) { console.log('状态矩阵 FAIL: 矩阵表头应 5 列（页+4态）'); bad++; }
    if (matrixRows !== 8) { console.log('状态矩阵 FAIL: 矩阵 5 列行 ' + matrixRows + ' ≠ 8 核心页'); bad++; }
    for (const l of body) if (/待设计/.test(l)) { console.log('状态矩阵 FAIL: 矩阵仍有"待设计" -> ' + l.trim().slice(0,40)); bad++; }
  } else { console.log('状态矩阵 FAIL: 缺文档 ' + DOC); bad++; }
  console.log('状态矩阵闸门: 核心页 ' + CORE.length + '，errorBox 页 ' + REMOTE.length + '，矩阵行 ' + matrixRows);
  fail += bad;
}

console.log(fail ? '=== FAIL: ' + fail + ' issue(s) ===' : '=== ALL CHECKS PASSED ===');
process.exit(fail ? 1 : 0);
