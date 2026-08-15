/* 探查：nodeUid、useLocBtn onclick、actRow 生成 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('function nodeUid');
console.log('=== nodeUid ===');
console.log(s.slice(i, i + 200));
const j = s.indexOf("useLocBtn').onclick");
console.log('=== useLocBtn onclick ===');
console.log(s.slice(j - 50, j + 500));
const k = s.indexOf('actRow');
const kk = s.indexOf('actRow');
console.log('=== actRow 生成 ===');
const a = s.indexOf("$id('actRow')");
console.log(s.slice(Math.max(0, a - 300), a + 700));
