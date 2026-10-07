/* tools/out/mut-verify43.js — verify.js §43（排期读数单点）变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §43 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §43 的靶子分五类：
 *   ① 天数这一族（M01–M10）：用户点名的那半——预填 5 回潮、排期自己解析 DOM、退路兜 5、
 *      估算另开一账、标签与 placeholder 把口径收回、分日调用里没人交代的字面天数，
 *      再加三条打在**判据自己**上（LIT43 收窄／ok43 摘掉显式 0 那一支／数调用点那一行摘掉）；
 *   ② 起终点这一族（M11–M24）：裸 matchStart 两侧、onchange 绕过、state.end = state.start 共享引用、
 *      环线死控件的原文、退单程那一手、toast 那句原因、「起」行摘掉、终行退回局部拼串、
 *      坐标缺失那句真话（两处各断一边）、头部部件表与那句直说、那颗定位钮；
 *      M25/M26/M27 打的是 ⑥ 与 ⑤ 那两条动态对账（承诺要有调用者、天数只许三个落点）；
 *   ③ 守卫自己（M28–M41）：共享剥刀／文档那一支／哨兵名／四元组少字段（A43 与 ZERO43 各一条）／
 *      期望次数抬高／登记没读的文件／正向对照失效／分母反号与分母挪位／⑦ 标签改名／抹登记；
 *   ④ 浏览器腿自身（M42–M49）：真机档与 dpr、逐档清场、定位桩、advanceToEnd 的调用、
 *      摘一条字面判据、改名一条判据、摘齐备检、整档形状改成 452；
 *   ⑤ 两条结构性无视野（G01/G02）：源码腿必须全绿、浏览器腿必须红，红在指名的那一条判据上。
 *      实测两条都成立：G01 红在 S32（钮在场、接线也在，只有文案不说话了），G02 红在 S15
 *      （屏上那行字变成「至首站 0 km」，而 A43 的锚只钉到函数签名与版式，数值它管不到）。
 *
 * 首轮的三条网自己的坑（都在案，都不算守卫失效）：① M19 的 to 串漏了收尾引号，node --check 当场拦下；
 * ② G01 的 from 串「TI('locate')+'当前位置</button>」在 planner.js 命中 **2 处**（1475 浏览面板那颗
 * 同名钮与 2394 出发地这颗），preflight 因此在动树前就中止——同名文案不能当锚，要带 id 点名；
 * ③ M48 的 token 起初写的是改名后的 'S29b'，可 ⑦ 的 FAIL 文案引的是**登记侧那条标签**，
 * 红确实红了却按 token 认不出来（§42 同一课：token 要取 FAIL 文案里真会出现的串）。
 *
 * 用法: MUT_LOG=tools/out/b28-mut-verify43.txt node tools/out/mut-verify43.js
 * **不要与别的变异网或像素基线并行**：本网动的是 planner.js / tools/verify.js /
 * tools/smoke-sched.js / README.md，像素基线与 smoke-planner 量的就是同一批屏；
 * 也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 * 网里的 G 类会重跑 smoke-sched，它按固定文件名落读数（tools/out/b28-smoke-sched.txt），
 * 所以跑完要在干净树上复跑一次那条腿，把基准读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut43.lock');
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

const FILES = ['planner.js', 'tools/verify.js', 'tools/smoke-sched.js', 'README.md'];
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
const BS = String.fromCharCode(92);
const QQ = String.fromCharCode(39);
const FP = [
  ['planner.js', 'function daysInput() {'],
  ['planner.js', 'function endpointRow(leg, tag, pt, other, looped) {'],
  ['planner.js', 'function syncLoopEnd() {'],
  ['planner.js', 'function matchKeep(cur, val) {'],
  ['planner.js', '<button class="btn" id="wStartLoc"'],
  ['planner.js', 'state.days = daysInput();'],
  ['tools/verify.js', '§43 排期读数单点闸门'],
  ['tools/verify.js', 'const flat43 = s => ws43(stripBlockComments(s));'],
  ['tools/verify.js', 'const view43 = f => /' + BS + '.html$|' + BS + '.md$/.test(f)'],
  ['tools/verify.js', "['planner.js', 'state.days || 5',"],
  ['tools/verify.js', '[\'planner.js\', "h += endpointRow(leg, " + Q43 + "终" + Q43 + ", trip.end, lastPlay", 1,'],
  ['tools/smoke-sched.js', "ok('S01 "],
  ['tools/smoke-sched.js', 'const VW = 328, VH = 723;'],
  ['README.md', '§43 排期读数单点'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 46) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* naive 剥注释那一支（M28 的 to 串从字符串拼，别靠源码转义——转义少一层就变成「needle 自己漂了」
   而不是「闸门退了」） */
const NAIVE43 = 's.replace(/' + BS + '/' + BS + '*' + '[' + BS + 's' + BS + 'S' + ']*?' + BS + '*' + BS + '/' + "/g, " + QQ + QQ + '));';

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, file, edits, token) { CASES.push({ name, file, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, file, edits: [[from, to]], token, kind: 'all' }); }
function gBoth(name, file, from, to, want) { CASES.push({ name, file, edits: [[from, to]], kind: 'silentB', want }); }

/* ① 天数一族：用户点名的那一半 */
t('M01 天数框又预填一个没人说过的 5（本批的原件症状）', 'planner.js',
  [[`placeholder="不限" value="' + (state.days || '') + '"`,
    `placeholder="不限" value="' + (state.days || 5) + '"`]],
  '没人说过的 5');
t('M02 排期自己解析 DOM（估算读 state、排期读 DOM＝同一屏两本账的来路）', 'planner.js',
  [['    state.days = daysInput();',
    "    state.days = parseInt((" + QQ + "$id(" + QQ + "intentDays" + QQ + ") && $id(" + QQ + "intentDays" + QQ + ").value) || state.days || 0, 10) || 0;"]],
  '排期自己解析 DOM');
t('M03 daysInput 的退路兜回 5（没有输入框时替用户做主）', 'planner.js',
  [['    if (!el) return state.days || 0;', '    if (!el) return state.days || 5;']],
  '没有输入框时的退路');
t('M04 汇总条那句退回独立 ceil（与真正排期不再是同一次分日调用）', 'planner.js',
  [['    return splitIntoDays(ordered, state.start, daysInput(), state.end, mkLeg(matrix, travelByNow())).length;',
    '    return Math.ceil(state.selected.length / 6);']],
  '汇总条那句');
t('M05 标签把留空的后果收回（改前这里只有「天数」两个字）', 'planner.js',
  [['<label>天数（留空＝按里程与时长自动分日）</label>', '<label>天数</label>']],
  '留空的后果写在标签里');
t('M06 摘掉 placeholder="不限"（空值的口径没有名字了）', 'planner.js',
  [['<input type="number" id="intentDays" min="1" max="30" placeholder="不限" value="',
    '<input type="number" id="intentDays" min="1" max="30" value="']],
  'placeholder 就是它');
t('M07 AI 精选那条分日把显式 0（不限）改成 3（没说出口的口径复活）', 'planner.js',
  [['    return splitIntoDays(flat, start, 0, null, leg, forced);',
    '    return splitIntoDays(flat, start, 3, null, leg, forced);']],
  '没人交代的口径');
t('M08 非零字面天数的正则收窄到两位（自校准必须当场喊：正则一退那个 0 就是空的）', 'tools/verify.js',
  [['    const LIT43 = /,\\s*[1-9]\\d*\\s*,/;', '    const LIT43 = /,\\s*[1-9]\\d{1,}\\s*,/;']],
  '分日判据自校准失效');
t('M09 ok43 摘掉「显式 0＝不限」那一支（合法形状被误判成越界）', 'tools/verify.js',
  [["    const ok43 = ln => !LIT43.test(ln) && (ln.indexOf('daysInput()') >= 0 || ln.indexOf('state.days') >= 0 || ZERO43ARG.test(ln));",
    "    const ok43 = ln => !LIT43.test(ln) && (ln.indexOf('daysInput()') >= 0 || ln.indexOf('state.days') >= 0);"]],
  '被误判成越界');
t('M10 摘掉调用点计数那一行（分母 5 掉到 0＝扫描器退化成什么都不查）', 'tools/verify.js',
  [['      split43.calls++;\n', '']],
  '从 5 处变成 0 处');

/* ② 起终点一族 */
t('M11 出发地侧退回裸 matchStart（定位坐标被文本回读洗成 null）', 'planner.js',
  [['    if (s && s.value) state.start = matchKeep(state.start, s.value);',
    '    if (s && s.value) state.start = matchStart(s.value);']],
  '文本框回读裸查字典');
t('M12 终到地侧退回裸 matchStart', 'planner.js',
  [['    if (e && e.value) state.end = matchKeep(state.end, e.value);',
    '    if (e && e.value) state.end = matchStart(e.value);']],
  '终到地那一侧');
t('M13 第 1 步 onchange 绕过 matchKeep（五处写入口少一处）', 'planner.js',
  [['      wsEl.onchange = function () { state.start = matchKeep(state.start, this.value); syncLoopEnd(); };',
    '      wsEl.onchange = function () { state.start = matchStart(this.value); syncLoopEnd(); };']],
  '有一处退回裸 matchStart');
t('M14 环线终点退回共享引用（排期把 end.isLoop 写回时顺着改到出发地）', 'planner.js',
  [['    if (state.start && state.start.name) state.end = { name: state.start.name, lat: state.start.lat, lng: state.start.lng };',
    '    if (state.start && state.start.name) state.end = state.start;']],
  '共享引用');
t('M15 环线那枚死控件的原文插回来（isLoop=true 而 end=null，86 km 返程没人排）', 'planner.js',
  [['        state.isLoop = true; syncLoopEnd(); renderWizard();',
    ['        state.isLoop = true;',
     '        if (state.start && state.start.name) state.end = { name: state.start.name, lat: state.start.lat, lng: state.start.lng };',
     '        renderWizard();'].join('\n')]],
  '死控件的原文');
t('M16 摘掉「出发地被清空时环线自己退成单程」那一手', 'planner.js',
  [['    else { state.isLoop = false; state.end = null; }', '    else { state.isLoop = false; }']],
  '自己退成单程');
t('M17 摘掉那句原因（把人带回第 1 步却什么都不说）', 'planner.js',
  [["          toast('环线要先填出发地（终点＝回到它）；不知道城市就按旁边那颗「当前位置」');\n", '']],
  '并给原因');
t('M18 摘掉结果页的「起」行（用户点名的「没有起始地」原地复活）', 'planner.js',
  [["    h += endpointRow(leg, '起', trip.start, firstPlay, false);\n", '']],
  '挂在首站之前');
t('M19 终行退回自己算的局部拼串（它读的是最后一个景点而不是终点）', 'planner.js',
  [["    h += endpointRow(leg, '终', trip.end, lastPlay, !!(trip.end && trip.end.isLoop));",
    ['    var lastStop = lastDay.stops[lastDay.stops.length - 1];',
     "    h += '<div class=\"stop\"><div class=\"stop-meta\"><span class=\"meta\">' + esc(Math.round(leg(lastStop, trip.end).km) + \" km\") + '</span></div></div>';"].join('\n')]],
  '局部拼串');
t('M20 摘掉「没有可对算的站点」那半句（有坐标没对端时静默留白）', 'planner.js',
  [["      : (pt.lat == null ? '未匹配到坐标 · 不参与里程' : '没有可对算的站点');",
    "      : (pt.lat == null ? '未匹配到坐标 · 不参与里程' : '');"]],
  '也要说得出口');
t('M21 向导末步终到地那一处退回空白（一条真话三处共用，断一处）', 'planner.js',
  [["esc(state.end.name) + (state.end.lat == null ? '（未匹配到坐标 · 不参与里程）' : '')",
    "esc(state.end.name) + (state.end.lat == null ? '' : '')"]],
  '共用同一句真话');
t('M22 没填出发地时不再直说（改前的「；；」就是这么来的）', 'planner.js',
  [["    else epParts.push('未填出发地：首日里程只含站与站之间的路');", "    else epParts.push('');"]],
  '直说没填');
t('M23 头部退回分隔符自带（部件表＋一次 join 这个形状没了）', 'planner.js',
  [["    var epParts = [rulerNote(trip), '按地理邻近自动分日，耗时含路程+游玩+休息+用餐（±2h 误差）'];",
    "    var epParts = [rulerNote(trip) + '；', '按地理邻近自动分日，耗时含路程+游玩+休息+用餐（±2h 误差）'];"]],
  '留下孤零零');
t('M24 摘掉出发地那颗「当前位置」钮（承诺又变回零调用者）', 'planner.js',
  [["        '<button class=\"btn\" id=\"wStartLoc\" style=\"flex:0 0 auto\" onclick=\"window.plannerStartFromHere(this)\">'+TI('locate')+'当前位置</button></div></div>' +",
    "        '</div></div>' +"]],
  '钮不在了');
t('M25 有人绕过 locate 自己拼 getCurrentPosition（定位一条腿一个出口断了）', 'planner.js',
  [['  window.plannerAddCurLoc = function (btn) {',
    ['  window.plannerAddCurLocDup = function () {',
     '    navigator.geolocation.getCurrentPosition(function () {}, function () {}, { timeout: 8000 });',
     '  };',
     '  window.plannerAddCurLoc = function (btn) {'].join('\n')]],
  '绕过 locate 自己拼');
t('M26 第二份 function locate（改前同样的回调在两个函数里各写一遍，改一漏一）', 'planner.js',
  [['  function locate(cb, fail) {', '  function locate(cb, fail) { }\n  function locate(cb, fail) {']],
  'locate 的定义不是 1 处');
t('M27 intentDays 多出第四个落点（估算与排期两本账的形状就是这么回来的）', 'planner.js',
  [["    state.startDate = $id('intentDate') ? $id('intentDate').value : '';",
    ["    var dExtra = parseInt($id('intentDays') ? $id('intentDays').value : '0', 10);",
     "    state.startDate = $id('intentDate') ? $id('intentDate').value : '';"].join('\n')]],
  '的落点从 3 处变成');

/* ③ 守卫自己 */
t('M28 flat43 退回 naive 剥注释（盲窗重开：住在里面的期望 0 那一族又会静默满足）', 'tools/verify.js',
  [['  const flat43 = s => ws43(stripBlockComments(s));', '  const flat43 = s => ws43(' + NAIVE43]],
  '共享剥刀');
t('M29 view43 的文档那一支退回「README 也剥注释」（登记串里天生要写 glob 形状）', 'tools/verify.js',
  [["  const view43 = f => /" + BS + ".html$|" + BS + ".md$/.test(f) ? ws43(rd43(f)) : flat43(rd43(f));",
    "  const view43 = f => /" + BS + ".html$/.test(f) ? ws43(rd43(f)) : flat43(rd43(f));"]],
  '的定义行退回');
t('M30 盲区哨兵的标记名多打一个字符（哨兵写坏＝这一段今天读不读得到再也没人知道）', 'tools/verify.js',
  [["    ['function endpointRow(leg', 'function matchKeep(cur'].forEach(function (mk) {",
    "    ['function endpointRowZZ(leg', 'function matchKeep(cur'].forEach(function (mk) {"]],
  '盲区哨兵');
t('M31 A43 有一条少写「串」字段（解构错位，那条锚等于没跑）', 'tools/verify.js',
  [["['planner.js', '没有可对算的站点', 1, '有名字、", "['planner.js', 1, '有名字、"]],
  'A43 有一条不是');
t('M35 ZERO43 有一条少写「串」字段（期望 0 只剩个名字，正向对照没处配）', 'tools/verify.js',
  [["['planner.js', '（可不填，缺省=当前位置）', ", "['planner.js', "]],
  'ZERO43 有一条不是');
t('M32 A43 一条期望次数抬高（锚还在、数不对＝条数锚不是抄来的死数）', 'tools/verify.js',
  [["['planner.js', 'readEndpointInputs();', 2,", "['planner.js', 'readEndpointInputs();', 3,"]],
  '一个都不许多');
t('M33 A43 登记了 §43 没读的文件（锚钉在没人读的字符串上＝永久绿灯）', 'tools/verify.js',
  [["['planner.js', 'function daysInput() {', 1,", "['plannerzz.js', 'function daysInput() {', 1,"]],
  '没读的文件');
t('M34 期望 0 那一族的 needle 去掉空格（正向对照当场失效——那个 0 不再是证据）', 'tools/verify.js',
  [["['planner.js', 'state.days || 5', ", "['planner.js', 'state.days||5', "]],
  '正向对照失效了');
t('M36 分母守卫反号（n<8 改成 n>8：现场读到 12 处时必须喊，别让它安静数数）', 'tools/verify.js',
  [["    if (n < 8) F43('planner.js 里「当前位置」只剩 '", "    if (n > 8) F43('planner.js 里「当前位置」只剩 '"]],
  '只剩');
t('M37 ⑦ 的一条形状标签改名（判据被摘掉时源码腿要说话；token 认改名后的标签）', 'tools/verify.js',
  [["'S04 A 档：2 站排成 1 张日卡'", "'S04x A 档：2 站排成 1 张日卡'"]],
  'S04x');
tAll('M38 抹掉 README 里 §43 的登记（摘登记要抹**全部出现**，摘一处不算抹掉）', 'README.md',
  '§43', '排期读数单点节', '没提 §43');
t('M39 起终点白名单摘掉一项（现场那处合法赋值被判成越界写法）', 'tools/verify.js',
  [["      'state.end = { name: state.start.name', 'state.end = null;',",
    "      'state.end = { name: state.start.name',"]],
  '出现没登记过的写法');
t('M40 起终点分母从 7 挪到 6（数量对账必须喊：赋值点还是 7 处）', 'tools/verify.js',
  [["    if (ep43.sites !== 7) F43('state.start／state.end 的赋值点从 7 处变成 '",
    "    if (ep43.sites !== 6) F43('state.start／state.end 的赋值点从 7 处变成 '"]],
  '从 7 处变成 7 处');
t('M41 天数形状白名单少了 onchange 那一支（绑定那一行变成没登记的读法）', 'tools/verify.js',
  [["      const shape = ln.indexOf('id=\"intentDays\"') >= 0 || ln.indexOf('$id(' + Q43 + 'intentDays' + Q43 + ').onchange') >= 0 ||",
    "      const shape = ln.indexOf('id=\"intentDays\"') >= 0 ||"]],
  '出现没登记的读法');

/* ④ 浏览器腿自身 */
t('M42 真机档退回 452×995（量的就不是用户那块屏）', 'tools/smoke-sched.js',
  [['const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '真机档取一加');
t('M43 dpr 退成 1（屏上字号回到桌面那套，量到的版式不代表手机）', 'tools/smoke-sched.js',
  [['deviceScaleFactor: 2 }', 'deviceScaleFactor: 1 }']],
  '桌面那套字号');
t('M44 摘掉逐档清场（file:// 同源共享两套存储，下一档读到的是上一档的快照）', 'tools/smoke-sched.js',
  [['  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });\n', '']],
  '逐档清场');
t('M45 摘掉定位桩（headless 授不到位权，那条腿就再没有证据）', 'tools/smoke-sched.js',
  [["      navigator.geolocation.getCurrentPosition = function (cb) { cb({ coords: { latitude: ll[0], longitude: ll[1], accuracy: 30 } }); };\n", '']],
  '定位桩');
t('M46 走到末步退回按次数点（守卫把人带回第 1 步时这条腿根本走不到排期）', 'tools/smoke-sched.js',
  [["  if (!(await advanceToEnd(page))) errs.push('走不到末步（#wDone 始终没出现）');",
    "  for (var zz = 0; zz < 4; zz++) { await page.click('#wNext'); await sleep(320); }"]],
  '这条腿不再真正走到排期');
t('M47 摘掉 S04 整条字面判据（条数锚必须喊）', 'tools/smoke-sched.js',
  [["  ok('S04 A 档：2 站排成 1 张日卡（改前是 2 张、每天 1 站＝用户点名的症状）', a.dom.cards === 1, 'cards=' + a.dom.cards + ' days=' + JSON.stringify(a.snap && a.snap.days));\n", '']],
  '少一条要说话');
t('M48 把 S29 改名成 S29b（判据还在但按 id 认领不到了：源码腿引的是**登记的那条标签**，不是文件里的新名字）', 'tools/smoke-sched.js',
  [["  ok('S29 G 档：出发地这枚「当前位置」按钮把坐标真落进了 state（改前这条腿零调用者）'",
    "  ok('S29b G 档：出发地这枚「当前位置」按钮把坐标真落进了 state（改前这条腿零调用者）'"]],
  '缺「S29 G 档');
t('M49 摘掉浏览器腿的齐备检（这一节自己也是会被删的）', 'tools/smoke-sched.js',
  [["  ok('S35 判据条数 ≥ 30（这一节自己也是会被删的）', checks >= 30, 'checks=' + checks);\n", '']],
  '实得 35，期望 36');

/* ⑤ 两条结构性无视野：源码腿必须全绿，浏览器腿必须红在那一条判据上 */
gBoth('G01 那颗钮的文案「当前位置」改成「定位中」（锚钉的是它在场与接线，文案它管不到）', 'planner.js',
  "id=\"wStartLoc\" style=\"flex:0 0 auto\" onclick=\"window.plannerStartFromHere(this)\">'+TI('locate')+'当前位置</button>",
  "id=\"wStartLoc\" style=\"flex:0 0 auto\" onclick=\"window.plannerStartFromHere(this)\">'+TI('locate')+'定位中</button>",
  'S32');
gBoth('G02 起／终两行的里程退回硬写 0（要求源码腿绿、浏览器腿红在 S15；若源码腿当场红就把它挪进 M 类）', 'planner.js',
  "+ Math.round(leg(tag === '起' ? pt : other, tag === '起' ? other : pt).km) + ' km'",
  "+ 0 + ' km'",
  'S15');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    c.edits.forEach(([from, to]) => {
      if (from === to) { console.log('预检 ' + c.name + '  恒等变异（from 与 to 相同）'); bad++; return; }
      const n = ORIG[c.file].split(eol(from, c.file)).length - 1;
      const want = c.kind === 'all' ? '>=1' : '1';
      if (c.kind === 'all' ? n < 1 : n !== 1) {
        console.log('预检 ' + c.name + '  ' + c.file + ' 的 from 串命中 ' + n + ' 处，期望 ' + want + '（源码已漂移或 needle 写错）');
        bad++;
      }
    });
  });
  return bad;
}
const pb = preflight();
if (pb) {
  console.log('中止：预检 ' + pb + ' 条不过，树一个字都没动');
  process.exit(2);
}

/* ============ 跑网 ============ */
function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
function smokeSched() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-sched.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §43 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
function smokeFails(out) {
  const m = out.match(/=== smoke-sched: (\d+) 项，失败 (\d+) ===/);
  if (!m) return null;                       // smoke 自己崩了＝这条没有读数，不能当成「没红」
  return Number(m[2]);
}

const base = verify();
const baseN = totalFails(base);
if (baseN !== 0) {
  console.log('中止：基准 verify.js ' + (baseN === null ? '没打出终判行（闸门自身就是坏的）' : '已有 ' + baseN + ' 条红') + '，先修树再跑变异网');
  console.log(pick(base).join('\n'));
  process.exit(2);
}
const bb = smokeSched();
const bbN = smokeFails(bb);
if (bbN !== 0) {
  console.log('中止：基准 smoke-sched.js ' + (bbN === null ? '没打出终判行（' + bb.replace(/\s+/g, ' ').slice(-160) + '）' : '已有 ' + bbN + ' 条红') + '，G 类没有可比读数');
  process.exit(2);
}

let red = 0, silent = 0, anomalies = 0, total = 0;
function apply(c) {
  let src = ORIG[c.file];
  c.edits.forEach(([from, to]) => {
    src = c.kind === 'all'
      ? src.split(eol(from, c.file)).join(eol(to, c.file))
      : src.replace(eol(from, c.file), () => eol(to, c.file));
  });
  return src;
}
function judge(c) {
  total++;
  fs.writeFileSync(path.join(ROOT, c.file), apply(c));
  let out, lines, n;
  try {
    out = verify();
    lines = pick(out);
    n = totalFails(out);
  } finally { fs.writeFileSync(path.join(ROOT, c.file), ORIG[c.file]); }
  if (n === null) {
    anomalies++;
    console.log('异常  ' + c.name + '  verify 没打出终判行（变异把闸门自己打崩了？这条没有读数）：' +
      out.replace(/\s+/g, ' ').slice(0, 160));
    return;
  }
  if (c.kind === 'silentB') {
    if (n !== 0) {
      anomalies++;
      console.log('异常  ' + c.name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§43 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
      return;
    }
    fs.writeFileSync(path.join(ROOT, c.file), apply(c));
    let so, sf;
    try { so = smokeSched(); sf = smokeFails(so); }
    finally { fs.writeFileSync(path.join(ROOT, c.file), ORIG[c.file]); }
    if (sf === null) {
      anomalies++;
      console.log('异常  ' + c.name + '  smoke-sched 没打出终判行（浏览器腿自己崩了）：' +
        so.replace(/\s+/g, ' ').slice(-160));
      return;
    }
    const hit = so.split('\n').filter(l => new RegExp('^FAIL\\s+' + c.want + '\\b').test(l));
    if (sf >= 1 && hit.length >= 1) {
      silent++;
      console.log('静默  ' + c.name + '  → 源码腿 0 红，浏览器腿红 ' + sf + ' 条，指名那条：' + hit[0].slice(0, 120));
    } else if (sf >= 1) {
      anomalies++;
      console.log('异常  ' + c.name + '  浏览器腿红了 ' + sf + ' 条，但没有一条落在指名的 ' + c.want + ' 上＝这条反证不算数：' +
        so.split('\n').filter(l => /^FAIL\s+S/.test(l)).map(l => l.slice(0, 74)).join(' | '));
    } else {
      anomalies++;
      console.log('异常  ' + c.name + '  源码腿 0 红**且浏览器腿也 0 红**＝两条腿都没有视野，这条是真漏（不是设计内静默）');
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(c.token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + c.name + '  → §43 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + c.name + '  打了变异但没按预期红（想找：' + c.token + '）；本轮 §43 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
CASES.forEach(judge);

console.log('====================================================================');
console.log('§43 变异自测 共 ' + total + ' 条：按预期红 ' + red + ' / 设计内静默（源码腿绿 + 浏览器腿红）' + silent + ' / 异常 ' + anomalies);
console.log('A43 表长 40 条、ZERO43 表长 9 条（M32 打的 2→3、M49 打的 36→35 与 M40 的分母 7→6，就是「阈值类变异要取当前长度 + 1」这条规矩的落地）；⓪ 那条共享剥刀与两枚现场哨兵不在 A43 表里，M28–M30 打的是这一屏自己');
console.log('判读：① 里 M01/M02/M07 与 ③ 里 M08/M09/M10/M36/M40 是这张网最该在的两组——前者证明「一个读数口径」' +
  '不是抄来的死数（预填、退路、字面天数任一复活，闸门自己喊），后者证明内置那四项动态对账各有独立视野' +
  '（正则一收窄、判据少一支、分母挪一格，当场就红，而不是把现场数当基线固化）。' +
  '② 里 M11/M12/M13 三条分开打：本轮那条真缺陷（定位坐标被文本回读洗成 null）有三个写入口，' +
  '少一个也照样是缺陷，所以单点断言不够，必须逐处点名。' +
  'G01/G02 是两条实测成立的无视野样本：G01 源码腿绿、浏览器腿红在 S32（钮在场、接线也在，只有文案不说话了）；' +
  'G02 源码腿绿、浏览器腿红在 S15（屏上那行字退成「至首站 0 km」，而 A43 的锚只钉到函数签名与版式，数值它管不到）。' +
  '两条都由浏览器腿反证一次，不是无人认领——「源码锚只钉形状」这件事的另一半证据在这里。');
process.exit(anomalies ? 1 : 0);
