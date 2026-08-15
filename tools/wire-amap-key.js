/* 接入 tn-key.js + getAmapKey 统一读取 + 防默认省份残留 */
const fs = require('fs');

/* ===== planner.html：引入 tn-key.js（planner.js 前） ===== */
let h = fs.readFileSync('planner.html', 'utf8');
const hcrlf = h.includes('\r\n');
if (hcrlf) h = h.replace(/\r\n/g, '\n');
if (!h.includes('tn-key.js')) {
  const from = '<script src="planner.js"></script>';
  const to = '<script src="tn-key.js"></script>\n  <script src="planner.js"></script>';
  if (h.includes(from)) { h = h.split(from).join(to); fs.writeFileSync('planner.html', hcrlf ? h.replace(/\n/g, '\r\n') : h, 'utf8'); console.log('OK  html 引入 tn-key.js'); }
  else console.log('SKIP html 引入');
} else console.log('html 已有 tn-key.js');
/* 输入框防恢复 */
const h2 = 'id="promptInput"';
if (h.includes(h2) && !h.includes('autocomplete="off"')) {
  const i = h.indexOf(h2);
  const end = h.indexOf('>', i);
  h = h.slice(0, end) + ' autocomplete="off"' + h.slice(end);
  fs.writeFileSync('planner.html', hcrlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
  console.log('OK  promptInput autocomplete off');
} else console.log('SKIP autocomplete');

/* ===== planner.js ===== */
let s = fs.readFileSync('planner.js', 'utf8');
const scrlf = s.includes('\r\n');
if (scrlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. getAmapKey 统一读取（localStorage 优先，自动写入后备） */
rep(
  `  /* 高德真实驾车距离（米→km，缓存） */`,
  `  /* 高德 Key：localStorage 优先，本地文件后备并自动写入 */
  function getAmapKey() {
    try { var k = localStorage.getItem('tn_amap_key'); if (k) return k; } catch (e) {}
    if (window.__TN_AMAP_KEY__) { try { localStorage.setItem('tn_amap_key', window.__TN_AMAP_KEY__); } catch (e) {} return window.__TN_AMAP_KEY__; }
    return '';
  }

  /* 高德真实驾车距离（米→km，缓存） */`,
  '1 getAmapKey 定义'
);

/* 2. 替换所有 tn_amap_key 读取 */
rep(
  `    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb(null); return; }`,
  `    var key = getAmapKey();
    if (!key) { cb(null); return; }`,
  '2 amapRoutePolyline key'
);
rep(
  `    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb(null); return; }`,
  `    var key = getAmapKey();
    if (!key) { cb(null); return; }`,
  '2b amapDriveDist key'
);
rep(
  `    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { toast('未配置高德 Key，无法用高德规划行程（设置页可配置）'); return; }`,
  `    var key = getAmapKey();
    if (!key) { toast('未配置高德 Key，无法用高德规划行程（设置页可配置）'); return; }`,
  '2c plannerAmapPlan key'
);
rep(
  `      } else if (!localStorage.getItem('tn_amap_key') && !routeHintShown) {`,
  `      } else if (!getAmapKey() && !routeHintShown) {`,
  '2d renderMap 提示 key'
);

/* 3. init 防残留：清空输入框（Chrome 表单恢复） */
rep(
  `  function init() {
    renderAISwitch();
    renderDestChips();`,
  `  function init() {
    try { var pi = $id('promptInput'); if (pi && pi.value && !pi.value.trim()) pi.value = ''; } catch (e) {}
    renderAISwitch();
    renderDestChips();`,
  '3 init 防残留'
);

fs.writeFileSync('planner.js', scrlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('planner.js patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 120)); }
