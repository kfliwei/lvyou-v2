/* tools/out/mut-smoke34.js — §34 的浏览器腿变异自测（批次 21 的 B 组）
 *
 * 六条「改了源码，真浏览器里必须红在指定那条判据上」的行为退化。
 * 为什么这组不能省：§34 的源码腿钉的是字面量，而批次 21 的两种真失败都是**看得见的**——
 * 来源标记写串了会把离线答案标成实时、超时提前会把还没回来的查询当空态、
 * 层级不收起会让半径条浮在景点卡上。这些只有真渲染才露头。
 *
 * 每条真跑一遍 tools/smoke-nearby.js，逐条串行；**不得与源码腿或像素基线并行**
 * （变异打的正是 smoke 要截的那几页，两份同时跑读数全废——批次 20 实测）。
 * 跑完逐字节还原（含异常退出）。
 *
 * 用法: MUT_LOG=tools/out/b21-mut-smoke34.txt node tools/out/mut-smoke34.js
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 证据由脚本自己写盘：shell 重定向在长跑后台任务里留过 0 字节文件 */
const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['nearby.js', 'topic-common.js'];
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
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-nearby.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1500000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}

let red = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  const hit = fails.filter(l => l.indexOf(token) >= 0);
  const sum = (out.match(/smoke-nearby: (\d+)\/(\d+)/) || []);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → ' + (sum[1] || '?') + '/' + (sum[2] || '?') + ' 通过，FAIL ' + fails.length + ' 条（' +
      fails.map(l => (l.match(/FAIL\s+(N\d+\w*)/) || [])[1] || '?').join(',') + '），指定那条：' + hit[0].slice(0, 150));
  } else if (/SMOKE CRASH/.test(out)) {
    anomalies++;
    console.log('异常  ' + name + '  smoke 直接崩了（不是红在指定判据上）：' +
      (out.match(/SMOKE CRASH.*/) || [''])[0].slice(0, 140));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  浏览器腿没按预期红（想找：' + token + '）；FAIL ' + fails.length + ' 条：' +
      fails.map(l => l.slice(0, 60)).join(' | '));
  }
}
function run(name, file, from, to, token) {
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  if (n !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.replace(from, () => to), token);
}
function runAll(name, file, from, to, token) {
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  if (n < 2) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串只命中 ' + n + ' 处，本条要一次替两处');
    return;
  }
  judge(name, file, src.split(from).join(to), token);
}

run('B1 内置行的来源标记写成「实时查询」（离线答案被标成要联网才有）→ N08 必须红', 'nearby.js',
  "src: '内置' }", "src: '实时查询' }", 'N08');
run('B2 抬心的 panBy 符号取反（点在中间却被往下推）→ N17c 必须红', 'topic-common.js',
  'map.panBy([0, p.y - want]', 'map.panBy([0, want - p.y]', 'N17c');
runAll('B3 两条关闭路径都不收半径条与面板（浮在景点卡之上）→ N19 必须红', 'topic-common.js',
  'hideNearBar(); hideNearSheet();', '/*mut*/', 'N19');
run('B4 超时从 8s 提前到 120ms（查询还没回来就当空态）→ N44 必须红', 'nearby.js',
  '}, OVERPASS_TIMEOUT_MS);', '}, 120);', 'N44');
run('B5 摘掉「内置够四条就不联网」→ N40（有网但内置≥4 时零请求）必须红', 'nearby.js',
  'if (hits.length >= BUILTIN_ENOUGH || offline) {', 'if (offline) {', 'N40');
run('B6 取点后 chip 不复位（用户以为还在取点模式）→ N28 必须红', 'topic-common.js',
  'if (nearMode || M.nearEnabled) { nearMode = false; syncChips(); nearPick(e.latlng); return; }',
  'if (nearMode || M.nearEnabled) { nearPick(e.latlng); return; }', 'N28');

console.log('mut-smoke34: ' + red + '/' + total + ' 按预期红，异常 ' + anomalies);
process.exit(anomalies ? 1 : 0);
