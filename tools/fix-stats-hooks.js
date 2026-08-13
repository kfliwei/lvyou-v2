/* 修复：区域统计钩子移出 M.lodEnabled 条件（全专题生效）+ 移除调试日志 */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\r\n/g, '\n');

/* 1. 移除调试日志 */
s = s.replace("    try { console.log('[stats] called, sites=' + SITES.length); } catch (e) {}\n", '');

/* 2. 钩子移出 lodEnabled 条件 */
const from = [
  "    /* LOD 鍒嗙骇锛氬钩绉?/ 缂╂斁鏃舵寜褰撳墠瑙嗛噹涓庣骇鍒堥噸娓叉煋锛堜粎鍏ㄥ浗椤匡級 */",
  "    if (M.lodEnabled) {",
  "      map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); scheduleRegionStats(); });",
  "      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); scheduleRegionStats(); });",
  "    }"
].join('\n');
const to = [
  "    /* LOD 鍒嗙骇锛氬钩绉?/ 缂╂斁鏃舵寜褰撳墠瑙嗛噹涓庣骇鍒堥噸娓叉煋锛堜粎鍏ㄥ浗椤匡級 */",
  "    if (M.lodEnabled) {",
  "      map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });",
  "      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });",
  "    }",
  "    /* 区域统计：全专题生效（规范 §32） */",
  "    map.on('moveend', scheduleRegionStats);",
  "    map.on('zoomend', scheduleRegionStats);"
].join('\n');
if (!s.includes(from)) { console.log('lod block not found, trying ASCII variant'); }
s = s.split(from).join(to);

/* 3. 容错：若上面因乱码未匹配，用宽松正则再试 */
if (!s.includes('区域统计：全专题生效')) {
  s = s.replace(
    /if \(M\.lodEnabled\) \{\n(\s*)map\.on\('moveend', function \(\) \{ if \(lastMarkerList\) renderMarkers\(lastMarkerList\); scheduleRegionStats\(\); \}\);\n\s*map\.on\('zoomend', function \(\) \{ if \(lastMarkerList\) renderMarkers\(lastMarkerList\); scheduleRegionStats\(\); \}\);\n\s*\}/,
    "if (M.lodEnabled) {\n$1map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });\n$1map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });\n$1}\n    /* 区域统计：全专题生效（规范 §32） */\n    map.on('moveend', scheduleRegionStats);\n    map.on('zoomend', scheduleRegionStats);"
  );
}
fs.writeFileSync(p, s, 'utf8');
console.log('done, stats hooks:', s.includes('map.on(\'moveend\', scheduleRegionStats)'));
