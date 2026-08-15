/* 探针2：PickProv 内 ts 长度 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    var ts = provThemes(provSel);
    box.style.display = 'block';`;
const to = `    var ts = provThemes(provSel);
    try { console.log('[pick] prov=' + provSel + ' ts=' + ts.length + ' box=' + !!box + ' bar=' + !!bar); } catch (e) {}
    box.style.display = 'block';`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('probe2 added');
} else console.log('miss');
