/* tools/out/mut-verify53.js — verify.js §53「图册落后同步与叙事地图全程可见闸门」变异自测 · 源码腿 + 两条浏览器腿
 *
 * 用户报（逐字，2026-10-11）：「我去了大同和太原，旅行图册只显示大同。旅程叙事上面的地图要展示什么？」
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §53 红**里看见它，
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一节为什么格外需要这张网：它守的是两件屏上的事——「封面上有没有那座被抹掉的城」与
 * 「进屏那一眼地图给的是全貌还是一个点」。源码锚钉得住串的在场与计数的相等，钉不住
 * 「点下去之后册子到底动了没有」「翻页时地图有没有自己飞走」，所以 ④ 那一族把
 * 「源码腿全绿而浏览器腿指名红」专门列成一类：那一类靶子证明的是这两条腿在量代码量不到的东西。
 *
 * §53 的靶子分四类：
 *   ① 产品形状被拆回原样（R01–R46）：书名那三档（并列上限／全空兜底／按城还是按景点）／恒空副题／
 *      插页标记与三认法／两点画不出那一档／倒着 splice／统计不重算／手改保护／章节名单与引用切片／
 *      落后检测与导出的四个出口／浮条那句带不带篇数／接线／aria-live／回执／44 地板／1200 档／
 *      编辑器改名即标手改／添加地图走单点／叙事侧 skipped 计数／取景退化 bounds／单站档／
 *      跨城那一段的诚实线／两族语法／三档标记大小／initial／只平移不改 zoom／进屏顺序／字号阶梯。
 *   ② 守卫自己（S01–S34）：两把共享剥刀各自的定义行、盲区哨兵、A53／ZERO53 四元组形状、
 *      登记了没读的文件、ZERO53 的正向对照失效、四把内置扫描各自的自校准与阈值（一律打**条件取反／抬阈值**，
 *      不打「摘掉那一支」——干净树上它们本来静默，摘掉不会独红）、④ 的循环上限与最大编号对账。
 *   ③ 两条腿与登记（T01–T14）：屏档、tn_onboarded、真鼠标点入口、条数守卫两条、SVG path 读数、
 *      dasharray 读数、判据改名两条、coverTitle 直调那一枚、README 三处登记被抹。
 *   ④ 两条腿的分工样本（U01–U05：源码腿必须全绿，浏览器腿必须红在指名那条）：
 *      U01 合并后不再补路线插页（A53 钉的是 routeChapter 的导出与「少于两点回 null」，钉不住有没有人真的把它塞回册子）→ A15 红；
 *      U02 render 末尾不再挂落后检测（那一句 `Album.pendingNotes(` 还在、还在被调用，只是没人调 checkPending）→ A04 红；
 *      U03 旧册代理匹配的分组键对不上（章盖不上名单＝整本被当成没入册）→ A22 红；
 *      U04 底部条那句不再以「第 N / M 站」开头（§53 没锚这句文案，只锚了 keepInView 与 zoom 那一族）→ S08 红；
 *      U05 进屏取景只吃第一站（fitBounds 的本体、退化 bounds 判据、padding 全在原处）→ S06 红。
 *   为什么必须有 ④：本节的立论是「落后要看得见且有一个出口」与「地图进屏就给全貌」，
 *      源码腿读的是串的在场、计数的相等、函数体的形状，读不到「那一下点下去册子动了几章」与
 *      「视野里究竟框住了几座城」。
 *
 * 登记一条本网不假装覆盖的盲区：把 A53／ZERO53 表里**整条锚删掉**不会红——§53 没有表长守卫
 *   （网自己在基准处对账摘要行的「A53 表长 69 条、ZERO53 表长 11 族」，删一条锚那行会变成 68/11，
 *   但这个数只印在日志里、不进退出码）。所以要砍锚得连产品串一起砍（R 类各条覆盖了这一支）。
 *
 * 登记第二条设计内盲区（与 §47/§48/§49/§50/§51 同因）：四把内置扫描各自的**自校准那一支**、
 *   ④ 的 `if (!LAB.length)` 那一支，原样摘掉都不会红——干净树上它们本来就是静默的。
 *   所以 S09/S10/S15/S18/S19/S21/S24/S27/S28/S32/S34 打的是条件取反与阈值抬高一格，
 *   证的是「这一支是活的、消息能落地」，而不是「摘掉有人报」。
 *
 * 记一条 token 口径：verify.js 印 A53/ZERO53 的红时 needle 只写前 52／48 字，所以 token 一律取
 *   why／reason 里的一段，或取自定义消息的整句片段；本网没有一条 token 跨在 slice 边界上。
 *   期望值类的 token（S11/S12/S16/S17/S19/S20/S22/S23/S24/S27/S28/S29）一律**从当场打印的那条红行里抄**，
 *   不抄「我以为它会说的那句」——§51 首跑那一族（甲）就是因为反着抄才误判成打不红。
 *
 * 首跑读数：98 条 → 红对 88／静默对 5／异常 5（归档 tools/out/b38-mut-verify53-run1.txt）。
 *   那 5 条异常不是抄错 token，是两条真缺陷，都已改在产品侧而不是改网：
 *   ① S16/S17/S19（drawRoute 那一族的三个期望）：红字里的「期望 N」是**再抄一遍的字面量**，
 *      变异把条件里的期望抬高一格，红行照样印旧期望——闸门在说谎（同一族坑 §50 的 S16 已经记过一次，
 *      当时那句 netHint 的分支数就是因此改成 ARMS50 单点）。改法：EXP53R 一张常量表，条件与文案同源。
 *      顺带把 legCalls 那一枚也并进同一条纪律（LEG_MIN53），因为它红字里写死的「没有一处」在
 *      现场 7 枚时本身就是假话（S09 抬下界时暴露）。
 *   ② S09 与 T11 打的不是退化：腿里 Album.coverTitle( 现场读 **7** 枚，「下界从 1 抬到 2」与
 *      「只摘掉其中 2 枚」都不构成「这一枚守卫失效」，干净树上自然不红（＝网自己没牙，不是闸门没牙）。
 *      数错成 5 枚是因为 `grep -c` 数的是**行**而不是**枚**（有两行各坐着两枚调用）——判「摘干净」一律用整文件改名。
 *      改法：S09 抬到 9（高于现场任何可能读数），T11 改成整文件改名（7 枚全摘，导出面那枚真成孤儿）。
 *   ③ 新增 S34：既然 intra／cross 那一支也进了同源常量表，就给它配自己的变异，别留一条没人测的常量。
 *
 * 改完后的终局读数：**99 条靶子 → 红对 94／设计内静默对 5／异常 0**（`tools/out/b38-mut-verify53.txt`；
 *   6 条局部复打那份是 `tools/out/b38-mut-verify53-patch2.txt`，全 OK／跳过 93）。
 *   跑完按纪律在干净树上复跑了两条腿并把固定名读数盖回（A32〔实际执行 32 条〕／S20〔实际执行 20 条〕，
 *   均 `=== 全部通过 ===`），再复跑 `node tools/verify.js` 全绿。
 *   复跑读数见本文件末尾那一行摘要（以 tools/out/b38-mut-verify53.txt 为准）。
 *
 * 用法:
 *   node tools/out/mut-verify53.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify53.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify53.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b38-mut-verify53.txt node tools/out/mut-verify53.js
 * **不要与别的变异网或像素基线并行**：本网动的是 album.js／album.html／album-edit.html／story.html／
 *   tools/smoke-album-sync.js／tools/smoke-story-map.js／tools/verify.js／README.md，
 *   与 mut-verify45/46/47/48/49/50/51 重叠 tools/verify.js 与 README.md（51 还重叠 album.js）；
 *   像素基线量的就是同一批屏（图册屏与叙事屏都在 109 态里）。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U 类会重跑这两条腿（它们自己把读数落到固定名 tools/out/b38-smoke-album-sync.txt 与
 *   tools/out/b38-smoke-story-map.txt），所以跑完要在干净树上**两条腿各复跑一次**，把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：单点模块（tools/mut-lock.js）。认所有 .mut*.lock，不认自己那一个名字。 */
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut53.lock');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['album.js', 'album.html', 'album-edit.html', 'story.html',
  'tools/smoke-album-sync.js', 'tools/smoke-story-map.js', 'tools/verify.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上 */
const FP = [
  ['tools/verify.js', 'const flat53 = s => ws53(stripBlockComments(s));'],
  ['tools/verify.js', 'const LEGS53 = ['],
  ['tools/verify.js', `['tools/smoke-story-map.js', 'S', 19, "ok('S20'"]`],
  ['tools/verify.js', 'const WANT53 = '],
  ['album.js', 'function mergeIntoAlbum(album, notes) {'],
  ['album.js', 'function coverTitle(notes) {'],
  ['album.html', `id="alPending"`],
  ['album-edit.html', 'var plate = Album.routeChapter(located);'],
  ['story.html', 'function drawRoute(upto){'],
  ['tools/smoke-album-sync.js', "ok('A32'"],
  ['tools/smoke-story-map.js', "ok('S20'"],
  ['README.md', '§53'],
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
function gBoth(name, edits, leg, want) { CASES.push({ name, edits, want, leg, kind: 'silentB' }); }

/* ---------- ① 产品形状被拆回原样：album.js ---------- */
t('R01 封面并列上限抬到三座（书名走 clamp(46px,13vw,64px)，328 宽里三行会把封面撑破）', [['album.js',
  'var CITY_MAX = 2;', 'var CITY_MAX = 3;']],
  '封面最多并列两座');
t('R02 city/province 全空时退回拿第一个景点名当书名（用户实测到的那句「云冈石窟」）', [['album.js',
  "if (!pool.length) return { title: '我的旅行', subtitle: '' };",
  "if (!pool.length) return { title: (notes[0] && notes[0].siteName) || '我的旅行', subtitle: '' };"]],
  '景点名不是书名');
t('R03 按城去重退回按景点去重（一座城三篇就成了三个「城」，书名与副题一起说谎）', [['album.js',
  "var cities = uniq('city'), provs = uniq('province');",
  "var cities = uniq('siteName'), provs = uniq('province');"]],
  '按城去重、城缺了才退到省');
t('R04 副题退回恒空（改前那一块屏永远是死的，多城旅程也没有任何地方说「还有别的城」）', [['album.js',
  "subtitle: pool.length > 1 ? pool.length + ' 座' + unit + ' · ' + notes.length + ' 段记忆' : ''",
  "subtitle: '',"]],
  '封面副题回到恒空');
t('R05 新插页不再带标记（合并时下一轮认不出自己上一轮生成的那枚，册子里叠出两张路线页）', [['album.js',
  'isRoutePlate: true,', 'isRoutePlate: false,']],
  '认不出自己上一轮生成的那枚');
t('R06 三认法少了标题那一支（旧编辑器手拼的那枚认不出，合并后留两张路线页）', [['album.js',
  "(ch.title || '').trim() === '我们的路线';", "(ch.title || '').trim() === '路线';"]],
  '三认法缺一不可');
t('R07 少于两点也照样生成插页（画不出的那张空页没人解释，调用方那一句「为什么没画」也永远不会说）', [['album.js',
  'if (pts.length < 2) return null;', 'if (pts.length < 1) return null;']],
  '让调用方去说');
t('R08 摘旧插页那一圈改成正着走（splice 一错位就漏摘一枚，两枚并存在同一本册里）', [['album.js',
  'for (var i = chs.length - 1; i >= 0; i--) { if (routePlate(chs[i])) chs.splice(i, 1); }',
  'for (var i = 0; i < chs.length; i++) { if (routePlate(chs[i])) chs.splice(i, 1); }']],
  '倒着走是为了 splice 不错位');
t('R09 追加章节却不重算统计（封面那三枚数字永远停在旧旅程上）', [['album.js',
  'album.stats = summarize(notes);', 'album.stats = album.stats;']],
  '永远停在旧旅程上');
t('R10 手改保护摘掉（用户自己起的书名会被下一批新游记重算盖掉——这是「不静默覆盖用户编辑」唯一的守卫）', [['album.js',
  'if (album.coverAuto !== false) {', 'if (true) {']],
  '不静默覆盖用户编辑');
t('R11 自动章节丢掉 member 名单（那篇游记在落后检测里永远算「没入册」，点一次「加进来」就多一章重复内容）', [['album.js',
  'noteIds: sorted.map(function (n) { return n.id; }),', 'memberIdsX: 0,']],
  '落后检测的分母就是它');
t('R12 没有落后也不动册子这一档摘掉（每进一次图册都重写一遍库，半途的册子也会被写进去）', [['album.js',
  'if (!album || !pending.length) return { album: album, added: 0, chapters: [] };',
  'if (!album) return { album: album, added: 0, chapters: [] };']],
  '没落后不动这册');
t('R13 代理匹配不再挡已有名单的章（已经核对过的章会被标题匹配改写，覆盖语义从此不确定）', [['album.js',
  'if (routePlate(ch) || (ch.noteIds && ch.noteIds.length)) return;', 'if (routePlate(ch)) return;']],
  '不许被代理匹配改写');
t('R14 盖进去的是数组引用而不是切片（库里那份与内存那份共享一个数组，改一处动两处）', [['album.js',
  'if (ids && ids.length) ch.noteIds = ids.slice();', 'if (ids && ids.length) ch.noteIds = ids;']],
  '不把笔记数组的引用漏进册子');
t('R15 没有册子也照样谈「落后」（空库走 autoCreate 那一条路，这条提示会在还没有书的时候先说话）', [['album.js',
  'if (!album || !album.chapters) return [];', 'if (!album) return [];']],
  '不该弹这条提示');
t('R16 落后检测的入口从导出面摘掉（页面那条腿从此拿不到它，album.js 里的代码看着还是齐的）', [['album.js',
  'pendingNotes: pendingNotes,', 'pendingNotesX: pendingNotes,']],
  '导出了没人调');

/* ---------- ① 产品形状被拆回原样：album.html ---------- */
t('R17 那颗「加进来」摘线（§49 那一族就是「屏上能看不能点」，浮条说了等于没说）', [['album.html',
  `document.getElementById('alPendingAdd').onclick = addPending;`,
  `document.getElementById('alPendingAddX').onclick = addPending;`]],
  '新入口先问一句谁给它挂了事件');
t('R18 「本次先不」这一档没了落点（用户关掉浮条后每次 render 又弹回来，只能二选一：被唠叨或被强加）', [['album.html',
  'var pend = (ALBUM && !_pendingHid) ? Album.pendingNotes(ALBUM, liveNotes()) : [];',
  'var pend = ALBUM ? Album.pendingNotes(ALBUM, liveNotes()) : [];']],
  '检测挂在每次 render 之后');
t('R19 没加成果也照样保存（会把一份半途的册子写进库里）', [['album.html',
  'if (!r.added) { checkPending(); return; }', 'if (!r.added) return;']],
  '否则会把一份半途的册子写进库里');
t('R20 存失败就不再重绘（屏上白点一下，用户以为什么都没发生）', [['album.html',
  'Album.save(r.album).then(function (saved) { render(saved); }, function () { render(r.album); });',
  'Album.save(r.album).then(function (saved) { render(saved); });']],
  '存失败也重绘');
t('R21 落后这件事不再走 aria-live（状态变更对读屏的人不存在）', [['album.html',
  `<div class="al-pending" id="alPending" role="status" aria-live="polite">`,
  `<div class="al-pending" id="alPending" role="status">`]],
  'aria-live');
t('R22 游记退回页面进屏时那一份缓存（写完游记再进图册，条子数的还是旧篇数）', [['album.html',
  'function liveNotes() { return window.TravelNotes ? TravelNotes.list() : []; }',
  'function liveNotes() { return window.TravelNotes ? TravelNotes.bootList : []; }']],
  '当场读数');
t('R23 点完不给回执（或回执不说加了几篇）', [['album.html',
  `toast('已加入 ' + r.added + ' 篇游记');`, `toast('已加入');`]],
  '回执说加了几篇');
t('R24 那句话退回不带篇数（只说「有新游记」等于让人自己去数）', [['album.html',
  `document.getElementById('alPendingText').textContent = '还有 ' + pend.length + ' 篇新游记没进这本册';`,
  `document.getElementById('alPendingText').textContent = '还有新游记没进这本册';`]],
  '这句话必须带篇数');
t('R25 动作钮改了名（只说「还有 N 篇没进来」而不给出口，是审核报告里「把没做的说成做不了」最小的复发形态）', [['album.html',
  '>加进来</button>', '>加入</button>']],
  '那颗动作钮不在场');

/* ---------- ① 产品形状被拆回原样：album-edit.html ---------- */
t('R26 改名不再标「这台册子自己定的」（下一批新游记进来时书名被重算盖掉）', [['album-edit.html',
  'album.title = this.value.trim(); album.coverAuto = false;', 'album.title = this.value.trim();']],
  '这台册子自己定的');
t('R27 编辑器生成的章不带名单（同一篇会被重复追加成两章）', [['album-edit.html',
  'noteIds: [n.id],', 'memberIdsX: [n.id],']],
  '会被重复追加');
t('R28 那颗「添加地图」绕开单点（第二处就地手拼插页，没有 isRoutePlate，也没有「少于两点画不出」那一档）', [['album-edit.html',
  'var plate = Album.routeChapter(located);', 'var plate = Album.routeChapterX(located);']],
  '编辑器走单点生成');
t('R29 画不出来时静默不响应', [['album-edit.html',
  `if (!plate) { toast('至少要两篇带位置的游记，路线才画得出来'); return; }`, 'if (!plate) return;']],
  '不是静默不响应');

/* ---------- ① 产品形状被拆回原样：story.html ---------- */
t('R30 过滤条件写成只查 lat（lng 缺了也算有位置，卡片与地图的点数从此不一致）', [['story.html',
  'var withLoc=notes.filter(function(n){return n.lat!=null&&n.lng!=null;});',
  'var withLoc=notes.filter(function(n){return n.lat!=null;});']],
  '过滤只写一次');
t('R31 没坐标的篇数不再单记一笔（改前是静默 filter，用户只会以为「丢了」）', [['story.html',
  'var skipped=notes.length-withLoc.length;', 'var skipped=0;']],
  '只会以为「丢了」');
t('R32 零站那一路摘掉（Leaflet 收到空集：整页报错还是白地图取决于库的心情）', [['story.html',
  'if(!pts.length) return;', 'if(pts.length<0) return;']],
  '喂空数组');
t('R33 退化 bounds 保护摘掉（站与站重合时 fitBounds 一路顶到最大缩放档，屏上只剩一个点占满全屏）', [['story.html',
  'if(pts.length>1 && b.getNorth()!==b.getSouth() && b.getEast()!==b.getWest()) map.fitBounds(b,{padding:[30,30]});',
  'if(pts.length>1) map.fitBounds(b,{padding:[30,30]});']],
  '顶到最大缩放档');
t('R34 单站退回顶到最大档', [['story.html',
  'else map.setView(pts[0],10);', 'else map.setView(pts[0],18);']],
  '不是最大档');
t('R35 跨城那一段一律画成「走过的路」（诚实线那一行自己没了：城与城之间的直线不是用户走过的）', [['story.html',
  `var same=placeKey(cards[k-1])!=='' && placeKey(cards[k-1])===placeKey(cards[k]);`, 'var same=true;']],
  '那条诚实线');
t('R36 城内那一族的颜色被换掉（两族语法合成一族的前一步）', [['story.html',
  `? {color:'#AE5738',weight:done?3:2,opacity:done?.6:.22,dashArray:done?null:'6 6',lineCap:'round'}`,
  `? {color:'#B6603F',weight:done?3:2,opacity:done?.6:.22,dashArray:done?null:'6 6',lineCap:'round'}`]],
  '城内一族');
t('R37 跨城那一族的颜色被换掉（有人又开始按距离编颜色）', [['story.html',
  `: {color:'#9C9A92',weight:done?2:1.5,opacity:done?.45:.28,dashArray:'2 7',lineCap:'round'};`,
  `: {color:'#8A8880',weight:done?2:1.5,opacity:done?.45:.28,dashArray:'2 7',lineCap:'round'};`]],
  '跨城一族');
t('R38 标记大小退回两档（未讲到的与讲到过的看起来一样）', [['story.html',
  'var sz=cur?16:(past?10:8),', 'var sz=cur?16:8,']],
  '分三档');
t('R39 setActive 丢掉 initial 参数（进屏那一次也会走 keepInView，与紧随其后的 fitBounds 抢视野）', [['story.html',
  'function setActive(i,initial){', 'function setActive(i){']],
  '进屏那一次也会走 keepInView');
t('R40 进屏那一次也平移（取景刚做完又被推一下，看着像在飘）', [['story.html',
  'if(!initial) keepInView(gxy(n.lat,n.lng));', 'keepInView(gxy(n.lat,n.lng));']],
  'zoom 恒不动');
t('R41 已在视野内也照样挪（每翻一页轻推一下地图）', [['story.html',
  'if(map.getBounds().pad(-0.05).contains(ll)) return;', 'if(false) return;']],
  '已在视野内一步都不动');
t('R42 平移退回飞站（缩放档被抬起来，另一座城直接从视野里消失）', [['story.html',
  'map.panTo(ll,{duration:.5});', 'map.flyTo(ll,{duration:.5});']],
  '要挪就挪，不改缩放档');
t('R43 进屏顺序反过来（先取景再落站＝取景之后又飞一次；树上这两句各占一行，锚在 flat 视图里是折叠成一句的）', [['story.html',
  '  setActive(0,true);\n  fitBounds();', '  fitBounds();\n  setActive(0,true);']],
  '先落到第一站');
t('R44 那句说明退回页内魔法数字（不走字号阶梯）', [['story.html',
  '.sc-skip{margin:8px 4px 0;font-size:var(--fs-3);', '.sc-skip{margin:8px 4px 0;font-size:13px;']],
  '字号阶梯');
t('R45 「算不算同一座城」的口径少了省这一档（city 缺时全部算跨城，两族语法乱成一团）', [['story.html',
  "function placeKey(n){ return n.city || n.province || n.siteName || ''; }",
  "function placeKey(n){ return n.city || n.siteName || ''; }"]],
  '口径单点');
t('R46 行程切分退回吃全量（没坐标的那几篇也进组，卡片数与地图点数不一致的老读数回来）', [['story.html',
  'trips=groupTrips(withLoc);', 'trips=groupTrips(notes);']],
  '吃的是过滤后那一份');

/* ---------- ② 守卫自己：tools/verify.js ---------- */
t('S01 flat53 定义行不再走那把共享剥刀（产品文件头注释里原样抄着改前那几句，不剥就当它们还在）', [['tools/verify.js',
  'const flat53 = s => ws53(stripBlockComments(s));', 'const flat53 = s => ws53(s);']],
  '没走那把共享剥刀');
t('S02 view53 退回「文档也剥注释」那一支（README 登记本批时要写旧函数名，文档侧的锚会当场读 0）', [['tools/verify.js',
  'const view53 = f => /\\.md$/.test(f) ? ws53(rd53(f)) : flat53(rd53(f));',
  'const view53 = f => flat53(rd53(f));']],
  '文档也剥注释');
t('S03 盲区哨兵表里那一枚换成树上没有的串（这一带又变成盲窗，住在里面的期望 0 会静默满足）', [['tools/verify.js',
  `['album.js', 'function coverTitle(notes) {'], ['album.html'`,
  `['album.js', 'function coverTitleX(notes) {'], ['album.html'`]],
  '盲区哨兵');
t('S04 A53 有一条多塞一个字段（四元组形状不整即红，跳过不再静默 return）', [['tools/verify.js',
  `['album.js', 'var CITY_MAX = 2;', 1, '封面最多并列两座`,
  `['album.js', 'var CITY_MAX = 2;', 1, 1, '封面最多并列两座`]],
  'A53 有一条不是');
t('S05 ZERO53 有一条把正向对照写成数字（那条期望 0 的对照等于没有）', [['tools/verify.js',
  `['album.js', 'var title = dominantPlace(all);', '    var title = dominantPlace(all);',`,
  `['album.js', 'var title = dominantPlace(all);', 7,`]],
  'ZERO53 有一条不是');
t('S06 A53 登记了本节没读的文件（锚等于没跑）', [['tools/verify.js',
  `['tools/smoke-story-map.js', 'const VW = 328, VH = 723;', 1, '同上'],`,
  `['wishlist.html', 'const VW = 328, VH = 723;', 1, '同上'],`]],
  '登记了 §53 没读的文件');
t('S07 ZERO53 的正向对照失效（那个 0 就不是证据：对照串里读不到 needle）', [['tools/verify.js',
  `['story.html', 'map.flyTo(', '  map.flyTo(_p,Math.max(map.getZoom(),10),{duration:.7});',`,
  `['story.html', 'map.flyTo(', '  map.panTo(_p,{duration:.7});',`]],
  '正向对照失效');
t('S08 导出面对账里落后检测的期望调用数抬成 2（产品面只剩一处真调用，从此这条永远红或永远不红都说不清）', [['tools/verify.js',
  `['pendingNotes', ['album.html'], 1,`, `['pendingNotes', ['album.html'], 2,`]],
  '在产品面读到 1 处调用（期望 2）');
t('S09 常驻腿直调 coverTitle 的下界从 1 抬到 9（现场明明读到 7 枚也算过＝那一枚守卫是个摆设）', [['tools/verify.js',
  'const LEG_MIN53 = 1;', 'const LEG_MIN53 = 9;']],
  '导出面这一枚就纯是死代码');
t('S10 章节归属那把刀的自校准期望从 2 抬成 3（刀一瞎，下面那几个数全是假的）', [['tools/verify.js',
  'if (calLits.length !== 2 || calWith !== 1)', 'if (calLits.length !== 3 || calWith !== 1)']],
  '章节归属那把刀自校准失准');
t('S11 album.js 带 noteIds 的生成点期望抬到 4（现场读 3 也算对，自动章丢名单没人管）', [['tools/verify.js',
  `const WANT53 = { 'album.js': [3, 0], 'album-edit.html': [1, 2] };`,
  `const WANT53 = { 'album.js': [4, 0], 'album-edit.html': [1, 2] };`]],
  '带 noteIds 的章节生成点是 3 处（期望 4');
t('S12 album-edit.html 不带名单的手工章期望抬到 3（有人新开口造「生成章却不登记名单」没人报）', [['tools/verify.js',
  `const WANT53 = { 'album.js': [3, 0], 'album-edit.html': [1, 2] };`,
  `const WANT53 = { 'album.js': [3, 0], 'album-edit.html': [1, 3] };`]],
  '手工章生成点是 2 处（期望 3');
t('S13 就地造章的兜底扫描把 album 那一族放进白名单外（第四种造章形状不再有人管，noteIds 与 isRoutePlate 会在某一族里静默缺席）', [['tools/verify.js',
  "/^(?!album)(.*\\.(js|html))$/.test(f)", "/^(?!zzz)(.*\\.(js|html))$/.test(f)"]],
  '个产品文件就地造章');
t('S14 drawRoute 两头查找串换掉（③(c) 那一整支当场失明）', [['tools/verify.js',
  "const s53c = raw53c.findIndex(L => L.indexOf('function drawRoute(upto){') >= 0);",
  "const s53c = raw53c.findIndex(L => L.indexOf('function drawRouteX(upto){') >= 0);"]],
  '读不到 drawRoute 的两头');
t('S15 drawRoute 那把尺子的反向自校准期望挪掉（尺子认不出旧写法，下面那几个数就只是尺子在睡）', [['tools/verify.js',
  'if (!(OC.trunc === 1 && OC.cross === 0 && OC.done === 0))', 'if (!(OC.trunc === 0 && OC.cross === 0 && OC.done === 0))']],
  'drawRoute 那把尺子反向自校准失准');
t('S16 覆盖全程的循环期望抬到 3（截断某一族没人管）', [['tools/verify.js',
  'const EXP53R = { poly: 1, full: 2, intra: 1, cross: 1, done: 1 };',
  'const EXP53R = { poly: 1, full: 3, intra: 1, cross: 1, done: 1 };']],
  '覆盖全程的循环是 2 处（期望 3');
t('S17 polyline 单点期望抬到 2（两段各画一次把「讲到／没讲到」分裂成两套样式来源）', [['tools/verify.js',
  'const EXP53R = { poly: 1, full: 2, intra: 1, cross: 1, done: 1 };',
  'const EXP53R = { poly: 2, full: 2, intra: 1, cross: 1, done: 1 };']],
  'L.polyline( 读到 1 处，期望 2');
t('S18 截断那一支的条件取反（干净树读 0 也算对，「进屏 0 段连线」那条成因重新没人守）', [['tools/verify.js',
  'if (R.trunc !== 0)', 'if (R.trunc !== 1)']],
  '这种截断');
t('S19 「讲到哪一档」的判据期望抬到 2（线与点的亮法两处各算一套）', [['tools/verify.js',
  'const EXP53R = { poly: 1, full: 2, intra: 1, cross: 1, done: 1 };',
  'const EXP53R = { poly: 1, full: 2, intra: 1, cross: 1, done: 2 };']],
  'var done=k<=upto; 读到 1 处，期望 2');
t('S34 城内／跨城两族各恰 1 的期望抬到 2（把跨城线并进「走过的路」那一档不再当红）', [['tools/verify.js',
  'const EXP53R = { poly: 1, full: 2, intra: 1, cross: 1, done: 1 };',
  'const EXP53R = { poly: 1, full: 2, intra: 2, cross: 1, done: 1 };']],
  '两族语法各恰 2／1');
t('S20 keepInView 的定义+调用计数抬到 3（只有定义＝没接线那一档从此不算红）', [['tools/verify.js',
  "if (cnt53(V53['story.html'], 'keepInView(') !== 2)", "if (cnt53(V53['story.html'], 'keepInView(') !== 3)"]],
  '定义 + 调用要各 1（现读 2');
t('S21 触控那把刀的自校准期望从 40 挪成 41（读不到数就等于没检查）', [['tools/verify.js',
  "if (px(CAL53D, 'min-height') !== 40)", "if (px(CAL53D, 'min-height') !== 41)"]],
  '触控那把刀自校准失准');
t('S22 「加进来」那颗钮的地板抬到 45（现场读 44 也算对，真正的落地板那一支被挪松）', [['tools/verify.js',
  "if (px(btn, 'min-height') < 44 || px(btn, 'min-width') < 44)", "if (px(btn, 'min-height') < 45 || px(btn, 'min-width') < 45)"]],
  '「加进来」那颗钮掉到 44 地板以下（现读 min-height 44 / min-width 44');
t('S23 浮条关闭钮的地板抬到 45（同上）', [['tools/verify.js',
  "if (px(x, 'width') < 44 || px(x, 'height') < 44)", "if (px(x, 'width') < 45 || px(x, 'height') < 45)"]],
  '浮条上那颗');
t('S24 落后条的 z-index 档挪成 1300（现场读 1200 也算错，这一档就不再是底部固定条那一族的位置）', [['tools/verify.js',
  'if (!zm || Number(zm[1]) !== 1200)', 'if (!zm || Number(zm[1]) !== 1300)']],
  '不是 1200 档（现读 1200');
t('S25 收起态那一支的查找串换掉（一条透明的条横在屏底挡住它下面那颗钮，不再有人报）', [['tools/verify.js',
  "if (bar.indexOf('opacity:0;pointer-events:none') < 0)", "if (bar.indexOf('opacity:0;pointer-events:auto') < 0)"]],
  '一条透明的条横在屏底');
t('S26 展开态那一支的查找串换掉（show 了却点不动不再有人报）', [['tools/verify.js',
  "if (block53('.al-pending.show').indexOf('pointer-events:auto') < 0)", "if (block53('.al-pending.show').indexOf('pointer-events:none') < 0)"]],
  'show 了却点不动');
t('S27 落后文案落点计数抬到 2（两处各写一句、有一句忘了带篇数这件事不当红）', [['tools/verify.js',
  `if (cnt53(CSS53, "' 篇新游记没进这本册'") !== 1)`, `if (cnt53(CSS53, "' 篇新游记没进这本册'") !== 2)`]],
  '落后文案的落点不是恰 1 处（现读 1');
t('S28 动作钮在场计数抬到 2（一枚算过，两枚才算过）', [['tools/verify.js',
  `if (cnt53(CSS53, '>加进来</button>') !== 1)`, `if (cnt53(CSS53, '>加进来</button>') !== 2)`]],
  '那颗动作钮不在场（现读 1');
t('S29 ④ 齐备检给 album-sync 那条腿登记的循环上限收窄一格（A31 从此没人守，而且它自己永远不会红）', [['tools/verify.js',
  `['tools/smoke-album-sync.js', 'A', 31, "ok('A32'"]`, `['tools/smoke-album-sync.js', 'A', 30, "ok('A32'"]`]],
  '登记的循环上限是 30');
t('S30 ④ 条数守卫的查找串挪成不存在的编号（守卫那一支换目标，摘掉它也没人报）', [['tools/verify.js',
  `['tools/smoke-album-sync.js', 'A', 31, "ok('A32'"]`, `['tools/smoke-album-sync.js', 'A', 31, "ok('A33'"]`]],
  '少了最后那条条数守卫');
t('S31 ④ 上限与真实最大编号的对账挪成「等于编号本身」（少守一条判据却自称对过账）', [['tools/verify.js',
  'if (last !== MAXN - 1)', 'if (last !== MAXN)']],
  '真实最大编号是 A32');
t('S32 ④ 那条「一条判据都没数到」的判据取反（这条腿形状变了也不再当场失明）', [['tools/verify.js',
  'if (!LAB.length) F53(', 'if (LAB.length) F53(']],
  '一条 ok() 判据都没数到');
t('S33 ④ 齐备检给 story-map 那条腿登记的循环上限收窄一格（S19 从此没人守）', [['tools/verify.js',
  `['tools/smoke-story-map.js', 'S', 19, "ok('S20'"]`, `['tools/smoke-story-map.js', 'S', 18, "ok('S20'"]`]],
  '登记的循环上限是 18');

/* ---------- ③ 两条腿的脚手架与登记 ---------- */
t('T01 album-sync 屏档退回 452×995（量的不是用户那块屏，「点了动没动」就不是同一件事）', [['tools/smoke-album-sync.js',
  'const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '量的是用户那块屏');
t('T02 album-sync 不打 tn_onboarded 标记（首启蒙层 z9990 吃掉真鼠标点击，症状酷似「浮条没接线」）', [['tools/smoke-album-sync.js',
  `localStorage.setItem('tn_onboarded', '1');`, `localStorage.setItem('tn_onboarded_off', '1');`]],
  '首启蒙层会吃掉真鼠标点击');
tAll('T03 album-sync 那两处真鼠标点击被改名（直调 addPending() 就测不到接线在不在，两本册也只剩一本）', 'tools/smoke-album-sync.js',
  `page.click('#alPendingAdd');`, `page.click('#alPendingAddX');`, '由真鼠标点出来');
t('T04 album-sync 条数守卫阈值挪低（判据少 30 条也算「跑完了」）', [['tools/smoke-album-sync.js',
  'total >= 32,', 'total >= 2,']],
  '最后那条守卫自己不算进 32');
t('T05 story-map 条数守卫阈值挪低（同上：中途抛了＝后面判据一条没执行，那种「全绿」是空转出来的）', [['tools/smoke-story-map.js',
  'total >= 20,', 'total >= 2,']],
  '那种「全绿」是空转出来的');
t('T06 story-map 屏档退回 452×995（视野里框住几座城与屏宽直接相关）', [['tools/smoke-story-map.js',
  'const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '同上');
t('T07 story-map 连线读数改打一个不存在的类（读回来的永远是空集，「进屏 0 段线」那条老成因重新量不到）', [['tools/smoke-story-map.js',
  `document.querySelectorAll('#storyMap path.leaflet-interactive')`,
  `document.querySelectorAll('#storyMap path.leaflet-XYZ')`]],
  '真渲染出来的 SVG path');
t('T08 story-map 的虚实读数改看 stroke-width（实线与淡虚线在 DOM 层再也分不开）', [['tools/smoke-story-map.js',
  `getAttribute('stroke-dasharray')`, `getAttribute('stroke-width')`]],
  '在 DOM 层分得开');
t('T09 album-sync 判据 A21 被改名（齐备检按字面 ok(\'A21 逐条数，改名＝这一条从证据链上消失）', [['tools/smoke-album-sync.js',
  `ok('A21', '关掉是「这一次」`, `ok('A21b', '关掉是「这一次」`]],
  '里 A21 这条判据不是恰 1 处');
t('T10 story-map 判据 S11 被改名（这条腿自己也是会被删的）', [['tools/smoke-story-map.js',
  `ok('S11', '讲到第二站`, `ok('S11b', '讲到第二站`]],
  '里 S11 这条判据不是恰 1 处');
tAll('T11 album-sync 里 coverTitle 的全部直调摘掉（现场 7 枚只摘 2 枚不算摘——导出面那枚真没人调时，源码锚必须当场红）', 'tools/smoke-album-sync.js',
  'Album.coverTitle(', 'Album.covTitleGone(', '导出面这一枚就纯是死代码');
tAll('T12 README 抹掉 §53 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§53', '§5Y', '没提 §53');
tAll('T13 README 抹掉图册这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-album-sync', 'smoke-album-synX', '没登记 tools/smoke-album-sync.js');
tAll('T14 README 抹掉叙事这条腿的登记（同上）', 'README.md', 'smoke-story-map', 'smoke-story-mX', '没登记 tools/smoke-story-map.js');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 合并时不再把重算的路线插页塞回册子（A53 钉的是 routeChapter 的导出与「少于两点回 null」，钉不住有没有人真的把它 append 回去）——期望红在 A15',
  [['album.js', 'if (route) album.chapters.push(route);', 'if (false) album.chapters.push(route);']], 'A', 'A15');
gBoth('U02 render 末尾不再挂落后检测（`Album.pendingNotes(` 那一行原样还在、也还在被调用，只是没人再调 checkPending：屏上永远不出条）——期望红在 A04',
  [['album.html',
    "    if (album) bindAudio(document.getElementById('albumRoot'));\n    checkPending();\n  }",
    "    if (album) bindAudio(document.getElementById('albumRoot'));\n    /* 落后检测不再挂在 render 之后 */\n  }"]], 'A', 'A04');
gBoth('U03 旧册代理匹配的分组键对不上（章节标题永远查不到那串名单：整本旧册被当成「一篇没入册」，浮条张口就说 6 篇）——期望红在 A22',
  [['album.js', "var ids = byTitle[(ch.title || '').trim()];", "var ids = byTitle[(ch.title || '').trim() + '·'];"]], 'A', 'A22');
gBoth('U04 底部条那句不再以「第 N / M 站」开头（§53 锚的是 keepInView 与 zoom 那一族，没有一句钉这段文案）——期望红在 S08',
  [['story.html',
    `document.getElementById('snSub').textContent='第 '+(i+1)+' / '+cards.length+' 站 · '+dayClock(n);`,
    `document.getElementById('snSub').textContent='共 '+cards.length+' 站里的第 '+(i+1)+' 站 · '+dayClock(n);`]], 'S', 'S08');
gBoth('U05 进屏取景只吃第一站（fitBounds 本体、退化 bounds 判据、padding 全在原处；「视野里框住两座城」只有真渲染知道）——期望红在 S06',
  [['story.html',
    'var pts=cards.map(function(n){var p=gxy(n.lat,n.lng);return [p[0],p[1]];});',
    'var pts=cards.slice(0,1).map(function(n){var p=gxy(n.lat,n.lng);return [p[0],p[1]];});']], 'S', 'S06');

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
console.log('=== mut-verify53 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['album.js',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：三条腿都得先是绿的，否则后面全是空判 ============ */
function tail2(e) { return '\nTHROW ' + String((e && e.message) || e).slice(0, 200) + '\nSTDERR ' + String((e && e.stderr) || '').split('\n').slice(-6).join('\n'); }
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
function runLeg(script) {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
const runAlbum = () => runLeg('tools/smoke-album-sync.js');
const runStory = () => runLeg('tools/smoke-story-map.js');
const S53 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §53') === 0);
const LEGRED = o => String(o).split('\n').filter(l => /^FAIL  [AS]\d\d\b/.test(l));

const why = r => String(r.out).split('\n').filter(l => l.indexOf('THROW') >= 0 || l.indexOf('STDERR') >= 0).join(' | ') || '(没抓到 THROW 行)';
const vbase = runVerify(), f0 = S53(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §53 有 ' + f0.length + ' 条红；整跑' + (vbase.green ? '绿（那就是 §53 自己红了）' : '不绿，原因：' + why(vbase)) + '\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§53 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM53 = String(vbase.out).split('\n').filter(l => l.indexOf('图册同步与叙事地图闸门:') === 0)[0] || '';
const LEN53 = [(SUM53.match(/闸门: (\d+) 条代码锚点/) || [])[1], (SUM53.match(/\+ (\d+) 族期望 0/) || [])[1]];
if (LEN53.join('/') !== '69/11') { console.log('中止：基准摘要里的表长是 ' + LEN53.join('/') + '，而本网登记的是 A53 69／ZERO53 11——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A53 表长 ' + LEN53[0] + '／ZERO53 表长 ' + LEN53[1] + '，与本网登记一致）');
const abase = runAlbum(), a0 = LEGRED(abase.out);
if (a0.length || !abase.green) {
  console.log('中止：基准 smoke-album-sync 有 ' + a0.length + ' 条红；整跑' + (abase.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(abase)));
  console.log((a0.length ? a0.slice(0, 4).join('\n') : String(abase.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
  process.exit(2);
}
console.log('基准 smoke-album-sync 判据全绿 ✓（' + abase.out.split('\n').filter(l => l.indexOf('PASS  A') >= 0).length + ' 条）');
const sbase = runStory(), s0 = LEGRED(sbase.out);
if (s0.length || !sbase.green) {
  console.log('中止：基准 smoke-story-map 有 ' + s0.length + ' 条红；整跑' + (sbase.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(sbase)));
  console.log((s0.length ? s0.slice(0, 4).join('\n') : String(sbase.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
  process.exit(2);
}
console.log('基准 smoke-story-map 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS  S') >= 0).length + ' 条）');

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
  const reds = S53(vr.out);
  if (c.kind === 'silentB') {
    const sm = c.leg === 'A' ? runAlbum() : runStory(), dd = LEGRED(sm.out);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，' + (c.leg === 'A' ? 'album-sync' : 'story-map') + ' 红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §53 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify53: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过两条腿，它们按固定文件名落读数 tools/out/b38-smoke-album-sync.txt 与 tools/out/b38-smoke-story-map.txt；跑完要在干净树上各复跑一次这两条腿并把读数盖回去。');
process.exit(weird ? 1 : 0);
