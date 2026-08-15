/* ③ 地图记住上次位置（每专题独立，fitBounds 让位） */
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

/* 1. init：恢复上次位置（存到 restorePos） */
rep(
  `    try { trip = JSON.parse(localStorage.getItem(M.tripKey) || '[]'); } catch (e) { trip = []; }`,
  `    try { trip = JSON.parse(localStorage.getItem(M.tripKey) || '[]'); } catch (e) { trip = []; }
    /* 地图记住上次位置（每专题独立，2026-08-15） */
    try {
      var _pos = JSON.parse(localStorage.getItem('tn_mappos_' + (M.key || 't')) || 'null');
      if (_pos && _pos.lat != null && _pos.zoom) restorePos = _pos;
    } catch (e) {}`,
  '3a restore pos'
);

/* 2. 顶部声明 restorePos */
rep(
  `  var SITES = [], markers = new Map(), map = null, lastMarkerList = null;`,
  `  var SITES = [], markers = new Map(), map = null, lastMarkerList = null;
  var restorePos = null;`,
  '3b var decl'
);

/* 3. fitBounds 让位（1184 行专题 fitBounds） */
rep(
  `    if (_b.isValid()) map.fitBounds(_b, { padding: [46, 70], maxZoom: 7 });`,
  `    if (restorePos && restorePos.zoom) map.setView([restorePos.lat, restorePos.lng], restorePos.zoom);
    else if (_b.isValid()) map.fitBounds(_b, { padding: [46, 70], maxZoom: 7 });`,
  '3c fitBounds yield'
);

/* 4. 全量 fitBounds（789 行）让位 */
rep(
  `  if (all.length) map.fitBounds(all, { padding: [40, 40] });`,
  `  if (restorePos && restorePos.zoom) { map.setView([restorePos.lat, restorePos.lng], restorePos.zoom); }
  else if (all.length) map.fitBounds(all, { padding: [40, 40] });`,
  '3d all fitBounds yield'
);

/* 5. moveend 存位置（防抖）——在现有 moveend 钩子里 */
rep(
  `    map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); scheduleRegionStats(); });`,
  `    map.on('moveend', function () {
      if (lastMarkerList) renderMarkers(lastMarkerList);
      scheduleRegionStats();
      /* 记住上次位置（防抖 500ms） */
      clearTimeout(map._savePosT);
      map._savePosT = setTimeout(function () {
        try {
          var c = map.getCenter();
          localStorage.setItem('tn_mappos_' + (M.key || 't'), JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom(), ts: Date.now() }));
        } catch (e) {}
      }, 500);
    });`,
  '3e save pos'
);

fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('③ patches:', n);
