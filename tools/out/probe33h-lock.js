/* tools/out/probe33h-lock.js（第二版）— 变异网独占锁的账，兼 §52 闸门的口径预跑
 *
 * 为什么这条账还欠着：每张网在动树期间把快照文件回写成自己的「还原值」，两张网并发＝后还原那张把
 * 前一张刚还原的内容一并抹掉，树停在中间态而两边都报「全过」。这是假绿里最坏的一种（没有任何判据会红）。
 * 37 之后的手写网都带了锁，16–36 那十几张是老写法（或者干脆没有锁），
 * mut-verify25b.js 那一支用的是 `.mut25b.lock`——别人的筛子写的是 /^\.mut\d+\.lock$/，
 * 带字母的名字从别人的视野里穿过去，等于「我看得见所有人，所有人看不见我」。
 *
 * 第一版栽在哪（这份 v2 存在的全部理由）：写盘判据只认 `fs.writeFileSync(path.join(ROOT,...))` 与
 * `writeFileSync(LOCK|ME)` 两种形状，于是 `fs.writeFileSync(F, ...)`（mut-avoid-e.js）与
 * `fs.writeFileSync(c.file, ...)`（mut-shell-res.js／mut-verify15-fallback.js）两种变量式目标整类漏掉，
 * 三张**真的在动文件**的网被印成「写盘 0 处 → 没有锁也不算雷」。第一版的合成对照丙恰好用的就是
 * path.join 那种写法，所以对照全过、读数照印——「尺子先自校准」要校准的是**判据的形状覆盖面**，
 * 不是「拿一个样本证明它能响」。v2 把写盘换成两把尺子取并集，并新增对照丁专门钉这一类形状。
 *
 * 尺子自己先校准（四条）：
 *   甲 正向（内联形状）：mut-verify50.js 必须数到锁名、取锁是 wx、筛子在场；
 *   乙 正向（模块形状）：mut-verify16.js 必须被认成「接了单点模块」（不这么认就会把 22 张接模块的网误报成「不筛别人」）；
 *   丙 退化（合成：写盘无锁）必须数到锁名 0 个；
 *   丁 退化（合成：写盘目标是变量 `c.file`／`F`，且只有快照没有 path.join 写法）必须被判成**真动树**——
 *      这条不成立就说明 v1 那个坑还在。
 * 任一对照失效就整份读数作废（打印后退出 1）。
 *
 * 用法：node tools/out/probe33h-lock.js   （只读，不写任何受检文件；读数落 tools/out/b33h-probe-lock2.txt）
 */
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const ROOT = path.resolve(__dirname, '..', '..');
const LOGP = path.join(OUT, 'b33h-probe-lock2.txt');
const lines = [];
const say = s => { lines.push(s); console.log(s); };

const nets = fs.readdirSync(OUT).filter(f => /^mut[-\w]*\.js$/.test(f)).sort();

/* 单点模块的筛子文本从它自己源码里抽，不手抄（抄错了探针会两头都对不上） */
const MOD = path.join(ROOT, 'tools', 'mut-lock.js');
const MODSRC = fs.existsSync(MOD) ? fs.readFileSync(MOD, 'utf8') : null;
const ANYSRC = MODSRC ? ((MODSRC.match(/const ANY = \/(\^[^\n]*?)\//) || [])[1] || null) : null;
if (!ANYSRC) { say('中止：抽不到 tools/mut-lock.js 里的 `const ANY` 筛子（模块没落地或写法漂了）'); fs.writeFileSync(LOGP, lines.join('\n') + '\n'); process.exit(1); }
const NARROW = '^\\.mut\\d+\\.lock$';

/* writeFileSync 的第一个参数要按括号平衡取（v1 用正则截到 ',' 就断，把 path.join(...) 切成 'path'） */
function firstArgAfter(src, i) {
  let depth = 0, out = '';
  for (let k = i; k < src.length; k++) {
    const ch = src[k];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') { if (depth === 0) break; depth--; }
    else if (ch === ',' && depth === 0) break;
    out += ch;
  }
  return out.trim();
}
function writeTargets(src) {
  const key = 'writeFileSync(';
  const t = [];
  let i = 0;
  while ((i = src.indexOf(key, i)) >= 0) {
    t.push(firstArgAfter(src, i + key.length));
    i += key.length;
  }
  /* 只写自己那份日志的网不算动树 */
  const isLog = a => /^(LOGP|LOG)$/.test(a) || /\.txt['"]?\s*$/.test(a) || /OUTDIR?,\s*'[^']*\.txt/.test(a);
  return t.filter(a => !isLog(a));
}

/* 从源码文本里派生：有没有取锁 / 锁名 / 别人的锁名它看不看得见 / 快照了哪些文件 / 崩溃时会不会还原 / 动不动树 */
function inspect(src) {
  /* 锁名只从「取锁那一下」的调用形状里抽（模块式 require(...mut-lock.js))('.mutNN.lock') 或
     内联式 const LOCK = path.join(…, '.mutNN.lock')），不扫全文：守闸门的网（mut-verify52.js）必须
     原样抄别人的取锁行当靶串，扫全文会把别人家的锁名算到它头上，⑥⑦ 两条判据当场失真。
     这一条与 tools/verify.js §52 的 lockNamesOf 同一形状——两把尺子必须是一把。 */
  const lockNames = [];
  const pushN = n => { if (n && lockNames.indexOf(n) < 0) lockNames.push(n); };
  let mN;
  const ACQ = /mut-lock\.js'\)\)\s*\('(\.mut[\w.-]*\.lock)'\)/g;
  const INL = /const LOCK = path\.join\([^)]*,\s*'(\.mut[\w.-]*\.lock)'\)/g;
  while ((mN = ACQ.exec(src))) pushN(mN[1]);
  while ((mN = INL.exec(src))) pushN(mN[1]);
  const usesModule = /mut-lock\.js/.test(src);
  const wx = /flag:\s*'wx'/.test(src);
  const existsThen = /fs\.existsSync\((LOCK|ME)\b\)/.test(src);
  const rawWrite = /writeFileSync\(\s*(LOCK|ME)\b/.test(src);
  const acq = usesModule ? '模块（wx＋宽筛）'
    : (wx ? "wx（存在即失败，无 race）" : (rawWrite ? (existsThen ? 'existsSync 再写（有 race）' : '先筛列表再写（有 race）') : '—'));
  const busyRe = (src.match(/readdirSync\([^)]*\)[^\n]*?filter\([^)]*\/(\^\\\.mut[^/]*)\//) || [])[1] || null;
  /* 快照名单：只认 `const FILES = [...]` 与 `const MUTS` 两种写法里的显式数组，其余标 UNKNOWN */
  let files = null;
  const m = src.match(/const FILES\s*=\s*\[([\s\S]*?)\];/);
  if (m) files = (m[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1));
  const mm = src.match(/const MUTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!files && mm) files = Array.from(new Set((mm[1].match(/'([\w./-]+\.(?:js|css|html|md|xml))'/g) || []).map(s => s.slice(1, -1))));
  const hasExit = /process\.on\('exit'/.test(src);
  const hasFinally = /finally\s*\{/.test(src);
  const finallyRestore = hasExit || hasFinally;
  /* 动没动树：两把尺子取并集（写盘目标 ∪ 「有快照/还原这一族」）。并集而不是相加，也不取交集。 */
  const tw = writeTargets(src);
  const snapish = /(?:function|const)\s+restore\b|\bbuf\b|ORIG|\bsnap\b/.test(src) && /readFileSync/.test(src);
  return {
    lockNames, usesModule, wx, existsThen, acq,
    busyRe: usesModule ? ANYSRC : busyRe,
    narrow: busyRe ? busyRe === NARROW : false,
    files, finallyRestore, hasExit, hasFinally,
    writes: tw.length, snapish: snapish ? 1 : 0,
    tree: (tw.length > 0 || !!snapish),
    snapFrom: files ? (src.match(/const FILES\s*=/) ? 'FILES' : 'MUTS') : (/(function|const)\s+restore\b/.test(src) ? '变量' : '无'),
  };
}

const byName = {};
nets.forEach(f => {
  const p = path.join(OUT, f);
  byName[f] = Object.assign(inspect(fs.readFileSync(p, 'utf8')), { file: f, bytes: fs.statSync(p).size });
});

/* 四条对照 */
const POS = byName['mut-verify50.js'];
const MODNET = byName['mut-verify16.js'];
const SYNTH = inspect([
  "const fs = require('fs');const path = require('path');",
  "const ROOT = path.join(__dirname, '..', '..');",
  "fs.writeFileSync(path.join(ROOT, 'design.css'), 'x');",
  'function restore() {}',
  "process.on('exit', restore);",
].join('\n'));
const SYNTH2 = inspect([
  "const fs = require('fs');const path = require('path');",
  'const CASES = [{ file: path.join(ROOT, \'x.xml\'), old: \'a\', neo: \'b\' }];',
  'const snaps = CASES.map(c => ({ c, buf: fs.readFileSync(c.file) }));',
  'for (const { c, buf } of snaps) { fs.writeFileSync(c.file, s.replace(c.old, c.neo)); }',
  'snaps.forEach(({ c, buf }) => fs.writeFileSync(c.file, buf));',
].join('\n'));
const SYNTH3 = inspect([
  "const fs = require('fs');",
  "const F = 'topic-common.js';",
  'const put = src => fs.writeFileSync(F, src);',
  "fs.writeFileSync(LOGP, '');",
].join('\n'));
/* 戊 退化（合成：文本里**提到**一枚别人的锁名，但自己去没去取锁只有一处）：必须只数到自己那一枚。
   这条不成立就说明分类器把「引用」当「声明」，那么⑥⑦ 两读全是假的（mut-verify52.js 抄别人的整行取锁
   当靶串时现场就会中招——它因此把 mut-/lock.js 断开写，分类器才不会数到别人家的锁）。 */
const SYNTH4 = inspect([
  "const fs = require('fs');const path = require('path');",
  "const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut99.lock');",
  "const NOTE = \"锁名 '.mut77.lock' 只是这张网在日志里提别人，不是它自己取锁\";",
  "fs.writeFileSync(path.join(ROOT, 'design.css'), 'x');",
].join('\n'));
const calib = !!(POS && POS.lockNames.length && POS.wx && !POS.usesModule && POS.busyRe === ANYSRC) &&
  !!(MODNET && MODNET.lockNames.length && MODNET.usesModule) &&
  !!(SYNTH.lockNames.length === 0 && SYNTH.tree) &&
  !!(SYNTH2.lockNames.length === 0 && SYNTH2.tree && SYNTH2.writes === 2) &&
  !!(SYNTH3.lockNames.length === 0 && SYNTH3.tree && SYNTH3.writes === 1) &&
  !!(SYNTH4.lockNames.length === 1 && SYNTH4.lockNames[0] === '.mut99.lock');
say('自校准：甲 mut-verify50.js 锁名 ' + (POS ? POS.lockNames.join('、') : 'NO FILE') + '（取锁 ' + (POS ? POS.acq : '?') + '，筛子同源 ' + (POS ? (POS.busyRe === ANYSRC) : '?') + '）；' +
  '乙 mut-verify16.js 取锁 ' + (MODNET ? MODNET.acq : '?') + '；' +
  '丙 合成「path.join 写盘无锁」→ 锁名 ' + SYNTH.lockNames.length + ' 个、动树=' + SYNTH.tree + '；' +
  '丁 合成「c.file 变量写盘（v1 漏的那一类）」→ 锁名 ' + SYNTH2.lockNames.length + ' 个、写盘 ' + SYNTH2.writes + ' 处、动树=' + SYNTH2.tree + '；' +
  '丁之二 合成「F 变量写盘＋只写自己日志」→ 写盘 ' + SYNTH3.writes + ' 处（应为 1，日志那处不计）、动树=' + SYNTH3.tree + '；' +
  '戊 合成「本行取锁 .mut99.lock ＋别处文本提到 .mut77.lock」→ 锁名 ' + SYNTH4.lockNames.join('、') + '（应为 1 枚，提到的那枚不算声明）' +
  ' → ' + (calib ? '六条都成立，尺子是灵的' : '★ 对照失效，读数不可信'));
if (!calib) { fs.writeFileSync(LOGP, lines.join('\n') + '\n'); process.exit(1); }

say('');
say('=== 逐张（' + nets.length + ' 张 mut-*.js）===');
nets.forEach(f => {
  const d = byName[f];
  say([
    f.padEnd(26),
    '锁名=' + (d.lockNames.length ? d.lockNames.join(',') : '无'),
    '取锁=' + d.acq,
    '筛别人=' + (d.busyRe ? (d.busyRe === ANYSRC ? '同源' : d.busyRe) : '无'),
    '窄筛=' + (d.narrow ? '★是' : 'N'),
    '崩还原=' + (d.finallyRestore ? 'Y' : 'N'),
    '写盘=' + d.writes + '处/快照' + d.snapish + '→动树' + (d.tree ? 'Y' : 'N'),
    '快照=' + (d.files ? d.files.length + '项(' + d.snapFrom + ')' : d.snapFrom),
  ].join(' | '));
});

/* 谁的锁名从谁的筛子里穿过去（字母名 vs \d+）*/
say('');
say('=== 名字对不上筛子的（并发时互相看不见）===');
let blind = 0;
nets.forEach(f => {
  const d = byName[f];
  if (!d.lockNames.length) return;
  d.lockNames.forEach(n => {
    nets.forEach(g => {
      if (g === f) return;
      const o = byName[g];
      if (!o.lockNames.length && !o.busyRe) return;
      if (!o.busyRe) { say(f + ' 持锁 ' + n + ' → ' + g + ' 根本没有「筛别人」那一步'); blind++; return; }
      if (!new RegExp(o.busyRe).test(n)) { say(f + ' 持锁 ' + n + ' → ' + g + ' 的筛子「' + o.busyRe + '」看不见它'); blind++; }
    });
  });
});
if (!blind) say('（无）');

/* 无锁网 × 自动锁网：快照重叠就是事故现场 */
say('');
say('=== 没有独占锁的网 ===');
const nolockAll = nets.filter(f => !byName[f].lockNames.length && !byName[f].usesModule);
const nolock = nolockAll.filter(f => byName[f].tree);
const inert = nolockAll.filter(f => !byName[f].tree);
say('没锁且真动树的（雷）：' + (nolock.length ? nolock.join('、') + '（' + nolock.length + ' 张）' : '（0 张）'));
say('没锁也抽不到动树证据的：' + (inert.length ? inert.join('、') + '（' + inert.length + ' 张）' : '（0 张）'));
let pairs = 0, unknowns = 0;
nolock.forEach(f => {
  const d = byName[f];
  if (!d.files) { unknowns++; say(f + '：快照名单 UNKNOWN（写法不是 FILES=/MUTS= 那一族），重叠要人工看'); return; }
  const locked = nets.filter(g => g !== f && (byName[g].lockNames.length || byName[g].usesModule));
  const hits = [];
  locked.forEach(g => {
    const o = byName[g];
    if (!o.files) return;
    const ov = d.files.filter(x => o.files.indexOf(x) >= 0);
    if (ov.length) hits.push(g + '(' + ov.length + ' 重合：' + ov.slice(0, 4).join(' ') + (ov.length > 4 ? '…' : '') + ')');
  });
  pairs += hits.length;
  say(f + '（快照 ' + d.files.length + ' 项）→ 与 ' + hits.length + ' 张自动锁的网重叠' + (hits.length ? '：' + hits.join('；') : ''));
});

/* §52 闸门要印的那几行：全部为 0 才算补干净 */
say('');
say('=== §52 口径预跑（下面每一项期望 0）===');
const modNets = nets.filter(f => byName[f].usesModule);
const inlineNets = nets.filter(f => !byName[f].usesModule && f !== 'mut-lock.js' && (byName[f].lockNames.length || byName[f].writes > 0));
const noLockTree = nets.filter(f => !byName[f].usesModule && !byName[f].lockNames.length && byName[f].tree);
const narrow = nets.filter(f => byName[f].narrow);
const offsrc = nets.filter(f => !byName[f].usesModule && byName[f].busyRe && byName[f].busyRe !== ANYSRC);
const noWx = nets.filter(f => !byName[f].usesModule && byName[f].lockNames.length && !byName[f].wx);
const noExit = nets.filter(f => !byName[f].usesModule && byName[f].lockNames.length && !byName[f].finallyRestore);
const racey = nets.filter(f => !byName[f].usesModule && byName[f].lockNames.length && /先筛列表再写|existsSync 再写/.test(byName[f].acq));
const noRestore = nets.filter(f => byName[f].tree && !byName[f].hasExit && !byName[f].hasFinally);
const listed = [];
[
  ['① 没锁却真动树', noLockTree],
  ['② 锁名筛子写成窄筛 \\d+', narrow],
  ['③ 内联筛子与模块 ANY 不同源', offsrc],
  ['④ 内联网取锁不是 flag wx', noWx],
  ['⑤ 内联网没有退出释放钩子', noExit],
  ['⑥ 内联网有「先筛后写」的 race', racey],
  ['⑦ 动树却既无 exit 钩子也无 finally（崩在中间把树留在变异态）', noRestore],
].forEach(function (e) { say(e[0] + '：' + e[1].length + ' 张' + (e[1].length ? '（' + e[1].join('、') + '）' : '')); listed.push(e[1].length); });
say('形态分布：接模块 ' + modNets.length + ' 张／自写内联 ' + inlineNets.length + ' 张／无锁 ' + nolockAll.length + ' 张（其中真动树 ' + noLockTree.length + '）');
say('模块自身：const ANY 定义 ' + ((MODSRC.match(/const ANY =/g) || []).length) + ' 处（期望 1）／flag wx ' +
  ((MODSRC.match(/flag: 'wx'/g) || []).length) + ' 处（期望 1）／exit 释放 ' +
  ((MODSRC.match(/process\.on\('exit', unlock\)/g) || []).length) + ' 处（期望 1）');

say('');
const sum = listed.reduce((a, b) => a + b, 0);
say('汇总（v2）：没锁却真动树 ' + noLockTree.length + ' 张；穿筛组合 ' + blind + ' 组；可判定的重叠对 ' + pairs + '；快照名单 UNKNOWN ' + unknowns + ' 张；§52 七项合计 ' + sum);
say('v1→v2 的差在哪（读 v1 那份文件时按这条更正来看）：v1 的写盘判据只认 `fs.writeFileSync(path.join(ROOT,...))` 与 `writeFileSync(LOCK|ME)` 两种形状，' +
  '于是 v1 把 mut-avoid-e.js／mut-shell-res.js／mut-verify15-fallback.js 印成「写盘 0 处 → 没有锁也不算雷」（见 b33h-probe-lock.txt 那三行「无锁但抽不到写盘调用的」），' +
  '而这三张真在写盘（topic-common.js／隔壁壳仓库的 xml／android_app 副本的 xml）。v2 换成「写盘目标 ∪ 快照形状」的并集判据，并加了对照丁专门钉这一类形状。');
fs.writeFileSync(LOGP, lines.join('\n') + '\n');
