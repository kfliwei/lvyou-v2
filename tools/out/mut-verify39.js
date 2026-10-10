/* tools/out/mut-verify39.js — verify.js §39（顶栏一族与触控口径）变异自测 · 源码腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §39 红**里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一批为什么需要这张网：§39 的立论是「同一族几何被写了四遍，谁后加载谁说了算」，
 * 所以它钉的不是值而是**出处唯一**——三类判据各有各的假绿法：
 *   ① 字面量锚（A39 88 条）：needle 被改名/整族换名 → 0 命中；条数守卫与分母锚（.topbar /
 *      id="infoSheet" / html 份数）专防这一类，M09／M31／M44 打的就是这三只门；
 *      条数守卫的阈值是**跟着锚点表长度抬的**（M51）：这张表 25-B 从 60 长到 64、33-E 长到 82、
 *      33-G 长到 88，原先那个「抬到 61 必红」的变异就此打不红了——阈值取自早先的计数，锚一加长守卫就自己失效，
 *      这是 §34 那一课的第二种形状（上一批栽在采样计数上，这一批栽在表长度上）；
 *   ② 规则体零尺寸抽取（SKIN39 廿一族）：如果 GEO39 那把尺子本身坏掉，这些族的「0 条违规」
 *      立刻全体恒真——M46 把 GEO39 换成永不匹配的正则，必须被 BADSKIN 反向对照打红；
 *   ③ 期望 0 十八族：needle 写坏（对不上真实改前形态）就是「拿一个不存在的串证明它不存在」，
 *      M50 只改 needle 一个字符，正向对照必须当场喊「这个 0 不是证据」。
 * M48／M49 两条打红的是**守卫自己**（四元组形状不整即红、不再静默解构错位），照 §27/§38 的写法。
 *
 * 批次 33-E 新增的七条（M61–M67）打的是三类新形状，这一族和前面四十条不一样：
 *   M61 design.css 面板族单点漂回 34——① 那一族的老路，只是落在新开的四条款上；
 *   M62 travel-notes.js 的注入串里给 `.tn-pill{` 加回 width:34px——**只有源码腿看得见**。
 *       为什么浏览器腿看不见：buildUI() 是运行时 `document.head.appendChild(style)`，永远晚于
 *       design.css，注入串里的 `.tn-x`（0-1-0）压不过 design.css 的 `body .tn-x`（0-1-1），
 *       加回来的尺寸是个死声明，画面照旧 44。这条就是「两腿盲区不同」的正面证据；
 *   M63 同文件把选择器改成 `body .tn-tagbar button`——同特异度＋后加载＝**真覆盖**，
 *       这条浏览器腿也有视野，所以它同时出现在 mut-smoke39 的 B 族里；
 *   M64 me.html 把被盖死的三条死声明加回 `.entry .ic` 第一条——同一选择器两条尺寸自相矛盾，
 *       只有源码腿的「同一选择器两条尺寸」那条锚认它（浏览器照样盖掉，K35 仍绿）；
 *   M65／M66 打的是**剥刀自己**：flat39 的定义行换回 naive 正则、view39 摘掉 `.md`。
 *       这两条是 §39 的自指定义行锚（⑦），变异串就写在 verify.js 的⑥ 段里，
 *       所以改的是**这张网的源文件本身**——打红的是守卫，不是被守的东西；
 *   M67 smoke-topbar 的 `const PN_SEL` 改名——K34 的名单抽不出来的那一刻，闸门必须当场喊，
 *       不许「零枚矮于 44」在空名单上恒绿。
 *
 * 批次 33-G 新增的九条（M68–M76）打的是**第三处两腿都无视野的屏**：首启引导蒙层。
 *   这一族的特殊性在于「盲区是双向的」，所以靶也成对：
 *     M68 design.css 那条 `body .ob-skip,body .ob-btn{min-height:44px}` 漂回 34——① 那一族的老路；
 *     M69 把改前那处页内 `min-height:44px` 塞回 index.html 的注入串——**值是对的**，照样要红，
 *         而且它对浏览器腿是盲的（0-1-0 打不过单点的 0-1-1，画面仍是 44），只有 ZERO39 那条认得；
 *     M70 同一个串里给选择器加 `body ` 前缀——同特异度＋后加载＝真覆盖，这一半两腿都有视野，
 *         所以 mut-smoke39 的 B 族同时打它；
 *     M71 把 `class="ob-skip"` 改名——调用点没了而判据还在，「零枚矮于 44」就是一个没有任何被测
 *         对象的绿（§38 那一课的第三种形状，本批在 K34 的名单、K36 的调用点上各配一根）；
 *     M72 把 `if(localStorage.getItem('tn_onboarded')) return;` 改写——蒙层根本不挂载，
 *         K36 量到的是「没有样本」而不是「够 44」：**取样前置**也是分母；
 *     M73 摘掉 smoke-topbar 里清 tn_onboarded 的那一行——这一条同时红两根锚（A39 与 ⑥ 的恰 1 处），
 *         钉 removeItem 而不是钉 OB_CLEAR 那个名字：改名要绿，行为没了要红；
 *     M74 K36 改名成 K36x（齐备检「缺 K36」必须响，§31 那一课在本批的第三次发作）；
 *     M75／M76 打的是**成双那两根**：`i <= 36` 与 `size >= 36` 各降一档。只抬编号不抬阈值（或反之），
 *         新加的那条判据就没人查它在不在——本批加 K36 时两根都抬过，所以两根都得能红。
 *
 * G01／G02 是**设计内静默**：G01 往 map.css 追加一条 `button.act,button.act.sec{min-height:24px}` 的覆写，
 * §39 的字面量锚一根没动（那两条被锚的规则原样在），区段检也不看 map.css——源码腿必须全绿。
 * 触控高度只有浏览器腿能抓（K01 顶栏内逐个量 rect、K02 扫 40 一族残留、K32 量 computed）。
 * G02 是本批新的一条，形状更刁：把专题页退档的媒体条件 360 抬到 700，规则体一字未改，
 * 锚按整串字面量命中、计数照旧——而 390 档（主流手机宽度）的动作钮会被切成纯图标、
 * 标签永久消失，这件事只有 K33 在 390 档量 .act-label 的高度看得见。
 * 这两条是给「存在性锚守不住形状」留的证据，不是漏跑。
 *
 * 用法: MUT_LOG=tools/out/b33g-mut-verify39.txt node tools/out/mut-verify39.js
 * **不要与别的变异网或像素基线并行**：变异打的就是 smoke-topbar 要量的那几页；
 * 也不要在本网跑着的时候编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁收在单点：tools/mut-lock.js（flag 'wx' 取锁＋认所有 .mut*.lock＋退出释放）。
   源码腿与浏览器腿共用这一枚 .mut39.lock，后起的那张直接 exit 2。 */
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut39.lock');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['design.css', 'map.css', 'travel-map.html', 'topic.html', 'node-manager.html', 'wishlist.html',
  'story.html', 'search.html', 'checklist.html', 'album-edit.html', 'expense.html', 'trip.html',
  'planner.html', 'travel-notes.js', 'me.html', 'index.html', 'tools/smoke-topbar.js', 'README.md', 'tools/verify.js'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); unlock(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上 */
const FP = [
  ['design.css', '.t-row .title{flex:1 1 7em;min-width:7em;'],
  ['design.css', '.ctl button{width:36px!important;height:36px!important;margin:0 auto}'],
  ['travel-map.html', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}'],
  ['node-manager.html', '#infoSheet .is-btn{flex:1;'],
  ['wishlist.html', '<div class="trow-acts">'],
  ['map.css', '.t-row .act{padding:0;width:44px;'],
  ['topic.html', '<span class="act-label">随手记</span>'],
  ['tools/smoke-topbar.js', "ok('K32 "],
  ['tools/smoke-topbar.js', "ok('K33 "],
  ['tools/smoke-topbar.js', "ok('K34 "],
  ['tools/smoke-topbar.js', 'const PN_SEL = '],
  ['design.css', 'body .tn-x{width:44px'],
  ['travel-notes.js', 'document.head.appendChild(s);'],
  ['me.html', '.entry .ic{color:'],
  ['design.css', 'body .ob-skip,body .ob-btn{min-height:44px}'],
  ['index.html', '.ob-btn{padding:0 26px;'],
  ['index.html', "if(localStorage.getItem('tn_onboarded')) return;"],
  ['tools/smoke-topbar.js', "ok('K36 "],
  ['tools/smoke-topbar.js', "localStorage.removeItem('tn_onboarded')"],
  ['tools/verify.js', '§39 顶栏一族与触控口径闸门'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 40) + '」，读数不可信');
    process.exit(2);
  }
});

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
/* 本节自己的红用行前缀认；闸门总红只认终判行里的计数，别拿行计数猜。 */
function pick(out) { return out.split('\n').filter(l => /^FAIL §39 /.test(l)); }
function totalFails(out) {
  const m = out.match(/=== (ALL CHECKS PASSED|FAIL: (\d+) issue\(s\)) ===/);
  if (!m) return null;                       // verify 自己抛异常/语法错＝终判没打出来，读数不可信
  return m[1] === 'ALL CHECKS PASSED' ? 0 : Number(m[2]);
}
const base = verify();
const baseN = totalFails(base);
if (baseN !== 0) {
  console.log('中止：基准 verify.js ' + (baseN === null ? '没打出终判行（闸门自身就是坏的）' : '已有 ' + baseN + ' 条红') + '，先修树再跑变异网');
  console.log(pick(base).join('\n'));
  process.exit(2);
}

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

let red = 0, silent = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token, wantGreen) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let out, lines, n;
  try {
    out = verify();
    lines = pick(out);
    n = totalFails(out);
  } finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  if (n === null) {
    anomalies++;
    console.log('异常  ' + name + '  verify 没打出终判行（变异把闸门自己打崩了？这条没有读数）：' +
      out.replace(/\s+/g, ' ').slice(0, 160));
    return;
  }
  if (wantGreen) {
    if (n === 0) {
      silent++;
      console.log('静默  ' + name + '  → 源码腿 0 红（形状类，只有浏览器腿 K01／K02／K32 量 rect/computed 能抓）');
    } else {
      anomalies++;
      console.log('异常  ' + name + '  本条应「源码腿全绿」，实际总红 ' + n + ' 条，§39 红 ' + lines.length + ' 条：' +
        lines.map(l => l.slice(0, 110)).join(' | '));
    }
    return;
  }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → §39 红 ' + lines.length + ' 条（闸门总红 ' + n + '），指定那条：' +
      hit[0].replace(/^FAIL /, '').slice(0, 150));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮 §39 红 ' + lines.length + ' 条 / 总红 ' + n + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
/* run：edits 是 [[from, to], …]，每一处都必须恰命中 1 次（多命中＝needle 太短，先报错不动树） */
function run(name, file, edits, token) {
  let src = ORIG[file];
  for (const [from, to] of edits) {
    if (from === to) {
      total++; anomalies++;
      console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
      return;
    }
    const F = eol(from, file);
    const n = src.split(F).length - 1;
    if (n !== 1) {
      total++; anomalies++;
      console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 1（源码已漂移或 needle 写错）');
      return;
    }
    src = src.replace(F, () => eol(to, file));
  }
  judge(name, file, src, token);
}
/* runAll：换掉全部命中（本批就是那 5 枚 `class="is-btn ic"` 与 README 里出现两次的登记串） */
function runAll(name, file, from, to, token) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（源码已漂移或 needle 写错）');
    return;
  }
  judge(name, file, src.split(F).join(eol(to, file)), token);
}
function greenCase(name, file, from, to) {
  const src = ORIG[file], F = eol(from, file);
  if (src.split(F).length - 1 !== 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  from 串不是恰 1 处（' + (src.split(F).length - 1) + '），静默样本没打上');
    return;
  }
  judge(name, file, src.replace(F, () => eol(to, file)), null, true);
}

/* ============ ① 尺寸只在 design.css 点名一次：单点那一族（M01–M19） ============ */
run('M01 摘掉 .t-row 的 flex-wrap（动作组整组换行的前置被拆，第二行直接裁掉）', 'design.css',
  [['.t-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}', '.t-row{display:flex;align-items:center;gap:8px}']],
  'flex-wrap 必须在 .t-row');
run('M02 顶栏返回键与 .t-ic 从 44 漂回 40（改前那一族的值）', 'design.css',
  [['.t-row .back,.t-row .t-ic{width:44px;height:44px;border:1px solid var(--color-line);',
    '.t-row .back,.t-row .t-ic{width:40px;height:40px;border:1px solid var(--color-line);']],
  '返回键与 .t-ic 同一条规则');
run('M03 右上角那枚动作钮不贴右（margin-left:auto 改 0＝各页又得自己写一份布局）', 'design.css',
  [['.t-row .t-ic{margin-left:auto}', '.t-row .t-ic{margin-left:0}']],
  '右上角那枚动作钮自己贴右');
run('M04 纯图标钮的 .ti 右距不归零（图标在 44 的圆里偏左）', 'design.css',
  [['.t-row .t-ic .ti{margin-right:0}', '.t-row .t-ic .ti{margin-right:6px}']],
  '.ti 的默认右距');
run('M05 摘掉钮 <a> 化后的 :active 缩放（点了没反应）', 'design.css',
  [['.t-row .back:active,.t-row .t-ic:active{transform:scale(.92)}', '.t-row .back:active,.t-row .t-ic:active{transform:none}']],
  '同一族共用按压反馈');
run('M06 标题退回改前形态 flex:1;min-width:0（328 档压成 clientW 2px，且贪心装箱把 44 的钮单独掉第二行）', 'design.css',
  [['.t-row .title{flex:1 1 7em;min-width:7em;', '.t-row .title{flex:1;min-width:0;']],
  '本批两条腿都在这一行');
run('M07 标题截断只留 overflow:hidden（硬裁成半个字，不是省略号）', 'design.css',
  [['letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', 'letter-spacing:.02em;white-space:nowrap;overflow:hidden}']],
  '截断必须是省略号');
run('M08 .trow-acts 改成 flex:1 1 auto（整组不再整体装箱，一枚孤钮会掉第二行）', 'design.css',
  [['.trow-acts{display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto}',
    '.trow-acts{display:flex;align-items:center;gap:8px;margin-left:auto;flex:1 1 auto}']],
  '动作组的容器');
run('M09 顶栏盒整族改名 .topbar→.tb-head（专打分母自检：改名让上面那族全部 0 命中）', 'design.css',
  [['.topbar{position:sticky;top:0;z-index:100;', '.tb-head{position:sticky;top:0;z-index:100;']],
  '顶栏盒没有写 height');
run('M10 故事页/地点页两个非 .topbar 宿主的返回键漂回 40', 'design.css',
  [['.story-bar .back,.nm-topbar .back{width:44px!important;height:44px!important;',
    '.story-bar .back,.nm-topbar .back{width:40px!important;height:40px!important;']],
  '两个非 .topbar 的顶栏宿主');
run('M11 顶栏动作钮的地板从 44 降到 36（36 是地图浮控件的点名豁免档，不该出现在这里）', 'design.css',
  [['button.act,button.act.sec,button.mine,button.go{min-height:44px}', 'button.act,button.sec,button.mine,button.go{min-height:36px}']],
  '顶栏动作钮的地板');
run('M12 录音钮摘掉 !important（页内那族同为 !important 时又是后加载者赢）', 'design.css',
  [['.sbar .mic{width:44px!important;height:44px!important}', '.sbar .mic{width:44px;height:44px}']],
  '录音钮＝高频');
run('M13 想去清单四枚动作钮降到 34', 'design.css',
  [['.wl-btn{min-height:44px!important}', '.wl-btn{min-height:34px!important}']],
  '想去清单顶栏四枚动作钮');
run('M14 「移除·删除·打开」并族那条把 .tb-open 摘出去（一族拆成两族＝两处各写一遍回来了）', 'design.css',
  [['.wl-remove,.ck-remove,.ech-del,.tb-open{width:44px!important;height:44px!important}',
    '.wl-remove,.ck-remove,.ech-del{width:44px!important;height:44px!important}']],
  '列表/卡片右端那枚');
run('M15 条目钮漂回 36（同因连带红：ZERO39 那条「同文件内自相矛盾」也一起红）', 'design.css',
  [['.nm-item-btn{min-height:44px}', '.nm-item-btn{min-height:36px}']],
  '地点清单条目钮');
run('M16 弹层主操作的地板整条删掉（浏览器腿 K12 会红，但源码侧的出处没了）', 'design.css',
  [['.is-btn{min-height:44px}', '']],
  '弹层主操作（node-manager 详情卡）的地板单点持有');
run('M17 摘掉 .ctl button 的 margin:0 auto（玻璃柱里图标贴左、右侧空一条，实测留白 0/8）', 'design.css',
  [['.ctl button{width:36px!important;height:36px!important;margin:0 auto}',
    '.ctl button{width:36px!important;height:36px!important}']],
  '36px 一族（点名允许低于 44');
run('M18 Leaflet 缩放控件漂回 40（同一族第二处：改前靠页内联写 40 盖掉 design.css）', 'design.css',
  [['.leaflet-control-zoom a,.leaflet-touch .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important}',
    '.leaflet-control-zoom a,.leaflet-touch .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important}']],
  '同一族第二处');
run('M19 行程条上下移/删除降到 36（驾驶场景高频，不在豁免里）', 'design.css',
  [['.tripbar .mv,.tripbar .x{min-width:44px;min-height:44px;', '.tripbar .mv,.tripbar .x{min-width:36px;min-height:36px;']],
  '行程条的上下移/删除');

/* ============ ② 各页持有：travel-map / node-manager / 内容区那几枚（M20–M37） ============ */
run('M20 --tb-h 从 63 改回 56（钮抬到 44 后 56 会压在顶栏上）', 'travel-map.html',
  [['body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 56px)}']],
  '顶栏高度单点');
run('M21 控件组的 top 退回写死 56px（两处只改一处＝变量派生被绕过，同因连带 ZERO39 的 56 族）', 'travel-map.html',
  [['position:absolute;right:12px;top:var(--tb-h);width:44px;', 'position:absolute;right:12px;top:56px;width:44px;']],
  '控件组与图层菜单都读同一个变量');
run('M22 退档阈值 360→700（452 档被切成纯图标，K21 就是这支温度计）', 'travel-map.html',
  [['@media(max-width:360px){', '@media(max-width:700px){']],
  '退档阈值 360 定向');
run('M23 退成纯图标那颗从 44 漂回 40（换图标后够点这件事没了）', 'travel-map.html',
  [['.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}',
    '.t-row .act{padding:0;width:40px;height:40px;border-radius:50%;justify-content:center}']],
  '退成 44×44 圆钮');
run('M24 退档时不收文字标签（96px 装不下，正是改前把标题压到 62px 的那只手）', 'travel-map.html',
  [['.t-row .act .act-label{display:none}', '.t-row .act .act-label{display:inline}']],
  '收掉文字才有标题的可读宽度');
run('M25 本页动作组退回旧容器名 .t-acts（与 .t-ic 只差一个字母，撞名那次差点被同一条 CSS 一起改掉）', 'travel-map.html',
  [['<div class="trow-acts">', '<div class="t-acts">']],
  '本页动作组也进同一个容器');
run('M26 摘掉退纯图标后的 aria-label（收掉文字不等于收掉可访问名，§36 那套口径被这批改坏）', 'travel-map.html',
  [[' title="用当前 GPS 位置随手语音记录" aria-label="随手记"', ' title="用当前 GPS 位置随手语音记录"']],
  '退档后钮的可访问名');
run('M27 缩放控件让位从 66 降到 44（压在顶栏描边上）', 'node-manager.html',
  [['.leaflet-top.leaflet-right{margin-top:calc(env(safe-area-inset-top,0px) + 66px);',
    '.leaflet-top.leaflet-right{margin-top:calc(env(safe-area-inset-top,0px) + 44px);']],
  '缩放控件给顶栏让位');
run('M28 摘掉 .is-acts 的 flex-wrap（nowrap 的标签配上不可换行的容器＝直接裁字）', 'node-manager.html',
  [['#infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}', '#infoSheet .is-acts{display:flex;gap:10px}']],
  '动作组整组可换行');
run('M29 摘掉 .is-btn 的 white-space:nowrap（本批原始症状：61px 的钮把「语音记录」排成 3 行）', 'node-manager.html',
  [['font-family:var(--font-sans);white-space:nowrap}', 'font-family:var(--font-sans)}']],
  'nowrap 把地板抬回整条标签宽');
runAll('M30 五枚带图标钮全退回无 .ic（block 按钮里 .ti 会下沉 5px，枚数与 K15 的口径一起漂）', 'node-manager.html',
  'class="is-btn ic"', 'class="is-btn"',
  '带图标那族恰 5 枚');
run('M31 详情卡容器改名（分母自检：期望 0 那族与规则体抽取都要有存在的宿主）', 'node-manager.html',
  [['id="infoSheet"', 'id="infoSheet2"']],
  '详情卡容器恰一枚');
run('M32 想去清单「移除」钮的尺寸写回页内（同值双写的形状，40 还是 44 不重要）', 'wishlist.html',
  [['.wl-remove{border:0;border-radius:50%;background:transparent;', '.wl-remove{width:40px;height:40px;border:0;border-radius:50%;background:transparent;']],
  '本页这一行只剩皮肤');
run('M33 注释里写回改前形态 `.t-row .title{`（证明 §39 那条「.html 视图不剥注释」的口径是活的）', 'wishlist.html',
  [['标题的下限也在 design.css 那一处（本页曾给顶栏标题写死 min-width:0，',
    '标题的下限也在 design.css 那一处（改前本页写过 .t-row .title{min-width:0}，']],
  '标题下限的写点只许 design.css 一处');
run('M34 换故事下拉从 44 漂回 34（批次 25-B 普查捞出的第四颗：select 曾经整体不在口径里）', 'story.html',
  [['.story-bar select{flex:0 0 auto;max-width:140px;height:44px;', '.story-bar select{flex:0 0 auto;max-width:140px;height:34px;']],
  '批次 25-B 普查补出来的第四颗');
run('M35 录音钮把「同值双写」44×44 加回页内（值对、出处错）', 'search.html',
  [['.sbar .mic{flex:0 0 auto;border:0;', '.sbar .mic{flex:0 0 auto;width:44px;height:44px;border:0;']],
  '只剩皮肤：改前这一行写');
run('M36 票据「打开附件」的缩略图框尺寸写回页内', 'checklist.html',
  [['.tb-open{flex:0 0 auto;border-radius:10px;', '.tb-open{flex:0 0 auto;width:40px;height:40px;border-radius:10px;']],
  '票据「打开附件」的缩略图框同一档');
run('M37 相册章节删除钮漂回 40（抬到 44 的代价是行高 +2px，漂回去没人会提醒）', 'album-edit.html',
  [['.ech-del{display:grid;place-items:center;border-radius:12px;', '.ech-del{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;']],
  '相册章节删除钮只剩皮肤');

/* ============ ③ 内联 style 一族与全站数量对账（M38–M39） ============ */
run('M38 把右上角动作钮退回内联 style 的 40×40（比页内 <style> 更靠后，CSS 全管不住它）', 'expense.html',
  [['<a class="t-ic" href="planner.html" aria-label="行程规划">',
    '<a class="t-ic" style="flex:0 0 auto;width:40px;height:40px;border:0" href="planner.html" aria-label="行程规划">']],
  '内联 style 那一族换成类');
run('M39 第五枚 .t-ic（复制 planner 那枚）：专打全站 html 扫描的累计数量对账', 'planner.html',
  [['<a class="t-ic" href="wishlist.html" aria-label="想去清单">',
    '<a class="t-ic" href="wishlist.html" aria-label="想去清单"><svg class="ti"></svg></a>\n    <a class="t-ic" href="wishlist.html" aria-label="想去清单">']],
  '全站 .t-ic 不是恰 4 枚');

/* ============ ④ 规则体抽取 / 区段检 / 分母（守门的门，M40–M47） ============ */
run('M40 map.css 四处 .t-row .back 之一改名（SKIN39 的分母失守：抽取看不见全部，零尺寸判据就没了依据）', 'map.css',
  [['.t-row .back{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}',
    '.t-row .backx{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}']],
  '分母失守');
run('M41 map.css 加回钉死行高 42px（改前形态：盒高写死会把换行的第二行直接裁掉，界面看不出问题、点也点不到）', 'map.css',
  [['.t-row .back{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}',
    '.t-row{height:42px;align-items:center;display:flex}\n.t-row .back{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}']],
  '行高钉死 42px');
run('M42 node-manager 页内联加回 Leaflet 缩放 40px（同一族在两处长成两种尺寸，靠后加载取胜）', 'node-manager.html',
  [['#infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}',
    '.leaflet-control-zoom a{width:40px;height:40px;line-height:40px}\n  #infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}']],
  '页内联的 40px 靠后加载盖掉');
run('M43 .is-btn 把 min-height:44px 加回页内（值对、出处错：下一次漂到 40 不需要任何人同意）', 'node-manager.html',
  [['#infoSheet .is-btn{flex:1;border-radius:999px;', '#infoSheet .is-btn{flex:1;min-height:44px;border-radius:999px;']],
  '值对、出处错');
run('M44 verify 自己：全站 html 扫描的名单换成空表（分母塌了＝④ 那一族整组恒真）', 'tools/verify.js',
  [["const htmls39 = fs.readdirSync('.').filter(x => /\\.html$/.test(x));", 'const htmls39 = [];']],
  '分母可疑');
run('M45 verify 自己：触控族段里多开一条 36 豁免后门（区段检必须认得「段还是那段、内容被换了」）', 'design.css',
  [['.tripbar .mv,.tripbar .x{min-width:44px;min-height:44px;display:inline-grid;place-items:center}',
    '.nm-close{width:36px;height:36px}\n.tripbar .mv,.tripbar .x{min-width:44px;min-height:44px;display:inline-grid;place-items:center}']],
  '豁免族只许「地图上浮控件」那两条款');
run('M46 verify 自己：把量尺寸的尺子 GEO39 换成永不匹配的正则（12 族「0 条违规」全体恒真，必须被 BADSKIN 反向对照当场打红）', 'tools/verify.js',
  [['const GEO39 = /width\\s*:|height\\s*:/;', 'const GEO39 = /zzzzneverzzz/;']],
  '规则体零尺寸判据的反向对照失效');
run('M47 verify 自己：BADSEG 反向对照的 token 写坏一个字符（区段检的门禁自证）', 'tools/verify.js',
  [["cnt39(BADSEG, '40px') < 1 || cnt39(BADSEG, '36px') !== 3", "cnt39(BADSEG, '400px') < 1 || cnt39(BADSEG, '36px') !== 3"]],
  '触控族段区段检的反向对照失效');

/* ============ ⑤ 锚点表形状与正向对照（守门的门 · 第二批，M48–M51） ============ */
run('M48 A39 的一行少写文件字段（四元组形状不整即红，不许静默解构错位——打红的是守卫自己）', 'tools/verify.js',
  [["    ['design.css', '.t-row .t-ic{margin-left:auto}', 1, '右上角那枚动作钮自己贴右（此前靠页内 flex 布局各写一套）'],",
    "    [ '.t-row .t-ic{margin-left:auto}', 1, '右上角那枚动作钮自己贴右（此前靠页内 flex 布局各写一套）'],"]],
  'A39 有锚点不是');
run('M49 ZERO39 的一行少写正向对照源码字段（那条期望 0 的对照等于没有——同样打红的是守卫自己）', 'tools/verify.js',
  [["      '.sbar .mic{flex:0 0 auto;width:44px;height:44px;border:0;border-radius:50%;}',\n", '']],
  'ZERO39 有一条不是');
run('M50 ZERO39 把 needle 写坏一个字符（needle 对不上真实改前形态＝拿不存在的串证明它不存在，正向对照必须喊「这个 0 不是证据」）', 'tools/verify.js',
  [["    ['wishlist.html', '.wl-remove{width:',", "    ['wishlist.html', '.wl-removeQ{width:',"]],
  '这条期望 0 的正向对照失效');
run('M51 锚点表条数守卫：把阈值抬到当前长度 + 1（守卫自己必须能红，否则「88 条」只是文案）。' +
  '阈值必须比 A39.length 大 1：25-B 把表从 60 长到 64、33-E 长到 82、33-G 长到 88，原先「从 58 抬到 65」' +
  '与后来「从 80 抬到 83」这两版都抬不过新长度，就此打不红——一个只会守旧长度的守卫，锚一加长就自己失效（§34 那一课的第二种形状）', 'tools/verify.js',
  [['if (A39.length < 86)', 'if (A39.length < 89)']],
  '锚点表被削减');

/* ============ ⑥ 浏览器腿在场：改名 / 复制 / 换档 / 摘登记（M52–M56） ============ */
run('M52 smoke-topbar 把 K16 改名成 K16x（齐备检认「id + 空格」：改名后这条判据消失了却仍绿，就是 §31 那一课）', 'tools/smoke-topbar.js',
  [["ok('K16 ", "ok('K16x "]],
  '缺 K16');
run('M53 smoke-topbar 复制一条 K02（改名会连带红齐备检，复制才只喂条数守卫——§34 同一课）', 'tools/smoke-topbar.js',
  [["  ok('K02 顶栏内 40×40 一族零残留（改前 13 页里 11 页命中；这族曾经的错法是 design.css/map.css/页内联/内联 style 各写一遍，谁后加载谁说了算）',\n    fortyAll.length === 0, fortyAll.slice(0, 5).join(' | ') || '0 条');",
    "  ok('K02 顶栏内 40×40 一族零残留（改前 13 页里 11 页命中；这族曾经的错法是 design.css/map.css/页内联/内联 style 各写一遍，谁后加载谁说了算）',\n    fortyAll.length === 0, fortyAll.slice(0, 5).join(' | ') || '0 条');\n  ok('K02b 复制的一条（本条只为证明 §39 的条数守卫有线）',\n    fortyAll.length === 0, 'x');"]],
  '判据条数不是 37');
run('M54 smoke-topbar 把 328×723 真机主档换成 375×812（「真机档已验证」就验在一台不存在的手机上）', 'tools/smoke-topbar.js',
  [['{ width: 328, height: 723 }', '{ width: 375, height: 812 }']],
  '真机主档');
run('M55 smoke-topbar 摘掉 isMobile/hasTouch（触控视口不是 :active 一族与 44 档的口径前提）', 'tools/smoke-topbar.js',
  [['isMobile: true, hasTouch: true', 'isMobile: false, hasTouch: false']],
  '触控视口（不带动点仿真');
runAll('M56 README 抹掉 §39 登记（两处出现一起抹：新闸门不写进 README 就等于没装）', 'README.md',
  '§39', '§3九',
  'README.md 的 verify 清单没提 §39');

/* ============ ⑦ 批次 25-B 专题页那一族：topic.html 不在 13 页分母里，只有这三条锚认它（M57–M60） ============
   这一族的由来：像素基线把 topic 六档打成红，K08 的 barH 检对它失明（topic.html 不在 BAR_PAGES 里），
   所以「顶栏被顶成两行」这个症状当时只有闸门外的探针看得见。修完之后源码腿的三条锚就是它唯一的常驻证据，
   必须逐条打上红，否则等于又装了一盏没人看的灯。 */
run('M57 专题页那两枚动作钮的退档从 44 漂回 40（退档是这份 CSS 里最后写的同特异度规则，漂了没有别人会提醒）', 'map.css',
  [['.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}',
    '.t-row .act{padding:0;width:40px;height:40px;border-radius:50%;justify-content:center}']],
  '专题页那两枚动作钮的 ≤360 退档');
run('M58 专题页把可收的标签摘成裸文本（退档收字靠的是 .act-label；travel-map 那两枚早有，同族却两种形状）', 'topic.html',
  [['</svg><span class="act-label">随手记</span></button>', '</svg></button>']],
  '退档要收字就得有可收的标签');
run('M59 专题页收掉文字顺便把可访问名也摘了（§36 口径：收字不等于收名）', 'topic.html',
  [[' title="查看游记列表" aria-label="游记"', ' title="查看游记列表"']],
  '收掉文字不等于收掉可访问名');
run('M60 smoke-topbar 把本批新加的 K33 改名成 K33x（齐备检的循环上限是不是真走到 33：改名后判据消失了却仍绿，就是 §31 那一课）', 'tools/smoke-topbar.js',
  [["ok('K33 ", "ok('K33x "]],
  '缺 K33');

/* ============ ⑧ 批次 33-E：面板族与 me.html（源码腿单侧有视野的那一族，M61–M67） ============
   这一族的由来：33-B 把随手记面板一族的尺寸从 travel-notes.js 运行时注入的那份 <style> 剥进
   design.css 单点，而 §39 的 FILES39 原本没有这两个文件——**修完那天起就没有一根锚守着它**。
   两腿盲区正好相反（地基读数 tools/out/b33e-probe-fileui.txt、b33e-probe-panel.txt）：
     · 注入串里写不带 body 的尺寸（0-1-0）→ design.css 的 body .tn-x（0-1-1）永远赢 → 画面照旧 44，
       浏览器腿结构性看不见，只有 SKIN39 的「规则体零尺寸」有视野（M62）；
     · 注入串里写带 body 前缀的尺寸（同 0-1-1＋后加载）→ 真覆盖，两腿都有视野（M63 在这张网里
       打的是 ZERO39 那一半，mut-smoke39 的 B 族同时打浏览器那一半）；
     · me.html 同选择器两条尺寸 → 后加载者胜，前面那条整行是死代码，浏览器量到的一直是 40×40，
       K35 只能证明「活着的是哪一条」，不能证明死声明没复活（M64）。
   M65／M66 打的是**剥刀自己**（⑦ 那两条自指定义行锚）：改的是 verify.js 这两行的口径，
   一旦换刀或收掉 .md 那一支，本节所有读数都失去依据，必须由定义行自己喊。
   M67 打 K34 的分母：PN_SEL 改名后脚本照样跑，但「零枚矮于 44」是在一个没有被测对象的页面上绿的。 */
run('M61 design.css 面板关闭钮从 44 漂回 34（改前实测 32/34/36/40 四种；这一族五处落点刚收进单点）', 'design.css',
  [['body .tn-x{width:44px;height:44px;flex:0 0 auto}', 'body .tn-x{width:34px;height:34px;flex:0 0 auto}']],
  '面板关闭钮一族五处落点');
run('M62 travel-notes.js 的注入串里给胶囊钮写回 width:34px（不带 body 前缀＝特异度赢不了 design.css：浏览器腿结构性看不见，这条只有源码腿有视野）', 'travel-notes.js',
  [['.tn-pill{background:rgba(255,255,255,.12);', '.tn-pill{width:34px;background:rgba(255,255,255,.12);']],
  '出现尺寸声明：胶囊钮');
run('M63 注入串里那族选择器加上 body 前缀（同特异度＋后加载＝真覆盖，这一半就不再是死声明了）', 'travel-notes.js',
  [['.tn-tagbar button{flex:0 0 auto;', 'body .tn-tagbar button{flex:0 0 auto;']],
  '里出现「body .tn」');
run('M64 me.html 把被盖死的三条死声明加回 .entry .ic 第一条（同选择器两条尺寸、后加载者胜；画面一字未动，所以只有源码腿看得见）', 'me.html',
  [['.entry .ic{color:var(--color-primary-dark);display:grid;',
    '.entry .ic{width:34px;height:34px;border-radius:10px;background:var(--color-primary-soft);color:var(--color-primary-dark);display:grid;']],
  '里出现「width:34px」');
run('M65 verify.js 自己：flat39 的定义行不再调用共享的字符串感知剥刀（travel-notes.js 注入串里有 108 处游离「斜杠星」，naive 正则从其中一处开盲窗一路吞到下一个「星斜杠」，本节全部读数失去依据）', 'tools/verify.js',
  [['  const flat39 = s => ws39(stripBlockComments(s));',
    "  const flat39 = s => ws39(s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''));"]],
  'flat39 的定义行不再调用共享的字符串感知剥刀');
run('M66 verify.js 自己：view39 不再把 .md 归进「只折叠空白、不剥注释」那一支（README 的登记行里带块注释字面量，被剥掉之后钉在 README 上的锚静默 0 命中——静默的 0 与「写对了」在输出里长得一样）', 'tools/verify.js',
  [['  const view39 = f => /\\.html$|\\.md$/.test(f) ? ws39(rd39(f)) : flat39(rd39(f));',
    '  const view39 = f => /\\.html$/.test(f) ? ws39(rd39(f)) : flat39(rd39(f));']],
  'view39 不再把 .md 归进');
runAll('M67 smoke-topbar 的 PN_SEL 整族改名（脚本照样跑、K34 照样绿，但那是「零枚矮于 44」绿在一张空名单上——§38「取样档位没有被测对象＝假绿」同一个形状）', 'tools/smoke-topbar.js',
  'PN_SEL', 'PANEL_SELS',
  '抽不出 smoke-topbar.js 的 PN_SEL 名单');

/* ============ ⑨ 批次 33-G：首启引导蒙层（第三处「两腿都无视野」的屏，M68–M76） ============
   这一族的靶是**成对**写的，因为盲区本身就是双向的（地基读数 tools/out/b33g-obskip.txt：改前「跳过 ›」60.2×34）：
     · M69 往注入串写回**不带 body 前缀**的尺寸 → design.css 的 body .ob-btn（0-1-1）永远赢 → 画面照旧 44，
       浏览器腿结构性看不见，只有本节的 ZERO39 有视野（与 M62 同一个形状，落在同一族的另一种写法上）；
     · M70 把选择器加上 body 前缀 → 同特异度＋后加载＝真覆盖，两腿都有视野（mut-smoke39 的 B 族同时打它）；
     · M71／M72 打的是**分母与取样前置**：调用点没了、或蒙层压根不挂载，「零枚矮于 44」就是一个没有
       被测对象的页面上的绿（§38 那一课在这一屏的两种形状）；
     · M75／M76 打成双那两根（编号上界与条数阈值）：33-G 加 K36 时两根都抬过，只抬一根等于没抬。 */
run('M68 design.css 那条首启引导的地板单点从 44 漂回 34（改前这一族根本没在任何地方被点名过，全靠 padding 撑）', 'design.css',
  [['body .ob-skip,body .ob-btn{min-height:44px}', 'body .ob-skip,body .ob-btn{min-height:34px}']],
  '首启引导那一屏的地板单点');
run('M69 index.html 的注入串里给 .ob-btn 写回 min-height:44px（值对、出处错；而且它不带 body 前缀、赢不了 design.css——浏览器腿结构性看不见，这条只有源码腿有视野）', 'index.html',
  [['.ob-btn{padding:0 26px;', '.ob-btn{min-height:44px;padding:0 26px;']],
  'index.html 里出现「min-height:44px」');
run('M70 注入串里那族选择器加上 body 前缀（同特异度＋后加载＝真覆盖，这一族里唯一两腿都有视野的写法）', 'index.html',
  [['.ob-skip{position:absolute;', 'body .ob-skip{position:absolute;']],
  'index.html 里出现「body .ob-」');
run('M71 把「跳过 ›」的调用点改名（K36 的分母宿主没了而判据还在：零枚矮于 44 绿在一张没有钮的屏上）', 'index.html',
  [['class="ob-skip"', 'class="obSkipX"']],
  'K36 的分母宿主');
run('M72 把蒙层的挂载前置换成另一个键名（tn_onboarded 这个名字没了，K36 读到的「没有样本」会被当成「够 44」——§38 那一课在这一屏的形状）', 'index.html',
  [["if(localStorage.getItem('tn_onboarded')) return;", "if(localStorage.getItem('tn_ob_done')) return;"]],
  '取样前置');
run('M73 smoke-topbar 摘掉清 tn_onboarded 那一行（K36 靠它把蒙层挂上来：行为没了要红，而 OB_CLEAR 改名字不该红——所以钉 removeItem 不钉名字）', 'tools/smoke-topbar.js',
  [['const OB_CLEAR = () => { try { localStorage.removeItem(\'tn_onboarded\'); } catch (e) {} };',
    'const OB_CLEAR = () => {};']],
  '清 tn_onboarded 的机制不是恰 1 处');
run('M74 smoke-topbar 把 K36 改名成 K36x（齐备检认「id + 空格」：判据消失了却仍绿，就是 §31 那一课的第三次发作）', 'tools/smoke-topbar.js',
  [["ok('K36 ", "ok('K36x "]],
  '缺 K36');
run('M75 smoke-topbar 的齐备检上界降回 i <= 35（只加判据不抬上界，K36 就不在检查范围里）', 'tools/smoke-topbar.js',
  [['i <= 36', 'i <= 35']],
  '浏览器腿齐备检的上界');
run('M76 smoke-topbar 的条数阈值降回 size >= 35（与上一根成双：抬了编号不抬阈值，或反过来，都是改个数字照样绿）', 'tools/smoke-topbar.js',
  [['size >= 36', 'size >= 35']],
  '条数守卫阈值');

/* ============ 设计内静默：只有浏览器腿有视野 ============ */
greenCase('G01 map.css 追加一条 button.act 的 24px 覆写（被锚钉的字面量一根没动、区段检不看 map.css：源码腿必须全绿，只有 K01／K02 量 rect 能抓）', 'map.css',
  '.t-row .back{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}',
  '.t-row .back{background:var(--color-bg-soft);color:var(--color-ink);border:1px solid var(--color-line);border-radius:50%}\nbutton.act,button.act.sec{min-height:24px}');

greenCase('G02 map.css 把专题页退档的媒体条件从 360 抬到 700（锚钉的是那条规则的字面量，不认它的媒体条件；travel-map 的「退档阈值 360 定向」那条锚只盯着自己的页内联）——源码腿必须全绿，只有 K33 量 390 档的 .act-label 是否可见能抓', 'map.css',
  '@media (max-width:360px){', '@media (max-width:700px){');

console.log('=== 变异自测 §39 源码腿: 共 ' + total + ' 条 / 按预期红 ' + red + ' / 设计内静默 ' + silent + ' / 异常 ' + anomalies + ' ===');
process.exit(anomalies ? 1 : 0);
