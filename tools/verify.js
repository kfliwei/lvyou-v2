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

/* 11. 图片加载闸门（P0-2）。从 design.css 真解析 token 值再算，不抄数字——
   - 每个含 `<img` 的行必须带 loading="lazy"；确属首屏 LCP 要提前加载的，在同一行注 `img-eager-ok: 理由`
     （沿用 §7 的显式登记思路：豁免必须留名，不许匿名通过）。
   - 每个 `<img` 必须带 onerror（品牌占位/切换占位类），裸挂远端图无兜底 = FAIL。
   - 每个 `<img` 必须带 src（批次 30-E 补的）。这一支原先没有，正因为它只查那两个「防御属性」，
     就把「压根没把 src 拼进串」这一族放过去了：图永远空白，而 onerror 会真的触发、UI.imgFail
     把框变成占位，症状长得像「图挂了」而不是「没给图」，读代码的人扫一眼看到 onerror 还在就翻篇了。
     review.html 的日卡缩略图就是这么漏的（42 个 `<img` 行里唯一一处），2026-10-09 用户在手机上发现。
   - 扫描器自己要有正向对照：先证明「漏 src 那种形状它抓得到」，否则「零违规」可能是它瞎了。
   - 比例系统 token（--ar-list/--ar-cover/--ar-square/--img-scrim）与 .imgbox/.img-fallback 必须在 design.css 定义，
     产品 CSS 不再手写 4/3、16/9 字面量。 */
{
  let bad = 0;
  const IMG_FILES = fs.readdirSync('.').filter(x => /\.(js|html)$/.test(x) && !/^test-/.test(x) && x !== 'icons-demo.html');
  let imgTotal = 0, lazyOk = 0, errOk = 0, srcOk = 0, registered = 0;
  const lazyBad = [], errBad = [], srcBad = [];
  const HAS_SRC = l => /src=/.test(l);
  /* 自校准两条：缺 src 的合成行必须被抓，带 src 的合成行不许误抓（抓反了的话这条规则等于没有） */
  if (HAS_SRC('<img loading="lazy" decoding="async" onerror="x">')) { console.log('图片闸门 FAIL: src 扫描器自校准失败——漏 src 的合成行没被抓到'); bad++; }
  if (!HAS_SRC('<img loading="lazy" decoding="async" onerror="x" src="a.svg">')) { console.log('图片闸门 FAIL: src 扫描器自校准失败——带 src 的合成行被误抓'); bad++; }
  for (const f of IMG_FILES) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (!line.includes('<img')) return;
      imgTotal++;
      /* 先查 src：它不在豁免分支里，img-eager-ok 只豁免 lazy，不豁免「没给图」 */
      if (HAS_SRC(line)) srcOk++; else srcBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
      if (line.includes('img-eager-ok:')) { registered++; if (!/onerror=/.test(line)) errBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60)); return; }
      if (/loading="lazy"/.test(line)) lazyOk++; else lazyBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
      if (/onerror=/.test(line)) errOk++; else errBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
    });
  }
  /* 分母对账：扫到的每一行 <img 都必须走到 src 判据。对不上＝有一族被跳过（push 被摘、豁免分支写错），
     那种闸门会「打印了红但没计数」——屏上看得见红字，退出码照样绿，等于没装。 */
  if (srcOk + srcBad.length !== imgTotal) {
    console.log('图片闸门 FAIL: src 检出分母对不上——扫到 ' + imgTotal + ' 行 <img，只有 ' + (srcOk + srcBad.length) + ' 行走到 src 判据');
    bad++;
  }
  lazyBad.forEach(l => console.log('图片闸门 FAIL（缺 loading="lazy" 或未登记 img-eager-ok）: ' + l));
  errBad.forEach(l => console.log('图片闸门 FAIL（缺 onerror 占位兜底）: ' + l));
  srcBad.forEach(l => console.log('图片闸门 FAIL（缺 src——缩略图只会是个空框，且 onerror 把它伪装成「图挂了」）: ' + l));
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
  console.log('图片闸门: <img 输出点 ' + imgTotal + '，src ' + srcOk + '，lazy ' + (lazyOk + registered) + '，兜底 ' + (errOk + registered) + '，登记豁免 ' + registered);
  fail += bad + lazyBad.length + errBad.length + srcBad.length;
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
  let litBad = 0, tail = 0, used = 0, clampN = 0, docPx = 0;
  const TAIL_MAX = 59;      /* 2026-10-04 收口时实测：≥21px 的展示级/海报数字，本轮有意不动，只许降不许升 */
  const LIT_MIN_USE = 600;  /* 走 token 的下限：收口后实测 929 处，掉下这条说明有人在批量退回字面量（下限留低是因为它还兼做「扫描面非空」的反向自证） */
  const CLAMP_MAX = 9;      /* 2026-10-04 实测：design.css 2 / album.html 2 / index.html 3 / album.js 2 */
  /* 独立导出文档的字号例外（批次 16）：docShell() 造的那份 HTML 不带 theme.css，
     var(--fs-*) 在里面**从来没解析成功过**（改前 h2 一直是 body 字号兜底），
     所以屏幕态那两个字号只能写死。这不是退回字面量，是阶梯根本到不了的地方；
     打印态那串是 pt（LIT 只匹配 px|rem，所以它天然不在计数里，不需要豁免）。
     写法照 clamp 那条：例外必须点名，涨一处就要先说明为什么又多了一份独立文档。 */
  const DOC_PX = [
    'font-size:17px;border-left:3px solid #AE5738',
    'color:#8C877D;font-size:13px}',
  ];
  fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js')
    .forEach(f => {
      const src = code21(f);
      src.split('\n').forEach(line => {
        clampN += (line.match(/font-size:clamp\(/g) || []).length;
        let m; LIT.lastIndex = 0;
        while ((m = LIT.exec(line))) {
          const v = m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * 16;
          if (v > 20) { tail++; continue; }
          if (DOC_PX.some(s => line.includes(s))) { docPx++; continue; }
          litBad++;
          if (litBad <= 6) F21('阶梯外字号字面量（' + f + '）：' + m[0].trim());
        }
        used += (line.match(/font-size:var\(--fs-/g) || []).length;
      });
    });
  if (litBad) F21('还有 ' + litBad + ' 处 ≤20px 的字号没进阶梯（跑 tools/out/ladder-sweep.js --write）');
  if (docPx !== DOC_PX.length) F21('独立导出文档的字号例外从点名的 ' + DOC_PX.length + ' 处变成 ' + docPx + ' 处：docShell 那份 HTML 没有 theme.css，var(--fs-*) 不解析，字号只能写死；要加第三条先说清是哪份独立文档');
  DOC_PX.forEach(s => {
    let n = 0;
    fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js')
      .forEach(f => { n += code21(f).split(s).length - 1; });
    if (n !== 1) F21('字号例外的点名串「' + s + '」全库命中 ' + n + ' 次（要 1）：串漂了豁免就是空转，那条字面量会同时从两个计数里消失');
  });
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
  /* 生成器也在这条线上：它原先没有字体段，跑一次就把两个 woff2 从 SHELL 里抹掉
     （本轮实测撞见）。钉的是**调用形状**而不是文件名子串——注释里提一句 coverage.json
     不算派生，探针先自证两头，否则这条线将来只剩一段注释还在"绿"。 */
  const GENFONT = /readFileSync\(path\.join\(dir,\s*'fonts\/coverage\.json'\)/;
  if (!GENFONT.test("JSON.parse(fs.readFileSync(path.join(dir, 'fonts/coverage.json'), 'utf8'))")) F21('生成器字体探针自身失效：已知正确写法没被抓到（这条锚是死的）');
  if (GENFONT.test('/* 名字从 fonts/coverage.json 派生 */')) F21('生成器字体探针误报：注释里的提及被当成派生（删掉代码它也不会红）');
  if (!GENFONT.test(read21('tools/gen-sw-shell.cjs'))) F21('tools/gen-sw-shell.cjs 不再从 fonts/coverage.json 派生品牌字预缓存：下次跑生成器就会把字体从 sw.js 的 SHELL 里抹掉（离线首屏没有品牌字）');
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
    '阶梯外 ≤20px 字面量 ' + litBad + ' 处、≥21px 尾巴 ' + tail + '/' + TAIL_MAX + '、clamp 例外 ' + clampN + '/' + CLAMP_MAX + '、独立导出文档字号例外 ' + docPx + '/' + DOC_PX.length + '（点名串逐条对账命中数）、走阶梯 ' + used + ' 处；' +
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
    ['topic-common.js', 'ix >= el.width * 0.6', 1, '横向没压满 60% 就不算带（顶栏实测占宽 .326 时确实不该扣）——批次18 补横向分支后这条改成「压满才算上下带」的正向形'],
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
      if (sm.indexOf("'U" + i + ' ') < 0) F24(SM24 + ' 缺 U' + i + ' 这条判据（U0–U13 是一整组，少一条就是有个退化没人管）');
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
  /* 性能预算的采样次数（批次 21 顺带修的一条假闸）：单次采样在冷首屏上是掷硬币，
     A/B 实测见 tools/out/b21-perf-ab.txt——HEAD 树 6 轮 888~2652ms（max 已越 2500 线），
     工作树 1016~1348ms。所以这里钉「取 3 次中位」这个形状，而不是钉某一次的读数。 */
  if (cnt25(VC, 'const PERF_SAMPLES = 3;') !== 1) F25('性能预算回到单次采样（PERF_SAMPLES 不是恰 1 处 = 3）——冷尾长尾会让这条闸门随机红，先读 tools/out/b21-perf-ab.txt 再改');
  if (cnt25(VC, 'const lcp = ls.slice().sort((a, b) => a - b)[1];') !== 1) F25('LCP 没取样本中位数——时间类指标取中位，单次读数不作数');
  if (cnt25(VC, 'const cls = Math.max.apply(null, cs);') !== 1) F25('CLS 没取三次里的最大值——位移越线一次就算越线，这里不该用中位');
  if (rd25('README.md').indexOf('LCP 中位') < 0) F25('README.md 没登记性能预算的采样口径（改口径不写进 README 就等于没改，下一个人还会拿单次读数当真相）');
  if (rd25('README.md').indexOf('#nmTip') < 0) F25('README.md 的视觉闸门口径没登记 #nmTip 这一类（新名单不写进 README 就等于没装）');
  if (rd25('README.md').indexOf('.ui-tilewarn') < 0) F25('README.md 的视觉闸门口径没登记 .ui-tilewarn 这一类');
  console.log('像素基线闸门: 摘除名单整串相等（' + n25 + ' 个选择器）且摘除动作真走它；只认 .ui-toast 的旧写法零残留；' +
    '名单里三个名字各有活挂载点（node-manager.html 的 id="nmTip" + loadIndex 开场提示、ui.js 的 ui-tilewarn + 4000ms 定时器、topic-common.js 的 .toast 兜底）；' +
    '性能预算取 3 次采样的 LCP 中位 + CLS 最大（单次采样是掷硬币）；README 已登记');
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

/* ============ §27 门票与事实新鲜度闸门 ============
   批次 15。这一节的由来是一次工具事故（0-1）：tools/gen-tickets.js 里写盘用的目标串
   和 site-tickets.js:6 的实际声明行各自演化，区间替换把 SEED 写成了语法错误的文件。
   更阴的是它的失败方向是反的——「有成果必失败、无成果必成功」：查到 0 条时合并结果空、
   走 exit 0 不写盘（看着像成功），查到 N 条时才开始炸。
   所以本节最有价值的不是第几条文案锚，而是下面这条**字面量对账**：把脚本里的 SEED_DECL
   真值抽出来，直接拿去 site-tickets.js 里数命中数，!== 1 即红。装上它之后，
   同一类漂移在任何一次 commit 里都会先红，不可能再靠人眼发现。
   其余锚点各钉一条口径：票价只能人工进种子（脚本不许写 p）、无 Key 不许发请求、
   同名异地 ±0.2° 两条比较、实时源要标出来源等级、tn_tk_ 永远不进备份。
   两条实现坑沿用 §24：needle 里不许出现块注释（flat27 先剥注释，写了永远 0 命中），
   所以「未收录就不显示价格行」这类文件头纪律走 RAW；期望 0 的锚点必须配正向对照。
   ============================================================ */
{
  let bad27 = 0;
  const F27 = m => { bad27++; console.log('FAIL §27 门票闸门: ' + m); };
  const flat27 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const cnt27 = (src, needle) => src.split(needle).length - 1;
  const rd27 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const FILES27 = ['site-tickets.js', 'topic-common.js', 'backup.js', 'tools/gen-tickets.js', 'tools/smoke-tickets.js'];
  const SRC27 = {}, RAW27 = {};
  FILES27.forEach(f => {
    if (!fs.existsSync(f)) { F27('缺 ' + f); SRC27[f] = ''; RAW27[f] = ''; return; }
    RAW27[f] = rd27(f);
    SRC27[f] = flat27(RAW27[f]);
  });

  /* ① 文件头三条纪律（注释体，只能走 RAW） */
  if (cnt27(RAW27['site-tickets.js'], '未收录就不显示价格行，绝不编造') !== 1)
    F27('site-tickets.js 文件头没有「未收录就不显示价格行，绝不编造」这条纪律（票价是唯一不能自动生成的字段）');
  if (cnt27(RAW27['tools/gen-tickets.js'], '合并纪律') !== 1)
    F27('tools/gen-tickets.js 头没有「合并纪律」注释（h 只在新值非空时覆盖 / p 绝不写 / 新条目才落 u——这三条一旦没人写下来就会被顺手改掉）');

  /* ② 字面量对账：脚本的写盘锚点必须能在真文件里命中且只命中一次 */
  const declM = RAW27['tools/gen-tickets.js'].match(/const SEED_DECL = '([^']+)';/);
  if (!declM) {
    F27('tools/gen-tickets.js 里抽不出 SEED_DECL 字面量（它必须是这个单引号常量；换成模板串/内联字面量就等于把对账闸门关掉）');
  } else {
    const hit = cnt27(SRC27['site-tickets.js'], declM[1]);
    if (hit !== 1)
      F27('字面量对账红：脚本要替换的串「' + declM[1] + '」在 site-tickets.js 里命中 ' + hit + ' 次（要 1 次）。0 次=脚本会写坏文件，多次=替换区间不确定。');
  }

  /* ③ SEED 内容口径：沙箱加载后逐条查 */
  let seed27 = null;
  try {
    const ctx27 = { window: {} };
    vm.createContext(ctx27);
    vm.runInContext(RAW27['site-tickets.js'], ctx27);
    seed27 = ctx27.window.SITE_TICKETS_SEED || null;
  } catch (e) { F27('site-tickets.js 在沙箱里加载失败：' + e.message + '（SEED 被写成语法错误就是这里先炸）'); }
  if (seed27) {
    const names27 = Object.keys(seed27);
    /* 条数下限取当前实测 9 条：它挡得住「脚本把 SEED 回写成空/残缺」（0-1 的失效形态就是丢条目），
       挡不住「比现在少几条」。15-B 跑完 h 档 381 条后要把它升到 ≥ 300，那时这条才完整。 */
    const SEED_MIN27 = 9;
    if (names27.length < SEED_MIN27)
      F27('SEED 只剩 ' + names27.length + ' 条（下限 ' + SEED_MIN27 + '）：写盘路径把种子写丢了');
    names27.forEach(k => {
      const it = seed27[k];
      if (!/^\d{4}-\d{2}$/.test(it.u || ''))
        F27('SEED[' + k + '].u =「' + it.u + '」不是 YYYY-MM：每条事实必须带核验年月，否则「更新于」那行没有内容可印');
      if (it.p && !/元|免费/.test(it.p))
        F27('SEED[' + k + '].p =「' + it.p + '」是裸数字/无口径票价（必须含「元」或「免费」，票价要带旺季淡季或含不含观光车的口径）');
    });
  }

  /* ④ 代码锚点（空白归一后整串计数） */
  const A27 = [
    ['site-tickets.js', 'var DAY = 30 * 24 * 3600 * 1000;', 1, '缓存 30 天：实时数据不许永久留在本机'],
    ['site-tickets.js', "function lsKey(n) { return 'tn_tk_' + n; }", 1, '缓存键前缀只有一处定义（改前缀要同步 backup 禁入表）'],
    ['site-tickets.js', 'if (!key) return cb(null);', 1, '无 Key 直接放弃，不发请求也不报错'],
    ['site-tickets.js', "Math.abs(loc[0] - (+site.lng || 0)) < 0.2", 1, '同名异地保护·经度那一半（全国同名 POI 一大把，靠坐标挡）'],
    ['site-tickets.js', "Math.abs(loc[1] - (+site.lat || 0)) < 0.2", 1, '同名异地保护·纬度那一半（两条各 1 处，缺一半就是没挡）'],
    ["site-tickets.js", "w(t && t.h ? { h: t.h, p: '', u: now, src: 'amap' } : null)", 1, '实时腿只给营业时间、永远不给票价（高德无票价 API）'],
    ['site-tickets.js', 'cb({ h: seed.h || \'\', p: seed.p || \'\', u: seed.u || \'\', src: \'seed\' })', 1, '种子优先级最高，且带 src 供 UI 标可信等级'],
    ['topic-common.js', "if (!t || (!t.h && !t.p)) { el.style.display = 'none'; return; }", 1, '无数据整行隐藏：不许出现「未收录」占位天天在用户眼前刷负分'],
    ['topic-common.js', 'if (_s0) loadTicket(_s0);', 1, '门票腿真挂在弹层渲染路径上（SiteTickets 只有这一个调用点，摘掉它种子再全也印不出来）'],
    ['topic-common.js', "loadTicket(SITES[curSite]);", 1, '详情异步补齐后刷新面板仍要重走门票腿，否则懒加载页永远空着'],
    ['topic-common.js', "'更新于 '", 1, 'u 的语义是「更新于」（旧文案「核对」读起来像让用户自己去核对）'],
    ['topic-common.js', '人工收录，未标核验时间', 1, '种子缺 u 时的口径（不猜、不留空）'],
    ['topic-common.js', '来自高德，未标核验时间', 1, '缓存/实时缺 u 时的口径（不猜、不留空）'],
    ['topic-common.js', "t.src === 'amap' ? '（高德实时）'", 1, '实时抓来的营业时间要标来源等级，与人工种子分开'],
    ['tools/gen-tickets.js', 'if (!h) return;', 1, '查不到的条目不建空壳、也不抹既有 h（EMPTY 直接跳过）'],
    ['tools/gen-tickets.js', "merged[k] = { h: h, p: '', u: now };", 1, '只有新条目才落 p:\'\'：脚本从网络上拿不到票价，也不许把人工 p 覆盖掉'],
    ['tools/gen-tickets.js', 'if (before.indexOf(SEED_DECL, start + 1) >= 0) die(', 1, '锚点多命中即拒绝写盘（宁可不写，不写坏）'],
    ['tools/gen-tickets.js', "if (hasFlag('--selftest')) runSelftest();", 1, '离线自测常驻：改一次写盘路径就要能不打网络验证它'],
    ['tools/gen-tickets.js', "if (hasFlag('--select')) {", 1, '--select 只报分母不烧配额：跑批量前先知道这批要发多少次请求'],
    ['backup.js', "'tn_tk_',", 1, '门票缓存仍在禁入备份表里（它能重抓，进备份只会把同步体积撑大）'],
    /* 浏览器腿：这一节要钉住 smoke 自己别退化成假闸 */
    ['tools/smoke-tickets.js', "if (s.indexOf('restapi.amap.com') < 0) return real(u);", 1, 'fetch 桩只截高德那一条腿，其余请求照常放行（全截就等于在测桩）'],
    ['tools/smoke-tickets.js', 'T5 无 Key 时零次高德请求', 1, '离线口径靠数调用次数证明，不是读代码'],
    ['tools/smoke-tickets.js', 'T11 未收录景点整行隐藏且行内不出现「元」', 1, '防编造票价的浏览器侧那条'],
    ['tools/smoke-tickets.js', 'T12 实时营业时间缀「（高德实时）」', 1, '来源等级必须真渲染出来'],
    ['tools/smoke-tickets.js', 'el.style.display || getComputedStyle(el).display', 1, '未收录那行的终态要兜 computed：只读 style.display 会永远拿到空串（实测第三次红）'],
    ['tools/smoke-tickets.js', 'window.SITES[+c.dataset.i]', 1, '样本从当页列表现挑：写死站名会挑到该页根本没有的景点（p=sx 里没有大雁塔）'],
  ];
  A27.forEach(a => {
    const [file, needle, want, why] = a;
    /* 静默 return 是这条闸门的假绿灯形状：少写一个文件字段，解构就整体错位，
       锚点表照打条数、实际一条没跑（本批实测抓到「（高德实时）」那条就是这么哑的）。
       哑掉必须出声。 */
    if (a.length !== 4 || typeof needle !== 'string' || typeof want !== 'number') {
      F27('A27 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没写）');
      return;
    }
    if (!(file in SRC27)) { F27('A27 登记了 §27 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt27(SRC27[file], needle);
    if (got !== want) F27(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });

  /* ⑤ 加载顺序：筛选必须在加载 Key 之前（筛选写错不该先撞「本机没密钥」） */
  const pickAt = RAW27['tools/gen-tickets.js'].indexOf('const sites = pick(loadSites());');
  const keyAt = RAW27['tools/gen-tickets.js'].indexOf('const KEY = loadKey();');
  if (pickAt < 0 || keyAt < 0) F27('gen-tickets.js 里找不到「先筛选后加载 Key」的两行（Key 的前置条件被改回主流程开头了？）');
  else if (pickAt > keyAt) F27('gen-tickets.js 的 loadKey() 又跑在 pick() 前面了：无 Key 机器将连筛选分母都自证不了');

  /* ⑥ 期望 0 的锚点配正向对照（旧文案「核对」） */
  const oldNeedle = "'核对'";
  if (cnt27(RAW27['topic-common.js'], '核对') !== 0)
    F27('topic-common.js 里还有「核对」字样（旧文案必须零残留，两处并存等于口径没收口）');
  const OLD27 = flat27("el.innerHTML = x + (t.u ? '<div>' + esc(t.u) + '核对</div>' : '');");
  if (cnt27(OLD27, '核对') < 1) F27('「核对」这条计数器的正向对照失效了（改前形态数不出命中，说明上一行的 0 不是证据）');

  const RD27 = rd27('README.md');
  if (RD27.indexOf('§27') < 0) F27('README.md 的 verify 清单没提 §27（新闸门不写进 README 就等于没装）');
  const DOC27 = rd27('改进实施方案与验收标准.md');
  if (DOC27.indexOf('批次 15') < 0) F27('改进实施方案与验收标准.md 没有「批次 15」这一节（实测数字要落文档，不然下批又从头猜）');

  console.log('门票闸门: ' + A27.length + ' 条代码锚点 + 1 条字面量对账（SEED_DECL ↔ site-tickets.js:6）+ SEED 逐条 u/p 口径（' +
    (seed27 ? Object.keys(seed27).length : 0) + ' 条，下限 ' + 9 + '）+ 先筛选后加载 Key 的顺序 + 旧文案零残留（带正向对照）+ tn_tk_ 禁入仍在；' +
    'README 与方案文档已登记');
  fail += bad27;
}


/* ============ §28 导出日历与打印路书闸门 ============
   批次 16。这一节盯的是两类「手机上只说打不开」的坏法：
   ① ICS 的折行按字符切而不是按 UTF-8 字节切。中文 3 字节/字，`slice(0,75)` 会把一个汉字
      劈成两个非法字节序列 —— 生成的文件在桌面上用编辑器看着一切正常，各家日历一律拒收，
      用户在手机上只看得见「打不开」四个字。这是本批的灵魂条，所以它同时出现在
      函数体抽取（期望 0）和变异自测（mut-verify28 第一条）里。
   ② 打印样式漏在 @media print 外面，等于把手机屏幕上的米白纸底糊到 A4 上；
      独立文档里 var(--fs-*) 从来不解析（theme.css 不在那份 HTML 里），
      所以字号只能写死，屏幕态与打印态各一档。
   方案 §4.4 原文要求「\r\n 与 TextEncoder 必须与 buildTripIcs 同函数体」。落地时折行拆进了
   icsFold（buildTripIcs 只负责拼字段），所以这里改成**按函数各抽一段**做体断言：
   "同函数体"在真实结构里的意思就是"这个函数自己按字节算预算"，抽取断言比原句更严。
   三条坑沿用 §24/§27：needle 里不许出现块注释（flat28 先剥注释）；期望 0 一律配正向对照；
   锚点表必须是四元组，字段少了要出声，不许静默 return。
   含反斜杠的 needle 一律用 String.raw 写：§27 那种手写 `\\\\` 在本批这种密度下必错。
   ============================================================ */
{
  let bad28 = 0;
  const F28 = m => { bad28++; console.log('FAIL §28 导出闸门: ' + m); };
  const flat28 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const cnt28 = (src, needle) => src.split(needle).length - 1;
  const rd28 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const FILES28 = ['planner.js', 'planner.html', 'site-tickets.js', 'design.css', 'tools/smoke-export.js'];
  const SRC28 = {}, RAW28 = {};
  FILES28.forEach(f => {
    if (!fs.existsSync(f)) { F28('缺 ' + f); SRC28[f] = ''; RAW28[f] = ''; return; }
    RAW28[f] = rd28(f);
    SRC28[f] = flat28(RAW28[f]);
  });

  /* 函数体抽取：抽不出=红（不许静默跳过，§27 的哑火形状在这儿同样致命） */
  const fnBody28 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };
  const region28 = (src, from, to) => {
    const a = src.indexOf(from), b = src.indexOf(to);
    return (a >= 0 && b > a) ? src.slice(a, b) : null;
  };

  /* ① 代码锚点（空白归一后整串计数） */
  const A28 = [
    ['planner.js', 'var ICS_FOLD = 75;', 1, '折行预算只有一个定义点（RFC 5545 的 75 字节，改它只能改这一处）'],
    ['planner.js', String.raw`return chunks.join('\r\n ');`, 1, '续行 = CRLF + 一个空格：unfolding 的判据，写成 \n 就是裸 LF'],
    ['planner.js', 'var enc = new TextEncoder()', 1, '预算按 UTF-8 字节算的起点'],
    ['planner.js', 'Array.from(line)', 1, '按码点迭代：😀（代理对）不许被劈开'],
    ['planner.js', 'if (used + b > budget)', 1, '比较用字节数不用字符数（中文 3 字节/字，字符数切必超）'],
    ['planner.js', 'budget = ICS_FOLD - 1', 1, '续行预算要扣掉开头那个空格，否则续行本身就是 76 字节'],
    ['planner.js', 'function icsLine(name, val) { return icsFold(name + \':\' + icsEsc(val)); }', 1, '每条字段都同时过转义与折行（漏一条长 DESCRIPTION 就出界）'],
    ['planner.js', String.raw`function icsStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }`, 1, 'DTSTAMP：toISOString 自带 Z，再拼一个就是本批探针抓到的真 bug'],
    ['planner.js', 'if (!window.SiteTickets) return null;', 1, '门票模块缺席时安静放弃，导出日历不许因此抛异常'],
    ['planner.js', 'var got = null, returned = false;', 1, '只取同步命中的两行状态（异步高德腿不该被等）'],
    ['planner.js', 'returned = true;', 1, '回调后置位＝异步迟到的那份数据丢弃，导出按钮不挂在网络上'],
    ['planner.js', 'if (!d0 || !days.length) return null;', 1, '没有出发日期就没有事件：绝不落回 1970，也不拿 createdAt 顶替'],
    ['planner.js', "var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//行迹 TRACE//行程规划//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];", 1, '日历级四个必需字段整串钉死（拆成四条锚会漏顺序）'],
    ['planner.js', "'DTSTART;VALUE=DATE:' + icsDay(from)", 1, '全天事件起始：日期值形式，绕开 VTIMEZONE 整块复杂度'],
    ['planner.js', "'DTEND;VALUE=DATE:' + icsDay(to)", 1, '全天事件结束（DTSTART 有而它没有＝各家日历对"含末"解释不一致）'],
    ['planner.js', String.raw`return L.join('\r\n') + '\r\n';`, 1, '行结束符 CRLF + 末尾留一个（部分解析器靠它收最后一行）'],
    ['planner.js', 'toast(\'要先在规划页选出发日期，日历事件才有日期\');', 1, '空日期那条要给真话，不许静默按钮无反应'],
    ['planner.js', "var fname = icsFileSafe(t.name) + '.ics';", 1, '文件名过 icsFileSafe（行程名里的 / 会被当路径分隔符）'],
    ['planner.js', String.raw`saveTextDoc(fname, ics, 'text/calendar;charset=utf-8'`, 1, '浏览器腿的 MIME 必须是 text/calendar（壳侧 text/html 那条另记阻塞）；批次 19 把通道抽成 saveTextDoc 后，这条锚按调用形状重钉，MIME 仍逐字在位'],
    ['planner.js', 'window.__tnSaveDone = function (r) {', 1, 'APK 腿读真实回吐：err / need_perm / 成功三种真话，不假装成功'],
    ['planner.js', "' style=\"opacity:.55\"'", 1, '灰态用 opacity 不用 disabled（下面 design.css 那条锚就是原因）'],
    ['planner.js', 'var icsOn = !!buildTripIcs(trip);', 1, '按钮置灰判据与"能否真生成"同一个函数，不许两套口径'],
    ['planner.js', "startDate: state.startDate, aiLevel: getAILevel(), travelBy: modeOf(travelByNow()), days: buildAiDays(", 1, 'AI 路线那条行程要带上已选出发日期'],
    ['planner.js', "state.startDate = '';", 1, '抹日期只许在重置路径这一处（AI 路径以前也抹，日卡天气/季节提醒/导出日历三样同时失效）'],
    ['planner.js', "'@page{margin:14mm}'", 1, '分页边距只在分页介质下起作用，放顶层不动屏幕态'],
    ['planner.js', "'@media print{'", 1, '打印样式必须圈在 media 查询里（漏出去＝手机屏幕上那层纸色底被改死）'],
    ['planner.js', '.daycard{break-inside: avoid}', 1, '一天一包的分页锚点'],
    ['planner.js', 'body{max-width:none;margin:0;padding:0;color:#000;background-color:#fff;font-size:10.5pt;line-height:1.6}', 1, '打印态正文字号必须是 pt：px 会吃手机「加大字号」把 A4 排版撑坏；background 必须用 -color 形式（§23 那条简写会复位 --grain-page）'],
    ['planner.js', 'font-size:17px;border-left:3px solid #AE5738', 1, '屏幕态字号写死：独立文档里 var(--fs-*) 从来没解析成功过'],
    ['planner.js', "h += '<div class=\"daycard\">';", 1, '路书真把每天包进 .daycard（没包上面那条 CSS 就是空转）'],
    ['planner.html', '<script src="site-tickets.js"></script>', 1, '规划页要引进门票模块，否则 icsTicket 永远走缺席分支、日历里一行事实都没有'],
    ['site-tickets.js', 'if (!key) return cb(null);', 1, '无 Key 必须**同步** cb(null)：planner 侧只等同步命中靠的就是这条'],
    ['design.css', '.btn:disabled', 1, 'pointer-events:none 在这——导出日历灰态改用 opacity 的原因，改成 disabled 会把点击吃掉'],
    ['tools/smoke-export.js', 'Buffer.byteLength(s, \'utf8\')', 1, '校验器的行长一律按字节：String.length 在这里一律不算数'],
    ['tools/smoke-export.js', "emulateMediaType('print')", 1, 'puppeteer 25 的打印介质 API 名（写成 emulateMedia 会抛 not a function，异常把整段报告吃掉）'],
    ['tools/smoke-export.js', "querySelectorAll('.ui-toast')", 1, 'toast 要聚合读：页面同时挂着 boot 那条，只读第一条量的是队列顺序'],
    ['tools/smoke-export.js', 'restapi.amap.com', 1, 'E6 单独数高德腿（天气那条本来会去够 open-meteo，两件事不许混计数）'],
    ['tools/smoke-export.js', "SiteTickets.get({ name: '晋祠'", 1, 'V8 的期望串向产品自己的门票模块现取再独立转义，不硬编码种子文案'],
    ['tools/smoke-export.js', 'V11 折行真发生了，且 unfolding（去掉 CRLF+一个空格）能逐字节还原', 1, '折行必须同时验"发生了"和"能还原"，只验前者会把截断当折行放过去'],
  ];
  A28.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F28('A28 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没写）');
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in SRC28)) { F28('A28 登记了 §28 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt28(SRC28[file], needle);
    if (got !== want) F28(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A28.length < 39) F28('锚点表被削减：' + A28.length + ' 条（批次 16 落地时实测 39 条，整组删掉就等于这节没了）');

  /* ② 函数体断言：本批的灵魂在这里——「按字符切」是唯一会静默坏掉的写法 */
  const foldBody = fnBody28(SRC28['planner.js'], 'function icsFold(line)');
  if (!foldBody) F28('抽不出 icsFold 函数体（改名/内联进 buildTripIcs 都会让这一整套体断言哑掉）');
  else {
    [['new TextEncoder()', '折行必须自己按字节算预算'],
     ['Array.from(', '必须按码点走，代理对不许劈开'],
     [String.raw`'\r\n '`, '续行分隔符必须在折行函数里']].forEach(n => {
      if (cnt28(foldBody, n[0]) < 1) F28('icsFold 体里找不到「' + n[0] + '」：' + n[1]);
    });
    /* 期望 0：字符切片。正向对照用改前形态（自己造，不吃真源） */
    if (cnt28(foldBody, '.slice(') !== 0)
      F28('icsFold 体里出现了 .slice( —— 按字符下标切就是本批要挡的那条：中文会被劈成非法字节序列，日历拒收而桌面看不出来');
    const CTRL = flat28('function icsFold(line) { return line.slice(0, 75); }');
    if (cnt28(CTRL, '.slice(') < 1) F28('「.slice(」这条期望 0 的正向对照失效了（造出来的改前形态都数不出命中，上面那个 0 不是证据）');
  }

  const icsBody = fnBody28(SRC28['planner.js'], 'function buildTripIcs(trip)');
  if (!icsBody) F28('抽不出 buildTripIcs 函数体');
  else {
    if (cnt28(icsBody, String.raw`'\r\n'`) < 1) F28('buildTripIcs 体里没有 CRLF 字面量（行结束符不是它自己写的，就是漏到某个 join 上了）');
    if (cnt28(icsBody, 'VALUE=DATE') !== 2) F28('buildTripIcs 体里 VALUE=DATE 命中 ' + cnt28(icsBody, 'VALUE=DATE') + ' 次（要 2：DTSTART 与 DTEND 各一处，缺一半就是没有结束日）');
    if (cnt28(icsBody, 'VTIMEZONE') !== 0) F28('buildTripIcs 里出现了 VTIMEZONE：全天事件不需要时区块，带上它＝多一个各家日历解释不一致的面');
    if (cnt28(icsBody, 'return null') !== 1) F28('buildTripIcs 的空事件出口不是 1 处（要么日期守卫被改软，要么多了一条静默返回）');
    const CTRL2 = flat28('function buildTripIcs(t) { return null; }');
    if (cnt28(CTRL2, 'return null') < 1) F28('「return null」计数失效：正向对照数不出命中');
  }

  const docRegion = region28(SRC28['planner.js'], 'function docShell(name, body)', 'function saveHtmlDoc(name, html)');
  if (!docRegion) F28('抽不出 docShell 区段（改名或把样式搬出去都会让这一组断言哑掉）');
  else {
    if (cnt28(docRegion, '@media print') !== 1) F28('docShell 里 @media print 命中 ' + cnt28(docRegion, '@media print') + ' 次（要 1）');
    if (cnt28(docRegion, 'var(--fs-') !== 0)
      F28('docShell 里还在吃 var(--fs-*)：那份独立 HTML 不带 theme.css，这些变量从来没解析成功过（导出的路书字号一直是 body 字号兜底）');
    const CTRL3 = flat28('h2{font-size:var(--fs-8)}');
    if (cnt28(CTRL3, 'var(--fs-') < 1) F28('「var(--fs-」这条期望 0 的正向对照失效了');
    if (cnt28(docRegion, 'background-color:#fff') !== 1) F28('docShell 打印态没把底色退回纯白（纸上不铺底色那条退了）；写成 background:#fff 也会被这里抓到——简写会复位 --grain-page，§23 有条同样的线');
  }

  /* ③ ICS 区段整体不许用跟随系统语言的日期格式 */
  const icsRegion = region28(SRC28['planner.js'], 'var ICS_FOLD = 75;', 'function docShell(name, body)');
  if (!icsRegion) F28('抽不出批次 16 的 ICS 区段（ICS_FOLD 或 docShell 的锚点串被改了）');
  else {
    if (cnt28(icsRegion, 'toLocaleDateString') !== 0 || cnt28(icsRegion, 'toLocaleString') !== 0)
      F28('ICS 区段里出现了 toLocale* 日期格式：那跟着系统语言走，同一份行程在两台手机上会生成两个不同的文件（日期一律走 dayDate + icsDay）');
    const CTRL4 = flat28("new Date(t.createdAt).toLocaleDateString()");
    if (cnt28(CTRL4, 'toLocaleDateString') < 1) F28('「toLocaleDateString」这条期望 0 的正向对照失效了');
    if (cnt28(icsRegion, 'dayDate(') < 4) F28('ICS 区段里 dayDate( 只有 ' + cnt28(icsRegion, 'dayDate(') + ' 次（逐日日期必须全部经它，它已经管好了 +di 与非法值）');
  }

  /* ④ 顺序：planner.html 里门票模块必须在 planner.js 之前到（icsTicket 判的是 window.SiteTickets 在不在） */
  const H28 = RAW28['planner.html'];
  const tkAt = H28.indexOf('site-tickets.js'), plAt = H28.indexOf('planner.js');
  if (tkAt < 0 || plAt < 0) F28('planner.html 里找不到 site-tickets.js 或 planner.js 的 script 标签');
  else if (tkAt > plAt) F28('planner.html 的 site-tickets.js 排到了 planner.js 后面：导出日历时会撞 !window.SiteTickets 那条缺席分支，日历里一行事实都不会有');

  /* ⑤ 转义顺序：反斜杠必须第一个补，否则 \\, 会被后续步骤二次转义成 \\\\, */
  const escBody = fnBody28(SRC28['planner.js'], 'function icsEsc(v)');
  if (!escBody) F28('抽不出 icsEsc 函数体');
  else {
    const iB = escBody.indexOf(String.raw`.replace(/\\/g`), iS = escBody.indexOf('.replace(/;/g'), iC = escBody.indexOf('.replace(/,/g');
    if (iB < 0 || iS < 0 || iC < 0) F28('icsEsc 里 \\ ; , 三个转义少了一个（命中位置：' + iB + '/' + iS + '/' + iC + '）');
    else if (!(iB < iS && iS < iC)) F28('icsEsc 的转义顺序变了：反斜杠必须最先补，否则已转义的 \\, 会被再补一层');
    if (cnt28(escBody, String.raw`'\\n'`) < 1) F28('icsEsc 没把换行折成 \\n（DESCRIPTION 里的多行靠它，直接留裸 LF 会提前结束这一行）');
  }

  const RD28 = rd28('README.md');
  if (RD28.indexOf('§28') < 0) F28('README.md 的 verify 清单没提 §28（新闸门不写进 README 就等于没装）');
  const DOC28 = rd28('改进实施方案与验收标准.md');
  if (DOC28.indexOf('批次 16') < 0) F28('改进实施方案与验收标准.md 没有「批次 16」这一节（实测数字要落文档，不然下批又从头猜）');

  console.log('导出闸门: ' + A28.length + ' 条代码锚点 + 4 组函数体/区段抽取（icsFold 字符切片期望 0 为本批灵魂）+ ICS 区段 toLocale* 零残留 + ' +
    'html 加载顺序 + icsEsc 转义顺序；每条期望 0 都配了正向对照；README 与方案文档已登记');
  fail += bad28;
}



/* ============ §29 行前清单闸门（批次 17-A/B） ============
   这一节盯三种「今天看着好、下次刷新就坏」的坏法：
   ① 阈值漂移。ELEV_HIGH/MID/LOW 与两组月份是规则表的骨架，一旦有人「顺手把 3000 改成 2500」
      而不动这条锚，预填条目会整批改口却没有任何一处会说红。所以四条阈值各钉一条整串锚。
   ② 重算洗掉勾选。syncAuto 每次进结果页都跑，它的权力边界是「只拥有 by==='auto' 那一半」：
      用户条目原样留下、已勾状态靠 doneMap 收回、数据没到齐时 prune 必须传 false。
      这三条各有一根整串锚，外加 ckId 体断言（id 绝不能掺时间戳——掺了就不幂等，
      每次刷新算出不同 id，两台机的并集去重和 doneMap 同时失效）。
   ③ 新增页面/脚本忘进离线壳。checklist.html 这次是「页面进了 SHELL、两个 js 没进」的形状
      （生成器的 CORE_JS 是手抄名单），所以下面 ③ 做**双向反向对账**：磁盘页面 ↔ SHELL、
      SHELL ↔ 磁盘、每个页面的本地 <script>/<link> 依赖 ↔ SHELL，三个方向都走真实磁盘列表，
      不手抄清单。§21 的字体段、§28 的 M37/M38 是同一事故形状的两次前科。
   口径沿用 §24/§27/§28：四元组形状不整即红；期望 0 一律配正向对照；锚点串不许落在块注释里。
   .html 的视图只归一空白、**不剥注释**——页面里的 CSS/JS 片段是字符串字面量，注释里只要出现一个
   块注释闭合符，剥注释的匹配器就会从更早的那个开注释符一路吃到页面底部，把整段 <script> 连同
   结构一起吞掉（本批实测：吞完 'checklist.js' 命中数从 1 变 0，页面结构在闸门眼里整个消失）。
   ============================================================ */
{
  let bad29 = 0;
  const F29 = m => { bad29++; console.log('FAIL §29 行前清单闸门: ' + m); };
  const ws29 = s => s.replace(/\s+/g, ' ').trim();
  const flat29 = s => ws29(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt29 = (s, n) => s.split(n).length - 1;
  const rd29 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view29 = f => /\.html$/.test(f) ? ws29(rd29(f)) : flat29(rd29(f));

  const FILES29 = ['checklist.js', 'checklist.html', 'planner.js', 'planner.html', 'design.css',
    'backup.js', 'sw.js', 'README.md', '改进实施方案与验收标准.md', 'tools/smoke-checklist.js', 'tools/gen-sw-shell.cjs'];
  const V29 = {};
  FILES29.forEach(f => {
    if (!fs.existsSync(f)) { F29('缺 ' + f); V29[f] = ''; return; }
    V29[f] = view29(f);
  });

  /* 函数体抽取（与 §28 同一套：抽不出=红，不许静默跳过） */
  const fnBody29 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };

  /* ① 代码锚点 */
  const A29 = [
    ['checklist.js', "var KEY = 'tn_checklist';", 1, '存储键只有一个定义点；改键名等于把所有人的清单清零，必须过这道'],
    ['checklist.js', "var CATS = ['证件', '衣物', '健康', '装备', '预约', '其他'];", 1, '分类枚举单点（catRank 与 UI 的分组都读它，加一类只能改这一行）'],
    ['checklist.js', 'var ELEV_HIGH = 3000, ELEV_MID = 2000, ELEV_LOW = 1000;', 1, '三个海拔阈值同处定义：阈值是建议的骨架，微调必须同时动这条锚，不许在规则里写裸数字'],
    ['checklist.js', 'var MON_RAIN = [6, 7, 8];', 1, '雨季月份窗口单点（折叠伞/驱蚊液两条只看它，改它=改全表文案的触发条件）'],
    ['checklist.js', 'var MON_COLD = [11, 12, 1, 2, 3];', 1, '冷季月份窗口单点（羽绒/暖手宝/防滑鞋三条）'],
    ['checklist.js', "if (!s || s.indexOf('全年') >= 0) return [];", 1, '「全年」= 没有季节信息，必须返回空集：返回 1..12 会把每个季节规则都点亮'],
    ['checklist.js', 'var em = new Date(+startDate.slice(0, 4), sm - 1, d + (n - 1)).getMonth() + 1;', 1, '行程月份末日按真实日历算：7-31 出发玩 3 天要跨进 8 月，起始月+天数会漏掉跨月'],
    ['checklist.js', "return 'c' + h.toString(36);", 1, '条目 id＝tripId+text 散列（FNV），这是 syncAuto 幂等与两台机并集去重的地基'],
    ['checklist.js', "done: doneMap[id] || 0", 1, '重算必须把已勾状态从旧条目收回来，否则刷新一次掉一半进度'],
    ['checklist.js', "if (x.tripId !== tripId || x.by !== 'auto') return true;", 1, '重算只拥有 auto 那一半：用户条目原样留下'],
    ['checklist.js', 'prune = prune !== false;', 1, '剪枝默认开、调用方显式传 false 才不剪（数据没到齐时剪＝把上一轮建议连勾选一起删）'],
    ['checklist.js', 'var quote = [d.best, t && t.h, t && t.p].filter(function (x) { return x && /预约/.test(x); })[0] || \'\';', 1, '「原文」必须自己就含触发词：先在 p+h 拼接串上判命中再挑 p 整串印出去，只有 h 写着「需预约」的站点就会把一句票价当预约依据印到清单上（建议没错，依据是假的；smoke-checklist C27 从运行时对账）'],
    ['checklist.js', "if (!tripId || !t) return null;", 1, '空文本/无行程不产条目，也不产孤儿桶'],
    ['checklist.js', "catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，行前清单本次未保存成功'); return false; }", 1, 'LS 写满要说真话：静默 return false 会让用户以为勾上了'],
    ['planner.js', 'Checklist.syncAuto(tid, pretripInput(), factsSettled());', 1, '结果页「出发前」卡是 auto 组唯一生长点，第三参是分省数据到货守卫（写成常量 true 就是本批要挡的）'],
    ['planner.js', 'if (removed && removed.id && window.Checklist) Checklist.clearTrip(removed.id);', 1, '删行程要连带清桶：孤儿桶会无界攒在 localStorage 里（这条是 clearTrip 的唯一调用点，零调用者=能力没接）'],
    ['planner.js', "location.href = 'checklist.html?trip=' + encodeURIComponent(ensureTripId(trip));", 1, '入口跳转带 trip 参数并过编码（行程名里的 & 会劈开查询串）'],
    ['planner.html', 'pretripCard', 1, '结果页那张卡的容器 id 还在（planner.js 判 !box 就整段静默不渲染）'],
    ['backup.js', "{ k: 'tn_checklist', g: 'data', m: 'id' },", 1, '清单键必须进 KEYS，且合并语义是 id 并集：分桶对象只能整桶择优，两台机各补几条会被覆盖掉一半（§16 已经保证代码与文档字段表逐键相等，这条钉这个具体键）'],
    ['checklist.html', '<script src="checklist.js"></script>', 1, '页面引到数据层（漏了就是 window.Checklist undefined，整页白卡）'],
    ['checklist.html', 'class="ckbox', 1, '勾选框用 design.css 的共享组件类，不在本页另起一套'],
    ['design.css', '.ckbox{', 1, '勾选样式定义点恰 1 处（下面 ④ 要求除它以外全站 0 处）'],
    ['design.css', '.ckbox.on{', 1, '已勾态单点'],
    ['sw.js', "'./checklist.html'", 1, '清单页在离线壳里：不在的话离线打开＝一条网络请求'],
    ['tools/gen-sw-shell.cjs', "'share.js', 'checklist.js', 'ticketbox.js'", 1, '生成器的 CORE_JS 名单必须含两个新模块：漏列的话跑一次生成器就把它们从 SHELL 抹掉（§21 字体段、§28 M37/M38 同形状）。名单结尾的 ] 不钉——后续批次会往后追加（批次 24 追加了 expense-form.js），钉住结尾就是给自己埋一条必漂移的锚'],
    ['tools/smoke-checklist.js', "[].slice.call(document.querySelectorAll('.ui-toast')).pop()", 3, '浏览器腿的 toast 采样取栈尾：toast 是堆叠的，读第一条量到的是队列顺序（本批 B16 就是这么假红过一次）'],
  ];
  A29.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F29('A29 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没写）');
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V29)) { F29('A29 登记了 §29 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt29(V29[file], needle);
    if (got !== want) F29(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A29.length < 26) F29('锚点表被削减：' + A29.length + ' 条（批次 17 落地时实测 26 条，整组删掉就等于这节没了）');

  /* ② ckId 体断言：本节的灵魂。id 掺进时间戳＝syncAuto 不再幂等，doneMap 与两台机并集同时失效，
        而它在单机上看着完全正常（每次刷新条目一样，只是 id 每轮都换） */
  const ckBody = fnBody29(V29['checklist.js'], 'function ckId(tripId, text)');
  if (!ckBody) F29('抽不出 ckId 函数体（改名或内联进 syncAuto 都会让这条断言哑掉）');
  else {
    if (cnt29(ckBody, '2166136261') !== 1) F29('ckId 体里没有 FNV 初值 2166136261（散列被换掉＝同一句话两台机两个 id，并集去重失效）');
    if (cnt29(ckBody, 'Date.now') !== 0)
      F29('ckId 体里出现了 Date.now：条目 id 掺时间戳会让 syncAuto 每轮算出新 id，已勾状态与跨设备并集一起失效');
    const CTRL29 = flat29('function ckId(tripId, text) { return "c" + tripId + Date.now(); }');
    if (cnt29(CTRL29, 'Date.now') < 1) F29('「Date.now」这条期望 0 的正向对照失效了（造出来的改前形态都数不出命中，上面那个 0 不是证据）');
  }

  /* ③ html ↔ SHELL 双向反向对账：三个方向都向磁盘取真名单，不手抄 */
  const SW29 = rd29('sw.js');
  const shellM = SW29.match(/var SHELL = \[([\s\S]*?)\];/);
  if (!shellM) F29('sw.js 里抽不出 var SHELL = [...] 块（下面整组反向对账会哑掉）');
  else {
    const items = (shellM[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
    const has = p => items.indexOf(p) >= 0;
    const pages = fs.readdirSync('.').filter(f => /\.html$/.test(f) && !/^(test-|icons-demo)/.test(f)).sort();
    let htmlIn = 0;
    pages.forEach(p => {
      if (p === 'index.html') { if (!has('./')) F29('SHELL 缺首页条目 ./（生成器把 index.html 写成 ./，改写法＝首屏离线直连网络）'); return; }
      htmlIn++;
      if (!has('./' + p)) F29('磁盘上有 ' + p + '，SHELL 没列它：离线打开这一页会走网络（新增页面忘跑 node tools/gen-sw-shell.cjs）');
    });
    items.filter(x => /^\.\/.+\.html$/.test(x)).forEach(x => {
      if (!fs.existsSync(x.replace('./', ''))) F29('SHELL 列了 ' + x + '，磁盘上没有这个页面（addAll 会整批 reject，预缓存静默全丢）');
    });
    /* 页面依赖：每个 html 引的本地 js/css 都必须在 SHELL 里 */
    let depN = 0;
    const depMiss = [];
    pages.concat(['index.html']).forEach(p => {
      const html = rd29(p);
      const tags = (html.match(/<script[^>]+src="[^"]+"/g) || []).map(t => t.replace(/.*src="/, '').replace(/".*/, ''))
        .concat((html.match(/<link[^>]+href="[^"]+\.css"[^>]*>/g) || []).map(t => t.replace(/.*href="/, '').replace(/".*/, '')));
      tags.forEach(src => {
        if (/^([a-z]+:|\/\/|\.\.\/)/i.test(src)) return;   /* 外部脚本与绝对地址不归壳管 */
        depN++;
        if (!has('./' + src)) depMiss.push(p + ' → ' + src);
      });
    });
    depMiss.forEach(m => F29('页面依赖没进 SHELL：' + m + '（本批 checklist.js/ticketbox.js 就是这个形状——页面进了壳、脚本没进）'));
    if (items.length < 150) F29('SHELL 只剩 ' + items.length + ' 项（生成器跑出来 150 项；数量掉这么多说明有分组被抹）');
    console.log('  · 反向对账：磁盘页面 ' + pages.length + ' 个 · SHELL 内 html ' + htmlIn + ' 条 · 页面本地依赖 ' + depN + ' 处（缺失 ' + depMiss.length + '）· SHELL 共 ' + items.length + ' 项');
  }

  /* ④ 期望 0：勾选样式单点 + 页面不许自己摸 LS */
  const htmlFiles = fs.readdirSync('.').filter(f => /\.html$/.test(f));
  htmlFiles.forEach(f => {
    const s = ws29(rd29(f));
    if (cnt29(s, '.ckbox{') !== 0) F29(f + ' 里自己声明了 .ckbox{：勾选样式必须在 design.css 单点收口（第三种 .ck 变体就是从这里长出来的）');
    if (f === 'checklist.html' && cnt29(s, 'localStorage.setItem') !== 0)
      F29('checklist.html 里出现 localStorage.setItem：清单写盘只许走 Checklist.save，页面自己摸 LS 会绕过合并语义与容量告警');
  });
  const CTRL29B = ws29('<style>.ckbox{width:20px}</style>');
  if (cnt29(CTRL29B, '.ckbox{') < 1) F29('「.ckbox{」这条期望 0 的正向对照失效了');

  if (V29['README.md'].indexOf('§29') < 0) F29('README.md 的 verify 清单没提 §29（新闸门不写进 README 就等于没装）');
  if (V29['改进实施方案与验收标准.md'].indexOf('`tn_checklist`') < 0) F29('改进实施方案与验收标准.md 的字段表没有 tn_checklist 这一行（§16 会要求代码与文档逐键相等）');

  console.log('行前清单闸门: ' + A29.length + ' 条代码锚点 + ckId 体断言（Date.now 期望 0 为本节灵魂）+ html↔SHELL 双向反向对账 + 勾选样式单点/页面不摸 LS 两组期望 0（各配正向对照）');
  fail += bad29;
}

/* ============ §30 「我的票」票据卡闸门（批次 17-C） ============
   三条边界（docs/功能完善实施方案-2026-10-05.md §5.3）里，只有 ②③ 是能被源码锚住的：
   ② 附件只进 IndexedDB ⇒ 永远不进 backup.js KEYS。这是**能力边界**，用户换机时附件不会跟过去，
      UI 必须把这句话说出来（锚在 checklist.html 文案上），而闸门要锚的是「它确实进不了备份」：
      backup.js 里 'trace-attachments' 期望 0，且票据侧三个文件里 localStorage.setItem 期望 0
      ——只要数据不落 LS，§16 的白名单采集就物理性地碰不到它，比"记得别登记"可靠。
   ③ 提醒只有页内横幅一条腿，禁止系统推送：new Notification / showNotification / requestPermission
      在**全站产品代码**（注释已剥掉）期望 0。桌面小组件那条腿要改壳重打包，登记为「本批不做」。
   另两组是收口本身的形状：
   ④ 提醒位单点——UI.nudge 一个定义 + design.css 一份样式（.ui-nudge{ 全站 1 处、cssText 内联 0 处），
      「距离触发的想去打卡条」和「时间触发的票据条」共用同一个组件，否则两条会叠在同一位置；
   ⑤ 压缩档单点——800 / 0.72 只允许出现在 UI.compressImage 里（票据附件与随手记照片同一把尺子），
      ticketbox.js 里两个数字各期望 0。
   口径同 §28/§29：四元组守卫、期望 0 配正向对照、锚点串不落块注释、.html 只归一空白。
   ============================================================ */
{
  let bad30 = 0;
  const F30 = m => { bad30++; console.log('FAIL §30 票据卡闸门: ' + m); };
  const ws30 = s => s.replace(/\s+/g, ' ').trim();
  const flat30 = s => ws30(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt30 = (s, n) => s.split(n).length - 1;
  const rd30 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view30 = f => /\.html$/.test(f) ? ws30(rd30(f)) : flat30(rd30(f));

  const FILES30 = ['ticketbox.js', 'ui.js', 'wishlist.js', 'design.css', 'checklist.html', 'index.html',
    'backup.js', 'sw.js', 'README.md', 'tools/gen-sw-shell.cjs', 'tools/smoke-ticketbox.js'];
  const V30 = {};
  FILES30.forEach(f => {
    if (!fs.existsSync(f)) { F30('缺 ' + f); V30[f] = ''; return; }
    V30[f] = view30(f);
  });

  const A30 = [
    ['ticketbox.js', "var DB_NAME = 'trace-attachments', DB_VER = 1, STORE = 'attachments';", 1, '库名/版本/store 名单点（改名＝老票夹静默打不开，只有这一处能定名）'],
    ['ticketbox.js', "d.createObjectStore(STORE, { keyPath: 'id' }).createIndex('byTrip', 'tripId');", 1, 'onupgradeneeded 里建 store + byTrip 索引：list(tripId) 靠索引取，缺索引会退化成全表扫'],
    ['ticketbox.js', "var KINDS = ['机票', '车票', '酒店', '门票', '其他'];", 1, 'kind 白名单单点；put() 对表外的值兜底成「其他」，UI 的 chip 与数据层读同一个数组'],
    ['ticketbox.js', 'var MAX_ATT = 12;', 1, '每行程附件张数上限（配额保护：一沓 800px 截图不能悄悄吃掉这台机）'],
    ['ticketbox.js', 'var MAX_RAW = 8 * 1024 * 1024;', 1, 'PDF 不压缩所以要有单张天花板（拒收那条文案在 smoke-ticketbox 里有独立断言）'],
    ['ticketbox.js', 'var SOON = 24 * 3600 * 1000;', 1, '「快要用了」窗口只有一个定义点'],
    ['ticketbox.js', "t.oncomplete = function () { d.close(); res(out && 'result' in out ? out.result : undefined); };", 1, 'IDB 房规：每个事务完成即 close（不 close 会把后续 deleteDatabase/别的连接吊死，本批闸门就在这一点上挂过一次）'],
    ['ticketbox.js', 'UI.compressImage(', 1, '压缩档必须复用 UI 那把尺子，本文件不许自己写 800/0.72（下面两条期望 0 钉的就是它）'],
    ["ticketbox.js", "if (!r.title && !r.code && !r.blob) return Promise.resolve(null);", 1, '三样全空不产幽灵票'],
    ['ticketbox.js', "location.href = 'checklist.html?trip=' + encodeURIComponent(hit.tripId);", 1, '横幅点下去回这趟行程的清单页，参数过编码'],
    ['ui.js', 'function nudge(o)', 1, '页内横幅组件单点定义'],
    ['ui.js', 'nudge: nudge', 1, '组件已导出（没导出＝各页又回去手写一条内联 cssText）'],
    ['ui.js', 'function compressImage(dataUrl, cb)', 1, '压缩档单点定义'],
    ['ui.js', 'var max = 800,', 1, '长边尺子只有一个定义点'],
    ['ui.js', "cb(cv.toDataURL('image/jpeg', 0.72));", 1, 'jpeg 质量只有一个定义点'],
    ['design.css', '.ui-nudge{', 1, '横幅样式定义点恰 1 处（下面 ④ 要求 cssText 全站 0 处）'],
    ['design.css', '--z-nudge', 2, '提醒层令牌：定义 + 消费各 1 处，不许在样式里写裸 9500'],
    ['checklist.html', '<script src="ticketbox.js"></script>', 1, '票卡所在页引到数据层'],
    ['index.html', 'if(window.TicketBox && TicketBox.nudge) TicketBox.nudge();', 1, '首页挂了票据提醒腿（这行零调用者＝「24h 横幅」这条能力等于没接）'],
    ['wishlist.js', 'UI.nudge', 1, '想去打卡条也走同一组件（两条提醒叠在同一位置就是这么长出来的）'],
    ['sw.js', "'./ticketbox.js'", 1, '数据层在离线壳里'],
    ['tools/smoke-ticketbox.js', 'try { new Notification(', 1, '浏览器腿自己带 Notification 正向对照探针（没有它，「计数为 0」永远为真）'],
  ];
  A30.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F30('A30 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V30)) { F30('A30 登记了 §30 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt30(V30[file], needle);
    if (got !== want) F30(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A30.length < 22) F30('锚点表被削减：' + A30.length + ' 条（批次 17 落地时实测 22 条）');

  /* ② 全站期望 0：系统推送一根线都不许碰（扫描范围＝根目录全部产品 js/html，注释已剥） */
  const NOTIF = ['new Notification', 'showNotification', 'requestPermission'];
  const productFiles = fs.readdirSync('.').filter(f => /\.js$|\.html$/.test(f));
  let notifHits = 0;
  productFiles.forEach(f => {
    const s = view30(f);
    NOTIF.forEach(n => {
      const c = cnt30(s, n);
      if (c) { notifHits += c; F30(f + ' 里出现「' + n + '」' + c + ' 次：提醒只有页内横幅一条腿，系统推送要先改壳重打包（§5.3 边界③）'); }
    });
  });
  const CTRL30 = flat30('var a = new Notification("x"); var b = reg.showNotification("x"); Notification.requestPermission(function () {});');
  NOTIF.forEach(n => {
    if (cnt30(CTRL30, n) < 1) F30('「' + n + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 附件进不了备份：两个方向同时钉（不在 LS ⇒ §16 白名单物理性采不到；不进 KEYS ⇒ 登记面没被污染） */
  if (cnt30(V30['backup.js'], 'trace-attachments') !== 0)
    F30('backup.js 里出现了 trace-attachments：票据附件不能进云备份（它存的是别人的行程凭证，且 IDB 采集器根本不在备份路径里）');
  if (cnt30(V30['backup.js'], "'attachments'") !== 0)
    F30('backup.js 里出现了 attachments：同上');
  const CTRL30B = flat30("{ k: 'trace-attachments', g: 'data', m: 'whole' },");
  if (cnt30(CTRL30B, 'trace-attachments') < 1) F30('「trace-attachments」这条期望 0 的正向对照失效了');
  ['ticketbox.js', 'checklist.html'].forEach(f => {
    if (cnt30(V30[f], 'localStorage.setItem') !== 0)
      F30(f + ' 里出现 localStorage.setItem：附件/票据一律走 IndexedDB，落 LS 就等于落进备份采集面');
  });
  if (cnt30(V30['ticketbox.js'], 'sessionStorage') !== 2)
    F30('ticketbox.js 里 sessionStorage 命中 ' + cnt30(V30['ticketbox.js'], 'sessionStorage') + ' 次（要 2：读一次 + 写一次「本会话已提醒」，跨会话不轰炸但换会话会重提，这个口径要看得见）');

  /* ④ 提醒位单点：样式只能有一份，内联 cssText 一律 0 */
  if (cnt30(V30['ui.js'], 'cssText') !== 0) F30('ui.js 里出现 cssText：横幅样式必须在 design.css 单点定义，内联会让两条提醒各长一套皮肤');
  ['wishlist.js', 'ticketbox.js', 'checklist.html'].forEach(f => {
    if (cnt30(V30[f], 'cssText') !== 0) F30(f + ' 里出现 cssText：提醒样式必须在 design.css 单点收口');
  });
  fs.readdirSync('.').filter(f => /\.html$/.test(f)).forEach(f => {
    if (cnt30(ws30(rd30(f)), '.ui-nudge{') !== 0) F30(f + ' 里自己声明了 .ui-nudge{：提醒样式必须在 design.css 单点收口');
  });

  /* ⑤ 压缩档魔法数不得二次出现（尺子单点在 ui.js，上面两条锚已钉死它的定义）。
     范围只取票据侧两个文件：wishlist.js 里那个 800 是「附近想去」的米数半径，与照片档位无关，
     把它拉进来就是拿一条同名数字冒充另一条的守卫。 */
  ['ticketbox.js', 'checklist.html'].forEach(f => {
    ['800', '0.72'].forEach(n => {
      if (cnt30(V30[f], n) !== 0) F30(f + ' 里出现魔法数 ' + n + '：随手记照片与票据附件必须同一把尺子，两处各写一档迟早一升一降');
    });
  });

  /* ⑥ 能力边界要说给用户听（附件不进云备份这句必须印在票卡上） */
  if (cnt30(V30['checklist.html'], '不进云备份') !== 1)
    F30('checklist.html 票卡没把「附件不进云备份」说出来（换机丢票据是用户必须提前知道的能力边界，不是实现细节）');

  if (V30['README.md'].indexOf('§30') < 0) F30('README.md 的 verify 清单没提 §30（新闸门不写进 README 就等于没装）');

  console.log('票据卡闸门: ' + A30.length + ' 条代码锚点 + 全站 Notification 三类名期望 0（扫 ' + productFiles.length + ' 个产品文件，累计命中 ' + notifHits + '）+ 附件进不了备份双锚 + 提醒位/压缩档两组单点 + 能力边界文案 1 条；每条期望 0 都配正向对照');
  fail += bad30;
}


/* ============ §31 双栏桌面档与可用视口横向分支闸门（批次 18） ============
   这一批是「桌面/平板腿」改动：用户只验手机 APK，手机上永远看不到双栏，所以源码侧必须自己
   证明两件事，否则这类改动最容易悄悄把手机档一起改了：
   ① 双栏 CSS 一条都不落在 900 媒体查询之外（block 包含检＝手机一根 CSS 没动的源码侧证明）；
   ② 侧栏绝不进 USABLE_BANDS。侧栏已经从 Leaflet 容器宽度里被栅格扣掉了，再进名单就是第二次
      内缩，症状是「地图内容整体偏右、fitBounds 留白过大」（§0 硬事实 0-2 的反面）。
   另外三组是本批交付物本身的形状：
   ③ 横向分支必须真的给 ins.left/ins.right 赋值（改前结构上恒 0，只钉初始化那行会一直绿）；
   ④ 聚焦路径收进 flyToUsable 单点（批次 13 登记的「flyToSite 仍按元素中心」残留就此收口，
      全站 map.flyTo( 只剩单点内部那 1 处）；
   ⑤ 左列悬停高亮要有可观测出口（dayLineWeights），否则「悬停会高亮」这句话只能靠肉眼看像素。
   口径同 §28/§29/§30：四元组守卫、期望 0 配正向对照、锚点串不落块注释、.html 只归一空白。
   ============================================================ */
{
  let bad31 = 0;
  const F31 = m => { bad31++; console.log('FAIL §31 双栏闸门: ' + m); };
  const ws31 = s => s.replace(/\s+/g, ' ').trim();
  const flat31 = s => ws31(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt31 = (s, n) => s.split(n).length - 1;
  const rd31 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view31 = f => /\.html$/.test(f) ? ws31(rd31(f)) : flat31(rd31(f));

  const FILES31 = ['topic-common.js', 'design.css', 'planner.js', 'topic.html', 'tools/smoke-usable.js',
    'README.md', 'docs/功能完善实施方案-2026-10-05.md'];
  const V31 = {};
  FILES31.forEach(f => {
    if (!fs.existsSync(f)) { F31('缺 ' + f); V31[f] = ''; return; }
    V31[f] = view31(f);
  });

  const A31 = [
    /* ③ 横向分支：真的产出 ins.left / ins.right */
    ['topic-common.js', "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];", 1, '带名单逐字钉死：只有这四类浮层参与内缩，侧栏不在其中（下面另有期望 0 那条）'],
    ['topic-common.js', 'iy >= el.height * 0.6', 1, '侧带判据：纵向压满 60% 才算左右带（与 tools/smoke-usable.js 的 PROBE 逐条同形，±2px 对账靠的就是同形）'],
    ['topic-common.js', 'ins.left = Math.max(ins.left, r.right - el.left);', 1, '硬事实 0-2 的反证：这一行存在，左内缩才第一次可能被算出来'],
    ['topic-common.js', 'ins.right = Math.max(ins.right, el.right - r.left);', 1, '同上，右侧'],
    ['topic-common.js', 'return { top: i.top + MARK_HALF, right: i.right + MARK_HALF, bottom: i.bottom + MARK_HALF, left: i.left + MARK_HALF };', 1, 'contentInsets 四边一起加半盒余量（漏左右＝focusUsable 的 padding 仍是 16）'],
    ['topic-common.js', 'return { l: i.left, t: i.top, r: s.x - i.right, b: s.y - i.bottom };', 1, 'usableRectPx 消费左右 → clampCapsules 的内收边界跟着双栏走'],
    ['topic-common.js', 'map.containerPointToLatLng(L.point(s.x - i.right, s.y - i.bottom))', 1, 'contentBounds 的右下角含 right（LOD 裁剪矩形不再把侧栏后的内容当可见）'],
    ['topic-common.js', 'paddingTopLeft: [i.left, i.top]', 2, 'fitUsable 与 focusUsable 两处不对称内缩都带 left（Leaflet 真选项名，paddingTL 不认）'],
    /* ④ 聚焦单点 */
    ['topic-common.js', 'function flyToUsable(latlng, zoom, opts) {', 1, '聚焦偏移只有一个定义点'],
    ['topic-common.js', 'flyToUsable(', 7, '定义 1 + 调用 6（聚合聚焦 / 站点 / 我的位置行 / 自动定位 / 定位按钮 / 这一带实时点）：新增聚焦入口必须走这里（批次 21 由 6→7，逐处点名而非改数凑绿）'],
    ['topic-common.js', '.subtract(contentCenterPx())', 1, '把「内容中心 − 元素中心」算进偏移（这就是批次 13 那条残留的正解）'],
    ['topic-common.js', 'if (opts && opts.instant) { map.setView(at, zoom); return; }', 1, '瞬时腿也在单点内，不是各处自己裸 setView'],
    ['topic-common.js', 'map.flyTo(at, zoom, { duration: (opts && opts.duration) || .5 });', 1, '单点内部那一条 flyTo（下面钉「全站只剩这一处」）'],
    ['topic-common.js', 'map.flyTo(', 1, '聚焦路径零裸 flyTo：多一处＝又一处按元素中心聚焦'],
    ['topic-common.js', 'setTimeout(function () { flyToUsable(pt(s), Math.max(map.getZoom(), 12), { duration: .6 }); }, 80);', 1, 'flyToSite 先切 tab 再聚焦：#map 不活动时容器 0×0，内容中心是垃圾偏移'],
    ['topic-common.js', 'flyToUsable: flyToUsable,', 1, '单点已导出（闸门侧要复算偏移，不导出就只剩像素可读）'],
    /* ⑤ 左列悬停高亮 */
    ['topic-common.js', 'document.body.dataset.view = tab;', 1, '双栏左面板由 switchTab 标注（不用 :has()：旧内核整块失效会露出空左条）'],
    ['topic-common.js', 'routeDayLines.push(line);', 1, '每日线按序留存，悬停才有「哪条是这天」的答案'],
    ['topic-common.js', 'if (pts.length < 1) { routeDayLines.push(null); return; }', 1, '没画线的天占位：下标必须等于天序号，否则悬停 D3 亮的是 D2'],
    ['topic-common.js', 'dayLineWeights: function () { return routeDayLines.map(function (l) { return l ? l.options.weight : 0; }); },', 1, '高亮的可观测出口（smoke 读线宽而不是像素）'],
    ['topic-common.js', 'hlRouteDay(p[0], p[1])', 1, '左列日块 mouseenter 接线在'],
    /* ① 双栏 CSS：阈值唯一、栅格与 sticky 的形状 */
    ['design.css', '@media (min-width: 900px)', 1, '整串恰一处（降到 700 会把 768×1024 切成两栏：地图只剩 428px，比手机还挤）'],
    ['design.css', '@media (min-width: 700px)', 0, 'design.css 里没有 700 档双栏（阈值被"顺手"下调即红；这条串在 map.css 的卡片多列里真实存在，见下面正向对照）'],
    ['design.css', ':root{--dv-side:340px}', 1, '左栏宽单点'],
    ['design.css', '--dv-side:380px', 1, '1440 档放宽只改这一个 token'],
    ['design.css', 'body.topic-page main>.view{left:var(--dv-side)}', 1, '专题页地图从容器尺寸里就让出侧栏（不是靠内缩去补）'],
    ['design.css', 'body.topic-page main>.view:not(#map){left:0;right:auto;width:var(--dv-side)}', 1, '当前 tab 的面板进左栏'],
    ['design.css', 'body.topic-page #map{display:block!important}', 1, '面板切走时地图仍可见（双栏的"专业软件"手感）'],
    ['design.css', 'body.topic-page[data-view="map"] #list{display:block}', 1, '打开地图时左栏用列表当面板，不留空条'],
    ['design.css', 'body.topic-page #list .grid{grid-template-columns:1fr}', 1, '340px 窄栏里压回一栏（map.css 的 ≥700 两栏会把卡片挤破）'],
    ['design.css', 'body.topic-page .tabbar{left:12px;transform:none;width:calc(var(--dv-side) - 24px)}', 1, '底部胶囊贴左栏：飘在右栏只占 .44 宽，既不成带（可用区算不出）又真遮标记'],
    ['design.css', 'body.topic-page .region-stats{left:12px;transform:none;width:calc(var(--dv-side) - 24px);max-width:none}', 1, '同上，统计条'],
    ['design.css', 'body.dv-result #stageResult{display:grid!important;grid-template-columns:var(--dv-side) minmax(0, 1fr);column-gap:18px;align-items:start}', 1, '规划结果页两列（showStage 用 inline display 管阶段，grid 必须 !important）'],
    ['design.css', 'body.dv-result #stageResult>#mapBox{grid-column:2;grid-row:1/span 12;position:sticky;top:12px;height:calc(100dvh - 140px);min-height:420px}', 1, '地图跨满左栏所有行才粘得住；span 用不完的行高度为 0，不额外撑高'],
    /* 规划页悬停高亮接线 */
    ['planner.js', String.raw`document.body.classList.toggle('dv-result', name === 'stageResult');`, 1, '双栏作用域只开在结果阶段（别的阶段仍是单列窄卡）'],
    ['planner.js', 'planDayGroups = trip.days.map(function () { return L.layerGroup().addTo(mapLayer); });', 1, '线段按天分组建，每轮 drawMap 重建'],
    ['planner.js', 'var seg = L.layerGroup().addTo(planDayGroups[own[i]] || mapLayer);', 1, '段归当天；own 越界兜底回 mapLayer（不兜底＝坐标缺失的段整个消失）'],
    ['planner.js', 'function planLine(group, latlngs, opts) {', 1, '建线单点：基准透明度/线宽在同一处记下'],
    ['planner.js', 'ln._bop = opts.opacity; ln._bw = opts.weight;', 1, 'setStyle 就地改 options，不留底就不知道离开悬停后回到哪一档'],
    ['planner.js', 'function hlPlanDay(di) {', 1, '悬停高亮单点'],
    ['planner.js', 'window.plannerHlDay = hlPlanDay;', 1, '日卡内联事件用的就是它（没导出＝点了没反应的热区）'],
    ['planner.js', String.raw`onmouseenter="window.plannerHlDay(' + di + ')" onmouseleave="window.plannerHlDay(-1)"`, 2, '两张日卡（正常/转场）都挂：只挂一张就漏掉赶路日'],
    ['topic.html', '<body class="topic-page" data-view="map">', 1, '双栏作用域开在 body 上，data-view 初值＝默认 tab'],
    /* 浏览器腿：七条新判据一条不许少 */
    ['tools/smoke-usable.js', String.raw`b.setAttribute('style', 'display:block;position:fixed;top:0;height:100vh;width:120px;transform:none;opacity:1;' +`, 1, 'U14/U15 借道真带元素：usableInsets 只遍历 USABLE_BANDS 那四个选择器，新插一个无名 div 它根本看不见，那条绿光是假绿'],
  ];
  A31.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F31('A31 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V31)) { F31('A31 登记了 §31 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt31(V31[file], needle);
    if (got !== want) F31(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A31.length < 44) F31('锚点表被削减：' + A31.length + ' 条（批次 18 落地时实测 44 条）');

  /* ② 侧栏不进带名单（期望 0 + 正向对照） */
  if (cnt31(V31['topic-common.js'], "'#list'") !== 0)
    F31('USABLE_BANDS 里出现了侧栏选择器 #list：双份内缩回归（fitUsable 对已被栅格扣掉的宽度再扣一次，地图内容整体偏右、fitBounds 留白过大）。这条只有源码腿能守：双栏档下侧栏盒与地图盒相切不重叠（ix=0<12 先被排除），浏览器侧量不到它变红');
  const CTRL31A = flat31("var USABLE_BANDS = ['#routeBanner', '#list', '.tabbar'];");
  if (cnt31(CTRL31A, "'#list'") < 1) F31('「#list 不进名单」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');

  /* ④ 改前形态零残留（各配合成正向对照） */
  const OLD31 = [
    ['topic-common.js', "map.flyTo(pt(s), Math.max(map.getZoom(), 12), { duration: .6 });", 'flyToSite 仍按元素中心裸 flyTo（批次 13 登记的残留）'],
    ['planner.js', 'var seg = L.layerGroup().addTo(mapLayer);', '线段平铺进 mapLayer：没有按天分组，悬停高亮无从下手'],
    ['topic.html', '<body>', '裸 body：双栏作用域没开'],
  ];
  OLD31.forEach(([f, needle, why]) => {
    if (cnt31(V31[f], needle) !== 0) F31(f + ' 里还有改前形态「' + needle + '」：' + why);
    if (cnt31(flat31(needle), needle) < 1) F31('「' + needle + '」这条期望 0 的正向对照失效了');
  });

  /* ① 双栏 CSS 一条都不许漏到 900 媒体查询之外（手机档一根 CSS 没动的源码侧证明）。
     --dv-side 只在 1400 那条放宽里额外出现一次，所以它的额度是「总数 − 1」。 */
  {
    const D31 = V31['design.css'];
    const I31 = D31.indexOf('@media (min-width: 900px){');
    const J31 = D31.indexOf('@media (min-width: 1400px)');
    if (I31 < 0 || J31 < 0 || J31 <= I31) F31('抠不出双栏段落（900 与 1400 两条查询至少改了一个，本节的范围检失效）');
    else {
      const BLK = D31.slice(I31, J31);
      [['body.topic-page', 0], ['body.dv-result', 0], ['--dv-side', 1]].forEach(([n, allow]) => {
        const all = cnt31(D31, n), inBlk = cnt31(BLK, n);
        if (all - inBlk !== allow)
          F31(n + ' 有 ' + (all - inBlk) + ' 处落在 900 媒体查询之外（允许 ' + allow + '）：双栏 CSS 漏进手机档＝本批红线');
      });
      if (BLK.indexOf('340px') < 0) F31('双栏段落里读不到 340 的左栏宽（上面那条 :root 锚没跑在这段里）');
    }
    /* 阈值降档的反证：700 这条串确实存在于仓库（map.css 的卡片多列），所以 design.css 里的 0 是真测出来的 */
    if (cnt31(flat31(rd31('map.css')), '@media (min-width: 700px)') < 1)
      F31('map.css 里找不到 @media (min-width: 700px)：design.css 那条期望 0 失去了正向对照');
  }

  /* 浏览器腿：U14–U20 一条不许少（横向内缩 2 + 1440 双栏 1 + 悬停 1 + 768 单栏 1 + 手机两档几何 2） */
  const U31 = ['U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20'];
  /* U14x 这种「把判据改名」的退化必须也算红：id 后面紧跟空格才算这条腿还在 */
  U31.forEach(u => {
    if (V31['tools/smoke-usable.js'].indexOf("check('" + u + ' ') < 0)
      F31('tools/smoke-usable.js 缺 ' + u + ' 这条判据（批次 18 的七条浏览器腿是一整组，少一条就是有个症状没人管）');
  });

  if (V31['README.md'].indexOf('§31') < 0) F31('README.md 的 verify 清单没提 §31（新闸门不写进 README 就等于没装）');
  if (V31['docs/功能完善实施方案-2026-10-05.md'].indexOf('批次 18 已实施') < 0)
    F31('方案文档没登记「批次 18 已实施」（这批在手机上看不见，收工状态只能靠文档留在案上）');

  console.log('双栏闸门: ' + A31.length + ' 条代码锚点（横向分支四边各有消费点 + 聚焦单点 7 处（含批次 21「这一带」实时点） + 双栏 CSS 阈值唯一 + 悬停高亮接线）+ 侧栏不进 USABLE_BANDS 期望 0 + 三条改前形态零残留 + 双栏 CSS 段落范围检（漏进手机档即红）+ smoke U14–U20 七条齐备；每条期望 0 都配正向对照；变异自测两层在案（源码腿 tools/out/mut-verify31.js 38 条应红全红、浏览器腿 tools/out/mut-smoke31.js 4 条应红全红，其中「侧栏进带名单」实测只有源码腿能守）');
  fail += bad31;
}


/* ============ §32 开销记账闸门（批次 19） ============
   这一批管的是钱。钱的错法只有一种要命：静默错到底——界面上永远看着对，症状要等到用户对账
   那天才出现，而那天已经隔了一整趟旅行。所以源码侧钉的五族，一族对应一种静默坏法：
   ① 浮点入口只有两处（add / setBudget 各一次 Math.round(元*100)）。多一处＝求和进了浮点域，
      三笔 33.33 差 1e-14；而读侧 centsOf() 也在四舍五入，所以写侧退化在界面上什么都看不出来
      （smoke 的 A17 因此直接断言 localStorage 落盘的整数，不看界面）。
   ② 分→元显示只有一个出口 fmtMoney，且它自己不碰 toFixed（补零靠手写两位）。
      各处自己除 100＝同一天在日卡 100.0、在汇总卡 100.00000000000001。
   ③ 分类只有一份：expense.js 的 CATS。planner 侧再写一套字面量＝两边会漂，
      漂的第一天就是「UI 让选六个、CSV 只有五行」。
   ④ 「显示即存入」：编辑器高亮与提交必须读同一个 expCatNow()。这条是本批真实事故——
      改前高亮兜「餐饮」、提交兜「其他」，新会话第一次记一笔就静默记错类，
      且没有任何一处界面显示过这个错。除字符串锚外再各抽一次函数体做结构断言：
      分叉的两半被拆进不同函数也要红。
   ⑤ 钱是隐私：share.js 白名单里不许出现金额类字段（期望 0 配正向对照）；
      备份侧两个键逐字登记（tn_expense 走 id 并集、tn_budget 走 dict，附件那类隐私另说）。
   另两族是手机上看得见的：44px 触控（design.css 触控高标准「高频/破坏性 ≥44」，记账整条流程
   都在这族里，含底脚入口与明细删除方块）、破坏性操作只走 UI.confirm
   （window.confirm / Notification 在 planner.js 期望 0）。
   口径同 §28/§31：四元组守卫、期望 0 一律配正向对照、锚点串不落块注释、.html 只归一空白不剥注释。
   ============================================================ */
{
  let bad32 = 0;
  const F32 = m => { bad32++; console.log('FAIL §32 记账闸门: ' + m); };
  const ws32 = s => s.replace(/\s+/g, ' ').trim();
  const flat32 = s => ws32(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt32 = (s, n) => s.split(n).length - 1;
  const rd32 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view32 = f => /\.html$/.test(f) ? ws32(rd32(f)) : flat32(rd32(f));
  const fnBody32 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };

  const FILES32 = ['expense.js', 'planner.js', 'planner.html', 'share.js', 'backup.js',
    'tools/gen-sw-shell.cjs', 'tools/smoke-expense.js', 'README.md', 'docs/功能完善实施方案-2026-10-05.md'];
  const V32 = {};
  FILES32.forEach(f => {
    if (!fs.existsSync(f)) { F32('缺 ' + f); V32[f] = ''; return; }
    V32[f] = view32(f);
  });

  const A32 = [
    /* ① 浮点入口：全模块两处，一处不多 */
    ['expense.js', "var KEY = 'tn_expense';", 1, '账本键单点（backup 侧、planner 撤销侧都按这个字符串对账）'],
    ['expense.js', "var BKEY = 'tn_budget';", 1, '预算单独一键：不塞进 trip 对象（trip 是分享载荷的来源）'],
    ['expense.js', "var CATS = ['交通', '住宿', '餐饮', '门票', '购物', '其他'];", 1, '六分类全站唯一来源'],
    ['expense.js', 'var i = CATS.indexOf(c); return i >= 0 ? CATS[i]', 1, '未知分类归「其他」：从别台机并回来的脏值不许炸掉汇总'],
    ['expense.js', 'var cents = Math.round(n * 100);', 1, 'add 的元→分入口（账本唯一的浮点入口之一）'],
    ['expense.js', 'var cents = (!isFinite(n) || n <= 0) ? 0 : Math.round(n * 100);', 1, 'setBudget 的元→分入口'],
    ['expense.js', 'Math.round(n * 100)', 2, '全模块浮点→整数只有这两处；第三处＝某个求和偷偷从元开始算'],
    ['expense.js', 'a / 100', 1, '分→元只在 fmtMoney 显示时发生一次'],
    ['expense.js', 'function fmtMoney(cents) {', 1, '金额显示单点'],
    ['expense.js', "var sign = c < 0 ? '-' : '', a = Math.abs(c), y = Math.floor(a / 100), f = a % 100;", 1, '负数带负号、小数手写补零（对账要「0.50」不是「0.5」）'],
    ['expense.js', "var n = Math.round(Number(d)); return isFinite(n) && n >= 1 ? n : 1;", 1, '天序号 1 起（存 0 起那天永远不进任何日卡）'],
    ['expense.js', "function uniqId() { return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); }", 1, 'id 是本机唯一号，不是 tripId+金额的散列：散列会把同天同额的第二笔并掉＝丢钱'],
    ['expense.js', "catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，这笔账本次没有记上'); return false; }", 1, 'LS 写满要说真话并让 add 返回 null（静默失败的钱最贵）'],
    ['expense.js', 'return t > b ? t - b : 0;', 1, '没超支就是 0：负数超支不外露成「已超预算 -40.00 元」'],
    ['expense.js', 'if (cents) d[tripId] = cents; else delete d[tripId];', 1, '清空预算＝删键，不留 0 分档（留 0 会让「已设预算」与除零同时发生）'],
    ['expense.js', 'keep = list.filter(function (x) { return x.tripId !== tripId; });', 1, '删行程时账目跟着走，不留孤儿桶'],
    ['expense.js', String.raw`return '\ufeff' + L.join('\r\n') + '\r\n';`, 1, 'CSV 首字节 BOM + 行结束只 CRLF（Excel 按本地代码页猜编码，没 BOM 的中文 CSV 开成一屏乱码）'],
    ['expense.js', String.raw`return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;`, 1, 'RFC 4180 判定按这三个字符：中文逗号不需要引号，英文逗号/引号/换行需要'],
    ['expense.js', "csvRow(['日期', '第几天', '分类', '金额(元)', '垫付人', '备注'])", 1, '表头整串固定（谁改列名谁负责通知所有旧账单）'],
    ['expense.js', "L.push(csvRow(['预算', budget ? fmtMoney(budget) : '未设']));", 1, '没设预算写「未设」，不写 0.00（0 元预算与没预算是两回事）'],
    ['expense.js', "if (budget) L.push(csvRow([over ? '超支' : '结余', fmtMoney(over ? over : budget - total)]));", 1, '两个分支都有字：只写超支会让没超支的账单看着像缺了一行'],
    /* ③④ 单一分类来源 + 显示即存入 */
    ['planner.js', "function expCatNow() { return Expense.CATS.indexOf(state.expCat) >= 0 ? state.expCat : '餐饮'; }", 1, '选中分类的单点出口'],
    ['planner.js', 'expCatNow(', 3, '定义 1 + 调用 2（高亮与提交）：调用数掉到 1 就是分叉又回来了'],
    ['planner.js', 'var sel = expCatNow();', 1, '编辑器高亮读它'],
    ["planner.js", "lump ? '其他' : expCatNow(),", 1, '提交读它——与上一条必须同源（本批真实事故）'],
    ['planner.js', 'state.expCat = c;', 1, '分类写入只有一个入口'],
    ['planner.js', 'Expense.CATS.map(function (c, i) {', 1, 'chip 由模块派生：UI 里不另立分类表'],
    /* 录入与界面 */
    ['planner.js', String.raw`'<input class="examt" id="exAmt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="' + (lump ? '今天一共花了多少' : '金额') + '" aria-label="金额（元）">' +`, 1, 'number+decimal 手机才直接上数字键盘；aria 名在（读屏用户要知道这个框是什么）'],
    ['planner.js', String.raw`'<button class="btn mini" onclick="window.plannerExpEdit(' + di + ')">' + (open && !state.expLump ? '收起' : TI('budget') + '记开销') + '</button>' +`, 1, '入口叫「记开销」：卡内那颗打卡按钮已经占了「记一笔」'],
    ['planner.js', String.raw`'今日 <b>' + Expense.fmtMoney(total) + '</b> 元 · ' + e.list.length + ' 笔'`, 1, '日脚与汇总卡同一把尺子（都从 fmtMoney 出）'],
    ['planner.js', String.raw`h += '<div class="exacts"><button class="btn primary" onclick="window.plannerExpSave(' + di + ',' + (lump ? 1 : 0) + ')">记上</button>' +`, 1, 'lump 标志随按钮走：一笔带过与拆项录入共用一个提交口'],
    ['planner.js', String.raw`if (!isFinite(n) || n <= 0) { toast('先填一个大于 0 的金额'); if (amt) amt.focus(); return; }`, 1, '0 与垃圾输入被挡在写盘前，且编辑器不关（关掉就把刚敲的备注一起吞了）'],
    ['planner.js', String.raw`text: '删除「' + it.cat + ' ' + Expense.fmtMoney(it.cents) + ' 元」这条记录？删了就找不回来。'`, 1, '破坏性确认点名是哪一笔（只写「确定删除吗」等于让人盲签）'],
    ['planner.js', 'var cats = Expense.catTotals(tid).filter(function (c) { return c.cents > 0; });', 1, '条形只列有钱的分类：六行里四行是 0 的图等于没图'],
    ['planner.js', String.raw`$id('expBar').style.width = (budget ? Math.min(100, Math.round(total / budget * 100)) : (list.length ? 100 : 0)) + '%';`, 1, '条宽夹在 100（超支时不冲出卡片）'],
    ['planner.js', String.raw`Math.max(4, Math.round(c.cents / max * 100))`, 1, '最小分类给 4% 下限：一笔 12.50 的交通在 839.50 旁边会渲染成 0 宽，看着像没记'],
    ['planner.js', String.raw`$id('expOver').innerHTML = over ? '<div class="warnline">' + TI('warn') + '已超预算 ' + Expense.fmtMoney(over) + ' 元</div>' : '';`, 1, '超支必须有字（WCAG 1.4.1，与批次 5 同口径：色盲/小屏/黑白打印都要读得出来）'],
    ['planner.js', 'if (bud && document.activeElement !== bud) bud.value = budget ? Expense.fmtMoney(budget) : \'\';', 1, '正在输入时不回写：回写会把用户刚敲的数字按分位重排'],
    ['planner.js', "if (csvBtn) csvBtn.style.opacity = list.length ? '' : '.55';", 1, '空账时只降透明度不 disabled：点下去那句教路的话才是出口'],
    ['planner.js', String.raw`if (!Expense.listOf(tid).length) { toast('这笔账还是空的：先在日卡底部记一笔开销，再来导出 CSV'); return; }`, 1, '空账导出下载一个只有表头的文件＝用户以为账单坏了'],
    ['planner.js', String.raw`saveTextDoc(icsFileSafe(t.name) + '-开销.csv', csv, 'text/csv;charset=utf-8', '用表格软件打开即可');`, 1, '通道与日历同源（APK 下载目录／浏览器 Blob／copyText 三条腿）'],
    ['planner.js', 'if (removed && removed.id && window.Expense) Expense.clearTrip(removed.id);', 1, '删行程带走账：与清单那条同一处理'],
    ['planner.js', 'renderTrips(); renderExpense();', 2, '两处（删除后 + 撤销后）都要重绘汇总卡：只 renderTrips 这张卡还挂着上一趟的金额与进度条'],
    ['planner.js', String.raw`if (exRaw != null) lsSet('tn_expense', exRaw); if (bdRaw != null) lsSet('tn_budget', bdRaw);`, 1, '撤销按原字节还原两桶（重算一遍会丢 ts 与插入序细节）'],
    /* ⑤ 隐私：钱不进分享载荷；备份两键逐字登记 */
    ['share.js', 'var ALLOWED = { v: 1, t: 1, sd: 1, from: 1, to: 1, loop: 1, r: 1, b: 1, days: 1, km: 1, h: 1, stops: 1, tr: 1, f: 1, o: 1, n: 1, la: 1, lo: 1, k: 1 };', 1, '白名单整串（下面三条期望 0 的对照物）'],
    ['backup.js', "{ k: 'tn_expense', g: 'data', m: 'id' },", 1, '账目走 id 并集：同天同额是两笔真开销，不能按内容散列去重'],
    ['backup.js', "{ k: 'tn_budget', g: 'data', m: 'dict' },", 1, '预算走 dict：顶层属性就是 tripId，各趟互不覆盖'],
    ['tools/gen-sw-shell.cjs', "'expense.js', 'share.js', 'checklist.js', 'ticketbox.js'", 1, 'CORE_JS 名单含记账模块（生成器的 filter 会静默抹掉不在名单里的文件，离线首屏就是一片白）'],
    /* 页面结构与触控族 */
    ['planner.html', '<div class="card sumcard" id="expCard" style="display:none">', 1, '汇总卡挂 sumcard：批次 17 把进度条样式收进 .sumcard，漏了这个类这张条就是隐形的'],
    ['planner.html', '<div class="phead"><span class="pbar" id="expBarWrap"><i id="expBar"></i></span><span class="pcount" id="expCount"></span></div>', 1, '进度条结构（i 在 pbar 里才有宽高）'],
    ['planner.html', '<div class="exbars" id="expBars"></div>', 1, '条形容器在'],
    ['planner.html', '<label for="exBudget">预算</label>', 1, 'label 关联：点文字也能聚焦到输入框'],
    ['planner.html', '<input id="exBudget" type="number" inputmode="decimal" min="0" step="1" placeholder="未设" onchange="window.plannerExpBudget(this.value)">', 1, '预算框是数字键盘档，onchange 走单点'],
    ['planner.html', '.day-card .exfoot .btn{min-height:44px}', 1, '底脚两个入口 44：空账时汇总卡的话就指着它们（「在日卡底部点『记开销』」）'],
    ['planner.html', '.exedit .excats .chip{min-height:44px}', 1, '分类 chip 44：它是这笔账归哪一类的判定，不是装饰标签'],
    ['planner.html', '.exedit .exacts .btn{flex:1;min-height:44px;justify-content:center;display:flex;align-items:center}', 1, '「记上」/「收起」44'],
    ['planner.html', '.exedit .examt{flex:1;min-width:0;min-height:44px;', 1, '金额框 44'],
    ['planner.html', '.exrows .ex .mv{width:44px;height:44px;flex:0 0 auto}', 1, '删除方块 44：销毁真实记录不是「上移下移」那种轻操作'],
    ['planner.html', '#expCsvBtn{min-height:44px}', 1, '导出键 44：这张卡唯一的主操作'],
    ['planner.html', '<script src="expense.js" defer></script>', 1, '模块进页面（没这行 planner.js 里的 Expense.* 全是 ReferenceError）'],
    /* 浏览器腿的夹具：机型与计数器 */
    ['tools/smoke-expense.js', 'await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });', 1, '452×995 是一加 Ace 6T 真机档；桌面宽度量出来的触控与溢出一律不作数'],
    ['tools/smoke-expense.js', 'window.confirm = function () { window.__native++; return true; };', 1, '原生 confirm 计数在（下面「零原生」那条没有它永远为真）'],
  ];
  A32.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F32('A32 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V32)) { F32('A32 登记了 §32 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt32(V32[file], needle);
    if (got !== want) F32(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A32.length < 62) F32('锚点表被削减：' + A32.length + ' 条（批次 19 落地时实测 62 条）');

  /* ④ 结构断言：高亮与存入分叉被拆进不同函数也要红（字符串锚只证明两处都调过） */
  {
    const SAVE = fnBody32(V32['planner.js'], 'window.plannerExpSave = function (di, lump) {');
    if (!SAVE) F32('抽不出 window.plannerExpSave 函数体（上面那批「提交读 expCatNow」的锚全部失去依据）');
    else {
      if (cnt32(SAVE, 'expCatNow(') !== 1) F32('plannerExpSave 体里 expCatNow( 不是恰 1 次：提交侧的分类出口被换掉了');
      if (cnt32(SAVE, 'Expense.add(') !== 1) F32('plannerExpSave 体里 Expense.add( 不是恰 1 次：写盘出口旁路了');
      if (cnt32(SAVE, 'state.expCat') !== 0) F32('plannerExpSave 体里直接读 state.expCat：绕过 expCatNow 单点＝「显示餐饮、存成其他」的坏法回来了');
    }
    const ED = fnBody32(V32['planner.js'], 'function expEditor(di, e) {');
    if (!ED) F32('抽不出 expEditor 函数体（高亮侧的结构断言没有依据）');
    else if (cnt32(ED, 'state.expCat') !== 0) F32('expEditor 体里直接读 state.expCat：高亮侧也绕过了单点');
    const CTRL32 = flat32("function expEditor(di) { var sel = state.expCat || '餐饮'; }");
    if (cnt32(CTRL32, 'state.expCat') < 1) F32('「不许直接读 state.expCat」这两条期望 0 的正向对照失效了');
  }

  /* ①②③ 期望 0：浮点旁路、第二套分类、原生弹窗（各配正向对照） */
  const ZERO32 = [
    ['expense.js', 'toFixed', "var c = (n).toFixed(2);", '账本模块里不许出现 toFixed：它把 1e-14 的误差藏进「看上去对」的读数，而补零 fmtMoney 自己手写'],
    ['expense.js', 'parseFloat', "var v = parseFloat(input.value);", '元→分只认 Number()+Math.round 那一处；parseFloat 冒出来＝另开一个浮点入口'],
    ['planner.js', "['交通'", "var CATS = ['交通', '住宿'];", 'planner 侧不许有第二套分类字面量：与 expense.js 那份会漂，漂的第一天就是「UI 选六个、CSV 五行」'],
    ['planner.js', 'window.confirm(', "if (window.confirm('删吗')) del();", '破坏性操作只走 UI.confirm：原生弹窗在 WebView 里不可样式化，且无法带「删了就找不回来」这句'],
    ['planner.js', 'Notification', "new Notification('票要过期了');", '红线：提醒只有页内横幅一条腿（系统推送要先改壳重打包）'],
    ['share.js', 'budget', 'ALLOWED = { budget: 1 };', '钱不进分享载荷：白名单里出现 budget 就是把每趟花多少发给点开链接的人'],
    ['share.js', 'expense', 'ALLOWED = { expense: 1 };', '同上'],
    ['share.js', 'cents', 'ALLOWED = { cents: 1 };', '同上，分位原值'],
  ];
  ZERO32.forEach(([f, needle, ctrl, why]) => {
    if (cnt32(V32[f], needle) !== 0) F32(f + ' 里出现「' + needle + '」：' + why);
    if (cnt32(flat32(ctrl), needle) < 1) F32('「' + needle + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* 浏览器腿：A01–A63 一条不许少，改名（A16→A16x）也要红 */
  for (let i = 1; i <= 63; i++) {
    const id = 'A' + (i < 10 ? '0' + i : i);
    if (V32['tools/smoke-expense.js'].indexOf("ok('" + id + ' ') < 0)
      F32('tools/smoke-expense.js 缺 ' + id + ' 这条判据（批次 19 的 63 条编号判据是一整组，少一条就是有个症状没人管）');
  }
  ['A16b', 'A16c', 'A16d'].forEach(id => {
    if (V32['tools/smoke-expense.js'].indexOf("ok('" + id + ' ') < 0)
      F32('tools/smoke-expense.js 缺 ' + id + '：sticky 分类与新会话「显示即存入」是两条独立的腿，合并成一条就测不出分叉');
  });

  if (V32['README.md'].indexOf('§32') < 0) F32('README.md 的 verify 清单没提 §32（新闸门不写进 README 就等于没装）');
  if (V32['docs/功能完善实施方案-2026-10-05.md'].indexOf('批次 19 已实施') < 0)
    F32('方案文档没登记「批次 19 已实施」（收工状态只能靠文档留在案上）');

  console.log('记账闸门: ' + A32.length + ' 条代码锚点（浮点→分两处入口 + 显示单点不碰 toFixed + 分类唯一来源 + 「显示即存入」单点 + 隐私两键 + 44px 触控族 + CSV BOM/CRLF/RFC 判定）+ plannerExpSave/expEditor 两处函数体结构断言 + 八族期望 0（toFixed/parseFloat/第二套分类/window.confirm/Notification/share 三键）+ smoke A01–A63 与 A16b/c/d 齐备检；每条期望 0 都配正向对照；变异自测两层在案（源码腿 tools/out/mut-verify32.js 65 条应红全红、异常 0；浏览器腿由上面 A01–A63 齐备检与 smoke 自身承担）');
  fail += bad32;
}

/* ============ §33 路线档位与锁定闸门（批次 20） ============
   这一批改的是「一把尺子量所有出行方式」和「用户钉过的顺序被自动重排打散」。
   两种坏法都是静默的：800m 的两站按 60km/h 排成「车程 1 分钟」，界面上没有任何一处说这不对；
   手动把第三站挪到第一位、下一次点「重新排期」它又飞回去，用户只会觉得软件在乱来。
   所以源码侧钉四族：
   ① MODE 表六个数字逐值钉死 + 旧的单值常量 AVG_KMH/ROAD_FACTOR 期望 0（残留＝某个入口还在用
      一把没分档的尺子）；mkLeg 形参必须带 tb，且**矩阵只喂自驾档**（把驾车里程当骑行里程，
      40km 的段会算成「骑行 40 分钟」）。
   ② 档位数字不许在文案里重抄一遍：rulerNote 从 MODE 派生，旧那句「直线 ×1.35」硬编码期望 0；
      时长动词走 verbOf，「车程」二字只在自驾档出现。
   ③ 锁定只在一个地方生效（withLocked），orderStops 与 orderByMatrix 各自**恰一次**经过它——
      两条独立锚，防止「只在一个里做」；plannerMoveStop 交换成功后必须置 locked=1（不留痕＝本批
      要修的原始 bug）；锁定的 UI 出口只有 plannerLockStop 一个。
   ④ 分享载荷：出行方式与钉住标记进白名单（短键 b/k），钱仍然不许进；osrm 域名全站期望 0
      （公开实例只有 driving profile，写了就是兑现不了的承诺）。
   口径同 §28/§31/§32：四元组守卫、期望 0 一律配正向对照、锚点串不落块注释、.html 只归一空白不剥注释。
   ============================================================ */
{
  let bad33 = 0;
  const F33 = m => { bad33++; console.log('FAIL §33 路线档位闸门: ' + m); };
  const ws33 = s => s.replace(/\s+/g, ' ').trim();
  const flat33 = s => ws33(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt33 = (s, n) => s.split(n).length - 1;
  const rd33 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view33 = f => /\.html$/.test(f) ? ws33(rd33(f)) : flat33(rd33(f));
  const fnBody33 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };

  const FILES33 = ['planner.js', 'planner.html', 'share.js', 'share.html',
    'tools/smoke-planner.js', 'README.md', 'docs/功能完善实施方案-2026-10-05.md'];
  const V33 = {};
  FILES33.forEach(f => {
    if (!fs.existsSync(f)) { F33('缺 ' + f); V33[f] = ''; return; }
    V33[f] = view33(f);
  });

  const A33 = [
    /* ① MODE 表：六个数字逐值钉（改一个数就是改产品口径，必须留字在这里） */
    ['planner.js', 'var MODE = {', 1, '档位表单点'],
    ['planner.js', "auto: { label: '自动', kmh: 0, factor: 0 }", 1, '自动档自己不给出速度：kmh/factor 必须是 0，否则 pickMode 形同虚设'],
    ['planner.js', "drive: { label: '自驾', kmh: 60, factor: 1.35 }", 1, '60 是门到门均速（含加油找位吃饭），不是限速；48 会把 440km 这种一天能到的段拆成两天'],
    ['planner.js', "bike: { label: '骑行', kmh: 15, factor: 1.25 }", 1, '骑行档'],
    ['planner.js', "walk: { label: '步行', kmh: 4.5, factor: 1.15 }", 1, '步行档'],
    ['planner.js', 'var AUTO_WALK_KM = 1.5, AUTO_BIKE_KM = 6;', 1, '自动档的站距判据（市内 800m 不该按自驾算，跨市 100km 不该按步行算）'],
    ['planner.js', "function modeOf(tb) { return MODE[tb] ? tb : 'drive'; }", 1, '老行程没有这个字段＝自驾：不许回头改口，否则存好的账全变'],
    ['planner.js', "function travelByNow() { var w = state.wiz && state.wiz.travelBy; return MODE[w] ? w : 'auto'; }", 1, '新建行程默认档只有这一个读法（两个入口各写字面量就是「这里自动、那里自驾」的开始）'],
    ['planner.js', "return straightKm <= AUTO_WALK_KM ? 'walk' : straightKm <= AUTO_BIKE_KM ? 'bike' : 'drive';", 1, '选档判定单点'],
    ['planner.js', 'function mkLeg(matrix, tb) {', 1, '唯一尺子的形参含档位'],
    ['planner.js', 'var want = modeOf(tb);', 1, '入口先归一档位'],
    ['planner.js', "var m = want === 'auto' ? pickMode(straight) : want;", 1, '自动档按这一段的直线距离现场选'],
    ['planner.js', "if (m === 'drive' && matrix) {", 1, '高德矩阵只喂自驾档：把驾车里程当骑行里程，40km 会算成「骑行 40 分钟」'],
    ['planner.js', 'if (km == null) km = straight * mo.factor;', 1, '缺矩阵时按本档系数折算，不是恒 1.35'],
    ['planner.js', 'return { km: km, h: km / mo.kmh, mode: m };', 1, '时长 = 里程 / 本档速度，且把用的哪档带出去'],
    ['planner.js', 'var leg = mkLeg(null, tb);', 1, '最近邻排序用同一把尺子（旧写法按直线距离排，自动档里把「要走 4 小时」的站当近的捞进来）'],
    ['planner.js', 'var leg = mkLeg(dist || {}, tb);', 1, '矩阵排序路径同一条尺子'],
    ['planner.js', "leg = leg || mkLeg(null, state.trip ? state.trip.travelBy : travelByNow());", 1, '兜底也走档：裸 mkLeg(null) 会把没传尺子的入口悄悄送回自驾'],
    /* ② 文案跟着档位走 */
    ['planner.js', "return m === 'drive' ? '车程' : m === 'bike' ? '骑行' : m === 'walk' ? '步行' : '在途';", 1, '时长动词单点：把走出来的 4 小时写成「车程 4.0h」是谎报口径'],
    ['planner.js', "'日卡里程按直线 ×' + mo.factor", 1, 'rulerNote 的数字从 MODE 派生'],
    ['planner.js', "这段路的' + verbOf(trip.travelBy) + '超过单日上限 ' + DRIVE_H + ' 小时", 1, '转场日的解释跟着档位走（原句写死「单日驾驶上限」）'],
    ['planner.js', '公共交通未覆盖', 2, '能力边界要说给用户听（公交要实时数据，与离线定位冲突，本批不做）；两处在案：结果页切换条 ' + "'public 未覆盖' 说明 + 向导 step3 排线说明尾部"],
    ['planner.js', "'；地图折线为驾车路线形状'", 1, '非自驾档的折线仍是高德驾车线：不说这句，用户以为图上那就是骑行道'],
    /* 标题与「N 站已锁定」挂在哪：这两处都是「算对了但屏幕上看不出来」的现场 */
    ['planner.js', "$id('resultTitle').textContent = trip.name", 1, '全程 km 在 renderDaysBody 里现算：换档/删站只重画日卡的话，标题挂着上一档的数（屏上两个口径并存）'],
    ['planner.js', "<span id=\"lkSlot\">' + lockedHint()", 1, '锁定提示挂在稳定插槽里（整块重画 actRow 会让按钮闪一下，钉完站没反馈）'],
    ['planner.js', "var lk = $id('lkSlot'); if (lk) lk.innerHTML = lockedHint();", 1, '插槽取不到就跳过：不许把 null.innerHTML 抛进渲染链'],
    /* ③ 锁定：单点生效 + 两条重排路径各自经过 + 移动即钉 */
    ['planner.js', 'function withLocked(sel, reorder) {', 1, '锁定处理收成单点 helper（在两条路径里各写一遍 filter＝将来改一处漏一处的半新半旧）'],
    ['planner.js', 'if (s && s.locked) held.push([i, s]); else free.push(s);', 1, '钉住的站先摘出参与重排的集合'],
    ['planner.js', 'out.splice(Math.min(hp[0], out.length), 0, hp[1]);', 1, '再按原索引插回（夹到 out.length：重排后变短了不许插到数组外）'],
    ['planner.js', 'function orderStops(sel, start, tb) {', 1, '地理档签名带 tb'],
    ['planner.js', 'function orderByMatrix(sel, start, dist, tb) {', 1, '矩阵档签名带 tb'],
    ['planner.js', 'flat[to].locked = 1;', 1, '手动移动成功即视为「用户钉过这一站」——这就是本批要修的原始 bug 的解'],
    /* 钉住的下标是按「用户看到的那一序」算的：屏上顺序不写回选点集，下一次重排就按选点时的旧序插回，
       锁定的站还是会被挪位；移掉的站同理会整站回来。三处出口各钉一条。 */
    ['planner.js', 'state.selected = ordered;', 2, '排期落档与高德规划两条入口都把排好的顺序写回选点集'],
    ['planner.js', 'state.selected = flat.slice();', 2, '手动调序与编辑选点都把当前站点序写回选点集'],
    ['planner.js', 'state.selected = flatStops();', 1, '移站要同时退出选点集，否则「重新排期」把它捞回行程'],
    ['planner.js', 'window.plannerLockStop = function (di, si) {', 1, '图钉的唯一出口'],
    ['planner.js', 's.locked = s.locked ? 0 : 1;', 1, '切换只认 0/1（trip JSON 里第三种值＝下一次 filter 的判据说不清）'],
    ['planner.js', 'function lockedCount() { return flatStops().filter(function (s) { return s.locked; }).length; }', 1, '计数单点：向导与结果页两处提示共用'],
    ['planner.js', "return n ? '<span class=\"lk-hint\">' + TI('pinned', 13) + n + ' 站已锁定 · 自动重排不参与</span>' : '';", 1, '提示只在有锁定时出现（0 站还挂一句是噪音）'],
    ['planner.js', "var tb = modeOf(w.travelBy);", 1, '排期落档单点'],
    ['planner.js', 'travelBy: tb,', 1, '新建行程把档位写进 trip（不存＝下次打开回到自驾）'],
    ['planner.js', "travelBy: modeOf(travelByNow()),", 1, 'AI 精选那条路径同样存档（漏一处就是两个入口两种口径）'],
    ['planner.js', "if (state.wiz) state.wiz.travelBy = m;", 1, '结果页换档要回写向导，否则回到向导看到的还是上一轮口径'],
    ['planner.js', 'window.plannerTravelBy = function (m) {', 1, '档位切换单点'],
    ['planner.js', "var TB_ORDER = ['auto', 'drive', 'bike', 'walk'];", 1, '档位顺序单点（结果页与向导共用一组）'],
    ['planner.js', 'function travelByRow(trip) {', 1, '结果页切换条'],
    ['planner.js', 'persistTrip(); resplitTrip();', 2, '两个出口都「先存再重切」（删站 + 换档）：换档不 persist 的话刷新回到旧档，账白算'],
    ['planner.js', "toast('出行方式：' + MODE[m].label + ' · '", 1, '换档要说清换了什么口径（本地估算还是真实道路），点下去没反应比点错更难查'],
    ['planner.html', '.mv.on{background:var(--color-primary)', 1, '钉住态必须看得出来（不点亮，用户以为顺序还是算出来的）'],
    ['planner.html', '.lk-hint{', 1, '锁定提示样式在案'],
    ['planner.html', '#tbRow{margin:', 1, '档位切换条留位'],
    /* ④ 分享载荷：短键登记，钱仍然不进 */
    ['share.js', "if (s && s.locked) st.k = 1;", 1, '钉住标记进载荷（只有 1 才带；方案 8.2.6 要求登记 locked，短键命名收成 k，偏离在文档 8.6 登记）'],
    ['share.js', "b: /^(auto|drive|bike|walk)$/.test(trip && trip.travelBy ? String(trip.travelBy) : '') ? String(trip.travelBy) : '',", 1, '出行方式进载荷且只认这四值（脏值宁可不带，不发一个收件人看不懂的字）'],
    ['share.js', "var TB_LAB = { auto: '按站距自动选（步行/骑行/自驾）', drive: '自驾', bike: '骑行', walk: '步行' };", 1, '档位中文名在分享侧的唯一定义'],
    ['share.js', "payloadOf: payloadOf, strayKeys: strayKeys, ALLOWED: ALLOWED, TB_LAB: TB_LAB,", 1, 'TB_LAB 必须导出：share.html 拿不到就是各写一套'],
    ['share.html', 'Share.TB_LAB[p.b]', 2, '收件人看到的档位来自 share.js 单点（存在判定 + 取值，两处都走它就不可能有第二套名字）'],
    ['share.html', "'钉住</span>'", 1, '钉住标记在只读页有呈现（进了载荷却不渲染＝死数据）'],
    ['share.html', "'日卡里程按直线折算，是估算不是实测'", 1, '只读页不再重抄系数（两处各写一个 1.35 迟早一升一降）'],
    ['tools/smoke-planner.js', 'setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })', 7, 'smoke-planner 全程用手机档量（桌面宽度量出来的档位排版与触控不作数）'],
    ['tools/smoke-planner.js', 'setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true })', 1, '真机档（一加 Ace6T）量一次切换条：四颗 chip + 一句「公共交通未覆盖」是这一批新加的行，窄屏挤不挤要有人量'],
    ['tools/smoke-planner.js', 'stale === false', 5, '档位/锁定那族判据逐个要求「读到的 trip 与屏上日卡同一份序」：重新排期会换新 id，不重存就读 localStorage＝拿旧账算单调关系（全绿但是假的）'],
  ];
  A33.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F33('A33 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V33)) { F33('A33 登记了 §33 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt33(V33[file], needle);
    if (got !== want) F33(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A33.length < 61) F33('锚点表被削减：' + A33.length + ' 条（批次 20 落地时实测 61 条，整组删掉就等于这节没了）');

  /* ③ 结构断言：锁定必须真的在两条重排路径里各生效一次（字符串锚只证明 withLocked 存在过） */
  {
    const OS = fnBody33(V33['planner.js'], 'function orderStops(sel, start, tb) {');
    if (!OS) F33('抽不出 orderStops 函数体（「地理档经过锁定」这条断言失去依据）');
    else if (cnt33(OS, 'withLocked(') !== 1) F33('orderStops 体里 withLocked( 不是恰 1 次：地理档这条路不认锁定了');
    const OM = fnBody33(V33['planner.js'], 'function orderByMatrix(sel, start, dist, tb) {');
    if (!OM) F33('抽不出 orderByMatrix 函数体（「矩阵档经过锁定」这条断言失去依据）');
    else if (cnt33(OM, 'withLocked(') !== 1) F33('orderByMatrix 体里 withLocked( 不是恰 1 次：高德档这条路不认锁定了');
    /* 重排的实活在 orderFree* 里，它们自己不许再碰 locked（两处都 filter＝插回两次，顺序会重复） */
    const OFG = fnBody33(V33['planner.js'], 'function orderFreeByGeo(sel, start, tb) {');
    if (!OFG) F33('抽不出 orderFreeByGeo 函数体');
    else if (cnt33(OFG, '.locked') !== 0) F33('orderFreeByGeo 体里出现 .locked：过滤不该在两条路径各写一遍');
    const OFM = fnBody33(V33['planner.js'], 'function orderFreeByMatrix(sel, start, dist, tb) {');
    if (!OFM) F33('抽不出 orderFreeByMatrix 函数体');
    else if (cnt33(OFM, '.locked') !== 0) F33('orderFreeByMatrix 体里出现 .locked：同上');
    const MV = fnBody33(V33['planner.js'], 'window.plannerMoveStop = function (di, si, dir) {');
    if (!MV) F33('抽不出 plannerMoveStop 函数体（「移动即钉」的结构断言失去依据）');
    else if (cnt33(MV, 'locked = 1') !== 1) F33('plannerMoveStop 体里 locked = 1 不是恰 1 次：移动不留痕，下一次自动重排照样把它打散');
    const CTRL33 = flat33("function orderStops(sel, start, tb) { return withLocked(sel, f); } function plannerMoveStop(di) { s.locked = 1; }");
    if (cnt33(CTRL33, 'withLocked(') !== 1 || cnt33(CTRL33, 'locked = 1') !== 1)
      F33('上面四条函数体断言的正向对照失效了（那些 0/1 不是证据）');
  }

  /* ③b 结构断言：重切要落盘、标题与锁定提示要在日卡那一次渲染里一起动 */
  {
    const RS = fnBody33(V33['planner.js'], 'function resplitTrip() {');
    if (!RS) F33('抽不出 resplitTrip 函数体（「重切后必须落盘」这条断言失去依据）');
    else if (cnt33(RS, 'persistTrip();') !== 1) F33('resplitTrip 体里 persistTrip(); 不是恰 1 次：换档改了日卡却不重存，从「已保存行程」重开看到的是旧档算出来的数');
    const RD = fnBody33(V33['planner.js'], 'function renderDaysBody() {');
    if (!RD) F33('抽不出 renderDaysBody 函数体');
    else {
      if (cnt33(RD, "$id('resultTitle').textContent") !== 1) F33('renderDaysBody 体里 resultTitle 赋值不是恰 1 次：标题不跟日卡同一次渲染动＝换档后两个口径同屏');
      if (cnt33(RD, 'lockedHint()') !== 1) F33('renderDaysBody 体里 lockedHint( 不是恰 1 次：钉完站提示不当场出现');
    }
    const RR = fnBody33(V33['planner.js'], 'function renderResult() {');
    if (!RR) F33('抽不出 renderResult 函数体');
    else if (cnt33(RR, 'resultTitle') !== 0) F33('renderResult 体里还有 resultTitle：标题算了两处（重画日卡那条路径不经过它，就是旧数挂在屏上）');
    const CTRL33B = flat33("function resplitTrip() { persistTrip(); } function renderDaysBody() { $id('resultTitle').textContent = x; var lk = $id('lkSlot'); lk.innerHTML = lockedHint(); } function renderResult() { travelByRow(t); }");
    if (cnt33(CTRL33B, 'persistTrip();') !== 1 || cnt33(CTRL33B, "$id('resultTitle').textContent") !== 1 ||
      cnt33(CTRL33B, 'lockedHint()') !== 1 || cnt33(CTRL33B, 'resultTitle') !== 1)
      F33('上面四条函数体断言的正向对照失效了（那些 0/1 不是证据）');
  }

  /* 期望 0：旧尺子残留、硬编码文案、裸 mkLeg、未承诺的路由源 */
  const ZERO33 = [
    ['planner.js', 'AVG_KMH', "var AVG_KMH = 60, ROAD_FACTOR = 1.35;", '单值均速常量必须不再存在：存在就意味着某个入口还在用一把没分档的尺子'],
    ['planner.js', 'ROAD_FACTOR', "var AVG_KMH = 60, ROAD_FACTOR = 1.35;", '同上'],
    ['planner.js', '日卡里程按直线 ×1.35 折算（未取真实道路数据）', "return '日卡里程按直线 ×1.35 折算（未取真实道路数据）';", '文案里重抄系数：改了 MODE 表改不了这句话，两本账回来'],
    ['planner.js', '这段路超过单日驾驶上限', "h += '这段路超过单日驾驶上限，单独成一天';", '动词写死「驾驶」：骑行档的转场日不该被说成开车'],
    ['planner.js', 'mkLeg(null)', "var leg = mkLeg(null);", '裸 mkLeg(null)＝漏传档位的调用点（默认回自驾，界面上没人看得出这一段被当成开车算）'],
    ['planner.js', 'mkLeg(matrix)', "var days = mkLeg(matrix);", '同上，排期入口'],
    ['planner.js', 'mkLeg(trip.dist)', "var leg = mkLeg(trip.dist);", '同上，日卡路径'],
    ['planner.js', 'mkLeg(state.trip.dist)', "state.trip.days = splitIntoDays(flat, mkLeg(state.trip.dist));", '同上，重切分路径'],
    ['planner.js', "sortMode === 'walk'", "if (w.sortMode === 'walk') {", '出行方式不许挤进 sortMode：排线依据与算时长的档是两个正交轴（合并要造四个组合值，而「重新排期」只该改后者）'],
    ['planner.js', "sortMode === 'bike'", "if (w.sortMode === 'bike') {", '同上'],
    ['planner.js', 'router.project-osrm.org', "fetch('https://router.project-osrm.org/route');", '公开 OSRM 实例只有 driving profile：写进来就是兑现不了的承诺'],
    ['share.js', '直线 ×1.35', "return '里程按直线 ×1.35 折算（估算）';", '分享侧同样不许重抄系数'],
    ['share.html', '直线 ×1.35', "h += '日卡里程按直线 ×1.35 折算，是估算不是实测';", '同上'],
    ['share.js', "locked: 1", "var ALLOWED = { locked: 1 };", '载荷用短键 k：8.2.6 说的 locked 是字段语义不是键名（这条钉的是「别把长键写进来把白名单撑爆」）'],
    ['planner.js', 'totalKm', "var totalKm = trip.days.reduce(function (s, d) { return s + d.driveKm; }, 0);", '旧标题用局部 totalKm 单独算全程（换档后不跟日卡动）；现在标题从 days 现算，残留一个 totalKm＝两处两个口径'],
  ];
  ZERO33.forEach(([f, needle, ctrl, why]) => {
    if (cnt33(V33[f], needle) !== 0) F33(f + ' 里出现「' + needle + '」：' + why);
    if (cnt33(flat33(ctrl), needle) < 1) F33('「' + needle + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* osrm 全站扫一遍（不只 planner：承诺一旦写在某个角落，就有人照着它等一个不会来的功能） */
  let osrmScope33 = 0;
  {
    const osrmFiles = fs.readdirSync('.').filter(f => /\.js$/.test(f) && fs.statSync(f).isFile());
    osrmScope33 = osrmFiles.length;
    let hits = 0;
    osrmFiles.forEach(f => { if (rd33(f).indexOf('project-osrm.org') >= 0) hits++; });
    if (hits) F33('全站根目录 JS 里出现 project-osrm.org 的文件数 ' + hits + '（本批不承诺 OSRM，见方案 8.2.3）');
    if (osrmFiles.length < 40) F33('全站扫描只覆盖到 ' + osrmFiles.length + ' 个根 JS 文件，这条期望 0 已经退化成没扫（预期 ≥40）');
  }

  /* 浏览器腿：T0／T0b／T1–T12 一条不许少（探针自校准、档位单调、1.5km 走步行、移动后重排顺序不变、locked 存回） */
  ["ok('T0 ", "ok('T0b "].forEach(n => {
    if (V33['tools/smoke-planner.js'].indexOf(n) < 0)
      F33('tools/smoke-planner.js 缺 ' + n.trim() + ' 这条（造点快照有没有恢复、读的是不是当前那份 trip——下面 12 条的数值全靠这两条兜底）');
  });
  for (let i = 1; i <= 12; i++) {
    if (V33['tools/smoke-planner.js'].indexOf("ok('T" + i + ' ') < 0)
      F33('tools/smoke-planner.js 缺 T' + i + ' 这条判据（批次 20 的 12 条档位/锁定判据是一整组，少一条就是有个症状没人管）');
  }

  if (V33['README.md'].indexOf('§33') < 0) F33('README.md 的 verify 清单没提 §33（新闸门不写进 README 就等于没装）');
  if (V33['docs/功能完善实施方案-2026-10-05.md'].indexOf('批次 20 已实施') < 0)
    F33('方案文档没登记「批次 20 已实施」（收工状态只能靠文档留在案上）');
  /* 两条偏离必须在文档里留字，否则下一个人会照着 8.2/8.3 的原文再找一遍代码 */
  if (V33['docs/功能完善实施方案-2026-10-05.md'].indexOf('不扩 `sortMode`，另立 `travelBy` 轴') < 0)
    F33('方案文档没登记「出行方式不扩 sortMode」这条偏离（8.3 原文要求扩枚举）');
  if (V33['docs/功能完善实施方案-2026-10-05.md'].indexOf('端点在本机无法实查') < 0)
    F33('方案文档没登记「高德 walking/bicycling 端点无法实查」的否定读数（8.2.2 要求先实查再定档）');

  console.log('路线档位闸门: ' + A33.length + ' 条代码锚点（MODE 四档六数逐值 + 自动档两阈值 + mkLeg 形参带档 + 矩阵只喂自驾 + 动词/文案从表派生 + withLocked 单点与两条重排路径 + 移动即钉 + 档位单点 + 分享 b/k 与 TB_LAB 导出）+ 九处函数体结构断言（orderStops/orderByMatrix 各恰一次 withLocked、orderFree* 两处零 locked、plannerMoveStop 恰一次 locked=1、resplitTrip 恰一次 persistTrip、renderDaysBody 里标题赋值与 lockedHint 各恰一次、renderResult 里 resultTitle 恰零次）+ 十五族期望 0（旧单值常量/硬编码 ×1.35/写死「驾驶」/裸 mkLeg/sortMode 挤档/OSRM/share 重抄系数/长键 locked/旧标题 totalKm）+ osrm 全站 ' + osrmScope33 + ' 个根 JS 扫 + smoke T0／T0b／T1–T12 齐备检（T0b 是探针自校准：读到的 trip 必须与屏上同序）；每条期望 0 都配正向对照；变异自测见 tools/out/mut-verify33.js');
  fail += bad33;
}

/* ============ §34 「这一带还有什么」闸门（批次 21） ============
   这一批的立论只有一句话：离线也能回答「这一带还有什么」，联网只是补位。
   它的坏法同样全是静默的——把两条腿的顺序换一下，界面上一个字都不变，但每一张
   没有缓存的手机上这个功能从「秒回」变成「转圈八秒然后什么都没有」；把 8s 超时摘掉，
   限流时面板永远不出；把来源口径写混，用户分不清「这一带真的没有」还是「没网没查」。
   所以源码侧钉四族：
   ① 合流函数体内的**顺序**（nearbySites 的命中位置必须早于 overpassNearby，且各恰一次）——
      这是本节的灵魂，用位置比而不是用「存在性」存在性检查；
   ② 三个数字（BUILTIN_ENOUGH=4 / OVERPASS_TIMEOUT_MS=8000 / MAX_OSM=12）与 LIVE_NOTE 整串逐值钉，
      超时/中断/回调只落一次三条各钉一处（限流是常态，重试与二次回调只会把对面拖得更死）；
   ③ 来源口径必须写进 DOM：内置「内置库 · N 处」＋脚注「来源：包内景点库，离线可用」、
      实时「内置 x · 实时 y」＋脚注逐字等于 LIVE_NOTE、空态按 res.offline 分叉成两句话
      （离线与「查了没返回」是两件不同的事，混写成一句就是让用户去查自己的网）；
   ④ UI 侧只有 queryNearby 一个入口（overpassNearby 在 topic-common.js 期望 0——绕过合流口
      就是绕过顺序），chip 是「武装一次取点」而不是常驻开关（默认点击语义不许变），
      面板开在下半屏时 raiseCenterClear 必须把圆心抬到面板上沿之上（新加的这条自己也要有锚）。
   口径同 §28/§31/§32/§33：四元组守卫、期望 0 一律配正向对照、锚点串不落块注释、.html 只归一空白不剥注释。
   ============================================================ */
{
  let bad34 = 0;
  const F34 = m => { bad34++; console.log('FAIL §34 附近查询闸门: ' + m); };
  const ws34 = s => s.replace(/\s+/g, ' ').trim();
  const flat34 = s => ws34(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt34 = (s, n) => s.split(n).length - 1;
  const rd34 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view34 = f => /\.html$/.test(f) ? ws34(rd34(f)) : flat34(rd34(f));
  const fnBody34 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };

  const FILES34 = ['nearby.js', 'topic-common.js', 'topic.html', 'sw.js',
    'tools/smoke-nearby.js', 'README.md'];
  const V34 = {};
  FILES34.forEach(f => {
    if (!fs.existsSync(f)) { F34('缺 ' + f); V34[f] = ''; return; }
    V34[f] = view34(f);
  });

  const A34 = [
    /* ① 数据层：常量逐值 + 两条腿 + 合流（顺序另走位置比，见结构断言） */
    ['nearby.js', "var OVERPASS_URL = 'https://overpass-api.de/api/interpreter';", 1, '补位源单点：换镜像要在这里换，不许在调用点各写一个域名'],
    ['nearby.js', 'var OVERPASS_TIMEOUT_MS = 8000;', 1, '超时读产品常量，闸门与 smoke 都不写死秒数（smoke N46 就是从常量推窗口）'],
    ['nearby.js', 'var BUILTIN_ENOUGH = 4;', 1, '内置凑满几条就不联网：这个数就是「第一答案是包内索引」的量化口径'],
    ['nearby.js', 'var MAX_OSM = 12;', 1, '补位结果上限：不限条数会让实时那几十条淹掉内置答案'],
    ['nearby.js', "var LIVE_NOTE = '以下为实时查询（OSM），离线不可用';", 1, '来源口径整串钉死（界面脚注、弹层、smoke 三处比的是同一个串）'],
    ['nearby.js', 'function nearbySites(lat, lng, rKm, cats, exclude) {', 1, '内置腿入口'],
    ['nearby.js', 'if (d <= r) out.push(', 1, '半径过滤单点（Geo.hav 纯本地，无任何网络）'],
    ['nearby.js', 'out.sort(byFlagThenDist);', 1, '内置结果按「必去/网红优先、同权重距离升序」'],
    ['nearby.js', 'var w = (FLAG_WEIGHT[b.flag] || 0) - (FLAG_WEIGHT[a.flag] || 0); return w !== 0 ? w : a.d - b.d;', 1, '权重表派生的比较函数单点（写死 flag 字符串就是第二套排序）'],
    ['nearby.js', "src: '内置'", 1, '内置腿每条带来源标记'],
    ['nearby.js', "src: '实时查询'", 1, '补位腿每条带来源标记（不标记就是两种答案混成一锅）'],
    ['nearby.js', 'function overpassQuery(lat, lng, rKm) {', 1, '查询语句构造单点（smoke 断言的是这一条产出的串）'],
    ['nearby.js', 'var radius = Math.round((+rKm > 0 ? +rKm : DEFAULT_RKM) * 1000);', 1, 'km→米换算单点：漏乘 1000 时 around 半径变成 30 米，界面照样显示「30km」'],
    ['nearby.js', "'[out:json][timeout:8];('", 1, '响应格式与服务端超时（服务端 8s 与本地 8s 同口径，别让对面等更久）'],
    ['nearby.js', 'node["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|zoo)$"](', 1, '只对这几类兴趣点补位——node 腿（点要素）'],
    ['nearby.js', 'way["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|zoo)$"](', 1, 'way 腿（面要素）：只查 node 会漏掉整个景区多边形，这条与上一条必须同时在'],
    ['nearby.js', "body: 'data=' + encodeURIComponent(overpassQuery(lat, lng, rKm)),", 1, 'Overpass 要的是 data= 表单，不是 JSON body：写错对面直接 400'],
    ['nearby.js', 'signal: ctl ? ctl.signal : undefined', 1, '超时要真能把请求掐掉（只 clearTimeout 不 abort，请求还在对面跑着）'],
    ['nearby.js', 'var timer = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } done(null); }, OVERPASS_TIMEOUT_MS);', 1, '到点即弃、不排队重试'],
    ['nearby.js', 'function done(list) { if (settled) return; settled = true; clearTimeout(timer); cb(list || null); }', 1, '回调只落一次（超时与响应竞速时二次 cb 会把面板渲染两遍、第二遍还是空态）'],
    ['nearby.js', 'if (!r || !r.ok) { done(null); return null; }', 1, '429/504 一律当「这次问不到」：限流是常态，不弹错、不重试'],
    ['nearby.js', '}).catch(function () { done(null); });', 1, '网络异常静默降级'],
    ['nearby.js', "if (!hav || !isFinite(+lat) || !isFinite(+lng) || typeof global.fetch !== 'function') { cb(null); return; }", 1, '没有 fetch / 没有 Geo / 非法坐标都不发请求（老内核与坏入参走同一条静默路）'],
    ['nearby.js', '.sort(function (a, b) { return a.d - b.d; }).slice(0, MAX_OSM);', 1, '补位结果按距离升序并截断'],
    ['nearby.js', 'function queryNearby(lat, lng, rKm, cats, cb, exclude) {', 1, '合流口（UI 唯一入口）'],
    ['nearby.js', 'var offline = !global.navigator || global.navigator.onLine === false;', 1, '有网判定单点（navigator 缺失按离线处理：宁可不问，也不在没网的机器上转八秒圈）'],
    ['nearby.js', 'if (hits.length >= BUILTIN_ENOUGH || offline) {', 1, '够四条或没网 → 直接回内置，一次请求都不发'],
    ['nearby.js', 'cb({ items: hits, builtin: hits.length, osm: 0, live: false, offline: offline });', 1, '内置分支把 offline 带出去（文案要分叉成「离线补不了」与「查了没返回」两句话）'],
    ['nearby.js', 'cb({ items: hits.concat(extra), builtin: hits.length, osm: extra.length, live: extra.length > 0, offline: false });', 1, '内置在前、补位在后拼成一份列表（顺序与本节灵魂同向）'],
    ['nearby.js', 'global.Nearby = {', 1, '模块导出单点'],
    /* ② UI 入口：一次性武装 + 合流口 + 层级与让位 */
    ['topic-common.js', 'if (nearMode || M.nearEnabled) { nearMode = false; syncChips(); nearPick(e.latlng); return; }', 1, '取点即复位（chip 亮着不复位＝用户以为还在取点模式，下一张卡就记错了地方）'],
    ['topic-common.js', 'Nearby.queryNearby(lat, lng, km, null, function (res) {', 1, 'UI 走合流口这一条腿'],
    ['topic-common.js', 'var a = Nearby.nearbySites(lat, lng, 0.2);', 1, '锚点排除：点在哪处景点就不该把用户已经站着的那处再列一遍'],
    ['topic-common.js', 'nearP = [latlng.lat, latlng.lng];', 1, '圆心留痕（抬心与半径条都读它）'],
    ['topic-common.js', "mkChip('这一带', false, '#AE5738')", 1, '与既有筛选同框（必去/网红之后）'],
    ['topic-common.js', "if (nearMode) { nearMode = false; syncChips(); showTripToast('已取消「这一带」取点'); return; }", 1, '取消要有反馈：点亮与熄灭两种状态都得说一句'],
    ['topic-common.js', 'raiseCenterClear(sh);', 1, '渲染完就检查圆心是否被面板盖住（调用点必须在 add("open") 之后，否则量到的是 display:none 的 0 高盒子）'],
    ['topic-common.js', 'function raiseCenterClear(sh) {', 1, '抬心单点'],
    ['topic-common.js', 'if (p.y > want) map.panBy([0, p.y - want], { animate: false });', 1, 'panBy 的符号是「视口往哪走」不是「内容往哪走」：实测 panBy([0,-120]) 会把同一个点从 y=430 推到 550（真机档 452×995 下半屏量出来的）'],
    ['topic-common.js', 'hideNearBar(); hideNearSheet();', 2, '半径条与面板层级 1200/1210 都在景点卡（#locSheet z 50）之上：不收起就会浮在卡片上——批次 21 自查出来的真缺陷。两处各管一条关闭路径（#nearX 手动关 / 点内置项进卡）'],
    /* ③ 来源口径写进 DOM */
    ['topic-common.js', "'内置 ' + res.builtin + ' · 实时 ' + res.osm", 1, '混过补位就说清各几条（只印「12 处」会让人以为这 12 条都离线可用）'],
    ['topic-common.js', "'内置库 · ' + res.builtin + ' 处'", 1, '纯内置时的口径'],
    ['topic-common.js', '来源：包内景点库，离线可用', 1, '内置脚注整串'],
    ['topic-common.js', "(res.offline ? '，离线也补不了实时查询' : '，实时查询这次也没返回')", 1, '空态两句话分叉：离线与「查了没返回」是两件事（写成一句会把没网的用户支去查路由器）'],
    ['topic-common.js', "nearSheet.setAttribute('aria-label', '这一带还有什么');", 1, '面板有无障碍名（批次 22 的读法与这里同源）'],
    /* ④ 壳与页面：文件在、进了预缓存 */
    ['topic.html', '<script src="nearby.js"></script>', 1, '页面挂了模块（§29 的反向对账管「页面依赖没进 SHELL」，这条钉反方向：SHELL 有而页面没挂＝死文件）'],
    ['sw.js', "'./nearby.js',", 1, '预缓存在案：这个功能的立论就是离线可用，不在壳里就是首屏即无'],
    ['tools/smoke-nearby.js', 'setOfflineMode(true)', 1, '断网腿走 CDP 真断网（读 navigator.onLine 的桩自己也算被测对象）'],
    ['tools/smoke-nearby.js', '= await toOffline(', 2, '全国页与省页各断一次网：两条入口都要在「物理没网」下出结果'],
  ];
  A34.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F34('A34 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V34)) { F34('A34 登记了 §34 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt34(V34[file], needle);
    if (got !== want) F34(file + ' 里「' + needle + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A34.length < 42) F34('锚点表被削减：' + A34.length + ' 条（批次 21 落地时实测 49 条，阈值取 42——删到 41 条就红，整组删掉就等于这节没了）');

  /* ① 灵魂：合流函数体内两条腿的先后（存在性检查守不住顺序，必须比位置） */
  {
    const QB = fnBody34(V34['nearby.js'], 'function queryNearby(lat, lng, rKm, cats, cb, exclude) {');
    if (!QB) F34('抽不出 queryNearby 函数体（本节的灵魂断言失去依据）');
    else {
      const i1 = QB.indexOf('nearbySites('), i2 = QB.indexOf('overpassNearby(');
      if (i1 < 0) F34('queryNearby 体里没有 nearbySites(：内置腿被摘掉，「离线也能回答这一带」当场失效');
      if (i2 < 0) F34('queryNearby 体里没有 overpassNearby(：补位腿被摘掉，界面会长期只列内置那几条却仍写着「这一带还有什么」');
      else if (i1 >= i2) F34('queryNearby 体里 overpassNearby( 排在 nearbySites( 之前：第一答案必须是包内索引（免 Key／离线／秒回），顺序一换，每张没缓存的手机都变成「转圈八秒然后什么都没有」');
      if (cnt34(QB, 'nearbySites(') !== 1) F34('queryNearby 体里 nearbySites( 不是恰 1 次：合流口又分叉了');
      if (cnt34(QB, 'overpassNearby(') !== 1) F34('queryNearby 体里 overpassNearby( 不是恰 1 次：点一次图发两回查询，限流的是对面');
    }
    /* 反向对照：网络在前的改前形态必须打红（否则上面那条位置比是恒真判据）；
       正向对照：内置在前的合成源不许打红（否则它守的不是顺序而是某一种写法）。 */
    const MUT = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { overpassNearby(lat, lng, rKm, function (osm) { cb({ items: osm || [] }); }); var hits = nearbySites(lat, lng, rKm, cats, exclude); }');
    if (!(MUT.indexOf('overpassNearby(') < MUT.indexOf('nearbySites(')))
      F34('顺序断言的反向对照失效：合成的「网络在前」源码都没触发它，那它对真源码的 PASS 就不是证据');
    const GOOD = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { var hits = nearbySites(lat, lng, rKm, cats, exclude); overpassNearby(lat, lng, rKm, function () {}); cb(hits); }');
    if (!(GOOD.indexOf('nearbySites(') < GOOD.indexOf('overpassNearby(')))
      F34('顺序断言的正向对照失效：合成的「内置在前」源码也触发它，那这条锚会不分对错一直红');
  }

  /* 抬心函数的结构断言：它必须真的读面板盒子并只在压住时才挪（无条件 panBy 会让每次查询都跳一下视图） */
  {
    const RC = fnBody34(V34['topic-common.js'], 'function raiseCenterClear(sh) {');
    if (!RC) F34('抽不出 raiseCenterClear 函数体（抬心这条断言失去依据）');
    else {
      if (cnt34(RC, 'getBoundingClientRect()') !== 2) F34('raiseCenterClear 体里 getBoundingClientRect() 不是恰 2 次（面板 + 地图容器各一次）：少一次就是拿屏幕坐标去比容器坐标');
      if (cnt34(RC, 'map.panBy(') !== 1) F34('raiseCenterClear 体里 map.panBy( 不是恰 1 次：挪两处等于每次查询视图跳两下');
      if (RC.indexOf('if (p.y > want)') < 0) F34('raiseCenterClear 里没有 p.y > want 守卫：没压住也要挪＝每查一次地图自己滑一下');
    }
    const CTRL34 = flat34('function raiseCenterClear(sh) { var p = m.latLngToContainerPoint(x); var cr = sh.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect(); var want = (cr.top - mr.top) - 40; if (p.y > want) map.panBy([0, p.y - want], { animate: false }); }');
    if (cnt34(CTRL34, 'getBoundingClientRect()') !== 2 || cnt34(CTRL34, 'map.panBy(') !== 1 || CTRL34.indexOf('if (p.y > want)') < 0)
      F34('上面三条抬心断言的正向对照失效了（那些 2/1 不是证据）');
  }

  /* 期望 0：数据层不越界、UI 不走旁路、补位结果不进事实表 */
  const ZERO34 = [
    ['nearby.js', 'SEED', "var SEED = { '西湖': { p: 1 } };", '实时查询的结果不许写进门票/事实 SEED：OSM 的 name 没有审核，混进去就是拿第三方数据冒充自己核过的事实'],
    ['nearby.js', 'localStorage', "localStorage.setItem('tn_near_cache', s);", '数据层不落盘：缓存一份实时答案＝把「这一带有什么」变成「上周有什么」，而离线腿的可信度全靠它是现算的'],
    ['nearby.js', 'sessionStorage', "sessionStorage.setItem('k', v);", '同上'],
    ['nearby.js', 'toast', "UI.toast('查询失败，请检查网络');", '数据层零 UI：失败一律静默降级（弹错给离线用户看没有意义，文案归渲染层）'],
    ['nearby.js', 'confirm', "window.confirm('重试？');", '同上，数据层不许弹确认框'],
    ['nearby.js', 'setInterval', 'setInterval(function () { go(); }, 1000);', '不排队重试：限流是常态，重试只会把下一次也拖慢（§18 天气队列同款口径）'],
    ['nearby.js', 'retryTimes', 'var retryTimes = 3;', '同上'],
    ['nearby.js', 'amap', "fetch('https://restapi.amap.com/v3/place/around');", '补位只用 OSM 一条腿：高德周边搜要先配 Key，写进这里等于把离线承诺换成登录承诺'],
    ['topic-common.js', 'overpassNearby(', 'overpassNearby(30, 120, 10, cb);', 'UI 只能走 queryNearby 这个合流口：直接调网络腿就是绕过「内置先跑」的顺序（本节的灵魂）'],
    ['topic-common.js', 'Notification', "new Notification('这一带有 12 处');", '这一带的提醒只有页内一条腿（批次 17 的红线延续到批次 21）'],
    ['topic-common.js', "fetch('https://overpass", "fetch('https://overpass-api.de/api/interpreter');", '页面侧不许自己拼 Overpass 请求：URL 与查询语句都在数据层，两处各写就是两份口径'],
    ['sw.js', 'overpass-api.de', "var SHELL = ['./index.html', 'https://overpass-api.de/api/interpreter'];", '第三方接口不进预缓存壳（它不是本地文件，塞进去只会让装机首屏白等）'],
  ];
  ZERO34.forEach(([f, needle, ctrl, why]) => {
    if (cnt34(V34[f], needle) !== 0) F34(f + ' 里出现「' + needle + '」：' + why);
    if (cnt34(flat34(ctrl), needle) < 1) F34('「' + needle + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* 浏览器腿：N01–N47 一条不许少（§31 同一课：改名成 N16x 也要红，所以认「id + 空格」） */
  const pad34 = i => 'N' + (i < 10 ? '0' + i : '' + i);
  for (let i = 1; i <= 47; i++) {
    if (V34['tools/smoke-nearby.js'].indexOf("ok('" + pad34(i) + ' ') < 0)
      F34('tools/smoke-nearby.js 缺 ' + pad34(i) + ' 这条判据（批次 21 的离线/补位/来源/降级四组判据是一整组，少一条就是有个症状没人管）');
  }
  ["ok('N17c ", "ok('N28a "].forEach(n => {
    if (V34['tools/smoke-nearby.js'].indexOf(n) < 0)
      F34('tools/smoke-nearby.js 缺 ' + n.trim() + ' 这条（N17c 是下半屏抬心的实测腿，N28a 是省页「有可用取样点」的前置——缺它们那两个断言就是恒真）');
  });
  if (cnt34(V34['tools/smoke-nearby.js'], "ok('N") !== 49)
    F34('tools/smoke-nearby.js 的判据条数不是 49：' + cnt34(V34['tools/smoke-nearby.js'], "ok('N") + ' 条（批次 21 落地时实测 49 条＝N01–N47 加 N17c／N28a 两条派生；整组削减等于把这节拆了）');

  if (V34['README.md'].indexOf('§34') < 0) F34('README.md 的 verify 清单没提 §34（新闸门不写进 README 就等于没装）');

  console.log('附近查询闸门: ' + A34.length + ' 条代码锚点（三个数字逐值 + 两条腿各钉入口 + 超时/中断/回调只落一次 + 来源口径四串整串钉进 DOM + 抬心与层级两处 + 壳与页面各一条）+ 灵魂顺序断言（queryNearby 体内 nearbySites 命中位置早于 overpassNearby 且各恰一次，反向合成的「网络在前」必红、正向合成的「内置在前」必不红）+ 抬心函数体三条（两次 getBoundingClientRect、一次 panBy、p.y > want 守卫）+ 十二族期望 0（SEED/localStorage/toast/confirm/setInterval/retry/高德周边/页面直调 overpassNearby/Notification/第三方进壳）；每条期望 0 都配正向对照；smoke N01–N47 齐备检 + 条数守卫（49）+ 断网两条腿在案');
  fail += bad34;
}

/* ============ §36 无障碍三类关键结构闸门（批次 22） ============
   这一批的东西坏了全都「看不出来」：aria-label 拼成空串、活区带字一次插入、Tab 跑出弹层、
   Esc 关不掉、焦点还不回触发元素——界面一个字都没变，读屏用户却整段用不了。
   所以源码侧只钉两类东西：①单点（同一族语义只允许有一个出处，复制粘贴必红）；
   ②顺序（这一批的灵魂全是顺序，存在性检查一条都守不住）：
     · 活区先「空着」入 DOM、文案下一帧再写；aria-live 属性必须和节点一起进去；
     · trapFocus 的 SVG/禁用过滤必须排在 first/last 取值之前（否则过滤了个寂寞）；
     · sheet.open 的「已开着就只换内容」守卫必须排在 aria-modal 与 classList.add 之前；
     · 重画（setIcon）之后必须补回 marker 的名字与 Enter。
   期望 0 那一族钉的是「旧写法不许回潮」：弹层开合只有一个入口，各页 classList.add('show')
   的裸开关、页面私搭 aria-live、node-lod 自己 setAttribute('aria-label') 全部为零。
   口径同 §28/§31/§32/§33/§34：四元组守卫、期望 0 一律配正向对照、.js 视图剥块注释、
   .html 视图只归一空白不剥注释，所以锚点串一律写成归一后的整串。
   ============================================================ */
{
  let bad36 = 0;
  const F36 = m => { bad36++; console.log('FAIL §36 无障碍闸门: ' + m); };
  const ws36 = s => s.replace(/\s+/g, ' ').trim();
  const flat36 = s => ws36(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt36 = (s, n) => s.split(n).length - 1;
  const rd36 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view36 = f => /\.html$/.test(f) ? ws36(rd36(f)) : flat36(rd36(f));
  const fnBody36 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };

  const FILES36 = ['ui.js', 'design.css', 'topic-common.js', 'topic.html', 'node-manager.html',
    'travel-map.html', 'node-lod.js', 'planner.js', 'share.html', 'story.html', 'wishlist.html',
    'travel-notes.js', 'README.md', 'tools/smoke-aria.js'];
  const V36 = {};
  FILES36.forEach(f => {
    if (!fs.existsSync(f)) { F36('缺 ' + f); V36[f] = ''; return; }
    V36[f] = view36(f);
  });

  const A36 = [
    /* ① 三件套单点：trap / 标记可达 / 弹层入口 */
    ['ui.js', 'function trapFocus(container, sel) {', 1, '焦点圈定单点（从 confirm 里抽出来的那一个）：冒出第二份 trap 就是两套口径'],
    ['ui.js', "var trap = trapFocus(m, 'button');", 1, 'confirm 走单点，不再自带一套 Tab 逻辑'],
    ['ui.js', 'trap = trapFocus(el, opts.focus);', 1, 'sheet 走同一个单点（模态与弹层共用一条 Tab 圈定）'],
    ['ui.js', 'function markerLabel(m, label) {', 1, '标记 accessible name 单点'],
    ['ui.js', 'function markerKeys(m, fn) {', 1, '标记键盘激活单点（Leaflet 1.1.1 的 Keyboard handler 不管 Enter，不补就是「Tab 停得下来却打不开」的半个可达）'],
    ['ui.js', 'function sheet(el, opts) {', 1, '弹层开合单点——本批立论就是「开合只有一个入口」'],
    ['ui.js', 'if (el.__uiSheet) return el.__uiSheet;', 1, '控制器缓存在元素上：重复 UI.sheet(el) 拿同一个，不会叠监听器'],
    ['ui.js', 'el.__uiSheet = api;', 1, '缓存写入点（与上一条一一对应，只留一条就等于没缓存）'],
    ['ui.js', 'sheet: sheet, markerLabel: markerLabel, markerKeys: markerKeys, trapFocus: trapFocus', 1, '四个新单点都在导出串上：漏一个导出页面就调不到，只有运行时才红'],
    ['ui.js', 'el.__uiKeys = 1;', 1, '键位幂等旗子（同一节点不重复绑，重画出的新节点要能再绑上）'],
    ['ui.js', 'if (!el || !el.addEventListener || el.__uiKeys) return;', 1, '绑定的幂等判定本身（只钉旗子不够：把判定摘掉就是同一节点绑两遍，Enter 一次开两层——而两层都看不出，界面上只是「又点了一次」）'],
    /* ② trapFocus 的清单过滤：本批实测缺陷之一 */
    ["ui.js", "if (n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;", 1, '清单要跳 SVG：[href] 会命中 <use href>，而 <use> 聚焦不上，last 成了按不动的节点，圈定永远兜不回弹层（实测第三次 Tab 跑到 tabbar）'],
    ['ui.js', "if (n.disabled || n.getAttribute && n.getAttribute('disabled') !== null) continue;", 1, '禁用按钮同样聚焦不上，留着它 last 又是死结'],
    ['ui.js', 'var f = [];', 1, '过滤结果另建数组（直接复用 NodeList 等于没过滤）'],
    ['ui.js', 'f.push(n);', 1, '入队只在这一处'],
    ['ui.js', 'if (!f.length) return false;', 1, '空清单不拦（没控件的弹层不该把 Tab 焊死在里面）'],
    /* ③ aria-live：全站只由 ui.js 造，且只有关键状态变更点 */
    ['ui.js', "setAttribute('aria-live', 'polite')", 4, '四个 polite 活区：toast / nudge / tileWarn / offlineBar'],
    ['ui.js', 'aria-live', 5, 'ui.js 内 aria-live 恰 5 处（4 polite + 错误卡 assertive）；多一处就是有人在五个组件之外私搭活区'],
    ['ui.js', '\'<div class="ui-errorbox" role="alert" aria-live="assertive">\'', 1, '错误卡整串：出错必须打断（polite 会被念出时机不明的等待）'],
    ['ui.js', '\'<div class="eb-t"></div><div class="eb-d"></div>', 1, '建区时标题/正文是两只空槽——填字在下一帧（灵魂那条的形状证据）'],
    /* ④ sheet 语义：dialog / modal / expanded / tabindex / 名字归属 */
    ['ui.js', "if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');", 1, 'role=dialog 只在这一处补，且页面已写的 role 不覆盖'],
    ['ui.js', "if (opts.modal) el.setAttribute('aria-modal', 'true');", 1, 'aria-modal 只给真模态：locSheet 升起时地图照样能点，报「外面不可达」是谎报'],
    ['ui.js', "el.removeAttribute('aria-modal');", 1, '关闭必须摘：留着下一次开之间读屏把整页当不可达'],
    ['ui.js', "if (opener) opener.setAttribute('aria-expanded', 'true');", 1, '开启态给触发元素标 expanded'],
    ['ui.js', "opener.setAttribute('aria-expanded', 'false');", 1, '关闭回落：不回落读屏一直报「已展开」'],
    ['ui.js', 'if (api.isOpen()) return;', 1, '已开着再 open＝只换内容：opener/焦点/监听都不重记（否则焦点归还到被 innerHTML 换掉的按钮上）'],
    ['ui.js', 'if (!api.isOpen()) { detach(); return; }', 1, '别的路径关掉的：监听器自我回收，不在文档上越积越多'],
    ['ui.js', "if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');", 1, '焦点落进弹层本身，读屏从这块念起，也不会把焦点丢回 body'],
    ['ui.js', "var pageLabel = !!el.getAttribute('aria-label');", 1, '页面建好就写死的名字归页面管'],
    ['ui.js', "if (!pageLabel && lb) el.setAttribute('aria-label', lb);", 1, '没写死的才跟着内容走（景点卡的名字要跟着这一站）'],
    ['ui.js', "var cls = opts.cls || 'show';", 1, '开合仍认同一个 class：各页显隐逻辑不变，抽屉的 open 也接得上'],
    ['ui.js', "if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }", 1, 'Esc 关弹层：键盘进得去也要出得来'],
    /* ⑤ 焦点归还：认「还活着的那一枚」（本批实测缺陷之二） */
    ['ui.js', 'if (!back.isConnected) {', 1, 'setIcon 换掉整个 DOM，opener.focus() 会静默失败（实测 Esc 后焦点掉 body）'],
    ['ui.js', "var want = back.getAttribute && back.getAttribute('aria-label');", 1, '按名字找回同一站点的替代标记'],
    ['ui.js', "document.querySelector('.leaflet-container')", 1, '都找不到就交还地图容器：焦点还停在这张图上，而不是从页首重新 Tab'],
    ['ui.js', "el.classList.add(cls);", 1, '开层只在这一处写 class'],
    ['ui.js', "el.classList.remove(cls);", 1, '关层只在这一处去 class'],
    /* ⑥ 日卡结构：planner 与只读分享页同一套口径 */
    ['planner.js', 'h += \'<div class="day-list" role="list" aria-label="\' + esc(trip.name || \'行程安排\') + \'，共 \' + days.length + \' 天">\';', 1, '列表容器整串：名字带「共 N 天」且过 esc'],
    ['planner.js', 'var tl = \'第 \' + (di + 1) + \' 天，赶路日，约 \' + Math.round(d.driveKm) + \' km，\' + verbOf(trip.travelBy) + \' \' + d.driveH.toFixed(1) + \' 小时\';', 1, '转场日名字：明说「赶路日」（否则读屏只念得出 0 站）'],
    ['planner.js', '<div class="day-card transit" role="listitem" aria-label="\' + esc(tl) + \'"', 1, '转场卡 listitem + esc 后的名字'],
    ['planner.js', 'var dl = \'第 \' + (di + 1) + \' 天，\' + d.stops.length + \' 站，约 \' + Math.round(d.driveKm) + \' km，游玩 \' +', 1, '常规日名字：天数＋站数＋里程'],
    ['planner.js', '<div class="day-card" role="listitem" aria-label="\' + esc(dl) + \'"', 1, '常规卡 listitem'],
    ['share.html', 'h += \'<div class="day-list" role="list" aria-label="\' + esc(p.t || \'我的行程\') + \'，共 \' + (p.days || []).length + \' 天">\'', 1, '分享页同一套容器口径（读的是别人，更不能给个无名列表）'],
    ['share.html', 'esc(\'第 \' + (di + 1) + \' 天，赶路日，约 \' + (d.km || 0) + \' km\')', 1, '分享页转场日名字'],
    ['share.html', 'esc(\'第 \' + (di + 1) + \' 天，\' + n + \' 站，约 \' + (d.km || 0) + \' km，全程 \' + (d.h || 0) + \' 小时\')', 1, '分享页常规日名字'],
    ['share.html', '<div class="day-card transit" role="listitem" aria-label="\'', 1, '分享页转场卡 listitem'],
    ['share.html', '<div class="day-card" role="listitem" aria-label="\'', 1, '分享页常规卡 listitem'],
    ['design.css', ':focus-visible', 3, '焦点环仍只有已在案的三条（亮色/暗色翻色/第二套声明）：本批零新增 CSS，数量变了要回文档说明'],
    /* ⑦ 弹层迁移：抽屉口径也走 sheet（cls 传 open） */
    ['topic-common.js', "UI.sheet(nearSheet, { cls: 'open' })", 1, '近邻面板抽屉开合走单点'],
    ['topic-common.js', "UI.sheet(sh, { cls: 'open' })", 1, '这一带面板抽屉同一条腿'],
    ['topic-common.js', "UI.sheet($('arriveDlg'), { label:", 1, '到达弹层是唯一真模态（带 label + modal）'],
    ['node-lod.js', 'if (window.UI && C.labelOf) UI.markerLabel(m, C.labelOf(s));', 2, 'LOD 两条绘制分支各补一次名（漏一条就是那一档缩放全图无名）'],
    ['node-lod.js', 'if (window.UI) UI.markerKeys(m, act);', 3, '三条绘制路径都接键盘：act 与点击同一个函数，不另写一套语义'],
    ['topic-common.js', 'UI.markerLabel(m, siteAria(SITES[idx]));', 1, '重画后补名（setActiveNode 体内）'],
    ['topic-common.js', 'UI.markerKeys(m, function () { openSheet(idx); });', 1, '重画后补键位'],
    ['topic-common.js', "if (window.UI) { UI.markerLabel(nm, siteAria(s)); UI.markerKeys(nm, function () { openSheet(i); }); }", 1, '近邻高亮的补画分支：新建的标记同样要有名字和 Enter'],
    ['topic-common.js', 'm.setIcon(nodeIcon(SITES[idx], idx === i));', 1, '重画单点（Leaflet 1.1.1 无 iconchange，后面两条补回是必须的）'],
    ['planner.js', 'UI.markerLabel(m, (i + 1) + \'，\' + s.name', 1, '规划结果页地图针脚带站序与站名'],
    ['travel-notes.js', 'UI.markerKeys(m, function () { m.openPopup(); });', 2, '随手记两处：Enter 等价于点开这张卡'],
    ['share.html', 'UI.markerKeys(mk, function () { mk.openPopup(); });', 1, '分享页针脚键盘可达'],
    ['wishlist.html', 'UI.markerKeys(m, function () { m.openPopup(); });', 1, '想去页标记键盘可达'],
  ];
  A36.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F36('A36 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V36)) { F36('A36 登记了 §36 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt36(V36[file], needle);
    if (got !== want) F36(file + ' 里「' + needle.slice(0, 60) + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A36.length < 50) F36('锚点表被削减：' + A36.length + ' 条（批次 22 落地时实测 61 条，阈值取 50——整组删掉就等于这节没了）');

  /* ⑧ 接线数量表：15 处标记站点里哪些有键位、哪些只给名字（story 针脚与选点脉冲针没有点击语义） */
  {
    const MAP = [
      ['node-lod.js', 3, 3, 3, 'LOD 三条绘制路径（列表两分支 + 聚合胶囊）名与键位都齐'],
      ['topic-common.js', 3, 5, 5, '3 处建标记 + setActiveNode/近邻高亮两处重画后补回'],
      ['node-manager.html', 2, 2, 1, 'pickMarker 是脉冲定位针，没有点击语义：给名字就够了，不硬塞 Enter'],
      ['planner.js', 1, 1, 1, '结果页站点'],
      ['share.html', 1, 1, 1, '只读分享页站点'],
      ['story.html', 1, 1, 0, '游记针脚只有装饰意义：只报名字，不给 Enter（点了没反应比按不动更糟）'],
      ['travel-map.html', 1, 1, 1, '足迹页节点'],
      ['travel-notes.js', 2, 2, 2, '随手记两处'],
      ['wishlist.html', 1, 1, 1, '想去页'],
    ];
    let mk = 0, lb = 0, ky = 0;
    MAP.forEach(([f, nMarker, nLabel, nKeys, why]) => {
      const c1 = cnt36(V36[f], 'L.marker('), c2 = cnt36(V36[f], 'UI.markerLabel('), c3 = cnt36(V36[f], 'UI.markerKeys(');
      if (c1 !== nMarker) F36(f + ' 的 L.marker( 数 ' + c1 + '（登记 ' + nMarker + '）：' + why);
      if (c2 !== nLabel) F36(f + ' 的 UI.markerLabel( 数 ' + c2 + '（登记 ' + nLabel + '）：' + why);
      if (c3 !== nKeys) F36(f + ' 的 UI.markerKeys( 数 ' + c3 + '（登记 ' + nKeys + '）：' + why);
      mk += c1; lb += c2; ky += c3;
    });
    if (mk !== 15) F36('全站标记站点总数不是 15：' + mk + '（方案文档写的是「四处」，实测 15 处才是要接的全集；少一处就是有一页的地图读屏仍念得出「按钮」）');
    if (ky !== 15) F36('全站 UI.markerKeys( 总数不是 15：' + ky + '（接线数随重画补回而高于标记数；对不上就是有绘制路径漏了键盘）');
  }

  /* ⑨ 弹层入口数量表：开合只有一个入口，调用点数就是要钉的入口面 */
  {
    const SHEET = [
      ['topic-common.js', 7, '景点卡/到达弹层/近邻/这一带四条路径'],
      ['node-manager.html', 11, 'rsSheet 与 infoSheet 的开关与互斥（另 5 处未迁移的旧弹层登记在方案文档）'],
      ['travel-map.html', 2, '记忆列表与单篇两条开径已并到 fillSheet 一处 open，加 closeMemSheet 一处 close（批次 29：同一张卡两条填内容路径各写一遍 open＝让位/提示那条腿只有一条上有）'],
      ['topic.html', 1, '壳层兜底的 _closeArrive'],
    ];
    SHEET.forEach(([f, want, why]) => {
      const got = cnt36(V36[f], 'UI.sheet(');
      if (got !== want) F36(f + ' 的 UI.sheet( 调用点数 ' + got + '（登记 ' + want + '）：' + why);
    });
    if (cnt36(V36['travel-notes.js'], 'UI.sheet(') !== 0) F36('travel-notes.js 里出现了 UI.sheet(：随手记的面板走的是自己的显隐，不在本批迁移范围，混用会把两套口径焊在一起');
  }

  /* ⑩ 灵魂 A：五个活区的「先空插入、下一帧写字」顺序（存在性检查守不住这个） */
  {
    const SITES36 = [
      ['function toast(msg, ms, action) {', "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(document.createTextNode(msg));', 'toast'],
      ['function nudge(o) {', "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(msg);', 'nudge'],
      ['function showTileWarn(msg) {', "tileWarnEl.setAttribute('aria-live', 'polite');", 'document.body.appendChild(tileWarnEl);', 'tileWarnEl.textContent = msg;', 'tileWarn'],
      ['function offlineBar() {', "bar.setAttribute('aria-live', 'polite');", 'document.body.appendChild(bar);', 'bar.innerHTML = \'<span class="oic">\'', 'offlineBar'],
      ['function errorBox(host, opts) {', '\'<div class="ui-errorbox" role="alert" aria-live="assertive">\'', '\'<div class="eb-t"></div><div class="eb-d"></div>\'', 't.textContent = opts.title || \'加载失败\';', 'errorBox'],
    ];
    const twoStep = (body, attr, ins, fill) => {
      const ia = body.indexOf(attr), ii = body.indexOf(ins);
      /* rAF 与填字都从「插入点之后」找：offlineBar 的 show() 里有一条同族早退分支
         （bar 已在 DOM 上时只补 classList.add("show")），它自己也用一个 rAF——从头找会先撞上它 */
      const ir = body.indexOf('requestAnimationFrame(', ii), ifi = body.indexOf(fill, ir);
      return ia >= 0 && ia < ii && ir > ii && ifi > ir;
    };
    SITES36.forEach(([head, attr, ins, fill, name]) => {
      const B = fnBody36(V36['ui.js'], head);
      if (!B) { F36('抽不出 ' + name + ' 函数体（两步时序断言失去依据）'); return; }
      if (!twoStep(B, attr, ins, fill))
        F36(name + ' 不再满足「活区先空着入 DOM、文案下一帧再写」：带着文案一次性插入，读屏把它当静态内容（新增节点）而不是状态变更，一个字都不播');
      if (B.indexOf(attr) < 0 || B.indexOf(ins) < 0 || B.indexOf(fill) < 0)
        F36(name + ' 里三件套（aria-live / 插入 / 填字）有缺件，顺序断言已失去意义');
    });
    /* 反向对照：带文案一次插入的改前形态必须被打红；否则上面全是恒真判据。
       合成串里的引号要跟锚点一致（单引号），否则「找不到串」也会被判成红——那不是证据。 */
    const BAD = flat36("function f(msg) { var d = document.createElement('div'); d.appendChild(document.createTextNode(msg)); d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); }");
    if (twoStep(BAD, "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(document.createTextNode(msg));'))
      F36('两步时序断言的反向对照失效：合成的「带字一次插入」源码都没触发它');
    /* 反向对照 2：aria-live 晚于插入（先挂节点再补属性，首帧那次变更没人监听） */
    const BAD2 = flat36("function f(msg) { var d = document.createElement('div'); document.body.appendChild(d); d.setAttribute('aria-live', 'polite'); requestAnimationFrame(function () { d.appendChild(document.createTextNode(msg)); }); }");
    if (twoStep(BAD2, "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(document.createTextNode(msg));'))
      F36('两步时序断言的反向对照 2 失效：合成的「属性晚于插入」源码都没触发它');
    /* 正向对照：同形但不同文案的正确写法不许被打红（守的是顺序，不是某一家的写法） */
    const GOOD = flat36("function f(msg) { var d = document.createElement('div'); d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); requestAnimationFrame(function () { d.appendChild(document.createTextNode(msg)); }); }");
    if (!twoStep(GOOD, "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(document.createTextNode(msg));'))
      F36('两步时序断言的正向对照失效：正确的合成源也被打红，那这条锚会不分对错一直红');
    /* 反向对照 3：正确形状但活区在插入之后才建（属性根本没跟着节点进 DOM） */
    const BAD3 = flat36("function f(msg) { var d = document.createElement('div'); document.body.appendChild(d); requestAnimationFrame(function () { d.setAttribute('aria-live', 'polite'); d.appendChild(document.createTextNode(msg)); }); }");
    if (twoStep(BAD3, "d.setAttribute('aria-live', 'polite');", 'document.body.appendChild(d);', 'd.appendChild(document.createTextNode(msg));'))
      F36('两步时序断言的反向对照 3 失效：合成的「aria-live 下一帧才补」源码都没触发它');
  }

  /* ⑩ 灵魂 B：trap 的过滤必须排在 first/last 取值之前 */
  {
    const TB = fnBody36(V36['ui.js'], 'function trapFocus(container, sel) {');
    if (!TB) F36('抽不出 trapFocus 函数体');
    else {
      const trapOrder = src => {
        const iF = src.indexOf('var f = [];'), iN = src.indexOf("'http://www.w3.org/1999/xhtml'");
        const iL = src.indexOf('var first = f[0], last = f[f.length - 1];');
        return iF >= 0 && iN > iF && iN < iL && iL >= 0;
      };
      if (!trapOrder(TB)) F36('trapFocus 的 SVG/禁用过滤不在 first/last 取值之前：last 仍是那枚聚焦不上的 <use>，「转到末尾回第一枚」永远不触发');
      const BADT = flat36("function trapFocus(container, sel) { var f = []; var first = f[0], last = f[f.length - 1]; var n = nodes[0]; if (n.namespaceURI !== 'http://www.w3.org/1999/xhtml') { continue; } }");
      if (trapOrder(BADT)) F36('trap 过滤顺序断言的反向对照失效：合成的「先取 first/last 再过滤」源码都没触发它');
      const GOODT = flat36("function trapFocus(container, sel) { var f = []; var n = nodes[0]; if (n.namespaceURI !== 'http://www.w3.org/1999/xhtml') { continue; } f.push(n); var first = f[0], last = f[f.length - 1]; }");
      if (!trapOrder(GOODT)) F36('trap 过滤顺序断言的正向对照失效：合成正确源也被打红');
    }
  }

  /* ⑩ 灵魂 C：open 里「已开着只换内容」的守卫必须早于 aria-modal 与 classList.add */
  {
    const OB = fnBody36(V36['ui.js'], 'open: function (label) {');
    if (!OB) F36('抽不出 sheet.open 函数体');
    else {
      const g = OB.indexOf('if (api.isOpen()) return;'), mo = OB.indexOf("if (opts.modal)"), ad = OB.indexOf('el.classList.add(cls);');
      if (g < 0) F36('sheet.open 里没有 isOpen 守卫：已开着再 open 会重记 opener／焦点／监听，焦点归还到一个已被 innerHTML 换掉的按钮上');
      if (!(g >= 0 && g < mo && g < ad)) F36('sheet.open 的 isOpen 守卫没有排在 aria-modal 与 classList.add 之前：二次 open 会重新走一遍开层流程');
      if (cnt36(OB, 'el.classList.add(cls);') !== 1) F36('sheet.open 体内 classList.add(cls) 不是恰 1 次：开层路径分叉了');
      const BADG = flat36('open: function (label) { if (opts.modal) el.setAttribute("aria-modal", "true"); el.classList.add(cls); if (api.isOpen()) return; }');
      if (!(BADG.indexOf('if (api.isOpen()) return;') > BADG.indexOf('el.classList.add(cls);'))) F36('open 守卫顺序断言的反向对照失效（合成的「守卫在后的」源码没排在 add 之后）');
    }
    const CB = fnBody36(V36['ui.js'], 'close: function () {');
    if (!CB) F36('抽不出 sheet.close 函数体');
    else {
      if (cnt36(CB, "el.removeAttribute('aria-modal');") !== 1) F36('sheet.close 没摘 aria-modal（恰 1 次）：关闭期间整页在读屏里不可达');
      if (cnt36(CB, "opener.setAttribute('aria-expanded', 'false');") !== 1) F36('sheet.close 没回落 aria-expanded：读屏报的还是「已展开」');
      if (cnt36(CB, 'el.classList.remove(cls);') !== 1) F36('sheet.close 体内 classList.remove(cls) 不是恰 1 次：关层路径分叉了');
      if (CB.indexOf('if (!back.isConnected) {') < 0) F36('sheet.close 没有 isConnected 判定：标记层整层重建换掉节点时焦点归还静默失败（实测落 body；setIcon 那条腿实测复用同一枚 DIV，不是它）');
    }
  }

  /* ⑩ 灵魂 D：重画之后补名/补键位，必须排在 setIcon 之后 */
  {
    const SA = fnBody36(V36['topic-common.js'], 'function setActiveNode(i) {');
    if (!SA) F36('抽不出 setActiveNode 函数体');
    else {
      const iSet = SA.indexOf('m.setIcon('), iL = SA.indexOf('UI.markerLabel('), iK = SA.indexOf('UI.markerKeys(');
      if (!(iSet >= 0 && iL > iSet && iK > iSet)) F36('setActiveNode 里补名/补键位没有排在 setIcon 之后：Leaflet 1.1.1 没有 iconchange，补在重画之前等于补在旧节点上；浏览器腿对这条顺序没有视野（vendor 反解 DivIcon.createIcon 复用同一枚 DIV，探针实测 setIcon 36 次节点换手 0），所以它是结构不变量，不是可观测缺陷');
      if (cnt36(SA, 'm.setIcon(') !== 1 || cnt36(SA, 'UI.markerLabel(') !== 1 || cnt36(SA, 'UI.markerKeys(') !== 1) F36('setActiveNode 体内 setIcon / markerLabel / markerKeys 不是各恰 1 次');
      const BADS = flat36('function setActiveNode(i) { UI.markerLabel(m, x); UI.markerKeys(m, y); m.setIcon(nodeIcon(s)); }');
      if (!(BADS.indexOf('m.setIcon(') > BADS.indexOf('UI.markerLabel('))) F36('重画补名断言的反向对照失效（合成的「补在重画之前」源码没排在前面）');
    }
  }

  /* 期望 0：旧写法不许回潮（弹层裸开关 / 页面私搭活区 / 组件外补 aria 属性） */
  const ZERO36 = [
    ["ui.js", "setAttribute('aria-hidden'", "el.setAttribute('aria-hidden', 'true');", "关闭态弹层靠 CSS display:none 退出 tab 序列，不双写 aria-hidden（两套状态迟早自相矛盾：CSS 关了这里还标着可见）。批次 23 把口径从裸 token 收到调用形：装饰性 glyph 的 aria-hidden 挂在 innerHTML 的 <svg> 上（X 那枚），不是弹层状态双写；口径见 §37 那条 glyph 锚"],
    ['ui.js', 'inert', 'el.inert = true;', '同上，也不用 inert（本批只在真模态上报 aria-modal）'],
    ['node-lod.js', "setAttribute('aria-label'", "m._icon.setAttribute('aria-label', name);", '标记的名字只走 UI.markerLabel 单点：LOD 自己搭一套就没法在重画后统一补回'],
    ['node-lod.js', "addEventListener('keydown'", "el.addEventListener('keydown', function (e) { if (e.key === \'Enter\') act(); });", '键位只走 UI.markerKeys 单点（幂等旗子在它那里）'],
    ['topic-common.js', "addEventListener('keydown'", "document.addEventListener('keydown', function (e) { if (e.key === \'Escape\') closeSheet(); });", 'Esc／Tab 归 sheet 与 trapFocus，页面不再各自挂一份（两份监听器会让 Esc 按两下才关）'],
    ['topic-common.js', "$('locSheet').classList.add('show')", "$('locSheet').classList.add('show');", '景点卡开层走 UI.sheet：裸开关没有 role／没有 Esc／焦点留在背后的地图上'],
    ['topic-common.js', "$('locSheet').classList.remove('show')", "$('locSheet').classList.remove('show');", '关层同上'],
    ['topic-common.js', "$('arriveDlg').classList.add('show')", "$('arriveDlg').classList.add('show');", '到达弹层是真模态，更要走单点（aria-modal 只在 opts.modal 那一条腿上挂）'],
    ['topic-common.js', "$('arriveDlg').classList.remove('show')", "$('arriveDlg').classList.remove('show');", '同上'],
    ['topic-common.js', "nearSheet.classList.remove('open')", 'nearSheet.classList.remove(\'open\');', '近邻抽屉的开合也走单点（cls 传 open，显隐逻辑不变）'],
    ['topic-common.js', "sh.classList.add('open')", "sh.classList.add('open');", '这一带抽屉同上'],
    ['topic.html', "var d = document.getElementById('arriveDlg'); if (d) d.classList.remove('show');", "var d = document.getElementById('arriveDlg'); if (d) d.classList.remove('show');", '壳层兜底也走 UI.sheet，否则关了层还留着 aria-modal／expanded'],
    ['node-manager.html', "$('rsSheet').classList", "$('rsSheet').classList.add('show');", '自建点面板开合走单点（这里曾有 5 处裸开关，批次 22 迁了 rsSheet/infoSheet）'],
    ['node-manager.html', "$('infoSheet').classList", "$('infoSheet').classList.remove('show');", '同上'],
    ['travel-map.html', "document.getElementById('memSheet').classList.add('show')", "document.getElementById('memSheet').classList.add('show');", '足迹记忆抽屉走单点'],
    ['travel-map.html', "document.getElementById('memSheet').classList.remove('show')", "document.getElementById('memSheet').classList.remove('show');", '同上'],
  ];
  ZERO36.forEach(([f, needle, ctrl, why]) => {
    if (cnt36(V36[f], needle) !== 0) F36(f + ' 里出现「' + needle + '」：' + why);
    if (cnt36(flat34ctrl36(ctrl), needle) < 1) F36('「' + needle + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });
  function flat34ctrl36(s) { return ws36(s.replace(/\/\*[\s\S]*?\*\//g, '')); }
  /* 全站 aria-live 只由 ui.js 造：其余文件出现即为组件外私搭活区 */
  FILES36.forEach(f => {
    if (f === 'ui.js' || f === 'README.md' || f === 'tools/smoke-aria.js') return;
    if (cnt36(V36[f], 'aria-live') !== 0) F36(f + ' 里出现 aria-live：播报区只允许由 ui.js 的五个组件造，页面自己搭的区没人负责「先空后写」的时序');
  });
  if (cnt36(flat34ctrl36('<div class="x" aria-live="polite"></div>'), 'aria-live') < 1) F36('aria-live 全站唯一出处那条期望 0 的正向对照失效了');

  /* 浏览器腿：A01–A25 / C01–C06 / D01–D09 / S01–S04 / E01 一条不许少 */
  const pad36 = (pre, i) => pre + (i < 10 ? '0' + i : '' + i);
  [['A', 25], ['C', 6], ['D', 9], ['S', 4]].forEach(([pre, n]) => {
    for (let i = 1; i <= n; i++) {
      if (V36['tools/smoke-aria.js'].indexOf("ok('" + pad36(pre, i) + ' ') < 0)
        F36('tools/smoke-aria.js 缺 ' + pad36(pre, i) + ' 这条判据（' + pre + ' 组是一整组：A 键盘闭环／C 两步时序／D 日卡快照／S 分享页同口径，少一条就是有个症状没人管）');
    }
  });
  if (V36['tools/smoke-aria.js'].indexOf("ok('E01 ") < 0) F36('tools/smoke-aria.js 缺 E01（零未捕获异常——可达属性改动最容易把某页的初始化改崩，而它表现为静默卡住）');
  if (cnt36(V36['tools/smoke-aria.js'], "ok('") !== 46)
    F36('tools/smoke-aria.js 的判据条数不是 46：' + cnt36(V36['tools/smoke-aria.js'], "ok('") + ' 条（批次 22 落地时实测 46＝A25+C6+D9+S4×2 条 S01 分支+E01；整组削减等于把这节拆了）');
  if (cnt36(V36['tools/smoke-aria.js'], 'interestingOnly: false') !== 1)
    F36('smoke-aria 的 D 组快照没有 interestingOnly: false：默认口径会把 generic 列表容器剪掉，量出来的 list/listitem 全 0 是眼睛的问题不是结构的问题');
  if (cnt36(V36['tools/smoke-aria.js'], 'Share.encodePayload(window.Share.payloadOf(t))') !== 1)
    F36('smoke-aria 的 S 组没有直接编 hash：file:// 下 Share.build 走 no-base 降级分支，返回值里根本没有 hash 字段，拿它猜就是 S 组恒不跑');

  if (V36['README.md'].indexOf('§36') < 0) F36('README.md 的 verify 清单没提 §36（新闸门不写进 README 就等于没装）');

  console.log('无障碍闸门: ' + A36.length + ' 条代码锚点（三件套单点各恰 1 + trap 的 SVG/禁用过滤族 + aria-live 4 polite/5 总数/1 assertive 整串 + sheet 语义九条 + 焦点归还三条 + 日卡两套页面各五条 + :focus-visible 恰 3 + 抽屉 cls:open 两条 + 重画补名三条）+ 接线数量表（9 页 15 处标记、名 17／键位 15，story 针脚与脉冲针只给名字的口子写进表）+ 弹层入口数量表（7/11/3/1）+ 四组灵魂顺序断言（活区五处「先空入 DOM、下一帧写字」并配「带字一次插入」与「属性晚于插入」两条反向对照、trap 过滤早于 first/last、open 的 isOpen 守卫早于 aria-modal 与 add、setIcon 早于补名补键位）+ close 函数体四条（摘 modal／回落 expanded／remove 恰一／isConnected 判定）+ 十七族期望 0（aria-hidden（批次 23 把口径从裸 token 收到 setAttribute 调用形，装饰性 glyph 的 aria-hidden 不算双写，见 §37）、inert、node-lod 自搭 aria-label/keydown、各页 classList 裸开关、全站 aria-live 只出自 ui.js）；每条期望 0 都配正向对照；smoke A01–A25／C01–C06／D01–D09／S01–S04／E01 齐备检 + 条数守卫（46）+ 快照口径与分享 hash 两条测试自校准；变异自测两层见 tools/out/mut-verify36.js');
  fail += bad36;
}



/* ============ §37 真机视口与弹层右上角关闭闸门（批次 23） ============
   这一批的三条症状全是「桌面看一切正常，手机上看不到东西」：
     · 排期向导第 3 步「倒序 · 从远端返回」后面半截没了（328 CSS 视口实测第二枚 right=395，
       需要宽 360 / 可用 258）；
     · locSheet 与 infoSheet 两枚弹层右上角没有任何可见关闭控件（全站 6 枚 UI.sheet 弹层里只有它俩光）；
     · 壳侧 textZoom 没归一，系统「字体大小」1.35 直接乘进 CSS 像素，前两条在真机上被放大。
   所以源码侧只钉三类东西：
     ① 单点：右上角 X 只由 UI.sheet 的 ensureX 造，class 全站只有 ui.js + design.css 两处出处；
     ② 认领表：写 data-sheet-x="off" 的弹层必须自己有可见关闭控件（「直接收起」/ .x / .ms-close / .nx），
        而 locSheet 与 infoSheet 不许认领——它们恰恰是没控件的那两枚，这里红就是「把症状当配置关掉了」；
     ③ 顺序：ensureX 必须排在 isOpen 守卫之前（开着重画内容的腿会把 X 连 DOM 一起 innerHTML 掉，
        守卫在后就 return 了）；off 判定必须排在 insertBefore 之前（自带控件的先插了再退 = 两枚 X 叠在同一角）。
   壳那一半另加一条硬账：仓库内的 MainActivity.java 与交付壳必须逐字节一致。
   不一致就是「改了但没进 APK」——用户只在手机上验，这条比任何 CSS 锚点都值钱。
   口径同 §21/§31/§36：四元组守卫、期望 0 一律配正向对照、.js/.css/.java 视图剥块注释、
   .html 视图只归一空白不剥注释（所以锚点串一律写成归一后的整串）。
   ============================================================ */
{
  let bad37 = 0;
  const F37 = m => { bad37++; console.log('FAIL §37 真机视口与弹层关闭闸门: ' + m); };
  const ws37 = s => s.replace(/\s+/g, ' ').trim();
  const flat37 = s => ws37(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt37 = (s, n) => s.split(n).length - 1;
  const rd37 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view37 = f => /\.html$/.test(f) ? ws37(rd37(f)) : flat37(rd37(f));
  const fnBody37 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };
  /* 归一后的 HTML 里，一枚元素的开标签 = 从它的 id="…" 到下一个 '>' 为止 */
  const tag37 = (src, idv) => {
    const a = src.indexOf('id="' + idv + '"');
    if (a < 0) return null;
    const gt = src.indexOf('>', a);
    return gt < 0 ? null : src.slice(a, gt);
  };

  const JP = 'android_app/app/src/main/java/com/gujian/guditu/MainActivity.java';
  const FILES37 = ['ui.js', 'design.css', 'planner.js', 'topic-common.js', 'topic.html',
    'node-manager.html', 'travel-map.html', 'tools/smoke-usable.js', JP, 'README.md'];
  const V37 = {};
  FILES37.forEach(f => {
    if (!fs.existsSync(f)) { F37('缺 ' + f); V37[f] = ''; return; }
    V37[f] = view37(f);
  });

  const A37 = [
    /* ① 23-A 壳侧归一：CSS 拿不到 textZoom，只能在壳里按住 */
    [JP, 'ws.setTextZoom(100);', 1, '系统「字体大小」(本机 font_scale=1.35) 会乘进 WebView 的 textZoom，而 CSS 侧没有任何一个量能读到它；不归一，328 视口上根字号被顶到 20.3px，整片按钮与弹层裁切'],
    [JP, 'setTextZoom', 1, '全站只许这一处碰缩放档位：出现第二处就是有人按机型钉了死数（钉死 px 正是 §21 从 html{font-size:16px} 里爬出来的那条坑）'],
    /* ② 23-B 二选一按钮行：文案完整可读排在「一行好看」前面 */
    ['design.css', '.row-opt>*{min-width:0;white-space:normal;align-self:stretch;flex-wrap:wrap}', 1, '整串：flex:1 留着默认 min-width:auto 就缩不到自身内容以下，两枚长文案并排必顶穿卡片。align-self 而不是动 .row——各页页面级 .fld .row 都写了 align-items:center，同权重抢不过'],
    ['design.css', '.row-opt>*>span{white-space:nowrap}', 1, '段内不许断行：换行点只留给段与段之间，省得窄屏断出「从起点 出发」这种半截话'],
    ['planner.js', 'class="row row-opt"', 5, '向导四行（环线/排序方式/方向/步骤条导航）+ 浏览弹层那行，共 5 处二选一或并排主操作；少一处就是有一行还留着裸 .row'],
    ['planner.js', '<span>正序</span><span>从起点出发</span>', 1, '文案必须分两段：整串「正序 · 从起点出发」是个不可断的整体，nowrap 下只能整体溢出'],
    ['planner.js', '<span>倒序</span><span>从远端返回</span>', 1, '用户报的就是这一枚（「倒序：从....」后面看不到内容）'],
    ['planner.js', '<span>是</span><span>回到起点</span>', 1, '环线行同族（同宽度下这行也要换行才读得完）'],
    ['planner.js', '<span>否</span><span>单程</span>', 1, '同上'],
    /* ③ 23-C 右上角关闭：单点 + 样式 */
    ['ui.js', 'function ensureX() {', 1, '右上角 X 的单点（只由 UI.sheet 造，页面不再各写一枚）'],
    ["ui.js", "if (el.getAttribute('data-sheet-x') === 'off') return;", 1, '声明式认领：控制器缓存在元素上，只有第一次 UI.sheet() 的 opts 算数，而各页第一次调的常常是 close()——只有跟着 DOM 走才与调用顺序无关'],
    ["ui.js", "xBtn = document.createElement('button');", 1, '按钮只建一次（配 !xBtn 的幂等）'],
    ["ui.js", "xBtn.className = 'ui-sheet-x';", 1, '样式名只在这一处挂：全站 class 出处就是这条加 design.css 那四条'],
    ["ui.js", "xBtn.setAttribute('aria-label', '关闭');", 1, '读屏念得出「关闭」，不念 SVG 路径'],
    ["ui.js", '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">', 1, 'glyph 装饰性：aria-hidden 挂在 <svg> 上、名字挂在按钮上。这条同时是给 §36 那族期望 0 划界——它守的是弹层元素上的 setAttribute 双写，不是这个（口径不收窄的话，下一枚装饰图标一进 ui.js 就把 §36 顶红，然后被人当误报删掉）'],
    ['ui.js', 'xBtn.onclick = function () { api.close(); };', 1, '点它必须走 api.close()：只 CSS 隐藏 class 的话 aria-modal／expanded／焦点归还全留在原地'],
    ['ui.js', 'if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);', 1, '插在内容最前 + 幂等：append 到末尾会跟着内容滚到底，绝对定位又会被 overflow 的滚动容器带走（locSheet 的 lsBody 自己滚）'],
    ['ui.js', 'var opener = null, keyH = null, trap = null, xBtn = null;', 1, 'X 的引用与 opener 同族缓存在闭包里：重复 open 不重建，DOM 被 innerHTML 换掉时由 ensureX 补回'],
    ['design.css', '.ui-sheet-x{float:right', 1, 'float 而不是 absolute：滚动容器内绝对定位会跟着内容走，44×44 的钮飘到列表中段'],
    ['design.css', '.ui-sheet-x:active{transform:scale(.92)', 1, '按压反馈（本项目的触控口径：:active 系，不依赖 :hover）'],
    ['design.css', '.theme-dark .ui-sheet-x{background', 1, '暗色档必须翻色，否则那枚 X 在深色弹层上还是看不见——本批的原始症状就是「看不到」'],
    /* ④ 23-C 认领表：四枚自带关闭控件的弹层各自声明一次 */
    ['topic.html', 'id="arriveDlg" data-sheet-x="off"', 1, '到达弹层：卡片底部有「直接收起」'],
    ['node-manager.html', 'data-sheet-x="off"', 1, '搜索结果面板头部自带 .x#rsClose'],
    ['travel-map.html', 'id="memSheet" data-sheet-x="off"', 1, '足迹记忆抽屉头部自带 .ms-close'],
    ["topic-common.js", "nearSheet.setAttribute('data-sheet-x', 'off');", 1, '这一带面板头部自带 .nx（渲染在 .nh 里，不在 HTML 上，所以只能在 JS 里声明）'],
    /* ⑤ 自带的关闭控件确实还在（认领 off 的前提） */
    ['topic.html', 'class="arrive-nav"', 1, '「直接收起」还在——控件没了而这行声明还留着 = 这枚弹层没人管关闭'],
    ['node-manager.html', 'id="rsClose"', 1, '头部那枚 .x 还在'],
    ['travel-map.html', 'class="ms-close"', 1, '绝对定位圆钮还在'],
    ['topic-common.js', 'id="nearSheetX"', 1, '.nh 里的关闭钮还在'],
    /* ⑥ 23-D 取样档：真机 328×723 必须进常驻闸门 */
    ['tools/smoke-usable.js', 'for (const w of [320, 328, 390, 452]) {', 1, '手机取样四档；328 是一加 Ace 6T 实测 CSS 视口（Override density 620 → 1272/(620/160)≈328），不带它「真机档已验证」验的是一台不存在的手机'],
    ['tools/smoke-usable.js', 'w === 328 ? 723', 1, '高度同档：328×723 是一对，只补宽度等于没补到底带裁切'],
    ["tools/smoke-usable.js", "check('U19 手机四档", 1, '判据名跟着档数改：§31 只锚 check(\'U19 前缀，改标签安全，但「四档」这个词必须和循环体一致'],
    ["tools/smoke-usable.js", "check('U20 手机四档", 1, '同上'],
    ['design.css', '@media (max-width:360px){ :root{--fs-bucket:.9375}', 1, '真机落的就是这一档（328 ≤ 360）：密度已经整块放大版面，CSS px 变窄是同一件事的另一面，424/452 两根乘数在这台机上结构性不触发——不是漏配'],
  ];
  A37.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F37('A37 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V37)) { F37('A37 登记了 §37 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt37(V37[file], needle);
    if (got !== want) F37(file + ' 里「' + needle.slice(0, 60) + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A37.length < 25) F37('锚点表被削减：' + A37.length + ' 条（批次 23 落地时实测 34 条，阈值取 25——整组删掉就等于这节没了）');

  /* ⑦ 认领表配对：写了 off 就必须自己有关闭控件（数量表，不是单点检查） */
  {
    const OWN37 = [
      ['topic.html', 'data-sheet-x="off"', 'class="arrive-nav"', '「直接收起」'],
      ['node-manager.html', 'data-sheet-x="off"', 'id="rsClose"', '头部 .x'],
      ['travel-map.html', 'data-sheet-x="off"', 'class="ms-close"', '.ms-close 圆钮'],
      ['topic-common.js', "setAttribute('data-sheet-x', 'off')", 'id="nearSheetX"', '.nh 里的 .nx'],
    ];
    OWN37.forEach(([f, off, ctl, name]) => {
      const o = cnt37(V37[f], off), c = cnt37(V37[f], ctl);
      if (o !== 1) F37(f + ' 的 data-sheet-x 声明数 ' + o + '（要 1）：认领要么不写，要么只写一次——写两遍就是有一枚弹层被重复认领');
      if (c < 1) F37(f + ' 声明了 data-sheet-x="off" 却找不到自己的关闭控件（' + name + '）：这一枚弹层就此没人管关闭，右上角和头部都是空的');
    });
  }

  /* ⑧ 反向认领表：没控件的两枚不许声明 off（症状不许被配置关掉） */
  {
    const NOCLAIM37 = [
      ['topic.html', 'locSheet', '景点卡：本批要补 X 的就是它（此前只有 .sheet__handle 一根拖拽条，触屏用户不知道能拽，读屏与鼠标都关不掉）'],
      ['node-manager.html', 'infoSheet', '地点详情卡：同上，底部四枚 .is-btn 之外没有任何关闭位'],
    ];
    NOCLAIM37.forEach(([f, idv, why]) => {
      const t = tag37(V37[f], idv);
      if (!t) { F37(f + ' 里找不到 id="' + idv + '" 的开标签（分母失守：这一族的期望 0 不是证据，可能只是元素被改名或删了）'); return; }
      if (t.indexOf('data-sheet-x') >= 0) F37(idv + ' 写了 data-sheet-x="off"：' + why);
    });
    /* 正向对照：合成「locSheet 声明了 off」必须被 tag37 抓到，否则上面那个 0 是恒真判据 */
    const SYN37 = ws37('<div class="location-sheet" id="locSheet" data-sheet-x="off"><div class="sheet__handle"></div></div>');
    if (!tag37(SYN37, 'locSheet') || tag37(SYN37, 'locSheet').indexOf('data-sheet-x') < 0)
      F37('反向认领表失效：合成的「locSheet 自己声明 off」源码都没抓到');
    /* 分母自检：两枚弹层在页面上都还得存在，且第一次开层路径没被别的地方抢先声明 */
    if (cnt37(V37['topic.html'], 'id="locSheet"') !== 1) F37('topic.html 的 locSheet 开标签不是恰 1 枚');
    if (cnt37(V37['node-manager.html'], 'id="infoSheet"') !== 1) F37('node-manager.html 的 infoSheet 开标签不是恰 1 枚');
  }

  /* ⑨ 灵魂：open() 里 ensureX 必须排在 isOpen 守卫之前 */
  {
    const OB = fnBody37(V37['ui.js'], 'open: function (label) {');
    if (!OB) F37('抽不出 sheet.open 函数体');
    else {
      const ix = OB.indexOf('ensureX();'), ig = OB.indexOf('if (api.isOpen()) return;');
      if (ix < 0) F37('sheet.open 不再调 ensureX：右上角那枚 X 只有首次开层才有，而 node-manager 的「想去」开关会重画整张卡（innerHTML 换掉 DOM），X 当场消失');
      if (ig < 0) F37('sheet.open 里没有 isOpen 守卫（§36 钉过的那条没了），本节的顺序断言失去依据');
      else if (ix >= 0 && !(ix < ig)) F37('ensureX 没有排在 isOpen 守卫之前：已开着再 open 会先 return，重画掉的 X 补不回来');
      if (cnt37(OB, 'ensureX();') !== 1) F37('sheet.open 体内 ensureX() 不是恰 1 次：开层路径分叉了');
      const BADX = flat37('open: function (label) { if (api.isOpen()) return; ensureX(); el.classList.add(cls); }');
      if (BADX.indexOf('ensureX();') < BADX.indexOf('if (api.isOpen()) return;'))
        F37('open 顺序断言的反向对照失效（合成的「守卫在前的」源码没排在 ensureX 之前）');
      const GOODX = flat37('open: function (label) { el.setAttribute("aria-label", lb); ensureX(); if (api.isOpen()) return; el.classList.add(cls); }');
      if (!(GOODX.indexOf('ensureX();') < GOODX.indexOf('if (api.isOpen()) return;')))
        F37('open 顺序断言的正向对照失效：合成正确源也被打红，这条锚会不分对错一直红');
    }
    /* 灵魂：ensureX 体内 off 判定必须排在插入之前 */
    const XB = fnBody37(V37['ui.js'], 'function ensureX() {');
    if (!XB) F37('抽不出 ensureX 函数体');
    else {
      const io = XB.indexOf("=== 'off') return;"), ii = XB.indexOf('el.insertBefore(xBtn, el.firstChild);');
      if (io < 0) F37('ensureX 里没有 off 判定（认领表失去执行者，四枚自带关闭控件的弹层会被叠上第二枚 X）');
      if (ii < 0) F37('ensureX 里没有 insertBefore（X 根本不进 DOM，本批等于没做）');
      else if (io >= 0 && !(io < ii)) F37('ensureX 的 off 判定没有排在插入之前：自带 .x/.ms-close/.nx 的弹层会先插一枚再退回，两枚 X 叠在同一个角（实测过的「双 X」形状）');
      if (cnt37(XB, 'insertBefore') !== 1) F37('ensureX 体内 insertBefore 不是恰 1 次：多一处就绕过了 parentNode 幂等判定，重开一次叠一枚');
      const BADO = flat37("function ensureX() { el.insertBefore(xBtn, el.firstChild); if (el.getAttribute('data-sheet-x') === 'off') return; }");
      if (BADO.indexOf('el.insertBefore(xBtn, el.firstChild);') > BADO.indexOf("=== 'off') return;"))
        F37('ensureX 顺序断言的反向对照失效（合成的「先插再判」源码没排在 off 判定之后）');
      const GOODO = flat37("function ensureX() { if (el.getAttribute('data-sheet-x') === 'off') return; if (!xBtn) { xBtn = mk(); } el.insertBefore(xBtn, el.firstChild); }");
      if (!(GOODO.indexOf("=== 'off') return;") < GOODO.indexOf('el.insertBefore(xBtn, el.firstChild);')))
        F37('ensureX 顺序断言的正向对照失效：合成正确源也被打红');
    }
  }

  /* ⑩ 壳与仓库副本逐字节对账：不一致＝改了但没进 APK（用户只在手机上验） */
  {
    const SHELL37 = (process.env.TRACE_ANDROID_SHELL || 'F:/MyAi/trace/lvyou-v2-android').replace(/\\/g, '/');
    const JP_REL = 'app/src/main/java/com/gujian/guditu/MainActivity.java';
    const repoP = JP, shellP = SHELL37 + '/' + JP_REL;
    if (!fs.existsSync(repoP)) F37('缺 ' + repoP + '（入库的壳源副本，§37 的 textZoom 锚点全挂在它上面）');
    else if (fs.existsSync(shellP)) {
      const norm = s => s.replace(/\r\n/g, '\n');
      const a = norm(fs.readFileSync(repoP, 'utf8')), b = norm(fs.readFileSync(shellP, 'utf8'));
      if (a !== b) F37('交付壳 MainActivity.java 与入库副本不一致：改的是仓库那份，构建吃的是壳那份——textZoom 归一不会进 APK（同步方向：仓库 → 壳，见「APK 构建流水线」）');
    } else {
      console.log('壳源对账: SKIP（' + shellP + ' 不在本机，textZoom 那条只钉了仓库内的副本，APK 里有没有要另行验包）');
    }
  }

  /* 期望 0：改前形态与废弃写法不许回潮。
     ctrl 一律写成**改前的那段源码形状**（不是把 needle 拼回一个串）——后者只证明 flat37 没把
     字符串吃掉，是恒真判据；前者才证明「真有人写回旧写法，这条会说话」。口径同 §34/§36。 */
  const ZERO37 = [
    ['planner.js', '<div class="row" style="gap:10px">',
      '<div class="fld"><label>是否环线</label><div class="row" style="gap:10px">',
      '向导三行改前的裸写法：没有 row-opt 就没有 min-width:0，两枚长文案并排顶穿卡片（328 档实测第二枚 right=395）'],
    ['planner.js', 'display:flex;gap:8px;margin-top:12px',
      '<div style="display:flex;gap:8px;margin-top:12px">',
      '浏览弹层那行改前是内联 flex：工具类收口后这类逐页手写的并排行要归零，否则下一处窄屏溢出没人负责'],
    ['planner.js', '正序 · 从起点出发',
      '<button class="btn" id="wOrderAsc" style="flex:1">正序 · 从起点出发</button>',
      '整串不可断的旧文案：nowrap 下只能整体溢出，「从起点出发」那半截就是被裁掉的'],
    ['planner.js', '倒序 · 从远端返回',
      '<button class="btn" id="wOrderDesc" style="flex:1">倒序 · 从远端返回</button>',
      '同上，用户报的那一枚（「倒序：从....」后面看不到内容）'],
    ['ui.js', 'closeX',
      "if (opts.closeX === false) return;",
      'opts.closeX 方案已废弃：控制器缓存在元素上，只有第一次 UI.sheet() 的 opts 算数，而各页第一次常是 close()——跟调用顺序走的声明等于没声明'],
    ['design.css', '.row-opt>.btn{',
      '.row-opt>.btn{min-width:0;white-space:normal}',
      '选择器太窄的改前形态：#infoSheet 的 .is-btn 不是 .btn，那行不会收缩——同一条修复在不同页面静默失效'],
    ['design.css', '.ui-sheet-x{position:absolute',
      '.ui-sheet-x{position:absolute;right:10px;top:8px}',
      '绝对定位会被滚动容器带走：locSheet 的 lsBody 自己滚，X 会跟着内容滚出视野（这条改回 float 就是「看不到」的第二个成因）'],
    ['ui.js', 'el.appendChild(xBtn)',
      'el.appendChild(xBtn);',
      'append 到末尾＝跟在长列表后面，弹层顶部看不见关闭钮；只许 insertBefore(firstChild)'],
    ['tools/smoke-usable.js', '手机三档',
      "check('U19 手机三档：地图容器仍满宽贴着视口左边',",
      '取样档已改成四档（328 补进来）；标签回到「三档」而循环体是四档，就是文档与闸门各说一套'],
  ];
  ZERO37.forEach(([f, needle, ctrl, why]) => {
    if (cnt37(V37[f], needle) !== 0) F37(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt37(flat37(ctrl), needle) < 1) F37('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });
  /* 单点出处族：X 的 class 与 off 声明只许活在该在的地方。
     文档（README 的 §37 登记块）里要提这些名字，所以出处族只扫代码文件——
     把说明文字算进计数，下一句文档就顶红一条「有人私搭」的假警报。 */
  const CODE37 = FILES37.filter(f => f !== 'README.md');
  CODE37.forEach(f => {
    if (f === 'ui.js' || f === 'design.css') return;
    if (cnt37(V37[f], 'ui-sheet-x') !== 0) F37(f + ' 里出现 ui-sheet-x：右上角 X 的样式只由 ui.js 挂、design.css 定义，页面自己造第二枚就没有「重画后补回」那一条腿');
  });
  CODE37.forEach(f => {
    const want = (f === 'ui.js') ? 1 : (['topic.html', 'node-manager.html', 'travel-map.html', 'topic-common.js'].indexOf(f) >= 0 ? 1 : 0);
    const got = cnt37(V37[f], 'data-sheet-x');
    if (got !== want) F37(f + ' 的 data-sheet-x 出现 ' + got + ' 次（登记 ' + want + '）：读取方 1（ui.js）＋声明方 4（自带关闭控件的弹层），多一处就是有人新认领了 off 却没登记控件，少一处就是那枚弹层会被叠 X');
  });

  if (V37['README.md'].indexOf('§37') < 0) F37('README.md 的 verify 清单没提 §37（新闸门不写进 README 就等于没装）');

  console.log('真机视口与弹层关闭闸门: ' + A37.length + ' 条代码锚点（壳侧 setTextZoom 两处恰 1 + 二选一按钮行五条整串 + X 单点九条 + 认领声明四条 + 自带控件在案四条 + 取样档四条 + ≤360 真机档一条）+ 认领表配对（声明 off 者必须有自家关闭控件，四条各恰 1）+ 反向认领表（locSheet/infoSheet 开标签内不许出现 data-sheet-x，配合成源正向对照与 id= 恰 1 分母自检）+ 两组灵魂顺序断言（open 的 ensureX 早于 isOpen 守卫、ensureX 的 off 判定早于 insertBefore，各配反向与正向合成源；ensureX 体内 insertBefore 恰 1 次＝幂等）+ 壳与仓库副本逐字节对账（壳不在本机打 SKIP，不假装通过）+ 九族期望 0（裸 row／内联 flex 行／整串旧文案两处／opts.closeX／.row-opt>.btn 窄选择器／X 的绝对定位／append 写法／「手机三档」旧标签）与单点出处族（ui-sheet-x 只出 ui.js+design.css、data-sheet-x 读 1 声明 4）；每条期望 0 都配正向对照；变异自测见 tools/out/mut-verify37.js');
  fail += bad37;
}



/* ============ §38 记账与行程入口解耦闸门（批次 24） ============
   这一批的立论不是「加个功能」而是「功能有，入口太窄」：排期／打卡／开销／清单／票原先只活在
   规划结果页尾部，不进规划页的人等于没有这五样。所以本节钉的是**入口拓扑与口径唯一性**：
     ① 实际口径（logStart／realDays）的写入口只有 trip.html 那一个 patchTrip，其余文件只许读——
        第二处写入口就是第二套「实际走了几天」，两边迟早不一致，而界面上零提示；
     ② 入口只加不减：planner 结果页 12 颗按钮一颗不许少（白名单反查缺失＋数量对账），
        本批加的只有 #tripHomeSlot 那一行；
     ③ 表单单份：金额／分类／日期只有 expense-form.js 一份实现，三个宿主共用（漂的第一天就是
        「页面上六个分类、面板里五个」）；分类名单只许出自 Expense.CATS；
     ④ 四条分支各就各位：列表态／单趟态／认不出的 id／free 桶——且**绝不拿 URL 上的 id 建桶**；
     ⑤ 常驻读数：me.html 两张卡是纯读数，合计走 yearCents（跨桶；反推不出日期的不进任何年份），
        分类只能自己按 byDate 的分组筛年——catTotals 不分年，用了就是把往年的账算进今年；
        桶列表要并上 Expense.tripIds()（行程删了，那批孤儿账合计还认、分类不能看不见它）；
     ⑥ 一条已入库的真缺陷要钉住：--fs-11 全站未定义，CSS 变量解析失败后静默退化成继承的 16px，
        而 44px 触控高度与横向溢出两类判据都量不到字号（浏览器侧由 smoke-trip T45／T52 断 ≥20px）。
   口径同 §21/§31/§36/§37：四元组守卫、期望 0 一律配正向对照、.js/.css 视图剥块注释、
   .html 视图只归一空白不剥注释（所以锚点串一律写成归一后的整串）。
   ============================================================ */
{
  let bad38 = 0;
  const F38 = m => { bad38++; console.log('FAIL §38 记账与行程入口解耦闸门: ' + m); };
  const ws38 = s => s.replace(/\s+/g, ' ').trim();
  const flat38 = s => ws38(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt38 = (s, n) => s.split(n).length - 1;
  const rd38 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view38 = f => /\.html$/.test(f) ? ws38(rd38(f)) : flat38(rd38(f));
  const fnBody38 = (src, head) => {
    const a = src.indexOf(head);
    if (a < 0) return null;
    const open = src.indexOf('{', a);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
    }
    return null;
  };
  /* 归一后的 HTML 里，一枚元素的开标签＝从它的 id="…" 到下一个 '>' 为止 */
  const tag38 = (src, idv) => {
    const a = src.indexOf('id="' + idv + '"');
    if (a < 0) return null;
    const gt = src.indexOf('>', a);
    return gt < 0 ? null : src.slice(a, gt);
  };

  const FILES38 = ['trip.html', 'me.html', 'expense.html', 'expense.js', 'expense-form.js',
    'planner.js', 'planner.html', 'travel-notes.js', 'design.css',
    'tools/smoke-trip.js', 'tools/smoke-expense.js', 'README.md'];
  const V38 = {};
  FILES38.forEach(f => {
    if (!fs.existsSync(f)) { F38('缺 ' + f); V38[f] = ''; return; }
    V38[f] = view38(f);
  });
  /* 产品文件（文档与判据不算进出处族计数：把说明文字算进去，下一句文档就顶红一条假警报） */
  const CODE38 = FILES38.filter(f => f !== 'README.md' && f.indexOf('tools/') !== 0);

  const A38 = [
    /* ① 24-A 数据层：date 权威、free 桶、实际口径优先 */
    ['expense.js', "var CATS = ['交通', '住宿', '餐饮', '门票', '购物', '其他'];", 1, '分类名单全站只此一份：第二份名单漂的第一天就是「页面上六个分类、面板里五个」'],
    ['expense.js', "var FREE_ID = 'free';", 1, '「未编排行程」桶的 id 只在这一处定义，各处一律走 Expense.FREE_ID'],
    ['expense.js', "var FREE_NAME = '未编排行程';", 1, '同上：桶名是给用户看的字，散写三处就会有三张不同措辞的空态'],
    ['expense.js', 'if (!tripId) return null;', 1, '「没有 tripId 就不落账」这条不许被兜底改掉——free 桶的唯一豁免口是调用方显式传 FREE_ID，不是这里偷偷填一个'],
    ['expense.js', 'function tripIds() {', 1, '账本里出现过的全部 tripId（含孤儿账）：跨桶视图按它建桶，行程一删，合计还认这笔钱、分类不能看不见它'],
    ['expense.js', 'yearCents: yearCents, tripIds: tripIds,', 1, '两个跨桶读数都在导出串上：漏一个导出页面就调不到，只有运行时才红'],
    ['expense.js', 'var d = effDate(x, t && (t.logStart || t.startDate));', 1, 'yearCents 按**实际口径**筛年：排期只是参考时，钱要跟着真实那一天走'],
    ['expense.js', 'if (d.slice(0, 4) === y) { c += centsOf(x); n++; }', 1, '反推不出日期的条目不进任何年份——宁可少算（看得见），也别把去年的账算进今年（对账时才发现）'],
    ['expense.js', 'var s = isoOf(tr.logStart) || isoOf(tr.startDate); if (!s) return;', 1, 'activeTripOf 同样是实际优先、判不出就不猜：猜错行程等于把钱记到另一趟头上'],
    ['expense.js', 'var n = Math.max(Math.round(Number(tr.realDays)) || 0, (tr.days || []).length);', 1, '进行中窗口取实际与计划的较大者：多走的那几天仍在路上，不能因为超出计划就把这趟判成走完'],
    ['expense.js', 'copy.date = d; out.push(copy); filled++;', 1, 'migrate 只改副本（纯内存、不落盘）：替用户写一个他没记过的日期进账本，是对账时最坏的一种'],
    /* ② 24-C 表单单份实现 */
    ['expense-form.js', 'function render(root, cfg) {', 1, '「记一笔」表单的唯一实现：金额／分类／日期各写一套就是两套口径'],
    ['expense-form.js', 'Expense.CATS.map', 1, '分类只从 Expense.CATS 现取，表单里不许钉一份自己的'],
    ['expense-form.js', 'if (info.id === Expense.FREE_ID) {', 1, 'free 桶那一档必须说真话（「没有行程也能记」），不能套用行程口径的提示'],
    ['expense-form.js', '.x-form .chip{min-height:44px', 1, '分类是行中要点的东西：44px 是本项目的触控口径，不是设计偏好'],
    ['expense-form.js', '.x-form .x-btn{min-height:44px', 1, '同上，取消／记上两枚'],
    ['expense.html', "var form = ExpenseForm.render($('adForm'), {", 1, '宿主一：记账主页底部的「记一笔」弹层'],
    ['trip.html', "var form = ExpenseForm.render($('adForm'), {", 1, '宿主二：行程主页的「记一笔」（行中入口，同一份表单）'],
    ['travel-notes.js', "expForm = ExpenseForm.render($X(ui.panel, '#tnExpForm'), {", 1, '宿主三：随手记面板的「记开销」档——§36 明令本文件不许出现 UI.sheet(，所以这一档是内嵌表单而不是再叠一层弹层'],
    ['travel-notes.js', 'function expOn() { return !!(window.Expense && window.ExpenseForm); }', 1, '门控：没载这两个模块的页面（旧壳／纯预览页／专题页）整条分段控件不出现，而不是点下去报错'],
    ['travel-notes.js', 'start: Expense.isoOf(t.logStart) || Expense.isoOf(t.startDate),', 1, '面板侧选桶也走实际口径（读，不写）'],
    /* ③ 24-D trip.html：实际口径的唯一写入口 */
    ['trip.html', 'function patchTrip(fn) {', 1, 'logStart／realDays 的**唯一写入口**：按 id 找到那一条、只改那一个字段、整表回写'],
    ['trip.html', 'for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === tripId) { hit = list[i]; break; }', 1, '整串：只认 id 相等的那一条，不认「第一条」也不认下标'],
    ['trip.html', "if (!hit) { UI.toast('这趟行程在本机找不到，改动没存上'); return false; }", 1, '找不到就说一句真话并退回，绝不顺手建一个桶——孤儿桶会无界攒在 localStorage 里'],
    ['trip.html', 'if (v) t.logStart = v; else delete t.logStart;', 1, '清空＝**删键**回到计划口径；留一个空串会让「实际出发日」在界面上变成一个说不清的状态'],
    ['trip.html', 'if (v) t.realDays = v; else delete t.realDays;', 1, '同上；留一个 0 会让「实际 0 天」直接上屏'],
    ['trip.html', "if (document.activeElement !== $('tRealStart')) $('tRealStart').value = rs || '';", 1, '输入框正在编辑时不回写：change 到达时焦点还在框上，回写会把用户刚敲的数按自己的口径重排'],
    ['trip.html', "if (document.activeElement !== $('tRealDays')) $('tRealDays').value = trip.realDays || '';", 1, '同上，实际天数那一格'],
    ['trip.html', 'function realStart(t) { return Expense.isoOf(t && t.logStart); }', 1, '计划与实际两个口径分开取，谁也不冒充谁：这一页全部读数都从这两个函数出发'],
    ['trip.html', 'function startOf(t) { return realStart(t) || planStart(t); }', 1, '需要「一个出发日」的地方一律实际优先'],
    ['trip.html', 'return isFinite(n) && n > 0 ? n : planDays(t);', 1, '实际天数留空就回落计划天数——留空是合法状态，不是 0'],
    /* ④ 24-D trip.html：四条分支 */
    ['trip.html', 'function render() { if (trip) renderTrip(); else renderPick(); }', 1, '两态枢纽只有一处分叉：多出第二条 render 路径就是两态各自漂'],
    ['trip.html', "$('pickCard').style.display = list.length ? 'block' : 'none';", 1, '零行程时收起空选择器卡（本批自查抓到的真缺陷：空选择器与空态同时 block，页顶露出一张空卡）'],
    ['trip.html', "$('tEmpty').style.display = list.length ? 'none' : 'block';", 1, '同一条判定的另一半：两个 display 必须共用 list.length，各写一个条件就会同时出现'],
    ['trip.html', '不排期，直接记一笔 →', 1, '空态指路必须指着真能点到的地方（planner.html:147 那条老教训）'],
    ['trip.html', '没排过期也能记账：', 1, '列表态的豁免口：不用排期功能的人也要有一条路进账本'],
    ['trip.html', 'function showUnknown() {', 1, 'URL 上认不出的 id 有专门的收尾态，而不是静默停在列表态让人以为链接坏了'],
    ['trip.html', 'if (!t) { showUnknown(); return; }', 1, 'open() 的第一道闸：认不出就退回，绝不往下走到「赋值 + 建桶」'],
    ['trip.html', "if (q === Expense.FREE_ID) { location.replace('expense.html?trip=' + Expense.FREE_ID); }", 1, 'free 桶不是行程、没有主页可言：直接转送记账页，不在这里造一个空壳 trip 对象'],
    /* ⑤ 24-D trip.html：票卡异步与红线 */
    ['trip.html', 'var tid = tripId;', 1, '先捕获当时的 id：IndexedDB 回来时用户可能已经换了另一趟'],
    ['trip.html', 'if (tripId !== tid) return;', 1, '守卫必须比这个快照，写成 if (tripId !== (trip && trip.id)) return; 是**恒等式**（守卫等于没有），而这类失效守卫在单机上永远看不出来'],
    ['trip.html', "$('tTbN').textContent = '…'; $('tTbD').textContent = '';", 1, '先置空再异步填：上一趟的读数留在屏上，比短暂少一个数更容易骗人'],
    ['trip.html', 'if (window.TicketBox && TicketBox.nudge) TicketBox.nudge(tripId);', 1, '提醒只走 24 小时页内横幅（批次 17 的红线：这一族一律不碰系统通知）'],
    /* ⑥ 24-D trip.html：aria-live 的显式豁免（全站唯一一枚页面级活区） */
    ['trip.html', '<div class="t-today" id="tToday" aria-live="polite"></div>', 1, '整串：豁免的前提是它守 §36 同一套时序——**空着进 DOM**、文案由 renderOverview 之后写；带字一次插入读屏就不播了'],
    ['trip.html', 'aria-live', 1, '本页只此一枚活区；冒出第二枚就是要往 §36 的「全站唯一出处」族里再开一个口子'],
    ['trip.html', "$('tToday').innerHTML = h;", 1, '写字只在这一处（先空后写的「后写」那一步）'],
    /* ⑦ 24-D planner：只加不减 */
    ['planner.html', '<div id="tripHomeSlot"></div>', 1, '结果页只多一个槽位，不在 HTML 里写死那一行（renderResult 才填）'],
    ['planner.html', '<div class="act-row" id="actRow"></div>', 1, '12 颗按钮的宿主还在原地（下面白名单反查缺失）'],
    ['planner.js', "var th = $id('tripHomeSlot');", 1, '入口行的填充点'],
    ['planner.js', '这趟的主页：打卡 · 开销 · 出发前 · 我的票</a>', 1, '文案四项与 trip.html 那四张卡一一对应：少一项就是卡片改名了而入口还指着旧名字'],
    ['planner.js', "var qTrip = new URLSearchParams(location.search).get('trip');", 1, '?trip=<id> 直达结果页：trip.html 顶栏那颗圆钮回来时要落回同一趟，否则用户看到的是空白规划态'],
    ['planner.js', 'if (at >= 0) window.plannerOpenTrip(at);', 1, '直达走产品自己的入口（不是另写一套恢复逻辑）'],
    ['planner.js', "else toast('本机没有这趟行程（可能已删除，或换了一台机）');", 1, '认不出只 toast 一句真话，同样绝不建桶'],
    /* ⑧ 24-E me.html：两张常驻读数卡 */
    ['me.html', '<div class="panel"><div class="ph">我的行程</div><div id="meTrips"></div></div>', 1, '整串：行程在「我的」这一层常驻（此前只活在规划结果页尾部，不进规划页的人等于没有这个功能）'],
    ['me.html', '<div class="msum"><b id="meYearSum">0.00</b><i>元</i><span class="mcnt" id="meYearCnt"></span></div>', 1, '整串：今年合计是主角数字，笔数是它的注脚'],
    ['me.html', '<a class="mbtn" href="expense.html">打开记账本</a>', 1, '卡片是纯读数，点击一律跳到**能改**的那一页'],
    ['me.html', '<script src="expense.js"></script>', 1, '账本模块在位（少一个 script 这页只会印空读数，而且不报错）'],
    ['me.html', '<script src="checklist.js"></script>', 1, '清单统计在位（行程行那格「清单 d/t」的读者）'],
    ['me.html', '<script src="ticketbox.js"></script>', 1, '票据库在位（行程行那格「票 N 张」的读者）'],
    ['me.html', 'Expense.yearCents(year, function(id){ return byId[id] || null; })', 1, '合计走 yearCents：跨桶、按实际口径筛年、反推不出日期的不进任何年份'],
    ['me.html', 'Expense.tripIds()', 1, '桶列表要并上账本里出现过的 tripId，否则行程全删光后合计还在、分类一片空白（截图人审抓到的就是这个）'],
    ['me.html', "if (!seen[Expense.FREE_ID]) buckets.push({ id: Expense.FREE_ID, start: '' });", 1, 'free 桶补位必须去重：tripIds() 已经含 free，再无条件 push 一次就是把「未编排行程」算两遍（第一版实测餐饮 133.33 而非 83.33）'],
    ['me.html', "s.setAttribute('data-tk', String(tk.length));", 1, '异步补票数的幂等旗子：me.html 在 TravelNotes._onReady 后会整体重画，两次回调落同一新节点，没有旗子就印两遍「票 2 张 · 票 2 张」'],
    ['me.html', '<a class="mbtn pri" href="planner.html">去排一趟行程</a>', 1, '零行程空态第一条路（这一页是「不用排期的人」唯一的落脚点，空态不许留白板）'],
    ['me.html', '不排行程，直接记一笔</a>', 1, '零行程空态第二条路：不排期也能记账，两件事各走各的门'],
    ['me.html', 'if (window.Expense) { renderTrips(); renderYear(); }', 1, '两张卡的渲染挂在同一个门控后（模块没载就整块不画，而不是画两张 0.00 的空卡）'],
    ['me.html', '-webkit-line-clamp:2', 1, '行程行小字两行夹断：单行 ellipsis 会把「打卡 d/t · 清单 d/t · 票 N 张」整截吃掉（截图人审抓到的第二处）'],
    ['me.html', '.msum b{font-family:var(--font-serif);font-size:var(--fs-10)', 1, '主角数字用已核定的顶档 --fs-10（1.5rem；≤360 那档降到 1.25rem＝20px，正是 T45／T52 断 ≥20px 的下界来源）'],
    ['me.html', '.mbtn{display:flex', 1, '空态两枚按钮的 44px 触控口径挂在这一族上'],
    /* ⑨ 24-B expense.html：按真实日期看账 */
    ['expense.html', 'Expense.byDate(tripId, start)', 1, '账单主体按真实日期分组，与 trip.days 的长度无关（计划 3 天实际走 5 天，第 4、5 天照样成组）'],
    ['expense.html', '<script src="expense-form.js"></script>', 1, '记账页载的是那一份表单实现'],
    ['trip.html', '<script src="expense-form.js"></script>', 1, '行程页同样（两页各写一份表单＝两套分类名单的开始）'],
    /* ⑩ 字号阶梯：顶档核定与真机档 */
    ['design.css', '--fs-10:1.5rem', 1, '顶档定义在案：主角数字只能引这一档'],
    ['design.css', ':root{--fs-8:1rem;--fs-9:1.125rem;--fs-10:1.25rem;', 1, '≤360 真机档把顶档降到 20px（328 落的就是这一档），所以浏览器侧的下界断言写 ≥20px 而不是 ≥24px'],
    /* ⑪ 判据在场：字号这条腿只能从浏览器侧断 */
    ['tools/smoke-trip.js', "ok('T45 ", 1, '「今年合计」的计算字号 ≥20px：源码扫描抓不到页内 <style> 里的 var(--*)（§21 的阶梯闸门只核 design.css 那一份定义集）'],
    ['tools/smoke-trip.js', "ok('T52 ", 1, '三处主角数字（#tPlanN／.t-money b／.x-year b）的字号回归网：--fs-11 那次就是 38 条绿灯全过而数字实际不大'],
    ['tools/smoke-trip.js', "{ width: 328, height: 723 }", 2, '真机主档取样两页（trip.html 与 me.html）：328×723 是一加 Ace 6T 实测 CSS 视口，不带它「真机档已验证」验的是一台不存在的手机'],
  ];
  A38.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F38('A38 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V38)) { F38('A38 登记了 §38 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt38(V38[file], needle);
    if (got !== want) F38(file + ' 里「' + needle.slice(0, 60) + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A38.length < 65) F38('锚点表被削减：' + A38.length + ' 条（批次 24 落地时实测 77 条，阈值取 65——整组删掉就等于这节没了）');

  /* ⑫ 入口只加不减：12 颗按钮白名单**反查缺失** + 数量对账
     只数数量抓不到「删一颗加一颗」，只查白名单抓不到「同一颗写两遍挤掉别的」，两条一起才算数。 */
  const ACT38 = ['plannerStartTrip', 'plannerSaveTrip', 'plannerAddAllWish', 'plannerCopyPlan',
    'plannerShare', 'plannerExportGPX', 'plannerExportIcs', 'plannerBuildBook',
    'plannerBuildAlbum', 'plannerReschedule', 'plannerEditPick', 'plannerOpenFootprint'];
  const RB38 = fnBody38(V38['planner.js'], 'function renderResult() {');
  if (!RB38) F38('抽不出 planner.renderResult 函数体（12 颗按钮的白名单失去宿主，本节最重的一条断言没跑）');
  else {
    const miss38 = ACT38.filter(n => cnt38(RB38, 'window.' + n + '(') < 1);
    if (miss38.length) F38('planner 结果页 #actRow 少了 ' + miss38.length + ' 颗按钮：' + miss38.join(' / ') + '（本批的立论是「入口只加不减」：加的是 #tripHomeSlot 那一行，删一颗老按钮就是拿新入口换旧入口，用户已经长在手上的肌肉记忆当场断掉）');
    const n38 = cnt38(RB38, 'window.planner');
    if (n38 !== 12) F38('renderResult 体内 window.planner* 调用不是 12 处而是 ' + n38 + '：白名单只反查缺失，数量变了（同一颗写两遍、或换了一颗名字）它抓不到');
    if (cnt38(RB38, "$id('actRow').innerHTML =") !== 1) F38('renderResult 体内 #actRow 的赋值不是恰 1 处：按钮行分叉成两处填充，白名单只能看到其中一处');
    if (cnt38(RB38, "trip.html?trip=") !== 1) F38('renderResult 体内 trip.html?trip= 不是恰 1 处：行程主页入口重复或缺失（这一行是本批唯一新增的入口）');
  }

  /* ⑬ 写入口唯一：logStart／realDays 只有 trip.html 那一个 patchTrip 会写，其余产品文件只许读 */
  const WR38 = ['t.logStart = v', 't.realDays = v', 'delete t.logStart', 'delete t.realDays'];
  WR38.forEach(n => { if (cnt38(V38['trip.html'], n) !== 1) F38('trip.html 里「' + n + '」不是恰 1 处：实际口径的写入口分叉了'); });
  CODE38.forEach(f => {
    if (f === 'trip.html') return;
    ['logStart =', 'logStart=', 'realDays =', 'realDays='].forEach(n => {
      if (cnt38(V38[f], n) !== 0) F38(f + ' 里出现「' + n + '」：logStart／realDays 的写入口只许 trip.html 那一个 patchTrip——第二处写入口就是第二套「实际出发日／实走天数」，两边迟早不一致，而界面上零提示（读法一律是 isoOf(t.logStart) 这种取值形，不带等号）');
    });
  });
  if (cnt38(flat38('t.logStart = v;'), 'logStart =') < 1) F38('写入口唯一那条期望 0 的正向对照失效了（上面那些 0 不是证据）');
  /* patchTrip 体内三步顺序：先判找不到 → 再改那一个字段 → 最后整表回写（顺序倒了就是「先写盘后发现没这条」） */
  const PB38 = fnBody38(V38['trip.html'], 'function patchTrip(fn) {');
  if (!PB38) F38('抽不出 trip.html 的 patchTrip 函数体');
  else {
    const i1 = PB38.indexOf("if (!hit) { UI.toast("), i2 = PB38.indexOf('fn(hit);'), i3 = PB38.indexOf('writeTrips(list)');
    if (i1 < 0 || i2 < 0 || i3 < 0) F38('patchTrip 三步（找不到就退／改那一个字段／整表回写）有缺件，顺序断言已失去意义');
    else if (!(i1 < i2 && i2 < i3)) F38('patchTrip 三步顺序不是「判定 → 改字段 → 回写」：先回写再判定就是把一条不存在的行程写进 tn_trips（孤儿桶的成因）');
    const BADP = flat38('function patchTrip(fn) { var list = readTrips(), hit = null; fn(hit); writeTrips(list); if (!hit) { UI.toast("x"); return false; } }');
    if (BADP.indexOf('fn(hit);') > BADP.indexOf("if (!hit) { UI.toast(")) F38('patchTrip 顺序断言的反向对照失效（合成的「先改再判」源码没被抓到）');
    const GOODP = flat38('function patchTrip(fn) { if (!hit) { UI.toast("x"); return false; } fn(hit); if (!writeTrips(list)) return false; }');
    if (!(GOODP.indexOf("if (!hit) { UI.toast(") < GOODP.indexOf('fn(hit);'))) F38('patchTrip 顺序断言的正向对照失效：合成正确源也被打红，这条锚会不分对错一直红');
  }

  /* ⑭ 灵魂：认不出的 id 绝不建桶——showUnknown 的判定必须早于「赋值 tripId／trip」 */
  const OB38 = fnBody38(V38['trip.html'], 'function open(id) {');
  if (!OB38) F38('抽不出 trip.html 的 open(id) 函数体');
  else {
    const ig = OB38.indexOf('if (!t) { showUnknown(); return; }'), ia = OB38.indexOf('tripId = t.id; trip = t;');
    if (ig < 0) F38('open() 里没有「认不出就走 showUnknown」这道闸：URL 上随便一个 id 都能落到赋值那一步');
    if (ia < 0) F38('open() 里没有 tripId／trip 的赋值（本节顺序断言失去依据，页面也根本进不了单趟态）');
    else if (ig >= 0 && !(ig < ia)) F38('open() 的守卫没有排在赋值之前：认不出的 id 会先把 trip 置成 null 再走单趟态渲染，或者干脆拿 undefined 建桶——孤儿桶就是这么攒出来的');
    const BADO = flat38('function open(id) { var t = findTrip(id); tripId = t.id; trip = t; if (!t) { showUnknown(); return; } render(); }');
    if (BADO.indexOf('if (!t) { showUnknown(); return; }') < BADO.indexOf('tripId = t.id; trip = t;')) F38('open 顺序断言的反向对照失效（合成的「先赋值再判」源码居然满足主判据，这条锚分不出对错）');
    const GOODO = flat38('function open(id) { var t = findTrip(id); if (!t) { showUnknown(); return; } tripId = t.id; trip = t; render(); }');
    if (!(GOODO.indexOf('if (!t) { showUnknown(); return; }') < GOODO.indexOf('tripId = t.id; trip = t;'))) F38('open 顺序断言的正向对照失效：合成正确源也被打红');
  }

  /* ⑮ 灵魂：票卡的异步守卫要比**快照**，且快照要在发起之前捕获 */
  const TB38 = fnBody38(V38['trip.html'], 'function renderTickets() {');
  if (!TB38) F38('抽不出 trip.html 的 renderTickets 函数体');
  else {
    const ic = TB38.indexOf('var tid = tripId;'), il = TB38.indexOf('TicketBox.list(tid)'), ig = TB38.indexOf('if (tripId !== tid) return;');
    if (ic < 0) F38('renderTickets 没有先捕获 id 快照：IndexedDB 是异步的，回来时用户可能已经换了另一趟');
    if (il < 0) F38('renderTickets 没有按快照取票（发起时用的 id 与守卫比的 id 不是同一个，守卫就成了摆设）');
    if (ig < 0) F38('renderTickets 没有换趟守卫：上一趟的票数会印在这一趟的卡上（单机上永远看不出来，因为不会有人在你测量时点另一趟）');
    else if (ic >= 0 && !(ic < ig)) F38('守卫用的 tid 不是在发起之前捕获的：比的是同一时刻的两个副本，恒等式，等于没有守卫');
    const BADT = flat38('function renderTickets() { TicketBox.list(tripId).then(function (rows) { if (tripId !== (trip && trip.id)) return; draw(rows); }); }');
    if (BADT.indexOf('var tid = tripId;') >= 0 || BADT.indexOf('if (tripId !== tid) return;') >= 0) F38('票卡守卫的反向对照 1 失效：合成的恒等式守卫（比 trip.id）里居然含有正确写法的两件');
    const BADT2 = flat38('function renderTickets() { TicketBox.list(tripId).then(function (rows) { if (tripId !== tid) return; var tid = tripId; draw(rows); }); }');
    if (BADT2.indexOf('var tid = tripId;') < BADT2.indexOf('if (tripId !== tid) return;')) F38('票卡守卫的反向对照 2 失效：合成的「快照晚于守卫」源码居然满足主判据（那样比的就是同一时刻的两个副本＝恒等式）');
    const GOODT = flat38('function renderTickets() { var tid = tripId; TicketBox.list(tid).then(function (rows) { if (tripId !== tid) return; draw(rows); }); }');
    if (!(GOODT.indexOf('var tid = tripId;') < GOODT.indexOf('if (tripId !== tid) return;'))) F38('票卡守卫的正向对照失效：合成正确源也被打红');
  }

  /* ⑯ 灵魂：me.html 的分类桶要**先并集再筛年**（顺序倒了，孤儿账的合计与分类就各说一套） */
  const RY38 = fnBody38(V38['me.html'], 'function renderYear(){');
  if (!RY38) F38('抽不出 me.html 的 renderYear 函数体');
  else {
    const ih = RY38.indexOf('Expense.yearCents('), iu = RY38.indexOf('Expense.tripIds()'), ib = RY38.indexOf('Expense.byDate('), iy = RY38.indexOf("g.date.slice(0, 4) !== year");
    if (ih < 0) F38('renderYear 不再调 yearCents：合计要么退回逐桶相加（漏掉孤儿账），要么退回 catTotals（不分年）');
    if (iu < 0) F38('renderYear 不再调 tripIds()：桶列表只剩 tn_trips 里活着的那几趟，行程一删，合计还认这笔钱、分类却看不见它');
    if (ib < 0) F38('renderYear 不再按 byDate 分组筛年：分类前二没有年份维度，往年的账会算进今年');
    if (iy < 0) F38('renderYear 的分组没有按年过滤（byDate 是全量分组，不筛年就是把这趟历年所有账都算成今年）');
    else if (iu >= 0 && ib >= 0 && !(iu < ib)) F38('renderYear 的桶并集没有排在 byDate 之前：先按活着的行程分组再补桶，孤儿账那一批已经漏掉了');
    const BADY = flat38('function renderYear(){ Expense.byDate(a, b).forEach(f); Expense.tripIds().forEach(g); }');
    if (BADY.indexOf('Expense.tripIds()') < BADY.indexOf('Expense.byDate(')) F38('renderYear 顺序断言的反向对照失效（合成的「先分组后并集」源码居然满足主判据，这条锚分不出对错）');
    const GOODY = flat38('function renderYear(){ Expense.tripIds().forEach(function(id){ buckets.push(id); }); buckets.forEach(function(b){ Expense.byDate(b.id, b.start).forEach(f); }); }');
    if (!(GOODY.indexOf('Expense.tripIds()') < GOODY.indexOf('Expense.byDate('))) F38('renderYear 顺序断言的正向对照失效：合成正确源也被打红');
  }

  /* ⑰ trip.html 的页面级 aria-live 是全站唯一豁免：豁免的凭据是「空着进 DOM」，两面都要对账 */
  {
    const emptyLive38 = s => /id="tToday" aria-live="polite"><\/div>/.test(s);
    if (!emptyLive38(V38['trip.html'])) F38('#tToday 不是空着进 DOM 的：页面级活区唯一的豁免凭据就是它守 §36 那套「先空后写」时序，带字一次插入读屏根本不播');
    if (emptyLive38(ws38('<div class="t-today" id="tToday" aria-live="polite">今天是第 1 天</div>')))
      F38('aria-live 豁免判据的反向对照失效：合成的「带字一次插入」源码也被当成空着进 DOM');
    if (!emptyLive38(ws38('<div class="t-today" id="tToday" aria-live="polite"></div>')))
      F38('aria-live 豁免判据的正向对照失效：合成正确源也被打红');
    const t38 = tag38(V38['trip.html'], 'tToday');
    if (!t38) F38('trip.html 里找不到 id="tToday" 的开标签（分母失守：上面那条豁免登记可能只是元素被改名了）');
    /* 与 §36 的「aria-live 全站唯一出处」族互斥对账：两节不许对同一枚活区各说一套 */
    const SELF38 = flat38(rd38(__filename));
    const m36 = SELF38.match(/const FILES36 = \[[^\]]*\]/);
    if (!m36) F38('抽不出 §36 的 FILES36 名单：trip.html 那枚 aria-live 的豁免与 §36「全站唯一出处」族必须互斥，抽不出就没法对账（豁免会变成两节互相打红）');
    else if (/'trip\.html'/.test(m36[0])) F38('§36 的 FILES36 里出现了 trip.html：那一枚页面级 aria-live 是登记在本节的豁免（空着进 DOM、文案后写），扫进 §36 的期望 0 族就是两节各说一套、彼此打红');
  }

  /* ⑱ 期望 0：改前形态与已推翻的写法不许回潮。
     ctrl 一律写成**坏写法的那段源码形状**（不是把 needle 拼回一个串）——后者只证明 flat38 没把
     字符串吃掉，是恒真判据；前者才证明「真有人写回旧写法，这条会说话」。口径同 §34/§36/§37。 */
  const ZERO38 = [
    ['me.html', 'Expense.catTotals(',
      'var cats = Expense.catTotals(tripId);',
      'catTotals **不分年**：直接拿它印「今年已花」的分类，往年的账会算进今年，而合计走 yearCents 是按年的——同一张卡上两个数就此对不上（分类只能自己按 byDate 的分组筛年）'],
    ['trip.html', 'if (tripId !== (trip && trip.id)) return;',
      'TicketBox.list(tripId).then(function (rows) { if (tripId !== (trip && trip.id)) return; });',
      '恒等式守卫：trip 与 tripId 是同一份状态，这个比较永远为假，等于没有守卫——期间换了趟照样把上一趟的票数印上来'],
    ['trip.html', 't.logStart = t.logStart || t.startDate',
      'patchTrip(function (t) { t.logStart = t.logStart || t.startDate; });',
      '把计划日期写进实际口径＝让「实际」永远等于「计划」，双读数就此失去意义（本批的立论恰恰是两者常常完全不同）'],
    ['expense.js', 'localStorage.setItem(KEY, JSON.stringify(migrate(',
      'function load() { var l = raw(); localStorage.setItem(KEY, JSON.stringify(migrate(l, start).list)); return l; }',
      'migrate 只许在**读取时**反推、绝不落盘：替用户写一个他没记过的日期进账本，是对账时发现「这笔我什么时候花的」最坏的一种'],
    ['expense.js', 'copy.date = isoOf(x.ts)',
      'copy.date = isoOf(x.ts) || effDate(x, start);',
      'ts 是**记账动作**的时刻，不是花钱那天：拿它冒充日期，路上补记的旧账会全堆在「今天」'],
    ['me.html', "setItem('tn_trips'",
      "localStorage.setItem('tn_trips', JSON.stringify(list));",
      '「我的」这两张卡是纯读数：读卡片的地方能写行程库，就意味着一次重画可能顺手改掉用户的行程'],
    ['me.html', 'writeTrips',
      'function writeTrips(list) { localStorage.setItem("tn_trips", JSON.stringify(list)); }',
      '同上：写入口只有 trip.html 那一个 patchTrip'],
    ['trip.html', 'new Notification',
      'new Notification("下一张票快到了");',
      '批次 17 的红线：「我的票」相关一律不许碰系统通知，提醒只走 24 小时页内横幅'],
    ['trip.html', 'showNotification',
      'TicketBox.showNotification(tripId);',
      '同上（换 API 名也要红）'],
    ['me.html', 'new Notification',
      'new Notification("今年已花超预算");',
      '同上：读数卡不做系统通知'],
    ['design.css', '--fs-11',
      ':root{--fs-11:1.75rem}',
      '这一档全站未定义：有人真加了它，§21「只许降不许升」的阶梯口径当场失控；没加而页面又引用，就是静默退化成继承的 16px（24-B／24-D 入库过这个真缺陷，主角数字实际不大而 38 条判据全绿）'],
  ];
  ZERO38.forEach(a => {
    /* 口径同 A38：少写一个字段（尤其是那串正向对照）会让解构错位，那个 0 就不再是证据。
       哑掉必须出声。 */
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string') {
      F38('ZERO38 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (cnt38(V38[f], needle) !== 0) F38(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt38(flat38(ctrl), needle) < 1) F38('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });
  /* 未定义令牌族：所有产品文件都不许引用 --fs-11（上面那条钉的是「不许新增这一档」，这条钉的是「不许引用它」） */
  CODE38.forEach(f => {
    if (cnt38(V38[f], 'var(--fs-11)') !== 0) F38(f + ' 里引用了 var(--fs-11)：全站没有这一档，CSS 变量解析失败后**静默**按继承值走（16px），页面上看是「数字不够大」而不是「坏了」，44px 触控高度与横向溢出两类判据都量不到它');
  });
  if (cnt38(flat38('b{font-size:var(--fs-11)}'), 'var(--fs-11)') < 1) F38('--fs-11 引用族那条期望 0 的正向对照失效了');
  /* 分类名单唯一出处：只有 expense.js 许写死那六个名字 */
  CODE38.forEach(f => {
    if (f === 'expense.js') return;
    if (cnt38(V38[f], "'交通', '住宿'") !== 0) F38(f + ' 里私写了一份分类名单：分类只许从 Expense.CATS 现取（表单、条形、CSV、桶都读同一份）');
  });
  if (cnt38(flat38("var C = ['交通', '住宿'];"), "'交通', '住宿'") < 1) F38('分类名单唯一出处那条期望 0 的正向对照失效了');

  /* ⑲ 浏览器腿齐备检：T01–T55 一条不许少（编号连续，少一条就是有个症状没人管） */
  {
    const pad38 = i => 'T' + (i < 10 ? '0' + i : '' + i);
    for (let i = 1; i <= 55; i++) {
      if (V38['tools/smoke-trip.js'].indexOf("ok('" + pad38(i) + ' ') < 0)
        F38('tools/smoke-trip.js 缺 ' + pad38(i) + ' 这条判据（行程主页两态／实际口径落盘／四分支「今天走了哪」／planner 12 颗按钮／me.html 两张卡是一整组）');
    }
    const nT38 = cnt38(V38['tools/smoke-trip.js'], "ok('T");
    if (nT38 !== 55) F38('tools/smoke-trip.js 的判据条数不是 55：' + nT38 + ' 条（24-D 落地 38 条＋24-E 扩到 54 条＋25-C 补 T55＝T01–T55；整组削减等于把这节拆了，编号有空洞上面那条会先红）');
    const nE38 = cnt38(V38['tools/smoke-expense.js'], "ok('");
    if (nE38 < 121) F38('tools/smoke-expense.js 的判据条数掉到 ' + nE38 + '（24-B／24-C 落地时实测 121 条；只设下界不设等号：这一套还会继续长，但一条都不许悄悄消失）');
    if (V38['tools/smoke-trip.js'].indexOf('indexedDB.deleteDatabase') < 0 && V38['tools/smoke-trip.js'].indexOf('freshPage') < 0)
      F38('tools/smoke-trip.js 既没有 freshPage 也没有清库：票与账的夹具会跨轮残留，「读到才补票」那条判据就成了恒真');
  }

  if (V38['README.md'].indexOf('§38') < 0) F38('README.md 的 verify 清单没提 §38（新闸门不写进 README 就等于没装）');
  console.log('记账与行程入口解耦闸门: ' + A38.length + ' 条代码锚点（按文件：expense.js 11 条数据层＝CATS／FREE_ID／FREE_NAME／「没有 tripId 就不落账」／tripIds 与导出／yearCents 的实际口径与筛年／activeTripOf 两条／migrate 只改副本；expense-form.js 5 条＝render 单点、分类只从 CATS 现取、free 那一档说真话、两枚 44px；三个宿主各恰 1（expense.html／trip.html／travel-notes.js）＋面板门控与选桶口径；trip.html 27 条＝实际口径写入口 10（patchTrip 单点、按 id 找那一条、找不到就说真话、清空＝删键两处、编辑中不回写两处、两个口径分开取、留空回落计划）＋四分支 8（两态枢纽、空选择器与空态共用 list.length 互斥、两条豁免口、showUnknown、open 的闸、free 桶转送）＋票卡与红线 4（id 快照、比快照的守卫、先置空再异步填、只走页内横幅）＋aria-live 豁免 3（整串空标签、恰一枚、写字一处）＋表单宿主与 script 2；planner.html 2＋planner.js 5＝入口只加不减；me.html 16 条两张常驻卡；design.css 2 条字号顶档与 ≤360 档；smoke-trip 3 条判据在场）+ 12 颗按钮白名单**反查缺失**与数量对账（renderResult 体内 window.planner* 恰 12、#actRow 赋值恰 1、trip.html?trip= 恰 1——只数数量抓不到「删一颗加一颗」，只查白名单抓不到「同一颗写两遍」）+ 写入口唯一（logStart／realDays 四个写形各恰 1，其余产品文件四种等号形一律 0，配正向对照）+ 五组灵魂顺序断言（patchTrip 判定→改字段→回写、open 的守卫早于赋值、票卡快照早于守卫、renderYear 的桶并集早于 byDate 且分组按年过滤、#tToday 空着进 DOM）各配反向与正向合成源 + §36 FILES36 名单互斥对账（trip.html 不许被扫进「aria-live 全站唯一出处」族，否则两节彼此打红）+ 十一族期望 0（catTotals 不分年／恒等式守卫／把计划日期写进实际口径／migrate 落盘／ts 冒充日期／读数卡写行程库两处／系统通知三处／design.css 新增 --fs-11）与两族唯一出处（var(--fs-11) 全站 0、分类名单只出 expense.js）；每条期望 0 都配正向对照；浏览器腿 T01–T55 齐备检 + 条数守卫（55；smoke-expense 只设下界 121）；变异自测见 tools/out/mut-verify38.js');
  fail += bad38;
}


/* ============ §39 顶栏一族与触控口径闸门（批次 25-B） ============
   这批的根因不在任何一个症状里，而在**同一族几何被写了四遍**：design.css、map.css、页面内联
   <style>、内联 style 属性。页内 <style> 最后加载，同为 !important 且同特异度时后加载者赢，
   于是「谁后加载谁说了算」——40×40 一族在 13 页顶栏里漂着（design.css 已点名 44），同一族圆钮
   在三个文件里长成 36/40/44 三种尺寸，标题被 min-width:0 压到 clientW 2px，61px 的钮把
   「语音记录」排成 3 行。三个症状都只有浏览器 rect 量得到，源码扫描全绿过一次（那 38 条绿灯
   就是本批要补的洞），所以本节两条腿：
     ① 源码侧钉「尺寸只在 design.css 单点点名，各页只留皮肤」——不钉值，钉**出处唯一**：
        各页那族的规则体里出现 width:/height:（含 min-*）就是红，无论写的是 40 还是 44；
     ② 浏览器腿 34 条 rect/computed 判据住在 tools/smoke-topbar.js（K00–K33），本节只钉它们
        在场、编号连续、两档取样（328×723 真机主档 + 320×640 装箱最紧档）都跑。
   收口过程中普查另捞出三处同族，一并量化进浏览器腿：地图浮控件在玻璃柱里贴左（留白 0/8 与
   0/4 → K31）、内容区三枚 40px（.ck-remove／.ech-del／.tb-open → K32）、story 那颗 34px 下拉（K27）。
   口径与 §21/§31/§36/§37/§38 一致：四元组守卫、期望 0 一律配「改前那段源码形状」的正向对照、
   .js/.css 视图剥块注释、.html 视图**只归一空白不剥注释**（所以 .html 的期望 0 一律避开注释里
   会出现的字面量，几何族改走规则体抽取；锚点串一律写成归一后的真实形状，多行 CSS 归一后 `{` 后
   带一个空格，写成紧凑形就是永远打不红的哑锚——口径表预跑见 tools/out/pre39-counts.js）。
   ============================================================ */
{
  let bad39 = 0;
  const F39 = m => { bad39++; console.log('FAIL §39 顶栏一族与触控口径闸门: ' + m); };
  const ws39 = s => s.replace(/\s+/g, ' ').trim();
  const flat39 = s => ws39(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt39 = (s, n) => s.split(n).length - 1;
  const rd39 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view39 = f => /\.html$/.test(f) ? ws39(rd39(f)) : flat39(rd39(f));
  /* 规则体抽取：选择器出现处 → 从它到下一个 } 为止（含选择器本身，好让反向对照看得见是谁的规则） */
  const bodies39 = (src, sel) => {
    const out = [];
    for (let i = src.indexOf(sel); i >= 0; i = src.indexOf(sel, i + 1)) {
      const a = src.indexOf('{', i), b = src.indexOf('}', a);
      if (a < 0 || b < 0) break;
      out.push(src.slice(i, b + 1));
    }
    return out;
  };
  const GEO39 = /width\s*:|height\s*:/;

  const FILES39 = ['design.css', 'map.css', 'travel-map.html', 'node-manager.html', 'wishlist.html',
    'story.html', 'search.html', 'checklist.html', 'album-edit.html', 'expense.html', 'trip.html',
    'planner.html', 'topic.html', 'tools/smoke-topbar.js', 'README.md'];
  const V39 = {};
  FILES39.forEach(f => {
    if (!fs.existsSync(f)) { F39('缺 ' + f); V39[f] = ''; return; }
    V39[f] = view39(f);
  });

  /* ① 单点持有：顶栏一族与触控族的每一寸尺寸都只在 design.css 点名一次 */
  const A39 = [
    ['design.css', '.t-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}', 1, 'flex-wrap 必须在 .t-row 上（动作组整组换行的前置；盒高交给内容撑开，别再回来钉死行高）'],
    ['design.css', '.t-row .back,.t-row .t-ic{width:44px;height:44px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-ink);font-size:var(--fs-6);display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;text-decoration:none}', 1, '返回键与 .t-ic 同一条规则（改前 .t-ic 不存在，四页各抄一遍 inline style 的 40×40）；text-decoration:none 是 <a> 化之后才需要的'],
    ['design.css', '.t-row .t-ic{margin-left:auto}', 1, '右上角那枚动作钮自己贴右（此前靠页内 flex 布局各写一套）'],
    ['design.css', '.t-row .t-ic .ti{margin-right:0}', 1, '.ti 的默认右距是给「图标+文字」用的，纯图标钮要归零，否则图标在 44 的圆里偏左'],
    ['design.css', '.t-row .back:active,.t-row .t-ic:active{transform:scale(.92)}', 1, '同一族共用按压反馈：钮改成 <a> 之后 :active 不会自动跟过来，漏了就是「点了没反应」'],
    ['design.css', '.t-row .title{flex:1 1 7em;min-width:7em;font-family:var(--font-serif);font-weight:400;font-size:var(--fs-8);color:var(--color-ink);letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', 1, '本批两条腿都在这一行：basis 写 7em 而不是 auto（贪心装箱按假想主轴宽排，auto 会把 44 的钮单独掉第二行），下限 7em 而不是 0（改前 min-width:0 让标题在 328 档被压到 clientW 2px）；截断必须是省略号'],
    ['design.css', '.trow-acts{display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto}', 1, '动作组的容器（原名 .t-acts 与 .t-ic 只差一个字母，撞名那次差点被同一条 CSS 一起改掉，故改名）：flex:0 0 auto 让它整体装箱、整组换行'],
    ['design.css', '.topbar{position:sticky;top:0;z-index:100;', 1, '顶栏盒没有写 height（本批把盒高交回内容）；这一行是分母自检——改名或整页换顶栏结构，上面那族会全部 0 命中'],
    ['design.css', '.story-bar .back,.nm-topbar .back{width:44px!important;height:44px!important;min-width:44px;min-height:44px;border-radius:50%}', 1, '两个非 .topbar 的顶栏宿主（故事页、地点管理页）在同一处收口，不各页写一份'],
    ['design.css', 'button.act,button.act.sec,button.mine,button.go{min-height:44px}', 1, '顶栏动作钮的地板（travel-map 的 ≤360 退档把宽高点名成 44，其余页靠这条地板）'],
    ['design.css', '.sbar .mic{width:44px!important;height:44px!important}', 1, '录音钮＝高频，尺寸出处只此一处（search.html 那份 40 已剥，页内只留皮肤）'],
    ['design.css', '.wl-btn{min-height:44px!important}', 1, '想去清单顶栏四枚动作钮'],
    ['design.css', '.wl-remove,.ck-remove,.ech-del,.tb-open{width:44px!important;height:44px!important}', 1, '列表/卡片右端那枚「移除·删除·打开附件」：形状各异（圆、圆角方、缩略图框）但触控档同一档——四条并一条就是「一族只写一遍」的字面证据'],
    ['design.css', '.nm-item-btn{min-height:44px}', 1, '地点清单条目钮（同文件内此前有一条 .nm-item-btn{min-height:36px}，两条自相矛盾、靠先后顺序取胜，那条已剥）'],
    ['design.css', '.is-btn{min-height:44px}', 1, '弹层主操作（node-manager 详情卡）的地板单点持有：页内那条 min-height 已剥'],
    ['design.css', '.ctl button{width:36px!important;height:36px!important;margin:0 auto}', 1, '36px 一族（点名允许低于 44：缩放有双指替代、浮在地图上）；margin:0 auto 不是装饰——玻璃柱的**盒宽**是各页自己写的（travel-map 44／map.css 40），钮收到 36 之后两边没人对账，图标贴左、柱子右侧空一条（实测留白 0/8 与 0/4）'],
    ['design.css', '.leaflet-control-zoom a,.leaflet-touch .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important}', 1, '同一族第二处：node-manager 的页内联从前写 40px，靠后加载盖掉 design.css'],
    ['design.css', '.tripbar .mv,.tripbar .x{min-width:44px;min-height:44px;display:inline-grid;place-items:center}', 1, '行程条的上下移/删除（驾驶场景高频）；条形默认收起没有真 rect，所以浏览器腿 K28 量 computed min-*'],
    /* travel-map：唯一「退纯图标」那一页（地图页顶栏不能长第二行压瓦片） */
    ['travel-map.html', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}', 1, '顶栏高度单点：8 上垫 + 44 触控档 + 10 下垫 + 1 描边 = 63；挂在 body 是因为 .ctl/.laymenu 是顶栏的兄弟，自定义属性只往下继承'],
    ['travel-map.html', 'top:var(--tb-h)', 2, '控件组与图层菜单都读同一个变量（写死 56px 会压在 44 的顶栏上，K22 抓过）'],
    ['travel-map.html', '.ctl{ position:absolute;right:12px;top:var(--tb-h);width:44px;', 1, '盒宽留在这里（皮肤）：那 4px 内衬是有意的，改盒宽要连 .laymenu{right:60px} 一起改，反而多两处耦合'],
    ['travel-map.html', '.laymenu{ position:absolute;right:60px;top:var(--tb-h);width:158px;', 1, '图层菜单的 right 是按 44 的盒算的：与上一条是一对，动一个就得动另一个'],
    ['travel-map.html', '@media(max-width:360px){', 1, '退档阈值 360 定向（真机 328 命中、452 不命中＝K18 与 K21 一红一绿才叫阈值写对）'],
    ['travel-map.html', '.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}', 1, '退成 44×44 圆钮：抬到 44 不是变大，是「文字换成图标后仍然够点」'],
    ['travel-map.html', '.t-row .act .act-label{display:none}', 1, '收掉文字才有标题的可读宽度（K19）；名字改由 aria-label + title 承担（K20）'],
    ['travel-map.html', 'class="trow-acts"', 1, '本页动作组也进同一个容器（改前三页各写一份 flex）'],
    ['travel-map.html', 'aria-label="随手记"', 1, '退档后钮的可访问名（§36 那套口径不许被这批改坏）'],
    ['travel-map.html', 'aria-label="游记"', 1, '同上第二枚'],
    /* node-manager：.is-btn 断字那一族 */
    ['node-manager.html', '#infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}', 1, '动作组整组可换行（此前 flex-wrap 是 JS 里逐处内联写的，两处一套口径）'],
    ['node-manager.html', '#infoSheet .is-btn{flex:1;border-radius:999px;border:1px solid var(--color-line-strong);background:var(--color-surface);color:var(--color-ink-soft);font-size:var(--fs-5);cursor:pointer;font-family:var(--font-sans);white-space:nowrap}', 1, 'nowrap 把地板抬回整条标签宽（改前 328 档四枚各分 61px，「语音记录」断成 3 行）；这一行里**没有** min-height——高度归 design.css 的 .is-btn 单点点名'],
    ['node-manager.html', '#infoSheet .is-btn.ic{display:inline-flex;align-items:center;justify-content:center;gap:5px}', 1, '带图标的钮一律 .ic：design.css 的 .ti 按 flex 父容器写，放进 block 按钮图标会掉到文字下方 5px（K15 量 rect 而不是数行，就是为了不把这 5px 读成断字假阳性）'],
    ['node-manager.html', '#infoSheet .is-btn.ic .ti{margin-right:0}', 1, '同 travel-map 那条右距归零，一族两处'],
    ['node-manager.html', 'class="is-btn ic"', 5, '带图标那族恰 5 枚（两张详情卡各若干）：枚数变了说明有人在 block 钮里塞图标，K15 会当场读成两排'],
    ['node-manager.html', 'id="infoSheet"', 1, '详情卡容器恰一枚（分母自检：期望 0 那族与规则体抽取都要有存在的宿主，否则「0 条违规」不是证据；注意用带 id= 的整串，裸 #infoSheet 在 JS 选择器里有 17 处）'],
    ['node-manager.html', '.leaflet-top.leaflet-right{margin-top:calc(env(safe-area-inset-top,0px) + 66px);margin-right:10px}', 1, '缩放控件给顶栏让位：66 = 44 触控 + 8 上垫 + 1 描边 + 13 余量（与 travel-map 的 63 同族不同值，因为本页顶栏更矮）'],
    /* wishlist：整组换行那一页（唯一付垂直空间的白名单页） */
    ['wishlist.html', '<div class="trow-acts">', 1, '四枚动作钮整组进容器：窄屏由 .t-row 的 wrap 把**整组**换到第二行，barH 63→107（K08 白名单只放行本页）'],
    ['wishlist.html', 'class="wl-remove" aria-label="移除"', 1, '破坏性操作在设计标准的豁免之外，且它不在顶栏里（K01 抓不到，必须 K25 单列）'],
    ['wishlist.html', '.wl-remove{border:0;border-radius:50%;background:transparent;color:var(--color-muted);font-size:var(--fs-5);cursor:pointer;flex:0 0 auto}', 1, '本页这一行只剩皮肤：没有 width/height（尺寸由 design.css 那一条并族点名）'],
    /* 内容区与另两处宿主 */
    ['story.html', '.story-bar select{flex:0 0 auto;max-width:140px;height:44px;border:1px solid var(--color-line);border-radius:999px;background:var(--color-surface);color:var(--color-ink);font-size:var(--fs-3);padding:0 12px}', 1, '批次 25-B 普查补出来的第四颗：select 从前不在触控口径的选择器里（34px 既不在高频档也不在 36 的点名豁免里）'],
    ['search.html', '.sbar .mic{flex:0 0 auto;border:0;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary-dark);font-size:var(--fs-6);cursor:pointer}', 1, '只剩皮肤：改前这一行写 width:40px;height:40px，与 design.css 的 !important 同特异度、后加载者赢'],
    ['checklist.html', '.ck-remove{border:0;border-radius:50%;background:transparent;color:var(--color-muted);cursor:pointer;flex:0 0 auto;padding:0;display:grid;place-items:center}', 1, '行前清单条目「移除」钮只剩皮肤（改前 40×40）'],
    ['checklist.html', '.tb-open{flex:0 0 auto;border-radius:10px;overflow:hidden;border:1px solid var(--color-line);background:var(--color-bg-soft);display:grid;place-items:center;cursor:pointer;padding:0;color:var(--color-muted);font-size:var(--fs-1);text-decoration:none}', 1, '票据「打开附件」的缩略图框同一档（它是框不是圆钮，但破坏性/主操作口径不分形状）'],
    ['album-edit.html', '.ech-del{display:grid;place-items:center;border-radius:12px;background:var(--color-bg-soft);color:var(--color-muted);font-size:var(--fs-6);cursor:pointer;flex:0 0 auto}', 1, '相册章节删除钮只剩皮肤（实测代价：行高 42→44、页高不变、两档零溢出）'],
    ['expense.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">', 1, '内联 style 那一族换成类：四页各抄一遍 style="flex:0 0 auto;width:40px;height:40px…" 是本批第二个根因'],
    ['trip.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">', 1, '同上第二页'],
    ['checklist.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">', 1, '同上第三页'],
    ['planner.html', '<a class="t-ic" href="wishlist.html" aria-label="想去清单">', 1, '同上第四页（href 不同，所以四页不可能是一份复制粘贴的公共模板，只能靠类名单对账）'],
    /* 浏览器腿在场 */
    ['tools/smoke-topbar.js', "ok('K01 ", 1, '顶栏内可点控件零矮于 44：这条的选择器含 select/input/button/a 四类（只写 button,a 就漏掉 story 那颗 34px 下拉）'],
    ['tools/smoke-topbar.js', "ok('K11 ", 1, '.is-btn 计算样式 white-space:nowrap（断字那条腿）'],
    ['tools/smoke-topbar.js', "ok('K15 ", 1, '带图标钮逐 childNode 同排（量 rect.top 而不是 Range 数行——inline svg 会被数行读成假阳性）'],
    ['tools/smoke-topbar.js', "ok('K18 ", 1, '328 档 travel-map 退成 44×44 圆钮'],
    ['tools/smoke-topbar.js', "ok('K22 ", 1, '控件组 top ≥ 顶栏下缘（--tb-h 那条的浏览器腿）'],
    ['tools/smoke-topbar.js', "ok('K23 ", 1, '.ctl 缩放钮恰 36×36：尺寸漂回 40 也要红（点名允许的豁免要有闸门，否则豁免就是无人看管的低值）'],
    ['tools/smoke-topbar.js', "ok('K27 ", 1, 'story 换故事下拉 44 高'],
    ['tools/smoke-topbar.js', "ok('K31 ", 1, '地图浮控件在玻璃柱里左右留白相等（margin:0 auto 的浏览器腿）'],
    ['tools/smoke-topbar.js', "ok('K32 ", 1, '内容区三枚 computed 44×44（不在顶栏，K01 抓不到）'],
    ['tools/smoke-topbar.js', "ok('K33 ", 1, '专题页顶栏一行 + 两颗动作钮退成 44 圆钮：topic.html 不在 BAR_PAGES 那 13 页里，K08 的 barH 检对它失明，这条是它唯一的闸门腿'],
    ['map.css', '.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}', 1, '专题页那两枚动作钮的 ≤360 退档（批次 25-B：标题下限收到 7em 后「游记」被顶到第二行，顶栏 137→189，地图少 52 CSS px）'],
    ['topic.html', '<span class="act-label">随手记</span>', 1, '退档要收字就得有可收的标签：专题页这两枚从前是裸文本，收不掉（travel-map 那两枚早有 .act-label，同族却两种形状）'],
    ['topic.html', 'aria-label="游记"', 1, '收掉文字不等于收掉可访问名（§36 口径）'],
    ['tools/smoke-topbar.js', '{ width: 328, height: 723 }', 1, '真机主档（一加 Ace 6T 实测 CSS 视口）：不带它，「真机档已验证」验的是一台不存在的手机'],
    ['tools/smoke-topbar.js', '{ width: 320, height: 640 }', 1, '装箱最紧档：只跑 328 就漏掉「再窄一档整组装箱怎么排」'],
    ['tools/smoke-topbar.js', 'isMobile: true, hasTouch: true', 1, '触控视口（不带动点仿真，:active 一族与 44 档的口径就不成立）'],
    ['tools/smoke-topbar.js', "const WRAPPED_OK = ['wishlist.html'];", 1, '付垂直空间的页白名单只有一页：某页退档失效被挤成两行，K08 会红；白名单被人加长也要红'],
  ];
  A39.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number') {
      F39('A39 有锚点不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90));
      return;
    }
    const [file, needle, want, why] = a;
    if (!(file in V39)) { F39('A39 登记了 §39 没读的文件「' + file + '」，这条锚一次都没跑过：' + why); return; }
    const got = cnt39(V39[file], needle);
    if (got !== want) F39(file + ' 里「' + needle.slice(0, 60) + '」命中 ' + got + ' 次（要 ' + want + '）：' + why);
  });
  if (A39.length < 58) F39('锚点表被削减：' + A39.length + ' 条（批次 25-B 落地时实测 60 条，阈值取 58——整组删掉就等于这节没了）');

  /* ② 各页只留皮肤：这一族规则体内**不许出现任何尺寸声明**（含 min-*）。
     这里钉的是出处唯一，不是值：写 44 也一样红——尺寸有第二处写点，就说明下一次漂移不需要任何人同意。 */
  const SKIN39 = [
    ['map.css', '.t-row .back{', 4, 'map.css 有主题覆写，四处都是皮肤'],
    ['map.css', '.t-row .title{', 4, '标题的字号/字体族覆写不许带 min-width 或 flex（改前正是这里一处 min-width:0 把标题压成 2px）'],
    ['map.css', '.ctl button{', 3, '玻璃柱里的钮：改前 94 行写 40×40，design.css 点名 36 之后没人对齐，图标贴左'],
    ['travel-map.html', '.ctl button{', 2, '本页两处（基样式 + 暗色）同样只留皮肤'],
    ['node-manager.html', '.nm-topbar .back{', 1, '尺寸由 design.css 那条 !important 持有'],
    ['node-manager.html', '#infoSheet .is-btn{', 1, 'min-height 已归 design.css；这一族曾经在此处写 44（值对、出处错）'],
    ['wishlist.html', '.wl-remove{', 2, '改前 40×40；本页两处含暗色覆写'],
    ['checklist.html', '.ck-remove{', 1, '改前 40×40'],
    ['checklist.html', '.tb-open{', 1, '改前 40×40（缩略图框，flex:0 0 auto 是布局不是尺寸，允许保留）'],
    ['album-edit.html', '.ech-del{', 1, '改前 40×40'],
    ['story.html', '.story-bar .back{', 1, '尺寸只走 design.css 那条 .story-bar .back,.nm-topbar .back'],
    ['search.html', '.sbar .mic{', 2, '改前 44（与 design.css 同值但两处各写，仍是根因形状）＋暗色覆写一处'],
  ];
  SKIN39.forEach(([f, sel, want, why]) => {
    if (!(f in V39)) { F39('SKIN39 登记了 §39 没读的文件「' + f + '」：' + why); return; }
    const bs = bodies39(V39[f], sel);
    if (bs.length !== want) F39(f + ' 里选择器「' + sel + '」抽到 ' + bs.length + ' 条规则体（要 ' + want + '）：分母失守——要么被改名要么被拆成更多处，下面那条「零尺寸」判据已经看不见全部了（' + why + '）');
    bs.forEach(b => { if (GEO39.test(b)) F39(f + ' 的「' + b.slice(0, 58) + '」里出现尺寸声明：' + why); });
  });
  /* 反向对照：合成的「页内又写回 40」必须被抽取抓到；正向对照：正确皮肤形状不许误伤 */
  {
    const BADSKIN = flat39('.wl-remove{border:0;border-radius:50%;width:40px;height:40px;cursor:pointer}');
    if (bodies39(BADSKIN, '.wl-remove{').filter(b => GEO39.test(b)).length !== 1)
      F39('规则体零尺寸判据的反向对照失效（合成的「页内又写回 40×40」源码没被抓到，上面那些绿不是证据）');
    const GOODSKIN = flat39('.wl-remove{border:0;border-radius:50%;color:var(--color-muted);cursor:pointer;flex:0 0 auto}');
    if (bodies39(GOODSKIN, '.wl-remove{').filter(b => GEO39.test(b)).length !== 0)
      F39('规则体零尺寸判据的正向对照失效：连 flex/圆角这种皮肤都被打红，这条锚会不分对错一直红');
  }

  /* ③ design.css 触控族段区段检：这一段里 40 一族必须清零、36 只许点名那两条款 */
  {
    const S = V39['design.css'];
    const i1 = S.indexOf('.story-bar .back,.nm-topbar .back{'), i2 = S.indexOf('.tripbar .mv,.tripbar .x{');
    if (i1 < 0 || i2 < 0 || i2 <= i1) F39('抽不出 design.css 的触控族段（两端锚点之一没了或被改名，本节的区段判据失去依据）');
    else {
      const seg = S.slice(i1, i2);
      if (cnt39(seg, '40px') !== 0) F39('design.css 触控族段里还有 ' + cnt39(seg, '40px') + ' 处 40px：口径只有 44（高频/破坏性）与 36（点名豁免）两档，40 是改前那一族的值，留在段里就是给下一次漂移留门（K01/K02 会在浏览器侧同时红）');
      if (cnt39(seg, '36px') !== 5) F39('design.css 触控族段里的 36px 不是恰 5 处（实测＝.ctl button 两处 + Leaflet 缩放三处）：豁免族只许「地图上浮控件」那两条款，多一处就是有人给别的控件开了低值后门，而闸门只认这两条');
      if (cnt39(seg, '44px') < 10) F39('design.css 触控族段里的 44px 掉到 ' + cnt39(seg, '44px') + ' 处（改前实测 12）：段还在但内容被掏空，上面那两个 0 就成了恒真判据');
      const BADSEG = flat39('.story-bar .back,.nm-topbar .back{width:44px!important} .ctl button{width:40px;height:40px;margin:0 auto} .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important} .tripbar .mv,.tripbar .x{min-width:44px}');
      if (cnt39(BADSEG, '40px') < 1 || cnt39(BADSEG, '36px') !== 3) F39('触控族段区段检的反向对照失效（合成的「40 回潮 + 豁免族多开一条」源码没被同一段读数抓到）');
      const GOODSEG = flat39('.story-bar .back,.nm-topbar .back{width:44px!important;height:44px!important} .wl-remove,.ck-remove,.ech-del,.tb-open{width:44px!important;height:44px!important} .ctl button{width:36px!important;height:36px!important;margin:0 auto} .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important} .tripbar .mv,.tripbar .x{min-width:44px;min-height:44px}');
      if (cnt39(GOODSEG, '40px') !== 0) F39('触控族段区段检的正向对照失效：合成正确源也被打红');
    }
  }

  /* ④ 全站 html 扫描：内联 style 那一族（改前四页各抄一遍 40×40）不许回潮，类名族数量对账 */
  {
    const htmls39 = fs.readdirSync('.').filter(x => /\.html$/.test(x));
    if (htmls39.length < 18) F39('全站 html 只扫到 ' + htmls39.length + ' 份：分母可疑（本批实测 21 份；扫描口径漂了就等于没扫）');
    let tic = 0, inline40 = 0;
    const hits = [];
    htmls39.forEach(x => {
      const v = view39(x);
      const n = cnt39(v, 'class="t-ic"');
      if (n) hits.push(x + '=' + n);
      tic += n;
      inline40 += cnt39(v, 'style="flex:0 0 auto;width:40px;height:40px');
    });
    if (tic !== 4) F39('全站 .t-ic 不是恰 4 枚（实测：' + hits.join(' ') + '）——这一族只该有 expense/trip/checklist/planner 四页的右上角动作钮，多一枚说明某页又私写了一份顶栏钮');
    if (inline40 !== 0) F39('全站 html 里出现 ' + inline40 + ' 处内联 40×40 圆钮 style：那正是「谁后加载谁说了算」的第三种写法（比页内 <style> 更靠后，CSS 全管不住它）');
    const CTRL40 = ws39('<a class="t-ic" style="flex:0 0 auto;width:40px;height:40px;border:0"></a>');
    if (cnt39(CTRL40, 'style="flex:0 0 auto;width:40px;height:40px') < 1) F39('内联 40×40 那条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  }

  /* ⑤ 期望 0：改前形态与已推翻的写法不许回潮。ctrl 一律写成**改前的那段源码形状**。
     .html 视图不剥注释，所以这些 needle 都避开了注释里会出现的字面量（travel-map 的注释里有
     「top:56px」但没有「top:56px;width:」；wishlist 的注释已改写掉 `.t-row .title{`）。 */
  const ZERO39 = [
    ['map.css', '.t-row{height:42px',
      '.t-row{height:42px;align-items:center;display:flex}',
      '行高钉死 42px 会把换行的第二行直接裁掉（界面看不出问题、点也点不到）：盒高必须由内容撑开'],
    ['map.css', '.ctl button{width:',
      '.ctl button{width:40px;height:40px;border:0;background:none}',
      '玻璃柱里的钮尺寸：design.css 已点名 36，这里再写一遍就是「谁后加载谁说了算」的老形状'],
    ['travel-map.html', 'top:56px;width:',
      '.ctl{ position:absolute;right:12px;top:56px;width:44px;',
      '写死 56px 的顶栏高度：顶栏钮抬到 44 之后 56 会压在钮上（现在读 --tb-h=63）'],
    ['travel-map.html', '.ctl button{ width:44px',
      '.ctl button{ width:44px;height:44px;border:0;background:none;',
      '本页的缩放钮从前 44：浮在地图上的低频控件按口径归 36，且尺寸不在页内持有'],
    ['node-manager.html', '.leaflet-control-zoom a{width:',
      '.leaflet-control-zoom a{width:40px;height:40px;line-height:40px}',
      '页内联的 40px 靠后加载盖掉 design.css 的 36：同一族在两处长成两种尺寸'],
    ['node-manager.html', '#infoSheet .is-btn{flex:1;min-height:',
      '#infoSheet .is-btn{flex:1;min-height:44px;white-space:nowrap}',
      '值对、出处错：min-height 有第二处写点，下一次漂到 40 不需要任何人同意'],
    ['node-manager.html', '.is-btn{min-height:40px',
      '.is-btn{min-height:40px;border-radius:999px}',
      'design.css 自己那一条也不能退到 40（弹层主操作＝口径里的高频）'],
    ['wishlist.html', '.t-row .title{',
      '.t-row .title{min-width:0}',
      '标题下限的写点只许 design.css 一处：本页这一句在 328 档把四个字的页名压成 clientW 2px'],
    ['wishlist.html', '.wl-remove{width:',
      '.wl-remove{width:40px;height:40px;border:0;border-radius:50%}',
      '「移除」钮的尺寸归 design.css 的并族那条'],
    ['story.html', 'height:34px',
      '.story-bar select{flex:0 0 auto;height:34px;border-radius:999px}',
      'select 不在口径的选择器族里就会被整体漏过（批次 25-B 把 select/input 加进普查才捞出它）'],
    ['search.html', '.sbar .mic{flex:0 0 auto;width:',
      '.sbar .mic{flex:0 0 auto;width:44px;height:44px;border:0;border-radius:50%;}',
      '连「同值双写」都算回潮：两处各写一遍正是这批的根因，值一致只是暂时没漂'],
    ['checklist.html', '.ck-remove{width:',
      '.ck-remove{width:40px;height:40px;border:0;border-radius:50%}',
      '同上'],
    ['album-edit.html', '.ech-del{width:',
      '.ech-del{width:40px;height:40px;border-radius:12px}',
      '同上'],
    ['design.css', '.nm-item-btn{min-height:36px',
      '.nm-item-btn{min-height:36px;padding:0 12px;border-radius:999px}',
      '同一文件内两条同族自相矛盾（36 在前、44 在后，靠顺序取胜）——这就是本批根因在 design.css 里的那一份'],
  ];
  ZERO39.forEach(a => {
    if (a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string') {
      F39('ZERO39 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V39)) { F39('ZERO39 登记了 §39 没读的文件「' + f + '」：' + why); return; }
    if (cnt39(V39[f], needle) !== 0) F39(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt39(flat39(ctrl), needle) < 1 && cnt39(ws39(ctrl), needle) < 1) F39('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ⑥ 浏览器腿齐备检：K00–K33 一条不许少，条数守卫（少一条就是有个症状没人管） */
  {
    const src39 = V39['tools/smoke-topbar.js'];
    for (let i = 0; i <= 33; i++) {
      const id = 'K' + (i < 10 ? '0' + i : '' + i);
      if (src39.indexOf("ok('" + id + ' ') < 0) F39('tools/smoke-topbar.js 缺 ' + id + ' 这条判据（顶栏一族／.is-btn 断字／标题省略号／退档与 36 豁免是 K00–K33 一整组）');
    }
    const nK39 = cnt39(src39, "ok('K");
    if (nK39 !== 34) F39('tools/smoke-topbar.js 的判据条数不是 34：' + nK39 + ' 条（25-B 落地时实测 K00–K33 共 34 条；整组削减等于把这节拆了）');
    if (cnt39(src39, 'const BAR_PAGES') !== 1) F39('抽不出 smoke-topbar.js 的 BAR_PAGES 名单：K00 的分母自检没有宿主');
    /* 与 §38 的互斥对账：本批改过 design.css 的触控族，别和 24 那批的字号族判据互相打红 */
    const SELF39 = flat39(rd39(__filename));
    if (SELF39.indexOf('const FILES38 = [') < 0) F39('抽不出 §38 的 FILES38 名单：本节改的是 design.css 与 13 页顶栏，§38 也钉了 design.css 的字号档，两节不许对同一条规则各说一套');
    else {
      const m38 = SELF39.match(/const FILES38 = \[[\s\S]*?\]/);
      if (m38 && /\.html'/.test(m38[0]) === false) F39('§38 的 FILES38 里没有 html 页：那节的产品文件名单被削减，本节的互斥对账失去依据');
    }
  }

  if (V39['README.md'].indexOf('§39') < 0) F39('README.md 的 verify 清单没提 §39（新闸门不写进 README 就等于没装）');

  console.log('顶栏一族与触控口径闸门: ' + A39.length + ' 条代码锚点（design.css 18＝顶栏一族 8（.t-row wrap／back+t-ic 同条／.t-ic 右贴与 .ti 归零／:active／.title flex:1 1 7em+min-width:7em+省略号／.trow-acts／.topbar 分母）+ 触控族 10（两个非 .topbar 宿主／act 地板／mic／wl-btn／移除·删除·打开四族并一条／nm-item-btn／is-btn／36 两条款含 margin:0 auto／行程条）；travel-map 10＝--tb-h 挂 body 的 63 推导／top:var(--tb-h) 两处／盒宽与 .laymenu 的 right 成对／≤360 阈值／退成 44 圆钮／收 .act-label／.trow-acts／两枚 aria-label；node-manager 7＝.is-acts wrap／.is-btn 只剩皮肤（无 min-height）／.ic 两处／is-btn ic 恰 5／infoSheet 分母／缩放让位 66；wishlist 3＝trow-acts／aria-label 移除／.wl-remove 皮肤；story＋search 各 1；checklist 3＋album-edit 1＝内容区那三枚；四页 .t-ic 各 1；map.css 1＝专题页那两枚动作钮的 ≤360 退档；topic.html 2＝.act-label 与 aria-label（退档要收字先得有可收的标签）；smoke-topbar 14＝九条判据在场 + K33 专题页那一行 + 两档取样 + 触控视口 + 白名单）+ 十二族规则体零尺寸抽取（每族先按分母数规则条数，再逐体断无 width:/height:——钉的是出处唯一不是值，页内写 44 也红；配反向「写回 40 要抓到」与正向「皮肤不误伤」）+ design.css 触控族段区段检（40px 期望 0／36px 恰 5＝豁免族只那两条款／44px ≥10 防空段，配改前合成段反向对照）+ 全站 html 扫描（.t-ic 恰 4 且逐页点名、内联 40×40 圆钮期望 0，分母 <18 份即红）+ 十四族期望 0（钉死行高 42／两处 .ctl button 尺寸／写死 56px／页内联 Leaflet 40／is-btn 的 min-height 双写／标题 min-width:0／三枚内容区 40／select 34／同值双写的 mic 44／design.css 自相矛盾的 36）每条配「改前那段源码形状」的正向对照；浏览器腿 K00–K33 齐备检 + 条数守卫 34；口径表预跑见 tools/out/pre39-counts.js，变异自测见 tools/out/mut-verify39.js');
  fail += bad39;
}


/* ============ §40 链跑可信度闸门（批次 25-C） ============
   这一节不管产品，只管「闸门自己会不会说谎」。本批实测到两种说谎方式：
   ① 等错时机。smoke-motion 原先 7 处导航全写 waitUntil:'load' + 30s；load 要等齐页面所有
      图/字体/瓦片，链跑（多条重闸门串一条 for 链、机器上同时几份 Chrome 抢 IO）时往往是 30s
      先到，goto 抛错被记成断言 FAIL——同一份代码一次绿一次红，症状长得像产品坏了，其实是取样
      时机不可靠。改后一律 domcontentloaded + 60s，再等「这一节真正要读的东西已经就位」
      （READY 三个谓词），就绪超时只打一行「按现状继续读」，不改成红。
      实测：改前链跑 exit 2（单跑绿）；改后链跑 EXIT_motion=0、单跑 35 项失败 0
      （tools/out/b25c-smoke-battery.txt／b25c-smoke-motion-alone.txt）。
   ② 放行表没人守。trip.html?trip=free 那句载入即转送会打断「进入本页」那次跨文档转场，
      浏览器自己抛 InvalidStateError（@view-transition{navigation:auto} 开着，而 ui.js 的
      UI.vt 三条 catch 只管我们自己起的转场，JS 里没有 promise 可以挂 catch）。
      探针 tools/out/probe25c-vt-free.js 的 A/B（同一 free 入口，B 腿把转送换成空块；各 15 轮）：
      空机 A 6/15、争用（6 个后台重页）A 4/15，B 腿两档都 0/15；两档除这一条外零其它真实报错，
      落点 30/30 都到 expense.html?trip=free ⇒ 争用既不是成因也没放大（就是约 1/3 的随机），
      且用户那一半是对的。放行它是对的；但「放行只认那一整串」必须写成源码事实，
      否则下一批有人把筛子扩成 /Error/，三条「零真实报错」判据同时变恒真——那才是本节要防的。
   配套：T09 从「URL 对」抬成「URL 对 + 那一页真画出来了」，替被摘掉的噪声信号还一个正身判据。
   条数守卫是 §31 那一课：阈值随锚点表长，抬阈值类变异必须取「当前长度 + 1」（M51 的教训）。
   ============================================================ */
{
  let bad40 = 0;
  const F40 = m => { bad40++; console.log('FAIL §40 链跑可信度闸门: ' + m); };
  const ws40 = s => s.replace(/\s+/g, ' ').trim();
  const flat40 = s => ws40(s.replace(/\/\*[\s\S]*?\*\//g, ''));
  const cnt40 = (s, n) => s.split(n).length - 1;
  const rd40 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view40 = f => /\.html$/.test(f) ? ws40(rd40(f)) : flat40(rd40(f));

  const FILES40 = ['tools/smoke-motion.js', 'tools/smoke-trip.js', 'trip.html', 'README.md'];
  const V40 = {};
  FILES40.forEach(f => {
    if (!fs.existsSync(f)) { F40('缺 ' + f); V40[f] = ''; return; }
    V40[f] = view40(f);
  });

  /* ① 导航只有一个出口，且那个出口等的是「就绪」不是「load」 */
  const A40 = [
    ['tools/smoke-motion.js', '.goto(', 1, '全站这个文件只剩一处 goto＝导航出口唯一（七处各写一遍＝七处会各自漂回 waitUntil:\'load\'）'],
    ['tools/smoke-motion.js', "waitUntil: 'domcontentloaded', timeout: 60000", 1, 'domcontentloaded + 60s：等齐资源那条腿就是链跑假红的成因'],
    ['tools/smoke-motion.js', "waitForFunction(ready, { timeout: 30000, polling: 150 })", 1, '就绪等待**必须传函数**：waitForFunction 收到多语句字符串会当场 eval 抛错、被 catch 吞掉，等待退化成 0ms（§34 踩过同一坑，那时读的是上一帧旧 DOM）'],
    ['tools/smoke-motion.js', 'const READY = {', 1, '三个就绪谓词集中在一个表里（「这一节真正要读的东西」写在一起才数得清）'],
    ['tools/smoke-motion.js', 'typeof UI !== \'undefined\'', 2, 'page/topic 两个谓词各自等 UI：UI 没到货就读动效类，量到的是空壳'],
    ['tools/smoke-motion.js', 'typeof window.plannerOpenTrip ===', 1, 'planner 那节等自己的入口函数在场，不是等通用 readyState'],
    ['tools/smoke-motion.js', 'typeof TravelNotes !==', 1, 'topic 那节等 TravelNotes（该节的读数全在它渲染完之后）'],
    ['tools/smoke-motion.js', 'await nav(', 7, '七处导航全走单点（改前这七处各写 waitUntil:\'load\' + 30s）'],
    ['tools/smoke-motion.js', '(就绪等待超时，按现状继续读', 1, '就绪超时打一行、不改判红：超时说明这一屏比预期慢，不等于判据失败——把它变红就是再造一个假红'],
    /* ② 放行表：窄到只认那一整串，且有正身判据替它守着「白屏」那半 */
    ['tools/smoke-trip.js', "const VT_ABORT = 'InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled';", 1, '放行的是**一整串**（等串匹配，不是正则前缀）：串里连后缀都在，改一个字这条就红'],
    ['tools/smoke-trip.js', 'const isReal = e => !NOISE.test(e) && e.indexOf(VT_ABORT) < 0;', 1, '报错筛子单点持有：瓦片噪声族 + 这一整串，两个来源写在一行，谁扩筛子都看得见'],
    ['tools/smoke-trip.js', '.filter(isReal)', 3, '三处判据（T36/T37/T53）共用同一把筛子；各写一份筛子＝改一处漏两处'],
    ["tools/smoke-trip.js", "isReal('pageerror: InvalidStateError: Transition was aborted because of invalid state. 换了个后缀') === true", 1, '正向对照：同一句换个后缀仍算真实报错。没有它，「只认那一整串」只是口头承诺'],
    ["tools/smoke-trip.js", "isReal('pageerror: TypeError: x is not a function') === true", 1, '正向对照：真报错仍算红（放行表不能把产品缺陷一起放掉）'],
    ['tools/smoke-trip.js', "document.getElementById('yearSum')", 1, 'T09 抬成「落点 + 那一页真画出来了」：摘掉一条噪声信号，就得给它在界面上的风险一个正身判据'],
    ['tools/smoke-trip.js', "ok('T09 ", 1, 'free 桶转送那条判据在场（两态枢纽那组的一条都不许悄悄消失）'],
    ['tools/smoke-trip.js', "ok('T55 ", 1, '筛子口径那条判据在场：它不测页面，测的是这把筛子本身'],
    ['README.md', '链跑红了先单跑复现', 1, '这条口径必须留在 README：链跑红≠产品回归，历史上被当成回归追过一整晚'],
  ];
  A40.forEach(a => {
    if (a.length !== 4) {
      F40('A40 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V40)) { F40('A40 登记了 §40 没读的文件「' + f + '」：' + why); return; }
    const n = cnt40(V40[f], needle);
    if (n !== exp) F40(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });
  /* 判据条数只设下界：这一套还会继续长，但一条都不许悄悄消失 */
  const nChk40 = cnt40(V40['tools/smoke-motion.js'], "check('");
  if (nChk40 < 35) F40('tools/smoke-motion.js 的判据条数掉到 ' + nChk40 + '（25-C 实测 35 条；减一条要说话，别让它静默消失）');

  /* ③ 期望 0：改前那两种形状不许回来，每条配正向对照 */
  const ZERO40 = [
    ['tools/smoke-motion.js', "waitUntil: 'load'", "await page.goto(url, { waitUntil: 'load', timeout: 30000 });", '又等齐资源才走＝链跑那份 30s 假红的成因回来了'],
    ['tools/smoke-trip.js', "filter(e => !NOISE.test(e))", "const realErrs = errs.filter(e => !NOISE.test(e));", '绕过 isReal 自搭一把筛子＝三处判据各漂各的，放行表扩没扩没人知道'],
    ['tools/smoke-trip.js', '/Error/', "const VT = /Error/;", '放行表被扩成整类正则：那三条「零真实报错」当场变恒真'],
  ];
  ZERO40.forEach(a => {
    if (a.length !== 4) {
      F40('ZERO40 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V40)) { F40('ZERO40 登记了 §40 没读的文件「' + f + '」：' + why); return; }
    if (cnt40(V40[f], needle) !== 0) F40(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt40(flat40(ctrl), needle) < 1) F40('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ④ 放行表的前提对账：它钉的是「trip.html 载入即转送」这件事。
        哪天转送没了（改成页内两态、或入口不再产 free 链接），这条噪声就结构性不存在，
        放行表必须一起摘——留着就是拿一个不会再发生的症状当永久豁免。 */
  if (cnt40(V40['trip.html'], "location.replace('expense.html?trip='") === 0
    && V40['tools/smoke-trip.js'].indexOf('VT_ABORT') >= 0)
    F40('trip.html 里那句 free 桶转送已经不在了，但 smoke-trip 还留着 VT_ABORT 放行串：转送没了这条噪声就不会再发生，放行表要一起摘掉（别把已定性的历史噪声当永久豁免）');

  if (V40['README.md'].indexOf('§40') < 0) F40('README.md 的 verify 清单没提 §40（新闸门不写进 README 就等于没装）');

  console.log('链跑可信度闸门: ' + A40.length + ' 条代码锚点（smoke-motion 9＝导航出口唯一 .goto 恰 1／domcontentloaded+60s／就绪谓词必须传函数／READY 表 + 三个谓词各自等的那一样东西／nav 单点 7 处调用／就绪超时只打一行不改红；smoke-trip 8＝放行整串字面量／isReal 单点／三处共用／两路正向对照（近亲串与真 TypeError 都还算红）／T09 画布判据在场／T55 在场；README 1＝链跑红了先单跑复现）+ smoke-motion 判据条数下界 35 + 三族期望 0（waitUntil:\'load\'／自搭筛子／把放行扩成 /Error/）各配正向对照 + 放行表前提对账（trip.html 那句转送没了就必须一起摘放行）；A40 表长 ' + A40.length + ' 条，抬阈值类变异要取当前长度 + 1；变异自测见 tools/out/mut-verify40.js');
  fail += bad40;
}



/* ============ 共享：剥块注释，但**认得字符串**（批次 27 现场发现，§41／§42 共用） ============
   这两节原来是 s.replace(/\/\*[\s\S]*?\*\//g, '')。travel-notes.js 的面板模板里有一行
   `<input type="file" id="tnFile" accept="image/*" multiple style="display:none">`，那个「斜杠星」
   在字符串字面量里、根本不是注释开头，naive 正则却当它是开头，一路吃到下一个「星斜杠」才停——
   实测吃掉 655→704 共 50 行真源码（含整个面板骨架那段），同一文件里还有一处 1843→1891（编辑卡）。
   后果不是「少读一段文本」而是**盲窗**：住在那一段里的正向锚永远读 0（早就该红而没人看见），
   而**期望 0 的那一族在那一段里永远满足**——变异网把批次 27 删掉的 tn-confirm 插回那一带
   （M21），闸门一个字没喊，就是这么露出来的。所以剥注释必须先跳过字符串再判注释开头。
   只处理块注释，不碰行注释：认行注释要顺手把正则字面量里的转义斜杠也分清楚，收益不抵风险。
   反过来也不许让「认字符串」这件事造出第二个盲窗：单/双引号里遇到没被反斜杠转义的换行就当它
   没闭合、立刻退出字符串态（JS 里那本来就是语法错，而 travel-notes.js 的续行写的是「反斜杠+换行」，
   那一对是被当成转义整体吃掉的，不受这条影响）。不这么收一手的话，正文字符串外随便一枚游离
   撇号都会一路吃到文件末尾——那比原 bug 更瞎。 */
function stripBlockComments(s) {
  var out = '', i = 0, n = s.length;
  while (i < n) {
    var ch = s.charAt(i);
    if (ch === '/' && s.charAt(i + 1) === '*') {
      i += 2;
      while (i < n && !(s.charAt(i) === '*' && s.charAt(i + 1) === '/')) i++;
      i += 2; out += ' ';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      var q = ch;
      out += ch; i++;
      while (i < n) {
        var c = s.charAt(i);
        if (c === '\\') { out += c + (s.charAt(i + 1) || ''); i += 2; continue; }
        if (c === q) { out += c; i++; break; }
        if (c === '\n' && q !== '`') { break; }
        out += c; i++;
      }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

/* ============ §41 游记按日期分组闸门（批次 26） ============
   用户报的是「我的游记—日期 tab 没有内容显示，只有 1234567……」。定性腿 tools/out/probe26-cal2.js
   （七条腿各注一份真 IndexedDB，逐形状读数）给的是三条成因，全都跟「渲染」无关：
   ① calState.ym 硬默认当前月。笔记都在往月时，那一栏画出来就是 1..31 一串裸日号，
      #calDay 是一块纯空白——既不说「这个月没有」，也没有一条去别处的路。症状与截图完全对上。
   ② 「格子亮不亮」用正则补零后的键，「点开有没有内容」却用原始 date 字符串 indexOf：两套口径。
      于是 2026-10-8（未补零）会「亮着却打不开」，2026.10.08 / 2026年10月8日 干脆不亮。
   ③ n.date.slice(...) 在 5 处裸用（统计/日档/年档/月档/TNStats）。date 字段整个缺失时
      openList 抛 Cannot read properties of undefined (reading 'slice')，列表一栏都出不来。
   修法是一个归一单点 TravelNotes.noteDay(n)（day → date 里任意非数字分隔符的年月日 → ts 反推，
   一律出补零键）＋日历默认落在「最近有记录的那个月」＋空月给「最近有记录的一天是 X｜跳过去」。
   所以这一节钉的是**形状纪律**：坏形状与好形状必须得到同一个读数，且不许有人再拼第二份解析。
   浏览器腿 tools/smoke-cal.js 33 项（六条畸形形状 ×2 + 落月/空白说明/空月出口 + 时间线与统计同键
   + 回顾页与首页同口径 + 分组顺序两条 + 全程零未捕获报错；实测读数见 tools/out/b26-smoke-cal.txt）。
   ============================================================ */
{
  let bad41 = 0;
  const F41 = m => { bad41++; console.log('FAIL §41 游记按日期分组闸门: ' + m); };
  const ws41 = s => s.replace(/\s+/g, ' ').trim();
  const flat41 = s => ws41(stripBlockComments(s));
  const cnt41 = (s, n) => s.split(n).length - 1;
  const rd41 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  /* html 与 md 只归一空白、不剥注释：markdown 没有块注释，而 README 的登记串里天生要写
     glob（`shots/` 斜杠星 `.png` 这种），走剥注释那一支就等于给文档开盲窗（批次 27 现场踩过
     一次：把那串属性值原样抄进 §42 的登记文字，§40 的一条 README 锚被吃成 0）。 */
  const view41 = f => /\.html$|\.md$/.test(f) ? ws41(rd41(f)) : flat41(rd41(f));

  const FILES41 = ['travel-notes.js', 'review.html', 'index.html', 'travel-map.html', 'map.css', 'design.css', 'tools/smoke-cal.js', 'README.md'];
  const V41 = {};
  FILES41.forEach(f => {
    if (!fs.existsSync(f)) { F41('缺 ' + f); V41[f] = ''; return; }
    V41[f] = view41(f);
  });

  /* ① 归一单点在场，且所有按日期分组的读取点都只走它 */
  const A41 = [
    ['travel-notes.js', 'function noteDay(n) {', 1, '全库唯一的日期归一出口（两处各拼一份解析＝两套口径再次分家，就是本批的成因②）'],
    ['travel-notes.js', 's.match(/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/)', 1, '认**任意非数字分隔符**（- 与 . 与 年月日）且允许未补零：只认连字符就是点号/中文日期不亮的那一半成因'],
    ['travel-notes.js', "return (typeof ts === 'number' && isFinite(ts)) ? fmtDay(ts) : '';", 1, 'date 坏/缺时由 ts 反推，最后出空串而不是抛错（成因③：undefined.slice 把整栏带走）'],
    ['travel-notes.js', 'var dd = noteDay(n); if (dd) days[dd] = 1;', 1, '顶栏「天数」走归一键：这里曾是 n.date.slice(0,10)，date 缺失时 openList 直接抛'],
    ['travel-notes.js', 'var dd = noteDay(n); if (dd) { days[dd] = 1; months[dd.slice(0, 7)]', 1, '统计面板的天数与月份分布同一个键（两处各读各的 date 会出现天数与月分布对不上）'],
    ['travel-notes.js', 'var d = noteDay(n) || UNDATED;', 1, '旅程展开/月内日档共用的分组键（这一档同时是日历点开后那个标题的来源）'],
    ['travel-notes.js', 'var y = noteYear(n);', 1, '时间线年档走 noteYear（noteYear 内部就是 noteDay，键形状只有一处定义）'],
    ['travel-notes.js', 'var m = noteMonth(n);', 1, '时间线月档同上：坏形状时这里曾直接照抄出「2026.10」这种档'],
    ['travel-notes.js', 'function sortDays(ks) {', 1, '倒序 + 兜底档压到最后的单点（三处分组各写 .sort().reverse()＝「未填日期」会排到最新那一头，用户以为那是最近一趟）'],
    ['travel-notes.js', 'sortDays(Object.keys', 3, '三处分组（日档/年档/月档）全走同一个倒序单点：这一处退回 .sort().reverse()，锚点还在、调用者已经少了一个，兜底档就在一处排到了最前'],
    ['travel-notes.js', 'if (a === UNDATED) return 1;', 1, '「未填日期」压在最后的那一手：摘掉它 sortDays 还是那个名字、还是那个函数，界面会把「未填日期」当成最近一趟摆在第一个'],
    ['travel-notes.js', 'if (!calState.ym) calState.ym = newest ?', 1, '首次进日历落「最近有记录的那个月」：成因①的修复点，落回当前月就是那串裸日号回来'],
    ['travel-notes.js', 'return noteDay(x) === k;', 1, '点开过滤与格子高亮共用同一个键（改回 indexOf 原文＝亮着却打不开）'],
    ['travel-notes.js', '这个月还没有游记', 1, '空月要说话：#calDay 从前是纯空白，用户只能读出「坏了」'],
    ['travel-notes.js', 'calGoto', 2, '空月出口两处（写出这颗钮 + 绑上事件）：只有 HTML 一次＝点了没反应'],
    ['travel-notes.js', '点上面带色的日期看当天', 1, '有记录的月也要给一句读法（否则 31 个格子里那两个带色的是什么，没人知道）'],
    ['travel-notes.js', 'noteDay: noteDay,', 1, '对外出口：外部页面（回顾/首页/足迹）必须复用这一份，不许自己再解析'],
    ['review.html', 'function dayOf(n){return TravelNotes.noteDay(n);}', 1, '回顾页那第二份解析（不认点号/中文、也没有 ts 兜底）已并到单点'],
    ['index.html', 'TravelNotes.noteDay(n)', 1, '首页「历 N 日」按归一键数天'],
    ['index.html', 'TravelNotes.noteDay(last)', 1, '首页那行起始日走同一个键（原来照抄 last.date 会把 2026年10月8日 直接印到界面上）'],
    ['travel-map.html', 'TravelNotes.noteDay(n)', 1, '足迹画布上的天数同一个键（这里也是裸 slice 的崩点之一）'],
    ['design.css', '.tn-cal-day-tip{', 1, '提示行有自己的类（不靠 inline style 魔法数，暗色与字号阶梯才跟得上），而且必须住在所有宿主页都加载的那张表里'],
    ['map.css', '.tn-cal-day-tip{', 0, '正向对照就是上一条：这一族 2026-10-07 前写在 map.css，而 map.css 只被 node-manager/topic/wishlist 三页加载，手机上（index/travel-map）读到的是空类；留在两处＝同族两份、谁后加载谁赢'],
    ['tools/smoke-cal.js', 'const SHAPES = [', 1, '六条畸形形状是一张表（写成一串 if 就没人数得清漏了哪条）'],
    ['tools/smoke-cal.js', "VW = 328, VH = 723", 1, '真机档取自批次 23-D 的改判口径，不是 452 那一档'],
    ['tools/smoke-cal.js', "ok('C", 21, '字面判据条数（六形状那两条在 for 里由 name 拼出，不占字面计数；少一条字面判据要说话）'],
  ];
  A41.forEach(a => {
    if (a.length !== 4) {
      F41('A41 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V41)) { F41('A41 登记了 §41 没读的文件「' + f + '」：' + why); return; }
    const n = cnt41(V41[f], needle);
    if (n !== exp) F41(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* 六条形状各自必须在 smoke-cal 里出现（摘掉一条＝那个症状重新没人管，表还在但腿空了） */
  ['C01 对照', 'C02 未补零', 'C03 点号', 'C04 中文', 'C05 date 是空串', 'C06 date 字段整个不存在'].forEach(function (lab) {
    if (V41['tools/smoke-cal.js'].indexOf(lab) < 0)
      F41('tools/smoke-cal.js 缺「' + lab + '」这条形状（本批的立论是坏形状与好形状同读数，少一条就是少一个证据）');
  });

  /* 两条顺序判据逐条在场：sortDays 的锚只认「函数与调用点在」，倒序方向和兜底档落位是
     源码腿结构性看不见的那一类（变异自测 G02 就拿「比较器反向」证明这点），只有真渲染一次才知道。 */
  ['C26 时间线日档按新→旧排', 'C27 既没日期也没 ts 的那条压在最后'].forEach(function (lab) {
    if (V41['tools/smoke-cal.js'].indexOf(lab) < 0)
      F41('tools/smoke-cal.js 缺「' + lab + '」这条顺序判据（分组顺序没有别的腿守着，摘掉就再没人知道它翻了）');
  });

  /* ② 期望 0：改前三套写法不许回来，每条配正向对照 */
  const ZERO41 = [
    ['travel-notes.js', "String(x.date || '').indexOf(k)", "var dayList = list.filter(function (x) { return String(x.date || '').indexOf(k) >= 0; });", '点开又改用原始串子串匹配：格子亮的是一套键、点开是另一套，未补零日期永远「当天没有游记」'],
    ['travel-notes.js', 'n.date.slice(0, 10)', "days[n.date.slice(0, 10)] = 1;", '裸 slice 回来了：date 缺失即抛，整栏（含日历 tab）出不来'],
    ['travel-notes.js', 'n.date.slice(0, 4)', "var y = n.date.slice(0, 4);", '时间线年档又照抄原文：点号/中文日期会分出自己的档，跨年浏览全乱'],
    ['travel-notes.js', 'n.date.slice(0, 7)', "var m = n.date.slice(0, 7);", '同上，月档形状必须与日历键同形（否则月历与时间线对不上同一条笔记）'],
    ['travel-notes.js', 'if (!calState.ym) calState.ym = now.getFullYear() * 100 + (now.getMonth() + 1);', "if (!calState.ym) calState.ym = now.getFullYear() * 100 + (now.getMonth() + 1);", '默认又落回当前月：笔记都在往月时满屏只剩裸日号，而这块空白看起来就是「页面坏了」'],
    ['review.html', "(n.day||(n.date||'').slice(0,10)||'').slice(0,10)", "function dayOf(n){return (n.day||(n.date||'').slice(0,10)||'').slice(0,10);}", '第二份日期解析又立起来了：它不认点号/中文，也没有 ts 兜底，两页同一篇会一边亮一边不亮'],
    ['index.html', 'n.date.slice(0, 10)', "var days = new Set(all.map(function (n) { return n.date.slice(0, 10); }));", '首页自己数天：坏形状时「历 N 日」会按原始字符串数出重复天'],
    ['travel-map.html', 'n.date.slice(0,10)', "new Set(notes.map(n=>n.date.slice(0,10))).size", '足迹画布自己数天（这里同样是裸 slice，date 缺失整张导出图抛错）'],
  ];
  ZERO41.forEach(a => {
    if (a.length !== 4) {
      F41('ZERO41 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V41)) { F41('ZERO41 登记了 §41 没读的文件「' + f + '」：' + why); return; }
    if (cnt41(V41[f], needle) !== 0) F41(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt41(flat41(ctrl), needle) < 1) F41('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 跨文件前提对账：产品发的那个类名，得在「宿主页真加载的那张表」里存在。
     原来这条对的是 map.css——而 map.css 只被 3 页加载，于是「样式存在」为真、
     「那一屏读得到」为假，闸门绿着把批次 26 的修复盖住了一半。改指 design.css，
     全站加载表对账在 §42（每一个挂 travel-notes.js 的页面都必须引 design.css）。 */
  if (V41['travel-notes.js'].indexOf('tn-cal-day-tip') >= 0 && V41['design.css'].indexOf('.tn-cal-day-tip{') < 0)
    F41('travel-notes.js 发的是 tn-cal-day-tip，而 design.css 没有这条样式：提示行会退化成无排版的一坨（类名改一边不改另一边＝读了个空类）');
  /* ④ noteDay 的键形状本身要有对账：它必须与产品写盘用的 fmtDay 同形，否则 persist 的 by_day 索引与 UI 键两套口径 */
  if (V41['travel-notes.js'].indexOf("day: fmtDay(_now),") < 0)
    F41('travel-notes.js 里 saveNote 写盘的 `day: fmtDay(_now),` 不在了：by_day 索引的键形状与 noteDay 的口径必须由同一个 fmtDay 保证，两处分开写＝索引查得到、界面认不出');

  if (V41['README.md'].indexOf('§41') < 0) F41('README.md 的 verify 清单没提 §41（新闸门不写进 README 就等于没装）');

  console.log('游记按日期分组闸门: ' + A41.length + ' 条代码锚点（travel-notes 17＝归一单点/任意分隔符正则/ts 兜底/四处读取点同键/sortDays 单点 + 三处调用 + 兜底档压到最后/落最近有记录的月/点开与高亮同键/空月说明+跳过去两处/有记录月的读法/对外出口；review 1＝dayOf 并到单点；index 2；travel-map 1；design.css 1 与 map.css 0＝同一族只许住在所有宿主页都加载的那张表里；smoke-cal 3＝形状表/真机档/字面判据条数 21）+ 六条畸形形状逐条在场 + 两条顺序判据逐条在场（倒序与兜底档落位是源码腿看不见的那一类） + 八族期望 0（原始串 indexOf／三处裸 slice／默认落回当前月／review 第二份解析／index 与 travel-map 自数天）各配正向对照 + 两条跨文件对账（发的类名要在所有宿主页都加载的 design.css 里、写盘 day 与 noteDay 同出 fmtDay）；A41 表长 ' + A41.length + ' 条，抬阈值类变异要取当前长度 + 1；变异自测见 tools/out/mut-verify41.js');
  fail += bad41;
}



/* ============ §42 拼串闭合 · 样式表归属 · 面板出口唯一（批次 27） ============
   用户点名的两条：「点按导入、导出弹出的窗口关闭按钮没 x」「游记内容有照片的点击照片不能放大」。
   定性腿（tools/out/probe27-*.js，全只读）给出的是两个形状完全不同的成因，外加一条没人报的：
   ① 拼串漏收尾 >。JS 里那句是 `<button … aria-label="关闭"` 直接接 `'+TI('close',14)`：tag 没闭合
      就交给字符串拼接，HTML 解析器把紧随的整串 `<svg class="ti" …>` 当成 button 的属性吞掉，
      DOM 里只剩一枚裸 `<use>`（不 paint），`class="ti"` 反而泄漏到 BUTTON 上。看不见＝「没 x」。
      全库 92 个 `+TI()` 站点里扫出 4 处（导出/导入/选点/定制路书），顺带揪出没人点名的第五枚。
   ② 样式表归属错置。`.tn-viewer*` 与 `.tn-cal-*` 共 24 行住在 map.css，而 map.css 只被 15 个
      travel-notes.js 宿主页里的 3 页（node-manager / topic / wishlist）加载。手机上（index / travel-map）
      读到的是空类：.tn-viewer 退化成文档流里一个裸 DIV（实测 328×63、position:static、z-index:auto），
      点照片「没反应」；.tn-cal-d 是 <span>，没有 grid 就排成一行裸日号——那正是批次 26 截图里
      「只有 1234567」的另一半成因。@keyframes tnPickFade 由面板运行时注入，所以挪表不伤动画。
   ③ 日历点开的日卡自己拼过一版窄卡（tn-item tn-cal-item：只有标题+正文+编辑/删除），照片、标签、
      录音和另外四个出口全不在屏上——「日历里点照片放大」根本无从下手。
   ④ 这条是这一节自己身上的：§41／§42 原来用 naive 正则剥块注释，把面板字符串里的「image/星斜杠」
      当成注释开头，实测在 travel-notes.js 上开出两处盲窗（655→704 面板骨架、1843→1891 编辑卡）。
      盲窗里正向锚永远读 0、期望 0 那一族永远满足——变异网 M21 把批次 27 删掉的 tn-confirm 插回去、
      闸门一个字没喊，就是这么露出来的。所以剥注释先跳字符串再判注释开头（文件顶共享函数），
      下面 ⓪ 那一屏用四段合成串 + 两枚现场哨兵自证这把刀今天还锋利。
   ⑤ 同一族漏口的第二次现场发作，这次在文档侧：把一串属性值原样抄进 §42 的登记文字，README 里
      就多出一对字面「斜杠星」，而 view41／view42 当时对 .md 也走剥注释那一支——§40 的一条 README
      锚当场被吃成 0（红在别节头上，找过来要走一圈）。markdown 根本没有块注释，README 的登记串里
      天生要写 glob，所以文档那一支改成只归一空白；definition-line 形状的锚钉在 ⓪ 里，改回去就喊。
   所以这一节钉三件事：坏形状全库 0（扫描器内置，不依赖外部探针跑过）、面板发的每个 tn-* 类必须在
   「宿主页真加载的那张表」里（design.css ∪ 面板自注入表，且宿主名单是现场 readdirSync 枚举的）、
   放大出口只有一条（口径限定在面板内：travel-map.html:593 与 md-manager.html:311/727 各有一版可用的
   页内 zoomPhoto，用内联样式，只是不是同一张皮——登记在 README 的漏口清单里，本批不动）。
   批次 26 的方法学失手就记在这儿：跨文件对账当时只断「某张表里有这条样式」，选错了表，
   于是闸门绿着把修复盖住了一半。这一节的宿主页码数不许抄任何文档，一律现场数。
   浏览器腿 tools/smoke-viewer.js 36 项（真机档 328×723；查看器、日历、五枚弹层 X 全读计算样式与
   真 DOM 命中，不是「节点在不在」；实测读数见 tools/out/b27-smoke-viewer.txt）。
   ============================================================ */
{
  let bad42 = 0;
  const F42 = m => { bad42++; console.log('FAIL §42 拼串闭合与样式表归属闸门: ' + m); };
  const ws42 = s => s.replace(/\s+/g, ' ').trim();
  const flat42 = s => ws42(stripBlockComments(s));
  const cnt42 = (s, n) => s.split(n).length - 1;
  const rd42 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view42 = f => /\.html$|\.md$/.test(f) ? ws42(rd42(f)) : flat42(rd42(f));
  const Q42 = String.fromCharCode(39);

  const FILES42 = ['travel-notes.js', 'results.js', 'design.css', 'map.css', 'ui.js', 'tools/smoke-viewer.js', 'README.md'];
  const V42 = {};
  FILES42.forEach(f => {
    if (!fs.existsSync(f)) { F42('缺 ' + f); V42[f] = ''; return; }
    V42[f] = view42(f);
  });

  /* ⓪ 读源码这件事自己先自校准（批次 27 现场发现，见文件顶 stripBlockComments 的说明）：
        naive 剥块注释会在 travel-notes.js 上开出两处盲窗（实测 655→704、1843→1891，全是面板骨架
        与编辑卡两段真代码）。盲窗里正向锚永远读 0，而**期望 0 那一族永远满足**——M21 把批次 27
        删掉的 tn-confirm 插回去、闸门一个字没喊，就是这么露出来的。
        两半都要：合成串管「正则/扫描器退化」，现场哨兵管「今天这一段的落点还在不在」——
        只留合成那一半，扫描器一旦漂到别处，现场那段照样瞎而没人喊。 */
  {
    const cal42 = flat42('x = \'<input accept="image/*" multiple>\'; /* tn-hidden-marker */ y = 1;');
    if (cal42.indexOf('image/*') < 0) F42('剥注释自校准失效：字符串字面量里的「image/*」被当成注释开头吃了（盲窗就是这么开出来的，这一串必须原样留在 flat 里）');
    if (cal42.indexOf('multiple') < 0) F42('剥注释自校准失效：字符串被截断，后半截「multiple」没留下（同一族的锚点从此读不到，且不会喊）');
    if (cal42.indexOf('tn-hidden-marker') >= 0) F42('剥注释自校准失效：真块注释没被剥掉（A42/ZERO42 会把注释里写的「改前长什么样」当成代码在场）');
    /* 第四半：字符串态必须被裸换行收住。这一条不是防御性修辞——去掉那一手，上面三段合成串
          全都照样绿（它们的引号都闭合了），只有这一整段「引号没闭合」的形状能抓到它。 */
    const cal42b = flat42('z = \'q;\n/* tn-loose-quote */ k = 1;');
    if (cal42b.indexOf('tn-loose-quote') >= 0) F42('剥注释自校准失效：一枚没闭合的引号把后面的真注释一路保护下来了（字符串态没在裸换行处收口）——正文字符串外随便一枚游离撇号都会让整份文件变成盲窗，那比原 bug 更瞎');
    /* §41 与 §42 共用同一把剥刀；flat41 一退回 naive，§41 那八族期望 0 就又住回盲窗里。
          §41 的名单里没有 verify.js，只能自指——而自指这条**只能钉定义行**：钉「整串在文件里出现」
          的话，比较串自己就是那一处命中，永远为真（首轮 M44 就是这么假过去的）。 */
    const DEF41 = (rd42('tools/verify.js').match(/^[ \t]*const flat41 = [^\n]*/m) || [''])[0];
    if (DEF41.indexOf('stripBlockComments') < 0) F42('§41 的 flat41 定义行没走这把共享剥刀（现场读到的那一行：' +
      (DEF41.slice(0, 56) || '整行没数到，连定义都漂了') + '）：两节又各剥各的，批次 27 那处盲窗会在 §41 一侧原地重开，而这一节照样全绿');
    /* 文档那一支必须走「不剥注释」：README 的登记串里天生要写 glob，剥注释＝给文档开盲窗。
          与 DEF41 同一条自指纪律——只钉定义行，钉整串的话比较串自己就是那一处命中。 */
    ['view41', 'view42'].forEach(function (fn) {
      const L = (rd42('tools/verify.js').match(new RegExp('^[ \\t]*const ' + fn + ' = [^\\n]*', 'm')) || [''])[0];
      if (L.indexOf('.md$') < 0) F42(fn + ' 的定义行退回「文档也剥注释」那一支（现场读到的那一行：' +
        (L.slice(0, 60) || '整行没数到') + '）：markdown 没有块注释，README 里那几处 glob 形状会被当成注释开头吃掉，' +
        '文档侧的锚当场读 0——批次 27 就是把一串属性值抄进登记文字后，§40 的一条 README 锚红成了这样');
    });
    ['id="tnQuotes"', 'id="tnEditSave"'].forEach(function (mk) {
      if (V42['travel-notes.js'].indexOf(mk) < 0) F42('盲区哨兵：面板骨架里「' + mk + '」这一段在 flat 里读不到了（这两枚各在一处历史盲窗的正中央；读不到＝这一带又变成盲窗，住在里面的期望 0 那一族会静默满足）');
    });
  }

  /* ① 五枚弹层关闭钮 + 查看器那枚：类名、id、aria 三件齐，逐枚点名；
        尺寸与皮肤只在 design.css 一处；两族样式住在所有宿主页都加载的那张表里；放大出口只有一条。 */
  const A42 = [
    ['travel-notes.js', '<button class="ui-modal-x" id="tnExpX" aria-label="关闭">', 1, '导出备份那枚：改前是 <button id="tnExpX" style="…34px…" aria-label="关闭" 后面直接拼 TI()，图标整串被解析器吞进属性表'],
    ['travel-notes.js', '<button class="ui-modal-x" id="tnImpX" aria-label="关闭">', 1, '导入备份那枚＝用户点名的这一处（同一形状的第二份拷贝）'],
    ['travel-notes.js', '<button class="ui-modal-x" id="placePickerClose" aria-label="关闭">', 1, '选点弹层那枚：同一形状，只是没人报'],
    ['results.js', '<button class="ui-modal-x" id="rzX" aria-label="关闭">', 1, '纪念册预览那枚：扫描时一并揪出来的，形状与前四枚一模一样'],
    ['results.js', '<button class="ui-modal-x" id="ix" aria-label="关闭">', 1, '定制路书那枚（第五处）'],
    ['travel-notes.js', 'class="ui-modal-x"', 3, '面板三枚共用同一个类名：掉到 2＝有一枚又退回页内拼尺寸'],
    ['results.js', 'class="ui-modal-x"', 2, 'results.js 两枚同理'],
    ['travel-notes.js', 'class="tn-viewer-x" id="tvX" aria-label="关闭">', 1, '查看器那枚此前连 aria-label 都没有：图标不 paint 时读屏也只剩一个无名字按钮'],
    ['design.css', '.ui-modal-x{flex:0 0 auto;width:44px;height:44px', 1, '尺寸只在 design.css 这一处定义（改前四枚各拼各的：34/34/34/36，手机上按不到）；flex:0 0 auto 是不许少的——标题行是 flex，被挤到 0 宽就又看不见了'],
    ['design.css', '.ui-modal-x:active{transform:scale(.92)', 1, '按下要有反馈：这一族与 .ui-sheet-x 同一套手感'],
    ['design.css', '.theme-dark .ui-modal-x{', 1, '暗色档补回：皮肤不住在类里，页内 inline 那版就没有暗色态'],
    ['design.css', '.tn-viewer-x{position:absolute', 1, '查看器那枚的定位也在 design.css（原来住 map.css 时，index 上它是文档流里第一个子节点，图标画出来也贴错地方）'],
    ['design.css', '.ui-modal-mask.show .ui-modal{transform:scale(1)}', 1, '弹层入场那一手要留着：浏览器腿量的就是它的终态（过渡中实测 41×41，见 settle 那条锚）'],
    ['design.css', '.tn-viewer{position:fixed', 1, '全屏查看器：改前这一屏读到空类，退化成一个 328×63 的裸 DIV，点照片「没反应」就是这个'],
    ['design.css', 'z-index:9900', 1, '盖在面板与底导航之上（面板那一层是 9400 一族；死码那版用的 9600 压不住查看器）'],
    ['design.css', 'animation:tnPickFade var(--motion-fast) ease', 1, '引用面板运行时注入的关键帧：挪表时这条腿一断就没有淡入，而 V07 读的正是 animationName 的解析值'],
    ['travel-notes.js', '@keyframes tnPickFade', 1, '关键帧的真身在 travel-notes.js 注入的表里（design.css 只引用它）：两条锚是一对，删一边另一边就静默失效'],
    ['design.css', '.tn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)', 1, '没有这一条，那 31 个 <span> 就排成一行裸日号——正是用户截图里「只有 1234567」的另一半成因'],
    ['design.css', '.tn-cal-nav{width:44px;height:44px', 1, '月份导航钮：改前 36×36 且住在 map.css（这一屏从没加载过那条规则）'],
    ['design.css', '.tn-cal-today{min-height:44px', 1, '「本月」胶囊：改前 min-height:34px'],
    ['design.css', 'body .tn-item h4 .tn-site{', 1, '裸类普查扫出来的同形状漏口：这条此前全库无定义，卡片里的「· 站点名」照抄 h4 的衬线大号，与标题糊成一句'],
    ['travel-notes.js', 'function zoomPhoto(src) {', 1, '放大出口在面板内只有一份：这里曾有两个同名 function（后一份静默盖掉前一份，而被盖那份的调用者是 0 个——JS 提升不报错）'],
    ['travel-notes.js', 'function zoomPhotoIdx(id, idx) {', 1, '按笔记 id 放大那一支'],
    ['travel-notes.js', 'zoomPhotoIdx: zoomPhotoIdx,', 1, '对外出口：卡片上的 <img onclick> 只能走它，不许在页内自己拼全屏层'],
    ['travel-notes.js', "onclick=\"TravelNotes.zoomPhotoIdx", 1, '照片上的点：这里曾直调裸名字 zoomPhoto，两份同名函数分家时读到的就是被盖的那份'],
    ['travel-notes.js', 'function openViewer(photos, idx) {', 1, '查看器唯一构造点'],
    ['travel-notes.js', 'openViewer(ph,', 2, '两个入口（按 id / 按 src）收在同一个查看器上：谁再拼一层全屏层就是第二套皮'],
    ['travel-notes.js', 'function renderItem(body, n) {', 1, '共用单篇卡：照片、标签、录音与六个出口都在这一张卡上'],
    ['travel-notes.js', 'renderItem(box, x);', 1, '日历点开那天的卡回到共用卡（成因③）：V23 断的 .tg 出口恰 6 枚就是这一手的结果'],
    ['ui.js', "xBtn.className = 'ui-sheet-x';", 1, '.ui-sheet-x 是 ui.js 挂的那枚（带 float 与重画补回那条腿）；面板自己拼的这几枚走 .ui-modal-x，两族不许互相蹭（§37 明令 ui-sheet-x 只出现在 ui.js+design.css）'],
    ['tools/smoke-viewer.js', 'const VW = 328, VH = 723;', 1, '真机档取一加 Ace 6T 的 CSS 视口（批次 23-D 的改判口径）'],
    ['tools/smoke-viewer.js', "ok('V", 36, '字面判据条数（实跑 36/36 绿）：少一条要说话'],
    ['tools/smoke-viewer.js', 'naturalWidth', 1, '假图夹具先证明自己解得开：解不开 UI.imgFail 会把 <img> 换成占位块，下面整节腿静默变空——这是假闸的形状'],
    ['tools/smoke-viewer.js', 'function settle(', 1, '量几何之前等入场动画收尾：直接读 rect 拿到的是过渡中的 41×41'],
    ['tools/smoke-viewer.js', 'setTimeout(step, 40)', 1, 'settle 的心跳必须是定时器：headless 里 rAF 冻在过渡首帧，用 rAF 轮询等于把 41 当稳定值，判据永远红在「改对了」的那一边'],
    ['tools/smoke-viewer.js', 'elementFromPoint', 2, '「看不见」与「点不动」是两件事：命中检用真坐标，且要允许命中钮内置的那张 svg'],
    ['tools/smoke-viewer.js', 'function openAndRead(', 1, '五枚弹层 X 走同一条取样路径：只有各自的 id 不同；取样时机一不同，读数就不可比'],
  ];
  A42.forEach(a => {
    if (a.length !== 4) {
      F42('A42 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V42)) { F42('A42 登记了 §42 没读的文件「' + f + '」：' + why); return; }
    const n = cnt42(V42[f], needle);
    if (n !== exp) F42(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* ② 期望 0：改前那四族写法不许回来，每条配正向对照（改前原文或合成源串） */
  const ZERO42 = [
    ['travel-notes.js', "aria-label=\"关闭\"" + Q42 + "+TI(", "aria-label=\"关闭\"" + Q42 + "+TI('close', 14)", 'tag 没闭合就交给字符串拼接：紧随的整串 <svg> 被解析器当成 button 的属性吞掉，DOM 里只剩一枚不 paint 的裸 <use>，用户读到的就是「关闭按钮没 x」'],
    ['results.js', "aria-label=\"关闭\"" + Q42 + "+TI(", "aria-label=\"关闭\"" + Q42 + "+TI('close', 14)", '同一份形状的第二宿主：只修 travel-notes.js 的话 results.js 那两枚还是没图标，而这一节钉的是形状不是文件名'],
    ['travel-notes.js', 'id="tnExpX" style=', 'id="tnExpX" style="border:0;background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px', '尺寸又回到页内 inline：四枚各拼各的（34/34/34/36 实测），design.css 那条 .ui-modal-x 就成了摆设，暗色态与 :active 也一并丢掉'],
    ['travel-notes.js', 'class="ui-modal-x" style=', 'class="ui-modal-x" style="width:34px;height:34px" id="tnExpX"', '合成对照：这一条钉「尺寸只许在 design.css 一处」——挂了类又把宽高写回内联，类就只剩个名字，§39 的「值对、出处错」原地复发'],
    ['results.js', 'class="ui-modal-x" style=', 'class="ui-modal-x" style="width:34px;height:34px" id="ix"', '同上，results.js 那一侧'],
    ['travel-notes.js', "item.className = 'tn-item tn-cal-item';", "item.className = 'tn-item tn-cal-item';", '日历日卡又自己拼窄卡：那一版 .tg 只有编辑/删除两枚（共用卡是 6 枚），照片、标签、录音全不在屏上，「日历里点照片放大」无从下手'],
    ['design.css', '.tn-cal-item', '.tn-cal-item{border:1px solid var(--color-line);border-radius:14px;padding:12px 14px;margin-bottom:10px}', '给「日历专用小卡」发通行证＝V23 那条 acts===6 会被重新绕开：窄卡那版样式（连同上面那条拼串）一起退场'],
    ['map.css', '.tn-cal-item', '.tn-cal-item{border:1px solid var(--color-line);border-radius:14px;padding:12px 14px;margin-bottom:10px}', '同一条也不许留在 map.css：那张表只被 3 页加载，而发这个类的面板挂在 15 页上'],
    ['map.css', '.tn-viewer', '.tn-viewer{position:fixed;inset:0;z-index:9900', '查看器一族只许有一份，而且必须在所有宿主页都加载的 design.css 里：写回 map.css＝index/travel-map 读到空类，点照片「没反应」（实测退化成文档流里 328×63 的裸 DIV）'],
    ['map.css', '.tn-cal-', '.tn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)', '日历一族同上：没有 grid 那 31 个 <span> 就是排成一行裸日号——批次 26 那张截图的另一半成因'],
    ['travel-notes.js', 'z-index:9600', "d.style.cssText='position:fixed;inset:0;z-index:9600", '死码那版自己拼的全屏层（9600 那一档，调用者 0 个）不许回来：它是第二套皮，而且压不住 9900 的查看器'],
    ['design.css', '.rz-x', '.rz-x{width:38px;height:38px;border:1px solid var(--color-line);border-radius:50%', 'results.js 那两枚改挂 .ui-modal-x 之后这条就是孤儿样式（全库零调用者）：孤儿规则留着＝下一轮「值对、出处错」的候选，而且它正是 §39 那份 38px 名单里的一条'],
    ['travel-notes.js', 'id="tnConfirm"', '<div class="tn-confirm" id="tnConfirm" style="display:none"></div>', '那枚空挂载点是裸类普查里唯一的例外（无样式、全库零引用）：删掉它这一节才不需要白名单；它回来＝普查要开后门'],
    ['tools/smoke-viewer.js', 'window.__rd', "window.__rd = READX;", '浏览器腿不许再把读样函数挂到页面上：页内脚手架一旦被产品自己的同名变量盖住，读数就是假的（这一版把函数直接传进 evaluate）'],
  ];
  ZERO42.forEach(a => {
    if (a.length !== 4) {
      F42('ZERO42 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V42)) { F42('ZERO42 登记了 §42 没读的文件「' + f + '」：' + why); return; }
    if (cnt42(V42[f], needle) !== 0) F42(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt42(flat42(ctrl), needle) < 1) F42('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 内置坏形状扫描器（口径来自 tools/out/probe27-scan-tagclose.js，但这一节自己跑，
        不依赖谁手工跑过探针）。先自校准：合成坏形状必须命中 1、合成好形状必须命中 0——
        没有这一步，正则一旦退化（比如被改掉一个字符），全库 0 就毫无意义。 */
  let scan42 = { files: 0, any: 0, bad: 0, good: 0, un: 0 };
  {
    const BAD42 = /<[a-zA-Z][^<>]*?["']\s*\+\s*TI\(/g;
    const GOOD42 = /<[a-zA-Z][^<>]*?>\s*['"]\s*\+\s*TI\(/g;
    const ANY42 = /\+\s*TI\(/g;
    const CAL_BAD42 = '<button id="tnExpX" style="width:34px" aria-label="关闭"' + Q42 + '+TI(' + Q42 + 'close' + Q42 + ', 14)';
    const CAL_GOOD42 = '<button class="ui-modal-x" id="tnExpX" aria-label="关闭">' + Q42 + ' + TI(' + Q42 + 'close' + Q42 + ', 14)';
    const m = (re, s) => (s.match(re) || []).length;
    if (m(BAD42, CAL_BAD42) !== 1) F42('扫描器自校准失效：合成坏形状串命中 ' + m(BAD42, CAL_BAD42) + '（期望 1）。正则一退化，下面那个「全库 0」就是空的');
    if (m(GOOD42, CAL_BAD42) !== 0) F42('扫描器自校准失效：合成坏形状串被好形状正则认领（' + m(GOOD42, CAL_BAD42) + '）＝两族不再互斥，坏的那一半会被算成好的');
    if (m(BAD42, CAL_GOOD42) !== 0 || m(GOOD42, CAL_GOOD42) !== 1) F42('扫描器自校准失效：合成好形状串应 BAD 0／GOOD 1，实得 ' + m(BAD42, CAL_GOOD42) + '／' + m(GOOD42, CAL_GOOD42));
    /* 现场逐条看过、两族正则都不认的合法第三形状（闭合符在拼接段里）：新增一处要看过再登记 */
    const UNCAL42 = ['node-manager.html', 'planner.js'];
    const list42 = fs.readdirSync('.').filter(f => /\.(js|html)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
    const hits42 = [], un42 = [];
    list42.forEach(f => {
      rd42(f).split('\n').forEach((line, i) => {
        const b = m(BAD42, line), g = m(GOOD42, line), a = m(ANY42, line);
        scan42.any += a; scan42.bad += b; scan42.good += g;
        if (b) hits42.push(f + ':' + (i + 1) + '  ' + ws42(line).slice(0, 90));
        if (a > Math.max(b, g)) un42.push(f);
      });
    });
    scan42.files = list42.length;
    scan42.un = un42.length;
    /* 站点清单必须打在**同一行**：F42 的行前缀是判据，变异网按行取红，换行列出的文件名在它眼里不存在
          （首轮 M02 三条红里没一条带 results.js，就是这么误判成「异常」的）。 */
    if (hits42.length) F42('拼串漏收尾 > 的站点 ' + hits42.length + ' 处（图标整串被吞进属性表，界面上就是「关闭按钮没 x」）：' + hits42.join(' ｜ '));
    if (scan42.any < 90) F42('全库 +TI() 站点分母只剩 ' + scan42.any + '（实测 92）：拼接写法一被整体改掉，这个扫描器就退化成什么都不查，分母要跟着口径一起改');
    if (scan42.un !== UNCAL42.length) F42('两族正则都没认领的站点从 ' + UNCAL42.length + ' 变成 ' + scan42.un + '：新增的那一处必须现场看过（是真坏形状还是第三种合法写法）再登记，不能被「坏 0」顺手放过');
    un42.forEach(function (f) { if (UNCAL42.indexOf(f) < 0) F42('未认领站点出现在没登记过的文件「' + f + '」：现场看过再决定是修法还是登记为合法第三形状'); });
  }

  /* ④ 内置裸类普查（口径来自 tools/out/probe27-class-coverage.js）：面板发出的每一个 tn-* 类，
        必须在「所有宿主页都加载的 design.css」或「面板自己注入的那份表」里。只在 map.css、
        或只在某页内联 <style> 里，都算没定义——批次 26 把样式加错表就是这么绿过去的。 */
  let cls42 = { total: 0, design: 0, own: 0 };
  {
    const raw = rd42('travel-notes.js');
    const CTX42 = [
      /\bel\(\s*'[a-z]+'\s*,\s*'([^']+)'/g,
      /className\s*=\s*'([^']+)'/g,
      /class="([^"]+)"/g,
      /class='([^']+)'/g,
      /\$\(body,\s*'\.([a-z0-9_-]+)'\)/g,
      /querySelector(?:All)?\('\.([a-z0-9_-]+)'\)/g,
    ];
    const seen42 = new Set();
    CTX42.forEach(function (re) {
      let mm; while ((mm = re.exec(raw))) ws42(mm[1]).split(/\s+/).forEach(function (t) { if (/^tn-[a-z0-9-]+$/.test(t)) seen42.add(t); });
    });
    const inline42 = rd42('index.html') + rd42('travel-map.html') + rd42('map.css');
    const naked42 = [], wrong42 = [];
    [...seen42].sort().forEach(function (c) {
      if (V42['design.css'].indexOf('.' + c) >= 0) { cls42.design++; return; }
      if (new RegExp('\\.' + c + '[\\s,{:.\\[>]').test(raw)) { cls42.own++; return; }
      if (inline42.indexOf('.' + c) >= 0) { wrong42.push(c); return; }
      naked42.push(c);
    });
    cls42.total = seen42.size;
    if (cls42.total < 70) F42('裸类普查的分母只剩 ' + cls42.total + ' 个（实测 78）：六个提取上下文被改掉／面板模板换了写法，这一节就退化成什么都不查');
    if (naked42.length) F42('面板发了裸类（design.css、面板自注入表、map.css、页内联四处都没有定义，界面读到的是空类）：' + naked42.join(' '));
    if (wrong42.length) F42('面板发的类只住在 map.css 或 index/travel-map 的页内联 <style> 里（map.css 只被 3 页加载、页内联只在那一页）：' + wrong42.join(' ') + '——批次 26 的 .tn-cal-* 就是这个形状');
  }

  /* ⑤ 动态宿主对账：凡挂了 travel-notes.js 的页面必须引 design.css。
        页码现场数，不抄文档（批次 26 的失真记录里「16 个页面」实为 15）。 */
  let hosts42 = [];
  {
    hosts42 = fs.readdirSync('.').filter(f => f.endsWith('.html') && rd42(f).indexOf('travel-notes.js') >= 0);
    if (hosts42.length < 15) F42('挂 travel-notes.js 的宿主页现场只数到 ' + hosts42.length + ' 页（实测 15）：分母掉下去说明枚举口径被改，这一节就不再覆盖全站');
    const noDesign = hosts42.filter(function (f) {
      const sheets = [...rd42(f).matchAll(/<link[^>]*stylesheet[^>]*href="([^"]+)"/g)].map(mm => mm[1]);
      return sheets.indexOf('design.css') < 0;
    });
    if (noDesign.length) F42('这些页面挂了 travel-notes.js 却没引 design.css：' + noDesign.join(' ') + '——面板发的那 78 个类在这一屏全是空类（点照片没反应、日历排成一行裸日号就是这个形状）');
  }

  /* ⑥ 浏览器腿的形状标签逐条在场：锚点只钉「脚手架在不在」，这六类判据是产品行为本身，
        摘掉一条就是那个症状重新没人管。 */
  ['V00 测试假图自己能解码', 'V03 查看器 position 是 fixed', 'V15 日历网格是 display:grid',
   'V19 有记录的那一格底色', 'V23 点开那天的卡是「那一张卡」', 'V24 日历里点开那天看得到照片',
   'V26 导出备份弹层的关闭钮', 'V28 导入备份弹层的关闭钮同上（用户点名的那一枚）',
   'V29 点这枚 X 真的收掉了弹层', 'V33 首页（第二个宿主页）'].forEach(function (lab) {
    if (V42['tools/smoke-viewer.js'].indexOf(lab) < 0)
      F42('tools/smoke-viewer.js 缺「' + lab + '」这条判据（这一节的立论是「读计算样式与真 DOM 命中，不是读节点在不在」，少一条就少一个证据）');
  });

  if (V42['README.md'].indexOf('§42') < 0) F42('README.md 的 verify 清单没提 §42（新闸门不写进 README 就等于没装）');

  console.log('拼串闭合与样式表归属闸门: ' + A42.length + ' 条代码锚点（关闭钮五枚逐一点名 + 面板类名计数 3/2 + design.css 尺寸/皮肤/暗色/关键帧引用 + 查看器与日历两族在 design.css 的几何单点 + 放大出口（同名函数恰 1／对外出口 1／构造点 1／两入口收口 2）+ 共用卡两点 + ui-sheet-x 分家 + 浏览器腿 7 条脚手架纪律）+ 十四族期望 0（漏收尾 > 的拼串 ×2 宿主／页内 inline 尺寸／窄卡拼串与它的样式 ×2 表／两族样式留在 map.css／9600 那版死码全屏层／孤儿 .rz-x／空挂载点 tn-confirm／页内脚手架 window.__rd）各配正向对照 + 五项读源码纪律（剥注释先跳字符串再判注释开头，四段合成串正反向自校准；没闭合的引号不许把后面的真注释保护下来；§41 的 flat41 必须走同一把共享剥刀；文档那一支不剥注释（markdown 没有块注释，而 README 的登记串里天生要写 glob）；两处历史盲窗的正中央各钉一枚现场哨兵）+ 三项内置动态对账（坏形状扫描 ' + scan42.files + ' 个文件／' + scan42.any + ' 站点／坏 ' + scan42.bad + '／好 ' + scan42.good + '／未认领 ' + scan42.un + ' 处逐处登记，扫描器先自校准；裸类普查 ' + cls42.total + ' 类＝design.css ' + cls42.design + '＋面板自注入 ' + cls42.own + '／裸 0／错表 0；宿主对账 ' + hosts42.length + ' 页真引 design.css／违规 0）+ 十条浏览器腿形状标签逐条在场；A42 表长 ' + A42.length + ' 条、ZERO42 表长 ' + ZERO42.length + ' 条，抬阈值类变异要取当前长度 + 1；变异自测见 tools/out/mut-verify42.js');
  fail += bad42;
}

/* ============ §43 排期读数单点闸门（批次 28） ============
   用户报（2026-10-07 逐字）：「我就在大同，在行程规划选择应县木塔和悬空寺，起始点按默认当前位置
   为空没填，终点填的当前位置（或是选还线），得出的都不对，本来一天的行程，规划结果的是两天，
   一天一个景点，而且没有起始地和终到地。」四条成因都在"同一个量有两本账"这一族里：
     1) 天数框预填了一个没人说过的 5，而分日把 5 当硬约束：ceil(2 站 / 5 天)＝每天 1 站 → 两站两天。
        同一屏的汇总条却写着「预计 1 天」——估算读 state.days、排期读 DOM，先印 1 再排 2。
     2) 出发地留空时首日 0 km，结果页又只在头部小字露一次名字、没有「起」这一行 →「没有起始地」；
        而标签写着「可不填，缺省=当前位置」，全站没有一处把定位接到出发地（零调用者的承诺）。
     3) 环线＋空出发地是死控件：isLoop=true 而 end=null，末步印着「是 · 回到起点」，86 km 返程没排。
        另一手：向导里 state.end = state.start 是共享引用，排期把 end.isLoop 写回时会顺着改到出发地。
     4) 终到地名认不出坐标时照印「0 km」，看着像"终点就在隔壁"，其实是没匹配到。
   外加本轮自己改出来的一条：定位成功后，文本框回读只按名字查字典，会把刚拿到的坐标洗成 null
        （toast 说「出发地已设为当前位置」而落盘 lat=null）——所以起终点的写入口必须只有一个形状。
   这一节钉的就是：天数一个读法、起终点一个出口、环线一个落点、定位一条有调用者的腿。 */
{
  let bad43 = 0;
  const F43 = m => { bad43++; console.log('FAIL §43 排期读数单点闸门: ' + m); };
  const ws43 = s => s.replace(/\s+/g, ' ').trim();
  const flat43 = s => ws43(stripBlockComments(s));
  const cnt43 = (s, n) => s.split(n).length - 1;
  const rd43 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view43 = f => /\.html$|\.md$/.test(f) ? ws43(rd43(f)) : flat43(rd43(f));
  const Q43 = String.fromCharCode(39);

  const FILES43 = ['planner.js', 'tools/smoke-sched.js', 'README.md'];
  const V43 = {};
  FILES43.forEach(f => {
    if (!fs.existsSync(f)) { F43('缺 ' + f); V43[f] = ''; return; }
    V43[f] = view43(f);
  });

  /* ⓪ 自指纪律与 §42 同一条：flat43 必须走那把共享剥刀，而且只钉定义行
        （钉「整串在文件里出现」的话，比较串自己就是那一处命中，永远为真）。
        这一节有九族"改前形状"要读 0，还有三十多条正向锚要读非 0，两边都靠这把刀活着。
        现场实测（tools/out/probe43-anchor-comment.js：逐串比"未剥"与"剥后"的命中数）：
        A43 的 33 条 planner.js 锚与注释文本重叠 0 条，那四串改前形状在含注释的原文里也各 0 处
        ——也就是说这一节**今天不靠**注释喂任何一条判据，剥刀退化成 naive 不会被现状掩盖。
        但危险方向是现成的：本批的注释天然要抄改前的原文（850–852、1125–1127 两段就在抄），
        哪天原样抄进注释，「注释当代码」那一支会让某条正向锚靠注释里的引用假绿；
        反过来「真代码当注释吞掉」（§42 记的 travel-notes.js 两处盲窗 655→704、1843→1891）
        会让住在这一带的期望 0 静默满足——那种 0 不是证据，是闸门在替人撒谎。 */
  {
    const DEF43 = (rd43('tools/verify.js').match(/^[ \t]*const flat43 = [^\n]*/m) || [''])[0];
    if (DEF43.indexOf('stripBlockComments') < 0) F43('§43 的 flat43 定义行没走这把共享剥刀（现场读到的那一行：' +
      (DEF43.slice(0, 56) || '整行没数到，连定义都漂了') + '）：注释里写的改前形状会被当成代码在场');
    const L43 = (rd43('tools/verify.js').match(/^[ \t]*const view43 = [^\n]*/m) || [''])[0];
    if (L43.indexOf('.md$') < 0) F43('view43 的定义行退回「文档也剥注释」那一支（现场读到的那一行：' + (L43.slice(0, 60) || '整行没数到') + '）：README 的登记串里天生要写 glob 形状，文档侧的锚会当场读 0');
    /* 现场哨兵：这两处新代码各自贴着一段解释改前形状的注释，注释一旦盖住代码就什么都读不到 */
    ['function endpointRow(leg', 'function matchKeep(cur'].forEach(function (mk) {
      if (V43['planner.js'].indexOf(mk) < 0) F43('盲区哨兵：「' + mk + '」在 flat 里读不到了（这两处各自贴着一段解释改前形状的注释；读不到＝这一带又变成盲窗，住在里面的期望 0 那一族会静默满足）');
    });
  }

  /* ① 正向锚点：一个读法／一个出口／一个落点／一条有调用者的腿 */
  const A43 = [
    ['planner.js', 'function daysInput() {', 1, '天数只有一个读法。改前输入框预填 5 而 state.days 是 0，估算读 state、排期读 DOM：同一屏先印「预计 1 天」再排出 2 天'],
    ['planner.js', 'daysInput()', 3, '定义 + estimateDays + doSchedule 三个落点；掉到 2＝有一处又回去自己解析 DOM，两本账原地复活'],
    ['planner.js', "if (!el) return state.days || 0;", 1, '没有输入框时的退路也只能是 0（不限），不许再兜回任何"好用的默认值"'],
    ['planner.js', 'state.days = daysInput();', 1, '排期第一步先把口径归一，再往下算——估算与排期必须读同一个数'],
    ['planner.js', "return splitIntoDays(ordered, state.start, daysInput(), state.end, mkLeg(matrix, travelByNow())).length;", 1, '汇总条那句「预计 N 天」与真正排期用的是同一次分日调用（同函数、同入参），不是第二次估'],
    ['planner.js', '<label>天数（留空＝按里程与时长自动分日）</label>', 1, '留空的后果写在标签里；改前这里只有「天数」两个字，没人知道空着会被当成 5'],
    ['planner.js', 'placeholder="不限"', 1, '空值的口径要有个名字：placeholder 就是它'],
    ['planner.js', "' + (state.days || '') + '", 1, '预填只回填用户说过的数（0 就留空）；这一串一旦变回 || 5，两站就又会被排成两天'],
    ['planner.js', 'function endpointRow(leg, tag, pt, other, looped) {', 1, '起／终两行的唯一出口：同一套版式，同一条「有坐标才报里程，没坐标就明说不参与」'],
    ['planner.js', 'endpointRow(leg, ', 3, '定义 + 起 + 终：改前只有终行，出发地只在头部小字里露一次名字 → 用户读到的就是「没有起始地」'],
    ['planner.js', "h += endpointRow(leg, " + Q43 + "起" + Q43 + ", trip.start, firstPlay, false);", 1, '「起」行挂在首站之前，里程与日卡同一把尺子（含真实矩阵）'],
    ['planner.js', "h += endpointRow(leg, " + Q43 + "终" + Q43 + ", trip.end, lastPlay", 1, '「终」行与「起」行同一出口，环线标注由 end.isLoop 决定'],
    ['planner.js', '未匹配到坐标 · 不参与里程', 3, '起行／终行／向导末步两行共用同一句真话；改前这些地方印的是「0 km」，看着像终点就在隔壁'],
    ['planner.js', '没有可对算的站点', 1, '有名字、有对端没坐标的那一支也要说得出口，不许静默留白'],
    ['planner.js', '（抵达地）', 1, '单程终点的标注（环线走另一支「回到起点 · 环线」）'],
    ['planner.js', 'var epParts = [rulerNote(trip),', 1, '头部那行改成部件表 + 一次 join：改前出发地缺失时会留下孤零零的「；；」'],
    ['planner.js', "else epParts.push(" + Q43 + "未填出发地：首日里程只含站与站之间的路" + Q43 + ");", 1, '没填就直说没填，并顺带把首日里程的口径讲清楚'],
    ['planner.js', 'esc(epParts.join(', 1, 'join 只在部件之间插分隔符，缺项不会留疤'],
    ['planner.js', 'function syncLoopEnd() {', 1, '环线只有一个落点：终点＝出发地的副本。改前向导里是 state.end = state.start（共享引用），排期把 end.isLoop 写回时顺着改到出发地头上'],
    ['planner.js', 'syncLoopEnd();', 5, 'renderWizard / wizardOpen / 出发地 onchange / 环线=是 / 定位成功 五个入口全走它；掉到 4＝有一处又自己拼终点'],
    ['planner.js', "else { state.isLoop = false; state.end = null; }", 1, '出发地被清空时环线自己退成单程——不许出现「末步印着 是 · 回到起点，而 end=null、排期里没有那段返程」'],
    ['planner.js', '环线要先填出发地', 1, '缺出发地点环线要被带回第 1 步并给原因；改前这枚是死控件（只翻个高亮，把人留在原地）'],
    ['planner.js', 'function locate(cb, fail) {', 1, '定位一条腿一个出口（改前同样的 getCurrentPosition 回调在两个函数里各写一遍，改一漏一）'],
    ['planner.js', 'navigator.geolocation.getCurrentPosition', 1, '全站这一处调用；出现第二处＝又有人绕过 locate 自己拼'],
    ['planner.js', 'window.plannerStartFromHere', 2, '定义 + 出发地那一行的按钮：这条承诺的腿有调用者（改前它零调用者，标签却写着「缺省=当前位置」）'],
    ['planner.js', 'id="wStartLoc"', 1, '出发地的定位入口就钉在这一枚钮上'],
    ['planner.js', 'function matchKeep(cur, val) {', 1, '文本框回读只认名字：名字没改过就沿用现值。缺这一手时定位成功后下一步会把坐标洗成 null'],
    ['planner.js', 'matchKeep(', 5, '定义 + readEndpointInputs 两处 + 两个 onchange；掉到 4＝有一处退回裸 matchStart'],
    ['planner.js', 'function readEndpointInputs() {', 1, '向导读 DOM 的单点（wizardOpen 兜底与第 1 步下一步共用它）'],
    ['planner.js', 'readEndpointInputs();', 2, '两个读 DOM 的入口，一个都不许多'],
    ['planner.js', "state.start = { name: " + Q43 + "当前位置" + Q43 + ", lat: lat, lng: lng };", 1, '定位成功的落点：坐标真进 state.start，于是首日里程含"从你站的地方到第一站"'],
    ['planner.js', '留空＝首日只算站与站之间的路', 1, '第 1 步的标签口径（末步那句是「未填（首日…）」，两串不同，各钉各的）'],
    ['planner.js', '留空＝单程；要回到出发地用下一步的环线', 1, '终到地的标签把"要回到出发地"指向环线，而不是让人在两个入口里猜'],
    ['tools/smoke-sched.js', 'const VW = 328, VH = 723;', 1, '真机档取一加 Ace 6T 的 CSS 视口（批次 23-D 口径）'],
    ['tools/smoke-sched.js', 'deviceScaleFactor: 2', 1, '真机档要带 dpr，否则量到的是桌面那套字号'],
    ['tools/smoke-sched.js', 'localStorage.clear(); sessionStorage.clear()', 1, 'file:// 同源共享两套存储：逐档清场，否则上一档的状态快照直接恢复，读数就不是这一档的'],
    ['tools/smoke-sched.js', 'navigator.geolocation.getCurrentPosition = function (cb)', 1, '定位桩：headless 下 file:// 拿不到位权，不桩就没有第二条腿能证明这颗钮真接上了（只验接线，不代表真 GPS）'],
    ['tools/smoke-sched.js', 'function advanceToEnd(', 1, '向导会被守卫改回上一步，所以"点到末步"必须按按钮在不在走，不能按次数走（按次数的那版在 D 档直接走不到 #wDone）'],
    ['tools/smoke-sched.js', 'advanceToEnd', 2, '定义 + 调用；调用那一处掉了＝这条腿不再真正走到排期'],
    ['tools/smoke-sched.js', 'ok(' + Q43 + 'S', 36, '字面判据条数（S00 那一处是档级异常，实跑 35 条）：少一条要说话'],
  ];
  A43.forEach(a => {
    if (a.length !== 4) {
      F43('A43 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V43)) { F43('A43 登记了 §43 没读的文件「' + f + '」：' + why); return; }
    const n = cnt43(V43[f], needle);
    if (n !== exp) F43(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* ② 期望 0：四族改前写法 + 本轮改出来那一族，每条配正向对照 */
  const ZERO43 = [
    ['planner.js', 'state.days || 5', Q43 + ' value=" + (state.days || 5) + " + Q43', '天数框又预填一个没人说过的 5：两站会被 ceil(2/5) 排成每天 1 站，正是用户点名的「本来一天的行程排成两天」'],
    ['planner.js', "parseInt((" + Q43 + "$id(" + Q43 + "intentDays" + Q43 + ")", "parseInt((" + Q43 + "$id(" + Q43 + "intentDays" + Q43 + ") && $id(" + Q43 + "intentDays" + Q43 + ").value) || state.days || 0, 10) || 0", '排期自己解析 DOM：估算读 state、排期读 DOM 就是同一屏两本账的来路（先印「预计 1 天」再排出 2 天）'],
    ['planner.js', 'state.start = matchStart(', 'if (s1 && s1.value) state.start = matchStart(s1.value);', '文本框回读裸查字典：定位成功后再点下一步会按名字「当前位置」重查，把刚拿到的坐标洗成 null（toast 说已设为当前位置而落盘 lat=null，实测就红在这一手）'],
    ['planner.js', 'state.end = matchStart(', 'if (weEl2 && weEl2.value) state.end = matchStart(weEl2.value);', '同上，终到地那一侧'],
    ['planner.js', 'state.end = state.start;', 'state.end = state.start;', '共享引用：排期会把 end.isLoop 写回终点对象，顺着就改到出发地头上（环线那一支的终点必须是副本）'],
    ['planner.js', '（可不填，缺省=当前位置）', '（可不填，缺省=当前位置）', '这句承诺零调用者：全站没有一处把定位接到出发地。要么把腿接上（wStartLoc），要么改口——不许只留文案'],
    ['planner.js', 'state.isLoop = true; if (state.start && state.start.name) state.end = { name: state.start.name, lat: state.start.lat, lng: state.start.lng }; renderWizard();', 'state.isLoop = true; if (state.start && state.start.name) state.end = { name: state.start.name, lat: state.start.lat, lng: state.start.lng }; renderWizard();', '环线那枚死控件的原文：缺出发地时只翻高亮、把人留在第 2 步，于是 isLoop=true 而 end=null，末步印着「是 · 回到起点」而排期里根本没有那段返程'],
    ['planner.js', 'var lastStop', 'var lastStop = lastDay.stops[lastDay.stops.length - 1];', '终行自己算里程那一手退回局部拼串：它读的是"最后一个景点"而不是"终点"，坐标没匹配时照样拼出 0 km'],
    ['tools/smoke-sched.js', 'window.__', 'window.__ss = SNAP;', '浏览器腿不许再把读样函数挂到页面上：页内脚手架一旦被产品自己的同名变量盖住，读数就是假的（批次 27 立的口径，这一节沿用）'],
  ];
  ZERO43.forEach(a => {
    if (a.length !== 4) {
      F43('ZERO43 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V43)) { F43('ZERO43 登记了 §43 没读的文件「' + f + '」：' + why); return; }
    if (cnt43(V43[f], needle) !== 0) F43(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt43(flat43(ctrl), needle) < 1) F43('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 内置动态对账一：分日入口。凡调用 splitIntoDays 的行必须显式交代天数口径
        （daysInput()／state.days／字面 0＝不限），出现任何非零字面天数就是"没说出口的默认值"复活。
        先自校准：三种合成形状各判一次，判据本身错了下面整段就只是数行数。 */
  let split43 = { calls: 0, lit: [] };
  {
    const LIT43 = /,\s*[1-9]\d*\s*,/;
    const ZERO43ARG = /,\s*0\s*,/;
    const ok43 = ln => !LIT43.test(ln) && (ln.indexOf('daysInput()') >= 0 || ln.indexOf('state.days') >= 0 || ZERO43ARG.test(ln));
    if (!LIT43.test('var x = splitIntoDays(ordered, state.start, 5, state.end, leg);')) F43('分日判据自校准失效：合成坏形状（字面 5 天）没被非零字面那条抓到，这一节当场是空的');
    if (ok43('var x = splitIntoDays(ordered, state.start, 5, state.end, leg);')) F43('分日判据自校准失效：合成坏形状（字面 5 天）被判成合法口径');
    if (!ok43('var y = splitIntoDays(flat, start, 0, null, leg, forced);')) F43('分日判据自校准失效：合法的显式 0（不限天数、按预算自动分日）被误判成越界');
    if (!ok43('var z = splitIntoDays(o, s, daysInput(), e, leg);')) F43('分日判据自校准失效：走 daysInput() 那一支被误判成越界（正向对照失效，下面的 0 就不是证据）');
    rd43('planner.js').split('\n').forEach(function (ln, i) {
      if (ln.indexOf('splitIntoDays(') < 0 || ln.indexOf('function splitIntoDays') >= 0) return;
      split43.calls++;
      if (LIT43.test(ln)) split43.lit.push('planner.js:' + (i + 1) + '  ' + ws43(ln).slice(0, 96));
      else if (!ok43(ln)) split43.lit.push('planner.js:' + (i + 1) + '（既没读 daysInput()/state.days，也不是显式 0＝不限——口径没人交代）');
    });
    if (split43.calls !== 5) F43('splitIntoDays 的调用点从 5 处变成 ' + split43.calls + ' 处：新增一处分日入口要现场看过（它传的天数从哪来、估算会不会跟着改）再登记，否则"排期只有一个入口"这句话不成立');
    if (split43.lit.length) F43('分日调用里出现没人交代的口径：' + split43.lit.join(' ｜ ') + '——字面天数就是"没说出口的默认值"这一族的原件（改前 2 站排 2 天是它的产物）');
  }

  /* ④ 内置动态对账二：起终点的写入口。state.start / state.end 的每一处赋值必须落在四种形状里
        （matchKeep／syncLoopEnd 的副本与退单程／locate 的坐标对象）。
        新增一处＝先现场看过再登记，不能被"锚点全绿"顺手放过。 */
  let ep43 = { sites: 0, out: [] };
  {
    const OK43 = [
      'state.start = matchKeep(', 'state.end = matchKeep(',
      'state.end = { name: state.start.name', 'state.end = null;',
      'state.start = { name: ' + Q43 + '当前位置' + Q43,
    ];
    rd43('planner.js').split('\n').forEach(function (ln, i) {
      const mm = /state\.(start|end)\s*=[^=]/.exec(ln);
      if (!mm) return;
      if (/^\s*(\/\/|\*)/.test(ln) || ln.trim().indexOf('/*') === 0) return;
      ep43.sites++;
      if (!OK43.some(function (k) { return ln.indexOf(k) >= 0; })) ep43.out.push('planner.js:' + (i + 1) + '  ' + ws43(ln).slice(0, 96));
    });
    if (ep43.sites !== 7) F43('state.start／state.end 的赋值点从 7 处变成 ' + ep43.sites + ' 处：写入单点这句话的分母变了（新增要看过形状再登记，删掉要确认那条腿真没了）');
    if (ep43.out.length) F43('起终点出现没登记过的写法：' + ep43.out.join(' ｜ ') + '——本轮的两条实错都出在这一族（裸 matchStart 把定位坐标洗成 null、state.end = state.start 让 end.isLoop 反写出发地）');
  }

  /* ⑤ 内置动态对账三：天数这一个量只有三个落点（渲染／绑定／读取） */
  let days43 = { sites: 0, out: [] };
  {
    rd43('planner.js').split('\n').forEach(function (ln, i) {
      if (ln.indexOf(Q43 + 'intentDays' + Q43) < 0 && ln.indexOf('id="intentDays"') < 0) return;
      days43.sites++;
      const shape = ln.indexOf('id="intentDays"') >= 0 || ln.indexOf('$id(' + Q43 + 'intentDays' + Q43 + ').onchange') >= 0 ||
        ln.trim() === 'var el = $id(' + Q43 + 'intentDays' + Q43 + ');';
      if (!shape) days43.out.push('planner.js:' + (i + 1) + '  ' + ws43(ln).slice(0, 96));
    });
    if (days43.sites !== 3) F43('intentDays 的落点从 3 处变成 ' + days43.sites + ' 处：又多了一处直接读输入框？那正是"估算与排期两本账"的形状');
    if (days43.out.length) F43('intentDays 出现没登记的读法：' + days43.out.join(' ｜ ') + '（渲染那一行、绑定那一行、daysInput 里读那一行之外都不该有）');
  }

  /* ⑥ 内置动态对账四：承诺要有调用者（"文档承诺的能力要 grep 调用者"常驻化）。
        planner.js 里只要还在讲「当前位置」，出发地这条腿就必须真的有定位入口在数得清的调用者上。 */
  {
    const n = cnt43(V43['planner.js'], '当前位置');
    if (n < 8) F43('planner.js 里「当前位置」只剩 ' + n + ' 处（实测 12）：这一族的文案被整体改掉时，下面三条调用者对账会一起变成空断言');
    if (cnt43(V43['planner.js'], 'navigator.geolocation.getCurrentPosition') !== 1) F43('定位调用点不是 1 处：要么这条腿又断了（承诺重新变成零调用者），要么有人绕过 locate 自己拼');
    if (cnt43(V43['planner.js'], 'id="wStartLoc"') < 1) F43('出发地那颗「当前位置」钮不在了，而全站还在 12 处讲「当前位置」：零调用者的承诺原地复活');
    if (cnt43(V43['planner.js'], 'function locate(') !== 1) F43('locate 的定义不是 1 处：定位一条腿一个出口这条纪律断了（改前同样的回调在两个函数里各写一遍，改一漏一）');
  }

  /* ⑦ 浏览器腿的形状标签逐条在场：这八条是四个症状各自的那一半证据 */
  ['S04 A 档：2 站排成 1 张日卡', 'S07 A 档：排期前「预计 1 天」与排期后 1 张日卡是同一本账',
   'S13 B2 档：显式 2 天就排成 2 张', 'S14 C 档：出发地填「大同」后结果页有「起」这一行',
   'S19 D 档：空出发地点「环线=是」被带回第 1 步', 'S23 E 档：出发地+环线 → 终点自动等于出发地，且是副本不是同一个对象',
   'S26 F 档：终到地认不出坐标时印「未匹配到坐标 · 不参与里程」', 'S29 G 档：出发地这枚「当前位置」按钮把坐标真落进了 state'].forEach(function (lab) {
    if (V43['tools/smoke-sched.js'].indexOf(lab) < 0)
      F43('tools/smoke-sched.js 缺「' + lab + '」这条判据（这一节的立论是"断日卡张数、落盘形状、屏上那几行字"，不是"按钮在不在"，少一条就少一个证据）');
  });

  if (V43['README.md'].indexOf('§43') < 0) F43('README.md 的 verify 清单没提 §43（新闸门不写进 README 就等于没装）');

  console.log('排期读数单点闸门: ' + A43.length + ' 条代码锚点（天数一个读法 3 落点 + 起终两行一个出口（endpointRow 定义 + 起 + 终）+ 坐标缺失的同一句真话 3 处 + 头部部件表 3 点 + 环线一个落点（定义 + 5 个入口 + 退单程那一手）+ 定位一条腿（locate 1／调用 1／钮 1／plannerStartFromHere 2）+ 文本框回读 matchKeep 5 处 + 向导读 DOM 单点 2 处 + 第 1 步两条标签口径 + 浏览器腿 6 条脚手架纪律）+ 九族期望 0（预填 5／排期自己解析 DOM／裸 matchStart ×2 侧／state.end = state.start 共享引用／缺省=当前位置那句零调用者的承诺／环线死控件原文／终行局部拼串 lastStop／页内脚手架 window.__）各配正向对照 + 四项内置动态对账（splitIntoDays 调用点 ' + split43.calls + ' 处逐一交代天数口径、非零字面 0 处，判据先自校准；起终点赋值点 ' + ep43.sites + ' 处四种形状、越界 0 处；intentDays 落点 ' + days43.sites + ' 处、越界 0 处；「当前位置」' + cnt43(V43['planner.js'], '当前位置') + ' 处对着 4 条调用者对账）+ 一条自指纪律（flat43/view43 定义行必须走共享剥刀与不剥文档那一支，两处新代码旁各钉一枚现场哨兵）+ 八条浏览器腿形状标签逐条在场；A43 表长 ' + A43.length + ' 条、ZERO43 表长 ' + ZERO43.length + ' 条，抬阈值类变异要取当前长度 + 1；变异自测见 tools/out/mut-verify43.js');
  fail += bad43;
}

/* ============ §44 足迹页底部堆叠与游记卡让位闸门（批次 29） ============
   用户报（2026-10-08 逐字）：「实际情况是点不开，看不全，一是文字只能看固定部分，多出的看不到，照片不显示。」
   四条根因（改前形状在 git HEAD 可查，现场读数在 tools/out/b29-probe-*.txt）：
     R1 遮挡：时间线 bottom 写死 150px，而统计条实测高 94px 且 z 1000 > 900，两者重叠 45px →
        chip 中心 elementFromPoint 命中的是统计条。绑定一直在，只是这一下永远点不到它。
     R2 定高裁切：抽屉写死 212px/485px，#msBody 虽 overflow-y:auto 却零提示 → 正文末行与整条照片行
        都落在卡片可见区之外。用户读到的就是「只能看固定部分」「照片不显示」。
     R3 让位反号：开卡 map.panBy([0,-180],{duration:420}) —— panBy 的符号是「视口往哪走」，负值是把
        正在看的那个点往屏幕「下」推，正好推进卡片里；而 Leaflet 的 duration 单位是「秒」，420＝七分半
        ＝等于没动，所以这个反向位移多年没露馅。topic-common.js 同形一处（[0,-160]），两处一起修。
     R4 自激：改成按实测矩形算的瞬移以后，自己那次 panBy 也会发 moveend 回到同一个函数，残余亚像素经
        Math.round 得 0，而 map.panBy([0,0]) 照样派发 moveend → 同步重入 1253 帧后爆栈，同一步还把
        sheetRaised 抹成 0，关卡就不知道该还多少。
   这一节钉的是：底部那一摞只有一条由实测高写下的基线、卡片只有一个填内容的入口、让位只有一个几何式
   函数且它自己会停手、以及「多出的看不到」必须留出口（纵向 ms-clip、横向 h-clipped 两条提示）。
   收工时闸门自己又逮到第五条（不在用户点单里，也不是我先发现的）：本批把照片排到正文之前那一手，
   动的正是 ms-story 那行的邻居，而那一行自己把闭合标签写成了 '</div' —— 漏掉一个 >。
   node --check 与像素基线都拦不住它（HTML 里少一个 > 不报错，样式照样 paint），
   所以 ②b 那条配平对账钉的是「拼串 + 变量 + 闭合」这一族的形状，先自校准再扫真源。 */
{
  let bad44 = 0;
  const F44 = m => { bad44++; console.log('FAIL §44 足迹页底部堆叠与游记卡让位闸门: ' + m); };
  const ws44 = s => s.replace(/\s+/g, ' ').trim();
  const flat44 = s => ws44(stripBlockComments(s));
  const cnt44 = (s, n) => s.split(n).length - 1;
  const rd44 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view44 = f => /\.md$/.test(f) ? ws44(rd44(f)) : flat44(rd44(f));

  const FILES44 = ['travel-map.html', 'topic-common.js', 'tools/smoke-travelmap.js', 'README.md'];
  const V44 = {};
  FILES44.forEach(f => {
    if (!fs.existsSync(f)) { F44('缺 ' + f); V44[f] = ''; return; }
    V44[f] = view44(f);
  });

  /* ⓪ 自指纪律：flat44 必须走那把共享剥刀。这一节和 §43 不同，**产品文件是 .html**，
        而本批的注释天然要抄改前的原串（[0,-180]、duration:420、150px 都在注释里写着），
        所以 html 这一支也必须剥——不剥的话那几族期望 0 当场读非 0（红，看得见），
        危险方向是反过来的那一支：真代码被当成注释吞掉，住在这一带的期望 0 会静默满足。
        于是两处新代码旁边各钉一枚现场哨兵：读不到＝这一带又变成盲窗。 */
  {
    const DEF44 = (rd44('tools/verify.js').match(/^[ \t]*const flat44 = [^\n]*/m) || [''])[0];
    if (DEF44.indexOf('stripBlockComments') < 0) F44('§44 的 flat44 定义行没走这把共享剥刀（现场读到的那一行：' +
      (DEF44.slice(0, 56) || '整行没数到，连定义都漂了') + '）：注释里抄的改前原串会被当成代码在场');
    const L44 = (rd44('tools/verify.js').match(/^[ \t]*const view44 = [^\n]*/m) || [''])[0];
    if (L44.indexOf('.md$') < 0) F44('view44 的定义行退回「文档也剥注释」那一支（现场读到的那一行：' + (L44.slice(0, 60) || '整行没数到') + '）：README 的登记串里天生要写 glob 形状，文档侧的锚会当场读 0');
    ["if(dy>=1){", "tl.style.setProperty('--tm-gap'"].forEach(function (mk) {
      if (V44['travel-map.html'].indexOf(mk) < 0) F44('盲区哨兵：「' + mk + '」在 flat 里读不到了（这两行各自贴着一大段解释改前形状的注释；读不到＝这一带又变成盲窗，住在里面的期望 0 那一族会静默满足）');
    });
  }

  /* ① 正向锚点：一条基线 / 一个填内容入口 / 一个会自己停手的让位函数 / 两条「还有下文」的出口 */
  const A44 = [
    ['travel-map.html', ':root{--map-stack-bottom:104px}', 1, '底部那一摞只有一条基线，CSS 里这个数只是 JS 前的兜底（改前是时间线 150、圆钮 150、卡片 212 三个各写各的硬编码数，统计条一撑高就把时间线整条压在下面）'],
    ['travel-map.html', "tl.style.setProperty('--tm-gap',(h?Math.round(h)+8:0)+'px');", 1, '档位由实测高现算现写；把这一行改回常数，R1 那一族重叠会原样回来'],
    ['travel-map.html', "[document.getElementById('statBar'),document.getElementById('statOpen')].forEach(function(el){", 1, '两态都要量：统计条收起后原位换成那枚 44px 圆钮，只量 statBar 会让胶囊压到钮上'],
    ['travel-map.html', "if(el && getComputedStyle(el).display!=='none') h=Math.max(h, el.offsetHeight);", 1, '取两态里的较大者（display:none 的那一枚不参与）'],
    ['travel-map.html', 'function layoutBottomStack(){', 1, '底部堆叠的几何单点：只有这一处算档位'],
    ['travel-map.html', 'layoutBottomStack();', 4, '四个落点：首屏、填完胶囊、统计条收起、统计条展开——少一个就是有一处状态变化没人重算'],
    ['travel-map.html', 'bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom) + var(--tm-gap,102px));', 1, '时间线坐在「基线 + 实测档」之上，而不是坐在某个猜的数上'],
    ['travel-map.html', '.tl-chip .tl-name{', 1, '胶囊上要有地点名：改前只有时间戳，读起来像坐标轴刻度，没人预期它可点'],
    ['travel-map.html', 'display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;', 1, '胶囊自己那一行要有 44 这个数（改前那一行根本没有 min-height，只靠 padding:9px 撑出 35）：这一排的可点高度实际由三条机制一起撑——这行声明（非 Chromium 内核那一级）、同排 .tl-trip 经默认 stretch 传下来的一级、BUTTON 让 Chromium 扣的内部 44px 下限（探针 tools/out/probe29-chiph3.txt），剪掉任意一条另两条还顶着，所以 TM04 量真实矩形那条腿不能撤'],
    ['travel-map.html', "nv.className='tl-name'", 1, '名字那一枚 span 的造法'],
    ['travel-map.html', "chip.setAttribute('aria-label','这一篇：'", 1, '可达口径同样写着「这一篇」，读屏的人才知道点开的是内容不是刻度'],
    ['travel-map.html', 'function clearSheetCenter(){', 1, '让位只有一个几何式函数（改前是两个：panSheetBy(h,up) 加两处调用点各抄一遍位移）'],
    ['travel-map.html', 'if(band<120) return;', 1, '卡片快占满屏时上面根本没地方看，挪了白挪——长正文那档（卡 593、只剩 26px）就是这一条让地图一动不动'],
    ['travel-map.html', 'if(dy>=1){ sheetRaised=Math.round(dy); map.panBy([0,sheetRaised],{animate:false}); }', 1, 'R4 的原件：门坎不足 1px 就不发这次瞬移。发出去的那一次自己也会发 moveend，残余 0.4px 经 Math.round 得 0，而 panBy([0,0]) 照样派发 moveend → 同步自激 1253 帧爆栈'],
    ['travel-map.html', 'var sheetFocus=null,sheetRaised=0;', 1, '抬升量要记账，关卡才知道还多少（R4 同一步曾经把 sheetRaised 抹成 0，TM27 抓到过）'],
    ['travel-map.html', 'function restoreSheetCenter(){', 1, '关卡原样还，不做第二次'],
    ['travel-map.html', 'if(map&&sheetRaised) map.panBy([0,-sheetRaised],{animate:false});', 1, '还的是记账那个数，不是又一个硬编码位移'],
    ['travel-map.html', 'function onSheetMoveEnd(){ clearSheetCenter(); }', 1, 'flyTo 落定后补一次（点胶囊那条路径：80ms 时视图还在飞，第一次量的是半途）'],
    ['travel-map.html', "map.on('moveend',onSheetMoveEnd);", 1, '挂点只在开卡那一条腿上'],
    ['travel-map.html', "map.off('moveend',onSheetMoveEnd);", 1, '关卡必须摘掉：不摘的话卡关了之后每次平移地图都会自己找一次那个已经不存在的落点'],
    ['travel-map.html', 'function fillSheet(html,label,focus){', 1, '抽屉填内容的单点：改前聚合列表与单篇两处各写一遍 innerHTML+open，让位/提示那条腿只有一条上有'],
    ['travel-map.html', 'sheetFocus=focus||null;', 1, '落点跟着这一篇走'],
    ['travel-map.html', 'if(was){ markClip(); if(pr) markHClip(pr); return; }', 1, '已经开着再填一次＝只换内容，地图不许挪第二回'],
    ['travel-map.html', "#memSheet.ms-clip::after{content:'↑ 上滑看全文'", 1, 'R2 的出口：定高容器必须让「下面还有」看得见'],
    ['travel-map.html', "s.classList.toggle('ms-clip',over>8&&b.scrollTop<over-8);", 1, '提示随 scrollTop 生灭（滚到底就该自己收，没有下文还挂着是撒谎）'],
    ['travel-map.html', "el.classList.toggle('h-clipped', el.scrollLeft + el.clientWidth < el.scrollWidth - 8);", 1, '横向那一族（底部胶囊排／卡内照片排）同一条口径：328 真机档上常常只露一枚，右边那些既不滚动也看不见'],
    ['travel-map.html', '.h-clipped{-webkit-mask-image:linear-gradient(to right,#000 0,#000 calc(100% - 30px),transparent);mask-image:', 1, '渐隐用 mask 不用底色，免得在毛玻璃卡上压出一条「脏」带子（§23 那把刀的口径）'],
    ['travel-map.html', 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;-webkit-overflow-scrolling:touch;', 1, '那一排不许自己写 align-items：两排的高度一致是 flex 默认 stretch 从同排 .tl-trip（min-height:44px）传下来的，写成 flex-start 就把这条隐式依赖剪断（实测：与「换成分片 + min-height 35」一起退化时 TM04 当场读到 35/35/35，读数 tools/out/g02b-smoke.txt）'],
    ['travel-map.html', 'max-height:calc(100dvh - env(safe-area-inset-bottom,0px) - var(--map-stack-bottom) - 26px)', 1, '卡片高度跟着可视区走；改前写死 485，正文末行 top=699 落在可见底 511 之外'],
    ['topic-common.js', 'function locSheetClear() {', 1, '专题地图那一站的详情卡同形缺陷（改前 map.panBy([0,-160],{duration:420})），与本节同一把几何尺'],
    ['topic-common.js', 'if (band < 120) return;', 1, '守卫两支都要在：travel-map 那支刚修过，这一支不许单独退回去'],
    ['topic-common.js', 'if (dy >= 1) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { animate: false }); }', 1, 'R4 的第二次发作在另一份文件里也要钉住：门坎不足 1px 就不发'],
    ['topic-common.js', 'setTimeout(locSheetClear, 80);', 1, '开卡后按实测算，不在 CSS 里猜卡片高度'],
    ['topic-common.js', 'if (map && sheetRaised) map.panBy([0, -sheetRaised], { animate: false });', 1, '关卡按记账的数原样还'],
    ['tools/smoke-travelmap.js', 'if (pan.length > 40) return map;', 1, '浏览器腿自己的刀断：被测形状一旦自激，闸门不许跟着爆栈（不然 TM34 之外还会连带红一串）'],
    ['tools/smoke-travelmap.js', 'MID.openPans.length === 1 && MID.openPans[0] >= 1 && MID.closePans.length === 1 && MID.closePans[0] <= -1', 1, '一次开卡只挪一次、关卡只还一次、不许零位移——R4 的直接判据'],
    ['travel-map.html', '.leaflet-container .leaflet-control-attribution{background:var(--paper-bar);color:var(--ink-500)}', 1, '版权条这一层要带上 .leaflet-container 那一级才赢得了 vendor（leaflet.css:413 是两级类，页内单类写了一辈子没生效过，见探针 tools/out/b29-probe-attribution2.txt）'],
    ['tools/smoke-travelmap.js', 'const norm = v => {', 1, 'hex↔rgb 换算：token 是 #FAF8F3 而 computed 是 rgb(...)，不换算 TM36 永远红——假红与假绿一样没人看，但它是那条判据能跑起来的前提'],
    ['travel-map.html', "'<div class=\"ms-story\">'+story+'</div>':'')", 1, '正文那一段的闭合标签：本批把照片排到正文之前时，动的就是这一行的 neighbours，而它自己差点少了个 >（§42 那一族「漏收尾 >」在拼串侧的第二次发作，见 ②b 的配平对账）'],
    ['travel-map.html', "window.addEventListener('resize',layoutBottomStack);", 1, '四个落点之外还有第五层：窗口本身变了形（转屏、分屏、键盘弹出）也得重排——实测高的定义域就是窗口，不是那四个按钮'],
    ['tools/smoke-travelmap.js', 'const VW = 328, VH = 723;', 1, '浏览器腿量的必须是用户那块屏（§37 把主档从 452×995 改判成 328×723）：档位挪回 452，TM08/TM29/TM31 那几条「右边被切掉」的判据就都在一块不存在的屏上测']
  ];
  A44.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {
      F44('A44 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V44)) { F44('A44 登记了 §44 没读的文件「' + f + '」：' + why); return; }
    const n = cnt44(V44[f], needle);
    if (n !== exp) F44(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* ② 期望 0：改前的四条形状，各配一条正向对照（上面那个 0 不是证据，除非同一把刀能在合成源上读出 1） */
  const ZERO44 = [
    ['travel-map.html', 'bottom:calc(env(safe-area-inset-bottom,0px) + 150px);',
      "#mmTimeline{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:900}",
      '时间线又回去坐在那个没人量过的 150px 上（R1 的原件：统计条实测 94px、z 1000 > 900，重叠 45px）'],
    ['travel-map.html', 'bottom:calc(env(safe-area-inset-bottom,0px) + 212px);',
      "#memSheet{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 212px);max-height:calc(100dvh - 212px - 26px)}",
      '卡片又回去坐在写死的 212px 上：那一档的算法与统计条实测高无关，撑高一次就压住一次'],
    ['travel-map.html', 'max-height:calc(100dvh - 212px - 26px)',
      "#memSheet{max-height:calc(100dvh - 212px - 26px);display:flex}",
      '卡片最大高又不认可视区了（R2 的原件：长正文那条末行 top=699 落在可见底 511 之外，照片行 577..721 整条在外面）'],
    ['travel-map.html', 'map.panBy([0,-180],{duration:420});',
      "function openMemSheet(){ setTimeout(function(){map.panBy([0,-180],{duration:420});},80); }",
      '开卡又把那个点往卡片底下推（panBy 的负值是视口往下走，不是内容往上走），而且 420 的单位是秒＝等于没动'],
    ['travel-map.html', 'map.panBy([0,180],{duration:420});',
      "function closeMemSheet(){ if(map) setTimeout(function(){map.panBy([0,180],{duration:420});},80); }",
      '关卡改回「还一个猜的数」：挪多少与还多少一旦不是同一笔账，地图就一路漂移'],
    ['travel-map.html', 'sheetHeight(', 'var sh = function sheetHeight(){ return 485; };',
      '那个按硬编码算位移的助手又回来了：位移该由卡片上沿的实测矩形算，不该由某个人的估计算'],
    ['travel-map.html', 'panSheetBy', 'function panSheetBy(h, up) { map.panBy([0, up ? -180 : 180]); }',
      '让位又拆成「算高」＋「两处调用各抄一遍」两条腿：R3 的反号就是在这种形状里活了多年的'],
    ['travel-map.html', 'var(--glass-sheet) 62%)',
      "#memSheet.ms-clip::after{background:linear-gradient(to bottom,transparent,var(--glass-sheet) 62%)}",
      '渐隐条压在毛玻璃 token 上＝§23 那把刀抓过的那次「那是脏不是毛玻璃」；实心纸用 --paper-50（它就是 --glass-sheet 的实心孪生）'],
    ['topic-common.js', 'map.panBy([0, -160], { duration: 420 });',
      "function openSheet(i) { setTimeout(function () { map.panBy([0, -160], { duration: 420 }); }, 80); }",
      '专题地图那一支的反号写法回来了（与 travel-map 同形，两处是一起修的，不许修一处留一处）'],
    ['topic-common.js', 'map.panBy([0, 160], { duration: 420 });',
      "function closeSheet() { if (map) setTimeout(function () { map.panBy([0, 160], { duration: 420 }); }, 80); }",
      '关卡那个猜的数回来了：这一支也没有记账'],
    ['topic-common.js', '{ duration: .52 }', "map.panBy([0, 40], { duration: .52 });",
      '带 duration 的平移会被同一条路径上先起的 flyTo 逐帧重设视图吞掉（探针实测位移被吞光），让位一律瞬移'],
    ['travel-map.html', 'margin-bottom:calc(env(safe-area-inset-bottom,0px) + 94px)',
      "  .leaflet-control-attribution{margin-bottom:calc(env(safe-area-inset-bottom,0px) + 94px)}",
      '那个 94 是「猜统计条有多高」的第三个数（R1 同一族），而且实测一辈子没生效：vendor 的 .leaflet-container .leaflet-control-attribution{margin:0} 是两级类，页内单类打不过它（探针 b29-probe-attribution2.txt 三档 computed margin-bottom 恒 0px）'],
    ['travel-map.html', '.leaflet-control-attribution{background:rgba(246,241,229,.75)',
      "  .leaflet-control-attribution{background:rgba(246,241,229,.75);color:var(--ink-500)}",
      '单类写底色＝写了不生效，屏幕上一直是 Leaflet 自己的白底；改这层要连 .leaflet-container 一起写（TM36 读 computed 才看得见这件事）'],
    ['travel-map.html', '.theme-dark .leaflet-control-attribution{background:',
      "  .theme-dark .leaflet-control-attribution{background:rgba(29,28,25,.8);color:var(--color-muted)}",
      '底色不该按主题各抄一份：--paper-bar / --ink-500 自己随主题翻。正是那份「只有暗色写对了」让亮色的白底活了多年没人发现'],
    ['travel-map.html', 'flex:none;padding:9px 14px;border-radius:999px;',
      "  .tl-chip{\n    flex:none;padding:9px 14px;border-radius:999px;\n    background:var(--paper-bar);\n  }",
      '胶囊又回去只靠 padding 撑高（改前那一行根本没有 min-height，TM04 量到的 35/35/35 就是这么来的）：这一排的可点高度要有自己的声明，不能只靠内核下限与同排 stretch 传下来的高度'],
  ];
  ZERO44.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {
      F44('ZERO44 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V44)) { F44('ZERO44 登记了 §44 没读的文件「' + f + '」：' + why); return; }
    if (cnt44(V44[f], needle) !== 0) F44(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt44(flat44(ctrl), needle) < 1) F44('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ②b 拼串的闭合配平（§42 那一族「漏收尾 >」的第二次发作，只不过这次漏在闭合标签上）：
        本批把照片排到正文之前，动的就是 ms-story 那行的邻居，而这一行自己少了个 > ——
        浏览器把后面整段并进这个 div 里，页面上「看着还行」，正文与音频/标签的容器就错了。
        先自校准（同一把刀必须能在改前原件上读出 1、在改后形状上读出 0），再扫真源。
        现场标定见探针 tools/out/probe44-div-balance.js。 */
  {
    const Q44 = String.fromCharCode(39);
    const RX44 = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>'\s*\+\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\[[^\]]*\])?\s*\+\s*'\/\1'(?![>])/g;
    const BAD44 = "+(story?" + Q44 + '<div class="ms-story">' + Q44 + "+story+" + Q44 + "/div" + Q44 + ":" + Q44 + Q44 + ")";
    const GOOD44 = "+(story?" + Q44 + '<div class="ms-story">' + Q44 + "+story+" + Q44 + "/div>" + Q44 + ":" + Q44 + Q44 + ")";
    const cb = (BAD44.match(RX44) || []).length, cg = (GOOD44.match(RX44) || []).length;
    if (cb !== 1 || cg !== 0) F44('§44 的闭合配平正则自己失准（坏串应命中 1、好串应命中 0，实得 ' + cb + '/' + cg + '）：那个「全树 0」不是证据，是这把刀瞎了');
    ['travel-map.html', 'topic-common.js'].forEach(function (f) {
      const hits = (rd44(f).match(RX44) || []);
      if (hits.length) F44(f + ' 有 ' + hits.length + ' 处拼串的闭合标签漏了收尾 >（' +
        hits.map(h => JSON.stringify(h.slice(0, 56))).join(' ｜ ') + '）：§42 钉的是开标签漏 >，这是同一族病在闭合侧——「<div …> 开、+</div 没关」后面整段会被并进这个容器');
    });
  }

  /* ③ 内置动态对账一：底部那些坐在基线上的层，每一层的 bottom 只许认那条变量。
        逐行扫原文（这一条要看的是「有没有第四种写法」，不能只数总数）。
        注释里提到 `bottom:calc(` 的行会被一起扫到，那是故意的宽口径：期望 0 那一族走 flat（剥注释），
        对账走原文；多扫到的行只要含基线就不红，真出现「含 bottom:calc( 又不含基线」的注释行也正好要人看一眼。 */
  const SCAN44 = src => {
    const r = { sites: 0, out: [] };
    src.split('\n').forEach(function (ln, i) {
      if (ln.indexOf('bottom:calc(') < 0) return;
      r.sites++;
      if (ln.indexOf('var(--map-stack-bottom)') < 0) r.out.push('第 ' + (i + 1) + ' 行  ' + ws44(ln).slice(0, 96));
    });
    return r;
  };
  let BT44 = { sites: 0, out: [] };
  {
    const CAL = SCAN44('#a{bottom:calc(env(safe-area-inset-bottom,0px) + 150px)}\n#b{bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom))}');
    if (CAL.sites !== 2 || CAL.out.length !== 1 || CAL.out[0].indexOf('150px') < 0) F44('§44 的 bottom:calc 扫描器自己失准（合成两行应读到 sites=2／越界 1 且是 150px 那一行，实得 sites=' + CAL.sites + ' 越界=' + JSON.stringify(CAL.out) + '）：扫描器红了，下面那条真读数不可信');
    BT44 = SCAN44(rd44('travel-map.html'));
    if (BT44.out.length || BT44.sites < 3) F44('坐在基线外的 bottom:calc 对账失效（实测 ' + BT44.sites + ' 行、越界 ' + BT44.out.length + ' 行：' + BT44.out.join(' ｜ ') + '）——R1 的原件正是「两个各写各的硬编码数」，这一条断了就等于没人守');
  }

  /* ④ 内置动态对账二：让位这笔账只走一处抬、一处还，全站不许有第三处 map.panBy */
  {
    const n = cnt44(V44['travel-map.html'], 'map.panBy(');
    if (n !== 2) F44('travel-map.html 里 map.panBy( 从 2 处变成 ' + n + ' 处：抬与还是同一笔账的两半（sheetRaised 记一次、还一次）。多出来的那一处要现场看过它挪的是谁、有没有跟着 moveend 回来自己——R4 那次自激就住在「第二个挪地图的人」身上');
    const t = cnt44(V44['topic-common.js'], 'map.panBy(');
    if (t !== 3) F44('topic-common.js 里 map.panBy( 从 3 处变成 ' + t + ' 处（§34 的 raiseCenterClear + 本节的抬与还）：新增一处要先说清它守的是哪个落点，别又留一个猜的数');
  }

  /* ⑤ 浏览器腿齐备检：TM01–TM37 逐条在场（少一条就少一个证据），条数守卫的阈值也要钉住 */
  {
    const S44 = V44['tools/smoke-travelmap.js'];
    for (let i = 1; i <= 37; i++) {
      const lab = "ok('TM" + (i < 10 ? '0' + i : '' + i) + ' ';
      if (cnt44(S44, lab) !== 1) F44('tools/smoke-travelmap.js 里 TM' + (i < 10 ? '0' + i : i) + ' 这条判据不是恰 1 处（实得 ' + cnt44(S44, lab) + '）：这一节的立论是「实测矩形 + 真点命中」，删一条就少一个证据，改编号会让 §44 的齐备检集体失效');
    }
    /* TM36b 是从 TM36 里分出来的第二条：底色对了但被某一摞盖住，署名照样读不到——两件事各一条，别并成一条含糊的 */
    if (cnt44(S44, "ok('TM36b") !== 1) F44('TM36b「版权条命中自己」不在场：TM36 只证明底色换了，不证明那行字露得到（R1 的教训就是「绑定在场 ≠ 命中得到」）');
    if (cnt44(S44, 'checks >= 37') !== 1) F44('条数守卫（本闸门自己也会被删）不在了或阈值被挪：判据是 38 条，而 ok() 在自增前求值，所以表达式写的是 checks >= 37');
    /* 齐备检自己也要有第二条腿：上面那个循环上限是个写死的数，把它从 37 收到 30 不会让任何一条红（少守 7 条）。
       所以拿 smoke 里真实存在的最大编号来对账——不抄常量，表长变了它自己跟着走。 */
    {
      const LAB = S44.match(/ok\('(TM\d+)[ ]/g) || [];
      const MAXN = LAB.reduce((m, s) => Math.max(m, Number(/TM(\d+)/.exec(s)[1])), 0);
      const SEG = (rd44('tools/verify.js').split('⑤ 浏览器腿齐备检')[1] || '');
      const BOUND = (SEG.match(/for \(let i = 1; i <= (\d+); i\+\+\)/) || [])[1];
      if (BOUND === undefined) F44('读不到 ⑤ 那条齐备检的循环上限（正则没命中＝那一行被改写形状了，这条对账当场失明）');
      else if (Number(BOUND) !== MAXN) F44('⑤ 齐备检的循环上限是 ' + BOUND + '，而 smoke-travelmap 里真实最大编号是 TM' + MAXN + '：上限比编号小＝有几条判据没人守（收窄一格就少守一条，而且它自己永远不会红）');
    }
  }

  if (V44['README.md'].indexOf('§44') < 0) F44('README.md 的 verify 清单没提 §44（新闸门不写进 README 就等于没装）');

  console.log('足迹页底部堆叠与让位闸门: ' + A44.length + ' 条代码锚点（一条基线 + 实测档位单点 + 两态都量 + 四个落点 + resize 那一层（窗口自己变形也得重排）+ 胶囊带地点名与 aria 同句 + 让位一个几何函数（band<120 守卫 / dy>=1 门坎 / 记账 / flyTo 落定补一次 / 挂与摘成对）+ 填内容一个入口（已开着只换内容）+ 两条「还有下文」的出口（ms-clip 随 scrollTop 生灭、h-clipped 用 mask）+ 那一排不写 align-items（44px 的一致高度是默认 stretch 从同排 .tl-trip 传下来的隐式依赖）+ 胶囊自己那行要有 min-height 声明（这排的可点高度实际由三条机制一起撑：这行声明、同排 stretch、BUTTON 让 Chromium 扣的内部 44px 下限——锚只钉得住声明那一层，几何那条腿是 TM04）+ 卡片高认可视区 + 专题地图那一支同形的四件 + 版权条那层要带 .leaflet-container 才赢得过 vendor + 浏览器腿四条脚手架纪律（刀断 / 只挪一次 / hex↔rgb 换算 / 真机档 328×723））+ 十五族期望 0（时间线 150／卡片 212／卡片 max-height 不认可视区／开卡反号 [0,-180]／关卡猜数 [0,180]／sheetHeight 硬编码助手／panSheetBy 两条腿／渐隐条压毛玻璃 token／专题两支的 -160 与 +160／带 duration 的平移／版权条那 94px／单类写的底色／按主题各抄一份的底色／胶囊只靠 padding 撑高（改前那一行根本没有 min-height））各配正向对照 + 三项内置动态对账（坐在基线外的 bottom:calc 逐行扫原文：' + BT44.sites + ' 行含它、越界 ' + BT44.out.length + ' 行，扫描器先拿合成两行自校准；map.panBy( 两支各 2／3 处，抬与还同一笔账；拼串闭合配平先拿改前原件自校准（坏 1／好 0）再扫两支真源，实得越界 0 处）+ 一条自指纪律（flat44/view44 定义行必须走共享剥刀与不剥文档那一支，两处贴着长注释的新代码旁各钉一枚现场哨兵）+ 浏览器腿 TM01–TM37 齐备检（TM36b 单列一条）与条数守卫；A44 表长 ' + A44.length + ' 条、ZERO44 表长 ' + ZERO44.length + ' 条，抬阈值类变异要取当前长度 + 1；变异自测见 tools/out/mut-verify44.js');
  fail += bad44;
}


/* ============ §45 卡面裸经纬度闸门（批次 30-A） ============
   用户点单（2026-10-08，选择题答复逐字）：「经纬度那一串（S1-2）在界面上怎么处置？」→「卡面删掉」。
   同一题里另一支口径同样是指令：「界面卡面只留地点名；复制/分享文本与带『坐标』标签的管理/导出元信息行保留」。
   所以这一节两条腿都要有：正向锚钉「该留的还留着」，期望 0 那一族钉「卡面那串真没了」。
   只钉一支的闸门会鼓励下一刀砍过头——把 toFixed 全删干净，源码更清爽，而「地点」计数变成「每篇一个地点」、
   复制出来的文本少一行、开卡后地图不知道该把哪儿抬进可视带。

   这一族的历史（本节的条数为什么是这个形状）：
     ① 我最初报「6 个显示点」，实测 8 处；这一节开工前又扫出 node-manager.html 两处详情面板 + 一处添加地点弹窗，
        合计 11 处。前两次漏的根因相同：窄文件名单 + 窄模式——`(+s.lat).toFixed(5)` 带括号那种形状，
        要求 lat 紧接 toFixed 的 grep 数不到。所以 ③ 那一条动态扫描器一律走 readdirSync('.') 全量，不抄名单。
     ② node-manager 那两处按用户的口径属于「管理面」，坐标在那里是有用的元信息，缺的是「这串数字是什么」的交代，
        不是数字本身；于是本批给它们补了「坐标 ·」前缀，与 md-manager 的 rows.push(['坐标', …])、
        vault.js 导出文档的 <p class="meta">坐标 · … 同族。弹窗那一处（添加/编辑地点）本来就有 pin 图标与
        「高德坐标」注记，是这一行的功能主体，原样保留。
     ③ travel-notes.js 地图 popup 那一行原本还把 n.style 直接拼进 HTML（未转义），删坐标时顺手补上 esc()。 */
{
  let bad45 = 0;
  const F45 = m => { bad45++; console.log('FAIL §45 卡面裸经纬度闸门: ' + m); };
  const ws45 = s => s.replace(/\s+/g, ' ').trim();
  const flat45 = s => ws45(stripBlockComments(s));
  const cnt45 = (s, n) => s.split(n).length - 1;
  const rd45 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view45 = f => /\.md$/.test(f) ? ws45(rd45(f)) : flat45(rd45(f));

  const FILES45 = ['results.js', 'review.html', 'travel-notes.js', 'travel-map.html', 'topic-common.js',
    'node-manager.html', 'md-manager.html', 'vault.js', 'tools/smoke-coord.js', 'README.md'];
  const V45 = {};
  FILES45.forEach(f => {
    if (!fs.existsSync(f)) { F45('缺 ' + f); V45[f] = ''; return; }
    V45[f] = view45(f);
  });

  /* ⓪ 自指纪律：读源码这件事自己先自校准。
        本节的改前原串天然要在注释与表里抄一遍，产品文件里又有 .html（页内 <style>/<script> 带 /* *\/ 注释），
        所以 html 这一支必须剥——不剥的话「期望 0」会被注释里的登记串读成非 0（红，看得见）；
        危险方向是反过来的那一支：真代码被当成注释吞掉，住在这一带的期望 0 会静默满足。
        于是两处改动旁边各钉一枚现场哨兵：读不到＝这一带又变成盲窗。 */
  {
    const DEF45 = (rd45('tools/verify.js').match(/^[ \t]*const flat45 = [^\n]*/m) || [''])[0];
    if (DEF45.indexOf('stripBlockComments') < 0) F45('§45 的 flat45 定义行没走那把共享剥刀（现场读到的那一行：' +
      (DEF45.slice(0, 56) || '整行没数到，连定义都漂了') + '）：注释里抄的改前原串会被当成代码在场');
    const L45 = (rd45('tools/verify.js').match(/^[ \t]*const view45 = [^\n]*/m) || [''])[0];
    if (L45.indexOf('.md$') < 0) F45('view45 的定义行退回「文档也剥注释」那一支（现场读到的那一行：' + (L45.slice(0, 60) || '整行没数到') + '）：README 的登记串里天生要写这族的形状，文档侧的锚会当场读 0');
    [['travel-notes.js', "it.querySelector('[data-a=copy]').onclick"], ['travel-map.html', "fillSheet('<div class=\"ms-place\">'"]].forEach(function (p) {
      if (V45[p[0]].indexOf(p[1]) < 0) F45('盲区哨兵：「' + p[1] + '」在 flat 里读不到了（它就贴在' + p[0] + ' 本批改掉的那几行旁边；读不到＝这一带又变成盲窗，住在里面的期望 0 那一族会静默满足）');
    });
  }

  /* ① 正向锚点：改后的卡面形状 + 三处「坐标是功能不是装饰」的保留点 */
  const A45 = [
    ['results.js', "+ '<div class=\"m\">' + esc(TravelNotes.dayText(n)) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'", 1, '纪念册卡片那一行只有日期与天气（改前尾巴上还挂着「 · 39.5606, 114.0862」）；日期那一格从裸读 n.date 换成 §41 显示单点（批次 31-A），锚串跟着改——这一支不许退回 esc(n.date)，那对 2026.10.08／2026年10月8日 都不产生统一读数'],
    ['review.html', "'<div class=\"meta\">'+esc(dayOf(n))+(n.weather?' · '+esc(n.weather):'')+'</div>'", 1, 'review 日卡的 .meta 同形状（改前那一串挤在同一行末尾，读起来像调试输出）；dayOf 是本页对 TravelNotes.noteDay 的既有包装，日期仍只有一个来源'],
    ['travel-notes.js', "'</h4><div class=\"tm\">' + esc(dayText(n)) + '</div><div class=\"tx\">'", 1, '随手记列表卡（renderItem 两个视图共用）：这一行改前还带着「 · 」与那串数，坐标没了之后那个悬空的连接符也要一起走；日期读 dayText 单点'],
    ['travel-notes.js', "'<div style=\"color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px\">' + esc(dayText(n)) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'", 1, '导出文档的卡面同一口径（这一处是「文档」，用户没让它带坐标；带坐标的是 vault.js 那条明写「坐标 ·」的元信息行）'],
    ['travel-notes.js', 'ctx.fillText(dayText(n), 70, 285);', 1, '海报 canvas 那行只写日期：siteName 在它上面几行已单独绘制，画布上那串数是噪声'],
    ['travel-notes.js', "(n.style ? '<div style=\"color:#6b665c;font-size:var(--fs-2);margin-top:6px\">' + esc(n.style) + '</div>' : '')", 1, '地图 popup 的尾行现在是风格而不是坐标；这一串同时钉住 esc(n.style)——改前那里是裸拼的 n.style，删坐标时顺手补的转义不许退回去'],
    ['travel-notes.js', "var txt = (n.title || n.siteName || '游记') + '\\n' + dayText(n) + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '')", 1, '复制/分享那条文本仍带坐标（用户口径里明写的保留支；浏览器腿 CO07 真点一次复制读回来）；日期段改读 dayText 后，那串坐标必须还在——这一支不是卡面'],
    ['travel-map.html', "fillSheet('<div class=\"ms-place\">'+place+'</div>'", 2, '两处填内容入口（聚合列表与单篇）都只写地点名——只钉一处等于另一处没人守'],
    ['travel-map.html', "if(map) map.flyTo(gxy(n.lat,n.lng)", 2, '坐标换成定位还在用（胶囊那条路径与列表点开那条路径）：删的是读数，不是那个点'],
    ['topic-common.js', '<b>途经点随手记</b><div class="pm pa">', 1, '专题地图途经点 popup：改前那里是 <div class="pm">lat, lng</div>，一句话的说明被坐标挤到下一档'],
    ['node-manager.html', "'<div class=\"is-coord\">坐标 · ' + (+s.lat).toFixed(5)", 1, '系统地点详情面板：管理面保留那串数，但必须交代它是什么（本批补的前缀）'],
    ['node-manager.html', "'<div class=\"is-coord\">坐标 · ' + (+u.lat).toFixed(5)", 1, '自建地点详情面板同一口径（两支一起改，不许修一处留一处）'],
    ['node-manager.html', "'<div class=\"nm-coord\" style=\"margin-bottom:6px\">'+TI('pin', 12)", 1, '添加/编辑地点弹窗那一处原样保留：那行右边就贴着「移动位置 ›」，坐标是这一行的主体而不是噪声'],
    ['md-manager.html', "rows.push(['坐标', n.lat.toFixed(4) + ', ' + n.lng.toFixed(4)]);", 1, '数据管理表的元信息行（带「坐标」这一列名），口径里明写的保留支'],
    ['vault.js', "'<p class=\"meta\">坐标 · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</p>'", 1, '导出 Markdown 的元信息行同一支'],
    ['tools/smoke-coord.js', 'const VW = 328, VH = 723;', 1, '浏览器腿量的必须是用户那块屏（§37 口径）：档位挪回 452，CO11 那条「那个点要落在卡片之上」就落在一块不存在的屏上测'],
    ['tools/smoke-coord.js', "document.getElementById('tnViewTime')", 1, '时间视图那一支的切换动作在场：renderItem 是两个视图共用的，只验聚合那一支＝另一支没人守（本批六条红就是这么来的）'],
    ['tools/smoke-coord.js', "document.querySelector('#tnListBody .tn-trip-head')", 1, '旅程卡默认折叠，不真点展开就读到 0 张卡：判据会绿得毫无意义（空跑）'],
  ];
  A45.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {
      F45('A45 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V45)) { F45('A45 登记了 §45 没读的文件「' + f + '」：' + why); return; }
    const n = cnt45(V45[f], needle);
    if (n !== exp) F45(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* ② 期望 0：本批删掉的十处形状，各配一条正向对照（那个 0 不是证据，除非同一把刀能在原件上读出 1）。
        串取自 git HEAD 的对应行（tools/out/probe45-anchor-preflight.js 逐条对过：现 0／HEAD 1）。 */
  const ZERO45 = [
    ['results.js', "+ '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>'",
      "var h='<div class=\"card\">' + '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>' + '</div>';",
      '纪念册卡面又把那串数接在天气后面（用户报的 S1-2 原件之一）'],
    ['review.html', "'<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+(n.lat!=null?' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4):'')+'</div>'",
      "return '<div class=\"md-item\"><h3>'+esc(n.title)+'</h3>'+'<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+(n.lat!=null?' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4):'')+'</div>'+'</div>';",
      'review 日卡同形回归：这一页在手机上是要给人看的，不是给调试用的'],
    ['travel-notes.js', "'</h4><div class=\"tm\">' + esc(n.date) + ' · ' + (n.lat != null ? '' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div><div class=\"tx\">'",
      "it.innerHTML = '<h4>' + esc(n.title) + '</h4><div class=\"tm\">' + esc(n.date) + ' · ' + (n.lat != null ? '' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div><div class=\"tx\">' + '</div>';",
      '列表卡 .tm 又回去写那串数（注意改前还有个悬空的 \' · \'：坐标缺失的记录只剩一个点）'],
    ['travel-notes.js', "'<div style=\"color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) : '') + '</div>'",
      "cards += '<div class=\"card\">' + '<div style=\"color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) : '') + '</div>' + '</div>';",
      '导出文档的卡面回到 5 位小数（这一族三处各写各的位数：4 位、5 位、4 位，本来就是没人对账的结果）'],
    ['travel-notes.js', "ctx.fillText(n.date + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : ''), 70, 285);",
      "ctx.fillText(n.date + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : ''), 70, 285);",
      '海报那行又把坐标画在日期后面：分享出去的图上多一串没人读的数'],
    ['travel-notes.js', "'</div><div style=\"color:#6b665c;font-size:var(--fs-2);margin-top:6px\">' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) + (n.style ? ' · ' + n.style : '') + '</div></div>'",
      "m.bindPopup('<div>' + esc(n.text) + '</div><div style=\"color:#6b665c;font-size:var(--fs-2);margin-top:6px\">' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) + (n.style ? ' · ' + n.style : '') + '</div></div>');",
      '地图 popup 的尾行回到坐标——那串数在 popup 里既不复制也不可点，纯噪声'],
    ['travel-map.html', "const locHtml=n.lat!=null?'<div class=\"ms-loc\">'+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>':'';",
      "function openMemSheet(n){ const locHtml=n.lat!=null?'<div class=\"ms-loc\">'+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>':''; fillSheet(locHtml); }",
      '抽屉里那行专门的坐标 div 回来了（批次 29 之后 .ms-loc 那条 CSS 已删，这一行会裸着渲染成一串无样式数字）'],
    ['travel-map.html', '+locHtml',
      "fillSheet('<div class=\"ms-place\">'+place+'</div>'+locHtml+'<div class=\"ms-time\">'+time+'</div>');",
      '拼串里还挂着那个变量：即使 locHtml 的定义被删干净，这一行会当场抛 ReferenceError，抽屉整块开不起来'],
    ['travel-map.html', '.ms-loc{',
      "  .ms-loc{margin-top:3px;font-size:var(--fs-2);color:var(--color-muted)}",
      '死规则又被写回来：落点已经不存在，留着它的后果是下一个人以为那行还该有内容'],
    ['topic-common.js', '<div class="pm">\' + lat.toFixed(5) + \', \' + lng.toFixed(5) + \'</div><div class="pm pa">',
      "m.bindPopup('<div class=\"pop\"><b>途经点随手记</b><div class=\"pm\">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div><div class=\"pm pa\">说明</div></div>');",
      '专题地图的途经点 popup 回到坐标占第一行、说明被挤到第二行（与 travel-map 同批修的第四支）'],
  ];
  ZERO45.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {
      F45('ZERO45 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V45)) { F45('ZERO45 登记了 §45 没读的文件「' + f + '」：' + why); return; }
    if (cnt45(V45[f], needle) !== 0) F45(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt45(flat45(ctrl), needle) < 1) F45('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 内置动态扫描：卡面拼裸坐标这一族的「形状」而不是「这十行」。
        为什么必须有一条扫全树的：这一批的普查数字一路是 6 → 8 → 11，两次都漏在同一件事上——
        只数登记过的文件与模式。登记表守得住已知的十个落点，守不住第十一个页面。
        判据（现场标定 tools/out/probe45-scan-rule.js）：一行同时含 lat、lng、.toFixed( → 坐标被格式化过，
        要么显示要么当键；含「坐标」二字 → 它交代了来意，放行；不含任何渲染信号 → 键／URL／缓存，放行；
        剩下的就是「拼进 HTML/canvas 又没说这是坐标」＝红。 */
  const REND45 = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'textContent', 'rows.push('];
  const SCAN45 = src => {
    const r = { sites: 0, labeled: 0, offscreen: 0, out: [] };
    src.split('\n').forEach(function (ln, i) {
      if (ln.indexOf('.toFixed(') < 0) return;
      if (!/lat/i.test(ln) || !/lng/i.test(ln)) return;
      r.sites++;
      if (ln.indexOf('坐标') >= 0) { r.labeled++; return; }
      if (!REND45.some(k => ln.indexOf(k) >= 0)) { r.offscreen++; return; }
      r.out.push('第 ' + (i + 1) + ' 行  ' + ws45(ln).slice(0, 104));
    });
    return r;
  };
  let var45scan = { files: 0, sites: 0, labeled: 0, offscreen: 0, bare: 0 };
  {
    const CAL45 = SCAN45(
      "  it.innerHTML = '<h4>x</h4><div class=\"tm\">' + esc(n.date) + ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</div>';\n" +
      "  if (n.lat != null) rows.push(['坐标', n.lat.toFixed(4) + ', ' + n.lng.toFixed(4)]);\n" +
      "  const k = n.lat.toFixed(4)+','+n.lng.toFixed(4);\n");
    if (CAL45.sites !== 3 || CAL45.out.length !== 1 || CAL45.out[0].indexOf('class="tm"') < 0)
      F45('§45 的扫描器自己失准（三行合成样本应 sites=3／越界 1 且是卡面那一行，实得 sites=' + CAL45.sites + ' 越界=' + JSON.stringify(CAL45.out) + '）：扫描器红了，下面那个「全树 0」不是证据');
    const FILES45ALL = fs.readdirSync('.').filter(f => /\.(js|html)$/.test(f) && fs.statSync(f).isFile());
    let CS45 = 0, CL45 = 0, CO45 = 0;
    const BARE45 = [];
    FILES45ALL.forEach(function (f) {
      const r = SCAN45(rd45(f));
      CS45 += r.sites; CL45 += r.labeled; CO45 += r.offscreen;
      r.out.forEach(o => BARE45.push(f + ':' + o));
    });
    if (BARE45.length) F45('卡面上出现裸坐标串（' + BARE45.length + ' 处：' + BARE45.join(' ｜ ') + '）：口径是「卡面删掉、界面只留地点名」；要留就带「坐标」二字交代来意，或走复制/导出那条不是卡面的出口');
    if (CS45 < 20) F45('全站「同时含 lat/lng/toFixed」的行只剩 ' + CS45 + ' 处（实测 25）：扫描口径本身漂了（判据被改窄或文件没数到），这一条一失准，上面那个「越界 0」就变成空断言');
    if (CL45 !== 5) F45('带「坐标」标签的保留点从 5 处变成 ' + CL45 + ' 处（登记：md-manager.html 的 rows.push([\'坐标\',…])、vault.js 导出 md 的 <p class="meta">坐标 · …、node-manager.html 两块详情面板与添加/编辑地点弹窗）：少了是那一支的坐标被顺手删了（它是功能不是装饰），多了是新落点没登记');
    if (CO45 < 15) F45('不在屏上的坐标行（去重键／缓存键／URL 参数／复制文本）从 20 处掉到 ' + CO45 + ' 处：这一族是「删卡面不许删功能」那条口径的正面证据，不许跟着卡面一起砍');
    var45scan = { files: FILES45ALL.length, sites: CS45, labeled: CL45, offscreen: CO45, bare: BARE45.length };
  }

  /* ④ 浏览器腿齐备检：CO01–CO21 逐条在场（少一条就少一个证据），条数守卫的阈值也要钉住 */
  {
    const S45 = V45['tools/smoke-coord.js'];
    for (let i = 1; i <= 21; i++) {
      const lab = "ok('CO" + (i < 10 ? '0' + i : '' + i) + ' ';
      if (cnt45(S45, lab) !== 1) F45('tools/smoke-coord.js 里 CO' + (i < 10 ? '0' + i : i) + ' 这条判据不是恰 1 处（实得 ' + cnt45(S45, lab) + '）：这一节的立论是「删的与留的都要在屏上读到」，删一条就少一个证据，改编号会让 §45 的齐备检集体失效');
    }
    if (cnt45(S45, 'checks >= 20') !== 1) F45('条数守卫（本闸门自己也会被删）不在了或阈值被挪：判据是 21 条，而 ok() 在自增前求值，所以表达式写的是 checks >= 20');
    if (cnt45(S45, "const BARE_SRC = '\\\\d{1,3}\\\\.\\\\d{3,}") !== 1) F45('浏览器腿那把裸坐标正则不在场或被复制成两份：CO03/CO05/CO09/CO12/CO15/CO18 那六条「读不到」全靠它，屏上那一格与属性那一格共用同一把刀，而它一旦漂了就只能靠 CO19 那条反证才发现');
    if (cnt45(S45, "ok('CO19 反证") !== 1) F45('CO19 那条合成坏样本不在场：没有它，这一节的六个「读不到」可能只是正则瞎了');
    if (cnt45(S45, "ok('CO13 反证") !== 1) F45('CO13 那条属性腿的反证不在场：CO12 那个「全页属性 0 命中」没有它就不是证据');
    {
      const LAB45 = S45.match(/ok\('(CO\d+)[ ]/g) || [];
      const MAXN45 = LAB45.reduce((m, s) => Math.max(m, Number(/CO(\d+)/.exec(s)[1])), 0);
      const SEG45 = (rd45('tools/verify.js').split('④ 浏览器腿齐备检')[1] || '');
      const BOUND45 = (SEG45.match(/for \(let i = 1; i <= (\d+); i\+\+\)/) || [])[1];
      if (BOUND45 === undefined) F45('读不到 ④ 那条齐备检的循环上限（正则没命中＝那一行被改写形状了，这条对账当场失明）');
      else if (Number(BOUND45) !== MAXN45) F45('④ 齐备检的循环上限是 ' + BOUND45 + '，而 smoke-coord 里真实最大编号是 CO' + MAXN45 + '：上限比编号小＝有几条判据没人守（收窄一格就少守一条，而且它自己永远不会红）');
    }
  }

  if (V45['README.md'].indexOf('§45') < 0) F45('README.md 的 verify 清单没提 §45（新闸门不写进 README 就等于没装）');

  console.log('卡面裸坐标闸门: ' + A45.length + ' 条代码锚点（改后卡面五处「只留日期/地点名」+ 两处填内容与两处 flyTo 都只钉一遍的形状 + popup 那行的 esc(n.style) + 三处带「坐标」标签的保留点 + 复制文本那条保留支 + 途经点 popup + 浏览器腿三条形状锚（真机档 328×723／切时间视图那一支／展开折叠的旅程卡——少了任何一条，那一支判据就在一块不存在的屏上或 0 张卡上空跑）+ 十族期望 0（results／review／列表卡／导出文档／海报 fillText／地图 popup／抽屉 locHtml 与其拼串与那条死 CSS／专题 popup）各配正向对照 + 三项内置动态对账（全量 readdir ' + var45scan.files + ' 个根目录文件：坐标行 ' + var45scan.sites + '、带标签保留 ' + var45scan.labeled + '、不在屏上的键与 URL ' + var45scan.offscreen + '、越界 ' + var45scan.bare + '，扫描器先拿三行合成样本自校准）+ 一条自指纪律（flat45/view45 定义行必须走那把共享剥刀与不剥文档那一支，两处改动旁各钉一枚现场哨兵）+ 浏览器腿 CO01–CO21 齐备检与条数守卫（含两枚反证锚：屏上那一格 CO19、属性那一格 CO13）；A45 表长 ' + A45.length + ' 条、ZERO45 表长 ' + ZERO45.length + ' 条，抬阈值类变异要取当前长度 + 1；锚点 preflight 见 tools/out/probe45-anchor-preflight.js，变异自测见 tools/out/mut-verify45.js');
  fail += bad45;
}

/* ============ §46 日期显示口径闸门（批次 31） ============
   用户点单（逐字）：「日期显示统一」。
   地基实测（tools/out/b31-divergence.txt，328×723 真浏览器腿）：五条种子全部归一到同一个键 2026-10-08，
   日历「亮哪格」与「点开有内容」都对，可同一张卡上那行日期印成 2026-10-8 ／ 2026.10.08 ／ 2026年10月8日 ／
   空串 ／ 十月八号 五种。根因是 §41 只收了「键」，显示那一路从来没收口：各页面各自抄 n.date、各自 slice(0,10)、
   各自拼年月日；时刻那一族更交给系统的 toLocale 家族，换一台手机（换一套 locale）就换一种读法。

   本节钉四件事：
     ① 出口只有那五个名字：noteDay（键）+ dayText ／ nowDayText ／ fmtDayText ／ fmtClock（显示），
        五条定义体与五条导出名逐个钉住，再钉各页面上「包装单点而不是另抄一份」的那几行；
     ② 本批删掉的旧写法不许回来，每一条期望 0 都配一条「同一把刀能在改前原件上读出 1」的正向对照；
     ③ 内置全量对账（readdir 全树，不抄名单）：单点调用点逐文件恰数、locale 调用形全站 0、
        第二份宽松解析全站 1、裸读 .date 按域白名单、手拼日期又渲染上屏的只剩一枚已判定的设备月份 label；
     ④ 浏览器腿 D01–D22 齐备检 + 条数守卫。

   为什么 ③ 必须自己扫而不是抄登记数字：批次 30 那一节的坐标普查一路是 6 → 8 → 11，两次漏的根因相同
   （只数登记过的文件与模式）。日期这一族更严重——动手前的静态普查就是 37 处（tools/out/b31-bucket-census.txt），
   登记表抄不全等于闸门只守一半的页面，而守不住的那一半恰好是用户天天翻的那几页。

   为什么「键统一了」不等于「显示统一了」（这一节为什么不并进 §41）：§41 的锚钉的是分组用的那个串，
   分组对了、屏上照样能印五种写法——那正是本批用户报上来的症状。显示这一路必须有自己的出口与自己的闸门。 */
{
  let bad46 = 0;
  const F46 = m => { bad46++; console.log('FAIL §46 日期显示口径闸门: ' + m); };
  const ws46 = s => s.replace(/\s+/g, ' ').trim();
  const flat46 = s => ws46(stripBlockComments(s));
  const cnt46 = (s, n) => s.split(n).length - 1;
  const rd46 = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const view46 = f => /\.md$/.test(f) ? ws46(rd46(f)) : flat46(rd46(f));

  const FILES46 = ['travel-notes.js', 'results.js', 'review.html', 'travel-map.html', 'md-manager.html',
    'settings.html', 'planner.js', 'album.js', 'wishlist.html', 'vault.js', 'index.html',
    'story.html', 'search.html', 'tools/smoke-date.js', 'tools/smoke-coord.js', 'README.md'];
  const V46 = {};
  FILES46.forEach(f => {
    if (!fs.existsSync(f)) { F46('缺 ' + f); V46[f] = ''; return; }
    V46[f] = view46(f);
  });

  /* ⓪ 自指纪律：读源码这件事自己先自校准（同 §45 那一支）。
        危险方向不是「注释里的登记串被当成代码」（那会红，看得见），而是反过来的那一支：
        真代码被当成注释吞掉，住在这一带的期望 0 会静默满足。于是在本批改过的三处旁边各钉一枚现场哨兵。 */
  {
    const DEF46 = (rd46('tools/verify.js').match(/^[ \t]*const flat46 = [^\n]*/m) || [''])[0];
    if (DEF46.indexOf('stripBlockComments') < 0) F46('§46 的 flat46 定义行没走那把共享剥刀（现场读到的那一行：' +
      (DEF46.slice(0, 56) || '整行没数到，连定义都漂了') + '）：注释里抄的改前原串会被当成代码在场');
    const L46 = (rd46('tools/verify.js').match(/^[ \t]*const view46 = [^\n]*/m) || [''])[0];
    if (L46.indexOf('.md$') < 0) F46('view46 的定义行退回「文档也剥注释」那一支（现场读到的那一行：' + (L46.slice(0, 60) || '整行没数到') + '）：README 登记串里天生要写这族的形状，文档侧的锚会当场读 0');
    [['travel-notes.js', 'function noteDay(n) {'],
     ['travel-map.html', "if(map) map.flyTo(gxy(n.lat,n.lng)"],
     ['settings.html', "line('wdStatus', '上次同步 '"]].forEach(function (p) {
      if (V46[p[0]].indexOf(p[1]) < 0) F46('盲区哨兵：「' + p[1] + '」在 flat 里读不到了（它就贴在 ' + p[0] + ' 本批改掉的行旁边；读不到＝这一带又变成盲窗，住在里面的期望 0 那一族会静默满足）');
    });
  }

  /* ① 正向锚点：五个出口的定义体 + 五条导出名 + 各页面「包装单点而非另抄一份」的那几行 */
  const A46 = [
    ['travel-notes.js', 'function noteDay(n) {', 1, '§41 的归一键仍是唯一解析处（dayText 只调它，不再开第二份）'],
    ['travel-notes.js', 'function dayText(n) { return noteDay(n); }', 1, '屏上日期唯一出口：这一行一旦长出 slice/拼年月日，本节的立论就散了'],
    ['travel-notes.js', 'function nowDayText() { return fmtDay(Date.now()); }', 1, '「今天/生成于/记录于」也走同一个 fmtDay，不再各页各取一套 locale'],
    ['travel-notes.js', "function fmtDay(ts) { var d = new Date(ts); if (!isFinite(d.getTime())) return '';", 1, '坏 ts 读空而不是印 NaN（改前 travel-map 那两行会把 NaN 画到屏上）'],
    ['travel-notes.js', "function fmtClock(ts) { var d = new Date(ts); if (!isFinite(d.getTime())) return ''; return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }", 1, '时刻固定档：HH:MM，坏 ts 同样读空'],
    ['travel-notes.js', "function fmtTime(ts) { var day = fmtDay(ts), ck = fmtClock(ts); return [day, ck].filter(Boolean).join(' '); }", 1, '日+时刻这一族改成拼两个固定档（改前它自己从零拼年月日，是五种写法之一）'],
    ['travel-notes.js', 'noteDay: noteDay,', 1, '五个出口都真的挂到 window.TravelNotes 上：定义在而没导出，页面就只能自己再抄一份'],
    ['travel-notes.js', 'dayText: dayText,', 1, '同上（这一支是屏上那一格的主出口）'],
    ['travel-notes.js', 'nowDayText: nowDayText,', 1, '同上（导出文档头、纪念册「生成于」都靠它）'],
    ['travel-notes.js', 'fmtDayText: fmtDay,', 1, '同上（ts → YYYY-MM-DD，短档页面自己 slice）'],
    ['travel-notes.js', 'fmtClock: fmtClock,', 1, '同上（ts → HH:MM）'],
    ['travel-notes.js', "' 篇 · 记录于 ' + nowDayText()", 1, '导出文档的头一行读设备时刻的固定档（改前是 locale）'],
    ['review.html', 'function dayOf(n){return TravelNotes.noteDay(n);}', 1, '这一页的既有包装转发的就是单点：留包装可以，另抄解析不行'],
    ['md-manager.html', "function dayText(n) { return (window.TravelNotes && TravelNotes.dayText) ? TravelNotes.dayText(n) : ''; }", 1, '数据管理页从前自己抄了一份宽松解析，现在只剩转发（转发失败读空，不猜形状）'],
    ['md-manager.html', "function ymOf(n) { return dayText(n).slice(0, 7) || '未知'; }", 1, '月份分组从显示单点派生，不再是第二份解析'],
    ['md-manager.html', '<script src="travel-notes.js"></script>', 1, '这页必须先载单点：转发的前提是库在场（漏载会让上面两行静默读空）'],
    ['travel-map.html', "const time=[TravelNotes.dayText(n), TravelNotes.fmtClock(n.ts)].filter(Boolean).join(' · ');", 2, '单篇抽屉与聚合列表两处共用同一把刀：只钉一处等于另一处没人守'],
    ['travel-map.html', "var time=TravelNotes.fmtDayText(n.ts).slice(5)+' '+TravelNotes.fmtClock(n.ts);", 1, '时间线胶囊的短档（MM-DD HH:MM）：slice 的是单点的输出，不是原始字段'],
    ['travel-map.html', 'var fmtD=function(ts){return TravelNotes.fmtDayText(ts).slice(5);};', 1, '旅程档头那对日期同一支短档'],
    ['travel-map.html', "ctx.fillText(TravelNotes.nowDayText()+' 制 · 古建地图集'", 1, '海报画布上的制图时刻也收进固定档'],
    ['results.js', 'function dayStr(ts) { return TravelNotes.fmtDayText(ts); }', 1, '纪念册/图鉴的日期档转发单点（改前这里是从零拼四位年 + 补零月日）'],
    ['results.js', "' · 生成于 ' + TravelNotes.nowDayText()", 3, '三处「生成于」共用一个出口（只钉一处会留下另两处各写各的）'],
    ['settings.html', "line('wdStatus', '上次同步 ' + TravelNotes.fmtDayText(l.ts).slice(5) + ' ' + TravelNotes.fmtClock(l.ts)", 1, '云同步那行「上次同步」的时刻：改前这里是页内自拼 + locale 混用'],
    ['album.js', 'function fmtD(ts) { return TravelNotes.fmtDayText(ts); }', 1, '相册章标题的日期档（改前是 2026.10.08 点号形）'],
    ['wishlist.html', 'function fmt(ts) { return TravelNotes.fmtDayText(ts); }', 1, '心愿单「已打卡 · 日期」同一支（改前同样是点号形）'],
    ['planner.js', "esc(t.createdAt ? TravelNotes.fmtDayText(t.createdAt) : '')", 1, '候选行的小字创建日期：没有createdAt 就读空，不印 undefined'],
    ['vault.js', "'> 由 行迹 TRACE 导出 · ' + TravelNotes.nowDayText()", 1, '导出索引的头一行同一口径'],
    ['tools/smoke-date.js', 'const VW = 328, VH = 723;', 1, '浏览器腿量的必须是用户那块屏（§37 口径）'],
    ['tools/smoke-date.js', 'const SHAPE_SRC', 1, '形状刀只声明一份（改名或再声明一份都会让下面那条「按名字共用」变成两份刀：正判据与 D00 自校准必须共用同一把）'],
    ['tools/smoke-date.js', 'new RegExp(SHAPE_SRC', 1, '正判据必须按名字共用那把刀：把刀体行内重打一遍，声明照旧在场而两处从此各改各的，D00 的自校准就只校准了没人用的那把'],
    ['tools/smoke-date.js', "document.getElementById('tnViewTime')", 1, '时间视图那一支真切换过：renderItem 两视图共用，只验聚合那一支＝另一支没人守'],
    ['tools/smoke-date.js', 'window.__CAP = [];', 1, '复制那条出口是私有函数、没有对外 API，只能真点 + 拦 clipboard；改成直接调内部函数＝验一个不存在的出口'],
    ['tools/smoke-coord.js', "const DATEONLY = c => /^\\d{4}-\\d{2}-\\d{2}$/.test(c.tm);", 1, '§45 那两条形判据跟着本批改档：卡面只剩日期（时刻归抽屉与时间线），这条锚钉的是「不许把时间档再塞回卡面」'],
    ['travel-map.html', '.sort(function(a,b){return (a.ts||0)-(b.ts||0);})', 1, '时间线排序把「没填时间戳」当最旧：原式 a.ts-b.ts 对缺 ts 的那篇返回 NaN，顺序交给引擎，那一枚能抢走默认那一程（屏上只剩一只空时间格的胶囊）'],
    ['story.html', "var _sp=cards.map(function(n){return n.ts;}).filter(function(t){return typeof t==='number'&&isFinite(t);});", 1, '卷首语的跨度只算有 ts 的站：原式 (末站ts-首站ts) 撞上缺 ts 就读 NaN，而「跨 NaN 天」是直接上屏的字'],
    ['search.html', 'TravelNotes.init({});', 1, '搜索页必须自己把游记库灌进来：这一行不在，TravelNotes.list() 恒为空数组，搜自己的游记恒读「0 篇」（浏览器腿 D13 的分母也靠它）'],
  ];
  A46.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {
      F46('A46 有一条不是「[文件, 串, 期望次数, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会解构错位，这条锚等于没跑）');
      return;
    }
    const [f, needle, exp, why] = a;
    if (!(f in V46)) { F46('A46 登记了 §46 没读的文件「' + f + '」：' + why); return; }
    const n = cnt46(V46[f], needle);
    if (n !== exp) F46(f + ' 里「' + needle.slice(0, 52) + '」实得 ' + n + '，期望 ' + exp + '：' + why);
  });

  /* ② 期望 0：本批删掉的旧写法，各配一条正向对照（那个 0 不是证据，除非同一把刀能在原件上读出 1）。
        对照串取自 tools/out/b31-bucket-census.txt 与 git HEAD 的对应行。 */
  const ZERO46 = [
    ['results.js', 'esc(n.date)',
      "var h='<div class=\"card\">' + '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>' + '</div>';",
      '纪念册卡面又把裸 n.date 抄回屏上：那对 2026-10-8 与 2026.10.08 都不产生统一读数'],
    ['review.html', 'esc(n.date)',
      "return '<div class=\"md-item\"><h3>'+esc(n.title)+'</h3>'+'<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+'</div>'+'</div>';",
      'review 日卡的 .meta 回到裸读日期字段（本批五种写法里那一种就是这么印出来的）'],
    ['travel-notes.js', "'</h4><div class=\"tm\">' + esc(n.date) + '</div>",
      "it.innerHTML = '<h4>' + esc(n.title) + '</h4><div class=\"tm\">' + esc(n.date) + '</div><div class=\"tx\">' + '</div>';",
      '列表卡 .tm 退回原始字段：这一格是用户看得最多的那一行，坏形状直接上屏'],
    ['travel-notes.js', "function fmtTime(ts) { var d = new Date(ts); function p(n)",
      "function fmtTime(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }",
      '单点自己退回从零拼年月日：那就不再有「只调 noteDay」这一条纪律，第二份解析住在最该干净的地方'],
    ['travel-map.html', "String(d.getMonth()+1).padStart(2,'0')+'.'",
      "const time=d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')+' · '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');",
      '抽屉与聚合列表那两行回到点号形 2026.10.08（用户报的五种写法之一）'],
    ['album.js', 'function fmtDM(ts)',
      "function fmtDM(ts) { var d = new Date(ts); return pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }",
      '零调用者的第二份短档又被写回来：留着它的后果是下一个人以为日期还有第二种出口'],
    ['settings.html', "(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours())",
      "      line('wdStatus', '上次同步 ' + (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + '：' + (l.msg || ''), l.ok ? 'ok' : 'err');",
      '「上次同步」回到页内自拼，月那段还漏了补零（10-8 与 10-08 在同屏并存）'],
    ['wishlist.html', "d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())",
      "function fmt(ts) { var d = new Date(ts); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate()); }",
      '心愿单那档回到点号形'],
  ];
  ZERO46.forEach(a => {
    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {
      F46('ZERO46 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组：' + JSON.stringify(a).slice(0, 90) + '（少字段会让那条期望 0 的正向对照等于没有）');
      return;
    }
    const [f, needle, ctrl, why] = a;
    if (!(f in V46)) { F46('ZERO46 登记了 §46 没读的文件「' + f + '」：' + why); return; }
    if (cnt46(V46[f], needle) !== 0) F46(f + ' 里出现「' + needle.slice(0, 48) + '」：' + why);
    if (cnt46(flat46(ctrl), needle) < 1) F46('「' + needle.slice(0, 48) + '」这条期望 0 的正向对照失效了（上面那个 0 不是证据）');
  });

  /* ③ 内置全量对账：五把扫描都先拿合成样本自校准，再去扫全树（readdir 不递归，与 §45 同一口径） */
  const FILES46ALL = fs.readdirSync('.').filter(f => /\.(js|html)$/.test(f) && fs.statSync(f).isFile());
  let var46 = { files: FILES46ALL.length, calls: 0, locale: 0, parse: 0, datelines: 0, hand: 0 };

  /* (a) 单点调用点：逐文件恰数。登记表抄漏一个文件＝那一页没人守；实得比登记多＝新落点没登记。 */
  {
    const RE46 = /TravelNotes\.(dayText|noteDay|nowDayText|fmtDayText|fmtClock)\(/g;
    const CALL46 = {
      'album-edit.html': 2, 'album.js': 2, 'index.html': 2, 'md-manager.html': 1, 'me.html': 1,
      'planner.js': 2, 'poster.js': 1, 'results.js': 11, 'review.html': 1, 'search.html': 1,
      'settings.html': 2, 'story.html': 4, 'travel-map.html': 9, 'travel-notes.js': 1, 'vault.js': 5, 'wishlist.html': 1,
    };
    const CAL46 = ((flat46("  it.innerHTML = '<b>' + esc(TravelNotes.dayText(n)) + '</b>';\n  var ck = TravelNotes.fmtClock(ts);\n").match(RE46)) || []).length;
    if (CAL46 !== 2) F46('§46 的调用点扫描器自己失准（两行合成样本应读 2，实得 ' + CAL46 + '）：扫描器红了，下面那张逐文件对账就不是证据');
    const DRIFT46 = [];
    FILES46ALL.forEach(function (f) {
      const n = ((flat46(rd46(f)).match(RE46)) || []).length;
      var46.calls += n;
      const exp = CALL46[f] || 0;
      if (n !== exp) DRIFT46.push(f + ' 实得 ' + n + '／登记 ' + exp);
      delete CALL46[f];
    });
    Object.keys(CALL46).forEach(f => { if (CALL46[f]) DRIFT46.push(f + ' 登记 ' + CALL46[f] + '／实得 0（那一页的接线被拆了，或文件名改了）'); });
    if (DRIFT46.length) F46('单点调用点与登记表对不上（' + DRIFT46.join(' ｜ ') + '）：口径是「日期只有一个出口」，多出来的那种调用是第几个出口、少掉的那一个是哪一页的接线，都得当场说清');
    if (var46.calls < 40) F46('全站单点调用只剩 ' + var46.calls + ' 处（实测 46）：扫描口径本身漂了（判据被改窄或文件没数到），这一条一失准，上面那张对账就变成空断言');
  }

  /* (b) locale 那一族：系统设置不许决定屏上读数。只认调用形，登记串写在注释里不会把自己读红。 */
  {
    const RE46L = /toLocale(?:Date|Time)String\s*\(/g;
    const CAL46L = ((flat46('  var s = new Date(ts).toLocaleDateString(); ctx.fillText(s, 10, 10);').match(RE46L)) || []).length;
    if (CAL46L !== 1) F46('locale 那把刀自己读不到合成样本（应 1 实得 ' + CAL46L + '）：下面那个「全站 0」就只是刀瞎了');
    const HITL = [];
    FILES46ALL.forEach(function (f) {
      const n = ((flat46(rd46(f)).match(RE46L)) || []).length;
      var46.locale += n;
      if (n) HITL.push(f + ':' + n);
    });
    if (var46.locale) F46('屏上读数又交给系统 locale 了（' + HITL.join(' ｜ ') + '）：同一篇导出文档在两台手机上会印成两种样子（en-US 的 10/8/2026 与 zh-CN 的 2026/10/8 都不在口径里）；数字千分位那种 toLocaleString 不在此列');
  }

  /* (c) 第二份宽松解析：全站只许 noteDay 本体那一处。 */
  {
    const NEED46P = '(\\d{4})\\D';   /* 源码里的字面形状：左括号、\d{4}、右括号、\D */
    const CAL46P = cnt46(flat46("  var m = s.match(/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/);"), NEED46P);
    if (CAL46P !== 1) F46('宽松解析那把刀读不到合成样本（应 1 实得 ' + CAL46P + '）：下面那个「全站 1」就不是证据');
    const HITP = [];
    FILES46ALL.forEach(function (f) {
      const n = cnt46(flat46(rd46(f)), NEED46P);
      var46.parse += n;
      if (n) HITP.push(f + ':' + n);
    });
    if (var46.parse !== 1) F46('全站「四位年 + 任意分隔」的宽松解析从 1 处（travel-notes.js 的 noteDay 本体）变成 ' + var46.parse + ' 处（' + HITP.join(' ｜ ') + '）：每多一处就多一份解析，坏形状在这里被修好、在别处又不修，正是本批五种写法的成因');
  }

  /* (d) 裸读 .date：记账域（那是开销自己的日期字段）与四处已定性的读点之外，不许新增。 */
  {
    const DATE46 = {
      'expense-form.js': 2, 'expense.html': 4, 'expense.js': 7,
      'md-manager.html': 1, 'me.html': 1, 'travel-notes.js': 4, 'vault.js': 2,
    };
    const D46 = {};
    FILES46ALL.forEach(function (f) {
      const n = rd46(f).split('\n').filter(ln => /\.date\b/.test(ln)).length;
      var46.datelines += n;
      if (n) D46[f] = n;
    });
    const DRIFT46D = [];
    Object.keys(D46).forEach(f => { if (D46[f] !== (DATE46[f] || 0)) DRIFT46D.push(f + ' 实得 ' + D46[f] + '／登记 ' + (DATE46[f] || 0)); });
    Object.keys(DATE46).forEach(f => { if (!D46[f]) DRIFT46D.push(f + ' 登记 ' + DATE46[f] + '／实得 0'); });
    if (DRIFT46D.length) F46('裸读 .date 的行数与登记对不上（' + DRIFT46D.join(' ｜ ') + '）：登记的是「记账域自己的日期字段」+ 四处已定性（md-manager 解析外部 MD 的输入、me.html 按年份筛开销、travel-notes 的归一键本体与注释、vault.js 的 zip DOS 时间戳）；游记的显示落点不在此列，新增了就是要开第二个出口');
    if (var46.datelines < 15) F46('全站 .date 行从 21 处掉到 ' + var46.datelines + ' 处：扫描口径漂了（记账域那一族是功能字段，不该跟着卡面一起砍）');
  }

  /* (e) 手拼日期 + 渲染信号：这一族就是 S1-4 的成因形状，全站只许剩一枚已判定的设备月份 label。 */
  {
    const REND46 = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'textContent', 'rows.push(', 'line(', 'status'];
    const SCAN46H = src => {
      const out = [];
      src.split('\n').forEach(function (ln, i) {
        if (!/(getFullYear\(\)|getMonth\(\)|getDate\(\))/.test(ln)) return;
        if (!REND46.some(k => ln.indexOf(k) >= 0)) return;
        out.push('第 ' + (i + 1) + ' 行  ' + ws46(ln).slice(0, 104));
      });
      return out;
    };
    const CAL46H = SCAN46H("  var s = d.getFullYear() + '-' + d.getMonth(); el.innerHTML = s;\n  const k = d.getDate() + '-' + m; cache[k] = 1;\n");
    if (CAL46H.length !== 1) F46('手拼+渲染那把刀失准（两行合成样本应 1，实得 ' + CAL46H.length + '）：第一行该抓（拼完就上屏），第二行该放（只是缓存键）');
    const HITS46 = [];
    FILES46ALL.forEach(function (f) { SCAN46H(rd46(f)).forEach(o => HITS46.push(f + ':' + o)); });
    var46.hand = HITS46.length;
    if (var46.hand !== 1) F46('「从零拼年月日又被渲染上屏」的行从 1 处变成 ' + var46.hand + ' 处（' + HITS46.join(' ｜ ') + '）：口径是屏上日期只准走那五个出口；要新增豁免得先说明它为什么不是游记日期');
    if (HITS46.length && HITS46[0].indexOf("seasonTitle').textContent = (new Date().getMonth() + 1) + ' 月，去哪？'") < 0)
      F46('全站仅剩的那一枚手拼不是首页「N 月，去哪？」那行（实得：' + HITS46[0] + '）：那一行是设备月份 label、与游记日期无关，已判定保留；换成一枚别的就说明口径漂了');
  }

  /* ④ 浏览器腿齐备检：D01–D22 逐条在场（少一条就少一个屏上证据），条数守卫的阈值也要钉住 */
  {
    const S46 = V46['tools/smoke-date.js'];
    for (let i = 1; i <= 22; i++) {
      const lab = "ok('D" + (i < 10 ? '0' + i : '' + i) + ' ';
      if (cnt46(S46, lab) !== 1) F46('tools/smoke-date.js 里 D' + (i < 10 ? '0' + i : i) + ' 这条判据不是恰 1 处（实得 ' + cnt46(S46, lab) + '）：这一节的立论是「每一个页面都读到同一个串」，删一条就少一个证据，改编号会让 §46 的齐备检集体失效');
    }
    if (cnt46(S46, "ok('D00 形状刀自校准") !== 1) F46('D00 那条形状刀自校准不在场：没有它，下面十几发「0 命中」可能只是正则瞎了');
    if (cnt46(S46, "ok('D18b ") !== 1) F46('D18b 那条普查分母不在场：十页全读不到日期时，十个「坏形状 0 命中」会一起绿掉，那是空跑');
    if (cnt46(S46, "ok('D20b ") !== 1) F46('D20b（复制那条仍带坐标）不在场：本批统一显示的时候不许顺手把 §45 的保留支砍掉');
    if (cnt46(S46, 'checks >= 24') !== 1) F46('条数守卫（本闸门自己也会被删）不在了或阈值被挪：判据是 25 条，而 ok() 在自增前求值，所以表达式写的是 checks >= 24');
    {
      const LAB46 = S46.match(/ok\('(D\d+)[ ]/g) || [];
      const MAXN46 = LAB46.reduce((m, s) => Math.max(m, Number(/D(\d+)/.exec(s)[1])), 0);
      const SEG46 = (rd46('tools/verify.js').split('④ 浏览器腿齐备检：D01')[1] || '');
      const BOUND46 = (SEG46.match(/for \(let i = 1; i <= (\d+); i\+\+\)/) || [])[1];
      if (BOUND46 === undefined) F46('读不到 ④ 那条齐备检的循环上限（正则没命中＝那一行被改写形状了，这条对账当场失明）');
      else if (Number(BOUND46) !== MAXN46) F46('④ 齐备检的循环上限是 ' + BOUND46 + '，而 smoke-date 里真实最大编号是 D' + MAXN46 + '：上限比编号小＝有几条判据没人守（收窄一格就少守一条，而且它自己永远不会红）');
    }
  }

  if (V46['README.md'].indexOf('§46') < 0) F46('README.md 的 verify 清单没提 §46（新闸门不写进 README 就等于没装）');

  console.log('日期显示口径闸门: ' + A46.length + ' 条代码锚点（五个出口的定义体 + 五条导出名 + 各页面「包装单点而非另抄解析」的那几行，含 review 的 dayOf、md-manager 的 dayText/ymOf 与其 script 载入、travel-map 两处共用同形与两处短档、results 三枚「生成于」各钉期望次数、§45 那条 CO 形判据跟着改档）+ 八族期望 0（裸读 n.date 三处／单点自己退回拼年月日／抽屉点号形／album 的第二份短档／settings 的页内自拼／wishlist 点号形）各配正向对照 + 五把内置扫描全量对账（readdir ' + var46.files + ' 个根目录文件：调用点 ' + var46.calls + ' 处逐文件恰数、locale 调用形 ' + var46.locale + '、宽松解析 ' + var46.parse + '、裸读 .date ' + var46.datelines + '、手拼+渲染 ' + var46.hand + '，每把都先拿合成样本自校准）+ 一条自指纪律（flat46/view46 定义行走那把共享剥刀与不剥文档那一支，三处改动旁各钉哨兵）+ 浏览器腿 D01–D22 齐备检与条数守卫（含 D00 形状刀自校准、D20b 保留支反证）；A46 表长 ' + A46.length + ' 条、ZERO46 表长 ' + ZERO46.length + ' 条，抬阈值类变异要取当前长度 + 1；取数探针见 tools/out/probe31-counts.js，变异自测见 tools/out/mut-verify46.js');
  fail += bad46;
}


console.log(fail ? '=== FAIL: ' + fail + ' issue(s) ===' : '=== ALL CHECKS PASSED ===');
process.exit(fail ? 1 : 0);
