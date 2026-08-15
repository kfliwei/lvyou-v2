/* 修复：地点选择面板暗色模式（背景/卡片/标题/关闭钮变量化） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
const subs = [
  ["sheet.style.cssText = 'width:100%;max-width:560px;background:linear-gradient(175deg,#FAF6EC 0%,#F1EAD9 100%);border-radius:26px 26px 0 0;",
   "sheet.style.cssText = 'width:100%;max-width:560px;background:var(--color-surface);border-radius:26px 26px 0 0;", 'sheet bg'],
  ["'<div style=\"flex:1;min-width:0\"><b style=\"display:block;font-family:&quot;Songti SC&quot;,serif;font-size:17px;font-weight:600;color:#26241F;letter-spacing:.03em\">记录地点</b>'",
   "'<div style=\"flex:1;min-width:0\"><b style=\"display:block;font-family:&quot;Songti SC&quot;,serif;font-size:17px;font-weight:600;color:var(--color-ink);letter-spacing:.03em\">记录地点</b>'", 'head title'],
  ["'<button id=\"placePickerClose\" style=\"width:34px;height:34px;border:0;border-radius:50%;background:rgba(38,36,31,.06);color:#6B665C;font-size:14px;",
   "'<button id=\"placePickerClose\" style=\"width:34px;height:34px;border:0;border-radius:50%;background:var(--color-bg-soft);color:var(--color-muted);font-size:14px;", 'close btn'],
  ["cur.style.cssText = 'display:flex;align-items:center;gap:12px;margin:2px 0 12px;padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.78);border:1px solid rgba(200,109,75,.18);",
   "cur.style.cssText = 'display:flex;align-items:center;gap:12px;margin:2px 0 12px;padding:13px 14px;border-radius:16px;background:var(--color-bg-soft);border:1px solid rgba(200,109,75,.18);", 'cur card']
];
subs.forEach(function (it) {
  if (t.includes(it[0])) { t = t.split(it[0]).join(it[1]); n++; console.log('OK  ', it[2]); }
  else console.log('SKIP', it[2]);
});
fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('patches:', n);
