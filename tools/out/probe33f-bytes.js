/* 把 D 档「0.00%」下面那 7 个亚阈值像素找出来：它们在哪、差多少、像哪一笔改动的残余 */
const fs = require('fs'), { PNG } = require('pngjs');
const pairs = [
  ['story.seed.390x844.png', 'seed-390-D-both.png'],
  ['story.328x723.png', 'empty-328-B-btn40.png'],
  ['story.390x844.png', null],
];
for (const [bf, sf] of pairs) {
  if (!sf) continue;
  const a = PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/' + bf));
  const b = PNG.sync.read(fs.readFileSync('tools/out/b33f-shots/' + sf));
  const out = [];
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) + Math.abs(a.data[i + 3] - b.data[i + 3]);
    if (d) { const px = i / 4; out.push({ x: px % a.width, y: Math.floor(px / a.width), d, a: [a.data[i], a.data[i + 1], a.data[i + 2], a.data[i + 3]], b: [b.data[i], b.data[i + 1], b.data[i + 2], b.data[i + 3]] }); }
  }
  console.log('== ' + bf + ' vs ' + sf + '  不一致像素 ' + out.length + ' / ' + (a.width * a.height) + '（占 ' + (out.length / a.width / a.height * 100).toFixed(5) + '%）');
  out.forEach(o => console.log('   x=' + o.x + ' y=' + o.y + ' ΣΔ=' + o.d + '  基线rgba(' + o.a + ')  当前rgba(' + o.b + ')'));
}
