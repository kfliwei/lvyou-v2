/* travel-map 内联 .act 升级为 v2 胶囊（该页不引 map.css，需自带） */
const fs = require('fs');
let s = fs.readFileSync('travel-map.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const anchor = `  .t-row .title{flex:1;min-width:0;font-family:var(--font-serif);font-weight:400;font-size:17px;color:var(--color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.02em}`;
const add = `  .t-row .act{flex:0 0 auto;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:var(--color-primary);color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px;font-family:var(--font-sans);box-shadow:0 4px 14px rgba(200,109,75,.25);transition:transform .12s var(--ease-standard);cursor:pointer;letter-spacing:.02em}
  .t-row .act:active{transform:scale(.94)}
  .t-row .act.sec{background:var(--color-surface);color:var(--color-ink-soft);box-shadow:inset 0 0 0 1px var(--color-line-strong)}
  .theme-dark .t-row .act.sec{background:var(--color-surface);color:var(--color-ink-soft);box-shadow:inset 0 0 0 1px var(--color-line-strong)}
`;
if (s.includes(anchor) && !s.includes('.t-row .act{')) {
  s = s.split(anchor).join(anchor + '\n' + add);
  fs.writeFileSync('travel-map.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('travel-map .act v2 inline added');
} else console.log(s.includes('.t-row .act{') ? 'already exists' : 'anchor miss');
