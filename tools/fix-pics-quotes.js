/* 修复 pics 行引号（用 \x27 表达单引号） */
const fs = require('fs');
let s = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = "onclick=\"TravelNotes.zoomPhotoIdx('' + n.id + '',' + pi + ')\"";
const to = "onclick=\"TravelNotes.zoomPhotoIdx(\\x27' + n.id + '\\x27,' + pi + ')\"";
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('pics quotes fixed');
} else console.log('miss');
/* 语法复检 */
const vm = require('vm');
try { new vm.Script(fs.readFileSync('travel-notes.js', 'utf8'), { filename: 'tn' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 60)); }
