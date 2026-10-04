/* §22 落闸门前的取数：三个 token 的字面量在「剥注释后的顶层 css/html/js」里各出现几次。
   闸门要写「只许 1 处」，就得先确认现在确实只有 1 处，否则当场把自己判红。 */
const fs = require('fs');
const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
const files = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
const LITS = [
  'rgba(33,26,19,.10)', 'rgba(33,26,19,.20)', 'saturate(.94)',
  'var(--photo-veil)', 'var(--photo-look)', 'var(--photo-edge)',
  'filter:var(--photo-look)', 'background:var(--photo-veil)',
  'box-shadow:inset 0 0 0 1px var(--photo-edge)', 'box-shadow:0 0 0 1px var(--photo-edge)',
  '.card .media'
];
LITS.forEach(l => {
  const hits = [];
  let n = 0;
  files.forEach(f => {
    const s = strip(fs.readFileSync(f, 'utf8')).replace(/\s+/g, ' ');
    let i = 0;
    while ((i = s.indexOf(l, i)) >= 0) { n++; hits.push(f); i += l.length; }
  });
  console.log(n + '  ' + l + (n ? '  <- ' + [...new Set(hits)].join(', ') : ''));
});
console.log('顶层文件数 ' + files.length);
