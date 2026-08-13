/* 修复 topic-common.js 的 USER_KEY 真实值 */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
const star = "var USER_KEY = '***';";
const real = "var USER_KEY = 'tn_userNodes';";
if (s.includes(star)) {
  s = s.split(star).join(real);
  fs.writeFileSync(p, s, 'utf8');
  console.log('REPLACED star key with real key');
} else if (s.includes(real)) {
  console.log('already real key');
} else {
  console.log('pattern not found, inspect:');
  const i = s.indexOf('USER_KEY');
  console.log(JSON.stringify(s.slice(i - 5, i + 45)));
}
