/* 分析 travel-notes 三处 fetch 块：提取完整块文本，判断同构 */
const fs = require('fs');
const s = fs.readFileSync('travel-notes.js', 'utf8');
const lines = s.split('\n');
function extractBlock(startLine /* 1-based fetch 行 */) {
  const i = startLine - 1;
  let depth = 0, end = -1;
  for (let k = i; k < lines.length; k++) {
    const line = lines[k];
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth <= 0 && k > i) { end = k; break; }
  }
  return lines.slice(i, end + 1).join('\n');
}
const b516 = extractBlock(516);
const b642 = extractBlock(642);
const b1010 = extractBlock(1010);
console.log('516 == 642:', b516 === b642);
console.log('516 len:', b516.length, '| 642 len:', b642.length, '| 1010 len:', b1010.length);
console.log('--- 516 block ---');
console.log(b516);
console.log('--- 1010 block ---');
console.log(b1010.slice(0, 2000));
fs.writeFileSync('tools/_b516.txt', b516, 'utf8');
fs.writeFileSync('tools/_b642.txt', b642, 'utf8');
fs.writeFileSync('tools/_b1010.txt', b1010, 'utf8');
