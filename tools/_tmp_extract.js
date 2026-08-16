var fs = require('fs');
var s = fs.readFileSync('topic-meta.js', 'utf8');
var re = /^\s{2}([a-z0-9]+):\s*\{/gm;
var keys = []; var m;
while ((m = re.exec(s))) { keys.push({ key: m[1], pos: m.index }); }
keys.forEach(function (k, i) {
  var end = i + 1 < keys.length ? keys[i + 1].pos : s.length;
  var seg = s.slice(k.pos, end);
  var tm = seg.match(/title:/s*'([^']+)'/);
  var rs = seg.match(/regionShort:/s*/{([^}]*)/}/);
  console.log(k.key + ' => ' + (tm ? tm[1] : '?') + (rs ? '   [' + rs[1].trim() + ']' : ''));
});
