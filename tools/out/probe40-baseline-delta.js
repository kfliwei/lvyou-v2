/* 批次 40 基线范围证明：清单指纹变了 6 条，逐条量「画面到底变了多少像素」
   （口径沿用批次 39：sha 变 ≠ 画面变——抗锯齿会改字节而不改肉眼可见的画面） */
const fs = require('fs'), { PNG } = require('pngjs');
const names = process.argv.slice(2);
for (const n of names) {
  const a = PNG.sync.read(fs.readFileSync('tools/out/visual-baseline-prev/' + n));
  const b = PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/' + n));
  let cnt = 0, max = 0, y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > 0) {
      cnt++; if (d > max) max = d;
      const p = i / 4, y = (p / a.width) | 0, x = p % a.width;
      if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
    }
  }
  console.log(n.padEnd(20) + ' 差像素 ' + cnt + ' 最大通道差 ' + max
    + ' 位置 CSS y ' + (y0 / 2).toFixed(0) + '–' + (y1 / 2).toFixed(0) + ' x ' + (x0 / 2).toFixed(0) + '–' + (x1 / 2).toFixed(0));
}
