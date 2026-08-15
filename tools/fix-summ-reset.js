/* 修复：renderCandidates 同步渲染汇总栏（doGenerate 重置后无残留） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    var c = state.candidates;
    var card = $id('candCard'), bar = $id('summbar');
    if (!c.length) { card.style.display = 'none'; bar.style.display = 'none'; return; }`;
const to = `    var c = state.candidates;
    renderSumm();
    var card = $id('candCard'), bar = $id('summbar');
    if (!c.length) { card.style.display = 'none'; bar.style.display = 'none'; return; }`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('renderCandidates 同步汇总栏');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
