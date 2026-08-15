/* 修复替换残留的重复 }); 行 */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const lines = t.split('\n');
/* 找连续两行同缩进的 });（排除合法场景：如 catch 后接函数收尾——合法场景中间有其他行）
   这里只清理完全相邻且内容相同的 "});" 对 */
let removed = 0;
for (let i = lines.length - 2; i >= 0; i--) {
  if (lines[i].trim() === '});' && lines[i + 1].trim() === '});' && lines[i].replace(/ /g, '').length === lines[i + 1].replace(/ /g, '').length) {
    /* 校验：前一行应包含 catch 或 then 的 UI 结束 */
    const prev = lines[i - 1] || '';
    if (/textContent|\.txt|display|showGuide/.test(prev)) {
      lines.splice(i + 1, 1);
      removed++;
    }
  }
}
console.log('removed dup lines:', removed);
fs.writeFileSync('travel-notes.js', crlf ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'), 'utf8');
/* 语法复检 */
const vm = require('vm');
try {
  new vm.Script(fs.readFileSync('travel-notes.js', 'utf8'), { filename: 'travel-notes.js' });
  console.log('SYNTAX OK');
} catch (e) {
  console.log('STILL ERR:', e.message.slice(0, 100));
  const ls = fs.readFileSync('travel-notes.js', 'utf8').split('\n');
  const m = e.stack.match(/travel-notes\.js:(\d+)/);
  if (m) { const ln = +m[1]; for (let i = ln - 4; i < ln + 3; i++) console.log((i + 1) + ': ' + (ls[i] || '')); }
}
