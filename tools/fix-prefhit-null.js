/* 修复 prefHit：自定义主题不在 PREF 表时安全返回 false */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `function prefHit(p, t) { var n = normTheme(t); return PREF[p].themes.indexOf(n) >= 0; }`;
const to = `function prefHit(p, t) { var def = PREF[p]; var n = normTheme(t); return !!(def && def.themes && def.themes.indexOf(n) >= 0); }`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('prefHit 判空修复');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
