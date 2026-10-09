/* tools/out/mut-verify48.js — verify.js §48「浮层层级与互斥闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §48 红**里看见它，
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §48 的靶子分四类：
 *   ① 层叠与互斥被拆（R01–R20）：接线退回从 panel 找（五形各一条）、触发钮反过来挪进浮层、
 *      收起少一支、qq 自己退回 $X(panel,…)、markup 与注入语句被拉开、某一层 z 挪走、
 *      一层的 position/z-index 被换序（派生刀读不到）、凭空多一层没登记、条子抬回 9500 / 挪成 7999、
 *      备份键改名 / 同文件读两次 / 从禁入名单里摘掉 / 第二出口整块被摘 / 严格比较放宽 / 12s 计时器被摘。
 *   ② 守卫自己（S01–S11）：共享剥刀、文档那一支、盲区哨兵、两把扫描各自的自校准、登记表值、
 *      键落点表期望、邻接上限、齐备检循环上限、README 抹登记两枚。
 *   ③ 浏览器腿脚手架（T01–T07）：判据改名（齐备检读不到＝这一节集体失效）、条数守卫阈值挪低、
 *      屏档退回 452×995、计时器劫持失效、三层各问一次少问一层。
 *   ④ 两条腿的分工样本（U01–U05：源码腿必须全绿，浏览器腿必须红在指名那条 L）：
 *      U01 hint 写死（锚只钉前缀，「kw 有没有真汇进来」源码腿读不到）→ L25 红；
 *      U02 清钮只清列表不清框（锚只钉 .onclick 前缀）→ L29 红；
 *      U03 结果项的追加出口被摘（§48 没钉这一行）→ L35 红；
 *      U04 条子的 position 从 fixed 退成 absolute（锚钉的是 104px+z 那一段）→ L04 红；
 *      U05 返回钮收起浮层却不召回面板（display none 两支计数仍对）→ L33 红。
 *   为什么必须有 ④：本节的立论是「层级改动要由真鼠标点得到来证明」，源码腿读的是串的在场与计数的
 *      相等，读不到「那一下点下去到底发生了什么」；①②③ 全对也只证明锚在场。
 *
 * 登记一条本网不假装覆盖的盲区：把 A48 / ZERO48 表里**整条锚删掉**不会红——§48 没有表长守卫
 *   （网自己在基准里对账摘要行的「A48 表长 31 条、ZERO48 表长 8 条」，删一条锚时那行会变成 30/7，
 *   但这个数只印在日志里、不进退出码）。所以要砍锚得连产品串一起砍（R/S 类各条都覆盖了这一支）。
 *
 * 登记第二条设计内盲区（S04 首跑栽在这里，与 §47 头部那条同因）：把某一条 `if (...) F48(` 判定
 *   那一行整句摘掉、或把它的条件挪成永不成立，都不会红——那一支本来就是「只在刀瞎了才说话」的
 *   保险，干净树上它是静默的。所以 S04/S05 打的都是**阈值**（把期望挪一格，让这条判定在干净树上
 *   当场红并印出消息），证的是「这一支是活的、消息能落地」，而不是「摘掉有人报」。
 *   摘掉整句那一支靠 ② 其余各条（扫描本体、登记表、齐备检、README）间接兜住，本网不假装覆盖。
 *
 * 记一条本网的产出（U05 首跑暴露）：L33 原样是「点返回之后 .tn-panel display=flex」，而浮层住 body
 *   且整屏不透明，面板从头到尾没被藏过——那条读的是它本来就有的样子，是空断言。腿已改成点先
 *   `display:none` 把面板按进幕内、再真点返回，并把「点前=none」写进判据（back.pre === 'none'）。
 *   现在 U05 摘掉返回钮里那句 `panel.style.display = 'flex';` 才真的红在 L33。
 *
 * 登记一条 token 口径（§47 的 R06 栽在这里，本网照同一把尺）：verify.js 印 A48/ZERO48 的红时
 *   needle 只写前 52／48 字，所以 token 要么取 needle 前 52 字以内那一段，要么取 why／reason 里的一段。
 *   本网有两条 token 是同一段 needle 的完整原文（R18 的 `||0; if(Date.now()-last>30*864e5){` 35 字、
 *   R15/S05 的扫描消息），已按现场消息逐字核过。
 *
 * 用法:
 *   node tools/out/mut-verify48.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify48.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify48.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b33-mut-verify48.txt node tools/out/mut-verify48.js
 * **不要与别的变异网或像素基线并行**：本网动的是 travel-notes.js／index.html／design.css／backup.js／
 *   settings.html／tools/verify.js／tools/smoke-layer.js／README.md，与 mut-verify46/47 重叠 verify.js、
 *   README.md 与 travel-notes.js；像素基线量的就是同一批屏。跑的时候别编辑这些文件——还原用的是启动时
 *   的快照，会把并发编辑一并抹掉。
 *   U 类会重跑 tools/smoke-layer.js（它自己把读数落到 tools/out/b33-smoke-layer.txt），
 *   所以跑完要在干净树上复跑一次这条腿，把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut48.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut48.lock');
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

const FILES = ['travel-notes.js', 'index.html', 'design.css', 'backup.js', 'settings.html',
  'tools/verify.js', 'tools/smoke-layer.js', 'README.md'];
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
  ['tools/verify.js', '④ 浏览器腿齐备检：L01'],
  ['tools/verify.js', 'const FAM48_RE = /\\.tn-([a-z0-9-]+)'],
  ['tools/verify.js', "if (String(var48.barZ) !== '8000')"],
  ['tools/verify.js', "for (let i = 1; i <= 39; i++) {"],
  ['tools/verify.js', "iQ - iB <= 60"],
  ['tools/smoke-layer.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-layer.js', "ok('L40 "],
  ['tools/smoke-layer.js', 'checks >= 38'],
  ['travel-notes.js', "var qq = document.getElementById('tnQuotes');"],
  ['travel-notes.js', "$X(qq, '#tnQuoteClear').onclick"],
  ['index.html', 'bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:8000;'],
  ['index.html', "if(w&&w.ok===true&&w.ts>last) last=w.ts;"],
  ['backup.js', "'tn_webdav_last',"],
  ['README.md', '§48 浮层层级与互斥闸门'],
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

/* ---------- ① 层叠与互斥被拆 ---------- */
t('R01 markup 与 body 注入语句被拉开（光 z:9005 在场不构成修复，本节要的是「谁把它插进 body」）', [['travel-notes.js',
  "insertAdjacentHTML('beforeend', '\\\n<div class=\"tn-quotes\" id=\"tnQuotes\">",
  "insertAdjacentHTML('beforeend', '<!-- 这一层从前住在 .tn-foot 里，孩子那个 9005 出不去 -->\\\n<div class=\"tn-quotes\" id=\"tnQuotes\">"]],
  '之间隔了');t('R02 提示语接线退回从 panel 找（写空了不报错，屏上只是少一句「已按当前地点…」）', [['travel-notes.js',
  "$X(qq, '#tnQuoteHint').textContent",
  "$X(panel, '#tnQuoteHint').textContent"]],
  "$X(panel, '#tnQuoteHint')");
t('R03 搜索框接线退回从 panel 找（markup 已在 body 上，$X 拿到 null，qs.oninput 当场炸）', [['travel-notes.js',
  "var qs = $X(qq, '#tnQuoteSearch');",
  "var qs = $X(panel, '#tnQuoteSearch');"]],
  "$X(panel, '#tnQuoteSearch')");
t('R04 结果列表接线退回从 panel 找（renderQuotes 写不进任何地方，浮层开着一片空白）', [['travel-notes.js',
  "var qlist = $X(qq, '#tnQuoteList');",
  "var qlist = $X(panel, '#tnQuoteList');"]],
  "$X(panel, '#tnQuoteList')");
t('R05 返回钮接线退回从 panel 找（浮层开了关不掉，只剩退出整页重开）', [['travel-notes.js',
  "$X(qq, '#tnQuoteBack').onclick",
  "$X(panel, '#tnQuoteBack').onclick"]],
  "$X(panel, '#tnQuoteBack')");
t('R06 清空钮接线退回从 panel 找（那一枚 44×44 的落点其实是背后的档位条）', [['travel-notes.js',
  "$X(qq, '#tnQuoteClear').onclick",
  "$X(panel, '#tnQuoteClear').onclick"]],
  "$X(panel, '#tnQuoteClear')");
t('R07 触发钮反过来挪进浮层里找（它住 .tn-foot 脚注、不在那一层里，挪过去就是拿到 null）', [['travel-notes.js',
  "$X(panel, '#tnQuote').onclick = function(){",
  "$X(qq, '#tnQuote').onclick = function(){"]],
  '触发钮**留在脚注里是设计**');
t('R08 追加成功那一支不收起浮层（用户回不到正文，而源码腿只看得见「两支各一处」这个数）', [['travel-notes.js',
  "qq.style.display = 'none';\n      flash('已追加名言",
  "flash('已追加名言"]],
  '收起这一层的两支各一处');
t('R09 浮层句柄自己退回 $X(panel, …)（层搬走了、句柄没搬走：整节改动的根就断在这一行）', [['travel-notes.js',
  "var qq = document.getElementById('tnQuotes');",
  "var qq = $X(panel, '#tnQuotes');"]],
  "$X(panel, '#tnQuotes')");
t('R10 那一层的 z 从 9005 挪到 9004（派生读到 9004／登记表写 9005：两处必须同源）', [['travel-notes.js',
  '.tn-quotes{position:fixed;inset:0;z-index:9005;display:none',
  '.tn-quotes{position:fixed;inset:0;z-index:9004;display:none']],
  '实得 z=9004／登记 9005');
t('R11 遮罩那层把 z-index 换到 position:fixed 之前（派生那把刀读不到它，这一层从此不参加对账）', [['travel-notes.js',
  '.tn-mask{position:fixed;inset:0;background:rgba(17,28,27,.6);z-index:9000;display:none}',
  '.tn-mask{inset:0;background:rgba(17,28,27,.6);z-index:9000;display:none;position:fixed}']],
  '派生不到（登记 9000）');
t('R12 凭空多一层整屏浮层而名单没跟上（本节立论是「低于整族」，族是派生的不是抄的）', [['design.css',
  'animation:tnPickFade var(--motion-fast) ease}',
  'animation:tnPickFade var(--motion-fast) ease}\n.tn-overlay{position:fixed;inset:0;z-index:9950;display:none}']],
  '没登记（新添的一整屏层');
t('R13 提醒条抬回 9500（又落进那一族中间，编辑页「加照片」重新变成死的——改前就是这一发）', [['index.html',
  'bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:8000;',
  'bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:9500;']],
  '没有低于整族');
t('R14 提醒条挪成 7999（仍然低于整族，但① 的正向锚与整族对账用的是同一个登记值 8000）', [['index.html',
  'bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:8000;',
  'bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:7999;']],
  '现场读到 7999');
t('R15 读侧键名漂一个字母（写的人还叫 tn_webdav_last：谁都不报错，那条判定从此恒弹）', [['index.html',
  "JSON.parse(localStorage.getItem('tn_webdav_last')||'null')",
  "JSON.parse(localStorage.getItem('tn_webdav_lst')||'null')"]],
  '落点与登记表对不上');
t('R16 同一个文件里读两次（出口不再唯一：谁赢看不出来）', [['index.html',
  "      var w=JSON.parse(localStorage.getItem('tn_webdav_last')||'null');",
  "      var w=JSON.parse(localStorage.getItem('tn_webdav_last')||'null');\n      var w2=JSON.parse(localStorage.getItem('tn_webdav_last')||'null');"]],
  '实得 2，期望 1');
t('R17 把这枚键从「禁入备份包」名单里摘掉（换机后另一台读到旧时间戳→该提醒的不提醒）', [['backup.js',
  "      'tn_lastBackup', 'tn_storefail_warned', 'tn_b64_warned', 'tn_lastVoiceError', 'tn_rc_idx', 'tn_emptyClosed'",
  "      'tn_lastBackup', 'tn_b64_warned', 'tn_storefail_warned', 'tn_emptyClosed'"]],
  '禁入备份包');
t('R18 第二出口整块被摘（开了自动同步的人每次冷启都被告知「数据只在本机」——这句对他就是假的）', [['index.html',
  "    try{\n      var w=JSON.parse(localStorage.getItem('tn_webdav_last')||'null');\n      if(w&&w.ok===true&&w.ts>last) last=w.ts;\n    }catch(e){}",
  "    /* 只看本机那一次 */"]],
  "||0; if(Date.now()-last>30*864e5){");
t('R19 严格比较放宽成 w.ok（字符串 "false" 也是真→永远不弹；期望 0 那一档靠的就是这个 ===true）', [['index.html',
  'if(w&&w.ok===true&&w.ts>last) last=w.ts;',
  'if(w&&w.ok&&w.ts>last) last=w.ts;']],
  '是严格比较，缺字段');
t('R20 12s 摘除计时器被摘（条子永久留在屏上，而腿 L08 靠这个全站唯一的时长截它）', [['index.html',
  '      setTimeout(function(){ d.remove(); }, 12000);',
  '      /* 到点自己摘走 */']],
  '全站用这个时长的只有这一处');

/* ---------- ② 守卫自己 ---------- */
t('S01 共享剥刀被摘（注释里抄的改前原串会被当成代码在场，八族期望 0 会当场静默满足）', [['tools/verify.js',
  'const flat48 = s => ws48(stripBlockComments(s));',
  'const flat48 = s => ws48(s);']],
  '没走那把共享剥刀');
t('S02 文档那一支退回「也剥注释」（README 里登记的改前形状天生含 /*，那一支会读 0）', [['tools/verify.js',
  'const view48 = f => /\\.md$/.test(f) ? ws48(rd48(f)) : flat48(rd48(f));',
  'const view48 = f => flat48(rd48(f));']],
  '的定义行退回');
t('S03 摘掉 index.html 那枚盲区哨兵（它贴着本批改掉的行，读不到＝这一带又成盲窗）', [['tools/verify.js',
  "     ['index.html', \"if(w&&w.ok===true&&w.ts>last) last=w.ts;\"],",
  "     ['index.html', \"这一枚哨兵被摘掉了\"],"]],
  '盲区哨兵');
t('S04 派生那把刀的自校准期望被挪一格（合成两句读 3 才算对：一挪就红，说明判定那一支是活的——整句摘掉不会红，见头部登记的设计内盲区）', [['tools/verify.js',
  "    if ((CAL48A || []).length !== 2) F48(",
  "    if ((CAL48A || []).length !== 3) F48("]],
  '刀一瞎，下面那句');
t('S05 备份键那把刀的自校准期望被挪成「0,0」（现场读 1,1：这条一挪就红，说明「刀瞎了要说话」那一支是活的；整句摘掉不会红，见头部登记）', [['tools/verify.js',
  "    if (kc.join(',') !== '1,1') F48(",
  "    if (kc.join(',') !== '0,0') F48("]],
  '备份键那把刀自校准失准');
t('S06 登记表自己的值抄错（现场 9005／登记 9004：① 的锚与 (a) 的表从此两套账）', [['tools/verify.js',
  'quotes: 9005, guide: 9006, editpage: 9010',
  'quotes: 9004, guide: 9006, editpage: 9010']],
  '实得 z=9005／登记 9004');
t('S07 键落点表的期望被抬成 2（表自己说谎时，现场读 1 也算对）', [['tools/verify.js',
  "const KEY48 = { 'tn_lastBackup': { 'index.html': 1, 'settings.html': 1, 'backup.js': 1 },",
  "const KEY48 = { 'tn_lastBackup': { 'index.html': 2, 'settings.html': 1, 'backup.js': 1 },"]],
  '实得 1，期望 2');
t('S08 邻接上限被挪到 20（现场 49：那一支当场永久红，红得没道理就没人再看它）', [['tools/verify.js',
  'else if (!(iQ > iB && iQ - iB <= 60))',
  'else if (!(iQ > iB && iQ - iB <= 20))']],
  '隔了 49 个字符');
t('S09 齐备检循环上限收窄一格（L39 从此没人守，而且它自己永远不会红）', [['tools/verify.js',
  '    for (let i = 1; i <= 39; i++) {',
  '    for (let i = 1; i <= 38; i++) {']],
  '循环上限是 38');
tAll('S10 README 抹掉 §48 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§48', '§4X', '的 verify 清单没提 §48');
tAll('S11 README 抹掉这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-layer', 'smoke-lyr', '没登记 tools/smoke-layer.js');

/* ---------- ③ 浏览器腿脚手架 ---------- */
t('T01 判据 L09 被改名（§48 的齐备检按字面 ok(\'L09 逐条数，改名＝这一条从证据链上消失）', [['tools/smoke-layer.js',
  "ok('L09 .tn-list(z:9000) 在场时提醒条中心点顶命中不是它'",
  "ok('L09b .tn-list(z:9000) 在场时提醒条中心点顶命中不是它'"]],
  '里 L09 这条判据');
t('T02 条数守卫阈值被挪低（判据少 18 条也算「跑完了」）', [['tools/smoke-layer.js',
  "ok('L39 判据条数 ≥ 38（这一节自己也是会被删的）', checks >= 38,",
  "ok('L39 判据条数 ≥ 20（阈值被挪低）', checks >= 20,"]],
  '条数守卫不在了或阈值被挪');
t('T03 取样档退回 452×995（量的不是用户那块屏，遮挡这类几像素的事就量不出来）', [['tools/smoke-layer.js',
  'const VW = 328, VH = 723;',
  'const VW = 452, VH = 995;']],
  '实得 0，期望 1：必须量用户那块屏');
t('T04 计时器劫持失效（12s 到点条子被摘走，L09–L15 量的是一块已经不存在的屏）', [['tools/smoke-layer.js',
  "if (ms === 12000 && typeof fn === 'function') {",
  "if (ms === 12001 && typeof fn === 'function') {"]],
  '截成稳定被测对象');
t('T05 三层各问一次少问一层（编辑页正是改前被压住那一层，不问就是没人守）', [['tools/smoke-layer.js',
  "  await waitShown(page, '.tn-editpage'); await settle(page, 500);\n  h = await page.evaluate('window.__L.barHit()');",
  "  await waitShown(page, '.tn-editpage'); await settle(page, 500);\n  h = { gone: false, isBar: false, hit: '这一层没人问过' };"]],
  '实得 2，期望 3');
t('T06 判据 L26 被改名（清钮那一枚正是改前点错到档位条上的那颗）', [['tools/smoke-layer.js',
  "ok('L26 #tnQuoteClear 中心点顶命中自己",
  "ok('L26b #tnQuoteClear 中心点顶命中自己"]],
  '里 L26 这条判据');
t('T07 判据 L39 被改名（条数守卫在场但齐备检数不到它，等于换了个没人认的名字）', [['tools/smoke-layer.js',
  "ok('L39 判据条数",
  "ok('L39b 判据条数"]],
  '里 L39 这条判据');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 hint 写死成静态引导（锚只钉 $X(qq, \'#tnQuoteHint\').textContent 这一段前缀，kw 有没有真汇进来源码腿读不到）——期望红在 L25',
  [['travel-notes.js',
    "$X(qq, '#tnQuoteHint').textContent = kw ? ('已按当前地点「' + kw + '」检索，可修改关键词') : '输入关键词检索相关名言';",
    "$X(qq, '#tnQuoteHint').textContent = '输入关键词检索相关名言';"]],
  'L25');
gBoth('U02 清钮只重画列表不清搜索框（锚只钉 .onclick 前缀；「点错档」这件事只有真鼠标知道）——期望红在 L29',
  [['travel-notes.js',
    "$X(qq, '#tnQuoteClear').onclick = function(){ qs.value = ''; renderQuotes(''); };",
    "$X(qq, '#tnQuoteClear').onclick = function(){ renderQuotes(''); };"]],
  'L29');
gBoth('U03 结果项的追加出口被摘（§48 的锚没钉这一行；点开浮层选一条却什么都不发生）——期望红在 L35',
  [['travel-notes.js',
    '        d.onclick = function(){ appendQuote(it); };\n        qlist.appendChild(d);',
    '        d.onclick = function(){ /* 追加出口被摘 */ };\n        qlist.appendChild(d);']],
  'L35');
gBoth('U04 条子的 position 从 fixed 退成 absolute（锚钉的是 104px+z-index 那一段，前半段的 position 不在账上）——期望红在 L04',
  [['index.html',
    "d.style.cssText='position:fixed;left:14px;right:14px;",
    "d.style.cssText='position:absolute;left:14px;right:14px;"]],
  'L04');
gBoth('U05 返回钮收起浮层却不召回面板（display none 两支的计数照样是 2，屏上却黑了整块）——期望红在 L33',
  [['travel-notes.js',
    "$X(qq, '#tnQuoteBack').onclick = function(){ qq.style.display = 'none'; panel.style.display = 'flex'; };",
    "$X(qq, '#tnQuoteBack').onclick = function(){ qq.style.display = 'none'; };"]],
  'L33');

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
console.log('=== mut-verify48 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['index.html',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, ['tools/smoke-layer.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}
const S48 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §48') === 0);
const B48 = o => String(o).split('\n').filter(l => /^FAIL\s+L\d/.test(l));

const vbase = runVerify(), f0 = S48(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §48 已经有 ' + f0.length + ' 条红或整跑不绿，先修基准\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§48 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM48 = String(vbase.out).split('\n').filter(l => l.indexOf('浮层层级与互斥闸门:') === 0)[0] || '';
const LEN48 = (SUM48.match(/A48 表长 (\d+) 条、ZERO48 表长 (\d+) 条/) || []).slice(1);
if (LEN48.join('/') !== '31/8') { console.log('中止：基准摘要里的表长是 ' + LEN48.join('/') + '，而本网登记的是 A48 31／ZERO48 8——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A48 表长 ' + LEN48[0] + '／ZERO48 表长 ' + LEN48[1] + '，与本网登记一致）');
const sbase = runSmoke(), c0 = B48(sbase.out);
if (c0.length || !sbase.green) { console.log('中止：基准 smoke-layer 已经有 ' + c0.length + ' 条红或整跑不绿，先修基准\n' + c0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 smoke-layer 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS  L') >= 0).length + ' 条）');

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
  const reds = S48(vr.out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B48(sm.out);
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
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §48 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify48: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-layer，它按固定文件名落读数 tools/out/b33-smoke-layer.txt；跑完要在干净树上复跑一次这条腿并把读数盖回去。');
process.exit(weird ? 1 : 0);
