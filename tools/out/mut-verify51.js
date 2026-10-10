/* tools/out/mut-verify51.js — verify.js §51「字族三档与注入串同名覆盖闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §51 红**里看见它，
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一节的靶子分四类：
 *   ① 三档与闸门被拆（R01–R22）：② 档那几枚 ctx.font 退回桌面名／出图口摘掉 fontsReady／
 *      设计内留 generic 那一枚被接上品牌族／面板私名退回公共名（同名覆盖回潮）／
 *      design.css 那族别名回来／--bg 那枚真令牌被越界摘除／ui.js 的兜底与导出被拆／
 *      第二份 fontsReady 实现出现／已删死码回来／③ 档被越界改接令牌／探针与本节的点名表分叉。
 *   ② 守卫自己（S01–S31）：两把共享剥刀各自的定义行、盲区哨兵、design.css 单向那把、
 *      A51／ZERO51 四元组形状、登记了没读的文件、期望 0 与正向对照两半、三把内置扫描各自的
 *      自校准与阈值（一律打**条件取反／抬阈值**，不打「摘掉那一支」——干净树上它们本来静默）、
 *      点名表表长、分母下界、④ 的循环上限与最大编号对账（含「收窄一格」那一支）。
 *   ③ 腿／探针／文档脚手架（T01–T11）：派生常量、页内那把刀、FO12 判据整串、三处永不落定 stub 之一、
 *      reject 档、真鼠标那颗钮、条数守卫、17 枚名单、判据改名、README 两处登记被抹。
 *   ④ 两条腿的分工样本（U01–U05：源码腿必须全绿，浏览器腿必须红在指名那条 FO）：
 *      U01 @font-face 的注册名与 ctx.font 写的名字分叉（源码只查「字面含 TRACE Serif」，查不到另一头叫什么）→ FO10 红；
 *      U02 fontsReady 成功时返回 false（锚钉的是那几行形状，不是那个布尔）→ FO08 红；
 *      U03/U04/U05 三个出图口各在闸门**前面**多打一发 go()（闸门行还在、计数还是 1）→ FO17／FO14／FO20 红。
 *   为什么必须有 ④：本节的立论是「出图排在字库后面」与「包内那套字真的上了屏」，
 *      源码腿数的是串的在场与计数，数不到「动笔发生在 await 之前还是之后」，也数不到 @font-face 那边叫什么名字。
 *
 * 登记一条本网不假装覆盖的盲区：把 A51／ZERO51 表里**整条锚删掉**不会红——§51 没有表长守卫
 *   （网自己在基准处对账摘要行的「A51 表长 34 条、ZERO51 表长 9 条」，删一条那张网当场中止，
 *   但单独跑 node tools/verify.js 不红：那两个数只印在日志里、不进退出码）。
 *
 * 登记第二条盲区（与 §50 的 T05 同因，那条后来靠把判据整串钉进 A51 补上的）：
 *   **把腿里某条判据的 cond 掏空**（标签不动、条数不变）时，源码腿与浏览器腿都会照样绿。
 *   §51 只钉得住它登记过的那几串（FO12 的判据整串、三处永不落定 stub、四颗星钮选择器、reject 档、条数守卫），
 *   其余判据的 cond 被改掉，本网没有一条靶子能打红它。要补就得往 A51 里再加钉，而不是假装这张网覆盖了。
 *
 * 登记第三条（结构性、不是本网的疏漏）：② 档那 15 处里，只有 A51 点名的 4 枚被逐枚钉住；
 *   其余 11 枚由内置扫描 (a) 的「不含品牌族 = 0」那把尺子整体兜住——所以打红它们任一枚的桌面名回潮
 *   走的是 R01/R02/R03/R07 那几条（扫描器红），而不是「某枚锚红」。两种红都真，别混为一谈。
 *
 * 记一条 token 口径：verify.js 印 A51/ZERO51 的红时 needle 只写前 52／48 字，所以 token 一律取
 *   why／reason 里的一段，或取自定义消息的整句片段；本网没有一条 token 跨在 slice 边界上。
 *
 * 首跑（69 条 → 红对 58／静默 4／异常 7，`tools/out/b35b-mut-verify51.txt`）把这族坑数成三类，全部落在本网、没有一条落在闸门上：
 *   (甲) **抬比较常数那一族（R08／S11／S12／S20／S21）：那种消息里的「期望 N」是硬写的字面量，不跟着常数动**。
 *     我把 token 写成「改完后它应该说的那句」（期望 11／期望 2），而它当场印的还是「期望 10／期望 1」——
 *     闸门是红的，我的 token 是瞎的。修法只有把比较常数与消息里那个数**同源**（本节没这么做：那要动 A51 三条锚 + README 的登记数，
 *     代价大于收益），所以本网的 token 一律**从当场打印的那条红行里抄**，不抄「我以为它会说的那句」。
 *   (乙) **T08 是首跑唯一一条真假绿灯**：往名单里少塞一枚名字，那条「ALIAS17.length !== 17」守卫照样成立，
 *     §51 只钉了守卫那一行、没钉名单本身 ⇒ 源码腿 0 红且整跑绿。本条已把名单整串补进 A51（表长 33 → 34），复打才认它红。
 *   (丙) **U05 首打火错了对象：插一行会把下面所有行号 +1**，② 档与 ③ 档那两张 (文件, 行号) 点名表当场跟着漂
 *     （红 2 条：「留 generic 那枚读成 0 枚」＋「不含品牌族 1 处」）。红是响的、不是漏，但那条靶子的立论是「源码腿必须全绿」，
 *     所以插入必须留在同一行内。**这也预告了本节的日常**：以后任何人在这两枚被点名之行的上方加代码，闸门都会红一次并要求同步改表。
 *
 * 用法:
 *   node tools/out/mut-verify51.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify51.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify51.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b35b-mut-verify51.txt node tools/out/mut-verify51.js
 * **不要与别的变异网或像素基线并行**：本网动的是 travel-notes.js／design.css／ui.js／poster.js／
 *   travel-map.html／results.js／album.js／tools/smoke-font.js／tools/out/probe35b-census.js／
 *   tools/verify.js／README.md，与 mut-verify45/46/47/48/49/50 重叠 tools/verify.js 与 README.md
 *   （45/46 还重叠 travel-notes.js、design.css、travel-map.html，42 重叠 travel-notes.js）；
 *   像素基线量的就是同一批屏。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U 类会重跑 tools/smoke-font.js（它自己把读数落到固定名 tools/out/b35b-smoke-font.txt），
 *   所以跑完要在干净树上复跑一次这条腿，把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut51.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut51.lock');
if (BUSY.length) { unlock(); console.log('中止：' + OUTDIR + ' 里还有别的变异网锁 ' + BUSY.join('、') + '（快照可能与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['design.css', 'ui.js', 'poster.js', 'travel-notes.js', 'travel-map.html', 'results.js',
  'album.js', 'tools/smoke-font.js', 'tools/out/probe35b-census.js', 'tools/verify.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); unlock(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上 */
const FP = [
  ['tools/verify.js', '/* ④ 浏览器腿齐备检：FO00–FO21 逐条在场 + 循环上限对账 */'],
  ['tools/verify.js', 'const flat51 = s => ws51(stripBlockComments(s));'],
  ['tools/verify.js', 'const view51 = f => /\\.md$/.test(f) ? ws51(rd51(f)) : flat51(rd51(f));'],
  ['tools/verify.js', "const T2GEN = [['travel-notes.js', 2278]];"],
  ['tools/verify.js', "const CAL = names(':root{--bg:#f6f1e5;--surface:#f6f1e5;}');"],
  ['tools/verify.js', "const CAL_OK = 'var(--tnp-fd)';"],
  ['tools/verify.js', "if (V51['design.css'].indexOf('var(--tnp-') >= 0)"],
  ['tools/verify.js', 'const DEF51b ='],
  ['travel-notes.js', '--tnp-bg:#f6f1e5;'],
  ['travel-notes.js', ":root{--tnp-fd:\"LXGW WenKai\",\"Kaiti SC\",serif;"],
  ['travel-notes.js', "ctx.font = '30px sans-serif';"],
  ['ui.js', 'function fontsReady() {'],
  ['ui.js', 'trapFocus: trapFocus, fontsReady: fontsReady };'],
  ['poster.js', "if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);"],
  ['travel-map.html', 'if(window.UI&&window.UI.fontsReady) window.UI.fontsReady().then(go,go);'],
  ['design.css', '--bg:var(--color-bg);'],
  ['tools/smoke-font.js', 'ALIAS17.length !== 17'],
  ['tools/out/probe35b-census.js', "['travel-notes.js', 2278]"],
  ['README.md', '§51 字族三档与注入串同名覆盖'],
  ['README.md', 'smoke-font'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 52) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, edits, token) { CASES.push({ name, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, edits: [[file, from, to]], token, kind: 'all' }); }
function gBoth(name, edits, want) { CASES.push({ name, edits, want, kind: 'silentB' }); }

/* ---------- ① 三档与闸门被拆 ---------- */
t('R01 轨迹卡标题退回改前那一枚桌面名（② 档的口径：canvas 只认字面族名）', [['travel-map.html',
  "  ctx.fillStyle=th.fg;ctx.font='bold 66px \"TRACE Serif\",serif';ctx.textAlign='center';",
  "  ctx.fillStyle=th.fg;ctx.font='bold 66px \"LXGW WenKai\",serif';ctx.textAlign='center';"]],
  '轨迹卡标题退回');
t('R02 轨迹卡日期那一笔退回 Noto Serif SC（包内子集注册的名字是 TRACE Serif，写它就是绕过自己内嵌的那套字）', [['travel-map.html',
  "  ctx.font='30px \"TRACE Serif\",serif';ctx.fillStyle=th.fg;ctx.globalAlpha=.8;",
  "  ctx.font='30px \"Noto Serif SC\",serif';ctx.fillStyle=th.fg;ctx.globalAlpha=.8;"]],
  '② 档另一枚退回公开字族名');
t('R03 海报标题退回桌面名（那两台机器上一个都不命中，出的每张 PNG 都是整机字体）', [['poster.js',
  "    ctx.font = '600 64px \"TRACE Serif\",serif';",
  "    ctx.font = '600 64px \"Songti SC\",\"Noto Serif SC\",serif';"]],
  '海报标题退回桌面名');
t('R04 海报出图口摘掉锁字库（font-display 管不到 canvas：字库没就位就把兜底字永久烤进 PNG）', [['poster.js',
  "    if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);\n    else go();",
  '    go();']],
  'poster.js 里 fontsReady().then(go, go) 实得 0');
t('R05 分享卡片那一路摘掉锁字库（那颗「卡」钮才是出口，这一支没人排队）', [['travel-notes.js',
  "    if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);\n    else go();",
  '    go();']],
  'travel-notes.js 里 fontsReady().then(go, go) 实得 0');
t('R06 轨迹卡出图口摘掉锁字库（三个口就是三行，摘一行就是那一支还在烤兜底字）', [['travel-map.html',
  '  if(window.UI&&window.UI.fontsReady) window.UI.fontsReady().then(go,go);\n  else go();',
  '  go();']],
  'travel-map.html 里 fontsReady().then(go, go) 实得 0');
t('R07 分享卡标题退回裸 sans-serif（改前那一行就是它：品牌字从来没上过卡片）', [['travel-notes.js',
  "    ctx.font = 'bold 64px \"TRACE Serif\",serif';",
  "    ctx.font = 'bold 64px sans-serif';"]],
  '② 档 canvas 落笔里有 1 处');
t('R08 日期那一笔被接上品牌族（它进过点名表＝设计内不担品牌字；表与本节会当场分叉）', [['travel-notes.js',
  "    ctx.font = '30px sans-serif';",
  "    ctx.font = '30px \"TRACE Serif\",serif';"]],
  '日期档设计内留 generic');
t('R09 面板私名退回公共名 --bg（本批的根因：注入串比宿主页后加载，:root 上后来者胜 ⇒ 面板一出现就换全站皮）', [['travel-notes.js',
  '--tnp-bg:#f6f1e5;', '--bg:#f6f1e5;']],
  '同名令牌 1 枚');
t('R10 面板字族令牌退回占用 --fd（design.css 那一族别名本批已摘，所以同名扫描抓不到它——由期望 0 那一族守）', [['travel-notes.js',
  ':root{--tnp-fd:', ':root{--fd:']],
  '面板重新占用 --fd 这个公共名字');
t('R11 design.css 那族别名回来一行（唯一读者已改 --tnp-b7；留着同名空壳就是给「:root 覆盖」这一类 bug 留门）', [['design.css',
  '  --bg:var(--color-bg);', '  --bg:var(--color-bg);\n  --b7:var(--color-ink);']],
  '那族别名回来了');
t('R12 ui.js 导出行退回没有 fontsReady（三处出图口吃的是 window.UI.fontsReady，没导出＝闸门看起来装了、其实一发作没有）', [['ui.js',
  'trapFocus: trapFocus, fontsReady: fontsReady };', 'trapFocus: trapFocus };']],
  '导出表里没有 fontsReady');
t('R13 没有 Font Loading API 时改成抛（抛了就把出图整个吃掉，用户看到的是「点了没反应」）', [['ui.js',
  "    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);",
  "    if (!document.fonts || !document.fonts.load) throw new Error('no fonts API');"]],
  '没有这套 API 时返回 false');
t('R14 只取一个字重（卡片与轨迹卡用的是粗体：700 那一档照样可能在没就位时落笔）', [['ui.js',
  "        document.fonts.load('400 24px \"TRACE Serif\"'),\n        document.fonts.load('700 24px \"TRACE Serif\"')\n      ])",
  "        document.fonts.load('400 24px \"TRACE Serif\"')\n      ])"]],
  '同上，粗体那一发');
t('R15 海报页自己抄一份 fontsReady（锁字库这件事必须只有一个实现）', [['poster.js',
  '  function generate(landscape, themeName) {',
  '  function fontsReady() { return Promise.resolve(true); }\n  function generate(landscape, themeName) {']],
  'fontsReady 的定义在四个相关文件里读到 2 处');
t('R16 已删的 shareCanvas/wrapText 回来了（全站零调用者：留着就有第二套「看起来像出图口」的代码不挂闸门）', [['results.js',
  '  function docShell(title, subtitle, body) {',
  '  function shareCanvas(title, subtitle, body, theme) { return null; }\n  function wrapText(ctx, text, x, y, maxW, lh) { return 0; }\n  function docShell(title, subtitle, body) {']],
  '已删的死码回来了');
tAll('R17 ③ 档那两枚桌面名越界改接令牌（那份独立 HTML 不载 design.css，@font-face 不在场，接了就是没有）', 'results.js',
  '&quot;Songti SC&quot;,serif', 'var(--font-serif)',
  '③ 档那一族的桌面名是');
t('R18 暗色档那一支不再让位给全站真令牌（改名只改名字：跟着全站走的那层语义不能一起改掉）', [['travel-notes.js',
  ':root.theme-dark{--tnp-bg:var(--color-bg);', ':root.theme-dark{--tnp-bg:#f6f1e5;']],
  '暗色档那一支必须让位给全站真令牌');
t('R19 SVG 那一枚改接品牌族（SVG 的 font-family 是属性不是 CSS 声明，那份文档不载 @font-face）', [['album.js',
  'font-family="Songti SC, serif"', 'font-family="TRACE Serif, serif"']],
  'SVG 里那一枚');
t('R20 design.css 那枚真令牌 --bg 被顺手摘掉（摘的是别名一族，不是把全站语义映射一起摘——第一版预检就是这么越界假红过 82 处）', [['design.css',
  '  --bg:var(--color-bg);', '  /* 摘掉 */']],
  '全站那一枚 --bg 还在');
t('R21 探针的留-generic 点名表行号漂一格（② 档那一枚在探针与本节各登记一次，只改一边就是「探针绿、闸门红」）', [['tools/out/probe35b-census.js',
  "const T2_GENERIC = [['travel-notes.js', 2278]];",
  "const T2_GENERIC = [['travel-notes.js', 2279]];"]],
  '探针与本节各登记一次');
t('R22 面板纸色的私名值被改掉（35-B 的口径是只改名字、值一个字不动 ⇒ 外观不变）', [['travel-notes.js',
  '--tnp-bg:#f6f1e5;', '--tnp-bg:#fbf8f1;']],
  '面板纸色走私名');

/* ---------- ② 守卫自己 ---------- */
t('S01 flat51 的哨兵条件取反（干净树当场红＝证明这一支真的在跑，不是写给人看的装饰）', [['tools/verify.js',
  "    if (DEF51.indexOf('stripBlockComments') < 0) F51('§51 的 flat51 定义行没走那把共享剥刀",
  "    if (DEF51.indexOf('stripBlockComments') >= 0) F51('§51 的 flat51 定义行没走那把共享剥刀"]],
  '定义行没走那把共享剥刀');
t('S02 view51 的哨兵条件取反（文档那一支不剥注释：README 的登记串里天生要写 glob）', [['tools/verify.js',
  "    if (L51.indexOf('.md$') < 0) F51('view51 的定义行退回「文档也剥注释」那一支",
  "    if (L51.indexOf('.md$') >= 0) F51('view51 的定义行退回「文档也剥注释」那一支"]],
  'view51 的定义行退回');
t('S03 design.css 单向那把尺子的条件放宽（面板私名只许住在面板自己那侧）', [['tools/verify.js',
  "if (V51['design.css'].indexOf('var(--tnp-') >= 0)",
  "if (V51['design.css'].indexOf('var(--tnp-') >= -1)"]],
  'design.css 里出现了 var(--tnp-');
t('S04 盲区哨兵那一条的条件挪一格（读不到才红 → 找到了才红：干净树当场红，证明哨兵真在场）', [['tools/verify.js',
  "      if (V51[p[0]].indexOf(p[1]) < 0) F51('盲区哨兵：「'",
  "      if (V51[p[0]].indexOf(p[1]) > 0) F51('盲区哨兵：「'"]],
  '盲区哨兵');
t('S05 专读原物那条（注释会被 flat 吃掉）取反', [['tools/verify.js',
  "    if (RAW51.indexOf('随批次 35-B 摘除') < 0) F51('design.css 那 19 行别名块换成的一行说明不见了",
  "    if (RAW51.indexOf('随批次 35-B 摘除') >= 0) F51('design.css 那 19 行别名块换成的一行说明不见了"]],
  '换成的一行说明不见了');
t('S06 A51 四元组形状守卫抬一位（少字段会解构错位，那条锚等于没跑）', [['tools/verify.js',
  "    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {\n      F51('A51 有一条不是",
  "    if (!Array.isArray(a) || a.length !== 5 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {\n      F51('A51 有一条不是"]],
  '不是「[文件, 串, 期望次数, 原因]」四元组');
t('S07 A51 登记了 §51 没读的文件（把 ui.js 那条改名一位）', [['tools/verify.js',
  '    ["ui.js", "function fontsReady() {", 1,', '    ["ui-x.js", "function fontsReady() {", 1,']],
  '登记了 §51 没读的文件');
t('S08 ZERO51 四元组形状守卫抬一位', [['tools/verify.js',
  "    if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {\n      F51('ZERO51 有一条不是",
  "    if (!Array.isArray(a) || a.length !== 5 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {\n      F51('ZERO51 有一条不是"]],
  '不是「[文件, 串, 正向对照源码, 原因]」四元组');
t('S09 期望 0 那一半的判据挪一格（干净树当场红：证明这 9 族真的在被逐条问「回来了吗」）', [['tools/verify.js',
  "    if (cnt51(V51[f], needle) !== 0) F51(f + ' 里出现「'",
  "    if (cnt51(V51[f], needle) !== 1) F51(f + ' 里出现「'"]],
  '里出现「');
t('S10 正向对照那一半失效时不许静默（期望 0 的 0 必须是量出来的，不是没人问）', [['tools/verify.js',
  "    if (cnt51(flat51(ctrl), needle) < 1) F51('「'",
  "    if (cnt51(flat51(ctrl), needle) < 2) F51('「'"]],
  '这条期望 0 的正向对照失效了');
t('S11 ③ 档点名表表长守卫抬一位（表自己缩水，那个「T3 命中数」就成了空断言）', [['tools/verify.js',
  "    if (T3.length !== 10) F51('③ 档点名表长 '", "    if (T3.length !== 11) F51('③ 档点名表长 '"]],
  '③ 档点名表长 10 条／期望 10（表自己缩水');
t('S12 留-generic 点名表表长守卫抬一位', [['tools/verify.js',
  "    if (T2GEN.length !== 1) F51('② 档留 generic 的点名表长 '",
  "    if (T2GEN.length !== 2) F51('② 档留 generic 的点名表长 '"]],
  '② 档留 generic 的点名表长 1 条／期望 1');
t('S13 白名单那把尺子的正向自校准改成恒真（合成那条硬写桌面名的行必须落进绕过档，否则「绕过 = 0」只是尺子瞎）', [['tools/verify.js',
  '    if (TOKEN_DEF(CAL_BAD.ln) || WIRED(CAL_BAD.val) || INHERIT(CAL_BAD.val) || MONO(CAL_BAD.val) || SYS(CAL_BAD.val)) {',
  '    if (true) {']],
  '白名单那把尺子失准');
t('S14 白名单的反向自校准条件取反（var(--tnp-fd) 必须被放行，否则改名后的合法接线会被整批判成绕过，然后这把刀被人关掉）', [['tools/verify.js',
  '    if (!WIRED(CAL_OK)) F51(', '    if (WIRED(CAL_OK)) F51(']],
  '白名单那把尺子反向失准');
t('S15 分母下界抬一档（readdir 或过滤条件被动过，这把尺子就不再覆盖全产品面）', [['tools/verify.js',
  "    if (FILES.length < 100) F51('根目录只扫到 '", "    if (FILES.length < 200) F51('根目录只扫到 '"]],
  '根目录只扫到 106 个');
t('S16 绕过档的判据挪成恒真（这一支是活的、消息能落地；证的不是「摘掉有人报」——干净树上摘掉本来静默）', [['tools/verify.js',
  "    if (bypass.length) F51('白名单之外还剩 '", "    if (bypass.length >= 0) F51('白名单之外还剩 '"]],
  '白名单之外还剩 0 处');
t('S17 不含品牌族那把尺子的判据挪成恒真（同上：这一族在② 档 15 枚上整体兜住）', [['tools/verify.js',
  "    if (var51.noBrand) F51('② 档 canvas 落笔里有 '", "    if (var51.noBrand >= 0) F51('② 档 canvas 落笔里有 '"]],
  '② 档 canvas 落笔里有 0 处');
t('S18 留-generic 命中数与表长对账的条件抬一位', [['tools/verify.js',
  '    if (var51.T2gen !== T2GEN.length) F51(', '    if (var51.T2gen !== T2GEN.length + 1) F51(']],
  '读到的不是 1 枚而是 1 枚');
t('S19 ③ 档命中下界那把比较号方向反过来（点名表 10 条 vs 现场 11 处：行被改形状或挪走就该红）', [['tools/verify.js',
  '    if (var51.T3 < T3.length) F51(', '    if (var51.T3 >= T3.length) F51(']],
  '③ 档点名表 10 条里现场只命中 11 处');
t('S20 出图口闸门计数的期望从 1 抬成 2（0 处＝那一支还在烤兜底字，2 处＝有人 await 两次，两种都得红）', [['tools/verify.js',
  "      if (G[f] !== 1) F51(f + ' 里 fontsReady", "      if (G[f] !== 2) F51(f + ' 里 fontsReady"]],
  '里 fontsReady().then(go, go) 实得 1，期望 1');
t('S21 fontsReady 定义单点那把尺子的期望抬一位', [['tools/verify.js',
  '    if (DEF51b !== 1) F51(', '    if (DEF51b !== 2) F51(']],
  'fontsReady 的定义在四个相关文件里读到 1 处，期望 1');
t('S22 同名那把尺子的自校准下界抬一位（合成两枚确在场的全站名必须撞上 ≥2，撞不上则「同名 = 0」不是证据）', [['tools/verify.js',
  '    if (sameCal < 2) F51(', '    if (sameCal < 3) F51(']],
  '同名那把尺子失准');
t('S23 同名覆盖那把尺子的判据挪成恒真（这一枚就是本批的根因：注入串比宿主页后加载，:root 上后来者胜）', [['tools/verify.js',
  "    if (same.length) F51('travel-notes.js 注入串与 design.css 同名令牌 '",
  "    if (same.length >= 0) F51('travel-notes.js 注入串与 design.css 同名令牌 '"]],
  '同名令牌 0 枚');
t('S24 私名族在场那一条取反（改名那一族整体没了 ⇒「同名 = 0」大概只是因为注入串自己没了）', [['tools/verify.js',
  "    if (!tnp.length) F51('注入串里一枚 --tnp-* 私有名都读不到", '    if (tnp.length) F51(\'注入串里一枚 --tnp-* 私有名都读不到']],
  '一枚 --tnp-* 私有名都读不到');
t('S25 ④ 循环上限对账的条件改错一格（上限必须等于最大编号减 1：FO22 是条数守卫，写在最后一条）', [['tools/verify.js',
  '      else if (Number(BOUND51) !== MAXN51 - 1) F51(', '      else if (Number(BOUND51) !== MAXN51) F51(']],
  '④ 齐备检的循环上限是 21，而这条腿里真实最大编号是 FO22');
t('S26 ④ 齐备检收窄一格（少守一条判据，而它自己永远不会红——由 S25 那把对账抓到）', [['tools/verify.js',
  '    for (let i = 0; i <= 21; i++) {\n      const lab = "ok(\'FO"', '    for (let i = 0; i <= 20; i++) {\n      const lab = "ok(\'FO"']],
  '循环上限是 20');
t('S27 条数守卫在场那条的期望抬一位', [['tools/verify.js',
  "    if (cnt51(S51, \"ok('FO22 \") !== 1) F51(", "    if (cnt51(S51, \"ok('FO22 \") !== 2) F51("]],
  'FO22（条数守卫）不在场');
t('S28 名单长度守卫那条锚的期望抬一位（名单自己缩水时，「旧名读取 0 处」会变成空断言）', [['tools/verify.js',
  "    if (cnt51(S51, 'ALIAS17.length !== 17') !== 1) F51(", "    if (cnt51(S51, 'ALIAS17.length !== 17') !== 2) F51("]],
  '腿里那张 17 枚名单的长度守卫没了');
t('S29 A51 里那条「条数守卫」锚的期望从 1 抬成 2', [['tools/verify.js',
  "    ['tools/smoke-font.js', 'checks >= 22', 1,", "    ['tools/smoke-font.js', 'checks >= 22', 2,"]],
  '条数守卫（本闸门自己也会被删）');
t('S30 A51 里那条「三处永不落定 stub」锚的期望从 3 抬成 4（这一族的计数就是这一批改口径改出来的，抄死会长期红或被顺手删）', [['tools/verify.js',
  "window.UI.fontsReady = () => new Promise(function () {});', 3,", "window.UI.fontsReady = () => new Promise(function () {});', 4,"]],
  '永不落定那一发在三个出图口各打一次');
t('S31 同名集合的取法改错（split 取冒号后面那一段 ⇒ 集合变成值，自校准当场撞不上）', [['tools/verify.js',
  "    const names = s => new Set((s.match(DECL) || []).map(x => x.split(':')[0]));",
  "    const names = s => new Set((s.match(DECL) || []).map(x => x.split(':')[1]));"]],
  '下面那句「同名 = 0」就不是证据');

/* ---------- ③ 腿 / 探针 / 文档脚手架 ---------- */
t('T01 腿里那个纸色写成第二份真值（产品改了值、腿还断旧值就是这么来的）', [['tools/smoke-font.js',
  "const PANEL_BG = '#f6f1e5';", "const PANEL_BG = '#fbf8f1';"]],
  '腿里那个纸色必须是从注入串派生的常量');
t('T02 页内那把墨量刀改名（puppeteer 只序列化第一个函数参数，这把刀必须住在页面里）', [['tools/smoke-font.js',
  'window.__INK = function (font) {', 'window.__INK9 = function (font) {']],
  '墨量这把刀住在页面里');
t('T03 FO12 的判据退回我自己先写错的那一版（写成「落回 64px 兜底族」；实测是整条 font 被丢、连字号一起丢）', [['tools/smoke-font.js',
  'FR.bad === FR.ua && FR.bad !== FR.fb && FR.bad !== FR.brand', 'FR.bad === FR.fb']],
  'FO12 的判据是');
t('T04 海报那一臂摘掉永不落定的 stub（三个出图口就是三发，少一处就是那一路的「排在字库后面」没人反证）', [['tools/smoke-font.js',
  "    const real = window.UI.fontsReady;\n    window.UI.fontsReady = () => new Promise(function () {});\n    window.__HOOK(true);\n    window.FootprintPoster.generate(false, 'ink');",
  "    const real = window.UI.fontsReady;\n    window.__HOOK(true);\n    window.FootprintPoster.generate(false, 'ink');"]],
  '永不落定那一发在三个出图口各打一次');
t('T05 reject 那一档的反证被摘（保险丝不许把出图整个吃掉：这种静默失效源码腿读不出来）', [['tools/smoke-font.js',
  "    window.UI.fontsReady = () => Promise.reject(new Error('no font'));   // 读不到字库：照样放行\n",
  '']],
  'reject 那一档必须照样落笔');
t('T06 卡片那一路把「确认出口在场」那一发改成问全局对象（真鼠标那颗钮是这条腿唯一的出口，genCard 没导出）', [['tools/smoke-font.js',
  "const HASBTN = await page.evaluate(() => !!document.querySelector('#tnListBody [data-a=card]'));",
  "const HASBTN = await page.evaluate(() => !!window.TravelNotes);"]],
  '卡片那一路走真鼠标点那颗钮');
t('T07 腿里的条数守卫阈值抬一档（判据 23 条，ok() 在自增前求值所以写 22：抬一档就当场红）', [['tools/smoke-font.js',
  'checks >= 22,', 'checks >= 23,']],
  '条数守卫（本闸门自己也会被删）');
t('T08 腿里那张 17 枚名单缩一枚（首跑这条是假绿灯：只钉「ALIAS17.length !== 17」那一行守不住名单自己少一枚——名单整串现已进 A51）', [['tools/smoke-font.js',
  "  const ALIAS17 = ['--fd', '--fb', '--b6', '--b7', '--b9', '--a3', '--d3', '--bg', '--sf', '--sf2', '--ln', '--i9', '--i7', '--i5', '--sm', '--tf', '--tn'];",
  "  const ALIAS17 = ['--fd', '--fb', '--b6', '--b7', '--b9', '--a3', '--d3', '--bg', '--sf', '--sf2', '--ln', '--i9', '--i7', '--i5', '--sm', '--tf'];"]],
  '名单自己少一枚');
t('T09 腿里把 FO15 的标签改名（④ 齐备检逐条问「这条判据还在吗」，改编号会让整节齐备检集体失效）', [['tools/smoke-font.js',
  "  ok('FO15 读不到字库时不许把出图整个吃掉", "  ok('FOX5 读不到字库时不许把出图整个吃掉"]],
  '这条判据不是恰 1 处');
tAll('T10 README 抹掉 §51 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§51', '§5Y', '的 verify 清单没提 §51');
tAll('T11 README 抹掉这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-font', 'smoke-fnt', '没登记 tools/smoke-font.js');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 @font-face 注册的名字与 ctx.font 写的名字分叉（源码腿只查「② 档每一行字面含 TRACE Serif」，查不到另一头叫什么；品牌字到底上没上屏只有墨量尺子知道）——期望红在 FO10',
  [['design.css',
    "@font-face{font-family:'TRACE Serif';font-style:normal;font-weight:400;",
    "@font-face{font-family:'TRACE SerifX';font-style:normal;font-weight:400;"],
   ['design.css',
    "@font-face{font-family:'TRACE Serif';font-style:normal;font-weight:700;",
    "@font-face{font-family:'TRACE SerifX';font-style:normal;font-weight:700;"]], 'FO10');
gBoth('U02 fontsReady 成功时返回 false（A51 钉的是那几行的形状：两个字重、兜底、导出，不是那个布尔；「锁到了字库」这件事只有页内读得到）——期望红在 FO08',
  [['ui.js', ']).then(function (list) { return !!(list && list.length); }, function () { return false; });',
    ']).then(function (list) { return false; }, function () { return false; });']], 'FO08');
gBoth('U03 海报出图口在闸门**前面**多打一发 go()（闸门行还在、计数还是 1：源码腿数得出「挂了」，数不出「排在前面」）——期望红在 FO17',
  [['poster.js',
    '    function go() { renderPoster(landscape, themeName); }\n    if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);',
    '    function go() { renderPoster(landscape, themeName); }\n    go();\n    if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);']], 'FO17');
gBoth('U04 轨迹卡出图口在闸门前多打一发（同一族第二个口：这一支的落笔计数只有页内那把刀量得到）——期望红在 FO14',
  [['travel-map.html',
    '  function go(){ drawTrackCard(themeId); }\n  if(window.UI&&window.UI.fontsReady) window.UI.fontsReady().then(go,go);',
    '  function go(){ drawTrackCard(themeId); }\n  go();\n  if(window.UI&&window.UI.fontsReady) window.UI.fontsReady().then(go,go);']], 'FO14');
gBoth('U05 分享卡片那一路在闸门前多打一发（第三个口；这颗钮是真鼠标点的，直调那一形 §51 另有锚）——期望红在 FO20。首跑这条打红了源码腿两条：那一发插成新的一行 ⇒ travel-notes.js 下面所有行号 +1 ⇒ ② 档点名表钉的 (2278) 与 ③ 档那几枚一起漂，扫描器当场把「留 generic 那枚读成 0 枚」＋「不含品牌族 1 处」两条都红了（红是响的，但那条靶子的期望就成了「源码腿必须绿」）。所以这一发的插入必须留在闸门那一行内，不许改变行数',
  [['travel-notes.js',
    '    if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);',
    '    go(); if (window.UI && window.UI.fontsReady) window.UI.fontsReady().then(go, go);']], 'FO20');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    if (!c.edits || !c.edits.length) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：没有 edits'); bad++; return; }
    c.edits.forEach(ed => {
      const f = ed[0], from = ed[1], to = ed[2];
      if (typeof from !== 'string' || typeof to !== 'string') {
        console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 的 from/to 不是串（' + typeof from + '/' + typeof to + '）');
        bad++; return;
      }
      if (from === to) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：from 与 to 相同（恒等变异，打不红）'); bad++; return; }
      if (ORIG[f] === undefined) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：文件 ' + f + ' 不在快照里'); bad++; return; }
      const src = eol(from, f);
      const hits = ORIG[f].split(src).length - 1;
      if (c.kind === 'all') { if (!hits) { console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 在 ' + f + ' 一次都没命中（抹登记那一族要的是「全部出现」）'); bad++; } }
      else if (hits !== 1) {
        console.log('预检 FAIL ' + c.name.slice(0, 34) + ' 在 ' + f + ' 命中 ' + hits + ' 次（要恰 1 次）：「' + from.slice(0, 46) + '」');
        bad++;
      }
    });
    /* U 类还要证明「源码腿此刻是绿的」：任何一条 U 打了别的产品文件之外的锚，会在实跑时以异常露出来 */
  });
  return bad;
}
const PBF = preflight();
console.log('=== mut-verify51 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['ui.js',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function tail2(e) { return '\nTHROW ' + String((e && e.message) || e).slice(0, 200) + '\nSTDERR ' + String((e && e.stderr) || '').split('\n').slice(-6).join('\n'); }
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, ['tools/smoke-font.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
const S51 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §51') === 0);
const B51 = o => String(o).split('\n').filter(l => /FAIL\s+FO\d/.test(l));

const why = r => String(r.out).split('\n').filter(l => l.indexOf('THROW') >= 0 || l.indexOf('STDERR') >= 0).join(' | ') || '(没抓到 THROW 行)';
const vbase = runVerify(), f0 = S51(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §51 有 ' + f0.length + ' 条红；整跑' + (vbase.green ? '绿（那就是 §51 自己红了）' : '不绿，原因：' + why(vbase)) + '\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§51 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM51 = String(vbase.out).split('\n').filter(l => l.indexOf('字族三档与注入串闸门:') === 0)[0] || '';
const LEN51 = (SUM51.match(/A51 表长 (\d+) 条、ZERO51 表长 (\d+) 条/) || []).slice(1);
if (LEN51.join('/') !== '34/9') { console.log('中止：基准摘要里的表长是 ' + LEN51.join('/') + '，而本网登记的是 A51 34／ZERO51 9——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
const READ51 = (SUM51.match(/根目录 (\d+) 个 js\/html\/css 里绕过 (\d+) 处/) || []).slice(1);
if (READ51.join('/') !== '106/0') { console.log('中止：基准摘要里的全量读数是 ' + READ51.join('/') + '，而本网登记的是 106 个／绕过 0 处——那把白名单尺子已经不在同一个基准上了'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A51 表长 ' + LEN51[0] + '／ZERO51 表长 ' + LEN51[1] + '／根目录 ' + READ51[0] + ' 个文件绕过 ' + READ51[1] + ' 处，与本网登记一致）');
const sbase = runSmoke(), c0 = B51(sbase.out);
if (c0.length || !sbase.green) {
  console.log('中止：基准 smoke-font 有 ' + c0.length + ' 条红；整跑' + (sbase.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(sbase)));
  console.log((c0.length ? c0.slice(0, 4).join('\n') : String(sbase.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
  process.exit(2);
}
console.log('基准 smoke-font 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS  FO') >= 0).length + ' 条）');

/* ============ 逐条打靶 ============ */
const ONLY = (process.env.MUT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
let okRed = 0, okSilent = 0, weird = 0, skipped = 0;
CASES.forEach(c => {
  if (ONLY.length && !ONLY.some(k => c.name.indexOf(k) === 0)) { skipped++; return; }
  try {
    c.edits.forEach(ed => {
      const f = ed[0], src = eol(ed[1], f), tgt = eol(ed[2], f);
      const p = path.join(ROOT, f);
      let text = fs.readFileSync(p, 'utf8');
      if (c.kind === 'all') text = text.split(src).join(tgt);
      else {
        if (text.split(src).length - 1 !== 1) throw new Error('运行时命中数变了：' + f);
        text = text.split(src).join(tgt);
      }
      fs.writeFileSync(p, text);
    });
  } catch (e) {
    weird++; console.log('异常 ' + c.name.slice(0, 40) + '  → 打靶本身失败：' + e.message); restore(); return;
  }
  const vr = runVerify();
  const reds = S51(vr.out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B51(sm.out);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，浏览器腿红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §51 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify51: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-font，它按固定文件名落读数 tools/out/b35b-smoke-font.txt；跑完要在干净树上复跑一次这条腿并把读数盖回去。');
process.exit(weird ? 1 : 0);
