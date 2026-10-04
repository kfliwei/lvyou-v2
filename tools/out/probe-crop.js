/* 把某张 PNG 的一小块裁出来放大，肉眼看看那块是什么组件。
   用法：node tools/out/probe-crop.js <in.png> <x> <y> <w> <h> [scale] [out.png] */
const fs = require('fs');
const PNG = require('pngjs').PNG;

const [inF, xs, ys, ws, hs, ss = '4', outF] = process.argv.slice(2);
const x0 = +xs, y0 = +ys, w = +ws, h = +hs, sc = +ss;
const p = PNG.sync.read(fs.readFileSync(inF));
const o = new PNG({ width: w * sc, height: h * sc });
for (let yy = 0; yy < h * sc; yy++) {
  for (let xx = 0; xx < w * sc; xx++) {
    const sx = Math.min(p.width - 1, x0 + Math.floor(xx / sc));
    const sy = Math.min(p.height - 1, y0 + Math.floor(yy / sc));
    const si = (p.width * sy + sx) << 2, di = (o.width * yy + xx) << 2;
    for (let c = 0; c < 4; c++) o.data[di + c] = p.data[si + c];
  }
}
const dest = outF || inF.replace(/\.png$/, '') + '.crop-' + x0 + '_' + y0 + '.png';
fs.writeFileSync(dest, PNG.sync.write(o));
console.log('已写 ' + dest + '（' + o.width + 'x' + o.height + '，取自 ' + x0 + ',' + y0 + ' 起 ' + w + 'x' + h + '）');
