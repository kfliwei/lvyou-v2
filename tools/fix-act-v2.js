/* .act 按钮 v2 化（专题页/足迹地图顶栏【随手记】【游记】统一为毛玻璃胶囊） */
const fs = require('fs');
let m = fs.readFileSync('map.css', 'utf8');
const crlf = m.includes('\r\n');
if (crlf) m = m.replace(/\r\n/g, '\n');
const from = `.t-row .act{
  flex:0 0 auto;height:34px;padding:0 11px;border:0;border-radius:9px;
  background:var(--cinnabar-500);color:var(--paper-50);
  font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;
  font-family:var(--font-display);box-shadow:0 2px 6px rgba(0,0,0,.18);
  transition:transform .12s;
}
.t-row .act:active{transform:scale(.94)}
.t-row .act.sec{background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}`;
const to = `.t-row .act{
  flex:0 0 auto;min-height:44px;padding:0 16px;border:0;border-radius:999px;
  background:var(--color-primary,#c86d4b);color:#fff;
  font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px;
  font-family:var(--font-sans);box-shadow:0 4px 14px rgba(200,109,75,.25);
  transition:transform .12s var(--ease-standard);cursor:pointer;
}
.t-row .act:active{transform:scale(.94)}
.t-row .act.sec{background:var(--color-surface,#fffdf8);color:var(--color-ink-soft);box-shadow:inset 0 0 0 1px var(--color-line-strong)}
.theme-dark .t-row .act{background:var(--color-primary);color:#fff}
.theme-dark .t-row .act.sec{background:var(--color-surface);color:var(--color-ink-soft);box-shadow:inset 0 0 0 1px var(--color-line-strong)}`;
if (m.includes(from)) {
  m = m.split(from).join(to);
  fs.writeFileSync('map.css', crlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
  console.log('act → v2 capsule');
} else console.log('SKIP (pattern)');
