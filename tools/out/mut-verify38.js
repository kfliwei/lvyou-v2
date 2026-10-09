/* tools/out/mut-verify38.js — verify.js §38（记账与行程入口解耦）变异自测 · 源码腿
 *
 * 每条变异只改一处（个别要挪位置的两处一起改），跑一遍 node tools/verify.js，必须在
 * **指定的那条 §38 红**里看见它；打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一批为什么需要这张网：§38 钉的不是某一处样式而是**入口拓扑**，而它的判据里最值钱的三类——
 * 顺序（patchTrip 判定→改字段→回写、open 的守卫早于赋值、票卡快照早于守卫、renderYear 先并集后筛年）、
 * 白名单**反查缺失**＋数量对账（只数数量抓不到「删一颗加一颗」，只查白名单抓不到「同一颗写两遍」）、
 * 十一族期望 0（catTotals 不分年／恒等式守卫／migrate 落盘／读数卡写库／系统通知／--fs-11）——
 * 都存在「needle 在源码里根本没有 ⇒ 期望 0 恒真」「合成对照自己坏掉」两种假绿法。
 * M19／M21／M32–M36 打的就是这两类守门的门。
 *
 * G1 是**设计内静默**：me.html 空态按钮的 min-height 从 44px 缩到 24px，字面量锚一根没动
 * （`.mbtn{display:flex` 还在），源码腿必须全绿——触控高度只有浏览器腿（smoke-trip T49／T51
 * 量 getBoundingClientRect）能抓。这一条是给「存在性锚守不住形状」留的证据，不是漏跑。
 *
 * 用法: MUT_LOG=tools/out/b24f-mut-verify38.txt node tools/out/mut-verify38.js
 * **不要与别的变异网或像素基线并行**：变异打的就是 smoke 要截的那几页；
 * 也不要在本网跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字：
   本族各网的快照都含 tools/verify.js（还常含 README.md 与同一批产品文件），并发跑会各自从自己的
   启动快照回写——后还原那张把前一张刚还原的内容一并抹掉，树停在中间态而两边都报「全过」。
   取锁用 flag 'wx'（存在即失败），把「同时启动」那一格也堵掉。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut38.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(x => /^\.mut\d+\.lock$/.test(x) && x !== '.mut38.lock');
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

const FILES = ['trip.html', 'me.html', 'expense.html', 'expense.js', 'expense-form.js',
  'planner.js', 'planner.html', 'travel-notes.js', 'design.css',
  'tools/smoke-trip.js', 'tools/smoke-expense.js', 'README.md', 'tools/verify.js'];
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
  ['trip.html', 'function patchTrip(fn) {'],
  ['trip.html', 'if (tripId !== tid) return;'],
  ['me.html', 'Expense.tripIds()'],
  ['expense.js', 'function tripIds() {'],
  ['expense-form.js', 'function render(root, cfg) {'],
  ['planner.js', "var th = $id('tripHomeSlot');"],
  ['tools/smoke-trip.js', "ok('T54 "],
  ['tools/verify.js', '§38 记账与行程入口解耦闸门'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 40) + '」，读数不可信');
    process.exit(2);
  }
});
/* 基准必须全绿：基线不脏就没法把红记在变异头上 */
function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认（其他节是「XX闸门 FAIL:」，前缀不是 FAIL，不能混着数）；
   闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §38 /.test(l)); }
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
      console.log('静默  ' + name + '  → 源码腿 0 红（形状类，只有浏览器腿 smoke-trip T49／T51 量 rect 能抓）');
    } else {
      anomalies++;
      console.log('异常  ' + name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§38 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §38 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮 §38 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
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
/* runAll：换掉全部命中（登记串本来就该出现多次的那族用这个，例如 121 条 ok(' 与两页的 328×723） */
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

/* ============ ① 实际口径的写入口唯一（本批的灵魂之一） ============ */
run("M01 清空实际出发日改成写空串（留一个 '' 就是界面上说不清的状态）", 'trip.html',
  [["if (v) t.logStart = v; else delete t.logStart;", "if (v) t.logStart = v; else t.logStart = '';"]],
  '清空＝');
run('M02 清空实际天数改成写 0（「实际 0 天」直接上屏）', 'trip.html',
  [["if (v) t.realDays = v; else delete t.realDays;", "if (v) t.realDays = v; else t.realDays = 0;"]],
  '留一个 0 会让「实际 0 天」直接上屏');
run('M03 patchTrip 的 fn(hit) 挪到「找不到就退」之前（把一条不存在的行程写进 tn_trips）', 'trip.html',
  [["    if (!hit) { UI.toast('这趟行程在本机找不到，改动没存上'); return false; }\n    fn(hit);\n",
    "    fn(hit);\n    if (!hit) { UI.toast('这趟行程在本机找不到，改动没存上'); return false; }\n"]],
  'patchTrip 三步顺序不是');
run('M04 me.html 里加第二处行程库写入口（读数卡能写库＝一次重画可能改掉用户的行程）', 'me.html',
  [["    var box = $('meTrips'); if (!box) return;\n",
    "    var box = $('meTrips'); if (!box) return;\n    localStorage.setItem('tn_trips', JSON.stringify(readTrips()));\n"]],
  "me.html 里出现「setItem('tn_trips'」");
run('M05 expense.js 的 migrate 顺手写一个 logStart（第二处写入口＝第二套「实际出发日」）', 'expense.js',
  [["      copy.date = d; out.push(copy); filled++;", "      copy.date = d; copy.logStart = d; out.push(copy); filled++;"]],
  'expense.js 里出现「logStart =」');
run('M06 migrate 直接落盘（替用户写一个他没记过的日期进账本）', 'expense.js',
  [["    migrate(listOf(tripId), start).list.forEach(function (x) {",
    "    localStorage.setItem(KEY, JSON.stringify(migrate(listOf(tripId), start).list));\n    migrate(listOf(tripId), start).list.forEach(function (x) {"]],
/* 闸门打印 needle 时按 slice(0,48) 截断，这条 needle 正好超一格：token 要跟着截，
   照抄整串会变成「红打了、token 找不到」的假异常。 */
  'expense.js 里出现「localStorage.setItem(KEY, JSON.stringify(migrate');

/* ============ ② 表单单份实现（24-C） ============ */
run('M07 expense-form.js 私写一份分类名单（漂的第一天就是「页面上六个分类、面板里五个」）', 'expense-form.js',
  [["catEl.innerHTML = Expense.CATS.map(function (c) {", "catEl.innerHTML = ['交通', '住宿', '餐饮'].map(function (c) {"]],
  '分类只从 Expense.CATS 现取');
run('M08 面板那一档改成自己造表单（三个宿主各写一套＝三套口径）', 'travel-notes.js',
  [["expForm = ExpenseForm.render($X(ui.panel, '#tnExpForm'), {", "expForm = TravelNotesForm.render($X(ui.panel, '#tnExpForm'), {"]],
  '宿主三');
run('M09 trip.html 不再载 expense-form.js（这一页的「记一笔」没有表单可用）', 'trip.html',
  [["<script src=\"expense-form.js\"></script>\n", ""]],
  'trip.html 里「<script src="expense-form.js"></script>」命中 0 次');

/* ============ ③ 入口只加不减（24-D planner 侧） ============ */
run('M10 结果页删掉一颗老按钮（拿新入口换旧入口，肌肉记忆当场断掉）', 'planner.js',
  [["      '<button class=\"btn ghost\" onclick=\"window.plannerEditPick()\">'+TI('edit')+'编辑选点</button>' +\n      '<button class=\"btn ghost\" onclick=\"window.plannerOpenFootprint()\">'+TI('map')+'足迹地图</button>';\n",
    "      '<button class=\"btn ghost\" onclick=\"window.plannerEditPick()\">'+TI('edit')+'编辑选点</button>';\n"]],
  '颗按钮');
run('M11 同一颗按钮写两遍（白名单反查缺失抓不到，只有数量对账抓得到）', 'planner.js',
  [["onclick=\"window.plannerReschedule()\">↻ 重新排期</button>",
    "onclick=\"window.plannerReschedule()\">↻ 重新排期</button><button class=\"btn\" onclick=\"window.plannerReschedule()\">↻ 重新排期</button>"]],
  'window.planner* 调用不是 12 处');
run('M12 planner.html 摘掉 #tripHomeSlot（入口行的宿主没了，行程主页从此进不去）', 'planner.html',
  [["      <div id=\"tripHomeSlot\"></div>\n", ""]],
  '结果页只多一个槽位');
run('M13 ?trip=<id> 直达改成不走产品自己的入口（另写一套恢复逻辑＝两套状态机）', 'planner.js',
  [["        if (at >= 0) window.plannerOpenTrip(at);", "        if (at >= 0) { state.trip = tl[at]; renderResult(); }"]],
  '直达走产品自己的入口');
run('M14 认不出的 id 不再 toast（静默停在输入页让人以为链接坏了）', 'planner.js',
  [["        else toast('本机没有这趟行程（可能已删除，或换了一台机）');", "        else { /* 静默 */ }"]],
  '认不出只 toast 一句真话');

/* ============ ④ trip.html 四条分支与「绝不建桶」 ============ */
run('M15 open() 的守卫挪到赋值之后（认不出的 id 也会走到赋值那一步）', 'trip.html',
  [["    if (!t) { showUnknown(); return; }\n    tripId = t.id; trip = t;\n",
    "    tripId = t.id; trip = t;\n    if (!t) { showUnknown(); return; }\n"]],
  'open() 的守卫没有排在赋值之前');
run('M16 摘掉 showUnknown 那道闸（认不出的 id 静默停在上一态）', 'trip.html',
  [["    if (!t) { showUnknown(); return; }", "    if (!t) { return; }"]],
  'open() 里没有「认不出就走 showUnknown」这道闸');
run('M17 free 桶改成也造一个空壳 trip（在账本外多出一份行程数据）', 'trip.html',
  [["  if (q === Expense.FREE_ID) { location.replace('expense.html?trip=' + Expense.FREE_ID); }",
    "  if (q === Expense.FREE_ID) { open(q); }"]],
  'free 桶不是行程');
run('M18 空选择器卡改成恒显示（零行程时页顶露出一张空卡——本批自查抓到的真缺陷回潮）', 'trip.html',
  [["    $('pickCard').style.display = list.length ? 'block' : 'none';", "    $('pickCard').style.display = 'block';"]],
  '零行程时收起空选择器卡');
run('M19 空态与选择器不再共用 list.length（两个 display 各写一个条件就会同时出现）', 'trip.html',
  [["    $('tEmpty').style.display = list.length ? 'none' : 'block';", "    $('tEmpty').style.display = trip ? 'none' : 'block';"]],
  '两个 display 必须共用 list.length');

/* ============ ⑤ 票卡的异步守卫（单机上永远看不出来的那类失效） ============ */
run('M20 守卫改成比 trip.id（恒等式＝等于没有守卫）', 'trip.html',
  [["      if (tripId !== tid) return;   /* 期间换了趟：这张卡已经不是我那张 */",
    "      if (tripId !== (trip && trip.id)) return;"]],
  '守卫必须比这个快照');
run('M21 摘掉 id 快照（守卫比的是同一时刻的两个副本）', 'trip.html',
  [["    var tid = tripId;\n", ""]],
  '没有先捕获 id 快照');
run('M22 票卡不再先置空（上一趟的读数留在屏上，比短暂少一个数更容易骗人）', 'trip.html',
  [["    $('tTbN').textContent = '…'; $('tTbD').textContent = '';\n", ""]],
  '先置空再异步填');
run('M23 提醒改成系统通知（批次 17 的红线）', 'trip.html',
  [["    if (window.TicketBox && TicketBox.nudge) TicketBox.nudge(tripId);",
    "    if (window.TicketBox) new Notification('下一张票快到了');"]],
  'trip.html 里出现「new Notification」');

/* ============ ⑥ aria-live 的显式豁免（全站唯一一枚页面级活区） ============ */
run('M24 #tToday 带字一次插入（读屏不播，豁免的凭据当场失效）', 'trip.html',
  [['<div class="t-today" id="tToday" aria-live="polite"></div>', '<div class="t-today" id="tToday" aria-live="polite">今天是第 1 天</div>']],
  '不是空着进 DOM');
run('M25 trip.html 再私搭一枚活区（往 §36「全站唯一出处」族里再开口子）', 'trip.html',
  [['<div class="t-date" id="tDate"></div>', '<div class="t-date" id="tDate" aria-live="polite"></div>']],
  '本页只此一枚活区');

/* ============ ⑦ me.html 两张常驻卡（24-E） ============ */
run('M26 「今年已花」的合计退回 catTotals（不分年＝往年的账算进今年）', 'me.html',
  [["    var y = Expense.yearCents(year, function(id){ return byId[id] || null; });",
    "    var y = { cents: Expense.catTotals(Expense.FREE_ID).reduce(function(s,c){ return s + c.cents; }, 0), count: 0 };"]],
  'me.html 里出现「Expense.catTotals(」');
run('M27 摘掉 tripIds() 那一步并集（行程删光后合计还在、分类一片空白）', 'me.html',
  [["    Expense.tripIds().forEach(function(id){ seen[id] = 1; buckets.push({ id: id, start: startOf(byId[id]) }); });\n", ""]],
  '不再调 tripIds()');
run('M28 桶并集挪到 byDate 之后（孤儿账那一批已经漏掉了）', 'me.html',
  [["    Expense.tripIds().forEach(function(id){ seen[id] = 1; buckets.push({ id: id, start: startOf(byId[id]) }); });\n", ""],
   ["    var top = Expense.CATS.map(function(c){ return { cat: c, cents: m[c] }; })",
    "    Expense.tripIds().forEach(function(id){ seen[id] = 1; buckets.push({ id: id, start: startOf(byId[id]) }); });\n    var top = Expense.CATS.map(function(c){ return { cat: c, cents: m[c] }; })"]],
  'renderYear 的桶并集没有排在 byDate 之前');
run('M29 free 桶补位不去重（tripIds() 已含 free，再 push 一次就是把「未编排行程」算两遍）', 'me.html',
  [["    if (!seen[Expense.FREE_ID]) buckets.push({ id: Expense.FREE_ID, start: '' });",
    "    buckets.push({ id: Expense.FREE_ID, start: '' });"]],
  'free 桶补位必须去重');
run('M30 摘掉异步补票数的幂等旗子（整体重画后印两遍「票 2 张 · 票 2 张」）', 'me.html',
  [["          s.setAttribute('data-tk', String(tk.length));\n", ""]],
  '异步补票数的幂等旗子');
run('M31 行程行小字退回单行 ellipsis（打卡／清单／票整截被吃掉）', 'me.html',
  [["-webkit-line-clamp:2", "-webkit-line-clamp:1"]],
  '行程行小字两行夹断');
run('M32 「今年合计」改回未定义令牌 --fs-11（静默退化成 16px，24-B／24-D 入库过的真缺陷）', 'me.html',
  [[".msum b{font-family:var(--font-serif);font-size:var(--fs-10)", ".msum b{font-family:var(--font-serif);font-size:var(--fs-11)"]],
  'me.html 里引用了 var(--fs-11)');
run('M33 两张卡脱离 window.Expense 门控（模块没载也画两张 0.00 的空卡）', 'me.html',
  [["    if (window.Expense) { renderTrips(); renderYear(); }", "    renderTrips(); renderYear();"]],
  '两张卡的渲染挂在同一个门控后');
run('M34 空态摘掉「不排行程，直接记一笔」那条路（不用排期的人在这一页走到头）', 'me.html',
  [["        '<a class=\"mbtn\" href=\"expense.html?trip=' + encodeURIComponent(Expense.FREE_ID) + '\">不排行程，直接记一笔</a>';", "        '';"]],
  '零行程空态第二条路');

/* ============ ⑧ 数据层与字号阶梯 ============ */
run('M35 yearCents 不再按实际口径筛年（排期只是参考时，钱跟着计划那天走）', 'expense.js',
  [["      var d = effDate(x, t && (t.logStart || t.startDate));", "      var d = effDate(x, t && t.startDate);"]],
  'yearCents 按**实际口径**筛年');
run('M36 yearCents 去掉年份过滤（反推不出日期的也进今年）', 'expense.js',
  [["      if (d.slice(0, 4) === y) { c += centsOf(x); n++; }", "      c += centsOf(x); n++;"]],
  '反推不出日期的条目不进任何年份');
run('M37 tripIds 不再导出（页面调不到，只有运行时才红）', 'expense.js',
  [["    byDate: byDate, migrate: migrate, undated: undated, yearCents: yearCents, tripIds: tripIds,",
    "    byDate: byDate, migrate: migrate, undated: undated, yearCents: yearCents,"]],
  '两个跨桶读数都在导出串上');
run('M38 design.css 私自加一档 --fs-11（§21「只许降不许升」的阶梯口径当场失控）', 'design.css',
  [["  --fs-10:1.5rem;     /* 24px 页面主标题 */", "  --fs-10:1.5rem;     /* 24px 页面主标题 */\n  --fs-11:1.75rem;"]],
  '这一档全站未定义');
run('M39 expense.js 给「没有 tripId」偷偷兜底成 free 桶（豁免口从此不在调用方手里）', 'expense.js',
  [["    if (!tripId) return null;", "    if (!tripId) tripId = FREE_ID;"]],
  '「没有 tripId 就不落账」这条不许被兜底改掉');

/* ============ ⑨ 判据在场（字号与真机档这两条腿只能从浏览器侧断） ============ */
run('M40 smoke-trip 的 T52 改编号（字号回归网悄悄消失，条数守卫看不出来）', 'tools/smoke-trip.js',
  [["ok('T52 ", "ok('T5X "]], 'tools/smoke-trip.js 缺 T52');
runAll('M41 smoke-trip 的真机主档改回 452×995（「真机档已验证」验的是一台不存在的手机）', 'tools/smoke-trip.js',
  '{ width: 328, height: 723 }', '{ width: 452, height: 995 }', '真机主档取样两页');
runAll('M42 smoke-expense 的判据全改名（121 条下界守卫必须说话）', 'tools/smoke-expense.js',
  "ok('", "ok2('", 'smoke-expense.js 的判据条数掉到');

/* ============ ⑩ 守门的门：合成对照自己坏掉时必须说话 ============ */
run('M43 open 顺序断言的反向对照改成正确顺序（这条锚从此分不出对错）', 'tools/verify.js',
  [["const BADO = flat38('function open(id) { var t = findTrip(id); tripId = t.id; trip = t; if (!t) { showUnknown(); return; } render(); }');",
    "const BADO = flat38('function open(id) { var t = findTrip(id); if (!t) { showUnknown(); return; } tripId = t.id; trip = t; render(); }');"]],
  'open 顺序断言的反向对照失效');
run('M44 renderYear 顺序断言的反向对照改成正确顺序', 'tools/verify.js',
  [["const BADY = flat38('function renderYear(){ Expense.byDate(a, b).forEach(f); Expense.tripIds().forEach(g); }');",
    "const BADY = flat38('function renderYear(){ Expense.tripIds().forEach(g); Expense.byDate(a, b).forEach(f); }');"]],
  'renderYear 顺序断言的反向对照失效');
run('M45 patchTrip 顺序断言的反向对照改成正确顺序', 'tools/verify.js',
  [["const BADP = flat38('function patchTrip(fn) { var list = readTrips(), hit = null; fn(hit); writeTrips(list); if (!hit) { UI.toast(\"x\"); return false; } }');",
    "const BADP = flat38('function patchTrip(fn) { var list = readTrips(), hit = null; if (!hit) { UI.toast(\"x\"); return false; } fn(hit); writeTrips(list); }');"]],
  'patchTrip 顺序断言的反向对照失效');
run('M46 票卡守卫的反向对照 2 改成正确顺序', 'tools/verify.js',
  [["const BADT2 = flat38('function renderTickets() { TicketBox.list(tripId).then(function (rows) { if (tripId !== tid) return; var tid = tripId; draw(rows); }); }');",
    "const BADT2 = flat38('function renderTickets() { var tid = tripId; TicketBox.list(tripId).then(function (rows) { if (tripId !== tid) return; draw(rows); }); }');"]],
  '票卡守卫的反向对照 2 失效');
run('M47 aria-live 豁免判据的正则放宽（合成的「带字一次插入」也被当成空着进 DOM）', 'tools/verify.js',
  [["const emptyLive38 = s => /id=\"tToday\" aria-live=\"polite\"><\\/div>/.test(s);",
    "const emptyLive38 = s => /id=\"tToday\"/.test(s);"]],
  'aria-live 豁免判据的反向对照失效');
run('M48 catTotals 那条期望 0 的正向对照串里抹掉 needle（那个 0 从此不是证据）', 'tools/verify.js',
  [["      'var cats = Expense.catTotals(tripId);',", "      'var cats = Expense.categoryTotals(tripId);',"]],
  '这条期望 0 的正向对照失效');
run('M49 ZERO38 有一条抹掉正向对照字段（四元组形状不整即红，不许解构错位后静默放行）', 'tools/verify.js',
  [["    ['me.html', 'Expense.catTotals(',\n      'var cats = Expense.catTotals(tripId);',\n", "    ['me.html', 'Expense.catTotals(',\n"]],
  'ZERO38 有一条不是');
run('M50 A38 有一条登记了 §38 没读的文件（这条锚一次都没跑过）', 'tools/verify.js',
  [["['tools/smoke-trip.js', \"ok('T45 \", 1,", "['tools/smoke-missing.js', \"ok('T45 \", 1,"]],
  '登记了 §38 没读的文件');
/* README 里 §38 实测出现 2 次（清单行 + smoke-trip 那段的前向引用），run() 要求恰 1 命中会判异常；
   这族要的是「登记整体消失」，所以全换。 */
runAll('M51 README 的 §38 登记改名（新闸门不写进 README 就等于没装）', 'README.md',
  '§38', '§3X', '没提 §38');

/* ============ ⑪ 设计内静默：源码腿抓不到、只有浏览器腿抓得到 ============ */
greenCase('G1 me.html 空态按钮 min-height 44px → 24px（字面量锚一根没动，只是按不到了）', 'me.html',
  '.mbtn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px',
  '.mbtn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:24px');

console.log('源码腿小结: 共 ' + total + ' 条 → 按预期红 ' + red + ' · 设计内静默 ' + silent + ' · 异常 ' + anomalies);
console.log('还原自检: ' + (FILES.filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8') === ORIG[f]).length) + '/' + FILES.length + ' 文件逐字节等于基准');
process.exit(anomalies ? 1 : 0);
