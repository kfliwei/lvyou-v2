/* 修复：随手记地点选择器「当前位置」卡片暗色模式不可读（硬编码色 → 变量） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
const subs = [
  ["'<small style=\"color:#8F8A7D;font-size:11px;letter-spacing:.05em;display:block;margin-top:1px\">选当前位置，或从附近地点中选择",
   "'<small style=\"color:var(--color-muted);font-size:11px;letter-spacing:.05em;display:block;margin-top:1px\">选当前位置，或从附近地点中选择", 'hint text'],
  ["'<span style=\"flex:1;min-width:0\"><b style=\"display:block;font-size:15px;font-weight:600;color:#26241F\">当前位置",
   "'<span style=\"flex:1;min-width:0\"><b style=\"display:block;font-size:15px;font-weight:600;color:var(--color-ink)\">当前位置", 'cur title'],
  ["'<small style=\"color:#8F8A7D;font-size:11.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">",
   "'<small style=\"color:var(--color-muted);font-size:11.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">", 'cur sub']
];
subs.forEach(function (it) {
  if (t.includes(it[0])) { t = t.split(it[0]).join(it[1]); n++; console.log('OK  ', it[2]); }
  else console.log('SKIP', it[2]);
});
fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('patches:', n);
