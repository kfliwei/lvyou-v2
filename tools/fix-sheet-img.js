/* buildSheet 详情大图用 imgSrc */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "var img = s.img ? '<div class=\"ls-img\"><img src=\"' + s.img + '\" alt=\"' + esc(s.label) + '\" onerror=\"";
const to = "var img = imgSrc(s) ? '<div class=\"ls-img\"><img src=\"' + imgSrc(s) + '\" alt=\"' + esc(s.label) + '\" onerror=\"";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('详情大图 imgSrc ok');
} else console.log('miss');
