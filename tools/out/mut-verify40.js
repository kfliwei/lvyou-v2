/* tools/out/mut-verify40.js — verify.js §40（链跑可信度）变异自测 · 源码腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §40 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §40 与前面各节不同：它盯的不是产品，是**闸门自己会不会说谎**，所以这张网里有三类靶子：
 *   ① 时机与出口（M01–M09）：domcontentloaded 退回 load、导航单点被拆成两处、就绪谓词退回
 *      字符串／退成通用 readyState／不再等自己那一样东西、超时从「打一行」变回「判红」——
 *      这些改动的症状是**随机红**，单跑一遍永远绿，所以源码锚是唯一的常驻证据；
 *   ② 放行表（M10–M17）：这一族最坏的坏法是「把筛子扩宽」。M11 把 isReal 扩成 /Error/，
 *      三条「零真实报错」当场恒真；M13/M14 把两路正向对照改成 === false——筛子照样绿，
 *      但「放行的只有那一整串」这件事再没人证明。M15/M16/M17 打的是 T09 的画布腿与两条在场检；
 *   ③ 守卫自己（M18–M24）：前提对账（转送没了不许留放行）、条数阈值（取 35+1=36 必须红，
 *      M51 那一课）、四元组形状、正向对照失效（needle 写坏时那个 0 不是证据）、
 *      README 的两处登记（摘§40 要抹**全部出现**，runAll；摘那句口径 run）。
 * G01／G02 是**设计内静默**：源码腿一字未动地绿，因为锚钉的是「判据在场」而不是「判据的数值下界」。
 * G01 把 T09 的 bodyH 下界 300 抬松成 1，G02 把 page 谓词的第一道条件从「不在 loading」换成
 * 「恰好等于 interactive」——两者都只有浏览器真跑一次才知道那一屏画没画出来。这两条是给
 * 「存在性锚守不住数值/形状」留的证据，不是漏跑。
 *
 * 用法: MUT_LOG=tools/out/b25c-mut-verify40.txt node tools/out/mut-verify40.js
 * **不要与别的变异网或像素基线并行**：本网动的是 trip.html 与两份 smoke，像素基线量的是同一批页面；
 * 也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut40.lock');
if (fs.existsSync(LOCK)) {
  console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）');
  process.exit(2);
}
fs.writeFileSync(LOCK, String(process.pid));
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['tools/smoke-motion.js', 'tools/smoke-trip.js', 'trip.html', 'README.md', 'tools/verify.js'];
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
  ['tools/smoke-motion.js', "await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });"],
  ['tools/smoke-motion.js', 'const READY = {'],
  ['tools/smoke-trip.js', "const VT_ABORT = 'InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled';"],
  ['tools/smoke-trip.js', "ok('T55 报错筛子口径"],
  ['trip.html', "if (q === Expense.FREE_ID) { location.replace('expense.html?trip=' + Expense.FREE_ID); }"],
  ['README.md', '/§40 链跑可信度'],
  ['tools/verify.js', '§40 链跑可信度闸门'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 46) + '」，读数不可信');
    process.exit(2);
  }
});

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §40 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
const base = verify();
const baseN = totalFails(base);
if (baseN !== 0) {
  console.log('中止：基准 verify.js ' + (baseN === null ? '没打出终判行（闸门自身就是坏的）' : '已有 ' + baseN + ' 条红') + '，先修树再跑变异网');
  console.log(pick(base).join('\n'));
  process.exit(2);
}

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

let red = 0, silent = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token, wantGreen) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let out, lines, n;
  try {
    out = verify();
    lines = pick(out);
    n = totalFails(out);
  } finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  if (n === null) {
    anomalies++;
    console.log('异常  ' + name + '  verify 没打出终判行（变异把闸门自己打崩了？这条没有读数）：' +
      out.replace(/\s+/g, ' ').slice(0, 160));
    return;
  }
  if (wantGreen) {
    if (n === 0) {
      silent++;
      console.log('静默  ' + name + '  → 源码腿 0 红（数值/形状类，只有浏览器真跑一次那屏才知道画没画出来）');
    } else {
      anomalies++;
      console.log('异常  ' + name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§40 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §40 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮 §40 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
/* run：edits 是 [[from, to], …]，每一处都必须恰命中 1 次（多命中＝needle 太短，先报错不动树） */
function run(name, file, edits, token) {
  let src = ORIG[file];
  for (const [from, to] of edits) {
    if (from === to) {
      total++; anomalies++;
      console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
      return;
    }
    const F = eol(from, file);
    const n = src.split(F).length - 1;
    if (n !== 1) {
      total++; anomalies++;
      console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
      return;
    }
    src = src.replace(F, () => eol(to, file));
  }
  judge(name, file, src, token);
}
/* runAll：换掉全部命中（README 的 §40 登记在正文里出现多次，抹一处不算抹掉） */
function runAll(name, file, from, to, token) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.split(F).join(eol(to, file)), token);
}
function greenCase(name, file, from, to) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  from 串不是恰 1 处（' + (src.split(F).length - 1) + '），静默样本没打上');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), null, true);
}

/* ============ ① 导航出口与就绪时机（M01–M09） ============ */
run('M01 domcontentloaded 退回改前的 waitUntil:load + 30s（链跑那份假红的成因回来）', 'tools/smoke-motion.js',
  [["await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });",
    "await page.goto(url, { waitUntil: 'load', timeout: 30000 });"]],
  '又等齐资源才走');
run('M02 导航单点被拆成两处（某页又自己写一遍 goto）', 'tools/smoke-motion.js',
  [["async function nav(page, url, ready) {\n  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });",
    "async function nav(page, url, ready) {\n  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });\n  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });"]],
  '只剩一处 goto');
run('M03 就绪谓词退回字符串（§34 那条坑：eval 抛错被吞，等待变 0ms）', 'tools/smoke-motion.js',
  [['await page.waitForFunction(ready, { timeout: 30000, polling: 150 });',
    'await page.waitForFunction(String(ready), { timeout: 30000, polling: 150 });']],
  '必须传函数');
run('M04 三个就绪谓词从表里散出去（各节自己写一份）', 'tools/smoke-motion.js',
  [['const READY = {', 'const READY_PER_SECTION = {']],
  '三个就绪谓词集中在一个表里');
run('M05 planner 那节不再等自己的入口函数在场（退回通用 readyState）', 'tools/smoke-motion.js',
  [["typeof window.plannerOpenTrip === 'function'", "window.plannerOpenTrip === 'function'"]],
  '等自己的入口函数在场');
run('M06 topic 那节等错了名字（TravelNotes 换成一个不存在的对象）', 'tools/smoke-motion.js',
  [["typeof TravelNotes !== 'undefined'", "typeof TravelNotesLoaded !== 'undefined'"]],
  'topic 那节等 TravelNotes');
run('M07 page 谓词不再等 UI（只剩 readyState，读的是空壳）', 'tools/smoke-motion.js',
  [["  page: function () { return document.readyState !== 'loading' && typeof UI !== 'undefined'; },",
    "  page: function () { return document.readyState !== 'loading' && !!window.UI; },"]],
  '两个谓词各自等 UI');
run('M08 就绪超时从「打一行按现状继续」改成「判红」（假红被重新造出来）', 'tools/smoke-motion.js',
  [['就绪等待超时，按现状继续读：', '就绪等待超时，直接判红：']],
  '就绪超时打一行、不改判红');
run('M09 一处导航绕开单点自己 goto（await nav 从 7 掉到 6）', 'tools/smoke-motion.js',
  [["  await nav(pe, BASE + '/topic.html', READY.topic);",
    "  await pe.goto(BASE + '/topic.html', { waitUntil: 'domcontentloaded', timeout: 60000 });\n  await waitReady(pe, READY.topic);"]],
  '七处导航全走单点');
run('M10 smoke-motion 的判据被删掉一条（条数下界 35 必须喊）', 'tools/smoke-motion.js',
  [["  check('D2 file:// 下 UI.vt 不抛（异常数组为空）', dcatch.length === 0, dcatch.join(' | ') || '无异常');\n", '']],
  '判据条数掉到');

/* ============ ② 放行表：窄到只认那一整串（M11–M18） ============ */
run('M11 放行串从整串缩成前缀（放行变宽，改一个字也不会红）', 'tools/smoke-trip.js',
  [["const VT_ABORT = 'InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled';",
    "const VT_ABORT = 'Transition was aborted';"]],
  '改一个字这条就红');
run('M12 筛子被扩成 /Error/ —— 三条「零真实报错」当场恒真', 'tools/smoke-trip.js',
  [['const isReal = e => !NOISE.test(e) && e.indexOf(VT_ABORT) < 0;',
    'const isReal = e => !/Error/.test(e);']],
  '放行表被扩成整类正则');
run('M13 T36 绕过 isReal 自搭一把筛子（三处共用变成三把尺子）', 'tools/smoke-trip.js',
  [['const noise = errs2.filter(isReal);', 'const noise = errs2.filter(e => !NOISE.test(e));']],
  '绕过 isReal 自搭一把筛子');
run('M14 T55 的「同一句换个后缀仍算红」改成 === false（正向对照反过来＝筛子扩宽不再有人证明）', 'tools/smoke-trip.js',
  [["换了个后缀') === true &&", "换了个后缀') === false &&"]],
  '同一句换个后缀仍算真实报错');
run('M15 T55 的「真 TypeError 仍算红」改成 === false（放行表把产品缺陷一起吃掉也测不出）', 'tools/smoke-trip.js',
  [["isReal('pageerror: TypeError: x is not a function') === true &&",
    "isReal('pageerror: TypeError: x is not a function') === false &&"]],
  '真报错仍算红');
run('M16 T09 的画布腿换回一个不存在的宿主（摘掉噪声却没还正身判据）', 'tools/smoke-trip.js',
  [["const b = document.getElementById('yearSum');", "const b = document.querySelector('.year-sum-card');"]],
  '那一页真画出来了');
run('M17 free 桶那条判据改名（齐备检与在场检必须一起红）', 'tools/smoke-trip.js',
  [["ok('T09 free 桶", "ok('T09b free 桶"]],
  'free 桶转送那条判据在场');
run('M18 筛子口径那条判据改名', 'tools/smoke-trip.js',
  [["ok('T55 报错筛子口径", "ok('T55x 报错筛子口径"]],
  '筛子口径那条判据在场');

/* ============ ③ 前提对账：转送没了，放行必须一起摘（M19） ============ */
run('M19 trip.html 那句 free 桶载入即转送被改掉（症状结构性消失，放行表还在＝永久豁免）', 'trip.html',
  [["if (q === Expense.FREE_ID) { location.replace('expense.html?trip=' + Expense.FREE_ID); }",
    "if (q === Expense.FREE_ID) { return; }"]],
  '放行表要一起摘掉');

/* ============ ④ 守卫自己：阈值、四元组、正向对照、README 登记（M20–M25） ============ */
run('M20 条数阈值从 35 抬到 36（当前实测 35，必须红——阈值取自早先计数就是 M51 那一坑）', 'tools/verify.js',
  [['if (nChk40 < 35) F40(', 'if (nChk40 < 36) F40(']],
  '判据条数掉到');
run('M21 A40 有一条少写「原因」字段（解构错位，那条锚等于没跑）', 'tools/verify.js',
  [["['README.md', '链跑红了先单跑复现', 1, '这条口径必须留在 README：链跑红≠产品回归，历史上被当成回归追过一整晚'],",
    "['README.md', '链跑红了先单跑复现', 1],"]],
  '不是「[文件, 串, 期望次数, 原因]」四元组');
run('M22 ZERO40 有一条少写「原因」字段（期望 0 的那族失去正向对照也无人喊）', 'tools/verify.js',
  [["['tools/smoke-trip.js', '/Error/', \"const VT = /Error/;\", '放行表被扩成整类正则：那三条「零真实报错」当场变恒真'],",
    "['tools/smoke-trip.js', '/Error/', \"const VT = /Error/;\"],"]],
  '不是「[文件, 串, 正向对照源码, 原因]」四元组');
run('M23 期望 0 的 needle 写坏一个字符（正向对照当场失效——那个 0 不再是证据）', 'tools/verify.js',
  [["\"waitUntil: 'load'\", \"await page.goto(url, { waitUntil: 'load'",
    "\"waitUntil: 'loads'\", \"await page.goto(url, { waitUntil: 'load'"]],
  '这条期望 0 的正向对照失效了');
runAll('M24 抹掉 README 里 §40 的登记（正文出现多处，只抹一处不算抹掉）', 'README.md',
  '§40', '链跑可信度节', '没提 §40');
run('M25 摘掉 README 那句「先单跑复现」的口径（链跑红被当成回归追一整晚，就是这句没写的时候）', 'README.md',
  [['**链跑红了先单跑复现**', '**先单跑复现再定性**']],
  '这条口径必须留在 README');

/* ============ 设计内静默：源码腿没有视野的两类（G01–G02） ============ */
greenCase('G01 T09 的 bodyH 下界 300 抬松成 1（锚钉的是判据在场，不是数值）', 'tools/smoke-trip.js',
  'land.bodyH > 300,', 'land.bodyH > 1,');
greenCase('G02 page 谓词的第一道条件换成 readyState === interactive（谓词还在、形状已退化）', 'tools/smoke-motion.js',
  "  page: function () { return document.readyState !== 'loading' && typeof UI !== 'undefined'; },",
  "  page: function () { return document.readyState === 'interactive' && typeof UI !== 'undefined'; },");

console.log('====================================================================');
console.log('§40 变异自测（源码腿） 共 ' + total + ' 条：按预期红 ' + red + ' / 设计内静默 ' + silent + ' / 异常 ' + anomalies);
console.log('A40 表长 18（抬阈值类取「当前长度 + 1」——M20 打的 35→36 就是这条规矩的落地）');
console.log('判读：M12／M23 是这张网最该在的两条——一个把放行扩宽、一个把正向对照写坏，' +
  '两种都会让「零真实报错」变成恒真而不说话。');
process.exit(anomalies ? 1 : 0);
