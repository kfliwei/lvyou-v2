/* 临时探针：plannerToggleCustomPref 加日志 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `  window.plannerToggleCustomPref = function (t) {
    var i = state.prefs.indexOf(t);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(t);
    renderIntent();
    if (provSel) window.plannerPickProv(provSel);
  };`;
const to = `  window.plannerToggleCustomPref = function (t) {
    var i = state.prefs.indexOf(t);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(t);
    try { console.log('[pref] t=' + t + ' prefs=' + state.prefs.join(',') + ' provSel=' + provSel); } catch (e) {}
    renderIntent();
    if (provSel) window.plannerPickProv(provSel);
    try { console.log('[pref] after: on=' + document.querySelectorAll('#intentProvThemes .chip.on').length); } catch (e) {}
  };`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('probe added');
} else console.log('miss');
