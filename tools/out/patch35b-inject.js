/* 批次 35-B 注入串手术：面板的 :root 令牌族改私有名 + 摘 design.css 里没人读的别名一族。
   根因：travel-notes.js 的注入串在 `:root` 上重声明了 17 枚与 design.css 同名的令牌，
   后来者胜 ⇒ 面板一出现，全站（宿主页 + design.css 自己）那 17 枚的值都被面板的米白皮劫持；
   --bg 那一枚站外有 108 个读取点。修法不是「摘掉两条」，而是让面板用**自己的名字**。
   值一个都不改 ⇒ 面板外观不变；design.css 那族别名（唯一读者就是这个面板）随之成为死码，摘掉。
   用法：node tools/out/patch35b-inject.js         预检（不落盘）
         node tools/out/patch35b-inject.js --write 落盘
   写成正则「--(fd|fb|…)」时一律带 (?![\\w-])：否则 --sf 会咬进 --sf2、--sm 会咬进 --sm-x。 */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.indexOf('--write') >= 0;
const out = [];
const _log = console.log.bind(console);
console.log = s => { out.push(String(s)); _log(s); };

const NAMES = ['fd', 'fb', 'b6', 'b7', 'b9', 'a3', 'd3', 'bg', 'sf', 'sf2', 'ln', 'i9', 'i7', 'i5', 'sm', 'tf', 'tn'];
/* 期望 = var() 读取 + 声明（:root 17 枚 + :root.theme-dark 再声明 11 枚） */
const EXPECT = { fd: 27, fb: 19, b6: 22, b7: 12, b9: 4, a3: 16, d3: 4, bg: 24, sf: 11, sf2: 9, ln: 28, i9: 15, i7: 6, i5: 21, sm: 9, tf: 14, tn: 3 };
const EXPECT_TOTAL = 244;
const PREFIX = '--tnp-';
const RE = new RegExp('--(' + NAMES.slice().sort((a, b) => b.length - a.length).join('|') + ')(?![\\w-])', 'g');
/* 串内四条死声明：串内串外都无人读取（var(--b8/--a5/--md/--lg) 全站各 0） */
const DEAD = ['--b8:#162725;', '--a5:#8d5b3c;', '--md:0 4px 14px rgba(60,50,30,.10);', '--lg:0 12px 32px rgba(60,50,30,.14);'];
/* design.css 里那一族别名的声明名（摘完之后全站读取数应为 0） */
const ALIAS = ['b7', 'b6', 'a3', 'ln', 'i9', 'i7', 'i5', 'fd', 'fb', 'sf2', 'sm', 'b9', 'd3', 'sf', 'tf', 'tn'];

const TN_PATH = path.join(__dirname, '..', '..', 'travel-notes.js');
const DC_PATH = path.join(__dirname, '..', '..', 'design.css');

let fail = 0;
const bad = m => { fail++; out.push('  ✗ ' + m); _log('  ✗ ' + m); };
const ok = m => out.push('  ✓ ' + m);

/* ---------- 1. travel-notes.js ---------- */
let tn = fs.readFileSync(TN_PATH, 'utf8');
const perName = {};
NAMES.forEach(n => {
  const c = (tn.match(new RegExp('--' + n + '(?![\\w-])', 'g')) || []).length;
  perName[n] = c;
  if (c !== EXPECT[n]) bad('travel-notes.js 里 --' + n + ' 实读 ' + c + '／期望 ' + EXPECT[n] + '（口径漂了就不要落盘）');
});
const total = (tn.match(RE) || []).length;
if (total !== EXPECT_TOTAL) bad('travel-notes.js 合计命中 ' + total + '／期望 ' + EXPECT_TOTAL);
ok('travel-notes.js：' + NAMES.length + ' 枚令牌合计 ' + total + ' 处命中（读取 216 + 声明 28）');
/* 正向对照：这把尺子咬得到自己 —— 把 --sf2 的读取数与 --sf 的读取数分开数，混了就说明边界失效 */
const sf = (tn.match(/--sf(?![\w-])/g) || []).length, sf2 = (tn.match(/--sf2(?![\w-])/g) || []).length;
if (sf !== EXPECT.sf || sf2 !== EXPECT.sf2) bad('边界自校准失效：--sf=' + sf + '／--sf2=' + sf2);
ok('自校准：--sf ' + sf + ' 与 --sf2 ' + sf2 + ' 各自计数互不吞（不带 (?![\\w-]) 时 --sf 会咬进 --sf2）');

DEAD.forEach(d => {
  const c = tn.split(d).length - 1;
  if (c !== 1) bad('死声明「' + d + '」命中 ' + c + '／期望恰 1');
});
ok('四条死声明各恰 1 处：' + DEAD.join(' ／ '));

/* 手术前的声明实例真值（不手抄常量，摘完后的期望由它减出来）：
   32 = 17 枚在 :root + 11 枚在 :root.theme-dark 再声明 + 4 条死声明 */
const DECL_RE = /--[a-z][a-z0-9-]*\s*:/g;
const declBefore = (tn.match(DECL_RE) || []).length;
if (declBefore !== 32) bad('手术前注入串的声明实例 ' + declBefore + '／期望 32（17 枚 + 11 枚重声明 + 4 条死声明）——口径漂了就不要落盘');
ok('手术前声明实例 ' + declBefore + ' 条 = 17 枚 :root + 11 枚 :root.theme-dark 重声明 + 4 条死声明');

tn = tn.replace(RE, (m, n) => PREFIX + n);
DEAD.forEach(d => { tn = tn.replace(d, ''); });
const left = (tn.match(RE) || []).length;
if (left !== 0) bad('改名后仍剩 ' + left + ' 处旧名');
const priv = (tn.match(/--tnp-[a-z0-9]+(?![\w-])/g) || []).length;
if (priv !== EXPECT_TOTAL) bad('改名后私有名合计 ' + priv + '／期望 ' + EXPECT_TOTAL);
ok('改名后：旧名残留 0，私有名 ' + priv + ' 处；死声明已摘（' + declBefore + ' 条声明 − ' + DEAD.length + ' 条 = 在场 ' + (declBefore - DEAD.length) + ' 条）');
const declLeft = (tn.match(/--tnp-(b8|a5|md|lg)(?![\w-])/g) || []).length;
if (declLeft !== 0) bad('死声明改名后仍在：' + declLeft);

/* ---------- 2. design.css ---------- */
const dcRaw = fs.readFileSync(DC_PATH, 'utf8');
const lines = dcRaw.split('\n');
const startIdx = lines.findIndex(l => /旧变量名兼容别名/.test(l));
if (startIdx < 0) bad('design.css 里找不到「旧变量名兼容别名」那行注释（区块改名了？不要瞎删）');
const stopIdx = lines.findIndex((l, i) => i > startIdx && /--ease-soft:/.test(l));
if (startIdx >= 0 && stopIdx < 0) bad('design.css 别名区块的右边界（--ease-soft）没找到');
const region = lines.slice(startIdx, stopIdx);
const aliasDecl = region.filter(l => /^\s*--([a-z0-9]+)\s*:/.test(l) && ALIAS.indexOf(RegExp.$1) >= 0);
if (aliasDecl.length !== 17) bad('别名区块里点到 ' + aliasDecl.length + ' 条声明／期望 17（16 枚 + --sm 重复声明那一条）');
if (region.length !== 19) bad('别名区块含注释与空行共 ' + region.length + ' 行／期望 19（删不动的就别删）');
ok('design.css 别名区块：19 行 = 1 行注释 + 1 行空行 + 17 条声明（其中 --sm 声明两次）');

const note = '  /* 旧变量名兼容别名一族（--b7/--b6/…/--tf/--tn，含重复的 --sm）随批次 35-B 摘除：唯一的读者是 travel-notes.js 注入串，那一族已改 --tnp-* 私有名；留着同名空壳，等于给「面板在 :root 上覆盖全站令牌」这一类 bug 留门 */';
const next = lines.slice(0, startIdx).concat([note]).concat(lines.slice(stopIdx));

/* ---------- 3. 摘 design.css 别名的许可证：那一族 16 枚在 travel-notes.js 之外必须零读取 ----------
   注意 --bg 不在这 16 枚里：design.css 的 --bg 是全站真令牌（站外 108 个读取点），
   面板那枚是同名劫持，靠改名解决，不是靠摘 design.css。 */
const dir = path.join(__dirname, '..', '..');
const roots = fs.readdirSync(dir).filter(f => /\.(js|html|css)$/.test(f) && fs.statSync(path.join(dir, f)).isFile());
const aliasReaders = [];
roots.forEach(f => {
  if (f === 'travel-notes.js') return;
  const src = f === 'design.css' ? next.join('\n') : fs.readFileSync(path.join(dir, f), 'utf8');
  const m = src.match(new RegExp('var\\(\\s*--(' + ALIAS.join('|') + ')\\s*[,)]', 'g')) || [];
  if (m.length) aliasReaders.push(f + ':' + m.length);
});
ok('design.css 之外（含 design.css 摘除后的自身）仍读那 16 枚别名 var() 的地方：' + (aliasReaders.length ? aliasReaders.join(' ') : '0 处'));
if (aliasReaders.length) bad('还有文件读别名（' + aliasReaders.join(' ') + '）——摘 design.css 那一族会把它们变成无效值');

/* 面板与 design.css 的同名令牌数：这一步之后应为 0（§51 要钉的就是这一枚）。
   两枚正则都必须允许**连字符**：只写 [a-z0-9]+ 会连 --color-bg 都抓不到，
   于是「同名 0 枚」变成两边都取到空集的空断言——这条探针第一次就这么瞎过。 */
const dcDecls = new Set((next.join('\n').match(/--[a-z][a-z0-9-]*\s*:/g) || []).map(s => s.split(':')[0]));
const declHits = tn.match(DECL_RE) || [];
const tnRootDecls = [...new Set(declHits.map(s => s.split(':')[0]))];
const sameName = tnRootDecls.filter(n => dcDecls.has(n));
/* 自校准：两把尺子都必须真的量到东西，否则「同名 0 枚」是空断言 */
if (!(dcDecls.size > 200)) bad('design.css 声明名只取到 ' + dcDecls.size + ' 枚（应 200 上下）——只认行首会把 `a{--x:1;--y:2}` 那种漏掉，下面的对账是空的');
if (declHits.length !== declBefore - DEAD.length) bad('注入串里声明条数取到 ' + declHits.length + '／期望 ' + (declBefore - DEAD.length) + '（手术前 ' + declBefore + ' 条 − 摘掉 ' + DEAD.length + ' 条死声明）');
if (tnRootDecls.length !== 17) bad('注入串去重后的声明名取到 ' + tnRootDecls.length + '／期望 17（11 枚在 :root.theme-dark 里再声明一次）');
ok('自校准：design.css 声明 ' + dcDecls.size + ' 枚、注入串声明 ' + declHits.length + ' 条（去重 ' + tnRootDecls.length + ' 枚），两把尺子都有牙');
ok('注入串声明的令牌 ' + tnRootDecls.length + ' 枚，与 design.css 同名 ' + sameName.length + ' 枚' + (sameName.length ? '（' + sameName.join(' ') + '）' : ''));

out.push('');
out.push('合计要落盘：travel-notes.js 命中 ' + EXPECT_TOTAL + ' 处改名 + 摘 4 条死声明；design.css 摘 17 条别名声明 + 那行旧注释，换成一行说明。');
out.push(fail ? '预检红 ' + fail + ' 项 —— 不许落盘' : '预检全绿');
if (!WRITE) { out.push('（当前是预检；加 --write 才写盘）'); fs.writeFileSync(path.join(__dirname, 'b35b-inject.txt'), out.join('\n') + '\n'); process.exit(fail ? 1 : 0); }
if (fail) { fs.writeFileSync(path.join(__dirname, 'b35b-inject.txt'), out.join('\n') + '\n'); console.log('预检未全绿，未落盘'); process.exit(1); }
fs.writeFileSync(TN_PATH, tn);
fs.writeFileSync(DC_PATH, next.join('\n'));
out.push('已落盘：travel-notes.js（' + fs.readFileSync(TN_PATH, 'utf8').length + ' 字符）、design.css（' + fs.readFileSync(DC_PATH, 'utf8').length + ' 字符）');
fs.writeFileSync(path.join(__dirname, 'b35b-inject.txt'), out.join('\n') + '\n');
