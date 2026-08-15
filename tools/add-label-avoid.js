/* 标签避让 ranking：重叠时低优先级隐藏（active > 必去 > 网红 > 用户 > 普通） */
const fs = require('fs');

/* 1. ui.js 追加全局 labelAvoid */
let u = fs.readFileSync('ui.js', 'utf8');
const add = `
/* 标签避让（2026-08-15）：地图名称标签重叠时保留高优先级，低优先级隐藏 */
window.labelAvoid = function (rootSel) {
  var root = document.querySelector(rootSel || '#mapEl');
  if (!root) return;
  var labels = Array.prototype.slice.call(root.querySelectorAll('.node-label'));
  if (labels.length < 2) return;
  function prio(el) {
    var n = el.closest('.tr-node');
    if (!n) return 0;
    if (n.classList.contains('tr-active')) return 9;
    if (n.classList.contains('tr-must')) return 7;
    if (n.classList.contains('tr-hot')) return 6;
    if (n.classList.contains('tr-user')) return 5;
    return 4;
  }
  labels.forEach(function (el) { el.classList.remove('hidden'); });
  labels.sort(function (a, b) { return prio(b) - prio(a); });
  var kept = [];
  labels.forEach(function (el) {
    var r = el.getBoundingClientRect();
    var hit = kept.some(function (k) {
      var kk = k.getBoundingClientRect();
      return !(r.right < kk.left || r.left > kk.right || r.bottom < kk.top || r.top > kk.bottom);
    });
    if (hit) el.classList.add('hidden');
    else kept.push(el);
  });
};
`;
if (!u.includes('window.labelAvoid')) {
  fs.writeFileSync('ui.js', u + add, 'utf8');
  console.log('ui.js labelAvoid added');
} else console.log('exists');

/* 2. map.css：hidden 样式 */
let m = fs.readFileSync('map.css', 'utf8');
const crlf = m.includes('\r\n');
if (crlf) m = m.replace(/\r\n/g, '\n');
if (!m.includes('.node-label.hidden')) {
  m += '\n.node-label.hidden{display:none}\n';
  fs.writeFileSync('map.css', crlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
  console.log('map.css hidden style added');
} else console.log('css exists');

/* 3. topic-common.js：renderMarkers 后调用（防抖 120ms） */
let t = fs.readFileSync('topic-common.js', 'utf8');
const tcrlf = t.includes('\r\n');
if (tcrlf) t = t.replace(/\r\n/g, '\n');
const from = `  function renderMarkers(list) {
    lastMarkerList = list;`;
const to = `  function renderMarkers(list) {
    lastMarkerList = list;
    /* 标签避让（2026-08-15）：重叠隐藏低优先级 */
    clearTimeout(renderMarkers._av);
    renderMarkers._av = setTimeout(function () { if (window.labelAvoid) labelAvoid('#mapEl'); }, 120);`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', tcrlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('topic-common avoid hook added');
} else console.log('SKIP topic-common');
