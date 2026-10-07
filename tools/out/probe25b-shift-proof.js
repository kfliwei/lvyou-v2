/* tools/out/probe25b-shift-proof.js — 批次 25-B 的「像素红到底动了哪里」范围证明
 *
 * 为什么要这支探针：本批把顶栏一族从 40 抬到 44、标题改成可换行、`.ctl` 收了 margin，
 * 顶栏**长高了几个 CSS px**，于是它下面的一切整体下移——像素闸门会把「内容平移」也记成改版，
 * 92 态红里混着两种完全不同的东西：① 顶栏那一族真的变了（该红）；② 只是被顶栏顶下去几 px（内容没改）。
 * 「92 张图我人眼看过没问题」不是证据。这里量的是**位移假设能不能解释整张图**：
 *   对每个红态，把当前图按 dy 平移后与基线逐像素比，取差异最小的 dy；
 *   若某个小 dy 能把差异率从 X% 压到近 0，说明这张图的改动＝整体平移（内容本身没变），
 *   剩下的残差再按行分带打印，看它落在哪一段高度上。
 * 判据不是自动放行，而是**把「该变的只在哪一条带」变成可复跑的数字**，人审只需要看那一条带。
 *
 * 前置：先跑 `node tools/visual-check.js --keep-current`（当前图落在 tools/out/visual-diff/<tag>.cur.png）。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe25b-shift-proof.js [tag 前缀过滤]
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', '..');
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const DIFF = path.join(ROOT, 'tools', 'out', 'visual-diff');
const filter = process.argv[2] || '';
const MAXDY = 20;                 /* 设备像素：DSF=2 时 10 CSS px 以内都算「小位移」 */

function load(f) { return PNG.sync.read(fs.readFileSync(f)); }
function diffAt(a, b, w, h, dy) {
  /* 只在两图重叠的行上比。a[y] 对 b[y-dy]，所以符号与直觉相反：
     dy>0 ＝ 当前图的内容比基线**高** dy 行（上移）；dy<0 ＝ 更低（下移）。 */
  let n = 0, y0 = Math.max(0, dy), y1 = Math.min(h, h) - Math.max(0, -dy);
  for (let y = y0; y < y1; y++) {
    const ia = (y * w) << 2, ib = ((y - dy) * w + 0) << 2;
    for (let x = 0; x < w; x++) {
      const p = ia + (x << 2), q = ib + (x << 2);
      if (Math.abs(a.data[p] - b.data[q]) > 8 || Math.abs(a.data[p + 1] - b.data[q + 1]) > 8 ||
          Math.abs(a.data[p + 2] - b.data[q + 2]) > 8) { n++; }
    }
  }
  return n;
}
function rowsChanged(a, b, w, h, dy) {
  /* 返回每行差异像素数，用于分带定位残差住在哪 */
  const per = new Int32Array(h);
  const y0 = Math.max(0, dy), y1 = h - Math.max(0, -dy);
  for (let y = y0; y < y1; y++) {
    let n = 0;
    const pa = (y * w) << 2, pb = ((y - dy) * w) << 2;
    for (let x = 0; x < w; x++) {
      const p = pa + (x << 2), q = pb + (x << 2);
      if (Math.abs(a.data[p] - b.data[q]) > 8 || Math.abs(a.data[p + 1] - b.data[q + 1]) > 8 ||
          Math.abs(a.data[p + 2] - b.data[q + 2]) > 8) n++;
    }
    per[y] = n;
  }
  return per;
}

const tags = fs.readdirSync(DIFF).filter(f => /\.cur\.png$/.test(f)).map(f => f.replace(/\.cur\.png$/, '.png'));
let out = [];
tags.forEach(tag => {
  if (filter && tag.indexOf(filter) < 0) return;
  const bf = path.join(BASE, tag), cf = path.join(DIFF, tag.replace(/\.png$/, '') + '.cur.png');
  if (!fs.existsSync(bf)) { out.push(tag + '  基线缺失，跳过'); return; }
  const a = load(bf), b = load(cf);
  if (a.width !== b.width || a.height !== b.height) {
    out.push(tag + '  尺寸不同 ' + a.width + 'x' + a.height + ' → ' + b.width + 'x' + b.height + '（不是平移，必须人审）');
    return;
  }
  const W = a.width, H = a.height, total = W * H;
  const dsf = H / (parseInt(tag.match(/x(\d+)\.png$/)[1], 10) || H);   /* 从态名反推设备像素比，带高按 CSS px 定 */
  const d0 = diffAt(a, b, W, H, 0);
  let best = { dy: 0, n: d0 };
  /* 双向搜：本批顶栏在多数内容页上**长高了 4 CSS px**（钮 40→44），它下面的一切随之往下顶，
     极值落在 dy=-8（设备像素，DSF=2）。只搜 dy≥0 会把「平移」误判成「整页改版」——第一次跑就被这条骗了一次。 */
  for (let dy = -MAXDY; dy <= MAXDY; dy++) {
    if (dy === 0) continue;
    const n = diffAt(a, b, W, H, dy);
    if (n < best.n) best = { dy: dy, n: n };
  }
  const per = rowsChanged(a, b, W, H, best.dy);
  /* 分区：顶栏带（真改了，该红）／中段滚动区（只该被顶栏顶开 dy，位移模型要能解释干净）／底部固定带。
     底部固定带（tabbar／FAB）不随文档流上移，所以单一 dy 模型必然在它上面留残差——那不是改版，
     是模型的边界，必须单独报出来，否则「残差 19%」会被误读成「底部也改了」。 */
  const T = Math.min(H, Math.round(90 * dsf)), Bm = Math.max(0, H - Math.round(110 * dsf));
  const zone = function (y0, y1) {
    let s = 0; for (let y = y0; y < y1; y++) s += per[y];
    return (100 * s / ((y1 - y0) * W)).toFixed(2);
  };
  const per0 = rowsChanged(a, b, W, H, 0);
  let s0 = 0; for (let y = Bm; y < H; y++) s0 += per0[y];
  out.push(tag + '  图高' + H + '  原始 ' + (100 * d0 / total).toFixed(2) + '% → 平移 dy=' + best.dy +
    ' 后残差 ' + (100 * best.n / total).toFixed(2) + '%｜顶带(0-90css) ' + zone(0, T) + '%｜中段 ' + zone(T, Bm) +
    '%｜底固定带(按 dy 比) ' + zone(Bm, H) + '%｜底固定带(不位移比) ' + (100 * s0 / ((H - Bm) * W)).toFixed(2) + '%');
});
out.forEach(l => console.log(l));
console.log('--- 共 ' + out.length + ' 个态 ---');
