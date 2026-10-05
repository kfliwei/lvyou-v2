/* tools/out/mut-smoke31.js — §31 的浏览器腿变异自测（批次 18 的 B 组）
 *
 * 四条「改了源码，真浏览器里必须变红」的行为退化。判落点的口径写在每条名字里，
 * 首轮打偏的两条也原样留着（别照着上一版的期望读）：
 *   · 原 B1 想测「侧栏进 USABLE_BANDS → 双份内缩」，实测浏览器腿**抓不到**：双栏档下侧栏盒与
 *     地图盒相切不重叠（ix=0 < 12 先被排除），内缩仍算出 0,0，U16 照绿。那一条只能由源码锚
 *     M9 守（§31 的 FAIL 文案里已明写「这条只有源码腿能守」）。B1 改成测「侧栏没从容器宽度里
 *     让开」这个真几何后果。
 *   · B3 丢的第二个实参不只是不对称内缩，还有调用方传进来的 maxZoom：四川 390 档因此渲出 0 枚
 *     标记且永不安稳，红落在 U12 而不是预期的 U4——因为 clampCapsules 还在独立兜首屏越界。
 *     「哪一层兜住了哪个症状」正是这组要留档的东西，所以按实测落点收。
 * 每条真跑一遍 tools/smoke-usable.js（约 220s），逐条串行；**不得与像素基线并行**（争用同一份基线文件）。
 * 用法: NODE_PATH=…/tools/node_modules node tools/out/mut-smoke31.js > tools/out/b18-mut-smoke31.txt 2>&1
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['topic-common.js', 'design.css'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function smoke() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-usable.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}

let red = 0, anomalies = 0, total = 0;
function run(name, file, from, to, token) {
  total++;
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  if (n !== 1) { anomalies++; console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1'); return; }
  if (from === to) { anomalies++; console.log('异常  ' + name + '  恒等变异，这条什么都没测'); return; }
  fs.writeFileSync(path.join(ROOT, file), src.replace(from, () => to));
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  const hit = fails.filter(l => l.indexOf(token) >= 0);
  const sum = out.match(/=== smoke-usable: (\d+)\/(\d+) PASS ===/) || [];
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → ' + (sum[1] || '?') + '/' + (sum[2] || '?') + ' PASS，FAIL ' + fails.length + ' 条（' +
      fails.map(l => (l.match(/FAIL (U\d+)/) || [])[1] || '?').join(',') + '），指定那条：' + hit[0].slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  浏览器腿没按预期红（想找：' + token + '）；FAIL ' + fails.length + ' 条：' +
      fails.map(l => l.slice(0, 60)).join(' | '));
  }
}

run('B1 侧栏不再从容器宽度里让开（改回覆盖式）→ U16 的「地图左缘＝侧栏右缘」必须红', 'design.css',
  'body.topic-page main>.view{left:var(--dv-side)}', 'body.topic-page main>.view{left:0}',
  'FAIL U16');

run('B2 双栏阈值 900→700 → U18（768 仍单栏）必须红', 'design.css',
  '@media (min-width: 900px){', '@media (min-width: 700px){',
  'FAIL U18');

run('B3 fitUsable 丢掉第二实参（不对称内缩与 maxZoom 一起没）→ 浏览器腿必须红', 'topic-common.js',
  'map.fitBounds(bounds, o);', 'map.fitBounds(bounds);',
  'FAIL U12');

run('B4 侧带判据失效（左右内缩退回结构性恒 0）→ U14/U15 必须红（这就是横向分支的活体反证）', 'topic-common.js',
  '} else if (iy >= el.height * 0.6) {', '} else if (iy >= el.height * 9.9) {',
  'FAIL U14');

console.log('\n=== mut-smoke31（浏览器腿）: ' + red + ' 条按预期红 / ' + anomalies + ' 条异常 / 共 ' + total + ' 条 ===');
process.exit(anomalies ? 1 : 0);
