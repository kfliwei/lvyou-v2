/* smoke.js 85-90 完整 */
const fs = require('fs');
const s = fs.readFileSync('tools/smoke.js', 'utf8').replace(/\r\n/g, '\n');
const L = s.split('\n');
console.log(L.slice(84, 90).join('\n'));
