/* mut-verify25b.js — §25「留档／取景／归档」三条腿新锚的变异自证（批次 33-F 起，33-G 加 M06–M12）
 * 33-F 那五发：M01 摘掉 ARCHIVE 回执 / M02 把整段留档挪到覆盖之后 / M03 摘掉逐张 copyFileSync /
 *       M04 摘掉 .gitignore 那条忽略 / M05 正向对照（干净树必须绿，否则后面各发的「红」没有基准）
 * 33-G 这七发（对象是「只读跑批那一发红的当前帧必须留档」这条腿）：
 *       M06 摘掉红态无条件落盘那行 / M07 把 keepCur 缩回只看开关 / M08 摘掉报告里的 curFrame 字段 /
 *       M09 摘掉 stdout 的 EVID 回执 / M10 把 curF 单点内联到红态那一行 /
 *       M11 摘掉 README 那句登记 / M12 把 EVID 回执挪到 FAIL 回执之前（顺序锚）
 * 33-I 这十八发（两条腿：取景等布局稳定 M13–M22，每跑证据按时刻归档 M23–M30）：
 *       定义在场没人调 / 稳定上限改 0 / 签名少文本 FNV / 签名少全树元素数 / 报告少 settled /
 *       NOTE 判据少 !stab.ok 那一半 / NOTE 阈值降回一轮轮询 / 摘收尾取景读数 / 摘地板 /
 *       判据挪到地板之前（顺序锚）/ 报告不归档 / diff 图不归档 / 当前帧不归档 / .gitignore 少一条 /
 *       归档块挪到写报告之前（顺序锚）/ README 两句登记各摘一条 / ranAt 不同源；
 *       外加 G02 一条设计内静默（settleExtraMs 有意不钉，它必须绿——绿了才证明「没钉」是选择不是漏）
 * 判据两条一起（缺一条就是假闸）：① 输出里有 'FAIL §25' 行 ② 整跑退出码非 0
 * G 发的判据反过来（必须不红），红即「多钉了一条不该钉的线」，与 M 发的「应红却绿」各管一边。
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
/* ===== 33-I：取景等布局稳定（M13–M22）＋每跑证据按时刻归档（M23–M30）＋一条设计内静默（G02） ===== */
function rep(file, from, to, what) {
  const s = fs.readFileSync(file, 'utf8');
  if (s.indexOf(from) < 0) throw new Error('preflight：' + what + ' 没命中（' + from.slice(0, 34) + '…）');
  fs.writeFileSync(file, s.replace(from, to));
}
const TRIG = 'if (!stab.ok || stab.ms > 2 * STABLE_POLL) {';
T.push(['M13 摘掉 waitStable 的调用（定义在场没人调）', () => {
  rep(VF, 'const stab = await waitStable(pg);', 'const stab = { ok: true, ms: 0 };', 'stab 调用');
}]);
T.push(['M14 把稳定上限改成 0（等稳退化成不等）', () => rep(VF, 'const STABLE_MAX = 8000;', 'const STABLE_MAX = 0;', 'STABLE_MAX')]);
T.push(['M15 摘掉签名里的文本 FNV（只量尺寸与长度）', () => {
  const [s, l] = LINE(/[ ]*h = Math\.imul\(h, 16777619\);.*\r?\n/);
  fs.writeFileSync(VF, s.replace(l, ''));
}]);
T.push(['M16 摘掉签名里的全树元素数（读不到整体重画）', () => {
  rep(VF, "document.getElementsByTagName('*').length, ", '', '全树元素数');
}]);
T.push(['M17 摘掉报告里的 settled 字段（没稳住只存在于那块屏幕上）', () => {
  rep(VF, ', settled: stab.ok', '', 'settled 字段');
}]);
T.push(['M18 摘掉 NOTE 判据的 !stab.ok 那一半（到上限未稳不印）', () => {
  rep(VF, TRIG, 'if (stab.ms > 2 * STABLE_POLL) {', 'NOTE 触发判据');
}]);
T.push(['M19 把 NOTE 阈值降回一轮轮询（109 张每张都印，信号淹在噪声里）', () => {
  rep(VF, TRIG, 'if (!stab.ok || stab.ms > STABLE_POLL) {', 'NOTE 触发判据');
}]);
T.push(['M20 摘掉收尾那行取景全量读数', () => {
  const [s, l] = LINE(/[ ]*console\.log\('取景: [^\r\n]*\r?\n/);
  fs.writeFileSync(VF, s.replace(l, ''));
}]);
T.push(['M21 摘掉地板那次固定等待（比基线更早截屏）', () => {
  const [s, l] = LINE(/[ ]*await new Promise\(r => setTimeout\(r, SETTLE\)\);.*\r?\n/);
  fs.writeFileSync(VF, s.replace(l, ''));
}]);
T.push(['M22 把稳定判据挪到地板之前（顺序锚）', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const stabL = (s.match(/[ ]*const stab = await waitStable\(pg\);[^\r\n]*\r?\n/) || [])[0];
  const floorL = (s.match(/[ ]*await new Promise\(r => setTimeout\(r, SETTLE\)\);[^\r\n]*\r?\n/) || [])[0];
  if (!stabL || !floorL) throw new Error('preflight：stab／地板两行没抓全（stab=' + !!stabL + ' floor=' + !!floorL + '）');
  const s2 = s.replace(stabL, '');
  if (s2.indexOf(floorL) < 0) throw new Error('preflight：摘掉 stab 行之后地板行不见了');
  fs.writeFileSync(VF, s2.replace(floorL, stabL + floorL));
}]);
T.push(['M23 摘掉本跑报告的归档 copy（固定文件名那份照旧被覆盖）', () => {
  rep(VF, "fs.copyFileSync(REPORT, path.join(runDir, 'visual-report.json'));", '', '报告归档');
}]);
T.push(['M24 摘掉红态 diff 图的归档 copy', () => {
  rep(VF, 'if (fs.existsSync(dP)) { fs.copyFileSync(dP, path.join(runDir, r.state)); arN++; }', '', 'diff 归档');
}]);
T.push(['M25 摘掉红态当前帧的归档 copy', () => {
  rep(VF, 'if (fs.existsSync(cP)) { fs.copyFileSync(cP, path.join(runDir, path.basename(cP))); arN++; }', '', '当前帧归档');
}]);
T.push(['M26 摘掉 .gitignore 里 visual-archive/ 那条忽略', () => {
  const s = fs.readFileSync(GI, 'utf8');
  const m = s.match(/tools\/out\/visual-archive\/\r?\n/);
  if (!m) throw new Error('preflight：visual-archive 忽略规则没命中（行尾口径？）');
  fs.writeFileSync(GI, s.replace(m[0], ''));
}]);
T.push(['M27 把归档块挪到写报告之前（拷进去的是上一跑的旧报告）', () => {
  const s = fs.readFileSync(VF, 'utf8');
  const blk = (s.match(/[ ]*const AR = path\.join\(ROOT, 'tools', 'out', 'visual-archive'\);[\s\S]*?console\.log\('ARCHIVE 本跑报告[^\r\n]*\r?\n/) || [])[0];
  if (!blk) throw new Error('preflight：抓不到归档整段（const AR … → ARCHIVE 回执）');
  const s2 = s.replace(blk, '');
  const repL = (s2.match(/[ ]*fs\.writeFileSync\(REPORT, JSON\.stringify\(\{[^\r\n]*\r?\n/) || [])[0];
  if (!repL) throw new Error('preflight：摘段之后找不到写报告那一行');
  fs.writeFileSync(VF, s2.replace(repL, blk + repL));
}]);
T.push(['M28 摘掉 README 的「取景先等地板再等布局稳定」登记', () => {
  cut('**取景先等地板再等布局稳定**', RM, 'README 取景那条登记');
}]);
T.push(['M29 摘掉 README 的「每一跑的证据按时刻归档」登记', () => {
  cut('**每一跑的证据按时刻归档**', RM, 'README 归档那条登记');
}]);
T.push(['M30 报告里的 ranAt 改回现场造（与归档目录名两套时间）', () => {
  rep(VF, 'ranAt: RAN_AT,', 'ranAt: new Date().toISOString(),', 'ranAt 同源');
}]);
/* 设计内静默：settleExtraMs 这个字段 §25 有意不钉（NOTE 与收尾计数已经把「等过头／没稳住」这两件事
   管住了，多钉一个字段名只是给以后的改名添麻烦）。它必须绿——绿了才证明「没钉」是有意的而不是漏了。 */
T.push(['G02 摘掉 settleExtraMs 字段（§25 有意不钉，必须静默）', () => {
  rep(VF, ', settleExtraMs: stab.ms', '', 'settleExtraMs 字段');
}]);
const LOG = path.join(ROOT, 'tools', 'out', 'b33i-mut-verify25b.txt');
fs.writeFileSync(LOG, '# mut-verify25b.js 逐发读数（本批 33-I 起每条由脚本自己落盘，不经 shell 重定向——重定向留过 0 字节）\n');
const say = l => { fs.appendFileSync(LOG, l + '\n'); console.log(l); };
for (const [name, mutate] of T) {
  restore();
  try { mutate(); } catch (e) { anom++; say('异常 ' + name + ' — ' + e.message); continue; }
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')], { encoding: 'utf8', cwd: ROOT });
  const hasFail = /FAIL §25/.test(r.stdout);
  const notGreen = r.status !== 0;
  const line = (r.stdout.match(/FAIL §25 像素基线闸门: .*/) || ['(无 §25 红行)'])[0].replace(/\r/g, '').slice(0, 160);
  if (name.startsWith('M05')) {
    const ok = !hasFail && !notGreen;
    say((ok ? 'PASS' : 'FAIL') + ' ' + name + ' — 干净树 §25 红=' + hasFail + ' 退出码=' + r.status);
    if (!ok) anom++;
  } else if (/^G\d/.test(name)) {
    const ok = !hasFail && !notGreen;
    say((ok ? '静默对 ' : 'FAIL ') + name + ' — 设计内静默判据：§25 红=' + hasFail + ' 退出码=' + r.status + (ok ? '' : '（G 发不该红，红了就是多钉了）'));
    if (!ok) anom++;
  } else if (hasFail && notGreen) { red++; say('红对 ' + name + ' → ' + line); }
  else { silent++; say('静默对 ' + name + ' — §25 红=' + hasFail + ' 退出码=' + r.status + '（两条判据缺一条即假闸）'); }
}
restore();
say('--- ' + T.length + ' 发：红对 ' + red + ' / 静默(应红却绿) ' + silent + ' / 异常 ' + anom + ' ---');
say('还原后三份被改文件的净增删（应与开网前一致，只作核对不作判据）：');
say(cp.spawnSync('git', ['diff', '--numstat', 'tools/visual-check.js', '.gitignore', 'README.md'], { encoding: 'utf8', cwd: ROOT }).stdout.trim());
unlock();
process.exit(anom || silent ? 1 : 0);
