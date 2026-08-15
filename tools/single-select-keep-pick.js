/* 省/主题单选 + 勾选保留 */
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

/* A. 省份单选：点新省替换，点同省取消 */
rep(
  `  window.plannerToggleRegion = function (r) {
    var i = state.regions.indexOf(r);
    if (i >= 0) state.regions.splice(i, 1); else state.regions.push(r);
    renderIntent(); doRecall();
    window.plannerPickProv(r); /* 联动：重建后展开该省主题（再点收起） */
  };`,
  `  window.plannerToggleRegion = function (r) {
    if (state.regions.length === 1 && state.regions[0] === r) state.regions = []; else state.regions = [r];
    renderIntent(); doRecall();
    window.plannerPickProv(r); /* 联动：重建后展开该省主题（再点收起） */
  };`,
  'A 省份单选'
);

/* B. 主题单选：点新主题替换，点同主题取消 */
rep(
  `  window.plannerToggleCustomPref = function (t) {
    var i = state.prefs.indexOf(t);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(t);
    renderIntent();
    renderProvThemes();
    doRecall();
  };`,
  `  window.plannerToggleCustomPref = function (t) {
    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    renderIntent();
    renderProvThemes();
    doRecall();
  };`,
  'B 主题单选'
);

/* C. 切换省/主题时保留已勾选景点（不清除 selected） */
rep(
  `    state.candidates = state.fromWish ? state.candidates : recall(intent);
    state.selected = state.selected.filter(function (s) { return state.candidates.some(function (c) { return nodeUid(c) === nodeUid(s); }); });
    renderCandidates();`,
  `    state.candidates = state.fromWish ? state.candidates : recall(intent);
    renderCandidates();`,
  'C 勾选保留'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
