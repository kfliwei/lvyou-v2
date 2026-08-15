/* 语音记录面板暗色化：背景/头部/大字地点标题/时间/提示等变量化 */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
const subs = [
  ['.tn-panel{background:linear-gradient(175deg,#FAF6EC 0%,#F3EDDE 60%,#ECE4D1 100%)}',
   '.tn-panel{background:linear-gradient(175deg,var(--color-surface) 0%,var(--color-bg-soft) 60%,var(--color-bg-soft) 100%)}', 'panel bg'],
  ['.tn-head{background:linear-gradient(135deg,rgba(250,246,236,.92),rgba(243,237,222,.9));border-bottom:1px solid rgba(200,109,75,.18);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
   '.tn-head{background:linear-gradient(135deg,var(--color-surface),var(--color-bg-soft));border-bottom:1px solid rgba(200,109,75,.18);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}', 'head bg'],
  ['.tn-head .tn-x{background:rgba(38,36,31,.06);color:#6b665c;border-radius:50%;width:34px;height:34px}',
   '.tn-head .tn-x{background:var(--color-bg-soft);color:var(--color-muted);border-radius:50%;width:34px;height:34px}', 'head x'],
  ['.tn-title{color:#26241f;font-weight:600;font-size:16px}',
   '.tn-title{color:var(--color-ink);font-weight:600;font-size:16px}', 'title'],
  ['.tn-title small{color:#8f8a7d;font-family:var(--fb)}',
   '.tn-title small{color:var(--color-muted);font-family:var(--fb)}', 'title small'],
  ['.tn-now__place{font-family:var(--fd);font-size:24px;font-weight:600;color:#26241f;letter-spacing:.04em;text-align:center;position:relative;padding-left:32px}',
   '.tn-now__place{font-family:var(--fd);font-size:24px;font-weight:600;color:var(--color-ink);letter-spacing:.04em;text-align:center;position:relative;padding-left:32px}', 'NOW PLACE (大标题)'],
  ['.tn-now__time{font-size:12px;color:#9c958a;margin-top:4px;letter-spacing:.12em}',
   '.tn-now__time{font-size:12px;color:var(--color-muted);margin-top:4px;letter-spacing:.12em}', 'time'],
  ['.tn-prompt{width:100%;text-align:center;font-family:var(--fd);font-size:14px;color:#7d7a6e;line-height:1.9;margin-top:10px}',
   '.tn-prompt{width:100%;text-align:center;font-family:var(--fd);font-size:14px;color:var(--color-muted);line-height:1.9;margin-top:10px}', 'prompt'],
  ['.tn-miclabel{font-size:12.5px;color:#8f8a7d;letter-spacing:.04em}',
   '.tn-miclabel{font-size:12.5px;color:var(--color-muted);letter-spacing:.04em}', 'miclabel'],
  ['.tn-tags{border-radius:999px;border:1px solid rgba(32,32,29,.1);padding:12px 16px}',
   '.tn-tags{border-radius:999px;border:1px solid var(--color-line);padding:12px 16px}', 'tags border'],
  ['.tn-repolish{background:rgba(255,255,255,.6);border:1px solid rgba(32,32,29,.12);color:#4c4a45}',
   '.tn-repolish{background:var(--color-surface);border:1px solid var(--color-line);color:var(--color-ink-soft)}', 'repolish']
];
subs.forEach(function (it) {
  if (t.includes(it[0])) { t = t.split(it[0]).join(it[1]); n++; console.log('OK  ', it[2]); }
  else console.log('SKIP', it[2]);
});
fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('patches:', n);
