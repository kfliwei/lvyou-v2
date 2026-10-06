/* tools/out/mut-smoke36.js — §36 的浏览器腿变异自测（批次 22 的 B 组）
 *
 * 十条变异：九条「改了源码，真浏览器里必须红在指定那条判据上」的行为退化，一条「浏览器腿
 * 对它没有视野」的预判（B6，要求全绿并把机制写进日志——打不出来不等于测过了）。
 * 为什么这组不能省：§36 九成锚点钉的是字面量与顺序，而批次 22 的三种真失败全是**看不见的**：
 *   ① accessible name 是浏览器算出来的——UI.esc 恒返回空串时，日卡那行
 *      `aria-label="' + esc(dl) + '"` 一个字都没动，源码腿 61 条全绿，读屏念出来是空的
 *      （B7/B8/B9 就是 mut-verify36 的 G1/G2/G3，成对读：源码腿 0 红 / 浏览器腿必须红）；
 *   ② 交互闭环——Esc 关不掉、焦点回不去、Tab 跑出弹层，DOM 层 grep 全绿；
 *   ③ 时序——toast「带字一次插入」与「先空插入、下一帧写字」在源码里只差三行位置，
 *      读屏一个播一个不播。
 *
 * 有一条浏览器腿打不到，登记在这里而不是假装打过：trapFocus 的 SVG 命名空间过滤
 * （源码腿 M12）只有当弹层容器里真出现 `<use href>` 才露头，而 smoke-aria 开的三个弹层
 * （locSheet / arriveDlg / nearSheet）里没有那种节点（topic.html 的两处 `<use>` 在图例与
 * 行程面板的关闭键上，都不在弹层内），452×995 下量不到。那条只有源码腿管。
 *
 * 每条真跑一遍 tools/smoke-aria.js，逐条串行；**不得与源码腿或像素基线并跑**
 * （变异打的正是 smoke 要读的这几页，两份同时跑读数全废——批次 20 实测）。
 * 跑完逐字节还原（含异常退出）。
 *
 * 用法: MUT_LOG=tools/out/b22-mut-smoke36.txt node tools/out/mut-smoke36.js
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 证据由脚本自己写盘：shell 重定向在长跑后台任务里留过 0 字节文件 */
const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['ui.js', 'topic-common.js'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });

/* 启动断言：基准源码必须含批次 22 的指纹，否则打的是别的版本的源码，读数全废 */
if (ORIG['ui.js'].indexOf('function trapFocus(container, sel) {') < 0 ||
  ORIG['topic-common.js'].indexOf('function siteAria(s) {') < 0) {
  console.log('中止：基准源码不含批次 22 的指纹（trapFocus 单点 / siteAria），读数不可信');
  process.exit(2);
}
const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function smoke() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-aria.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}
const ids = out => out.split('\n').filter(l => /^FAIL /.test(l))
  .map(l => (l.match(/FAIL\s+([A-Z]\d+\w*)/) || [])[1] || '?');

let red = 0, blind = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const sum = out.match(/smoke-aria: (\d+) 项，失败 (\d+)/);
  if (!sum || /SMOKE-ARIA ERROR/.test(out)) {
    anomalies++;
    console.log('异常  ' + name + '  smoke 没跑完（不是红在指定判据上）：' +
      (out.match(/SMOKE-ARIA ERROR.*/) || [out.slice(-160)])[0].slice(0, 160));
    return;
  }
  const list = ids(out);
  const hit = list.filter(i => i === token);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → ' + (sum[1] || '?') + ' 项，失败 ' + (sum[2] || '?') + '（' +
      list.join(',') + '），指定那条：' + token);
  } else {
    anomalies++;
    console.log('异常  ' + name + '  浏览器腿没按预期红（想找：' + token + '）；失败 ' + (sum[2] || '?') + ' 条：' +
      (list.join(',') || '全绿'));
  }
}
function run(name, file, from, to, token) {
  const src = ORIG[file], F = eol(from, file);
  const n = src.split(F).length - 1;
  if (n !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
    return;
  }
  if (from === to) {
    total++; anomalies++;
    console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), token);
}
/* runBlind：浏览器腿无视野的样本（必须全绿），机制写在条目名里，不许当成「已过」 */
function runBlind(name, file, from, to, why) {
  const src = ORIG[file], F = eol(from, file);
  const n = src.split(F).length - 1;
  if (n !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
    return;
  }
  total++;
  fs.writeFileSync(path.join(ROOT, file), src.replace(F, () => eol(to, file)));
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const sum = out.match(/smoke-aria: (\d+) 项，失败 (\d+)/);
  if (!sum || /SMOKE-ARIA ERROR/.test(out)) {
    anomalies++;
    console.log('异常  ' + name + '  smoke 没跑完：' + (out.match(/SMOKE-ARIA ERROR.*/) || [out.slice(-160)])[0].slice(0, 160));
  } else if (sum[2] !== '0') {
    anomalies++;
    console.log('异常  ' + name + '  本条预判「浏览器腿无视野」，实际红 ' + sum[2] + ' 条（' + ids(out).join(',') + '）——预判错了，要么改判据要么改这条的定性');
  } else {
    blind++;
    console.log('无视野  ' + name + '  → 45 项全绿（' + why + '）');
  }
}

/* ============ 先立基线：干净源码必须全绿，否则下面所有「红」都不是变异的功劳 ============ */
{
  const out = smoke();
  const sum = out.match(/smoke-aria: (\d+) 项，失败 (\d+)/);
  if (!sum || sum[2] !== '0') {
    console.log('中止：干净源码的浏览器腿就不是全绿（' + (sum ? sum[1] + ' 项失败 ' + sum[2] : '没跑完') +
      '）。基线不干净时变异读数没有意义：' + ids(out).join(','));
    process.exit(2);
  }
  console.log('基线  干净源码 smoke-aria ' + sum[1] + ' 项，失败 ' + sum[2] + ' —— 下面每条的红都记在变异头上');
}

/* ============ 交互闭环：只有真键盘才量得到 ============ */
run('B1 markerKeys 只认 Enter、不认 Space（Tab 停得下来、Enter 打得开，Space 什么也不发生＝半个可达）→ A17 必须红', 'ui.js',
  "        if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && e.keyCode !== 13 && e.keyCode !== 32) return;",
  "        if (k !== 'Enter' && e.keyCode !== 13) return;", 'A17');
run('B2 sheet 的 Esc 分支摘掉（读屏用户进得去打不开也关不掉，只能刷新页面）→ A18 必须红', 'ui.js',
  "          if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }", '', 'A18');
run('B3 open 的 isOpen 守卫摘掉（已开着再 open 把 opener 记成弹层自己，焦点归还交给一个 dialog）→ A22 必须红', 'ui.js',
  '\n        if (api.isOpen()) return;', '', 'A22');
run('B4 焦点归还的「还活着的那一枚」找回摘掉（标记被 setIcon 换掉后 focus() 静默失败）→ A19 必须红', 'ui.js',
  '          if (!back.isConnected) {', '          if (false) {', 'A19');
run('B5 开层后焦点不落进弹层（读屏从头念，弹层里没按钮时焦点丢回 body）→ A13 必须红', 'ui.js',
  "        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');", '', 'A13');

/* ============ 重画补名的顺序：浏览器腿对这条没有视野（把预判写下来并验一次，不当成「已过」） ============ */
runBlind('B6 补名挪到 setIcon 之前（＝源码腿 M55 钉的那条顺序）', 'topic-common.js',
  '      m.setIcon(nodeIcon(SITES[idx], idx === i));\n      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }',
  '      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }\n      m.setIcon(nodeIcon(SITES[idx], idx === i));',
  'vendor/leaflet/leaflet.js 反解实测：DivIcon._createIcon 是 t&&"DIV"===t.tagName?t:createElement("div")，也就是复用同一枚 DIV，Marker._initIcon 只在 i!==this._icon 时才 _removeIcon——这条路径上节点根本不换，补在 setIcon 前还是后都落在同一元素上，aria-label 一个也不会掉。名字会丢的是整层重建那条腿（node-lod 重画时新建 marker，创建点就把名字写上）。所以这条顺序断言是结构不变量、不是可观测缺陷，浏览器腿打不出来＝预判成立，不是漏跑');

/* ============ 两步时序：源码里只差三行位置 ============ */
run('B7 toast 带字一次插入（读屏当静态内容，一个字都不播）→ C01 必须红', 'ui.js',
  '    document.body.appendChild(d);\n    requestAnimationFrame(function () {\n      d.appendChild(document.createTextNode(msg));',
  '    d.appendChild(document.createTextNode(msg));\n    document.body.appendChild(d);\n    requestAnimationFrame(function () {',
  'C01');

/* ============ 设计内静默的成对样本：源码腿 0 红，浏览器腿必须红（G1/G2/G3） ============ */
run('B8 =G1 UI.esc 恒返回空串（日卡那行 aria-label 字面量一个字没动，读屏念出来是空的）→ D03 必须红', 'ui.js',
  "    return String(s == null ? '' : s)", "    return ''", 'D03');
run('B9 =G2 siteAria 恒返回空串（调用点的字面量全在，标记名却全空）→ A02 必须红', 'topic-common.js',
  "    return bits.filter(Boolean).join('，');", "    return '';", 'A02');
run('B10 =G3 markerLabel 的赋值行不执行（单点在、导出在、名字从来没写上去）→ A02 必须红', 'ui.js',
  "      if (el && el.setAttribute) el.setAttribute('aria-label', label);",
  "      if (el && el.setAttribute && label.length < 0) el.setAttribute('aria-label', label);", 'A02');

console.log('mut-smoke36: ' + red + '/' + total + ' 按预期红，异常 ' + anomalies);
process.exit(anomalies ? 1 : 0);
