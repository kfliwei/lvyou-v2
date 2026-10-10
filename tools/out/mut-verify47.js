/* tools/out/mut-verify47.js — verify.js §47「不可逆动作闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条红**里看见它（§47 族看 FAIL §47），
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §47 的靶子分四类：
 *   ① 不可逆动作的判定与出口被拆（R01–R23）：本批删掉的旧写法逐处插回去（裸 push 回手动按钮、
 *      UI.tileWarn(字符串) 那两支永久静默、远端 404 不截断链、risky 定义收窄、危险档文案退回「确定」、
 *      取消不上报、没有确认层就直接覆盖、导出面摘掉、两段按钮文案退回一句、名不符实的按钮与标题、
 *      清除不关 autosync、开关 UI 不回落、flash 谎报、force 判定放宽、closePanel 形参抹掉、
 *      两处绑定退回裸引用、确认钮文案退回默认）。
 *   ② 守卫自己（S01–S19）：共享剥刀／文档那一支／盲区哨兵／四把扫描各自的自校准／登记表与阈值／
 *      齐备检循环上限／条数守卫阈值／四元组形状／正向对照失效／登记没读的文件／README 抹登记。
 *   ③ 浏览器腿脚手架（T01–T07）：真机档退回 452、摘判据、改编号、跨防抖那一等被挪短、遮罩那条被摘、
 *      确认层类名读错、种子函数少一形参。
 *   ④ 两条腿的分工样本（U01–U04：源码腿必须全绿，浏览器腿必须红在指名那条）：
 *      U01 panelDirty 恒返回「不脏」（锚只钉函数名那一行，body 退化源码腿结构性看不见）→ I37 红；
 *      U02 dirtyWords 退回通用问句（锚同理只钉定义行）→ I39 红；
 *      U03 coverPlan 里图册那一类不计 lose（钉的是 p.lose 求和那一行，这一行在锚外）→ I06 红；
 *      U04 pushWords 把「从云端恢复也读不回来」那半句摘掉（钉的是 title 那一行）→ I07 红。
 *   为什么必须有 ④：本节的全部立论是「屏幕上真出一层会说话的确认框」，源码腿读的是串的在场，
 *      读不到「那句话有没有真的飘出来、判定有没有真的走到那一支」；①②③ 全对也只证明锚在场。
 *
 * 登记一条设计内盲区（本网不假装覆盖）：把某条 `if (...) F47(` 整句摘掉不会红——四把扫描都有 CAL
 *   自校准（S04–S07/S19 打的就是刀本身），但「摘掉判定那一行」这种砍法只能靠锚点表自身的条数守卫
 *   和 README 登记间接兜住。所以 ② 里逐条打了 CAL 阈值与刀体口径，而不是只打产品侧。
 *
 * 登记一条 R 类 token 的口径（R06 首跑栽在这里）：verify.js 印 A47 那条红时只写 needle 的前 52 字
 *   （`needle.slice(0, 52)`），所以 token 抄「整条 needle」永远匹配不上——75 字的串在红字里只有前 52 字。
 *   要么取 needle 前 52 字以内的那一段，要么取 reason 里的一段。R06 现取「once(null, { exists: false }」，
 *   它正好落在第 52 字之前，而被打进去的改后串里是 `cb(null, ...)`，不含这一串，不会自撞。
 *
 * 用法:
 *   node tools/out/mut-verify47.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify47.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify47.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b32-mut-verify47.txt node tools/out/mut-verify47.js
 * **不要与别的变异网或像素基线并行**：本网动的是 sync-webdav.js／settings.html／travel-notes.js／
 *   tools/verify.js／tools/smoke-irreversible.js／README.md，与 mut-verify46 重叠 verify.js 与 README.md，
 *   像素基线量的就是同一批屏；也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，
 *   会把并发编辑一并抹掉。
 *   U 类会重跑 smoke-irreversible（它自己把读数落到 tools/out/b32-smoke-irreversible.txt），
 *   所以跑完要在干净树上复跑一次 tools/smoke-irreversible.js，把被变异腿覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut47.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut[\w.-]+\.lock$/.test(f) && f !== '.mut47.lock');
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

const FILES = ['sync-webdav.js', 'settings.html', 'travel-notes.js',
  'tools/verify.js', 'tools/smoke-irreversible.js', 'README.md'];
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
  ['tools/verify.js', '§47 不可逆动作闸门'],
  ['tools/verify.js', 'const flat47 = s => ws47(stripBlockComments(s));'],
  ["tools/verify.js", "if (var47.panel !== 4 || !P47['travel-notes.js'])"],
  ['tools/verify.js', "cnt47(S47, 'checks >= 57') !== 1"],
  ['tools/verify.js', "const EXIT47 = { 'sync-webdav.js': 6, 'settings.html': 1 };"],
  ['tools/verify.js', 'const RE47P = /closePanel'],
  ['tools/smoke-irreversible.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-irreversible.js', "ok('I14b "],
  ['tools/smoke-irreversible.js', "ok('I22b "],
  ['tools/smoke-irreversible.js', 'await sleep(31000);'],
  ['sync-webdav.js', 'function once(err, info) { if (settled) return; settled = true; cb(err, info); }'],
  ['sync-webdav.js', 'if (!p.risky) { putEnv(c, env, cb); return; }'],
  ['settings.html', 'WebDAV.confirmPush(function (err, r) {'],
  ['settings.html', '<button class="data-danger" onclick="clearAll()">清除全部游记</button>'],
  ['travel-notes.js', 'function closePanel(force) {'],
  ['travel-notes.js', '篇游记，图册/行程/账目/设置都没动'],
  ['README.md', '§47 不可逆动作闸门'],
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

/* ---------- ① 不可逆动作的判定与出口被拆 ---------- */
t('R01 自动出口那条唯一放行式被摘（没人点按钮也整包覆盖——改前 L2 那一发原地复活）', [['sync-webdav.js',
  '        if (!p.risky) { putEnv(c, env, cb); return; }',
  '        putEnv(c, env, cb); return;']],
  'if (!p.risky)');
t('R02 首建那一档扩成「所有档都直传」（确认层整条绕开）', [['sync-webdav.js',
  "        if (p.first) { stage('upload'); putEnv(c, env, cb); return; }",
  "        if (true) { stage('upload'); putEnv(c, env, cb); return; }"]],
  'if (p.first)');
t('R03 手动按钮接回裸 push（零确认抹云端，本批那颗主雷）', [['settings.html',
  '        WebDAV.confirmPush(function (err, r) {',
  '        WebDAV.push(function (err, r) {']],
  '手动上传又接回裸 push');
t('R04 跳过告警又交给 UI.tileWarn(字符串)（那句话永远上不了屏）', [['sync-webdav.js',
  "        try { UI.toast && UI.toast('自动上传已跳过：' + why); } catch (e) {}",
  "        try { UI.tileWarn && UI.tileWarn('自动上传已跳过：' + why); } catch (e) {}"]],
  '替你挡下覆盖」这件事不吭声');
t('R05 云同步失败的告警同形退回 tileWarn', [['sync-webdav.js',
  "      pushAuto(function (err) { if (err) { try { UI.toast && UI.toast('云同步失败：' + err.message); } catch (e) {} } });",
  "      pushAuto(function (err) { if (err) { try { UI.tileWarn && UI.tileWarn('云同步失败：' + err.message); } catch (e) {} } });"]],
  '签名是 (layer, name)');
t('R06 remoteInfo 的 404 那一支不截断链（同一调用者答两次：先直传成功又弹一层危险确认）', [['sync-webdav.js',
  '      if (r.status === 404) { once(null, { exists: false }); return undefined; }',
  '      if (r.status === 404) { cb(null, { exists: false }); return; }']],
  'once(null, { exists: false }');
t('R07 risky 的定义收窄到只数条数（云端读不到／读不出合法备份这两档从此不算险）', [['sync-webdav.js',
  '    p.risky = p.unknown || p.invalid || p.lose > 0;',
  '    p.risky = p.lose > 0;']],
  '「可能会丢」的精确定义');
t('R08 真会丢那一档的标题与动词退回泛泛（「确定」不说明后果，红色也一起没了）', [['sync-webdav.js',
  "      title: '云端有本机没有的记录', danger: true, okText: '仍然覆盖',",
  "      title: '确定要上传吗', danger: false, okText: '确定',"]],
  '真会丢的那一档必须红');
t('R09 取消不上报（页面从此不知道用户说了不，结果行只剩上一句的余温）', [['sync-webdav.js',
  '          if (!ok) { cb(null, { cancelled: true }); return; }',
  '          if (!ok) { return; }']],
  '取消是一个要上报的结果');
t('R10 没有确认层可用时改回静默覆盖（宁可报错这一支没了）', [['sync-webdav.js',
  "        if (!window.UI || !UI.confirm) { cb(new Error('云端已有一份备份，这个页面没有确认框可用，请先在设置页手动上传')); return; }",
  '        if (!window.UI || !UI.confirm) { putEnv(c, env, cb); return; }']],
  '没有确认层可用时报错');
t('R11 导出面摘掉 confirmPush（页面拿到 undefined，判定与确认从此没人能调）', [['sync-webdav.js',
  '    confirmPush: confirmPush,',
  '']],
  'confirmPush: confirmPush');
t('R12 两段按钮文案退回一句（两次网络往返被「正在上传…」盖住）', [['settings.html',
  "          $('wdPushBtn').textContent = stage === 'check' ? '检查云端…' : '正在上传…';",
  "          $('wdPushBtn').textContent = '正在上传…';"]],
  '两段文案真的接上了');
t('R13 按钮名回到「清除全部数据」（承诺比实际大，实际只删游记）', [['settings.html',
  '<button class="data-danger" onclick="clearAll()">清除全部游记</button>',
  '<button class="data-danger" onclick="clearAll()">清除全部数据</button>']],
  '那颗按钮的名字/标题又回到');
t('R14 确认层标题同族退回（正文说实话而标题谎报范围）', [['settings.html',
  "      title: '清除全部游记',",
  "      title: '清除全部数据',"]],
  '确认层跟着改名');
t('R15 清除前不关 autosync（清完那一下走 _afterSave，33s 后自己把空包推上云端）', [['settings.html',
  '        WebDAV.setAutosync(false);',
  '        /* 改前没有这一句 */']],
  '清完那一下会走');
t('R16 关完不刷新那颗开关的 UI（显示开着、实际已关，两边分叉）', [['settings.html',
  '        if (window.WDW && WDW.render) WDW.render();',
  '        /* 改前不刷新 UI */']],
  '否则状态与显示分叉');
t('R17 结果提示又谎报「已清除全部数据」', [['travel-notes.js',
  "      flash(n ? ('已清除 ' + n + ' 篇游记，图册/行程/账目/设置都没动') : '本机已经没有游记了');",
  "      flash('已清除全部数据');"]],
  '结果提示又谎报');
t('R18 force 的严格比较放宽成「有没有实参」（click 事件对象从此就是强制关闭的通行证）', [['travel-notes.js',
  '    if (force !== true) {',
  '    if (force) {']],
  '严格比较：事件对象');
t('R19 closePanel 的 force 形参被抹掉（脏检查那条 if 失去输入）', [['travel-notes.js',
  '  function closePanel(force) {',
  '  function closePanel() {']],
  'force 形参被抹掉');
t('R20 遮罩绑定退回裸函数引用（事件对象当第一个实参递进去）', [['travel-notes.js',
  '    mask.onclick = function () { closePanel(); };',
  '    mask.onclick = closePanel;']],
  '绑定退回裸函数引用');
t('R21 #tnX 绑定退回裸引用（这一枚是真机档唯一可达的关闭出口）', [['travel-notes.js',
  "    $X(panel, '#tnX').onclick = function () { closePanel(); };",
  "    $X(panel, '#tnX').onclick = closePanel;"]],
  '真机档唯一可达的关闭出口');
t('R22 确认层两个按钮退回默认「确定/取消」（说不清「关掉就没了」）', [['travel-notes.js',
  "        confirmDialog(dirtyWords(d), function () { closePanel(true); }, '关掉不保存', '继续编辑');",
  '        confirmDialog(dirtyWords(d), function () { closePanel(true); });']],
  '两个按钮各写自己的后果');
t('R23 confirmDialog 的自定义钮名形参被摘（这一族从此只能叫「确定/取消」）', [['travel-notes.js',
  '  function confirmDialog(msg, onOk, okLabel, noLabel) {',
  '  function confirmDialog(msg, onOk) {']],
  '第 3/4 形参');

/* ---------- ② 守卫自己 ---------- */
t('S01 共享剥刀退回不剥注释（注释里抄的改前原串会被当成代码在场）', [['tools/verify.js',
  '  const flat47 = s => ws47(stripBlockComments(s));',
  '  const flat47 = s => ws47(s);']],
  'flat47 定义行没走那把共享剥刀');
t('S02 文档那一支退回「README 也剥注释」（登记串里天生要写这族的形状，文档侧的锚当场读 0）', [['tools/verify.js',
  String.raw`  const view47 = f => /\.md$/.test(f) ? ws47(rd47(f)) : flat47(rd47(f));`,
  '  const view47 = f => flat47(rd47(f));']],
  'view47 的定义行退回');
t('S03 盲区哨兵：只把 wdPushBtn 那行的函数体空格形状改掉（A47/ZERO 的锚都不碰这一行，红必须指名「这一带又变成盲窗」）', [['settings.html',
  "      $('wdPushBtn').onclick = function () {",
  "      $('wdPushBtn').onclick = function() {"]],
  '盲区哨兵');
t('S04 裸 push 那把刀失准（下面那个「产品侧 0」就只是刀瞎）', [['tools/verify.js',
  String.raw`    const RE47B = /WebDAV\.push\s*\(/g;`,
  String.raw`    const RE47B = /WebDAV\.ZZZneverZZZ\s*\(/g;`]],
  '裸 push 扫描器自己读不到合成样本');
t('S05 push 家族那把刀失准（登记表会当场变成空断言）', [['tools/verify.js',
  String.raw`    const RE47E = /\b(?:WebDAV\.)?(confirmPush|pushAuto|coverPlan)\s*\(/g;`,
  String.raw`    const RE47E = /\b(?:WebDAV\.)?(confirmPushZZZ)\s*\(/g;`]],
  'push 家族那把刀失准');
t('S06 文案那把刀的自校准失准（全站 0 不再区分「产品干净」与「刀没开刃」）', [['tools/verify.js',
  "    const NEED47C = ['清除全部数据', '已清除全部数据', '确定清除全部游记数据'];",
  "    const NEED47C = ['清除全部数据ZZZ', '已清除全部数据ZZZ', '确定清除全部游记数据ZZZ'];"]],
  '文案那把刀自校准失准');
t('S07 closePanel 那把刀退回只认括号（读不到裸引用那一种形状，② 里两条期望 0 就没对照）', [['tools/verify.js',
  String.raw`    const RE47P = /closePanel\s*[;(]/g;`,
  String.raw`    const RE47P = /closePanel\s*\(/g;`]],
  'closePanel 那把刀失准');
t('S08 把 settings.html 从 push 家族登记表里摘掉（那一处接线被拆时不再有人喊）', [['tools/verify.js',
  "    const EXIT47 = { 'sync-webdav.js': 6, 'settings.html': 1 };",
  "    const EXIT47 = { 'sync-webdav.js': 6 };"]],
  '落点与登记表对不上');
t('S09 tools 侧裸 push 的分母下限挪高（批次 8 那条传输腿被拆时，「产品侧 0」失去正向对照）', [['tools/verify.js',
  '    if (var47.toolsBare < 4) F47(',
  '    if (var47.toolsBare < 400) F47(']],
  'tools/ 侧裸 push 只剩');
t('S10 条数守卫阈值从 57 挪到 2（删 55 条判据照样绿）', [['tools/smoke-irreversible.js',
  'checks >= 57',
  'checks >= 2']],
  '阈值被挪');
t('S11 齐备检循环上限从 56 收到 55（收窄一格就少守一条，而且它自己永远不会红）', [['tools/verify.js',
  '    for (let i = 1; i <= 56; i++) {',
  '    for (let i = 1; i <= 55; i++) {']],
  '循环上限是 55');
t('S12 摘掉 I14b（remoteInfo 单次回调守卫从此零反证——它自己没有任何其它调用者）', [['tools/smoke-irreversible.js',
  "  ok('I14b ",
  "  chk('I14b "]],
  'I14b（一次 remoteInfo 只回调一次）不在场');
t('S13 摘掉 I22b（开关显示开了其实没开这一族没人守）', [['tools/smoke-irreversible.js',
  "  ok('I22b ",
  "  chk('I22b "]],
  'I22b（真点开关后 UI 与状态同步）不在场');
t('S14 A47 有一条被拆成三元组（少字段会解构错位，这条锚等于没跑）', [['tools/verify.js',
  "    ['sync-webdav.js', 'var settled = false;', 1, 'remoteInfo 的单次回调守卫（改前 404 那一支会把同一次调用答两次）'],",
  "    ['sync-webdav.js', 'var settled = false;', 1],"]],
  '不是「[文件, 串, 期望次数, 原因]」四元组');
t('S15 A47 登记了 §47 没读的文件（名单与登记表分家时那条锚静默通过）', [['tools/verify.js',
  "    ['sync-webdav.js', 'function putEnv(c, env, cb) {', 1, '全站唯一写远端文件的地方；它自己不做任何判断，只认「已经决定要覆盖」'],",
  "    ['sync-webdavX.js', 'function putEnv(c, env, cb) {', 1, '全站唯一写远端文件的地方；它自己不做任何判断，只认「已经决定要覆盖」'],"]],
  '登记了 §47 没读的文件');
t('S16 ZERO47 的 needle 换成树上没有的串（那个 0 就不再是证据）', [['tools/verify.js',
  "    ['settings.html', '清除全部数据',",
  "    ['settings.html', '清除全部数据ZZZ',"]],
  '正向对照失效了');
tAll('S17 抹掉 README 里 §47 的登记（摘登记要抹全部出现：只摘一处 indexOf 照样命中）', 'README.md', '§47', '§xx', '就等于没装');
t('S18 CAL47B 的期望从 1 挪到 0（自校准那一行被摘了牙，后面那个「产品侧 0」没人验刀）', [['tools/verify.js',
  "    if (CAL47B !== 1) F47(",
  "    if (CAL47B !== 0) F47("]],
  '裸 push 扫描器自己读不到合成样本');
t('S19 CAL47P 的期望从 3 挪到 2（「分不清包一层和裸引用」这把刀被认成合法）', [['tools/verify.js',
  "    if (CAL47P !== 3) F47(",
  "    if (CAL47P !== 2) F47("]],
  'closePanel 那把刀失准');

/* ---------- ③ 浏览器腿脚手架 ---------- */
t('T01 真机档退回 452×995（量的就不是用户那块屏，§37 口径）', [['tools/smoke-irreversible.js',
  'const VW = 328, VH = 723;',
  'const VW = 452, VH = 995;']],
  '必须量用户那块屏');
t('T02 摘掉 I25 那一条（把 ok 换名：按钮名回归那种「页面上没人读」的回归从此只有源码腿的一半）', [['tools/smoke-irreversible.js',
  "  ok('I25 ",
  "  chk('I25 "]],
  'I25 这条判据不是恰 1 处');
t('T03 把 I43 改成 I93（改编号＝齐备检集体失效，那一格从此没人守）', [['tools/smoke-irreversible.js',
  "  ok('I43 选「继续编辑」",
  "  ok('I93 选「继续编辑」"]],
  'I43 这条判据不是恰 1 处');
t('T04 跨防抖那一等从 31s 缩到 2s（读到 PUT 自增 0 变成必然，连锁那一条的证据没了）', [['tools/smoke-irreversible.js',
  '  await sleep(31000);',
  '  await sleep(2000);']],
  '跨过默认防抖');
t('T05 遮罩那条代码路径被摘（屏上摸不到≠两条入口可以不接）', [['tools/smoke-irreversible.js',
  'document.querySelector(".tn-mask").click()',
  'document.querySelector(".tn-maskXXX").click()']],
  '遮罩那一条按代码路径也要验');
t('T06 确认层的类名读错（永远读到 null，然后判成「没弹层」——那种绿比红更坏）', [['tools/smoke-irreversible.js',
  "    kind: m.classList.contains('tn-cfm') ? 'tn-cfm' : 'ui-modal',",
  "    kind: m.classList.contains('tn-cfmX') ? 'tn-cfmX' : 'ui-modal',"]],
  '判据把两套确认层读成同一枚形状');
t('T07 种子函数少一个形参（「其它集合没动」从此没有分母）', [['tools/smoke-irreversible.js',
  'function seedLocal(ids, davPort, withAlbum)',
  'function seedLocal(ids, davPort)']],
  '本机条数与「有没有图册」都按参数铺');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 panelDirty 恒返回「不脏」（A47 只钉 function panelDirty() { 那一行，body 退化源码腿结构性看不见）——期望红在 I37',
  [['travel-notes.js',
    '    if (!ui || !state) return null;',
    '    if (!ui || !state) return null;\n    if (1) return null;']],
  'I37');
gBoth('U02 dirtyWords 退回通用问句（锚同理只钉定义行；「列出会丢什么」这一条只有屏上量得到）——期望红在 I39',
  [['travel-notes.js',
    "    return '这一段还没保存（' + (bits.join('、') || '已有内容') + '），关掉就没了，也不会进游记列表。';",
    "    return '确定要关闭吗？';"]],
  'I39');
gBoth('U03 coverPlan 里图册那一类不计 lose（钉的是 p.lose 求和那一行，被改的这行在锚外）——期望红在 I06',
  [['sync-webdav.js',
    '      p.loseAlbums = lostIds(env.albums, re.albums);',
    '      p.loseAlbums = 0;']],
  'I06');
gBoth('U04 pushWords 把「从云端恢复也读不回来」那半句摘掉（锚钉的是 title 那一行；这一句正是不可逆的那一半）——期望红在 I07',
  [['sync-webdav.js',
    "        p.localAlbums + ' 本，换掉的那部分云端就没有了，「从云端恢复」也读不回来。'",
    "        p.localAlbums + ' 本。'"]],
  'I07');

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
console.log('=== mut-verify47 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['sync-webdav.js',
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
  try { return { out: cp.execFileSync(process.execPath, ['tools/smoke-irreversible.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}
const S47 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §47') === 0);
const B47 = o => String(o).split('\n').filter(l => /^FAIL\s+I\d/.test(l));

const vbase = runVerify(), f0 = S47(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §47 已经有 ' + f0.length + ' 条红或整跑不绿，先修基准\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§47 之外也有红，后面的读数不可比）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（' + String(vbase.out).split('\n').filter(l => l.indexOf('不可逆动作闸门:') === 0)[0].slice(0, 46) + '…）');
const sbase = runSmoke(), c0 = B47(sbase.out);
if (c0.length || !sbase.green) { console.log('中止：基准 smoke-irreversible 已经有 ' + c0.length + ' 条红或整跑不绿，先修基准\n' + c0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 smoke-irreversible 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS  I') >= 0).length + ' 条）');

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
  const reds = S47(vr.out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B47(sm.out);
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
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §47 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify47: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-irreversible，它按固定文件名落读数 tools/out/b32-smoke-irreversible.txt；跑完要在干净树上复跑一次并把读数盖回去。');
process.exit(weird ? 1 : 0);
