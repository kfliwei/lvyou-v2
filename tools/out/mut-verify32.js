/* tools/out/mut-verify32.js — verify.js §32（开销记账 / 预算 / CSV）变异自测
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条**红里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 为什么这批特别需要：钱族最坏的错法是「静默错到底」——界面永远看着对，症状要等到
 * 用户对账那天才出现。§32 里因此有八族「期望 0」和两组函数体结构断言，而期望 0 的锚
 * 是最容易写成恒真的那一类（needle 串在源码里根本不存在、正向对照自己失效）。
 * 判红范围除 §32 外还带 §16（备份键策略）、§30（Notification 全站零命中）与 §21（字号/触控邻居）：
 * 键被改、Notification 回潮都是「别的节早就该挡」的形状，写进 FAIL 文案里更有力。
 *
 * 用法: node tools/out/mut-verify32.js > tools/out/b19-mut-verify32.txt 2>&1
 * 浏览器腿（smoke-expense 自身）另见文末 B 组：那条要打的是「产品改了、判据还绿」，
 * 需要真跑一次 66 条冒烟（约 3 分钟/条），本批以 A16d/A35 两条打点为准。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['expense.js', 'planner.js', 'planner.html', 'share.js', 'backup.js',
  'tools/gen-sw-shell.cjs', 'tools/smoke-expense.js', 'tools/verify.js', 'README.md',
  'docs/功能完善实施方案-2026-10-05.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
const pick = out => out.split('\n').filter(l =>
  l.indexOf('FAIL §32') >= 0 || l.indexOf('FAIL §16') >= 0 || l.indexOf('FAIL §30') >= 0 ||
  l.indexOf('语法') >= 0 || /FAIL .*:/.test(l));

let red = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let lines;
  try { lines = pick(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → 本轮红 ' + lines.length + ' 条，指定那条：' + hit[0].replace(/^FAIL /, '').slice(0, 130));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
function run(name, file, from, to, token, wantCount) {
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  const wc = wantCount === undefined ? 1 : wantCount;
  if (n !== wc) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 ' + wc + '（源码已漂移或 needle 写错）');
    return;
  }
  if (from === to) {
    total++; anomalies++;
    console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
    return;
  }
  judge(name, file, src.replace(from, () => to), token);
}
function runAll(name, file, from, to, token) {
  const src = ORIG[file];
  if (src.split(from).length - 1 < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.split(from).join(to), token);
}
const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');

/* ============ ① 浮点入口：账本只许有两道门 ============ */
run('M1 把 add 的元→分换成裸浮点乘（0.1+0.2 类退化，三笔 33.33 复算差 1e-14）', 'expense.js',
  'var cents = Math.round(n * 100);', 'var cents = n * 100;',
  'var cents = Math.round(n * 100);');
run('M2 把 setBudget 的元→分换成裸浮点乘（同上，预算侧）', 'expense.js',
  'var cents = (!isFinite(n) || n <= 0) ? 0 : Math.round(n * 100);',
  'var cents = (!isFinite(n) || n <= 0) ? 0 : n * 100;',
  'var cents = (!isFinite(n) || n <= 0) ? 0 : Math.round(n * 100);');
run('M3 偷偷多开第三道浮点入口（读侧从元开始算）', 'expense.js',
  'var cents = Math.round(n * 100);', 'var cents = Math.round(n * 100), again = Math.round(n * 100);',
  '全模块浮点→整数只有这两处');
run('M4 另开一个 parseFloat 入口（Number() 单点被绕过）', 'expense.js',
  'var n = Number(yuan);', 'var n = parseFloat(yuan);',
  'expense.js 里出现「parseFloat」', 2);
run('M5 fmtMoney 改用 toFixed（把误差藏进「看上去对」的读数，补零也不再是手写）', 'expense.js',
  "return sign + y + '.' + (f < 10 ? '0' : '') + f;", 'return sign + (a / 100).toFixed(2);',
  '不许出现 toFixed');
run('M6 天序号退回 0 起（那天永远不进任何日卡）', 'expense.js',
  'var n = Math.round(Number(d)); return isFinite(n) && n >= 1 ? n : 1;',
  'var n = Math.round(Number(d)); return isFinite(n) && n >= 0 ? n : 0;',
  'var n = Math.round(Number(d)); return isFinite(n) && n >= 1 ? n : 1;');
run('M7 id 改成散列（同天同分类同金额的第二笔被并掉＝丢钱）', 'expense.js',
  "function uniqId() { return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); }",
  "function uniqId() { return 'e1'; }",
  'function uniqId()');
run('M8 存储写满改静默成功（钱没记上但没人知道）', 'expense.js',
  "catch (e) { if (window.UI && UI.toast) UI.toast('本地存储已满，这笔账本次没有记上'); return false; }",
  'catch (e) { return true; }',
  '本地存储已满');
run('M9 超支算成差值（没超时外露「已超预算 -40.00 元」）', 'expense.js',
  'return t > b ? t - b : 0;', 'return t - b;',
  'return t > b ? t - b : 0;');
run('M10 清空预算留 0 分档（「已设预算」与除零同时发生）', 'expense.js',
  'if (cents) d[tripId] = cents; else delete d[tripId];', 'd[tripId] = cents;',
  'if (cents) d[tripId] = cents; else delete d[tripId];');
run('M11 删行程留下孤儿桶（filter 反向）', 'expense.js',
  'keep = list.filter(function (x) { return x.tripId !== tripId; });',
  'keep = list.filter(function (x) { return x.tripId === tripId; });',
  'keep = list.filter(function (x) { return x.tripId !== tripId; });');
run('M12 未知分类不再归「其他」（别台机并回来的脏值进不了汇总）', 'expense.js',
  "function catOf(c) { var i = CATS.indexOf(c); return i >= 0 ? CATS[i] : '其他'; }",
  "function catOf(c) { return CATS.indexOf(c) >= 0 ? c : '合计'; }",
  'var i = CATS.indexOf(c); return i >= 0 ? CATS[i]');

/* ============ ② CSV：BOM / CRLF / RFC 判定 ============ */
run('M13 丢掉 BOM（无 BOM 的 UTF-8 中文账单在 Windows Excel 里开成一屏乱码）', 'expense.js',
  String.raw`return '\ufeff' + L.join('\r\n') + '\r\n';`,
  String.raw`return L.join('\r\n') + '\r\n';`,
  String.raw`return '\ufeff' + L.join('\r\n') + '\r\n';`);
run('M14 行结束符改成 LF（Excel 旧版把整份文件当一行）', 'expense.js',
  String.raw`return '\ufeff' + L.join('\r\n') + '\r\n';`,
  String.raw`return '\ufeff' + L.join('\n') + '\n';`,
  String.raw`return '\ufeff' + L.join('\r\n') + '\r\n';`);
run('M15 把中文逗号也当分隔符（每个「地铁，机场线」都被套上引号，列数没错、读感全乱）', 'expense.js',
  String.raw`return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;`,
  String.raw`return /[",，\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;`,
  String.raw`return /[",\r\n]/.test(s)`);
run('M16 引号不再加倍（表格软件把「说"好"的」读成残缺字段）', 'expense.js',
  String.raw`return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;`,
  String.raw`return /[",\r\n]/.test(s) ? '"' + s + '"' : s;`,
  String.raw`return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;`);
run('M17 表头列名被改（旧账单从此对不上号）', 'expense.js',
  "csvRow(['日期', '第几天', '分类', '金额(元)', '垫付人', '备注'])",
  "csvRow(['日期', '第几天', '分类', '金额', '垫付人', '备注'])",
  "csvRow(['日期', '第几天', '分类', '金额(元)', '垫付人', '备注'])");
run('M18 没设预算写 0.00（0 元预算与没预算是两回事）', 'expense.js',
  "L.push(csvRow(['预算', budget ? fmtMoney(budget) : '未设']));",
  "L.push(csvRow(['预算', fmtMoney(budget)]));",
  "L.push(csvRow(['预算', budget ? fmtMoney(budget) : '未设']));");
run('M19 删掉结余分支（没超支的账单看着像缺了一行）', 'expense.js',
  "if (budget) L.push(csvRow([over ? '超支' : '结余', fmtMoney(over ? over : budget - total)]));",
  "if (budget && over) L.push(csvRow(['超支', fmtMoney(over)]));",
  "if (budget) L.push(csvRow([over ? '超支' : '结余', fmtMoney(over ? over : budget - total)]));");

/* ============ ③ 分类只有一份 + 显示即存入 ============ */
run('M20 planner 侧另立一套分类字面量（与 expense.js 那份从此会漂）', 'planner.js',
  'function expCatNow() {',
  "var CATS2 = ['交通', '合计']; function expCatNow() {",
  "planner.js 里出现「['交通'」");
run('M21 chip 改由 UI 自己列表（模块那份不再是唯一来源）', 'planner.js',
  'Expense.CATS.map(function (c, i) {',
  "['交通', '住宿', '餐饮', '门票', '购物', '其他'].map(function (c, i) {",
  'Expense.CATS.map(function (c, i) {');
run('M22 高亮侧绕开单点（本批真实事故的前半：显示的是餐饮）', 'planner.js',
  'var sel = expCatNow();', "var sel = state.expCat || '餐饮';",
  'expEditor 体里直接读 state.expCat');
run('M23 提交侧绕开单点（后半：存进去的是其他）', 'planner.js',
  "lump ? '其他' : expCatNow(),", "lump ? '其他' : (state.expCat || '其他'),",
  'plannerExpSave 体里直接读 state.expCat');
run('M24 单点被改成常量（高亮与提交仍然「同源」，但都不再认用户选的档）', 'planner.js',
  "function expCatNow() { return Expense.CATS.indexOf(state.expCat) >= 0 ? state.expCat : '餐饮'; }",
  "function expCatNow() { return '餐饮'; }",
  'function expCatNow() { return Expense.CATS.indexOf(state.expCat) >= 0 ? state.expCat');
run('M25 分类不再粘（连记三笔同类要每笔重点一次）', 'planner.js',
  'state.expCat = c;', 'void c;',
  'state.expCat = c;');
run('M26 提交旁路 Expense.add（写盘出口没了＝某个入口自己拼对象）', 'planner.js',
  'var it = Expense.add(expTripId(), di + 1, yuan,', 'var it = expBypassAdd(expTripId(), di + 1, yuan,',
  'plannerExpSave 体里 Expense.add( 不是恰 1 次');
run('M27 函数头签名被改（体断言抽不出＝守卫必须出声，不许静默跳过）', 'planner.js',
  'window.plannerExpSave = function (di, lump) {', 'window.plannerExpSave = function (di) {',
  '抽不出 window.plannerExpSave 函数体');

/* ============ ④ 录入与界面（手机上看得见的那一半） ============ */
run('M28 记账入口改回「记一笔」，与同卡打卡按钮撞名（点错就把打卡记成钱）', 'planner.js',
  "TI('budget') + '记开销'", "'记一笔'",
  '入口叫「记开销」');
run('M29 金额框退回裸 text（手机上要自己切数字键盘）', 'planner.js',
  'id="exAmt" type="number" inputmode="decimal" min="0" step="0.01"',
  'id="exAmt" type="text"',
  'number+decimal 手机才直接上数字键盘');
run('M30 0 元与垃圾输入不再拦（落一笔 0 分，明细里多个空行）', 'planner.js',
  "if (!isFinite(n) || n <= 0) { toast('先填一个大于 0 的金额'); if (amt) amt.focus(); return; }",
  'if (!isFinite(n)) n = 0;',
  '先填一个大于 0 的金额');
run('M31 删除确认不点名是哪一笔（只写「确定删除吗」＝让人盲签）', 'planner.js',
  "text: '删除「' + it.cat + ' ' + Expense.fmtMoney(it.cents) + ' 元」这条记录？删了就找不回来。',",
  "text: '确定删除吗？',",
  '破坏性确认点名是哪一笔');
run('M32 破坏性操作走回原生 confirm（WebView 里不可样式化，也带不动那句话）', 'planner.js',
  'var tid = expTripId(), it = expOf(di).list[k];', 'var tid = expTripId(), it = expOf(di).list[k]; if (window.confirm(it.cat)) return;',
  'planner.js 里出现「window.confirm(」');
run('M33 系统推送回潮（红线：提醒只有页内横幅一条腿）', 'planner.js',
  'function expTripId() { var t = state.trip; return t ? ensureTripId(t) : \'\'; }',
  'function expTripId() { try { new Notification("账"); } catch (e) {} var t = state.trip; return t ? ensureTripId(t) : \'\'; }',
  'Notification');
run('M34 条形把零钱分类也列出来（六行里四行是 0 的图等于没图）', 'planner.js',
  'var cats = Expense.catTotals(tid).filter(function (c) { return c.cents > 0; });',
  'var cats = Expense.catTotals(tid);',
  '条形只列有钱的分类');
run('M35 进度条不再夹在 100%（超支时冲出卡片）', 'planner.js',
  'Math.min(100, Math.round(total / budget * 100))', 'Math.round(total / budget * 100)',
  '条宽夹在 100');
run('M36 最小分类丢了 4% 下限（12.50 挤成 0 宽，看着像没记）', 'planner.js',
  'Math.max(4, Math.round(c.cents / max * 100))', 'Math.round(c.cents / max * 100)',
  '最小分类给 4% 下限');
run('M37 超支只剩颜色（WCAG 1.4.1：色盲/小屏/黑白打印读不出来）', 'planner.js',
  "$id('expOver').innerHTML = over ? '<div class=\"warnline\">' + TI('warn') + '已超预算 ' + Expense.fmtMoney(over) + ' 元</div>' : '';",
  "$id('expOver').innerHTML = over ? '<div class=\"warnline\"></div>' : '';",
  '超支必须有字');
run('M38 正在输入的预算框被回写（用户刚敲的数字按分位重排）', 'planner.js',
  "if (bud && document.activeElement !== bud) bud.value = budget ? Expense.fmtMoney(budget) : '';",
  "if (bud) bud.value = budget ? Expense.fmtMoney(budget) : '';",
  '正在输入时不回写');
run('M39 空账时导出键改 disabled（点不动＝没有那句教路的话）', 'planner.js',
  "if (csvBtn) csvBtn.style.opacity = list.length ? '' : '.55';",
  'if (csvBtn) csvBtn.disabled = !list.length;',
  '空账时只降透明度不 disabled');
run('M40 空账也照样下载（用户以为账单坏了）', 'planner.js',
  "if (!Expense.listOf(tid).length) { toast('这笔账还是空的：先在日卡底部记一笔开销，再来导出 CSV'); return; }",
  'void 0;',
  '空账导出下载一个只有表头的文件');
run('M41 导出文件名不过 icsFileSafe（行程名带 / 就直接报错）', 'planner.js',
  "saveTextDoc(icsFileSafe(t.name) + '-开销.csv', csv, 'text/csv;charset=utf-8', '用表格软件打开即可');",
  "saveTextDoc(t.name + '-开销.csv', csv, 'text/csv;charset=utf-8', '用表格软件打开即可');",
  "saveTextDoc(icsFileSafe(t.name) + '-开销.csv'");
run('M42 删行程后汇总卡不重绘（账清了，卡还挂着上一趟的「已超预算」）', 'planner.js',
  'renderTrips();' + EOL('planner.js') +
  '      /* 账已经跟着行程清了，汇总卡必须重绘：只 renderTrips 的话这张卡还挂着上一趟的金额与进度条 */' + EOL('planner.js') +
  '      renderExpense();',
  'renderTrips();',
  '两处（删除后 + 撤销后）都要重绘汇总卡');
run('M43 撤销只还账不还预算（两桶不同源，预算悄悄丢了）', 'planner.js',
  "if (exRaw != null) lsSet('tn_expense', exRaw); if (bdRaw != null) lsSet('tn_budget', bdRaw);",
  "if (exRaw != null) lsSet('tn_expense', exRaw);",
  "if (exRaw != null) lsSet('tn_expense', exRaw); if (bdRaw != null) lsSet('tn_budget', bdRaw);");

/* ============ ⑤ 隐私与登记 ============ */
run('M44 预算进了分享白名单（点开链接的人看见每趟花多少）', 'share.js',
  'lo: 1, k: 1 };', 'lo: 1, k: 1, budget: 1 };',
  'share.js 里出现「budget」');
run('M45 账目并进 trip 对象（分享载荷的来源就是 trip，白名单成了唯一防线）', 'share.js',
  'lo: 1, k: 1 };', 'lo: 1, k: 1, expense: 1 };',
  'share.js 里出现「expense」');
run('M46 备份侧账目改成按内容去重（跨机并集把两笔真开销并成一笔）', 'backup.js',
  "{ k: 'tn_expense', g: 'data', m: 'id' },", "{ k: 'tn_expense', g: 'data', m: 'text' },",
  "{ k: 'tn_expense', g: 'data', m: 'id' },");
run('M47 预算键的并集方式从 dict 改成 id（顶层属性是 tripId，按 id 并集会整桶丢）', 'backup.js',
  "{ k: 'tn_budget', g: 'data', m: 'dict' },", "{ k: 'tn_budget', g: 'data', m: 'id' },",
  "{ k: 'tn_budget', g: 'data', m: 'dict' },");
run('M48 记账模块没进离线壳名单（生成器的 filter 会静默抹掉，离线首屏一片白）', 'tools/gen-sw-shell.cjs',
  "'expense.js', 'share.js', 'checklist.js', 'ticketbox.js'", "'share.js', 'checklist.js', 'ticketbox.js'",
  "tools/gen-sw-shell.cjs 里「'expense.js', 'share.js'");

/* ============ ⑥ 页面结构与 44px 触控族 ============ */
run('M49 页面不吃 expense.js（planner 里所有 Expense.* 全是 ReferenceError）', 'planner.html',
  '<script src="expense.js" defer></script>', '',
  '模块进页面');
run('M50 汇总卡丢了 sumcard 作用域（批次 17 那条进度条样式不再命中，这张条隐形）', 'planner.html',
  '<div class="card sumcard" id="expCard" style="display:none">', '<div class="card" id="expCard" style="display:none">',
  '汇总卡挂 sumcard');
run('M51 预算框没有 label（读屏与「点文字聚焦」一起丢）', 'planner.html',
  '<label for="exBudget">预算</label>', '<span>预算</span>',
  'label 关联');
run('M52 分类 chip 退回 34px（它是判定，不是装饰标签）', 'planner.html',
  '.exedit .excats .chip{min-height:44px}', '.exedit .excats .chip{min-height:34px}',
  '.exedit .excats .chip{min-height:44px}');
run('M53 底脚入口没提档（空账时汇总卡指路指的就是这两颗）', 'planner.html',
  '.day-card .exfoot .btn{min-height:44px}', '',
  '底脚两个入口 44');
run('M54 明细删除方块退回 30px（销毁真实记录不是轻操作）', 'planner.html',
  '.exrows .ex .mv{width:44px;height:44px;flex:0 0 auto}', '.exrows .ex .mv{width:30px;height:30px;flex:0 0 auto}',
  '.exrows .ex .mv{width:44px;height:44px;flex:0 0 auto}');
run('M55 「记上」/「收起」没提档', 'planner.html',
  '.exedit .exacts .btn{flex:1;min-height:44px;justify-content:center;display:flex;align-items:center}',
  '.exedit .exacts .btn{flex:1;justify-content:center;display:flex;align-items:center}',
  '「记上」/「收起」44');
run('M56 导出键退回 .btn 基数 42', 'planner.html', '#expCsvBtn{min-height:44px}', '', '导出键 44');

/* ============ ⑦ 浏览器腿：夹具与判据齐备 ============ */
run('M57 冒烟夹具改成桌面宽（桌面量出来的触控与溢出一律不作数）', 'tools/smoke-expense.js',
  'await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });',
  'await p.setViewport({ width: 1280, height: 900 });',
  '452×995 是一加 Ace 6T 真机档');
run('M58 原生 confirm 计数器被摘（下面「零原生」那条没有它永远为真）', 'tools/smoke-expense.js',
  'window.confirm = function () { window.__native++; return true; };',
  'window.confirm = function () { return true; };',
  'window.confirm = function () { window.__native++; return true; };');
run('M59 把 A35 改名成 A35x（判据还在，但齐备检必须认「id + 空格」而不只认前缀）', 'tools/smoke-expense.js',
  "ok('A35 首三字节", "ok('A35x 首三字节",
  '缺 A35');
run('M60 删掉 A16d 整条（「显示即存入」这条腿没了）', 'tools/smoke-expense.js',
  "  ok('A16d 显示即存入：没碰分类时存进去的分类＝屏幕上高亮的那一档，不是另兜一套默认',\r\n" +
  "    S1.length === 1 && S1[0].cat === SHOW[0] && S1[0].cents === 3333, JSON.stringify(S1[0] || {}));\r\n",
  '', '缺 A16d');
run('M61 README 去掉 §32 登记（新闸门不写进 README 就等于没装）', 'README.md',
  '/§32 开销记账（', '/开销记账（',
  'README.md 的 verify 清单没提 §32');
runAll('M62 方案文档去掉「批次 19 已实施」（收工状态只能靠文档留在案上）', 'docs/功能完善实施方案-2026-10-05.md',
  '批次 19 已实施', '批次 19 未登记',
  '方案文档没登记「批次 19 已实施」');

/* ============ ⑧ 打守卫自己：锚点表与四元组 ============ */
run('M63 锚点表被削减一条（守卫自己必须有线）', 'tools/verify.js',
  "    ['expense.js', 'var cents = Math.round(n * 100);', 1, 'add 的元→分入口（账本唯一的浮点入口之一）']," + EOL('tools/verify.js'),
  '', '锚点表被削减');
run('M64 四元组少写文件字段（这条锚从此一次都没跑过，还不说话）', 'tools/verify.js',
  "    ['expense.js', 'a / 100', 1, '分→元只在 fmtMoney 显示时发生一次'],",
  "    ['a / 100', 1, '少了文件字段'],",
  '四元组');
run('M65 正向对照自己失效（把合成对照源改掉，期望 0 就成了自证）', 'tools/verify.js',
  "const CTRL32 = flat32(\"function expEditor(di) { var sel = state.expCat || '餐饮'; }\");",
  "const CTRL32 = flat32(\"function expEditor(di) { var sel = '餐饮'; }\");",
  '的正向对照失效了');

console.log('\n=== mut-verify32（源码腿）: ' + red + ' 条按预期红 / ' + anomalies + ' 条异常 / 共 ' + total + ' 条 ===');
console.log('异常＝0 才说明 §32 每条锚都有线；打不红的锚要先修锚再收工。');
process.exit(anomalies ? 1 : 0);
