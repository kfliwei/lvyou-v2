/* tools/out/mut-verify25-perf.js — verify.js §25 新增三条「性能预算采样口径」锚的变异自测
 *
 * 为什么单开一张小网：这三条是批次 21 顺手修的一条**假闸**（单次采样的 LCP 在冷首屏上随机红），
 * 它不属于 §34 那张 62 条的网（那张守的是「附近」产品逻辑），也不该塞进 §34 的条数守卫里。
 * 每条只改一处 → 跑 node tools/verify.js → 必须在指定的那条 §25 红里看见它。
 *
 * 已知守不住的一条，写在这里而不是假装没有：**把这三条锚本身删掉**，§25 没有条数下限守卫，
 * 闸门不会红（§34 那边有 A34.length < 42 这种「守门的门」，本节没有）。要补就先给 §25 加规模下限。
 *
 * 用法: MUT_LOG=tools/out/b21-mut-verify25-perf.txt node tools/out/mut-verify25-perf.js
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['tools/visual-check.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
const pick = out => out.split('\n').filter(l => /^FAIL /.test(l) || l.indexOf('语法') >= 0);

let red = 0, anomalies = 0, total = 0;
function run(name, file, from, to, token) {
  total++;
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  if (n !== 1) { anomalies++; console.log('异常  ' + name + '  from 命中 ' + n + ' 次（要恰 1 次），这一条没打出去'); return; }
  fs.writeFileSync(path.join(ROOT, file), src.replace(from, to));
  let lines;
  try { lines = pick(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → 本轮红 ' + lines.length + ' 条，指定那条：' + hit[0].replace(/^FAIL /, '').slice(0, 160));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}

run('P1 采样次数改回 1（单次读数＝掷硬币，本批 3252ms 那条红就是这么来的）', 'tools/visual-check.js',
  'const PERF_SAMPLES = 3;', 'const PERF_SAMPLES = 1;', '性能预算回到单次采样');
run('P2 LCP 不取中位、直接取第一个样本', 'tools/visual-check.js',
  'const lcp = ls.slice().sort((a, b) => a - b)[1];', 'const lcp = ls[0];', 'LCP 没取样本中位数');
run('P3 CLS 跟着取中位（时间能取中位，位移越线一次就算越线）', 'tools/visual-check.js',
  'const cls = Math.max.apply(null, cs);', 'const cls = cs.slice().sort((a, b) => a - b)[1];', 'CLS 没取三次里的最大值');
run('P4 README 抹掉「LCP 中位」登记（改了口径不写进 README 就等于没改）', 'README.md',
  '3 次采样的 LCP 中位', '3 次采样的 LCP中位', 'README.md 没登记性能预算的采样口径');

console.log('---');
console.log('mut-verify25-perf: ' + red + '/' + total + ' 按预期红，异常 ' + anomalies);
process.exitCode = anomalies ? 1 : 0;
