/* 升级版本号 2.18 → 2.19 (28 → 29) */
const fs = require('fs');
const f = 'app/build.gradle';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
if (s.includes('versionCode 28')) { s = s.replace('versionCode 28', 'versionCode 29'); n++; }
if (s.includes("versionName '2.18'")) { s = s.replace("versionName '2.18'", "versionName '2.19'"); n++; }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('version patches:', n);
