/* 修复：热门目的地点击后切换到意图卡阶段（stagePick） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false; state.amapSorted = false; state.wishPool = null;
    renderIntent(); doRecall();`;
const to = `    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false; state.amapSorted = false; state.wishPool = null;
    renderIntent(); doRecall(); showStage('stagePick');`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('plannerPickRegion 补 showStage');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
