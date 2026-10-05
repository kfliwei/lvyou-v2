/* mut-usable.js — 批次 13「地图可用视口」变异自测（verify.js §24 + tools/smoke-usable.js）
 *
 * 用法（浏览器腿要 puppeteer-core）：
 *   NODE_PATH=F:/MyAi/trace/lvyou-v2/tools/node_modules node tools/out/mut-usable.js
 *   只想跑源码腿（快，~30s）：加 SKIP_SMOKE=1
 *
 * 纪律（沿用 mut-verify19.js / mut-avoid-e.js）：
 *   · 每条变异显式登记 gate：'verify' | 'smoke' | 'both' | observe。归属是测出来的，不是许愿的。
 *   · verify 腿：exit≠0，「边缘点闸门 FAIL」行里命中 exp，且没有别的闸门红。
 *   · smoke 腿：want 的 U 标号必须红，reds − want 必须落在 allow（同因连带）里，否则算噪声。
 *     gate:'smoke' 的条目额外断言 verify.js 仍绿——那才是「源码锚看不见这条退化」的证据。
 *   · 每条跑完立刻写回原始字节（不用 git checkout），最后逐文件字节比对；还原后 verify.js 必须回绿。
 *   · 变异锚点先断命中次数，不符就 ABORT——防止锚点漂了却得出「这条闸是死的」的错误结论。
 *   · CRLF 混用：topic-common.js/node-lod.js/map.css/verify.js/README/方案文档 是 CRLF，
 *     tools/smoke-usable.js 是 LF。全部读成 LF 工作串、写回时按各自行尾换算，所以跨行锚也敢用。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const G24 = '边缘点闸门 FAIL';
const VF = 'tools/verify.js';
const SM = 'tools/smoke-usable.js';
const DOC = '改进实施方案与验收标准.md';
const FILES = ['topic-common.js', 'node-lod.js', 'map.css', VF, SM, 'README.md', DOC];

const B = {};   /* f -> {raw, crlf, base} */
FILES.forEach(f => {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const crlf = raw.indexOf('\r\n') >= 0;
  B[f] = { raw: raw, crlf: crlf, base: crlf ? raw.replace(/\r\n/g, '\n') : raw };
});
const conv = (f, s) => B[f].crlf ? s.replace(/\n/g, '\r\n') : s;
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), conv(f, s), 'utf8');
const reset = f => write(f, B[f].base);
const resetAll = () => FILES.forEach(reset);

function runVerify() {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, VF)], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, fails: [] };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    return { code: e.status === undefined ? -1 : e.status,
      fails: out.split(/\r?\n/).filter(l => l.indexOf('闸门 FAIL:') >= 0) };
  }
}

let port = parseInt(process.env.SMOKE_PORT || '8181', 10);
function runSmoke() {
  port++;
  const r = spawnSync(process.execPath, [path.join(ROOT, SM)], {
    cwd: ROOT, encoding: 'utf8', timeout: 300000,
    env: Object.assign({}, process.env, { PORT: String(port), NODE_PATH: path.join(ROOT, 'tools', 'node_modules') })
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = {};
  for (const m of out.matchAll(/^(PASS|FAIL) (U\d+)[^\r\n]*/gm)) {
    if (!lines[m[2]]) lines[m[2]] = [];
    lines[m[2]].push(m[0]);
  }
  const red = Object.keys(lines).filter(k => lines[k].some(l => l.indexOf('FAIL') === 0));
  return { code: r.status, red: red, lines: lines, out: out };
}

const TPC = 'topic-common.js', NLOD = 'node-lod.js', CSS = 'map.css', RD = 'README.md';

const MUTS = [
  /* ============ ① 胶囊居中（map.css 那一条 translate 是本批主修复的第①条根因） ============ */
  { id: 'M1 摘掉 .lod-cl 基础规则的居中 translate（149px 宽的胶囊重新从锚点向右下悬出半枚）', gate: 'both',
    ed: [[CSS, '  transform:translate(calc(-50% + var(--lod-dx,0px)),calc(-50% + var(--lod-dy,0px)));\n', '  /*（变异：不居中）*/\n', 1]],
    exp: 'transform:translate(calc(-50%', want: ['U3', 'U4'], allow: ['U9', 'U12', 'U5', 'U6', 'U7', 'U8'],
    why: 'U3 盒中心＝锚点、U4 全在可用区内，正是「悬出半枚」的两个面；全国/390 各腿同因连带。' },
  { id: 'M2 :active 退回裸 scale(.94)（按下那一刻整枚弹回锚点右下）', gate: 'verify',
    ed: [[CSS, '.lod-cl:active{transform:translate(calc(-50% + var(--lod-dx,0px)),calc(-50% + var(--lod-dy,0px))) scale(.94)}', '.lod-cl:active{transform:scale(.94)}', 1]],
    exp: '.lod-cl:active{transform:scale(.94)}',
    why: '闸门从不模拟长按胶囊，浏览器侧结构上看不见这个态；只有源码锚点判得死 → 归属源码侧。' },
  { id: 'M3 只做横向居中、纵向写回 0px（底带 155px 里那半枚又被切）', gate: 'verify',
    ed: [[CSS, '  transform:translate(calc(-50% + var(--lod-dx,0px)),calc(-50% + var(--lod-dy,0px)));\n', '  transform:translate(calc(-50% + var(--lod-dx,0px)),0px);\n', 1]],
    exp: 'var(--lod-dy,0px)',
    why: '与 M1 同一条声明的两轴；M1 已证明这条线在浏览器侧是活闸，这里只补纵向锚。' },

  /* ============ ② 可用区口径（usableInsets 一族） ============ */
  { id: 'M4 带名单里去掉 .tabbar（贡献 82px，被 .region-stats 的 155px 盖住 → 几何上是恒等操作）', gate: 'verify', observe: true,
    ed: [[TPC, `var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];`, `var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tripbar.open'];`, 1]],
    exp: 'var USABLE_BANDS = [',
    why: '这条第一轮许给浏览器侧，实测打不红 U2，于是量了每条带的单独贡献' +
      '（tools/out/b13-band-contrib.js：452 档 region-stats 155px／tabbar 82px，390 档 155／82）：' +
      '内缩取的是各带贡献的最大值，去掉非最大那条＝逐像素不变，浏览器侧结构上看不见——归属只能给源码锚（名单整串相等）。' +
      '这不是闸门的洞，是「max 口径」的性质；能在浏览器侧现形的是 M4b。' },
  { id: 'M4b 带名单里去掉 .region-stats（当前贡献最大那条：155px → 82px）', gate: 'both',
    ed: [[TPC, `var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];`, `var USABLE_BANDS = ['#routeBanner', '.tabbar', '.tripbar.open'];`, 1]],
    exp: 'var USABLE_BANDS = [', want: ['U2'], allow: ['U4', 'U12', 'U3', 'U5', 'U6', 'U7', 'U8', 'U9', 'U11'],
    why: 'U1 量的是闸门自己的独立内缩（不该红，红了反而是闸门坏）；U2「产品＝闸门」才该红——' +
      '这条变异只坏产品侧（155→82 而闸门仍 155），正是那道双向对账存在的理由。' },

  { id: 'M5 成带判据整条短路（任何浮层都不算带 → 内缩恒 0）', gate: 'verify',
    ed: [[TPC, '      if (r.height <= 0 || ix < el.width * 0.6) return;', '      return;   /*（变异：全不算带）*/', 1]],
    exp: 'ix < el.width * 0.6',
    why: 'M4b 坏一条带、M5 坏整个口径（内缩恒 0）；浏览器侧与 M4b 同因（U2 红），不重复跑一条 70s 的腿。' },
  { id: 'M6 MARK_HALF 改 0（内容区不再比可用区再让半枚标记）', gate: 'both',
    ed: [[TPC, 'var MARK_HALF = 16;', 'var MARK_HALF = 0;', 1]],
    exp: 'var MARK_HALF = 16;', want: ['U2'], allow: ['U4', 'U12', 'U3', 'U5', 'U6', 'U7', 'U8', 'U9'],
    why: 'U2 明写「内容区 = 可用区再让 16px」，这条就是它的正向对照。' },
  { id: 'M7 + 键退回 map.zoomIn()（缩放锚点回到元素几何中心，比可用区中心低 53px）', gate: 'both',
    ed: [[TPC, `$('zoomIn').onclick = function () { zoomUsable(1); };`, `$('zoomIn').onclick = function () { map.zoomIn(); };`, 1]],
    exp: "$('zoomIn').onclick", want: ['U5'], allow: ['U6', 'U4', 'U3', 'U12'],
    why: 'U5 第一条断言就是「可用区中心那个经纬度缩放后仍在中心 ±4px」。' },
  { id: 'M8 缩放内部那一步退回 map.setZoom（接线还在，锚点算了）', gate: 'verify',
    ed: [[TPC, 'map.setZoomAround(map.containerPointToLatLng(p), nz);', 'map.setZoom(nz);', 1]],
    exp: 'map.setZoomAround',
    why: 'M7 砸「接线被拆」、M8 砸「接线里那一步算错」；浏览器侧同源，不重复跑。' },
  { id: 'M9 不把裁剪矩形注入 LOD（引擎重新按 #mapEl 元素矩形算视野）', gate: 'both',
    ed: [[TPC, 'vb: contentBounds,', '/*（变异：不注入裁剪矩形）*/', 1]],
    exp: 'vb: contentBounds,', want: ['U4'], allow: ['U3', 'U12', 'U5', 'U6', 'U7', 'U8', 'U9'],
    why: '第②条根因的可执行面：死带里的内容会被重新渲染出来。若浏览器侧被 clamp 兜住不红，就把归属改回源码侧并改写本条。' },
  { id: 'M10 不把聚焦方式注入 LOD（点聚合回到写死 padding [24,40] 的 flyToBounds）', gate: 'verify', observe: true,
    ed: [[TPC, 'focus: focusUsable,', '/*（变异：不注入聚焦）*/', 1]],
    exp: 'focus: focusUsable,',
    why: '聚焦后产品仍会跑 refitAvoid + clamp 把胶囊收回来，浏览器侧大概率兜得住（M9 那种「压根按错矩形渲染」才兜不住）；实测在日志里。' },

  /* ============ ③ 内收与重算 ============ */
  { id: 'M11 内收退回「读胶囊自己的盒再减回上次 dx」——本批 E 段刚修掉的竞态形状', gate: 'verify',
    ed: [[TPC,
      `      var cont = n.parentNode;\n      if (!cont || !cont.getBoundingClientRect) return;\n      var c = cont.getBoundingClientRect();\n      var ax = c.left + c.width / 2, ay = c.top + c.height / 2;\n      var w = n.offsetWidth, h = n.offsetHeight;\n      var dx = 0, dy = 0;\n      if (w < lim.r - lim.l) dx = Math.min(Math.max(ax, lim.l + w / 2), lim.r - w / 2) - ax;\n      if (h < lim.b - lim.t) dy = Math.min(Math.max(ay, lim.t + h / 2), lim.b - h / 2) - ay;`,
      `      var px = parseFloat(n.style.getPropertyValue('--lod-dx')) || 0;\n      var py = parseFloat(n.style.getPropertyValue('--lod-dy')) || 0;\n      var r = n.getBoundingClientRect();\n      var l = r.left - px, tp = r.top - py, rt = r.right - px, bt = r.bottom - py;\n      var dx = 0, dy = 0;\n      if (rt - l < lim.r - lim.l) { if (l < lim.l) dx = lim.l - l; else if (rt > lim.r) dx = lim.r - rt; }\n      if (bt - tp < lim.b - lim.t) { if (tp < lim.t) dy = lim.t - tp; else if (bt > lim.b) dy = lim.b - bt; }`, 1]],
    exp: 'var ax = c.left + c.width / 2',
    why: '旧写法读的是胶囊自身 transform 的中间态（.lod-cl 带 160ms transform 过渡），残留 1.9~4.7px 偏移，\n     在浏览器侧表现为「同一个构建时红时绿」（本轮实测：run1 红 U5/U6，run2 红 U5/U12）——只能由源码锚点负责。' },
  { id: 'M12 mini 化之后不再按新宽度重算内收（refitAvoid 里那句 clampCapsules 没了）', gate: 'verify', observe: true,
    ed: [[TPC, "      if (window.labelAvoid) labelAvoid('#mapEl');\n      clampCapsules();", "      if (window.labelAvoid) labelAvoid('#mapEl');", 1]],
    exp: "labelAvoid('#mapEl'); clampCapsules();",
    why: '后面还有一轮 LOD/内收会兜，几何未必红；锚点判得死。归属源码侧，实测在日志里。' },
  { id: 'M13 统计卡消失那个出口不再重算内缩（recheckInsets 两个出口删一个）', gate: 'verify',
    ed: [[TPC, '\n    recheckInsets();', '\n    /*（变异：这个出口不重算）*/', 1]],
    exp: 'recheckInsets();',
    why: '计数锚（期望 2）专防「只补了一个出口」这种半吊子修法。' },

  /* ============ ④ Leaflet 选项名与改前形态 ============ */
  { id: 'M14 padding 选项名漂回 paddingTL（这版 Leaflet 1.1.1 不认，写了静默失效）', gate: 'verify',
    ed: [[TPC, 'paddingTopLeft: [i.left, i.top]', 'paddingTL: [i.left, i.top]', 2]],
    exp: 'paddingTL',
    why: '一条变异同时打红两条锚（paddingTopLeft 少 2、paddingTL 从 0 变 2），「静默失效」就是这么被钉住的。' },
  { id: 'M15 路线 fit 退回写死 padding 的 map.fitBounds(all, …)', gate: 'verify',
    ed: [[TPC, 'else if (all.length) fitUsable(all);', 'else if (all.length) map.fitBounds(all, { padding: [24, 40] });', 1]],
    exp: 'map.fitBounds(all', why: '期望 0 的改前形态回潮即红（合成源正向对照保证那个 0 不是假绿灯）。' },

  /* ============ ⑤ node-lod 侧 ============ */
  { id: 'M16 LOD 两处裁剪矩形退回 C.map.getBounds()（注入形同虚设）', gate: 'verify',
    ed: [[NLOD, 'var b = vb();', 'var b = C.map.getBounds();', 2]],
    exp: 'var b = vb();', why: 'M9 坏在产品侧不注入，M16 坏在引擎侧不消费——两条独立锚。' },
  { id: 'M17 顺手改掉「未注入时的默认行为」（默认 flyToBounds 的 padding 被调小）', gate: 'verify',
    ed: [[NLOD, 'C.map.flyToBounds(bnd, { padding: C.pad || [24, 40], maxZoom: mz, duration: .5 });', 'C.map.flyToBounds(bnd, { padding: C.pad || [8, 8], maxZoom: mz, duration: .5 });', 1]],
    exp: 'C.map.flyToBounds(bnd', why: '这条锚的意义就是「默认路径不许被顺手改掉」；只钉注入那一半不够。' },

  /* ============ ⑥ §24 自己的每道守卫都要能被砸红 ============ */
  { id: 'G1 锚点表被削减（整行删掉 MARK_HALF 那条）', gate: 'verify',
    ed: [[VF, `    ['topic-common.js', 'var MARK_HALF = 16;', 1, '内容区在可用区之外再让半枚标记（胶囊 31/节点 30 的半高）'],\n`, '', 1]],
    exp: '锚点表被削减', why: '「这一节还在不在」的下限：55 → 54 就红。' },
  { id: 'G2 needle 里写进块注释（flat24 先剥注释 → 永远 0 命中 = 假红灯）', gate: 'verify',
    ed: [[VF, `['topic-common.js', 'function contentBounds(', 1,`, `['topic-common.js', 'function contentBounds(/* 注 */', 1,`, 1]],
    exp: '锚点里不许出现块注释', why: '本批真写错过一条，所以这道守卫本身要能被砸红。' },
  { id: 'G3 合成「改前源」里去掉 paddingTL（期望 0 的那条锚失去正向对照 = 假绿灯）', gate: 'verify',
    ed: [[VF, `'map.zoomIn(); L.divIcon({ paddingTL: [8, 8] });',`, `'map.zoomIn(); L.divIcon({ });',`, 1]],
    exp: '正向对照失效', why: '期望 0 的锚若没有对照，就分不清「真没有」和「needle 写错了」。' },
  { id: 'G4 某个文件一条锚都不剩（node-lod 那组删到 4 条）', gate: 'verify',
    ed: [[VF,
      `    ['node-lod.js', 'C.focus({ center: bnd.getCenter(), zoom: 10 });', 1, 'region 分支把「那个中心」交给产品（固定缩放，不给 bounds）'],\n    ['node-lod.js', 'C.focus({ bounds: bnd, maxZoom: mz });', 1, 'city/county 分支交边界 + maxZoom'],\n    ['node-lod.js', 'C.map.flyToBounds(bnd, { padding: C.pad || [24, 40], maxZoom: mz, duration: .5 });', 1, '未注入时的旧行为原样留着（默认路径不许被顺手改掉）'],\n`, '', 1]],
    exp: '锚点覆盖不足', why: '每文件下限 5；同时表规模也红（两条都是 §24 的自有守卫）。' },
  { id: 'G5 冒烟里 U3 那条断言被改名（闸门写了不等于测过）', gate: 'verify',
    ed: [[SM, `check('U3 ' + tag`, `check('盒中心＝锚点：' + tag`, 1]],
    exp: '缺 U3 这条判据', why: '§24 ③ 组按 U0–U13 逐个点名；改名等于悄悄摘掉一条断言。' },
  { id: 'G6 README 不再登记 smoke-usable.js（新闸门等于没装）', gate: 'verify',
    ed: [[RD, 'smoke-usable.js', 'smoke-usable-x.js', 1]],
    exp: 'README.md 没登记 smoke-usable.js', why: '别人复跑时不知道该跑它。' },
  { id: 'G7 方案文档里没有「批次 13」这一节（实测数字没落盘）', gate: 'verify',
    ed: [[DOC, '批次 13', '批次 拾叁', 1]],
    exp: '没有「批次 13」这一节', why: '不落文档，下批就得从头猜。' },

  /* ============ ⑦ 闸门自己坏掉的样子：§24 看不见，只能由行为闸兜 ============ */
  { id: 'B1 闸门的独立内缩测量空转（BANDS 置空 → 闸门量到 0，产品照旧 155）', gate: 'smoke',
    ed: [[SM, `const BANDS = ['.routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];`, `const BANDS = [];`, 1]],
    want: ['U1'], allow: ['U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12'],
    why: '§24 只查 `BANDS = [` 这个字面在不在，防不住「名字还在、内容空了」。本条断言 verify.js 仍绿 + 浏览器侧红，' +
      '这才是「闸门必须自己独立量一遍内缩」这句话背后有真闸的证据，而不是一句注释。' },
];

const SKIP_SMOKE = !!process.env.SKIP_SMOKE;
/* ONLY=M4,M4b → 只跑这几条（归属改判后要复测那一条，不该为一件事重跑 20 分钟） */
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
const LIST = ONLY ? MUTS.filter(mu => ONLY.some(k => mu.id.indexOf(k) === 0)) : MUTS;
if (ONLY && !LIST.length) { console.log('ONLY=' + process.env.ONLY + ' 一条没匹配上（id 前缀打错了）'); process.exit(2); }
let ok = 0, bad = 0, dirty = 0, smokeRuns = 0;

resetAll();
const base = runVerify();
console.log('基线 verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.fails.join('\n')); process.exit(2); }

try {
  for (const mu of LIST) {
    FILES.forEach(reset);
    let abort = '';
    for (const [f, from, , cnt] of mu.ed) {
      const n = B[f].base.split(from).length - 1;
      if (n !== cnt) abort = '锚点在 ' + f + ' 命中 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 44));
    }
    if (abort) { bad++; console.log('\n✗ ' + mu.id + '\n    ABORT ' + abort); continue; }
    const staged = {};
    mu.ed.forEach(([f, from, to]) => { staged[f] = (staged[f] || B[f].base).split(from).join(to); });
    Object.keys(staged).forEach(f => write(f, staged[f]));

    /* 每条都跑 verify：gate:'smoke' 的条目要的正是「§24 看不见」这个结论 */
    const v = runVerify();
    let sm = null;
    if (!SKIP_SMOKE && (mu.gate === 'both' || mu.gate === 'smoke' || mu.observe)) { sm = runSmoke(); smokeRuns++; }
    FILES.forEach(reset);

    /* —— 源码腿 —— */
    let vok = true, vMsg = '';
    if (v) {
      const hits = v.fails.filter(l => l.indexOf(G24) >= 0);
      const others = v.fails.filter(l => l.indexOf(G24) < 0);
      const hitExp = hits.some(l => l.indexOf(mu.exp) >= 0);
      if (mu.gate === 'smoke') vok = v.code === 0;                 /* 这条要证明源码锚看不见 */
      else vok = v.code !== 0 && hitExp && !others.length;
      vMsg = '[verify] exit=' + v.code + ' §24 红 ' + hits.length + ' 行' +
        (mu.gate === 'smoke' ? (v.code === 0 ? '（仍绿＝源码锚看不见这条退化，符合归属）' : '（竟然红了）')
          : (hitExp ? ' 命中「' + mu.exp.slice(0, 24) + '」' : ' 没命中 exp！')) +
        (others.length ? ' · 别的闸门噪声：' + others[0].slice(0, 48) : '');
    }
    /* —— 浏览器腿 —— */
    let sok = true, sMsg = '';
    if (sm) {
      const miss = (mu.want || []).filter(k => sm.red.indexOf(k) < 0);
      const noise = sm.red.filter(k => (mu.want || []).indexOf(k) < 0 && (mu.allow || []).indexOf(k) < 0);
      const asserted = mu.gate === 'both' || mu.gate === 'smoke';
      sok = !asserted || (sm.red.length > 0 && !miss.length && !noise.length);
      sMsg = '[smoke:' + sm.red.join(',') + ']' + (asserted ? (sok ? ' 按要求红' : ' 没达标' + (miss.length ? '（want 没红 ' + miss.join(',') + '）' : '') + (noise.length ? '（噪声 ' + noise.join(',') + '）' : '')) : ' 旁证（只记录）');
    }
    const pass = vok && sok;
    if (pass) ok++; else bad++;
    console.log('\n' + (pass ? '✓ ' : '✗ ') + mu.id);
    console.log('    归属=' + (mu.gate === 'smoke' ? '浏览器闸门' : mu.gate === 'both' ? '双闸' : '源码 §24') +
      (vMsg ? '  ' + vMsg : '') + (sMsg ? '  ' + sMsg : ''));
    console.log('    ' + mu.why);
  }
} finally {
  FILES.forEach(reset);
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== B[f].raw) { dirty++; console.log('!! 未逐字节还原：' + f); }
  });
  console.log('\n还原对账：' + FILES.length + ' 个文件，未还原 ' + dirty + ' 个');
  const after = runVerify();
  console.log('还原后 verify.js exit=' + after.code + (after.code === 0 ? '（绿）' : '（红：' + after.fails.join(' / ') + '）'));
}
console.log('=== §24 + smoke-usable 变异自测：' + ok + '/' + LIST.length + ' 条按要求变红 · 异常 ' + bad +
  ' · 浏览器腿 ' + smokeRuns + ' 次 ===');
process.exit((bad || dirty) ? 1 : 0);
