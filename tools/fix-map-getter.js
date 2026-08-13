/* 修复 TopicEngine._map 值捕获 bug → getter（影响离线瓦片下载 dl=1） */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
const from = "  window.TopicEngine = { _map: map,";
const to = "  window.TopicEngine = { get _map() { return map; },";
if (!s.includes(from)) { console.log('pattern not found'); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(p, s, 'utf8');
console.log('TopicEngine._map getter fixed');
