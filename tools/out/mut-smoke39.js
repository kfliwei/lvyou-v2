/* tools/out/mut-smoke39.js — §39 的浏览器腿变异自测（批次 25-B 的 B 组）
 *
 * 二十二条「改了源码，真浏览器里必须红在指定那条 K 判据上」的行为退化，外加一条 G03 反证（下面明写）。
 * 为什么这组不能省：§39 的根因是「同一族几何被写了四遍，谁后加载谁说了算」，
 * 而源码腿能钉的是**出处与字面量**，钉不到**落到屏幕上的那寸尺寸**——
 * 断字（K11/K13）、标题被压成 2px（K03）、退档阈值写错（K21）、玻璃柱里贴左（K31）、
 * 控件组压在顶栏上（K22）这五类，全是「锚点原样在、渲染已经错」的形状。
 * 25-B 又添一类同形的：专题页那两枚钮的退档写在 map.css 里，锚只认规则体的字面量，
 * 不认它的媒体条件（B12），也不认 44 漂回 40（B13）——这两条只有这里能抓。
 * 33-E 再补一条对面的：面板一族的尺寸住在 travel-notes.js 运行时注入的那份 <style> 里，
 * 注入串里**不带 body 前缀**的尺寸写回（源码腿 M62）浏览器腿结构性看不见——design.css 的
 * `body .tn-x`（0-1-1）永远赢它（0-1-0），画面照旧 44。所以这一族在 B 组只打「design.css 单点
 * 自己漂」（B15/B16）与「me.html 活着的这一条漂」（B17），外加 B18 打 K34 自己的分母：
 * 名单清空后「零枚矮于 44」会在一个没有被测对象的页面上绿（§38 那一课的第三种形状）。
 * 33-G 是同一族形状落在**第三处无视野的屏**上（首启引导蒙层，index.html 运行时注入的那份 <style>）：
 * B19 打 design.css 单点自己漂、B20 打注入串里带 body 前缀的真覆盖（这一半两腿都有视野，与源码腿
 * M70 同源）、B21/B22 打 K36 的取样前置与调用点（蒙层不挂载＝「没有样本」而不是「够 44」）。
 * 最后 G03 是本腿的**反证**：不带 body 前缀的尺寸写回必须让整网全绿——K36 的文案里那句
 * 「本腿读不到」不能只写在注释里（§43 那一课：闸门注释里「现状如此」的说法要先实测一次）。
 * 跑前先验基线：smoke-topbar 必须 37 条全绿，否则整网退出——基线不脏就没法把红记在变异头上。
 *
 * **不得与源码腿（mut-verify39.js）或像素基线并行**：变异打的正是 smoke 要量的那几页，
 * 两份同时跑读数全废（批次 20 实测）。锁用**同一个文件**：只有一侧带锁的锁不是锁。
 *
 * 用法: MUT_LOG=tools/out/b33g-mut-smoke39.txt node tools/out/mut-smoke39.js
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁收在单点：tools/mut-lock.js（§52 的口径——三件事只留一份，筛子不许各家自写）。
   与源码腿 mut-verify39.js 共用同一把 .mut39.lock 是**故意**的：两侧同抢一把，只有一侧带锁等于没有。 */
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut39.lock');

/* 证据由脚本自己写盘：shell 重定向在长跑后台任务里留过 0 字节文件。
   每行带时刻：这张网一条要跑一整遍 smoke-topbar（十几分钟级），没时间戳就没法判断
   是「还在跑第一条」还是「卡死了」，也就没法给「摘要声称的落盘」对账。 */
const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, '[' + new Date().toTimeString().slice(0, 8) + '] ' + s + '\n');
};

const FILES = ['design.css', 'map.css', 'topic.html', 'travel-map.html', 'node-manager.html', 'story.html',
  'search.html', 'wishlist.html', 'checklist.html', 'album-edit.html', 'expense.html', 'me.html',
  'index.html', 'tools/smoke-topbar.js'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); unlock(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上（与源码腿同一口径） */
[['map.css', '.t-row .act{padding:0;width:44px;'],
 ['topic.html', '<span class="act-label">游记</span>'],
 ['travel-map.html', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}'],
 ['design.css', '.t-row .title{flex:1 1 7em;min-width:7em;'],
 ['design.css', 'body .tn-x{width:44px'],
 ['me.html', '.entry .ic{width:40px'],
 ['tools/smoke-topbar.js', "ok('K34 "],
 ['tools/smoke-topbar.js', 'const PN_SEL = '],
 ['design.css', 'body .ob-skip,body .ob-btn{min-height:44px}'],
 ['index.html', '.ob-btn{padding:0 26px;'],
 ['index.html', 'class="ob-skip"'],
 ['tools/smoke-topbar.js', "ok('K36 "],
 ['tools/smoke-topbar.js', "localStorage.removeItem('tn_onboarded')"],
].forEach(pair => {
  if (ORIG[pair[0]].indexOf(pair[1]) < 0) {
    console.log('中止：基准源码 ' + pair[0] + ' 不含本批指纹「' + pair[1].slice(0, 40) + '」，读数不可信');
    process.exit(2);
  }
});

function smoke() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-topbar.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1500000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
  return (r.stdout || '') + (r.stderr || '');
}

/* 基线必须干净 */
{
  const out = smoke();
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  if (fails.length) {
    console.log('中止：基准 smoke-topbar 已有 ' + fails.length + ' 条红，先修树再跑变异网\n' +
      fails.map(l => l.slice(0, 100)).join('\n'));
    process.exit(2);
  }
  console.log('基准 smoke-topbar 全绿（' + (out.match(/全部通过（(\d+) 条）/) || [])[1] + ' 条），开始逐条打红\n');
}

let red = 0, anomalies = 0, total = 0, silent = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  const hit = fails.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → FAIL ' + fails.length + ' 条（' +
      fails.map(l => (l.match(/FAIL\s+(K\d+\w*)/) || [])[1] || '?').join(',') + '），指定那条：' +
      hit[0].slice(0, 150));
  } else if (/CRASH/.test(out)) {
    anomalies++;
    console.log('异常  ' + name + '  smoke 直接崩了（不是红在指定判据上）：' +
      (out.match(/CRASH.*/) || [''])[0].slice(0, 140));
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
/* 设计内静默（浏览器腿必须**全绿**）：这一条不是「没人守」，而是反证 K36 文案里那句声明——
   「注入串里写回不带 body 前缀的尺寸，本腿读不到」。这句若不实测一次，就又是一条只写在注释里的
   断言（§43 那一课：闸门注释里「现状如此」的说法要先写探针实测）。读到 44 才算证明：
   0-1-0 打不过 design.css 的 0-1-1，画面照旧 44，真正的视野在源码腿 M69 那一边。 */
function silentCase(name, file, from, to) {
  total++;
  const src = ORIG[file];
  const n = src.split(from).length - 1;
  if (n !== 1) {
    anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（静默样本没打上）');
    return;
  }
  fs.writeFileSync(path.join(ROOT, file), src.replace(from, () => to));
  let out;
  try { out = smoke(); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL ') === 0);
  if (fails.length === 0 && !/CRASH/.test(out)) {
    silent++;
    console.log('静默  ' + name + '  → 浏览器腿 0 红（这条退化对 rect/computed 是结构性盲的，视野在源码腿 M69 那一边）');
  } else {
    anomalies++;
    console.log('异常  ' + name + '  本条应「浏览器腿全绿」（用它反证那句结构性失明），实际 FAIL ' + fails.length +
      ' 条：' + fails.map(l => l.slice(0, 70)).join(' | '));
  }
}

/* ============ 标题那一族：源码锚在、渲染已经错 ============ */
run('B1 标题退回改前 flex:1;min-width:0（328 档被压成 clientW 2px，K03 量的是可读下限）→ K03 必须红', 'design.css',
  '.t-row .title{flex:1 1 7em;min-width:7em;', '.t-row .title{flex:1;min-width:0;', 'K03');
run('B2 只留 overflow:hidden 不留省略号（硬裁成半个字）→ K04 必须红', 'design.css',
  'letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', 'letter-spacing:.02em;white-space:nowrap;overflow:hidden}', 'K04');
run('B3 顶栏返回键与 .t-ic 漂回 40（改前 13 页里 11 页就是这个值）→ K02 必须红', 'design.css',
  '.t-row .back,.t-row .t-ic{width:44px;height:44px;', '.t-row .back,.t-row .t-ic{width:40px;height:40px;', 'K02');
run('B4 右上角钮退回内联 style 的 40×40（比页内 <style> 更靠后，CSS 全管不住它）→ K02 必须红', 'expense.html',
  '<a class="t-ic" href="planner.html" aria-label="行程规划">',
  '<a class="t-ic" style="flex:0 0 auto;width:40px;height:40px;border:0" href="planner.html" aria-label="行程规划">', 'K02');

/* ============ 弹层按钮断字那一族 ============ */
run('B5 摘掉 .is-btn 的 white-space:nowrap（CJK 任意断行，61px 的钮把「语音记录」排成 3 行）→ K11 必须红', 'node-manager.html',
  'font-family:var(--font-sans);white-space:nowrap}', 'font-family:var(--font-sans)}', 'K11');
run('B6 摘掉 .is-acts 的 flex-wrap（nowrap 的标签配不可换行容器＝裁字）→ K14 必须红', 'node-manager.html',
  '#infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}', '#infoSheet .is-acts{display:flex;gap:10px}', 'K14');

/* ============ 退档阈值 / --tb-h / 36 豁免档 ============ */
run('B7 退档阈值 360→700（452 档也被切成纯图标：K21 就是这支温度计，§31 同一形状）→ K21 必须红', 'travel-map.html',
  '@media(max-width:360px){', '@media(max-width:700px){', 'K21');
run('B8 --tb-h 从 63 改回写死口径 56（钮抬到 44 后控件组压在顶栏上）→ K22 必须红', 'travel-map.html',
  'body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 56px)}', 'K22');
run('B9 地图缩放钮从 36 漂回 40（点名允许的豁免档也要有闸门，否则豁免就是无人看管的低值）→ K23 必须红', 'design.css',
  '.ctl button{width:36px!important;height:36px!important;margin:0 auto}', '.ctl button{width:40px!important;height:40px!important;margin:0 auto}', 'K23');
run('B10 摘掉 .ctl button 的 margin:0 auto（玻璃柱里图标贴左、右侧空一条，实测留白 0/8）→ K31 必须红', 'design.css',
  '.ctl button{width:36px!important;height:36px!important;margin:0 auto}', '.ctl button{width:36px!important;height:36px!important}', 'K31');
run('B11 并族那条「移除·删除·打开」漂回 40（K25 量 wishlist 那枚真 rect、K32 量三枚 computed）→ K25 必须红', 'design.css',
  '.wl-remove,.ck-remove,.ech-del,.tb-open{width:44px!important;height:44px!important}',
  '.wl-remove,.ck-remove,.ech-del,.tb-open{width:40px!important;height:40px!important}', 'K25');

/* ============ 批次 25-B 专题页那一族：锚钉字面量，媒体条件与值都不认（G02 的对面） ============ */
run('B12 专题页退档的媒体条件 360→700（390 档的主流手机被切成纯图标、标签永久消失；源码腿 G02 已证它全绿）→ K33 必须红', 'map.css',
  '@media (max-width:360px){', '@media (max-width:700px){', 'K33');
run('B13 专题页那两枚退档钮从 44 漂回 40（这条规则写在 map.css 最后，没人再提醒；K33 逐枚量 rect）→ K33 必须红', 'map.css',
  '.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}',
  '.t-row .act{padding:0;width:40px;height:40px;border-radius:50%;justify-content:center}', 'K33');
run('B14 专题页收掉文字顺便把 aria-label 也摘了（屏幕上看着对，读屏软件里那颗钮没有名字）→ K33 必须红', 'topic.html',
  ' title="查看游记列表" aria-label="游记"', ' title="查看游记列表"', 'K33');

/* ============ 批次 33-E：随手记面板族与 me.html（K34/K35 是这两族的第一条浏览器腿） ============
   注意口径：B15/B16 打的是 design.css 单点自己漂；注入串里那些**不带 body 前缀**的尺寸写回
   （源码腿 M62）在这张网里量不到——特异度不够，design.css 永远赢，画面照旧 44。
   这条静默是设计内的，它在 tools/out/b33e-probe-fileui.txt 里有实测（同一枚钮带 inline 34 才读得到 34）。 */
run('B15 design.css 面板关闭钮从 44 漂回 34（这一族五处落点共用一条，改前实测 32/34/36/40 四种）→ K34 必须红', 'design.css',
  'body .tn-x{width:44px;height:44px;flex:0 0 auto}', 'body .tn-x{width:34px;height:34px;flex:0 0 auto}', 'K34');
run('B16 面板那四条「非方形钮」的地板从 44 掉到 34（胶囊/页签/重润色/标签条共一条；#tnQuote 与 #tnDocBtn 量的就是它）→ K34 必须红', 'design.css',
  'body .tn-cfm .tc-btns button{min-height:44px;', 'body .tn-cfm .tc-btns button{min-height:34px;', 'K34');
run('B17 me.html 的入口图标从 40 漂到 34（活着的是后写那一条，前面那条死声明盖不住它——K35 量的是生效值）→ K35 必须红', 'me.html',
  '.entry .ic{width:40px;height:40px;border-radius:13px;', '.entry .ic{width:34px;height:34px;border-radius:13px;', 'K35');
run('B18 K34 自己的分母清空（PN_SEL 换成空表：五枚全不量，「零枚矮于 44」就在一个没有被测对象的页面上绿——§38 那一课的第三种形状）→ K34 必须红', 'tools/smoke-topbar.js',
  "const PN_SEL = ['#tnX', '#tnQuote', '#tnDocBtn', '#tnViewTrip', '#tnSearch'];",
  'const PN_SEL = [];', 'K34');

/* ============ 批次 33-G：首启引导蒙层（这屏此前既不在 FILES39 也不在 BAR_PAGES，两腿都无视野） ============
   地基读数 tools/out/b33g-obskip.txt：改前「跳过 ›」= 60.2×34（328 与 320 两档同值），比地板差 10。
   B19 打 design.css 单点自己漂；B20 打注入串里**带 body 前缀**的真覆盖（同特异度＋后加载，这一半两腿都有视野）；
   B21／B22 打 K36 的取样前置与调用点——蒙层不挂载、或那枚钮换了 class，「零枚矮于 44」都是绿在一张没有样本的屏上。
   G03 是这一族的**反证**：不带 body 前缀的尺寸写回，本腿必须全绿（K36 的文案就是这么声明的，得实测一次）。 */
run('B19 design.css 那条首启引导的地板单点从 44 漂回 34（改前这一族压根没在任何地方被点名过，全靠 padding 撑）→ K36 必须红', 'design.css',
  'body .ob-skip,body .ob-btn{min-height:44px}', 'body .ob-skip,body .ob-btn{min-height:34px}', 'K36');
run('B20 注入串里给那枚跳过钮写回带 body 前缀的 min-height:34px（同特异度＋运行时 append＝真覆盖，design.css 压不住它；这一半与源码腿 M70 打的是同一种写法）→ K36 必须红', 'index.html',
  '.ob-skip{position:absolute;', 'body .ob-skip{min-height:34px;position:absolute;', 'K36');
run('B21 挂载前置倒转成恒真（tn_onboarded 那个键还在但蒙层永远不挂载：K36 读到的 mounted=false 是「没有样本」，不是「够 44」）→ K36 必须红', 'index.html',
  "if(localStorage.getItem('tn_onboarded')) return;", 'if(1) return;', 'K36');
run('B22 把「跳过 ›」的 class 改名（钮还在屏幕上、还能点，但 .ob-skip 这个选择器没人认了：K36 的分母宿主没了而判据照样跑）→ K36 必须红', 'index.html',
  'class="ob-skip"', 'class="obSkipX"', 'K36');
silentCase('G03 注入串里给 .ob-btn 写回不带 body 前缀的 min-height:34px（0-1-0 打不过 design.css 的 0-1-1，画面照旧 44）——浏览器腿必须全绿：这条就是 K36 那句「本腿读不到不带 body 前缀的写回」的实测反证，视野在源码腿 M69', 'index.html',
  '.ob-btn{padding:0 26px;', '.ob-btn{min-height:34px;padding:0 26px;');

console.log('mut-smoke39: 共 ' + total + ' 条 / 按预期红 ' + red + ' / 设计内静默 ' + silent + ' / 异常 ' + anomalies);
process.exit(anomalies ? 1 : 0);
