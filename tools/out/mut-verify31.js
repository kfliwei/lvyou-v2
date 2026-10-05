/* tools/out/mut-verify31.js — verify.js §31（双栏桌面档 + 可用视口横向分支）变异自测
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条**红里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 为什么这批特别需要变异自测：改动全在 900/1400 媒体查询里，手机上永远看不见，
 * 而 §31 的锚点里有三条「期望 0」和一条「段落范围检」——它们最容易写成恒真
 * （阈值串不存在、侧栏选择器写错名字、双栏规则其实没在查询里）。
 * 判红范围除 §31 外还带 §24（边缘点）与 §26（规划结果页地图）：横向分支改了
 * usableInsets 的判据形，fitUsable/contentInsets 那几条锚同时属于 §24。
 *
 * 用法: NODE_PATH=…/tools/node_modules node tools/out/mut-verify31.js > tools/out/b18-mut-verify31.txt 2>&1
 * 浏览器腿另见文件末尾的 B 组（每条要真跑一次 smoke-usable，故单独串行，且不得与像素基线并行）。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['topic-common.js', 'design.css', 'planner.js', 'topic.html',
  'tools/smoke-usable.js', 'tools/verify.js', 'README.md', 'docs/功能完善实施方案-2026-10-05.md'];
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
  l.indexOf('FAIL §31') >= 0 || l.indexOf('FAIL §24') >= 0 || l.indexOf('FAIL §26') >= 0);

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const cntOf = (s, n) => s.split(n).length - 1;

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
    console.log('红  ' + name + '  → 本轮红 ' + lines.length + ' 条，指定那条：' +
      hit[0].replace(/^FAIL §31 双栏闸门: /, '§31: ').replace(/^FAIL §24 [^:]*: /, '§24: ').replace(/^FAIL §26 [^:]*: /, '§26: ').slice(0, 130));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
function run(name, file, from, to, token, wantCount) {
  const src = ORIG[file];
  const n = cntOf(src, from);
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
/* 登记串在文档里出现两处（小节标题 + 正文），只改一处当然还是绿的——这类要全替换 */
function runAll(name, file, from, to, token) {
  const src = ORIG[file];
  const n = cntOf(src, from);
  if (n < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.split(from).join(to), token);
}

/* ============ ① 横向分支：0-2 那条「从不赋值」的反证 ============ */
run('M1 删掉 ins.left 的赋值行（左内缩退回结构性恒 0，双栏等于白做）', 'topic-common.js',
  'else ins.left = Math.max(ins.left, r.right - el.left);', 'else void 0;',
  'ins.left = Math.max(ins.left, r.right - el.left);');
run('M2 删掉 ins.right 的赋值行（同上，右侧）', 'topic-common.js',
  'if ((r.left + r.right) / 2 > el.left + el.width / 2) ins.right = Math.max(ins.right, el.right - r.left);',
  'if ((r.left + r.right) / 2 > el.left + el.width / 2) void 0;',
  'ins.right = Math.max(ins.right, el.right - r.left);');
run('M3 侧带判据从 0.6 抬到 9.9（分支还在但永不成立＝假在）', 'topic-common.js',
  '} else if (iy >= el.height * 0.6) {', '} else if (iy >= el.height * 9.9) {',
  'iy >= el.height * 0.6');
run('M4 横向分支改成和纵向同一条（复制粘贴式退化，左右带又算不出来）', 'topic-common.js',
  '} else if (iy >= el.height * 0.6) {', '} else if (ix >= el.width * 0.99) {',
  'iy >= el.height * 0.6');
run('M5 contentInsets 漏掉左右（focusUsable 的 padding 仍是 16）', 'topic-common.js',
  'return { top: i.top + MARK_HALF, right: i.right + MARK_HALF, bottom: i.bottom + MARK_HALF, left: i.left + MARK_HALF };',
  'return { top: i.top + MARK_HALF, right: MARK_HALF, bottom: i.bottom + MARK_HALF, left: MARK_HALF };',
  'return { top: i.top + MARK_HALF, right: i.right + MARK_HALF, bottom: i.bottom + MARK_HALF, left: i.left + MARK_HALF };');
run('M6 usableRectPx 的右边不吃 ins.right（clampCapsules 把侧栏后面当可见）', 'topic-common.js',
  'return { l: i.left, t: i.top, r: s.x - i.right, b: s.y - i.bottom };',
  'return { l: i.left, t: i.top, r: s.x, b: s.y - i.bottom };',
  'return { l: i.left, t: i.top, r: s.x - i.right, b: s.y - i.bottom };');
run('M7 contentBounds 右下角不吃 ins.right（LOD 裁剪矩形退回全屏）', 'topic-common.js',
  'map.containerPointToLatLng(L.point(s.x - i.right, s.y - i.bottom))',
  'map.containerPointToLatLng(L.point(s.x, s.y - i.bottom))',
  'map.containerPointToLatLng(L.point(s.x - i.right, s.y - i.bottom))');
run('M8 fitUsable 用回 Leaflet 不认的 paddingTL（写了静默失效）', 'topic-common.js',
  'var o = { paddingTopLeft: [i.left, i.top], paddingBottomRight: [i.right, i.bottom] };',
  'var o = { paddingTL: [i.left, i.top], paddingBR: [i.right, i.bottom] };',
  'paddingTopLeft: [i.left, i.top]');

/* ============ ② 侧栏不进带名单（本批的关键判断） ============ */
run('M9 把侧栏选择器塞进 USABLE_BANDS（双份内缩：内容整体偏右）', 'topic-common.js',
  "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];",
  "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open', '#list'];",
  'USABLE_BANDS 里出现了侧栏选择器');
run('M10 带名单被改但 #list 写成 list（期望 0 那条靠字面命中，改名等于绕过守卫）', 'topic-common.js',
  "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];",
  "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open', 'list'];",
  "var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];");

/* ============ ③ 聚焦单点：批次 13 残留 ============ */
run('M11 flyToSite 改回批次 13 的裸 map.flyTo（元素中心聚焦）', 'topic-common.js',
  'setTimeout(function () { flyToUsable(pt(s), Math.max(map.getZoom(), 12), { duration: .6 }); }, 80);',
  'setTimeout(function () { map.flyTo(pt(s), Math.max(map.getZoom(), 12), { duration: .6 }); }, 80);',
  'flyToSite 仍按元素中心裸 flyTo');
run('M12 偏移不再走内容中心（双栏档左右内缩白算）', 'topic-common.js',
  '.subtract(contentCenterPx())', '.subtract(L.point(0, 0))',
  '.subtract(contentCenterPx())');
run('M13 把 flyToUsable 的瞬时腿删掉（各处又开始自己裸 setView）', 'topic-common.js',
  'if (opts && opts.instant) { map.setView(at, zoom); return; }', 'if (opts && opts.dontexist) { map.setView(at, zoom); return; }',
  'if (opts && opts.instant) { map.setView(at, zoom); return; }');

/* ============ ④ 双栏 CSS：阈值唯一 + 不许漏进手机档 ============ */
run('M14 阈值 900→700（768 横屏被切成两栏，地图只剩 428px）', 'design.css',
  '@media (min-width: 900px){', '@media (min-width: 700px){',
  '@media (min-width: 900px)');
run('M15 把一条双栏规则复制进手机档（本批红线：手机一根 CSS 不许动）', 'design.css',
  '.vlead{margin:0;',
  '.vlead{margin:0;' + EOL('design.css') + 'body.topic-page .tabbar{left:12px;transform:none;width:calc(var(--dv-side) - 24px)}',
  'body.topic-page 有 1 处落在 900 媒体查询之外');
run('M16 左栏宽 token 被换成硬编码 320（栅格宽度和闸门读数脱钩）', 'design.css',
  ':root{--dv-side:340px}', ':root{--dv-side:320px}',
  ':root{--dv-side:340px}');
run('M17 地图不再让出侧栏宽度（双栏变成覆盖：左栏压在地图上面）', 'design.css',
  'body.topic-page main>.view{left:var(--dv-side)}', 'body.topic-page main>.view{left:0}',
  'body.topic-page main>.view{left:var(--dv-side)}');
run('M18 面板定宽那条丢了（当前 tab 的面板铺满整个视口）', 'design.css',
  'body.topic-page main>.view:not(#map){left:0;right:auto;width:var(--dv-side)}',
  'body.topic-page main>.view:not(#map){left:0}',
  'body.topic-page main>.view:not(#map){left:0;right:auto;width:var(--dv-side)}');
run('M19 地图常驻可见被删（切到列表右半屏直接黑）', 'design.css',
  'body.topic-page #map{display:block!important}', 'body.topic-page #mapx{display:block!important}',
  'body.topic-page #map{display:block!important}');
run('M20 结果页 grid 去掉 !important（showStage 的 inline display 会把它抢回 block）', 'design.css',
  'body.dv-result #stageResult{display:grid!important;', 'body.dv-result #stageResult{display:grid;',
  'body.dv-result #stageResult{display:grid!important;');
run('M21 sticky 的跨行改成 grid-row:auto（左栏一滚动地图就跟着走）', 'design.css',
  'grid-row:1/span 12;position:sticky;', 'grid-row:auto;position:sticky;',
  'grid-row:1/span 12;position:sticky;');
run('M22 窄栏里的卡片没有压回一栏（340px 里排两列＝挤破）', 'design.css',
  'body.topic-page #list .grid{grid-template-columns:1fr}', 'body.topic-page #list .gridx{grid-template-columns:1fr}',
  'body.topic-page #list .grid{grid-template-columns:1fr}');

/* ============ ⑤ 悬停高亮：接线 + 可观测出口 ============ */
run('M23 不再给 body 打 view 标记（双栏左面板选不中）', 'topic-common.js',
  'document.body.dataset.view = tab;', 'void tab;',
  'document.body.dataset.view = tab;');
run('M24 日线不再按天留存（悬停无从下手）', 'topic-common.js',
  'routeDayLines.push(line);', 'void line;',
  'routeDayLines.push(line);');
run('M25 空掉的天不再占位（下标错位：悬停 D3 亮的是 D2）', 'topic-common.js',
  'if (pts.length < 1) { routeDayLines.push(null); return; }',
  'if (pts.length < 1) { return; }',
  'if (pts.length < 1) { routeDayLines.push(null); return; }');
run('M26 高亮的可观测出口被删（闸门只能读像素）', 'topic-common.js',
  'dayLineWeights: function () { return routeDayLines.map(function (l) { return l ? l.options.weight : 0; }); },',
  'dayWeightsX: function () { return []; },',
  'dayLineWeights: function () { return routeDayLines.map(function (l) { return l ? l.options.weight : 0; }); },');
run('M27 mouseenter 把 ri/di 传反', 'topic-common.js',
  'hlRouteDay(p[0], p[1])', 'hlRouteDay(p[1], p[0])',
  'hlRouteDay(p[0], p[1])');
run('M28 planner 线段退回平铺 mapLayer（没有「按天」这条维度）', 'planner.js',
  'var seg = L.layerGroup().addTo(planDayGroups[own[i]] || mapLayer);',
  'var seg = L.layerGroup().addTo(mapLayer);',
  '线段平铺进 mapLayer');
run('M29 基准线宽/透明度没留底（离开悬停回不去）', 'planner.js',
  'ln._bop = opts.opacity; ln._bw = opts.weight;', 'ln._bop = 0; ln._bw = 0;',
  'ln._bop = opts.opacity; ln._bw = opts.weight;');
run('M30 只给正常日卡挂悬停，赶路日漏掉', 'planner.js',
  'onmouseenter="window.plannerHlDay(\' + di + \')" onmouseleave="window.plannerHlDay(-1)"',
  'onX="window.plannerHlDay(\' + di + \')"',
  'onmouseenter="window.plannerHlDay(\' + di + \')" onmouseleave="window.plannerHlDay(-1)"', 2);
run('M31 dv-result 作用域没摘（别的阶段也被双栏）', 'planner.js',
  "document.body.classList.toggle('dv-result', name === 'stageResult');",
  "document.body.classList.add('dv-result');",
  "document.body.classList.toggle('dv-result', name === 'stageResult');");
run('M32 topic.html 的 body 回到裸标签（双栏作用域没开）', 'topic.html',
  '<body class="topic-page" data-view="map">', '<body>',
  '裸 body：双栏作用域没开');

/* ============ ⑥ 浏览器腿与登记：少一条就是有个症状没人管 ============ */
run('M33 U14/U15 不再借道真带元素（改插无名 div／删样式都会让这条串消失，而那条绿光是假绿）', 'tools/smoke-usable.js',
  "b.setAttribute('style', 'display:block;position:fixed;top:0;height:100vh;width:120px;transform:none;opacity:1;' +",
  "b.setAttribute('style', 'display:block;position:fixed;top:0;height:100vh;width:120px;' +",
  'tools/smoke-usable.js 里「b.setAttribute');
run('M34 把 U16 改名成 U16x（判据还在但 id 漂移——齐备检必须认「id + 空格」而不只认前缀）', 'tools/smoke-usable.js',
  "check('U16 1440 双栏", "check('U16x 1440 双栏",
  'tools/smoke-usable.js 缺 U16');
run('M35 README 去掉 §31 登记（新闸门不写进 README 就等于没装）', 'README.md',
  '/§31 双栏桌面档（', '/双栏桌面档（',
  'README.md 的 verify 清单没提 §31');
runAll('M36 方案文档去掉「批次 18 已实施」（这批在手机上看不见，只能靠文档留在案上）', 'docs/功能完善实施方案-2026-10-05.md',
  '批次 18 已实施', '批次 18 未登记',
  '方案文档没登记「批次 18 已实施」');
run('M37 锚点表被削减（守卫自己也要有线）', 'tools/verify.js',
  "    ['topic-common.js', 'iy >= el.height * 0.6', 1, '侧带判据：纵向压满 60% 才算左右带（与 tools/smoke-usable.js 的 PROBE 逐条同形，±2px 对账靠的就是同形）'],\r\n",
  '',
  '锚点表被削减');
run('M38 四元组形状被拆（少写一个字段，这条锚从此一次都没跑过）', 'tools/verify.js',
  "    ['topic-common.js', 'ins.left = Math.max(ins.left, r.right - el.left);', 1, '硬事实 0-2 的反证：这一行存在，左内缩才第一次可能被算出来'],",
  "    ['ins.left = Math.max(ins.left, r.right - el.left);', 1, '少了文件字段'],",
  '四元组');

console.log('\n=== mut-verify31（源码腿）: ' + red + ' 条按预期红 / ' + anomalies + ' 条异常 / 共 ' + total + ' 条 ===');
console.log('异常＝0 才说明 §31 每条锚都有线；打不红的锚要先修锚再收工。');
process.exit(anomalies ? 1 : 0);
