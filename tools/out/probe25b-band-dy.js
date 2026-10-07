/* tools/out/probe25b-band-dy.js — 批次 25-B 红态的「逐带位移」证明
 *
 * probe25b-shift-proof.js 用**一个** dy 解释整张图。story 系那一族它解释不动：
 * 顶栏长高 4 CSS px，而它下面的地图区高度是跟着顶栏算的，于是「顶栏往下挪 4、
 * 空态往下挪 8」——单一 dy 取哪个都不对，残差就停在 2%～3%，看着像改版。
 * 这支探针把图按 CSS 高度切成窄带，**每带独立搜 dy**，输出「哪一条带、挪了几 px、挪完还剩多少」。
 * 全带残差近 0 ⇒ 这张图只是被分段顶开，没有内容变化；某带挪不动 ⇒ 那条带真的要人眼审。
 *
 * 前置：先跑 `node tools/visual-check.js --keep-current`。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe25b-band-dy.js <tag 前缀>
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', '..');
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const DIFF = path.join(ROOT, 'tools', 'out', 'visual-diff');
const filter = process.argv[2] || '';
const STRIP_CSS = 40;
const MAXDY = 24;

function load(f) { return PNG.sync.read(fs.readFileSync(f)); }

const tags = fs.readdirSync(DIFF).filter(f => /\.cur\.png$/.test(f)).map(f => f.replace(/\.cur\.png$/, '.png')).sort();
tags.forEach(tag => {
  if (filter && tag.indexOf(filter) < 0) return;
  const bf = path.join(BASE, tag), cf = path.join(DIFF, tag.replace(/\.png$/, '') + '.cur.png');
  if (!fs.existsSync(bf)) return;
  const a = load(bf), b = load(cf);
  if (a.width !== b.width || a.height !== b.height) { console.log(tag + '  尺寸不同，跳过'); return; }
  const W = a.width, H = a.height;
  const dsf = H / (parseInt(tag.match(/x(\d+)\.png$/)[1], 10) || H);
  const strip = Math.max(8, Math.round(STRIP_CSS * dsf));
  const rows = function (y0, y1, dy) {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      const ya = y, yb = y - dy;
      if (yb < 0 || yb >= H) { n += W; continue; }
      const pa = (ya * W) << 2, pb = (yb * W) << 2;
      for (let x = 0; x < W; x++) {
        const p = pa + (x << 2), q = pb + (x << 2);
        if (Math.abs(a.data[p] - b.data[q]) > 8 || Math.abs(a.data[p + 1] - b.data[q + 1]) > 8 ||
            Math.abs(a.data[p + 2] - b.data[q + 2]) > 8) n++;
      }
    }
    return n;
  };
  const parts = [];
  for (let y0 = 0; y0 < H; y0 += strip) {
    const y1 = Math.min(H, y0 + strip);
    const d0 = rows(y0, y1, 0);
    let best = { dy: 0, n: d0 };
    for (let dy = -MAXDY; dy <= MAXDY; dy++) {
      if (!dy) continue;
      const n = rows(y0, y1, dy);
      if (n < best.n) best = { dy: dy, n: n };
    }
    const pct = function (v) { return (100 * v / ((y1 - y0) * W)).toFixed(2); };
    const c0 = Math.round(y0 / dsf), c1 = Math.round(y1 / dsf);
    if (d0 < 0.05 * W && best.n < 0.05 * W) continue;   /* 两条带都几乎全白，不印 */
    parts.push(c0 + '-' + c1 + 'css: ' + pct(d0) + '%→dy=' + best.dy + ' 剩 ' + pct(best.n) + '%');
  }
  console.log('== ' + tag + ' (dsf=' + dsf.toFixed(2) + ')');
  parts.forEach(p => console.log('   ' + p));
  if (!parts.length) console.log('   （所有带都近 0）');
});
