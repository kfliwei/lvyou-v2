const fs = require('fs');
const src = fs.readFileSync('planner.js', 'utf8');
const Q = String.fromCharCode(39);
const flat = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
const F = flat(src);
const c = n => F.split(n).length - 1;
[
  '缺省=当前位置', '当前位置', 'state.days || \x27\x27', 'state.days || 5',
  'state.start = matchStart(', 'state.end = matchStart(', 'state.end = state.start;',
  'splitIntoDays(', 'state.isLoop = true; if (state.start', 'daysInput()', 'matchKeep(',
  'syncLoopEnd();', 'readEndpointInputs();', 'endpointRow(leg, ',
  '未匹配到坐标 · 不参与里程', '留空＝首日只算站与站之间的路', 'id="wStartLoc"',
  'window.plannerStartFromHere', 'navigator.geolocation.getCurrentPosition',
  'function locate(', '（抵达地）', 'lastStop', 'isLoop = true;'
].forEach(n => console.log(String(c(n)).padStart(3) + '  [flat]  ' + n));

console.log('');
/* 行级：分日调用点与起终点写入点（flat 把换行压掉了，这两族必须按行看） */
const lines = src.split('\n');
lines.forEach((ln, i) => {
  if (/state\.(start|end)\s*=[^=]/.test(ln)) console.log('EP  ' + (i + 1) + '  ' + ln.trim().slice(0, 110));
});
lines.forEach((ln, i) => {
  if (ln.indexOf('splitIntoDays(') >= 0 && ln.indexOf('function splitIntoDays') < 0) console.log('SPLIT ' + (i + 1) + '  ' + ln.trim().slice(0, 120));
});
lines.forEach((ln, i) => {
  if (ln.indexOf(Q + 'intentDays' + Q) >= 0 || ln.indexOf('id="intentDays"') >= 0) console.log('DAYS ' + (i + 1) + '  ' + ln.trim().slice(0, 120));
});
