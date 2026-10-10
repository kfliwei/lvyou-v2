/* tools/out/mut-verify52.js — verify.js §52「变异网独占锁与还原保障闸门」变异自测 · 源码腿
 *
 * 本节守的不是产品，是**我们自己的尺子**：42 张变异网在同一棵树上动土（本网自己也在 §52 的分母里），两张并发时后还原的那张会把
 * 前一张刚还原的内容一并抹掉，树停在中间态而两边都报「全过」——这是假绿里最坏的一种，因为没有任何
 * 产品判据会红。所以这一节的每一条靶子都要回答：「这一件防线退回老写法，闸门当场红不红？」
 *
 * 靶子分四类：
 *   ① 单点模块自己（M01–M05）：筛子改窄成 \d+／取锁退回非 wx／摘掉退出释放／出现第二把 ANY／ANY 改名让闸门抽不到。
 *      M01 要特别记一句：它红在**自校准失效**而不是红在七项清单——模块这把筛子一改窄，「与模块同源」这个概念
 *      本身就没了，闸门选择闭嘴并印一条自校准红（比印 15 条同源红更诚实，因为那 15 条全是拿 null 比出来的）。
 *   ② 某一张网的形状退化（M06–M12）：筛子退回 \d+／换成另一种「同样宽但字面不同」的筛子（这一支才证明
 *      「同源」不是只抓 \d+）／取锁非 wx／摘掉 exit 兜底／接了模块却没传锁名／一把锁名两网共用／整行锁摘掉。
 *   ③ 尺子自己（M13）：把甲对照那张内联网伪造成「接了模块」——四条自校准必须当场失效，并且 §52 余下读数
 *      不再计数（一条会系统性撒谎的常驻闸门比没有闸门更坏，所以这一支要的是「尺子一坏就全场闭嘴」。
 *   ④ 逐字节锚与登记（M14–M15）：本批转换过的网的 require 行漂了要红在锚上，不能只靠分类器归类；
 *      README 的 verify 清单被抹掉 §52 也要红（新闸门不登记就等于没装，§50/§51 同一条纪律）。
 *
 * 登记一条本节看不见、由第二条腿守的盲区（守卫记忆：设计内静默要第二条腿反证一次，两腿都绿＝没人守）：
 *   G01 把 tools/mut-lock.js 里两处 process.exit(2) 改成 exit(0)——「别人持锁必须拒跑」这件运行时事实，
 *   §52 一把源码文本尺子永远看不见（三件定义各恰 1、wx 在、释放钩子在，全部照绿）。所以 G01 判据是
 *   「§52 必须 0 红」+「node tools/mut-lock.js --selftest 必须当场红（丙那条子进程实测 exit===2 失效）」。
 *   本网因此不是一条腿自证通过的网：它同时钉住了两条腿各自的视野。
 *
 * 另登记一条本节故意不管的：tools/out/mut-*.js 之外的脚本（探针 probe33h-lock.js、草稿腿
 *   tools/out/archive/gate52-draft.js.disabled）不在这 42 张网
 *   的分母里，它们不取锁也不动树；若哪天有人写一个动树的探针，得连分母筛子一起改（/^mut[-\w]*\.js$/）。
 *
 * 用法:
 *   node tools/out/mut-verify52.js --selfcheck      # 只跑内部自测：预检必须能抓到一枚坏靶子且不落盘
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify52.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=M01,M13 node tools/out/mut-verify52.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b33h-mut-verify52.txt node tools/out/mut-verify52.js
 * **不要与别的变异网或像素基线并行**：本网动 tools/mut-lock.js、README.md 与 tools/out/mut-verify{16,22,39,45,46,47,48,50}.js，
 *   其中 tools/mut-lock.js 是所有网取锁的那一处——本网持锁期间别的网本来就该拒跑，这正是本网要证的事。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁收在单点（本网砸的就是这个单点，取锁发生在砸之前；改盘上的它不影响内存里已 require 的那一份） */
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut-verify52.lock');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

/* 快照＋逐字节还原（含异常退出）。tools/verify.js 只读进来当护栏：它是尺子，本网一条都不该改到它。 */
const FILES = [
  'tools/mut-lock.js', 'tools/verify.js', 'README.md',
  'tools/out/mut-verify16.js', 'tools/out/mut-verify22.js', 'tools/out/mut-verify39.js',
  'tools/out/mut-verify45.js', 'tools/out/mut-verify46.js', 'tools/out/mut-verify47.js',
  'tools/out/mut-verify48.js', 'tools/out/mut-verify50.js',
];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); unlock(); });

/* 启动断言：基准源码必须含本批指纹。§52 还没搬进闸门就跑这张网，每条靶子都会「不红」，
   而那张成绩单看起来会像「闸门全盲」——实际上是本网在量一个不存在的东西。
   （这一节排在预检之后：预检纯读盘，§52 没落地时照样能拿来对账靶单锚点。） */

/* 靶串里凡是要原样抄下「别人家那一行取锁调用」的，`mut-` 与 `lock.js` 之间一律断开写：
   §52 的锁名从取锁调用形状里抽，本网若整串抄写就会被自己的分类器数到 4 枚锁名，⑥⑦ 立刻失真——
   这是「扫描器把引用当声明」那一类坑（守卫记忆第 5 条），先在本网这一侧堵住，而不是把分类器放宽。 */
const CASES = [
  /* 下面凡是把「别人的整行 require」当靶串的（M10/M12/M14 与启动指纹那一条），一律把 mut-lock.js
     写成两段拼接。原因不是文字洁癖：§52 的锁名从「取锁那一下」的调用形状里抽，照抄一次就等于
     在本网里凭空多出三枚锁名，⑥⑦ 两条判据会把这张网自己数成「一把锁名两网共用／锁名传得不对」。 */
  { id: 'M01', kind: '红', file: 'tools/mut-lock.js',
    old: 'const ANY = /^\\.mut[\\w.-]+\\.lock$/;',
    neo: 'const ANY = /^\\.mut\\d+\\.lock$/;',
    exp: '自校准失效 — 甲', n: 1,
    note: '模块这把尺子自己改窄 ⇒「同源」这个概念当场没了。闸门选的是一条自校准红＋余下读数全部闭嘴，' +
      '而不是印 15 条同源红：一条会系统性撒谎的常驻闸门比没有闸门更坏（与 M13 打的是同一条红，起因不同——M01 在尺子那侧，M13 在被测网那侧）' },
  { id: 'M02', kind: '红', file: 'tools/mut-lock.js',
    old: "{ flag: 'wx' });", neo: "{ flag: 'w' });",
    exp: '取锁不是恰 1 处', n: 1,
    note: '退回 existsSync 再写就留着一格「同时启动」的 race' },
  { id: 'M03', kind: '红', file: 'tools/mut-lock.js',
    old: "process.on('exit', unlock);", neo: "/* 释放钩子摘掉：崩在中间就把锁永远留在盘上 */",
    exp: '模块没有恰 1 处退出释放', n: 1,
    note: '崩了不释放 ⇒ 后面每一张网永远拒跑，比没锁更难查（表现为「莫名其妙起不来」）' },
  { id: 'M04', kind: '红', file: 'tools/mut-lock.js',
    old: 'module.exports.ANY = ANY;',
    neo: ';(function () { const ANY = 1; })();\nmodule.exports.ANY = ANY;',
    exp: '定义是 2 处', n: 1,
    note: '两把筛子就没有「同源」可言；抽串那一支按行首匹配，不会被这行误抽（所以只红计数这一笔）' },
  { id: 'M05', kind: '红', file: 'tools/mut-lock.js',
    old: 'const ANY = /^\\.mut[\\w.-]+\\.lock$/;',
    neo: 'const ANYX = /^\\.mut[\\w.-]+\\.lock$/;',
    exp: '抽不到模块里', n: 2,
    note: '同因两笔（抽不到 + 定义 0 处）。这一支守的是「闸门拿 null 去比同源」那种全场假绿/假红' },
  { id: 'M06', kind: '红', file: 'tools/out/mut-verify45.js',
    old: "/^\\.mut[\\w.-]+\\.lock$/.test(f) && f !== '.mut45.lock'",
    neo: "/^\\.mut\\d+\\.lock$/.test(f) && f !== '.mut45.lock'",
    exp: '锁名筛子退回窄筛', n: 2,
    note: '②③ 同因两笔是有意留的：删掉「窄筛」那一支，「与模块不同源」还守着这一形状' },
  { id: 'M07', kind: '红', file: 'tools/out/mut-verify46.js',
    old: "/^\\.mut[\\w.-]+\\.lock$/.test(f) && f !== '.mut46.lock'",
    neo: "/^\\.mut.*\\.lock$/.test(f) && f !== '.mut46.lock'",
    exp: '自写筛子与模块 ANY 不同源', n: 1,
    note: '这一支才证明「同源」不是只抓 \\d+：换成另一把同样宽、字面不同的筛子照样红' },
  { id: 'M08', kind: '红', file: 'tools/out/mut-verify47.js',
    old: "{ flag: 'wx' });", neo: "{ flag: 'w' });",
    exp: '有锁但取锁不是 flag wx', n: 1,
    note: '内联网这一族按「三件齐备」放行（不批量改写 15 张正在被别的证据引用的网），但 wx 那一格必须钉住' },
  { id: 'M09', kind: '红', file: 'tools/out/mut-verify48.js',
    old: "process.on('exit', () => { restore(); unlock(); });",
    neo: "/* 摘掉 exit 兜底：崩在注入与还原之间就把树留在变异态 */",
    exp: '动树却既无 exit 钩子也无 finally', n: 1,
    note: '第二类缺陷（本批新查出）：有锁、会还原，但崩在中间就没人还原' },
  { id: 'M10', kind: '红', file: 'tools/out/mut-verify16.js',
    old: "require(path.join(ROOT, 'tools', 'mut-" + "lock.js'))('.mut-verify16.lock');",
    neo: "require(path.join(ROOT, 'tools', 'mut-" + "lock.js'))();",
    exp: '接了模块却把锁名传得不对', n: 1,
    note: '锁名就是别人筛子里那串；没传＝这张网的锁没人认得（模块在场也不等于上了锁）' },
  { id: 'M11', kind: '红', file: 'tools/out/mut-verify16.js',
    old: "('.mut-verify16.lock')", neo: "('.mut-verify17.lock')",
    exp: '一把锁名被两张不同的网共用', n: 1,
    note: '两张网同名锁＝其中一张永远起不来，或更坏：都以为自己拿到了' },
  { id: 'M12', kind: '红', file: 'tools/out/mut-verify22.js',
    old: "require(path.join(ROOT, 'tools', 'mut-" + "lock.js'))('.mut-verify22.lock'); /* 独占锁单点，见 tools/mut-lock.js */",
    neo: '/* 锁整行摘掉 */',
    exp: '没有锁却真动树', n: 1,
    note: '摘的是整行（连那句提到 mut-lock.js 的注释一起），否则分类器仍按「接了模块」放行——这本身就是 M10 那条判据' },
  { id: 'M13', kind: '红', file: 'tools/out/mut-verify50.js',
    old: "{ flag: 'wx' });", neo: "{ flag: 'wx' }); /* 本行假装改走了 tools/mut-lock.js */",
    exp: '自校准失效 — 甲', n: 1,
    note: '打的是尺子不是判据：甲对照要求那张网是自己写内联锁。尺子一坏，§52 余下读数当场不再计数（只剩这一笔红）' },
  { id: 'M14', kind: '红', file: 'tools/out/mut-verify39.js',
    old: "const unlock = require(path.join(ROOT, 'tools', 'mut-" + "lock.js'))('.mut39.lock');",
    neo: 'const unlock = function () {};',
    exp: 'tools/out/mut-verify39.js 里那行独占锁 require 命中 0 次', n: 2,
    note: '同因两笔：逐字节锚（⑤）＋分类器判它「模块串还在却没传锁名」（⑥，注释里那句 tools/mut-lock.js 还在）' },
  { id: 'M15', kind: '红', file: 'README.md', all: true, cnt: 2,
    old: '§52', neo: '§5Z',
    exp: 'README.md 的 verify 清单没提 §52', n: 1,
    note: '新闸门不登记就等于没装（§50/§51 同一条纪律）。打的是「§52 这三字的全部出现」而不是某一行的第一处——' +
      '守卫记忆：抹登记要抹全部出现，只抹第一处会留下一模一样的另一处，闸门照样绿，等于空靶子。' +
      'cnt 必须在搬进闸门那天现场数（README 里 §52 若被写在两处，这一支的 cnt 就得跟着搬到两处，否则预检当场中止）——' +
      '本批现场数为 2：§52 登记段 1 处 + 33-E 段那句「33-H 起一并改走单点 tools/mut-lock.js」的括注 1 处' },
  { id: 'G01', kind: '静默', file: 'tools/mut-lock.js', cnt: 2, n: 0, all: true,
    old: 'process.exit(2);', neo: 'process.exit(0);',
    exp: '§52 必须 0 红（设计内静默），第二腿 node tools/mut-lock.js --selftest 必须红',
    note: '「别人持锁必须拒跑」是运行时事实，源码文本尺子看不见；丙那条子进程实测才是它的守者' },
];

function hit(s, sub) { return s.split(sub).length - 1; }

/* 预检：先数锚点命中，再决定动不动树（守卫记忆：变异 from 串先 preflight，缩进/写法错位会伪装成「锚没线」） */
function preflight(list) {
  const bad = [];
  list.forEach(c => {
    const want = c.cnt || 1;
    const n = hit(ORIG[c.file], c.old);
    if (n !== want) bad.push(c.id + ' 锚点在 ' + c.file + ' 命中 ' + n + ' 次（期望恰 ' + want + '）：' + JSON.stringify(c.old));
    const nn = hit(ORIG[c.file], c.neo);
    /* 注入串在基准里就该是 0 次：否则这一发打下去计数不变化，闸门看着红其实是我在原地踏步
       （守卫记忆：变异打不红先量是否恒等操作）。全部靶子的 neo 已现场 grep 过，各 0 次。 */
    if (nn !== 0) bad.push(c.id + ' 注入串在基准里已存在 ' + nn + ' 次（' + c.file + '），注入数不出变化：' + JSON.stringify(c.neo));
  });
  return bad;
}

function runVerify() {
  try {
    const out = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
function runSelftest() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'mut-lock.js'), '--selftest'],
    { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status === null ? -1 : r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const lines = out => out.split(/\r?\n/);
const f52 = out => lines(out).filter(l => l.indexOf('FAIL §52') === 0);
const fOther = out => lines(out).filter(l => l.indexOf('FAIL ') === 0 && l.indexOf('FAIL §52') !== 0);

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK    ' : '异常  ') + msg); if (!cond) fail++; };

/* --selfcheck：坏靶子必须被预检抓住，而且一个字节都不许落盘 */
if (process.argv.indexOf('--selfcheck') >= 0) {
  const syn = [{ id: 'SC01', file: 'tools/mut-lock.js', old: 'const ANY = /^\\.mutZZ+\\.lock$/;', neo: 'ZZZABSENTZZZ' }];
  const bad = preflight(syn);
  ok(bad.length === 1 && /命中 0 次/.test(bad[0]), '坏靶子（锚点根本不在盘上）必须被预检抓住：' + bad.join(' | '));
  const same = FILES.every(f => fs.readFileSync(path.join(ROOT, f), 'utf8') === ORIG[f]);
  ok(same, '预检不落盘：' + FILES.length + ' 个快照文件逐字节不变');
  const all = preflight(CASES);
  ok(all.length === 0, '真靶单预检全过（' + CASES.length + ' 条）：' + all.join(' | '));
  console.log('=== mut-verify52 自测：' + (fail ? fail + ' 条不成立' : '三条都成立') + ' ===');
  process.exit(fail ? 1 : 0);
}

const bad0 = preflight(CASES);
if (bad0.length) { bad0.forEach(b => console.log('异常  ' + b)); console.log('中止：靶单锚点没对齐，树没动'); process.exit(1); }
if (process.env.MUT_PREFLIGHT) { console.log('预检通过（' + CASES.length + ' 条锚点各恰 1 次），MUT_PREFLIGHT＝1 不动树'); process.exit(0); }

const FP = [
  ['tools/verify.js', '§52-BEGIN'],
  ['tools/verify.js', '变异网独占锁与还原保障闸门'],
  ["tools/verify.js", "const NARROW52 = '^\\\\.mut\\\\d+\\\\.lock$';"],
  ['tools/mut-lock.js', "const ANY = /^\\.mut[\\w.-]+\\.lock$/;"],
  ['tools/out/mut-verify39.js', "require(path.join(ROOT, 'tools', 'mut-" + "lock.js'))('.mut39.lock');"],
];
const FMISS = FP.filter(c => ORIG[c[0]].indexOf(c[1]) < 0).map(c => c[0] + ' 缺 ' + JSON.stringify(c[1]));
if (FMISS.length) {
  console.log('中止：基准源码不含本批指纹 —— ' + FMISS.join('；') + '（§52 或本批转换还没落地，此时跑出的读数全是空的）');
  process.exit(2);
}

const ONLY = process.env.MUT_ONLY ? process.env.MUT_ONLY.split(',') : null;

/* 基准：干净树上整跑必须绿，且 §52 一行 FAIL 都不许有 */
const b = runVerify();
ok(b.code === 0 && f52(b.out).length === 0 && fOther(b.out).length === 0,
  '基准 verify.js → exit=' + b.code + ' §52 FAIL ' + f52(b.out).length + ' 条 其它 FAIL ' + fOther(b.out).length + ' 条');
if (b.code !== 0) {
  fOther(b.out).slice(0, 6).forEach(l => console.log('  基准红在：' + l.slice(0, 160)));
  console.log('中止：基准不绿（树脏或别的节在红），此时逐条打红的读数全是假的');
  process.exit(1);
}
const k52 = (f52(b.out).join('') + (lines(b.out).filter(l => l.indexOf('变异网独占锁') === 0)[0] || '')).length;
ok(k52 > 0, '基准里能读到 §52 的口径行（判据在场，不是空节）');

CASES.forEach(c => {
  if (ONLY && ONLY.indexOf(c.id) < 0) return;
  const p = path.join(ROOT, c.file);
  const src = ORIG[c.file];
  fs.writeFileSync(p, c.all ? src.split(c.old).join(c.neo) : src.replace(c.old, c.neo));
  const r = runVerify();
  const g = f52(r.out), oth = fOther(r.out);
  const countOk = g.length === c.n;
  if (c.kind === '静默') {
    const st = runSelftest();
    ok(r.code === 0 && g.length === 0 && oth.length === 0 && st.code !== 0 && /FAIL/.test(st.out),
      c.id + ' 设计内静默（注入 ' + path.basename(c.file) + '：' + c.note + '）→ §52 exit=' + r.code +
      ' FAIL ' + g.length + ' 条（本该 0）；第二腿 mut-lock --selftest exit=' + st.code +
      ' 红句：' + JSON.stringify((lines(st.out).filter(l => l.indexOf('FAIL') === 0)[0] || '').slice(0, 90)));
  } else {
    ok(r.code !== 0 && countOk && r.out.indexOf(c.exp) >= 0 && oth.length === 0,
      c.id + ' 砸 ' + path.basename(c.file) + ' → exit=' + r.code + ' §52 FAIL ' + g.length + ' 条（期望 ' + c.n + '）' +
      ' 命中预期短语=' + (r.out.indexOf(c.exp) >= 0) + ' 其它节 FAIL=' + oth.length + ' 条' +
      (oth.length ? '（' + oth[0].slice(0, 120) + '）' : '') + ' ｜ ' + c.note);
  }
  restore();
  if (fs.readFileSync(p, 'utf8') !== ORIG[c.file]) { ok(false, '还原失败！' + c.file); }
});

/* 收尾：全部还原后整跑归零，尺子（tools/verify.js）一个字节都没被碰过 */
restore();
const z = runVerify();
ok(z.code === 0 && f52(z.out).length === 0 && fOther(z.out).length === 0,
  '终跑 verify.js 归零 → exit=' + z.code + ' §52 FAIL ' + f52(z.out).length + ' 条 其它 FAIL ' + fOther(z.out).length + ' 条');
ok(FILES.every(f => fs.readFileSync(path.join(ROOT, f), 'utf8') === ORIG[f]), '逐字节还原对账：' + FILES.length + ' 个快照文件全数等于启动值');
const st2 = runSelftest();
ok(st2.code === 0, '第二腿 mut-lock --selftest 还原后归零 → exit=' + st2.code +
  '（现场本网持锁时「丁 wx 那一格」按纪律打 SKIP，不静默算过：' + (/SKIP 丁/.test(st2.out) ? 'SKIP 已印' : '未 SKIP') + '）');
console.log('=== mut-verify52：' + CASES.length + ' 条靶子（' + CASES.filter(c => c.kind === '红').length + ' 条必须红 ＋ ' +
  CASES.filter(c => c.kind === '静默').length + ' 条设计内静默由第二腿反证）｜ 异常 ' + fail + ' 条 ===');
process.exit(fail ? 1 : 0);
