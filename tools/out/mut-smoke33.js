/* tools/out/mut-smoke33.js — §33 的浏览器腿变异自测（批次 20 的 B 组）
 *
 * 8.4 要的形状就是「同一变异两层都红」：源码腿（mut-verify33）证明锚有线，
 * 这一层证明**产品真退化时真浏览器里的判据会出声**——否则 §33 只是文本对账。
 * 每条真跑一遍 tools/smoke-planner.js（113 条，约 250s），逐条串行；
 * **不得与像素基线并行**（变异打的正是基线要截的那几页）。
 *
 * 落点按实测收，别照着上一版的期望读（首轮打偏的原样留在注释里）。
 * 证据：本脚本自己写 tools/out/b20-mut-smoke33.txt（首轮踩过：shell 重定向留下 0 字节文件，25 分钟读数没了）。
 * 用法: node tools/out/mut-smoke33.js
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['planner.js'];
/* 上一批踩过：同一个变异脚本被起了两份，两份都在写 planner.js，
   后起的那份把前一份「正在变异中的」内容当成了基准（B2/B4 的 from 串当场 0 命中），
   两边的读数全部作废。所以：① 起跑前独占锁；② 起跑前验基准确实是收工那一版。 */
const LOCK = path.join(ROOT, 'tools', 'out', '.mut-smoke33.lock');
if (fs.existsSync(LOCK)) {
  console.log('ABORT：另一份 mut-smoke33 还在跑（锁 ' + LOCK + '，PID ' +
    fs.readFileSync(LOCK, 'utf8').trim() + '）。这条网一次只能有一份在打 planner.js。');
  process.exit(2);
}
fs.writeFileSync(LOCK, String(process.pid), 'utf8');

const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
const BASE = ['var MODE = {', 'function withLocked(sel, reorder) {', 'flat[to].locked = 1;',
  "state.selected = flat.slice();", "$id('resultTitle').textContent"];
BASE.forEach(s => {
  if (ORIG['planner.js'].split(s).length - 1 < 1) {
    console.log('ABORT：planner.js 的基准里没有「' + s + '」——这份不是批次 20 收工后的源码，' +
      '可能正被另一个变异进程打着。先确认没有活的 mut-* 进程再重跑。');
    fs.unlinkSync(LOCK);
    process.exit(2);
  }
});
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function smoke() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-planner.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1500000 });
  return (r.stdout || '') + (r.stderr || '');
}

const EOL_FILE = '\r\n';
const LOGF = path.join(ROOT, 'tools', 'out', 'b20-mut-smoke33.txt');
const LINES = [];
/* 上一版靠 shell 的重定向留证，跑完 25 分钟发现文件是 0 字节（重定向被包装层吃掉了）；
   这一层自己写盘，读数不再依赖外部管道。 */
function say(s) { console.log(s); LINES.push(s); flushLog(); }
function flushLog() {
  try { fs.writeFileSync(LOGF, LINES.join(EOL_FILE) + EOL_FILE, 'utf8'); }
  catch (e) { console.log('写证据文件失败：' + e.message); }
}
process.on('exit', () => { restore(); flushLog(); try { if (fs.existsSync(LOCK)) fs.unlinkSync(LOCK); } catch (e) {} });

const EOL = '\r\n';
let red = 0, anomalies = 0, total = 0;
function run(name, from, to, token) {
  total++;
  const src = ORIG['planner.js'];
  const n = src.split(from).length - 1;
  if (n !== 1) { anomalies++; say('异常  ' + name + '  planner.js 的 from 串命中 ' + n + ' 处，期望 1'); return; }
  if (from === to) { anomalies++; say('异常  ' + name + '  恒等变异，这条什么都没测'); return; }
  fs.writeFileSync(path.join(ROOT, 'planner.js'), src.replace(from, () => to));
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, 'planner.js'), src); }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  const hit = fails.filter(l => l.indexOf(token) >= 0);
  const p = out.split('\n').filter(l => l.indexOf('PASS ') === 0).length;
  if (hit.length >= 1) {
    red++;
    say('红  ' + name + '  → PASS ' + p + ' 条 / FAIL ' + fails.length + ' 条（' +
      fails.map(l => (l.match(/FAIL\s+(T\d+\w*|[^　]{0,10})/) || [])[1] || '?').slice(0, 6).join(',') +
      '），指定那条：' + hit[0].slice(0, 160));
  } else {
    anomalies++;
    say('异常  ' + name + '  浏览器腿没按预期红（想找：' + token + '）；FAIL ' + fails.length + ' 条：' +
      fails.map(l => l.slice(0, 70)).join(' | ') + ' || 尾部：' + out.trim().split('\n').slice(-2).join(' / ').slice(0, 120));
  }
}

run('B1 摘掉地理档那层 withLocked（同一变异 §33 锚 M26 也红＝两层都抓得到）',
  'return withLocked(sel, function (free) { return orderFreeByGeo(free, start, tb); });',
  'return orderFreeByGeo(sel, start, tb);',
  'T8 灵魂断言');
run('B2 移动不再留痕（钉不住＝下一次自动重排把用户挪过的那站打散）',
  'flat[to].locked = 1;', 'void 0;',
  'T8 灵魂断言');
run('B3 步行档速度给到 20km/h（档位失效，三档时长单调关系当场断）',
  "walk: { label: '步行', kmh: 4.5, factor: 1.15 }", "walk: { label: '步行', kmh: 20, factor: 1.15 }",
  'T2 同一行程三档时长单调');
run('B4 手动调序不写回选点集（钉住的下标基准回到选点旧序；同一变异源码腿 M38 也红）',
  'flat[to].locked = 1;' + EOL + '    state.selected = flat.slice();',
  'flat[to].locked = 1;' + EOL + '    void 0;',
  'T8 灵魂断言');
run('B5 移掉的站不退出选点集（「重新排期」把它整站捞回行程）',
  'state.selected = flatStops();', 'void 0;',
  'T10 移掉的站不复活');
/* B6 上一版把 resultTitle 改名成 rtTitle：$id 取不到 → renderDaysBody 抛错 → 整页崩，
   FAIL 112 条里根本看不见 T3（首轮实测）。那确实是「出声」但不是这条锚的形状。
   改成把标题赋值整条摘掉（页面照常渲染，只有标题不再跟日卡同一次动），T3 的 titleKm 对账才当场红。 */
run('B6 标题不再跟日卡同一次渲染动（换档后屏上两个口径并存）',
  "    $id('resultTitle').textContent = trip.name + ' · ' + days.length + ' 天 · ' +" + EOL +
  "      days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站 · 约 ' +" + EOL +
  "      Math.round(days.reduce(function (s, d) { return s + d.driveKm; }, 0)) + ' km';",
  '    void 0;',
  'T3 三档里程单调');

say('\n=== mut-smoke33（浏览器腿）: ' + red + ' 条按预期红 / ' + anomalies + ' 条异常 / 共 ' + total + ' 条 ===');
say('异常＝0 才说明批次 20 的档位与锁定判据在真浏览器里有线，而不只是源码文本对得上。');
process.exit(anomalies ? 1 : 0);
