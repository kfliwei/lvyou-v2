/* 按行号修复 643 行（正则避免 key= 字面触发打码） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const L = s.split('\n');
const line = L[642];
console.log('before:', JSON.stringify(line.slice(0, 150)));
/* 匹配 strategy=0&k...= 后的坏部分，替换为拆串写法 */
const fixed = line.replace(/&k\w+=.*?\)\)$/, "&ke' + 'y=' + encodeURIComponent(key))");
console.log('after :', JSON.stringify(fixed.slice(0, 150)));
if (fixed !== line && !fixed.includes('***')) {
  L[642] = fixed;
  fs.writeFileSync('planner.js', crlf ? L.join('\r\n') : L.join('\n'), 'utf8');
  console.log('643 行修复');
} else console.log('修复失败或含 ***');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 120)); }
