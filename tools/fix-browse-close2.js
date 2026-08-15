/* 关闭按钮替换（实际文本含裸单引号） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `onclick="document.getElementById('browseSheet')&&document.getElementById('browseSheet').remove();document.getElementById('browseMask')&&document.getElementById('browseMask').remove()">✕ 关闭`;
const to = `onclick="window.plannerCloseBrowse()">✕ 关闭`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('关闭按钮替换');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 100)); }
