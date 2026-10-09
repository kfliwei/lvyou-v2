/* tools/out/mut-verify49.js — verify.js §49「入口接线与深链回执闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §49 红**里看见它，
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §49 的靶子分四类：
 *   ① 入口接线与深链被拆（R01–R24）：story 那枚 onclick 摘掉／pi 退回写死第一张／cursor 退掉／
 *      照片框整族不渲染；me 的 encodeURIComponent／aria 那一件／键盘那半支／空格 preventDefault／
 *      裸减法／容器两次查／逐行绑定的分母；design.css 那条 44 地板；深链那一支的解析期回潮、
 *      setTimeout 猜载入、一次性清零、三档回执各缺一档、真值判坐标、解码 try、调用位置、
 *      第二次抢镜头、flyTo 多一处、回执口径分叉、全屏层那一族少一处、搜索那条老出口被删。
 *   ② 守卫自己（S01–S16）：两把共享剥刀各自的定义行、盲区哨兵表、A49/ZERO49 四元组形状、
 *      A49 登记了没读的文件、ZERO49 的正向对照失效、三把派生扫描各自的登记表与阈值（含两把
 *      「只在刀瞎了才说话」的自校准，按 §47/§48 的教训一律打**阈值**不打摘句）、缩略图分母的
 *      两视图对账（S09 把条件取反，证那一句红印得出来／S16 从产品侧真塞一条注释里的出图形状）。
 *   ③ 浏览器腿脚手架（T01–T14）：屏档、tn_onboarded、block:'center'、顶命中 null 判据、瓦片噪声、
 *      分母 throw、条数守卫、库名、判据改名三条（E09/E24/E32）、齐备检循环上限、README 两处登记
 *      被抹（§49 那条 / smoke-entry 那条腿）。
 *   ④ 两条腿的分工样本（U01–U04：源码腿必须全绿，浏览器腿必须红在指名那条 E）：
 *      U01 深链落点 z13 退成 z10（§49 的锚钉的是 `.flyTo(` 出现一次，不是那个 13）→ E14 红；
 *      U02 design.css 在 44 那条之后再写一条 `.rec{min-height:32px}`（正向锚读到的还是那一行）→ E09 红；
 *      U03 travel-map 的页内全屏层建出来了却不把 img 挂上去（锚钉的是 markup 里的 onclick）→ E23 红；
 *      U04 album-edit 选择器那一行只收选择器不回传（album-edit.html 根本不在 §49 的读表里）→ E29 红。
 *   为什么必须有 ④：本节的立论是「入口能不能点必须由真鼠标点得到来证明」，源码腿读的是串的在场、
 *      计数的相等、位置的前后，读不到「那一下点下去到底发生了什么」；①②③ 全对也只证明锚在场。
 *
 * 登记一条本网不假装覆盖的盲区：把 A49 / ZERO49 表里**整条锚删掉**不会红——§49 没有表长守卫
 *   （网自己在基准里对账摘要行的「A49 表长 34 条、ZERO49 表长 8 条」，删一条锚那行会变成 33/8，
 *   但这个数只印在日志里、不进退出码）。所以要砍锚得连产品串一起砍（R 类各条覆盖了这一支）。
 *
 * 登记第二条设计内盲区（与 §47/§48 同因）：三把派生扫描各自的**自校准那一支**和段两头取不到那一支，
 *   原样摘掉都不会红——干净树上它们本来就是静默的。所以 S09/S13/S14/S15 打的是条件取反、阈值与查找串，
 *   证的是「这一支是活的、消息能落地」，而不是「摘掉有人报」。
 *   S09 另有一层：把两视图对账原样摘掉，再塞一条注释里的出图形状（S16 那个触发），整跑**仍然不绿**——
 *   因为逐文件计数对账（story 实得 2／登记 1）也会抓到同一发。所以那句红不是只由这一支撑着的，
 *   这一支的价值在「早一步说出根因是注释」，本网用条件取反证它活着，不假装它是唯一防线。
 *
 * 记一条 token 口径：verify.js 印 A49/ZERO49 的红时 needle 只写前 52／48 字，所以 token 一律取
 *   why／reason 里的一段，或取自定义消息的整句片段；本网没有一条 token 跨在 slice 边界上。
 *
 * 用法:
 *   node tools/out/mut-verify49.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify49.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify49.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b34-mut-verify49.txt node tools/out/mut-verify49.js
 * **不要与别的变异网或像素基线并行**：本网动的是 story.html／me.html／design.css／travel-map.html／
 *   search.html／album-edit.html／tools/verify.js／tools/smoke-entry.js／README.md，与 mut-verify46/47/48
 *   重叠 tools/verify.js 与 README.md（48 还重叠 design.css）；像素基线量的就是同一批屏。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U 类会重跑 tools/smoke-entry.js（它自己把读数落到固定名 tools/out/b34-smoke-entry.txt），
 *   所以跑完要在干净树上复跑一次这条腿，把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut49.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut49.lock');
if (BUSY.length) { unlock(); console.log('中止：' + OUTDIR + ' 里还有别的变异网锁 ' + BUSY.join('、') + '（快照可能与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['story.html', 'me.html', 'design.css', 'travel-map.html', 'search.html',
  'album-edit.html', 'tools/verify.js', 'tools/smoke-entry.js', 'README.md'];
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
  ['tools/verify.js', '/* ④ 浏览器腿齐备检：E01–E31 逐条在场'],
  ['tools/verify.js', "const flat49 = s => ws49(stripBlockComments(s));"],
  ['tools/verify.js', "const view49 = f => /\\.md$/.test(f) ? ws49(rd49(f)) : flat49(rd49(f));"],
  ['tools/verify.js', "const ROWEX49 = { 'md-manager.html': 'it.onclick = function () { openDetail(n); };' };"],
  ['tools/verify.js', "const REG49B = { 'me.html': { emit: 1, read: 2 }, 'search.html': { emit: 3, read: 2 } };"],
  ['tools/verify.js', "if (var49.rowExit !== 1)"],
  ['tools/verify.js', 'const C49 = [[\'sm.textContent\', 3,'],
  ['tools/verify.js', "      const nCalls = cnt49(T49, 'locateDeepNote(');"],
  ['tools/smoke-entry.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-entry.js', "ok('E32 "],
  ['tools/smoke-entry.js', 'checks >= 31'],
  ['story.html', "onclick=\"TravelNotes.zoomPhotoIdx(\\x27'+n.id+'\\x27,'+pi+')\""],
  ['me.html', "var box = document.getElementById('meRecent');"],
  ['travel-map.html', 'function locateDeepNote(){'],
  ['design.css', '#meRecent .rec{min-height:44px}'],
  ['README.md', '§49 入口接线与深链回执'],
  ['README.md', 'smoke-entry'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 52) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, edits, token) { CASES.push({ name, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, edits: [[file, from, to]], token, kind: 'all' }); }
function gBoth(name, edits, want) { CASES.push({ name, edits, want, kind: 'silentB' }); }

/* ---------- ① 入口接线被拆：story ---------- */
t('R01 story 那一枚的 onclick 整段摘掉（回到「有 src 有样式、没有出口」＝用户逐字报的那件事）', [['story.html',
  ' onerror="window.UI&&UI.imgFail(this)" onclick="TravelNotes.zoomPhotoIdx(\\x27\'+n.id+\'\\x27,\'+pi+\')"',
  ' onerror="window.UI&&UI.imgFail(this)"']],
  '接到页面级查看器');
t('R02 story 的 pi 退回写死第一张（map 形参与调用两处一起退化，代码不崩；查看器从此永远停在 1/n）', [['story.html',
  'n.photos.map(function(p,pi){return', 'n.photos.map(function(p){return'],
  ['story.html', "\\x27,'+pi+')\"", "\\x27,0)\""]],
  'map 的形参要带 pi');
t('R03 story 的 cursor 从那一行退回去（接线还在但屏上没有任何可点承诺，改前实测 cursor:auto）', [['story.html',
  'border-radius:10px;flex:0 0 auto;cursor:pointer}', 'border-radius:10px;flex:0 0 auto}']],
  'cursor 与接线必须一起改');
t('R04 story 照片框整族不渲染（.sc-pics 那个容器名一改，出口与 cursor 全都挂在不存在的东西上）', [['story.html',
  '\'<div class="sc-pics">\'', '\'<div class="sc-pics2">\'']],
  '照片框这一族在场');

/* ---------- ① 入口接线被拆：me ---------- */
t('R05 me 的出口少 encodeURIComponent：id 里带 & 或空格就把查询串拼歪，落地页读到一个不存在的 id', [['me.html',
  "data-go=\"travel-map.html?id=' + encodeURIComponent(n.id||'')",
  "data-go=\"travel-map.html?id=' + (n.id||'')"]],
  'encodeURIComponent 在');
t('R06 me 的 aria-label 摘掉（role/tabindex 还在，读屏用户从此听不到那一句）', [['me.html',
  "role=\"button\" tabindex=\"0\" aria-label=\"打开这篇游记\"",
  "role=\"button\" tabindex=\"0\""]],
  '接成入口就要可达');
t('R07 me 的键盘那半支整条摘掉（只接鼠标＝一半人能点，而 DOM 里行数、高度、data-go 全都没变）', [['me.html',
  "      it.onkeydown=function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); location.href=it.dataset.go; } };\n", '']],
  '只接鼠标＝键盘用户点不动');
t('R08 空格不 preventDefault（跳转与滚页同时发生：可达性做了，行为却互相抢）', [['me.html',
  "if(e.key==='Enter'||e.key===' '){ e.preventDefault(); location.href=it.dataset.go; }",
  "if(e.key==='Enter'||e.key===' '){ location.href=it.dataset.go; }"]],
  '空格键要 preventDefault');
t('R09 排序回到裸减法 b.ts - a.ts（撞没填时间戳那篇返回 NaN，「最近」两字的顺序交给引擎）', [['me.html',
  'return (b.ts||0) - (a.ts||0);', 'return b.ts - a.ts;']],
  '裸减法撞没填时间戳那篇返回 NaN');
t('R10 写入与接线分开各查一次容器（症状是「有时能点有时不能点」那种最难复现的）', [['me.html',
  "    var box = document.getElementById('meRecent');\n    box.innerHTML =",
  "    document.getElementById('meRecent').innerHTML ="],
  ['me.html', "    box.querySelectorAll('.rec').forEach(function(it){",
  "    document.getElementById('meRecent').querySelectorAll('.rec').forEach(function(it){"]],
  '写入与接线分开各查一次容器');
t('R11 逐行绑定的分母换成模板里的计数（渲染没出来的行也被人替它认领出口）', [['me.html',
  "box.querySelectorAll('.rec').forEach(function(it){", 'recent.forEach(function(it){']],
  '逐行绑定的分母取自 DOM');

/* ---------- ① 触控地板 ---------- */
t('R12 44 地板从 .rec 那一行退回去（接成入口而不抬地板＝造一枚不合格的新钮）', [['design.css',
  '#meRecent .rec{min-height:44px}', '#meRecent .rec{min-height:32px}']],
  '44 地板管到这一排');

/* ---------- ① 深链那一支 ---------- */
t('R13 深链回到解析期读库（把 HEAD 那一段的形状请回来一次：for 一次都不进，三档全是同一句沉默）', [['travel-map.html',
  "var _deepId=(location.search.match(/[?&]id=([^&]+)/)||[])[1]||'';",
  "(function(){var m=location.search.match(/[?&]id=([^&]+)/);if(m){var id=m[1];var nts=TravelNotes.list();for(var i=0;i<nts.length;i++){}}})();\nvar _deepId=(location.search.match(/[?&]id=([^&]+)/)||[])[1]||'';"]],
  '深链又回到解析期读库');
t('R14 段内挂一个 setTimeout（猜「载入大概完成了」的时刻，而不是等载入完成）', [['travel-map.html',
  "  var nn=TravelNotes.list().filter(function(x){return x.id===id;})[0];",
  "  var nn=TravelNotes.list().filter(function(x){return x.id===id;})[0];\n  setTimeout(function(){},500);"]],
  'setTimeout」实得 1，期望 0');
t('R15 一次性清零被摘（保存之后 _onReady 再跑一次会把人从全体视野抢回那一点）', [['travel-map.html',
  "  _deepId='';", '  /* 不清零 */']],
  '一次性：不清零的话');
t('R16 回执档一少一档（找不到那一篇重新变成沉默——改前三档读回来是同一句常态统计）', [['travel-map.html',
  "  if(!nn){ if(sm) sm.textContent='没找到那篇游记，可能已经被删除了'; return; }", '  if(!nn) return;']],
  '回执档一');
t('R17 缺坐标那一档改成真值判断（lat 为 0 是合法值，赤道上的点会被读成「没有坐标」）', [['travel-map.html',
  'if(nn.lat==null||nn.lng==null)', 'if(!nn.lat||!nn.lng)']],
  '缺坐标那一档要显式判');
t('R18 解码的 try/catch 摘掉（坏 % 串抛 URIError 发生在 _onReady 里＝整页刷新没跑完）', [['travel-map.html',
  "var id=_deepId; try{ id=decodeURIComponent(_deepId); }catch(e){}", 'var id=decodeURIComponent(_deepId);']],
  '坏 % 串会让 decodeURIComponent 抛 URIError');
t('R19 调用退回 refresh 之前（refresh 会写那行字，回执晚一步才盖在它上面；倒了就是回执被覆盖）', [['travel-map.html',
  'window.TravelNotes._onReady = function(){ refresh(); locateDeepNote(); };',
  'window.TravelNotes._onReady = function(){ locateDeepNote(); refresh(); };']],
  '回执晚一步才能盖在它上面');
t('R20 载入之外多一处调用（屏上表现为「点什么都没选，地图自己飞走了」）', [['travel-map.html',
  'window.TravelNotes._onReady = function(){ refresh(); locateDeepNote(); };',
  'window.TravelNotes._onReady = function(){ refresh(); locateDeepNote(); };\nlocateDeepNote();']],
  '实得 3，期望 2');
t('R21 段内 flyTo 多一处（同一篇被抢两次镜头，本节立论是「定位动作恰一处」）', [['travel-map.html',
  '  if(map&&map.flyTo) map.flyTo(gxy(nn.lat,nn.lng),Math.max(map.getZoom(),13),{duration:.8});',
  '  if(map&&map.flyTo) map.flyTo(gxy(nn.lat,nn.lng),Math.max(map.getZoom(),13),{duration:.8});\n  if(map&&map.flyTo) map.flyTo(gxy(nn.lat,nn.lng),Math.max(map.getZoom(),13),{duration:.8});']],
  '.flyTo(」实得 2，期望 1');
t('R22 成功那一档的回执换了说法（两条链共用同一句口径从此分叉，?lat= 那条还在说旧话）', [['travel-map.html',
  "  if(sm) sm.textContent='已定位：'+nm;", "  if(sm) sm.textContent='定位好了：'+nm;"]],
  '两条链共用这一句回执口径');
t('R23 记忆列表那一族的缩略图丢掉全屏层出口（A49 的 2 掉到 1，派生那把刀同时读不到档位）', [['travel-map.html',
  "src=\"'+x+'\" onclick=\"zoomPhoto(this.src)\" onerror", "src=\"'+x+'\" onerror"]],
  '那两族缩略图各接一处本页全屏层');
t('R24 首页搜索那条老出口被删（深链修好了而入口从两条砍回一条——入口太窄那一族）', [['search.html',
  "out+='<div class=\"item\" data-go=\"travel-map.html?id='+encodeURIComponent(n.id||'')",
  "out+='<div class=\"item\" data-go=\"travel-map.html?q='+encodeURIComponent(n.id||'')"]],
  '首页搜索那条老出口要一直在');

/* ---------- ② 守卫自己 ---------- */
t('S01 flat49 定义行不再走那把共享剥刀（注释里抄的改前原串会被当成代码在场）', [['tools/verify.js',
  'const flat49 = s => ws49(stripBlockComments(s));', 'const flat49 = s => ws49(s);']],
  'flat49 定义行没走那把共享剥刀');
t('S02 view49 退回「文档也剥注释」那一支（审核报告与 README 天生要写这族的改前形状）', [['tools/verify.js',
  "const view49 = f => /\\.md$/.test(f) ? ws49(rd49(f)) : flat49(rd49(f));",
  'const view49 = f => flat49(rd49(f));']],
  '文档也剥注释');
t('S03 盲区哨兵表里那一枚换成树上没有的串（这一带又变成盲窗，住在里面的期望 0 会静默满足）', [['tools/verify.js',
  "     ['design.css', '#meRecent .rec{min-height:44px}'],",
  "     ['design.css', '#meRecent .rec{min-height:45px}'],"]],
  '盲区哨兵');
t('S04 A49 有一条多塞一个字段（四元组形状不整即红，跳过不再静默 return）', [['tools/verify.js',
  "['search.html', 'travel-map.html?id=', 1, '首页搜索那条老出口要一直在",
  "['search.html', 'travel-map.html?id=', 1, 1, '首页搜索那条老出口要一直在"]],
  'A49 有一条不是');
t('S05 ZERO49 有一条多塞一个字段（那条期望 0 的正向对照等于没有）', [['tools/verify.js',
  "['me.html', 'b.ts - a.ts',\n", "['me.html', 'b.ts - a.ts', 'zz',\n"]],
  'ZERO49 有一条不是');
t('S06 A49 登记了本节没读的文件（锚等于没跑）', [['tools/verify.js',
  "['search.html', 'travel-map.html?id=', 1,", "['wishlist.html', 'travel-map.html?id=', 1,"]],
  '登记了 §49 没读的文件');
t('S07 ZERO49 的正向对照失效（那个 0 就不是证据：对照串里读不到 needle）', [['tools/verify.js',
  '"    var recent = notes.slice().sort(function(a,b){ return b.ts - a.ts; }).slice(0,4);"',
  '"    var recent = notes.slice().sort(function(a,b){ return (b.ts||0) - (a.ts||0); }).slice(0,4);"']],
  '正向对照失效了');
t('S08 缩略图登记表把 review 抬成 2（现场读 1 也算对，表自己说谎时没人管）', [['tools/verify.js',
  "'story.html': 1, 'travel-map.html': 1, 'travel-notes.js': 2 };",
  "'story.html': 1, 'travel-map.html': 1, 'travel-notes.js': 3 };"]],
  '实得 2／登记 3');
t('S09 两视图对账的条件取反（干净树当场红并印出消息，证这一支活着；原样摘掉不会独红——逐文件计数对账也会抓到同一条注释）', [['tools/verify.js',
  "    if (var49.em !== var49.emFlat)", "    if (var49.em === var49.emFlat)"]],
  '缩略图分母在两个视图里不一致');
t('S10 行级出口那一档的过关数判据挪成「读到 0 处也算过」的反面（干净树当场红：rowExit=1 > 0）', [['tools/verify.js',
  'if (var49.rowExit !== 1)', 'if (var49.rowExit > 0)']],
  '靠「行级出口」这一档过关的缩略图现在读到');
t('S11 行级出口的例外串换成树上没有的（例外要求本文件里真读得到那行的行处理器）', [['tools/verify.js',
  "const ROWEX49 = { 'md-manager.html': 'it.onclick = function () { openDetail(n); };' };",
  "const ROWEX49 = { 'md-manager.html': 'it.onclick = function () { openDetailOther(n); };' };"]],
  '在拼缩略图，但它和它下面三行里没有四个出口档位里的任何一个');
t('S12 data-go 登记表把 me 的 read 挪低一格（发出与读取不再同源）', [['tools/verify.js',
  "const REG49B = { 'me.html': { emit: 1, read: 2 }, 'search.html': { emit: 3, read: 2 } };",
  "const REG49B = { 'me.html': { emit: 1, read: 1 }, 'search.html': { emit: 3, read: 2 } };"]],
  '登记 {"emit":1,"read":1}');
t('S13 段两头的查找串换掉（读不到 locateDeepNote 那一段时，③ 的所有计数都不作数）', [['tools/verify.js',
  "const s49 = raw49.findIndex(L => L.indexOf('function locateDeepNote(){') >= 0);",
  "const s49 = raw49.findIndex(L => L.indexOf('function locateDeepNoteX(){') >= 0);"]],
  '读不到 locateDeepNote 那一段的两头');
t('S14 缩略图那把刀的自校准期望从 2 抬成 3（干净树当场红并印出消息，证的是这一支是活的）', [['tools/verify.js',
  "    if (calN !== 2) F49('缩略图那把刀自校准失准", "    if (calN !== 3) F49('缩略图那把刀自校准失准"]],
  '应读 2，实得 2');
t('S15 data-go 那把刀的自校准第一个期望挪成 0（干净树当场红并印出消息：同一族保险，按 §47/§48 的教训打条件而不是摘句）', [['tools/verify.js',
  "    if ((cnt49(CAL49B, 'data-go=') !== 1) || (cnt49(CAL49B, 'dataset.go') !== 1))",
  "    if ((cnt49(CAL49B, 'data-go=') !== 0) || (cnt49(CAL49B, 'dataset.go') !== 1))"]],
  'data-go 那把刀自校准失准');
t('S16 盘上多一处写在块注释里的「出图形状」（按行读到 10、剥完注释读到 9：两视图必须同源）', [['story.html',
  '  .story-card .sc-pics{display:flex;gap:6px;margin-top:10px;overflow-x:auto}',
  '  .story-card .sc-pics{display:flex;gap:6px;margin-top:10px;overflow-x:auto}\n/* 改前那一版是 n.photos.map(function(p){return \'<img>\';}) —— 有图无出口 */']],
  '缩略图分母在两个视图里不一致');

/* ---------- ③ 浏览器腿脚手架 ---------- */
t('T01 屏档退回 452×995（量的不是用户那块屏，视口外取点那一族就量不出来）', [['tools/smoke-entry.js',
  'const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '必须量用户那块屏');
t('T02 不打 tn_onboarded 标记（首启引导蒙层 z9990 吃掉真鼠标点击，症状酷似「入口没接线」）', [['tools/smoke-entry.js',
  "localStorage.setItem('tn_onboarded', '1');", "localStorage.setItem('tn_onboarded_off', '1');"]],
  '不打这个标记');
t('T03 滚进改成 block:start（缩略图被送到 y=0，中心命中的是吸顶条，那是取点的锅）', [['tools/smoke-entry.js',
  "e.scrollIntoView({ block: 'center' });", "e.scrollIntoView({ block: 'start' });"]],
  '滚进中位而不是起始');
t('T04 摘掉「顶命中读成 null」那半句判据（视口外的 mouse.click 等于没点，上一版就是这么「点过」的）', [['tools/smoke-entry.js',
  "RD.hit !== 'null'", "RD.hit !== 'nothing-here'"]],
  '把「顶命中读成 null');
t('T05 瓦片噪声不再单记（静态 http 环境里在线瓦片注定取不到，混进 errs 就没法分辨真异常）', [['tools/smoke-entry.js',
  "appmaptile", "tileNoiseRenamed"]],
  '瓦片噪声单记');
t('T06 分母不对只 say 不 throw（那条腿会继续把「什么都没量到」写成一片绿）', [['tools/smoke-entry.js',
  "throw new Error('SEED_DENOMINATOR'", "console.log('SEED_DENOMINATOR'"]],
  '分母不对就整腿收摊那一支不在场');
t('T07 条数守卫阈值被挪低（判据少 11 条也算「跑完了」）', [['tools/smoke-entry.js',
  'checks >= 31,', 'checks >= 20,']],
  '条数守卫不在了或阈值被挪');
t('T08 种子写的库名漂掉（产品换了库而腿还写旧库，读到的永远是空态）', [['tools/smoke-entry.js',
  "'gujian-notes'", "'trace-notes-legacy'"]],
  '库名换了而腿还在写旧库');
t('T09 判据 E09 被改名（齐备检按字面 ok(\'E09 逐条数，改名＝这一条从证据链上消失）', [['tools/smoke-entry.js',
  "ok('E09 ", "ok('E09b "]],
  '里 E09 这条判据');
t('T10 判据 E24 被改名（它问的是「那一格滚进视口后顶命中读不读得到东西」）', [['tools/smoke-entry.js',
  "ok('E24 ", "ok('E24b "]],
  'E24 不在场');
t('T11 判据 E32 被改名（腿是顺序跑的，抛在中间＝后面的判据一条都没执行）', [['tools/smoke-entry.js',
  "ok('E32 ", "ok('E32b "]],
  'E32（两条腿跑完没有抛出）不在场');
t('T12 齐备检循环上限收窄一格（E31 从此没人守，而且它自己永远不会红）', [['tools/verify.js',
  "    for (let i = 1; i <= 31; i++) {\n      const lab = \"ok('E\"",
  "    for (let i = 1; i <= 30; i++) {\n      const lab = \"ok('E\""]],
  '循环上限是 30');
tAll('T13 README 抹掉 §49 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§49', '§4Y', '的 verify 清单没提 §49');
tAll('T14 README 抹掉这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-entry', 'smoke-leg-off', '没登记 tools/smoke-entry.js');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 深链落点从 z13 退成 z10（§49 钉的是 `.flyTo(` 恰一处与三档回执，不是那个 13；「已放大」这件事只有中心读数知道）——期望红在 E14',
  [['travel-map.html',
    '  if(map&&map.flyTo) map.flyTo(gxy(nn.lat,nn.lng),Math.max(map.getZoom(),13),{duration:.8});',
    '  if(map&&map.flyTo) map.flyTo(gxy(nn.lat,nn.lng),Math.max(map.getZoom(),10),{duration:.8});']],
  'E14');
gBoth('U02 44 那条之后再补一条 32（A49 读到的仍是那一行原文，屏上却被后一条压回低值钮）——期望红在 E09',
  [['design.css', '#meRecent .rec{min-height:44px}', '#meRecent .rec{min-height:44px}\n#meRecent .rec{min-height:32px}']],
  'E09');
gBoth('U03 页内全屏层建出来却不把 img 挂上去（锚钉的是 markup 里那枚 onclick，函数体里少一行它读不出来）——期望红在 E23',
  [['travel-map.html', '  m.appendChild(img);\n  m.onclick=function(){ m.remove(); };', '  m.onclick=function(){ m.remove(); };']],
  'E23');
gBoth('U04 album-edit 选择器那一行只收选择器不回传（album-edit.html 压根不在 §49 的读表里；「点了这一行到底落到编辑稿没有」只有真点知道）——期望红在 E29',
  [['album-edit.html',
    "      it.onclick = function () {\n        var n = null;\n        for (var i = 0; i < notes.length; i++) if (notes[i].id === it.dataset.id) { n = notes[i]; break; }\n        pk.close(); cb(n);\n      };",
    "      it.onclick = function () { pk.close(); };"]],
  'E29');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    if (!c.edits || !c.edits.length) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：没有 edits'); bad++; return; }
    c.edits.forEach(ed => {
      const f = ed[0], from = ed[1], to = ed[2];
      if (typeof from !== 'string' || typeof to !== 'string') {
        console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 的 from/to 不是串（' + typeof from + '/' + typeof to + '）');
        bad++; return;
      }
      if (from === to) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：from 与 to 相同（恒等变异，打不红）'); bad++; return; }
      if (ORIG[f] === undefined) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：文件 ' + f + ' 不在快照里'); bad++; return; }
      const src = eol(from, f);
      const hits = ORIG[f].split(src).length - 1;
      if (c.kind === 'all') { if (!hits) { console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 在 ' + f + ' 一次都没命中（抹登记那一族要的是「全部出现」）'); bad++; } }
      else if (hits !== 1) {
        console.log('预检 FAIL ' + c.name.slice(0, 34) + ' 在 ' + f + ' 命中 ' + hits + ' 次（要恰 1 次）：「' + from.slice(0, 46) + '」');
        bad++;
      }
    });
  });
  return bad;
}
const PBF = preflight();
console.log('=== mut-verify49 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['story.html',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, ['tools/smoke-entry.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}
const S49 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §49') === 0);
const B49 = o => String(o).split('\n').filter(l => /^FAIL\s+E\d/.test(l));

const vbase = runVerify(), f0 = S49(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §49 已经有 ' + f0.length + ' 条红或整跑不绿，先修基准\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§49 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM49 = String(vbase.out).split('\n').filter(l => l.indexOf('入口接线与深链回执闸门:') === 0)[0] || '';
const LEN49 = (SUM49.match(/A49 表长 (\d+) 条、ZERO49 表长 (\d+) 条/) || []).slice(1);
if (LEN49.join('/') !== '34/8') { console.log('中止：基准摘要里的表长是 ' + LEN49.join('/') + '，而本网登记的是 A49 34／ZERO49 8——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A49 表长 ' + LEN49[0] + '／ZERO49 表长 ' + LEN49[1] + '，与本网登记一致）');
const sbase = runSmoke(), c0 = B49(sbase.out);
if (c0.length || !sbase.green) { console.log('中止：基准 smoke-entry 已经有 ' + c0.length + ' 条红或整跑不绿，先修基准\n' + c0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 smoke-entry 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS  E') >= 0).length + ' 条）');

/* ============ 逐条打靶 ============ */
const ONLY = (process.env.MUT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
let okRed = 0, okSilent = 0, weird = 0, skipped = 0;
CASES.forEach(c => {
  if (ONLY.length && !ONLY.some(k => c.name.indexOf(k) === 0)) { skipped++; return; }
  try {
    c.edits.forEach(ed => {
      const f = ed[0], src = eol(ed[1], f), tgt = eol(ed[2], f);
      const p = path.join(ROOT, f);
      let text = fs.readFileSync(p, 'utf8');
      if (c.kind === 'all') text = text.split(src).join(tgt);
      else {
        if (text.split(src).length - 1 !== 1) throw new Error('运行时命中数变了：' + f);
        text = text.split(src).join(tgt);
      }
      fs.writeFileSync(p, text);
    });
  } catch (e) {
    weird++; console.log('异常 ' + c.name.slice(0, 40) + '  → 打靶本身失败：' + e.message); restore(); return;
  }
  const vr = runVerify();
  const reds = S49(vr.out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B49(sm.out);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，浏览器腿红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §49 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify49: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-entry，它按固定文件名落读数 tools/out/b34-smoke-entry.txt；跑完要在干净树上复跑一次这条腿并把读数盖回去。');
process.exit(weird ? 1 : 0);
