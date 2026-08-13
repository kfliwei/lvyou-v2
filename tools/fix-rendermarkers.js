/* 精确修复 renderMarkers 双重 NodeLOD.init 开头 */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\r\n/g, '\n');
const from = [
  "    NodeLOD.init({",
  "      map: map, layer: markerLayer,",
  "    /* 筛选双态（规范 §11）：主题/区域/城市等筛选时渲染全量，非匹配节点降透明而非删除 */",
  "    var fn = getFilterFn();",
  "    var hasFilter = !!(state.theme || state.region || state.city || state.flag || state.elev);",
  "    NodeLOD.init({"
].join('\n');
const to = [
  "    /* 筛选双态（规范 §11）：主题/区域/城市等筛选时渲染全量，非匹配节点降透明而非删除 */",
  "    var fn = getFilterFn();",
  "    var hasFilter = !!(state.theme || state.region || state.city || state.flag || state.elev);",
  "    NodeLOD.init({"
].join('\n');
if (!s.includes(from)) { console.log('from not found'); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(p, s, 'utf8');
console.log('fixed');
