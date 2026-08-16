/* 升级版本号 2.17 → 2.18 (27 → 28) */
const fs = require('fs');
const f = 'app/build.gradle';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
if (s.includes('versionCode 27')) { s = s.replace('versionCode 27', 'versionCode 28'); n++; }
if (s.includes("versionName '2.17'")) { s = s.replace("versionName '2.17'", "versionName '2.18'"); n++; }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('version patches:', n);
