/* sw.js SHELL 补 tiles.js + node-lod.js */
const fs = require('fs');
let s = fs.readFileSync('sw.js', 'utf8');
const from = "  './geo.js',";
const to = "  './geo.js',\n  './tiles.js',\n  './node-lod.js',";
if (s.includes(from) && !s.includes('./node-lod.js')) {
  s = s.split(from).join(to);
  fs.writeFileSync('sw.js', s, 'utf8');
  console.log('tiles + node-lod added to SHELL');
} else {
  console.log(s.includes('./node-lod.js') ? 'already present' : 'anchor missing');
}
