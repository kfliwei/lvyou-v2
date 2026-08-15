/* 修正联动顺序：renderIntent 重建后再展开主题 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    window.plannerPickProv(r); /* 联动：展开该省主题（再点收起） */
    renderIntent(); doRecall();`;
const to = `    renderIntent(); doRecall();
    window.plannerPickProv(r); /* 联动：重建后展开该省主题（再点收起） */`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('顺序修正');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
