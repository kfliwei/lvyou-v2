/* tools/out/mut-verify26.js — verify.js §26（规划结果页地图）变异自测
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在 §26 里看见**指定的那条**红；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 * 用法: node tools/out/mut-verify26.js > tools/out/b14-mut-verify26.txt 2>&1
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['planner.js', 'ui.js', 'planner.html', 'README.md', '改进实施方案与验收标准.md', 'tools/verify.js', 'tools/smoke-planner.js'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
let restored = true;
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) { fs.writeFileSync(path.join(ROOT, f), ORIG[f]); restored = false; }
  });
}
process.on('exit', restore);

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
const f26 = out => out.split('\n').filter(l => l.indexOf('FAIL §26') >= 0);
/* 本轮踩到的坑：仓库里这些文件全是 CRLF，变异串里写 '\n' 就是 0 命中（首轮 P1/P2/P13/S2 四条
   因此被判成「源码已漂移」——那是脚本错，不是源码漂）。跨行 needle 一律用该文件自己的换行符拼。 */
const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const J = (f, ...lines) => lines.join(EOL(f));

let red = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let lines;
  try { lines = f26(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §26 共红 ' + lines.length + ' 条，指定那条：' + hit[0].replace('FAIL §26 地图闸门: ', '').slice(0, 108));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但 §26 没按预期红（想找：' + token + '）；本轮 §26 红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
/* 单点替换：from 必须恰好命中 wantCount 处，否则算「变异没落到 intend 的地方」 */
function run(name, file, from, to, token, wantCount) {
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  const wc = wantCount === undefined ? 1 : wantCount;
  if (n !== wc) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 ' + wc + '（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.replace(from, () => to), token);
}
/* 整文件级变异（削减锚点表、全文改名这类） */
function runRaw(name, file, mutated, token) {
  if (mutated === ORIG[file]) {
    total++; anomalies++;
    console.log('异常  ' + name + '  整文件变异是恒等操作（源里没有可改的东西，打不红是必然）');
    return;
  }
  judge(name, file, mutated, token);
}

/* ---- 基线：还原态必须 0 条 §26 红，否则下面所有「红」都不说明问题 ---- */
{
  const base = f26(verify());
  console.log('基线（未变异）: §26 红 ' + base.length + ' 条' + (base.length ? '\n  ' + base.join('\n  ') : ''));
  if (base.length) { console.log('基线不干净，先修 §26 再谈变异自测'); process.exit(1); }
}

/* ============ planner.js：被钉的实现形状 ============ */
const SIZED4 = '    if (box.clientWidth && box.clientHeight) { drawMap(trip, pts); return; }';
const SIZED6 = '      if (box.clientWidth && box.clientHeight) { drawMap(trip, pts); return; }';
const GENLINE = '      if (gen !== mapGen) return;                                  /* 更新的渲染已接管，这次作废 */';

run('P1 调度层不做尺寸判定就直接画（回到 0×0 建图）', 'planner.js',
  J('planner.js', "    var gen = ++mapGen, box = $id('mapBox'), tries = 0;", SIZED4),
  J('planner.js', "    var gen = ++mapGen, box = $id('mapBox'), tries = 0;", '    drawMap(trip, pts); return;'),
  'box.clientWidth && box.clientHeight');

run('P2 rAF 那条出口也不量尺寸（两条出口缩成一条）', 'planner.js',
  J('planner.js', GENLINE, SIZED6), GENLINE,
  'box.clientWidth && box.clientHeight');

run('P3 过期轮次的作废检查被摘（两轮都画 → 叠图）', 'planner.js',
  '      if (gen !== mapGen) return;', '      /* 作废检查丢了 */ void gen;',
  'gen !== mapGen');

run('P4 等尺寸没有上限（无限挂 rAF）', 'planner.js',
  'if (++tries < 180) requestAnimationFrame(wait);', 'if (tries < 1e9) requestAnimationFrame(wait);',
  '++tries < 180');

run('P5 建图搬回调度层（改前形态：不管容器有没有尺寸）', 'planner.js',
  '    var gen = ++mapGen,',
  J('planner.js', "    if (!map) { map = L.map('mapBox', { zoomControl: false }); }", '    var gen = ++mapGen,'),
  'renderMap 调度层里又出现 L.map(');

run('P6 单站也走 fitBounds（0 跨度顶到 maxZoom＝又一条显示不全）', 'planner.js',
  'else if (bnd.length === 1) map.setView(bnd[0], 9);',
  'else if (bnd.length === 1) map.fitBounds(bnd, { padding: [40, 40] });',
  '单站不 fitBounds');

run('P7 fitBounds 的 padding 被顺手改掉（整串相等必须红）', 'planner.js',
  'map.fitBounds(bnd, { padding: [40, 40] });', 'map.fitBounds(bnd);', 'fitBounds');

run('P8 点针脚没信息了（症状③的接线被摘）', 'planner.js',
  "m.bindPopup('<b>' + esc(s.name)", "m.setPopupContent('<b>' + esc(s.name)", 'bindPopup');

run('P9 三个 renderMap() 出口少一个（增删站点后不再重画）', 'planner.js',
  'persistTrip(); renderDaysBody(); renderMap();', 'persistTrip(); renderDaysBody();', 'renderMap();');

run('P10 恢复路径顺序改回反的（renderResult 先于 showStage）', 'planner.js',
  "if (snap.stage === 'stageResult' && snap.trip) { showStage('stageResult'); renderResult(); }",
  "if (snap.stage === 'stageResult' && snap.trip) { renderResult(); showStage('stageResult'); }",
  '改前的反顺序零残留');

run('P11 用「别转场了」绕开成因（UI.vt 接线被摘）', 'planner.js',
  'UI.vt(function () {', 'stageFlipNow(function () {', 'UI.vt(function () {');

run('P12 缩放控件挪出 if (!map)（每轮渲染多挂一个）', 'planner.js',
  'mapLayer = L.layerGroup().addTo(map); }',
  J('planner.js', 'mapLayer = L.layerGroup().addTo(map); }', "    L.control.zoom({ position: 'bottomright' }).addTo(map);"),
  'L.control.zoom');

run('P13 事后 invalidateSize 被摘（转屏/改宽没人补尺寸）', 'planner.js',
  EOL('planner.js') + '    map.invalidateSize();', '', 'invalidateSize');

run('P14 针脚图标改成 0 尺寸（G7 的盒内判定失真）', 'planner.js',
  'iconSize: [26, 26], iconAnchor: [13, 24]', 'iconSize: [0, 0], iconAnchor: [0, 0]', 'iconSize');

/* ============ ui.js：成因仍在，由产品侧挡 ============ */
run('U1 同步退化分支少条件（减动效口径被改）', 'ui.js',
  'if (reducedMotion() || !document.startViewTransition) { fn(); return null; }',
  'if (reducedMotion()) { fn(); return null; }',
  '同步退化分支还在');

run('U2 异步分支被抹掉（G 段就该换档，不许继续绿）', 'ui.js',
  'var t = document.startViewTransition(fn);', 'var t = null;', 'document.startViewTransition(fn)');

/* ============ planner.html：容器自己有高度 ============ */
run('H1 #mapBox 高度归零（sized 判定等的是永远 0 高的盒子）', 'planner.html',
  '#mapBox{height:46vh;min-height:220px', '#mapBox{height:0;min-height:0', '#mapBox{height');

/* ============ tools/smoke-planner.js：活闸自身 ============ */
run('S1 把 G 段改到强制减动效档（结构性看不见本 bug → 假闸）', 'tools/smoke-planner.js',
  '  await page.evaluateOnNewDocument(MAP_HOOK);',
  J('tools/smoke-planner.js', "  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);", '  await page.evaluateOnNewDocument(MAP_HOOK);'),
  'emulateMediaFeatures');

run('S2 删掉 G7 这条判据（针脚框内没人管了）', 'tools/smoke-planner.js',
  EOL('tools/smoke-planner.js') + "  ok('G7 针脚全部落在地图框内', g.pins > 0 && g.pinsInBox === g.pins, g.pinsInBox + '/' + g.pins + ' 在框内');",
  '', '缺 G7');

run('S3 重画后不再复测（只剩首屏一次读数）', 'tools/smoke-planner.js',
  'const g2 = await page.evaluate(MAP_GEOM);', 'const g2 = g;', 'G 段只剩一次读数');

run('S4 建图钩子不再交回实例（G2/G8 读的是别的对象）', 'tools/smoke-planner.js',
  'window.__plannerMap = m;', 'window.__notTheMap = m;', '__plannerMap');

run('S5 几何读数函数改名（判据读的东西失联）', 'tools/smoke-planner.js',
  'const MAP_GEOM = () => {', 'const MAPGEOM2 = () => {', 'MAP_GEOM');

/* ============ verify.js §26 自己的守门 ============ */
run('V1 锚点里写块注释（flat26 先剥注释 → 永远 0 命中的假红灯）', 'tools/verify.js',
  "['planner.js', 'map.invalidateSize();', 1,",
  "['planner.js', '/* 注释 */ map.invalidateSize();', 1,", '锚点里不许出现块注释');

{
  const victims = ["L.control.zoom({ position: 'bottomright' })", 'iconSize: [26, 26]', 'map.invalidateSize();',
    'else if (bnd.length === 1) map.setView', 'if (bnd.length > 1) map.fitBounds', "'UI.vt(function () {',"];
  const cut = ORIG['tools/verify.js'].split('\n').filter(l =>
    !(l.trim().startsWith("['planner.js',") && victims.some(v => l.indexOf(v) >= 0))).join('\n');
  runRaw('V2 锚点表被悄悄削减 6 条（整组删掉等于这节没了）', 'tools/verify.js', cut, '锚点表被削减');
}

run('V3 合成"改前源"的正向对照失效（期望 0 的那条成了假绿灯）', 'tools/verify.js',
  `"if (snap.stage === 'stageResult' && snap.trip) { renderResult(); showStage('stageResult'); }"`,
  `"if (snap.stage === 'stageResult' && snap.trip) { showStage('stageResult'); renderResult(); }"`,
  '正向对照失效：合成"改前源"里的反顺序没命中');

run('V4 结构检的函数体切片改成整文件（renderMap 体内禁建图成了空话）', 'tools/verify.js',
  "const RB = bodyOf(SRC26['planner.js'], 'function renderMap() {', 'function drawMap(trip, pts) {');",
  'const RB = SRC26[\'planner.js\'];', 'renderMap 调度层里又出现 L.map(');

/* ============ 文档登记 ============ */
run('D1 README 的 verify 清单不再提 §26', 'README.md', '§26 规划结果页地图', '§27 规划结果页地图', '没提 §26');
/* D2 首轮写成"只改一处 G1–G11"，结果 §26 零红——README 有两处登记（闸门清单那行 + smoke-planner 那行），
   改一处另一处还兜着。这条本就该是「整份 README 都不再提 G1–G11」才算摘掉登记，故改整文件级。 */
runRaw('D2 README 不再登记 G1–G11（两处全摘）', 'README.md',
  ORIG['README.md'].split('G1–G11').join('G1-11'), '没登记 G1–G11');
runRaw('D3 方案文档不再有「批次 14」', '改进实施方案与验收标准.md',
  ORIG['改进实施方案与验收标准.md'].split('批次 14').join('批次拾肆'), '没有「批次 14」这一节');

console.log('\n合计 ' + total + ' 条变异：打红 ' + red + ' / 异常 ' + anomalies +
  (restored ? ' / 全部文件逐字节还原（' + FILES.length + ' 个）' : ' / 还原时发现有文件不是原样，已按快照写回'));
process.exit(anomalies ? 1 : 0);
