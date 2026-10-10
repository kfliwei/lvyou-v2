/* mut-verify25b.js — §25 那四条「改拍前先留档」新锚的变异自证（批次 33-F）
 * 五发：M01 摘掉 ARCHIVE 回执 / M02 把整段留档挪到覆盖之后 / M03 摘掉逐张 copyFileSync /
 *       M04 摘掉 .gitignore 那条忽略 / M05 正向对照（干净树必须绿，否则前四发的「红」没有基准）
 * 判据两条一起（缺一条就是假闸）：① 输出里有 'FAIL §25' 行 ② 整跑退出码非 0
 * 每一发都先 preflight 断言「这一刀确实切到了字串」——第一版没做，M04 因为 .gitignore 是 CRLF
 * 而替换串写的 LF，replace 空转 → 报了个「静默对」，其实是「压根没变异」，两种失效在输出里长得一样。
 * 还原用内存快照，不用 git checkout（工作树里有本批未提交的改动）。
 * 独占锁：认所有 tools/out/.mut*.lock（只认自己名字＝并发时互相抹还原） */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const VF = path.join(ROOT, 'tools', 'visual-check.js');
const GI = path.join(ROOT, '.gitignore');
const LOCKS = fs.readdirSync(path.join(ROOT, 'tools', 'out')).filter(f => /^\.mut.*\.lock$/.test(f) && !/mut25b/.test(f));
if (LOCKS.length) { console.log('拒跑：另一张变异网正在动树 ' + LOCKS.join(',')); process.exit(2); }
const ME = path.join(ROOT, 'tools', 'out', '.mut25b.lock');
fs.writeFileSync(ME, String(process.pid));
const snap = { vf: fs.readFileSync(VF, 'utf8'), gi: fs.readFileSync(GI, 'utf8') };
const restore = () => { fs.writeFileSync(VF, snap.vf); fs.writeFileSync(GI, snap.gi); };
/* 块文本从盘上派生，不手抄（CRLF 的文件里手抄 LF 字面量＝静默空转） */
function grabBlock() {
  const s = fs.readFileSync(VF, 'utf8');
  const m = s.match(/[ ]*if \(UPDATE\) \{\r?\n(?:.*\r?\n)*?.*ARCHIVE.*\r?\n[ ]{2}\}\r?\n/);
  if (!m) throw new Error('preflight：抓不到 if (UPDATE) { … ARCHIVE … } 整段');
  return m[0];
}
function cut(from, to, what) {
  const s = fs.readFileSync(to === VF ? VF : GI, 'utf8');
  if (s.indexOf(from) < 0) throw new Error('preflight：' + what + ' 没命中，这一刀等于没切');
  fs.writeFileSync(to === VF ? VF : GI, s.replace(from, ''));
}
const OVER_RE = /( {6}fs\.writeFileSync\(baseF, buf\);[^\r\n]*\r?\n)/;
let red = 0, silent = 0, anom = 0;
const T = [];
T.push(['M01 摘掉 ARCHIVE 回执那一行', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const m = s.match(/[ ]*console\.log\('ARCHIVE[^\r\n]*\r?\n/);
  if (!m) throw new Error('preflight：ARCHIVE 回执行没命中');
  fs.writeFileSync(VF, s.replace(m[0], ''));
}]);
T.push(['M02 把整段留档挪到覆盖之后', () => {
  const blk = grabBlock();
  let s = snap.vf.replace(blk, '');
  if (!OVER_RE.test(s)) throw new Error('preflight：找不到覆盖基线那一行，顺序靶子无从挪起');
  s = s.replace(OVER_RE, '$1' + blk);
  if (s.indexOf(blk) < 0) throw new Error('preflight：挪位后块不见了');
  fs.writeFileSync(VF, s);
}]);
T.push(['M03 摘掉逐张 copyFileSync', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const from = 'fs.copyFileSync(path.join(BASE, f), path.join(PREV, f)); snapN++;';
  if (s.indexOf(from) < 0) throw new Error('preflight：copyFileSync 那行没命中');
  fs.writeFileSync(VF, s.replace(from, 'snapN++;'));
}]);
T.push(['M04 摘掉 .gitignore 里那条忽略', () => {
  const s = fs.readFileSync(GI, 'utf8');
  const m = s.match(/tools\/out\/visual-baseline-prev\/\r?\n/);
  if (!m) throw new Error('preflight：忽略规则没命中（行尾口径？CRLF 文件要按 \r?\n 匹配）');
  fs.writeFileSync(GI, s.replace(m[0], ''));
}]);
T.push(['M05 正向对照：干净树', () => { }]);
for (const [name, mutate] of T) {
  restore();
  try { mutate(); } catch (e) { anom++; console.log('异常 ' + name + ' — ' + e.message); continue; }
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')], { encoding: 'utf8', cwd: ROOT });
  const hasFail = /FAIL §25/.test(r.stdout);
  const notGreen = r.status !== 0;
  const line = (r.stdout.match(/FAIL §25 像素基线闸门: .*/) || ['(无 §25 红行)'])[0].replace(/\r/g, '').slice(0, 160);
  if (name.startsWith('M05')) {
    const ok = !hasFail && !notGreen;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' — 干净树 §25 红=' + hasFail + ' 退出码=' + r.status);
    if (!ok) anom++;
  } else if (hasFail && notGreen) { red++; console.log('红对 ' + name + ' → ' + line); }
  else { silent++; console.log('静默对 ' + name + ' — §25 红=' + hasFail + ' 退出码=' + r.status + '（两条判据缺一条即假闸）'); }
}
restore();
fs.unlinkSync(ME);
console.log('--- 5 发：红对 ' + red + ' / 静默 ' + silent + ' / 异常 ' + anom + ' ---');
console.log('还原后本批两文件的净增删（应与变异前一致：.gitignore 1/0、visual-check.js 14/0）：');
console.log(cp.spawnSync('git', ['diff', '--numstat', 'tools/visual-check.js', '.gitignore'], { encoding: 'utf8', cwd: ROOT }).stdout.trim());
process.exit(anom ? 1 : 0);
