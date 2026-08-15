/* 修复：plannerOpenBrowse 重开前移除旧 mask */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `  window.plannerOpenBrowse = function () {
    var old = $id('browseSheet');
    if (old) old.remove();`;
const to = `  window.plannerOpenBrowse = function () {
    var old = $id('browseSheet'); if (old) old.remove();
    var oldM = $id('browseMask'); if (oldM) oldM.remove();`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('mask 清理修复');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
