/* probe35a-census.js — 批次 35-A 普查腿：把「绕过品牌字族」的行数出来
 * 用法: node tools/out/probe35a-census.js   （读数落 tools/out/b35a-census.txt / .json）
 *
 * 为什么要自己重数：审核报告 §4 第 5 条写「33 处 / 7 个文件」，但三档相加只有 32（正文印 ③ 12、逐条数得出 11）。
 * 我第一版用 `font-family:` + 值字符类里排除引号 去抓，planner.js/album.js/vault.js 整档 0 命中——
 *   原因是那些行写 font-family:"PingFang SC"（值以字面双引号开头），被字符类挡掉；
 *   album.js:262 写 font-family="Songti SC, serif"（SVG/HTML 属性，等号不是冒号），也一样漏。
 *   第二版把值放宽后又把 `var(--font-…)`、`inherit`、`ui-monospace` 这些合法行算进来了。
 * ⇒ 这一版改成「白名单」形状（和将来 §21 闸门同一个口径）：
 *   每一处 font-family / ctx.font 必须落进四个合法桶之一（token 定义 / var 接线 / inherit / 等宽档），
 *   否则算「绕过品牌字族」；绕过者再按 T1 应用内 / T2 canvas / T3 导出件 分档，T3 要显式点名，没点名的一律进 T1（当场可见）。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const files = fs.readdirSync(ROOT).filter(f => /\.(js|html|css)$/.test(f));
const hits = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);
  src.forEach((ln, i) => {
    let m;
    /* 值里允许 HTML 实体（&quot; 自带分号，不能用 [^;}]+ 一刀切——那是第二版把 9 行 results/travel-notes
       的族名截成「&quot」的原因）；把实体当整体吃掉 */
    const VAL = '((?:&[a-z]+;|[^;}])+)';
    let re = new RegExp('font-family\\s*:\\s*' + VAL, 'g');      // CSS 声明
    while ((m = re.exec(ln))) hits.push({ f, n: i + 1, kind: 'css', val: m[1].trim(), ln: ln.trim() });
    re = new RegExp('font-family\\s*=\\s*"([^"]*)"', 'g');       // SVG / HTML 属性
    while ((m = re.exec(ln))) hits.push({ f, n: i + 1, kind: 'attr', val: m[1].trim(), ln: ln.trim() });
    re = /\.font\s*=\s*['"]([^'"]*)['"]/g;                       // canvas ctx.font
    while ((m = re.exec(ln))) hits.push({ f, n: i + 1, kind: 'canvas', val: m[1].trim(), ln: ln.trim() });
  });
}

/* ===== 四个合法桶 ===== */
const TOKEN_DEF = h => /@font-face/.test(h.ln);
const WIRED = h => /var\(--(font-[a-z]+|fd|fb)[,)]/.test(h.val);   // 带兜底的写法 var(--font-serif,serif) 也算接线
const INHERIT = h => /^inherit$/.test(h.val);
const MONO = h => /monospace|Consolas|SFMono|Menlo/i.test(h.val) && !/Songti|PingFang|YaHei|Noto|LXGW|Kaiti|STSong/.test(h.val);
const SYS = h => /^(system-ui|-apple-system|sans-serif|serif)(\s*,\s*(system-ui|-apple-system|sans-serif|serif))*$/.test(h.val.trim());

/* ===== T3 导出件 / SVG 点名表（那些文档不载 design.css，@font-face 不在场，写死桌面名是唯一办法） ===== */
const T3 = [
  ['results.js', 177], ['results.js', 179], ['results.js', 184], ['results.js', 190],   // docShell 打印友好路书
  ['planner.js', 2040], ['planner.js', 2041], ['planner.js', 2042],                     // docShell 自有 body/h1/h2/.story
  ['travel-notes.js', 1984],                                                            // 另存的游记 HTML body
  ['vault.js', 400],                                                                    // vault 导出 HTML body
  ['album.js', 262]                                                                     // SVG <text font-family="Songti SC, serif">
];
const isT3 = h => T3.some(([f, n]) => h.f === f && h.n === n);

const buckets = { TOKEN_DEF: [], WIRED: [], INHERIT: [], MONO: [], SYS: [], T1: [], T2: [], T3: [] };
hits.forEach(h => {
  if (TOKEN_DEF(h)) return buckets.TOKEN_DEF.push(h);
  if (WIRED(h)) return buckets.WIRED.push(h);
  if (INHERIT(h)) return buckets.INHERIT.push(h);
  if (MONO(h)) return buckets.MONO.push(h);
  if (SYS(h)) return buckets.SYS.push(h);
  if (isT3(h)) return buckets.T3.push(h);
  if (h.kind === 'canvas') return buckets.T2.push(h);
  return buckets.T1.push(h);
});
const bypass = [...buckets.T1, ...buckets.T2, ...buckets.T3].sort((a, b) => a.f.localeCompare(b.f) || a.n - b.n);

const out = [];
const p = s => { out.push(s); console.log(s); };
const filesOf = a => new Set(a.map(x => x.f)).size;
p('扫描根目录 ' + files.length + ' 个 .js/.html/.css；font-family / ctx.font 命中 ' + hits.length + ' 行');
p('合法桶：@font-face 定义 ' + buckets.TOKEN_DEF.length + ' 行｜已接 var(--font-*)/--fd/--fb（含带兜底写法）' + buckets.WIRED.length + ' 行｜inherit ' + buckets.INHERIT.length + ' 行｜等宽档 ' + buckets.MONO.length + ' 行｜纯 generic/system-ui ' + buckets.SYS.length + ' 行');
p('绕过品牌字族 = ' + bypass.length + ' 处 / ' + filesOf(bypass) + ' 个文件（审核报告 §4 第 5 条写的是 33 处 / 7 个文件）');
for (const t of ['T1', 'T2', 'T3']) {
  const a = buckets[t];
  p('\n【' + t + '】' + a.length + ' 处 / ' + filesOf(a) + ' 个文件');
  a.forEach(h => p('  ' + h.f + ':' + h.n + ' [' + h.kind + '] ' + h.val.replace(/&quot;/g, '"').slice(0, 66)));
}
p('\n等宽档明细（S3 登记为设计内，不算绕过）：' + buckets.MONO.map(h => h.f + ':' + h.n).join(' '));
p('纯 generic 明细：' + (buckets.SYS.map(h => h.f + ':' + h.n + '→' + h.val.slice(0, 22)).join('  ') || '(无)'));
fs.writeFileSync(path.join(__dirname, 'b35a-census.txt'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'b35a-census.json'), JSON.stringify(bypass, null, 1));
