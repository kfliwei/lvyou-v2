/* 解析偏好隐形化：意图解析的 prefs 不再写入 state.prefs（不显示/不进标题），仅作初始召回；手动点主题才接管 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. doGenerate：解析偏好 → autoPrefs（隐形），state.prefs 空 */
rep(
  `    state.regions = intent.regions; state.days = intent.days; state.prefs = intent.prefs; state.fromWish = false; state.selected = [];`,
  `    state.regions = intent.regions; state.days = intent.days; state.prefs = []; state.autoPrefs = intent.prefs || []; state.fromWish = false; state.selected = [];`,
  '1 doGenerate 解析偏好隐形'
);

/* 2. doRecall：候选召回用手动主题优先，否则解析偏好 */
rep(
  `    var intent = { regions: state.regions, days: state.days, prefs: state.prefs };`,
  `    var intent = { regions: state.regions, days: state.days, prefs: state.prefs.length ? state.prefs : (state.autoPrefs || []) };`,
  '2 doRecall 手动优先'
);

/* 3. 手动点主题 → 解析偏好作废 */
rep(
  `    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    renderIntent();`,
  `    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    state.autoPrefs = [];
    renderIntent();`,
  '3 手动接管'
);

/* 4. 种子快捷/不限目的地：autoPrefs 同步清空 */
rep(
  `    state.regions = r ? [r] : []; state.prefs = []; state.days = state.days || 0; state.fromWish = false;`,
  `    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false;`,
  '4 种子清 autoPrefs'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
