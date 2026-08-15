/* 高德规划改为：先排序展示（弹层新顺序），不自动跳排期 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      state.days = parseInt(($id('intentDays') && $id('intentDays').value) || state.days || 0, 10) || 0;
      state.startDate = $id('intentDate') ? $id('intentDate').value : '';
      state.start = $id('intentStart') && $id('intentStart').value ? (matchStart($id('intentStart').value) || state.start) : state.start;
      var days = schedule(ordered, state.start, state.days, true);
      var name = (state.regions.join('/') || '旅行') + ' ' + days.length + ' 日' + (state.prefs.length ? state.prefs.join('·') : '') + '之旅';
      state.trip = { name: name, createdAt: Date.now(), start: state.start, startDate: state.startDate, aiLevel: getAILevel(), days: days, narrative: null };
      showStage('stageResult'); renderResult();
      if (mk) mk.remove();
      toast(failed && !Object.keys(dist).length ? '已按高德真实道路距离重新规划' : '已按高德真实道路距离重新规划' + (failed ? '（部分路段缺失，已兜底）' : ''));`;
const to = `      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      renderCandidates(); renderSumm();
      if (mk) mk.remove();
      window.plannerOpenBrowse();
      toast(failed && !Object.keys(dist).length ? '已按高德真实道路距离排序（部分缺失已直线兜底），点「开始排期」出行程' : '已按高德真实道路距离排序，点「开始排期」出行程');`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('高德规划改为先排序');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 100)); }
