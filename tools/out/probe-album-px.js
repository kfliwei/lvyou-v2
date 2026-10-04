/* 逐像素对照：album.seed 那块提示文字在基线与本次截图里各是什么颜色。 */
const fs = require('fs');
const PNG = require('pngjs').PNG;
const rd = f => PNG.sync.read(fs.readFileSync(f));
const a = rd('tools/out/visual-baseline/album.seed.390x844.png');
const b = rd('tools/out/visual-diff/album.seed.390x844.cur.png');
const L = (p, x, y) => { const i = ((p.width * y) + x) << 2; return [p.data[i], p.data[i + 1], p.data[i + 2]]; };
const lum = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
for (const [n, p] of [['base', a], ['cur', b]]) {
  let mx = -1, at = null;
  for (let y = 1590; y < 1670; y++) for (let x = 290; x < 480; x++) {
    const c = L(p, x, y), l = lum(c);
    if (l > mx) { mx = l; at = [x, y, c.join(',')]; }
  }
  console.log(n + ' 最亮 ' + mx.toFixed(0) + ' @' + at[0] + ',' + at[1] + ' rgb=' + at[2]);
}
for (const [x, y] of [[330, 1630], [360, 1634], [420, 1630], [300, 1610], [460, 1655], [380, 1600]])
  console.log('px ' + x + ',' + y + '  base=' + L(a, x, y).join(',') + '  cur=' + L(b, x, y).join(','));
