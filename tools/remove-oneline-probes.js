/* 移除探针 */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
const probes = [
  "    try { console.log('[oneline] 进入, SITES=' + (SITES ? SITES.length : 'undef')); } catch (e) {}\n",
  "    try { console.log('[oneline] doAdd 开始, 文本=' + text.slice(0, 20)); } catch (e) {}\n",
  "      try { console.log('[oneline] 解析结果 name=' + name + ' prov=' + parsed.province + ' city=' + parsed.city + ' cat=' + parsed.category); } catch (e) {}\n",
  "      try { console.log('[oneline] 保存 ' + rec.name); } catch (e) {}\n"
];
let removed = 0;
probes.forEach(p => { if (h.includes(p)) { h = h.split(p).join(''); removed++; } });
fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
console.log('探针移除:', removed);
