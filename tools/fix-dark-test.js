/* 修正 check-dark-consolidate 选择器支持 story-bar */
const fs = require('fs');
let s = fs.readFileSync('check-dark-consolidate.js', 'utf8');
s = s.replace("const topbar = document.querySelector('.topbar');", "const topbar = document.querySelector('.topbar, .story-bar');");
s = s.replace("const title = document.querySelector('.t-row .title');", "const title = document.querySelector('.t-row .title, .story-bar .title');");
fs.writeFileSync('check-dark-consolidate.js', s, 'utf8');
console.log('fixed');
