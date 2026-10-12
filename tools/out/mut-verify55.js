/* tools/out/mut-verify55.js — verify.js §55「主题别名归一・叙事末站闸门」变异自测 · 源码腿 + 两条浏览器腿
 *
 * 这一节的三条来路都出自「继续推进剩余功能的测试」那一轮复跑分出来的红腿（逐条重量后才定性）：
 *   ① 专题页点主题标签＝整张图变淡、零结果（产品缺陷，topic-common.js 的别名表只作用在景点那一侧）；
 *   ② 叙事翻页到末站，130ms 后被判读抢回倒数第二站（产品缺陷，story.html 的 scroll-spy 取「离带中心最近」）；
 *   ③ 另两条红是腿自己歪：拿 history.length 当「压没压历史」、按文案子串猜 chip。
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §55 红**里看见它，并且整跑不绿
 * （红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 靶子分五类：
 *   R01–R14 产品形状被拆回原样（别名表两侧分家、配置四个字段各自的归一支、chip/图例成对守卫、末站三件读数）；
 *   W01–W06 末站那一档（收口那句摘掉／maxS>4 省掉／整屏读数写回 spy 体内／atEnd 改名／另开通路绕开 lastActive）；
 *   G01–G28 守卫自己（两把剥刀与哨兵、两张四元组形状、没读的文件、正向对照、两个分母、两把自校准、
 *      五条期望 0 取反、④ 的循环上限与真实最大编号对账、名单与现场两个方向的对账）；
 *   T01–T13 两条腿与 README 登记（条数守卫、取样形状、精确匹配、可观测量、判据改名、三处抹登记）；
 *   U01–U03 分工样本（源码腿必须全绿，浏览器腿必须红在指名那条）。
 *
 * 本网登记的不覆盖项一条，拿基准现场证过一次（不当已覆盖）：
 *   甲）基准现场即证据：③(a) 的普查每次都在摘要行印「灰 N 处」，而 N=605 那一发照样全绿。
 *      根因是「这一页的配置压根没声明这个主题」（要补就得给约 20 个主题挑颜色），属设计取舍不属 bug，
 *      所以本网只把它当读数基准（基准摘要里的灰数会打印出来），不配判据。
 *   原来还记着第二条「盲区」：给某一页的配色表加一支本页零景点的主题，说两条腿都不看它。
 *   实测推翻——它红了在浏览器腿的「chip 名单=归一后的 themeOrder」上（themeOrder 由配色表的键自动补全，
 *   而那颗零命中的 chip 被守卫挡掉，于是屏上的颗数比名单短）。已按实跑改成 U03，README 那句登记同步改回。
 *
 * 行尾口径（实测）：topic-common.js／topic-meta.js／story.html／bj-data.js／tools/smoke-nodes.js 是 CRLF；
 *   tools/verify.js／tools/smoke-story-map.js／tools/smoke-irreversible.js／README.md 是 LF。
 *   多行 from 串一律经 eol(s,f) 转成该文件行尾，否则命中 0 会伪装成「锚没线」。
 *
 * 记一条 token 口径（本网自己踩过）：verify.js 印 A55／ZERO55 的红时 needle 只写前 52／48 字，
 *   所以 token 不许跨在 slice 边界上。第一轮 R08 的 token 抄了整条锚（55 字）跨过去了——那一发
 *   明明红在指名那条，却因暗号被切而判成异常；README.md 那两条腿的红字里腿名不带 tools/ 前缀，
 *   T13 也踩过同一个坑。现在 64 条 token 逐条量过长度，且都取红字里独有的片段。
 *   抬阈值类（G09/G10/G12/G20/G23）的期望值取自 A55 表长 27／ZERO55 表长 5 与当前循环上限 20——
 *   基准处先对账摘要里的「27 条／5 族」，表长一变就中止。
 *
 * 用法:
 *   node tools/out/mut-verify55.js --selfcheck      # 只跑内部自测（预检必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify55.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,G23 node tools/out/mut-verify55.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b40-mut-verify55.txt node tools/out/mut-verify55.js
 * **不要与别的变异网或像素基线并行**：本网动的是 topic-common.js／topic-meta.js／story.html／
 *   tools/smoke-nodes.js／tools/smoke-story-map.js／tools/smoke-irreversible.js／tools/verify.js／README.md，
 *   与 mut-verify45/46/47/48/49/50/51/52/53/54 重叠 tools/verify.js 与 README.md；
 *   像素基线 109 态里就有 topic 态与叙事态（U01 那发还会改 chip 的颜色）。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U/B 类会重跑 tools/smoke-nodes.js（它按固定文件名落读数），跑完要在干净树上复跑一次把读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：单点模块（tools/mut-lock.js）。认所有 .mut*.lock，不认自己那一个名字。 */
require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut55.lock');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['topic-common.js', 'topic-meta.js', 'story.html',
  'tools/smoke-nodes.js', 'tools/smoke-story-map.js', 'tools/smoke-irreversible.js',
  'tools/verify.js', 'README.md'];
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
  ['tools/verify.js', 'const flat55 = s => ws55(stripBlockComments(s));'],
  ['tools/verify.js', 'const view55 = f => /\\.md$/.test(f) ? ws55(rd55(f)) : flat55(rd55(f));'],
  ['tools/verify.js', "['tools/smoke-nodes.js', 'total >= 18', 1,"],
  ['tools/verify.js', 'const PAGE_MIN55 = 30, SITE_MIN55 = 7000;'],
  ['tools/verify.js', 'for (let i = 0; i <= 20; i++) {'],
  ['tools/verify.js', "const SEG55 = (rd55('tools/verify.js').split('/* ④ 两条常驻腿的齐备检 */')[1] || '');"],
  ['topic-common.js', 'function canonThemes() {'],
  ['topic-common.js', 'function normTheme(t) {'],
  ['topic-common.js', 'M.themeOrder = order;'],
  ['story.html', 'function atEnd(){'],
  ['tools/smoke-nodes.js', "'var A=window.THEME_ALIAS||{},M=window.TOPIC_META||{},S=window.SITES||[];'"],
  ['tools/smoke-story-map.js', "ok('S20'"],
  ['tools/smoke-irreversible.js', "e1.hstate.indexOf('tnEdit') >= 0"],
  ['README.md', '§55'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 56) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\r\n/g, '\n').replace(/\n/g, EOL(f));

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, edits, token) { CASES.push({ name, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, edits: [[file, from, to]], token, kind: 'all' }); }
function gBoth(name, edits, leg, want) { CASES.push({ name, edits, want, leg, kind: 'silentB' }); }

/* ---------- ① R：产品形状被拆回原样 ---------- */
t('R01 别名表入口空转（normTheme 原样返回，景点那侧与配置那侧永远不同名）',
  [['topic-common.js', `function normTheme(t) { return (window.THEME_ALIAS && window.THEME_ALIAS[t]) || t; }`,
    `function normTheme(t) { return t; }`]],
  'function normTheme(t) { return (window.THEME_ALIAS');
t('R02 景点侧不再归一（tk 直接回原样字段，chip 存的是标准名就永远比不中）',
  [['topic-common.js', `function tk(s) { return normTheme(s[M.themeKey || 'theme']); }`,
    `function tk(s) { return s[M.themeKey || 'theme']; }`]],
  'function tk(s) { return normTheme');
t('R03 取色不再过归一（那一枚景点查不到配色就退灰，正是 ③(a) 要数的那个 0）',
  [['topic-common.js', `function colorOf(s) { return M.themes[tk(s)] || "#7D7970"; }`,
    `function colorOf(s) { return M.themes[s[M.themeKey || 'theme']] || "#7D7970"; }`]],
  'function colorOf(s) { return M.themes[tk');
t('R04 筛选两侧退回不同名（点 chip＝整张图变淡、零结果，就是用户报的那个症状）',
  [['topic-common.js', `if (state.theme && tk(s) !== state.theme) return false;`,
    `if (state.theme && s[M.themeKey || 'theme'] !== state.theme) return false;`]],
  'if (state.theme && tk(s) !== state.theme)');
t('R05 「必去」那一档不再归一（加粗与封印静默失效，改前 34 页次全在这一条上）',
  [['topic-common.js', `function isMajorSite(s) { return (M.majorThemes || []).indexOf(tk(s)) >= 0 || (s.flag && s.flag.indexOf('m') >= 0); }`,
    `function isMajorSite(s) { return (M.majorThemes || []).indexOf(s[M.themeKey || 'theme']) >= 0 || (s.flag && s.flag.indexOf('m') >= 0); }`]],
  'function isMajorSite(s) { return (M.majorThemes ||');
t('R06 canonThemes 定义了不接（init 里那一调用摘掉＝这条修复压根不存在）',
  [['topic-common.js', 'canonThemes();', 'canonThemesX();']],
  'canonThemes();');
t('R07 配色表不归一（chip 圆点、图例点、分组头三处一起查不到色）',
  [['topic-common.js', 'if (M.themes) M.themes = mapKeys(M.themes);', 'if (M.themes) M.themes = M.themes;']],
  'if (M.themes) M.themes = mapKeys(M.themes);');
t('R08 图标表不归一（那一类节点取不到图标：屏幕上不报错，只少一张图）',
  [['topic-common.js', 'if (M.themeIcons) M.themeIcons = mapKeys(M.themeIcons);', 'if (M.themeIcons) M.themeIcons = M.themeIcons;']],
  'M.themeIcons = mapKeys');
t('R09 mapKeys 撞名保第一支改成静默覆盖（别名与标准名同时声明时，后一支把前一支颜色抹掉）',
  [['topic-common.js', `Object.keys(src || {}).forEach(function (t) { var n = normTheme(t); if (out[n] == null) out[n] = src[t]; });`,
    `Object.keys(src || {}).forEach(function (t) { var n = normTheme(t); out[n] = src[t]; });`]],
  'Object.keys(src || {}).forEach(function (t)');
t('R10 标签顺序不去重（同一主题两颗 chip，点其中一颗另一颗也跟着亮）',
  [['topic-common.js', `M.themeOrder.forEach(function (t) { var n = normTheme(t); if (order.indexOf(n) < 0) order.push(n); });`,
    `M.themeOrder.forEach(function (t) { order.push(normTheme(t)); });`]],
  'M.themeOrder.forEach(function (t) { var n');
t('R11 majorThemes 并进 mapKeys（数组走对象支＝把索引当键，这一支整条废掉）',
  [['topic-common.js', `M.majorThemes.forEach(function (t) { var n = normTheme(t); if (mt.indexOf(n) < 0) mt.push(n); });`,
    `M.majorThemes = mapKeys(M.majorThemes);`]],
  'M.majorThemes.forEach(function (t) { var n');
tAll('R12 chip 与图例的存在性守卫两处全摘（零命中那颗点下去＝整张图变淡，用户看不出是筛空还是坏了）',
  'topic-common.js', `if (!SITES.some(function (s) { return tk(s) === th; })) return;`, '',
  'if (!SITES.some(function (s) { return tk(s) === th');
t('R13 只摘 chip 那一处守卫（图例还有、chip 没有＝联动落空，成对判据被拆散）',
  [['topic-common.js', `        if (!SITES.some(function (s) { return tk(s) === th; })) return;\n        var cc = mkChip(th, false, M.themes[th]);`,
    `        var cc = mkChip(th, false, M.themes[th]);`]],
  '必须成对');
t('R14 别名表在配置侧改名（canonThemes 仍在跑但查的是空表：普查的尺子跟着塌，靠自校准当场红）',
  [['topic-meta.js', 'window.THEME_ALIAS = {', 'window.THEME_ALIAS_V2 = {']],
  '③(a) 的归一去重自校准失准');

/* ---------- ② W：叙事末站那一档 ---------- */
t('W01 spy 里的末站收口那句摘掉（末站又被「离带中心最近」判给倒数第二张）',
  [['story.html', 'if(best>=0&&els.length&&atEnd())best=els.length-1;', 'if(best>=0){}']],
  '里没有那一句末站收口');
t('W02 atEnd 的 maxS>4 那一档省掉（内容没超出屏幕时恒真：任何一发判读都被抢给最后一张）',
  [['story.html', 'return maxS>4&&window.scrollY>=maxS-4;', 'return window.scrollY>=maxS-4;']],
  'return maxS>4&&window.scrollY>=maxS-4;');
t('W03 atEnd 不再读整屏高，把 328×723 那一档量出来的数写回代码（换台机器就全错）',
  [['story.html', 'var maxS=document.documentElement.scrollHeight-window.innerHeight;',
    'var maxS=document.documentElement.scrollHeight-723;']],
  'atEnd 没读');
t('W04 把「滚到底」的三件读数写回 scroll-spy 体内（§54 那条「不许拿整屏高度当尺子」当场失明）',
  [['story.html', 'if(best>=0&&els.length&&atEnd())best=els.length-1;',
    'var maxS=document.documentElement.scrollHeight-window.innerHeight;if(best>=0&&maxS>4&&window.scrollY>=maxS-4)best=els.length-1;']],
  '又出现整屏读数');
t('W05 末站另开通路绕开 lastActive（同一发滚轮问两遍，跟批次 39 的「只许问一遍」同源）',
  [['story.html', 'if(best>=0 && best!==lastActive){ lastActive=best; setActive(best); }',
    'if(best>=0){ lastActive=best; setActive(best); }']],
  'if(best>=0 && best!==lastActive)');
t('W06 atEnd 改名（函数体读不到＝③(b) 这一支失明，靠 body55 的 null 那一支当场红）',
  [['story.html', 'function atEnd(){', 'function atEndV2(){']],
  '读不到 story.html 里 atEnd 的函数体');

/* ---------- ③ G：守卫自己 ---------- */
t('G01 本节的 flat55 定义行不走那把共享剥刀（成因注释里原样写着别名旧流程，不剥就当它还在）',
  [['tools/verify.js', 'const flat55 = s => ws55(stripBlockComments(s));', 'const flat55 = s => ws55(s);']],
  '没走那把共享剥刀');
t('G02 view55 的定义行退回「文档也剥注释」（README 登记本批时要写旧写法，文档侧的锚当场读 0）',
  [['tools/verify.js', `const view55 = f => /\\.md$/.test(f) ? ws55(rd55(f)) : flat55(rd55(f));`,
    `const view55 = f => flat55(rd55(f));`]],
  '文档也剥注释');
t('G03 盲区哨兵那一支取反（这一带变成盲窗时它不报，反而在正常时报）',
  [['tools/verify.js', `if (V55[p[0]].indexOf(p[1]) < 0) F55('盲区哨兵`, `if (V55[p[0]].indexOf(p[1]) >= 0) F55('盲区哨兵`]],
  '盲区哨兵');
t('G04 A55 的四元组形状检改字段数（少一字段会解构错位，那条锚等于没跑）',
  [['tools/verify.js', `if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {\n      F55('A55 有一条`,
    `if (!Array.isArray(a) || a.length !== 5 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {\n      F55('A55 有一条`]],
  'A55 有一条不是');
t('G05 ZERO55 的四元组形状检改字段数（少字段会让那条期望 0 的正向对照等于没有）',
  [['tools/verify.js', `if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {\n      F55('ZERO55 有一条`,
    `if (!Array.isArray(a) || a.length !== 5 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {\n      F55('ZERO55 有一条`]],
  'ZERO55 有一条不是');
t('G06 A55 登记了本节没读的文件（那一支锚永远读空串，期望次数却照判）',
  [['tools/verify.js', `['topic-common.js', 'function canonThemes() {', 1,`, `['topic-commo.js', 'function canonThemes() {', 1,`]],
  'A55 登记了 §55 没读的文件');
t('G07 ZERO55 登记了本节没读的文件（正向对照同理读空，那条 0 就不是证据）',
  [['tools/verify.js', `['topic-common.js', '(M.themeOrder || []).forEach(function (th) { var cc = mkChip(th, false, M.themes[th]);',`,
    `['topic-commo.js', '(M.themeOrder || []).forEach(function (th) { var cc = mkChip(th, false, M.themes[th]);',`]],
  'ZERO55 登记了 §55 没读的文件');
t('G08 期望 0 的正向对照检取反（对照失效时它不红，反而在对照成立时红＝这条腿是倒装的）',
  [['tools/verify.js', 'if (cnt55(flat55(ctrl), needle) < 1) F55', 'if (cnt55(flat55(ctrl), needle) > 0) F55']],
  '的正向对照失效了');
t('G09 普查的页数分母抬到测不到（分母塌了，那几个 0 是空转出来的）',
  [['tools/verify.js', 'const PAGE_MIN55 = 30, SITE_MIN55 = 7000;', 'const PAGE_MIN55 = 90, SITE_MIN55 = 7000;']],
  '个有数据页（期望');
t('G10 普查的景点数分母抬到测不到（数据文件读过半路，判据没被测到）',
  [['tools/verify.js', 'const PAGE_MIN55 = 30, SITE_MIN55 = 7000;', 'const PAGE_MIN55 = 30, SITE_MIN55 = 99000;']],
  '个景点（期望');
t('G11 归一去重自校准取反（别名表读不到时下面所有 0 都不算证据，这一条是那把尺子的反证）',
  [['tools/verify.js', `if (!(CAL55.length === 1 && CAL55[0] === n55('古建寺院'))) F55`, `if (CAL55.length === 1 && CAL55[0] === n55('古建寺院')) F55`]],
  '③(a) 的归一去重自校准失准');
t('G12 配色表归一自校准的期望支数改 2（合成两支应剩一支）',
  [['tools/verify.js', 'if (CALK55.length !== 1) F55', 'if (CALK55.length !== 2) F55']],
  '③(a) 的配色表归一自校准失准');
t('G13 「归一后原样查得到而归一查不到」那条期望 0 取反（① 的失败模式复活就没人看）',
  [['tools/verify.js', 'if (aliasGray !== 0) F55', 'if (aliasGray === 0) F55']],
  '归一后仍有');
t('G14 表内残留别名键那条期望 0 取反（canonThemes 没跑或跑晚了的读数口）',
  [['tools/verify.js', 'if (aliasKeyLeft !== 0) F55', 'if (aliasKeyLeft === 0) F55']],
  '个别名当键');
t('G15 majorThemes 零命中那条期望 0 取反（改前 34 页次全是这一族）',
  [['tools/verify.js', 'if (majorDead !== 0) F55', 'if (majorDead === 0) F55']],
  '个主题名在本页一个景点都没命中');
t('G16 标签重名那条期望 0 取反',
  [['tools/verify.js', 'if (dupCanon !== 0) F55', 'if (dupCanon === 0) F55']],
  '颗重名');
t('G17 整页全零命中那条期望 0 取反（这一页的筛选条应当是空而不造）',
  [['tools/verify.js', 'if (allDeadPages !== 0) F55', 'if (allDeadPages === 0) F55']],
  '页整页的主题标签一个景点都没命中');
t('G18 普查第一条正向对照取反（拿改前那套量必须数出 >0，取反后它只在尺子真的坏了时不红）',
  [['tools/verify.js', 'if (!(aliasGrayRaw > 0)) F55', 'if (aliasGrayRaw > 0) F55']],
  '正向对照失效：拿改前那套');
t('G19 普查第二条正向对照取反（同上，majorThemes 那一支）',
  [['tools/verify.js', 'if (!(majorDeadRaw > 0)) F55', 'if (majorDeadRaw > 0) F55']],
  '正向对照失效：改前那套 majorThemes');
t('G20 末站尺子的自校准阈值改成 0（缺样数不出＝atEnd 恒真/恒假没人看得见）',
  [['tools/verify.js', 'if (m55.length !== 2) F55', 'if (m55.length !== 0) F55']],
  '③(b) 那把尺子自校准失准');
t('G21 spy 整屏尺子的自校准取反（合成串里明明写了 innerHeight，正则读不到时下面那个「体干净」是假绿）',
  [['tools/verify.js', 'if (!/innerHeight|scrollHeight/.test(flat55(SYN2))) F55', 'if (/innerHeight|scrollHeight/.test(flat55(SYN2))) F55']],
  'spy 那把整屏尺子的自校准失准');
t('G22 body55 读不到 atEnd 那一支取反（这一支自己永远不会红的形状）',
  [['tools/verify.js', 'if (AE === null) F55', 'if (AE !== null) F55']],
  '读不到 story.html 里 atEnd 的函数体');
t('G23 body55 读不到 onScroll 那一支取反（同上，第二支）',
  [['tools/verify.js', 'if (SPY === null) F55', 'if (SPY !== null) F55']],
  '读不到 story.html 里 onScroll 的函数体');
t('G24 ④ 齐备检的循环上限从 20 收到 13（少守 7 条而它自己恒不红——拿真实最大编号对账才有牙）',
  [['tools/verify.js', 'for (let i = 0; i <= 20; i++) {', 'for (let i = 0; i <= 13; i++) {']],
  '④ 齐备检的循环上限是 13');
t('G25 上限对账那把正则改到读不到（形状一改，这条对账当场失明而非报红）',
  [['tools/verify.js', 'const BOUND55 = (SEG55.match(/for \\(let i = 0; i <= (\\d+); i\\+\\+\\)/) || [])[1];',
    'const BOUND55 = (SEG55.match(/for \\(let i = 1; i <= (\\d+); i\\+\\+\\)/) || [])[1];']],
  '读不到 ④ 那条齐备检的循环上限');
t('G26 ④ 的条数守卫检取反（少了 S20 那条守卫时它不红，反而在它在场时红）',
  [['tools/verify.js', `if (cnt55(S, "ok('S20'") !== 1) F55`, `if (cnt55(S, "ok('S20'") !== 0) F55`]],
  'smoke-story-map 少了最后那条条数守卫');
t('G27 名单少登记一条（新加判据不登记，本节就永远看不见它）',
  [['tools/verify.js', `      '无脚本错误', '本腿条数守卫（≥18 条）'];`, `      '本腿条数守卫（≥18 条）'];`]],
  '登记的名单是');
t('G28 腿里新加一条判据不写进名单（现场比名单多——双向对账的另一半边；把 !== 取反成 > 是等价变异，数据对得上时两半都恒不红，实测打不红已改成这一发）',
  [['tools/smoke-nodes.js', `  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));`,
    `  ok('G28 这条故意不登记进名单', true, '');\n  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));`]],
  '条判据，④ 登记的名单是');

/* ---------- ④ T：两条腿与登记 ---------- */
t('T01 smoke-nodes 的条数守卫阈值挪低（判据少 16 条也算跑完：中途抛了＝后面一条没执行）',
  [['tools/smoke-nodes.js', 'total >= 18', 'total >= 2']], 'total >= 18');
t('T02 smoke-story-map 的条数守卫阈值挪低（同上）',
  [['tools/smoke-story-map.js', 'total >= 20', 'total >= 3']], 'total >= 20');
t('T03 smoke-nodes 的名单退回拼常量（名单不是现场取回来的真值，改了运行时也照旧绿）',
  [['tools/smoke-nodes.js', '}, shape.order);', `}, ['古建寺院', '寺庙']);`]], '}, shape.order);');
t('T04 smoke-nodes 的取样退回读空壳（A/M/S 全空＝形状检抱着自己的 DOM 读数自说自话）',
  [['tools/smoke-nodes.js', 'var A=window.THEME_ALIAS||{},M=window.TOPIC_META||{},S=window.SITES||[];', 'var A={},M={},S=[];']],
  'var A=window.THEME_ALIAS');
tAll('T05 逐颗点／回选／比配色那三处的精确匹配改成 includes（有一处改了就等于拿别名蒙中）',
  'tools/smoke-nodes.js', 'filter(x => x.textContent.trim() === l)[0]', 'filter(x => x.textContent.includes(l))[0]',
  'filter(x => x.textContent.trim() === l)[0]');
t('T06 smoke-story-map 末站那条从「城内三段全亮」退成「≥2 段」（末站没待住也算过）',
  [['tools/smoke-story-map.js', `s2.segs.filter(function (x) { return x === '#ae5738/solid'; }).length === 3`,
    `s2.segs.filter(function (x) { return x === '#ae5738/solid'; }).length >= 2`]],
  's2.segs.filter(function (x) { return x === ');
t('T07 smoke-story-map 的 S14 编号挪走（齐备检按字面 ok(\'S14\' 数，改名＝这一条从证据链上消失）',
  [['tools/smoke-story-map.js', `ok('S14',`, `ok('S14b',`]], '这条判据不是恰 1 处');
t('T08 smoke-nodes 的一条判据改名（名单里那条从此读 0）——改后的名字不许含登记名的前缀：第一次改成「无脚本错误吧」，名单那条是前缀、cnt55 照读 1，等于恒等变异',
  [['tools/smoke-nodes.js', `ok('无脚本错误'`, `ok('页面报错清零'`]], '无脚本错误」这条判据不是恰 1 处');
t('T09 smoke-irreversible 的可观测量退回 history.length（压没压历史看不见了：back 先吃前向条目再追加＝净零）',
  [['tools/smoke-irreversible.js', 'hstate: JSON.stringify(history.state || null)', 'hstate: String(history.length)']],
  'hstate: JSON.stringify(history.state || null)');
t('T10 smoke-irreversible 的 J04 判据退回旧写法（把「拿 length 当压历史」那一族期望 0 原样请回来）',
  [['tools/smoke-irreversible.js', `e1.hstate.indexOf('tnEdit') >= 0`, `e1.hist === HB + 1`]],
  '拿 history.length 当');
tAll('T11 README 抹掉 §55 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§55', '§5Y', '没提 §55');
tAll('T12 README 抹掉主题腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-nodes.js', 'smoke-nodeX.js', '没登记 smoke-nodes.js');
tAll('T13 README 抹掉叙事地图腿的登记（同上；红字里那条腿不带 tools/ 前缀，暗号要照打印口径抄）', 'README.md', 'smoke-story-map.js', 'smoke-story-maX.js', '没登记 smoke-story-map.js');

/* ---------- ⑤ U：两条腿的分工样本（源码腿必须全绿，浏览器腿必须红在指名那条） ---------- */
gBoth('U01 配色表里那一支的颜色写成空串（键还在＝源码腿的「表里查不到」那条尺子量不到；屏上那一类节点从此没有颜色）',
  [['topic-meta.js', `'江河湖泊': '#3E7CB1', '古城古镇': '#8A5A44'`, `'江河湖泊': '#3E7CB1', '古城古镇': ''`]],
  'N', 'themeOrder 里每个名字都查得到配色');
gBoth('U02 canonThemes 算出归一名单却不写回（函数、归一那行、init 调用三处锚全在原位＝源码腿读不出这条修复没落地；屏上别名那颗 chip 被零命中守卫挡掉，浏览器腿数得出 chip 比名单少）',
  [['topic-common.js', 'M.themeOrder = order;', 'M.themeOrder = M.themeOrder;']],
  'N', 'chip 名单=归一后的 themeOrder');

/* ---------- ⑥ U03：原登记为「两腿都不看的盲区」，实测被推翻，改成浏览器腿抓得到的分工样本 ---------- */
gBoth('U03 给某一页的配色表加一支「本页压根没景点」的主题（源码腿只把它计进 themeOrder 零命中的印数、不进退出码；浏览器腿数得出 chip 比名单少——原先记成盲区，实跑打红了，README 已按实跑改回）',
  [['topic-meta.js', `majorThemes: ["古建寺院","城市地标","古城遗址","江河湖泊","古城古镇"], themes: {`,
    `majorThemes: ["古建寺院","城市地标","古城遗址","江河湖泊","古城古镇"], themes: {'石窟艺术': '#7B5EA7', '名山大川': '#1F5C3A',`]],
  'N', 'chip 名单=归一后的 themeOrder');

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
console.log('=== mut-verify55 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／分工 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['story.html',
    '  var 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：源码腿与两条浏览器腿都得先是绿的，否则后面全是空判 ============ */
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
const LEGS = { N: { script: 'tools/smoke-nodes.js' } };
const S55 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §55') === 0);
const LEGRED = o => String(o).split('\n').filter(l => /^FAIL  /.test(l));
const LEGPASS = o => String(o).split('\n').filter(l => l.indexOf('PASS  ') === 0).length;
const why = r => String(r.out).split('\n').filter(l => l.indexOf('THROW') >= 0 || l.indexOf('STDERR') >= 0).join(' | ') || '(没抓到 THROW 行)';

const vbase = runVerify(), f0 = S55(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §55 有 ' + f0.length + ' 条红；整跑' + (vbase.green ? '绿（那就是 §55 自己红了）' : '不绿，原因：' + why(vbase)) + '\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§55 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM55 = String(vbase.out).split('\n').filter(l => l.indexOf('主题别名归一・叙事末站闸门:') === 0)[0] || '';
const LEN55 = [(SUM55.match(/闸门: (\d+) 条代码锚点/) || [])[1], (SUM55.match(/\+ (\d+) 族期望 0/) || [])[1]];
if (LEN55.join('/') !== '27/5') { console.log('中止：基准摘要里的表长是 ' + LEN55.join('/') + '，而本网登记的是 A55 27／ZERO55 5——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
const CEN55 = (String(vbase.out).split('\n').filter(l => l.indexOf('主题普查:') === 0)[0] || '');
const GRAY55 = (CEN55.match(/灰 (\d+) 处/) || [])[1];
console.log('基准 verify 全绿 ✓（A55 表长 ' + LEN55[0] + '／ZERO55 表长 ' + LEN55[1] + '，与本网登记一致）');
console.log('基准普查读数（不覆盖项甲的现场证据）：' + CEN55.slice(0, 96) + '……灰 ' + GRAY55 + ' 处而整跑绿＝这一族没配判据（待点单）');

Object.keys(LEGS).forEach(k => {
  const g = LEGS[k], r = runLeg(g.script), red = LEGRED(r.out);
  if (red.length || !r.green) {
    console.log('中止：基准 ' + g.script + ' 有 ' + red.length + ' 条红；整跑' + (r.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(r)));
    console.log((red.length ? red.slice(0, 4).join('\n') : String(r.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
    process.exit(2);
  }
  console.log('基准 ' + g.script + ' 判据全绿 ✓（' + LEGPASS(r.out) + ' 条）');
});
{
  const r = runLeg('tools/smoke-story-map.js'), red = LEGRED(r.out);
  if (red.length || !r.green) {
    console.log('中止：基准 tools/smoke-story-map.js 有 ' + red.length + ' 条红；整跑' + (r.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(r)));
    console.log((red.length ? red.slice(0, 4).join('\n') : String(r.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
    process.exit(2);
  }
  console.log('基准 tools/smoke-story-map.js 判据全绿 ✓（' + LEGPASS(r.out) + ' 条）');
}

/* ============ 逐条打靶 ============ */
const ONLY = (process.env.MUT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
let okRed = 0, okSilent = 0, weird = 0, skipped = 0;
function applyEdits(c) {
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
}
CASES.forEach(c => {
  if (ONLY.length && !ONLY.some(k => c.name.indexOf(k) === 0)) { skipped++; return; }
  try { applyEdits(c); } catch (e) {
    weird++; console.log('异常 ' + c.name.slice(0, 40) + '  → 打靶本身失败：' + e.message); restore(); return;
  }
  const vr = runVerify();
  const reds = S55(vr.out);
  if (c.kind === 'silentB') {
    const g = LEGS[c.leg], sm = runLeg(g.script), dd = LEGRED(sm.out);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，' + g.script + ' 红在「' + c.want + '」（共 ' + dd.length + ' 条红：' + dd.map(l => l.replace(/^FAIL\s+/, '').slice(0, 42)).join(' / ') + '）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd.length ? '（' + dd.slice(0, 3).map(l => l.replace(/^FAIL\s+/, '').slice(0, 42)).join(' / ') + '）' : '') + (named ? '' : '；指名的「' + c.want + '」没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §55 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 && String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify55: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／分工对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
process.exit(weird ? 1 : 0);
