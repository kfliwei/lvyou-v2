/* 探针：oneLineAdd 执行路径 */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!h.includes(from)) { console.log('SKIP', tag); return; }
  h = h.split(from).join(to); n++;
  console.log('OK  ', tag);
}
rep(`  function oneLineAdd(text) {
    var tries = 0;`, `  function oneLineAdd(text) {
    try { console.log('[oneline] 进入, SITES=' + (SITES ? SITES.length : 'undef')); } catch (e) {}
    var tries = 0;`, 'P1');
rep(`    function doAdd() {
    var finish = function (parsed) {`, `    function doAdd() {
    try { console.log('[oneline] doAdd 开始, 文本=' + text.slice(0, 20)); } catch (e) {}
    var finish = function (parsed) {`, 'P2');
rep(`      var name = (parsed.name || '').trim();
      if (!name || name.length < 2) { tip('没能识别出景点名，试试：我想加成都武侯祠，三国文化'); return; }`, `      var name = (parsed.name || '').trim();
      try { console.log('[oneline] 解析结果 name=' + name + ' prov=' + parsed.province + ' city=' + parsed.city + ' cat=' + parsed.category); } catch (e) {}
      if (!name || name.length < 2) { tip('没能识别出景点名，试试：我想加成都武侯祠，三国文化'); return; }`, 'P3');
rep(`      arr.push(rec); saveUserNodes(arr);`, `      try { console.log('[oneline] 保存 ' + rec.name); } catch (e) {}
      arr.push(rec); saveUserNodes(arr);`, 'P4');
fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
console.log('probes:', n);
