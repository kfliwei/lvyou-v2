/* UI-4 · verify.js §22（实景图压色 / 表面清单 / 封面描边 / 登记）变异自测
 *
 * 规矩（沿用 §16–§21 那几轮）：
 *  · 每条变异只砸一个「本该让 §22 变红」的点，跑 tools/verify.js，断言 exit≠0 且输出含指定短语；
 *    除 only:false 的几条，§22 这一栏必须恰好红 1 条——多红说明锚点打偏，少红说明这条线是死的。
 *  · 锚点先断出现次数（cnt），替换一律 split/join（String.replace 只换第一处）。
 *  · 跑完按内存快照逐字节还原，还原后再跑一遍 verify.js 必须绿。
 *  · 行尾：design.css 是 LF，map.css 全 CRLF（插入新行一律写 \r\n），README.md 只用行内锚点。
 *  · green:true 的条目是反向自证——「这样写不该红」。本轮 §22 有三处天生容易写坏成永久绿灯，
 *    全靠这类条目钉住：注释里的讲解反例（② ⑤ 扫的是剥注释后的代码）、选择器子串过宽
 *    （`.ls-img-ph` / `.eph-empty` / `.imgbox--plain` 是占位态和修饰态，不是照片表面）、
 *    以及 `!r.body.includes(...)` 的排除条件写错（那样全站每一条滤镜规则都会被判违规，闸门见谁都红）。
 *  · 这一轮当场补了闸门自己的两个洞（都是变异砸出来的，不是产品侧）：
 *    ① ③ 那组不变式原先写成「拿 WANT_* 台账常量互相比」——常量比自己永真，S2 删掉一条 veil 选择器时
 *       它一声不吭，等于永久绿灯。改成按**实际解析出的挂载**算，并补 X1–X4 四条专砸它。
 *    ② ④ 原先写成「.ls-img 里**有 box-shadow 的**那条必须含 inset 环」，于是「把整条 box-shadow 删掉」
 *       （描边照样没了）静默放行。改成「每一条 .ls-img 规则都必须含 inset 环」，C3 就是砸这个。
 *  · UI-5（质感收口）把封面影与下压影令牌化之后，这一栏跟着改了三轮，并补了四条：
 *    ① C8/C9：`::after` 现在写 `var(--scrim-cover)`，只断言「含这个 var()」是不够的——token 被改值
 *       或被整条删掉（var() 解析失败会连带丢掉整条 background）都照样绿。所以闸门锁双面：认 var()，
 *       又钉 design.css 里 `--scrim-cover:rgba(32,32,29,.22)` 逐值存在。
 *    ② V4：LOOK_RE 少了 `\s*` 时，多行规则 flat 后是「; filter:」，一条也抓不到（⑤ 变永久绿灯）。
 *       这是 UI-5 探针**当场撞到**的洞，不是假想：闸门里补 BAD_ML 多行正样本自证，V4 砸回原形。
 *    ③ V2 因此改成 only:false：正则整体瞎掉时单行/多行两条自证该一起红，只红 1 条反而说明多行那条是摆设。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const CSS = 'design.css', MAP = 'map.css', VF = 'tools/verify.js', RD = 'README.md';
const G = '实景图闸门 FAIL';

/* 真身在文件里的三条长锚（写全，别用短前缀——短前缀在本仓库撞车概率极高） */
const LOOK_RULE = '.card .ph img,.ls-img>img,.al-ch-img,.photo-wall img,.md-item .thumbs img,.eph img,.p-cell img,.n-item .th img,.story-item__stamp img,.imgbox>img{filter:var(--photo-look)}';
const VEIL_RULE = '.card .ph:has(>img)::after,.eph:has(>img)::after,.p-cell:has(>img)::after,.n-item .th:has(>img)::after,.trip-feature__img::after,.imgbox:has(>img)::after';
const INSET_RULE = '.card .ph:has(>img),.n-item .th:has(>img),.trip-feature__img,.imgbox:has(>img){box-shadow:inset 0 0 0 1px var(--photo-edge)}';
const OUT_RULE = '.al-ch-img,.photo-wall img,.md-item .thumbs img{box-shadow:0 0 0 1px var(--photo-edge)}';
/* UI-5 后这两条长锚改了：封面下压影进 --scrim-cover，外层影进暖墨族 */
const AFTER = '.ls-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,var(--scrim-cover)),var(--photo-veil);pointer-events:none}';
const LATE = '.ls-img{border-radius:18px;box-shadow:inset 0 0 0 1px var(--photo-edge),var(--shadow-medium)}';
const FIRST = 'overflow:hidden;box-shadow:inset 0 0 0 1px var(--photo-edge),var(--shadow-medium)}';

const MUTS = [
  /* ============ ① 三个 token 逐值 + 字面量双写 ============ */
  { name: 'T1 把 veil 的 α 从 .10 漂成 .14（探针实测 α=.18 时过暗样本 4→8，档位不许凭手感改）',
    ed: [[CSS, '  --photo-veil:rgba(33,26,19,.10);', '  --photo-veil:rgba(33,26,19,.14);', 1]],
    exp: '--photo-veil:rgba(33,26,19,.10) 出现 0 次', only: false, why: '同一档位两面：逐值核定 + 字面量双写扫描' },
  { name: 'T2 在别处硬写 rgba(33,26,19,.20)（绕开 --photo-edge 的第二个真相，改 token 时它不动）',
    ed: [[CSS, LOOK_RULE, '.probe-s22{box-shadow:0 0 0 1px rgba(33,26,19,.20)}\n' + LOOK_RULE, 1]],
    exp: '在全站出现 2 次' },
  { name: 'T3 --photo-look 从 saturate(.94) 改成 saturate(.88)（整批照片一起变灰，没人重跑探针）',
    ed: [[CSS, '  --photo-look:saturate(.94);', '  --photo-look:saturate(.88);', 1]],
    exp: '出现 0 次', only: false, why: '同一档位两面：逐值核定 + saturate(.94) 的双写扫描' },

  /* ============ ② 表面清单逐条（少一条=那张照片这轮没人管） ============ */
  { name: 'S1 从滤镜清单里漏掉 .story-item__stamp img（蜡封邮票里的实景照没压色，跟别的照片不同调）',
    ed: [[CSS, ',.n-item .th img,.story-item__stamp img,.imgbox>img{', ',.n-item .th img,.imgbox>img{', 1]],
    exp: '滤镜表面清单：.story-item__stamp img 缺', only: false, why: '漏一条同时打红「逐条挂载」与「清单条数对账」' },
  { name: 'S2 veil 清单漏掉 .p-cell（行程卡照片：容器定了位却没挂压色层）',
    ed: [[CSS, VEIL_RULE, '.card .ph:has(>img)::after,.eph:has(>img)::after,.n-item .th:has(>img)::after,.trip-feature__img::after,.imgbox:has(>img)::after', 1]],
    exp: 'veil 表面清单：.p-cell:has(>img)::after 缺', only: false,
    why: '实测只红 1 条——③ 那三条不变式原本拿台账常量互比（永真），砸这条时一声不吭；已改成按「实际挂载」算，漂多方向由 X1–X4 钉' },
  { name: 'S3 inset 描边清单漏掉 .trip-feature__img（精选大图与纸面之间又没有分界）',
    ed: [[CSS, ',.trip-feature__img,.imgbox:has(>img){box-shadow:inset', ',.imgbox:has(>img){box-shadow:inset', 1]],
    exp: '容器分界描边清单：.trip-feature__img 缺' },
  { name: 'S4 暗色外圈清单漏掉 .theme-dark .al-ch-img（暗色主题下章节封面变成「贴上去的」）',
    ed: [[CSS, '.theme-dark .al-ch-img,.theme-dark .photo-wall img,', '.theme-dark .photo-wall img,', 1]],
    exp: '暗色外圈翻转清单：.theme-dark .al-ch-img 缺' },
  { name: 'S5 压色容器清单漏掉 .card .ph（卡面照片的 ::after 没有定位基准，veil 贴到视口上）',
    ed: [[CSS, '.card .ph,.eph,.p-cell,.n-item .th,.trip-feature__img,.imgbox{position:relative}',
      '.eph,.p-cell,.n-item .th,.trip-feature__img,.imgbox{position:relative}', 1]],
    exp: '压色容器需有定位：.card .ph 缺' },
  { name: 'S6 把滤镜拆成两条规则各写一遍 --photo-look（改一档时另一条被忘掉）',
    ed: [[CSS, LOOK_RULE, '.eph img{filter:var(--photo-look)}\n' + LOOK_RULE, 1]],
    exp: 'filter:var(--photo-look) 写在 2 条规则里', only: false, why: '拆两条同时打红「条数对账」与「挂载点唯一」' },

  /* ============ ③ 三条不变式（按实际挂载算；X 系列就是专门砸这组的） ============ */
  { name: 'X1 给裸图 .al-ch-img 也挂 inset 环（画到替换元素内容之下，等于没画；且它没有 veil）',
    ed: [[CSS, INSET_RULE, '.card .ph:has(>img),.al-ch-img,.n-item .th:has(>img),.trip-feature__img,.imgbox:has(>img){box-shadow:inset 0 0 0 1px var(--photo-edge)}', 1]],
    exp: '挂了 inset 描边却不在清单里的表面 .al-ch-img', only: false, why: '同一写法两面：清单漂多 + inset⊄veil（描边脱离压色）' },
  { name: 'X2 给占位态 .eph-empty 挂 veil（空态被压成脏灰——:has(>img) 那条护栏就是这么来的）',
    ed: [[CSS, VEIL_RULE, '.card .ph:has(>img)::after,.eph-empty::after,.eph:has(>img)::after,.p-cell:has(>img)::after,.n-item .th:has(>img)::after,.trip-feature__img::after,.imgbox:has(>img)::after', 1]],
    exp: '挂了 veil 却不在清单里的表面 .eph-empty' },
  { name: 'X3 给 .n-item .th img 另挂一条外圈环（清单没登记；它已经吃滤镜，所以只算漂多）',
    ed: [[CSS, OUT_RULE, '.al-ch-img,.n-item .th img,.photo-wall img,.md-item .thumbs img{box-shadow:0 0 0 1px var(--photo-edge)}', 1]],
    exp: '挂了外圈描边却不在清单里的表面 .n-item .th img' },
  { name: 'X4 外圈环从裸图错挂到容器 .md-item .thumbs（环外还有容器背景，照片本身没吃滤镜）',
    ed: [[CSS, OUT_RULE, '.al-ch-img,.photo-wall img,.md-item .thumbs{box-shadow:0 0 0 1px var(--photo-edge)}', 1]],
    exp: '裸图 .md-item .thumbs 有外圈描边但没吃 --photo-look', only: false, why: '错挂同时打红「清单漂多」「外圈⊄滤镜」「清单逐条挂载」三条' },

  /* ============ ④ 封面 .ls-img：后发覆盖与 ::after 唯一 ============ */
  { name: 'C1 首发的 .ls-img 只留外扩影、丢掉 inset 环（封面与纸面失去分界）',
    ed: [[MAP, FIRST, 'overflow:hidden;box-shadow:var(--shadow-medium)}', 1]],
    exp: '.ls-img 的一条声明里没有 inset 环' },
  { name: 'C2 后发装饰段（1327 行）覆盖 box-shadow 时没带上 inset 环——本轮实测就是这个写法才救回来的',
    ed: [[MAP, LATE, '.ls-img{border-radius:18px;box-shadow:var(--shadow-medium)}', 1]],
    exp: '.ls-img 的一条声明里没有 inset 环' },
  { name: 'C3 后发段把整条 box-shadow 删掉（描边照样没了：这就是「有 box-shadow 才检查」那个洞）',
    ed: [[MAP, LATE, '.ls-img{border-radius:18px}', 1]],
    exp: '.ls-img 的一条声明里没有 inset 环' },
  { name: 'C4 封面 veil 没并进自带影那条 background（下压影独吞 ::after，压色整层消失）',
    ed: [[MAP, AFTER, '.ls-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,var(--scrim-cover));pointer-events:none}', 1]],
    exp: '.ls-img::after 没把 veil 并进同一条 background' },
  { name: 'C5 封面的「下压式」影被删（::after 只剩 veil，封面顶部不再向下压）',
    ed: [[MAP, AFTER, '.ls-img::after{content:"";position:absolute;inset:0;background:var(--photo-veil);pointer-events:none}', 1]],
    exp: '.ls-img::after 丢了封面自带「下压式」影' },
  { name: 'C6 另起第二条 .ls-img::after（同一元素只有一个 ::after，两条互相吃掉）',
    ed: [[MAP, AFTER, AFTER + '\r\n' + AFTER, 1]],
    exp: '.ls-img::after 有 2 条' },
  { name: 'C7 追加第三条 .ls-img 后发段（账本上现在只有两条；新那条还没带环）',
    ed: [[MAP, LATE, LATE + '\r\n.ls-img{border-radius:20px}', 1]],
    exp: '.ls-img 规则 3 条', only: false, why: '多一条后发段同时打红「条数」与「每条必须含 inset 环」' },
  { name: 'C8 --scrim-cover 的档位漂成 .30（::after 现在认 token，闸门必须同时钉住 token 的值，否则 var() 被改值照样绿）',
    ed: [[CSS, '  --scrim-cover:rgba(32,32,29,.22);', '  --scrim-cover:rgba(32,32,29,.30);', 1]],
    exp: '--scrim-cover 没在 design.css 里定义成 rgba(32,32,29,.22)' },
  { name: 'C9 --scrim-cover 整条定义删掉（var() 解析失败会连带丢掉整条 background，封面下压影静默消失）',
    ed: [[CSS, '  --scrim-cover:rgba(32,32,29,.22);\n', '', 1]],
    exp: '--scrim-cover 没在 design.css 里定义成 rgba(32,32,29,.22)' },

  /* ============ ⑤ 照片表面不许另写字面量滤镜 / 暗色不许重定义 token ============ */
  { name: 'L1 某页给封面另调 saturate(1.3)（一批照片里只有一张艳的，正是「一半压过一半没压」的来路）',
    ed: [[CSS, LOOK_RULE, '.ls-img>img{filter:saturate(1.3)}\n' + LOOK_RULE, 1]],
    exp: '给照片表面 .ls-img>img 另写了滤镜' },
  { name: 'L2 在 .theme-dark 里重定义 --photo-veil（分界线画在照片自己身上，不随主题翻）',
    ed: [[CSS, LOOK_RULE, '.theme-dark{--photo-veil:rgba(33,26,19,.22)}\n' + LOOK_RULE, 1]],
    exp: '在 .theme-dark 里重定义了 --photo-* token' },

  /* ============ ⑥ 死规则不许复活 ============ */
  { name: 'R1 把 .card .media 一族加回来（零调用者的选择器：留着就是「看着有其实没有」）',
    ed: [[CSS, LOOK_RULE, '.card .media{position:relative;overflow:hidden}\n' + LOOK_RULE, 1]],
    exp: '.card .media 又出现 1 次' },

  /* ============ ⑦ 登记在案 ============ */
  { name: 'G1 README 的验证命令里删掉 smoke-photo.js（下一个人不会知道压色有浏览器闸门）',
    ed: [[RD, 'node tools/smoke-photo.js', 'node tools/smoke-photoX.js', 1]],
    exp: 'README 没登记 smoke-photo.js' },
  { name: 'G2 README 的闸门清单里删掉 §22（源码侧闸门从此没人知道存在）',
    ed: [[RD, '/§22 实景图压色与分界描边', '', 1]],
    exp: 'verify.js 闸门清单里没有 §22' },

  /* ============ ⑤ 探针自身的正反向自证（砸 verify.js） ============ */
  { name: 'V1 把表面匹配的词尾护栏 (?![\\w-]) 写成 (?=.)（子串过宽：占位态 .ls-img-ph/.eph-empty 也被当成照片）',
    ed: [[VF, '(?![\\w-])/', '(?=.)/', 1]],
    exp: '照片滤镜探针误报' },
  { name: 'V2 把 LOOK_RE 写坏成抓不到 filter（正向自证失效：坏样本溜过去＝⑤ 永久绿灯）',
    ed: [[VF, 'const LOOK_RE = /(?:^|;)\\s*filter\\s*:/;', 'const LOOK_RE = /(?:^|;)\\s*zfilter\\s*:/;', 1]],
    exp: '照片滤镜探针自身失效', only: false,
    why: '正则整体瞎掉时，单行 BAD 与多行 BAD_ML 两条正向自证会一起红——红 2 条才是对的，只红 1 条说明多行那条自证是摆设' },
  { name: 'V4 把 LOOK_RE 的 \\s* 去掉（UI-5 探针当场撞到的洞：多行规则 flat 后是「; filter:」，去掉就整条放过）',
    ed: [[VF, 'const LOOK_RE = /(?:^|;)\\s*filter\\s*:/;', 'const LOOK_RE = /(?:^|;)filter:/;', 1]],
    exp: '照片滤镜探针漏多行写法' },
  { name: 'V3 把「吃 token 的不算违规」那条件写错（反向自证失效：全站每条合规滤镜都被判违规）',
    ed: [[VF, "!r.body.includes('var(--photo-look)')", "!r.body.includes('var(--photo-lookzz)')", 1]],
    exp: '照片滤镜探针误报', only: false, why: '排除条件写坏后 design.css 自己那条合规规则也会一起红' },

  /* ============ 反向自证：这样写不该红 ============ */
  { name: 'K1（反向）注释里举反例 .theme-dark{--photo-veil:rgba(33,26,19,.22)} 与 .ls-img>img{filter:saturate(1.3)}，不算声明',
    ed: [[CSS, '   只压「真有照片」的那一层：',
      '   只压「真有照片」的那一层（讲解用反例 .theme-dark{--photo-veil:rgba(33,26,19,.22)}、.ls-img>img{filter:saturate(1.3)} 写在注释里，不算声明）：', 1]],
    exp: '', green: true, why: '证明 §22 扫的是剥注释后的代码；不剥注释的写法会永久自杀' },
  { name: 'K2（反向）给占位态/修饰态写滤镜：.ls-img-ph / .eph-empty / .imgbox--plain 不是照片表面',
    ed: [[CSS, LOOK_RULE,
      '.card:hover .ls-img-ph{filter:sepia(.3)}\n.eph-empty{filter:grayscale(.2)}\n.imgbox--plain{filter:brightness(1.02)}\n' + LOOK_RULE, 1]],
    exp: '', green: true, why: '证明词尾护栏在：子串式匹配会把这三条一起打红' },
];

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
const gateFails = out => out.split('\n').filter(l => l.indexOf(G) >= 0);
const otherFails = out => out.split('\n').filter(l => /FAIL/.test(l) && l.indexOf(G) < 0 && l.indexOf('=== FAIL') < 0);

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    let bad = false, why = '';
    m.ed.forEach(([f, from, , cnt]) => {
      const n = read(f).split(from).length - 1;
      if (n !== cnt) { bad = true; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 46)); }
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
      console.log('✓ ' + m.name + '\n    §22 红 ' + hits.length + ' 条'
        + (others.length ? ' · 同时惊动别的闸门：' + others[0].slice(0, 56) : '') + ' · 命中：' + m.exp);
    } else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.exp + '」=' + hit
        + ' · §22 ' + hits.length + ' 条（期望' + (m.only === false ? '不限' : '恰 1') + '）'
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
console.log('=== §22 变异自测: ' + pass + ' 条按要求变红/变绿 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' 条 ===');
process.exit(fail || dirty ? 1 : 0);
