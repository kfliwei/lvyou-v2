/* smoke.js wishlist 段 */
const fs = require('fs');
const s = fs.readFileSync('tools/smoke.js', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('wishlist');
console.log(s.slice(i - 200, i + 900));
