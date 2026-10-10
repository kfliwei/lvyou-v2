/* probe33f-diff.js — 把像素 diff 图里的红区聚成连通块，逐块印坐标/面积/占视口比例
 * 用法: node tools/out/probe33f-diff.js            # 默认扫本次 7 张红态
 *       node tools/out/probe33f-diff.js a.png b.png
 * 为什么要这一支：只写「story 红 0.70%」守不住任何东西——要能回答「红在哪一块、
 * 是不是我这一批改的那一块」。连通块 + 视口坐标是唯一能对着源码行号核的口径。
 * 输出只读盘，不改任何文件。 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', '..');
const DIFF = path.join(ROOT, 'tools', 'out', 'visual-diff');
const DEFAULT = ['story.320x640.png', 'story.328x723.png', 'story.390x844.png', 'story.452x995.png',
  'story.768x1024.png', 'story.1440x900.png', 'story.seed.390x844.png'];

const args = process.argv.slice(2);
const names = args.length ? args : DEFAULT;

/* pixelmatch 把不匹配像素画成红（亮红到暗红），alpha 混合的抗锯齿边会偏黄；
   这里只认「红主导」的像素，避免把基线里本来就有的暖色看成交货。 */
function isRed(r, g, b) {
  return r > 90 && r > g * 1.6 && r > b * 1.6;
}

function clusters(png) {
  const { width: W, height: H, data } = png;
  const cs = 8;                       /* 8px 网格做并查集，够定位又不炸内存 */
  const cols = Math.ceil(W / cs), rows = Math.ceil(H / cs);
  const parent = new Int32Array(cols * rows).fill(-1);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const hit = new Map();              /* cellIdx -> count */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      if (!isRed(data[i], data[i + 1], data[i + 2])) continue;
      const ci = Math.floor(y / cs) * cols + Math.floor(x / cs);
      if (parent[ci] === -1) parent[ci] = ci;
      hit.set(ci, (hit.get(ci) || 0) + 1);
      /* 与已知的上/左邻格合并，保证连通性 */
      const up = ci - cols, lf = ci - 1;
      if (up >= 0 && parent[up] !== -1) uni(ci, up);
      if (lf >= 0 && lf % cols !== cols - 1 && parent[lf] !== -1) uni(ci, lf);
    }
  }
  const boxes = new Map();
  for (const [ci, n] of hit) {
    const root = find(ci);
    const cx = ci % cols, cy = Math.floor(ci / cols);
    let b = boxes.get(root);
    if (!b) b = { x0: cx * cs, y0: cy * cs, x1: cx * cs + cs, y1: cy * cs + cs, px: 0 };
    b.x0 = Math.min(b.x0, cx * cs); b.y0 = Math.min(b.y0, cy * cs);
    b.x1 = Math.max(b.x1, cx * cs + cs); b.y1 = Math.max(b.y1, cy * cs + cs);
    b.px += n;
    boxes.set(root, b);
  }
  return { W, H, total: hit.size ? [...hit.values()].reduce((a, b) => a + b, 0) : 0, list: [...boxes.values()].sort((a, b) => b.px - a.px) };
}

const out = [];
function p(s) { out.push(s); console.log(s); }

p('=== diff 图红区连通块（8px 网格并查集；只认红主导像素） ===');
for (const nm of names) {
  const fp = path.join(DIFF, nm);
  if (!fs.existsSync(fp)) { p(nm + ' — 文件不存在，跳过'); continue; }
  const png = PNG.sync.read(fs.readFileSync(fp));
  const c = clusters(png);
  p('\n' + nm + '  视口 ' + c.W + '×' + c.H + '  红像素 ' + c.total + '  块数 ' + c.list.length);
  c.list.slice(0, 12).forEach((b, i) => {
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    p('  块' + (i + 1) + ' x=' + b.x0 + '-' + b.x1 + ' y=' + b.y0 + '-' + b.y1 +
      ' 尺寸 ' + w + '×' + h + ' 红像素 ' + b.px + ' 占图 ' + (b.px / (c.W * c.H) * 100).toFixed(3) + '%' +
      ' 纵向位置 ' + (b.y0 / c.H * 100).toFixed(1) + '%-' + (b.y1 / c.H * 100).toFixed(1) + '%');
  });
  if (c.list.length > 12) p('  …另有 ' + (c.list.length - 12) + ' 块（每块 <' + c.list[11].px + ' 像素）');
}
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-diff-clusters.txt'), out.join('\n') + '\n');
