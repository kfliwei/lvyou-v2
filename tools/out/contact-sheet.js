/* 把一批基线截图拼成一张联络表，人审时一眼看完一整族，避免逐张开 17 次图。
   用法：node tools/out/contact-sheet.js <out.png> <scale> <列数> <tag 前缀…>
   例：node tools/out/contact-sheet.js tools/out/b25a-sheet-328.png 0.5 4 328x723 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BASE = path.join(__dirname, 'visual-baseline');
const args = process.argv.slice(2);
const OUT = args[0];
const SCALE = parseFloat(args[1] || '0.5');
const COLS = parseInt(args[2] || '4', 10);
const pats = args.slice(3);

const files = fs.readdirSync(BASE).filter(f => f.endsWith('.png'))
  .filter(f => !pats.length || pats.some(p => f.includes(p)))
  .sort();
if (!files.length) { console.error('没有匹配的基线'); process.exit(1); }

const src = files.map(f => ({ f, png: PNG.sync.read(fs.readFileSync(path.join(BASE, f))) }));
const cellW = Math.round(src[0].png.width * SCALE);
const cellH = Math.round(src[0].png.height * SCALE);
const rows = Math.ceil(src.length / COLS);
const sheet = new PNG({ width: cellW * COLS, height: cellH * rows });

/* 最近邻缩到 cellW×cellH：人审要的是「哪一格破了」，不是重采样质量 */
src.forEach((s, i) => {
  const cx = (i % COLS) * cellW, cy = Math.floor(i / COLS) * cellH;
  for (let y = 0; y < cellH; y++) {
    const sy = Math.min(s.png.height - 1, Math.floor(y / SCALE));
    for (let x = 0; x < cellW; x++) {
      const sx = Math.min(s.png.width - 1, Math.floor(x / SCALE));
      const si = (s.png.width * sy + sx) << 2, di = (sheet.width * (cy + y) + (cx + x)) << 2;
      sheet.data[di] = s.png.data[si];
      sheet.data[di + 1] = s.png.data[si + 1];
      sheet.data[di + 2] = s.png.data[si + 2];
      sheet.data[di + 3] = 255;
    }
  }
});
fs.writeFileSync(OUT, PNG.sync.write(sheet));
console.log('格子顺序（行优先）:');
src.forEach((s, i) => console.log('  [' + (i % COLS) + ',' + Math.floor(i / COLS) + '] ' + s.f +
  ' ' + s.png.width + 'x' + s.png.height + ' ' + Math.round(fs.statSync(path.join(BASE, s.f)).size / 1024) + 'KB'));
console.log('已拼 ' + src.length + ' 张 → ' + OUT + '（' + sheet.width + 'x' + sheet.height + '，' +
  Math.round(fs.statSync(OUT).size / 1024) + 'KB）');
