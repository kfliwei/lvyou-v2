/* 升级版本号 */
const fs = require('fs');
const f = 'app/build.gradle';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
if (s.includes('versionCode 26')) { s = s.replace('versionCode 26', 'versionCode 27'); n++; }
if (s.includes("versionName '2.0'")) { s = s.replace("versionName '2.0'", "versionName '2.17'"); n++; }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('version patches:', n);
