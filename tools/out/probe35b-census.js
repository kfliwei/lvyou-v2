/* probe35b-census.js — 批次 35-B 改后普查：同一把白名单尺子，再看三档落到哪
 * 用法: node tools/out/probe35b-census.js   （读数落 tools/out/b35b-census.txt / .json）
 * 与 probe35a-census.js 的差别只有两处，且都是这一批改了口径带来的：
 *   ① WIRED 认的面板私有令牌族从 --fd/--fb 换成 --tnp-fd/--tnp-fb（注入串改名，§51 的白名单同口径）
 *   ② canvas 那一档不再只数「绕过」，而是逐条要求字面族名里含 "TRACE Serif"，
 *      不含的必须显式登记（travel-notes.js 日期档那一条是设计内留 generic）
 * 尺子本身要自校准：白名单五桶 + T3 之外一条不许剩，T1 必须读 0；读不出 0 就是还有漏接线。
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
    const VAL = '((?:&[a-z]+;|[^;}])+)';
    let re = new RegExp('font-family\\s*:\\s*' + VAL, 'g');
    while ((m = re.exec(ln))) hits.push({ f, n: i + 1, kind: 'css', val: m[1].trim(), ln: ln.trim() });
    re = new RegExp('font-family\\s*=\\s*"([^"]*)"', 'g');
    while ((m = re.exec(ln))) hits.push({ f, n: i + 1, kind: 'attr', val: m[1].trim(), ln: ln.trim() });
    re = /\.font\s*=\s*(.+)$/;                                  // canvas 那一档只看这一行有没有赋值（.font = '…'）
    /* 注意：canvas 的族名要用**整行**判，不能只取引号里的片段——
       ctx.font = '600 64px "TRACE Serif",serif' 用 ['"]([^'"]*)['"] 只会截到 600 64px，
       于是「不含品牌名」被读成 16 处／期望 0 的那一把尺子当场失准（35-A 第一版就栽在引号嵌套上） */
    if (re.test(ln)) hits.push({ f, n: i + 1, kind: 'canvas', val: (ln.match(re) || ['', ''])[1].trim(), ln: ln.trim() });
  });
}

const TOKEN_DEF = h => /@font-face/.test(h.ln);
const WIRED = h => /var\(--(font-[a-z]+|tnp-f[db])[,)]/.test(h.val);
const INHERIT = h => /^inherit$/.test(h.val);
const MONO = h => /monospace|Consolas|SFMono|Menlo/i.test(h.val) && !/Songti|PingFang|YaHei|Noto|LXGW|Kaiti|STSong/.test(h.val);
const SYS = h => /^(system-ui|-apple-system|sans-serif|serif)(\s*,\s*(system-ui|-apple-system|sans-serif|serif))*$/.test(h.val.trim());

/* ③ 档：独立导出件 / SVG。那些文档不载 design.css，@font-face 不在场，写死桌面名是唯一办法
   （行号是改后实测：results.js 那一族因批次 35-B 删掉 shareCanvas 死码整体上移 45 行） */
const T3 = [
  ['results.js', 132], ['results.js', 134], ['results.js', 139], ['results.js', 145],
  ['planner.js', 2040], ['planner.js', 2041], ['planner.js', 2042],
  ['travel-notes.js', 2047],
  ['vault.js', 400],
  ['album.js', 344]
];
const isT3 = h => T3.some(([f, n]) => h.f === f && h.n === n);
/* ② 档里设计内留 generic 的那一条（日期短档，不担品牌字族），必须显式点名 */
const T2_GENERIC = [['travel-notes.js', 2354]];

const buckets = { TOKEN_DEF: [], WIRED: [], INHERIT: [], MONO: [], SYS: [], T1: [], T2: [], T2gen: [], T3: [] };
hits.forEach(h => {
  if (TOKEN_DEF(h)) return buckets.TOKEN_DEF.push(h);
  if (WIRED(h)) return buckets.WIRED.push(h);
  if (INHERIT(h)) return buckets.INHERIT.push(h);
  if (MONO(h)) return buckets.MONO.push(h);
  if (SYS(h)) return buckets.SYS.push(h);
  if (isT3(h)) return buckets.T3.push(h);
  if (h.kind === 'canvas') {
    if (T2_GENERIC.some(([f, n]) => h.f === f && h.n === n)) { buckets.T2gen.push(h); return; }
    return buckets.T2.push(h);
  }
  return buckets.T1.push(h);
});

const noBrand = buckets.T2.filter(h => h.ln.indexOf('TRACE Serif') < 0);
const out = [];
const p = s => { out.push(s); console.log(s); };
const filesOf = a => new Set(a.map(x => x.f)).size;
p('扫描根目录 ' + files.length + ' 个 .js/.html/.css；font-family / ctx.font 命中 ' + hits.length + ' 行');
p('合法桶：@font-face ' + buckets.TOKEN_DEF.length + '｜var 接线 ' + buckets.WIRED.length +
  '｜inherit ' + buckets.INHERIT.length + '｜等宽 ' + buckets.MONO.length + '｜纯 generic ' + buckets.SYS.length);
p('【T1 应用内 DOM 硬写桌面名】' + buckets.T1.length + ' 处／期望 0' + (buckets.T1.length ? '：' + buckets.T1.map(h => h.f + ':' + h.n + ' ' + h.val.slice(0, 40)).join(' ｜ ') : ''));
p('【T2 canvas 出图】' + buckets.T2.length + ' 处／' + filesOf(buckets.T2) + ' 个文件，其中字面族名不含 "TRACE Serif" 的 ' + noBrand.length + ' 处／期望 0');
buckets.T2.forEach(h => p('  ' + h.f + ':' + h.n + ' ' + h.val.replace(/&quot;/g, '"').slice(0, 60)));
p('【T2 设计内留 generic】' + buckets.T2gen.length + ' 处（点名表 ' + T2_GENERIC.length + ' 条）');
buckets.T2gen.forEach(h => p('  ' + h.f + ':' + h.n + ' ' + h.val.slice(0, 60)));
p('【T3 独立导出件 / SVG】' + buckets.T3.length + ' 处（点名表 ' + T3.length + ' 条）／' + filesOf(buckets.T3) + ' 个文件');
buckets.T3.forEach(h => p('  ' + h.f + ':' + h.n + ' [' + h.kind + '] ' + h.val.replace(/&quot;/g, '"').slice(0, 60)));
p('等宽档明细：' + buckets.MONO.map(h => h.f + ':' + h.n).join(' '));
p('纯 generic 明细：' + (buckets.SYS.map(h => h.f + ':' + h.n + '→' + h.val.slice(0, 22)).join('  ') || '(无)'));

/* 自校准：白名单必须真的咬得住——先造一条已知绕过的行，量它进 T1；否则 T1=0 是空断言 */
{
  const CAL = '  x{font-family:"Songti SC",serif}';
  const h = { f: '__cal__', n: 0, kind: 'css', val: '"Songti SC",serif', ln: CAL };
  if (TOKEN_DEF(h) || WIRED(h) || INHERIT(h) || MONO(h) || SYS(h) || isT3(h)) {
    p('✗ 尺子失准：合成那条硬写桌面名的行被白名单放行了，T1=0 不构成证据');
  } else p('✓ 正向对照：合成行「font-family:"Songti SC",serif」确实落进 T1（T1=0 是有牙的读数，不是空集）');
  const CAL2 = '  x{font-family:var(--tnp-fd)}';
  const h2 = { f: '__cal__', n: 0, kind: 'css', val: 'var(--tnp-fd)', ln: CAL2 };
  if (!WIRED(h2)) p('✗ 尺子失准：面板私有名 var(--tnp-fd) 没被 WIRED 放行，改名的那一族会被误报成绕过');
  else p('✓ 反向对照：var(--tnp-fd) 落进 WIRED（改名后的面板私有名不算绕过）');
}

/* 旧名读取数：travel-notes.js 一枚都不许留（那一族整族是面板私有的，已改名）；
   design.css 只许摘掉那 16 枚别名——--bg 不在别名族里，它是全站真令牌（自己就有 28 个读取点），
   把 --bg 也列进这张表就会把合法读取算成越界（patch 预检第一版就是这么假红过 82 处） */
const NAMES17 = ['fd', 'fb', 'b6', 'b7', 'b9', 'a3', 'd3', 'bg', 'sf', 'sf2', 'ln', 'i9', 'i7', 'i5', 'sm', 'tf', 'tn'];
if (NAMES17.length !== 17) p('✗ 17 枚名单长度 ' + NAMES17.length + '／期望 17（名单自己缩水，下面那个 0 就成了空断言）');
const dead = [];
const ALIAS16 = ['fd', 'fb', 'b6', 'b7', 'b9', 'a3', 'd3', 'sf', 'sf2', 'ln', 'i9', 'i7', 'i5', 'sm', 'tf', 'tn'];
{
  const s = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
  const c17 = NAMES17.reduce((a, n) => a + (s.match(new RegExp('var\\(\\s*--' + n + '[,)]', 'g')) || []).length, 0);
  if (c17) dead.push('travel-notes.js 仍读旧名 var()×' + c17);
}
{
  const s = fs.readFileSync(path.join(ROOT, 'design.css'), 'utf8');
  const c16 = ALIAS16.reduce((a, n) => a + (s.match(new RegExp('var\\(\\s*--' + n + '[,)]', 'g')) || []).length, 0);
  if (c16) dead.push('design.css 仍读那 16 枚别名 var()×' + c16);
}
p('旧名 var() 读取：travel-notes.js（17 枚）+ design.css（16 枚别名）＝' + (dead.length ? '✗ ' + dead.join(' ｜ ') : '0 处 ✓'));

/* design.css 与注入串的同名令牌数：§51 守根因那一枚，这里先取改后读数 */
{
  const dc = fs.readFileSync(path.join(ROOT, 'design.css'), 'utf8');
  const tn = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
  const dcSet = new Set((dc.match(/--[a-z][a-z0-9-]*\s*:/g) || []).map(s => s.split(':')[0]));
  const tnRoot = [...new Set((tn.match(/--[a-z][a-z0-9-]*\s*:/g) || []).map(s => s.split(':')[0]))];
  const same = tnRoot.filter(n => dcSet.has(n));
  p('design.css 声明 ' + dcSet.size + ' 枚／注入串声明去重 ' + tnRoot.length + ' 枚／同名 ' + same.length + ' 枚' + (same.length ? '（' + same.join(' ') + '）' : ''));
}
fs.writeFileSync(path.join(__dirname, 'b35b-census.txt'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'b35b-census.json'), JSON.stringify({ T1: buckets.T1, T2: buckets.T2, T2gen: buckets.T2gen, T3: buckets.T3 }, null, 1));
