/* 改版前的 diff 图定量归档：红点住在哪几段 y 区间，不靠肉眼说「只在底部那一摞」 */
const fs = require('fs');
const { PNG } = require('pngjs');

const file = process.argv[2] || 'tools/out/b29-visual-diff-before-update/travel-map.seed.390x844.png';
const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;

const rows = new Array(H).fill(0);
let red = 0, minX = W, maxX = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 150 && g < 110 && b < 110) {
      red++; rows[y]++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
}
/* 连续有红的行合成区间（允许 3 行空隙） */
const bands = [];
let s = -1, gap = 0;
for (let y = 0; y < H; y++) {
  if (rows[y] > 0) { if (s < 0) s = y; gap = 0; }
  else if (s >= 0 && ++gap > 3) { bands.push([s, y - gap]); s = -1; gap = 0; }
}
if (s >= 0) bands.push([s, H - 1]);

console.log('图 ' + W + 'x' + H + '  红像素 ' + red + '（' + (red * 100 / (W * H)).toFixed(2) + '% 面积）  x 跨度 ' + minX + '..' + maxX);
bands.forEach(([a, b]) => console.log('  y ' + a + '..' + b + '（高 ' + (b - a + 1) + 'px，峰值 ' + Math.max(...rows.slice(a, b + 1)) + ' px/行）'));
console.log('上半屏（y < ' + Math.round(H * 0.6) + '）红像素 ' + rows.slice(0, Math.round(H * 0.6)).reduce((a, b) => a + b, 0));
