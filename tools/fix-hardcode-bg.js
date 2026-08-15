/* 清理组件硬编码背景 → var(--color-surface/line)（深色自适应） */
const fs = require('fs');

function patch(file, subs, tag) {
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  let n = 0;
  subs.forEach(function (it) {
    if (s.includes(it[0])) { s = s.split(it[0]).join(it[1]); n++; console.log('OK  ', tag, '|', it[2]); }
    else console.log('SKIP', tag, '|', it[2]);
  });
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  return n;
}

/* travel-notes.js：语音面板输入区/AI 区/标签区/照片占位 */
patch('travel-notes.js', [
  ['.tn-recbox{width:100%;margin-top:12px;background:#fff;border:1px solid #e4dbc6;',
   '.tn-recbox{width:100%;margin-top:12px;background:var(--color-surface);border:1px solid var(--color-line);', 'recbox'],
  ['.tn-tags{width:100%;margin-top:10px;padding:11px 14px;border:1px solid #e4dbc6;',
   '.tn-tags{width:100%;margin-top:10px;padding:11px 14px;border:1px solid var(--color-line);', 'tags'],
  ['.tn-ai{margin-top:12px;width:100%;background:#fff;border:1px solid #e4dbc6;',
   '.tn-ai{margin-top:12px;width:100%;background:var(--color-surface);border:1px solid var(--color-line);', 'ai'],
  ['.tn-addphoto{width:64px;height:64px;border:1.5px dashed #d5cdb9;',
   '.tn-addphoto{width:64px;height:64px;border:1.5px dashed var(--color-line-strong);', 'addphoto'],
  ['border:1px solid #e4dbc6;border-radius:10px;background:#fff',
   'border:1px solid var(--color-line);border-radius:10px;background:var(--color-surface)', 'settings box']
], 'travel-notes');

/* results.js：文档保存弹窗（硬编码浅色） */
let r = fs.readFileSync('results.js', 'utf8');
const rcrlf = r.includes('\r\n');
if (rcrlf) r = r.replace(/\r\n/g, '\n');
let rn = 0;
const rsubs = [
  ["background:#FAF8F3;border:1px solid rgba(32,32,29,.09);border-top:1px solid #C86D4B;",
   "background:var(--color-surface);border:1px solid var(--color-line);border-top:1px solid var(--color-primary);", 'saveDoc bg'],
  ["color:#20201D\">' + esc(name)", "color:var(--color-ink)\">' + esc(name)", 'saveDoc title'],
  ["background:#E6E1D7;border-radius:8px;width:34px;height:34px;color:#7D7970;",
   "background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px;color:var(--color-muted);", 'saveDoc close'],
  ["border:1px solid rgba(32,32,29,.09);border-radius:12px;max-height:40vh;overflow-y:auto;font-size:10.5px;color:#7D7970;padding:12px;white-space:pre-wrap;background:#fff",
   "border:1px solid var(--color-line);border-radius:12px;max-height:40vh;overflow-y:auto;font-size:10.5px;color:var(--color-muted);padding:12px;white-space:pre-wrap;background:var(--color-surface)", 'saveDoc preview']
];
rsubs.forEach(function (it) {
  if (r.includes(it[0])) { r = r.split(it[0]).join(it[1]); rn++; console.log('OK   results |', it[2]); }
  else console.log('SKIP results |', it[2]);
});
fs.writeFileSync('results.js', rcrlf ? r.replace(/\n/g, '\r\n') : r, 'utf8');

console.log('=== legacy hardcode cleanup done ===');
