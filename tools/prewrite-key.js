/* init 预写 Key + 查 sync-assets 是否同步 tn-key.js */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `  function init() {
    try { var pi = $id('promptInput'); if (pi && pi.value && !pi.value.trim()) pi.value = ''; } catch (e) {}
    renderAISwitch();`;
const to = `  function init() {
    try { var pi = $id('promptInput'); if (pi && pi.value && !pi.value.trim()) pi.value = ''; } catch (e) {}
    try { getAmapKey(); } catch (e) {}
    renderAISwitch();`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('OK  init 预写 Key');
} else console.log('SKIP init 预写');
/* sync-assets 文件列表 */
const sa = fs.readFileSync('tools/sync-assets.js', 'utf8');
console.log('--- sync-assets 是否含 tn-key/通配 ---');
const lines = sa.split(/\r?\n/);
lines.forEach((l, i) => { if (/planner|tn-key|\*\.js|files|list|assets/.test(l) && i < 60) console.log((i + 1) + ': ' + l.trim().slice(0, 100)); });
