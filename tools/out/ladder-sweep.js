/* ladder-sweep.js — 把散落的 font-size 字面量收进 V3 字号阶梯
 * 用法: node tools/out/ladder-sweep.js            # 干跑，只出报表
 *       node tools/out/ladder-sweep.js --write     # 落盘改写
 *       node tools/out/ladder-sweep.js --write --only design.css
 * 改写规则（只动 ≤20px 的 DOM 文字；≥21px 的标题/海报数字本轮登记为尾巴、不改）：
 *   就近落到阶梯，.5 一律进位；clamp() 里的（响应式标题）整条跳过；canvas 的 ctx.font 不含
 *   'font-size:' 所以天然不会被匹配。工具目录、vendor、数据 js 一律不碰。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const LADDER = [10, 11, 12, 13, 14, 15, 16, 17, 20];   /* --fs-1 … --fs-9 */
const nearest = v => {
  let best = LADDER[0];
  for (const s of LADDER) {
    if (Math.abs(s - v) < Math.abs(best - v) || (Math.abs(s - v) === Math.abs(best - v) && s > best)) best = s;
  }
  return best;
};
const tokenFor = v => '--fs-' + (LADDER.indexOf(nearest(v)) + 1);

const SKIP = new Set(['sw.js', 'test-data.js']);
const files = fs.readdirSync(ROOT).filter(f =>
  (f.endsWith('.css') || f.endsWith('.html') || f.endsWith('.js')) && !SKIP.has(f) && !/^\.-data\.js$/.test(f)
);

const WRITE = process.argv.includes('--write');
const oi = process.argv.indexOf('--only');
const ONLY = oi >= 0 ? process.argv[oi + 1].split(',') : null;
const targets = ONLY ? files.filter(f => ONLY.includes(f)) : files;

const hist = {};
let changed = 0, tail = 0, clamped = 0;
for (const f of targets) {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, 'utf8');
  let out = src;
  const perFile = {};
  out = out.replace(/font-size:(\s*)(\d+(?:\.\d+)?)(px|rem)/g, (m, sp, num, unit, off) => {
    const v = unit === 'px' ? parseFloat(num) : parseFloat(num) * 16;   /* rem 字面量是早前「px 换算成 rem」留下的第二族，同样要收进阶梯 */
    /* clamp() 内的字面量是响应式标题的下限，不能被 token 钉死 */
    const lineStart = out.lastIndexOf('\n', off) + 1;
    const nl = out.indexOf('\n', off);
    const line = out.slice(lineStart, nl < 0 ? out.length : nl);
    if (line.includes('clamp(')) { clamped++; return m; }
    if (v > 20) { tail++; return m; }
    const tok = tokenFor(v);
    const key = num + unit + '→' + tok;
    perFile[key] = (perFile[key] || 0) + 1;
    hist[key] = (hist[key] || 0) + 1;
    changed++;
    return 'font-size:var(' + tok + ')';
  });
  const ks = Object.keys(perFile).sort();
  if (ks.length) console.log(f + ': ' + ks.map(k => k + '×' + perFile[k]).join('  '));
  if (WRITE && out !== src) fs.writeFileSync(p, out, 'utf8');
}
console.log('---');
console.log((WRITE ? '已改写' : '干跑') + '：命中 ' + changed + ' 处 | ≥21px 尾巴 ' + tail + ' 处（不动）| clamp 内跳过 ' + clamped + ' 处');
console.log('涉及文件 ' + targets.length + ' 个：' + targets.join(' '));
