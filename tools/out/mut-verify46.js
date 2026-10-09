/* tools/out/mut-verify46.js — verify.js §46「日期显示口径闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处（R13 与 U02 是两处：一条产品形状 + 摘掉扫描器的一类信号），跑一遍 node tools/verify.js，
 * 必须在**指定的那条红**里看见它（§46 族看 FAIL §46）；打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §46 的靶子分四类：
 *   ① 显示落点回归 / 出口被拆（R01–R13）：本批删掉的旧写法逐处插回去（裸读 n.date、点号形、页内自拼、
 *      第二份短档、第二份宽松解析），外加三种「没登记过的形状」—— locale 混进来（R11）、新长出一枚
 *      手拼+渲染（R12）、渲染信号名单被摘（R13）。后三条红在动态扫描而不是串匹配：登记表守得住抄下来的
 *      二十四行，守不住第二十五行。
 *   ② 守卫自己（S01–S15）：共享剥刀／文档那一支／盲区哨兵／A46 与 ZERO46 的四元组形状／正向对照失效／
 *      登记没读的文件／五把扫描各自的自校准／两条分母下限／齐备检的循环上限／条数守卫阈值／README 抹登记。
 *   ③ 浏览器腿脚手架（T01–T07）：摘判据、改编号、摘三枚分母与反证、形状刀行内重打、真机档退回 452、
 *      时间视图那一支不再切。
 *   ④ 两条腿的分工样本（U01–U03：源码腿必须全绿，浏览器腿必须红在指名那条）：
 *      U01 fmtDay 内部的补零摘掉（锚钉的是那一行的**前缀**，尾部的 p() 一改不到；屏上立刻回到
 *         2026-10-8 → D01 红）；
 *      U02 在单点**之后**做字符串手术（me.html 把统一串再 replace 成点号形）：调用点计数没变、没有任何锚
 *         钉这一行的形状、ZERO46 钉的是「从零拼」的源码串——源码腿永久沉默，只有整屏普查抓得到 → D10 红；
 *         两条一起（产品一行 + 摘掉 locale 刀的信号名单？不是，这里只改产品一行）。
 *      U03 noteDay 坏 ts 那一支不再读空而把原值转成串（D01 与 D19 都要红：noteDay 的锚只钉函数名那一行）。
 *   为什么必须有 ④：本批用户报的症状就是「键对了、屏上五种写法」，源码腿结构性读不到「渲染出来的那一串
 *      长什么样」；①②③ 全对也只证明锚在场，不证明锚抓得住下一刀砍在出口之后。
 *
 * 第一轮全量跑（读数 tools/out/b31-mut-verify46.txt）出三条异常，逐条查到底是谁的错：
 *   R12 —— 靶子的错。它拿 .title = 造第二枚手拼，而渲染信号名单里没有 .title，扫描器按口径不认（现场实测：
 *          全树「手拼年月日 + .title」0 处）。口径不收 tooltip：手机 APK 上那层根本不出屏，属设计内静默。
 *          已改用 innerHTML 重造这一发（改的是靶子，闸门没动）。
 *   S14/T02 —— 又是「子串碰撞」，这次发作在网自己身上：S14 把 verify 的 needle 从 checks >= 24 改成 checks >= 2，
 *          而后者是前者的前缀子串，cnt46 照样读 1；T02 把 const SHAPE_SRC 改名成 const SHAPE_SRC_UNUSED，同理。
 *          两条都改成动真身：S14 改 smoke-date.js 的 checks >= 24，T02 把刀体行内重打一遍。
 *   T02 顺带查出闸门一条**真**缺陷：旧锚只数「声明在场」，数不出「行内又重打一份」。已补一条 A46 锚
 *          'new RegExp(SHAPE_SRC' 恰 1（表长 35 → 36），并把旧锚那句「只写一次」改成实话「只声明一份」。
 *
 * 剔除的两条（原本想当靶子，实测是恒等变异或压根不红）：
 *   ✗ 摘掉 travel-map.html 的 `const tl=...` 之外的排序那一支：全树实测剩 18 行同款裸 a.ts-b.ts（本批只修证据
 *     点名的那一行），把它们改成别的形状不会让 §46 红——那 18 行本来就没登记，是覆盖面账不是锚。
 *   ✗ 把 index.html:471 那枚豁免的手拼改成走单点：屏上读数不变（那是设备月份 label，不是游记日期），
 *     源码腿会红在「全站仅剩的那一枚手拼不是它」——看着像有牙，实际守的是字符串位置而非行为，留在网里会
 *     让人以为「豁免那行被守住了」。
 *
 * 用法:
 *   node tools/out/mut-verify46.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify46.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify46.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b31-mut-verify46.txt node tools/out/mut-verify46.js
 * **不要与别的变异网或像素基线并行**：本网动的是 13 个产品文件 + tools/verify.js + tools/smoke-date.js +
 *   README.md，像素基线量的就是同一批屏；
 *   也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   网里的 U 类会重跑 smoke-date，它按固定文件名落读数吗？不——smoke-date 的读数由调用方的 shell 重定向
 *   决定，子进程里的两次重跑不会覆盖 tools/out/b31-smoke-date.txt；但干净树基准那一跑会留下 process 输出，
 *   所以跑完仍要在干净树上复跑一次 tools/smoke-date.js 把基准读数盖回证据文件。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。
   本网快照 20 个文件，与 mut-verify45 重叠 11 个（results.js／review.html／travel-notes.js／travel-map.html／
   md-manager.html／settings.html／album.js／wishlist.html／vault.js／tools/verify.js／README.md），
   与 mut-verify44 重叠 travel-map.html 与 README.md。两张网并发＝后还原那张把前一张的还原一并抹掉。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut46.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut46.lock');
if (BUSY.length) { unlock(); console.log('中止：' + OUTDIR + ' 里还有别的变异网锁 ' + BUSY.join('、') + '（快照与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['travel-notes.js', 'results.js', 'review.html', 'travel-map.html', 'md-manager.html',
  'settings.html', 'planner.js', 'album.js', 'wishlist.html', 'vault.js', 'index.html',
  'story.html', 'search.html', 'me.html', 'poster.js', 'album-edit.html',
  'tools/verify.js', 'tools/smoke-date.js', 'tools/smoke-coord.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); unlock(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上（指纹含批次 31 的三处新修复） */
const FP = [
  ['tools/verify.js', '§46 日期显示口径闸门'],
  ['tools/verify.js', 'const flat46 = s => ws46(stripBlockComments(s));'],
  ['tools/verify.js', "if (L46.indexOf('.md$') < 0) F46('view46"],
  ['tools/verify.js', 'if (var46.parse !== 1) F46('],
  ['tools/verify.js', 'for (let i = 1; i <= 22; i++) {'],
  ['tools/verify.js', "cnt46(S46, 'checks >= 24') !== 1"],
  ['tools/verify.js', "'new RegExp(SHAPE_SRC'"],
  ['tools/smoke-date.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-date.js', "ok('D18b "],
  ['tools/smoke-date.js', "ok('D20b "],
  ['travel-notes.js', 'function dayText(n) { return noteDay(n); }'],
  ['travel-notes.js', "function fmtDay(ts) { var d = new Date(ts); if (!isFinite(d.getTime())) return '';"],
  ['travel-map.html', '.sort(function(a,b){return (a.ts||0)-(b.ts||0);})'],
  ['travel-map.html', "var time=TravelNotes.fmtDayText(n.ts).slice(5)+' '+TravelNotes.fmtClock(n.ts);"],
  ['story.html', "var _sp=cards.map(function(n){return n.ts;}).filter(function(t){return typeof t==='number'&&isFinite(t);});"],
  ['search.html', 'try { TravelNotes.init({}); } catch (e) {}'],
  ['me.html', "esc(TravelNotes.dayText(n))"],
  ['README.md', '§46 日期显示口径'],
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

/* ---------- ① 显示落点回归 / 出口被拆 ---------- */
t('R01 屏上日期唯一出口退回裸读字段（本批五种写法的成因原地复活）', [['travel-notes.js',
  '  function dayText(n) { return noteDay(n); }',
  "  function dayText(n) { return (n.date || '').slice(0, 10); }"]],
  '屏上日期唯一出口');
t('R02 纪念册卡面把裸 n.date 抄回屏上（ZERO46 第一族＋调用点分母一起红）', [['results.js',
  "        + '<div class=\"m\">' + esc(TravelNotes.dayText(n)) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'",
  "        + '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'"]],
  '纪念册卡面又把裸 n.date 抄回屏上');
t('R03 review 日卡的 .meta 退回原始字段', [['review.html',
  "      '<div class=\"meta\">'+esc(dayOf(n))+(n.weather?' · '+esc(n.weather):'')+'</div>'+",
  "      '<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+'</div>'+"]],
  'review 日卡的 .meta 回到裸读日期字段');
t('R04 随手记列表卡 .tm 退回原始字段（用户看得最多的那一行）', [['travel-notes.js',
  "</h4><div class=\"tm\">' + esc(dayText(n)) + '</div>",
  "</h4><div class=\"tm\">' + esc(n.date) + '</div>"]],
  '列表卡 .tm 退回原始字段');
t('R05 时间线胶囊的短档退回点号形（这一支的 slice 本来就是从单点派生，改回自己拼就没了出口）', [['travel-map.html',
  "      var time=TravelNotes.fmtDayText(n.ts).slice(5)+' '+TravelNotes.fmtClock(n.ts);",
  "      var d=new Date(n.ts);var time=d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');"]],
  '时间线胶囊的短档');
t('R06 云同步「上次同步」退回页内自拼（月那段还漏补零，10-8 与 10-08 同屏并存）', [['settings.html',
  "      line('wdStatus', '上次同步 ' + TravelNotes.fmtDayText(l.ts).slice(5) + ' ' + TravelNotes.fmtClock(l.ts) + '：' + (l.msg || ''), l.ok ? 'ok' : 'err');",
  "      line('wdStatus', '上次同步 ' + (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + '：' + (l.msg || ''), l.ok ? 'ok' : 'err');"]],
  '「上次同步」回到页内自拼');
t('R07 心愿单那一档退回点号形（把出口换成页内从零拼）', [['wishlist.html',
  '  function fmt(ts) { return TravelNotes.fmtDayText(ts); }',
  "  function fmt(ts) { var d = new Date(ts); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate()); }"]],
  '心愿单那档回到点号形');
t('R08 相册章标题退回点号形，并把 album 那枚零调用者的第二份短档一起写回来', [['album.js',
  '  function fmtD(ts) { return TravelNotes.fmtDayText(ts); }',
  "  function fmtD(ts) { var d = new Date(ts); return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }\n  function fmtDM(ts) { var d = new Date(ts); return pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }"]],
  '零调用者的第二份短档又被写回来');
t('R09 数据管理页再开第二份宽松解析（全站「四位年 + 任意分隔」从 1 处变 2 处＝本批五种写法的成因）', [['md-manager.html',
  "  function ymOf(n) { return dayText(n).slice(0, 7) || '未知'; }",
  "  function ymOf(n) { var s = String((n.date || '') + ' ' + (n.day || '')); var m = s.match(/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/); return m ? m[1] + '-' + m[2] : '未知'; }"]],
  '宽松解析从 1 处');
t('R10 导出索引的头一行退回 locale（同一份导出在两台手机上印两种样子）', [['vault.js',
  "'> 由 行迹 TRACE 导出 · ' + TravelNotes.nowDayText()",
  "'> 由 行迹 TRACE 导出 · ' + new Date().toLocaleDateString()"]],
  '屏上读数又交给系统 locale 了');
t('R11 首页那句设备月份 label 被「顺手统一」成 locale（豁免那一支改走 locale：口径漂了，而锚还在）', [['index.html',
  "    document.getElementById('seasonTitle').textContent = (new Date().getMonth() + 1) + ' 月，去哪？';",
  "    document.getElementById('seasonTitle').textContent = new Date().toLocaleDateString() + '，去哪？';"]],
  '屏上读数又交给系统 locale 了');
t('R12 新长出一枚没登记的手拼+渲染（登记表守得住二十四行，守不住第二十五行）', [['index.html',
  "    document.getElementById('seasonTitle').textContent = (new Date().getMonth() + 1) + ' 月，去哪？';",
  "    document.getElementById('seasonTitle').textContent = (new Date().getMonth() + 1) + ' 月，去哪？';\n    document.getElementById('seasonSub').innerHTML = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate();"]],
  '从零拼年月日又被渲染上屏');
t('R13 摘掉扫描器渲染信号名单里的 textContent（那一行照样是拼完就上屏，刀却看不见了）', [['tools/verify.js',
  "    const REND46 = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'textContent', 'rows.push(', 'line(', 'status'];",
  "    const REND46 = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'rows.push(', 'line(', 'status'];"]],
  '从零拼年月日又被渲染上屏');

/* ---------- ② 守卫自己 ---------- */
t('S01 共享剥刀退回不剥注释（flat46 的定义行自己有哨兵：注释里抄的改前原串会被当成代码在场）', [['tools/verify.js',
  '  const flat46 = s => ws46(stripBlockComments(s));',
  '  const flat46 = s => ws46(s);']],
  'flat46 定义行没走那把共享剥刀');
t('S02 文档那一支退回「README 也剥注释」（登记串里天生要写这族的形状，文档侧的锚会当场读 0）', [['tools/verify.js',
  '  const view46 = f => /\\.md$/.test(f) ? ws46(rd46(f)) : flat46(rd46(f));',
  '  const view46 = f => flat46(rd46(f));']],
  'view46 的定义行退回');
t('S03 盲区哨兵：settings 那行只把「上次同步 」的尾空格改掉（三枚哨兵各钉一处本批改过的行旁边；红必须指名「这一带又变成盲窗」，不能只报锚缺失）', [['settings.html',
  "line('wdStatus', '上次同步 ' + TravelNotes.fmtDayText(l.ts)",
  "line('wdStatus', '上次同步：' + TravelNotes.fmtDayText(l.ts)"]],
  '盲区哨兵');
t('S04 调用点扫描器失准（下面那张逐文件对账会当场变成空断言）', [['tools/verify.js',
  '    const RE46 = /TravelNotes\\.(dayText|noteDay|nowDayText|fmtDayText|fmtClock)\\(/g;',
  '    const RE46 = /TravelNotes\\.ZZZneverZZZ\\(/g;']],
  '调用点扫描器自己失准');
t('S05 locale 那把刀失准（全站 0 就从证据变成刀瞎）', [['tools/verify.js',
  '    const RE46L = /toLocale(?:Date|Time)String\\s*\\(/g;',
  '    const RE46L = /toLocaleZZZ(?:Date|Time)\\s*\\(/g;']],
  'locale 那把刀自己读不到合成样本');
t('S06 宽松解析那把刀失准（全站 1 同理）', [['tools/verify.js',
  "    const NEED46P = '(\\\\d{4})\\\\D';",
  "    const NEED46P = '(\\\\d{9})\\\\DZZZ';"]],
  '宽松解析那把刀读不到合成样本');
t('S07 裸读 .date 的白名单失准：把 expense 域那一族从登记表里摘掉（新增落点就没人守了）', [['tools/verify.js',
  "      'expense-form.js': 2, 'expense.html': 4, 'expense.js': 7,",
  "      'expense-form.js': 2, 'expense.html': 4,"]],
  '裸读 .date 的行数与登记对不上');
t('S08 正向对照失效：把 ZERO46 第一族的 needle 换成树上没有的串（那个 0 就不再是证据）', [['tools/verify.js',
  "    ['results.js', 'esc(n.date)',",
  "    ['results.js', 'esc(n.dateZZZ)',"]],
  '正向对照失效了');
t('S09 A46 有一条被拆成三元组（少字段会解构错位，这条锚等于没跑）', [['tools/verify.js',
  "    ['travel-notes.js', 'function noteDay(n) {', 1, '§41 的归一键仍是唯一解析处（dayText 只调它，不再开第二份）'],",
  "    ['travel-notes.js', 'function noteDay(n) {', 1],"]],
  '不是「[文件, 串, 期望次数, 原因]」四元组');
t('S10 A46 登记了 §46 没读的文件（名单与登记表分家时，那条锚静默通过）', [['tools/verify.js',
  "    ['vault.js', \"'> 由 行迹 TRACE 导出 · ' + TravelNotes.nowDayText()\", 1,",
  "    ['vaultX.js', \"'> 由 行迹 TRACE 导出 · ' + TravelNotes.nowDayText()\", 1,"]],
  '登记了 §46 没读的文件');
t('S11 单点调用点的分母下限从 40 抬到 400（口径被改窄时，逐文件对账全在带内也照样绿）', [['tools/verify.js',
  '    if (var46.calls < 40) F46(',
  '    if (var46.calls < 400) F46(']],
  '全站单点调用只剩');
t('S12 裸读 .date 的分母下限挪高（记账域那一族被顺手砍时没人喊）', [['tools/verify.js',
  '    if (var46.datelines < 15) F46(',
  '    if (var46.datelines < 1500) F46(']],
  '扫描口径漂了');
t('S13 齐备检循环上限从 22 收到 21（收窄一格就少守一条，而且它自己永远不会红）', [['tools/verify.js',
  '    for (let i = 1; i <= 22; i++) {',
  '    for (let i = 1; i <= 21; i++) {']],
  '循环上限是 21');
t('S14 条数守卫阈值从 24 挪到 2（删 23 条判据照样绿）〔上一发打不红是靶子自己的错：它改的是 verify.js 里的 needle 串，而 needle 写成 checks >= 2，正好是 checks >= 24 的前缀子串——「子串碰撞」这条老账在网自己身上第二次发作〕', [['tools/smoke-date.js',
  'checks >= 24',
  'checks >= 2']],
  '阈值被挪');
tAll('S15 抹掉 README 里 §46 的登记（摘登记要抹全部出现：只摘一处 indexOf 照样命中）', 'README.md', '§46', '§xx', '就等于没装');

/* ---------- ③ 浏览器腿脚手架 ---------- */
t('T01 真机档退回 452×995（量的就不是用户那块屏，§37 口径）', [['tools/smoke-date.js',
  'const VW = 328, VH = 723;',
  'const VW = 452, VH = 995;']],
  '量的必须是用户那块屏');
t('T02 形状刀行内重打（声明照旧在场，正判据与 D00 那条自校准从此各改各的）〔上一发打不红是靶子自己的错：它把声明改名成 const SHAPE_SRC_UNUSED，而 needle「const SHAPE_SRC」是它的前缀子串；这一发改用「按名字共用」那条新锚才咬得住〕', [['tools/smoke-date.js',
  "const re = new RegExp(SHAPE_SRC, 'g');",
  String.raw`const re = new RegExp('(\\d{4})([.\\-/年])(\\d{1,2})([.\\-/月])(\\d{1,2})日?', 'g');`]],
  '按名字共用');
t('T03 摘掉 D07 那一条（把 ok 换名：行注释挡不住 flat 视图，只有真删调用形才红）', [['tools/smoke-date.js',
  "  ok('D07 时间线胶囊那格是",
  "  chk('D07 时间线胶囊那格是"]],
  'D07 这条判据不是恰 1 处');
t('T04 摘掉 D00 形状刀自校准（下面十几发「0 命中」可能只是正则瞎了）', [['tools/smoke-date.js',
  "    ok('D00 形状刀自校准",
  "    chk('D00 形状刀自校准"]],
  '形状刀自校准不在场');
t('T05 摘掉 D18b 普查分母（十页全读不到日期时，十个「坏形状 0 命中」会一起绿掉）', [['tools/smoke-date.js',
  "  ok('D18b 十页普查的分母",
  "  chk('D18b 十页普查的分母"]],
  '普查分母不在场');
t('T06 摘掉 D20b（§45 的保留支：统一显示时不许顺手把坐标那一条砍掉）', [['tools/smoke-date.js',
  "  ok('D20b 复制那条文本仍带着坐标",
  "  chk('D20b 复制那条文本仍带着坐标"]],
  'D20b（复制那条仍带坐标）不在场');
t('T07 不再切到时间视图（renderItem 两支共用，只验聚合那一支＝另一支没人守：本批三条红里就有这一族）', [['tools/smoke-date.js',
  "    const b = document.getElementById('tnViewTime');",
  "    const b = document.getElementById('tnViewTimeOff');"]],
  '时间视图那一支真切换过');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 fmtDay 尾部的补零摘掉（锚钉的是那一行的前缀，p() 住在锚外；屏上立刻回到 2026-10-8）——期望红在 D01',
  [['travel-notes.js',
    "function p(n) { return (n < 10 ? '0' : '') + n; }",
    "function p(n) { return '' + n; }"]],
  'D01');
gBoth('U02 在单点之后做字符串手术（me.html 把统一读数再 replace 成点号形）：调用点计数没变、没有锚钉这一行的形状、ZERO46 钉的是「从零拼」的源码串——源码腿永久沉默，只有整屏普查抓得到——期望红在 D10',
  [['me.html',
    "'</span><span class=\"d\">' + esc(TravelNotes.dayText(n)) + '</span></div>'",
    "'</span><span class=\"d\">' + esc(TravelNotes.dayText(n).replace(/-/g, '.')) + '</span></div>'"]],
  'D10');
gBoth('U03 noteDay 坏 ts 那一支不再读空而把原值转成串（noteDay 的锚只钉函数名那一行；屏上会吐 NaN/undefined，卡片那一格也要红）——期望红在 D19',
  [['travel-notes.js',
    "    return (typeof ts === 'number' && isFinite(ts)) ? fmtDay(ts) : '';",
    "    return (typeof ts === 'number' && isFinite(ts)) ? fmtDay(ts) : String(ts);"]],
  'D19');

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
  });
  return bad;
}
const PBF = preflight();
console.log('=== mut-verify46 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证。塞一条 from 串压根不在树上的靶子 → 预检必须抓到它。
     不塞这一发的话，「网里少登记一条靶子」这件事本身没人守（§44 那张网栽过同形的一跤）。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['travel-map.html',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function runVerify() {
  try { return cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); }
  catch (e) { return String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200); }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return cp.execFileSync(process.execPath, ['tools/smoke-date.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 420000 }); }
  catch (e) { return String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200); }
}
const S46 = out => String(out).split('\n').filter(l => l.indexOf('FAIL §46') === 0);
const B46 = out => String(out).split('\n').filter(l => /^FAIL\s+D\d/.test(l));

const vbase = runVerify(), f0 = S46(vbase);
if (f0.length) { console.log('中止：基准 verify.js 的 §46 已经有 ' + f0.length + ' 条红，先修基准\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§46 之外也有红，后面的读数不可比）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（' + String(vbase).split('\n').filter(l => l.indexOf('日期显示口径闸门:') === 0)[0].slice(0, 46) + '…）');
const sbase = runSmoke(), c0 = B46(sbase);
if (c0.length) { console.log('中止：基准 smoke-date 已经有 ' + c0.length + ' 条红，先修基准\n' + c0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 smoke-date 判据全绿 ✓（' + sbase.split('\n').filter(l => l.indexOf('PASS  D') >= 0).length + ' 条）');

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
  const out = runVerify();
  const reds = S46(out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B46(sm);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && dd.length && named) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红，浏览器腿红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §46 红 ' + reds.length + ' 条，没有一条含「' + c.token + '」' +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify46: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-date；跑完要在干净树上复跑 tools/smoke-date.js 并把读数盖回 tools/out/b31-smoke-date.txt。');
process.exit(weird ? 1 : 0);
