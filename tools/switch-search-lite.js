/* search.html → topic-meta-lite.js */
const fs = require('fs');
let s = fs.readFileSync('search.html', 'utf8');
const from = '<script src="topic-meta.js"></script>';
const to = '<script src="topic-meta-lite.js"></script>';
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('search.html', s, 'utf8');
  console.log('search → lite');
} else console.log('miss');
