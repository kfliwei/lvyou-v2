/* tools/out/mut-verify33.js — verify.js §33（路线档位 + 锁定点）变异自测
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条**红里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 为什么这批特别需要：这一族两种坏法都是**静默**的——800m 的两站按 60km/h 排成「车程 1 分钟」，
 * 界面上没有任何一处说这不对；手动把第三站挪到第一位、下次点「重新排期」它又飞回去，用户只会
 * 觉得软件在乱来。§33 里因此有 MODE 六数逐值锚、九处函数体结构断言和十五族期望 0，而「期望 0」
 * 与「恰 N 次」都是最容易写成恒真的那一类（needle 在源码里根本不存在／正向对照自己失效）。
 *
 * 判红范围除 §33 外还收其它节的 FAIL：档位文案与 share 白名单同时被 §17/§28 钉着，
 * 键被改、系数被重抄往往**别的节早就该挡**——红在别处也算有线，但 token 必须落在指定那条上。
 *
 * 用法: node tools/out/mut-verify33.js > tools/out/b20-mut-verify33.txt 2>&1
 * 浏览器腿（同一变异 smoke 也要红）见文末「两层都红」两条：需要真跑一次 113 条冒烟（约 4 分钟），
 * 与像素基线不能并行（变异打的正是基线要截的那几页）。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['planner.js', 'planner.html', 'share.js', 'share.html',
  'tools/smoke-planner.js', 'tools/verify.js', 'README.md',
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
  l.indexOf('FAIL §33') >= 0 || l.indexOf('语法') >= 0 || /^FAIL /.test(l));

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
/* run：from 必须恰 wantCount 处，只替第一处（String.replace 给字符串模式就只换第一处） */
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
/* runAll：from 出现几处替几处，给「改名／去掉登记串」那类 indexOf<0 型断言用（§31 的 M36 教训） */
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

/* ============ ① MODE 表与唯一尺子（改一个数就是改产品口径） ============ */
run('M1 自驾均速 60→48（门到门均速被当成限速，440km 一天能到的段会拆成两天）', 'planner.js',
  "drive: { label: '自驾', kmh: 60, factor: 1.35 },", "drive: { label: '自驾', kmh: 48, factor: 1.35 },",
  "kmh: 60");
run('M2 步行速度 4.5→6（档位还在、尺子已经不准：三档单调关系当场失真）', 'planner.js',
  "walk: { label: '步行', kmh: 4.5, factor: 1.15 }", "walk: { label: '步行', kmh: 6, factor: 1.15 }",
  'kmh: 4.5');
run('M3 自动档自己给出速度（kmh/factor 归 0 是为了让 pickMode 说话，给 nonzero 就是两套口径）', 'planner.js',
  "auto: { label: '自动', kmh: 0, factor: 0 }", "auto: { label: '自动', kmh: 60, factor: 1.35 }",
  'kmh: 0, factor: 0');
run('M4 自动档两阈值改大（市内 800m 的两站又回到「车程 1 分钟」）', 'planner.js',
  'var AUTO_WALK_KM = 1.5, AUTO_BIKE_KM = 6;', 'var AUTO_WALK_KM = 99, AUTO_BIKE_KM = 999;',
  'AUTO_WALK_KM = 1.5');
run('M5 老行程的缺档从自驾改口成自动（存好的账全变：同一趟行程重开换了尺子）', 'planner.js',
  "function modeOf(tb) { return MODE[tb] ? tb : 'drive'; }", "function modeOf(tb) { return MODE[tb] ? tb : 'auto'; }",
  "return MODE[tb] ? tb : 'drive'");
run('M6 新建行程默认档从自动改回自驾（两个入口各写字面量的开始）', 'planner.js',
  "function travelByNow() { var w = state.wiz && state.wiz.travelBy; return MODE[w] ? w : 'auto'; }",
  "function travelByNow() { var w = state.wiz && state.wiz.travelBy; return MODE[w] ? w : 'drive'; }",
  "return MODE[w] ? w : 'auto'");
run('M7 选档判定反写（近的走步行改成近的开车）', 'planner.js',
  "return straightKm <= AUTO_WALK_KM ? 'walk' : straightKm <= AUTO_BIKE_KM ? 'bike' : 'drive';",
  "return straightKm <= AUTO_WALK_KM ? 'drive' : straightKm <= AUTO_BIKE_KM ? 'bike' : 'walk';",
  '选档判定单点');
run('M8 mkLeg 形参退回不带档位（所有调用点多传的字面量被静默忽略）', 'planner.js',
  'function mkLeg(matrix, tb) {', 'function mkLeg(matrix) {',
  '唯一尺子的形参含档位');
run('M9 驾车矩阵喂给所有档位（40km 的段算成「骑行 40 分钟」）', 'planner.js',
  "if (m === 'drive' && matrix) {", 'if (matrix) {',
  '矩阵只喂自驾');
run('M10 缺矩阵时系数写死 1.35（改了 MODE 表也白改：档位只影响时长不影响里程）', 'planner.js',
  'if (km == null) km = straight * mo.factor;', 'if (km == null) km = straight * 1.35;',
  '按本档系数折算');
run('M11 时长不带货出的档位（界面无法说明这一段按什么算的）', 'planner.js',
  'return { km: km, h: km / mo.kmh, mode: m };', 'return { km: km, h: km / mo.kmh };',
  '把用的哪档带出去');
run('M12 最近邻排序退回裸 mkLeg(null)（漏传档位＝默认回自驾，界面上没人看得出这一段被当成开车算）', 'planner.js',
  'var leg = mkLeg(null, tb);', 'var leg = mkLeg(null);',
  '漏传档位');
run('M13 矩阵排序路径退回裸 mkLeg', 'planner.js',
  'var leg = mkLeg(dist || {}, tb);', 'var leg = mkLeg(dist || {});',
  '矩阵排序路径同一条尺子');
run('M14 日卡兜底退回裸 mkLeg（三个裸调用点之一就是从这里长回来的）', 'planner.js',
  'leg = leg || mkLeg(null, state.trip ? state.trip.travelBy : travelByNow());', 'leg = leg || mkLeg(null);',
  '兜底也走档');
run('M15 旧单值常量回潮（某个入口还在用一把没分档的尺子）', 'planner.js',
  'var MODE = {', "var AVG_KMH = 60, ROAD_FACTOR = 1.35; var MODE = {",
  '单值均速常量必须不再存在');

/* ============ ② 文案跟着档位走（动词、系数、能力边界） ============ */
run('M16 动词单点里自驾也写成「在途」（或者反过来：走出来的 4 小时写成车程）', 'planner.js',
  "return m === 'drive' ? '车程' : m === 'bike' ? '骑行' : m === 'walk' ? '步行' : '在途';",
  "return m === 'drive' ? '在途' : m === 'bike' ? '骑行' : m === 'walk' ? '步行' : '在途';",
  '时长动词单点');
run('M17 口径行重抄 ×1.35（改了 MODE 表改不了这句话，两本账回来）', 'planner.js',
  "'日卡里程按直线 ×' + mo.factor + ' 折算（未取真实道路数据）'",
  "'日卡里程按直线 ×1.35 折算（未取真实道路数据）'",
  '文案里重抄系数');
run('M18 转场日动词写死「驾驶」（骑行档的转场日被说成开车）', 'planner.js',
  "这段路的' + verbOf(trip.travelBy) + '超过单日上限 '",
  "这段路超过单日驾驶上限 '",
  '动词写死「驾驶」');
run('M19 结果页丢掉「公共交通未覆盖」（能力边界不说，用户等一个不会来的档）', 'planner.js',
  '公共交通未覆盖</span></div>', '</span></div>',
  '两处在案');
run('M20 非自驾档的折线警告被抹掉（图上那就是高德驾车线，用户以为画的是骑行道）', 'planner.js',
  "'；地图折线为驾车路线形状'", "''",
  '不说这句');
run('M21 出行方式挤进 sortMode（两个正交轴合并＝「重新排期」要改四组组合值）', 'planner.js',
  'var tb = modeOf(w.travelBy);', "if (w.sortMode === 'walk') { } var tb = modeOf(w.travelBy);",
  '排线依据与算时长的档是两个正交轴');

/* ============ ③ 标题 / 提示：算对了但屏幕上看不出来的现场 ============ */
run('M22 标题不再跟日卡同一次渲染动（换档后屏上两个口径并存）', 'planner.js',
  "$id('resultTitle').textContent = trip.name", "$id('rtTitle').textContent = trip.name",
  '标题不跟日卡同一次渲染动');
run('M23 锁定提示退回内联（钉完站不当场出现，因为整块重画 actRow 把提示重算了一遍）', 'planner.js',
  '<span id="lkSlot">\' + lockedHint() + \'</span>', '<span>\' + lockedHint() + \'</span>',
  '稳定插槽');
run('M24 插槽判空被去掉（取不到就 null.innerHTML 抛进渲染链）', 'planner.js',
  "var lk = $id('lkSlot'); if (lk) lk.innerHTML = lockedHint();",
  "var lk = $id('lkSlot'); lk.innerHTML = lockedHint();",
  '插槽取不到就跳过');
run('M25 旧标题局部 totalKm 回潮（两处两个口径）', 'planner.js',
  'var MODE = {', "var totalKm = trip.days.reduce(function (s, d) { return s + d.driveKm; }, 0); var MODE = {",
  '残留一个 totalKm');

/* ============ ④ 锁定：单点生效 + 两条重排路径各自经过 + 移动即钉 ============ */
run('M26 地理档不再经过 withLocked（本批灵魂断言的源码腿 + smoke T8 的运行时腿都该红）', 'planner.js',
  'return withLocked(sel, function (free) { return orderFreeByGeo(free, start, tb); });',
  'return orderFreeByGeo(sel, start, tb);',
  'orderStops 体里 withLocked( 不是恰 1 次');
run('M27 矩阵档不再经过 withLocked（只在一个里做＝高德用户照样被重排打散）', 'planner.js',
  'return withLocked(sel, function (free) { return orderFreeByMatrix(free, start, dist, tb); });',
  'return orderFreeByMatrix(sel, start, dist, tb);',
  'orderByMatrix 体里 withLocked( 不是恰 1 次');
run('M28 过滤在实活里再写一遍（插回两次，顺序会重复）', 'planner.js',
  'function orderFreeByGeo(sel, start, tb) {',
  'function orderFreeByGeo(sel, start, tb) { sel = sel.filter(function (s) { return !s.locked; });',
  '过滤不该在两条路径各写一遍');
run('M29 矩阵实活里再写一遍', 'planner.js',
  'function orderFreeByMatrix(sel, start, dist, tb) {',
  'function orderFreeByMatrix(sel, start, dist, tb) { sel = sel.filter(function (s) { return !s.locked; });',
  'orderFreeByMatrix 体里出现 .locked');
run('M30 钉住的站不再被摘出（withLocked 变成装饰）', 'planner.js',
  'if (s && s.locked) held.push([i, s]); else free.push(s);', 'free.push(s);',
  '钉住的站先摘出');
run('M31 插回不夹上界（重排后变短时插到数组外，静默丢站）', 'planner.js',
  'out.splice(Math.min(hp[0], out.length), 0, hp[1]);', 'out.splice(hp[0], 0, hp[1]);',
  '夹到 out.length');
run('M32 移动不留痕（下一次自动重排照样把它打散＝本批要修的原始 bug 回来了）', 'planner.js',
  'flat[to].locked = 1;', 'void 0;',
  '移动不留痕');
run('M33 钉错了站（钉的是让位那站，不是被挪那站：位置看着对，重排照样飞）', 'planner.js',
  'flat[to].locked = 1;', 'flat[idx].locked = 1;',
  '手动移动成功即视为');
run('M34 图钉第三种值（trip JSON 里出现 2＝下一次 filter 的判据说不清）', 'planner.js',
  's.locked = s.locked ? 0 : 1;', 's.locked = s.locked ? 0 : 2;',
  '切换只认 0/1');
run('M35 计数写死 0（提示与向导那句一起变哑）', 'planner.js',
  'function lockedCount() { return flatStops().filter(function (s) { return s.locked; }).length; }',
  'function lockedCount() { return 0; }',
  '计数单点');
run('M36 0 站也挂提示（噪音），且不再点名「自动重排不参与」', 'planner.js',
  "return n ? '<span class=\"lk-hint\">' + TI('pinned', 13) + n + ' 站已锁定 · 自动重排不参与</span>' : '';",
  "return '<span class=\"lk-hint\">站点</span>';",
  '提示只在有锁定时出现');

/* ============ ⑤ 顺序与落盘：本批真实事故的四条腿 ============ */
run('M37 高德排期不写回选点集（钉站按选点旧序插回＝挪了又飞回去）', 'planner.js',
  'state.selected = ordered;', 'void 0;',
  '排期落档与高德规划两条入口', 2);
run('M38 手动调序不写回选点集（同上，结果页那条腿）', 'planner.js',
  'state.selected = flat.slice();', 'void 0;',
  '手动调序与编辑选点都把当前站点序写回选点集', 2);
run('M39 移掉的站不退出选点集（「重新排期」把它整站捞回行程）', 'planner.js',
  'state.selected = flatStops();', 'void 0;',
  '捞回行程');
run('M40 换档只重切不落盘（刷新回到旧档，账白算）', 'planner.js',
  'persistTrip(); resplitTrip();', 'resplitTrip();',
  '先存再重切', 2);
run('M41 resplitTrip 自己不落盘（从「已保存行程」重开看到的是旧档算出来的数）', 'planner.js',
  '    persistTrip();' + EOL('planner.js') + '    renderDaysBody(); renderMap();',
  '    renderDaysBody(); renderMap();',
  '换档改了日卡却不重存');
run('M42 标题在两处算（重画日卡那条路径不经过 renderResult，旧数挂在屏上）', 'planner.js',
  'function renderResult() {', "function renderResult() { var tOld = $id('resultTitle');",
  '标题算了两处');
run('M43 trip 不存档位（下次打开回到自驾）', 'planner.js',
  'travelBy: tb,', "travelBy: 'drive',",
  '新建行程把档位写进 trip');
run('M44 AI 精选那条路径漏存档位（两个入口两种口径）', 'planner.js',
  'travelBy: modeOf(travelByNow()),', "travelBy: 'drive',",
  'AI 精选那条路径同样存档');
run('M45 结果页换档不回写向导（回到向导看到的还是上一轮口径）', 'planner.js',
  'if (state.wiz) state.wiz.travelBy = m;', 'void 0;',
  '结果页换档要回写向导');
run('M46 档位表摘掉步行（切换条少一颗，向导与结果页一起少一档）', 'planner.js',
  "var TB_ORDER = ['auto', 'drive', 'bike', 'walk'];", "var TB_ORDER = ['auto', 'drive', 'bike'];",
  '档位顺序单点');
run('M47 换档 toast 不再说口径（点下去没反应比点错更难查）', 'planner.js',
  "toast('出行方式：' + MODE[m].label + ' · '", "toast('已切换'",
  '换档要说清换了什么口径');

/* ============ ⑥ 页面结构（钉住态与切换条看得见的那一半） ============ */
run('M48 钉住态不点亮（用户以为顺序还是算出来的）', 'planner.html',
  '.mv.on{background:var(--color-primary)', '.mv.on{background:transparent',
  '钉住态必须看得出来');
run('M49 锁定提示样式名被改（类名与 planner.js 那句各写一套＝提示没样式）', 'planner.html',
  '.lk-hint{', '.lkhint{',
  '锁定提示样式在案');
run('M50 切换条不留位（与上面的按钮贴在一起）', 'planner.html',
  '#tbRow{margin:4px 0 10px}', '',
  '档位切换条留位');

/* ============ ⑦ 分享载荷：短键登记，钱仍然不进 ============ */
run('M51 白名单回长键 locked（8.2.6 说的是字段语义不是键名，把白名单撑爆）', 'share.js',
  'lo: 1, k: 1 };', 'lo: 1, locked: 1 };',
  '载荷用短键 k');
run('M52 钉住标记换了个没人读的键（进了载荷却不进只读页）', 'share.js',
  'if (s && s.locked) st.k = 1;', 'if (s && s.locked) st.z = 1;',
  '钉住标记进载荷');
run('M53 档位脏值不再校（收件人看见一个看不懂的字）', 'share.js',
  "b: /^(auto|drive|bike|walk)$/.test(trip && trip.travelBy ? String(trip.travelBy) : '') ? String(trip.travelBy) : '',",
  "b: trip && trip.travelBy ? String(trip.travelBy) : '',",
  '只认这四值');
run('M54 TB_LAB 不导出（share.html 只能自己再写一套档位名）', 'share.js',
  'payloadOf: payloadOf, strayKeys: strayKeys, ALLOWED: ALLOWED, TB_LAB: TB_LAB,',
  'payloadOf: payloadOf, strayKeys: strayKeys, ALLOWED: ALLOWED,',
  'TB_LAB 必须导出');
run('M55 只读页自己拼档位名（share.js 与 share.html 两处两个名字）', 'share.html',
  "(p.b && Share.TB_LAB[p.b] ? ' · 出行方式：' + Share.TB_LAB[p.b] : '')",
  "(p.b ? ' · 出行方式：' + p.b : '')",
  '档位来自 share.js 单点');
run('M56 钉住标记进了载荷却不渲染（死数据）', 'share.html',
  "'钉住</span>'", "'</span>'",
  '进了载荷却不渲染');
run('M57 只读页重抄系数（两处各写一个 1.35 迟早一升一降）', 'share.html',
  "'日卡里程按直线折算，是估算不是实测'", "'日卡里程按直线 ×1.35 折算，是估算不是实测'",
  '出现「直线 ×1.35」');

/* ============ ⑧ 浏览器腿：视口档与判据齐备 ============ */
run('M58 冒烟退回桌面宽（桌面量出来的档位排版与触控一律不作数）', 'tools/smoke-planner.js',
  'setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })',
  'setViewport({ width: 1280, height: 900 })',
  '全程用手机档量', 7);
run('M59 真机档（452×995）那条被摘（新增那一行挤不挤就没人量了）', 'tools/smoke-planner.js',
  'setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true })',
  'setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })',
  '一加 Ace6T');
runAll('M60 探针自校准的 stale 断言摘掉（读 tn_trips[0] 拿到上一轮旧对象＝三档一模一样的数却全绿）', 'tools/smoke-planner.js',
  'stale === false', 'stale !== undefined',
  '同一份序');
run('M61 灵魂断言改名成 T8x（判据还在，但齐备检必须认「id + 空格」）', 'tools/smoke-planner.js',
  "ok('T8 灵魂断言", "ok('T8x 灵魂断言",
  '缺 T8 这条判据');
run('M62 探针自校准那条改名成 T0c（下面 12 条的数值全靠它兜底）', 'tools/smoke-planner.js',
  "ok('T0b 探针自校准", "ok('T0c 探针自校准",
  "缺 ok('T0b 这条");

/* ============ ⑨ 登记与守卫自己 ============ */
runAll('M63 README 去掉 §33 登记（新闸门不写进 README 就等于没装；三处全抹，只改标题串的话正文里的 §33 还顶着这条锚）', 'README.md',
  '§33', '#33',
  '没提 §33');
runAll('M64 方案文档去掉「批次 20 已实施」（收工状态只能靠文档留在案上；两处都要替，批次 19 的 M62 同坑）', 'docs/功能完善实施方案-2026-10-05.md',
  '批次 20 已实施', '批次 20 未登记',
  '没登记「批次 20 已实施」');
runAll('M65 方案文档去掉「不扩 sortMode」那条偏离（下一个人会照 8.3 原文再找一遍代码）', 'docs/功能完善实施方案-2026-10-05.md',
  '不扩 `sortMode`，另立 `travelBy` 轴', '扩 sortMode',
  '没登记「出行方式不扩 sortMode」');
runAll('M66 方案文档去掉「端点无法实查」的否定读数（8.2.2 要求先实查再定档）', 'docs/功能完善实施方案-2026-10-05.md',
  '端点在本机无法实查', '端点实查通过',
  '否定读数');
run('M67 锚点表被削减一条（守卫自己必须有线；下限就钉在落地上实测的那个数）', 'tools/verify.js',
  "    ['planner.js', 'var MODE = {', 1, '档位表单点']," + EOL('tools/verify.js'), '',
  '锚点表被削减');
run('M68 四元组少写文件字段（这条锚从此一次都没跑过，还不说话）', 'tools/verify.js',
  "    ['planner.js', 'out.splice(Math.min(hp[0], out.length), 0, hp[1]);', 1, '再按原索引插回（夹到 out.length：重排后变短了不许插到数组外）']," + EOL('tools/verify.js'),
  "    ['out.splice(Math.min(hp[0], out.length), 0, hp[1]);', 1, '少了文件字段']," + EOL('tools/verify.js'),
  '四元组');
run('M69 结构断言的正向对照自己失效（把合成对照源改掉，那个 0/1 就成了自证）', 'tools/verify.js',
  'const CTRL33 = flat33("function orderStops(sel, start, tb) { return withLocked(sel, f); } function plannerMoveStop(di) { s.locked = 1; }");',
  'const CTRL33 = flat33("function orderStops(sel, start, tb) { return f; } function plannerMoveStop(di) { s.locked = 1; }");',
  '正向对照失效');
run('M70 ③b 的正向对照自己失效（标题/落盘那四条同理）', 'tools/verify.js',
  "function renderDaysBody() { $id('resultTitle').textContent = x; var lk = $id('lkSlot'); lk.innerHTML = lockedHint(); }",
  "function renderDaysBody() { var lk = $id('lkSlot'); lk.innerHTML = lockedHint(); }",
  '正向对照失效');

console.log('\n=== mut-verify33（源码腿）: ' + red + ' 条按预期红 / ' + anomalies + ' 条异常 / 共 ' + total + ' 条 ===');
console.log('异常＝0 才说明 §33 每条锚都有线；打不红的锚要先修锚再收工。');
process.exit(anomalies ? 1 : 0);
