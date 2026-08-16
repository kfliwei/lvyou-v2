/* 查 wlPlanBtn 在 wishlist.js 的绑定（搜 id 引用） */
const fs = require('fs');
const j = fs.readFileSync('wishlist.js', 'utf8').replace(/\r\n/g, '\n');
const lines = j.split('\n');
lines.forEach((l, i) => { if (/wlPlanBtn|planBtn|wlMapBtn/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 130)); });
/* 页面内 inline 脚本 */
const h = fs.readFileSync('wishlist.html', 'utf8').replace(/\r\n/g, '\n');
const hl = h.split('\n');
hl.forEach((l, i) => { if (/wlPlanBtn/.test(l) && i > 70) console.log('html:' + (i + 1) + ': ' + l.trim().slice(0, 130)); });
