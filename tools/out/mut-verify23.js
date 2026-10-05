/* UI-5 · verify.js §23（一族投影 / 两档毛玻璃 / 一张有颗粒的纸 / 遮罩 / 描边 / 括号 / 实心纸）变异自测
 *
 * 规矩（沿用 §16–§22 那几轮）：
 *  · 每条变异只砸一个「本该让 §23 变红」的点，跑 tools/verify.js，断言 exit≠0 且输出含指定短语；
 *    除 only:false 的几条，§23 这一栏必须恰好红 1 条——多红说明锚点打偏，少红说明这条线是死的。
 *  · 锚点先断出现次数（cnt），替换一律 split/join（String.replace 只换第一处）。
 *  · 跑完按内存快照逐字节还原，还原后再跑一遍 verify.js 必须绿。
 *  · 行尾：design.css 是 LF，map.css 全 CRLF，所以注入一律进 design.css；
 *    README.md 只用行内锚点（本轮不动 README）。
 *  · green:true 的条目是反向自证——「这样写不该红」。§23 最容易写成永久绿灯的三处全靠这类条目钉住：
 *    注释里的讲解反例（strip23 剥不掉就等于把示例当声明）、`backdrop-filter:none` 复位（不算第三档）、
 *    body 简写的误报面（`.body-x` / `body.theme-dark` / `background-color` 长写法 / body 的后代元素）。
 *  · 本轮砸出来的两个「闸门自己不会红」的洞，都是变异前先修掉的（见 git diff）：
 *    ① blocks() 的 `src.indexOf('{', s+1) < i` 对文件**最后一个块**返回 -1，-1 < i 恒成立 →
 *       每个文件的最后一条规则从不参与检查；已知坏样本正好是那条，于是 body 简写这半条是死的。
 *       修成 `const nx = …; if (nx !== -1 && nx < i) continue;`，T6/P6 就是砸这条线。
 *    ② selOf() 的链在 js 拼接串里断掉（`' + 'body` 这种前导引号加号），导出文档串里的 body 简写扫不到。
 *       subjectOf() 取「最后一个复合选择器」并剥掉前导非选择器字符，T7 砸这条线。
 *    ③ 附带抓到一轮真 bug：批量脚本把 `background:` 的插入偏移算到冒号上，18 个页面的 body 底色声明
 *       被改成 `backgroundbackground-coloror-bg)` 这种非法属性名——CSS 整条丢弃、肉眼看不出、
 *       而当时那版闸门也抓不到（它只找 `background:`）。已用 tools/out/fix-ui5c-mangle.js 还原。
 *  · G7 砸的是闸门侧锚点（挂点预算）：产品侧加 3 条真挂点会破坏「名单外一律实心纸」这条口径，
 *    所以把 HOOK_BUDGET 临时压到 5 来证明这条线活着（顺手把报错文案里写死的「预算 20」改成读变量——
 *    第一版 G7 就是被这句谎话判成「没命中」的）。
 *  · G4 砸出的是闸门第四个洞（本轮唯一一条「exit=0」）：glass⟺blur 的配对原先写在 hooks 循环里，
 *    而 hooks 只收「有 backdrop-filter 的块」——把 blur 整条删掉（最常见的退化）正好不在扫描面上。
 *    改成另起一遍全站扫描：凡引用 var(--glass-*) 的块必须同体挂上对应的 var(--blur-*)，否则豁免名单。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const CSS = 'design.css', VF = 'tools/verify.js', TN = 'travel-notes.js', AL = 'album.js', IX = 'index.html';
const G = '质感闸门 FAIL';

/* ---- 产品侧长锚（写全，别用短前缀） ---- */
const SOFT = '  --shadow-soft:0 1px 2px rgba(33,26,19,.04),0 12px 30px -14px rgba(33,26,19,.14);';
const MED = '  --shadow-medium:0 2px 6px rgba(33,26,19,.05),0 22px 48px -18px rgba(33,26,19,.22);';
const RISE = '  --shadow-rise:0 -2px 6px rgba(33,26,19,.05),0 -22px 48px -18px rgba(33,26,19,.22);';
const POP = '  --shadow-pop:0 20px 44px -18px rgba(27,23,19,.42);';
const BLURBAR = '  --blur-bar:blur(20px) saturate(1.5);';
const GLASSBAR = '  --glass-bar:rgba(250,248,243,.82);';
const SCRIMMODAL = '  --scrim-modal:rgba(32,32,29,.45);';
const SCRIMCOVER = '  --scrim-cover:rgba(32,32,29,.22);';
const EDGE = '  --edge-hair:rgba(33,26,19,.14);';
const EDGESOFT = '  --edge-hair-soft:rgba(33,26,19,.08);';
const NAVHOOK = '  backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)}';
const NAVBG = '  background:var(--glass-bar);border:1px solid rgba(255,255,255,.75);';
const CARDRULE = '.card{\n  background:var(--surface);\n  border:1px solid var(--edge-hair);\n  border-radius:var(--r-card);\n  box-shadow:none;';
const SEETHOOK = '.location-sheet{position:absolute;z-index:50;left:12px;right:12px;bottom:12px;max-height:82dvh;overflow-y:auto;padding:0.625rem 18px 22px;background:var(--glass-sheet);border:1px solid var(--edge-hair-soft);border-radius:30px;box-shadow:var(--shadow-float);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet);';
const SEALSHADOW = 'box-shadow:0 2px 6px rgba(32,31,27,.35)';
const GRAINPAGE = "%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E";
const GRAINPOSTER = "%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E";
const BODYGRAIN = 'background-image:var(--grain-page);background-size:140px 140px}';
const IXBODY = 'html,body{background-color:var(--color-bg);color:var(--color-ink);font-family:var(--font-body)}';
const TNDOC = 'body{background:#fff!important}';
const TNHOOK = '.tn-cfm{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;background:var(--scrim-modal);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)}';
const ALPHOTO = 'body{background:var(--color-bg);color:var(--color-ink);font-family:var(--font-sans);line-height:1.75}';
const IXINLINE = '<h1 class="hero__title fade-up" style="animation-delay:var(--motion-tap)">';
const DARKBLOCK = '  --glass-bar:rgba(29,28,25,.82);';

const MUTS = [
  /* ============ ① 一族投影 ============ */
  { name: 'P1 --shadow-soft 的弥散层 α 从 .14 漂成 .16（台账逐值核定：手感档漂了没人重跑探针）',
    ed: [[CSS, SOFT, SOFT.replace('.14);', '.16);'), 1]],
    exp: '--shadow-soft 的整串定义出现 0 次', only: false },
  { name: 'P2 --shadow-rise 自己调成 -26px/52px（不再是 medium 的 y 反向镜像，「同族反向档」名存实亡）',
    ed: [[CSS, RISE, '  --shadow-rise:0 -2px 6px rgba(33,26,19,.05),0 -26px 52px -20px rgba(33,26,19,.22);', 1]],
    exp: '不再是 --shadow-medium 的 y 反向镜像', only: false, why: '整串逐值 + 镜像推导两条一起红才是对的' },
  { name: 'P3 --shadow-pop 从单层补成双层（弹层专用档被改成贴地档）',
    ed: [[CSS, POP, '  --shadow-pop:0 1px 2px rgba(27,23,19,.04),0 20px 44px -18px rgba(27,23,19,.42);', 1]],
    exp: '--shadow-pop 不是那一条单层影' },
  { name: 'P4 冷灰族字面量复活（新写一条 rgba(30,30,28,…) 影）',
    ed: [[CSS, SOFT, SOFT + '\n.probe-p4{box-shadow:0 8px 30px rgba(30,30,28,.06)}', 1]],
    exp: '冷灰族字面量 rgba(30,30,28 还有 1 处' },
  { name: 'P5 旧别名 --sh-sm 回到 :root（删掉的族换个名字又能用了）',
    ed: [[CSS, SOFT, SOFT + '\n  --sh-sm:0 8px 30px rgba(33,26,19,.06);', 1]],
    exp: '旧冷灰投影档 --sh-* 又出现了', only: false },
  { name: 'P6 .card 直接写暖墨外影字面量（绕开 --shadow-* 档，UI-2 定案的「卡面不靠影」也被推翻）',
    ed: [[CSS, CARDRULE, CARDRULE.replace('box-shadow:none;', 'box-shadow:0 3px 10px rgba(33,26,19,.2);'), 1]],
    exp: '有暖墨族字面量外影' },
  { name: 'P7 把豁免中的蜡封章影 α 从 .35 改成 .30（豁免是逐值的，改值等于新档）',
    ed: [[CSS, SEALSHADOW, SEALSHADOW.replace('.35', '.30'), 1]],
    exp: '品牌实物影', only: false, why: '白名单计数 0 + 外影未登记，两条都该红' },
  { name: 'P8 .theme-dark 里重定义 --shadow-soft（暗档自己画一套影=第二套物理感觉）',
    ed: [[CSS, DARKBLOCK, DARKBLOCK + '\n  --shadow-soft:0 1px 2px rgba(0,0,0,.5);', 1]],
    exp: '.theme-dark 里重定义了质感 token' },

  /* ============ ② 两档毛玻璃 ============ */
  { name: 'G1 底导漏写 -webkit- 前缀（Android WebView 只认带前缀那条，这台机器上毛玻璃直接没有）',
    ed: [[CSS, NAVHOOK, '  backdrop-filter:var(--blur-bar)}', 1]],
    exp: '的 -webkit- 前缀与标准写法不配对' },
  { name: 'G2 把 bar 档改成字面 blur(14px)（第三档，且没人知道这层 GPU 谁付）',
    ed: [[CSS, NAVHOOK, '  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}', 1]],
    exp: '只许 var(--blur-bar)/var(--blur-sheet)/none', only: false, why: '值白名单 + 字面 blur( 计数两条红' },
  { name: 'G3 底导底色从 --glass-bar 换成实心 --paper-bar（底是实心的，blur 看不见但每帧照付）',
    ed: [[CSS, NAVBG, NAVBG.replace('var(--glass-bar)', 'var(--paper-bar)'), 1]],
    exp: '挂了 var(--blur-bar) 却没有同档透底' },
  { name: 'G4 拆掉底导的 blur 只留半透底（那不是毛玻璃，是脏）',
    ed: [[CSS, NAVHOOK, '}', 1]],
    exp: '用了 var(--glass-bar) 却没挂 var(--blur-bar)' },
  { name: 'G5 删掉 design.css 里 .location-sheet 的 blur-sheet 挂点（豁免名单的前提就没了，map.css 那条后发覆盖成了唯一的「像毛玻璃」）',
    ed: [[CSS, SEETHOOK, SEETHOOK.replace('backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet);', ''), 1]],
    exp: '豁免名单里的 map.css|.location-sheet', only: false, why: '豁免失效 + glass-sheet 无 blur 两条红' },
  { name: 'G6 --glass-bar 的定义在别处再写一遍（token 之外第二个真相，改 α 时它不动）',
    ed: [[CSS, GLASSBAR, GLASSBAR + '\n' + GLASSBAR, 1]],
    exp: '--glass-bar:rgba(250,248,243,.82); 全站出现 2 次（应为 1）' },
  { name: 'G7 挂点预算线（闸门侧锚点）：把 HOOK_BUDGET 从 20 压成 5，必须当场报「18 条 > 预算 5」',
    ed: [[VF, 'const HOOK_BUDGET = 20;', 'const HOOK_BUDGET = 5;', 1]],
    exp: '毛玻璃挂点 18 条 > 预算 5' },

  /* ============ ③ 纸是真的纸 ============ */
  { name: 'T1 --grain-page 去掉 feColorMatrix（彩色噪声直接贴米纸，紫绿杂点）',
    ed: [[CSS, GRAINPAGE, "%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E", 1]],
    exp: '--grain-page 没先去色' },
  { name: 'T2 --grain-page 强度从 .14 抬到 .30（改强度不重跑亮度标准差核定就是「纸面出斑」）',
    ed: [[CSS, "height='100%25' filter='url(%23g)' opacity='0.14'", "height='100%25' filter='url(%23g)' opacity='0.30'", 1]],
    exp: "--grain-page 的强度不是 .14" },
  { name: 'T3 给海报档 --grain 也加去色（两档 grain 差在去不去色，加了就分不出哪层是页面底）',
    ed: [[CSS, GRAINPOSTER, "%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E", 1]],
    exp: '--grain 不该去色' },
  { name: 'T4 卡面再铺一层 --grain-page（纸上糊沙；grain 引用应当恰好 2 处）',
    ed: [[CSS, CARDRULE, '.probe-t4{background-image:var(--grain-page);background-size:140px 140px}\n' + CARDRULE, 1]],
    exp: 'grain 引用 3 处（应为 2', only: false, why: '引用计数 + 「页面颗粒只许铺 body」两条都该红' },
  { name: 'T5 body 铺颗粒但删掉 background-size（噪声按自身尺寸平铺，颗粒粗细和别处不一致）',
    ed: [[CSS, BODYGRAIN, 'background-image:var(--grain-page)}', 1]],
    exp: '铺了 grain 却没有 background-size:140px 140px' },
  { name: 'T6 首页 body 用回 background 简写（把 --grain-page 复位成 none，CSS 一声不吭——UI-5 抓到 18 处那一条）',
    ed: [[IX, IXBODY, IXBODY.replace('background-color:', 'background:'), 1]],
    exp: '会把 body 上的 --grain-page 复位成 none' },
  { name: 'T7 导出文档串里的 body 简写改了值却没改豁免（豁免条目必须活着，否则名单会变万能洞）',
    ed: [[TN, TNDOC, 'body{background:#eee!important}', 1]],
    exp: 'body 简写豁免条目已失效', only: false, why: '未登记的简写 + 豁免条目失效，两条都该红' },

  /* ============ ④ 遮罩 ============ */
  { name: 'S1 --scrim-modal 的 α 从 .45 漂成 .50（压住多少背景是逐值核定的）',
    ed: [[CSS, SCRIMMODAL, SCRIMMODAL.replace('.45', '.50'), 1]],
    exp: '--scrim-modal:rgba(32,32,29,.45); 全站 0 次（应为 1）' },
  { name: 'S2 album.js 导出文档自带的 --scrim-photo 定义被删（离线打开相册时 var() 解析失败，整条 background 一起丢）',
    ed: [[AL, '--scrim-photo:rgba(0,0,0,.55);', '', 1]],
    exp: '--scrim-photo 的定义在 design.css（应为 design.css + album.js 两处' },
  { name: 'S3 --scrim-cover 在别处再写一遍（改 token 时它不动）',
    ed: [[CSS, SCRIMCOVER, SCRIMCOVER + '\n' + SCRIMCOVER, 1]],
    exp: '--scrim-cover:rgba(32,32,29,.22); 全站 2 次（应为 1）' },

  /* ============ ⑤ 描边一族 ============ */
  { name: 'E1 --edge-hair-soft 的 α 从 .08 漂成 .06（两档是按 α 归的，漂了就分不清哪档）',
    ed: [[CSS, EDGESOFT, EDGESOFT.replace('.08', '.06'), 1]],
    exp: '--edge-hair-soft:rgba(33,26,19,.08); 全站 0 次（应为 1）' },
  { name: 'E2 .card 描边写回暖墨字面量（.theme-dark 下等于没有线；同时砸掉 §21 的「.card 吃 --edge-hair」）',
    ed: [[CSS, CARDRULE, CARDRULE.replace('border:1px solid var(--edge-hair);', 'border:1px solid rgba(33,26,19,.14);'), 1]],
    exp: '描边还写着暖墨字面量', only: false },

  /* ============ ⑥ 声明级括号平衡 ============ */
  { name: 'B1 声明末尾多一个 )（整条声明被静默丢弃，肉眼看不出）',
    ed: [[CSS, '  box-shadow:none;', '  box-shadow:none);', 1]],
    exp: '声明括号不配对' },
  { name: 'B2 行内 style 里多一个 )（本轮抓到的一处真 bug 就在内联串里，不在 {} 里）',
    ed: [[IX, IXINLINE, '<h1 class="hero__title fade-up" style="animation-delay:var(--motion-tap))">', 1]],
    exp: '[内联] animation-delay' },
  { name: 'B3 --blur-bar 少一个 (（② 的逐值与 ⑥ 的括号两条线都要红，证明同一件事有两面在守）',
    ed: [[CSS, BLURBAR, '  --blur-bar:blur 20px) saturate(1.5);', 1]],
    exp: '声明括号不配对', only: false },

  /* ============ 反向自证：这样写不该红 ============ */
  { name: 'X1 注释里写 backdrop-filter:blur(9px) 讲解反例', green: true,
    ed: [[CSS, SOFT, '/* 反例：backdrop-filter:blur(9px) 是第三档，不许这么写 */\n' + SOFT, 1]],
    why: 'strip23 先把注释拉平；把它当声明的话字面 blur( 计数会从 2 变 3，② 见谁都红' },
  { name: 'X2 新挂点只写 backdrop-filter:none 复位（含 -webkit- 成对）', green: true,
    ed: [[CSS, SOFT, SOFT + '\n.probe-x2{backdrop-filter:none;-webkit-backdrop-filter:none}', 1]],
    why: 'none 是复位不是第三档；同时「全挂点都是 none」那条自证要求它不能把已有挂点全淹没' },
  { name: 'X3 .body-x / body.theme-dark 长写法 / body 后代元素三种一起注入', green: true,
    ed: [[CSS, SOFT, SOFT + '\n.body-x{background:#fff} body.theme-dark{background-color:#1D1C19} body .probe-x3{background:rgba(32,32,29,.06)}', 1]],
    why: 'body 简写探针只看「最后一个复合选择器是不是 body 元素」，误报会把改 token 的人逼去删闸门' },
  { name: 'X4 注入 inset 描边环与白描边各一条', green: true,
    ed: [[CSS, SOFT, SOFT + '\n.probe-x4{box-shadow:inset 0 0 0 1px rgba(32,32,29,.10);border:1px solid rgba(255,255,255,.6)}', 1]],
    why: 'inset 环是描边的另一种写法、白描边画在照片上，两类都不算「暖墨外影」也不算「暖墨字面量描边」' },
  { name: 'X5 把 .tn-cfm 的两条 backdrop-filter 成对删除（底是 --scrim-modal）', green: true,
    ed: [[TN, ';backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)}', '}', 1]],
    why: '整条挂点消失时不该报「前缀不配对」也不该报「blur 没透底」；遮罩档本来就允许有 blur 也允许没有' },
];

const orig = {}, touched = new Set();
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { if (!(f in orig)) { orig[f] = read(f); touched.add(f); } fs.writeFileSync(path.join(ROOT, f), s); };
const restore = () => Object.keys(orig).forEach(f => { if (read(f) !== orig[f]) fs.writeFileSync(path.join(ROOT, f), orig[f]); });
const runVerify = () => {
  try { const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/verify.js')], { cwd: ROOT, encoding: 'utf8' }); return { code: 0, out }; }
  catch (e) { return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') }; }
};
const gateFails = out => out.split('\n').filter(l => l.indexOf(G) >= 0);
const otherFails = out => out.split('\n').filter(l => /FAIL/.test(l) && l.indexOf(G) < 0 && !/^=== FAIL/.test(l) && !/^--- /.test(l));

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    let bad = false, why = '';
    m.ed.forEach(([f, from, , cnt]) => {
      const n = read(f).split(from).length - 1;
      if (n !== cnt) { bad = true; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 52)); }
    });
    if (bad) { fail++; console.log('✗ ' + m.name + ' — ' + why); return; }
    m.ed.forEach(([f, from, to]) => write(f, read(f).split(from).join(to)));
    const r = runVerify();
    restore();
    const hits = gateFails(r.out), others = otherFails(r.out);
    if (m.green) {
      if (r.code === 0) { pass++; console.log('✓ ' + m.name + '\n    反向自证 OK：exit=0（' + m.why + '）'); }
      else { fail++; console.log('✗ ' + m.name + '\n    期望 exit=0，实际 ' + r.code + '\n    ' + (hits.concat(others)).join('\n    ').slice(0, 600)); }
      return;
    }
    const hit = m.exp ? r.out.includes(m.exp) : hits.length > 0;
    const single = m.only === false ? true : hits.length === 1;
    if (r.code !== 0 && hit && single) {
      pass++;
      console.log('✓ ' + m.name + '\n    §23 红 ' + hits.length + ' 条'
        + (others.length ? ' · 同时惊动别的闸门：' + others[0].slice(0, 56) : '') + ' · 命中：' + m.exp);
    } else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.exp + '」=' + hit
        + ' · §23 ' + hits.length + ' 条（期望' + (m.only === false ? '不限' : '恰 1') + '）'
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
console.log('=== §23 变异自测: ' + pass + ' 条按要求变红/变绿 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' 条 ===');
process.exit(fail || dirty ? 1 : 0);
