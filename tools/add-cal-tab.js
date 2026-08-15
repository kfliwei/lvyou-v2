/* 补 6a：日历 tab 按钮（实际 HTML 前缀） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = '<div class="tn-viewrow"><button class="tn-viewtab on" id="tnViewTrip">旅程</button><button class="tn-viewtab" id="tnViewTime">时间线</button></div>';
const to = '<div class="tn-viewrow"><button class="tn-viewtab on" id="tnViewTrip">旅程</button><button class="tn-viewtab" id="tnViewTime">时间线</button><button class="tn-viewtab" id="tnViewCal">日历</button></div>';
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('6a cal tab added');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('travel-notes.js', 'utf8'), { filename: 'tn' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 60)); }
