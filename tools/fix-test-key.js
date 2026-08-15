/* 修测试 KEY → travelNotes，重跑 ⑤⑥ */
const fs = require('fs');
['check-six-features.js', 'diag-cal-viewer.js'].forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/const KEY = '\*\*\*';/g, "const KEY = 'travelNotes';");
  s = s.replace(/localStorage\.setItem\('\*\*\*'/g, "localStorage.setItem('travelNotes'");
  fs.writeFileSync(f, s, 'utf8');
});
console.log('keys fixed');
