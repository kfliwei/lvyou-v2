/* 批次 11-D · verify.js §19（时序与转场）+ §20（个性化画像）变异自测
 * 每条变异只改一个「应该让闸门变红」的点，跑 verify.js 断言：exit≠0 且输出含指定短语，
 * 并且（除 only:false 的几条外）只让对应那一栏变红 1 条——多红说明锚点打偏了。
 * only:false 的每条都是「同一条口径的两面」或「跨闸门互证」，理由写在条目注释里。
 * 跑完从内存快照逐字节还原，还原后再跑一遍 verify.js 必须绿。
 * 锚点先断出现次数，替换一律 split/join（String.replace 只换第一处）。
 * 行尾：本仓库实测混用——design.css / backup.js / smoke-motion.js 是 LF，ui.js / planner.js /
 * travel-notes.js / topic-common.js / 各 html / verify.js / README / 文档 是 CRLF。所以除 LF 那三个文件外，
 * 所有锚点都不跨行（跨行要写 \r\n，写错就是 0 次命中，第一轮 M25 就这么空跑过一次）。
 * 备注：verify.js 单次 ~1.0s，所以本 harness 敢把 §19/§20 的每条断言都单独砸一次。
 *
 * 这一轮砸出三处「闸门自己不会红」的洞，已当场改掉（都是变异自测的产出，不是产品代码的问题）：
 *   ① M7：裸时序扫描的声明边界只认 `[\s;{]`，而 `style="animation-delay:…"` 的声明紧跟在引号后，
 *      整条「行内 style 属性」扫描面一条都抓不到（批次 11-A 的 133 处里这类占了不少）。
 *      → verify.js 的边界类补 `{"'`，补完全站仍然 0 处，说明产品侧没漏、漏的是网。
 *   ② M32/N24：文档类锚点天生有多处（§P2-7 的判据在「复核注」和「勾选项」各写了一次，§P2-8 的键名
 *      在开关条目和勾选条目各写了一次）。只抹一处不会红——不是洞，但变异必须整组一起抹，
 *      否则会得出「这条判据是死的」的错误结论。字段表那一行故意不抹，留给 §16 逐键对账。
 *   ③ N25：§P2-8 隐私口径原判据是 `/不送|不带|正文/`——三个常见词任一命中就绿，永远绿。
 *      → 换成「`只送聚合关键词` 且 `正文…不出门`」两句原文逐字钉，变异（两处一起抹）才打得红。
 *
 * 第二轮（把 §P2-8 的文档记录补全之后重跑）多出的三条与一处返工：
 *   · M14b/c/d 是给「减动效块的 delay 必须正好 0s」这条新判据配的网。这条判据不是防御性的：
 *     visual-check 的 album.seed 稳定差 0.06%，A/B 四组合（tools/out/probe-album-ab.js）定位到
 *     `animation-delay:var(--motion-none)`（=.01ms）——首帧停在关键帧 0%（封面提示 opacity .8→.35），
 *     动画结束后浏览器不补重绘，减动效档就永久停在偏淡那一帧。改成 0s 后 album.seed 回到 0.00%。
 *   · M12 的锚点从 delay 挪到 duration：delay 现在钉的是 `0s!important`，把 !important 摘掉会被
 *     「必须正好写成 0s」先抓住（红在同一条口径的另一面），砸不出「漏 !important」这一条。
 *   · N24/N25 各多抹一处：批次落地记录按本仓库惯例写在所属 P2-x 小节里，同一口径因此在切片里
 *     多出现一次——整组抹不干净就是「假红变假绿」（教训②的复发，说明它得写进注释）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const CSS = 'design.css', UI = 'ui.js', PL = 'planner.js', TN = 'travel-notes.js',
  IDX = 'index.html', TOP = 'topic.html', STO = 'story.html', SET = 'settings.html',
  TPC = 'topic-common.js',
  BK = 'backup.js', SM = 'tools/smoke-motion.js', SMOKEP = 'tools/smoke-planner.js',
  VF = 'tools/verify.js', RD = 'README.md', DOC = '改进实施方案与验收标准.md';

const G19 = '时序转场闸门 FAIL', G20 = '画像闸门 FAIL';

const MUTS = [
  /* ==================== §19 ① 阶梯逐值核定 + 撞档 + 多一档 ==================== */
  { g: G19, name: 'M1 把 --motion-tap 从 120ms 改成 100ms（交互档漂了，闸门与样式各记一套）',
    ed: [[CSS, '  --motion-tap:120ms;', '  --motion-tap:100ms;', 1]], exp: '--motion-tap 应为 120ms' },
  { g: G19, name: 'M2 删掉逐条入场步长档（calc(var(--motion-step)*n) 从此解析成 0）',
    ed: [[CSS, '  --motion-step:40ms;             /* 逐条入场步长 */\n', '', 1]], exp: '时序阶梯缺 --motion-step' },
  { g: G19, name: 'M2b 多出一档没人核定的 --motion-extra（阶梯是账本，私自加档=口径失控）',
    ed: [[CSS, '  --motion-step:40ms;', '  --motion-extra:900ms;\n  --motion-step:40ms;', 1]], exp: '多出一档 --motion-extra' },
  { g: G19, name: 'M3 装饰档 drift 就近归到 breath 同值——撞档，父子反向旋转看起来冻住',
    ed: [[CSS, '  --motion-drift:3200ms;', '  --motion-drift:2800ms;', 1]], exp: '时序阶梯撞档', only: false,
    why: '同一条口径两面：逐值核定 + 撞档检查' },
  { g: G19, name: 'M4 token 里套 var（token 表本身就是唯一真相，再套一层就没法逐值核定）',
    ed: [[CSS, '  --motion-mid:240ms;', '  --motion-mid:var(--motion-fast);', 1]], exp: '不是裸时长', only: false,
    why: 'token 变成 var 后既「不是裸时长」又「缺 --motion-mid」' },

  /* ==================== §19 ② 裸时序归零：三条扫描面各砸一次 ==================== */
  { g: G19, name: 'M5 design.css 里一个 transition 退回字面量 .25s（锚点在批次 12 漂过：原锚那行的 border 字面量已被 UI-5 收进 --edge-hair，整串不在了 → 复跑全网才发现，正是「锚点随文件漂移」这个坑）',
    ed: [[CSS, 'transition:var(--t-fast);height:var(--chip-h);', 'transition:opacity .25s;height:var(--chip-h);', 1]],
    exp: '裸时序字面量（design.css）' },
  { g: G19, name: 'M6 页面 <style> 里的 animation 退回字面量 .7s（批次 11 前有 133 处就在这）',
    ed: [[IDX, '.fade-up{opacity:0;animation:fadeUp var(--motion-long) var(--ease-standard) forwards}', '.fade-up{opacity:0;animation:fadeUp .7s var(--ease-standard) forwards}', 1]],
    exp: '裸时序字面量（index.html <style>）' },
  { g: G19, name: 'M7 行内 style 属性里的 animation-delay 退回字面量（扫描面第三条，最容易漏）',
    ed: [[IDX, '<h1 class="hero__title fade-up" style="animation-delay:var(--motion-tap)">今天，', '<h1 class="hero__title fade-up" style="animation-delay:120ms">今天，', 1]],
    exp: '裸时序字面量（index.html style 属性）' },
  /* --- 探针自证：三条都是「闸门自己的对照」，砸坏正则必须当场现形，否则就是永久绿灯 --- */
  { g: G19, name: 'M8 裸时序正则写坏到抓不到省零小数（正向对照失效：坏样本溜过去=永久绿灯）',
    ed: [[VF, "(?!0(\\.0*)?(ms|s)\\b)\\d*\\.?\\d+(ms|s)", '(?!0(\\.0*)?(ms|s)\\b)\\d+(ms|s)', 1]], exp: '裸时序探针自身失效' },
  { g: G19, name: 'M9 裸时序正则去掉「放过零值」的先行断言（反向对照失效：CSSOM 展开的 0s 被当魔法数字）',
    ed: [[VF, "(^|[^A-Za-z0-9_.-])(?!0(\\.0*)?(ms|s)\\b)", '(^|[^A-Za-z0-9_.-])', 1]], exp: '裸时序探针误报：CSSOM 把 animation:none', only: false,
    why: '零值不再放过，真实扫描面里带 0s 的声明会一起红——这正是反向对照存在的理由' },

  /* ==================== §19 ③ 别名族只能派生 ==================== */
  { g: G19, name: 'M10 旧别名 --t-fast 自带字面量（两套时长迟早分家）',
    ed: [[CSS, '  --t-fast:var(--motion-fast) var(--ease-standard);', '  --t-fast:.16s var(--ease-standard);', 1]], exp: '旧时序别名没从 --motion-* 派生' },

  /* ==================== §19 ④ 减动效覆盖面：四样各砸一次 ==================== */
  { g: G19, name: 'M11 减动效块不再归零 transition-delay（系统开了减弱动效，hover 位移照旧慢半拍）',
    ed: [[CSS, 'transition-duration:var(--motion-none)!important;transition-delay:0s!important}', 'transition-duration:var(--motion-none)!important}', 1]],
    exp: '减动效块缺 transition-delay' },
  { g: G19, name: 'M12 减动效归零漏掉 !important（压不住各页局部声明，等于白写）',
    ed: [[CSS, '*::after{animation-duration:var(--motion-none)!important;', '*::after{animation-duration:var(--motion-none);', 1]],
    exp: '减动效归零没带 !important' },
  { g: G19, name: 'M13 减动效不再把 infinite 收成 1 次（时长归零了但骨架屏永远在闪）',
    ed: [[CSS, 'animation-iteration-count:1!important;transition-duration', 'animation-iteration-count:2!important;transition-duration', 1]],
    exp: '减动效块缺 animation-iteration-count:1' },
  { g: G19, name: 'M14 减动效块不再点名 ::view-transition-*（`*` 不吃伪元素根，转场照旧飞 360ms）',
    ed: [[CSS, '  ::view-transition-group(*),::view-transition-image-pair(*),::view-transition-old(*),::view-transition-new(*){animation-duration:var(--motion-none)!important;animation-delay:0s!important}\n', '', 1]],
    exp: '减动效块缺 ::view-transition-old(*)' },
  /* M14b/c/d 钉的是本批 visual-check 抓到的那条真回归：delay 写成 .01ms（复用 --motion-none）
     会让减动效档的首帧停在关键帧 0% 且不再补重绘（album 封面提示 .8 → .35，稳定 0.06% 差）。
     判据「delay 必须正好 0s」是这条回归的常驻网。 */
  { g: G19, name: 'M14b 减动效块的 animation-delay 图省事复用 --motion-none(.01ms)（本批真踩过的雷：首帧卡在关键帧 0% 不再重绘）',
    ed: [[CSS, 'animation-duration:var(--motion-none)!important;animation-delay:0s!important;animation-iteration-count', 'animation-duration:var(--motion-none)!important;animation-delay:var(--motion-none)!important;animation-iteration-count', 1]],
    exp: '必须正好写成 0s' },
  { g: G19, name: 'M14c 转场伪元素根的 delay 复用别的档 --motion-step（归零不彻底，转场晚一拍）',
    ed: [[CSS, 'animation-duration:var(--motion-none)!important;animation-delay:0s!important}', 'animation-duration:var(--motion-none)!important;animation-delay:var(--motion-step)!important}', 1]],
    exp: '必须正好写成 0s' },
  { g: G19, name: 'M14d 减动效块整条不再写 delay（少两条=归零口径塌了）',
    ed: [[CSS, 'animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:var(--motion-none)!important;transition-delay:0s!important}', 'animation-iteration-count:1!important;transition-duration:var(--motion-none)!important}', 1], [CSS, ';animation-delay:0s!important}', '}', 1]],
    exp: '只找到 ', only: false },

  /* ==================== §19 ⑤ 跨文档转场开通 + root 时长 ==================== */
  { g: G19, name: 'M15 跨文档转场没开通（navigation:none：导航不再过渡，P2-7 的页面转场全废）',
    ed: [[CSS, '@view-transition{navigation:auto}', '@view-transition{navigation:none}', 1]], exp: '跨文档转场没开通' },
  { g: G19, name: 'M16 删掉 root 伪元素的转场时长（默认转场不吃 token，档位改了也没用）',
    ed: [[CSS, '::view-transition-old(root),::view-transition-new(root){animation-duration:var(--motion-page);animation-timing-function:var(--ease-standard)}\n', '', 1]],
    exp: '没给 root 伪元素定转场时长' },
  { g: G19, name: 'M16b root 转场时长写死 360ms（改档时这里不会跟着变）',
    ed: [[CSS, '::view-transition-old(root),::view-transition-new(root){animation-duration:var(--motion-page);', '::view-transition-old(root),::view-transition-new(root){animation-duration:360ms;', 1]],
    exp: 'root 转场时长没走 --motion-page token', only: false, why: '同一条口径两面：token 断了 + 字面量回流' },

  /* ==================== §19 ⑥ 三处转场接线 + 共享元素名唯一 ==================== */
  { g: G19, name: 'M17 planner 阶段切换绕过 UI.vt（三处转场之一，且 file:// 降级也就没人走了）',
    ed: [[PL, '    UI.vt(function () {', '    (function () {', 1]], exp: 'planner 阶段切换没走 UI.vt' },
  { g: G19, name: 'M18 随手记面板只接开不接关（关面板时一半有名一半无声）',
    ed: [[TN, 'if (window.UI && UI.vt) UI.vt(hide); else hide();', 'hide();', 1]], exp: '随手记面板关闭没走 UI.vt' },
  { g: G19, name: 'M18b 随手记面板打开不再走转场',
    ed: [[TN, 'if (window.UI && UI.vt) UI.vt(flip); else flip();', 'flip();', 1]], exp: '随手记面板打开没走 UI.vt' },
  { g: G19, name: 'M19 首页给两个元素起同名 search-field（同页重名会让整段转场失效）',
    ed: [[IDX, 'view-transition-name:search-field;', 'view-transition-name:search-field;view-transition-name:search-field;', 1]], exp: '首页 里 search-field 出现 2 次' },
  { g: G19, name: 'M19b 专题页把共享元素名摘掉（页面跳回去时那块区域没有配对，转场没有连续性）',
    ed: [[TOP, '.topbar .search{view-transition-name:search-field}', '.topbar .search{}', 1]], exp: '专题页 里 search-field 出现 0 次' },

  /* ==================== §19 ⑦ UI.vt / UI.motionMs 的契约 ==================== */
  { g: G19, name: 'M20 UI 导出漏掉 vt（各页 UI.vt 变成 undefined，当场崩）',
    ed: [[UI, 'scrollBehavior: scrollBehavior, vt: vt };', 'scrollBehavior: scrollBehavior };', 1]], exp: 'UI 的四个动效 helper 没导出' },
  { g: G19, name: 'M21 UI.vt 只 catch 两条 promise——就是批次 11-B 实际踩的那个坑（ready 的 AbortError 冒成页面报错）',
    ed: [[UI, "['ready', 'updateCallbackDone', 'finished'].forEach", "['updateCallbackDone', 'finished'].forEach", 1]], exp: 'UI.vt 没给三条 promise 全挂 catch' },
  { g: G19, name: 'M22 UI.vt 降级出口把回调吞了（减动效/老内核下 DOM 不再更新，不是「静默降级」是「静默不干活」）',
    ed: [[UI, 'if (reducedMotion() || !document.startViewTransition) { fn(); return null; }', 'if (reducedMotion() || !document.startViewTransition) { return null; }', 1]],
    exp: 'UI.vt 降级出口不对' },
  { g: G19, name: 'M23 UI.motionMs 不回读 :root（JS 与 CSS 各记一套时长）',
    ed: [[UI, "getPropertyValue('--motion-' + name)", "getPropertyValue('--dur-' + name)", 1]], exp: 'UI.motionMs 没从 :root 回读' },
  { g: G19, name: 'M24 toast 的移除等待退回写死 320（--motion-normal 改档后它不跟着动）',
    ed: [[UI, "setTimeout(function () { d.remove(); }, motionMs('normal', 320));", 'setTimeout(function () { d.remove(); }, 320);', 1]],
    exp: 'toast/offlineBar 的移除等待应各回读一次 token' },

  /* ==================== §19 ⑧ 载 helper 的页必须载 ui.js ==================== */
  { g: G19, name: 'M25 story.html 载了 travel-notes.js 却摘掉 ui.js（UI 未定义是当场崩，不是静默降级）',
    ed: [[STO, '<script src="ui.js"></script>', '<!-- M25：ui.js 被摘掉 -->', 1]], exp: 'story.html 载了 travel-notes.js 却没载 ui.js' },

  /* ==================== §19 ⑨ 浏览器那头确实在测（闸门写了不等于测过） ==================== */
  { g: G19, name: 'M26 冒烟里「同文档转场真被调用」那条断言改名（源码闸门看着绿，浏览器其实没盯）',
    ed: [[SM, "check('C5 UI.vt 在支持的环境里真的走 startViewTransition，回调没被吞'", "check('C5 UI.vt 真走 startViewTransition'", 1]], exp: '缺同文档转场真被调用的断言行' },
  { g: G19, name: 'M27 冒烟里「减动效 ≤1 帧」那条断言改名',
    ed: [[SM, "check('B8 验收口径「所有动画时长 ≤1 帧」实测：全页元素无超帧（含 vendor leaflet 的动画）'", "check('B8 全页元素无超帧'", 1]], exp: '缺减动效全页逐元素实测的断言行' },
  { g: G19, name: 'M28 冒烟里「转场不许冒未捕获异常」那条断言改名（D4 就是抓 AbortError 的那条）',
    ed: [[SM, "check('D4 全程无页面未捕获异常'", "check('D4 无未捕获异常'", 1]], exp: '缺转场不许冒未捕获拒绝的断言行' },
  { g: G19, name: 'M29 冒烟里「随手记两处接线」那条断言改名',
    ed: [[SM, "check('C12 随手记面板开合各走一次转场'", "check('C12 面板开合各走一次'", 1]], exp: '缺随手记两处接线的断言行' },
  { g: G19, name: 'M30 冒烟里「共享元素名落地」那条断言改名',
    ed: [[SM, "check('C4 首页搜索框挂了共享元素名 search-field'", "check('C4 首页搜索框共享元素名'", 1]], exp: '缺共享元素名落地的断言行' },
  { g: G19, name: 'M31 README 的闸门清单不再登记 smoke-motion.js（别人复跑时根本不知道该跑它）',
    ed: [[RD, 'smoke-motion.js', 'smoke-motion-x.js', 2]], exp: 'README 闸门清单没登记 smoke-motion.js' },

  /* ==================== §19 ⑩ 文档口径 ==================== */
  { g: G19, name: 'M32 §P2-7 的验收判据退回原方案那句无效 grep（`0.[0-9]+s` 照字面跑一上来就 PASS，两处引用一起退）',
    ed: [[DOC, '时间字面量 `([0-9]+\\.[0-9]+s|[0-9]+ms)` 归零', '时间字面量 `0.[0-9]+s` 归零', 1],
      [DOC, '改成：`grep -oE "([0-9]+\\.[0-9]+s|[0-9]+ms)" design.css` 的命中数 = 0', '改成：`grep -oE "0.[0-9]+s" design.css` 的命中数 = 0', 1]],
    exp: '§P2-7 的验收判据没换成' },
  { g: G19, name: 'M33 §P2-7 把批次 11 的实测回写抹掉（只剩原方案的计划，等于没交付）',
    ed: [[DOC, '### 批次 11-A/B 落地', '### 二期-A/B 落地', 1], [DOC, '改前（批次 11 起点的 HEAD）', '改前（起点 HEAD）', 1]], exp: '§P2-7 没回写批次 11 的实测结论' },
  { g: G19, name: 'M34 §P2-7 又留了一个未勾选项（批次当没收工）',
    ed: [[DOC, '- [x] `--motion-*` 为唯一时序来源', '- [ ] `--motion-*` 为唯一时序来源', 1]], exp: '§P2-7 还有未勾选项' },

  /* ==================== §19 ⑨b 入场动画 × 标签避让（批次 12 · V5 附） ====================
     这一组是 topic.1440/768 双态的根因回归。四条各钉修法的一面：两拍 rAF、两个渲染回调的补测入口、
     视野变化后的补测、动画收尾的补测。少任何一条，避让就重新跑在 node-fade-in 的 scale(.6) 首帧上。 */
  { g: G19, name: 'M35 两拍 rAF 退回一拍（一拍只保证回调排进本轮 rAF，量到的还是动画首帧的 0.6 倍矩形）',
    ed: [[TPC, '    requestAnimationFrame(function () { requestAnimationFrame(function () {', '    requestAnimationFrame(function () {', 1]],
    exp: 'refitAvoid 不是「两拍 rAF」' },
  { g: G19, name: 'M36 标签渲染回调退回直调 capsuleAvoid（批次 12 之前的写法，几何在动画中间态上量）',
    ed: [[TPC, 'renderMarkers._av = setTimeout(refitAvoid, 120);', "renderMarkers._av = setTimeout(function () { capsuleAvoid('#mapEl'); }, 120);", 1]],
    exp: '避让补测的调用点丢了' },
  { g: G19, name: 'M37 NodeLOD 的 onRendered 退回直调（另一条渲染路径同样会在首帧量）',
    ed: [[TPC, 'window.__cavT = setTimeout(refitAvoid, 80);', "window.__cavT = setTimeout(function () { capsuleAvoid('#mapEl'); }, 80);", 1]],
    exp: '避让补测的调用点丢了' },
  { g: G19, name: 'M38 moveend zoomend 退回只补胶囊（标签避让从此不在视野变化后重测，缩放后的新重叠没人收）',
    ed: [[TPC, "map.on('moveend zoomend', function () { clearTimeout(capsuleAvoid._t); capsuleAvoid._t = setTimeout(refitAvoid, 170); });",
      "map.on('moveend zoomend', function () { clearTimeout(capsuleAvoid._t); capsuleAvoid._t = setTimeout(function () { if (window.capsuleAvoid) capsuleAvoid('#mapEl'); }, 170); });", 1]],
    exp: 'moveend zoomend 没走 refitAvoid' },
  { g: G19, name: 'M39 摘掉 animationend 收尾补测（正常档 --motion-enter 480ms 比 80/120ms 长得多，错态一路留到截图）',
    ed: [[TPC, '      clearTimeout(refitAvoid._t); refitAvoid._t = setTimeout(refitAvoid, 120);', '      /*（变异：动画收尾不再补测）*/', 1]],
    exp: 'animationend 收尾补测没了' },
  { g: G19, name: 'M40 冒烟里 E3「动画结束后标签两两不重叠」那条断言改名',
    ed: [[SM, "check('E3 动画全部结束后，可见标签两两不重叠'", "check('E3 标签两两不重叠'", 1]],
    exp: '缺入场动画 × 标签避让的回归的断言行' },
  { g: G19, name: 'M41 冒烟里 E4「缩小视野后避让真被再调一次」那条断言改名（E4 是这段唯一的正向对照，改名等于摘掉）',
    ed: [[SM, "check('E4 缩小视野后补测真的又跑过", "check('E4 缩放后补测跑过", 1]],
    exp: '缺视野变化后的避让补测的断言行' },

  /* ==================== §20 ① 聚合函数：默认值、开关、上限、不碰正文 ==================== */
  { g: G20, name: 'N1 prefSummary 顺手读了游记正文（画像链路的唯一红线：正文一个字都不许出门）',
    ed: [[PL, '      bump(city, n.city);', '      bump(city, n.city); bump(kw, n.text);', 1]], exp: 'prefSummary 读了游记正文/原声' },
  { g: G20, name: 'N2 画像串 160 字上限放宽到 4000（prompt 随游记数量无界膨胀）',
    ed: [[PL, "return parts.join('；').slice(0, 160);", "return parts.join('；').slice(0, 4000);", 1]], exp: '画像串没有 160 字上限' },
  { g: G20, name: 'N3 画像开关从「默认开、写 0 才关」翻成「默认关、写 1 才开」（不写键的机器从此没这功能）',
    ed: [[PL, "localStorage.getItem(PREF_KEY) !== '0'", "localStorage.getItem(PREF_KEY) === '1'", 1]], exp: '个性化推荐不是「默认开、写 0 才关」' },
  { g: G20, name: 'N4 开关关掉后仍然出画像（设置页那个开关成了摆设）',
    ed: [[PL, "    if (!prefOn()) return '';", '    if (false) return \'\';', 1]], exp: '开关关掉后 prefSummary 没有直接返回空串' },
  { g: G20, name: 'N5 不再判心愿单库在不在（未载 wishlist.js 的页当场崩）',
    ed: [[PL, 'var wl = (window.Wish && Wish.list) ? Wish.list() : [];', 'var wl = Wish.list();', 1]], exp: 'prefSummary 没判数据库在不在' },
  { g: G20, name: 'N6 画像不取心愿单主题（vibe 口径断了一半，四处引用一起改）',
    ed: [[PL, 'var prov = {}, city = {}, theme = {}, kw = {};', 'var prov = {}, city = {}, wishKw = {}, kw = {};', 1],
      [PL, '      bump(theme, w.theme);', '      bump(wishKw, w.topic);', 1],
      [PL, 'var pTop = topKeys(prov, 3), cTop = topKeys(city, 3), tTop = topKeys(theme, 3), kTop = topKeys(kw, 6);',
        'var pTop = topKeys(prov, 3), cTop = topKeys(city, 3), tTop = topKeys(wishKw, 3), kTop = topKeys(kw, 6);', 1],
      [PL, "    if (tTop.length) parts.push('心愿单主题 ' + tTop.join('/'));", "    if (tTop.length) parts.push('心愿单话题 ' + tTop.join('/'));", 1]],
    exp: '画像没取心愿单主题' },
  { g: G20, name: 'N7 画像不取近期标签（改用标题冒充口味，正是隐私口径要避免的）',
    ed: [[PL, '(n.tags || []).forEach(function (t) { bump(kw, String(t).trim()); });', '(n.keywords || []).forEach(function (t) { bump(kw, String(t).trim()); });', 1]],
    exp: '画像没取近期标签' },
  { g: G20, name: 'N8 聚合入口改名（prefSummary 这个人再也找不到）',
    ed: [[PL, '  function prefSummary() {', '  function prefSummaryX() {', 1]], exp: '没有 prefSummary()', only: false,
    why: '改名同时让「注入点计数」变成 1 处，两条一起红' },

  /* ==================== §20 ② 注入点唯一且带护栏 ==================== */
  { g: G20, name: 'N9 多一个 prefSummary 调用点（多一处没人审计过的出门口）',
    ed: [[PL, 'var profile = prefSummary();', 'var profile = prefSummary() || prefSummary();', 1]], exp: 'prefSummary 只许「定义 1 处 + aiPlanRoutes 调用 1 处」' },
  { g: G20, name: 'N10 摘掉「别为迎合画像推荐目的地之外景点」的护栏（模型会开始推荐别省的景点）',
    ed: [[PL, "但不要因为画像而推荐「'", "请贴合口味推荐「'", 1]], exp: '画像段没带护栏' },
  { g: G20, name: 'N11 prompt 段名「用户画像」漂了（画像进出去了也看不出来）',
    ed: [[PL, "(profile ? '用户画像：' + profile", "(profile ? '口味：' + profile", 1]], exp: "prompt 里没有「用户画像」段名" },
  { g: G20, name: 'N12 aiPlanRoutes 的 prompt 里直接拼正文（红线）',
    ed: [[PL, 'var profile = prefSummary();', "var profile = prefSummary() + (TravelNotes.last && TravelNotes.last.text || '');", 1]],
    exp: 'aiPlanRoutes 的 prompt 里出现游记正文', only: false, why: '同一条链路上「注入点计数」也变了：调用式里多了 .text' },

  /* ==================== §20 ③ 键两清（与 §16 备份闸门互证） ==================== */
  { g: G20, name: 'N13 开关没在备份策略登记（关掉一次开关换机就丢，或被当数据同步）',
    ed: [[BK, "    { k: 'tn_plan_pref', g: 'prefs', m: 'whole' },     /* 个性化推荐开关：只决定要不要把本机画像喂给 AI，画像本身不入库 */\n", '', 1]],
    exp: 'tn_plan_pref 应为 prefs', only: false, why: '§16 同时报「文档字段表 ↔ 策略表少一行」——两道闸互证' },
  { g: G20, name: 'N14 键名漂成 tn_plan_profile（设置页与备份登记从此对不上）',
    ed: [[PL, "var PREF_KEY = 'tn_plan_pref';", "var PREF_KEY = 'tn_plan_profile';", 1]], exp: "画像开关键名漂了", only: false,
    why: '键名是三方对账（planner/设置页/备份+文档），改一处必然多红' },

  /* ==================== §20 ④ 设置页开关 ==================== */
  { g: G20, name: 'N15 设置页开关控件没挂 id（点不出、也关不掉）',
    ed: [[SET, 'id="swAiPref"', 'id="swAiProf"', 1]], exp: '设置页没有「个性化推荐」开关控件' },
  { g: G20, name: 'N16 设置页开关不落键（关掉一次，刷新就回来）',
    ed: [[SET, "lsSave('tn_plan_pref', off() ? '1' : '0');", "toast('已切换');", 1]], exp: '设置页开关没落键' },
  { g: G20, name: 'N17 开关文案漂了（两处：标签与注释）',
    ed: [[SET, '个性化推荐', '个性推荐', 2]], exp: '开关文案漂了' },
  { g: G20, name: 'N18 副标题不再说清「只给聚合关键词、不带正文」（用户有权知道要出门的是哪几个字）',
    ed: [[SET, '（只给聚合关键词，不带游记正文）', '（只送关键词）', 1]], exp: '开关副标题没写清画像是什么' },

  /* ==================== §20 ⑤ 冒烟真测在案（判据落在真请求体上） ==================== */
  { g: G20, name: 'N19 拦 AI 请求体的桩失效（画像根本没被观测到）',
    ed: [[SMOKEP, "if (u.indexOf('chat/completions') >= 0) {", "if (u.indexOf('chat') >= 0) {", 1]], exp: '缺拦 AI 请求体的桩' },
  { g: G20, name: 'N20 「正文一个字都不发」那条反向断言改名',
    ed: [[SMOKEP, "ok('画像只出门送关键词，游记正文一个字都不发'", "ok('正文不出门'", 1]], exp: '缺正文不出门的断言' },
  { g: G20, name: 'N21 「关掉开关」那一档写错键名（关档实际没关，画像照样在体里）',
    ed: [[SMOKEP, "localStorage.setItem('tn_plan_pref', '0')", "localStorage.setItem('tn_plan_pref_x', '0')", 1]], exp: '缺关掉开关那一档' },
  { g: G20, name: 'N22 「新用户零历史」那一档变成有数据档（漏测「没历史也不许报错」）',
    ed: [[SMOKEP, 'const a2 = await aiOpen(false);', 'const a2 = await aiOpen(true);', 1]], exp: '缺新用户零历史那一档' },
  { g: G20, name: 'N23 「省市/主题/关键词逐个在体里」那条断言改名（断言还在，但闸门再也认不出它）',
    ed: [[SMOKEP, "'画像是聚合出来的：省 / 市 / 心愿单主题 / 近期关键词逐个在体里'", "'画像四个来源逐个在体里'", 1]], exp: '缺省市/主题/关键词逐个在体里' },

  /* ==================== §20 ⑥ 文档口径 ==================== */
  /* 文档类判据的切片是「## P2-8 → ## 豁免登记」，本仓库的惯例是批次落地记录也写在所属小节里，
     所以同一口径在「规格」和「批次记录」里各出现一次——变异必须整组抹干净（教训②）。 */
  { g: G20, name: 'N24 §P2-8 没写开关键名（切片内三处引用一起抹，字段表那行留给 §16 对账）',
    ed: [[DOC, '`tn_plan_pref`：**默认开', '`tn_plan_profile`：**默认开', 1], [DOC, "写 `tn_plan_pref='0'` 后重新生成", "写 `tn_plan_profile='0'` 后重新生成", 1],
      [DOC, "对账 `classOf('tn_plan_pref') === 'prefs'`", "对账 `classOf('tn_plan_profile') === 'prefs'`", 1]], exp: '§P2-8 没写开关键名' },
  { g: G20, name: 'N25 §P2-8 的隐私口径只剩一句「只送统计值」（原判据 `/不送|不带|正文/` 三个常见词任一命中就绿，等于永远绿）',
    ed: [[DOC, '：画像进 prompt，正文不出门', '：画像进 prompt', 1],
      [DOC, '红线：只送聚合关键词，游记正文（`note.text`）与原声（`note.raw`）一个字节都不出门', '红线：画像只给统计值', 1],
      [DOC, '换成两句原文逐字钉（`只送聚合关键词` 且 `正文…不出门`）', '换成两句原文逐字钉（聚合口径 + 正文不外传）', 1]],
    exp: '§P2-8 没写「只送聚合口径、正文不出门」' },
  { g: G20, name: 'N26 §P2-8 留了一个未勾选项',
    ed: [[DOC, '- [x] 关闭时不包含', '- [ ] 关闭时不包含', 1]], exp: '§P2-8 还有未勾选项' }
];

if (module.parent) { module.exports = { MUTS }; return; }

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function write(f, s) { fs.writeFileSync(path.join(ROOT, f), s, 'utf8'); }

const touched = new Set();
MUTS.forEach(m => m.ed.forEach(e => touched.add(e[0])));
const orig = {};
[...touched].forEach(f => { orig[f] = read(f); });
function restore() { [...touched].forEach(f => { if (read(f) !== orig[f]) write(f, orig[f]); }); }

function runVerify() {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const gateFails = (out, g) => out.split('\n').filter(l => l.indexOf(g) >= 0);
const otherFails = (out, g) => out.split('\n').filter(l => /FAIL/.test(l) && l.indexOf(g) < 0 && l.indexOf('=== FAIL') < 0);

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    let ok = true, why = '';
    m.ed.forEach(([f, from, , cnt]) => {
      const n = read(f).split(from).length - 1;
      if (n !== cnt) { ok = false; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 52)); }
    });
    if (!ok) { fail++; console.log('✗ ' + m.name + ' — ' + why); return; }
    m.ed.forEach(([f, from, to]) => write(f, read(f).split(from).join(to)));
    const r = runVerify();
    restore();
    const hits = gateFails(r.out, m.g), others = otherFails(r.out, m.g);
    const hit = r.out.includes(m.exp);
    const single = m.only === false ? true : hits.length === 1;
    if (r.code !== 0 && hit && single) {
      pass++;
      console.log('✓ ' + m.name + '\n    ' + (m.g === G19 ? '§19' : '§20') + ' 红 ' + hits.length + ' 条'
        + (others.length ? ' · 同时惊动别的闸门：' + others[0].slice(0, 56) : '') + ' · 命中：' + m.exp);
    } else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.exp + '」=' + hit
        + ' · ' + m.g + ' ' + hits.length + ' 条（期望' + (m.only === false ? '不限' : '恰 1）')
        + '\n    ' + (hits.length ? hits.join('\n    ') : '(该栏没红) ' + others.join(' / ')).slice(0, 700));
    }
  });
} finally {
  restore();
  [...touched].forEach(f => { if (read(f) !== orig[f]) { dirty++; console.log('!! 未还原：' + f); } });
  console.log('还原对账：' + touched.size + ' 个文件，未还原 ' + dirty + ' 个');
  const after = runVerify();
  console.log('还原后 verify.js exit=' + after.code + (after.code === 0 ? '（绿）' : '（红：' + after.out.split('\n').filter(l => /FAIL/.test(l)).join(' / ') + '）'));
}
const n19 = MUTS.filter(m => m.g === G19).length, n20 = MUTS.length - n19;
console.log('=== §19+§20 变异自测: ' + pass + ' 条按要求变红 / ' + fail + ' 条异常 / 共 ' + MUTS.length + '（§19 ' + n19 + ' 条 + §20 ' + n20 + ' 条）===');
process.exit(fail || dirty ? 1 : 0);
