/* 补 2d：list ds 转义（正则匹配，避开乱码字符） */
const fs = require('fs');
let s = fs.readFileSync('topic-common.js', 'utf8');
s = s.replace(/\r\n/g, '\n');
const re = /'<div class="ds">' \+ s\.desc \+ \(s\.best \? \('[^']*' \+ s\.best\) : ''\) \+ '<\/div>' \+/;
if (re.test(s)) {
  s = s.replace(re, "'<div class=\"ds\">' + esc(s.desc) + (s.best ? ('　· 最佳 ' + esc(s.best)) : '') + '</div>' +");
  fs.writeFileSync('topic-common.js', s, 'utf8');
  console.log('2d list ds escaped');
} else {
  console.log('2d pattern not found');
}
