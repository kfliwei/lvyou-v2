/* 暴力修 KEY 行 */
const fs = require('fs');
['check-six-features.js', 'diag-cal-viewer.js'].forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  const lines = s.split('\n');
  let fixed = 0;
  lines.forEach((l, i) => {
    if (l.includes('const KEY =') || (l.includes('localStorage.setItem') && l.includes("'***'"))) {
      if (l.includes('const KEY =')) { lines[i] = "const KEY = 'travelNotes';"; fixed++; }
      else { lines[i] = l.split("'***'").join("'travelNotes'"); fixed++; }
    }
  });
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  console.log(f, 'fixed lines:', fixed);
});
