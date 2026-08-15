/* 修复 293 行缺失分号 */
const fs = require('fs');
let s = fs.readFileSync('topic-common.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = "</i></div>') + '</div>' +\n    return '<div class=\"ls-place\">'";
const to = "</i></div>') + '</div>';\n    return '<div class=\"ls-place\">'";
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('semicolon fixed');
} else console.log('miss');
