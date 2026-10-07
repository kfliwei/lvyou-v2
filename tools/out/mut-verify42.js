/* tools/out/mut-verify42.js — verify.js §42（拼串闭合 · 样式表归属 · 面板出口唯一）变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §42 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §42 的靶子分五类：
 *   ① 用户点名的那两半（M01–M04）：漏收尾 > 的拼串按宿主各来一次（travel-notes / results 两半，
 *      只修一边就是「这一节钉的是形状不是文件名」那句话没兑现）、挂类又写回内联尺寸、
 *      日历日卡退回自己拼的窄卡；
 *   ② 样式表归属（M05–M15、M20、M27、M28）：.tn-viewer 退回 absolute、两族样式写回 map.css
 *      （各一条：查看器族、日历族）、44 一档退回 36/34、.tn-site 那条漏口规则摘掉、
 *      .ui-modal-x 整条摘掉／少了 flex:0 0 auto／暗色档摘掉、关键帧注入与它的那条引用各断一边
 *      （一对锚就有一条当场失效）、孤儿 .rz-x 插回来；
 *   ③ 放大出口（M16–M19）：同名函数立第二份、照片上的点退回裸名字、对外出口摘掉、
 *      9600 那版自己拼的全屏层插回来（合法函数名，只验「第二套皮」这一条）；
 *   ④ 守卫自己（M22–M33、M40）：扫描器两条正则各退化一步（自校准与两族互斥就是这一手要抓的）、
 *      分母守卫（拼接站点 92／裸类普查 78／宿主页 15）各打掉一个、未认领白名单改数量与改内容
 *      （后者打的是**逐文件点名**那条腿）、四元组少字段、A42 计数期望抬高、正向对照少打一个字符；
 *   ④′ 读源码这把刀自己（M41–M47）：首轮跑网时 M21 打不红，查出来是 §41／§42 共用的 naive
 *      剥注释把面板字符串里的「image/星斜杠」当注释开头，实测在 travel-notes.js:655→704 与
 *      1843→1891 开出两处**盲窗**——盲窗里正向锚永远读 0，而期望 0 那一族永远满足。
 *      这七条打的正是那把刀：flat42 退回 naive／字符串态整支短路／摘掉裸换行收口／
 *      flat41 单独退回 naive（共享那条只能自指）／哨兵标记名多打一个字符／
 *      view42、view41 各退回「文档也剥注释」那一支（第二次发作在 README 上：登记串里的 glob
 *      就是一对斜杠星，红落在 §40 的锚上——markdown 没有块注释，文档侧只归一空白）；
 *   ⑤ 浏览器腿自身（M34–M39）：settle 的心跳退回 rAF、真机档退回 452×995、摘一条形状标签、
 *      摘一条字面判据、抹 README 登记（抹全部出现）。
 *
 * G01／G02 是**设计内静默**，但这一批不停在「源码腿看不见」上：每条都再跑一遍
 * tools/smoke-viewer.js，要求浏览器腿**必须红**。G01 把 .tn-viewer-x 的 44×44 改成 34×34
 * （A42 那条锚钉的是 `position:absolute`，数值它管不到 → V11 必须红）；
 * G02 把 .tn-cal-d.has 的底色改成 transparent（源码里那条规则还在、类还在 → V19 必须红）。
 * 若某条 G 连浏览器腿都不红，本脚本按异常报（＝两腿都没视野，是真漏，不是设计内）。
 *
 * 用法: MUT_LOG=tools/out/b27-mut-verify42.txt node tools/out/mut-verify42.js
 * **不要与别的变异网或像素基线并行**：本网动的是 travel-notes.js / results.js / design.css /
 * map.css / index.html / tools/smoke-viewer.js，像素基线与 smoke-cal 量的就是同一批屏；
 * 也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 * 网里的 G 类会重跑 smoke-viewer，它按固定文件名落读数（tools/out/b27-smoke-viewer.txt），
 * 所以跑完要在干净树上复跑一次那条腿，把基准读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut42.lock');
if (fs.existsSync(LOCK)) {
  console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）');
  process.exit(2);
}
fs.writeFileSync(LOCK, String(process.pid));
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['travel-notes.js', 'results.js', 'design.css', 'map.css', 'index.html', 'ui.js',
  'README.md', 'tools/verify.js', 'tools/smoke-viewer.js'];
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
  ['travel-notes.js', '<button class="ui-modal-x" id="tnExpX" aria-label="关闭">'],
  ['travel-notes.js', 'function zoomPhoto(src) {'],
  ['travel-notes.js', 'renderItem(box, x);'],
  ['results.js', '<button class="ui-modal-x" id="ix" aria-label="关闭">'],
  ['design.css', '.ui-modal-x{flex:0 0 auto;width:44px;height:44px'],
  ['design.css', '.tn-viewer{position:fixed'],
  ['map.css', '这两族由 travel-notes.js 发'],
  ['index.html', '<link rel="stylesheet" href="design.css">'],
  ['tools/verify.js', '§42 拼串闭合 · 样式表归属 · 面板出口唯一'],
  ['tools/verify.js', 'function stripBlockComments(s) {'],
  ['tools/verify.js', 'const flat42 = s => ws42(stripBlockComments(s));'],
  /* 文档那一支（M46／M47 的靶面）：基准树必须已经带上这条，否则下面两条打的是「本批没做的活」 */
  ['tools/verify.js', 'const view42 = f => /' + String.fromCharCode(92) + '.html$|' + String.fromCharCode(92) + '.md$/.test(f)'],
  ['tools/verify.js', 'const view41 = f => /' + String.fromCharCode(92) + '.html$|' + String.fromCharCode(92) + '.md$/.test(f)'],
  ['tools/smoke-viewer.js', "ok('V00 "],
  ['README.md', '/§42 拼串闭合'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 46) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* 正则那两条从字符串拼，别靠源码转义（转义少一层就变成「needle 自己漂了」而不是「闸门退了」） */
const QQ = String.fromCharCode(39);
const BS = String.fromCharCode(92);
const RX_BAD = '<[a-zA-Z][^<>]*?["' + QQ + ']' + BS + 's*' + BS + '+' + BS + 's*TI' + BS + '(';
const RX_GOOD = '<[a-zA-Z][^<>]*?>' + BS + 's*[' + QQ + '"]' + BS + 's*' + BS + '+' + BS + 's*TI' + BS + '(';
const BAD_LINE = '    const BAD42 = /' + RX_BAD + '/g;';
const GOOD_LINE = '    const GOOD42 = /' + RX_GOOD + '/g;';

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, file, edits, token) { CASES.push({ name, file, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, file, edits: [[from, to]], token, kind: 'all' }); }
function gBoth(name, file, from, to, whyBrowser) { CASES.push({ name, file, edits: [[from, to]], kind: 'silentB', whyBrowser }); }

/* ① 用户点名的那两半（token 取「文件名:行号」＝全库扫描器自己点名的那一处；首轮 M02 三条红
      都没带这个串，是因为站点清单原来换行列出、被判据按行取红的那一手丢掉了——现已收成同一行） */
t('M01 导出备份那枚退回漏收尾 > 的拼串（图标整串被解析器吞进属性表＝「关闭按钮没 x」）', 'travel-notes.js',
  [['<button class="ui-modal-x" id="tnExpX" aria-label="关闭">\' + TI(\'close\', 14) + \'',
    '<button id="tnExpX" style="border:0;background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px;color:var(--color-muted);font-size:var(--fs-6);cursor:pointer;flex:0 0 auto" aria-label="关闭"\' + TI(\'close\', 14) + \''.replace("关闭\"' + TI", "关闭\"'+TI")]],
  'travel-notes.js:');
t('M02 results.js 纪念册那枚退回同一形状（只修一半宿主的话，这一节钉的「形状」就没兑现）', 'results.js',
  [['<button class="ui-modal-x" id="rzX" aria-label="关闭">\' + TI(\'close\', 14) + \'',
    '<button id="rzX" style="border:0;background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px;color:var(--color-muted);font-size:var(--fs-6);cursor:pointer"\' + TI(\'close\', 14) + \''.replace("关闭\"' + TI", "关闭\"'+TI")]],
  'results.js:');
t('M03 挂了类又把宽高写回内联（类只剩个名字，§39 的「值对、出处错」原地复发）', 'travel-notes.js',
  [['<button class="ui-modal-x" id="tnExpX" aria-label="关闭">',
    '<button class="ui-modal-x" style="width:34px;height:34px" id="tnExpX" aria-label="关闭">']],
  '尺寸只许在 design.css 一处');
t('M04 日历点开那天又自己拼窄卡（成因③：那一版 .tg 只有两枚出口，照片根本不在屏上）', 'travel-notes.js',
  [['        dayList.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (x) { renderItem(box, x); });',
    ['        dayList.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (x) {',
      '          var item = document.createElement(\'div\');',
      '          item.className = \'tn-item tn-cal-item\';',
      '          item.innerHTML = \'<h4>\' + esc(x.title || x.siteName) + \'</h4><div class="tm">\' + esc(x.date || \'\') + \'</div><div class="tx">\' + esc((x.text || x.raw || \'\').slice(0, 120)) + \'</div><div class="tg"><button data-a="edit">编辑</button><button data-a="del" class="danger">删除</button></div>\';',
      '          item.querySelector(\'[data-a=edit]\').onclick = function () { openEdit(x.id); };',
      '          box.appendChild(item);',
      '        });'].join('\n')]],
  '日历日卡又自己拼窄卡');

/* ② 样式表归属 */
t('M05 查看器从 fixed 退成 absolute（锚钉的是这条规则在场，改前它在文档流里是个 328×63 的裸 DIV）', 'design.css',
  [['.tn-viewer{position:fixed', '.tn-viewer{position:absolute']],
  '全屏查看器');
t('M06 查看器一族写回 map.css（那张表只被 3 页加载，而发这个类的面板挂在 15 页上）', 'map.css',
  [['   留在这里 = 手机上（index / travel-map）读到空类，点照片没反应、日历排成一行裸日号。 */\n',
    '   留在这里 = 手机上（index / travel-map）读到空类，点照片没反应、日历排成一行裸日号。 */\n' +
    '.tn-viewer{position:fixed;inset:0;z-index:9900;background:rgba(12,12,10,.95)}\n']],
  '查看器一族只许有一份');
t('M07 日历一族写回 map.css（批次 26 那张截图的另一半成因就是这么绿过去的）', 'map.css',
  [['   留在这里 = 手机上（index / travel-map）读到空类，点照片没反应、日历排成一行裸日号。 */\n',
    '   留在这里 = 手机上（index / travel-map）读到空类，点照片没反应、日历排成一行裸日号。 */\n' +
    '.tn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:4px 0}\n']],
  '日历一族同上');
t('M08 月份导航钮退回 36×36（A42 钉的正是尺寸出处在这一条上）', 'design.css',
  [['.tn-cal-nav{width:44px;height:44px', '.tn-cal-nav{width:36px;height:36px']],
  '月份导航钮');
t('M09 「本月」胶囊退回 min-height:34px', 'design.css',
  [['.tn-cal-today{min-height:44px', '.tn-cal-today{min-height:34px']],
  '「本月」胶囊');
t('M10 摘掉 body .tn-item h4 .tn-site（裸类普查扫出来的同形状漏口：那一行「· 站点名」又去照抄 h4）', 'design.css',
  [['body .tn-item h4 .tn-site{font-family:var(--font-sans);font-weight:400;font-size:var(--fs-3);color:var(--color-muted);letter-spacing:0}\n', '']],
  '同形状漏口');
t('M11 摘掉 .ui-modal-x 整条规则（五枚钮只剩名字，尺寸/皮肤/暗色一起没处住）', 'design.css',
  [['.ui-modal-x{flex:0 0 auto;width:44px;height:44px;padding:0;border:0;border-radius:999px;background:var(--color-bg-soft);color:var(--color-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform var(--motion-tap) var(--ease-pop),background var(--motion-fast)}\n', '']],
  '尺寸只在 design.css 这一处定义');
t('M12 少了 flex:0 0 auto（标题行是 flex，钮被挤到 0 宽＝图标画得出来也看不见）', 'design.css',
  [['.ui-modal-x{flex:0 0 auto;width:44px', '.ui-modal-x{width:44px']],
  'flex:0 0 auto 是不许少的');
t('M13 暗色档那条摘掉（皮肤不住在类里，页内 inline 那版就没有暗色态）', 'design.css',
  [['.theme-dark .ui-modal-x{background:rgba(239,233,220,.12);color:var(--color-ink)}\n', '']],
  '暗色档补回');
t('M14 面板不再注入 tnPickFade 关键帧（design.css 那条引用还在，解析到空＝淡入没了）', 'travel-notes.js',
  [['@keyframes tnPickFade{from{opacity:0}to{opacity:1}}@keyframes tnPickUp{', '@keyframes tnPickUp{']],
  '关键帧的真身');
t('M15 design.css 那条引用换成 animation:none（两条锚是一对，断一边另一边就该喊）', 'design.css',
  [['animation:tnPickFade var(--motion-fast) ease', 'animation:none']],
  '引用面板运行时注入的关键帧');

/* ③ 放大出口 */
t('M16 同名函数立第二份（JS 提升不报错，后一份静默盖掉前一份）', 'travel-notes.js',
  [['  function zoomPhoto(src) {', '  function zoomPhoto(src) { }\n  function zoomPhoto(src) {']],
  '放大出口在面板内只有一份');
t('M17 照片上的点退回裸名字 zoomPhoto（两份同名函数分家时读到的就是被盖的那份）', 'travel-notes.js',
  [['onclick="TravelNotes.zoomPhotoIdx(', 'onclick="zoomPhoto(']],
  '照片上的点');
t('M18 摘掉对外出口 zoomPhotoIdx（卡片上的 img 只能走它，摘掉＝外部页面只能自己再拼一层）', 'travel-notes.js',
  [['    zoomPhotoIdx: zoomPhotoIdx,\n', '']],
  '对外出口');
t('M19 9600 那版自己拼的全屏层插回来（第二套皮，而且压不住 9900 的查看器）', 'travel-notes.js',
  [['  function zoomPhoto(src) {',
    ['  function zoomPhotoLegacy(src) {',
      '    var d = document.createElement(\'div\');',
      '    d.style.cssText=\'position:fixed;inset:0;z-index:9600;background:#000;display:flex;align-items:center;justify-content:center\';',
      '    d.innerHTML = \'<img src="\' + src + \'">\';',
      '    document.body.appendChild(d); d.onclick = function () { d.remove(); };',
      '  }',
      '  function zoomPhoto(src) {'].join('\n')]],
  '死码那版自己拼的全屏层');

/* 界面上被删掉的两处死代码：它们靠「期望 0 + 合成正向对照」守着，这两条就是来打这两族的 */
t('M20 孤儿 .rz-x 插回来（results.js 那两枚已改挂 .ui-modal-x，全库零调用者的规则就是下一个「出处错」候选）', 'design.css',
  [['.rz-title{font-family:var(--font-serif);font-size:var(--fs-10);color:var(--color-ink);font-weight:400;letter-spacing:.02em}',
    '.rz-title{font-family:var(--font-serif);font-size:var(--fs-10);color:var(--color-ink);font-weight:400;letter-spacing:.02em}' +
    '\n.rz-x{width:38px;height:38px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-muted);font-size:var(--fs-6);cursor:pointer;display:grid;place-items:center}']],
  '孤儿样式');
t('M21 空挂载点 tn-confirm 插回来（裸类普查唯一的例外：它回来这一节就得开后门）', 'travel-notes.js',
  [['  <div class="tn-quotes" id="tnQuotes">\\',
    '  <div class="tn-confirm" id="tnConfirm" style="display:none"></div>\\\n  <div class="tn-quotes" id="tnQuotes">\\']],
  '空挂载点');

/* ④ 守卫自己：扫描器、分母、白名单、四元组、正向对照 */
t('M22 坏形状正则的字符类收窄（自校准必须当场喊：正则一退化，那个「全库 0」就是空的）', 'tools/verify.js',
  [[BAD_LINE, BAD_LINE.replace('["' + QQ + ']', '["]')]],
  '扫描器自校准失效');
t('M23 好形状正则改成与坏形状同一条（两族不再互斥＝坏的那一半会被算成好的）', 'tools/verify.js',
  [[GOOD_LINE, '    const GOOD42 = /' + RX_BAD + '/g;']],
  '两族不再互斥');

/* ④′ 读源码这把刀自己（批次 27 的 M21 就是这么露出来的：naive 剥注释在 travel-notes.js 上
        开出两处盲窗，住在里头的期望 0 那一族静默满足，闸门一个字不喊） */
const NAIVE_SUFFIX = 's.replace(/' + BS + '/' + BS + '*' + '[' + BS + 's' + BS + 'S' + ']*?' + BS + '*' + BS + '/' + "/g, " + QQ + QQ + '));';
t('M41 §42 的 flat42 退回 naive 剥注释（盲窗重开：那一族的期望 0 又会静默满足）', 'tools/verify.js',
  [['  const flat42 = s => ws42(stripBlockComments(s));', '  const flat42 = s => ws42(' + NAIVE_SUFFIX]],
  '剥注释自校准失效');
t('M42 字符串态整支短路（同一条回归的另一半：不跳字符串，那个「image/星斜杠」又当注释开头了）', 'tools/verify.js',
  [["    if (ch === '\"' || ch === \"'\" || ch === '`') {", '    if (ch === String.fromCharCode(1)) {']],
  '被当成注释开头吃了');
t('M43 摘掉「裸换行收口」那一手（没闭合的引号把后面的真注释一路保护下来＝整份文件变盲窗）', 'tools/verify.js',
  [["        if (c === '" + BS + "n' && q !== '`') { break; }\n", '']],
  '没闭合的引号');
t('M44 §41 的 flat41 单独退回 naive（§42 绿着，§41 那八族期望 0 又住回盲窗——共享这条得有人钉；首轮它假过去就是因为钉的是「整串在文件里」，比较串自己就是那一处命中）', 'tools/verify.js',
  [['  const flat41 = s => ws41(stripBlockComments(s));', '  const flat41 = s => ws41(' + NAIVE_SUFFIX]],
  '共享剥刀');
t('M45 盲区哨兵的标记名多打一个字符（哨兵写坏＝这一段今天读不读得到再也没人知道）', 'tools/verify.js',
  [["    ['id=\"tnQuotes\"', 'id=\"tnEditSave\"'].forEach(function (mk) {",
    "    ['id=\"tnQuotesZ\"', 'id=\"tnEditSave\"'].forEach(function (mk) {"]],
  '盲区哨兵');
/* M46／M47：同一族漏口的第二次现场发作用在文档侧——README 的登记串里天生要写 glob，
   那一支一退回剥注释，README 就被开出盲窗，红会落在**别一节**头上（批次 27 实测：§40 的一条
   README 锚当场读 0）。两条分开是因为 view41 与 view42 各写一遍，改一支另一支照旧。 */
t('M46 §42 的 README 视图退回「文档也剥注释」那一支（glob 形状＝一对斜杠星，文档当场开盲窗）', 'tools/verify.js',
  [["  const view42 = f => /" + BS + ".html$|" + BS + ".md$/.test(f) ? ws42(rd42(f)) : flat42(rd42(f));",
    "  const view42 = f => /" + BS + ".html$/.test(f) ? ws42(rd42(f)) : flat42(rd42(f));"]],
  '的定义行退回');
t('M47 §41 的同一支单独退回（§42 绿着，§41 那一节的 README 锚照样能被吃）', 'tools/verify.js',
  [["  const view41 = f => /" + BS + ".html$|" + BS + ".md$/.test(f) ? ws41(rd41(f)) : flat41(rd41(f));",
    "  const view41 = f => /" + BS + ".html$/.test(f) ? ws41(rd41(f)) : flat41(rd41(f));"]],
  '的定义行退回');
t('M24 拼接站点扫描只喂一个文件（分母 92 掉下去，扫描器退化成什么都不查）', 'tools/verify.js',
  [["    const list42 = fs.readdirSync('.').filter(f => ", "    const list42 = ['travel-notes.js']; // "]],
  '分母只剩');
t('M25 未认领白名单删掉一项（数量对账必须喊：站点还在，认领少了）', 'tools/verify.js',
  [["    const UNCAL42 = ['node-manager.html', 'planner.js'];", "    const UNCAL42 = ['planner.js'];"]],
  '从 1 变成 2');
t('M26 未认领白名单换掉一项（数量照样对得上，只有**逐文件点名**那条腿抓得到）', 'tools/verify.js',
  [["    const UNCAL42 = ['node-manager.html', 'planner.js'];", "    const UNCAL42 = ['node-manager.html', 'topic.html'];"]],
  '没登记过的文件');
t('M27 面板发的类名漂移（tn-cal-day-tip → tn-cal-tip：产品发一个、表里另一个＝读空类）', 'travel-notes.js',
  [["'<div class=\"tn-cal-day-tip\">本月 '", "'<div class=\"tn-cal-tip\">本月 '"]],
  '面板发了裸类');
t('M28 摘掉 design.css 的 .tn-cal-day-tip（宿主对账说这一页真加载了这张表，表里却没这条）', 'design.css',
  [['.tn-cal-day-tip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:var(--fs-4);color:var(--color-ink-soft);padding:2px 0 6px}\n', '']],
  '面板发了裸类');
t('M29 裸类普查摘掉一个提取上下文（分母 78→23：六条腿少一条就没人知道漏了哪条）', 'tools/verify.js',
  [['      /class="([^"]+)"/g,\n', '']],
  '裸类普查的分母只剩');
t('M30 宿主名单改成硬编码一页（现场枚举被抹掉，这一节就不再覆盖全站）', 'tools/verify.js',
  [["    hosts42 = fs.readdirSync('.').filter(f => f.endsWith('.html') && rd42(f).indexOf('travel-notes.js') >= 0);",
    "    hosts42 = ['index.html'];"]],
  '宿主页现场只数到');
t('M31 index.html 不再引 design.css（宿主对账是动态的：这一页发的那 78 个类全成空类）', 'index.html',
  [['<link rel="stylesheet" href="design.css">\n', '']],
  '没引 design.css');
t('M32 A42 一条期望次数抬高（锚还在、数不对＝条数锚不是抄来的死数）', 'tools/verify.js',
  [['[\'ui.js\', "xBtn.className = \'ui-sheet-x\';", 1,', '[\'ui.js\', "xBtn.className = \'ui-sheet-x\';", 2,']],
  '实得 1，期望 2');
t('M40 A42 登记了 §42 没读的文件（锚钉在没人读的字符串上＝永久绿灯）', 'tools/verify.js',
  [["['ui.js', \"xBtn.className = 'ui-sheet-x';\"", "['uiload.js', \"xBtn.className = 'ui-sheet-x';\""]],
  '没读的文件');
t('M33 A42 有一条少写「串」字段（解构错位，那条锚等于没跑）', 'tools/verify.js',
  [["['design.css', 'z-index:9900', 1, '盖在面板与底导航之上", "['design.css', 1, '盖在面板与底导航之上"]],
  '四元组');
t('M34 ZERO 那族的 needle 多打一个空格（正向对照当场失效——那个 0 不再是证据）', 'tools/verify.js',
  [["['map.css', '.tn-viewer', '.tn-viewer{position:fixed;inset:0;z-index:9900',",
    "['map.css', '.tn-viewer ', '.tn-viewer{position:fixed;inset:0;z-index:9900',"]],
  '正向对照失效了');

/* ⑤ 浏览器腿自己 */
t('M35 settle 的心跳退回 rAF 轮询（headless 里 rAF 冻在过渡首帧，41×41 会被当稳定值）', 'tools/smoke-viewer.js',
  [['setTimeout(step, 40);', 'requestAnimationFrame(step);']],
  'settle 的心跳必须是定时器');
t('M36 真机档退回 452×995（量的就不是用户那块屏）', 'tools/smoke-viewer.js',
  [['const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '真机档取一加 Ace 6T');
t('M37 摘掉 V00（假图夹具自证那条：它一没，下面整节腿可以静默空转）', 'tools/smoke-viewer.js',
  [["  ok('V00 测试假图自己能解码成 1×1（解码失败会被 UI.imgFail 换成占位块，下面整节腿就空了）', fx === '1x1,1x1', fx);\n", '']],
  '这条判据');
t('M38 摘掉 V32 一条字面判据（条数锚必须喊）', 'tools/smoke-viewer.js',
  [["  ok('V32 results.js 纪念册预览的关闭钮（第五处）', XGOOD(rz, 'ui-modal-x'), JSON.stringify(rz));\n", '']],
  '实得 35，期望 36');
tAll('M39 抹掉 README 里 §42 的登记（摘登记要抹**全部出现**，摘一处不算抹掉）', 'README.md',
  '§42', '拼串闭合与样式表归属节', '没提 §42');

/* 设计内静默：源码腿没有视野，但浏览器腿必须红 */
gBoth('G01 .tn-viewer-x 的 44×44 退成 34×34（锚钉的是 position:absolute 那条腿，数值它管不到）', 'design.css',
  '.tn-viewer-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;width:44px;height:44px',
  '.tn-viewer-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;width:34px;height:34px');
gBoth('G02 .tn-cal-d.has 的底色改成 transparent（规则还在、类还在、类名还在，格子却不再亮）', 'design.css',
  '.tn-cal-d.has{background:var(--color-primary-soft);color:var(--color-primary-dark);font-weight:600;border-color:rgba(200,109,75,.25)}',
  '.tn-cal-d.has{background:transparent;color:var(--color-primary-dark);font-weight:600;border-color:rgba(200,109,75,.25)}');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    c.edits.forEach(([from, to]) => {
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

/* ============ 跑网 ============ */
function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
function smokeViewer() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-viewer.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §42 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
function smokeFails(out) {
  const m = out.match(/=== smoke-viewer: (\d+) 项，失败 (\d+) ===/);
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
const bb = smokeViewer();
const bbN = smokeFails(bb);
if (bbN !== 0) {
  console.log('中止：基准 smoke-viewer.js ' + (bbN === null ? '没打出终判行（' + bb.replace(/\s+/g, ' ').slice(-160) + '）' : '已有 ' + bbN + ' 条红') + '，G 类没有可比读数');
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
      console.log('异常  ' + c.name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§42 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
      return;
    }
    fs.writeFileSync(path.join(ROOT, c.file), apply(c));
    let so, sf;
    try { so = smokeViewer(); sf = smokeFails(so); }
    finally { fs.writeFileSync(path.join(ROOT, c.file), ORIG[c.file]); }
    if (sf === null) {
      anomalies++;
      console.log('异常  ' + c.name + '  smoke-viewer 没打出终判行（浏览器腿自己崩了）：' +
        so.replace(/\s+/g, ' ').slice(-160));
      return;
    }
    if (sf >= 1) {
      silent++;
      const fl = so.split('\n').filter(l => /^FAIL\s+V/.test(l)).map(l => l.slice(0, 96));
      console.log('静默  ' + c.name + '  → 源码腿 0 红，浏览器腿红 ' + sf + ' 条（' + fl.slice(0, 2).join(' | ') + '）');
    } else {
      anomalies++;
      console.log('异常  ' + c.name + '  源码腿 0 红**且浏览器腿也 0 红**＝两条腿都没有视野，这条是真漏（不是设计内静默）');
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(c.token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + c.name + '  → §42 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + c.name + '  打了变异但没按预期红（想找：' + c.token + '）；本轮 §42 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
CASES.forEach(judge);

console.log('====================================================================');
console.log('§42 变异自测 共 ' + total + ' 条：按预期红 ' + red + ' / 设计内静默（源码腿绿 + 浏览器腿红）' + silent + ' / 异常 ' + anomalies);
console.log('A42 表长 37 条、ZERO42 表长 14 条（M32 打的 1→2 与 M38 打的 36→35 就是「阈值类变异要取当前长度 + 1」这条规矩的落地）；剥注释这把刀的四段合成串 + 两枚现场哨兵 + 文档那一支不在 A42 表里，M41–M47 打的是这一屏自己');
console.log('判读：M22/M23 与 M24/M25/M26/M29/M30 是这张网最该在的两组——前者证明内置扫描器不是「跑一次全库 0 就交差」' +
  '（正则一退化、分母一掉、白名单一改，闸门自己喊），后者证明动态对账的三项各有独立视野；' +
  'M26 与 M32 特意分开：换一项数量不变，只有逐文件点名抓得到。' +
  'M21 与 M41–M47 是这一批真正的收获：M21 首轮**打不红**，顺着它挖出 naive 剥注释在 travel-notes.js 上开的两处盲窗' +
  '（655→704、1843→1891），修完 M21 才第一次红；④′ 那七条钉的就是「这把刀本身不许再退化回去」——' +
  '一条闸门读不到源码，比没有那条闸门更危险，因为它会替你撒谎。' +
  'M46／M47 是同族漏口的第二次现场发作，这次在文档侧：把一串属性值原样抄进 §42 的登记文字，' +
  'README 里就多出一对字面斜杠星，而 .md 当时也走剥注释那一支，于是红落在**别一节**（§40 的一条 README 锚读 0）；' +
  'markdown 没有块注释、登记串里天生要写 glob，所以文档那一支只归一空白。' +
  'G01/G02 证明「源码锚只钉判据在场」这件事由浏览器腿补上数值与底色，而不是无人认领。');
process.exit(anomalies ? 1 : 0);
