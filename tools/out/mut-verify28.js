/* tools/out/mut-verify28.js — verify.js §28（导出日历与打印路书）变异自测
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条**红里看见它；
 * 打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 * 判红范围除 §28 外还带 §21/§23：本批有两处真问题（阶梯外字面量、background 简写）就是被这两节抓的，
 * 它们的例外表/简写线同样是活的闸。
 * 用法: node tools/out/mut-verify28.js > tools/out/b16-mut-verify28.txt 2>&1
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['planner.js', 'planner.html', 'design.css', 'tools/smoke-export.js',
  'tools/verify.js', 'tools/gen-sw-shell.cjs', 'README.md', '改进实施方案与验收标准.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() {
  FILES.forEach(f => {
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (now !== ORIG[f]) fs.writeFileSync(path.join(ROOT, f), ORIG[f]);
  });
}
process.on('exit', restore);

function verify() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}
/* §28 + 本批牵连到的 §21（字号阶梯 / 独立文档字号例外）与 §23（质感简写线） */
const pick28 = out => out.split('\n').filter(l =>
  /^FAIL §28/.test(l) || l.indexOf('字号阶梯闸门 FAIL') >= 0 || l.indexOf('质感闸门 FAIL') >= 0);
/* 各文件都是 LF（本批实测），跨行 needle 用文件自己的 EOL 拼 */
const EOL = f => (ORIG[f].indexOf('\r\n') >= 0 ? '\r\n' : '\n');
const J = (f, ...lines) => lines.join(EOL(f));
const cntOf = (s, n) => s.split(n).length - 1;

let red = 0, anomalies = 0, total = 0;
function judge(name, file, mutated, token) {
  total++;
  fs.writeFileSync(path.join(ROOT, file), mutated);
  let lines;
  try { lines = pick28(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  const hit = lines.filter(l => l.indexOf(token) >= 0);
  if (hit.length >= 1) {
    red++;
    console.log('红  ' + name + '  → 本轮红 ' + lines.length + ' 条，指定那条：' +
      hit[0].replace(/^FAIL §28 导出闸门: /, '').replace('字号阶梯闸门 FAIL: ', '§21: ').replace('质感闸门 FAIL: ', '§23: ').slice(0, 120));
  } else {
    anomalies++;
    console.log('异常  ' + name + '  打了变异但没按预期红（想找：' + token + '）；本轮红 ' + lines.length + ' 条：' +
      lines.map(l => l.slice(0, 90)).join(' | '));
  }
}
function run(name, file, from, to, token, wantCount) {
  const src = ORIG[file];
  const n = cntOf(src, from);
  const wc = wantCount === undefined ? 1 : wantCount;
  if (n !== wc) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 的 from 串命中 ' + n + ' 处，期望 ' + wc + '（源码已漂移或 needle 写错）');
    return;
  }
  if (from === to) {
    total++; anomalies++;
    console.log('异常  ' + name + '  恒等变异（from 与 to 相同），这条什么都没测');
    return;
  }
  judge(name, file, src.replace(from, () => to), token);
}
function runAll(name, file, from, to, token) {
  const src = ORIG[file];
  if (cntOf(src, from) < 1) {
    total++; anomalies++;
    console.log('异常  ' + name + '  ' + file + ' 里找不到 from 串（needle 已漂移）');
    return;
  }
  judge(name, file, src.split(from).join(to), token);
}
/* 设计内不该红的变异：反向确认下限只在跌破时生效 */
function runExpectedQuiet(name, file, from, to) {
  total++;
  const src = ORIG[file];
  if (cntOf(src, from) !== 1) { anomalies++; console.log('异常  ' + name + '  from 串不唯一'); return; }
  fs.writeFileSync(path.join(ROOT, file), src.replace(from, () => to));
  let lines;
  try { lines = pick28(verify()); }
  finally { fs.writeFileSync(path.join(ROOT, file), ORIG[file]); }
  if (lines.length === 0) console.log('静默  ' + name + '  → 0 红（**设计内**：条数下限只在被削减时起作用，它本来就不挡"临时把下限调低"这个动作）');
  else { anomalies++; console.log('异常  ' + name + '  期望不红却红了 ' + lines.length + ' 条：' + lines.map(l => l.slice(0, 80)).join(' | ')); }
}

/* ---- 基线：还原态必须 0 条红 ---- */
{
  const base = pick28(verify());
  console.log('基线（未变异）: 红 ' + base.length + ' 条' + (base.length ? '\n  ' + base.join('\n  ') : ''));
  if (base.length) { console.log('基线不干净，先修闸门再谈变异自测'); process.exit(1); }
}

/* ============ 一、折行：本批的灵魂 ============ */
run('M1 灵魂条：折行改成按字符 slice(0,75)（汉字会被劈成非法字节）', 'planner.js',
  J('planner.js',
    '  function icsFold(line) {',
    '    var enc = new TextEncoder(), cps = Array.from(line), chunks = [], buf = \'\', used = 0, budget = ICS_FOLD;',
    '    for (var i = 0; i < cps.length; i++) {',
    '      var b = enc.encode(cps[i]).length;',
    '      if (used + b > budget) { chunks.push(buf); buf = \'\'; used = 0; budget = ICS_FOLD - 1; }',
    '      buf += cps[i]; used += b;',
    '    }',
    '    chunks.push(buf);',
    '    return chunks.join(\'\\r\\n \');',
    '  }'),
  J('planner.js',
    '  function icsFold(line) {',
    '    if (line.length <= ICS_FOLD) return line;',
    '    return line.slice(0, ICS_FOLD) + \'\\r\\n \' + line.slice(ICS_FOLD, ICS_FOLD * 2);',
    '  }'),
  '.slice(');
run('M2 字节预算退回字符数（摘掉 TextEncoder）', 'planner.js',
  'var enc = new TextEncoder(), cps = Array.from(line)',
  'var enc = { encode: function (s) { return s; } }, cps = Array.from(line)',
  'icsFold 体里找不到「new TextEncoder()」');
run('M3 续行分隔符写成裸 LF（unfolding 直接散架）', 'planner.js',
  String.raw`    return chunks.join('\r\n ');`,
  String.raw`    return chunks.join('\n ');`,
  '续行 = CRLF');
run('M4 整份文件用 LF 结束（RFC 5545 硬性要求被无视）', 'planner.js',
  String.raw`    return L.join('\r\n') + '\r\n';`,
  String.raw`    return L.join('\n') + '\n';`,
  '行结束符 CRLF');
run('M5 续行预算不扣开头那个空格', 'planner.js',
  'used = 0; budget = ICS_FOLD - 1;',
  'used = 0; budget = ICS_FOLD;',
  '续行预算要扣掉开头那个空格');

/* ============ 二、日期与事件 ============ */
run('M6 空日期守卫摘掉（会落回 1970 或空 DTSTART）', 'planner.js',
  'if (!d0 || !days.length) return null;',
  'if (!days.length) return null;',
  '没有出发日期就没有事件');
run('M7 逐日日期改回跟系统语言走的 toLocaleDateString', 'planner.js',
  'var d0 = dayDate(trip, 0);',
  'var d0 = trip && trip.createdAt ? new Date(trip.createdAt).toLocaleDateString() : dayDate(trip, 0);',
  'toLocale');
run('M8 DTEND 丢了 VALUE=DATE（只有 DTSTART 是全天事件）', 'planner.js',
  "L.push('DTEND;VALUE=DATE:' + icsDay(to));",
  "L.push('DTEND:' + icsDay(to));",
  '全天事件结束');
run('M9 DTSTAMP 多拼一个 Z（探针抓到的真 bug 复发）', 'planner.js',
  String.raw`function icsStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }`,
  String.raw`function icsStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z'; }`,
  'DTSTAMP');
run('M10 把 VTIMEZONE 塞回来（全天事件根本不需要时区块）', 'planner.js',
  "L.push('END:VEVENT');",
  "L.push('BEGIN:VTIMEZONE'); L.push('END:VEVENT');",
  'VTIMEZONE');

/* ============ 三、门票腿 / 转义 / 文件名 / 通道 ============ */
run('M11 异步迟到的那份高德数据不再丢弃', 'planner.js',
  '    returned = true;',
  '    returned = returned;',
  '回调后置位');
run('M12 icsEsc 的转义顺序反了（先补逗号再补反斜杠）', 'planner.js',
  String.raw`.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')`,
  String.raw`.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\\/g, '\\\\')`,
  '转义顺序变了');
run('M13 文件名不再消毒（行程名里的 / 被当路径分隔符）', 'planner.js',
  "var fname = icsFileSafe(t.name) + '.ics';",
  "var fname = t.name + '.ics';",
  '文件名过 icsFileSafe');
run('M14 导出 MIME 退回 text/html', 'planner.js',
  String.raw`new Blob([ics], { type: 'text/calendar;charset=utf-8' })`,
  String.raw`new Blob([ics], { type: 'text/html;charset=utf-8' })`,
  'MIME 必须是 text/calendar');
run('M15 灰态改用 disabled（design.css 会把点击吃掉，用户永远听不到那句真话）', 'planner.js',
  String.raw`' style="opacity:.55"'`,
  String.raw`' disabled'`,
  '灰态用 opacity');
run('M16 AI 路线那条把已选出发日期又抹平', 'planner.js',
  '      state.selected = flatAll.slice();',
  J('planner.js', '      state.startDate = \'\';', '      state.selected = flatAll.slice();'),
  '抹日期只许在重置路径这一处');

/* ============ 四、打印路书 ============ */
run('M17 整个打印档挪出 @media print（手机上那层米白纸底被改死）', 'planner.js',
  "'@media print{' +",
  "'@media screen{' +",
  '@media print');
run('M18 独立文档的屏幕态字号退回吃 token（那里从来不解析）', 'planner.js',
  'font-size:17px;border-left:3px solid #AE5738',
  'font-size:var(--fs-8);border-left:3px solid #AE5738',
  'var(--fs-');
run('M19 打印底色改回 background 简写（会复位 --grain-page）', 'planner.js',
  'background-color:#fff',
  'background:#fff',
  'background 简写');
run('M20 日卡不再包 .daycard（分页锚点空转）', 'planner.js',
  "h += '<div class=\"daycard\">';",
  "h += '<div>';",
  '路书真把每天包进 .daycard');

/* ============ 五、抽取失效必须出声（§27 那条哑火教训） ============ */
run('M21 icsFold 改名 → 抽取失败要判红，不许静默跳过', 'planner.js',
  'function icsFold(line) {',
  'function foldIcsLine(line) {',
  '抽不出 icsFold 函数体');
run('M22 docShell 改名 → 区段抽取判红', 'planner.js',
  'function docShell(name, body) {',
  'function shellDoc(name, body) {',
  '抽不出 docShell 区段');
run('M23 ICS_FOLD 初值漂了 → ICS 区段抽不出要判红', 'planner.js',
  'var ICS_FOLD = 75;',
  'var ICS_FOLD = 74;',
  '抽不出批次 16 的 ICS 区段');
/* planner.html：把门票模块整行挪到 planner.js 之后（defer 之后执行顺序反了） */
{
  const f = 'planner.html';
  const src = ORIG[f];
  const TAG = '<script src="site-tickets.js"></script>';
  const PL = '<script src="planner.js" defer></script>';
  if (cntOf(src, TAG) !== 1 || cntOf(src, PL) !== 1) {
    total++; anomalies++;
    console.log('异常  M24 planner.html 的两行 script 标签不唯一，needle 已漂移');
  } else {
    judge('M24 site-tickets.js 挪到 planner.js 后面（导出日历时 window.SiteTickets 还不存在）', f,
      src.replace(TAG + EOL(f), '').replace(PL, () => PL + EOL(f) + TAG),
      '排到了 planner.js 后面');
  }
}

/* ============ 六、闸门自己：锚点表形状 / 正向对照 / 例外表 ============ */
run('M25 A28 少写文件字段（解构错位 → 这条锚静默哑掉）', 'tools/verify.js',
  "    ['design.css', '.btn:disabled', 1, 'pointer-events:none 在这——导出日历灰态改用 opacity 的原因，改成 disabled 会把点击吃掉'],",
  "    ['.btn:disabled', 1, 'pointer-events:none 在这——导出日历灰态改用 opacity 的原因，改成 disabled 会把点击吃掉'],",
  '四元组');
run('M26 A28 登记了 §28 没读的文件（一条都没跑过要出声）', 'tools/verify.js',
  "    ['design.css', '.btn:disabled', 1,",
  "    ['design-x.css', '.btn:disabled', 1,",
  '没读的文件');
run('M27 锚点表被整段削减', 'tools/verify.js',
  "    ['planner.js', 'function icsLine(name, val) { return icsFold(name + \\':\\' + icsEsc(val)); }', 1, '每条字段都同时过转义与折行（漏一条长 DESCRIPTION 就出界）'],",
  '',
  '锚点表被削减');
run('M28 折行那条的正向对照失效（造出来的改前形态数不出命中）', 'tools/verify.js',
  "const CTRL = flat28('function icsFold(line) { return line.slice(0, 75); }');",
  "const CTRL = flat28('function icsFold(line) { return line.substr(0, 75); }');",
  '正向对照失效');
run('M29 §21 的独立文档字号例外点名串漂了（豁免会变空转）', 'tools/verify.js',
  "    'color:#8C877D;font-size:13px}',",
  "    'color:#8C877D;font-size:13px)x',",
  '字号例外的点名串');
run('M30 §21 的独立文档字号处数漂（写第三处得先点名）', 'planner.js',
  'color:#8C877D;font-size:13px}',
  'color:#8C877D;font-size:12px}',
  '独立导出文档的字号例外');
run('M31 README 的 verify 清单不再提 §28', 'README.md',
  '§28 导出日历与打印路书',
  '导出日历与打印路书',
  'README.md 的 verify 清单没提 §28');
runAll('M32 方案文档删掉「批次 16」这一节', '改进实施方案与验收标准.md',
  '批次 16', '批次十六', '没有「批次 16」这一节');

/* ============ 七、浏览器腿不许退化 ============ */
run('M33 校验器行长退回字符数（String.length 在这里一律不算数）', 'tools/smoke-export.js',
  "const B = s => Buffer.byteLength(s, 'utf8');",
  'const B = s => s.length;',
  'String.length');
run('M34 打印介质 API 漂回不存在的那个名字', 'tools/smoke-export.js',
  "await doc.emulateMediaType('print');",
  'await doc.emulateMedia({ media: \'print\' });',
  'puppeteer 25 的打印介质');
run('M35 toast 退回只读第一条（量的是队列顺序）', 'tools/smoke-export.js',
  "querySelectorAll('.ui-toast')",
  "querySelector('.ui-toast')",
  'toast 要聚合读');
run('M36 高德腿计数被打桩（零次请求那条就不成立了）', 'tools/smoke-export.js',
  "if (u.indexOf('restapi.amap.com') >= 0) amapReqs.push(u); r.abort();",
  'r.abort();',
  '单独数高德腿');

/* ============ 七·五、sw 生成器的字体段（16-G 实测撞见：跑一次生成器把两个 woff2 从 SHELL 抹掉） ============ */
run('M37 生成器不再从 coverage.json 派生字体（下次抬版本号就漏字体）', 'tools/gen-sw-shell.cjs',
  "fs.readFileSync(path.join(dir, 'fonts/coverage.json'), 'utf8')",
  "fs.readFileSync(path.join(dir, 'fonts/coverageZZZ.json'), 'utf8')",
  '派生品牌字预缓存');
run('M38 §21 那条生成器探针自身漂了（已知正确写法匹配不上必须出声）', 'tools/verify.js',
  "const GENFONT = /readFileSync\\(path\\.join\\(dir,\\s*'fonts\\/coverage\\.json'\\)/;",
  "const GENFONT = /readFileSync\\(path\\.joinZZZ\\(dir,\\s*'fonts\\/coverage\\.json'\\)/;",
  '探针自身失效');

/* ============ 八、设计内静默（下限不挡临时调低） ============ */
runExpectedQuiet('X1 §28 锚点表下限临时调成 20', 'tools/verify.js',
  'if (A28.length < 39) F28(',
  'if (A28.length < 20) F28(');

const SHOULD_RED = total - 1;
console.log('—— 变异自测：应红 ' + SHOULD_RED + ' 条 / 实测红 ' + red + ' 条 / 设计内静默 1 条 / 异常 ' + anomalies + ' 条');
if (anomalies || red !== SHOULD_RED) { console.log('MUTATION SELFTEST FAIL'); process.exit(1); }
console.log('MUTATION SELFTEST PASS');
