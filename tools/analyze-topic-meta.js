/* topic-meta.js 体积构成分析 */
const fs = require('fs');
const s = fs.readFileSync('topic-meta.js', 'utf8');
console.log('total bytes:', s.length);
let cnt = 0, bytes = 0;
const re = /routes\s*:\s*\[/g;
let m;
while ((m = re.exec(s))) { cnt++; bytes += m[0].length; }
console.log('routes keys found:', cnt, '(samples only)');
/* 提取每个专题对象的大小分布（按 key 名统计属性占比粗略） */
const keys = ['routes', 'days', 'stops', 'itinerary', 'tips'];
keys.forEach(k => {
  const re2 = new RegExp('([\'"]' + k + '[\'"]\\s*:)|(\\b' + k + '\\s*:)', 'g');
  let c = 0;
  while (re2.exec(s)) c++;
  console.log('key "' + k + '" occurrences:', c);
});
