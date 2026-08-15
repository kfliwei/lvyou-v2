/* 多图查看器 + 日历视图样式（map.css） */
const fs = require('fs');
let m = fs.readFileSync('map.css', 'utf8');
const crlf = m.includes('\r\n');
if (crlf) m = m.replace(/\r\n/g, '\n');
const css = `
/* ============================================================
   多图查看器 + 日历视图 2026-08-15
   ============================================================ */
.tn-viewer{position:fixed;inset:0;z-index:9900;background:rgba(12,12,10,.95);display:flex;align-items:center;justify-content:center;animation:tnPickFade .18s ease}
.tn-viewer img{max-width:100%;max-height:84vh;object-fit:contain;border-radius:8px}
.tn-viewer-x{position:absolute;top:calc(env(safe-area-inset-top,0px)+14px);right:16px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer}
.tn-viewer-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:26px;cursor:pointer}
.tn-viewer-nav.l{left:12px}.tn-viewer-nav.r{right:12px}
.tn-viewer-i{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px)+18px);left:50%;transform:translateX(-50%);color:#fff;font-size:12.5px;background:rgba(255,255,255,.14);border-radius:999px;padding:5px 14px}
.tn-cal-head{display:flex;align-items:center;gap:8px;padding:10px 4px}
.tn-cal-head b{flex:1;font-family:var(--font-serif);font-weight:400;font-size:15px;color:var(--color-ink)}
.tn-cal-nav{width:36px;height:36px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-surface);color:var(--color-ink);font-size:18px;cursor:pointer}
.tn-cal-today{min-height:34px;padding:0 12px;border:1px solid var(--color-line);border-radius:999px;background:var(--color-surface);color:var(--color-ink-soft);font-size:12px;cursor:pointer}
.tn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:4px 0}
.tn-cal-w{text-align:center;font-size:11px;color:var(--color-muted);padding:4px 0}
.tn-cal-d{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:12.5px;color:var(--color-ink);border-radius:10px;position:relative;cursor:pointer;border:1px solid transparent}
.tn-cal-d.empty{visibility:hidden}
.tn-cal-d.has{background:var(--color-primary-soft);color:var(--color-primary-dark);font-weight:600;border-color:rgba(200,109,75,.25)}
.tn-cal-d.has i{position:absolute;bottom:3px;font-style:normal;font-size:9px;background:var(--color-primary);color:#fff;border-radius:999px;min-width:14px;height:14px;line-height:14px;text-align:center;padding:0 3px}
.tn-cal-d.today{outline:2px solid rgba(200,109,75,.4)}
.tn-cal-day{border-top:1px solid var(--color-line);margin-top:8px;padding-top:8px}
.tn-cal-day-t{font-family:var(--font-serif);font-size:14px;color:var(--color-ink);margin-bottom:6px}
.tn-cal-item{border:1px solid var(--color-line);border-radius:14px;padding:12px 14px;margin-bottom:10px}
.tn-cal-item h4{font-family:var(--font-serif);font-size:15px;color:var(--color-ink);margin:0 0 4px}
.theme-dark .tn-cal-nav,.theme-dark .tn-cal-today{background:var(--color-surface);border-color:var(--color-line);color:var(--color-ink)}
.theme-dark .tn-cal-d{color:var(--color-ink)}
`;
if (!m.includes('.tn-viewer{')) {
  fs.writeFileSync('map.css', crlf ? (m + css).replace(/\n/g, '\r\n') : m + css, 'utf8');
  console.log('viewer+calendar css added');
} else console.log('exists');
