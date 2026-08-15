/* 修复 plannerAddMine：String().toFixed → (+n).toFixed */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = "var k = String(+u.lat).toFixed(3) + ',' + String(+u.lng).toFixed(3);";
const to = "var k = (+u.lat).toFixed(3) + ',' + (+u.lng).toFixed(3);";
const from2 = "var dup = state.candidates.some(function (c) { return c.lat != null && String(+c.lat).toFixed(3) + ',' + String(+c.lng).toFixed(3) === k; });";
const to2 = "var dup = state.candidates.some(function (c) { return c.lat != null && (+c.lat).toFixed(3) + ',' + (+c.lng).toFixed(3) === k; });";
let n = 0;
if (s.includes(from)) { s = s.split(from).join(to); n++; console.log('OK  k 修复'); } else console.log('SKIP k');
if (s.includes(from2)) { s = s.split(from2).join(to2); n++; console.log('OK  dup 修复'); } else console.log('SKIP dup');
fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 60)); }
