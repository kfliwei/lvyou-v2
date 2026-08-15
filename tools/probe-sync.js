/* 查 sync-assets 源文件列表 */
const fs = require('fs');
const s = fs.readFileSync('tools/sync-assets.js', 'utf8');
const L = s.split(/\r?\n/);
console.log(L.slice(0, 40).join('\n'));
