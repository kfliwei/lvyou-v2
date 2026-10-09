/* tools/out/mut-verify44.js — verify.js §44（足迹页底部堆叠与游记卡让位）变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §44 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §44 的靶子分五类：
 *   ① 底部堆叠这一族（M01–M12）：用户点名的那半——时间线坐回 150、卡片坐回 212、卡片高不认可视区、
 *      只量 statBar（收起后那枚 44px 圆钮没人量）、resize 掉出落点（新锚：窗口自己变形也得重排）、已开着还挪第二回、
 *      纵向提示没人打（**M07 是 silentB**：那一行整体没被 A44 钉，只有浏览器腿看得见）、横向渐隐整族消失、aria 那句「点开看全文与照片」被摘、渐隐条压回毛玻璃 token、
 *      版权条那 94px 与单类底色（§44 的动态对账自己逮到的第五条）；
 *   ② 让位那一族（M13–M24）：开卡反号 [0,-180]、关卡猜数 [0,180]、硬编码助手 sheetHeight、
 *      两条腿的 panSheetBy、自激门坎 dy>=1 退成 >=0（两支各打一次）、band<120 守卫摘掉、moveend 挂而不摘、
 *      带 duration 的平移（打专题那一支：travel-map 那一支的 {animate:false} 被 A44 整行钉着，改它就红在锚上）、
 *      专题地图那一支同形四处（-160／+160／band／dy>=1 两支各断一边）；
 *   ③ 守卫自己（M25–M40）：共享剥刀／文档那一支／哨兵名／四元组少字段（A44 与 ZERO44 各一条）／
 *      期望次数抬高／登记没读的文件／正向对照失效／期望 0 的 needle 换成页内那条真规则／
 *      两把扫描器的自校准（闭合配平反号、bottom:calc 的校准串退化）／两个动态对账真正守的东西
 *      （计数守卫改为「多插一处没人认领的 map.panBy」——把判据本身放宽在现值下打不红，那正是它的盲区）／
 *      抹登记／条数守卫与上限对账／TM36b 那条单列判据的认领；
 *   ④ 浏览器腿自身（M41–M45）：真机档（新锚）、播种那条记录只剩一张照片（**M42 是 silentB**）、
 *      TM 标签改名、摘一条反证、条数阈值挪低；
 *   ⑤ 两条结构性无视野（G01/G03）：源码腿必须全绿、浏览器腿必须红，红在指名的那一条判据上。
 *      G01 把照片排回正文之后（本批刻意改的次序，A44 钉的是那一行在场，不钉谁在前）→ 期望红在 TM18；
 *      G03 在同一条规则之后再补一条同名规则，把底色盖成 Leaflet 自己的白（前面那条锚串一个字没动）→ 期望红在 TM36。
 *      这四条（M07／M42／G01／G03）是这张网里唯一「源码腿读不到」的样本：它们证明 A44 那 41 条钉的全是
 *      形状与写法——次序、computed 到底赢没赢，一律要靠浏览器腿。
 *      那 44px 一族（M46／M47／G02）第一轮原本是第 5 条 silentB，三轮实测之后改判：
 *      只改那行声明两头都不红——Chromium 给 form 控件一条内部 44px 下限，行内 !important 都按不动，
 *      见 tools/out/probe29-chiph3.txt；把标签换成 div 还是 44，因为 `.mm-timeline` 默认 align-items:stretch，
 *      同排的 .tl-trip 有 min-height:44px，把胶囊一起拉高，见 tools/out/g02-smoke.txt 那排读数 44/44/44；
 *      三条一起退化才读到 35，见 tools/out/g02b-smoke.txt。查明「这排高度由三条机制一起撑」之后，
 *      其中源码可见的两条（那行 min-height、那一排的 display 行）各补了一枚锚，于是这一族改由源码腿红——
 *      留下的口径：锚钉得住声明与形状，钉不住「另两条机制还顶着」的几何，所以 TM04 量真实矩形那条不能撤。
 *
 * 用法: MUT_LOG=tools/out/b29-mut-verify44.txt node tools/out/mut-verify44.js
 * **不要与别的变异网或像素基线并行**：本网动的是 travel-map.html / topic-common.js /
 * tools/verify.js / tools/smoke-travelmap.js / README.md，像素基线量的就是同一批屏；
 * 也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 * 网里的 G 类会重跑 smoke-travelmap，它按固定文件名落读数（tools/out/b29-smoke-travelmap.txt），
 * 所以跑完要在干净树上复跑一次那条腿，把基准读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。
   这张网认所有 .mut*.lock，不认自己那一个名字：本网的快照含 travel-map.html／topic-common.js／tools/verify.js／README.md，
   而 mut-verify45 的快照含同一批（外加 results/review/travel-notes/…）。两张各锁自己的文件名的话，
   并发跑会各自从自己的启动快照回写——后还原的那张把前一张的还原一并抹掉，树停在中间态而两边读数都显示「全过」。 */
const OUTDIR44 = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR44, '.mut44.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY44 = fs.readdirSync(OUTDIR44).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut44.lock');
if (BUSY44.length) { unlock(); console.log('中止：' + OUTDIR44 + ' 里还有别的变异网锁 ' + BUSY44.join('、') + '（快照与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['travel-map.html', 'topic-common.js', 'tools/verify.js', 'tools/smoke-travelmap.js', 'README.md'];
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
  ['travel-map.html', ':root{--map-stack-bottom:104px}'],
  ['travel-map.html', 'function layoutBottomStack(){'],
  ['travel-map.html', 'if(dy>=1){ sheetRaised=Math.round(dy);'],
  ['travel-map.html', "if(was){ markClip(); if(pr) markHClip(pr); return; }"],
  ['travel-map.html', "'<div class=\"ms-story\">'+story+'</div>':'')"],
  ['travel-map.html', '.leaflet-container .leaflet-control-attribution{background:var(--paper-bar)'],
  ['topic-common.js', 'function locSheetClear() {'],
  ['topic-common.js', 'if (dy >= 1) { sheetRaised = Math.round(dy);'],
  ['tools/verify.js', '§44 足迹页底部堆叠与游记卡让位闸门'],
  ['tools/verify.js', 'const flat44 = s => ws44(stripBlockComments(s));'],
  ['tools/verify.js', "['travel-map.html', 'layoutBottomStack();', 4,"],
  ['tools/verify.js', "['travel-map.html', \"window.addEventListener('resize',layoutBottomStack);\", 1,"],
  ['tools/verify.js', "['tools/smoke-travelmap.js', 'const VW = 328, VH = 723;', 1,"],
  ['travel-map.html', 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;'],
  ["tools/verify.js", "['travel-map.html', 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;"],
  ["tools/verify.js", "['travel-map.html', 'flex:none;padding:9px 14px;border-radius:999px;',"],
  ['tools/smoke-travelmap.js', "ok('TM01 "],
  ['tools/smoke-travelmap.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-travelmap.js', "photos: [pic(1), pic(2)], title: '大同古城' }"],
  ['travel-map.html', 'flex:none;display:flex;align-items:center;min-height:44px;'],
  ['travel-map.html', "var chip=document.createElement('button');"],
  ['README.md', '§44 足迹页底部堆叠与游记卡让位'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 52) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* naive 剥注释那一支（M23 的 to 串从字符串拼，别靠源码转义——转义少一层就变成「needle 自己漂了」
   而不是「闸门退了」） */
const NAIVE44 = 's.replace(/' + BS + '/' + BS + '*' + '[' + BS + 's' + BS + 'S' + ']*?' + BS + '*' + BS + '/' + "/g, " + QQ + QQ + '));';

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, file, edits, token) { CASES.push({ name, file, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, file, edits: [[from, to]], token, kind: 'all' }); }
function gBoth(name, file, pair, want) {
  /* pair 既收「一条 [from,to]」也收「多条 [[from,to],…]」：有些症状单改一处压不出来（G02 就是——
     只改页内那行 min-height，Chromium 的 form 控件内部 44px 下限照样把它顶回 44）。 */
  const edits = Array.isArray(pair[0]) ? pair : [[pair[0], pair[1]]];
  CASES.push({ name, file, edits, kind: 'silentB', want });
}

/* ① 底部堆叠一族 */
t('M01 时间线又回去坐在那个没人量过的 150px 上（R1 的原件原地复活）', 'travel-map.html',
  [[`    position:absolute;left:12px;right:12px;z-index:900;\n    bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom) + var(--tm-gap,102px));`,
    `    position:absolute;left:12px;right:12px;z-index:900;\n    bottom:calc(env(safe-area-inset-bottom,0px) + 150px);`]],
  '越界 1 行');
t('M02 统计条自己的 bottom 认回硬编码（坐在基线外的第四种写法）', 'travel-map.html',
  [['    position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom));z-index:1000;',
    '    position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:1000;']],
  '越界 1 行');
t('M03 卡片坐回 212 且最大高不认可视区（R2 的原件两条一起回来）', 'travel-map.html',
  [['bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom));display:none;max-height:calc(100dvh - env(safe-area-inset-bottom,0px) - var(--map-stack-bottom) - 26px)',
    'bottom:calc(env(safe-area-inset-bottom,0px) + 212px);display:none;max-height:calc(100dvh - 212px - 26px)']],
  '卡片又回去坐在写死的 212px 上');
t('M04 只量 statBar（统计条收起后那枚 44px 圆钮没人量，胶囊压到钮上）', 'travel-map.html',
  [["[document.getElementById('statBar'),document.getElementById('statOpen')].forEach(function(el){",
    "[document.getElementById('statBar')].forEach(function(el){"]],
  '两态都要量');
t('M05 resize 不再重排底部三层（转屏/分屏后那一档是旧的；这一族的第五层落点，A44 新钉的那条）', 'travel-map.html',
  [["window.addEventListener('resize',layoutBottomStack);\n", '']],
  '定义域就是窗口');
t('M06 已经开着再点一次，地图自己挪第二回（fillSheet 单点被拆掉一半）', 'travel-map.html',
  [['  if(was){ markClip(); if(pr) markHClip(pr); return; }\n', '']],
  '已经开着再填一次');
gBoth('M07 开卡时没人打纵向提示（只有滚动监听，首屏那条「↑ 上滑看全文」不出现）——源码腿无视野：这一行整体没被 A44 钉', 'travel-map.html',
  ['  setTimeout(function(){clearSheetCenter();markClip();if(pr)markHClip(pr);},80);',
    '  setTimeout(function(){clearSheetCenter();if(pr)markHClip(pr);},80);'],
  'TM21');
t('M08 横向渐隐整族消失（328 档右边那几枚既不滚动也看不见）', 'travel-map.html',
  [["  el.classList.toggle('h-clipped', el.scrollLeft + el.clientWidth < el.scrollWidth - 8);\n", '']],
  '同一条口径');
t('M09 胶囊的 aria 那句「这一篇」被摘（读屏的人不知道点开的是内容还是刻度）', 'travel-map.html',
  [["      chip.setAttribute('aria-label','这一篇：'+nm+' · '+time+'，点开看全文与照片');",
    "      chip.setAttribute('aria-label',nm);"]],
  '可达口径');
t('M10 渐隐条压回毛玻璃 token（§23 那把刀抓过的那次「那是脏不是毛玻璃」）', 'travel-map.html',
  [['background:linear-gradient(to bottom,transparent,var(--paper-50) 62%);pointer-events:none',
    'background:linear-gradient(to bottom,transparent,var(--glass-sheet) 62%);pointer-events:none']],
  '渐隐条压在毛玻璃 token 上');
t('M11 版权条那条一辈子没生效的 94px 插回来（R1 同一族的第三个数）', 'travel-map.html',
  [['  @media (hover:hover){.leaflet-control-zoom a:hover{background:var(--surface-2)}}',
    '  .leaflet-control-attribution{margin-bottom:calc(env(safe-area-inset-bottom,0px) + 94px)}\n  @media (hover:hover){.leaflet-control-zoom a:hover{background:var(--surface-2)}}']],
  '那个 94 是「猜统计条有多高」的第三个数');
t('M12 底色退回单类写 + 按主题各抄一份（亮色白底活多年的那个形状）', 'travel-map.html',
  [['  .leaflet-container .leaflet-control-attribution{background:var(--paper-bar);color:var(--ink-500)}',
    '  .leaflet-control-attribution{background:rgba(246,241,229,.75);color:var(--ink-500)}\n  .theme-dark .leaflet-control-attribution{background:rgba(29,28,25,.8);color:var(--color-muted)}']],
  '单类写底色');

/* ② 让位一族 */
t('M13 开卡又把那个点往卡片底下推（反号 + duration 单位是「秒」，两层错一起回来）', 'travel-map.html',
  [["  setTimeout(function(){clearSheetCenter();markClip();if(pr)markHClip(pr);},80);",
    "  setTimeout(function(){map.panBy([0,-180],{duration:420});markClip();},80);"]],
  '开卡又把那个点往卡片底下推');
t('M14 关卡改回「还一个猜的数」（挪多少与还多少不再是同一笔账）', 'travel-map.html',
  [['  if(map&&sheetRaised) map.panBy([0,-sheetRaised],{animate:false});',
    '  if(map) setTimeout(function(){map.panBy([0,180],{duration:420});},80);']],
  '关卡改回');
t('M15 那个按硬编码算位移的助手又回来了', 'travel-map.html',
  [['function clearSheetCenter(){',
    'function sheetHeight(){ return 485; }\nfunction clearSheetCenter(){']],
  '硬编码算位移的助手');
t('M16 让位又拆成「算高」＋「两处调用各抄一遍」两条腿（R3 的反号就是在这种形状里活了多年的）', 'travel-map.html',
  [['function restoreSheetCenter(){',
    'function panSheetBy(h, up) { map.panBy([0, up ? -180 : 180]); }\nfunction restoreSheetCenter(){']],
  '让位又拆成');
t('M17 自激门坎从「不足 1px 就不挪」退成「0 也发一次」（panBy([0,0]) 照样派发 moveend → 1253 帧爆栈）', 'travel-map.html',
  [['  if(dy>=1){ sheetRaised=Math.round(dy); map.panBy([0,sheetRaised],{animate:false}); }',
    '  if(dy>=0){ sheetRaised=Math.round(dy); map.panBy([0,sheetRaised],{animate:false}); }']],
  '门坎不足 1px 就不发');
t('M18 摘掉「卡片快占满屏就别挪」那半句守卫', 'travel-map.html',
  [['  if(band<120) return;   /* 卡片快占满屏：上面根本没地方看，挪了白挪 */\n', '']],
  '卡片快占满屏时上面根本没地方看');
t('M19 挂而不摘：关卡不 off moveend，卡关了之后每次平移都自己找一次那个已经不存在的落点', 'travel-map.html',
  [["  if(map) map.off('moveend',onSheetMoveEnd);\n", '']],
  '关卡必须摘掉');
t('M20 让位退回带 duration 的平移（同一条路径上先起的 flyTo 每帧重设视图，位移被吞光）——打专题那一支：travel-map 那一支的整行被 A44 钉着，改它只会红在锚上', 'topic-common.js',
  [['    if (dy >= 1) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { animate: false }); }',
    '    if (dy >= 1) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { duration: .52 }); }']],
  '让位一律瞬移');
t('M21 专题地图那一支的反号写法回来了（与 travel-map 同形，两处是一起修的）', 'topic-common.js',
  [['    setTimeout(locSheetClear, 80);',
    '    if (map) setTimeout(function () { map.panBy([0, -160], { duration: 420 }); }, 80);']],
  '专题地图那一支的反号');
t('M22 专题那一支的关卡退回猜的 160', 'topic-common.js',
  [['    if (map && sheetRaised) map.panBy([0, -sheetRaised], { animate: false });',
    '    if (map) setTimeout(function () { map.panBy([0, 160], { duration: 420 }); }, 80);']],
  '关卡那个猜的数回来了');
t('M23 专题那一支单独摘掉 band 守卫（travel-map 那支刚修过，这一支不许一个人退回去）', 'topic-common.js',
  [['    if (band < 120) return;   /* 卡片快占满屏：上面没地方看，挪了白挪 */\n', '']],
  '守卫两支都要在');
t('M24 专题那一支的自激门坎退成 dy >= 0', 'topic-common.js',
  [['    if (dy >= 1) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { animate: false }); }',
    '    if (dy >= 0) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { animate: false }); }']],
  'R4 的第二次发作');

/* ③ 守卫自己 */
t('M25 flat44 退回 naive 剥注释（盲窗重开：注释里抄的改前原串会被当成代码在场）', 'tools/verify.js',
  [['  const flat44 = s => ws44(stripBlockComments(s));', '  const flat44 = s => ws44(' + NAIVE44]],
  '共享剥刀');
t('M26 view44 的文档那一支退回「html 也不剥注释」（本批注释里写着改前的 [0,-180]，正向锚会靠注释假绿）', 'tools/verify.js',
  [["  const view44 = f => /" + BS + ".md$/.test(f) ? ws44(rd44(f)) : flat44(rd44(f));",
    "  const view44 = f => ws44(rd44(f));"]],
  '的定义行退回');
t('M27 盲区哨兵的标记名多打一个字符（哨兵写坏＝这一段今天读不读得到再也没人知道）', 'tools/verify.js',
  [["    [\"if(dy>=1){\", \"tl.style.setProperty('--tm-gap'\"].forEach(function (mk) {",
    "    [\"if(dy>=1)ZZ{\", \"tl.style.setProperty('--tm-gap'\"].forEach(function (mk) {"]],
  '盲区哨兵');
t('M28 A44 有一条少写「串」字段（解构错位，那条锚等于没跑）', 'tools/verify.js',
  [["['travel-map.html', 'function layoutBottomStack(){', 1,", "['travel-map.html', 1,"]],
  'A44 有一条不是');
t('M29 A44 一条期望次数抬高（锚还在、数不对＝条数锚不是抄来的死数）', 'tools/verify.js',
  [["['travel-map.html', 'layoutBottomStack();', 4,", "['travel-map.html', 'layoutBottomStack();', 5,"]],
  '少一个就是有一处状态变化没人重算');
t('M30 A44 登记了 §44 没读的文件（锚钉在没人读的字符串上＝永久绿灯）', 'tools/verify.js',
  [["['travel-map.html', 'function layoutBottomStack(){', 1,", "['travel-mapzz.html', 'function layoutBottomStack(){', 1,"]],
  '没读的文件');
t('M31 ZERO44 有一条少写「串」字段（期望 0 只剩个名字，正向对照没处配）', 'tools/verify.js',
  [["    ['travel-map.html', 'sheetHeight(', 'var sh = function", "    ['travel-map.html', 'var sh = function"]],
  'ZERO44 有一条不是');
t('M32 期望 0 那一族的 needle 去掉空格（正向对照当场失效——那个 0 不再是证据）', 'tools/verify.js',
  [["['travel-map.html', 'map.panBy([0,-180],{duration:420});',", "['travel-map.html', 'map.panBy([0,-180],{duration:420) ;',"]],
  '正向对照失效了');
t('M33 把「按主题各抄一份的底色」那一族的 needle 换成页内那条真规则（期望 0 与正向对照共用一把尺：needle 一写歪，红就自己来说话）', 'tools/verify.js',
  [["['travel-map.html', '.theme-dark .leaflet-control-attribution{background:',",
    "['travel-map.html', '.leaflet-container .leaflet-control-attribution{background:var(--paper-bar);color:var(--ink-500)}',"]],
  '里出现');
t('M34 把闭合配平的自校准反号（好串当成坏串、坏串当成好串：那个「全树 0」立刻不再是证据）', 'tools/verify.js',
  [['    if (cb !== 1 || cg !== 0) F44(', '    if (cb !== 0 || cg !== 1) F44(']],
  '闭合配平正则自己失准');
t('M35 把 bottom:calc 扫描器的校准串退化成「只喂一行好串」（越界那一支从此没人验刀）', 'tools/verify.js',
  [["    const CAL = SCAN44('#a{bottom:calc(env(safe-area-inset-bottom,0px) + 150px)}" + BS + "n#b{bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom))}');",
    "    const CAL = SCAN44('#b{bottom:calc(env(safe-area-inset-bottom,0px) + var(--map-stack-bottom))}');"]],
  '扫描器自己失准');
t('M36 bottom:calc 那条对账的分母挪高（现场 4 行永远够不到 9，越界不再说话）', 'tools/verify.js',
  [['    if (BT44.out.length || BT44.sites < 3) F44(', '    if (BT44.out.length || BT44.sites < 9) F44(']],
  '坐在基线外的 bottom:calc 对账失效');
t('M37 在专题地图那一支多插一处没人认领的 map.panBy（④ 的计数守卫必须喊——R4 就住在「第二个挪地图的人」身上；把判据本身放宽在现值下打不红，那正是它守的盲区）', 'topic-common.js',
  [['    if (map && sheetRaised) map.panBy([0, -sheetRaised], { animate: false });',
    '    if (map && sheetRaised) map.panBy([0, -sheetRaised], { animate: false });\n    if (map) map.panBy([0, 40], { animate: false });']],
  '别又留一个猜的数');
tAll('M38 抹掉 README 里 §44 的登记（摘登记要抹**全部出现**：README 那一行里 §44 出现 2 次——登记串头一处 + 「动态对账自己逮的」那句，只摘前者 indexOf 照样命中）', 'README.md',
  '§44', '足迹节', '没提 §44');
t('M39 齐备检的循环上限从 37 收到 30（少守 7 条而它自己永远不会红）', 'tools/verify.js',
  [['    for (let i = 1; i <= 37; i++) {', '    for (let i = 1; i <= 30; i++) {']],
  '而 smoke-travelmap 里真实最大编号是 TM37');
t('M40 抹掉 TM36b 那条单列判据本身（「底色对了」与「署名读得到」是两件事：源码腿那句认领必须喊）', 'tools/smoke-travelmap.js',
  [["  ok('TM36b 版权条读得到（中心命中自己）且不越过地图底边——署名不许藏在某一摞底下', ATR.self === true && ATR.inside === true, '命中自己=' + ATR.self + ' 在图内=' + ATR.inside);\n", '']],
  'TM36b');

/* ④ 浏览器腿自身 */
t('M41 真机档退回 452×995（量的就不是用户那块屏）', 'tools/smoke-travelmap.js',
  [['const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '量的必须是用户那块屏');
gBoth('M42 播种那条记录只剩一张照片（TM19 要的是「两枚都已解码、各有版面」）——源码腿无视野：A44 引的是判据行，不看播种', 'tools/smoke-travelmap.js',
  ["photos: [pic(1), pic(2)], title: '大同古城' }", "photos: [pic(1)], title: '大同古城' }"],
  'TM19');
t('M43 把 TM13 改名成 TM13b（判据还在但按编号认领不到了：源码腿引的是**登记的那条标签**）', 'tools/smoke-travelmap.js',
  [["  ok('TM13 时间线与 44px 圆钮零重叠", "  ok('TM13b 时间线与 44px 圆钮零重叠"]],
  'TM13 这条判据不是恰 1 处');
t('M44 摘掉 TM32 那条反证（把遮挡做回来闸门必须红——这一条自己也是会被删的）', 'tools/smoke-travelmap.js',
  [["  ok('TM32 反证：把 --tm-gap 归零，重叠与「命中不到自己」应当同时出现（说明 TM01/TM07 真在守这件事）', NEG.overlap > 0 && NEG.self === false, '重叠=' + NEG.overlap + ' 命中=' + NEG.hit);\n", '']],
  'TM32 这条判据不是恰 1 处');
t('M45 条数守卫阈值挪低到 20（删 18 条判据照样绿）', 'tools/smoke-travelmap.js',
  [["  ok('TM37 判据条数 ≥ 38（这一节自己也是会被删的）', checks >= 37, 'checks=' + checks",
    "  ok('TM37 判据条数 ≥ 38（这一节自己也是会被删的）', checks >= 20, 'checks=' + checks"]],
  '阈值被挪');

t('M47 只把那行 min-height 改回 35（整行形状还在，退的是那个数——这一枚锚钉的是**声明**，几何上 Chromium 的下限与同排 stretch 还顶着，所以 TM04 这一轮不会跟着红）', 'travel-map.html',
  [['    flex:none;display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;',
    '    flex:none;display:flex;align-items:center;min-height:35px;padding:0 14px;border-radius:999px;']],
  '胶囊自己那一行要有 44 这个数');

/* ⑤ 两条结构性无视野（源码腿必须全绿，浏览器腿必须红在那一条判据上）＋那 44px 的退化三件套（M46/M47/G02）：
     这一族第一轮是 silentB，查明「44 由三条机制一起撑」之后补了两枚源码锚，于是它们改由源码腿红——
     留下的教训：锚钉得住声明与形状，钉不住「另两条机制还在顶着」的几何；TM04 量真实矩形那条不能撤。 */
gBoth('G01 照片排回正文之后（本批刻意改的次序；A44 钉的是那一行在场，不钉谁在前——期望红在 TM18）〔批次 30-A 删掉 +locHtml 后这串的 from 已重取现值：改前那版含 +locHtml，预检会当场报「命中 0 处」而不是静默漏过〕', 'travel-map.html',
  ["    +photosHtml\n    +(story?'<div class=\"ms-story\">'+story+'</div>':'')",
    "    +(story?'<div class=\"ms-story\">'+story+'</div>':'')\n    +photosHtml"],
  'TM18');
t('M46 胶囊那一行整行退回改前形状（那一行根本没有 min-height，只靠 padding:9px 撑高——TM04 改前读数 35/35/35 就是这么来的）', 'travel-map.html',
  [['    flex:none;display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;',
    '    flex:none;padding:9px 14px;border-radius:999px;']],
  '只靠 padding 撑高');
t('G02 那 44px 三条腿一起退化（换成分片 + min-height 35 + 那一排写 align-items:flex-start 才压得下去：单改声明被 Chromium 对 form 控件的内部 44px 下限顶回，探针 tools/out/probe29-chiph3.txt；只换标签又被同排 .tl-trip 经默认 stretch 拉到 44，读数 tools/out/g02-smoke.txt；三条一起退化才读到 35，读数 tools/out/g02b-smoke.txt）。前两轮它是两头都不红的 silentB，第二轮补上两条源码锚（那一排的 display 行 + 胶囊自己那行 min-height）之后它就不该再是静默样本：塌的是**隐式依赖**这一族，源码腿现在认得', 'travel-map.html',
  [["      var chip=document.createElement('button');", "      var chip=document.createElement('div');"],
   ['    flex:none;display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;',
    '    flex:none;display:flex;align-items:center;min-height:35px;padding:0 14px;border-radius:999px;'],
   ['    display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;-webkit-overflow-scrolling:touch;',
    '    display:flex;align-items:flex-start;gap:8px;overflow-x:auto;padding:4px 2px 6px;-webkit-overflow-scrolling:touch;']],
  '那一排不许自己写 align-items');
gBoth('G03 在同一条规则之后再补一条同名规则，把底色盖成 Leaflet 自己的白（前面那条锚串一个字没动，只有 computed 看得见——期望红在 TM36）', 'travel-map.html',
  ['.leaflet-container .leaflet-control-attribution{background:var(--paper-bar);color:var(--ink-500)}',
    '.leaflet-container .leaflet-control-attribution{background:var(--paper-bar);color:var(--ink-500)}\n  .leaflet-container .leaflet-control-attribution{background:rgba(255,255,255,.8)}'],
  'TM36');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    c.edits.forEach(([from, to]) => {
      /* 预检自己也要有类型判据：from 写成数字/undefined 时 `split(eol(from))` 会当场 TypeError，
         而那一刻树的快照还没还原完——报「哪条 case 的 from 不是串」比报栈有用。 */
      if (typeof from !== 'string' || typeof to !== 'string') {
        console.log('预检 ' + c.name + '  的 from/to 不是串（from=' + typeof from + ' to=' + typeof to + '），这条没法预检');
        bad++; return;
      }
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
/* MUT_PREFLIGHT=1 只跑预检就退出：45 条 case 的 from 串能不能命中基准树，这一步几毫秒就出结果，
   而基准 smoke 要半分钟——改 case 时先用它把网自身的形状过一遍。 */
if (process.env.MUT_PREFLIGHT) {
  console.log('预检全过（' + CASES.length + ' 条），MUT_PREFLIGHT=1 所以树一个字没动');
  process.exit(0);
}

/* ============ 跑网 ============ */
function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
function smokeMap() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-travelmap.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §44 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
function smokeFails(out) {
  const m = out.match(/=== smoke-travelmap: (\d+) 项，失败 (\d+) ===/);
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
const bb = smokeMap();
const bbN = smokeFails(bb);
if (bbN !== 0) {
  console.log('中止：基准 smoke-travelmap.js ' + (bbN === null ? '没打出终判行（' + bb.replace(/\s+/g, ' ').slice(-160) + '）' : '已有 ' + bbN + ' 条红') + '，G 类没有可比读数');
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
      console.log('异常  ' + c.name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§44 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
      return;
    }
    fs.writeFileSync(path.join(ROOT, c.file), apply(c));
    let so, sf;
    try { so = smokeMap(); sf = smokeFails(so); }
    finally { fs.writeFileSync(path.join(ROOT, c.file), ORIG[c.file]); }
    if (sf === null) {
      anomalies++;
      console.log('异常  ' + c.name + '  smoke-travelmap 没打出终判行（浏览器腿自己崩了）：' +
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
        so.split('\n').filter(l => /^FAIL\s+TM/.test(l)).map(l => l.slice(0, 74)).join(' | '));
    } else {
      anomalies++;
      console.log('异常  ' + c.name + '  源码腿 0 红**且浏览器腿也 0 红**＝两条腿都没有视野，这条是真漏（不是设计内静默）');
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(c.token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + c.name + '  → §44 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + c.name + '  打了变异但没按预期红（想找：' + c.token + '）；本轮 §44 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
CASES.forEach(judge);

console.log('====================================================================');
console.log('§44 变异自测 共 ' + total + ' 条：按预期红 ' + red + ' / 设计内静默（源码腿绿 + 浏览器腿红）' + silent + ' / 异常 ' + anomalies);
console.log('A44 表长 41 条、ZERO44 表长 15 条（M29 打的 4→5 就是「阈值类变异要取当前长度 + 1」这条规矩的落地）；⓪ 那条共享剥刀与两枚现场哨兵不在 A44 表里，M25–M27 打的是这一屏自己');
console.log('判读：① 里 M01/M02/M03 是这张网最该在的三条——它们证明「一条基线」不是抄来的死数' +
  '（150／104／212 任一回潮，坐回硬编码那一行同时被 A44 的期望 0 与 ③ 的逐行对账抓住，两把刀各喊一次）。' +
  '② 里 M17/M24 分开打两支的自激门坎：R4 那次爆栈住在「第二个挪地图的人」身上，而 travel-map 与 topic-common 是同一把几何尺的两端，' +
  '修一处留一处照样炸。③ 里 M34/M35/M36 打的是**内置动态对账自己**（配平校准反号、扫描器校准串退化、对账分母挪高），' +
  'M37 打的是计数守卫真正守的东西（多插一处没人认领的 map.panBy）——把判据本身放宽（!== 3 改成 < 2）在现值下打不红，' +
  '那本身就是这张网要登记的盲区：计数守卫只防「变了」，不防「改了判据」。' +
  'M40 与 M39/M45 一起，是「认领判据」与「判据本身」两条腿各断一边：删判据→认领喊，删认领→只有浏览器腿还认得它。' +
  '四条 silentB（M07／M42／G01／G03）是实测出来的无视野样本：源码锚只钉形状与写法，' +
  '首屏那次提示打没打、播种几张图、谁排在谁前面、computed 到底赢没赢，都只有浏览器腿看得见。' +
  '那 44px 一族（M46／M47／G02）是这张网里改判过的一条线：前两轮它两头都不红，三轮实测查明那排胶囊的高度是三条机制一起撑的' +
  '（Chromium 对 form 控件的内部下限、同排 .tl-trip 经 align-items:stretch 传下来的高度、页内那行 min-height 本身），' +
  '前一条只在真机矩形里现形、后两条源码看得见——于是给后两条各补一枚锚，这一族改由源码腿红；' +
  'TM04 那条量真实矩形的判据不撤，因为锚钉得住声明与形状，钉不住「另两条机制还顶着」的几何。');
process.exit(anomalies ? 1 : 0);
