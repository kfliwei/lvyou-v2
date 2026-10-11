const fs = require('fs');

const jobs = [
  { f: 'README.md', from: '`results.js:426/427`（定制路书 `#ix`）', to: '`results.js:425/426`（定制路书 `#ix`）' },
  { f: 'docs/功能与UI全面审核-2026-10-09.md', from: '`results.js:426`（定制路书 `#ix` → `d.remove()`）与 `:427`', to: '`results.js:425`（定制路书 `#ix` → `d.remove()`）与 `:426`' },
  { f: 'docs/功能与UI全面审核-2026-10-09.md', from: '`results.js:426/427`、录音面板', to: '`results.js:425/426`、录音面板' },
];

for (const j of jobs) {
  const s = fs.readFileSync(j.f, 'utf8');
  const n = s.split(j.from).length - 1;
  if (n !== 1) { console.log('ABORT ' + j.f + ' hits=' + n + ' :: ' + j.from); process.exit(2); }
  fs.writeFileSync(j.f, s.replace(j.from, j.to));
  console.log('OK ' + j.f + ' -> ' + j.to);
}

for (const f of ['README.md', 'docs/功能与UI全面审核-2026-10-09.md']) {
  const s = fs.readFileSync(f, 'utf8');
  const left = (s.match(/results\.js:426/g) || []).length;
  const fixed = (s.match(/results\.js:425/g) || []).length;
  console.log(f + ' 残留 results.js:426 = ' + left + ' · results.js:425 = ' + fixed);
}
