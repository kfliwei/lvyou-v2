/* b13-attr.js — 边缘点普查的逐枚几何归因（读 probe-edge-points.js 的 RAW_OUT JSONL）
 *
 * 用法：node tools/out/b13-attr.js tools/out/b13-raw-before-452.jsonl
 *
 * 为什么不能拿人眼读的日志行做统计：report 每个状态只印前 8 条；
 * 而且首轮我用正则读日志，带两个标记的行（[切边][出元素]）整批漏掉，右溢几乎全在那批里。
 *
 * 两个口径：
 *   失效 = 视觉盒越出屏幕 / 越出地图元素 / 越出可用区（可用区＝元素矩形扣掉成带的固定浮层）；
 *   「只把胶囊居中」反事实 = 把合集盒改成以地理锚点为中心后重算同一批几何谓词，
 *   差值＝「胶囊从锚点向右下悬出」单独能救回多少
 *   （被浮层命中需要矩形列表，反事实不重算那一条，只算几何三谓词）。
 */
const fs = require('fs');
const file = process.argv[2] || 'tools/out/b13-raw-before-452.jsonl';
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));

function preds(box, r) {
  const mr = r.mapRect, u = r.usable, vp = r.vp;
  const usable = { l: mr[0] + u[0], t: mr[1] + u[1], r: mr[0] + u[2], b: mr[1] + u[3] };
  const el = { l: mr[0], t: mr[1], r: mr[0] + mr[2], b: mr[1] + mr[3] };
  return {
    offVp: box.r < 0 || box.l > vp[0] || box.b < 0 || box.t > vp[1],
    cutVp: box.l < 0 || box.r > vp[0] || box.t < 0 || box.b > vp[1],
    cutEl: box.l < el.l - 1 || box.r > el.r + 1 || box.t < el.t - 1 || box.b > el.b + 1,
    outUse: box.l < usable.l - 1 || box.r > usable.r + 1 || box.t < usable.t - 1 || box.b > usable.b + 1,
    over: {
      rightVp: Math.max(0, box.r - vp[0]), leftVp: Math.max(0, -box.l),
      topVp: Math.max(0, -box.t), bottomVp: Math.max(0, box.b - vp[1]),
      bottomUse: Math.max(0, box.b - usable.b), topUse: Math.max(0, usable.t - box.t),
      leftUse: Math.max(0, usable.l - box.l), rightUse: Math.max(0, box.r - usable.r)
    }
  };
}
const boxNow = r => { const mr = r.mapRect; return { l: mr[0] + r.m.bx[0], t: mr[1] + r.m.bx[1], r: mr[0] + r.m.bx[2], b: mr[1] + r.m.bx[3] }; };
const boxCentered = r => { const mr = r.mapRect, ax = mr[0] + r.m.ax, ay = mr[1] + r.m.ay; return { l: ax - r.m.size[0] / 2, t: ay - r.m.size[1] / 2, r: ax + r.m.size[0] / 2, b: ay + r.m.size[1] / 2 }; };
const bad = p => p.offVp || p.cutVp || p.cutEl || p.outUse;
const pct = (a, b) => (b ? (a * 100 / b).toFixed(1) : '0.0') + '%';
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

const states = ['init', 'z+1', 'z+2', 'z+3'];
const acc = {};
const all = [];
rows.forEach(r => {
  const s = acc[r.st] = acc[r.st] || { n: 0, bad: 0, cap: 0, capBad: 0, capBadIfCentered: 0, nod: 0, nodBad: 0, cov: 0, depths: {}, pages: {} };
  const p = preds(boxNow(r), r);
  s.n++;
  s.pages[r.page] = s.pages[r.page] || { n: 0, bad: 0 };
  s.pages[r.page].n++;
  const isCap = r.m.k === '合集';
  if (isCap) s.cap++; else s.nod++;
  if (r.m.underOverlay) s.cov++;
  const isBad = bad(p);
  if (isBad) { s.bad++; s.pages[r.page].bad++; }
  if (isCap) { if (isBad) s.capBad++; if (bad(preds(boxCentered(r), r))) s.capBadIfCentered++; }
  else if (isBad) s.nodBad++;
  Object.keys(p.over).forEach(k => { if (p.over[k] > 0) (s.depths[k] = s.depths[k] || []).push(p.over[k]); });
  all.push({ r: r, p: p, b: isBad, pc: isCap ? preds(boxCentered(r), r) : null });
});

console.log('文件 ' + file + '｜逐枚记录 ' + rows.length + ' 条');
states.forEach(k => {
  const s = acc[k]; if (!s) return;
  console.log(`\n[${k}] 标记 ${s.n} 枚（合集 ${s.cap}／节点 ${s.nod}）｜失效 ${s.bad}（${pct(s.bad, s.n)}）｜被成带浮层命中 ${s.cov}（${pct(s.cov, s.n)}）`);
  ['offVp', 'cutVp', 'cutEl', 'outUse'].forEach(p => {
    const n = rows.filter(r => r.st === k && r.m && preds(boxNow(r), r)[p]).length;
    if (n) console.log(`    ${p.padEnd(7)} ${String(n).padStart(4)} 枚 (${pct(n, s.n)})`);
  });
  Object.keys(s.depths).sort((a, b) => s.depths[b].length - s.depths[a].length).forEach(d => {
    const a = s.depths[d].slice().sort((x, y) => x - y);
    console.log(`    越界深度 ${d.padEnd(10)} ${String(a.length).padStart(4)} 枚  中位 ${q(a, .5)}px  p90 ${q(a, .9)}px  最大 ${a[a.length - 1]}px`);
  });
  console.log(`    合集失效 ${s.capBad}/${s.cap}（${pct(s.capBad, s.cap)}）｜只把胶囊居中的反事实：仍失效 ${s.capBadIfCentered}（救回 ${s.capBad - s.capBadIfCentered} 枚）`);
  console.log(`    节点失效 ${s.nodBad}/${s.nod}（${pct(s.nodBad, s.nod)}）`);
  const worst = Object.keys(s.pages).map(k2 => ({ p: k2, n: s.pages[k2].n, bad: s.pages[k2].bad })).filter(x => x.n).sort((x, y) => y.bad / y.n - x.bad / x.n).slice(0, 5);
  console.log('    最坏 5 页 ' + worst.map(x => `${x.p}:${x.bad}/${x.n}`).join(' '));
});

const tot = states.reduce((a, k) => { const s = acc[k]; if (s) { a.n += s.n; a.bad += s.bad; a.cap += s.cap; a.capBad += s.capBad; a.capIfC += s.capBadIfCentered; } return a; }, { n: 0, bad: 0, cap: 0, capBad: 0, capIfC: 0 });
console.log(`\n=== 合计 ${tot.n} 枚｜失效 ${tot.bad}（${pct(tot.bad, tot.n)}）｜合集 ${tot.capBad}/${tot.cap} 失效（${pct(tot.capBad, tot.cap)}），只居中后仍失效 ${tot.capIfC} → 居中这一条单独救回 ${tot.capBad - tot.capIfC} 枚（${pct(tot.capBad - tot.capIfC, tot.n)} 全站）`);
console.log('判读：居中救的是「右溢/下溢半枚」；剩下的要靠可用区口径（首屏 fit、+/− 锚点、聚合聚焦 padding）。');
