/* 修复 zoomPhotoIdx 挂载时机 + 查 wishlist/search 错误 */
const fs = require('fs');

/* travel-notes.js：挂载改内部函数 + 导出块注册 */
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = `  /* 多图入口：按游记 id + 图索引 */
  window.TravelNotes.zoomPhotoIdx = function (id, idx) {
    var x = notes.find(function (z) { return z.id === id; });
    var ph = (x && x.photos) || [];
    if (!ph.length) return;
    openViewer(ph, Math.max(0, Math.min(idx || 0, ph.length - 1)));
  };`;
const to = `  /* 多图入口：按游记 id + 图索引 */
  function zoomPhotoIdx(id, idx) {
    var x = notes.find(function (z) { return z.id === id; });
    var ph = (x && x.photos) || [];
    if (!ph.length) return;
    openViewer(ph, Math.max(0, Math.min(idx || 0, ph.length - 1)));
  }`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  console.log('zoomPhotoIdx → internal fn');
} else console.log('SKIP fn refactor');

/* 导出块注册 */
const exFrom = "    openList: openList,";
const exTo = "    openList: openList,\n    zoomPhotoIdx: zoomPhotoIdx,";
if (t.includes(exFrom)) {
  t = t.split(exFrom).join(exTo);
  console.log('export zoomPhotoIdx');
} else console.log('SKIP export');

fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('travel-notes.js', 'utf8'), { filename: 'tn' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 60)); }
