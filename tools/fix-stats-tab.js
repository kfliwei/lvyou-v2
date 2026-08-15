/* switchTab：非地图 tab 隐藏「当前区域」统计条，回地图自动恢复 */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = `  function switchTab(tab) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    $(tab).classList.add('active');
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (tab === 'map') { setTimeout(function () { map.invalidateSize(); }, 60); autoLocate(); }
  }`;
const to = `  function switchTab(tab) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    $(tab).classList.add('active');
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    /* 「当前区域」统计条仅地图 tab 显示（2026-08-15） */
    if (statEl) statEl.style.display = (tab === 'map') ? 'flex' : 'none';
    if (tab === 'map') { setTimeout(function () { map.invalidateSize(); }, 60); autoLocate(); scheduleRegionStats(); }
  }`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('switchTab stats visibility ok');
} else console.log('SKIP');
