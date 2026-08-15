/* renderSumm：清空时同步清 summInfo 文本 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    if (!state.selected.length) { bar.style.display = 'none'; return; }`;
const to = `    if (!state.selected.length) { bar.style.display = 'none'; $id('summInfo').innerHTML = ''; return; }`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('summInfo 清空');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
