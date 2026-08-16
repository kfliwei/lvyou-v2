/* 查 wlPlanBtn 绑定 */
const fs = require('fs');
const h = fs.readFileSync('wishlist.html', 'utf8').replace(/\r\n/g, '\n');
const i = h.indexOf('wlPlanBtn');
console.log('--- HTML ---');
console.log(h.slice(Math.max(0, i - 300), i + 200));
const j = fs.readFileSync('wishlist.js', 'utf8').replace(/\r\n/g, '\n');
const k = j.indexOf('wlPlanBtn');
console.log('--- JS ---');
console.log(j.slice(Math.max(0, k - 300), k + 400));
