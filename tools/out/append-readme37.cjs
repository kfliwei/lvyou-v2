/* 把 §37 登记块追加到 README 的 verify 清单行尾（一次性脚本；README 是全 CRLF，插之前要剥行尾 \r） */
const fs = require('fs');
const clause = fs.readFileSync('tools/out/b23-readme-37.txt', 'utf8').replace(/\s+$/, '').replace(/\r/g, '');
const lines = fs.readFileSync('README.md', 'utf8').split('\n');
const i = 79;
if (lines[i].indexOf('/§37 ') >= 0) { console.log('already registered'); process.exit(0); }
const body = lines[i].replace(/\r$/, '');
if (body.indexOf('真机 TalkBack（一加 Ace 6T / ColorOS）未验）') < 0) { console.log('ANCHOR MISSING: ' + body.slice(-60)); process.exit(1); }
lines[i] = body + clause + '\r';
fs.writeFileSync('README.md', lines.join('\n'), 'utf8');
const after = fs.readFileSync('README.md', 'utf8');
console.log('ok · CRLF ' + after.split('\r\n').length + ' / LF ' + after.split('\n').length + ' · line80 len ' + lines[i].length);
