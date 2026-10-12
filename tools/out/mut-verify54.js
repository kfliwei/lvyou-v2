/* tools/out/mut-verify54.js — verify.js §54「可读带・触控第三写法・物理返回键闸门」变异自测 · 源码腿 + 三条浏览器腿
 *
 * 本批三条线各来自一句用户现场报（2026-10-11/10-12）：
 *   ①「正文被翻页浮条压住」→ story 落点与 scroll-spy 改读同一条「可读带」；
 *   ②「那两枚钮点不着」→ planner 站点行的「移除」「记一笔」抬到 44，并把触控尺寸的第三种写法（内联 style）收掉；
 *   ③「手机返回键一问就把整层丢了」→ 三处带输入框的层各压一条历史，返回先落到层上再走屏上那扇门本来就有的脏检查。
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §54 红**里看见它，并且整跑不绿
 * （红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * §54 的靶子分四类：
 *   ① 产品形状被拆回原样（R01–R33）：落点退回 scrollIntoView／spy 退回整屏比例／带的顶缘丢掉滚动态接缝／
 *      把 328×723 那一档量出来的像素写回代码／钳位摘掉／42 的地板与 28px 左内衬回来／内联 min-height 回来／
 *      mv-del 的例外标记与可达名摘掉／两扇裸关的门改回 m.remove()／监听绑多次／收层不收回历史条目／
 *      压条目整个不压／冒一个没登记的历史键／脏检查名单漏一格与多一格。
 *   ② 守卫自己（S01–S24）：两把共享剥刀各自的定义行、四枚盲区哨兵、A54／ZERO54 四元组形状、
 *      A54 登记了没读的文件、ZERO54 的正向对照失效、四把内置扫描各自的自校准与阈值
 *      （一律打**条件取反／阈值抬高一格／名单少一枚**，不打「摘掉那一支」——干净树上它们本来静默，摘掉不会独红）、
 *      ④ 的编号补零、循环上限、真实最大编号对账、守卫串挪位、一条判据都没数到那一支。
 *   ③ 三条腿与登记（T01–T16）：屏档、tn_onboarded、播种、读数落点、可观测量是 state 不是 length、
 *      入口不在场时那一发的编号、判据改名、三条条数守卫、README 四处登记被抹。
 *   ④ 两条腿的分工样本（U02–U03：源码腿必须全绿，浏览器腿必须红在指名那条）：
 *      U02 「移除」那颗的生成点加一句内联 `style="height:30px"`（③(a) 那把刀只认 min-height）→ T01 红；
 *      U03 syncFormBase 空转（函数、名单、两处调用点全在原处，只是不再把机器填的那两格补进基线）→ B04 红。
 *      原来这一节还有一条 U01（spy 改用卡顶）：实跑两腿都绿——L05 只判「刚落定那一站是不是自己」，而这五篇种子
 *      在这一档屏上恰好还是它自己赢。于是一来把它改判成源码锚（R34，§54 从此钉住取的是卡中心那一点），
 *      二来这一条就是「腿绿不等于有人守」的现场证据，别把它当已覆盖。
 *   为什么必须有 ④：本节的立论是「屏上那一段到底谁能看见」「那一发返回有没有人接」，
 *      源码腿读的是串的在场、计数的相等、函数体的形状，读不到「卡片有没有真被浮条盖住」与
 *      「干净层按返回会不会白问一句」。
 *
 * 登记本网不假装覆盖的盲区两条：
 *   甲）把 A54／ZERO54 表里**整条锚删掉**不会红——§54 没有表长守卫（表长只印在摘要行里、不进退出码），
 *      所以要砍锚得连产品串一起砍（R 类各条覆盖这一支）。基准处仍对账摘要里的「90 条／9 族」，表长一变就中止。
 *   乙）③(a) 那把内联刀**只认 min-height**：U02 就是拿一条 `style="height:30px"` 打的红——
 *      内联的 width/height 那一路源码腿结构性看不见，而本批不能顺手把刀扩到任何尺寸，
 *      planner.js 现场有 7 处合规的内联尺寸（序号徽章 22px、进度条 100%、底部抽屉 max-height:78vh），
 *      扩刀要同时配白名单。这一条按「待点单」处理，写在 §54 头注释与 README 里。
 *
 * 记一条 token 口径：verify.js 印 A54/ZERO54 的红时 needle 只写前 52／48 字，所以 token 一律取
 *   why／reason 里的一段，或取自定义消息的整句片段；本网没有一条 token 跨在 slice 边界上。
 *   期望值类 token（S09/S10/S11/S15/S21/S22）从当场打印的那条红行里抄——§54 这四个阈值本来就是
 *   INL_CAL54／DENOM_MIN54／MVBASE_EXP54／MV44_EXP54／GOOD_EXP54／BACKPAT／CAL_CTL54 单点派生（S12 除外：
 *   它打的是 BACKPAT 那把刀本身），条件与红字同源，抬一档红字就跟着说「≥400」「期望恰 2」，闸门不说谎。
 *
 * 用法:
 *   node tools/out/mut-verify54.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify54.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify54.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b39-mut-verify54.txt node tools/out/mut-verify54.js
 * **不要与别的变异网或像素基线并行**：本网动的是 story.html／planner.html／planner.js／design.css／
 *   node-manager.html／results.js／travel-notes.js／tools/smoke-story-landing.js／tools/smoke-planner-touch.js／
 *   tools/smoke-layer-back.js／tools/verify.js／README.md，与 mut-verify45/46/47/48/49/50/51/52/53 重叠
 *   tools/verify.js 与 README.md；像素基线量的就是同一批屏（叙事屏与排期屏都在 109 态里）。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U 类会重跑三条腿（它们按固定文件名落读数 tools/out/b39-smoke-story-landing.txt、
 *   b39-smoke-planner-touch.txt、b39-smoke-layer-back.txt），所以跑完要在干净树上**三条腿各复跑一次**，
 *   把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：单点模块（tools/mut-lock.js）。认所有 .mut*.lock，不认自己那一个名字。 */
const unlock = require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut54.lock');

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['story.html', 'planner.html', 'planner.js', 'design.css',
  'node-manager.html', 'results.js', 'travel-notes.js',
  'tools/smoke-story-landing.js', 'tools/smoke-planner-touch.js', 'tools/smoke-layer-back.js',
  'tools/verify.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', () => { restore(); });

/* 启动断言：基准源码必须含本批指纹，否则这张网跑在已漂移的树上 */
const FP = [
  ['tools/verify.js', 'const flat54 = s => ws54(stripBlockComments(s));'],
  ['tools/verify.js', 'const LEGS54 = ['],
  ['tools/verify.js', `['tools/smoke-layer-back.js', 'B', 23, "ok('B24'"]`],
  ['tools/verify.js', 'const INL_CAL54 = 1, DENOM_MIN54 = 40, MVBASE_EXP54 = 1, MV44_EXP54 = 2;'],
  ['tools/verify.js', 'const GOOD_EXP54 = 1, BAD_EXP54 = 0;'],
  ['tools/verify.js', 'const CAL_CTL54 = 4;'],
  ['tools/verify.js', 'const REG54 = '],
  ['story.html', 'function focusCard(el){'],
  ['planner.html', '.btn{min-height:44px'],
  ['planner.js', 'class="mv mv-del" aria-label="移除"'],
  ['design.css', '.stop-acts .mv.mv-del{width:44px;height:44px'],
  ['node-manager.html', 'function syncFormBase(id) {'],
  ['results.js', 'function closeItin(force) {'],
  ['travel-notes.js', 'function onPanelPop() {'],
  ['tools/smoke-story-landing.js', "ok('L12'"],
  ['tools/smoke-planner-touch.js', "ok('T15'"],
  ['tools/smoke-layer-back.js', "ok('B24'"],
  ['README.md', '§54'],
];
FP.forEach(([f, n]) => {
  if (ORIG[f].indexOf(n) < 0) {
    console.log('中止：基准源码 ' + f + ' 不含本批指纹「' + n.slice(0, 52) + '」，读数不可信');
    process.exit(2);
  }
});

const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\n/g, EOL(f));

/* ============ 靶子登记表（先全部登记，预检通过才动树） ============ */
const CASES = [];
function t(name, edits, token) { CASES.push({ name, edits, token, kind: 'red' }); }
function tAll(name, file, from, to, token) { CASES.push({ name, edits: [[file, from, to]], token, kind: 'all' }); }
function gBoth(name, edits, leg, want) { CASES.push({ name, edits, want, leg, kind: 'silentB' }); }

/* ---------- ① 产品形状被拆回原样：story.html（可读带） ---------- */
t('R01 落点退回 scrollIntoView 那一版（往整屏正中放，而整屏正中上下各有一条带压着）',
  [['story.html', 'if(el) focusCard(el);', `if(el) el.scrollIntoView({behavior:UI.scrollBehavior(),block:'center'});`]],
  'el.scrollIntoView');
t('R02 scroll-spy 退回整屏比例（它判的那一点与落点算的那一点分家）',
  [['story.html', 'var mid=(bd.top+bd.bottom)/2;', 'var mid=window.innerHeight*0.55;']],
  'var mid=window.innerHeight*0.55;');
t('R03 带的顶缘丢掉滚动态接缝（地图还没让开时那条带被算长一截，落点算的是没让开那一档）',
  [['story.html', 'return {top:Math.max(g.mp-y,0)+g.barH,bottom:g.navTop};', 'return {top:g.mp+g.barH,bottom:g.navTop};']],
  'Math.max(g.mp-y,0)');
t('R04 把 328×723 那一档量出来的地图高写回代码（换一台机器、装了导航栏、字体缩放一档就全错）',
  [['story.html', 'var y=(h>g.navTop-g.barH)?Math.max(g.mp,D-g.barH):', 'var y=(h>g.navTop-g.barH)?Math.max(318,D-g.barH):']],
  '写进了实测像素 318');
t('R05 落点不再问底导航上缘（navTop 是 getBoundingClientRect 现量的，写死一次就错一台；这一发先由 A54 那条两档式子接住，③(d) 的三必读名是同一条的第二重——它按文本判，锚串里本来就带着 g.navTop）',
  [['story.html', 'var y=(h>g.navTop-g.barH)?Math.max(g.mp,D-g.barH):D+h/2-(g.barH+g.navTop)/2;',
    'var y=(h>window.innerHeight-g.barH)?Math.max(g.mp,D-g.barH):D+h/2-(g.barH+g.navTop)/2;']],
  '两档分开：装得下就把卡中心放到带中心');
t('R06 落点不钳在文档两头之内（第一张卡与最后一张卡是同一套代码，不钳就滚出边界）',
  [['story.html', 'window.scrollTo({top:Math.max(0,Math.min(y,document.documentElement.scrollHeight-window.innerHeight)),behavior:UI.scrollBehavior()});',
    'window.scrollTo({top:y,behavior:UI.scrollBehavior()});']],
  '钳在文档两头之内');
t('R07 地图高写死（带顶缘的第二个来源，本批口径是一个像素也不许写进代码；③(d) 的写死像素那一支与 A54 那条地图高的锚同时红）',
  [['story.html', `var mp=document.getElementById('storyMap').offsetHeight;`, 'var mp=318;']],
  '里写进了实测像素 318');

/* ---------- ① 产品形状被拆回原样：planner.html / design.css / planner.js（触控） ---------- */
t('R08 本页那条 .btn 又砍掉 design.css 地板的一截（实测「导航」75×42）',
  [['planner.html', '.btn{min-height:44px;padding:0 18px;border-radius:13px', '.btn{min-height:42px;padding:0 18px;border-radius:13px']],
  '.btn{min-height:42px');
t('R09 28px 左内衬回来（出行态那一行改前已挤出盒外 20px）',
  [['planner.html', '.stop-acts{display:flex;align-items:center;gap:6px}', '.stop-acts{display:flex;align-items:center;gap:8px;padding-left:28px}']],
  'gap:8px;padding-left:28px}');
t('R10 「记一笔」回到 28 高，且尺寸第二次写进页内 <style>（第二种写法晚加载同特异度就赢）',
  [['planner.html', '.stop-acts .btn.mini{font-size:var(--fs-2)}', '.stop-acts .btn.mini{min-height:28px;padding:0 10px;font-size:var(--fs-2)}']],
  'min-height:28px;padding:0 10px');
t('R11 可逆轻操作那一档被顺手整族抬到 44（口径是「破坏性/高频 ≥44」，上移/下移/锁定留 30）',
  [['planner.html', '.mv{width:30px;height:30px;border:1px', '.mv{width:44px;height:44px;border:1px']],
  '的 30 基础档读到 0');
t('R12 开销行那颗删除的既有例外被合并回 30（例外少了＝新的破坏性钮藏进 30 那一档没人登记）',
  [['planner.html', '.exrows .ex .mv{width:44px;height:44px;flex:0 0 auto}', '.exrows .ex .mv{width:30px;height:30px;flex:0 0 auto}']],
  '抬到 44 的例外现读 1');
t('R13 「移除这一站」的 44 声明退化（尺寸只许从 design.css 读一处）',
  [['design.css', '.stop-acts .mv.mv-del{width:44px;height:44px;display:inline-grid;place-items:center}',
    '.stop-acts .mv.mv-del{width:30px;height:30px;display:inline-grid;place-items:center}']],
  '尺寸只从这里读一处');
t('R14 design.css 那条「记一笔」的高度退化到 34（低于 44 地板，腿量得出来而锚只认整串）',
  [['design.css', '.stop-acts .btn.mini{min-height:44px;padding:0 6px}', '.stop-acts .btn.mini{min-height:34px;padding:0 6px}']],
  '那条 min-height:44px 的声明不在了');
t('R15 生成点丢掉 mv-del 这个例外标记（那颗破坏性钮跟着上移/下移留在 30，design.css 那条声明成死规则）',
  [['planner.js', `class="mv mv-del" aria-label="移除"`, `class="mv" aria-label="移除"`]],
  '没有 mv-del 这个例外标记');
t('R16 内联 style 里的 min-height 回来（触控尺寸的第三种写法，CSS 管不住它）',
  [['planner.js', `style="padding:0 12px;font-size:var(--fs-3)" onclick="window.plannerNavDay(`,
    `style="min-height:30px;padding:0 12px;font-size:var(--fs-3)" onclick="window.plannerNavDay(`]],
  'min-height:30px');
t('R17 行程清单里那颗纯图标删除钮又只剩一枚 ✕（破坏性操作没有可达名，读屏念得出「按钮」念不出删什么）',
  [['planner.js', `style="padding:0 10px;font-size:var(--fs-3);color:var(--color-muted)" aria-label="删除行程" onclick=`,
    `style="padding:0 10px;font-size:var(--fs-3);color:var(--color-muted)" onclick=`]],
  '那颗纯图标删除钮必须有可达名');

/* ---------- ① 产品形状被拆回原样：三处裸关层 ---------- */
t('R18 屏上那扇门回到裸关（一句不问把刚填的名称、地址、封面一起丢掉）',
  [['node-manager.html', `m.querySelector('#nmCancel').onclick = function () { closeForm(); };`,
    `m.querySelector('#nmCancel').onclick = function () { m.remove(); };`]],
  '屏上那扇门回到裸关');
t('R19 遮罩那一扇改回裸关（两扇门必须走同一条脏检查）',
  [['node-manager.html', `m.onclick = function (e) { if (e.target === m) closeForm(); };`,
    `m.onclick = function (e) { if (e.target === m) m.remove(); };`]],
  '点遮罩那一扇同上');
t('R20 开层时再多绑一个不认旗的接收者（开合十次叠十个，一发返回问十遍；这一发只许 ③(b) 的配对计数红——那条守卫式子本身没动，A54 的锚照样 1 处）',
  [['node-manager.html', `if (!formPopBound) { formPopBound = true; addEventListener('popstate', onFormPop); }`,
    `if (!formPopBound) { formPopBound = true; addEventListener('popstate', onFormPop); }
    addEventListener('popstate', onFormPop);`]],
  'popstate 监听绑了 2 次');
t('R21 收了层却不收回历史条目（用户下一次按返回是在替一个看不见的前后坑背债）',
  [['node-manager.html', 'if (c && c.pushed) { try { history.back(); } catch (e) {} }', 'if (c && c.pushed) { }']],
  '而「收层同时收条目」只读到');
t('R22 开层不再压条目（新开这一页时后面一个文档都没有＝一发返回直接退出应用；③(b) 的穷举看不见「有没有人真的去压」）',
  [['node-manager.html', `if (!formPopBound) { formPopBound = true; addEventListener('popstate', onFormPop); }
    pushFormEntry();`, `if (!formPopBound) { formPopBound = true; addEventListener('popstate', onFormPop); }
    /* 这一版不压条目 */`]],
  'pushFormEntry();」实得 1，期望 2');
t('R23 冒出一个没登记的历史条目键（新增这一层要一起登记并照本节形状写）',
  [['node-manager.html', 'function syncFormBase(id) {', 'function syncFormBase(id) {\n    if (0) history.pushState({ nmAiGhostKey: 1 }, "");']],
  '没登记的历史条目键');
t('R24 脏检查名单漏一格（在「地址」那一格打的字一句不问就没＝只守了半个层）',
  [['node-manager.html', `var FORM_FIELDS = ['nmName', 'nmCity', 'nmAddr', 'nmCat', 'nmTags', 'nmElev', 'nmDesc'];`,
    `var FORM_FIELDS = ['nmName', 'nmCity', 'nmCat', 'nmTags', 'nmElev', 'nmDesc'];`]],
  '不在脏检查名单上');
t('R25 名单里有一格框不在场（框被删了而读数还留着，判脏永远脏、每关一次白拦一道）',
  [['node-manager.html', `'nmCat', 'nmTags', 'nmElev'`, `'nmCat', 'nmTagsGhost', 'nmElev`]],
  '的名单里有框不在场');
t('R26 路书层那扇门改回裸 remove（这一层丢掉的是偏好那句 + 已经生成的那一版，再要一次得再花一次 AI 调用）',
  [['results.js', `d.querySelector('#ix').onclick = function () { closeItin(); };`,
    `d.querySelector('#ix').onclick = function () { d.remove(); };`]],
  '而这一层丢掉的是偏好那句');
t('R27 路书层的遮罩改回裸 remove',
  [['results.js', `d.onclick = function (e) { if (e.target === d) closeItin(); };`,
    `d.onclick = function (e) { if (e.target === d) d.remove(); };`]],
  '遮罩那一扇同上');
t('R28 已经问出口了还叠第二层确认框（连点两下返回＝两张确认卡压在一起）',
  [['results.js', `if (document.querySelector('.ui-modal-mask')) return;`, `if (false) return;`]],
  '连点两下返回不许叠第二层确认框');
t('R29 路书层再多绑一个不认旗的接收者（同 R20，另一条腿）',
  [['results.js', `if (!itinPopBound) { itinPopBound = true; addEventListener('popstate', onItinPop); }`,
    `if (!itinPopBound) { itinPopBound = true; addEventListener('popstate', onItinPop); }
    addEventListener('popstate', onItinPop);`]],
  'popstate 监听绑了 2 次');
t('R30 panelPushed 不再打头判（关面板的 hide 走 UI.vt 要等一帧，popstate 早于那一帧，同一发返回被问第二遍）',
  [['travel-notes.js', `if (!panelPushed || !ui || ui.panel.style.display !== 'flex') return;`,
    `if (!ui || ui.panel.style.display !== 'flex') return;`]],
  'panelPushed 不再是第一判');
t('R31 面板把编辑屏那一发抢回来（批次 37 那一半被子层吃掉：编辑屏还开着，返回先问了面板）',
  [['travel-notes.js', `if (editCtx && document.querySelector('.tn-editpage')) return;`, `if (false) return;`]],
  '编辑屏压在面板之上');
t('R32 关面板时不收自己压的那条（下一次返回是在替一个看不见的前后坑背债）',
  [['travel-notes.js', `if (panelPushed) { panelPushed = false; try { history.back(); } catch (e) {} }`,
    `if (panelPushed) { panelPushed = false; }`]],
  '而「收层同时收条目」只读到');
t('R33 面板再多绑一个不认旗的接收者（同 R20/R29，第三处）',
  [['travel-notes.js', `if (!panelPopBound) { panelPopBound = true; addEventListener('popstate', onPanelPop); }`,
    `if (!panelPopBound) { panelPopBound = true; addEventListener('popstate', onPanelPop); }
    addEventListener('popstate', onPanelPop);`]],
  'popstate 监听绑了 3 次');

/* ---------- ② 守卫自己：tools/verify.js 里的 §54 ---------- */
t('S01 flat54 的定义行不再调用那把共享剥刀（注释里原样抄着改前那几句，期望 0 会当场变哑）',
  [['tools/verify.js', 'const flat54 = s => ws54(stripBlockComments(s));', 'const flat54 = s => ws54(s);']],
  'flat54 定义行没走那把共享剥刀');
t('S02 view54 的定义行退回「文档也剥注释」那一支（README 登记本批时要写旧写法，文档侧的锚当场读 0）',
  [['tools/verify.js', 'const view54 = f => /\\.md$/.test(f) ? ws54(rd54(f)) : flat54(rd54(f));', 'const view54 = f => flat54(rd54(f));']],
  'view54 的定义行退回');
t('S03 四枚盲区哨兵里的一枚改成读不到的串（这一带又变回盲窗而没人报）',
  [['tools/verify.js', `['story.html', 'function focusCard(el){']`, `['story.html', 'function focusCardGhost(el){']`]],
  '盲区哨兵');
t('S04 A54 有一条少写期望次数字段（四元组形状不整会解构错位，这条锚等于没跑）',
  [['tools/verify.js', `['design.css', '.stop-acts .btn.mini{min-height:44px;padding:0 6px}', 1,`,
    `['design.css', '.stop-acts .btn.mini{min-height:44px;padding:0 6px}',`]],
  'A54 有一条不是「[文件, 串, 期望次数, 原因]」四元组');
t('S05 ZERO54 有一条少写正向对照字段（那条期望 0 的对照等于没有）',
  [['tools/verify.js', `['node-manager.html', "#nmCancel').onclick = function () { m.remove(); }", "m.querySelector('#nmCancel').onclick = function () { m.remove(); };",`,
    `['node-manager.html', "#nmCancel').onclick = function () { m.remove(); }",`]],
  'ZERO54 有一条不是「[文件, 串, 正向对照源码, 原因]」四元组');
t('S06 ZERO54 的正向对照改成不含 needle（上面那个 0 就不是证据）',
  [['tools/verify.js', `['story.html', 'var mid=window.innerHeight*0.55;', 'var mid=window.innerHeight*0.55;',`,
    `['story.html', 'var mid=window.innerHeight*0.55;', 'var mid=window.innerHeight*0.6;',`]],
  '这条期望 0 的正向对照失效');
t('S07 A54 登记了 §54 没读的文件（锚住在空气上，永远读不到也永远不红）',
  [['tools/verify.js', `['story.html', 'function geo(){', 1,`, `['story.htmGhost', 'function geo(){', 1,`]],
  '登记了 §54 没读的文件');
t('S08 内联尺寸那把刀改名（喂改前那一行读不到 1，刀一瞎下面那个 0 就是空判据）',
  [['tools/verify.js', `/style="[^"]*min-height[^"]*"/g`, `/style="[^"]*min-wid[^"]*"/g`]],
  '内联尺寸那把刀自校准失准');
t('S09 ③(a) 的分母下界抬到 400（现场 72 处内联 style，红字要跟着说 ≥400 才算同源）',
  [['tools/verify.js', 'const INL_CAL54 = 1, DENOM_MIN54 = 40,', 'const INL_CAL54 = 1, DENOM_MIN54 = 400,']],
  '期望 ≥400 当分母');
t('S10 ③(a) 的 .mv 基础档期望抬到 2（一处声明改成两处才算过）',
  [['tools/verify.js', 'MVBASE_EXP54 = 1, MV44_EXP54 = 2;', 'MVBASE_EXP54 = 2, MV44_EXP54 = 2;']],
  '期望恰 2');
t('S11 ③(a) 的 44 例外期望抬到 3（多一处「有破坏性钮藏进 30」的登记位就当合规；token 取「期望 3」＝条件与红字同源那个证据）',
  [['tools/verify.js', 'MV44_EXP54 = 2;', 'MV44_EXP54 = 3;']],
  '期望 3');
t('S12 ③(b) 的收条目模式打歪一个字符（合规串读不到，把「摘层不收回历史」当成合规）',
  [['tools/verify.js', `const BACKPAT = 'history.back(); } catch (e) {} }';`, `const BACKPAT = 'history.back(); } catch (e) {} ]';`]],
  '收条目那把刀自校准失准');
t('S13 ③(b) 登记表少登一行（面板那一层的返回键守卫整个没了也无人报）',
  [['tools/verify.js', `['travel-notes.js', 'tnPanel'], ['travel-notes.js', 'tnEdit']];`, `['travel-notes.js', 'tnEdit']];`]],
  '没登记的历史条目键');
t('S14 控件那把刀少认一种标签（合成样本只数到 3，名单对账就是空判据）',
  [['tools/verify.js', `/<(?:input|textarea|select)\\b([^>]*)>/gi`, `/<(?:input|textarea)\\b([^>]*)>/gi`]],
  '控件那把刀自校准失准');
t('S15 ③(c) 把 type=file 那一格豁免摘掉（选文件那种框由它自己的 onchange 改状态，本就不该进名单；红字要指名那一格）',
  [['tools/verify.js', `.filter(c => c.type !== 'file');`, `.filter(c => c.type !== 'ghost');`]],
  '不在脏检查名单上');
t('S16 ③(c) 空分母那一支取反（这一层压根没读到框时不再当场失明）',
  [['tools/verify.js', 'if (!ctls.length) F54(', 'if (ctls.length) F54(']],
  '没读到任何输入框');
t('S17 ③(d) 写死像素的名单少一枚（557 不在名单里，浮条带顶写回代码就没人管）',
  [['tools/verify.js', '/\\b(318|494|176|557|619|639|709|917|1162|1406|1650|1786)\\b/', '/\\b(318|494|176|619|639|709|917|1162|1406|1650|1786)\\b/']],
  '写死像素那把刀自校准失准');
t('S18 ③(d) 的 focusCard 必读名加一枚不存在的（红字要说的是这一枚，不是那三个）',
  [['tools/verify.js', `['g.mp', 'g.barH', 'g.navTop'].forEach`, `['g.mp', 'g.barH', 'g.navTop', 'g.ghostH'].forEach`]],
  'focusCard 没读 g.ghostH');
t('S19 ③(d) 的 spy「读 bandAt」那一支挪成不存在的名字（这一支换目标，摘掉它也没人报）',
  [['tools/verify.js', `if (spy.indexOf('bandAt(') < 0 || spy.indexOf('bd.top') < 0)`, `if (spy.indexOf('bandAtGhost(') < 0 || spy.indexOf('bd.top') < 0)`]],
  '不再读 bandAt 的带中心');
t('S20 ③(d) 的 spy「不许碰整屏高度」那一支取反（干净树上它本来静默，取反才看得出这一支是活的）',
  [['tools/verify.js', `if (spy.indexOf('window.innerHeight') >= 0)`, `if (spy.indexOf('window.innerHeight') < 0)`]],
  '又拿整屏高度当尺子');
t('S21 ④ 齐备检给 story-landing 登记的循环上限收窄一格（L11 从此没人守，而且它自己永远不会红）',
  [['tools/verify.js', `['tools/smoke-story-landing.js', 'L', 11,`, `['tools/smoke-story-landing.js', 'L', 10,`]],
  '登记的循环上限是 10');
t('S22 ④ 上限与真实最大编号的对账挪成「等于编号本身」（少守一条判据却自称对过账）',
  [['tools/verify.js', 'if (last !== MAXN - 1) F54(', 'if (last !== MAXN) F54(']],
  '真实最大编号是');
t('S23 ④ 条数守卫的查找串挪成不存在的编号（守卫那一支换目标）',
  [['tools/verify.js', `"ok('L12'"]`, `"ok('L13'"]`]],
  '少了最后那条条数守卫');
t('S24 ④ 齐备检的编号补零分支去掉（L00–L09 那十条从此按 ok(\'L0 找，一条也数不到）',
  [['tools/verify.js', `        const lab = "ok('" + pre + (i < 10 ? '0' : '') + i + "'";
        if (cnt54(S, lab) !== 1) F54(`, `        const lab = "ok('" + pre + i + "'";
        if (cnt54(S, lab) !== 1) F54(`]],
  '这条判据不是恰 1 处');
t('S25 ④「一条判据都没数到」那一支取反（这条腿形状变了也不再当场失明）',
  [['tools/verify.js', 'if (!LAB.length) F54(', 'if (LAB.length) F54(']],
  '一条 ok() 判据都没数到');

/* ---------- ③ 三条腿的脚手架与登记 ---------- */
t('T01 story-landing 屏档退回 452×995（量的不是用户那块屏，带高与浮条位置全变）',
  [['tools/smoke-story-landing.js', 'const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '量的是用户那块屏');
t('T02 story-landing 不打 tn_onboarded 标记（首启蒙层 z9990 吃掉真鼠标点击，症状酷似「落点没收尾」）',
  [['tools/smoke-story-landing.js', `localStorage.setItem('tn_onboarded', '1');`, `localStorage.setItem('tn_onboarded_off', '1');`]],
  '首启蒙层会吃掉真鼠标点击');
t('T03 story-landing 不再确认产品那把尺子在场（产品改了名字，腿会抱着自己的 DOM 读数自说自话）',
  [['tools/smoke-story-landing.js', 'if (!(window.geo && window.bandAt)) return null;', 'if (false) return null;']],
  '腿先确认产品的尺子在场');
t('T04 story-landing 的 prod 读数写死 -1（L06 那条「两边同数」从此拿不到产品那一侧）',
  [['tools/smoke-story-landing.js', 'prod: window.bandAt ? Math.round(bandAt(window.scrollY).top) : -1', 'prod: -1']],
  '与独立 DOM 读数并排对账');
t('T05 story-landing 条数守卫阈值挪低（判据少 10 条也算「跑完了」：中途抛了＝后面一条没执行）',
  [['tools/smoke-story-landing.js', 'total >= 12', 'total >= 2']],
  'total >= 12');
t('T06 planner-touch 不播种行程清单（这一段测的是刚改的两枚钮，没播种就没有被测对象＝假绿）',
  [['tools/smoke-planner-touch.js', `localStorage.setItem('tn_trips'`, `localStorage.setItem('tn_tripsGhost'`]],
  '行程清单那一档要在独立 context 里自己播种');
t('T07 planner-touch 的清单行读数落点改打不存在的类（清单两枚钮的实测永远是空集）',
  [['tools/smoke-planner-touch.js', `document.querySelectorAll('#tripsHomeList .cand')`, `document.querySelectorAll('#tripsHomeList .candGhost')`]],
  '清单行的读数落点');
t('T08 planner-touch 条数守卫阈值挪低（同上）',
  [['tools/smoke-planner-touch.js', 'total >= 15', 'total >= 2']],
  'total >= 15');
t('T09 layer-back 的可观测量改名（可观测量是 history.state，不是 history.length：压一条再收一条 length 全程不动）',
  [['tools/smoke-layer-back.js', 'window.histState = function ()', 'window.histStateGhost = function ()']],
  '可观测量是 history.state');
t('T10 layer-back 的 X 层入口不在场时那一发红挪了编号（齐备检按字面 ok(\'B00 数，改名＝这一条从证据链上消失）',
  [['tools/smoke-layer-back.js', `first: 'B00'`, `first: 'B0X'`]],
  '入口不在场时那一发红');
t('T11 layer-back 判据 B18 被改名（「同一发返回只许问一遍」这一条没人守了）',
  [['tools/smoke-layer-back.js', `ok('B18', `, `ok('B18b', `]],
  'B18 这条判据不是恰 1 处');
t('T12 layer-back 条数守卫阈值挪低（同上，24 条前置判据齐备这一条不许退）',
  [['tools/smoke-layer-back.js', 'total >= 24', 'total >= 2']],
  'total >= 24');
tAll('T13 README 抹掉 §54 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§54', '§5Y', '没提 §54');
tAll('T14 README 抹掉可读带这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-story-landing', 'smoke-story-landinX', '没登记 tools/smoke-story-landing.js');
tAll('T15 README 抹掉触控这条腿的登记（同上）', 'README.md', 'smoke-planner-touch', 'smoke-planner-toucnX', '没登记 tools/smoke-planner-touch.js');
tAll('T16 README 抹掉返回键这条腿的登记（同上）', 'README.md', 'smoke-layer-back', 'smoke-layer-bacX', '没登记 tools/smoke-layer-back.js');

/* ---------- ④ 三条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
t('R34 scroll-spy 判「最近」用的是卡顶而不是卡中心（这一条原本是当分工样本写的 U01：期望浏览器腿 L05 红，实跑两腿都绿——328×723 这五篇种子里那一发恰好还是自己赢，L05 结构上量不到这一点。改判成源码锚，锚的就是这一行本身）',
  [['story.html', 'var d=Math.abs((r.top+r.height/2)-mid);', 'var d=Math.abs(r.top-mid);']],
  '「谁离带中心最近」取的是卡中心那一点');
gBoth('U02 「移除」那颗的生成点加一句内联 style="height:30px"（③(a) 那把刀只认 min-height；登记在头的盲区乙）——期望红在 T01',
  [['planner.js', `'<button class="mv mv-del" aria-label="移除" onclick=`, `'<button class="mv mv-del" aria-label="移除" style="height:30px" onclick=`]], 'T', 'T01');
gBoth('U03 syncFormBase 空转（函数、名单、两处调用点全在原处，只是不再把机器异步填的那两格补进基线）——期望红在 B04',
  [['node-manager.html', 'function syncFormBase(id) {\n    if (!formCtx) return;', 'function syncFormBase(id) {\n    if (1) return;']], 'B', 'B04');

/* ============ 预检：全部 from 串必须在基准树里命中应有的次数，且不许是恒等操作 ============ */
function preflight() {
  let bad = 0;
  CASES.forEach(c => {
    if (!c.edits || !c.edits.length) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：没有 edits'); bad++; return; }
    c.edits.forEach(ed => {
      const f = ed[0], from = ed[1], to = ed[2];
      if (typeof from !== 'string' || typeof to !== 'string') {
        console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 的 from/to 不是串（' + typeof from + '/' + typeof to + '）');
        bad++; return;
      }
      if (from === to) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：from 与 to 相同（恒等变异，打不红）'); bad++; return; }
      if (ORIG[f] === undefined) { console.log('预检 FAIL ' + c.name.slice(0, 28) + '：文件 ' + f + ' 不在快照里'); bad++; return; }
      const src = eol(from, f);
      const hits = ORIG[f].split(src).length - 1;
      if (c.kind === 'all') { if (!hits) { console.log('预检 FAIL ' + c.name.slice(0, 28) + ' 在 ' + f + ' 一次都没命中（抹登记那一族要的是「全部出现」）'); bad++; } }
      else if (hits !== 1) {
        console.log('预检 FAIL ' + c.name.slice(0, 34) + ' 在 ' + f + ' 命中 ' + hits + ' 次（要恰 1 次）：「' + from.slice(0, 46) + '」');
        bad++;
      }
    });
  });
  return bad;
}
const PBF = preflight();
console.log('=== mut-verify54 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['story.html',
    '  var 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：源码腿与三条浏览器腿都得先是绿的，否则后面全是空判 ============ */
function tail2(e) { return '\nTHROW ' + String((e && e.message) || e).slice(0, 200) + '\nSTDERR ' + String((e && e.stderr) || '').split('\n').slice(-6).join('\n'); }
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
function runLeg(script) {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
const LEGS = {
  L: { script: 'tools/smoke-story-landing.js', pre: 'L' },
  T: { script: 'tools/smoke-planner-touch.js', pre: 'T' },
  B: { script: 'tools/smoke-layer-back.js', pre: 'B' },
};
const S54 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §54') === 0);
const LEGRED = (o, pre) => String(o).split('\n').filter(l => new RegExp('^FAIL  ' + pre + '\\d\\d\\b').test(l));
const LEGPASS = (o, pre) => String(o).split('\n').filter(l => l.indexOf('PASS  ' + pre) >= 0).length;
const why = r => String(r.out).split('\n').filter(l => l.indexOf('THROW') >= 0 || l.indexOf('STDERR') >= 0).join(' | ') || '(没抓到 THROW 行)';

const vbase = runVerify(), f0 = S54(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §54 有 ' + f0.length + ' 条红；整跑' + (vbase.green ? '绿（那就是 §54 自己红了）' : '不绿，原因：' + why(vbase)) + '\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§54 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM54 = String(vbase.out).split('\n').filter(l => l.indexOf('可读带・触控第三写法・物理返回键闸门:') === 0)[0] || '';
const LEN54 = [(SUM54.match(/闸门: (\d+) 条代码锚点/) || [])[1], (SUM54.match(/\+ (\d+) 族期望 0/) || [])[1]];
if (LEN54.join('/') !== '90/9') { console.log('中止：基准摘要里的表长是 ' + LEN54.join('/') + '，而本网登记的是 A54 90／ZERO54 9——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A54 表长 ' + LEN54[0] + '／ZERO54 表长 ' + LEN54[1] + '，与本网登记一致）');

Object.keys(LEGS).forEach(k => {
  const g = LEGS[k], r = runLeg(g.script), red = LEGRED(r.out, g.pre);
  if (red.length || !r.green) {
    console.log('中止：基准 ' + g.script + ' 有 ' + red.length + ' 条红；整跑' + (r.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(r)));
    console.log((red.length ? red.slice(0, 4).join('\n') : String(r.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
    process.exit(2);
  }
  console.log('基准 ' + g.script + ' 判据全绿 ✓（' + LEGPASS(r.out, g.pre) + ' 条）');
});

/* ============ 逐条打靶 ============ */
const ONLY = (process.env.MUT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
let okRed = 0, okSilent = 0, weird = 0, skipped = 0;
CASES.forEach(c => {
  if (ONLY.length && !ONLY.some(k => c.name.indexOf(k) === 0)) { skipped++; return; }
  try {
    c.edits.forEach(ed => {
      const f = ed[0], src = eol(ed[1], f), tgt = eol(ed[2], f);
      const p = path.join(ROOT, f);
      let text = fs.readFileSync(p, 'utf8');
      if (c.kind === 'all') text = text.split(src).join(tgt);
      else {
        if (text.split(src).length - 1 !== 1) throw new Error('运行时命中数变了：' + f);
        text = text.split(src).join(tgt);
      }
      fs.writeFileSync(p, text);
    });
  } catch (e) {
    weird++; console.log('异常 ' + c.name.slice(0, 40) + '  → 打靶本身失败：' + e.message); restore(); return;
  }
  const vr = runVerify();
  const reds = S54(vr.out);
  if (c.kind === 'silentB') {
    const g = LEGS[c.leg], sm = runLeg(g.script), dd = LEGRED(sm.out, g.pre);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，' + g.script + ' 红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §54 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify54: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过三条腿，它们按固定文件名落读数 tools/out/b39-smoke-story-landing.txt、b39-smoke-planner-touch.txt、b39-smoke-layer-back.txt；跑完要在干净树上各复跑一次把读数盖回去。');
unlock();
process.exit(weird ? 1 : 0);
