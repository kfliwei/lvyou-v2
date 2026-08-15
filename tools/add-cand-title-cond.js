/* 候选标题联动摘要：候选景点 · 云南 · 古城古镇 · 12 处 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    $id('candTitle').textContent = '候选景点 · ' + (q ? list.length + ' / ' + c.length : c.length) + ' 处';`;
const to = `    var cond = [];
    if (state.regions.length) cond.push(state.regions.join('/'));
    if (state.prefs.length) cond.push(state.prefs.join('·'));
    var condTxt = cond.length ? ' · ' + cond.join(' · ') : '';
    $id('candTitle').textContent = '候选景点' + condTxt + ' · ' + (q ? list.length + ' / ' + c.length : c.length) + ' 处';`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('候选标题联动摘要');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
