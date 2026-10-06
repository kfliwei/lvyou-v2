/* tools/out/mut-verify36.js — verify.js §36（无障碍三类关键结构）变异自测 · 源码腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §36 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这批为什么最需要这张网：批次 22 改的全是「屏幕上看不见」的东西——aria-label、
 * aria-live、Tab 圈定、Esc、焦点归还。界面一个像素都不变，读屏用户却整段用不了。
 * 而 §36 的判据九成是**顺序**（先空插入再写字、过滤早于 first/last、守卫早于 add、
 * 补名晚于 setIcon），顺序断言最容易写成恒真（needle 在源码里根本不存在／合成对照自己失效）。
 *
 * G1–G3 三条是**设计内静默**：变异打在 §36 不钉字面量的位置（esc 的函数体、siteAria 的
 * 函数体、markerLabel 的赋值行），源码腿必须一根不红——它们只有浏览器腿能抓。
 * 这就是「同一变异两层视野不同」的证据，配对读 tools/out/mut-smoke36.js 的 B7–B9。
 * M75–M77 打的是「守门的门」：合成对照自己坏掉时必须说话，否则期望红不是证据。
 *
 * 用法: MUT_LOG=tools/out/b22-mut-verify36.txt node tools/out/mut-verify36.js
 * 浏览器腿（同一变异 smoke 也要红）见 tools/out/mut-smoke36.js——**不要与本网并行**：
 * 变异打的就是 smoke 要截的那几页，两份同时跑读数全废（批次 20 实测）。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['ui.js', 'design.css', 'topic-common.js', 'topic.html', 'node-manager.html',
  'travel-map.html', 'node-lod.js', 'planner.js', 'share.html', 'story.html', 'wishlist.html',
  'travel-notes.js', 'README.md', 'tools/smoke-aria.js', 'tools/verify.js'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);
/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上 */
if (ORIG['ui.js'].indexOf('function trapFocus(container, sel) {') < 0 ||
  ORIG['tools/verify.js'].indexOf('§36 无障碍三类关键结构闸门') < 0) {
  console.log('中止：基准源码不含批次 22 的指纹（trapFocus 单点 / §36 闸门标题），读数不可信');
  process.exit(2);
}
const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
/* 多行 from/to 一律按目标文件的行尾重写：本仓多数文件是 CRLF，硬写 \n 会一条都命不中 */
const eol = (s, f) => s.replace(/\n/g, EOL(f));

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
const pick = out => out.split('\n').filter(l => /^FAIL /.test(l));

let red = 0, silent = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token, wantGreen) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let lines;
  try { lines = pick(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const s36 = lines.filter(l => l.indexOf('FAIL §36') >= 0);
  if (wantGreen) {
    if (lines.length === 0) {
      silent++;
      console.log('静默  ' + name + '  → 源码腿 0 红（只有浏览器腿能抓，配 mut-smoke36 的同名变异成对读）');
    } else {
      anomalies++;
      console.log('异常  ' + name + '  本条应「源码腿全绿」，实际红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
    }
    return;
  }
  const hit = s36.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §36 红 ' + s36.length + ' 条（总红 ' + lines.length + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 140));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
function run(name, file, from, to, token, wantCount) {
  const src = ORIG[file], F = eol(from, file);
  const n = src.split(F).length - 1;
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
  judge(name, file, src.replace(F, () => eol(to, file)), token);
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
/* greenCase：设计内静默样本（源码腿必须全绿） */
function greenCase(name, file, from, to) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  from 串不是恰 1 处（' + src.split(F).length - 1 + '），静默样本没打上');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), null, true);
}
/* dropAnchors：只在 A36 数组区段内删前 count 条锚点行（marker 若不限区段会删到别的节，
   §34 那条「把门拆了读成全绿」的坑就是这么来的） */
function dropAnchors(name, count, token) {
  const file = 'tools/verify.js', src = ORIG[file], nl = EOL(file);
  const a = src.indexOf('const A36 = [');
  const b = src.indexOf(nl + '  ];', a);
  if (a < 0 || b < 0) {
    total++; anomalies++;
    console.log('异常  ' + name + '  定位不到 A36 区段');
    return;
  }
  const head = src.slice(0, a), mid = src.slice(a, b), tail = src.slice(b);
  const lines = mid.split(nl);
  let dropped = 0;
  const kept = lines.filter(l => {
    if (dropped < count && /^\s+\['/.test(l)) { dropped++; return false; }
    return true;
  });
  if (dropped < count) {
    total++; anomalies++;
    console.log('异常  ' + name + '  A36 区段里只找到 ' + dropped + ' 条锚点行，凑不齐 ' + count);
    return;
  }
  judge(name, file, head + kept.join(nl) + tail, token);
}

/* ============ ① 三件套与弹层入口：单点被复制／被绕过 ============ */
run('M1 trapFocus 定义改名（导出串与调用点同时断）', 'ui.js',
  'function trapFocus(container, sel) {', 'function trapFocus2(container, sel) {', 'function trapFocus(container, sel)');
run('M2 confirm 自带一套 Tab 逻辑（回到批次 22 之前的两份 trap）', 'ui.js',
  "var trap = trapFocus(m, 'button');", 'var trap = function () { return false; };', 'confirm 走单点');
run('M3 sheet 不走单点（弹层重新没有 Tab 圈定）', 'ui.js',
  'trap = trapFocus(el, opts.focus);', 'trap = function () { return false; };', 'sheet 走同一个单点');
run('M4 markerLabel 定义改名（各页调用点全哑）', 'ui.js',
  'function markerLabel(m, label) {', 'function markerLabel2(m, label) {', 'function markerLabel(m, label)');
run('M5 markerKeys 定义改名', 'ui.js',
  'function markerKeys(m, fn) {', 'function markerKeys2(m, fn) {', 'function markerKeys(m, fn)');
run('M6 sheet 定义改名', 'ui.js',
  'function sheet(el, opts) {', 'function sheet2(el, opts) {', 'function sheet(el, opts)');
run('M7 导出漏一个（页面调不到，只有运行时才红——所以必须钉导出串）', 'ui.js',
  'sheet: sheet, markerLabel: markerLabel, markerKeys: markerKeys, trapFocus: trapFocus',
  'sheet: sheet, markerLabel: markerLabel, trapFocus: trapFocus', '四个新单点都在导出串上');
run('M8 控制器缓存读的那半摘掉（重复 UI.sheet(el) 叠监听器）', 'ui.js',
  'if (el.__uiSheet) return el.__uiSheet;', 'if (false) return el.__uiSheet;', '控制器缓存在元素上');
run('M9 控制器缓存写的那半摘掉（与 M8 成对：只留一条＝没有缓存）', 'ui.js',
  '    el.__uiSheet = api;\n', '', '缓存写入点');
run('M10 键位幂等旗子摘掉', 'ui.js',
  '      el.__uiKeys = 1;\n', '', '键位幂等旗子');
run('M11 绑定处的幂等判定摘掉（同一节点绑两遍，Enter 一次触发两层开层）', 'ui.js',
  'if (!el || !el.addEventListener || el.__uiKeys) return;', 'if (!el || !el.addEventListener) return;', '绑定的幂等判定本身');

/* ============ ② trapFocus 的清单过滤：批次 22 实测缺陷之一 ============ */
run('M12 SVG 过滤摘掉（<use href> 混进清单当 last，Tab 第三次就跑到 tabbar）', 'ui.js',
  "        if (n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;\n", '', '清单要跳 SVG');
run('M13 禁用按钮过滤摘掉（另一种按不动的 last）', 'ui.js',
  "        if (n.disabled || n.getAttribute && n.getAttribute('disabled') !== null) continue;\n", '', '禁用按钮同样聚焦不上');
run('M14 过滤结果直接复用 NodeList（过滤了个寂寞）', 'ui.js',
  '      var f = [];', '      var f = Array.prototype.slice.call(nodes);', 'var f = []');
run('M15 入队口删掉（清单永远空）', 'ui.js',
  '        f.push(n);\n', '', '入队只在这一处');
run('M16 空清单也拦（没控件的弹层把 Tab 焊死在里面）', 'ui.js',
  '      if (!f.length) return false;', '      if (!f.length) { e.preventDefault(); return true; }', '空清单不拦');
run('M17 first/last 取在过滤之前（过滤照样跑，但 last 已是过滤前的死节点）', 'ui.js',
  '      var f = [];\n      for (var i = 0; i < nodes.length; i++) {',
  '      var f = [];\n      var first = f[0], last = f[f.length - 1];\n      for (var i = 0; i < nodes.length; i++) {',
  'trapFocus 的 SVG/禁用过滤不在 first/last 取值之前');

/* ============ ③ aria-live：全站只由 ui.js 的五个组件造 ============ */
run('M18 toast 的活区属性摘掉（提示音全无，界面照常）', 'ui.js',
  "    d.setAttribute('aria-live', 'polite');\n    document.body.appendChild(d);\n    requestAnimationFrame(function () {\n      d.appendChild(document.createTextNode(msg));",
  '    document.body.appendChild(d);\n    requestAnimationFrame(function () {\n      d.appendChild(document.createTextNode(msg));',
  '四个 polite 活区');
run('M19 错误卡从 assertive 降成 polite（出错那句被排在等待之后）', 'ui.js',
  '\'<div class="ui-errorbox" role="alert" aria-live="assertive">\'',
  '\'<div class="ui-errorbox" role="alert" aria-live="polite">\'', '错误卡整串');
run('M20 ui.js 里多出第六处 aria-live（组件外私搭活区的形状）', 'ui.js',
  "    d.className = 'ui-toast';\n    d.setAttribute('role', 'status');",
  "    d.className = 'ui-toast';\n    d.setAttribute('aria-live', 'polite');\n    d.setAttribute('role', 'status');",
  'aria-live 恰 5 处');
run('M21 页面侧自己搭活区（design.css 出现 aria-live）', 'design.css',
  '.theme-dark :focus-visible{outline-color:var(--brand-600)}',
  '.theme-dark :focus-visible{outline-color:var(--brand-600)}\n[aria-live="polite"]{outline-offset:1px}',
  'design.css 里出现 aria-live');
run('M22 提醒条 nudge 退回带文案一次插入（读屏当静态内容，一个字不播）', 'ui.js',
  "    requestAnimationFrame(function () {\n      var msg = document.createElement('span');",
  '    (function () {\n      var msg = document.createElement(\'span\');',
  'nudge 不再满足');
run('M23 离线条的 aria-live 摘掉（常驻状态没有活区）', 'ui.js',
  "      bar.setAttribute('aria-live', 'polite');\n", '', 'offlineBar 里三件套');
run('M24 错误卡的空槽改成建区就带字（两步时序失去意义）', 'ui.js',
  '\'<div class="eb-t"></div><div class="eb-d"></div>\'',
  '\'<div class="eb-t">加载失败</div><div class="eb-d"></div>\'', '建区时标题/正文是两只空槽');

/* ============ ④ sheet 语义：dialog / modal / expanded / tabindex / 名字归属 ============ */
run('M25 role 覆盖页面已写的 role', 'ui.js',
  "if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');",
  "el.setAttribute('role', 'dialog');", 'role=dialog 只在这一处补');
run('M26 aria-modal 不分真模态全挂（景点卡升起时地图照样能点，报「外面不可达」是谎报）', 'ui.js',
  "if (opts.modal) el.setAttribute('aria-modal', 'true');",
  "el.setAttribute('aria-modal', 'true');", 'aria-modal 只给真模态');
run('M27 关闭不摘 aria-modal（到下一次开之间整页读屏不可达）', 'ui.js',
  "        el.removeAttribute('aria-modal');\n", '', 'sheet.close 没摘 aria-modal');
run('M28 开启不标 aria-expanded=true', 'ui.js',
  "        if (opener) opener.setAttribute('aria-expanded', 'true');\n", '', '开启态给触发元素标 expanded');
run('M29 关闭不回落 aria-expanded（读屏一直报「已展开」）', 'ui.js',
  "          opener.setAttribute('aria-expanded', 'false');\n", '', 'sheet.close 没回落 aria-expanded');
run('M30 摘掉「已开着只换内容」守卫（二次 open 重记 opener／焦点／监听）', 'ui.js',
  '        if (api.isOpen()) return;\n', '', 'sheet.open 里没有 isOpen 守卫');
run('M31 守卫排在 aria-modal 与 add 之后（顺序错＝二次 open 照样走一遍开层流程）', 'ui.js',
  '        if (api.isOpen()) return;\n        if (opts.modal) el.setAttribute(\'aria-modal\', \'true\');\n        opener = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;\n        if (opener) opener.setAttribute(\'aria-expanded\', \'true\');\n        el.classList.add(cls);',
  '        if (opts.modal) el.setAttribute(\'aria-modal\', \'true\');\n        opener = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;\n        if (opener) opener.setAttribute(\'aria-expanded\', \'true\');\n        el.classList.add(cls);\n        if (api.isOpen()) return;',
  'sheet.open 的 isOpen 守卫没有排在 aria-modal 与 classList.add 之前');
run('M32 别的路径关层后监听器不回收（文档上越积越多）', 'ui.js',
  '          if (!api.isOpen()) { detach(); return; }   /* 别的路径关掉的：监听器自我回收，不留在文档上 */\n', '', 'detach(); return;');
run('M33 焦点不落进弹层（读屏从头念，弹层里没按钮时焦点丢回 body）', 'ui.js',
  "        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');\n", '', '焦点落进弹层');
run('M34 页面写死的 aria-label 被覆盖（近邻面板那句「这一带还有什么」没了）', 'ui.js',
  "var pageLabel = !!el.getAttribute('aria-label');", 'var pageLabel = false;', '页面建好就写死的名字归页面管');
run('M35 开层 class 写两处（路径分叉）', 'ui.js',
  '        el.classList.add(cls);\n        trap = trapFocus(el, opts.focus);',
  '        el.classList.add(cls);\n        el.classList.add(cls);\n        trap = trapFocus(el, opts.focus);',
  '开层路径分叉');
run('M36 关层 class 写两处', 'ui.js',
  "        el.classList.remove(cls);\n        el.removeAttribute('aria-modal');",
  "        el.classList.remove(cls);\n        el.classList.remove(cls);\n        el.removeAttribute('aria-modal');",
  '关层路径分叉');
run('M37 Esc 分支摘掉（键盘进得去出不来）', 'ui.js',
  "          if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }\n", '', 'Esc 关弹层');
run('M38 cls 默认值写死 show（抽屉传 open 失效）', 'ui.js',
  "var cls = opts.cls || 'show';", "var cls = 'show';", '开合仍认同一个 class');

/* ============ ⑤ 焦点归还：认「还活着的那一枚」 ============ */
run('M39 isConnected 判定摘掉（opener 已被 setIcon 换掉，focus() 静默失败、焦点落 body）', 'ui.js',
  '          if (!back.isConnected) {', '          if (false) {', 'sheet.close 没有 isConnected 判定');
run('M40 按名字找回替代标记那半摘掉', 'ui.js',
  "var want = back.getAttribute && back.getAttribute('aria-label');", 'var want = null;', '按名字找回同一站点的替代标记');
run('M41 兜底交还地图容器摘掉（焦点从页首重新 Tab）', 'ui.js',
  "document.querySelector('.leaflet-container') || null;", 'null;', '都找不到就交还地图容器');

/* ============ ⑥ 日卡结构：planner 与只读分享页同一套口径 ============ */
run('M42 列表容器名不带「共 N 天」（列表报得出却报不出长度）', 'planner.js',
  '<div class="day-list" role="list" aria-label="\' + esc(trip.name || \'行程安排\') + \'，共 \' + days.length + \' 天">',
  '<div class="day-list" role="list" aria-label="\' + esc(trip.name || \'行程安排\') + \'">', 'day-list');
run('M43 常规卡漏 role=listitem（漏一张就有一天的内容读屏跳不过去）', 'planner.js',
  '<div class="day-card" role="listitem" aria-label="\'', '<div class="day-card" aria-label="\'', '常规卡 listitem');
run('M44 转场卡名字不写「赶路日」（读屏只念得出 0 站）', 'planner.js',
  "var tl = '第 ' + (di + 1) + ' 天，赶路日，约 '", "var tl = '第 ' + (di + 1) + ' 天，约 '", '转场日名字');
run('M45 分享页列表容器不带「共 N 天」', 'share.html',
  '<div class="day-list" role="list" aria-label="\' + esc(p.t || \'我的行程\') + \'，共 \' + (p.days || []).length + \' 天">',
  '<div class="day-list" role="list" aria-label="\' + esc(p.t || \'我的行程\') + \'">', 'day-list');
run('M46 分享页常规卡漏 role=listitem', 'share.html',
  '<div class="day-card" role="listitem" aria-label="\'', '<div class="day-card" aria-label="\'', '常规卡 listitem');
run('M47 design.css 里多出第 4 条 :focus-visible（本批「零新增 CSS」的账漂了）', 'design.css',
  '.theme-dark :focus-visible{outline-color:var(--brand-600)}',
  '.theme-dark :focus-visible{outline-color:var(--brand-600)}\n.mut-extra:focus-visible{outline:2px solid red}',
  '焦点环仍只有已在案的三条');

/* ============ ⑦ 接线与入口的数量表：整页漏接只有表能抓 ============ */
run('M48 topic-common 重画补名整条摘掉（点开一趟景点卡回来全图标记集体失名）', 'topic-common.js',
  '      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }\n', '', '重画后补名');
/* node-lod 三处 markerKeys 的缩进有两处相同（8 空格），而 10 空格那一处又包含 8 空格串：
   单行 needle 会撞出 3 个命中（§36 的教训「子串碰撞」）。聚合胶囊这条要连它上面那行标签一起锚。 */
const CLUSTER36 = "        if (window.UI) UI.markerLabel(m, lbl + ' ' + n + ' 处' + (dim ? '，当前筛选没有匹配' : '，点击查看这一片'));\n        if (window.UI) UI.markerKeys(m, act);";
run('M49 node-lod 第三条绘制路径漏接键位（聚合胶囊 Tab 停得下来打不开）', 'node-lod.js',
  CLUSTER36,
  "        if (window.UI) UI.markerLabel(m, lbl + ' ' + n + ' 处' + (dim ? '，当前筛选没有匹配' : '，点击查看这一片'));",
  '三条绘制路径都接键盘');
run('M50 travel-notes 两处漏一处', 'travel-notes.js',
  "      if (window.UI) { UI.markerLabel(m, (n.title || n.siteName || '随手记') + '，' + (n.date || '')); UI.markerKeys(m, function () { m.openPopup(); }); }",
  "      if (window.UI) { UI.markerLabel(m, (n.title || n.siteName || '随手记') + '，' + (n.date || '')); }", '随手记两处');
run('M51 story 针脚多接一个 Enter（点了没反应比按不动更糟，登记表要如实反映）', 'story.html',
  '    if(window.UI) UI.markerLabel(mk,', '    if(window.UI) UI.markerKeys(mk, function(){});\n    if(window.UI) UI.markerLabel(mk,', '游记针脚只有装饰意义');
run('M52 多建一枚标记但没接可达（全站 15 处的账不平）', 'wishlist.html',
  'UI.markerKeys(m, function () { m.openPopup(); });',
  'UI.markerKeys(m, function () { m.openPopup(); }); var __extraMk = L.marker([0, 0]);', 'wishlist.html 的 L.marker( 数');
run('M53 topic-common 多出第 8 个弹层入口（「开合只有一个入口」被破）', 'topic-common.js',
  "function closeArrive() { UI.sheet($('arriveDlg')).close(); }",
  "function closeArrive() { UI.sheet($('arriveDlg')).close(); UI.sheet($('arriveDlg')).close(); }", 'topic-common.js 的 UI.sheet( 调用点数');
run('M54 随手记的面板混用 sheet（两套口径焊在一起）', 'travel-notes.js',
  'window.Ai = (function () {', 'window.Ai = (function () {\n  if (false) UI.sheet(document.body);', 'travel-notes.js 里出现了 UI.sheet(');

/* ============ ⑧ 重画补名的顺序：补在 setIcon 之前等于没补 ============ */
run('M55 补名排在 setIcon 之前（Leaflet 1.1.1 无 iconchange，补在旧节点上）', 'topic-common.js',
  '      m.setIcon(nodeIcon(SITES[idx], idx === i));\n      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }',
  '      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }\n      m.setIcon(nodeIcon(SITES[idx], idx === i));',
  '没有排在 setIcon 之后');
run('M56 setIcon 写两遍（体内恰 1 次的账不平）', 'topic-common.js',
  '      m.setIcon(nodeIcon(SITES[idx], idx === i));',
  '      m.setIcon(nodeIcon(SITES[idx], idx === i));\n      m.setIcon(nodeIcon(SITES[idx], idx === i));', '重画单点');

/* ============ ⑨ 期望 0 的十七族：旧写法回潮 ============ */
run('M57 ui.js 回潮 aria-hidden（CSS 与 aria 两套状态迟早自相矛盾）', 'ui.js',
  "        el.removeAttribute('aria-modal');",
  "        el.removeAttribute('aria-modal'); el.setAttribute('aria-hidden', 'true');", 'ui.js 里出现「aria-hidden」');
run('M58 ui.js 回潮 inert', 'ui.js',
  "        el.removeAttribute('aria-modal');",
  "        el.removeAttribute('aria-modal'); el.inert = true;", 'ui.js 里出现「inert」');
run('M59 node-lod 自搭 aria-label（绕开单点，重画后没人补回）', 'node-lod.js',
  CLUSTER36,
  "        if (window.UI) UI.markerLabel(m, lbl + ' ' + n + ' 处' + (dim ? '，当前筛选没有匹配' : '，点击查看这一片'));\n        m._icon.setAttribute('aria-label', lbl);\n        if (window.UI) UI.markerKeys(m, act);",
  "node-lod.js 里出现「setAttribute('aria-label'");
run('M60 node-lod 自挂 keydown（幂等旗子在单点那里）', 'node-lod.js',
  CLUSTER36,
  "        if (window.UI) UI.markerLabel(m, lbl + ' ' + n + ' 处' + (dim ? '，当前筛选没有匹配' : '，点击查看这一片'));\n        document.addEventListener('keydown', function (e) { if (e.key === 'Enter') act(); });\n        if (window.UI) UI.markerKeys(m, act);",
  "node-lod.js 里出现「addEventListener('keydown'");
run('M61 topic-common 页面自己挂 Esc（两份监听器＝Esc 要按两下才关）', 'topic-common.js',
  '  function hideNearSheet()',
  "  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });\n  function hideNearSheet()", "topic-common.js 里出现「addEventListener('keydown'");
run('M62 景点卡回潮裸 classList 开关（没有 role／没有 Esc／焦点留在地图上）', 'topic-common.js',
  "    UI.sheet($('locSheet')).close();",
  "    $('locSheet').classList.add('show');\n    UI.sheet($('locSheet')).close();", "$('locSheet').classList.add('show')");
run('M63 node-manager 旧弹层裸开关回潮', 'node-manager.html',
  "function closeSheets() { UI.sheet($('rsSheet')).close();",
  "function closeSheets() { $('rsSheet').classList.add('show'); UI.sheet($('rsSheet')).close();", "$('rsSheet').classList");
run('M64 travel-map 记忆抽屉裸开关回潮', 'travel-map.html',
  "  UI.sheet(document.getElementById('memSheet')).close();",
  "  document.getElementById('memSheet').classList.add('show');\n  UI.sheet(document.getElementById('memSheet')).close();", "memSheet').classList.add('show')");
run('M65 topic.html 壳层兜底不走 sheet（关了层还留着 aria-modal／expanded）', 'topic.html',
  "if (d && window.UI) UI.sheet(d).close();",
  "if (d) d.classList.remove('show'); if (d && window.UI) UI.sheet(d).close();", "arriveDlg'); if (d) d.classList.remove('show')");

/* ============ ⑩ 守门的门：锚点表 / 四元组 / 登记 / 齐备检 ============ */
dropAnchors('M66 A36 锚点表被削减 12 条（整组删掉＝这节没了，但它只是少几行）', 12, '锚点表被削减');
run('M67 四元组形状破掉（期望次数写成字符串＝这条锚静默跳过）', 'tools/verify.js',
  "['ui.js', 'el.__uiKeys = 1;', 1,", "['ui.js', 'el.__uiKeys = 1;', '1',", '四元组');
run('M68 A36 登记了 §36 没读的文件（一条锚一次都没跑过）', 'tools/verify.js',
  "['design.css', ':focus-visible', 3,", "['map.css', ':focus-visible', 3,", '登记了 §36 没读的文件');
runAll('M69 README 抹掉 §36 登记（新闸门不写进 README 就等于没装）', 'README.md', '§36', '§叁6', 'README.md 的 verify 清单没提 §36');
run('M70 判据改名成 A16x（齐备检按「id + 空格」认，要红）', 'tools/smoke-aria.js',
  "ok('A16 ", "ok('A16x ", '缺 A16 这条判据');
run('M71 复制一条判据（条数守卫：整组被灌水也是漂移）', 'tools/smoke-aria.js',
  "  ok('E01 ", "  ok('E01 全程零页面未捕获异常（可达属性不许把任何一页改崩）', true, '');\n  ok('E01 ", '判据条数不是 46');
run('M72 快照口径退回默认（interestingOnly:true 把 generic 列表容器剪掉，D 组量出来全 0）', 'tools/smoke-aria.js',
  'interestingOnly: false', 'interestingOnly: true', '没有 interestingOnly: false');
run('M73 S 组退回 Share.build（file:// 走 no-base 降级，返回值里根本没有 hash 字段＝整组恒不跑）', 'tools/smoke-aria.js',
  '{ hash: window.Share.encodePayload(window.Share.payloadOf(t)) }', '{ hash: (window.Share.build(t) || {}).hash }', 'S 组没有直接编 hash');
run('M74 §36 少读一个文件（design.css 的 :focus-visible 锚从此不再跑）', 'tools/verify.js',
  "const FILES36 = ['ui.js', 'design.css',", "const FILES36 = ['ui.js',", '登记了 §36 没读的文件');

/* toast 的「先空插入、下一帧写字」退回一次插入：两层顺序断言真正抓住的那条 */
run('M78 toast 把文案写进插入前的节点（活区带字进场，读屏当静态内容）', 'ui.js',
  '    document.body.appendChild(d);\n    requestAnimationFrame(function () {\n      d.appendChild(document.createTextNode(msg));',
  '    d.appendChild(document.createTextNode(msg));\n    document.body.appendChild(d);\n    requestAnimationFrame(function () {',
  'toast 不再满足');

/* ============ ⑪ 守门的门之二：合成对照自己坏掉时必须说话 ============ */
run('M75 两步时序的反向对照改成正确形状（合成源不再触发它＝那条红是空的）', 'tools/verify.js',
  "const BAD = flat36(\"function f(msg) { var d = document.createElement('div'); d.appendChild(document.createTextNode(msg)); d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); }\");",
  "const BAD = flat36(\"function f(msg) { var d = document.createElement('div'); d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); requestAnimationFrame(function () { d.appendChild(document.createTextNode(msg)); }); }\");",
  '反向对照失效');
run('M76 trap 顺序断言的反向对照改成正确顺序', 'tools/verify.js',
  "const BADT = flat36(\"function trapFocus(container, sel) { var f = []; var first = f[0], last = f[f.length - 1]; var n = nodes[0]; if (n.namespaceURI !== 'http://www.w3.org/1999/xhtml') { continue; } }\");",
  "const BADT = flat36(\"function trapFocus(container, sel) { var f = []; var n = nodes[0]; if (n.namespaceURI !== 'http://www.w3.org/1999/xhtml') { continue; } f.push(n); var first = f[0], last = f[f.length - 1]; }\");",
  '反向对照失效');
run('M77 期望 0 的正向对照串里抹掉 needle（那个 0 从此不是证据）', 'tools/verify.js',
  "['ui.js', 'aria-hidden', 'el.setAttribute(\\'aria-hidden\\', \\'true\\');',",
  "['ui.js', 'aria-hidden', 'el.setAttribute(\\'aria-atomic\\', \\'true\\');',", '期望 0 的正向对照失效');

/* ============ ⑫ 设计内静默：源码腿抓不到、只有浏览器腿抓得到 ============ */
/* 这三条是「同一变异两层视野差」的样本：源码腿必须全绿，mut-smoke36.js 的 B7–B9 必须红。
   共同点：字面量一根没动，退化发生在函数体内部的求值结果上。 */
greenCase('G1 UI.esc 恒返回空串（日卡 aria-label 实测全空，而 §36 钉的每条字面量都还在）', 'ui.js',
  "    return String(s == null ? '' : s)\n      .replace", "    return ''\n      .replace");
greenCase('G2 siteAria 恒返回空串（标记名全空，调用点的字面量一根没动）', 'topic-common.js',
  '  function siteAria(s) {\n    var bits = [s.label || s.name];',
  "  function siteAria(s) {\n    return '';\n    var bits = [s.label || s.name];");
greenCase('G3 markerLabel 的赋值行不执行（单点还在、导出还在，名字从来没写上去）', 'ui.js',
  "if (el && el.setAttribute) el.setAttribute('aria-label', label);",
  "if (el && el.setAttribute && label.length < 0) el.setAttribute('aria-label', label);");

console.log('源码腿小结: 共 ' + total + ' 条 → 按预期红 ' + red + ' · 设计内静默 ' + silent + ' · 异常 ' + anomalies);
process.exit(anomalies ? 1 : 0);
