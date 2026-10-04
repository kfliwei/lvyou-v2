/* UI-3 · verify.js §21（字号阶梯 / 真机档根字号 / 品牌字进包 / 卡片边界）变异自测
 *
 * 规矩（沿用 §16–§20 那几轮）：
 *  · 每条变异只砸一个「本该让闸门变红」的点，跑 tools/verify.js，断言 exit≠0 且输出含指定短语；
 *    除 only:false 的几条，§21 这一栏必须恰好红 1 条——多红说明锚点打偏，少红说明这条线是死的。
 *  · 锚点先断出现次数（cnt），替换一律 split/join（String.replace 只换第一处）。
 *  · 跑完按内存快照逐字节还原，还原后再跑一遍 verify.js 必须绿。
 *  · 行尾混用：design.css 是 LF（跨行锚点可以写 \n），index.html / sw.js / verify.js /
 *    sync-assets.js / coverage.json 一律只用行内锚点。
 *    map.css 实测全 CRLF（1410/1410 行），所以 Q5 插入的新行也写 \r\n，别在 CRLF 文件里掺裸 LF。
 *  · 锚点先断出现次数这条本轮真的拦下了一次：Q5 原锚点 `.t-row .title small{` 在 map.css 出现 4 次
 *    （34 行 / 639 行媒体查询 / 731 行 / 1109 行），harness 直接判「锚点不唯一」空跑。
 *    → 换成 34 行整条声明前缀（命中 1 次）。这不是闸门的洞，是变异的洞，但后果一样：不红就是没测。
 *  · green:true 的条目是反向自证——「这样写不该红」。它和红条目一样重要：
 *    §21 ③⑤ 都扫注释剥除后的源码，注释里举反例如果也算声明，这条线就是永久自杀开关。
 *
 * 这一轮砸出来的洞（已当场改掉，都是闸门的锅不是产品的锅）：
 *   G1 design.css「阅读字号」块在注释里举了改前的坏写法 html{font-size:16px}，③ 的探针把它当成
 *      真声明打红；⑤ 的字面量计数同理会被注释里的举例算进去。
 *      → §21 所有扫描先剥 CSS 块注释与 HTML 注释，而且剥成等长空白而不是删掉——跨行注释一旦删掉，
 *        前后两行会并成一行，⑤ 的「clamp 行跳过」就会误吞相邻声明（P7 用 green:true 钉住这条）。
 *   G2 ⑤ 里 `if (line.includes('clamp(')) continue;` 是死代码：LIT 要求 `font-size:` 后紧跟数字，
 *      而 clamp 行是 `font-size:clamp(`，那条 continue 一次都没执行过（R4 原版砸掉它 verify 仍 exit=0）。
 *      → 换成「clamp 处数逐值钉死 9 处」，R4a/R4b/R4c 三条才砸得红。
 *   G3 §12 对比度审计取 :root 块用的是「到第一个 } 为止」的非贪婪匹配，P7 往注释里塞了一个
 *      html{font-size:16px} 就把 token 表切短，后半段 --color-ink / --color-muted 全解析不出 → 9 条对比度假红。
 *      → §12 读 design.css 时同样先剥注释。这条与本节无关，但它是 P7 砸出来的，记在这里。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const CSS = 'design.css', MAP = 'map.css', VF = 'tools/verify.js', IDX = 'index.html',
  SW = 'sw.js', SY = 'tools/sync-assets.js', COV = 'fonts/coverage.json';
const G = '字号阶梯闸门 FAIL';

const MUTS = [
  /* ============ ① 阶梯逐值：改值 / 缺档 / 多档 / 单位 / 撞档 ============ */
  { name: 'P1 把 --fs-5（14px 正文）漂成 0.9rem——阶梯与闸门各记一套',
    ed: [[CSS, '  --fs-5:0.875rem;', '  --fs-5:0.9rem;', 1]], exp: '--fs-5 应为 0.875rem' },
  { name: 'P2 删掉 --fs-9 整档（引用它的地方静默 fallback 成继承值）',
    ed: [[CSS, '  --fs-9:1.25rem;     /* 20px 区块标题 */\n', '', 1]], exp: '字号阶梯缺 --fs-9' },
  { name: 'P2b 私自加一档 --fs-11:1.75rem（阶梯是账本，未核定的档=口径失控）',
    ed: [[CSS, '  --fs-10:1.5rem;', '  --fs-11:1.75rem;\n  --fs-10:1.5rem;', 1]], exp: '多出一档 --fs-11' },
  { name: 'P3 --fs-3 写成 12px（px 把系统「字体大小」缩放钉死，正是本轮收口的动机）',
    ed: [[CSS, '  --fs-3:0.75rem;', '  --fs-3:12px;', 1]], exp: '不是裸 rem', only: false,
    why: '同一档两面：既「不是 rem」又「缺 --fs-3」' },
  { name: 'P4 --fs-8 挪成与 --fs-9 同值（两档其实是一档，17px 小标题从此不存在）',
    ed: [[CSS, '  --fs-8:1.0625rem;', '  --fs-8:1.25rem;', 1]], exp: '字号阶梯撞档', only: false,
    why: '同一条口径两面：逐值核定 + 撞档检查' },

  /* ============ ② 旧名别名只能派生 ============ */
  { name: 'P5 --fs-md 偷偷带回 15px 字面量（两套正文尺寸迟早分家）',
    ed: [[CSS, '--fs-md:var(--fs-6);', '--fs-md:15px;', 1]], exp: '--fs-md 不再是纯别名' },
  { name: 'P5b 删掉 --fs-xs 别名（16 处存量引用一起失效，小字全变继承字号）',
    ed: [[CSS, '--fs-xs:var(--fs-2); ', '', 1]], exp: '旧字号别名 --fs-xs 不见了' },

  /* ============ ③ 根字号必须是相对值 ============ */
  { name: 'P6 380 档里把根字号钉回 html{font-size:16px}（用户在系统里调的字体大小整个失效）',
    ed: [[CSS, '.page-scroll{padding-left:0.75rem', 'html{font-size:16px}.page-scroll{padding-left:0.75rem', 1]],
    exp: '把根字号钉成 px', only: false, why: '同一条写法两面：③ 抓到 px 根字号，⑤ 也把它数成阶梯外字面量' },
  { name: 'P7（反向）注释里举反例 html{font-size:16px}、font-size:13px 不该算声明',
    ed: [[CSS, '单位一律 rem：', '单位一律 rem（反例写法 html{font-size:16px}、font-size:13px 只是讲解，不算声明）：', 1]],
    exp: '', green: true, why: '证明 ③⑤ 扫的是代码不是注释；不剥注释的写法会永久自杀' },
  { name: 'P8 探针写坏到抓不到 px（正向自证失效：坏样本溜过去=这条线是永久绿灯）',
    ed: [[VF, 'font-size:\\s*\\d*\\.?\\d+px/;', 'font-size:\\s*\\d*\\.?\\d+zx/;', 1]], exp: '根字号探针自身失效' },
  { name: 'P9 探针放宽到吃任何值（反向自证失效：rem/% 写法被当成钉死，闸门见谁都红）',
    ed: [[VF, 'font-size:\\s*\\d*\\.?\\d+px/;', 'font-size:\\s*\\S+?/;', 1]], exp: '根字号探针误报', only: false,
    why: '探针误报之后真实扫描面里的 html{font-size:var(--fs-7)} 也会一起红' },

  /* ============ ④ 机型档 / 用户档逐字在案 ============ */
  { name: 'Q1 452dp 真机档从 1.12 漂成 1.15（闸门与样式各记一套，真机字号对不上账）',
    ed: [[CSS, '@media (min-width:440px) and (max-width:479px){:root{--fs-bucket:1.12}}',
      '@media (min-width:440px) and (max-width:479px){:root{--fs-bucket:1.15}}', 1]], exp: '缺452dp 真机档' },
  { name: 'Q2 删掉设置页大字档乘数（「大字」那一档点了没反应，又回到假功能）',
    ed: [[CSS, 'html.font-lg{--fs-stage:1.0625}     /* 设置页大字档：17/16（原 17.5px，收进阶梯） */\n', '', 1]],
    exp: '缺设置页大字档乘数' },
  { name: 'Q3 320dp 收紧档的阈值写回 ≤375（375 是全站 px 刻度基准宽，会被压成 15px 根）',
    ed: [[CSS, '@media (max-width:360px){', '@media (max-width:375px){', 1]], exp: '缺320dp 收紧档的媒体条件' },
  { name: 'Q4 用户档重新各写一条 font-size（本轮真踩的雷：.font-sm 的 specificity 压过媒体查询里的 html，真机上「大字」比「标准」还小）',
    ed: [[CSS, 'html.font-sm{--fs-stage:.9375}', 'html.font-sm{font-size:var(--fs-6)}', 1]],
    exp: '根字号声明有 2 处', only: false, why: '同一条两面：乘数串不见了 + 单一声明塌了' },
  { name: 'Q5 map.css 里另起一处 html{font-size:1.1em}（两处根字号互相吃掉，rem 体系从此没有唯一真相）',
    ed: [[MAP, '.t-row .title small{font-family:var(--font-body);font-weight:400;font-size:var(--fs-2);',
      'html{font-size:1.1em}\r\n.t-row .title small{font-family:var(--font-body);font-weight:400;font-size:var(--fs-2);', 1]],
    exp: 'map.css 也声明了根字号' },

  /* ============ ⑤ 阶梯外字面量归零 / 尾巴 / 下限 ============ */
  { name: 'R1 design.css 一处字号退回 13px 字面量（真机档上浮时它不动，层级比例随屏幕漂）',
    ed: [[CSS, '.card p{font-size:var(--fs-sm);', '.card p{font-size:13px;', 1]],
    exp: '阶梯外字号字面量（design.css）', only: false, why: '逐处点名 + 汇总计数，同一条口径两面' },
  { name: 'R1b index.html <style> 里一处退回 14px（扫描面第二条：页面内联样式）',
    ed: [[IDX, '.hero__sub{margin-top:12px;font-size:var(--fs-5)}', '.hero__sub{margin-top:12px;font-size:14px}', 1]],
    exp: '阶梯外字号字面量（index.html）', only: false, why: '同上：点名与汇总各红一条' },
  { name: 'R2 新写一处 26px 展示级字号（尾巴 59 → 60，「只许降不许升」塌口）',
    ed: [[CSS, '.card p{font-size:var(--fs-sm);', '.card p{font-size:26px;', 1]], exp: '≥21px 字号尾巴从 59 涨到 60' },
  { name: 'R3 走阶梯的下限失效（LIT_MIN_USE 被抬到扫描面根本到不了的值，反向自证：这条线会不会报）',
    ed: [[VF, 'const LIT_MIN_USE = 600;', 'const LIT_MIN_USE = 5000;', 1]], exp: 'font-size 走阶梯的引用只剩' },
  { name: 'R4a 新加一处 font-size:clamp(...)（clamp 绕开阶梯和根字号，例外没点名就进不来）',
    ed: [[CSS, '.card p{font-size:var(--fs-sm);', '.card p{font-size:clamp(15px,4vw,18px);', 1]],
    exp: 'clamp(...) 从登记的 9 处变成 10 处' },
  { name: 'R4b 把 .section-title 的 clamp 换成固定档（例外少一处却没改账，登记数从此对不上代码）',
    ed: [[CSS, '.section-title{font-size:clamp(27px,7.4vw,36px);', '.section-title{font-size:var(--fs-10);', 1]],
    exp: 'clamp(...) 从登记的 9 处变成 8 处' },
  { name: 'R4c clamp 计数正则写坏（原「line.includes(clamp) 就跳过」是死代码，砸掉它 verify 仍绿；换成计数后必须能红）',
    ed: [[VF, 'line.match(/font-size:clamp\\(/g)', 'line.match(/font-size:clampX\\(/g)', 1]],
    exp: 'clamp(...) 从登记的 9 处变成 0 处' },

  /* ============ ⑥ 品牌衬线进包对账 ============ */
  { name: 'S1 字体文件字节数与清单不符（换过一次子集，覆盖率结论作废）',
    ed: [[COV, '"bytes":1506904', '"bytes":1506905', 1]], exp: '字节数漂了' },
  { name: 'S2 sha256 对不上（字体被换过而清单没动，等于没对账）',
    ed: [[COV, '"sha256":"8ee802839ea9', '"sha256":"9ee802839ea9', 1]], exp: 'sha256 与清单不符' },
  { name: 'S3 sw.js 预缓存里的字体条目没了（离线首屏没有品牌字，退回系统宋体）',
    ed: [[SW, "'./fonts/NotoSerifSC-400.woff2',", "'./fonts/REMOVED.woff2',", 1]], exp: '不在 sw.js 预缓存清单里' },
  { name: 'S4 OFL 授权文本探针指向不存在的文件（授权文本必须随字体同行）',
    ed: [[VF, 'fonts/OFL-1.1.txt', 'fonts/OFL-1.1-x.txt', 2]], exp: '缺 fonts/OFL-1.1' },
  { name: 'S5 缺字串少一个字符、语料跟着少一个（三数仍自洽但缺字数从 94 漂走）',
    ed: [[COV, '"corpusCjkChars":3723', '"corpusCjkChars":3722', 1],
      [COV, '"missingCjk":"䢺仫伲', '"missingCjk":"䢺仫', 1]], exp: '缺字数从登记的 94 漂到 93' },
  { name: 'S6 三数不自洽（只改语料数不改缺字串，覆盖率账目平不了）',
    ed: [[COV, '"corpusCjkChars":3723', '"corpusCjkChars":3722', 1]], exp: '覆盖率三数不自洽' },
  { name: 'S7 sync-assets 目录白名单里删掉 fonts（APK assets 会漏字体，装机后没有品牌字）',
    ed: [[SY, "['vendor', 'art', 'fonts', ", "['vendor', 'art', ", 1]], exp: '白名单里没有 fonts' },
  { name: 'S8 --font-display 队首换成系统字体名（包内字库白装，品牌字根本不生效）',
    ed: [[CSS, "--font-display:'TRACE Serif',", "--font-display:'Noto Serif CJK SC',", 1]], exp: '队首不是 TRACE Serif' },

  /* ============ ⑦ 卡片边界单一来源 ============ */
  { name: 'T1 再写第二条 .card{ 基础规则（皮肤层覆盖优先级=当年「保存键被藏死」那个坑）',
    ed: [[CSS, '  border:1px solid var(--edge-hair);\n', '  border:1px solid var(--edge-hair);\n}\n.card{padding:0}\n', 1]],
    exp: '.card 基础规则出现 2 次' },
  { name: 'T2 .card 的边框退回 var(--color-line)（450ppi 亮屏上边界是靠暖墨细线立住的，不是淡投影）',
    ed: [[CSS, '  border:1px solid var(--edge-hair);\n', '  border:1px solid var(--color-line);\n', 1]],
    exp: '.card 没引用 --edge-hair' },
  { name: 'T3 暗色 --edge-hair 值漂了一档（浅色/暗色必须各钉一条字面量）',
    ed: [[CSS, '--edge-hair:rgba(239,233,220,.16);', '--edge-hair:rgba(239,233,220,.18);', 1]],
    exp: '缺一条 --edge-hair' },
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
const gateFails = (out) => out.split('\n').filter(l => l.indexOf(G) >= 0);
const otherFails = (out) => out.split('\n').filter(l => /FAIL/.test(l) && l.indexOf(G) < 0 && l.indexOf('=== FAIL') < 0);

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
      if (r.code === 0) { pass++; console.log('✓ ' + m.name + '\n    反向自证 OK：exit=0（注释里的反例没被当成声明）'); }
      else { fail++; console.log('✗ ' + m.name + '\n    期望 exit=0，实际 ' + r.code + '\n    ' + (hits.concat(others)).join('\n    ').slice(0, 600)); }
      return;
    }
    const hit = m.exp ? r.out.includes(m.exp) : hits.length > 0;
    const single = m.only === false ? true : hits.length === 1;
    if (r.code !== 0 && hit && single) {
      pass++;
      console.log('✓ ' + m.name + '\n    §21 红 ' + hits.length + ' 条'
        + (others.length ? ' · 同时惊动别的闸门：' + others[0].slice(0, 56) : '') + ' · 命中：' + m.exp);
    } else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.exp + '」=' + hit
        + ' · §21 ' + hits.length + ' 条（期望' + (m.only === false ? '不限' : '恰 1') + '）'
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
console.log('=== §21 变异自测: ' + pass + ' 条按要求变红/变绿 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' 条 ===');
process.exit(fail || dirty ? 1 : 0);
