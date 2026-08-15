/* 修复：关闭按钮改用独立函数（避免引号转义问题） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `      '<button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="document.getElementById(\\'browseSheet\\')&&document.getElementById(\\'browseSheet\\').remove();document.getElementById(\\'browseMask\\')&&document.getElementById(\\'browseMask\\').remove()">✕ 关闭</button></div>' +`;
const to = `      '<button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="window.plannerCloseBrowse()">✕ 关闭</button></div>' +`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  console.log('关闭按钮修复');
} else console.log('miss-close-btn');
/* 加 plannerCloseBrowse 定义（在 plannerOpenBrowse 前） */
const a2 = `  /* ---------- 浏览已选弹层 ---------- */
  window.plannerOpenBrowse = function () {`;
const b2 = `  /* ---------- 浏览已选弹层 ---------- */
  window.plannerCloseBrowse = function () { var mk = $id('browseMask'); if (mk) mk.remove(); };
  window.plannerOpenBrowse = function () {`;
if (s.includes(a2)) { s = s.split(a2).join(b2); console.log('close 函数定义'); } else console.log('miss-close-def');
fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
