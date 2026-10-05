/* tools/verify.js — 全站改动验证：编码 / JS 语法 / 残留 alert 检查 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['ui.js','index.html','search.html','wishlist.html','travel-map.html','md-manager.html','settings.html','me.html','explore-map.html','topic.html','review.html','story.html','test-data.html','node-manager.html','topic-common.js','design.css','nation-index.js','travel-notes.js','results.js','poster.js','node-lod.js','wishlist.js','geo.js','quotes.js','vault.js','theme.js','backup.js','sync-webdav.js','share.js','share.html','planner.js','planner.html'].filter(f => fs.existsSync(f));

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
  // 注释必须先剥：:root 块按「第一个 }」截断，注释里举一个 html{...} 反例就会把 token 表切短一截，
  // 后半段 --color-ink 之类全解析不出（§21 变异自测的 P7 撞出来的）。
  const css = fs.readFileSync('design.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
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
    ['D', '--color-danger', 'rgba(179,74,63,.12) on --color-surface', 'graphic', '暗色错误卡图标'],
    /* P1-7 日卡蜡封章：章内数字 + 金环均走 --day-c*，压在读卡卡面上 */
    ['L', '--day-c1', '--color-surface', 'body', '.day-seal.ds-1 日卡章数字'],
    ['L', '--day-c2', '--color-surface', 'body', '.day-seal.ds-2 日卡章数字'],
    ['L', '--day-c3', '--color-surface', 'body', '.day-seal.ds-3 日卡章数字'],
    ['L', '--day-c4', '--color-surface', 'body', '.day-seal.ds-4 日卡章数字'],
    ['L', '--day-c5', '--color-surface', 'body', '.day-seal.ds-5 日卡章数字'],
    ['L', '--day-c6', '--color-surface', 'body', '.day-seal.ds-6 日卡章数字'],
    ['D', '--day-c1', '--color-surface', 'body', '暗色日卡章数字 1'],
    ['D', '--day-c2', '--color-surface', 'body', '暗色日卡章数字 2'],
    ['D', '--day-c3', '--color-surface', 'body', '暗色日卡章数字 3'],
    ['D', '--day-c4', '--color-surface', 'body', '暗色日卡章数字 4'],
    ['D', '--day-c5', '--color-surface', 'body', '暗色日卡章数字 5'],
    ['D', '--day-c6', '--color-surface', 'body', '暗色日卡章数字 6'],
    ['L', '--bg', '--color-primary-dark', 'body', '.map-pin 立针序号 / .day-seal.done「游」印（深陶土实底）'],
    ['D', '--bg', '--color-primary-dark', 'body', '暗色同上（primary-dark 翻亮，纸色字自动翻深）'],
    ['L', '--bg', '--color-muted', 'body', '.bdg-t 临时节点徽标（批次7 由内联 #fff 收进 token）'],
    ['D', '--bg', '--color-muted', 'body', '暗色同上（旧 #fff on #969184 只有 2.1:1，实为暗色 bug）'],
    ['L', '--color-muted', '--color-bg', 'body', '.vtitle 竖排题签（批次7-C）'],
    ['D', '--color-muted', '--color-bg', 'body', '暗色竖排题签']
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

/* 14. 品牌签名闸门（P1-7 · 批次7）。三个签名动作要"落在 CSS 里、挂在页面上、JS 不再内联色"：
   ① design.css 定义 .empty-art / .day-seal / .map-pin，且 --day-c1..6 在两主题各有一份；
   ② 空态线稿真挂载 ≥6 处，且必须是 inline <svg stroke="currentColor">：
      <img src=*.svg> 里 currentColor 解析成 SVG 自己的 black（暗色瞎），
      CSS mask 取图走 CORS，file:// 页面拿不到图（APK 里整块空态隐形）——两种回潮都要红；
      旧 emoji 漂浮样式不得回潮；
   ③ planner.js 日卡走 day-seal、地图标记走 map-pin，且这两类渲染行不得再内联色。 */
{
  let bad = 0;
  const NL = /\r?\n/;
  const dcss = fs.readFileSync('design.css', 'utf8');
  const pl = fs.readFileSync('planner.js', 'utf8');
  const dcssLines = dcss.split(NL);
  for (const cls of ['.empty-art', '.day-seal', '.map-pin']) {
    if (!dcss.includes(cls + '{')) { console.log('品牌签名 FAIL: design.css 缺 ' + cls + '{ 组件样式'); bad++; }
  }
  const dkIdx = dcssLines.findIndex(l => /^\.theme-dark\s*\{/.test(l.trim()));
  if (dkIdx < 0) { console.log('品牌签名 FAIL: design.css 找不到 .theme-dark 块'); bad++; }
  for (let i = 1; i <= 6; i++) {
    const tk = '--day-c' + i + ':';
    const inLight = dcssLines.slice(0, dkIdx < 0 ? dcssLines.length : dkIdx).some(l => l.includes(tk));
    const inDark = dkIdx >= 0 && dcssLines.slice(dkIdx).some(l => l.includes(tk));
    if (!inLight || !inDark) { console.log('品牌签名 FAIL: --day-c' + i + ' 缺' + (inLight ? '暗色' : '亮色') + '档（日卡章切主题会掉色）'); bad++; }
  }
  if (/\.empty \.emoji\s*\{/.test(dcss)) { console.log('品牌签名 FAIL: .empty .emoji 漂浮样式回潮，应走线稿'); bad++; }
  const flat = dcss.replace(/\s+/g, ' ');
  if (/\.empty-art\{[^}]*mask:/.test(flat)) { console.log('品牌签名 FAIL: .empty-art 又用 CSS mask 上色（file:// 下取不到 mask 图，APK 里空态隐形）'); bad++; }
  const LINE_ART = 'mountain|footprint|tent|letter|film|compass';   /* 6 张线稿；旧的渐变插画(journey/md/memory/voice)仍走 <img>，不在此列 */
  if (/--art:url\(/.test(flat)) { console.log('品牌签名 FAIL: design.css 残留 --art:url( 挂载变量'); bad++; }
  const MOUNT_FILES = fs.readdirSync('.').filter(x => /\.(js|html)$/.test(x) && !/^test-/.test(x));
  let mounts = 0, vmounts = 0;
  for (const f of MOUNT_FILES) {
    fs.readFileSync(f, 'utf8').split(NL).forEach((line, i) => {
      const at = f + ':' + (i + 1);
      if (line.includes('class="vtitle"')) vmounts++;
      if (new RegExp('<img[^>]*art/empty-(' + LINE_ART + ')\\.svg').test(line)) { console.log('品牌签名 FAIL: ' + at + ' 线稿又用 <img> 挂载（currentColor 不跟主题，暗色=看不见）'); bad++; }
      if (/--art:url\(art\/empty-/.test(line)) { console.log('品牌签名 FAIL: ' + at + ' 空态又用 --art mask 挂载（file:// 取不到图）'); bad++; }
      if (!line.includes('class="empty-art"')) return;
      mounts++;
      if (!new RegExp('<svg[^>]*class="empty-art"[^>]*viewBox="0 0 120 100"[^>]*fill="none"[^>]*stroke="currentColor"').test(line)) {
        console.log('品牌签名 FAIL: ' + at + ' 空态线稿不是 inline <svg class="empty-art" … stroke="currentColor">（换 <img>/mask 都会在某些主题或 APK 里瞎）'); bad++;
      }
      if (!/aria-label="[^"]*线稿"/.test(line)) { console.log('品牌签名 FAIL: ' + at + ' 空态线稿缺 aria-label="…线稿"'); bad++; }
      if (/stroke="#|fill="#/.test(line)) { console.log('品牌签名 FAIL: ' + at + ' 空态线稿内联了硬编码色，应走 currentColor'); bad++; }
    });
  }
  if (mounts < 6) { console.log('品牌签名 FAIL: 空态线稿挂载 ' + mounts + ' 处 < 6（六张插画应各有一处落地）'); bad++; }
  /* 竖排题签（批次7-C）：组件必须在 CSS 里，且 topic 卷首 + story 开篇两处真挂载 */
  if (!/\.vtitle\{[^}]*writing-mode:vertical-rl/.test(flat)) { console.log('品牌签名 FAIL: design.css 缺 .vtitle{…writing-mode:vertical-rl…} 竖排组件'); bad++; }
  if (vmounts < 2) { console.log('品牌签名 FAIL: 竖排题签挂载 ' + vmounts + ' 处 < 2（topic 列表卷首 + story 旅程开篇）'); bad++; }
  /* art/empty-*.svg 是这六张线稿的画稿源；页面里是内联副本，两者必须逐字一致，否则改画稿不会生效 */
  const ALL_SRC = MOUNT_FILES.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const drift = [];
  for (const k of LINE_ART.split('|')) {
    const p = 'art/empty-' + k + '.svg';
    if (!fs.existsSync(p)) { console.log('品牌签名 FAIL: 缺画稿 ' + p); bad++; continue; }
    const raw = fs.readFileSync(p, 'utf8').trim();
    const body = raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('</svg>')).trim();
    if (!body || !ALL_SRC.includes(body)) drift.push(k);
  }
  if (drift.length) { console.log('品牌签名 FAIL: 画稿与内联线稿已漂移 ' + drift.join(',') + '（改 art/*.svg 要同步挂载处，或反过来）'); bad++; }
  if (/DAY_COLORS/.test(pl)) { console.log('品牌签名 FAIL: planner.js 仍有 DAY_COLORS 硬编码色板'); bad++; }
  if (!pl.includes('day-seal')) { console.log('品牌签名 FAIL: planner.js 日卡未挂 day-seal 蜡封章'); bad++; }
  if (!pl.includes('class="map-pin"')) { console.log('品牌签名 FAIL: planner.js 地图标记未走 map-pin 类'); bad++; }
  pl.split(NL).forEach((line, i) => {
    if (!/L\.divIcon\(|day-seal|empty-art/.test(line)) return;
    const inline = line.match(/background:#[0-9A-Fa-f]{3,6}|color:#[0-9A-Fa-f]{3,6}|border:2px solid #/);
    if (inline) { console.log('品牌签名 FAIL: planner.js:' + (i + 1) + ' 标记/日卡/空态渲染行仍内联色 ' + inline[0]); bad++; }
  });
  console.log('品牌签名闸门: 组件类 3，空态内联挂载 ' + mounts + ' 处，画稿对账 ' + (LINE_ART.split('|').length - drift.length) + '/6，竖排挂载 ' + vmounts + ' 处，token 档 12');
  fail += bad;
}

/* 15. 启动屏品牌闸门（P1-7 时刻⑤ · 批次7-D）。
   这一格的产物在外部安卓壳（不受本仓库 git 管理），所以闸门做「源真值对账」而不是数截图：
   ① 线稿描边色 = design.css 的 --color-gold（壳里另抄一份十六进制迟早漂）；
   ② 山脊/雪线/地平线/日 的几何 = art/empty-mountain.svg 按 0.5 缩放 + 居中偏移的换算结果
      （改画稿不同步启动屏，这里直接红）；
   ③ Android 12+ 走系统启动屏属性，同时 windowBackground 必须退回纯色，否则系统屏结束后
      又叠一层带图首帧 = logo 闪两次；
   ④ 同名 style 是整体替换不是合并，values/themes.xml 的每一项都要在 values-v31 里重抄。
   壳目录与仓库内的壳源副本都不在本机时才打 SKIP，把覆盖缺口写明，不假装通过。 */
{
  const SHELL = (process.env.TRACE_ANDROID_SHELL || 'F:/MyAi/trace/lvyou-v2-android').replace(/\\/g, '/');
  const RES_SHELL = SHELL + '/app/src/main/res';
  const RES_REPO = 'android_app/app/src/main/res';
  /* 交付壳优先；壳不在本机（另一台机器、CI）时退回仓库内的壳源副本，两边都没有才 SKIP */
  const RES = fs.existsSync(RES_SHELL) ? RES_SHELL : (fs.existsSync(RES_REPO) ? RES_REPO : null);
  if (!RES) {
    console.log('启动屏闸门: SKIP（外部壳 ' + SHELL + ' 与 ' + RES_REPO + ' 都不在本机，APK 首帧不在本闸门覆盖内）');
  } else {
    let bad = 0;
    const F = m => { console.log('启动屏 FAIL: ' + m); bad++; };
    const rd = rel => {
      const p = RES + '/' + rel;
      if (!fs.existsSync(p)) { F('缺 ' + rel); return ''; }
      return fs.readFileSync(p, 'utf8');
    };
    /* ① 描边色对账 */
    const gold15 = (fs.readFileSync('design.css', 'utf8').match(/--color-gold:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    if (!gold15) F('design.css 读不到 --color-gold 的十六进制值');
    const cm = (rd('values/colors.xml').match(/name="gold_deep">([^<]+)</) || [])[1];
    if (!cm) F('壳 colors.xml 没有 gold_deep');
    else if (gold15 && cm.toUpperCase() !== gold15.toUpperCase()) F('启动屏线稿 ' + cm + ' ≠ design.css --color-gold ' + gold15 + '（品牌色两处漂移）');
    const vec = rd('drawable/splash_brand.xml');
    if (/strokeColor="#/.test(vec)) F('splash_brand 内联了硬编码 strokeColor，应走 @color/gold_deep');
    if (!/strokeColor="@color\/gold_deep"/.test(vec)) F('splash_brand 没引用 @color/gold_deep');
    /* ② 几何对账：画稿 d → 0.5 缩放 + 居中偏移 (24,29)，与 vector 的 pathData 逐条比 */
    const svgRaw = fs.readFileSync('art/empty-mountain.svg', 'utf8');
    const S = 0.5, OX = 24, OY = 29;   /* viewBox 120×100 → 60×50，居中进 108×108 安全区 */
    const num = v => String(Math.round(v * 1000) / 1000);
    const scalePath = d => {
      const t = d.trim().match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
      const out = []; let cx = 0, cy = 0;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (!/^[A-Za-z]$/.test(c)) continue;
        if (c === 'Z') { out.push('Z'); continue; }
        if (c === 'M' || c === 'L') {
          cx = parseFloat(t[++i]); cy = parseFloat(t[++i]);
          if (!isFinite(cx) || !isFinite(cy)) return null;
          out.push(c + num(cx * S + OX) + ',' + num(cy * S + OY));
        } else if (c === 'H') {
          cx = parseFloat(t[++i]); if (!isFinite(cx)) return null;
          out.push('L' + num(cx * S + OX) + ',' + num(cy * S + OY));   /* 壳里 H 展开成 L（同一画稿的写法差异） */
        } else if (c === 'V') {
          cy = parseFloat(t[++i]); if (!isFinite(cy)) return null;
          out.push('L' + num(cx * S + OX) + ',' + num(cy * S + OY));
        } else return null;   /* 画稿改用 C/A/Q/S/T 或相对命令，这个换算器就不覆盖了 */
      }
      return out.join(' ');
    };
    const norm = s => (s || '').replace(/\s+/g, '');
    const vecDs = (vec.match(/android:pathData="([^"]+)"/g) || []).map(s => norm(s.slice(s.indexOf('="') + 2, -1)));
    const srcDs = [...svgRaw.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
    let geoOk = 0, geoTotal = srcDs.length;
    srcDs.forEach((d, k) => {
      const want = norm(scalePath(d));
      if (!want) { F('画稿第 ' + (k + 1) + ' 条路径含换算器不覆盖的命令，启动屏几何无法对账'); return; }
      if (!vecDs.includes(want)) F('启动屏第 ' + (k + 1) + ' 条几何与 art/empty-mountain.svg 漂移（应为 ' + want + '）');
      else geoOk++;
    });
    const cir = svgRaw.match(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"/);
    if (cir) {
      geoTotal++;
      const cc = 'M' + num(parseFloat(cir[1]) * S + OX) + ',' + num(parseFloat(cir[2]) * S + OY);
      if (!vecDs.some(d => d.startsWith(cc))) F('启动屏「日」没跟画稿圆心走（应从 ' + cc + ' 起笔）');
      else geoOk++;
    }
    /* ③④ 主题对账 */
    const th = rd('values/themes.xml'), th31 = rd('values-v31/themes.xml');
    if (!/android:windowBackground">@drawable\/splash_bg</.test(th)) F('values/themes.xml 首帧没挂 @drawable/splash_bg（Android 11 及以下仍是白屏）');
    const bg = rd('drawable/splash_bg.xml');
    if (!/<layer-list/.test(bg)) F('splash_bg 不是 layer-list');
    if (!/gravity="center"/.test(bg)) F('splash_bg 线稿没居中');
    if (!/@drawable\/splash_brand/.test(bg)) F('splash_bg 没引用 splash_brand');
    if (!/windowSplashScreenBackground">@color\//.test(th31)) F('values-v31 没配 android:windowSplashScreenBackground');
    if (!/windowSplashScreenAnimatedIcon">@drawable\/splash_brand</.test(th31)) F('values-v31 没配 android:windowSplashScreenAnimatedIcon=@drawable/splash_brand');
    const wb31 = (th31.match(/android:windowBackground">([^<]+)</) || [])[1];
    if (!wb31) F('values-v31 没重抄 windowBackground（同名 style 是替换不是合并，缺项=首帧回白）');
    else if (/@drawable\//.test(wb31)) F('values-v31 的 windowBackground 用了 @drawable，系统启动屏后又叠带图首帧 = logo 闪两次');
    const namesOf = s => (s.match(/<item name="[^"]+"/g) || []).map(m => m.slice(12, -1));
    const miss = namesOf(th).filter(n => !namesOf(th31).includes(n));
    if (miss.length) F('values-v31 漏重抄：' + miss.join(',') + '（同名 style 整体替换，漏一项等于把那项退回系统默认）');
    console.log('启动屏闸门: ' + (RES === RES_SHELL ? '外部壳 ' : '仓库壳源副本 ') + RES + ' 对账，线稿色 ' + (cm || '-') + '，几何 ' + geoOk + '/' + geoTotal + ' 吻合，v31 首帧双 logo 抑制 ' + (wb31 && !/@drawable\//.test(wb31) ? 'OK' : '红'));
    fail += bad;
  }
}

/* 16. 备份与云同步闸门（P1-4 · 批次8）。三道锁，一把比一把难绕：
   ① 在沙箱里真跑 backup.js，拿它**自己的**策略函数对账（不做正则影子）：代码里每一个形似
      存储键的字符串字面量必须落在「采集 / 禁入 / 未登记」三态之一，未登记即红；
      采集集与文档字段表逐键、逐组、逐合并语义相等；禁入集与闸门里带理由的 EXPECT_NEVER 相等
      —— 想悄悄加一个禁入键、或偷偷注册一个采集键，两头都会红。
   ② 接线：设置页卡片 11 个控件、sw.js SHELL、TravelNotes.replaceNotes、恢复后刷新页面。
   ③ 纪律：backup.js 不许裸写游记库（回灌只能走 persist 的 diff 通道）；云同步模块不留 console 输出。 */
{
  let bad = 0;
  const F16 = m => { console.log('备份闸门 FAIL: ' + m); bad++; };
  const NL16 = /\r?\n/;
  const read16 = f => { if (!fs.existsSync(f)) { F16('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const BK = read16('backup.js'), WD = read16('sync-webdav.js');
  const SET = read16('settings.html'), TN16 = read16('travel-notes.js'), SW = read16('sw.js');
  read16('tools/smoke-backup.js'); read16('tools/webdav-stub.js');
  read16('改进实施方案与验收标准.md');

  /* 沙箱：backup.js 只在函数体里碰 indexedDB / TravelNotes，加载期只要一个内存 localStorage */
  const bstore = {}, bwin = {};
  const bctx = vm.createContext({
    window: bwin, console,
    localStorage: {
      getItem: k => (k in bstore ? bstore[k] : null),
      setItem: (k, v) => { bstore[k] = String(v); },
      removeItem: k => { delete bstore[k]; },
      key: i => Object.keys(store0())[i] === undefined ? null : Object.keys(store0())[i],
      get length() { return Object.keys(bstore).length; }
    }
  });
  function store0() { return bstore; }
  try { vm.runInContext(BK, bctx, { filename: 'backup.js' }); }
  catch (e) { F16('backup.js 在沙箱里跑不起来：' + e.message); }
  const B = bwin.Backup;
  if (!B) { F16('backup.js 没导出 window.Backup'); }
  else {
    if (B.SCHEMA !== 2) F16('SCHEMA 应为 2，实际 ' + B.SCHEMA);
    if (B.KIND !== 'trace-backup-full') F16('KIND 漂移：' + B.KIND);
    ['collect', 'serialize', 'validate', 'describe', 'apply', 'policyOf', 'classOf', 'mergeById', 'mergeDict', 'secretHits']
      .forEach(fn => { if (typeof B[fn] !== 'function') F16('缺导出 ' + fn); });

    /* --- ① 全量存储键对账：扫产品文件里所有形似存储键的字面量（含走包装函数的，正则只认整串） --- */
    const seen = new Map();
    fs.readdirSync('.').filter(f => /\.(js|html)$/.test(f)).forEach(f => {
      const s = fs.readFileSync(f, 'utf8');
      (s.match(/'tn_[A-Za-z0-9_]+'|'travelNotes'/g) || []).forEach(m => {
        const k = m.slice(1, -1);
        if (!seen.has(k)) seen.set(k, new Set());
        seen.get(k).add(f);
      });
    });
    const collected = [], neverSeen = [], unreg = [];
    seen.forEach((where, k) => {
      const c = B.classOf(k);
      if (c === 'unregistered') unreg.push(k + ' ← ' + [...where].join(','));
      else if (c === 'never') neverSeen.push(k);
      else collected.push({ k: k, g: c });
    });
    if (unreg.length) F16('未登记的存储键字面量 ' + unreg.length + ' 个：' + unreg.join(' | ')
      + '（新键必须先在 backup.js 策略表登记，或明确禁入并在本闸门留理由——宁可漏采，也不要把没审计过的东西同步出去）');

    /* 禁入集要与闸门里逐条带理由的表**两边相等**：多一条要理由，少一条要解释 */
    const EXPECT_NEVER = {
      'tn_aiKey': '旧版单站点 AI Key', 'tn_key_': '各站点 AI Key 前缀', 'tn_amap_key': '高德 Web Key',
      'tn_webdav': 'WebDAV 账号与口令', 'tn_webdav_autosync': '自动上传开关绑这台机器的凭据', 'tn_webdav_last': '上次同步结果只对本机展示',
      'tn_photo_': '图片镜像缓存，可再生', 'tn_rt_': '车程耗时缓存', 'tn_d_': '距离缓存', 'tn_tk_': '门票信息缓存', 'tn_weather_': '天气缓存',
      'tn_storefail_warned': '存储写满告警位（只提示一次）', 'tn_b64_warned': '内嵌告警位', 'tn_lastVoiceError': '语音诊断回显',
      'tn_lastBackup': '本机导出时间', 'tn_rc_idx': 'planner 撤销栈下标', 'tn_emptyClosed': '空态卡片关闭位',
      'tn_model': '旧版单站点模型名，migrate() 归位后由 tn_model_deepseek 进备份'
    };
    const neverHit = k => Object.keys(EXPECT_NEVER).find(e => /_$/.test(e) ? k.indexOf(e) === 0 : k === e);
    neverSeen.forEach(k => { if (!neverHit(k)) F16('禁入键没在闸门登记理由：' + k + '（backup.js 里悄悄加了 NEVER？）'); });
    Object.keys(EXPECT_NEVER).forEach(e => {
      if (![...seen.keys()].some(k => /_$/.test(e) ? k.indexOf(e) === 0 : k === e)) F16('闸门里的禁入条目已失效，代码里再也扫不到：' + e + '（删掉这行或说明为什么还留着）');
    });
    /* 哨兵扫描本身要活着：把三类密钥塞回包里，serialize 必须抛 */
    ['tn_aiKey', 'tn_key_deepseek', 'tn_amap_key'].forEach(k => {
      const e = { kind: B.KIND, schema: 2, notes: [], albums: [], storage: { data: {}, prefs: {} } };
      e.storage.prefs[k] = 'x';
      let threw = false;
      try { B.serialize(e); } catch (err) { threw = /禁入键/.test(err.message); }
      if (!threw) F16('哨兵扫描失效：塞进 ' + k + ' 居然还能出包');
    });

    /* 采集集 ↔ 文档字段表逐键相等（组与合并语义也比，防止文档只写个名字） */
    const doc = fs.readFileSync('改进实施方案与验收标准.md', 'utf8');
    const anchor = '### 批次 8 落地（2026-10-04）：BACKUP_SCHEMA 2 字段表与合并语义';
    const at = doc.indexOf(anchor);
    if (at < 0) F16('文档缺字段表小节：' + anchor);
    else {
      const next = doc.indexOf('\n### ', at + anchor.length);
      const seg = doc.slice(at, next < 0 ? doc.length : next);
      const rows = {};
      seg.split(NL16).forEach(l => {
        const m = l.match(/^\|\s*`([^`]+)`\s*\|\s*(data|prefs)\s*\|\s*(id|dict|whole)\s*\|/);
        if (m) rows[m[1]] = { g: m[2], m: m[3] };
      });
      const code = {};
      B.KEYS.forEach(e => { code[e.k || e.p] = { g: e.g, m: e.m }; });
      Object.keys(code).forEach(k => { if (!rows[k]) F16('文档字段表漏键 ' + k); });
      Object.keys(rows).forEach(k => {
        if (!code[k]) F16('文档字段表多出一个代码并不采集的键 ' + k);
        else if (rows[k].g !== code[k].g || rows[k].m !== code[k].m)
          F16('键 ' + k + ' 两说不一致：文档 ' + rows[k].g + '/' + rows[k].m + ' · 代码 ' + code[k].g + '/' + code[k].m);
      });
      console.log('备份闸门: 存储键字面量 ' + seen.size + ' 个（采集 ' + collected.length + ' / 禁入 ' + neverSeen.length
        + ' / 未登记 ' + unreg.length + '），策略表 ' + B.KEYS.length + ' 条与文档字段表 ' + Object.keys(rows).length + ' 行逐键相等');
    }
  }

  /* --- ② 接线 --- */
  ['backup.js', 'sync-webdav.js'].forEach(f => {
    if (!SET.includes('<script src="' + f + '"></script>')) F16('settings.html 没引 ' + f);
  });
  ['wdUrl', 'wdDir', 'wdUser', 'wdPass', 'wdTestBtn', 'wdSaveBtn', 'wdPushBtn', 'wdPullBtn', 'wdForceBtn', 'swWdAuto', 'wdStatus']
    .forEach(i => { if (!SET.includes('id="' + i + '"')) F16('云同步卡片缺控件 #' + i); });
  if (!/id="wdPass"\s+type="password"/.test(SET)) F16('口令输入框不是 type=password，会在设置页明文回显');
  if (!/group-title">云同步</.test(SET)) F16('缺「云同步」分组标题');
  if (!/绝不进备份/.test(SET)) F16('卡片没向用户写明密钥不进备份');
  /* 恢复后要刷新：锚点必须钉在「拉取成功」那条提示上——字体重置也有一处 location.reload，
     只扫整页会被它蒙过去（§16 变异自测 M10 抓到的假绿） */
  const pullMsg = SET.split(NL16).findIndex(l => l.indexOf('页面即将刷新') >= 0);
  if (pullMsg < 0) F16('找不到恢复成功提示（文案「页面即将刷新」漂移）');
  else if (!/location\.reload/.test(SET.split(NL16).slice(pullMsg, pullMsg + 3).join(NL16)))
    F16('恢复后没刷新页面（各页启动时现读存储，不刷新等于没恢复）');
  ['./backup.js', './sync-webdav.js'].forEach(f => { if (!SW.includes("'" + f + "'")) F16('sw.js SHELL 缺 ' + f); });
  if (!/replaceNotes:\s*function/.test(TN16)) F16('travel-notes.js 没导出 replaceNotes（恢复没有写入口）');

  /* --- ③ 纪律 --- */
  BK.split(NL16).forEach((line, i) => {
    if (/gujian-notes/.test(line) && /readwrite|createObjectStore|\.put\(/.test(line))
      F16('backup.js:' + (i + 1) + ' 疑似裸写游记库，回灌必须走 TravelNotes.replaceNotes 的 persist diff 通道');
  });
  if (!/trace-full-backup\.json/.test(WD)) F16('sync-webdav.js 远端文件名漂移（不是 trace-full-backup.json）');
  if (!/MKCOL/.test(WD)) F16('sync-webdav.js 没有 MKCOL 建目录链路');
  if (!/tn_webdav_autosync/.test(WD) || !/=== '1'/.test(WD)) F16('sync-webdav.js 自动同步开关不是「显式打开才生效」');
  if (!/function redact/.test(WD)) F16('sync-webdav.js 缺口令抹除函数');
  if (/console\.(log|warn|error|info)\(/.test(WD)) F16('sync-webdav.js 里有 console 输出——别把带口令的 URL 打进日志');
  fail += bad;
}

/* ============================================================
   17. 只读行程分享闸门（批次 9 · P1-5）
   分享是这条产品线唯一「把内容交出去」的通道，所以闸门不查字符串出没出现，
   而是在沙箱里真跑 share.js：喂一个带照片/备注/密钥的脏行程，看出去的载荷里还有没有。
   ① 行为：白名单构造、编解码往返、超长与无基址的降级、基址协议收紧。
   ② 接线：planner 入口 + 确认卡 + 系统分享失败落回复制；settings 基址；sw SHELL。
   ③ 对账：分享页与 planner 的日卡版式逐条声明必须逐字相等——两份样式，漂移就是丑的开始。
   ============================================================ */
{
  let bad = 0;
  const F17 = m => { console.log('分享闸门 FAIL: ' + m); bad++; };
  const read17 = f => { if (!fs.existsSync(f)) { F17('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const SH = read17('share.js'), SA = read17('share.html'), PLJ = read17('planner.js'), PLH = read17('planner.html');
  const SET17 = read17('settings.html'), SW17 = read17('sw.js'), PK = read17('vendor/pako.min.js');
  read17('vendor/pako-LICENSE.txt');
  if (!PK) F17('vendor/pako.min.js 缺失或为空（share.js 解压全靠它）');

  /* --- 沙箱：share.js 只碰 localStorage / location / window.pako / btoa / TextDecoder --- */
  const sstore = {}, swin = {};
  const sctx = vm.createContext({
    window: swin, console, JSON, Math, Number, String, Array, Object, isFinite, parseInt, RegExp, Error, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    /* atob 必须按浏览器口径严格：Node 的 Buffer(s,'base64') 连 URL-safe 的 -_ 都照单全收，
       拿它当桩会把「解码端忘了还原字符表」这类真 bug 洗成绿灯。 */
    atob: s => {
      const body = String(s).replace(/\s+/g, '').replace(/=+$/, '');
      if (/[^A-Za-z0-9+/]/.test(body) || body.length % 4 === 1) throw new Error('InvalidCharacterError');
      return Buffer.from(body, 'base64').toString('binary');
    },
    encodeURIComponent, decodeURIComponent,
    location: { protocol: 'file:', pathname: '/storage/0/planner.html', origin: 'null' },
    localStorage: {
      getItem: k => (k in sstore ? sstore[k] : null),
      setItem: (k, v) => { sstore[k] = String(v); },
      removeItem: k => { delete sstore[k]; }
    }
  });
  /* pako 在宿主侧 require（浏览器 UMD 也认 module.exports）：在 vm 沙箱里直接执行它会因为
     缺 TextEncoder 而炸，而真浏览器里它有全套内建——闸门不该被沙箱的内建差异绊倒，
     但要的是「这个 vendor 文件载得动、有 deflate/inflate」。 */
  let PAKO = null;
  try { PAKO = require(path.join(__dirname, '..', 'vendor', 'pako.min.js')); }
  catch (e) { F17('vendor/pako.min.js 载入失败：' + e.message); }
  if (PAKO && (typeof PAKO.deflate !== 'function' || typeof PAKO.inflate !== 'function'))
    F17('vendor/pako.min.js 载入了但没有 deflate/inflate 导出');
  swin.pako = PAKO;
  try { vm.runInContext(SH, sctx, { filename: 'share.js' }); } catch (e) { F17('share.js 在沙箱里跑不起来：' + e.message); }
  const S = swin.Share;
  if (!S) { F17('share.js 没导出 window.Share'); }
  else {
    /* --- ① 行为 --- */
    ['payloadOf', 'strayKeys', 'encodePayload', 'decodePayload', 'summary', 'textOf', 'build', 'normBase', 'savedBase', 'setBase', 'linkBase', 'hasPako']
      .forEach(fn => { if (typeof S[fn] !== 'function') F17('缺导出 ' + fn); });
    if (S.URL_LIMIT > 7000) F17('URL_LIMIT=' + S.URL_LIMIT + ' 超过聊天软件 7000 字符的实测上限');
    if (S.BASE_KEY !== 'tn_share_base') F17('BASE_KEY 漂移：' + S.BASE_KEY);

    const dirty = {
      name: '晋陕豫 5 日自驾', startDate: '2026-10-20',
      start: { name: '北京', lat: 39.9, lng: 116.4 }, end: { name: '北京', lat: 39.9, lng: 116.4, isLoop: true },
      dist: { 'a|b': 12345 }, narrative: { story: '这段是自己写的游记正文，绝不能出现在链接里' },
      userNote: '私密备注', aiKey: 'sk-SECRET',
      days: [0, 1, 2, 3, 4].map(d => ({
        driveKm: 61.4 + d * 3, totalH: 7.25 + d,
        stops: [{ name: '五台山', lat: 39.0812, lng: 113.5518, photo: 'data:image/png;base64,SECRETPIX', note: '只有本机可见', audio: 'blob:x' },
          { name: '平遥古城', lat: 37.2050, lng: 112.1830, ticket: { price: 125 } }]
      }))
    };
    const p = S.payloadOf(dirty);
    const pj = JSON.stringify(p);
    ['photo', 'note', 'audio', 'story', 'SECRET', 'aiKey', 'ticket', 'narrative', 'userNote', 'tn_']
      .forEach(w => { if (pj.indexOf(w) >= 0) F17('载荷里混进了「' + w + '」——白名单不是删字段，是逐字段构造，改坏了就是把用户内容发出去了'); });
    const stray = S.strayKeys(p);
    if (stray.length) F17('载荷含白名单外字段：' + [...new Set(stray)].join(','));
    const su = S.summary(p);
    if (su.days !== 5 || su.stops !== 10) F17('汇总与源行程不符：' + JSON.stringify(su));
    if (su.km !== Math.round(p.days.reduce((n, d) => n + d.km, 0))) F17('总里程与逐日之和不一致');
    /* 往返必须逐字相等：解码端和编码端不是同一套字节口径，链接发出去就是废的 */
    const back = S.decodePayload(S.encodePayload(p));
    if (!back) F17('encodePayload → decodePayload 往返失败（解不开自己编的包）');
    else if (JSON.stringify(back) !== JSON.stringify(p)) F17('往返结果与原文不等价：' + JSON.stringify(back).slice(0, 60));
    if (S.decodePayload('v2.abc') !== null) F17('版本前缀不符时应判坏包');
    if (S.decodePayload('v1.@@@@') !== null) F17('坏 base64url 应解码为 null，不能抛给页面');
    /* 基址收紧：只认 http(s)。填个 javascript: 或 file: 进去，生成的链接要么钓鱼要么对方打不开。
       光测 javascript:alert(1) 不够 —— 它没有 //，任何「scheme://」式的正则都能挡掉；
       javascript://host/ 才会漏过宽松协议白名单，所以两个都要断。 */
    [['javascript:alert(1)', ''], ['javascript://evil.com/%0aalert(1)', ''],
      ['ftp://a/b', ''], ['file:///sdcard/app', ''],
      ['HTTPS://A.COM/app/', 'HTTPS://A.COM/app'], ['https://a.com/app/share.html', 'https://a.com/app'],
      ['https://a.com/app///', 'https://a.com/app']].forEach(([i, o]) => {
        if (S.normBase(i) !== o) F17('normBase(' + i + ') = ' + JSON.stringify(S.normBase(i)) + '，期望 ' + JSON.stringify(o));
      });
    /* 无基址（本机 file://）与超长的降级：宁可给文本，绝不发一条会被截断的链接 */
    const nb = S.build(dirty);
    if (nb.ok || nb.degrade !== 'no-base' || !nb.text) F17('file:// 且没填基址时应降级为文本，实际 ' + JSON.stringify(nb).slice(0, 60));
    if (!/由 行迹 TRACE 生成/.test(nb.text)) F17('文本降级缺署名尾行');
    if (!/里程为真实道路数据/.test(nb.text)) F17('真实里程的尺子没在文本版里说明');
    const est = JSON.parse(JSON.stringify(dirty)); est.dist = {};
    if (!/折算/.test(S.textOf(S.payloadOf(est)))) F17('估算里程的尺子没在文本版里说明——不说清就是拿估算冒充实测');
    sstore[S.BASE_KEY] = 'https://example.org/trace';
    const big = JSON.parse(JSON.stringify(dirty));
    big.days = [];
    /* 名字够杂才压不动：deflate 能把重复中文行程压到几百字符，用固定词造的"长行程"照样秒过 7000 */
    for (let i = 0; i < 30; i++) {
      const st = [];
      for (let j = 0; j < 15; j++) {
        const seed = (i * 131 + j * 7919) % 1000003;
        st.push({ name: '景点' + seed.toString(36) + '·' + ((seed * 31) % 9973).toString(36) + '观景台' + j,
          lat: 20 + (seed % 7000) / 1000, lng: 100 + (seed % 9000) / 1000 });
      }
      big.days.push({ driveKm: 20 + (i * 7) % 90, totalH: 5 + (i % 8), stops: st });
    }
    const bb = S.build(big);
    if (bb.ok || bb.degrade !== 'too-long' || bb.url) F17('超长行程应判 too-long 且不产出链接，实际 ' + JSON.stringify(bb).slice(0, 60));
    if (bb.chars <= S.URL_LIMIT) F17('too-long 时应回报真实长度 ' + bb.chars);
    if (S.build({ days: [] }).reason !== '还没有排出行程') F17('空行程应给 reason，不该弹确认卡');
    const link = S.build(dirty);
    if (!link.ok || link.url.indexOf('https://example.org/trace/share.html#v1.') !== 0) F17('填了基址就该出可点开的链接，实际 ' + link.url);
    delete sstore[S.BASE_KEY];

    /* 基址键必须已在备份策略里登记：改了 BASE_KEY 忘了登记，换机后就丢一个「为什么链接打不开」的谜 */
    const b17 = {};
    const bctx17 = vm.createContext({
      window: {}, console,
      localStorage: { getItem: k => (k in b17 ? b17[k] : null), setItem: (k, v) => { b17[k] = String(v); }, removeItem: k => { delete b17[k]; } }
    });
    try { vm.runInContext(read17('backup.js'), bctx17, { filename: 'backup.js' }); } catch (e) { F17('backup.js 沙箱失败：' + e.message); }
    const BK17 = bctx17.window.Backup;
    if (!BK17) F17('backup.js 没导出 Backup，基址键无从对账');
    else {
      const cls = BK17.classOf(S.BASE_KEY), pol = BK17.policyOf(S.BASE_KEY);
      if (cls !== 'prefs') F17('存储键 ' + S.BASE_KEY + ' 在备份策略里是「' + cls + '」，应为 prefs（改了 BASE_KEY 忘了登记，换机就丢分享设置）');
      else if (!pol || pol.m !== 'whole') F17('键 ' + S.BASE_KEY + ' 合并语义不是 whole');
    }
  }

  /* --- ② 接线 --- */
  if (!/<script src="vendor\/pako\.min\.js"><\/script>/.test(SA)) F17('share.html 没引 vendor/pako.min.js');
  if (!/<script src="share\.js"><\/script>/.test(SA)) F17('share.html 没引 share.js');
  if (!/<script src="theme\.js"><\/script>/.test(SA)) F17('share.html 没在最前引 theme.js（暗色会先白闪一下）');
  if (!/Share\.decodePayload\(/.test(SA)) F17('share.html 没调 decodePayload');
  if (!/location\.hash/.test(SA)) F17('share.html 没从 location.hash 取载荷');
  ['这条链接没有带上行程', '压缩库没加载，解不开链接', '链接内容读不出来'].forEach(t => {
    if (!SA.includes(t)) F17('share.html 缺一条失败态文案「' + t + '」');
  });
  /* 交付壳没注册 traceapp:// intent-filter，页面上放「用行迹打开」就是一个点不动的死控件 */
  if (/traceapp:|用行迹打开/.test(SA)) F17('share.html 出现了唤起按钮——壳侧 AndroidManifest 没有对应 intent-filter，那是个死控件');
  if (!/class="map-pin"/.test(SA)) F17('share.html 地图标记没走 map-pin 品牌组件');
  if (!/dashArray/.test(SA)) F17('share.html 没画离线可用的示意连线');
  if (!/window\.shareCopyText\s*=/.test(SA)) F17('share.html 的复制按钮没有实现（只有按钮没函数＝死控件）');
  if (!/window\.plannerShare\s*=\s*function/.test(PLJ)) F17('planner.js 没有 plannerShare 实现');
  if (!/onclick="window\.plannerShare\(\)"/.test(PLJ)) F17('planner 结果区没挂「分享行程」按钮');
  if (!/UI\.confirm\(\{ title: '分享这份行程'/.test(PLJ)) F17('分享没走确认卡——用户必须先看一眼要交出去什么');
  if (!/不会分享：游记正文、照片、录音、任何 API Key/.test(PLJ)) F17('确认卡没向用户写明不会分享什么');
  if (!/typeof navigator\.share === 'function'/.test(PLJ)) F17('plannerShare 没优先走系统分享');
  if ((PLJ.match(/copyText\(r\.url\)/g) || []).length < 2) F17('plannerShare 缺系统分享失败后的复制兜底（WebView 里 navigator.share 常是空壳）');
  if (!/<script src="share\.js" defer><\/script>/.test(PLH)) F17('planner.html 没加载 share.js');
  if (!/<script src="vendor\/pako\.min\.js" defer><\/script>/.test(PLH)) F17('planner.html 没加载 pako');
  if (!/id="shareBaseInput"/.test(SET17) || !/Share\.setBase\(/.test(SET17)) F17('settings 没有分享网址输入或没落盘');
  if (!/<script src="share\.js"><\/script>/.test(SET17)) F17('settings.html 没引 share.js');
  ['./share.html', './share.js', './vendor/pako.min.js'].forEach(f => { if (!SW17.includes("'" + f + "'")) F17('sw.js SHELL 缺 ' + f); });
  read17('tools/smoke-share.js');

  /* --- ③ 版式对账：同一套日卡，两份 CSS，逐字不许漂 --- */
  const PAR = ['#mapBox', '.day-card', '.day-card .dhead', '.day-card .dhead .dmeta', '.day-card .stop', '.day-card .stop .n',
    '.day-card .stop .meta', '.stop .lbl', '.stop-name', '.stop-name .lbl', '.stop-meta',
    '.day-card.transit', '.day-card.transit .dhead', '.transit-route', '.transit-route span',
    '.theme-dark .day-card', '.theme-dark .day-card .stop .n', '.btn'];
  const styleOf = f => { const m = f.match(/<style>([\s\S]*?)<\/style>/); return m ? m[1] : ''; };
  function ruleMap(css) {
    const out = {};
    css.split(/\r?\n/).forEach(l => {
      const t = l.trim(), bi = t.indexOf('{');
      if (bi < 0 || t[bi + 1] === '-' || !t.endsWith('}')) return;   /* 跳过多行规则与注释行 */
      const sel = t.slice(0, bi).trim();
      (out[sel] = out[sel] || []).push(t.slice(bi));
    });
    return out;
  }
  const PR = ruleMap(styleOf(PLH)), SR = ruleMap(styleOf(SA));
  let par = 0;
  PAR.forEach(sel => {
    const a = PR[sel] || [], b = SR[sel] || [];
    if (a.length !== 1) { F17('planner.html 里选择器 ' + sel + ' 定义了 ' + a.length + ' 次，对账没有唯一锚点'); return; }
    if (b.length !== 1) { F17('share.html 缺选择器 ' + sel + '（日卡版式应与 planner 同一份）'); return; }
    if (a[0] !== b[0]) F17('版式漂移 ' + sel + '：planner ' + a[0].slice(0, 40) + '… / share ' + b[0].slice(0, 40) + '…');
    else par++;
  });
  if (!/seal = 'day-seal ds-' \+ \(di % 6 \+ 1\)/.test(PLJ)) F17('planner 日卡章算法漂移，分享页的 ds-* 对账失去基准');
  if (SA.indexOf('<span class="\' + sealClass(di) + \'">D') < 0 || !/return 'day-seal ds-' \+ \(i % 6 \+ 1\);/.test(SA))
    F17('share.html 的日卡章没按 planner 的 ds-(i%6+1) 走');
  console.log('分享闸门: 行为断言（脏行程出包 ' + (S ? 'OK' : 'SKIP') + '），版式对账 ' + par + '/' + PAR.length + '，降级两态（无基址 / 超长）已验');
  fail += bad;
}

/* ============================================================
   18. 逐日天气闸门（批次 10 · P1-6）
   天气是排线里唯一「行程已经排完、还要再补一轮网络」的功能，最容易做成
   又慢又吵、满屏「加载失败」。闸门只盯三件事：码表与游记同源、拿不到就当
   这件事不存在、开关与缓存的键各归各位（一个进备份、一字节都不许出去）。
   ============================================================ */
{
  let bad = 0;
  const F18 = m => { console.log('天气闸门 FAIL: ' + m); bad++; };
  const read18 = f => { if (!fs.existsSync(f)) { F18('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const PL = read18('planner.js'), PLH = read18('planner.html'), TN = read18('travel-notes.js');
  const IC = read18('icons.js'), SET18 = read18('settings.html'), SH18 = read18('share.html');
  const BK18 = read18('backup.js'), SM18 = read18('tools/smoke-planner.js'), DOC18 = read18('改进实施方案与验收标准.md');

  /* --- ① 码表对账：两份 WMO 表都按对象字面量真解析（不写影子实现），逐码比 --- */
  const lit18 = (src, re, what) => {
    const m = src.match(re);
    if (!m) { F18('取不到' + what + '的字面量（改了写法请同步本闸门）'); return null; }
    try { return vm.runInNewContext('(' + m[1] + ')'); }
    catch (e) { F18(what + ' 字面量解析失败：' + e.message); return null; }
  };
  const G18 = lit18(PL, /var WMO_G = (\{[\s\S]*?\n  \})/, 'planner 的 WMO_G');
  const W18 = lit18(TN, /var WMO = (\{[^}]*\})/, 'travel-notes 的 WMO');
  let NAMES18 = null;
  {
    const m = IC.match(/window\.TI_NAMES = (\[[^\]]*\])/);
    if (!m) F18('icons.js 取不到 TI_NAMES');
    else { try { NAMES18 = JSON.parse(m[1]); } catch (e) { F18('TI_NAMES 不是合法 JSON 数组：' + e.message); } }
  }
  let codes18 = 0;
  if (G18 && W18) {
    const kg = Object.keys(G18).map(Number).sort((a, b) => a - b);
    const kw = Object.keys(W18).map(Number).sort((a, b) => a - b);
    const missG = kw.filter(k => kg.indexOf(k) < 0), missW = kg.filter(k => kw.indexOf(k) < 0);
    if (missG.length) F18('planner 码表缺码，这些天气在游记里有、日卡上不会显示：' + missG.join(','));
    if (missW.length) F18('planner 码表多出游记没有的码：' + missW.join(','));
    /* 同一个码在两处不能说两种话：游记表带 emoji 前缀，去前缀后逐字比 */
    const strip = s => String(s).replace(/^[^一-龥]+/, '');
    kg.forEach(k => {
      const g = G18[k];
      if (!Array.isArray(g) || g.length !== 2) { F18('WMO_G[' + k + '] 不是 [字形, 中文] 两项'); return; }
      if (W18[k] && strip(W18[k]) !== g[1]) F18('码 ' + k + ' 两处中文不一致：planner「' + g[1] + '」/ 游记「' + strip(W18[k]) + '」');
      if (NAMES18 && NAMES18.indexOf(g[0]) < 0) F18('码 ' + k + ' 的字形 "' + g[0] + '" 不在 icons.js 的 TI_NAMES 里——日卡上会是一块空白');
      codes18++;
    });
  }

  /* --- ② 口径逐值核定：缓存时长与预报窗口拿源码里的字面量求值，不认注释 --- */
  const num18 = (name, want, why) => {
    const m = PL.match(new RegExp('var ' + name + ' = ([^;]+);'));
    if (!m) { F18('取不到 var ' + name + '（' + why + '）'); return; }
    let v; try { v = vm.runInNewContext('(' + m[1] + ')'); } catch (e) { F18(name + ' 求值失败：' + e.message); return; }
    if (v !== want) F18(name + ' 应为 ' + want + '，实际 ' + v + '（' + why + '）');
  };
  num18('WX_TTL', 6 * 3600 * 1000, '文档口径：预报一天更新几轮，缓存 6 小时');
  num18('WX_HORIZON', 15, '接口只给到 T+16，第 16 天起没有数据');

  /* --- ③ 接口口径：forecast（不是 archive）、同一天首尾、三字段与游记一套、零 Key --- */
  if (PL.indexOf("'https://api.open-meteo.com/v1/forecast'") < 0) F18('天气接口地址漂移（排线查未来，应是 forecast 不是 archive）');
  if (/archive-api/.test(PL)) F18('planner 用了历史天气接口：过期日期的天气不属于排线，宁可什么都不显示');
  if (PL.indexOf('daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto') < 0) F18('daily 参数与 travel-notes 不是同一套字段');
  if (!/&start_date=' \+ date \+ '&end_date=' \+ date/.test(PL)) F18('没把 start_date 与 end_date 钉成同一天，取回来的就不止一天');

  const WXBLK = (() => {
    const a = PL.indexOf('var WX_TTL'), b = PL.indexOf('function renderDaysBody');
    if (a < 0 || b < 0 || b <= a) { F18('找不到天气模块的边界（var WX_TTL … function renderDaysBody）'); return ''; }
    return PL.slice(a, b);
  })();
  /* 静默降级的硬口径：这一整块里不许出现任何"我失败了"的话术，也不许留 console */
  [['console.', '往控制台刷日志'], ['toast(', '弹 toast'], ['errorBox', '挂错误卡'],
    ['重试', '放重试话术'], ['alert(', '弹系统框'], ['getAmapKey', '读高德 Key'], ['tn_amap_key', '读本机密钥']]
    .forEach(([s, why]) => { if (WXBLK.indexOf(s) >= 0) F18('天气模块里出现「' + s + '」——' + why + '，取不到天气就该当这件事没发生'); });
  if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(WXBLK)) F18('天气模块里出现 emoji 字形（P0-1 已收口成 SVG 图标）');
  if (!/if \(!g\) return '';/.test(WXBLK)) F18('没登记的天气码必须不显示，不能摆「天气码 50」');
  {
    const m = WXBLK.match(/function wxSlot[\s\S]*?\n  }/);
    if (!m) F18('取不到 wxSlot 的函数体');
    else {
      const n = (m[0].match(/return ''/g) || []).length;
      if (n < 3) F18('wxSlot 的静默出口从 ' + n + ' 条掉到不足 3 条（开关关/缺坐标/超出预报期三条都要有）');
    }
  }
  if (!/rememberCacheKey\(k\)/.test(WXBLK)) F18('天气缓存没走 rememberCacheKey 的 LRU——localStorage 会无界膨胀');
  if (!/function wxRun\(job\) \{ gateRun\(wxGate, job\); \}/.test(PL)) F18('天气没走与高德同族的限流闸门（并发 2）');
  if (!/gateRun\(amapGate, job\)/.test(PL)) F18('amapRun 不再走公共闸门，两份限流逻辑开始各写各的');
  if (!/r\.status === 429 && \(tries \|\| 0\) < 2/.test(PL) || !/wxRest\(url, cb, \(tries \|\| 0\) \+ 1\); \}, 700 \* \(\(tries \|\| 0\) \+ 1\)\)/.test(PL)) F18('天气缺被限流后的退避重试（最多 2 次）');
  if (!/weatherOn\(\)[\s\S]{0,80}getItem\('tn_planner_weather'\) !== '0'/.test(PL)) F18('天气开关不是「默认开、写 0 才关」');

  /* --- ④ 接线：两处日卡都要有天气位，渲染完补槽，转场日也要有坐标可查 --- */
  {
    const a = PL.indexOf('function renderDaysBody'), b = PL.indexOf('function renderNarrative');
    if (a < 0 || b < 0 || b <= a) F18('找不到 renderDaysBody 的边界，日卡天气位无从对账');
    else {
      /* 只数函数体内的调用点：定义处那句 function wxSlot(trip, di) 不是调用 */
      const n = ((PL.slice(a, b).match(/\+ wxSlot\(trip, di\)/g) || []).length);
      if (n !== 2) F18('renderDaysBody 里 wxSlot 调用应为 2 处（普通日卡 + 赶路日），实际 ' + n + ' 处');
    }
  }
  if (!/resultBody'\)\.innerHTML = h;\s*\n\s*wxHydrate\(trip\);/.test(PL)) F18('渲染后没补槽：缓存没命中的日子永远不会显示天气');
  if (!/tla: to && to\.lat != null/.test(PL)) F18('赶路日没存终点坐标——长途那天恰恰最该看天气');
  if (!/\.day-card \.dhead \.wxh\{display:none\}/.test(PLH)) F18('planner.html 的空槽没设 display:none，取不到天气时会在日卡上留一个位');
  if (!/\.day-card \.dhead \.wx\{[^}]*flex:0 0 auto[^}]*white-space:nowrap/.test(PLH)) F18('.wx 没设 flex:0 0 auto + white-space:nowrap，320px 窄屏会把导航键挤出去');

  /* --- ⑤ 键两清：开关要能同步，缓存一字节都不许进备份（拿 backup.js 自己的分类函数判） --- */
  const litKeys18 = src => [...new Set((src.match(/'tn_[A-Za-z0-9_]+'/g) || []).map(s => s.slice(1, -1)))];
  const wxCache = litKeys18(PL).filter(k => /^tn_weather_/.test(k));
  const wxSw = litKeys18(PL).filter(k => k === 'tn_planner_weather');
  /* 开关键绝不能落在 tn_weather_ 前缀里：topic-common 的 pruneKV 清缓存会把开关一起扫掉
     （文档原方案写 tn_weather=0 正是这个雷，复核时改名为 tn_planner_weather）。
     这条要能被打红，只能反过来钉「tn_weather 家族里只许有缓存前缀这一个键」——
     若写成「wxSw[0] 是否以 tn_weather_ 开头」，两个 filter 条件天然互斥，永远不红（变异自测抓到过）。 */
  if (wxCache.length !== 1 || wxCache[0] !== 'tn_weather_d_') F18('planner 里 tn_weather 家族只许有缓存前缀 tn_weather_d_ 一个键，实际：' + (wxCache.join(',') || '无') + '（开关若叫 tn_weather* 会被 pruneKV 连带清掉）');
  if (!wxSw.length) F18('planner 没读天气开关键 tn_planner_weather');
  {
    const bstore18 = {}, bwin18 = {};
    const bctx18 = vm.createContext({
      window: bwin18, console, JSON, Math, Object, String, Array, Number, Date, isFinite, parseInt,
      localStorage: {
        getItem: k => (k in bstore18 ? bstore18[k] : null),
        setItem: (k, v) => { bstore18[k] = String(v); },
        removeItem: k => { delete bstore18[k]; },
        key: i => Object.keys(bstore18)[i] === undefined ? null : Object.keys(bstore18)[i],
        get length() { return Object.keys(bstore18).length; }
      }
    });
    try { vm.runInContext(BK18, bctx18, { filename: 'backup.js' }); }
    catch (e) { F18('backup.js 在天气闸门里跑不起来：' + e.message); }
    const B18 = bwin18.Backup;
    if (!B18) F18('backup.js 没导出 window.Backup，天气键无从对账');
    else {
      if (wxSw.length && B18.classOf(wxSw[0]) !== 'prefs') F18('开关 ' + wxSw[0] + ' 没注册成 prefs（换机就丢，或被当数据同步）：实际 ' + B18.classOf(wxSw[0]));
      if (wxCache.length && B18.classOf(wxCache[0] + '30.50_114.30_2026-10-05') !== 'never')
        F18('逐日天气缓存没被 tn_weather_ 禁入前缀盖住——它会跟着备份跑到别人机器上');
    }
  }

  /* --- ⑥ 其它两处不许越界：分享页不替访客发请求；设置页开关真接上 --- */
  if (/open-meteo|tn_weather|wxSlot|class="wx"/.test(SH18)) F18('分享页里出现了天气——链接只该展示写进行程里的那些字，不给看链接的人发第三方请求');
  if (!/id="swWx"/.test(SET18)) F18('设置页没有日卡天气开关控件');
  if (!/lsSave\('tn_planner_weather'/.test(SET18)) F18('设置页开关没落键');
  if (!/行程日卡显示天气/.test(SET18)) F18('开关文案漂了（高级设置里那条「行程日卡显示天气」）');

  /* --- ⑦ 冒烟里必须真测了天气，不是只有闸门在盯着源码 ---
     每条锚点都取「只出现一次的那一行」，这样它被改掉时闸门一定红；
     宽锚点（如光一个 __wxCalls）删掉自增点也不会红，等于没闸。
     后 6 条是批次 13-F 加的：dayN 这一枚计数是整段阈值（calls >= dayN、
     cacheKeys.length === dayN、wxN === dayN）的分母，读到 0 就全体恒真。
     实测同一份代码两次跑出 0 和 3（tools/out/b13-smoke-planner.txt vs -rerun.txt），
     读到 0 那次「排好行程后按天发起天气请求」输出的是「请求 0 次 / 0 天」的**假绿**。
     变异自测（tools/out/b13-planner-mut-v{1,2,2b}.txt）：摘掉 wizardDone 尾部 1600ms →
     首读 0 但 poll 收回 3、84/84 仍绿（证明 poll 在干活）；再拆掉 poll 退回一次性读数 →
     7 条红，补齐四条口径的下界后同一变异 14 条红，且每条 detail 自己说出「0 张日卡（首读 0）」。 */
  [["if \\(u\\.indexOf\\('api\\.open-meteo\\.com'\\) >= 0\\) \\{", 'mock 预报接口的拦截点'],
    ['window\\.__wxCalls\\+\\+', '数取数次数的计数器自增点'],
    ["\\$\\$eval\\('#resultBody \\.day-card \\.wx'", '日卡天气位计数'],
    ["localStorage\\.setItem\\('tn_planner_weather', '0'\\)", '关掉开关后的无天气态'],
    ['wxOpen\\(.ok., 40\\)', '超出预报期那一档'], ['__wxMode = .down.', '断网那一档'],
    ['wxOpen\\(.rate., 2\\)', '被 429 限流那一档'],
    ['if \\(dayN > 0 && dayN === dayPrev\\) break;', 'dayN 取样 poll 到两轮相等（一次性读数读到 0 会让本口径所有 >= dayN 阈值恒真）'],
    ['const dayFirst = await p\\.\\$\\$eval', '落定前首读留证（红了要能分清是采样早了还是产品真没渲染）'],
    ['w1\\.dayN >= 1 &&', '口径①阈值分母带下界'],
    ['w2\\.dayN >= 1 &&', '口径②（超预报期）阈值分母带下界——这条的期望值是 0 个请求，没下界就是空跑也算过'],
    ['w3\\.dayN >= 1 &&', '口径③（坏包/断网）阈值分母带下界'],
    ['w4\\.dayN >= 1 &&', '口径④（429 限流）阈值分母带下界']]
    .forEach(([re, what]) => { if (!new RegExp(re).test(SM18)) F18('smoke-planner.js 里缺' + what + '——闸门写了不等于测过'); });

  /* --- ⑧ 文档：键名更正在案，本节欠账清零 --- */
  {
    const a = DOC18.indexOf('## P1-6'), b = DOC18.indexOf('## P1-7');
    if (a < 0 || b < 0 || b <= a) F18('文档里找不到 §P1-6 的边界');
    else {
      const sec = DOC18.slice(a, b);
      if (!/tn_planner_weather/.test(sec)) F18('§P1-6 没写开关键名（文档原方案要写 tn_weather，与既有缓存前缀撞名，这条更正必须在案）');
      if (/- \[ \]/.test(sec)) F18('§P1-6 还有未勾选项，批次 10 不能算收工');
      if (!/6\s*(小时|h)/.test(sec)) F18('§P1-6 没写缓存时长口径');
    }
  }

  console.log('天气闸门: 码表 ' + codes18 + ' 码与游记逐码对账、字形全在 TI_NAMES；缓存 6h 与窗口 T+15 逐值核定；'
    + '静默降级（模块内零 toast/零错误卡/零 console）；键两清（开关 prefs ↔ 缓存 never）；分享页零天气请求');
  fail += bad;
}

/* ============================================================
   19. 时序与转场闸门（批次 11 · P2-7）
   动效烂掉的方式通常不是「不工作」，而是各写各的时长：改一处 token 别处不动、
   减动效只管 duration 不管 delay、转场把导航拦住。闸门盯六件事——
   唯一时序来源、阶梯逐值核定、减动效全覆盖、三处转场接线且不拦路、动画中间态不许拿来量几何、
   以及浏览器那头确实在测。
   ============================================================ */
{
  let bad = 0;
  const F19 = m => { console.log('时序转场闸门 FAIL: ' + m); bad++; };
  const read19 = f => { if (!fs.existsSync(f)) { F19('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const D = read19('design.css'), U = read19('ui.js'), PL = read19('planner.js'), TN = read19('travel-notes.js');
  const SMOKE = read19('tools/smoke-motion.js'), RD = read19('README.md'), DOC19 = read19('改进实施方案与验收标准.md');

  /* --- ① 阶梯逐值核定：token 表按字面量求值成毫秒，与期望逐键比（多一档少一档改值都红） --- */
  const WANT = { none: 0.01, tap: 120, fast: 160, mid: 240, normal: 280, page: 360, enter: 480, slow: 520, long: 700,
    spin: 800, tick: 1000, flash: 1200, shimmer: 1300, pulse: 1800, boot: 2200, breath: 2800, drift: 3200, step: 40 };
  const rung = {};
  (D.match(/--motion-[a-z]+:[^;]+;/g) || []).forEach(s => {
    const n = /--motion-([a-z]+):/.exec(s)[1], m = /:\s*(\d*\.?\d+)(ms|s)\s*;/.exec(s);
    if (!m) { F19('--motion-' + n + ' 不是裸时长（' + s + '）：token 本身就是账本，不许再套 var/calc'); return; }
    rung[n] = m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
  });
  Object.keys(WANT).forEach(n => {
    if (!(n in rung)) F19('时序阶梯缺 --motion-' + n + '（期望 ' + WANT[n] + 'ms）');
    else if (rung[n] !== WANT[n]) F19('--motion-' + n + ' 应为 ' + WANT[n] + 'ms，实际 ' + rung[n] + 'ms');
  });
  Object.keys(rung).forEach(n => { if (!(n in WANT)) F19('多出一档 --motion-' + n + '=' + rung[n] + 'ms，未在本闸门核定口径'); });
  /* 同一组件父子两层反向旋转靠跨档才有相对速度，撞档=转圈看起来冻住，所以档位不许重值 */
  const dup = Object.keys(rung).filter((n, i, a) => a.some((o, j) => j < i && o !== n && rung[o] === rung[n]));
  if (dup.length) F19('时序阶梯撞档（同值会让父子反向旋转看起来停住）：' + dup.join(','));

  /* --- ② 裸时序归零：第一方 css + 各页 <style> 与 style 属性，声明值段里不许有非零 ms/s ---
     探针先用已知坏样本自证能抓到，再拿 token 样本自证不误报——否则正则写错就是一盏永久绿灯。 */
  const RAW = /(^|[^A-Za-z0-9_.-])(?!0(\.0*)?(ms|s)\b)\d*\.?\d+(ms|s)\b/;
  const bare = decl => RAW.test(decl.replace(/var\([^)]*\)/g, ''));
  if (!bare('transition:opacity .25s')) F19('裸时序探针自身失效：已知坏样本 .25s 没被抓到');
  if (bare('transition:transform var(--motion-tap) ease')) F19('裸时序探针误报：token 声明被当成魔法数字');
  if (bare('animation:none 0s 1 normal')) F19('裸时序探针误报：CSSOM 把 animation:none 展开出来的 0s 被抓进来了');
  /* 边界类里必须带引号：`style="animation-delay:…"` 的声明紧跟在 `"` 之后，只认 `[\s;{]` 的话
     整条「行内 style 属性」扫描面会一条都抓不到（变异自测 M7 抓出来的死扫描面）。 */
  const declScan = (label, src) => {
    (src.match(/(?:^|[\s;{"'])(?:transition|animation)(?:-duration|-delay)?:[^;}]*/g) || [])
      .forEach(seg => { if (bare(seg)) F19('裸时序字面量（' + label + '）：' + seg.trim().slice(0, 70)); });
  };
  {
    const files = fs.readdirSync('.').filter(f => /\.(css|html)$/.test(f));
    if (files.length < 18) F19('时序扫描面只有 ' + files.length + ' 个第一方 css/html，覆盖不足');
    files.forEach(f => {
      const src = read19(f);
      if (f.endsWith('.css')) { declScan(f, src); return; }
      declScan(f + ' <style>', (src.match(/<style[\s\S]*?<\/style>/g) || []).join('\n'));
      declScan(f + ' style 属性', (src.match(/style="[^"]*"/g) || []).join('\n'));
    });
  }

  /* --- ③ 别名族只能派生，不许自带字面量 --- */
  ['--t-fast:var(--motion-fast)', '--t-norm:var(--motion-normal)', '--duration-fast:var(--motion-fast)', '--duration-normal:var(--motion-normal)']
    .forEach(s => { if (D.indexOf(s) < 0) F19('旧时序别名没从 --motion-* 派生：' + s); });

  /* --- ④ 减动效覆盖面：duration + delay + 循环次数 + 滚动 + 转场伪元素，一个都不许漏 --- */
  {
    const a = D.indexOf('@media (prefers-reduced-motion:reduce)');
    if (a < 0) F19('没有减动效块');
    else {
      const b = D.indexOf('\n}', a);
      const blk = D.slice(a, b < 0 ? D.length : b);
      ['animation-duration', 'animation-delay', 'transition-duration', 'transition-delay',
        'animation-iteration-count:1', 'scroll-behavior:auto', '::view-transition-old(*)']
        .forEach(s => { if (blk.indexOf(s) < 0) F19('减动效块缺 ' + s + '（少一样就有半边动效在减动效档照旧跑）'); });
      if (/var\(--motion-none\)(?!!important)/.test(blk)) F19('减动效归零没带 !important：压不住各页局部声明');
      /* delay 要的是「归零」，写 0s；复用 --motion-none(.01ms) 等于凭空加了一拍延迟。
         实测（visual-check 的 album.seed 稳定差 0.06%，A/B 四组合定位）：.01ms 的 animation-delay
         会让首帧停在关键帧 0% 的值上（封面提示 opacity .8 → .35），动画结束后浏览器不补那次重绘，
         减动效模式下就永久停在比基色更淡的一帧——所以这里逐条钉死成 0s。 */
      const delays = blk.match(/(?:animation|transition)-delay:[^;}]+/g) || [];
      if (delays.length < 2) F19('减动效块只找到 ' + delays.length + ' 条 delay 归零声明（animation 与 transition 各至少一条）');
      delays.forEach(s => {
        if (s !== 'animation-delay:0s!important' && s !== 'transition-delay:0s!important')
          F19('减动效块的 delay 必须正好写成 0s!important（.01ms 不是零，会让首帧卡在关键帧 0% 且不再重绘）：' + s);
      });
    }
  }

  /* --- ⑤ 跨文档转场：开通 + root 时长走 token --- */
  if (!/@view-transition\{navigation:auto\}/.test(D)) F19('跨文档转场没开通（@view-transition{navigation:auto}，新旧文档都要认）');
  {
    const m = /::view-transition-old\(root\)[^{]*\{[^}]*\}/.exec(D);
    if (!m) F19('没给 root 伪元素定转场时长（默认转场不吃 --motion-page）');
    else {
      if (m[0].indexOf('var(--motion-page)') < 0) F19('root 转场时长没走 --motion-page token');
      if (bare(m[0])) F19('root 转场时长写了字面量：' + m[0].slice(0, 70));
    }
  }

  /* --- ⑥ 三处转场接线 + 共享元素名同页唯一 --- */
  if (!/function showStage[\s\S]{0,240}UI\.vt\(function/.test(PL)) F19('planner 阶段切换没走 UI.vt（P2-7 三处转场之一）');
  if (!/var flip = function[\s\S]{0,160}UI\.vt\(flip\)/.test(TN)) F19('随手记面板打开没走 UI.vt（P2-7 三处转场之一）');
  if (!/var hide = function[\s\S]{0,160}UI\.vt\(hide\)/.test(TN)) F19('随手记面板关闭没走 UI.vt（只接开不接关会一半有名一半无声）');
  [['index.html', '首页'], ['topic.html', '专题页']].forEach(([f, zh]) => {
    const src = read19(f);
    const n = (src.match(/view-transition-name:search-field/g) || []).length;
    if (n !== 1) F19(zh + ' 里 search-field 出现 ' + n + ' 次：同页重名会让整段转场失效，两处必须各恰好一次');
  });

  /* --- ⑦ UI.vt / UI.motionMs 的契约 --- */
  if (!/window\.UI = \{[^}]*reducedMotion: reducedMotion, motionMs: motionMs, scrollBehavior: scrollBehavior, vt: vt/.test(U)) F19('UI 的四个动效 helper 没导出');
  if (!/\['ready', 'updateCallbackDone', 'finished'\]\.forEach/.test(U)) F19('UI.vt 没给三条 promise 全挂 catch：连开两次转场时 ready 的 AbortError 会冒成「页面报错」（smoke-motion D4 抓到过）');
  if (!/if \(reducedMotion\(\) \|\| !document\.startViewTransition\) \{ fn\(\); return null; \}/.test(U)) F19('UI.vt 降级出口不对：减动效/老内核必须直接执行回调并返回 null，不许把 DOM 改动吞掉');
  if (!/getPropertyValue\('--motion-' \+ name\)/.test(U)) F19('UI.motionMs 没从 :root 回读 --motion-*：CSS 与 JS 会各记一套时长');
  if ((U.match(/motionMs\('normal', 320\)/g) || []).length !== 2) F19('toast/offlineBar 的移除等待应各回读一次 token（2 处），写死 320 会与 --motion-normal 脱节');

  /* --- ⑧ 用了 helper 的页必须载 ui.js（UI 未定义是当场崩，不是静默降级） --- */
  ['planner.js', 'topic-common.js', 'travel-notes.js'].forEach(lib => {
    const src = read19(lib);
    if (!/UI\.(vt|motionMs|scrollBehavior)\(/.test(src)) { F19(lib + ' 不再引用动效 helper，本条锚点需同步闸门'); return; }
    fs.readdirSync('.').filter(f => f.endsWith('.html'))
      .filter(f => read19(f).indexOf('src="' + lib + '"') >= 0)
      .forEach(h => { if (read19(h).indexOf('src="ui.js"') < 0) F19(h + ' 载了 ' + lib + ' 却没载 ui.js：UI 未定义会当场崩'); });
  });

  /* --- ⑨ 浏览器那头确实在测，不是只有源码闸门在盯 --- */
  [['C5 UI.vt 在支持的环境里真的走 startViewTransition', '同文档转场真被调用'],
    ['B8 验收口径「所有动画时长 ≤1 帧」实测', '减动效全页逐元素实测'],
    ['D4 全程无页面未捕获异常', '转场不许冒未捕获拒绝'],
    ['C12 随手记面板开合各走一次转场', '随手记两处接线'],
    ['C4 首页搜索框挂了共享元素名', '共享元素名落地'],
    ['E3 动画全部结束后，可见标签两两不重叠', '入场动画 × 标签避让的回归'],
    ['E4 缩小视野后补测真的又跑过', '视野变化后的避让补测']]
    .forEach(([s, why]) => { if (SMOKE.indexOf(s) < 0) F19('smoke-motion.js 缺' + why + '的断言行：闸门写了不等于测过'); });
  if (RD.indexOf('smoke-motion.js') < 0) F19('README 闸门清单没登记 smoke-motion.js');

  /* --- ⑨b 入场动画 × 标签避让：几何只能在动画结束后量（批次 12 · V5 附） ---
     .tr-node 的 node-fade-in 首帧是 translateY(8px) scale(.6)，而 labelAvoid/capsuleAvoid 靠
     getBoundingClientRect 判重叠。渲染回调在节点创建后 80/120ms 就跑，可能正好落进动画第一帧，
     量到 0.6 倍矩形（实测标签宽 67px vs 稳定 112px）→ 隐藏集是错的，且错态活到截图。
     这条是 topic.1440/768 双态的根因，四条各钉修法的一面，少一条就退回掷硬币。 */
  {
    const TC = read19('topic-common.js');
    if (!/function refitAvoid\(\)[\s\S]{0,220}?requestAnimationFrame\(function \(\) \{ requestAnimationFrame/.test(TC))
      F19('refitAvoid 不是「两拍 rAF」：一拍只保证回调排进本轮 rAF，两拍才保证动画至少推进过一帧');
    ['renderMarkers._av = setTimeout(refitAvoid, 120);', 'window.__cavT = setTimeout(refitAvoid, 80);']
      .forEach(s => { if (TC.indexOf(s) < 0) F19('避让补测的调用点丢了（' + s + '）：渲染回调里直调 capsuleAvoid/labelAvoid 就是在动画中间态上量几何'); });
    if (!/map\.on\('moveend zoomend'[\s\S]{0,180}?refitAvoid/.test(TC))
      F19('moveend zoomend 没走 refitAvoid：视野变了只补胶囊，标签避让不再重测，缩放后新撞出来的重叠没人收');
    if (!/animationend[\s\S]{0,240}?node-fade-in[\s\S]{0,240}?refitAvoid/.test(TC))
      F19('animationend 收尾补测没了：正常档 --motion-enter 480ms 比 80/120ms 的补测长得多，动画结束后不补测就是把错态留到截图');
  }

  /* --- ⑩ 文档口径：判据换过、结论回写 --- */
  {
    const a = DOC19.indexOf('## P2-7'), b = DOC19.indexOf('## P2-8');
    if (a < 0 || b < 0 || b <= a) F19('文档里找不到 §P2-7 的边界');
    else {
      const sec = DOC19.slice(a, b);
      if (!/\(\[0-9\]\+\\.\[0-9\]\+s\|\[0-9\]\+ms\)/.test(sec)) F19('§P2-7 的验收判据没换成「时间字面量归零」——原判据 grep `0.[0-9]+s` 是无效的（文件里写的是 .12s 省零形式，照字面跑一上来就 PASS）');
      if (!/批次 11/.test(sec)) F19('§P2-7 没回写批次 11 的实测结论');
      if (/- \[ \]/.test(sec)) F19('§P2-7 还有未勾选项，批次 11 不能算收工');
    }
  }
  console.log('时序转场闸门: 阶梯 ' + Object.keys(rung).length + ' 档逐值核定且无撞档；'
    + '第一方 css/html 声明内裸时序 0 处（探针带正反向自证）；减动效 duration+delay+循环+滚动+转场伪元素全覆盖；'
    + '跨文档开通且 root 时长走 token；三处 UI.vt 接线 + 共享元素名同页唯一；UI.vt 三 promise 全 catch；'
    + '避让只在动画结束后量几何（两拍 rAF + 两条渲染回调 + moveend/zoomend + animationend 收尾各钉一处）；smoke-motion 断言在案');
  fail += bad;
}

/* ============================================================
   20. 个性化画像闸门（批次 11 · P2-8）
   画像是本仓库第一条「把用户本机数据喂给第三方 AI」的链路，红线只有一条：
   出门的只能是聚合口径，正文一个字都不许走。其余全是工程账：默认值、开关落键、
   键进备份、注入点唯一、新用户不崩。
   ============================================================ */
{
  let bad = 0;
  const F20 = m => { console.log('画像闸门 FAIL: ' + m); bad++; };
  const read20 = f => { if (!fs.existsSync(f)) { F20('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const PL = read20('planner.js'), SET = read20('settings.html'), BK = read20('backup.js');
  const SM = read20('tools/smoke-planner.js'), DOC = read20('改进实施方案与验收标准.md');

  /* --- ① 聚合函数：默认开、库不在也不崩、有上限、不碰正文 --- */
  if (!/function prefSummary\(\)/.test(PL)) F20('没有 prefSummary()（画像聚合入口）');
  if (!/var PREF_KEY = 'tn_plan_pref';/.test(PL)) F20('画像开关键名漂了（planner 里应是 var PREF_KEY = \'tn_plan_pref\'）');
  if (!/getItem\(PREF_KEY\) !== '0'/.test(PL)) F20('个性化推荐不是「默认开、写 0 才关」');
  {
    const m = /function prefSummary\(\)[\s\S]*?\n  \}/.exec(PL);
    if (!m) F20('取不到 prefSummary 的函数体');
    else {
      const b = m[0];
      if (!/if \(!prefOn\(\)\) return '';/.test(b)) F20('开关关掉后 prefSummary 没有直接返回空串');
      if (!/window\.TravelNotes && TravelNotes\.list/.test(b) || !/window\.Wish && Wish\.list/.test(b)) F20('prefSummary 没判数据库在不在——新用户或未载 wishlist.js 的页会当场崩');
      if (!/\.slice\(0, 160\)/.test(b)) F20('画像串没有 160 字上限：prompt 会随游记数量无界膨胀');
      if (/\.text|\.raw/.test(b)) F20('prefSummary 读了游记正文/原声——画像只许给聚合关键词');
      if (!/tags/.test(b)) F20('画像没取近期标签（vibe 口径断了）');
      if (!/theme/.test(b)) F20('画像没取心愿单主题');
    }
  }

  /* --- ② 注入点唯一且带护栏（多一个注入点=多一处没人审计过的出门口） --- */
  if ((PL.match(/prefSummary\(\)/g) || []).length !== 2) F20('prefSummary 只许「定义 1 处 + aiPlanRoutes 调用 1 处」，实际 ' + (PL.match(/prefSummary\(\)/g) || []).length + ' 处');
  {
    const a = PL.indexOf('function aiPlanRoutes'), b = PL.indexOf('function arData_regions');
    if (a < 0 || b < 0 || b <= a) F20('找不到 aiPlanRoutes 的边界');
    else {
      const fn = PL.slice(a, b);
      if (!/prefSummary\(\)/.test(fn)) F20('AI 精选路线没把画像拼进 prompt');
      if (!/用户画像/.test(fn)) F20('prompt 里没有「用户画像」段名（画像进出去了也看不出来）');
      if (!/不要因为画像/.test(fn)) F20('画像段没带护栏：模型会为迎合画像推荐目的地之外的景点');
      if (/\.text\b|\.raw\b|SECRET/.test(fn)) F20('aiPlanRoutes 的 prompt 里出现游记正文');
    }
  }

  /* --- ③ 键两清：开关注册 prefs，且不落进任何缓存/禁入前缀 --- */
  {
    const bstore = {}, bwin = {};
    const ctx = vm.createContext({
      window: bwin, console, JSON, Math, Object, String, Array, Number, Date, isFinite, parseInt,
      localStorage: {
        getItem: k => (k in bstore ? bstore[k] : null),
        setItem: (k, v) => { bstore[k] = String(v); },
        removeItem: k => { delete bstore[k]; },
        key: i => Object.keys(bstore)[i] === undefined ? null : Object.keys(bstore)[i],
        get length() { return Object.keys(bstore).length; }
      }
    });
    try { vm.runInContext(BK, ctx, { filename: 'backup.js' }); }
    catch (e) { F20('backup.js 在画像闸门里跑不起来：' + e.message); }
    const B = bwin.Backup;
    if (!B) F20('backup.js 没导出 window.Backup，画像键无法对账');
    else {
      const c = B.classOf('tn_plan_pref');
      if (c !== 'prefs') F20('tn_plan_pref 应为 prefs（换机要带走、又不带数据），实际 ' + c + '：没登记就采不到，落成 never 就是关掉一次开关不同步');
    }
  }

  /* --- ④ 设置页给的是看得懂、关得掉的开关 --- */
  if (!/id="swAiPref"/.test(SET)) F20('设置页没有「个性化推荐」开关控件');
  if (!/lsSave\('tn_plan_pref'/.test(SET)) F20('设置页开关没落键（关掉一次，刷新就回来）');
  if (!/个性化推荐/.test(SET)) F20('开关文案漂了');
  if (!/只给聚合关键词，不带游记正文/.test(SET)) F20('开关副标题没写清画像是什么——用户有权知道要出门的是哪几个字');

  /* --- ⑤ 冒烟真测在案（判据落在真发出去的请求体上） --- */
  [["u\\.indexOf\\('chat/completions'", '拦 AI 请求体的桩'],
    ['画像只出门送关键词，游记正文一个字都不发', '正文不出门的断言'],
    ["localStorage\\.setItem\\('tn_plan_pref', '0'", '关掉开关那一档'],
    ['aiOpen\\(false\\)', '新用户零历史那一档'],
    ['画像是聚合出来的', '省市/主题/关键词逐个在体里']]
    .forEach(([re, what]) => { if (!new RegExp(re).test(SM)) F20('smoke-planner.js 缺' + what + '：闸门写了不等于测过'); });

  /* --- ⑥ 文档：键名与口径在案，欠账清零 --- */
  {
    const a = DOC.indexOf('## P2-8'), b = DOC.indexOf('## 豁免登记');
    if (a < 0 || b < 0 || b <= a) F20('文档里找不到 §P2-8 的边界');
    else {
      const sec = DOC.slice(a, b);
      if (!/tn_plan_pref/.test(sec)) F20('§P2-8 没写开关键名');
      /* 原判据是 `/不送|不带|正文/`——三个常见词任一命中就绿，等于永远绿；换成两句原文逐字钉。 */
      if (!/只送聚合关键词/.test(sec) || !/正文.{0,14}不出门/s.test(sec)) F20('§P2-8 没写「只送聚合口径、正文不出门」这条隐私口径');
      if (/- \[ \]/.test(sec)) F20('§P2-8 还有未勾选项，批次 11 不能算收工');
    }
  }
  console.log('画像闸门: 聚合口径（省市/主题/标签）逐条钉死、160 字上限、零正文；注入点唯一（定义+调用各 1）且带目的地护栏；开关 tn_plan_pref=prefs/默认开；设置页可见开关落键；冒烟四档在案');
  fail += bad;
}

/* ============================================================
   21. 字号阶梯 · 真机档 · 品牌字进包闸门（V3 · 2026-10-04）
   这一节守的是一条「看着像审美、其实是账」的线：收口前全站 998 处 font-size（同一口径：顶层
   css/html/js 61 个文件、排除 *-data.js 与 sw.js、注释剥成空白）只有 17 处
   走 token、57 个字号并存（11/11.5/12/12.5/13/13.5…），且除 9 行 clamp 外全是裸 px——
   于是（a）真机（一加 Ace 6T，CSS 视口 424–452dp）上标题按 vw 浮了 20%、正文一点不浮，
   层级比例随屏幕漂；（b）设置页那套「小字/标准/大字」和系统字体缩放只能作用到 17 处引用上，
   等于 shipped 了一个假功能。所以这里既钉阶梯，也钉「根字号必须是相对值」。
   ============================================================ */
{
  let bad = 0;
  const F21 = m => { console.log('字号阶梯闸门 FAIL: ' + m); bad++; };
  const read21 = f => { if (!fs.existsSync(f)) { F21('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  /* 注释里的写法不是声明：不剥掉，「html{font-size:16px}」这种讲解用例会把探针和字面量计数一起打红
     （本轮就踩了一次：design.css 的「阅读字号」块在注释里举了改前的坏写法）。
     占位成同长度的空白而不是删掉——行内扫描按行走，跨行注释一旦被压成一行，
     相邻声明就会并到同一行被 clamp 的跳过规则误吞。 */
  const blank21 = m => m.replace(/[^\n]/g, ' ');
  const strip21 = s => s.replace(/\/\*[\s\S]*?\*\//g, blank21).replace(/<!--[\s\S]*?-->/g, blank21);
  const code21 = f => strip21(read21(f));
  const D = read21('design.css'), SW = read21('sw.js'), SY = read21('tools/sync-assets.js');
  const Dc = strip21(D), SWc = strip21(SW);

  /* --- ① 阶梯逐值核定：十档必须全是 rem，值逐个比，多一档/缺/改值都红 --- */
  const WANT21 = { 1: 0.625, 2: 0.6875, 3: 0.75, 4: 0.8125, 5: 0.875, 6: 0.9375, 7: 1, 8: 1.0625, 9: 1.25, 10: 1.5 };
  const rung21 = {};
  (Dc.match(/^\s*--fs-\d+:[^;]+;/gm) || []).forEach(s => {
    const n = /--fs-(\d+):/.exec(s)[1], m = /:\s*(\d*\.?\d+)rem\s*;/.exec(s);
    if (!m) { F21('--fs-' + n + ' 不是裸 rem（' + s.trim() + '）：阶梯用 rem，px 会把系统字体缩放钉死'); return; }
    rung21[n] = parseFloat(m[1]);
  });
  Object.keys(WANT21).forEach(n => {
    if (!(n in rung21)) F21('字号阶梯缺 --fs-' + n + '（期望 ' + WANT21[n] + 'rem）');
    else if (rung21[n] !== WANT21[n]) F21('--fs-' + n + ' 应为 ' + WANT21[n] + 'rem，实际 ' + rung21[n] + 'rem');
  });
  Object.keys(rung21).forEach(n => { if (!(n in WANT21)) F21('字号阶梯多出一档 --fs-' + n + '=' + rung21[n] + 'rem，未在本闸门核定'); });
  /* 撞值=两档其实是同一档，留着只会让人随手挑错 */
  const dup21 = Object.keys(rung21).filter((n, i, a) => a.some((o, j) => j < i && +rung21[o] === +rung21[n]));
  if (dup21.length) F21('字号阶梯撞档（同值等于没有这一档）：' + dup21.join(','));

  /* --- ② 旧名必须是阶梯的别名，不许偷偷带回字面量 --- */
  ['xs', 'sm', 'md', 'lg', 'xl'].forEach(n => {
    const m = new RegExp('--fs-' + n + ':\\s*([^;]+);').exec(Dc);
    if (!m) F21('旧字号别名 --fs-' + n + ' 不见了（16 处存量引用会一起失效）');
    else if (!/^var\(--fs-\d+\)$/.test(m[1].trim())) F21('--fs-' + n + ' 不再是纯别名：' + m[1].trim());
  });

  /* --- ③ 根字号必须是相对值：html/:root 上出现 px 字号就是红 ---
     探针先自证：已知坏样本必须抓到、正确写法不许误报，否则这条线是永久绿灯。 */
  const ROOTPX = /(?:^|[\s;}])(?:html|:root)\s*\{[^}]*font-size:\s*\d*\.?\d+px/;
  if (!ROOTPX.test('html{font-size:16px}')) F21('根字号探针自身失效：已知坏样本 html{font-size:16px} 没被抓到');
  if (ROOTPX.test('html{font-size:var(--fs-7)}') || ROOTPX.test('@media x{html{font-size:112%}}')) F21('根字号探针误报：rem/% 写法被当成钉死');
  fs.readdirSync('.').filter(f => /\.(css|html)$/.test(f)).forEach(f => {
    const src = code21(f);
    (src.match(/(?:html|:root)\s*\{[^}]*\}/g) || []).forEach(b => { if (ROOTPX.test(' ' + b)) F21(f + ' 把根字号钉成 px（用户在系统里调的字体大小会整个失效）：' + b.slice(0, 60)); });
  });

  /* --- ④ 机型档 / 用户档逐串在案：少一档就是某个屏幕或某个设置项没人管 ---
     两条乘数相乘（bucket = 屏幕那一档、stage = 用户在设置页选的档），根字号全库只有一处声明。
     这不是洁癖：原来三条 `html{font-size:…}` 各写各的，而 `html.font-sm` 比媒体查询里的 `html`
     更具体，真机 452 档上选「大字」掉回 17px、比「标准」的 17.92 还小——档位倒挂。 */
  [[':root{--fs-bucket:1;--fs-stage:1}', '两档乘数的默认值'],
   ['html{font-size:calc(100% * var(--fs-bucket) * var(--fs-stage))}', '根字号唯一声明（机型×用户相乘）'],
   ['html.font-sm{--fs-stage:.9375}', '设置页小字档乘数'],
   ['html.font-lg{--fs-stage:1.0625}', '设置页大字档乘数'],
   ['@media (min-width:400px) and (max-width:439px){:root{--fs-bucket:1.08}}', '424dp 真机档'],
   ['@media (min-width:440px) and (max-width:479px){:root{--fs-bucket:1.12}}', '452dp 真机档'],
   [':root{--fs-bucket:.9375}', '320dp 收紧档乘数'],
   ['@media (max-width:360px)', '320dp 收紧档的媒体条件']]
    .forEach(([s, what]) => { if (!Dc.includes(s)) F21('缺' + what + '，逐字应为 ' + s); });
  {
    const rootDecls = (Dc.match(/(?:^|[\s;}])html(?:\.font-(?:sm|lg))?\s*\{[^}]*font-size:/g) || []).length;
    if (rootDecls !== 1) F21('design.css 里根字号声明有 ' + rootDecls + ' 处（只许 1 处）：机型档与用户档必须出乘数，各写一条 font-size 就是让 specificity 互相吃掉');
    fs.readdirSync('.').filter(f => /\.(css|html)$/.test(f) && f !== 'design.css').forEach(f => {
      if (/(?:^|[\s;}])(?:html|:root)\s*\{[^}]*font-size:/.test(code21(f))) F21(f + ' 也声明了根字号：两处 font-size 会互相吃掉（真机上「大字」比「标准」还小就是这么来的）');
    });
  }

  /* --- ⑤ 字面量归零：第一方 css/html/js 里 font-size:<数字>(px|rem) 只许 ≥21px 尾巴与 clamp 例外 ---
     LIT 天生匹配不进 clamp( 里（数字前面是 `clamp(`），所以原来那行
     `if (line.includes('clamp(')) continue;` 一次都没生效过——变异自测把它摘掉 verify 仍 exit=0。
     例外就得点名：clamp 处数逐值钉死，这行才是活的。 */
  const LIT = /font-size:\s*(\d+(?:\.\d+)?)(px|rem)/g;
  let litBad = 0, tail = 0, used = 0, clampN = 0;
  const TAIL_MAX = 59;      /* 2026-10-04 收口时实测：≥21px 的展示级/海报数字，本轮有意不动，只许降不许升 */
  const LIT_MIN_USE = 600;  /* 走 token 的下限：收口后实测 929 处，掉下这条说明有人在批量退回字面量（下限留低是因为它还兼做「扫描面非空」的反向自证） */
  const CLAMP_MAX = 9;      /* 2026-10-04 实测：design.css 2 / album.html 2 / index.html 3 / album.js 2 */
  fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js')
    .forEach(f => {
      const src = code21(f);
      src.split('\n').forEach(line => {
        clampN += (line.match(/font-size:clamp\(/g) || []).length;
        let m; LIT.lastIndex = 0;
        while ((m = LIT.exec(line))) {
          const v = m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * 16;
          if (v > 20) { tail++; continue; }
          litBad++;
          if (litBad <= 6) F21('阶梯外字号字面量（' + f + '）：' + m[0].trim());
        }
        used += (line.match(/font-size:var\(--fs-/g) || []).length;
      });
    });
  if (litBad) F21('还有 ' + litBad + ' 处 ≤20px 的字号没进阶梯（跑 tools/out/ladder-sweep.js --write）');
  if (tail > TAIL_MAX) F21('≥21px 字号尾巴从 ' + TAIL_MAX + ' 涨到 ' + tail + ' 处：新写的展示级字号也要走阶梯');
  if (used < LIT_MIN_USE) F21('font-size 走阶梯的引用只剩 ' + used + ' 处（下限 ' + LIT_MIN_USE + '）：疑似批量退回字面量');
  if (clampN !== CLAMP_MAX) F21('font-size:clamp(...) 从登记的 ' + CLAMP_MAX + ' 处变成 ' + clampN + ' 处：clamp 是绕开阶梯和根字号的例外（vw 驱动，不随真机档上浮），每加一处都要先点名');

  /* --- ⑥ 品牌衬线进包对账：文件在、字节指纹对、预缓存里有、同步白名单里有、缺字登记不漂 --- */
  let COV = null;
  try { COV = JSON.parse(read21('fonts/coverage.json')); } catch (e) { F21('fonts/coverage.json 读不到/不是合法 JSON：' + e.message); }
  if (COV) {
    Object.keys(COV.files).forEach(name => {
      const p = 'fonts/' + name;
      if (!fs.existsSync(p)) { F21('清单登记了 ' + p + ' 但文件不在'); return; }
      const buf = fs.readFileSync(p);
      if (buf.length !== COV.files[name].bytes) F21(p + ' 字节数漂了：清单 ' + COV.files[name].bytes + ' 实际 ' + buf.length);
      const hex = require('crypto').createHash('sha256').update(buf).digest('hex');
      if (hex !== COV.files[name].sha256) F21(p + ' sha256 与清单不符（字体被换过，覆盖率结论作废）');
      if (!SWc.includes('./fonts/' + name)) F21(p + ' 不在 sw.js 预缓存清单里：离线首屏会没有品牌字');
    });
    if (!fs.existsSync('fonts/OFL-1.1.txt')) F21('缺 fonts/OFL-1.1.txt：SIL OFL 要求授权文本随字体同行');
    if (COV.missingCjk.length !== 94) F21('缺字数从登记的 94 漂到 ' + COV.missingCjk.length + '：语料加字或换字库后要重跑 tools/out/font-coverage.py 并同步这里');
    if (COV.corpusCjkChars - COV.covered !== COV.missingCjk.length) F21('覆盖率三数不自洽：语料 ' + COV.corpusCjkChars + ' − 覆盖 ' + COV.covered + ' ≠ 缺字 ' + COV.missingCjk.length);
  }
  if (!/['"]fonts['"]/.test(SY)) F21('tools/sync-assets.js 的目录白名单里没有 fonts：APK assets 会漏字体');
  if (!/--font-display:\s*'TRACE Serif'/.test(D)) F21('--font-display 队首不是 TRACE Serif：包内字库白装了');

  /* --- ⑦ 卡片边界单一来源：.card 只许定义一次，且必须吃 --edge-hair --- */
  const cardRules = (Dc.match(/^\.card\{/gm) || []).length;
  if (cardRules !== 1) F21('.card 基础规则出现 ' + cardRules + ' 次（应为 1）：皮肤层再写第二遍就是当年「保存键被藏死」那个坑');
  {
    const m = /^\.card\{[^}]*\}/m.exec(Dc);
    if (m && !/var\(--edge-hair\)/.test(m[0])) F21('.card 没引用 --edge-hair：边界又准备靠淡投影，450ppi 亮屏下会看不见');
  }
  ['--edge-hair:rgba(33,26,19,.14)', '--edge-hair:rgba(239,233,220,.16)'].forEach(s => { if (!Dc.includes(s)) F21('缺一条 --edge-hair（浅色/暗色各一）：' + s); });

  console.log('字号阶梯闸门: 阶梯 ' + Object.keys(rung21).length + ' 档逐值核定且全 rem；旧名 5 个纯别名；根字号禁 px（探针带正反向自证）；' +
    '机型/用户档 8 串在案且根字号全库单一声明（424/452dp 真机 × 大小字两个乘数 + 320dp 收紧）；' +
    '阶梯外 ≤20px 字面量 ' + litBad + ' 处、≥21px 尾巴 ' + tail + '/' + TAIL_MAX + '、clamp 例外 ' + clampN + '/' + CLAMP_MAX + '、走阶梯 ' + used + ' 处；' +
    '字体两档字节+sha256 与清单逐条相等且在 sw 预缓存、缺字 94 三数自洽、sync-assets 白名单含 fonts；.card 单定义吃 --edge-hair');
  fail += bad;
}

/* ============================================================
   22. 实景图统一压色 + 分界描边闸门（UI-4 · 2026-10-04）
   这节守的是「75 张来路不同的实景照贴在同一个纸面上」这件事。取数探针
   tools/out/photo-tint-probe.js 在 64×64 采样上算了整批照片的离散度，三档结论：
     · 乘性滤镜（saturate/brightness 一类）只会把整批一起压，σ(S) 才降 4%——它治「艳」，不治「乱」；
     · 真压批内离散度的是「向同一个颜色做凸组合」的那层 veil：每通道 σ 乘 (1−α)，
       α=.10 + 轻滤镜合起来 σ(S)−15%、σ(色温 R−B)−16%，明度均值只从 45.3% 掉到 41.5%；
     · α 有上限：α=.18 时「过暗样本」从 4 张涨到 8 张，压色反过来吃掉暗部。
   所以档位不是手感，是算出来的，闸门逐值钉住；要改就重跑探针。
   比档位更容易出事的是「表面清单」和「后发覆盖」：
     · 少一条表面＝那张照片这一轮没人管，全站看上去就是一半压过一半没压；
     · map.css 有两条 .ls-img（894 与 1331 的后发装饰段），第二条一旦漏写 inset 环，
       封面描边整块消失——同一元素只有一个 ::after，自带影与 veil 必须合并成一条声明。
   ============================================================ */
{
  let bad = 0;
  const F22 = m => { console.log('实景图闸门 FAIL: ' + m); bad++; };
  const read22 = f => { if (!fs.existsSync(f)) { F22('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const blank22 = m => m.replace(/[^\n]/g, ' ');
  const strip22 = s => s.replace(/\/\*[\s\S]*?\*\//g, blank22).replace(/<!--[\s\S]*?-->/g, blank22);
  const code22 = f => strip22(read22(f));
  const FILES22 = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
  const esc22 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flat22 = s => s.replace(/\s+/g, ' ').trim();

  /* 逗号在 :has() 的括号里不算选择器分隔符 */
  const splitSels = s => {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  };
  /* 把 css 拍平成「选择器 → 声明体」的账本：按声明反查它挂在哪些选择器上，
     这样「表面清单少一条」和「这条表面没挂上这条声明」都当场红，不靠数行数。 */
  const parse = src => {
    const f = flat22(src), out = [], re = /([^{}]+)\{([^{}]*)\}/g;
    let m, i = 0;
    while ((m = re.exec(f))) {
      const body = m[2].trim();
      /* 一条规则展开成 N 条「选择器→声明体」，rule 号留着：
         「挂载点唯一」这类判据问的是几条**规则**，不是几条选择器。 */
      splitSels(m[1]).forEach(sel => out.push({ sel, body, rule: i }));
      i++;
    }
    return out;
  };
  const D = code22('design.css'), MAP = code22('map.css');
  const DR = parse(D), MR = parse(MAP);
  const has = (rules, sel, decl) => rules.some(r => r.sel === sel && r.body.includes(decl));
  const need = (label, list, rules, decl) => list.forEach(s => { if (!has(rules, s, decl)) F22(label + '：' + s + ' 缺 ' + decl); });
  const countSel = (rules, sel) => rules.filter(r => r.sel === sel).length;

  /* --- ① 三个 token 逐值核定：档位是探针算出来的，改值必须重跑 tools/out/photo-tint-probe.js --- */
  const TOKS = ['--photo-veil:rgba(33,26,19,.10)', '--photo-look:saturate(.94)', '--photo-edge:rgba(33,26,19,.20)'];
  TOKS.forEach(t => {
    const n = (flat22(D).match(new RegExp(esc22(t), 'g')) || []).length;
    if (n !== 1) F22('design.css 里 ' + t + ' 出现 ' + n + ' 次（应为 1）：veil 的 α 有实测上限（.18 时过暗样本 4→8），改档请重跑探针再同步这里');
  });
  /* 字面量双写：token 声明之外全站不许再出现这三个值，否则等于某处绕过 token 自己调一档 */
  ['rgba(33,26,19,.10)', 'rgba(33,26,19,.20)', 'saturate(.94)'].forEach(lit => {
    let n = 0;
    FILES22.forEach(f => { n += (flat22(code22(f)).match(new RegExp(esc22(lit), 'g')) || []).length; });
    if (n !== 1) F22(lit + ' 在全站出现 ' + n + ' 次（只许 token 声明那 1 处）：别处再写一遍就是绕开 --photo-* 的第二个真相');
  });

  /* --- ② 表面清单逐条在案（design.css 那块统一声明是唯一的挂载点） --- */
  const WANT_LOOK = ['.card .ph img', '.ls-img>img', '.al-ch-img', '.photo-wall img', '.md-item .thumbs img',
    '.eph img', '.p-cell img', '.n-item .th img', '.story-item__stamp img', '.imgbox>img'];
  const WANT_POS = ['.card .ph', '.eph', '.p-cell', '.n-item .th', '.trip-feature__img', '.imgbox'];
  const WANT_VEIL = ['.card .ph:has(>img)::after', '.eph:has(>img)::after', '.p-cell:has(>img)::after',
    '.n-item .th:has(>img)::after', '.trip-feature__img::after', '.imgbox:has(>img)::after'];
  const WANT_INSET = ['.card .ph:has(>img)', '.n-item .th:has(>img)', '.trip-feature__img', '.imgbox:has(>img)'];
  const WANT_OUTER = ['.al-ch-img', '.photo-wall img', '.md-item .thumbs img'];
  const WANT_DARK = ['.theme-dark .al-ch-img', '.theme-dark .photo-wall img', '.theme-dark .md-item .thumbs img'];
  need('滤镜表面清单', WANT_LOOK, DR, 'filter:var(--photo-look)');
  need('压色容器需有定位', WANT_POS, DR, 'position:relative');
  need('veil 表面清单', WANT_VEIL, DR, 'background:var(--photo-veil)');
  need('容器分界描边清单', WANT_INSET, DR, 'box-shadow:inset 0 0 0 1px var(--photo-edge)');
  need('裸图外圈描边清单', WANT_OUTER, DR, 'box-shadow:0 0 0 1px var(--photo-edge)');
  need('暗色外圈翻转清单', WANT_DARK, DR, 'box-shadow:0 0 0 1px var(--edge-hair)');
  {
    const n = DR.filter(r => r.body.includes('filter:var(--photo-look)')).length;
    if (n !== WANT_LOOK.length) F22('吃 --photo-look 的表面有 ' + n + ' 条（清单 ' + WANT_LOOK.length + ' 条）：清单与实际挂载不一致');
  }
  /* 滤镜只许一处真相：多条规则分头写 --photo-look，改一档就会漏掉另一档 */
  {
    const rules = new Set(DR.filter(r => /(?:^|;)filter:var\(--photo-look\)/.test(r.body)).map(r => r.rule));
    if (rules.size !== 1) F22('filter:var(--photo-look) 写在 ' + rules.size + ' 条规则里（应为 1 条）：拆成多条就是将来只改一条、另一半照片悄悄没压');
  }

  /* --- ③ 不变式：描边不许脱离压色，外圈不许脱离滤镜，台账不许漂多 ---
     全部按「实际挂载」算。拿 WANT_* 常量互相比是永真的死断言（S2 变异一砸才发现：
     删掉一条 veil 选择器时它一声不吭，因为两边的常量都还在原地）。 */
  const norm = s => s.replace(/::after$/, '').replace(/:has\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const act = pred => [...new Set(DR.filter(pred).map(r => norm(r.sel)))];
  const ACT_VEIL = act(r => /(?:^|;)background:var\(--photo-veil\)/.test(r.body));
  const ACT_INSET = act(r => /(?:^|;)box-shadow:inset 0 0 0 1px var\(--photo-edge\)/.test(r.body));
  const ACT_OUT = act(r => /(?:^|;)box-shadow:0 0 0 1px var\(--photo-edge\)/.test(r.body));
  const ACT_LOOK = act(r => /(?:^|;)filter:var\(--photo-look\)/.test(r.body));
  const LEDG_VEIL = WANT_VEIL.map(norm), LEDG_INSET = WANT_INSET.map(norm);
  ACT_VEIL.forEach(b => { if (!LEDG_VEIL.includes(b)) F22('挂了 veil 却不在清单里的表面 ' + b + '：新增表面必须先登记，否则这一轮的对账不成立'); });
  ACT_INSET.forEach(b => {
    if (!LEDG_INSET.includes(b)) F22('挂了 inset 描边却不在清单里的表面 ' + b);
    if (!ACT_VEIL.includes(b)) F22('容器 ' + b + ' 有 inset 描边却没挂 veil：描边压在没收拾过的照片上，等于没分层');
  });
  ACT_OUT.forEach(b => {
    if (!WANT_OUTER.map(norm).includes(b)) F22('挂了外圈描边却不在清单里的表面 ' + b);
    if (!ACT_LOOK.includes(b)) F22('裸图 ' + b + ' 有外圈描边但没吃 --photo-look：环内的照片还是原来的色温');
  });

  /* --- ④ 封面（map.css 两条 .ls-img）：后发声明不许吃掉描边，::after 只能有一条 --- */
  {
    const n = countSel(MR, '.ls-img');
    if (n !== 2) F22('.ls-img 规则 ' + n + ' 条（现为 894 与后发装饰段共 2 条）：条数变了要重看后发覆盖');
    MR.filter(r => r.sel === '.ls-img').forEach(r => {
      /* 不写「有 box-shadow 才检查」：把整条 box-shadow 删掉同样会丢描边，那种写法正好给它放行 */
      if (!r.body.includes('box-shadow:inset 0 0 0 1px var(--photo-edge)'))
        F22('.ls-img 的一条声明里没有 inset 环（后发段整条覆盖 box-shadow 也算）：' + r.body.slice(0, 90));
    });
    const af = MR.filter(r => r.sel === '.ls-img::after');
    if (af.length !== 1) F22('.ls-img::after 有 ' + af.length + ' 条：同一元素只能有一个 ::after，分两处写会互相吃掉');
    af.forEach(r => {
      /* UI-5 起这条压色收进 --scrim-cover；闸门跟着改认 token，
         并单独确认 :root 里真的声明了它——否则 var() 会被解析成无效值，整条 background 一起丢。 */
      if (!r.body.includes('linear-gradient(180deg,transparent 60%,var(--scrim-cover))')) F22('.ls-img::after 丢了封面自带「下压式」影：' + r.body.slice(0, 90));
      if (!/--scrim-cover\s*:\s*rgba\(32,32,29,\.22\)/.test(flat22(code22('design.css')))) F22('--scrim-cover 没在 design.css 里定义成 rgba(32,32,29,.22)：::after 的 var() 会整条失效');
      if (!r.body.includes('var(--photo-veil)')) F22('.ls-img::after 没把 veil 并进同一条 background');
    });
  }

  /* --- ⑤ 照片表面不许另写字面量滤镜（各页自调一档是「一半压过一半没压」的来路） --- */
  const SURF_RE = /(?:^|[\s>+~,])(\.ls-img|\.card \.ph|\.al-ch-img|\.photo-wall|\.md-item \.thumbs|\.eph|\.p-cell|\.n-item \.th|\.story-item__stamp|\.imgbox|\.trip-feature__img)(?![\w-])/;
  /* 必须允许 ; 与属性名之间有空白：多行规则 flat 之后是「; filter:」，漏了 \s* 就整条放过（永久绿灯） */
  const LOOK_RE = /(?:^|;)\s*filter\s*:/;
  const litFilter = rules => rules.filter(r => SURF_RE.test(r.sel) && LOOK_RE.test(r.body) && !r.body.includes('var(--photo-look)'));
  {
    /* 探针正反向自证：⑤ 扫的是「解析出的规则」，正则一旦写坏就永久绿灯，
       所以先拿内存里的坏样本证明抓得到，再拿五类反例证明不误报。 */
    const BAD = '.ls-img>img{filter:saturate(1.3)contrast(1.1)}';
    /* 换行写法：同一件事，只是把声明拆成多行。这一条专门盯 LOOK_RE 的 \s* */
    const BAD_ML = '.card .ph img{\n  border-radius:8px;\n  filter:saturate(1.2) contrast(1.05);\n}';
    const OK = ['.imgbox--plain{filter:brightness(1.02)}', '.eph-empty{filter:grayscale(.2)}',
      '.card:hover .ls-img-ph{filter:sepia(.3)}', '.leaflet-tile{filter:sepia(.32) saturate(.52)}',
      '.btn.primary:active{filter:brightness(.96)}', '.card .ph img{filter:var(--photo-look)}'].join('');
    if (!litFilter(parse(BAD)).length) F22('照片滤镜探针自身失效：已知坏样本 ' + BAD + ' 抓不到（⑤ 从此是永久绿灯）');
    if (!litFilter(parse(BAD_ML)).length) F22('照片滤镜探针漏多行写法：' + BAD_ML.replace(/\n/g, '\\n') + ' 抓不到，说明 LOOK_RE 丢了 \\s*');
    const fp = litFilter(parse(OK)).length;
    if (fp) F22('照片滤镜探针误报 ' + fp + ' 处：修饰态/占位态/瓦片/:active 不是照片表面，不该被拦');
  }
  FILES22.forEach(f => {
    if (!/\.css$/.test(f)) return;
    const rules = parse(code22(f));
    litFilter(rules).forEach(r => F22(f + ' 给照片表面 ' + r.sel + ' 另写了滤镜：' + r.body.slice(0, 70)));
    /* 照片上的分界线不随主题翻（它画在照片自己身上）；暗色只翻 UI 侧外圈 */
    rules.forEach(r => {
      if (/theme-dark/.test(r.sel) && /--photo-/.test(r.body)) F22(f + ' 在 .theme-dark 里重定义了 --photo-* token：' + r.sel);
    });
  });

  /* --- ⑥ 死规则不许复活：.card .media 一族零调用者，留着就是「看着有其实没有」 --- */
  {
    let n = 0;
    FILES22.forEach(f => { n += (flat22(code22(f)).match(/\.card \.media/g) || []).length; });
    if (n) F22('.card .media 又出现 ' + n + ' 次：这套选择器没有任何调用者，已删作欠账登记');
  }

  /* --- ⑦ 登记在案：浏览器侧闸门存在且 README 指得到 --- */
  if (!fs.existsSync('tools/smoke-photo.js')) F22('缺 tools/smoke-photo.js（16 条真浏览器断言：计算值 + 像素对账）');
  {
    const R = read22('README.md');
    if (!/smoke-photo\.js/.test(R)) F22('README 没登记 smoke-photo.js：下一个人不会知道压色是有浏览器闸门的');
    if (!/§22/.test(R)) F22('README 的 verify.js 闸门清单里没有 §22');
  }

  console.log('实景图闸门: --photo-veil/.10 --photo-look/saturate(.94) --photo-edge/.20 逐值核定且字面量全站双写 0 处；' +
    '表面清单 10+6+6+4+3+3 条逐条挂载、滤镜单一挂载点；' +
    '按实际挂载算出的三条不变式成立（inset⊆veil、外圈⊆滤镜、清单零漂多）；' +
    '封面 .ls-img 两条声明都含 inset 环且 ::after 恰 1 条（自带影与 veil 合并）；' +
    '照片表面零字面量滤镜、暗色零 --photo-* 重定义；.card .media 零复活；smoke-photo.js 与 README 在案');
  fail += bad;
}

/* ============================================================
   23. 质感语言闸门（UI-5 · 2026-10-05）
   这一节把「一张纸、一族影、两档毛玻璃」三件事钉成可复跑的判据。为什么值得钉：
   改之前全站 171 条字面量 box-shadow 分 5 个色族、blur 半径 8/12/14/16/18/20/22/26 八档、
   半透纸底 .82/.90/.94/.96/.97 五档混用——单看每一处都「差不多」，叠在一起就是「差点意思」。
   口径三条：
     · 一族投影：只留暖墨双层影（接触影 + 弥散影），品牌辉光/照片白内圈/纯黑另族本轮不动（欠账见文档）；
     · 两档毛玻璃：blur 只有 bar/sheet 两档，且**只在挂点内**——底色 α≥.90 时 blur 看不见但每帧 GPU 照付；
     · 纸是真的纸：颗粒只铺 body 一层，卡面干净；糊在纸上的「半透但不 blur」一律换实心纸 + 细描边。
   实现上有两条坑是这一节形状的成因，别再走回头路：
     ① 检查必须跑在**声明**上。按行扫全站括号会产生 207 条噪声；按「深度 0 的 ;」切整文件
        又会被 JS 字符串/注释里的括号污染（travel-notes.js 实测收尾 depth=-1）。
        现在按最内层 {} 块切，块内再按深度 0 的 ; 切声明，只审「prop:value」形状的声明。
     ② 切层不能 split(',')：rgba(32,31,27,.14) 里的逗号不是层分隔符，直接 split 会把
        一条暖墨影切成四片，于是「暖墨外影残留 0 处」永远绿——那是假绿灯。
   括号不配对 = 整条声明被静默丢掉且 CSS 不报错，本轮实测抓到 6 处这种真 bug，
   所以第⑥组不是风格检查，是错误检查。
   ============================================================ */
{
  let bad = 0;
  const F23 = m => { console.log('质感闸门 FAIL: ' + m); bad++; };
  const read23 = f => { if (!fs.existsSync(f)) { F23('缺 ' + f); return ''; } return fs.readFileSync(f, 'utf8'); };
  const blank23 = m => m.replace(/[^\n]/g, ' ');
  const strip23 = s => s.replace(/\/\*[\s\S]*?\*\//g, blank23).replace(/<!--[\s\S]*?-->/g, blank23);
  const code23 = f => strip23(read23(f));
  const FILES23 = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
  const esc23 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flat23 = s => s.replace(/\s+/g, ' ').trim();
  const ALL23 = FILES23.map(f => ({ f: f, src: code23(f) }));
  /* 全站（限本表口径的文件集）字面出现次数 */
  const siteCount = needle => ALL23.reduce((n, o) => n + (flat23(o.src).match(new RegExp(esc23(needle), 'g')) || []).length, 0);
  /* 「整文件当一个 CSS 源」扫最内层 {} 块：多认几条假块无所谓，漏一条就是闸门的洞。
     不按 <style>/引号串切语境实测会漏——js 模板字符串用反斜杠续行，
     引号正则里的 \\. 匹配不到「反斜杠+换行」，整段孤岛找不到。 */
  const selOf = (src, bi) => {
    let j = bi - 1;
    while (j >= 0 && src[j] !== '}' && src[j] !== ';' && src[j] !== '{' && bi - j < 260) j--;
    const raw = src.slice(j + 1, bi).replace(/\\/g, ' ');
    const m = raw.match(/([^{};]*[#.*:\w][^{};]*)$/);
    return m ? flat23(m[1]) : '';
  };
  const blocks = src => {
    const out = [], st = [];
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '{') st.push(i);
      else if (src[i] === '}') {
        const s = st.pop();
        if (s === undefined) break;
        const nx = src.indexOf('{', s + 1);
        if (nx !== -1 && nx < i) continue;                 /* 含子块的不算最内层；indexOf 返回 -1 表示全站此后再无「{」，正是文件最后一个块，必须参与检查 */
        out.push({ sel: selOf(src, s), body: flat23(src.slice(s + 1, i)) });
      }
    }
    return out;
  };
  /* 括号感知切分：rgba()/var()/url() 里的分隔符不算分隔符 */
  const byDepth = (s, sep) => {
    const out = []; let d = 0, cur = '';
    for (const ch of s) {
      if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--;
      if (ch === sep && d === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  };
  const decls = body => byDepth(body, ';').map(flat23).filter(t => /^[a-z-]+\s*:/.test(t));
  const D23 = code23('design.css');

  /* --- ① 一族投影：四档双层暖墨影逐值核定，档位含义（接触影 ≤6px / 弥散 ≥12px）也钉住 --- */
  const TIERS = [
    ['--shadow-soft', '0 1px 2px rgba(33,26,19,.04)', '0 12px 30px -14px rgba(33,26,19,.14)'],
    ['--shadow-medium', '0 2px 6px rgba(33,26,19,.05)', '0 22px 48px -18px rgba(33,26,19,.22)'],
    ['--shadow-float', '0 4px 14px rgba(33,26,19,.08)', '0 30px 66px -22px rgba(33,26,19,.32)'],
    ['--shadow-rise', '0 -2px 6px rgba(33,26,19,.05)', '0 -22px 48px -18px rgba(33,26,19,.22)'],
  ];
  TIERS.forEach(t => {
    const def = t[0] + ':' + t[1] + ',' + t[2] + ';';
    const n = (flat23(D23).match(new RegExp(esc23(def), 'g')) || []).length;
    if (n !== 1) F23('design.css 里 ' + t[0] + ' 的整串定义出现 ' + n + ' 次（应为 1）：三档暖墨影是逐值核定的，改档请同时改这里的台账');
    const y = parseFloat(t[1].split(' ')[1]);
    const blur = parseFloat(t[2].split(' ')[2]);
    if (!(Math.abs(y) <= 6 && y !== 0)) F23(t[0] + ' 的接触影 y 偏移 = ' + y + 'px：接触影必须非零且 ≤6px，否则那是一条悬浮影不是接触影');
    if (blur < 12) F23(t[0] + ' 的弥散层 blur = ' + blur + 'px：弥散层 <12px 时两层会糊成一圈硬边，等于回到单层影');
  });
  /* --shadow-rise 的全部意义是「贴底面板的影只能往上打」：它必须是 medium 的 y 取负镜像，
     自己另调一套值就不叫「同一族」。 */
  {
    const mirrored = TIERS[1].slice(1).map(l => l.replace(/^0 (-?\d+)px/, (m0, v) => '0 ' + (-v) + 'px')).join(',');
    const n = (flat23(D23).match(new RegExp(esc23('--shadow-rise:' + mirrored + ';'), 'g')) || []).length;
    if (n !== 1) F23('--shadow-rise 不再是 --shadow-medium 的 y 反向镜像：贴底面板要有「同族反向档」，别单独调一套');
  }
  if ((flat23(D23).match(new RegExp(esc23('--shadow-pop:0 20px 44px -18px rgba(27,23,19,.42);'), 'g')) || []).length !== 1)
    F23('--shadow-pop 不是那一条单层影（弹层专用，靠 -18px 收边）：单层是给「离地很高」用的，双层是给贴地卡片用的');
  /* 旧档（无接触影的冷灰单层）不许复活，也不许再有别名指向它 */
  if (siteCount('--sh-')) F23('旧冷灰投影档 --sh-* 又出现了 ' + siteCount('--sh-') + ' 处：它没有接触影，整族已删，要加影就加 --shadow-* 四档');
  ['rgba(30,30,28', 'rgba(40,38,32', 'rgba(30,40,35'].forEach(c => {
    const n = siteCount(c);
    if (n) F23('冷灰族字面量 ' + c + ' 还有 ' + n + ' 处：那族影子偏蓝偏绿，压在米色纸上看着脏');
  });
  /* 暗档不得重画投影/blur/grain：影和模糊是物理量，纸翻深了影不会自己变浅 */
  {
    const redefined = [];
    ALL23.forEach(o => blocks(o.src).forEach(b => {
      if (!/\.theme-dark/.test(b.sel)) return;
      const hit = b.body.match(/--(?:shadow|blur|grain|photo|scrim)[a-z-]*\s*:/g);
      if (hit) redefined.push(o.f + ' [' + b.sel.slice(0, 44) + '] ' + hit.join(' '));
    }));
    if (redefined.length) redefined.forEach(r => F23('.theme-dark 里重定义了质感 token：' + r));
  }
  /* 暖墨族外影零字面量：品牌实物（蜡封章、地图针）两条逐值豁免，其余一律走 token */
  const INKF = /^inset\b|\binset\b|^0 0 0 /;
  const INK_LIT = /rgba\(\s*(?:32,32,29|33,26,19|32,31,27|27,23,19|30,28,24|38,36,31)\s*,/;
  const SHADOW_EXEMPT = ['0 1px 4px rgba(32,31,27,.14)', '0 2px 6px rgba(32,31,27,.35)'];
  const inkOuter = src => {
    const hits = [];
    (flat23(src).match(/box-shadow\s*:\s*[^;'"`}]{0,300}/g) || []).forEach(d => {
      byDepth(d.replace(/box-shadow\s*:\s*/, ''), ',').forEach(l => {
        const s = flat23(l);
        if (!INK_LIT.test(s) || INKF.test(s)) return;
        hits.push(s);
      });
    });
    return hits;
  };
  {
    const found = [];
    ALL23.forEach(o => inkOuter(o.src).forEach(h => found.push({ f: o.f, layer: h })));
    found.forEach(x => {
      if (SHADOW_EXEMPT.indexOf(x.layer) < 0) F23(x.f + ' 有暖墨族字面量外影「' + x.layer + '」：中性影只能走 --shadow-soft/medium/float/rise，新档要先在 :root 立起来');
    });
    SHADOW_EXEMPT.forEach(e => {
      const n = found.filter(x => x.layer === e).length;
      if (n !== 1) F23('品牌实物影「' + e + '」出现 ' + n + ' 次（应为 1，蜡封章/地图针各一条）：豁免是逐值的，不是整族放行');
    });
    /* 探针自证：切层用 split(',') 会把 rgba 里的逗号当层分隔，于是这条永远抓不到 */
    const BAD = '.x{box-shadow:0 3px 10px rgba(33,26,19,.2)}';
    if (!inkOuter(BAD).length) F23('暖墨外影探针自身失效：已知坏样本 ' + BAD + ' 抓不到（① 从此永久绿灯）');
    const OK = ['.y{box-shadow:inset 0 0 0 1px rgba(32,32,29,.10)}',
      '.z{box-shadow:0 0 0 5px rgba(32,32,29,.06),0 3px 10px rgba(0,0,0,.15)}',
      '.w{box-shadow:var(--shadow-soft)}'].join('');
    const fp = inkOuter(OK).length;
    if (fp) F23('暖墨外影探针误报 ' + fp + ' 处：inset 环与 0 0 0 扩散环是描边的另一种写法，纯黑一族本轮不并族');
  }

  /* --- ② 两档毛玻璃：blur 只有 bar/sheet 两档，且必须和同档透底同体出现 --- */
  ['--blur-bar:blur(20px) saturate(1.5);', '--blur-sheet:blur(26px) saturate(1.6);'].forEach(t => {
    const n = (flat23(D23).match(new RegExp(esc23(t), 'g')) || []).length;
    if (n !== 1) F23('design.css 里 ' + t + ' 出现 ' + n + ' 次（应为 1）：两档 blur 是「挂点经济学」的产物，加第三档请先说明谁付这份 GPU');
  });
  {
    /* 字面 blur( 只许出现在那两行 token 里：别处写 blur(14px) 就是第三档 */
    let lit = 0;
    ALL23.forEach(o => (flat23(o.src).match(/[^-\w]blur\(/g) || []).forEach(() => lit++));
    if (lit !== 2) F23('全站字面 blur( 出现 ' + lit + ' 次（只许 --blur-bar/--blur-sheet 两条定义各 1 次）');
  }
  const GLASS_EXEMPT = { 'map.css|.location-sheet': '同族在 design.css 已挂 blur-sheet，这条只是后发覆盖圆角/底色' };
  const hooks = [];
  ALL23.forEach(o => blocks(o.src).forEach(b => {
    const re = /(?:^|[^-\w])(-webkit-)?backdrop-filter\s*:\s*([^;]+)/g;
    const std = [], wk = [];
    let m2;
    while ((m2 = re.exec(b.body))) (m2[1] ? wk : std).push(flat23(m2[2]));
    if (!std.length && !wk.length) return;
    hooks.push({ f: o.f, sel: b.sel, body: b.body, std: std, wk: wk });
  }));
  {
    const TIER = { 'var(--blur-bar)': 'bar', 'var(--blur-sheet)': 'sheet', 'none': 'none' };
    hooks.forEach(h => {
      h.std.concat(h.wk).forEach(v => { if (!TIER[v]) F23(h.f + ' [' + h.sel.slice(0, 40) + '] 的 backdrop-filter 值是「' + v + '」：只许 var(--blur-bar)/var(--blur-sheet)/none'); });
      if (h.std.sort().join('|') !== h.wk.sort().join('|'))
        F23(h.f + ' [' + h.sel.slice(0, 40) + '] 的 -webkit- 前缀与标准写法不配对（标准 ' + h.std.join(',') + ' / webkit ' + h.wk.join(',') + '）：Android WebView 只认带前缀那条，漏写等于这台机器上没有毛玻璃');
      h.std.forEach(v => {
        const t = TIER[v];
        if (!t || t === 'none') return;
        const okBg = t === 'bar' ? h.body.indexOf('var(--glass-bar)') >= 0 : /var\(--glass-sheet\)|var\(--scrim-/.test(h.body);
        if (!okBg) F23(h.f + ' [' + h.sel.slice(0, 40) + '] 挂了 ' + v + ' 却没有同档透底：底是实心的话 blur 看不见，每帧 GPU 照付');
      });
    });
    /* 「用了 --glass-* 的底必须同体挂 blur」不能只在有 backdrop-filter 的块里查：
       把 blur 整条删掉恰恰是最常见的退化，而删掉的行不会进 hooks，只在挂点内部自检等于对这种退化永久绿灯
       ——变异 G4 当场砸出来的洞。所以这里扫全站每一条引用 --glass-* 的声明块。 */
    const GLASS_NEED = { 'var(--glass-bar)': 'var(--blur-bar)', 'var(--glass-sheet)': 'var(--blur-sheet)' };
    ALL23.forEach(o => blocks(o.src).forEach(b => {
      Object.keys(GLASS_NEED).forEach(g => {
        if (b.body.indexOf(g) < 0 || b.body.indexOf(GLASS_NEED[g]) >= 0) return;
        if (GLASS_EXEMPT[o.f + '|' + b.sel]) return;
        F23(o.f + ' [' + b.sel.slice(0, 40) + '] 用了 ' + g + ' 却没挂 ' + GLASS_NEED[g] + '：那是「脏」不是毛玻璃，不在豁免名单（' + Object.keys(GLASS_EXEMPT).join('/') + '）就一律换实心纸');
      });
    }));
    Object.keys(GLASS_EXEMPT).forEach(k => {
      const sel = k.split('|')[1];
      if (!hooks.some(h => h.sel === sel && h.std.indexOf('var(--blur-sheet)') >= 0))
        F23('豁免名单里的 ' + k + ' 现在全站找不到对应 blur-sheet 挂点：豁免的前提是同族别处挂过，挂点被删就该把这条改回实心纸');
    });
    const HOOK_BUDGET = 20;
    if (hooks.length > HOOK_BUDGET) F23('毛玻璃挂点 ' + hooks.length + ' 条 > 预算 ' + HOOK_BUDGET + '：加挂点要写清为什么这层不能是纸');
    if (!hooks.length) F23('一条 backdrop-filter 都没扫到：多半是 blocks() 或正则坏了，不是真的没有毛玻璃');
    /* 反向自证：none 是复位不是第三档；注释里的示例不算挂点 */
    const SELF = hooks.filter(h => h.std.indexOf('none') >= 0).length;
    if (hooks.some(h => h.std.some(v => v === 'none') && h.std.length > 1)) F23('有规则把 backdrop-filter:none 和 var(--blur-*) 写在同一条里：复位和挂点混写，后者会被前者吃掉');
    const FAKE = '.ghost{color:#000}/* .ghost2{backdrop-filter:blur(9px)} */';
    if (blocks(strip23(FAKE)).some(b => /backdrop-filter/.test(b.body))) F23('质感探针把注释里的示例当成声明了：strip23 失效，② 会误报');
    if (SELF === hooks.length) F23('所有挂点都是 none：blur 档位形同虚设，请核对 --blur-* 是否被删');
  }
  /* α 与底色：四组值各 1 处（token 定义自身），别处再写一遍就是第二个真相 */
  ['--glass-bar:rgba(250,248,243,.82);', '--glass-sheet:rgba(250,248,243,.90);',
    '--paper-bar:#FAF8F3;', '--glass-bar:rgba(29,28,25,.82);', '--glass-sheet:rgba(29,28,25,.90);', '--paper-bar:#1D1C19;']
    .forEach(t => {
      const n = siteCount(t);
      if (n !== 1) F23(t + ' 全站出现 ' + n + ' 次（应为 1）：亮/暗各一条定义，别处再写一遍就是绕过 token 的第二个真相');
    });
  {
    /* 暗档翻三样（两档玻璃 + 实心纸），其余质感 token 不翻 */
    const dark = blocks(D23).filter(b => b.sel === '.theme-dark');
    if (dark.length !== 1) F23('.theme-dark token 块 ' + dark.length + ' 条（应为 1）');
    dark.forEach(b => {
      ['--glass-bar:rgba(29,28,25,.82)', '--glass-sheet:rgba(29,28,25,.90)', '--paper-bar:#1D1C19',
        '--edge-hair:rgba(239,233,220,.16)', '--edge-hair-soft:rgba(239,233,220,.09)'].forEach(t => {
        if (b.body.indexOf(t) < 0) F23('.theme-dark 缺暗档 ' + t + '：暗底上的毛玻璃/描边必须翻，不翻就是「没有线」');
      });
    });
  }

  /* --- ③ 纸是真的纸：颗粒只铺 body，卡面干净 --- */
  {
    const pgDef = D23.match(/--grain-page:[^;]+;/);
    const grDef = D23.match(/--grain:[^;]+;/);
    if (!pgDef || !grDef) F23('--grain / --grain-page 定义不见了');
    else {
      if (pgDef[0].indexOf("feColorMatrix type='saturate' values='0'") < 0) F23('--grain-page 没先去色：彩色噪声贴在米色纸上会带紫绿杂点');
      if (pgDef[0].indexOf("opacity='0.14'") < 0) F23('--grain-page 的强度不是 .14：页面底没有中间层可乘，强度只能写死在图里，改值要重跑 tools/smoke-texture.js 的亮度标准差核定');
      if (grDef[0].indexOf('feColorMatrix') >= 0) F23('--grain 不该去色：海报那层靠元素 opacity + overlay 混合控制，去色是 --grain-page 的差别所在');
    }
    const refs = [];
    ALL23.forEach(o => blocks(o.src).forEach(b => {
      if (b.body.indexOf('var(--grain-page)') >= 0) refs.push({ f: o.f, sel: b.sel, tier: 'page', body: b.body });
      if (b.body.indexOf('var(--grain)') >= 0) refs.push({ f: o.f, sel: b.sel, tier: 'grain', body: b.body });
    }));
    if (refs.length !== 2) F23('grain 引用 ' + refs.length + ' 处（应为 2：body 一次、.cine-grain 一次）：卡面再铺一层就是「纸上糊沙」');
    refs.forEach(r => {
      if (r.tier === 'page' && r.sel !== 'body') F23(r.f + ' 把 --grain-page 挂在 [' + r.sel.slice(0, 34) + ']：页面颗粒只许铺 body');
      if (r.tier === 'grain' && !/cine-grain/.test(r.sel)) F23(r.f + ' 把 --grain 挂在 [' + r.sel.slice(0, 34) + ']：彩色噪声只给电影海报那层用');
      if (r.body.indexOf('background-size:140px 140px') < 0) F23(r.f + ' [' + r.sel.slice(0, 34) + '] 铺了 grain 却没有 background-size:140px 140px：噪声图会按自身尺寸平铺或被拉伸，颗粒大小不一致');
    });
    /* 纸颗粒铺在 body 的 background-image 上，而 `background` 简写会把没写到的 longhand 复位成初始值。
       每个页自己 <style> 里那行 body{background:var(--color-bg)} 加载在 design.css 之后，
       于是 grain「源码里写着、手机上看不见」，CSS 一声不吭——UI-5 就是靠这条抓到 18 处。
       口径只管 App 内页面：导出/打印文档自带独立 :root、不加载 design.css，那里没有 grain 可抹，
       所以这类点走 BODY_KILL_EXEMPT 逐值豁免（豁免条目失效也要红，防止它变成万能洞）。 */
    const subjectOf = sel => String(sel).split(',').pop().trim().split(/\s+|>/).pop().replace(/^[^-\w.#]+/, '');
    const isBodySel = sel => /^body($|[.:#\[])/.test(subjectOf(sel));
    const bodyKill = src => blocks(src).filter(b => isBodySel(b.sel) && /(?:^|[;\s])background\s*:/.test(b.body))
      .map(b => ({ sel: subjectOf(b.sel), decl: 'background:' + flat23(/(?:^|[;\s])background\s*:\s*([^;]+)/.exec(b.body)[1]) }));
    const BODY_KILL_EXEMPT = {
      'results.js|background:#F7F5EF': '导出文档的 body（独立 HTML，不加载 design.css）',
      'results.js|background:#fff': '导出文档里的 @media print 串：打印稿自带白纸面',
      'travel-notes.js|background:#fff!important': '导出游记 HTML 串里的 @media print，同上',
      'album.js|background:var(--color-bg)': '导出相册 HTML 自带 :root（④ 就靠这份离线自足），页面底色由它自己定',
      'planner.js|background:#F6F3EC': '导出路线文档的 body（独立 HTML）',
      'vault.js|background:#faf8f3': '导出密库文档的 body（独立 HTML）',
      'icons-demo.html|background:#F7F5EF': '图标目录页：开发工具，整页不链 design.css，没有 grain 可抹',
    };
    {
      const hits = [];
      ALL23.forEach(o => bodyKill(o.src).forEach(h => hits.push({ f: o.f, sel: h.sel, decl: h.decl, key: o.f + '|' + h.decl })));
      const open = hits.filter(h => !BODY_KILL_EXEMPT[h.key]);
      open.forEach(h => F23('body 规则用了 background 简写，会把 body 上的 --grain-page 复位成 none：' + h.f + ' [' + h.sel.slice(0, 24) + '] ' + h.decl.slice(0, 40) + ' —— 改成 background-color'));
      Object.keys(BODY_KILL_EXEMPT).forEach(k => {
        if (hits.map(h => h.key).indexOf(k) < 0) F23('body 简写豁免条目已失效：' + k + '（' + BODY_KILL_EXEMPT[k] + '）—— 这条已经不在源码里了，把豁免一起删掉');
      });
      const BAD = ['html,body{background:var(--color-bg)}', "var s='a{b}' + 'body{background:#fff}';"];
      BAD.forEach(b => { if (bodyKill(b).length !== 1) F23('body 简写探针自身失效：已知坏样本 ' + b + ' 抓到 ' + bodyKill(b).length + ' 条（应为 1），③ 的这半条是假绿灯'); });
      const OK = 'body{background-color:var(--color-bg)} .body-x{background:#fff} body.theme-dark{background-color:#1D1C19} body .sheet{background:var(--glass-sheet)} body>.card{background:#fff} body{background-image:var(--grain-page)}';
      const fp = bodyKill(OK).length;
      if (fp) F23('body 简写探针误报 ' + fp + ' 处：background-color 长写法、background-image、.body-x、body 的后代元素都不该被拦');
    }
    if (!fs.existsSync('tools/smoke-texture.js')) F23('缺 tools/smoke-texture.js：grain 强度、毛玻璃挂点、投影档都要在真浏览器计算值上对账');
    const R23 = read23('README.md');
    if (!/smoke-texture\.js/.test(R23)) F23('README 没登记 smoke-texture.js');
    if (!/§23/.test(R23)) F23('README 的 verify.js 闸门清单里没有 §23');
  }

  /* --- ④ 遮罩三档逐值 + 零双写（album.js 导出文档要自带一份，逐条对账同值） --- */
  ['--scrim-cover:rgba(32,32,29,.22);', '--scrim-modal:rgba(32,32,29,.45);'].forEach(t => {
    const n = siteCount(t);
    if (n !== 1) F23(t + ' 全站 ' + n + ' 次（应为 1）：暖墨遮罩改 α 会同时改「压住多少背景」，别处双写就是第二档');
  });
  {
    const photoDefs = ALL23.filter(o => flat23(o.src).indexOf('--scrim-photo:rgba(0,0,0,.55);') >= 0).map(o => o.f).sort();
    if (photoDefs.join(' ') !== 'album.js design.css')
      F23('--scrim-photo 的定义在 ' + photoDefs.join(' / ') + '（应为 design.css + album.js 两处且只有这两处）：album.js 导出的相册 HTML 要离线自足，必须自带一份，两处必须同值');
    ['cover', 'modal', 'photo'].forEach(t => {
      const n = siteCount('var(--scrim-' + t + ')');
      if (!n) F23('--scrim-' + t + ' 没有任何引用：这档遮罩是死的，删掉或挂上去，别留着当「看起来有」');
    });
    const modalN = siteCount('var(--scrim-modal)');
    if (modalN < 2) F23('--scrim-modal 引用 ' + modalN + ' 处（现在 ≥2：到达确认 + 删除确认）：对话框遮罩少了就是弹层直接压在内容上');
  }

  /* --- ⑤ 描边一族：亮/暗逐值 + border 声明里暖墨字面量归零 --- */
  ['--edge-hair:rgba(33,26,19,.14);', '--edge-hair-soft:rgba(33,26,19,.08);'].forEach(t => {
    const n = siteCount(t);
    if (n !== 1) F23(t + ' 全站 ' + n + ' 次（应为 1）：两档描边按 α 归的（≤.10 归 soft，>.10 归 hair），别处再写就是第三档');
  });
  {
    const BORDER_INK = /\bborder(?:-[a-z]+)*\s*:\s*[^;()"'`]*?rgba\((?:32,32,29|33,26,19|38,36,31|30,28,24|32,31,27)\s*,/;
    const borderInk = src => (flat23(src).match(new RegExp(BORDER_INK.source, 'g')) || []);
    const found = [];
    ALL23.forEach(o => borderInk(o.src).forEach(h => found.push(o.f + ' ' + flat23(h).slice(0, 70))));
    found.forEach(x => F23('描边还写着暖墨字面量：' + x + ' —— 写死的 rgba 在 .theme-dark 下等于没有线'));
    const BAD = ['.a{border:1px solid rgba(32,32,29,.08)}', '.b{border-top:1px solid rgba(33,26,19,.14)}'].join('');
    if (borderInk(BAD).length !== 2) F23('描边探针自身失效：两条已知坏样本只抓到 ' + borderInk(BAD).length + ' 条（应为 2），⑤ 是假绿灯');
    const OK = ['.c{border:1px solid var(--edge-hair)}', '.d{border-color:var(--edge-hair-soft)}',
      '.e{border:1px solid rgba(255,255,255,.6)}', '.f{border-left:3px solid #C86D4B}'].join('');
    if (borderInk(OK).length) F23('描边探针误报 ' + borderInk(OK).length + ' 处：token/白描边(画在照片上)/品牌色不算暖墨字面量');
  }

  /* --- ⑥ 声明级括号平衡：多一个 ) 会让整条声明静默消失，CSS 不报错、肉眼看不出 --- */
  {
    const badDecl = body => decls(body).filter(d => {
      const o = (d.match(/\(/g) || []).length, c = (d.match(/\)/g) || []).length;
      return o !== c;
    });
    const strays = [];
    ALL23.forEach(o => blocks(o.src).forEach(b => badDecl(b.body).forEach(d => strays.push(o.f + ' [' + b.sel.slice(0, 30) + '] ' + d.slice(0, 74)))));
    /* 内联 style 与 cssText 不在 {} 里，单独扫：本轮抓到的一处真 bug 就在这里 */
    ALL23.forEach(o => {
      const strs = (o.src.match(/\bstyle\s*=\s*"([^"]*)"/g) || []).concat(o.src.match(/cssText\s*=\s*'([^']*)'/g) || []);
      strs.forEach(s => badDecl(s.replace(/^.*?["']/, '').replace(/["']$/, '')).forEach(d => strays.push(o.f + ' [内联] ' + d.slice(0, 74))));
    });
    strays.forEach(s => F23('声明括号不配对（整条会被静默丢弃）：' + s));
    const BAD1 = '.x{box-shadow:var(--shadow-medium))}', BAD2 = ".y{cursor:pointer)'",
      BAD3 = '.z{box-shadow:0 10px 34px rgba(200,109,75,.18))}';
    [[BAD1, 1], [BAD2, 1], [BAD3, 1]].forEach(p => {
      if (badDecl(p[0].replace(/^.*?\{/, '').replace(/\}$/, '')).length !== p[1])
        F23('括号探针自身失效：已知坏样本 ' + p[0] + ' 没抓到，⑥ 是假绿灯');
    });
    const OK = 'transform:rotate(-90deg);width:calc(100% - env(safe-area-inset-bottom, 0px) + 12px);' +
      'background:var(--glass-bar);color:rgba(32,32,29,.14);padding:0 14px;box-shadow:inset 0 0 0 1px var(--edge-hair);';
    if (badDecl(OK).length) F23('括号探针误报：' + badDecl(OK).join(' | ') + ' —— rotate/calc/env/嵌套 var 都是配对的');
    /* 按行扫全站括号会有 207 条噪声：这行盯的就是「必须跑在声明上」这条口径 */
    const lineWise = (D23.match(/\(/g) || []).length !== (D23.match(/\)/g) || []).length;
    if (lineWise && !strays.length) F23('整文件括号总数不等但没有声明级命中：说明有声明被块扫描漏掉了，请核对 blocks() 的边界');
  }

  /* --- ⑦ 实心纸优先：「不糊却半透」的底色一律换成 --paper-bar --- */
  {
    const solidPaper = src => (flat23(src).match(/background(?:-color)?\s*:\s*rgba\(250,248,243/g) || []);
    const found = [];
    ALL23.forEach(o => solidPaper(o.src).forEach(() => found.push(o.f)));
    if (found.length) F23('还有 ' + found.length + ' 处 background:rgba(250,248,243…)（' + found.join(' / ') +
      '）：不在毛玻璃挂点名单里的半透米白，手机上看着像脏纸，换 --paper-bar + --edge-hair 细描边');
    const BAD = '.q{background:rgba(250,248,243,.94)}';
    if (!solidPaper(BAD).length) F23('实心纸探针自身失效：已知坏样本 ' + BAD + ' 判不出来，⑦ 是假绿灯');
    const OK = '.r{background:var(--paper-bar)} .s{background:var(--glass-bar)} .t{background:#FAF8F3}';
    if (solidPaper(OK).length) F23('实心纸探针误报 token 写法：' + solidPaper(OK).join(' | '));
  }

  console.log('质感闸门: 投影四档+pop 逐值核定（rise 必须是 medium 的 y 反向镜像，接触影 ≤6px/弥散 ≥12px 是含义不是手感）；' +
    '冷灰族与 --sh-* 零残留，暖墨外影除品牌实物 2 条逐值豁免外归零（探针带正反向自证）；' +
    'blur 只有 bar/sheet 两档且字面 blur( 全站 2 处，' + hooks.length + ' 个挂点逐条同体配对 -webkit-、逐条与同档透底配对（' +
    Object.keys(GLASS_EXEMPT).join('/') + ' 按同族已挂过豁免并要求挂点仍在）；' +
    '引用 var(--glass-*) 的块不分「有没有 backdrop-filter」一律同体要求对应 blur（G4 那类「把 blur 整条删掉」的退化在 hooks 里看不见）；' +
    'α/底色亮暗各 1 处零双写，.theme-dark 只翻玻璃·纸·描边且零质感 token 重定义；' +
    'grain 引用 2 处（body + .cine-grain）且带 background-size，去色只在 page 档；遮罩三档逐值 + 三档都有调用者；' +
    '描边一族亮暗各 2 条逐值、border 暖墨字面量 0 处；' +
    '声明级括号平衡（三条真 bug 形态自证 + rotate/calc/env/嵌套 var 不误报）；「不糊却半透」底色 0 处');
  fail += bad;
}

/* ============================================================
   24. 地图可用视口闸门（批次 13 · 2026-10-05）
   用户报的：「34 个省的地图上经常出现几个节点和合集点，放大后这些点不在屏幕中，而是分散在屏幕外的地图边缘，用户要一个个的找」。
   基线实测（tools/out/b13-edge-before-452.txt + b13-raw-before-452.jsonl，34 页 × 4 档）：
     4134 枚标记里纯几何越界（并集）555 枚（13.4%）；再并上「被成带浮层盖住」558 枚（13.5%）。
     普查脚本汇总行那 834（20.2%）是各类目**按档累加**、同一枚被切边又被浮层盖住会数两次，别拿它当并集用。
     逐档恶化 5.0% → 11.2% → 11.3% → 27.8%，连按三次 + 之后「被底部面板盖住」单独冲到 17.5%（165/941），
     下溢中位 108px（正好是那条死带的深度）。390 档同口径 3990 枚 / 几何并集 681（17.1%）／并浮层 689（17.3%）。
   修复后同一批 JSONL 重算（b13-raw-after-*.jsonl + b13-attr.js）：452 档 3697 枚，纯几何越界 **0 枚**，
     几何∪浮层并集 7 枚（全是「被成带浮层盖住」）；另有 29 枚盒缘贴屏幕边（<1px，按 attr 的容差不算越界，
     但确实零呼吸——记在残余里）。390 档 3528 枚 / 几何并集 5（0.1%）／并浮层 13（0.4%），其中 init 那 5 枚
     （4 枚右溢中位 4px 最大 10px、1 枚左溢 4px）经稳态复查
     （tools/out/b13-tw.js 在 1500/3000/5000ms 三点重采样，22 枚胶囊 0 越界）判定为普查脚本在内收链
     收敛前采到的中间帧——那个脚本用固定 setTimeout，正是批次 12 记过的教训，不改口径只登记。
   根因三条，这一节就把这三条的实现形状钉住：
     ① 合集胶囊不以地理锚点为中心（clusterIcon 用 iconSize/iconAnchor 全 0，149px 宽的胶囊从锚点
        向右下悬出半枚，右缘能捅到 551px 而屏只有 452px）；
     ② 渲染决策按 #mapEl 元素矩形算，而元素下面 155px 被统计卡 + tabbar 盖住（占元素高 18%），
        fitBounds/裁剪/聚焦都按那个更大的矩形算，于是内容一格一格挪进死带；
     ③ +/− 走 map.zoomIn()，锚在元素几何中心，比可用区中心低 53px，连按就把内容一路推进底部死带。
   浏览器侧的几何由 tools/smoke-usable.js 的 U0–U13 钉（22 条判据）；这一节钉的是
   **那套几何所依赖的实现形状不许悄悄改回去**——它是常驻提交闸门，跑在源码字符串上。
   本批 E 段踩到的那条只有重复跑才现形的坑（锚点表里 clamp 那 6 条钉的是它的**读取来源**，不是它的结果）：
     clampCapsules 原先读胶囊**自己的** getBoundingClientRect() 再减回上一轮的 --lod-dx，而
     .lod-cl 带 transform:var(--motion-fast)（160ms）过渡——量到的永远是位移中间态。表现为
     **同一个构建**连跑两次冒烟：第一次红 U5/U6，第二次红 U5/U12，偏移 1.9／2.7／4.7px（都是
     越界 0 的「居中」项），第三次起才可能绿。改法是锚点取 0×0 容器中心、宽高取 offsetWidth/Height
     （两者都不吃 transform），复跑三遍各 22/22 且 0 红（tools/out/b13-repeat-run{1,2,3}.txt）。
     教训：**「时绿时红」不是测试噪声，是产品在读动画中间态**；判据只能由源码锚点负责，
     因为固定定时器的探针根本复现不了竞态（本轮实测：定点探针量到最大偏移 0.1px）。
   变异侧的两条归属账（tools/out/mut-usable.js，26 条 / 异常 0 / 逐字节还原）：
     · M4「带名单去掉 .tabbar」浏览器侧 0 红——内缩取各带贡献的 max，452/390 两档都是
       .region-stats 155px 压住 .tabbar 82px，删小的那条几何上是恒等操作（tools/out/b13-band-contrib.js）。
       所以 M4 归属源码锚，另加 M4b（删最大的那条 → 155→82）把 U2 打红，这条对账才是活闸。
     · B1「闸门的 BANDS 置空」→ verify.js 仍全绿、只有浏览器侧红：证明「闸门自己独立量一遍内缩」
       这句话背后真有闸，而不是一句注释。
   两条实现坑（都是本轮实测踩到的，别再走回头路）：
     · 锚点计数跑在「剥掉块注释 + 空白归一」的源上，所以 needle 里一旦出现 /* 就永远 0 命中。
        本轮真的写错过一条（'clampCapsules(); /* mini 化之后'），期望 1 恒得 0——那是假绿灯的反面
        （假红灯），改回去就没人再信这条闸。所以第②组把「needle 含注释」直接判红。
     · 期望 0 的锚点（改前形态）必须有正向对照才成立，否则「这条永远 0」和「这条真的没有」在
        输出里长得一模一样。第①组把改前三条形态拼成一个合成源喂进同一个计数器，必须命中 ≥1。
   57 条锚点全部先实测再写死（node tools/out/b13-anchors.js → 57/57；那张探针不再另抄一份表，
   直接从本节抠 A24 求值——手抄两份账本这轮就漂过 2 条），差一个空格就是永久红灯。
   ============================================================ */
{
  let bad = 0;
  const F24 = m => { console.log('边缘点闸门 FAIL: ' + m); bad++; };
  const flat24 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const cnt24 = (src, needle) => src.split(needle).length - 1;
  const FILES24 = ['topic-common.js', 'node-lod.js', 'map.css'];
  const SRC24 = {};
  FILES24.forEach(f => {
    if (!fs.existsSync(f)) { F24('缺 ' + f); SRC24[f] = ''; return; }
    SRC24[f] = flat24(fs.readFileSync(f, 'utf8'));
  });
  /* [文件, 锚点（空白归一后的字面串）, 期望次数, 这条钉的是什么退化] */
  const A24 = [
    ['topic-common.js', "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];", 1, '带名单整串相等（4 条；.ctl 不在里面——它是点状遮挡，扣进去等于把整条右边判死）'],
    ['topic-common.js', "USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];", 1, '同上（去 var 的宽松式，防写法漂移）'],
    ['topic-common.js', 'ix < el.width * 0.6', 1, '横向没压满 60% 就不算带（顶栏实测占宽 .326 时确实不该扣）'],
    ['topic-common.js', 'Math.min(ins.top, size.y - 40)', 1, '带不许把可用区吃光（横屏/极矮视口保险）'],
    ['topic-common.js', 'Math.min(ins.bottom, size.y - 40)', 1, '同上（底带）'],
    ['topic-common.js', 'ins.left = Math.max(0, Math.min(ins.left, size.x - 40));', 1, '四条边都有保险，不只上下'],
    ['topic-common.js', 'ins.right = Math.max(0, Math.min(ins.right, size.x - 40));', 1, '同上'],
    ['topic-common.js', 'var MARK_HALF = 16;', 1, '内容区在可用区之外再让半枚标记（胶囊 31/节点 30 的半高）'],
    ['topic-common.js', 'function usableInsets(', 1, '可用区内缩'],
    ['topic-common.js', 'function contentInsets(', 1, '内容区内缩'],
    ['topic-common.js', 'function contentBounds(', 1, '喂给 LOD 的裁剪矩形'],
    ['topic-common.js', 'function fitUsable(', 1, '按可用区 fit'],
    ['topic-common.js', 'function zoomUsable(', 1, '按可用区中心缩放'],
    ['topic-common.js', 'function contentCenterPx(', 1, '内容中心（聚焦与缩放共用一个口径）'],
    ['topic-common.js', 'function focusUsable(', 1, '按可用区聚焦'],
    ['topic-common.js', 'function clampCapsules(', 1, '边缘内收'],
    ['topic-common.js', 'paddingTopLeft: [i.left, i.top]', 2, 'Leaflet 真实选项名（fitUsable + focusUsable 各一处）'],
    ['topic-common.js', 'paddingBottomRight: [i.right, i.bottom]', 2, '同上'],
    ['topic-common.js', 'paddingTL', 0, '这版 Leaflet（1.1.1）没有 paddingTL，写了静默失效＝改前形态'],
    ['topic-common.js', "$('zoomIn').onclick = function () { zoomUsable(1); };", 1, '+ 走可用区锚点'],
    ['topic-common.js', "$('zoomOut').onclick = function () { zoomUsable(-1); };", 1, '− 同上'],
    ['topic-common.js', 'map.zoomIn()', 1, '只许留在 zoomUsable 的 catch 兜底里那一处'],
    ['topic-common.js', 'map.zoomOut()', 1, '同上'],
    ['topic-common.js', 'map.setZoomAround(map.containerPointToLatLng(p), nz);', 1, '缩放绕「内容中心那个经纬度」，它缩放后屏幕位置不动'],
    ['topic-common.js', 'else if (all.length) fitUsable(all);', 1, '路线首屏 fit 走可用区'],
    ['topic-common.js', 'map.fitBounds(all', 0, '旧的写死 padding 路线 fit＝改前形态'],
    ['topic-common.js', 'map.fitBounds(_b', 0, '旧的首屏 fit＝改前形态'],
    ['topic-common.js', 'fitUsable(_b, { maxZoom: 7, animate: false });', 2, '首屏两遍 fit（统计卡 400ms 后才出现，第一遍必然按旧内缩算）'],
    ['topic-common.js', 'updateRegionStats();', 1, '两遍之间把统计卡补出来'],
    ['topic-common.js', "switchTab('map'); if (restorePos && restorePos.zoom)", 1, '路线：切 tab 紧接 fit，顺序不能反（region-stats 只在地图 tab 显示）'],
    ['topic-common.js', 'vb: contentBounds,', 1, '把裁剪矩形注入 LOD'],
    ['topic-common.js', 'focus: focusUsable,', 1, '把聚焦方式注入 LOD'],
    ['topic-common.js', 'onRendered: function () { clampCapsules();', 1, '渲染完立刻内收（同一帧不变量）'],
    ['topic-common.js', "labelAvoid('#mapEl'); clampCapsules();", 1, '避让把胶囊改窄/挪位后再按新宽度重算一次'],
    ['topic-common.js', 'var ax = c.left + c.width / 2, ay = c.top + c.height / 2;', 1, '锚点取容器中心：胶囊自身 transform 带 160ms 过渡，量胶囊盒会读到位移中间态（U5/U12 时红时绿的根因）'],
    ['topic-common.js', 'var w = n.offsetWidth, h = n.offsetHeight;', 1, '宽高走布局盒 offsetWidth/Height，不吃 transform'],
    ['topic-common.js', 'if (w < lim.r - lim.l) dx = Math.min(Math.max(ax, lim.l + w / 2), lim.r - w / 2) - ax;', 1, '比可用区还宽就不挪 + 期望中心＝锚点夹进半盒（重复调用幂等，不读上次的 dx）'],
    ['topic-common.js', 'if (h < lim.b - lim.t) dy = Math.min(Math.max(ay, lim.t + h / 2), lim.b - h / 2) - ay;', 1, '纵向同理——底带 155px 那半枚就是靠它'],
    ['topic-common.js', "n.style.setProperty('--lod-dx', Math.round(dx) + 'px');", 1, '内收量落在 --lod-dx 上（CSS 侧 translate 变量，锚点不动）'],
    ['topic-common.js', "n.style.setProperty('--lod-dy', Math.round(dy) + 'px');", 1, '同上（纵向）'],
    ['topic-common.js', 'usableInsets: usableInsets,', 1, '导出给浏览器闸门独立复算'],
    ['topic-common.js', 'contentInsets: contentInsets,', 1, '同上'],
    ['topic-common.js', 'usableRectPx: usableRectPx,', 1, '同上（clampCapsules 的 lim 口径）'],
    ['topic-common.js', 'function recheckInsets(', 1, '带变了就重跑 LOD'],
    ['topic-common.js', 'recheckInsets();', 2, '统计卡出现/消失两个出口都要重算'],
    ['node-lod.js', 'function vb() { return C.vb ? C.vb() : C.map.getBounds(); }', 1, '裁剪矩形可注入，不注入才回元素矩形'],
    ['node-lod.js', 'var b = vb();', 2, 'groupBy + renderNodes 都走注入矩形'],
    ['node-lod.js', 'C.map.getBounds()', 1, '全站只剩 vb() 兜底那一处'],
    ['node-lod.js', 'if (C.focus)', 2, 'region 分支 + bounds 分支都让产品接管聚焦'],
    ['node-lod.js', 'C.focus({ center: bnd.getCenter(), zoom: 10 });', 1, 'region 分支把「那个中心」交给产品（固定缩放，不给 bounds）'],
    ['node-lod.js', 'C.focus({ bounds: bnd, maxZoom: mz });', 1, 'city/county 分支交边界 + maxZoom'],
    ['node-lod.js', 'C.map.flyToBounds(bnd, { padding: C.pad || [24, 40], maxZoom: mz, duration: .5 });', 1, '未注入时的旧行为原样留着（默认路径不许被顺手改掉）'],
    ['map.css', 'var(--lod-dx,0px)', 2, '基础规则 + :active 两处都得带居中'],
    ['map.css', 'var(--lod-dy,0px)', 2, '纵向同理——只做横不做竖，底带里那半枚照样被切'],
    ['map.css', 'transform:translate(calc(-50% + var(--lod-dx,0px)),calc(-50% + var(--lod-dy,0px)))', 2, '盒中心＝地理锚点（两条：基础与按下态）'],
    ['map.css', '.lod-cl:active{transform:translate(calc(-50%', 1, ':active 必须重复同一条 translate'],
    ['map.css', '.lod-cl:active{transform:scale(.94)}', 0, '裸 scale 会让按住那一刻整枚弹回锚点右下＝改前形态'],
  ];
  const GROUPS = {};
  A24.forEach(t => {
    if (t[1].indexOf('/*') >= 0 || t[1].indexOf('*/') >= 0)
      F24('锚点里不许出现块注释（flat24 先剥注释，这条永远 0 命中；本轮真的写错过一条）：' + t[1].slice(0, 44));
    if (!t[3]) F24('锚点缺说明（第 4 项是"这条钉的是哪个退化"，没有它半年后没人敢删）：' + t[1].slice(0, 40));
    const n = cnt24(SRC24[t[0]], t[1]);
    if (n !== t[2])
      F24(t[0] + ' 锚点「' + t[1].slice(0, 46) + '」实得 ' + n + '，期望 ' + t[2] + ' —— ' + t[3]);
    GROUPS[t[0]] = (GROUPS[t[0]] || 0) + 1;
  });
  if (A24.length < 57) F24('锚点表被削减：' + A24.length + ' 条（批次 13 落地时实测 57 条，整组删掉就等于这节没了）');
  FILES24.forEach(f => { if ((GROUPS[f] || 0) < 5) F24('锚点覆盖不足：' + f + ' 只有 ' + (GROUPS[f] || 0) + ' 条，该文件的退化检不出来'); });

  /* ① 期望 0 那几条的正向对照：把改前形态喂进同一个计数器，必须命中 ≥1，
        否则「永远 0」到底是真没有还是 needle 自己写错了，输出上分不出来 */
  {
    const OLD = flat24([
      '.lod-cl:active{transform:scale(.94)}',
      'map.fitBounds(all, { padding: [24, 40] }); map.fitBounds(_b, { padding: 40 });',
      'map.zoomIn(); L.divIcon({ paddingTL: [8, 8] });',
    ].join('\n'));
    [['.lod-cl:active{transform:scale(.94)}', '裸 scale 改前形态'],
     ['map.fitBounds(all', '写死 padding 的路线 fit'],
     ['map.fitBounds(_b', '写死 padding 的首屏 fit'],
     ['paddingTL', '不存在的 Leaflet 选项名']].forEach(t => {
      if (cnt24(OLD, t[0]) < 1) F24('正向对照失效：合成"改前源"里的「' + t[1] + '」没命中，那条期望 0 的锚是假绿灯');
    });
  }
  /* ② 计数方法自身：needle 必须区分大小写与连字，且对真源非恒正 */
  if (cnt24(SRC24['map.css'], 'TRANSFORM:TRANSLATE(CALC(-50%') < 0) F24('计数器自身失效（split 不可能给负数，这行只防实现被改坏）');
  if (cnt24(SRC24['map.css'], 'transform:translate(calc(-50%') <= 0) F24('探针失效：真源里连基础居中规则都找不到，②③组全是空转');

  /* ③ 浏览器闸门与文档不许缺席（这节钉实现形状，几何判据在 smoke-usable.js） */
  const SM24 = 'tools/smoke-usable.js';
  if (!fs.existsSync(SM24)) F24('缺 ' + SM24 + '：可用区几何没人量了');
  else {
    const sm = fs.readFileSync(SM24, 'utf8');
    for (let i = 0; i <= 13; i++)
      if (sm.indexOf("'U" + i) < 0 && sm.indexOf('U' + i + ' ') < 0) F24(SM24 + ' 缺 U' + i + ' 这条判据（U0–U13 是一整组，少一条就是有个退化没人管）');
    if (sm.indexOf('BANDS = [') < 0) F24(SM24 + ' 不再自己量内缩了：闸门必须独立复算一遍再和产品对账，只读产品函数等于自我实现');
  }
  const RD = fs.existsSync('README.md') ? fs.readFileSync('README.md', 'utf8') : '';
  if (RD.indexOf('smoke-usable.js') < 0) F24('README.md 没登记 smoke-usable.js（新闸门不写进 README 就等于没装）');
  if (RD.indexOf('§24') < 0) F24('README.md 的 verify 清单没提 §24');
  const DOC = fs.existsSync('改进实施方案与验收标准.md') ? fs.readFileSync('改进实施方案与验收标准.md', 'utf8') : '';
  if (DOC.indexOf('批次 13') < 0) F24('改进实施方案与验收标准.md 没有「批次 13」这一节（实测数字要落文档，不然下批又从头猜）');

  console.log('边缘点闸门: ' + A24.length + ' 条源码锚点逐条计数（空白归一后整串相等，含大小写与连字）——带名单四条逐值 + 60% 成带判据 + 四边 40px 保险 + ' +
    'MARK_HALF 16；usableInsets/contentInsets/contentBounds/fitUsable/zoomUsable/contentCenterPx/focusUsable/clampCapsules 各恰 1 处；' +
    'paddingTopLeft/paddingBottomRight 各 2 处且 paddingTL 零残留（这版 Leaflet 不认它，写了静默失效）；' +
    '+/− 只许走 zoomUsable，map.zoomIn/Out 各只剩 catch 兜底 1 处；路线与首屏的旧 fitBounds 零残留、首屏两遍 fit + 中间补统计卡 + 切 tab 在 fit 之前；' +
    'LOD 侧 vb/focus 注入到位且 C.map.getBounds() 只剩兜底 1 处、未注入的默认 flyToBounds 旧行为原样保留；' +
    'map.css 居中 translate 基础与 :active 各 1 条（裸 scale 回潮即红）；clamp 的三条不变量在——锚点取容器中心、宽高取 offsetWidth/Height（都不吃胶囊自身 transform 的 160ms 过渡）、比可用区还宽就不挪；' +
    'recheckInsets 两个出口在；期望 0 的四条改前形态有合成源正向对照；smoke-usable.js U0–U13 齐备且仍自己量一遍内缩；README 与方案文档已登记');
  fail += bad;
}

/* ============ §25 像素基线闸门：短命提示的摘除名单 ============
   批次 13-G 实测：重拍基线后连跑，node-manager 三档红 **1.72%／4.10%／6.03%**，红点全落在
   「本地 7794 个地点已就绪 · 搜索添加新地点」那颗胶囊上。它是 node-manager.html 页内自造的
   `#nmTip`（`loadIndex()` 回调里打一条，活 2600ms + 退场过渡），**不是 `.ui-toast`**，
   所以 visual-check 的摘除名单漏了它 → 基线拍到「全显示」、复跑拍到「退场中间帧」，
   同一份代码连跑结果不同。它与 `.ui-toast` 是同一条口径下的两个名字，所以这一节钉的是
   「名单不许缩回只认 `.ui-toast`」，外加名单里每个名字都要有活着的挂载点（名字改了就红，
   防"名单还在、指向已死"）。 */
{
  let bad25 = 0;
  const F25 = m => { bad25++; console.log('FAIL §25 像素基线闸门: ' + m); };
  const flat25 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const cnt25 = (src, needle) => src.split(needle).length - 1;
  const rd25 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const VC = flat25(rd25('tools/visual-check.js'));
  if (!VC) F25('读不到 tools/visual-check.js');
  const SEL = cnt25(VC, `const TOAST_SEL = '.ui-toast, #nmTip, .toast, .ui-tilewarn';`);
  if (SEL !== 1) F25('摘除名单字面整串不等（期望恰 1 处，实测 ' + SEL + '）——名单被改窄或被改名，短命提示就会重新进基线');
  const USE = cnt25(VC, 'document.querySelectorAll(sel).forEach(e => e.remove());');
  if (USE !== 1) F25('摘除动作没走 TOAST_SEL（期望恰 1 处，实测 ' + USE + '）——名单定义了却没被用，等于没摘');
  /* 改前形态零残留：只认 `.ui-toast` 的那两行必须一处不剩 */
  const OLD = cnt25(VC, `document.querySelectorAll('.ui-toast')`);
  if (OLD !== 0) F25('还留着只认 .ui-toast 的旧写法 ' + OLD + ' 处（缩回名单=像素闸门重新掷硬币）');
  /* 名单里每个名字都要有活挂载点，否则"名单齐了但指向已死"是静默失效 */
  const NM = rd25('node-manager.html');
  if (cnt25(flat25(NM), `id="nmTip"`) !== 1) F25('node-manager.html 的 #nmTip 挂载点不是恰 1 处（实测 ' + cnt25(flat25(NM), `id="nmTip"`) + '）——产品改了名字，名单要跟着改，别把这条删掉了事');
  if (NM.indexOf("tip('本地 '") < 0) F25('node-manager.html 里那条 loadIndex 回调的开场提示不见了（它要是改成不自动弹，本节的 #nmTip 才可以从名单里摘掉）');
  const UJS = flat25(rd25('ui.js'));
  if (cnt25(UJS, `tileWarnEl.className = 'ui-tilewarn';`) !== 1) F25('ui.js 的 .ui-tilewarn 挂载点不是恰 1 处（实测 ' + cnt25(UJS, `tileWarnEl.className = 'ui-tilewarn';`) + '）——那颗「瓦片加载失败」还在不在名单都得先说清');
  if (cnt25(UJS, `}, 4000);`) < 1) F25('ui.js 里 tileWarn 的 4000ms 自消失定时器不见了（它要是不再自己消失，就不该继续待在摘除名单里）');
  const TC = flat25(rd25('topic-common.js'));
  if (cnt25(TC, `t.className = 'toast'`) !== 1) F25('topic-common.js 的 #tripToast 兜底类名 `.toast` 挂载点不是恰 1 处（实测 ' + cnt25(TC, `t.className = 'toast'`) + '）');
  const n25 = (VC.match(/const TOAST_SEL = '([^']*)'/) || [, ''])[1].split(',').length;
  if (n25 < 4) F25('摘除名单只剩 ' + n25 + ' 个选择器（下限 4：.ui-toast / #nmTip / .toast / .ui-tilewarn——一类一类往上添过，删任何一类都要先证明它不再自动消失）');
  if (rd25('README.md').indexOf('#nmTip') < 0) F25('README.md 的视觉闸门口径没登记 #nmTip 这一类（新名单不写进 README 就等于没装）');
  if (rd25('README.md').indexOf('.ui-tilewarn') < 0) F25('README.md 的视觉闸门口径没登记 .ui-tilewarn 这一类');
  console.log('像素基线闸门: 摘除名单整串相等（' + n25 + ' 个选择器）且摘除动作真走它；只认 .ui-toast 的旧写法零残留；' +
    '名单里三个名字各有活挂载点（node-manager.html 的 id="nmTip" + loadIndex 开场提示、ui.js 的 ui-tilewarn + 4000ms 定时器、topic-common.js 的 .toast 兜底）；README 已登记');
  fail += bad25;
}


/* ============ §26 规划结果页地图闸门：不许再对着 0×0 容器建图 ============
   批次 14。用户报三条症状：① 地图显示不全 ② 只有节点没有路线 ③ 点节点不出信息。
   根因一条，且三条症状同源（showStage 走 UI.vt，View Transition 把 display 翻转推到下一帧，
   紧随其后的 renderResult()→renderMap() 量到的是切换前的 display:none = 0×0）。
   改前物证（tools/out/b14-probe-before.txt，452×995 = 一加 Ace 6T）：
     建图时容器 0×0 → map.getSize() 永久 0×0、瓦片只有 1 块（视口铺满 10.1%）、
     overlay svg 属性 0x0 → 8 条 path 全画成 0×0（所以「只显示节点不显示路线」）、
     针脚被投到 -49383,-405742（所以「点不到节点」，弹窗也定位在框外被 overflow:hidden 裁掉）、
     fitBounds 同时退化成 maxZoom=18。事后 invalidateSize 只救得回尺寸（瓦片 100%）
     救不回视图（path 仍 0×0，见路径 A2/A3）——所以修法只能是「有尺寸之后才建图」，
     这一节钉的就是那个分层的实现形状，不是某个像素结果。
   为什么批次 3–13 的闸门全绿（这是本批最重要的一条口径教训）：
     79 态像素基线与跑减动效档的 smoke 都强制 prefers-reduced-motion，UI.vt 在那一档走
     **同步**退化分支，建图时容器已有尺寸——改后探针路径 D 实测 vtSeen=0 且几何健康。
     也就是说这一整类「转场异步 ⇒ 紧接着量几何」的 bug，在减动效档结构性看不见。
     所以补了 tools/smoke-planner.js 的 G1–G11（跑在默认档，不强制减动效），
     并要求这一节自己钉住「smoke-planner 不许改成强制减动效」——否则 G 段会静默变成又一条假闸。
   两条实现坑沿用 §24：needle 里不许出现块注释（flat26 先剥注释，写了永远 0 命中）；
   期望 0 的锚点必须有正向对照（把改前形态喂进同一个计数器，必须命中 ≥1）。
   ============================================================ */
{
  let bad26 = 0;
  const F26 = m => { bad26++; console.log('FAIL §26 地图闸门: ' + m); };
  const flat26 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const cnt26 = (src, needle) => src.split(needle).length - 1;
  const rd26 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const FILES26 = ['planner.js', 'ui.js', 'planner.html', 'tools/smoke-planner.js'];
  const SRC26 = {};
  FILES26.forEach(f => {
    if (!fs.existsSync(f)) { F26('缺 ' + f); SRC26[f] = ''; return; }
    SRC26[f] = flat26(rd26(f));
  });
  /* [文件, 锚点（空白归一后的字面串）, 期望次数, 这条钉的是什么退化] */
  const A26 = [
    ['planner.js', 'var map = null, mapLayer = null, mapGen = 0;', 1, 'mapGen 是过期轮次的作废计数（少了它两轮渲染都会画）'],
    ['planner.js', 'function renderMap() {', 1, '调度层：只决定什么时候画'],
    ['planner.js', 'function drawMap(trip, pts) {', 1, '画图层：只对已经有尺寸的容器画'],
    ['planner.js', "var gen = ++mapGen, box = $id('mapBox'), tries = 0;", 1, '每轮渲染先领代次号再量容器'],
    ['planner.js', 'if (box.clientWidth && box.clientHeight) { drawMap(trip, pts); return; }', 2, '两条出口都在尺寸判定之后（同步一条 + rAF 一条）；少一条就是回到 0×0 建图'],
    ['planner.js', 'if (gen !== mapGen) return;', 1, '增删站点/重新排期会再 renderMap 一次，旧轮次必须作废'],
    ['planner.js', 'if (++tries < 180) requestAnimationFrame(wait);', 1, '等尺寸有上限（约 3s），不是无限挂 rAF'],
    ["planner.js", "L.map('mapBox', { zoomControl: false })", 1, '全页只剩 drawMap 里那一处建图'],
    ['planner.js', 'map.invalidateSize();', 1, '有尺寸之后仍补一次（转屏/改宽）——它是补充，不是本节的修法'],
    ['planner.js', 'if (bnd.length > 1) map.fitBounds(bnd, { padding: [40, 40] });', 1, '多点才 fit（症状①的另一半）'],
    ['planner.js', 'else if (bnd.length === 1) map.setView(bnd[0], 9);', 1, '单站不 fitBounds：0 跨度会顶到 maxZoom=18，等于又一条「显示不全」'],
    ['planner.js', 'renderMap();', 3, '首屏渲染 / AI 换线 / 增删站点重排 三个出口都走调度层'],
    ['planner.js', 'UI.vt(function () {', 1, 'showStage 仍走 View Transition——这条 bug 的成因不许用「别转场了」来绕开'],
    ['planner.js', "m.bindPopup('<b>' + esc(s.name)", 1, '症状③「点节点不出信息」的接线还在'],
    ['planner.js', 'iconSize: [26, 26], iconAnchor: [13, 24]', 1, '针脚锚点（改回 0 尺寸图标，G7 的盒内判定就失真）'],
    ['planner.js', "L.control.zoom({ position: 'bottomright' }).addTo(map);", 1, '建图那次一次性挂缩放控件（挪进 clearLayers 循环会越叠越多）'],
    ['planner.js', "if (snap.stage === 'stageResult' && snap.trip) { showStage('stageResult'); renderResult(); }", 1, '刷新恢复：先切阶段再渲染（这是第二条独立缺陷，顺序和别的入口一致）'],
    ['planner.js', "renderResult(); showStage('stageResult');", 0, '改前的反顺序零残留'],
    ['ui.js', 'if (reducedMotion() || !document.startViewTransition) { fn(); return null; }', 1, '同步退化分支还在（G 段特意不走这一档）'],
    ['ui.js', 'var t = document.startViewTransition(fn);', 1, '异步分支还在＝成因没被抹掉，只是被产品侧挡住了；哪天 UI.vt 改名，G 段就该换档而不是变绿'],
    ['planner.html', '#mapBox{height:46vh;min-height:220px', 1, '容器自己有高度——sized 判定等的不是一个永远 0 高的盒子'],
    ['tools/smoke-planner.js', 'const MAP_HOOK = () => {', 1, '测试侧建图钩子在场（G1/G2/G8 的读数来源）'],
    ['tools/smoke-planner.js', 'const MAP_GEOM = () => {', 1, '几何读数函数在场（判据读 DOM，不读像素）'],
    ['tools/smoke-planner.js', 'window.__plannerMap = m;', 1, '钩子把 Leaflet 实例交给闸门'],
    ['tools/smoke-planner.js', 'emulateMediaFeatures', 0, 'smoke-planner 不许强制减动效：那一档 UI.vt 同步执行，本 bug 结构性看不见，G 段会静默变假闸'],
  ];
  const GROUPS = {};
  A26.forEach(t => {
    if (t[1].indexOf('/*') >= 0 || t[1].indexOf('*/') >= 0)
      F26('锚点里不许出现块注释（flat26 先剥注释，这条永远 0 命中）：' + t[1].slice(0, 44));
    if (!t[3]) F26('锚点缺说明（第 4 项是"这条钉的是哪个退化"）：' + t[1].slice(0, 40));
    if (!(t[0] in SRC26)) { F26('锚点指向没登记的文件：' + t[0]); return; }
    const n = cnt26(SRC26[t[0]], t[1]);
    if (n !== t[2])
      F26(t[0] + ' 锚点「' + t[1].slice(0, 46) + '」实得 ' + n + '，期望 ' + t[2] + ' —— ' + t[3]);
    GROUPS[t[0]] = (GROUPS[t[0]] || 0) + 1;
  });
  if (A26.length < 25) F26('锚点表被削减：' + A26.length + ' 条（批次 14 落地时实测 25 条，整组删掉等于这节没了）');
  const MIN26 = { 'planner.js': 17, 'ui.js': 2, 'planner.html': 1, 'tools/smoke-planner.js': 4 };
  FILES26.forEach(f => { if ((GROUPS[f] || 0) < (MIN26[f] || 1)) F26('锚点覆盖不足：' + f + ' 只有 ' + (GROUPS[f] || 0) + ' 条，下限 ' + (MIN26[f] || 1)); });

  /* ① 结构检：renderMap 调度层里不许出现建图，建图只能在 drawMap 里 */
  const bodyOf = (src, a, b) => {
    const i = src.indexOf(a); if (i < 0) return null;
    const j = src.indexOf(b, i + a.length);
    return src.slice(i, j < 0 ? src.length : j);
  };
  const RB = bodyOf(SRC26['planner.js'], 'function renderMap() {', 'function drawMap(trip, pts) {');
  if (!RB) F26('抠不出 renderMap 函数体（renderMap / drawMap 两个名字至少改了一个，本节的结构检失效）');
  else {
    if (RB.indexOf('L.map(') >= 0) F26('renderMap 调度层里又出现 L.map( —— 回到「不管容器有没有尺寸就建图」的改前形态');
    if (RB.indexOf('drawMap(') < 0) F26('renderMap 不再调 drawMap：sized 判定形同虚设，画图层没人叫');
  }
  const DB = bodyOf(SRC26['planner.js'], 'function drawMap(trip, pts) {', 'function flatStops() {');
  if (!DB) F26('抠不出 drawMap 函数体（后面紧跟的是 flatStops，这两个名字漂了要同步改本节）');
  else if (DB.indexOf('L.map(') < 0) F26('建图不在 drawMap 里（drawMap 段抠不到 L.map(），那 G1–G11 量的就不是这一处建图');

  /* ② 期望 0 那条的正向对照：把改前形态喂进同一套计数与结构检，必须命中 */
  {
    const OLD26 = flat26([
      "function renderMap() { var trip = state.trip; if (!trip) return; if (!map) { map = L.map('mapBox', { zoomControl: false }).setView([34.5, 105], 5); } }",
      'function drawMapUnused() {}',
      "if (snap.stage === 'stageResult' && snap.trip) { renderResult(); showStage('stageResult'); }"
    ].join('\n'));
    const OB = bodyOf(OLD26, 'function renderMap() {', 'function drawMapUnused() {');
    if (!OB || OB.indexOf('L.map(') < 0) F26('正向对照失效：合成"改前源"的 renderMap 体里抠不到 L.map(，那条结构检是假绿灯');
    if (cnt26(OLD26, "renderResult(); showStage('stageResult');") < 1) F26('正向对照失效：合成"改前源"里的反顺序没命中，那条期望 0 的锚是假绿灯');
    const MM = rd26('tools/smoke-motion.js');
    if (cnt26(flat26(MM), 'emulateMediaFeatures') < 1) F26('正向对照失效：仓库里连一条 emulateMediaFeatures 都找不到，那条期望 0 的锚只是 needle 写错了');
  }

  /* ③ 浏览器闸门 G1–G11 一条不许少（这一节的几何判据只活在 smoke-planner 的默认档里） */
  for (let i = 1; i <= 11; i++)
    if (SRC26['tools/smoke-planner.js'].indexOf("'G" + i + " ") < 0)
      F26('tools/smoke-planner.js 缺 G' + i + ' 这条判据（G1–G11 是一整组：尺寸/画布/条数/零尺寸/框内/缩放/弹窗/不裁/重画复测，少一条就是有个症状没人管）');
  if (cnt26(SRC26['tools/smoke-planner.js'], 'page.evaluate(MAP_GEOM)') < 2)
    F26('G 段只剩一次读数：改完站点/重新排期之后的复测（G11）不能省，重画是另一条出口');

  const RD26 = rd26('README.md');
  if (RD26.indexOf('§26') < 0) F26('README.md 的 verify 清单没提 §26（新闸门不写进 README 就等于没装）');
  if (RD26.indexOf('G1–G11') < 0) F26('README.md 的 smoke-planner 那一行没登记 G1–G11 地图判据');
  const DOC26 = rd26('改进实施方案与验收标准.md');
  if (DOC26.indexOf('批次 14') < 0) F26('改进实施方案与验收标准.md 没有「批次 14」这一节（实测数字要落文档，不然下批又从头猜）');

  console.log('地图闸门: ' + A26.length + ' 条源码锚点逐条计数（空白归一后整串相等）——renderMap 调度层 / drawMap 画图层分层，' +
    '两条 sized 出口各 1 处、mapGen 作废与 180 帧上限在、建图只剩 drawMap 一处、fitBounds 与单站 setView 分两条、' +
    '三个 renderMap() 出口、bindPopup/针脚锚点/缩放控件各在其位；恢复路径顺序与别的入口一致（反顺序零残留）；' +
    'UI.vt 同步与异步两条分支都在（成因没抹、由产品侧挡）；#mapBox 自带高度；' +
    'smoke-planner 的 MAP_HOOK/MAP_GEOM/__plannerMap 在场且 G1–G11 齐备、仍不强制减动效、改图后有复测；' +
    '期望 0 的三条各有合成改前源或真源正向对照；README 与方案文档已登记');
  fail += bad26;
}


console.log(fail ? '=== FAIL: ' + fail + ' issue(s) ===' : '=== ALL CHECKS PASSED ===');
process.exit(fail ? 1 : 0);
