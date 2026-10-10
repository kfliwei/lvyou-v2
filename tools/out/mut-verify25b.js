/* mut-verify25b.js — §25「留档」两条腿新锚的变异自证（批次 33-F 起，33-G 加 M06–M12）
 * 33-F 那五发：M01 摘掉 ARCHIVE 回执 / M02 把整段留档挪到覆盖之后 / M03 摘掉逐张 copyFileSync /
 *       M04 摘掉 .gitignore 那条忽略 / M05 正向对照（干净树必须绿，否则后面各发的「红」没有基准）
 * 33-G 这七发（对象是「只读跑批那一发红的当前帧必须留档」这条腿）：
 *       M06 摘掉红态无条件落盘那行 / M07 把 keepCur 缩回只看开关 / M08 摘掉报告里的 curFrame 字段 /
 *       M09 摘掉 stdout 的 EVID 回执 / M10 把 curF 单点内联到红态那一行 /
 *       M11 摘掉 README 那句登记 / M12 把 EVID 回执挪到 FAIL 回执之前（顺序锚）
 * 判据两条一起（缺一条就是假闸）：① 输出里有 'FAIL §25' 行 ② 整跑退出码非 0
 * 每一发都先 preflight 断言「这一刀确实切到了字串」——第一版没做，M04 因为 .gitignore 是 CRLF
 * 而替换串写的 LF，replace 空转 → 报了个「静默对」，其实是「压根没变异」，两种失效在输出里长得一样。
 * 还原用内存快照，不用 git checkout（工作树里有本批未提交的改动）。
 * 独占锁收在单点：tools/mut-lock.js（老写法是「先筛列表再写」，同时启动那一格有 race，且崩在中间没人释放锁） */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const VF = path.join(ROOT, 'tools', 'visual-check.js');
const GI = path.join(ROOT, '.gitignore');
const RM = path.join(ROOT, 'README.md');
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut25b.lock');
const snap = { vf: fs.readFileSync(VF, 'utf8'), gi: fs.readFileSync(GI, 'utf8'), rm: fs.readFileSync(RM, 'utf8') };
const restore = () => { fs.writeFileSync(VF, snap.vf); fs.writeFileSync(GI, snap.gi); fs.writeFileSync(RM, snap.rm); };
/* 崩在注入与还原之间会把 visual-check.js／.gitignore／README.md 留在变异态：退出时兜底写回 */
process.on('exit', restore);
/* 块文本从盘上派生，不手抄（CRLF 的文件里手抄 LF 字面量＝静默空转） */
function grabBlock() {
  const s = fs.readFileSync(VF, 'utf8');
  const m = s.match(/[ ]*if \(UPDATE\) \{\r?\n(?:.*\r?\n)*?.*ARCHIVE.*\r?\n[ ]{2}\}\r?\n/);
  if (!m) throw new Error('preflight：抓不到 if (UPDATE) { … ARCHIVE … } 整段');
  return m[0];
}
function cut(from, to, what) {
  const s = fs.readFileSync(to === VF ? VF : (to === RM ? RM : GI), 'utf8');
  if (s.indexOf(from) < 0) throw new Error('preflight：' + what + ' 没命中，这一刀等于没切');
  fs.writeFileSync(to, s.replace(from, ''));
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
/* ===== 33-G：只读跑批「那一发红的当前帧」这条腿 ===== */
/* visual-check.js 是 CRLF 文件：凡是要摘整行的，一律按 \r?\n 匹配从盘上抓，不手抄行尾 */
const LINE = re => {
  const s = fs.readFileSync(VF, 'utf8');
  const m = s.match(re);
  if (!m) throw new Error('preflight：整行正则没命中（' + re.source.slice(0, 40) + '…）');
  return [s, m[0]];
};
T.push(['M06 摘掉红态无条件落盘那行', () => {
  const [s, l] = LINE(/[ ]*if \(!KEEP && !ok\) fs\.writeFileSync\(curF\(tag\), buf\);.*\r?\n/);
  fs.writeFileSync(VF, s.replace(l, ''));
}]);
T.push(['M07 把留帧判据缩回只看 --keep-current', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const from = 'const keepCur = KEEP || !ok;';
  if (s.indexOf(from) < 0) throw new Error('preflight：keepCur 那行没命中');
  fs.writeFileSync(VF, s.replace(from, 'const keepCur = KEEP;'));
}]);
T.push(['M08 摘掉报告里的 curFrame 字段（留了档不登记在哪）', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const from = ', curFrame: keepCur ? path.relative(ROOT, curF(tag)) : undefined';
  if (s.indexOf(from) < 0) throw new Error('preflight：curFrame 字段没命中');
  fs.writeFileSync(VF, s.replace(from, ''));
}]);
T.push(['M09 摘掉 stdout 的 EVID 回执', () => {
  const [s, l] = LINE(/[ ]*if \(!KEEP\) console\.log\('EVID .*?\r?\n/);
  fs.writeFileSync(VF, s.replace(l, ''));
}]);
T.push(['M10 把 curF 单点内联到红态那一行', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const from = 'if (!KEEP && !ok) fs.writeFileSync(curF(tag), buf);';
  const to = "if (!KEEP && !ok) fs.writeFileSync(path.join(DIFF, tag.replace(/\\.png$/, '') + '.cur.png'), buf);";
  if (s.indexOf(from) < 0) throw new Error('preflight：红态落盘那行没命中');
  fs.writeFileSync(VF, s.replace(from, to));
}]);
T.push(['M11 摘掉 README 那句登记', () => {
  cut('**只读跑批的红态当前帧自动留档**', RM, 'README 那句登记');
}]);
T.push(['M12 把 EVID 回执挪到 FAIL 回执之前', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const fl = (s.match(/[ ]*console\.log\('FAIL ' \+ tag \+ '  diff .*?\r?\n/) || [])[0];
  const el = (s.match(/[ ]*if \(!KEEP\) console\.log\('EVID .*?\r?\n/) || [])[0];
  if (!fl || !el) throw new Error('preflight：FAIL／EVID 两行没抓全（fl=' + !!fl + ' el=' + !!el + '）');
  if (s.indexOf(fl + el) < 0) throw new Error('preflight：这两行不是相邻的 FAIL→EVID，挪位靶子无从 swap 起');
  fs.writeFileSync(VF, s.replace(fl + el, el + fl));
}]);
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
unlock();
console.log('--- ' + T.length + ' 发：红对 ' + red + ' / 静默 ' + silent + ' / 异常 ' + anom + ' ---');
console.log('还原后三份被改文件的净增删（应与开网前一致，只作核对不作判据）：');
console.log(cp.spawnSync('git', ['diff', '--numstat', 'tools/visual-check.js', '.gitignore', 'README.md'], { encoding: 'utf8', cwd: ROOT }).stdout.trim());
process.exit(anom ? 1 : 0);
