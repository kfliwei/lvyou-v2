/* 二分定位语法错误 */
const fs = require('fs');
const vm = require('vm');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
function okRange(a, b) {
  try { new vm.Script(L.slice(a, b).join('\n'), { filename: 'p' }); return true; } catch (e) { return false; }
}
/* 找第一个错误行：逐段 50 行 */
let bad = -1;
for (let i = 0; i < L.length; i += 50) {
  if (!okRange(i, Math.min(i + 50, L.length))) { bad = i; break; }
}
console.log('首个坏段起点行:', bad + 1);
/* 段内二分 */
if (bad >= 0) {
  let a = bad, b = Math.min(bad + 50, L.length);
  while (b - a > 1) {
    const mid = Math.floor((a + b) / 2);
    if (okRange(a, mid)) a = mid; else b = mid;
  }
  console.log('错误行约:', a + 1);
  console.log(L.slice(Math.max(0, a - 3), a + 4).join('\n'));
}
