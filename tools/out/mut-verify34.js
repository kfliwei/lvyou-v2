/* tools/out/mut-verify34.js — verify.js §34（这一带还有什么）变异自测
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条**红里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 为什么这节最需要：批次 21 的立论是「离线也要能答」，而它的两种坏法都是**静默**的——
 * 合流顺序调个反，界面上一个字都没变，只是每张没缓存的手机都要转八秒圈然后显示空态；
 * 来源口径混写，用户看着一句「实时查询不可用」去查路由器，而真原因是离线。
 * 所以 §34 有 49 条锚、一处**按命中位置比**的顺序断言、一处函数体抬心断言、十二族期望 0，
 * 而这三类恰好都是最容易写成恒真的（needle 在源码里根本不存在／合成对照自己失效）。
 * 本网的 M54–M61 打的正是**守门的门**：删锚、破四元组、破合成对照、漏读文件。
 *
 * 用法: MUT_LOG=tools/out/b21-mut-verify34.txt node tools/out/mut-verify34.js
 * 浏览器腿（同一变异 smoke 也要红）见 tools/out/mut-smoke34.js——**不要与本网并行**：
 * 变异打的就是 smoke 要截的那几页，两份同时跑读数全废（批次 20 实测）。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 证据由脚本自己写盘：shell 重定向在长跑后台任务里留过 0 字节文件（§20 同一课） */
const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['nearby.js', 'topic-common.js', 'topic.html', 'sw.js',
  'tools/smoke-nearby.js', 'README.md', 'tools/verify.js'];
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
  l.indexOf('FAIL §34') >= 0 || l.indexOf('语法') >= 0 || /^FAIL /.test(l));

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
    console.log('红  ' + name + '  → 本轮红 ' + lines.length + ' 条，指定那条：' + hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
/* run：from 必须恰 wantCount 处，只替第一处 */
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
/* runAll：from 出现几处替几处（改名／抹登记那类 indexOf<0 型断言） */
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
/* dropLines：删掉含 marker 的前 count 行（用来打「锚点表被削减」这条守卫） */
function dropLines(name, file, marker, count, token) {
  const lines = ORIG[file].split(/\r?\n/);
  const drop = [];
  for (let i = 0; i < lines.length && drop.length < count; i++) {
    if (lines[i].indexOf(marker) >= 0) drop.push(lines[i]);
  }
  if (drop.length < count) {
    total++; anomalies++;
    console.log('异常  ' + name + '  含「' + marker + '」的行只找到 ' + drop.length + ' 行，凑不齐 ' + count + ' 行');
    return;
  }
  const from = drop.join('\n');
  if (ORIG[file].split(from).length - 1 !== 1) {
    /* 行与行之间的换行符可能是 CRLF，逐行替换更稳 */
    let src = ORIG[file];
    const nl = EOL(file);
    drop.forEach(l => { src = src.replace(l + nl, () => ''); });
    judge(name, file, src, token);
    return;
  }
  judge(name, file, ORIG[file].replace(from, () => ''), token);
}

/* ============ ① 数据层三个数字：改一个数就是改产品口径 ============ */
run('M1 内置凑满阈值 4→0（每次点图都要联网，「离线也能答」当场没了）', 'nearby.js',
  'var BUILTIN_ENOUGH = 4;', 'var BUILTIN_ENOUGH = 0;', 'BUILTIN_ENOUGH = 4');
run('M2 超时 8s→30s（转半分钟圈，用户以为程序死了）', 'nearby.js',
  'var OVERPASS_TIMEOUT_MS = 8000;', 'var OVERPASS_TIMEOUT_MS = 30000;', 'OVERPASS_TIMEOUT_MS = 8000');
run('M3 补位上限 12→200（几十条实时结果淹掉内置答案）', 'nearby.js',
  'var MAX_OSM = 12;', 'var MAX_OSM = 200;', 'MAX_OSM = 12');
run('M4 来源口径脚注改文案（弹层、smoke、闸门比的是同一个串）', 'nearby.js',
  "var LIVE_NOTE = '以下为实时查询（OSM），离线不可用';", "var LIVE_NOTE = '实时查询结果';",
  '以下为实时查询（OSM），离线不可用');

/* ============ ② 本节的灵魂：合流顺序（存在性检查守不住它，必须比位置） ============ */
run('M5 合流顺序调反：网络腿先跑（界面一个字没变，每张手机都转八秒）', 'nearby.js',
  'var hits = nearbySites(lat, lng, rKm, cats, exclude);',
  'overpassNearby(lat, lng, rKm, function () {}); var hits = nearbySites(lat, lng, rKm, cats, exclude);',
  '排在 nearbySites( 之前');
run('M6 合流口摘掉内置腿（离线用户永远空态）', 'nearby.js',
  'var hits = nearbySites(lat, lng, rKm, cats, exclude);',
  'var hits = builtinIndex(lat, lng, rKm, cats, exclude);', '体里没有 nearbySites(');
run('M7 合流口摘掉补位腿（内置没记录的地方永远说「这一带还有什么」）', 'nearby.js',
  'overpassNearby(lat, lng, rKm, function (osm) {', 'osmFill(lat, lng, rKm, function (osm) {',
  '体里没有 overpassNearby(');
run('M8 合流口调两次补位（点一次图发两回查询，限流的是对面）', 'nearby.js',
  "cb({ items: hits.concat(extra), builtin: hits.length, osm: extra.length, live: extra.length > 0, offline: false });",
  "if (extra.length > MAX_OSM) overpassNearby(lat, lng, rKm, function () {}); cb({ items: hits.concat(extra), builtin: hits.length, osm: extra.length, live: extra.length > 0, offline: false });",
  '点一次图发两回查询');

/* ============ ③ 查询语句与降级：静默三兄弟（429 / 504 / 没网）都得闭嘴 ============ */
run('M9 km→米漏乘 1000（界面写着 30km，对面按 30 米查）', 'nearby.js',
  'var radius = Math.round((+rKm > 0 ? +rKm : DEFAULT_RKM) * 1000);',
  'var radius = Math.round(+rKm > 0 ? +rKm : DEFAULT_RKM);', 'km→米换算单点');
run('M10 服务端超时抬到 30s（本地 8s 就弃，对面替我们占着线程）', 'nearby.js',
  "'[out:json][timeout:8];('", "'[out:json][timeout:30];('", '响应格式与服务端超时');
run('M11 摘掉 way 腿（整个景区多边形从此查不到）', 'nearby.js',
  'way["tourism"', 'rel["tourism"', 'way["tourism"~');
run('M12 摘掉 node 腿（只剩多边形，散点兴趣点全没了）', 'nearby.js',
  'node["tourism"', 'nod["tourism"', 'node["tourism"~');
run('M13 请求体改成 JSON（Overpass 要 data= 表单，对面直接 400）', 'nearby.js',
  "body: 'data=' + encodeURIComponent(overpassQuery(lat, lng, rKm)),",
  'body: JSON.stringify({ data: overpassQuery(lat, lng, rKm) }),', 'Overpass 要的是 data= 表单');
run('M14 超时只 clearTimeout 不 abort（请求还在对面跑着）', 'nearby.js',
  'signal: ctl ? ctl.signal : undefined', 'signal: undefined', '超时要真能把请求掐掉');
run('M15 定时器里摘掉 abort（同上，另一种写法）', 'nearby.js',
  'var timer = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } done(null); }, OVERPASS_TIMEOUT_MS);',
  'var timer = setTimeout(function () { done(null); }, OVERPASS_TIMEOUT_MS);', '到点即弃、不排队重试');
run('M16 回调守卫摘掉：超时与响应竞速时二次 cb（面板渲染两遍、第二遍是空态）', 'nearby.js',
  'function done(list) { if (settled) return; settled = true; clearTimeout(timer); cb(list || null); }',
  'function done(list) { clearTimeout(timer); cb(list || null); }', '回调只落一次');
run('M17 429/504 不再当「问不到」（限流是常态，弹错等于每次点图都可能糊一脸红）', 'nearby.js',
  'if (!r || !r.ok) { done(null); return null; }', 'if (!r) { done(null); return null; }',
  '429/504 一律当');
run('M18 摘掉 catch（网络异常冒泡出去，页面静默死在这条腿上）', 'nearby.js',
  '}).catch(function () { done(null); });', '});', '网络异常静默降级');
run('M19 有网判定恒 false（没网的机器上每次转八秒圈）', 'nearby.js',
  'var offline = !global.navigator || global.navigator.onLine === false;',
  'var offline = false;', '有网判定单点');
run('M20 合流判定丢掉 offline（离线也发请求）', 'nearby.js',
  'if (hits.length >= BUILTIN_ENOUGH || offline) {', 'if (hits.length >= BUILTIN_ENOUGH) {',
  '够四条或没网');
run('M21 内置分支不把 offline 带出去（渲染层分叉不了，「没网」与「查了没返回」混成一句）', 'nearby.js',
  'cb({ items: hits, builtin: hits.length, osm: 0, live: false, offline: offline });',
  'cb({ items: hits, builtin: hits.length, osm: 0, live: false });', '内置分支把 offline 带出去');
run('M22 拼接顺序反：实时结果排在内置之前', 'nearby.js',
  'cb({ items: hits.concat(extra),', 'cb({ items: extra.concat(hits),', '内置在前、补位在后');
run('M23 内置腿来源标记改名（两种答案混成一锅）', 'nearby.js',
  "d: d, src: '内置' }", "d: d, src: '库内' }", "src: '内置'");
run('M24 摘掉内置结果排序（必去的西湖排到二十公里外的小庙后面）', 'nearby.js',
  'out.sort(byFlagThenDist);', 'void 0;', '内置结果按「必去/网红优先');
run('M25 比较函数写死 flag 字符串（绕过权重表＝第二套排序）', 'nearby.js',
  'var w = (FLAG_WEIGHT[b.flag] || 0) - (FLAG_WEIGHT[a.flag] || 0);',
  "var w = a.flag === 'm' ? -1 : 1;", '权重表派生的比较函数单点');

/* ============ ④ UI 入口：取点复位 / 层级让位 / 抬心 ============ */
run('M26 取点完不复位（chip 亮着，用户以为还在取点，下一张卡记错地方）', 'topic-common.js',
  'if (nearMode || M.nearEnabled) { nearMode = false; syncChips(); nearPick(e.latlng); return; }',
  'if (nearMode || M.nearEnabled) { nearMode = false; nearPick(e.latlng); return; }', '取点即复位');
run('M27 取消取点不说话（点亮与熄灭两种状态只有一种有反馈）', 'topic-common.js',
  "if (nearMode) { nearMode = false; syncChips(); showTripToast('已取消「这一带」取点'); return; }",
  'if (nearMode) { nearMode = false; syncChips(); return; }', '取消要有反馈');
run('M28 入口 chip 改名换色（与必去/网红同框的那颗就不是它了）', 'topic-common.js',
  "mkChip('这一带', false, '#AE5738')", "mkChip('附近', false, '#111111')", "mkChip('这一带'");
run('M29 摘掉抬心调用（下半屏的圆心永远被自己的结果面板盖住）', 'topic-common.js',
  'raiseCenterClear(sh);', 'void 0;', '渲染完就检查圆心是否被面板盖住');
run('M30 panBy 位移符号写反（实测把点从 y=430 推到 550：越抬越压住）', 'topic-common.js',
  'if (p.y > want) map.panBy([0, p.y - want], { animate: false });',
  'if (p.y > want) map.panBy([0, want - p.y], { animate: false });', 'panBy 的符号');
run('M31 去掉 p.y > want 守卫（没压住也挪：每查一次地图自己滑一下）', 'topic-common.js',
  'if (p.y > want) map.panBy([0, p.y - want], { animate: false });',
  'map.panBy([0, p.y - want], { animate: false });', '没有 p.y > want 守卫');
run('M32 面板与地图容器只量一次矩形（屏幕坐标去比容器坐标）', 'topic-common.js',
  'var cr = sh.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect();',
  'var cr = sh.getBoundingClientRect(), mr = { top: 0 };', '不是恰 2 次');
run('M33 抬心挪两次（每次查询视图跳两下）', 'topic-common.js',
  'if (p.y > want) map.panBy([0, p.y - want], { animate: false });',
  'if (p.y > want) { map.panBy([0, p.y - want], { animate: false }); map.panBy([0, 8], { animate: false }); }',
  'map.panBy( 不是恰 1 次');
run('M34 点内置项进卡时不收起半径条与面板（1200/1210 浮在景点卡之上）', 'topic-common.js',
  '      hideNearBar(); hideNearSheet();' + EOL('topic-common.js') + '      flyToSite(i);',
  '      flyToSite(i);', '半径条与面板层级');
run('M35 空态两句话合成一句（离线用户被支去查路由器）', 'topic-common.js',
  "(res.offline ? '，离线也补不了实时查询' : '，实时查询这次也没返回')",
  "'，实时查询暂时不可用'", '空态两句话分叉');
run('M36 内置脚注改名（界面、smoke、闸门比的是同一串）', 'topic-common.js',
  "'来源：包内景点库，离线可用'", "'来源：内置库'", '内置脚注整串');
run('M37 混排时只印总数（12 条看着都像离线可用）', 'topic-common.js',
  "('内置 ' + res.builtin + ' · 实时 ' + res.osm)", "('这一带 ' + (res.builtin + res.osm) + ' 处')",
  '· 实时 ');
run('M38 面板不写无障碍名（批次 22 的读法与这里同源）', 'topic-common.js',
  "nearSheet.setAttribute('aria-label', '这一带还有什么');", 'void 0;', '面板有无障碍名');

/* ============ ⑤ 期望 0 十二族：把每种越界真的写进去 ============ */
run('M39 实时答案落盘（「这一带有什么」变成「上周有什么」）', 'nearby.js',
  "var _rows = null, _rowsFrom = '';",
  "var _rows = null, _rowsFrom = '';\n  function cache(s) { localStorage.setItem('tn_near_cache', s); }",
  '数据层不落盘');
run('M40 数据层起定时器（自己把对面限流放大）', 'nearby.js',
  'var FLAG_WEIGHT = { m: 2, h: 1 };',
  "var FLAG_WEIGHT = { m: 2, h: 1 };\n  function beat() { setInterval(function () { go(); }, 1000); }",
  '不排队重试');
run('M41 补位腿改走高德周边搜（离线承诺换成登录承诺）', 'nearby.js',
  'var DEFAULT_RKM = 30;',
  "var DEFAULT_RKM = 30;\n  function amapAround() { fetch('https://restapi.amap.com/v3/place/around'); }",
  '补位只用 OSM 一条腿');
run('M42 OSM 的 name 混进事实 SEED（拿第三方数据冒充自己核过的事实）', 'nearby.js',
  "var DEFAULT_RKM = 30;",
  "var DEFAULT_RKM = 30;\n  var SEED = { '西湖': { p: 1 } };",
  '实时查询的结果不许写进门票/事实 SEED');
run('M43 页面侧弹错误 toast（数据层零 UI）', 'nearby.js',
  'var DEFAULT_RKM = 30;',
  "var DEFAULT_RKM = 30;\n  function warn() { UI.toast('查询失败，请检查网络'); }",
  '数据层零 UI');
run('M44 UI 绕过合流口直接调网络腿（本节的灵魂当场失效）', 'topic-common.js',
  'Nearby.queryNearby(lat, lng, km, null, function (res) {',
  'Nearby.overpassNearby(lat, lng, km, function (res) {', 'UI 只能走 queryNearby 这个合流口');
run('M45 这一带改成系统通知（批次 17 的红线延续到批次 21）', 'topic-common.js',
  'nearP = [latlng.lat, latlng.lng];',
  "nearP = [latlng.lat, latlng.lng];\n    new Notification('这一带有 12 处');",
  '这一带的提醒只有页内一条腿');
run('M46 页面侧自己拼 Overpass 请求（URL 与查询语句两份口径）', 'topic-common.js',
  'function raiseCenterClear(sh) {',
  "function dbgFetch() { fetch('https://overpass-api.de/api/interpreter'); }\n  function raiseCenterClear(sh) {",
  '页面侧不许自己拼 Overpass 请求');
run('M47 第三方接口进预缓存壳（它不是本地文件，装机首屏白等）', 'sw.js',
  "  './nearby.js',", "  './nearby.js', 'https://overpass-api.de/api/interpreter',",
  '第三方接口不进预缓存壳');

/* ============ ⑥ 壳与页面：SHELL 有而页面没挂＝死文件；页面挂了而壳里没有＝首屏即无 ============ */
run('M48 页面摘掉 nearby.js（壳里还留着，模块白占体积）', 'topic.html',
  '<script src="nearby.js"></script>', '', '页面挂了模块');
run('M49 离线壳摘掉 nearby.js（这功能的立论就是离线可用）', 'sw.js',
  "  './nearby.js'," + EOL('sw.js'), '', '预缓存在案');
run('M50 断网腿不再真断网（读 navigator.onLine 的桩自己也算被测对象）', 'tools/smoke-nearby.js',
  'await p.setOfflineMode(true);', 'await p.setOfflineMode(false);', '断网腿走 CDP 真断网');
run('M51 断网腿只断一次（省页那条入口不再验物理没网）', 'tools/smoke-nearby.js',
  '= await toOffline(', '= await toOfflineX(', '全国页与省页各断一次网', 2);

/* ============ ⑦ 浏览器腿条数与齐备检：删判据必须说话 ============ */
run('M52 判据改名成 N16x（齐备检原先只认前缀会放过它，§31 同一课）', 'tools/smoke-nearby.js',
  "ok('N16 ", "ok('N16x ", '缺 N16 这条判据');
run("M53 判据条数被灌水（把同一条 ok('N01 复制一遍：齐备检照样过，只有条数守卫会红）", 'tools/smoke-nearby.js',
  "ok('N01 断网生效（navigator.onLine===false）', offA === '', offA);",
  "ok('N01 断网生效（navigator.onLine===false）', offA === '', offA); ok('N01 断网生效（navigator.onLine===false）', offA === '', offA);",
  '判据条数不是 49');
runAll('M54 README 抹掉 §34 登记（新闸门不写进 README 就等于没装）', 'README.md', '§34', '§3x', '没提 §34');

/* ============ ⑧ 守门的门：锚点表形状／阈值／合成对照／读文件名单 ============ */
/* marker 必须带四空格缩进：裸 `['nearby.js',` 还会命中 3637 行的 FILES34 声明，
 * 删掉它 verify.js 直接 ReferenceError 崩在半路，pick() 里没有一条 FAIL ——
 * 表现是「本轮红 0 条」而不是「红在指定那条」，看着像守卫失效其实是变异自己把门拆了（首跑就踩在这）。 */
dropLines('M55 锚点表被削减 8 条（阈值 42 是落地时实测的守卫线：49−8＝41 才越线）', 'tools/verify.js',
  "    ['nearby.js',", 8, '锚点表被削减');
run('M56 锚点写成三元组（跳过不再静默 return，§27 立的形状守卫）', 'tools/verify.js',
  "['nearby.js', 'var MAX_OSM = 12;', 1, '补位结果上限：不限条数会让实时那几十条淹掉内置答案'],",
  "['nearby.js', 'var MAX_OSM = 12', 1],", '不是「[文件, 串, 期望次数, 原因]」四元组');
run('M57 一条锚的 needle 被改成源码里没有的串（假绿灯的最常见形态）', 'tools/verify.js',
  "['nearby.js', 'var MAX_OSM = 12;', 1,", "['nearby.js', 'var MAX_OSM = 200;', 1,",
  '命中 0 次（要 1）');
run('M58 期望 0 的正向对照换成不含该串的空壳（那个 0 就不再是证据）', 'tools/verify.js',
  "['nearby.js', 'setInterval', 'setInterval(function () { go(); }, 1000);',",
  "['nearby.js', 'setInterval', 'notARealControl();',", '这条期望 0 的正向对照失效');
run('M59 抬心正向对照改成一次矩形（2/1 那两条判据失去依据）', 'tools/verify.js',
  "var cr = sh.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect(); var want = (cr.top - mr.top) - 40; if (p.y > want) map.panBy([0, p.y - want], { animate: false }); }');",
  "var cr = sh.getBoundingClientRect(); var want = 40; if (p.y > want) map.panBy([0, p.y - want], { animate: false }); }');",
  '抬心断言的正向对照失效');
run('M60 灵魂反向对照改成内置在前（那它对真源码的 PASS 就不是证据）', 'tools/verify.js',
  "const MUT = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { overpassNearby(lat, lng, rKm, function (osm) { cb({ items: osm || [] }); }); var hits = nearbySites(lat, lng, rKm, cats, exclude); }');",
  "const MUT = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { var hits = nearbySites(lat, lng, rKm, cats, exclude); overpassNearby(lat, lng, rKm, function (osm) { cb({ items: osm || [] }); }); }');",
  '顺序断言的反向对照失效');
run('M61 灵魂正向对照改成网络在前（这条锚会不分对错一直红）', 'tools/verify.js',
  "const GOOD = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { var hits = nearbySites(lat, lng, rKm, cats, exclude); overpassNearby(lat, lng, rKm, function () {}); cb(hits); }');",
  "const GOOD = flat34('function queryNearby(lat, lng, rKm, cats, cb, exclude) { overpassNearby(lat, lng, rKm, function () {}); var hits = nearbySites(lat, lng, rKm, cats, exclude); cb(hits); }');",
  '顺序断言的正向对照失效');
run('M62 FILES34 漏读一个文件（那几条锚一次都没跑过）', 'tools/verify.js',
  "const FILES34 = ['nearby.js', 'topic-common.js', 'topic.html', 'sw.js',",
  "const FILES34 = ['nearby.js', 'topic-common.js', 'topic.html',",
  '登记了 §34 没读的文件');

console.log('mut-verify34: ' + red + '/' + total + ' 按预期红，异常 ' + anomalies);
process.exit(anomalies ? 1 : 0);
