/* tools/out/mut-verify41.js — verify.js §41（游记按日期分组）变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §41 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §41 的靶子分四类：
 *   ① 归一单点自己（M01–M06）：分隔符正则收窄成只认连字符（点号/中文日期那两半成因回来）、
 *      ts 兜底摘掉（成因③的抛错回来）、出口不导出（外部页面只能自己再解析）、点开退回原始串
 *      indexOf（成因②的「亮着却打不开」）、默认退回当前月（成因①的那串裸日号）、
 *      兜底档不再压最后（「未填日期」冒充最近那一趟）；
 *   ② 单点被拆（M07–M12）：三处分组里任何一处退回 .sort().reverse()，或任何一处退回裸
 *      n.date.slice——M08 与 M12 特意分成两条：前者由 A41 的读取点锚抓，后者**只有期望 0 那族
 *      抓得到**（TNStats 那一处本来就没有正向锚，别以为条数锚能替它说话）；
 *   ③ 界面上那两句话与那颗钮（M13–M16、M21–M22、M41）：空月文案整串、有记录月的读法整串、
 *      #calGoto 的绑定（calGoto 从 2 掉到 1＝只有 HTML 没有手）、整块空月出口被摘、
 *      design.css 类名漂移（跨文件对账那条才算数）、这一族写回 map.css（M41：批次 27 把这条锚
 *      从 map.css 改指所有宿主页都加载的 design.css，并把 map.css 那一处改成期望 0——
 *      批次 26 当时选的表就是这批的失手点）、写盘 day 不再与 noteDay 同出一个 fmtDay；
 *   ④ 守卫自己（M23–M32）：条数阈值（当前实测 21 颗字面判据，取 21+1=22 必须红——M51 那一课）、
 *      A41／ZERO41 的四元组形状、needle 写坏一个字符（正向对照当场失效、那个 0 不再是证据）、
 *      A41 登记了 §41 没读的文件、smoke-cal 摘一条形状／摘一条字面判据／摘一条顺序判据、
 *      真机档退回 452×995、README 的两处登记。
 *
 * G01／G02 是**设计内静默**，但这一批不停在「源码腿看不见」上：每条都再跑一遍
 * tools/smoke-cal.js，要求浏览器腿**必须红**——「锚钉的是判据在场」这句话只有配上
 * 「另一条腿真的钉住了数值与顺序」才不是自我安慰。G01 摘掉 noteDay 里的 pad2（键不再补零），
 * G02 把 sortDays 的比较器反向（分组翻成正序）。两条源码腿都全绿。
 * 若某条 G 连浏览器腿都不红，本脚本按异常报（＝两腿都没视野，是真漏，不是设计内）。
 *
 * 用法: MUT_LOG=tools/out/b26-mut-verify41.txt node tools/out/mut-verify41.js
 * **不要与别的变异网或像素基线并行**：本网动的是 travel-notes.js 与 smoke-cal.js，
 * 像素基线量的是同一批页面；也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，
 * 会把并发编辑一并抹掉。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut41.lock');
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

const FILES = ['travel-notes.js', 'review.html', 'index.html', 'travel-map.html', 'map.css',
  'design.css', 'README.md', 'tools/verify.js', 'tools/smoke-cal.js'];
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
  ['travel-notes.js', 'function noteDay(n) {'],
  ['travel-notes.js', 'var UNDATED ='],
  ['travel-notes.js', 'id="calGoto"'],
  ['travel-notes.js', 'noteDay: noteDay,'],
  ['review.html', 'function dayOf(n){return TravelNotes.noteDay(n);}'],
  ['index.html', 'TravelNotes.noteDay(last)'],
  ['travel-map.html', 'TravelNotes.noteDay(n)'],
  ['design.css', '.tn-cal-day-tip{'],   /* 批次 27 把这条锚从 map.css 改指 design.css：样式住在所有宿主页都加载的那张表里才算数 */
  ['tools/smoke-cal.js', 'const SHAPES = ['],
  ['tools/smoke-cal.js', "ok('C26 "],
  ['tools/verify.js', '§41 游记按日期分组闸门'],
  ['README.md', '/§41 游记按日期分组'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 46) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, file, edits, token) { CASES.push({ name, file, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, file, edits: [[from, to]], token, kind: 'all' }); }
function gBoth(name, file, from, to, whyBrowser) { CASES.push({ name, file, edits: [[from, to]], kind: 'silentB', whyBrowser }); }

/* ① 归一单点自己 */
t('M01 分隔符正则收窄成只认连字符（点号／中文日期那两半成因回来：不亮）', 'travel-notes.js',
  [['    var m = s.match(/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/);',
    '    var m = s.match(/(\\d{4})-(\\d{1,2})-(\\d{1,2})/);']],
  '任意非数字分隔符');
t('M02 ts 兜底摘掉（成因③回来：date 坏/缺时出空串不再反推，noteDay 那条锚当场没跑）', 'travel-notes.js',
  [["    return (typeof ts === 'number' && isFinite(ts)) ? fmtDay(ts) : '';", '    return \'\';']],
  '由 ts 反推');
t('M03 归一出口不导出（外部页面只剩自己再解析一条路，本批并轨的立论就没了）', 'travel-notes.js',
  [['    noteDay: noteDay,\n', '']],
  '对外出口');
t('M04 点开退回原始串 indexOf（成因②原样回来：格子亮的是一套键、点开是另一套）', 'travel-notes.js',
  [["      var dayList = list.filter(function (x) { return noteDay(x) === k; });",
    "      var dayList = list.filter(function (x) { return String(x.date || '').indexOf(k) >= 0; });"]],
  "里出现「String(x.date || '').indexOf(k)」");
t('M05 日历默认退回当前月（成因①那串裸日号回来，用户看到的仍是「页面坏了」）', 'travel-notes.js',
  [['    if (!calState.ym) calState.ym = newest ? (+newest.slice(0, 4)) * 100 + (+newest.slice(5, 7)) : now.getFullYear() * 100 + (now.getMonth() + 1);',
    '    if (!calState.ym) calState.ym = now.getFullYear() * 100 + (now.getMonth() + 1);']],
  '默认又落回当前月');
t('M06 兜底档不再压最后（「未填日期」排到最新那一头，用户以为那是最近一趟）', 'travel-notes.js',
  [['      if (a === UNDATED) return 1;\n      if (b === UNDATED) return -1;\n', '']],
  '压在最后的那一手');

/* ② 单点被拆成多处／裸 slice 回来 */
t('M07 月档这一处退回 .sort().reverse()（函数还在、调用点少了一个＝兜底档在这一处排到最前）', 'travel-notes.js',
  [['      sortDays(Object.keys(byMonth)).forEach(function (m) {',
    '      Object.keys(byMonth).sort().reverse().forEach(function (m) {']],
  '实得 2，期望 3');
t('M08 顶栏「天数」退回裸 slice（A41 那条读取点锚是唯一的证人）', 'travel-notes.js',
  [['      var dd = noteDay(n); if (dd) days[dd] = 1;',
    '      if (n.date) { days[n.date.slice(0, 10)] = 1; }']],
  '顶栏「天数」走归一键');
t('M09 统计面板的天数与月分布分家（月档又去读原始 date）', 'travel-notes.js',
  [['      var dd = noteDay(n); if (dd) { days[dd] = 1; months[dd.slice(0, 7)] = (months[dd.slice(0, 7)] || 0) + 1; }',
    '      var dd = noteDay(n); if (dd) { days[dd] = 1; months[n.date.slice(0, 7)] = (months[n.date.slice(0, 7)] || 0) + 1; }']],
  '天数与月份分布同一个键');
t('M10 时间线年档退回照抄原文（点号／中文日期分出自己的档，跨年浏览全乱）', 'travel-notes.js',
  [['    list.forEach(function (n) { var y = noteYear(n); (byYear[y] = byYear[y] || []).push(n); });',
    '    list.forEach(function (n) { var y = n.date.slice(0, 4); (byYear[y] = byYear[y] || []).push(n); });']],
  '时间线年档走 noteYear');
t('M11 时间线月档退回照抄原文（同一篇笔记在月档与日历里对不上）', 'travel-notes.js',
  [['      byYear[y].forEach(function (n) { var m = noteMonth(n); (byMonth[m] = byMonth[m] || []).push(n); });',
    '      byYear[y].forEach(function (n) { var m = n.date.slice(0, 7); (byMonth[m] = byMonth[m] || []).push(n); });']],
  '时间线月档同上');
t('M12 TNStats 那一处退回裸 slice（这里**没有**正向锚，只有期望 0 那族守得住）', 'travel-notes.js',
  [['    var d = TravelNotes.noteDay(n); if (d) days[d] = 1;',
    '    if (n.date) { days[n.date.slice(0, 10)] = 1; }']],
  '裸 slice 回来了');

/* ③ 界面上那两句话与那颗钮 */
t('M13 空月那句说明换了词（锚钉的是整串，不是「有写东西」）', 'travel-notes.js',
  [['这个月还没有游记', '本月暂无游记']],
  '空月要说话');
t('M14 有记录月的读法换了词（用户对着 31 个格子仍不知道带色的是什么）', 'travel-notes.js',
  [['点上面带色的日期看当天', '点上面带色的日期看当日']],
  '有记录的月也要给一句读法');
t('M15 摘掉 #calGoto 的事件绑定（只剩 HTML 那颗钮＝点了没反应）', 'travel-notes.js',
  [["      $X(dayBox, '#calGoto').onclick = function () { calState.ym = (+newest.slice(0, 4)) * 100 + (+newest.slice(5, 7)); renderCalView(body, list); };\n", '']],
  '实得 1，期望 2');
t('M16 整块空月出口被摘成一句日期（说明与那颗钮一起没了）', 'travel-notes.js',
  [["      dayBox.innerHTML = '<div class=\"tn-cal-day-tip\">这个月还没有游记。最近有记录的一天是 <b>' + newest + '</b>' +\n        '<button class=\"tn-cal-today\" id=\"calGoto\">跳过去</button></div>';\n      $X(dayBox, '#calGoto').onclick = function () { calState.ym = (+newest.slice(0, 4)) * 100 + (+newest.slice(5, 7)); renderCalView(body, list); };",
    "      dayBox.innerHTML = '<div class=\"tn-cal-day-tip\">' + newest + '</div>';"]],
  '实得 0，期望 2');
t('M21 design.css 那条样式改了名（产品发的类名没人接，提示行退化成无排版的一坨）', 'design.css',
  [['.tn-cal-day-tip{', '.tn-cal-tip{']],
  '没有这条样式');
t('M41 这一族又写回 map.css（批次 26 的失手点：那张表只被 3 页加载，期望 0 那族就是为它立的）', 'map.css',
  [['/* 多图查看器 + 日历视图的样式在 design.css（2026-10-07 挪出）：\n',
    '.tn-cal-day-tip{display:flex;align-items:center;gap:10px;padding:2px 0 6px}\n/* 多图查看器 + 日历视图的样式在 design.css（2026-10-07 挪出）：\n']],
  '正向对照就是上一条');
t('M22 写盘 day 不再走 fmtDay（by_day 索引的键与 UI 的键两套出处，看着等价而已漂）', 'travel-notes.js',
  [['day: fmtDay(_now),', 'day: fmtTime(_now).slice(0, 10),']],
  '不在了');

/* ④ 外部页面并轨 */
t('M17 回顾页把第二份解析立回来（不认点号／中文，也没有 ts 兜底）', 'review.html',
  [['function dayOf(n){return TravelNotes.noteDay(n);}',
    "function dayOf(n){return (n.day||(n.date||'').slice(0,10)||'').slice(0,10);}"]],
  '第二份日期解析又立起来了');
t('M18 首页自己数天（坏形状按原始字符串数出重复天）', 'index.html',
  [['    var days = new Set(all.map(function (n) { return TravelNotes.noteDay(n); }).filter(Boolean));',
    '    var days = new Set(all.map(function (n) { return n.date.slice(0, 10); }));']],
  '首页自己数天');
t('M19 首页那行起始日退回照抄 date（2026年10月8日 直接印到界面上）', 'index.html',
  [["    var lastDay = last ? TravelNotes.noteDay(last) : '';",
    "    var lastDay = last ? last.date : '';"]],
  '首页那行起始日');
t('M20 足迹画布自己数天（同样是裸 slice，date 缺失整张导出图抛错）', 'travel-map.html',
  [['new Set(notes.map(n=>TravelNotes.noteDay(n)).filter(Boolean)).size',
    'new Set(notes.map(n=>n.date.slice(0,10))).size']],
  '足迹画布自己数天');

/* ⑤ 守卫自己：阈值、四元组、正向对照、登记 */
t('M23 字面判据阈值从 21 抬到 22（当前实测 21，必须红——阈值取自早先计数就是 M51 那一坑）', 'tools/verify.js',
  [["\"ok('C\", 21,", "\"ok('C\", 22,"]],
  '实得 21，期望 22');
t('M24 A41 有一条少写「原因」字段（解构错位，那条锚等于没跑）', 'tools/verify.js',
  [["['design.css', '.tn-cal-day-tip{', 1, '提示行有自己的类（不靠 inline style 魔法数，暗色与字号阶梯才跟得上），而且必须住在所有宿主页都加载的那张表里'],",
    "['design.css', '.tn-cal-day-tip{', 1],"]],
  '不是「[文件, 串, 期望次数, 原因]」四元组');
t('M25 ZERO41 有一条少写「正向对照源码」字段（那族期望 0 失去自证也不会有人喊）', 'tools/verify.js',
  [["['review.html', \"(n.day||(n.date||'').slice(0,10)||'').slice(0,10)\", \"function dayOf(n){return (n.day||(n.date||'').slice(0,10)||'').slice(0,10);}\", '第二份日期解析又立起来了：它不认点号/中文，也没有 ts 兜底，两页同一篇会一边亮一边不亮'],",
    "['review.html', \"(n.day||(n.date||'').slice(0,10)||'').slice(0,10)\", '第二份日期解析又立起来了：它不认点号/中文，也没有 ts 兜底，两页同一篇会一边亮一边不亮'],"]],
  '不是「[文件, 串, 正向对照源码, 原因]」四元组');
t('M26 期望 0 的 needle 少打一个空格（正向对照当场失效——那个 0 不再是证据）', 'tools/verify.js',
  [["['travel-notes.js', 'n.date.slice(0, 10)',", "['travel-notes.js', 'n.date.slice(0,10)',"]],
  '正向对照失效了');
t('M27 A41 登记了 §41 根本没读的文件（锚钉在没人读的字符串上＝永久绿灯）', 'tools/verify.js',
  [["['tools/smoke-cal.js', \"ok('C\", 21,", "['tools/smoke-cal-x.js', \"ok('C\", 21,"]],
  '没读的文件');
t('M28 smoke-cal 摘掉一条畸形形状（表还在、腿空了一条，那个症状重新没人管）', 'tools/smoke-cal.js',
  [["    ['C03 点号 2026.10.08', note(ts(M, 8), Y + '.' + pad(M + 1) + '.08 15:30', '点号', ''), dayKey(8)],\n", '']],
  '这条形状');
t('M29 smoke-cal 摘掉一条字面判据（条数锚必须喊）', 'tools/smoke-cal.js',
  [["  ok('C24 全程零未捕获报错（坏形状不再让 openList 抛 undefined.slice）', errs.length === 0, errs.slice(0, 3).join(' | '));\n", '']],
  '实得 20，期望 21');
t('M30 smoke-cal 摘掉一条顺序判据（倒序与兜底落位没有别的腿守着，摘掉就再没人知道它翻了）', 'tools/smoke-cal.js',
  [["    ok('C26 时间线日档按新→旧排（20 日排在 5 日之前）', iR >= 0 && iO >= 0 && iR < iO, labels.join(','));\n", '']],
  '这条顺序判据');
t('M31 smoke-cal 真机档退回 452×995（批次 23-D 的改判口径被抹掉，量的就不是用户那块屏）', 'tools/smoke-cal.js',
  [['const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '批次 23-D 的改判口径');
tAll('M32 抹掉 README 里 §41 的登记（摘登记要抹**全部出现**，摘一处不算抹掉）', 'README.md',
  '§41', '游记按日期分组节', '没提 §41');

/* 设计内静默：源码腿没有视野，但浏览器腿必须红 */
gBoth('G01 noteDay 里摘掉 pad2（键不再补零：锚钉的是解析器在场，不是它输出的键形状）', 'travel-notes.js',
  "    if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);",
  "    if (m) return m[1] + '-' + (+m[2]) + '-' + (+m[3]);");
gBoth('G02 sortDays 的比较器反向（函数、名字、调用点数一个没动，分组却翻成正序）', 'travel-notes.js',
  '      return a < b ? 1 : a > b ? -1 : 0;',
  '      return a < b ? -1 : a > b ? 1 : 0;');

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
function smokeCal() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-cal.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §41 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
function smokeFails(out) {
  const m = out.match(/=== smoke-cal: (\d+) 项，失败 (\d+) ===/);
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
const bb = smokeCal();
const bbN = smokeFails(bb);
if (bbN !== 0) {
  console.log('中止：基准 smoke-cal.js ' + (bbN === null ? '没打出终判行（' + bb.replace(/\s+/g, ' ').slice(-160) + '）' : '已有 ' + bbN + ' 条红') + '，G 类没有可比读数');
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
      console.log('异常  ' + c.name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§41 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
      return;
    }
    fs.writeFileSync(path.join(ROOT, c.file), apply(c));
    let so, sf;
    try { so = smokeCal(); sf = smokeFails(so); }
    finally { fs.writeFileSync(path.join(ROOT, c.file), ORIG[c.file]); }
    if (sf === null) {
      anomalies++;
      console.log('异常  ' + c.name + '  smoke-cal 没打出终判行（浏览器腿自己崩了）：' +
        so.replace(/\s+/g, ' ').slice(-160));
      return;
    }
    if (sf >= 1) {
      silent++;
      const fl = so.split('\n').filter(l => /^FAIL\s+C/.test(l)).map(l => l.slice(0, 96));
      console.log('静默  ' + c.name + '  → 源码腿 0 红，浏览器腿红 ' + sf + ' 条（' + fl.slice(0, 2).join(' | ') + '）');
    } else {
      anomalies++;
      console.log('异常  ' + c.name + '  源码腿 0 红**且浏览器腿也 0 红**＝两条腿都没有视野，这条是真漏（不是设计内静默）');
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(c.token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + c.name + '  → §41 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + c.name + '  打了变异但没按预期红（想找：' + c.token + '）；本轮 §41 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
CASES.forEach(judge);

console.log('====================================================================');
console.log('§41 变异自测 共 ' + total + ' 条：按预期红 ' + red + ' / 设计内静默（源码腿绿 + 浏览器腿红）' + silent + ' / 异常 ' + anomalies);
console.log('A41 表长 26（M23 打的 21→22 就是「阈值类变异要取当前长度 + 1」这条规矩的落地；批次 27 把 .tn-cal-day-tip 那条锚从 map.css 改指 design.css，并新增 map.css 期望 0 那一族，表长从 25 抬到 26，M41 打的就是新立的这一族）');
console.log('判读：M12 与 M23 是这张网最该在的两条——前者证明「读取点正向锚」之外还有期望 0 那一族在守，' +
  '后者证明条数阈值不是抄来的死数；G01/G02 证明「源码锚只钉在场」这件事由浏览器腿补上形状与顺序，' +
  '而不是无人认领。');
process.exit(anomalies ? 1 : 0);
