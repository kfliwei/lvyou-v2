const fs = require('fs');
const { PNG } = require('pngjs');
const p = PNG.sync.read(fs.readFileSync(process.argv[2]));
/* pixelmatch 的输出：不一致=红，容差内=黄，其余是原图淡成灰。只数红/黄。 */
let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
const cls = (r, g, b) => (r > 180 && g < 90 && b < 90) ? 'R' : (r > 180 && g > 140 && b < 120) ? 'Y' : null;
for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
  const i = (p.width * y + x) << 2;
  if (cls(p.data[i], p.data[i + 1], p.data[i + 2])) {
    n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
console.log(p.width + 'x' + p.height + ' 红/黄像素 ' + n + ' (' + (n / (p.width * p.height) * 100).toFixed(3) + '%)');
if (n) console.log('包围盒 x ' + minX + '→' + maxX + ' / y ' + minY + '→' + maxY + '（' + (maxX - minX + 1) + 'x' + (maxY - minY + 1) + '）');
const band = 40, hist = {};
for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
  const i = (p.width * y + x) << 2;
  if (cls(p.data[i], p.data[i + 1], p.data[i + 2])) { const b = Math.floor(y / band) * band; hist[b] = (hist[b] || 0) + 1; }
}
Object.keys(hist).sort((a, b) => hist[b] - hist[a]).slice(0, 8).forEach(b => console.log('  y ' + b + '–' + (+b + band) + ': ' + hist[b] + ' px'));
