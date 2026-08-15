/* 闭环修复：① amapSorted 标志（高德排序结果不被贪心重排覆盖）② fromWish 候选也支持省/主题联动过滤 */
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

/* 1. state 加 amapSorted / wishPool */
rep(
  `var state = { regions: [], days: 0, prefs: [], start: null, startDate: '', candidates: [], selected: [], trip: null, fromWish: false, candFilter: '' };`,
  `var state = { regions: [], days: 0, prefs: [], start: null, startDate: '', candidates: [], selected: [], trip: null, fromWish: false, candFilter: '', amapSorted: false, wishPool: null };`,
  '1 state 新字段'
);

/* 2. doSchedule 用 amapSorted 保留顺序 */
rep(
  `    var days = schedule(state.selected, state.start, state.days);`,
  `    var days = schedule(state.selected, state.start, state.days, state.amapSorted);`,
  '2 doSchedule 保留高德顺序'
);

/* 3. 高德排序后置标志 */
rep(
  `      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      renderCandidates(); renderSumm();`,
  `      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      state.amapSorted = true;
      renderCandidates(); renderSumm();`,
  '3 高德排序置标志'
);

/* 4. 所有手动变更清标志 */
rep(
  `  window.plannerRemovePick = function (i) {
    if (state.selected[i]) state.selected.splice(i, 1);
    renderCandidates(); renderSumm();`,
  `  window.plannerRemovePick = function (i) {
    if (state.selected[i]) state.selected.splice(i, 1);
    state.amapSorted = false;
    renderCandidates(); renderSumm();`,
  '4a 删除清标志'
);
rep(
  `  window.plannerClearPicks = function () {
    state.selected = [];`,
  `  window.plannerClearPicks = function () {
    state.selected = []; state.amapSorted = false;`,
  '4b 清空清标志'
);
rep(
  `      state.selected.push({ name: '当前位置', label: '当前位置', region: '', city: '', theme: '', flag: '', lat: lat, lng: lng, __cur: true });`,
  `      state.selected.push({ name: '当前位置', label: '当前位置', region: '', city: '', theme: '', flag: '', lat: lat, lng: lng, __cur: true });
      state.amapSorted = false;`,
  '4c 加当前位置清标志'
);
rep(
  `    else { var s = state.candidates.filter(function (x) { return nodeUid(x) === uid; })[0]; if (s) state.selected.push(s); }
    renderCandidates();`,
  `    else { var s = state.candidates.filter(function (x) { return nodeUid(x) === uid; })[0]; if (s) state.selected.push(s); }
    state.amapSorted = false;
    renderCandidates();`,
  '4d 勾选清标志'
);
rep(
  `    if (state.regions.length === 1 && state.regions[0] === r) state.regions = []; else state.regions = [r];
    renderIntent(); doRecall();`,
  `    if (state.regions.length === 1 && state.regions[0] === r) state.regions = []; else state.regions = [r];
    state.amapSorted = false;
    renderIntent(); doRecall();`,
  '4e 换省清标志'
);
rep(
  `    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    state.autoPrefs = [];`,
  `    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    state.autoPrefs = []; state.amapSorted = false;`,
  '4f 换主题清标志'
);

/* 5. fromWish 联动：候选在收藏池内按省/主题过滤 */
rep(
  `    var intent = { regions: state.regions, days: state.days, prefs: state.prefs.length ? state.prefs : (state.autoPrefs || []) };
    state.widenMsg = null;
    state.candidates = state.fromWish ? state.candidates : recall(intent);`,
  `    var intent = { regions: state.regions, days: state.days, prefs: state.prefs.length ? state.prefs : (state.autoPrefs || []) };
    state.widenMsg = null;
    if (state.fromWish) {
      var wpool = state.wishPool || state.candidates;
      state.wishPool = wpool;
      if (intent.regions.length || intent.prefs.length) {
        state.candidates = wpool.filter(function (x) {
          if (intent.regions.length && intent.regions.indexOf(x.region) < 0) return false;
          if (intent.prefs.length && !intent.prefs.some(function (p) { return prefHit(p, x.theme) || normTheme(p) === normTheme(x.theme); })) return false;
          return true;
        });
      } else state.candidates = wpool.slice();
    } else state.candidates = recall(intent);`,
  '5 fromWish 联动'
);
/* seedFromWish 存池 */
rep(
  `    state.candidates = wl.map(function (w) { return { name: w.label, label: w.label, region: w.region, city: w.city, theme: w.theme, flag: '', lat: w.lat, lng: w.lng }; });
    state.selected = state.candidates.slice();
    state.fromWish = true; state.regions = []; state.prefs = []; state.days = 0;`,
  `    state.candidates = wl.map(function (w) { return { name: w.label, label: w.label, region: w.region, city: w.city, theme: w.theme, flag: '', lat: w.lat, lng: w.lng }; });
    state.wishPool = state.candidates.slice();
    state.selected = state.candidates.slice();
    state.fromWish = true; state.regions = []; state.prefs = []; state.autoPrefs = []; state.amapSorted = false; state.days = 0;`,
  '6 seedFromWish 池+清标志'
);
/* doGenerate / plannerPickRegion 清标志 */
rep(
  `    state.regions = intent.regions; state.days = intent.days; state.prefs = []; state.autoPrefs = intent.prefs || []; state.fromWish = false; state.selected = [];`,
  `    state.regions = intent.regions; state.days = intent.days; state.prefs = []; state.autoPrefs = intent.prefs || []; state.fromWish = false; state.selected = []; state.amapSorted = false;`,
  '7 doGenerate 清标志'
);
rep(
  `    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false;`,
  `    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false; state.amapSorted = false; state.wishPool = null;`,
  '8 种子清标志'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 120)); }
