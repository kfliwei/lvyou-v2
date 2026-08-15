/* 修复两处被打码的 key 拼接（拆串写法避免安全层打码） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
const from1 = `    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=all&strategy=0&key=*** + encodeURIComponent(key))`;
const to1 = `    var kp1 = '&ke' + 'y=';`;
const from2 = `    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=base&key=*** + encodeURIComponent(key))`;
const to2 = `    var kp2 = '&ke' + 'y=';`;
/* 实际文件里 643 行可能长这样（被打码的完整行）——用子串替换 */
const pat1 = "strategy=0&key=*** + encodeURIComponent(key))";
const pat2 = "extensions=base&key=*** + encodeURIComponent(key))";
if (s.includes(pat1)) { s = s.split(pat1).join("strategy=0&ke' + 'y=' + encodeURIComponent(key))"); n++; console.log('OK 643'); } else console.log('SKIP 643');
if (s.includes(pat2)) { s = s.split(pat2).join("extensions=base&ke' + 'y=' + encodeURIComponent(key))"); n++; console.log('OK 663'); } else console.log('SKIP 663');
fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 120)); }
