/* 查 planner.html 热门目的地区块 + renderDestChips 逻辑 */
const fs = require('fs');
const h = fs.readFileSync('planner.html', 'utf8').replace(/\r\n/g, '\n');
const i = h.indexOf('热门');
console.log('=== HTML 区块 ===');
console.log(h.slice(Math.max(0, i - 200), i + 300));
const j = h.indexOf('destChips');
console.log('=== destChips 上下文 ===');
console.log(h.slice(Math.max(0, j - 300), j + 200));
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const k = s.indexOf('function renderDestChips');
console.log('=== renderDestChips ===');
console.log(s.slice(k, k + 500));
