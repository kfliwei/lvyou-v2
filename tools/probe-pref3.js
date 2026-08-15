/* 探针3：renderIntent 前后 provSel */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    renderIntent();
    if (provSel) window.plannerPickProv(provSel);
    try { console.log('[pref] after: on=' + document.querySelectorAll('#intentProvThemes .chip.on').length); } catch (e) {}`;
const to = `    try { console.log('[pref] before render: provSel=' + JSON.stringify(provSel)); } catch (e) {}
    renderIntent();
    try { console.log('[pref] after render: provSel=' + JSON.stringify(provSel)); } catch (e) {}
    if (provSel) window.plannerPickProv(provSel);
    try { console.log('[pref] after: on=' + document.querySelectorAll('#intentProvThemes .chip.on').length); } catch (e) {}`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('probe3 added');
} else console.log('miss');
