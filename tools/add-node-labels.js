/* 地图节点加半透明名称标签（zoom ≥ 10 显示，LOD 详细层） */
const fs = require('fs');

/* 1. topic-common.js nodeIcon 加 label */
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = `    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + tint + '"></span><span class="tr-dot"></span>';
    if (f.indexOf('m') >= 0) html += '<span class="tr-seal">必</span>';
    if (num) html += '<span class="node-num">' + num + '</span>';
    html += '</div>';`;
const to = `    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + tint + '"></span><span class="tr-dot"></span>';
    if (f.indexOf('m') >= 0) html += '<span class="tr-seal">必</span>';
    if (num) html += '<span class="node-num">' + num + '</span>';
    /* 半透明名称标签（详细层 zoom ≥ 10 显示；筛选降透明时同步淡化） */
    if (map && map.getZoom() >= 10 && s.label) {
      html += '<span class="node-label' + (dim ? ' dim' : '') + '">' + esc(s.label) + '</span>';
    }
    html += '</div>';`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('OK   topic-common node label');
} else console.log('SKIP topic-common (pattern)');

/* 2. node-manager.html icon 回调加 label */
let m = fs.readFileSync('node-manager.html', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const mFrom = `        if (s.source === 'user') html += '<span class="node-num" style="background:#5F7A4E">我</span>';
        html += '</div>';`;
const mTo = `        if (s.source === 'user') html += '<span class="node-num" style="background:#5F7A4E">我</span>';
        if (map && map.getZoom() >= 10 && s.label) {
          html += '<span class="node-label' + (dim ? ' dim' : '') + '">' + esc(s.label) + '</span>';
        }
        html += '</div>';`;
if (m.includes(mFrom)) {
  m = m.split(mFrom).join(mTo);
  fs.writeFileSync('node-manager.html', mcrlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
  console.log('OK   node-manager label');
} else console.log('SKIP node-manager (pattern)');

/* 3. map.css：node-label 样式（半透明） */
let c = fs.readFileSync('map.css', 'utf8');
const ccrlf = c.includes('\r\n');
if (ccrlf) c = c.replace(/\r\n/g, '\n');
const css = `
/* ============================================================
   节点半透明名称标签 2026-08-15（LOD 详细层 zoom≥10）
   ============================================================ */
.node-label{position:absolute;left:50%;top:calc(100% + 3px);transform:translateX(-50%);font-size:10px;font-weight:500;color:var(--color-ink,#26241f);opacity:.55;white-space:nowrap;font-family:var(--font-sans);pointer-events:none;letter-spacing:.02em;line-height:1.2;text-shadow:0 1px 3px rgba(255,255,255,.75);max-width:120px;overflow:hidden;text-overflow:ellipsis}
.node-label.dim{opacity:.25}
.tr-active .node-label{opacity:.9;font-weight:600}
.tr-user .node-label{opacity:.8;color:#5F7A4E}
.theme-dark .node-label{color:var(--color-ink,#e9e4d8);text-shadow:0 1px 3px rgba(0,0,0,.7)}
`;
if (!c.includes('节点半透明名称标签 2026-08-15')) {
  fs.writeFileSync('map.css', ccrlf ? (c + css).replace(/\n/g, '\r\n') : c + css, 'utf8');
  console.log('OK   map.css label style');
} else console.log('SKIP map.css (exists)');
