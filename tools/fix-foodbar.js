/* 修复：美食筛选条不换行（紧凑均分）+ 暗色适配 */
const fs = require('fs');
let m = fs.readFileSync('map.css', 'utf8');
const crlf = m.includes('\r\n');
if (crlf) m = m.replace(/\r\n/g, '\n');
const from = `.foodbar{
  display:flex;gap:8px;padding:9px 12px;flex-wrap:wrap;
  border-bottom:1px solid var(--line);
  position:sticky;top:0;z-index:5;background:#fff;
}
.foodbar input{
  flex:1 1 140px;height:38px;padding:0 12px;border:1px solid var(--line);
  border-radius:9px;font-size:13px;background:var(--bg);
  font-family:var(--font-serif);
}
.foodbar select{
  height:38px;padding:0 9px;border:1px solid var(--line);
  border-radius:9px;font-size:13px;background:var(--bg);
  font-family:var(--font-serif);
}`;
const to = `.foodbar{
  display:flex;gap:6px;padding:8px 12px;flex-wrap:nowrap;align-items:center;
  border-bottom:1px solid var(--color-line);
  position:sticky;top:0;z-index:5;background:var(--color-surface);
}
.foodbar input{
  flex:1.3 1 70px;min-width:0;height:38px;padding:0 10px;border:1px solid var(--color-line);
  border-radius:9px;font-size:12.5px;background:var(--color-bg-soft);
  font-family:var(--font-sans);color:var(--color-ink);
}
.foodbar select{
  flex:1 1 0;min-width:0;height:38px;padding:0 6px;border:1px solid var(--color-line);
  border-radius:9px;font-size:12px;background:var(--color-bg-soft);
  font-family:var(--font-sans);color:var(--color-ink);overflow:hidden;text-overflow:ellipsis;
}`;
if (m.includes(from)) {
  m = m.split(from).join(to);
  fs.writeFileSync('map.css', crlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
  console.log('foodbar compact ok');
} else console.log('SKIP');
