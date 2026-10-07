/* tools/out/probe25b-crop.js — 把基线与当前图的同一条带裁出来给人眼看
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe25b-crop.js <tag.png> <cssY0> <cssY1>
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const ROOT = path.join(__dirname, '..', '..');
const tag = process.argv[2], y0c = +process.argv[3], y1c = +process.argv[4];
const a = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'tools', 'out', 'visual-baseline', tag)));
const b = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'tools', 'out', 'visual-diff', tag.replace(/\.png$/, '') + '.cur.png')));
const dsf = a.height / (parseInt(tag.match(/x(\d+)\.png$/)[1], 10) || a.height);
const y0 = Math.max(0, Math.round(y0c * dsf)), y1 = Math.min(a.height, Math.round(y1c * dsf));
const h = y1 - y0;
function crop(img) {
  const o = new PNG({ width: img.width, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < img.width; x++) {
      const p = ((y0 + y) * img.width + x) << 2, q = (y * img.width + x) << 2;
      o.data[q] = img.data[p]; o.data[q + 1] = img.data[p + 1]; o.data[q + 2] = img.data[p + 2]; o.data[q + 3] = 255;
    }
  }
  return o;
}
const ca = crop(a), cb = crop(b);
/* 上下堆叠而不是左右并排：并排会把宽度翻倍，Read 预览一缩放字就糊了 */
const out = new PNG({ width: ca.width, height: h * 2 + 8 });
for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
  const q = (y * out.width + x) << 2;
  let src = null, sy = y;
  if (y < h) { src = ca; sy = y; }
  else if (y >= h + 8) { src = cb; sy = y - h - 8; }
  if (!src) { out.data[q] = 160; out.data[q + 1] = 160; out.data[q + 2] = 160; out.data[q + 3] = 255; continue; }
  const p = (sy * src.width + x) << 2;
  out.data[q] = src.data[p]; out.data[q + 1] = src.data[p + 1]; out.data[q + 2] = src.data[p + 2]; out.data[q + 3] = 255;
}
const f = path.join(ROOT, 'tools', 'out', 'visual-diff', tag.replace(/\.png$/, '') + '.crop-' + y0c + '-' + y1c + '.png');
fs.writeFileSync(f, PNG.sync.write(out));
console.log(f + '  上=基线 下=当前  带 ' + y0c + '-' + y1c + ' css（dsf=' + dsf.toFixed(2) + '）');
