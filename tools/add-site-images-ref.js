/* 页面引用 site-images.js（topic.html 主引用） */
const fs = require('fs');
let s = fs.readFileSync('topic.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const anchor = '<script src="topic-meta.js?v=20260813"></script>';
const add = '<script src="site-images.js?v=20260815"></script>';
if (s.includes(anchor) && !s.includes('site-images.js')) {
  s = s.split(anchor).join(anchor + '\n' + add);
  fs.writeFileSync('topic.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('topic.html 引用 site-images.js');
} else console.log(s.includes('site-images.js') ? 'exists' : 'anchor miss');
