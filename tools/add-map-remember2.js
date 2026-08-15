/* ③ 补：3b 变量声明 + 3e moveend 保存（实际文本） */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!t.includes(from)) { console.log('SKIP', tag); return; }
  t = t.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
rep(
  `  var SITES = [], FOOD = [];`,
  `  var SITES = [], FOOD = [];
  var restorePos = null;`,
  '3b var'
);
rep(
  `    map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });`,
  `    map.on('moveend', function () {
      if (lastMarkerList) renderMarkers(lastMarkerList);
      /* 记住上次位置（防抖 500ms，2026-08-15） */
      clearTimeout(map._savePosT);
      map._savePosT = setTimeout(function () {
        try {
          var c = map.getCenter();
          localStorage.setItem('tn_mappos_' + (M.key || 't'), JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom(), ts: Date.now() }));
        } catch (e) {}
      }, 500);
    });`,
  '3e save'
);
fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('③b/e patches:', n);
