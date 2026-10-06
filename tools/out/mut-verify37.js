/* tools/out/mut-verify37.js — verify.js §37（真机视口与弹层右上角关闭）变异自测 · 源码腿
 *
 * 每条变异只改一处（个别要挪位置的两处一起改），跑一遍 node tools/verify.js，必须在
 * **指定的那条 §37 红**里看见它；打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一批为什么需要这张网：三条症状全是「桌面看正常、手机上看不到东西」，而 §37 的判据里
 * 最值钱的两类——顺序（ensureX 早于 isOpen 守卫、off 判定早于 insertBefore）与
 * 双向认领表（声明 off 者必须有自家关闭控件；没控件的两枚不许声明）——
 * 都存在「needle 在源码里根本没有 ⇒ 期望 0 恒真」「合成对照自己坏掉」两种假绿法。
 * M31–M34 打的就是这两类守门的门。
 *
 * G1 是**设计内静默**：X 的尺寸从 40px 缩到 8px，字面量锚一根没动（`.ui-sheet-x{float:right`
 * 还在），源码腿必须全绿——尺寸只有浏览器腿（tools/out/probe23d-sheetx.js 量 rect 与命中）能抓。
 * 这一条是给「存在性锚守不住形状」留的证据，不是漏跑。
 *
 * 用法: MUT_LOG=tools/out/b23-mut-verify37.txt node tools/out/mut-verify37.js
 * **不要与别的变异网或像素基线并行**：变异打的就是 smoke 要截的那几页；
 * 也不要在本网跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉（批次 23 实测踩过）。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut37.lock');
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

const JP = 'android_app/app/src/main/java/com/gujian/guditu/MainActivity.java';
const FILES = ['ui.js', 'design.css', 'planner.js', 'topic-common.js', 'topic.html',
  'node-manager.html', 'travel-map.html', 'tools/smoke-usable.js', JP, 'README.md', 'tools/verify.js'];
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
  ['ui.js', 'function ensureX() {'],
  ['ui.js', "if (el.getAttribute('data-sheet-x') === 'off') return;"],
  ['design.css', '.row-opt>*{min-width:0;white-space:normal;align-self:stretch;flex-wrap:wrap}'],
  ['planner.js', '<span>倒序</span><span>从远端返回</span>'],
  [JP, 'ws.setTextZoom(100);'],
  ['tools/verify.js', '§37 真机视口与弹层右上角关闭闸门'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 40) + '」，读数不可信');
    process.exit(2);
  }
});
/* 基准必须全绿：基线不脏就没法把红记在变异头上 */
const base = verify();
if (pick(base).length) {
  console.log('中止：基准 verify.js 已有 ' + pick(base).length + ' 条红，先修树再跑变异网');
  console.log(pick(base).join('\n'));
  process.exit(2);
}

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
function pick(out) { return out.split('\n').filter(l => /^FAIL /.test(l)); }

let red = 0, silent = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token, wantGreen) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let lines;
  try { lines = pick(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const s37 = lines.filter(l => l.indexOf('FAIL §37') >= 0);
  if (wantGreen) {
    if (lines.length === 0) {
      silent++;
      console.log('静默  ' + name + '  → 源码腿 0 红（尺寸/形状类，只有浏览器腿能抓，配 probe23d 的同名测量成对读）');
    } else {
      anomalies++;
      console.log('异常  ' + name + '  本条应「源码腿全绿」，实际红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
    }
    return;
  }
  const hit = s37.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §37 红 ' + s37.length + ' 条（总红 ' + lines.length + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
/* run：edits 是 [[from, to], …]，每一处都必须恰命中 1 次（多命中＝needle 太短，先报错不动树） */
function run(name, file, edits, token) {
  let src = ORIG[file];
  for (const [from, to] of edits) {
    if (from === to) {
      total++; anomalies++;
      console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
      return;
    }
    const F = eol(from, file);
    const n = src.split(F).length - 1;
    if (n !== 1) {
      total++; anomalies++;
      console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
      return;
    }
    src = src.replace(F, () => eol(to, file));
  }
  judge(name, file, src, token);
}
function runAll(name, file, from, to, token) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.split(F).join(eol(to, file)), token);
}
/* runFirst：只换第一处（多命中是设计使然，例如 class="row row-opt" 本来就有 5 处，
   摘掉一处才能把「计数锚掉到 4」这一族打红；换全部会把同族的另一条期望 0 一起改形状） */
function runFirst(name, file, from, to, token) {
  const src = ORIG[file], F = eol(from, file);
  const n = src.split(F).length - 1;
  if (n < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), token);
}
function greenCase(name, file, from, to) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  from 串不是恰 1 处（' + (src.split(F).length - 1) + '），静默样本没打上');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), null, true);
}

/* ============ ① X 的单点与两组顺序（本批的灵魂） ============ */
run('M01 摘掉 open() 里的 ensureX() 调用（X 从此不出现）', 'ui.js',
  [["        ensureX();\n", ""]], '不再调 ensureX');
run('M02 ensureX() 挪到 isOpen 守卫之后（重画内容的腿补不回 X）', 'ui.js',
  [["        ensureX();\n", ""],
  ["        if (api.isOpen()) return;\n", "        if (api.isOpen()) return;\n        ensureX();\n"]],
  'ensureX 没有排在 isOpen 守卫之前');
run('M03 off 判定挪到 insertBefore 之后（自带控件的弹层被叠两枚 X）', 'ui.js',
  [["      if (el.getAttribute('data-sheet-x') === 'off') return;\n", ""],
  ["      if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);\n",
    "      if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);\n      if (el.getAttribute('data-sheet-x') === 'off') return;\n"]],
  'off 判定没有排在插入之前');
run('M04 摘掉 off 判定（认领表失去执行者）', 'ui.js',
  [["      if (el.getAttribute('data-sheet-x') === 'off') return;\n", ""]], '声明式认领');
run('M05 插入改成 appendChild（X 跟到列表末尾，顶部看不见）', 'ui.js',
  [["if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);",
    "if (xBtn.parentNode !== el) el.appendChild(xBtn);"]], 'append 到末尾');
run('M06 第二处 insertBefore（绕过 parentNode 幂等，重开一次叠一枚）', 'ui.js',
  [["      if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);\n",
    "      if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);\n      if (xBtn.parentNode !== el) el.insertBefore(xBtn, el.firstChild);\n"]],
  'insertBefore 不是恰 1 次');
run('M07 点 X 只去 class，不走 api.close()（aria-modal／expanded／焦点全留原地）', 'ui.js',
  [["xBtn.onclick = function () { api.close(); };", "xBtn.onclick = function () { el.classList.remove(cls); };"]],
  '点它必须走 api.close()');
run('M08 摘掉 X 的 aria-label（读屏只念得出「按钮」）', 'ui.js',
  [["        xBtn.setAttribute('aria-label', '关闭');\n", ""]], '读屏念得出「关闭」');
run('M09 回潮 opts.closeX（跟调用顺序走的声明＝没声明）', 'ui.js',
  [["      if (el.getAttribute('data-sheet-x') === 'off') return;",
    "      if (opts.closeX === false) return;\n      if (el.getAttribute('data-sheet-x') === 'off') return;"]],
  'closeX 方案已废弃');

/* ============ ② 二选一按钮行（23-B 的形状） ============ */
run('M10 row-opt 摘掉 min-width:0（缩不到内容以下，顶穿卡片）', 'design.css',
  [[".row-opt>*{min-width:0;white-space:normal;align-self:stretch;flex-wrap:wrap}",
    ".row-opt>*{white-space:normal;align-self:stretch;flex-wrap:wrap}"]], '整串：flex:1 留着默认');
run('M11 选择器收窄成 .row-opt>.btn（infoSheet 的 .is-btn 静默失效）', 'design.css',
  [[".row-opt>*{min-width:0", ".row-opt>.btn{min-width:0"]], '选择器太窄的改前形态');
run('M12 摘掉段内 nowrap（窄屏断出「从起点 出发」半截话）', 'design.css',
  [[".row-opt>*>span{white-space:nowrap}\n", ""]], '段内不许断行');
run('M13 X 改回绝对定位（滚动容器把 X 带走）', 'design.css',
  [[".ui-sheet-x{float:right", ".ui-sheet-x{position:absolute"]], '绝对定位会被滚动容器带走');
run('M14 摘掉暗色档翻色（深色弹层上那枚 X 又看不见了）', 'design.css',
  [[".theme-dark .ui-sheet-x{background:rgba(239,233,220,.12);color:var(--color-ink)}\n", ""]], '暗色档必须翻色');
runFirst('M15 向导环线行改回裸 .row（328 档第二枚 right=395）', 'planner.js',
  'class="row row-opt"', 'class="row"', '向导四行（环线/排序方式/方向/步骤条导航）');
run('M16 正序文案合回不可断的整串', 'planner.js',
  [["<span>正序</span><span>从起点出发</span>", "正序 · 从起点出发"]], '整串不可断的旧文案');
run('M17 浏览弹层那行改回内联 flex（逐页手写并排行）', 'planner.js',
  [["<div class=\"row row-opt\" style=\"gap:8px;margin-top:12px\">", "<div style=\"display:flex;gap:8px;margin-top:12px\">"]],
  '浏览弹层那行改前是内联 flex');

/* ============ ③ 双向认领表 ============ */
run('M18 locSheet 自己声明 off（把症状当配置关掉）', 'topic.html',
  [["<div class=\"location-sheet\" id=\"locSheet\">", "<div class=\"location-sheet\" id=\"locSheet\" data-sheet-x=\"off\">"]],
  '景点卡：本批要补 X 的就是它');
run('M19 infoSheet 自己声明 off（同上）', 'node-manager.html',
  [["<div id=\"infoSheet\">", "<div id=\"infoSheet\" data-sheet-x=\"off\">"]], '地点详情卡：同上');
run('M20 rsSheet 的关闭钮改名（声明还在，控件没了）', 'node-manager.html',
  [["<button class=\"x\" id=\"rsClose\"", "<button class=\"x\" id=\"rsCloseX\""]], '却找不到自己的关闭控件');
run('M21 到达弹层「直接收起」改名（配对断言的另一条腿）', 'topic.html',
  [["<div class=\"arrive-nav\" onclick=", "<div class=\"arrive-navx\" onclick="]], '「直接收起」还在——控件没了');
run('M22 摘掉 nearSheet 的 off 声明（这一带面板被叠第二枚 X）', 'topic-common.js',
  [["    nearSheet.setAttribute('data-sheet-x', 'off');\n", ""]], '这一带面板头部自带 .nx');

/* ============ ④ 取样档（23-D：真机 328×723 必须进常驻闸门） ============ */
run('M23 取样档退回三档（真机档没人验）', 'tools/smoke-usable.js',
  [["for (const w of [320, 328, 390, 452]) {", "for (const w of [320, 390, 452]) {"]], '手机取样四档');
/* 「手机四档」在 smoke-usable.js 实测出现 3 次（注释 1 + U19/U20 两条标签），run() 要恰 1 命中。
   这族要的是「标签整体回到三档」，所以全换：既打中期望 0 的那条，也顺带打中取样档两条锚。 */
runAll('M24 判据标签改回「手机三档」（文档与闸门各说一套）', 'tools/smoke-usable.js',
  '手机四档', '手机三档', '里出现「手机三档」');
run('M25 328 档的高度写成 640（只补宽度＝底带裁切没人看）', 'tools/smoke-usable.js',
  [["w === 328 ? 723", "w === 328 ? 640"]], '高度同档');

/* ============ ⑤ 壳侧归一与壳源对账（23-A） ============ */
run('M26 摘掉 setTextZoom(100)（font_scale 直接乘进 CSS 像素）', JP,
  [["        ws.setTextZoom(100);\n", ""]], '系统「字体大小」');
run('M27 只在仓库副本追加一行（改的是这份，构建吃的是壳那份）', JP,
  [["        ws.setUserAgentString(ws.getUserAgentString() + \" GuJianApp\");",
    "        ws.setUserAgentString(ws.getUserAgentString() + \" GuJianApp\");\n        // b23-mut：只动仓库副本，交付壳没动"]],
  '与入库副本不一致');

/* ============ ⑥ 守门的门：合成对照自己坏掉时必须说话 ============ */
run('M28 反向认领表的合成源里抹掉 data-sheet-x（那个 0 从此不是证据）', 'tools/verify.js',
  [["const SYN37 = ws37('<div class=\"location-sheet\" id=\"locSheet\" data-sheet-x=\"off\">",
    "const SYN37 = ws37('<div class=\"location-sheet\" id=\"locSheet\""]], '反向认领表失效');
run('M29 open 顺序断言的反向对照改成正确顺序', 'tools/verify.js',
  [["const BADX = flat37('open: function (label) { if (api.isOpen()) return; ensureX(); el.classList.add(cls); }');",
    "const BADX = flat37('open: function (label) { ensureX(); if (api.isOpen()) return; el.classList.add(cls); }');"]],
  'open 顺序断言的反向对照失效');
run('M30 ensureX 顺序断言的反向对照改成正确顺序', 'tools/verify.js',
  [["const BADO = flat37(\"function ensureX() { el.insertBefore(xBtn, el.firstChild); if (el.getAttribute('data-sheet-x') === 'off') return; }\");",
    "const BADO = flat37(\"function ensureX() { if (el.getAttribute('data-sheet-x') === 'off') return; el.insertBefore(xBtn, el.firstChild); }\");"]],
  'ensureX 顺序断言的反向对照失效');
run('M31 closeX 那条期望 0 的正向对照串里抹掉 needle', 'tools/verify.js',
  [["      \"if (opts.closeX === false) return;\",", "      \"if (opts.hideX === false) return;\","]],
  '这条期望 0 的正向对照失效');
/* README 里 §37 实测出现 2 次（清单行 + 登记块），run() 要求恰 1 命中会判异常；
   这族要的是「登记整体消失」，所以全换。 */
runAll('M32 README 的 §37 登记改名（新闸门不写进 README 就等于没装）', 'README.md',
  '§37', '§3X', '没提 §37');

/* ============ ⑦ 设计内静默：源码腿抓不到、只有浏览器腿抓得到 ============ */
greenCase('G1 X 的尺寸 40px → 8px（字面量锚一根没动，触屏按不到而已）', 'design.css',
  ".ui-sheet-x{float:right;width:40px;height:40px;", ".ui-sheet-x{float:right;width:8px;height:8px;");

console.log('源码腿小结: 共 ' + total + ' 条 → 按预期红 ' + red + ' · 设计内静默 ' + silent + ' · 异常 ' + anomalies);
console.log('还原自检: ' + (FILES.filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8') === ORIG[f]).length) + '/' + FILES.length + ' 文件逐字节等于基准');
process.exit(anomalies ? 1 : 0);
