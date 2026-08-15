/* 诊断：_b516.txt 与 travel-notes.js 内容匹配 */
const fs = require('fs');
const path = require('path');
let t = fs.readFileSync('travel-notes.js', 'utf8');
t = t.replace(/\r\n/g, '\n');
const b516 = fs.readFileSync(path.join(__dirname, '_b516.txt'), 'utf8');
console.log('t len:', t.length, '| b516 len:', b516.length);
console.log('includes:', t.includes(b516));
/* 找差异：逐行对比 */
const tl = t.split('\n');
const bl = b516.split('\n');
console.log('b516 lines:', bl.length);
for (let i = 0; i < bl.length; i++) {
  const line = bl[i].trim();
  if (line && !t.includes(line)) {
    console.log('MISSING line', i + 1, ':', JSON.stringify(line.slice(0, 80)));
    break;
  }
}
/* 也检查 Authorization 行在 t 中的样子 */
const ai = t.indexOf('api.deepseek.com');
console.log('first fetch line:', JSON.stringify(tl[ai]));
