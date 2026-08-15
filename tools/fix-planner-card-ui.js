/* 修复：排期结果卡 v2 化（day-card 卡片化 + 内部元素打磨 + 深色适配） */
const fs = require('fs');
let s = fs.readFileSync('planner.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const css = `
/* ============================================================
   排期结果卡 v2 化（2026-08-15：宣纸卡片 + 16px 圆角 + 柔和阴影）
   ============================================================ */
.day-card{background:var(--color-surface);border:1px solid var(--color-line);border-radius:16px;box-shadow:0 6px 18px rgba(40,38,32,.06);padding:14px 15px;margin-bottom:14px}
.day-card .dhead{border-bottom:1px solid var(--color-line);padding-bottom:9px;margin-bottom:9px}
.day-card .dhead b{font-family:var(--font-serif);font-size:16px;font-weight:600;letter-spacing:.03em}
.day-card .dhead span{font-size:11.5px;color:var(--color-muted)}
.day-card .stop{border-radius:10px;padding:6px 6px;transition:background .15s}
.day-card .stop:active{background:var(--color-bg-soft)}
.day-card .stop .n{flex:0 0 20px;height:20px;border-radius:7px;background:var(--color-primary-soft);color:var(--color-primary-dark);font-size:11px;font-weight:600;display:inline-grid;place-items:center}
.day-card .stop.done{opacity:.55}
.day-card .stop .meta{font-size:11px;color:var(--color-muted)}
.day-card .warnline{background:rgba(200,109,75,.08);border:1px solid rgba(200,109,75,.18);color:var(--color-primary-dark)}
.day-card .mv{width:30px;height:30px}
.theme-dark .day-card{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .day-card .dhead{border-bottom-color:var(--color-line)}
.theme-dark .day-card .stop .n{background:var(--color-primary-soft);color:var(--color-primary-dark)}
`;
if (!s.includes('排期结果卡 v2 化')) {
  const styleEnd = s.indexOf('</style>');
  if (styleEnd > 0) {
    s = s.slice(0, styleEnd) + css + s.slice(styleEnd);
    fs.writeFileSync('planner.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
    console.log('day-card v2 css added');
  } else console.log('style end not found');
} else console.log('exists');
