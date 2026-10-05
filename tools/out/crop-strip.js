/* crop-strip.js — 把「改前 / 改后」两张同尺寸图按带裁出来并竖向拼接，人审用
 * 用法: node tools/out/crop-strip.js <before.png> <after.png> <y0> <h> <out.png>
 * 为什么竖向不横向：横向拼成 1808px 宽，预览缩到一半就看不清颗粒和 1px 描边了。 */
const fs = require('fs');
const { PNG } = require('pngjs');
const [bf, af, y0, h, out] = process.argv.slice(2);
const a = PNG.sync.read(fs.readFileSync(bf));
const b = PNG.sync.read(fs.readFileSync(af));
const Y = +y0, H = +h;
if (a.width !== b.width) { console.error('两图宽度不等'); process.exit(2); }
const W = a.width, GAP = 8;
const o = new PNG({ width: W, height: H * 2 + GAP });
PNG.bitblt(a, o, 0, Y, W, H, 0, 0);
PNG.bitblt(b, o, 0, Y, W, H, 0, H + GAP);
fs.writeFileSync(out, PNG.sync.write(o));
console.log(out + ' ' + W + 'x' + (H * 2 + GAP) + '（上=改前 下=改后，裁自 y=' + Y + ' h=' + H + '）');
