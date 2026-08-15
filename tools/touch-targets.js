/* 修正触控补丁：仅高频/破坏性操作 ≥44px；低频文本（标签/元信息/图例/统计条）保持原样 */
const fs = require('fs');
let s = fs.readFileSync('design.css', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

/* 删除旧补丁块（含低频项） */
const startMark = '/* ============================================================\n   触控目标高标准 2026-08-15';
const endMark = '/* 触控目标高标准 2026-08-15 */';
const si = s.indexOf(startMark);
if (si < 0) { console.log('old block not found'); }
else {
  /* 块结尾：下一个 '/* ====' 或文件尾 */
  const after = s.indexOf('/* ====', si + startMark.length);
  const ei = after > 0 ? after : s.length;
  s = s.slice(0, si) + s.slice(ei);
  console.log('old block removed');
}

/* 新补丁：仅高频/破坏性操作 */
const block = `/* ============================================================
   触控目标高标准 2026-08-15：仅高频/破坏性操作 ≥44px（低频标签/元信息保持原样）
   ============================================================ */
.t-row .back,.story-bar .back,.nm-topbar .back{width:44px!important;height:44px!important;min-width:44px;min-height:44px;border-radius:50%}
button.act,button.act.sec,button.mine,button.go{min-height:44px}
.sbar .mic{width:44px!important;height:44px!important}
.wl-btn{min-height:44px}
.wl-remove{width:44px!important;height:44px!important}
.nm-item-btn{min-height:44px}
.is-btn{min-height:44px}
.leaflet-control-zoom a,.leaflet-touch .leaflet-control-zoom a{width:44px!important;height:44px!important;line-height:44px!important}
/* 行程条操作（驾驶场景高频） */
.tripbar .mv,.tripbar .x{min-width:40px;min-height:40px;display:inline-grid;place-items:center}
`;
if (!s.includes('仅高频/破坏性操作')) {
  fs.writeFileSync('design.css', crlf ? (s + block).replace(/\n/g, '\r\n') : s + block, 'utf8');
  console.log('revised touch block added');
}
