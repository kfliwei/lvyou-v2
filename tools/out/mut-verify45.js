/* tools/out/mut-verify45.js — verify.js §45「卡面裸经纬度闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处（G02 与 I04 是两处：一条产品形状 + 摘掉扫描器的一类信号），跑一遍 node tools/verify.js，
 * 必须在**指定的那条红**里看见它（§45 族看 FAIL §45，⑤ 族看图片闸门）；打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §45 的靶子分四类：
 *   ① 卡面回归那一族（R01–R21）：本批删掉的显示落点逐处插回去，外加保留支被顺手砍（node-manager 的
 *      「坐标 ·」前缀、md-manager／vault 的元信息行、复制文本里那串数）。
 *      其中 R02／R07／R08／R14 用的是**没登记过的形状**（results 的「首次探访」行、海报的另一套位数、
 *      popup 的另一种拼法、抽屉 ms-time 尾巴上挂一串）：A45／ZERO45 钉的是抄下来的那十串，抄不住的第十
 *      一种写法只能由 ③ 的动态扫描逮——这四条红在「卡面上出现裸坐标串」，不红在串匹配。
 *   ② 守卫自己（R22–R39）：共享剥刀／文档那一支／盲区哨兵／A45 与 ZERO45 的四元组形状／期望次数／
 *      登记没读的文件／正向对照失效／把期望 0 的 needle 换成页内那条真规则／扫描器两处自校准／
 *      三条动态对账的分母与「坐标」放行／把「不在屏上就放行」整条摘掉／readdir 收窄成只扫 .html／
 *      齐备检的循环上限。
 *   ③ 浏览器腿自身（R40–R49）：摘判据、改编号、摘两枚反证、裸坐标正则挪一个量级、条数阈值挪低、
 *      真机档退回 452、时间视图那一支不再切、旅程卡那句 querySelector 换成 null、README 抹登记。
 *   ④ 两条腿的分工样本（G01–G04：源码腿必须全绿、浏览器腿必须红在指名那条）：
 *      G01 去重键从坐标换成标题（三条动态对账全在带内，屏上「地点 2」变「地点 3」→ CO16 红）；
 *      G02 抽屉那一行插一串新形状 + 摘掉扫描器的 '<div' 信号（源码腿绿 → CO09 红）：证明 REND45
 *         名单本身是承重墙，也证明浏览器腿是第二道；单插那一串是 R14，那里源码腿会红；
 *      G03 坐标挂进胶囊的 aria-label（那一行没有任何渲染信号，③ 按「不在屏上的键」放行 → CO12 红）：
 *         读屏版的卡面，证据链 tools/out/probe45-aria-blind.txt；
 *      G04 摘掉「展开折叠旅程卡」那一次点击（A45 那句 querySelector 锚还在，列表读到 0 张卡 → CO01 红）：
 *         判据空跑这一族只有浏览器腿看得见。
 *   ⑤ §11 图片闸门「img 必须带 src」那一族（I01–I04，红检出面走 IMGRED，不看 §45）：
 *      起因是 2026-10-09 用户在手机上发现 review 日卡缩略图是空框——§11 原先只查 lazy/onerror 两枚
 *      「防御属性」，恰好放过「压根没把 src 拼进串」，而 onerror 会真触发、把空框变成占位，症状长得
 *      像「图挂了」不像「没给图」。这一族四条：产品回归一枚（I01）、扫描器两枚自校准（I02/I03，
 *      恒真/恒假各方向一枚，证明那两条对照不是摆设）、分母对账一枚（I04：只 srcOk++ 不 push，
 *      红字照样打印但 fail 不计数＝口头上守着）。IMGRED 检出要求「有红字且整跑不绿」，
 *      否则「打印了但不算数」这种变异会被当成打红了。
 *
 * 剔除的一条（原本想当靶子，实测是恒等变异）：摘掉 travel-notes.js 的 `} else legacy();`。
 *   理由：本机 headless Chromium 里 file:// 算安全上下文（isSecureContext=true、navigator.clipboard 在），
 *   点一次「复制」实测只落进 clipboard 那一支，legacy 走不到 ⇒ 摘了源码腿不红、浏览器腿 CO07 照样拦得到。
 *   读数见 tools/out/probe45-copybranch.js（它自己第一次也栽在「旅程卡默认折叠＝0 张卡」上，那正是 A45
 *   给浏览器腿补第三条形状锚的原因）。这类靶子留在网里只会让人以为「那条锚守住了复制」。
 *
 * 用法:
 *   node tools/out/mut-verify45.js --selfcheck      # 只跑内部自测（判据自己红不红得起来）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify45.js  # 只数 from 串命中，不动树
 *   MUT_LOG=tools/out/b30-mut-verify45.txt node tools/out/mut-verify45.js
 * **不要与别的变异网或像素基线并行**：本网动的是 8 个产品文件 + tools/verify.js +
 *   tools/smoke-coord.js + README.md，像素基线量的就是同一批屏；
 *   也不要在跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   网里的 G 类会重跑 smoke-coord，它按固定文件名落读数（tools/out/b30-smoke-coord.txt），
 *   所以跑完要在干净树上复跑一次那条腿，把基准读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。
   认所有 .mut*.lock，不认自己那一个名字：本网快照 11 个文件，与 mut-verify44 的快照重叠四个
   （travel-map.html／topic-common.js／tools/verify.js／README.md）。两张网各锁自己的文件名的话，
   并发跑会各自从自己的启动快照回写——后还原那张把前一张的还原一并抹掉，树停在中间态而两边都报「全过」。
   取锁用 flag 'wx'（存在即失败），把「同时启动」那一格也堵掉。 */
const OUTDIR45 = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR45, '.mut45.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY45 = fs.readdirSync(OUTDIR45).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut45.lock');
if (BUSY45.length) { unlock(); console.log('中止：' + OUTDIR45 + ' 里还有别的变异网锁 ' + BUSY45.join('、') + '（快照与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['results.js', 'review.html', 'travel-notes.js', 'travel-map.html', 'topic-common.js',
  'node-manager.html', 'md-manager.html', 'vault.js', 'tools/verify.js', 'tools/smoke-coord.js', 'README.md'];
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
  ['tools/verify.js', '§45 卡面裸经纬度闸门'],
  ['tools/verify.js', 'const flat45 = s => ws45(stripBlockComments(s));'],
  ['tools/verify.js', "const REND45 = ['<div', '<span',"],
  ['tools/verify.js', 'if (CL45 !== 5) F45('],
  ['tools/verify.js', 'if (CO45 < 15) F45('],
  ['tools/verify.js', 'for (let i = 1; i <= 21; i++) {'],
  ['tools/smoke-coord.js', 'const VW = 328, VH = 723;'],
  ['tools/smoke-coord.js', "ok('CO21 判据条数 ≥ 21"],
  ['travel-map.html', `fillSheet('<div class="ms-place">'+place+'</div>'`],
  ['travel-map.html', `chip.setAttribute('aria-label','这一篇：'`],
  ['travel-notes.js', `it.querySelector('[data-a=copy]').onclick`],
  ['review.html', `sites[n.lat.toFixed(4)+','+n.lng.toFixed(4)]=1`],
  ['node-manager.html', `'<div class="is-coord">坐标 · ' + (+s.lat).toFixed(5)`],
  ['md-manager.html', `rows.push(['坐标', n.lat.toFixed(4)`],
  ['vault.js', `'<p class="meta">坐标 · '`],
  ['README.md', '§45 卡面裸经纬度'],
  /* ⑤ 图片闸门那一族的落点：扫描器判据本体、分母对账、以及被 I01 抹掉的那枚 src */
  ['tools/verify.js', 'const HAS_SRC = l => /src=/.test(l);'],
  ['tools/verify.js', 'src 检出分母对不上'],
  ['review.html', `UI.imgFail(this)" src="'+esc(p)+'" onclick=`],
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
/* edits: [[文件, from, to], …]；token：§45 的 FAIL 行里必须出现的那句 */
function t(name, edits, token) { CASES.push({ name, edits, token, kind: 'red' }); }
function tImg(name, edits, token) { CASES.push({ name, edits, token, kind: 'red', d: 'img' }); }
function tAll(name, file, needle, token) { CASES.push({ name, edits: [[file, needle, '']], token, kind: 'all' }); }
function gBoth(name, edits, want) { CASES.push({ name, edits, want, kind: 'silentB' }); }

/* ---------- ① 卡面回归 + 保留支被砍 ---------- */
t('R01 纪念册卡面把那串数接回天气后面（用户报的 S1-2 原件原地复活）', [['results.js',
  `        + '<div class="m">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'`,
  `        + '<div class="m">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>'`]],
  '接在天气后面');
t('R02 没登记过的形状：「首次探访」那一行插回坐标（登记表守得住抄下来的十串，守不住第十一种写法）', [['results.js',
  `          + '<div class="m">首次探访 ' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'`,
  `          + '<div class="m">首次探访 ' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(3) + ', ' + n.lng.toFixed(3) : '') + '</div>'`]],
  '卡面上出现裸坐标串');
t('R03 review 日卡的 .meta 尾巴挂回那串数', [['review.html',
  `      '<div class="meta">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+'</div>'+`,
  `      '<div class="meta">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+(n.lat!=null?' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4):'')+'</div>'+`]],
  '给人看的，不是给调试用的');
t('R04 随手记列表卡的 .tm 写回坐标（连那个悬空的「 · 」一起回来）', [['travel-notes.js',
  `'</h4><div class="tm">' + esc(n.date) + '</div><div class="tx">'`,
  `'</h4><div class="tm">' + esc(n.date) + ' · ' + (n.lat != null ? '' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div><div class="tx">'`]],
  '只剩一个点');
t('R05 导出文档的卡面回到 5 位小数（这一族本来就三处各写各的位数）', [['travel-notes.js',
  `'<div style="color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>' +`,
  `'<div style="color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) : '') + '</div>' +`]],
  '回到 5 位小数');
t('R06 海报 canvas 把坐标画回日期后面（登记过的那一串）', [['travel-notes.js',
  `    ctx.fillText(n.date, 70, 285);`,
  `    ctx.fillText(n.date + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : ''), 70, 285);`]],
  '没人读的数');
t('R07 海报那一行换成没登记的拼法（另一种位数）——只有 REND45 里的 fillText( 还在名单里才逮得住', [['travel-notes.js',
  `    ctx.fillText(n.date, 70, 285);`,
  `    ctx.fillText(n.date + ' · ' + (+n.lat || 0).toFixed(6) + ', ' + (+n.lng || 0).toFixed(6), 70, 285);`]],
  '卡面上出现裸坐标串');
t('R08 地图 popup 的尾行回到坐标（不走登记的那一串，另一种拼法）', [['travel-notes.js',
  `(n.style ? '<div style="color:#6b665c;font-size:var(--fs-2);margin-top:6px">' + esc(n.style) + '</div>' : '')`,
  `'<div style="color:#6b665c;font-size:var(--fs-2);margin-top:6px">' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) + (n.style ? ' · ' + n.style : '') + '</div>'`]],
  '卡面上出现裸坐标串');
t('R09 popup 那一行把 esc(n.style) 退回裸拼（本批删坐标时顺手补的转义，不许跟着一起退）', [['travel-notes.js',
  `' + esc(n.style) + '</div>' : '')`,
  `' + n.style + '</div>' : '')`]],
  '不许退回去');
t('R10 复制文本里那串数被砍掉（口径明写的保留支：删的是卡面显示，不是那条出口）', [['travel-notes.js',
  `+ (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '\\n' + (n.text || n.raw || '');`,
  `+ '\\n' + (n.text || n.raw || '');`]],
  '真点一次复制读回来');
t('R11 抽屉里那行专门的坐标 div 回来了（.ms-loc 的 CSS 本批已删，这一行会裸着渲染成一串无样式数字）', [['travel-map.html',
  `  const photosHtml=(n.photos&&n.photos.length)?'<div class="ms-photos">'`,
  `  const locHtml=n.lat!=null?'<div class="ms-loc">'+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>':'';\n  const photosHtml=(n.photos&&n.photos.length)?'<div class="ms-photos">'`]],
  '裸着渲染成一串无样式数字');
t('R12 拼串里还挂着那个变量（定义删干净了、这一行没删：当场 ReferenceError，抽屉整块开不起来）', [['travel-map.html',
  `    +'<div class="ms-time">'+time+'</div>'`,
  `    +locHtml+'<div class="ms-time">'+time+'</div>'`]],
  '抽屉整块开不起来');
t('R13 死规则 .ms-loc 又被写回来（落点已不在，留着它的后果是下一个人以为那行还该有内容）', [['travel-map.html',
  `  .ms-place{font-family:var(--font-serif);font-size:26px;font-weight:400;margin-top:6px;letter-spacing:.01em}`,
  `  .ms-place{font-family:var(--font-serif);font-size:26px;font-weight:400;margin-top:6px;letter-spacing:.01em}\n  .ms-loc{margin-top:3px;font-size:var(--fs-2);color:var(--color-muted)}`]],
  '那行还该有内容');
t('R14 抽屉 ms-time 尾巴上挂一串新形状（③ armed 版：渲染信号 <div 还在名单里才逮得住——G02 摘掉它之后源码腿就读不到了）', [['travel-map.html',
  `    +'<div class="ms-time">'+time+'</div>'`,
  `    +'<div class="ms-time">'+time+' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>'`]],
  '卡面上出现裸坐标串');
t('R15 开卡后飞的那个点换成写死的经纬度（「坐标换成定位还在用」那一支：删的是读数不是那个点）', [['travel-map.html',
  `        if(map) map.flyTo(gxy(n.lat,n.lng),Math.max(map.getZoom(),13),{duration:.6});`,
  `        if(map) map.flyTo(gxy(39.9,116.4),Math.max(map.getZoom(),13),{duration:.6});`]],
  '删的是读数，不是那个点');
t('R16 专题地图途经点 popup 回到「坐标占第一行、说明挤第二行」（与 travel-map 同批修的第四支）', [['topic-common.js',
  `<b>途经点随手记</b><div class="pm pa">`,
  `<b>途经点随手记</b><div class="pm">` + "' + lat.toFixed(5) + ', ' + lng.toFixed(5) + `" + `</div><div class="pm pa">`]],
  '挤到下一档');
t('R17 系统地点详情面板摘掉「坐标 ·」前缀（管理面那串数要有交代；这一条同时证明「坐标」二字就是放行理由）', [['node-manager.html',
  `      '<div class="is-coord">坐标 · ' + (+s.lat).toFixed(5) + ', ' + (+s.lng).toFixed(5) + '</div>' +`,
  `      '<div class="is-coord">' + (+s.lat).toFixed(5) + ', ' + (+s.lng).toFixed(5) + '</div>' +`]],
  '保留点从 5 处变成');
t('R18 自建地点详情面板那一支摘掉前缀（两支一起改的口径，不许修一处留一处）', [['node-manager.html',
  `      '<div class="is-coord">坐标 · ' + (+u.lat).toFixed(5) + ', ' + (+u.lng).toFixed(5) + '</div>' +`,
  `      '<div class="is-coord">' + (+u.lat).toFixed(5) + ', ' + (+u.lng).toFixed(5) + '</div>' +`]],
  '自建地点详情面板同一口径');
t('R19 添加/编辑地点弹窗那一行整条删掉（那一行的主体就是坐标：右边贴着「移动位置 ›」，删了它控件就没得对照）', [['node-manager.html',
  `      (preset && preset.lat != null ? '<div class="nm-coord" style="margin-bottom:6px">'+TI('pin', 12)+'' + (+preset.lat).toFixed(5) + ', ' + (+preset.lng).toFixed(5) + (preset.gcj ? ' · 高德坐标' : '') +`,
  '']],
  '那行右边就贴着');
t('R20 数据管理表那一行 rows.push([‘坐标’,…]) 删掉（口径明写的保留支，也是 labeled 那一枚分母）', [['md-manager.html',
  `    if (n.lat != null) rows.push(['坐标', n.lat.toFixed(4) + ', ' + n.lng.toFixed(4)]);`,
  '']],
  '数据管理表的元信息行');
t('R21 导出 Markdown 的元信息行删掉（同一支：少了它就是「坐标被顺手删了」而不是「卡面干净了」）', [['vault.js',
  `      (n.lat != null) ? '<p class="meta">坐标 · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</p>' : '',`,
  `      '',`]],
  '导出 Markdown 的元信息行同一支');

/* ---------- ② 守卫自己 ---------- */
t('R22 flat45 退回不剥注释（共享剥刀一坏，注释里抄的改前原串就被当成代码在场）', [['tools/verify.js',
  `  const flat45 = s => ws45(stripBlockComments(s));`,
  `  const flat45 = s => ws45(s);`]],
  'flat45 定义行没走那把共享剥刀');
t('R23 view45 的定义行退回「文档也剥注释」（README 的登记串里天生要写这族的形状，文档侧的锚会当场读 0）', [['tools/verify.js',
  `  const view45 = f => /\\.md$/.test(f) ? ws45(rd45(f)) : flat45(rd45(f));`,
  `  const view45 = f => flat45(rd45(f));`]],
  'view45 的定义行退回');
t('R24 盲区哨兵的 needle 漂一个字符（少一个尖括号：哨兵写坏＝这一带今天读不读得到再也没人知道）', [['tools/verify.js',
  `['travel-map.html', "fillSheet('<div class=\\"ms-place\\">'"]`,
  `['travel-map.html', "fillSheet('<div class=\\"ms-place\\"'"]`]],
  '这一带又变成盲窗');
t('R25 A45 有一条少写「期望次数」字段（解构错位，那条锚等于没跑）', [['tools/verify.js',
  `['results.js', "+ '<div class=\\"m\\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'", 1,`,
  `['results.js', "+ '<div class=\\"m\\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'",`]],
  'A45 有一条不是');
t('R26 A45 有一条期望次数从 2 抬到 3（锚还在、数不对：条数锚若是抄来的死数就不会红）', [['tools/verify.js',
  `['travel-map.html', "fillSheet('<div class=\\"ms-place\\">'+place+'</div>'", 2,`,
  `['travel-map.html', "fillSheet('<div class=\\"ms-place\\">'+place+'</div>'", 3,`]],
  '两处填内容入口');
t('R27 A45 登记了 §45 没读的文件（锚钉在没人读的字符串上＝永久绿灯）', [['tools/verify.js',
  `['md-manager.html', "rows.push(['坐标', n.lat.toFixed(4)`,
  `['md-managerzz.html', "rows.push(['坐标', n.lat.toFixed(4)`]],
  '没读的文件');
t('R28 ZERO45 有一条少写「正向对照源码」字段（期望 0 只剩个名字，对照没处配）', [['tools/verify.js',
  `      "var h='<div class=\\"card\\">' + '<div class=\\"m\\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>' + '</div>';",\n`,
  '']],
  'ZERO45 有一条不是');
t('R29 把一条正向对照的小数位改一个（对照串里再没有那串 needle：那个 0 就不再是证据）', [['tools/verify.js',
  `(n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>' + '</div>';`,
  `(n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(3) : '') + '</div>' + '</div>';`]],
  '正向对照失效');
t('R30 把「死规则 .ms-loc{」那条期望 0 的 needle 换成页内那条真规则（期望 0 与正向对照共用一把尺：红就自己来说话）', [['tools/verify.js',
  `    ['travel-map.html', '.ms-loc{',`,
  `    ['travel-map.html', '.ms-place{',`]],
  '死规则又被写回来');
t('R31 扫描器自校准的「必须被逮住」期望被挪成 0（把好串当成坏串、坏串当成好串：下面那个「全树 0」立刻不再是证据）', [['tools/verify.js',
  `    if (CAL45.sites !== 3 || CAL45.out.length !== 1 ||`,
  `    if (CAL45.sites !== 3 || CAL45.out.length !== 0 ||`]],
  '扫描器自己失准');
t('R32 把自校准的第一行样本换成「键」那一行（两条键、零条越界：越界那一支从此没人验刀，而 sites 与 labeled 看着都对）', [['tools/verify.js',
  `      "  it.innerHTML = '<h4>x</h4><div class=\\"tm\\">' + esc(n.date) + ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</div>';\\n" +`,
  `      "  const kk = n.lat.toFixed(4)+','+n.lng.toFixed(4);\\n" +`]],
  '扫描器自己失准');
t('R33 坐标行的分母挪高（现场 25 行永远够不到 45，扫描口径漂了也不说话）', [['tools/verify.js',
  `    if (CS45 < 20) F45(`, `    if (CS45 < 45) F45(`]],
  '扫描口径本身漂了');
t('R34 带「坐标」标签那族的期望从 5 改成 30（少了是那一支被顺手删、多了是新落点没登记，两头一起哑）', [['tools/verify.js',
  `    if (CL45 !== 5) F45(`, `    if (CL45 !== 30) F45(`]],
  '保留点从 5 处变成');
t('R35 「不在屏上的键与 URL」下限挪高（这一族是「删卡面不许删功能」的正面证据，挪高就等于不守）', [['tools/verify.js',
  `    if (CO45 < 15) F45(`, `    if (CO45 < 40) F45(`]],
  '不许跟着卡面一起砍');
t('R36 「含坐标二字就放行」改成恒真（所有坐标行都算交代过来意：labeled 从 5 涨到 25，卡面那一族同批失去判据）', [['tools/verify.js',
  `      if (ln.indexOf('坐标') >= 0) { r.labeled++; return; }`,
  `      if (ln.indexOf('坐标') >= -1) { r.labeled++; return; }`]],
  '那一支的坐标被顺手删了');
t('R37 「不在屏上就放行」整条摘掉（去重键／缓存键／URL 全成越界：判据自己淹死在 20 处噪声里）', [['tools/verify.js',
  `      if (!REND45.some(k => ln.indexOf(k) >= 0)) { r.offscreen++; return; }\n`,
  '']],
  '口径是「卡面删掉、界面只留地点名」');
t('R38 readdir 收窄成只扫 .html（.js 那一支的坐标行整族消失：名单式扫描正是本批普查 6→8→11 的根因）', [['tools/verify.js',
  `    const FILES45ALL = fs.readdirSync('.').filter(f => /\\.(js|html)$/.test(f) && fs.statSync(f).isFile());`,
  `    const FILES45ALL = fs.readdirSync('.').filter(f => /\\.html$/.test(f) && fs.statSync(f).isFile());`]],
  '扫描口径本身漂了');
t('R39 浏览器腿齐备检的循环上限从 21 收到 18（少守 3 条而它自己永远不会红）', [['tools/verify.js',
  `    for (let i = 1; i <= 21; i++) {`, `    for (let i = 1; i <= 18; i++) {`]],
  '真实最大编号是 CO21');

/* ---------- ③ 浏览器腿自身 ---------- */
t('R40 摘掉 CO05 一条判据（源码腿的齐备检必须喊：删一条就少一个屏上证据）', [['tools/smoke-coord.js',
  `  ok('CO05 时间视图的 .tm 同样只剩日期，整卡文本同样没有裸坐标',\n    V.length === 3 && V.every(x => DATEONLY(x) && !BARE.test(x.all)), V.map(x => JSON.stringify(x.tm)).join(' | '));\n`,
  '']],
  '这条判据不是恰 1 处');
t('R41 把 CO06 改名成 CO06b（判据还在但按编号认领不到了）', [['tools/smoke-coord.js',
  `  ok('CO06 卡面上留着的是地点名`, `  ok('CO06b 卡面上留着的是地点名`]],
  '改编号会让 §45 的齐备检集体失效');
t('R42 摘掉 CO13 那条属性腿的反证（CO12 那个「全页属性 0 命中」没有它就不是证据）', [['tools/smoke-coord.js',
  `  ok('CO13 反证：把坐标挂进 aria-label，上一条判据读得到（不然 CO12 那个 0 不算证据）',\n    ATTRNEG.placed === true && ATTRNEG.hits.length >= 1, '挂上后命中 ' + ATTRNEG.hits.length + ' 条');\n`,
  '']],
  '属性腿的反证不在场');
t('R43 摘掉 CO19 那条屏上反证（把遮挡做回来闸门必须红——这一条自己也是会被删的）', [['tools/smoke-coord.js',
  `  ok('CO19 反证：改前那串塞回页面时判据正则读得到（不然上面六条「读不到」不算证据）', BARE.test(NEG), JSON.stringify(NEG));\n`,
  '']],
  '合成坏样本不在场');
t('R44 浏览器腿那把裸坐标正则把小数位从 3 位挪到 6 位（六处「读不到」当场变成「正则瞎了」，而源码腿只看它在不在场）', [['tools/smoke-coord.js',
  `const BARE_SRC = '\\\\d{1,3}\\\\.\\\\d{3,}`, `const BARE_SRC = '\\\\d{1,3}\\\\.\\\\d{6,}`]],
  '那把裸坐标正则不在场');
t('R45 条数守卫阈值从 20 挪到 8（删 13 条判据照样绿）', [['tools/smoke-coord.js',
  `checks >= 20,`, `checks >= 8,`]],
  '阈值被挪');
t('R46 真机档退回 452×995（量的就不是用户那块屏，§37 口径）', [['tools/smoke-coord.js',
  `const VW = 328, VH = 723;`, `const VW = 452, VH = 995;`]],
  '量的必须是用户那块屏');
t('R47 不再切到时间视图（renderItem 两支共用，只验一支＝另一支没人守：本批六条红就是这么来的）', [['tools/smoke-coord.js',
  `  await page.evaluate(() => { const t = document.getElementById('tnViewTime'); if (t) t.click(); });\n`, '']],
  '只验聚合那一支');
tAll('R48 抹掉 README 里 §45 的登记（摘登记要抹**全部出现**：那一行里 §45 出现 2 次，只摘一处 indexOf 照样命中）', 'README.md', '§45', '就等于没装');
t('R49 把「找旅程卡那一句」换成 null（A45 钉的是那行 querySelector 在场：源码腿红在串上，浏览器腿红在空跑上，两条各守一半）', [['tools/smoke-coord.js',
  `    const h = document.querySelector('#tnListBody .tn-trip-head');`,
  `    const h = null;`]],
  '旅程卡默认折叠');

/* ---------- ⑤ §11 图片闸门「img 必须带 src」（2026-10-09 用户在手机上发现的空框） ---------- */
tImg('I01 review 日卡缩略图退回缺 src 的原件（用户报的那一条：空框 + 点了没反应）', [['review.html',
  `UI.imgFail(this)" src="'+esc(p)+'" onclick=`,
  `UI.imgFail(this)" onclick=`]],
  '缺 src');
tImg('I02 src 判据恒真（42 行全都算「带 src」，包括压根没给图那一行）——两条自校准的前一条必须当场红', [['tools/verify.js',
  `const HAS_SRC = l => /src=/.test(l);`,
  `const HAS_SRC = l => /<img/.test(l);`]],
  '漏 src 的合成行没被抓到');
tImg('I03 src 判据恒假（反向对照：正向对照失效也要红，否则「两条自校准」只有一条有牙）', [['tools/verify.js',
  `const HAS_SRC = l => /src=/.test(l);`,
  `const HAS_SRC = l => false;`]],
  '带 src 的合成行被误抓');
tImg('I04 漏检不记账（两处：产品那一行缺 src + 扫描器只 srcOk++ 不把漏的记下来）——靠分母对账逮：扫到 42 行、只判了 41 行',
  [['review.html', `UI.imgFail(this)" src="'+esc(p)+'" onclick=`, `UI.imgFail(this)" onclick=`],
   ['tools/verify.js',
    `      if (HAS_SRC(line)) srcOk++; else srcBad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));`,
    `      if (HAS_SRC(line)) srcOk++;`]],
  'src 检出分母对不上');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('G01 review 的坐标去重键换成标题（源码腿：坐标行 25→24、不在屏上 20→19、带标签 5，三条对账全在带内；屏上「篇游记 3／地点 2」变「地点 3」→ 期望红在 CO16）',
  [['review.html',
    `  notes.forEach(function(n){if(n.lat!=null)sites[n.lat.toFixed(4)+','+n.lng.toFixed(4)]=1;if(dayOf(n))days++;photos+=(n.photos||[]).length;});`,
    `  notes.forEach(function(n){if(n.lat!=null)sites[n.title]=1;if(dayOf(n))days++;photos+=(n.photos||[]).length;});`]],
  'CO16');
gBoth('G02 抽屉那一行插一串没登记的坐标 + 摘掉扫描器 REND45 里的 <div 信号（两条一起才压得住：单插那一串是 R14，那里源码腿会红）——期望红在 CO09；这一条证明 REND45 名单本身是承重墙，浏览器腿是第二道',
  [['travel-map.html',
    `    +'<div class="ms-time">'+time+'</div>'`,
    `    +'<div class="ms-time">'+time+' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>'`],
   ['tools/verify.js', `const REND45 = ['<div', '<span',`, `const REND45 = ['<span',`]],
  'CO09');
gBoth('G03 坐标挂进胶囊的 aria-label（读屏版的卡面：那一行没有任何渲染信号，③ 按「不在屏上的键」放行，源码腿永久沉默——证据链 tools/out/probe45-aria-blind.txt）——期望红在 CO12',
  [['travel-map.html',
    `      chip.setAttribute('aria-label','这一篇：'+nm+' · '+time+'，点开看全文与照片');`,
    `      chip.setAttribute('aria-label','这一篇：'+nm+' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'，点开看全文与照片');`]],
  'CO12');
gBoth('G04 摘掉「展开折叠旅程卡」那一次点击（A45 那句 querySelector 锚还在，列表读到 0 张卡：判据空跑这一族只有浏览器腿看得见）——期望红在 CO01',
  [['tools/smoke-coord.js', `    if (!wasOpen && h) h.click();\n`, '']],
  'CO01');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    if (!c.edits || !c.edits.length) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：没有 edits'); bad++; return; }
    c.edits.forEach(ed => {
      const f = ed[0], from = ed[1], to = ed[2];
      if (typeof from !== 'string' || typeof to !== 'string') {
        console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 的 from/to 不是串（' + typeof from + '/' + typeof to + '）：报「哪条 case 的串不是串」比报栈有用');
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
console.log('=== mut-verify45 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证。摘掉一条 §45 判据（在快照上改，不动树）→ 网必须报「预检 FAIL」。
     不塞这一发的话，「网里少登记一条靶子」这件事本身没人守——§44 那张网栽过同形的一跤。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['travel-map.html',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function runVerify() {
  try { return cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); }
  catch (e) { return String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200); }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return cp.execFileSync(process.execPath, ['tools/smoke-coord.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 300000 }); }
  catch (e) { return String((e && e.stdout) || '') + '\nTHROW ' + String((e && e.message) || e).slice(0, 200); }
}
const S45 = out => String(out).split('\n').filter(l => l.indexOf('FAIL §45') === 0);
const B45 = out => String(out).split('\n').filter(l => /^FAIL\s+CO\d/.test(l));
/* §11 图片闸门的检出面：必须「有红字」且「整跑不绿」两个一起——只印红字而不计入 fail 的那种
   变异（I04），屏上看着像有守，退出码照样绿，等于没装。 */
const IMGRED = out => {
  const s = String(out);
  if (s.indexOf('=== ALL CHECKS PASSED ===') >= 0) return [];
  return s.split('\n').filter(l => l.indexOf('图片闸门 FAIL') >= 0);
};
const RED = (c, out) => (c.d === 'img' ? IMGRED(out) : S45(out));

const vbase = runVerify(), f0 = S45(vbase);
if (f0.length) { console.log('中止：基准 verify.js 的 §45 已经有 ' + f0.length + ' 条红，先修基准\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 verify §45 全绿 ✓');
const i0 = IMGRED(vbase);
if (i0.length) { console.log('中止：基准 verify.js 的图片闸门已经有 ' + i0.length + ' 条红，先修基准\n' + i0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 verify 图片闸门全绿 ✓（' + String(vbase).split('\n').filter(l => l.indexOf('图片闸门:') === 0)[0] + '）');
const sbase = runSmoke(), c0 = B45(sbase);
if (c0.length) { console.log('中止：基准 smoke-coord 已经有 ' + c0.length + ' 条红，先修基准\n' + c0.slice(0, 4).join('\n')); process.exit(2); }
console.log('基准 smoke-coord 判据全绿 ✓（' + sbase.split('\n').filter(l => l.indexOf('PASS  CO') >= 0).length + ' 条）');

/* ============ 逐条打靶 ============
   MUT_ONLY=R16,R29 只复打指名的几条（异常复诊用；预检与基准照样跑全量，读数仍可信） */
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
  const out = runVerify();
  const reds = RED(c, out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), co = B45(sm);
    const named = co.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && co.length && named) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红，浏览器腿红在 ' + c.want + '（共 ' + co.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') +
        '，浏览器腿红 ' + co.length + ' 条' + (co[0] ? '（首条 ' + co[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + (c.d === 'img' ? hit[0].slice(0, 100) : hit[0].slice(11, 87))); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → ' + (c.d === 'img' ? '图片闸门红' : '§45 红') + ' ' + reds.length + ' 条，没有一条含「' + c.token + '」' +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (c.d === 'img' && String(out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那枚锚是假绿灯）' : '（＝这条变异压根打不红，那枚锚是假绿灯）')));
    }
  }
  restore();
});

console.log('=== mut-verify45: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + ' ===');
console.log('注意：网里的 G 类重跑过 smoke-coord，读数文件可能已被覆盖，跑完要在干净树上复跑 tools/smoke-coord.js 盖回基准。');
process.exit(weird ? 1 : 0);
