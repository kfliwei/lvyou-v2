/* tools/out/mut-verify50.js — verify.js §50「云同步失败出口闸门」变异自测 · 源码腿 + 浏览器腿
 *
 * 每条变异只改一处，跑一遍 node tools/verify.js，必须在**指定的那条 §50 红**里看见它，
 * 并且整跑不绿（红字印了但退出码 0＝闸门没装）。打不红＝那条锚是假绿灯。跑完逐字节还原（含异常退出）。
 *
 * 这一节为什么格外需要这张网：它守的是「一句人话」。源码锚能钉住「那句死话此刻不在代码里」，
 * 钉不住「失败的时候页面上落的究竟是哪一句」——所以 ④ 那一族把「源码腿全绿而浏览器腿指名红」
 * 专门列成一类：那一类靶子证明的是这条腿在量代码量不到的东西，而不是在重复源码锚。
 *
 * §50 的靶子分四类：
 *   ① 出口与探活被拆（R01–R21）：那句「App 内弹不出来」回潮／401 退回只报号码／netHint 退回单入参／
 *      合流处那句统一出口被摘／中性分支退回没出口的「做不到」／no-cors 摘掉／探活带上凭据／
 *      探活改打 /dav/／探活回到共用 30s／编程错误被人话盖住／外抄原文的旧 throw／record 不过 redact／
 *      withTimeout 退回一根保险丝／口令框 placeholder 回潮／预设钮摘线／预设地址与腿分叉／
 *      桩的掐连接档摘掉／桩的挑战头摘掉／离线那句绕到密码／分支里各抄一份出口／兜底只报号码。
 *   ② 守卫自己（S01–S22）：两把共享剥刀各自的定义行、盲区哨兵表、A50/ZERO50 四元组形状、
 *      A50 登记了没读的文件、ZERO50 的正向对照失效、四把派生扫描各自的自校准与阈值（按 §47/§48/§49
 *      的教训一律打**阈值或条件取反**，不打「摘掉那一支」——干净树上它们本来静默，摘掉不会独红）、
 *      「裸 App 内不许进黑名单」那条自指纪律、分母下界、两把取段子的查找串、e.message 例外计数、
 *      redact 落点下界、④ 的循环上限与最大编号对账。
 *   ③ 浏览器腿脚手架（T01–T16）：屏档、tn_onboarded、真鼠标点入口、等落定不等固定毫秒、NO_EXIT 表（整行）与
 *      它自己的「有牙」自校准、条数守卫阈值、判据改名两条（W09/W15）、直调反证那一发的协议、什么都不听的那档端口、
 *      桩侧裸 GET 读数、W07 读记录而不是读 #wdStatus、口令对账的 filter 形、README 两处登记被抹。
 *   ④ 两条腿的分工样本（U01–U04：源码腿必须全绿，浏览器腿必须红在指名那条 W）：
 *      U01 settings 把结果一律写成 err 档（§50 没锚这一行的颜色选择）→ W01 红；
 *      U02 test() 的 catch 把失败记成 ok:true（锚钉的是 redact 与 record 的落点，不是那个布尔）→ W07 红；
 *      U03 桩不再校密码（源码锚钉的是 dropMethods / requireChallenge 两个开关，不是 authed 的判据）→ W02 红；
 *      U04 offline() 恒 false（§50 锚的是「离线那句说什么」，不是这个判据本身）→ W12 红。
 *   为什么必须有 ④：本节的立论是「失败时落的那一句必须真点出来才作数」，源码腿读的是串的在场、
 *      计数的相等、句子里有没有动词，读不到「那一下点下去屏幕上究竟写了什么」；①②③ 全对也只证明锚在场。
 *
 * 登记一条本网不假装覆盖的盲区：把 A50 / ZERO50 表里**整条锚删掉**不会红——§50 没有表长守卫
 *   （网自己在基准里对账摘要行的「A50 表长 45 条、ZERO50 表长 9 条」，删一条锚那行会变成 44/9，
 *   但这个数只印在日志里、不进退出码）。所以要砍锚得连产品串一起砍（R 类各条覆盖了这一支）。
 *
 * 登记第二条设计内盲区（与 §47/§48/§49 同因）：四把派生扫描各自的**自校准那一支**、段两头取不到那一支，
 *   原样摘掉都不会红——干净树上它们本来就是静默的。所以 S08/S11/S12/S13/S14/S15/S16/S17/S18/S21 打的是
 *   条件取反、阈值与查找串，证的是「这一支是活的、消息能落地」，而不是「摘掉有人报」。
 *
 * 记一条 token 口径：verify.js 印 A50/ZERO50 的红时 needle 只写前 52／48 字，所以 token 一律取
 *   why／reason 里的一段，或取自定义消息的整句片段；本网没有一条 token 跨在 slice 边界上。
 *
 * 首跑 62 条 → 55/4/3，那 3 条异常各留下一件实物（这一族是第四次，见 §47/§48/§49 的同类登记）：
 *   T05 是**一条假绿灯**：§50 的 ④ 原本只钉「const NO_EXIT」六个字，把表改名带缩窄
 *   （NO_EXIT_Q = /弹不出来|做不到/）照样命中 1，于是源码腿 0 红、整跑还绿——「表被掏空」这件事
 *   两腿都没人守。改法两步：④ 现在钉整行（改名／缩窄／掏空都当场 0 命中），并在腿里给这张表加一行
 *   NO_EXIT_OK 正向自校准（拿表里四种句式各命中一次），④ 同时数这一行的在场——掏空表与摘掉自校准
 *   是两条不同的靶子（T05／T16），各配各的红。
 *   R20 与 S16 是**同一个我的错**：两条都写了 token「句分支文案，期望 4」，而 verify.js 那句消息里的
 *   「期望 3」是**抄的第二遍**，不是从条件里来的。R20 现场印「读到 4 句分支文案，期望 3」（闸门是活的，
 *   我 token 写反）；S16 把条件抬成 4 后印的还是「期望 3」（闸门印了一句谎）。修法：分支数只写一次
 *   const ARMS50 = 3，条件与文案都从它来；S16 改打这一行，token「句分支文案，期望 4」从此名副其实，
 *   R20 的 token 改成「读到 4 句分支文案」。
 *
 * 用法:
 *   node tools/out/mut-verify50.js --selfcheck      # 只跑内部自测（预检自己必须能抓到坏靶子）
 *   MUT_PREFLIGHT=1 node tools/out/mut-verify50.js  # 只数 from 串命中，不动树
 *   MUT_ONLY=R01,S03 node tools/out/mut-verify50.js # 只复打指名的几条（预检与基准照样跑全量）
 *   MUT_LOG=tools/out/b36-mut-verify50.txt node tools/out/mut-verify50.js
 * **不要与别的变异网或像素基线并行**：本网动的是 sync-webdav.js／settings.html／tools/webdav-stub.js／
 *   tools/smoke-webdav.js／tools/verify.js／README.md，与 mut-verify46/47/48/49 重叠 tools/verify.js 与
 *   README.md（47 还重叠 sync-webdav.js 与 settings.html，48 重叠 settings.html，39 重叠 settings.html）；
 *   像素基线量的就是同一批屏。
 *   跑的时候别编辑这些文件——还原用的是启动时的快照，会把并发编辑一并抹掉。
 *   U 类会重跑 tools/smoke-webdav.js（它自己把读数落到固定名 tools/out/b36-smoke-webdav.txt），
 *   所以跑完要在干净树上复跑一次这条腿，把被变异覆盖掉的读数盖回来。
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* 独占锁：同一时间只许一张变异网动树。认所有 .mut*.lock，不认自己那一个名字。 */
const OUTDIR = path.join(ROOT, 'tools', 'out');
const LOCK = path.join(OUTDIR, '.mut50.lock');
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) {} }
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
catch (e) { console.log('中止：' + LOCK + ' 已存在（另一张变异网正在动树，读数会全废）'); process.exit(2); }
const BUSY = fs.readdirSync(OUTDIR).filter(f => /^\.mut\d+\.lock$/.test(f) && f !== '.mut50.lock');
if (BUSY.length) { unlock(); console.log('中止：' + OUTDIR + ' 里还有别的变异网锁 ' + BUSY.join('、') + '（快照可能与本网重叠，并发跑两边读数全废）'); process.exit(2); }

const LOG = process.env.MUT_LOG || '';
const LOGP = LOG ? (path.isAbsolute(LOG) ? LOG : path.join(ROOT, LOG)) : '';
const rawLog = console.log.bind(console);
if (LOGP) fs.writeFileSync(LOGP, '');
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  rawLog(s);
  if (LOGP) fs.appendFileSync(LOGP, s + '\n');
};

const FILES = ['sync-webdav.js', 'settings.html', 'tools/webdav-stub.js',
  'tools/smoke-webdav.js', 'tools/verify.js', 'README.md'];
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
  ['tools/verify.js', '/* ④ 浏览器腿齐备检：W01–W14 逐条在场'],
  ['tools/verify.js', 'const flat50 = s => ws50(stripBlockComments(s));'],
  ['tools/verify.js', 'const view50 = f => /\\.md$/.test(f) ? ws50(rd50(f)) : flat50(rd50(f));'],
  ['tools/verify.js', "const DEAD50 = ['弹不出来', '做不到', '不允许浏览器直连', '此环境不支持', '无解', '直连可用，不需要 Java 桥'];"],
  ['tools/verify.js', "const ONLY50 = \"var msg = String((e && e.message) || e);\";"],
  ['tools/verify.js', 'const ARMS50 = 3;'],
  ['tools/verify.js', "cnt50(S50, 'const NO_EXIT_OK =')"],
  ['tools/verify.js', 'if (bads.length !== 1 || bads[0].indexOf(ONLY50) < 0)'],
  ['tools/verify.js', "    for (let i = 1; i <= 14; i++) {\n      const lab = \"ok('W\""],
  ['sync-webdav.js', "var APP_PW = '坚果云 / Nextcloud / 群晖要填在网页版单独生成的「应用密码」，不是登录密码';"],
  ['sync-webdav.js', 'function netHint(c, reached) {'],
  ['sync-webdav.js', "return withTimeout(fetch(m[1] + '/', { mode: 'no-cors', cache: 'no-store' }), REACH_TIMEOUT)"],
  ['settings.html', '<button type="button" id="wdPresetJg">坚果云：填标准地址</button>'],
  ['tools/webdav-stub.js', 'if (opts.dropMethods && opts.dropMethods.indexOf(req.method) >= 0) { req.socket.destroy(); return; }'],
  ['tools/smoke-webdav.js', 'const P_DEAD = 8799;'],
  ['tools/smoke-webdav.js', 'checks >= 14'],
  ['README.md', '§50 云同步失败出口'],
  ['README.md', 'smoke-webdav'],
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
function gBoth(name, edits, want) { CASES.push({ name, edits, want, kind: 'silentB' }); }

/* ---------- ① 出口与探活被拆：sync-webdav.js ---------- */
t('R01 那句死话回来了（用户点单逐字报的那件事：看完就没再点第二次的那一句）', [['sync-webdav.js',
  "      ? '能连上这台服务器，但这发请求没拿到响应：先按「账号或密码被拒绝」来查'",
  "      ? '能连上这台服务器，但这发请求没拿到响应（它会要求弹窗认证，App 内弹不出来）'"]],
  '这一族的判据不是「措辞不好看」');
t('R02 401/403 退回只报号码（用户听到「不对」，不知道哪里不对、该换成什么）', [['sync-webdav.js',
  "    if (status === 401 || status === 403) return '账号或密码被拒绝（' + status + '）：' + APP_PW;",
  "    if (status === 401 || status === 403) return '账号或密码不对（' + status + '）';"]],
  '那一支退回只有号码没有出口');
t('R03 netHint 退回只认原始错误串的单入参形状（reached 没了，三条分支就合成一句，可达与不可达再也分不出来）', [['sync-webdav.js',
  '  function netHint(c, reached) {', '  function netHint(c, raw) {']],
  'netHint 回到只认原始错误串的形状');
t('R04 合流处那句统一接出口被摘（三分支各自说完就 return，谁都不会再提应用密码）', [['sync-webdav.js',
  "    if (c && (c.user || c.pass)) m += '。' + APP_PW;", '    /* 不接出口 */']],
  '合流处那句统一接出口读不到');
t('R05 探不出来那一档退回没出口的「做不到」（本节的核心不变式：每一句必须留一个做得动的动作）', [['sync-webdav.js',
  "        : '连不上 WebDAV 服务：这一发没测出这台设备能不能到那台服务器，先再点一次「测试连接」重试';",
  "        : '连不上 WebDAV 服务：这个环境做不到，谁也帮不了你';"]],
  '支没有出口（命中死话句式或一个动词都没有）');
t('R06 探活的 no-cors 摘掉（普通 GET 要 CORS、带凭据还要预检，探活自己先失败＝这一发永远答不出「可达吗」）', [['sync-webdav.js',
  "fetch(m[1] + '/', { mode: 'no-cors', cache: 'no-store' })", "fetch(m[1] + '/', { cache: 'no-store' })"]],
  'no-cors 那处读到 0 处');
t('R07 探活带上凭据（就不再是简单请求：浏览器先发预检，服务器一挑战把探活自己卡住）', [['sync-webdav.js',
  "fetch(m[1] + '/', { mode: 'no-cors', cache: 'no-store' })",
  "fetch(m[1] + '/', { mode: 'no-cors', cache: 'no-store', headers: headers(c) })"]],
  '里出现了凭据或自定义头');
t('R08 探活改打 /dav/（坚果云的 /dav/ 对无凭据请求回 401 + 挑战，撞上它自己要诊断的那个认证框）', [['sync-webdav.js',
  "fetch(m[1] + '/', { mode: 'no-cors'", "fetch(m[1] + '/dav/', { mode: 'no-cors'"]],
  '不再拼根路径');
t('R09 探活回到共用那根 30s 保险丝（失败路径总共 60s，用户等到的是「卡住了」而不是一句话）', [['sync-webdav.js',
  "cache: 'no-store' }), REACH_TIMEOUT)", "cache: 'no-store' }), TIMEOUT)"]],
  '期望 2（定义 + 使用）');
t('R10 编程错误也被人话盖住（那一行是「别把 bug 说成网盘的错」唯一的守卫）', [['sync-webdav.js',
  '      if (!/超时|Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) throw e;', '      if (false) throw e;']],
  '不许被人话盖住');
t('R11 网络层失败退回不探活、直接把上游原文拼给人看（里面可能是带 user:pass 的 URL）', [['sync-webdav.js',
  "      return reach(c).then(function (reached) {\n        throw new Error((/超时/.test(msg) ? '等满 ' + (TIMEOUT / 1000) + ' 秒没响应：' : '') + netHint(c, reached));\n      });",
  "      throw new Error(netHint(c, /Failed to fetch|NetworkError|Load failed|CORS/i.test(String(e && e.message)) ? '' : e && e.message));"]],
  '网络层失败不发探活那一发');
t('R12 失败原文不过 redact 就写进 tn_webdav_last（它会显示在 #wdStatus，而带 URL 的错误可能含口令）', [['sync-webdav.js',
  'try { body = Backup.serialize(env); } catch (e) { record(false, redact(e.message)); cb(e); return; }',
  'try { body = Backup.serialize(env); } catch (e) { record(false, e.message); cb(e); return; }']],
  '就写进 tn_webdav_last');
t('R13 withTimeout 退回只有一根 30s（limit 参数没了＝探活那发跟着等满 30s）', [['sync-webdav.js',
  "      var limit = ms || TIMEOUT;\n      var t = setTimeout(function () { if (!done) { done = true; rej(new Error('请求超时（' + (limit / 1000) + 's）')); } }, limit);",
  "      var t = setTimeout(function () { if (!done) { done = true; rej(new Error('请求超时（' + (TIMEOUT / 1000) + 's）')); } }, TIMEOUT);"]],
  'withTimeout 退回只有一根 30s');
t('R14 口令框退回那句「请用应用密码」（没说去哪拿也没说填错会怎样——正是那台设备真实踩到的坑）', [['settings.html',
  'placeholder="坚果云要填「应用密码」，不是登录密码"', 'placeholder="坚果云等平台请用「应用密码」"']],
  '它没说去哪拿');
t('R15 那颗地址预设钮摘线（屏上一块能看不能点的按钮，§49 那一族同因）', [['settings.html',
  "$('wdPresetJg').onclick = function () {", "$('wdPresetJgX').onclick = function () {"]],
  '那颗钮真接了线');
t('R16 产品填的地址少一段 /dav/ 而腿照旧（那条腿从此守的是另一件事，产品那串写错也照样绿）', [['settings.html',
  "$('wdUrl').value = 'https://dav.jianguoyun.com/dav/';", "$('wdUrl').value = 'https://dav.jianguoyun.com/dav';"]],
  '产品填的地址与腿断言的地址不一致');
t('R17 桩的掐连接档摘掉（netHint 那条探活分支从此永远测不到——「拿不到状态码」那一发没有形状了）', [['tools/webdav-stub.js',
  '      if (opts.dropMethods && opts.dropMethods.indexOf(req.method) >= 0) { req.socket.destroy(); return; }',
  '      if (false) { req.socket.destroy(); return; }']],
  '这一支复现的是');
t('R18 桩的挑战头摘掉（坚果云形状那一档从此不存在，W05 钉的那条实测结论没人再守）', [['tools/webdav-stub.js',
  'if (opts.requireChallenge) h[\'WWW-Authenticate\'] = \'Basic realm="stub"\';',
  'if (opts.requireChallenge) h[\'X-Nothing\'] = \'y\';']],
  '坚果云形状那一档保留开关');
t('R19 离线那句绕到密码（离线本身已经由 send() 说了，再提密码就是把两件事混成一件）', [['sync-webdav.js',
  "if (offline()) return Promise.reject(new Error('当前离线，稍后再试'));",
  "if (offline()) return Promise.reject(new Error('当前离线：先核对账号或应用密码'));"]],
  '离线那句只说离线');
t('R20 出口在分支里各抄一份（本节立论是「只写一次、几处共用」；抄第二份就会有一支漏掉或走样）', [['sync-webdav.js',
  "    if (c && (c.user || c.pass)) m += '。' + APP_PW;",
  "    if (c && (c.user || c.pass)) { m += '。'; m += '这里再抄一遍应用密码的说明文案'; }"]],
  '读到 4 句分支文案');
t('R21 兜底那一支退回只报一个号码（号码不是出口，「先重试一次，再拿这个号码去找网盘」才是）', [['sync-webdav.js',
  "    return '服务器返回 HTTP ' + status + '，先再点一次「测试连接」重试；还是这样就拿这个号码去找网盘那边';",
  "    return '服务器返回 HTTP ' + status;"]],
  '号码不是出口');

/* ---------- ② 守卫自己 ---------- */
t('S01 flat50 定义行不再走那把共享剥刀（注释里抄的改前原串会被当成代码在场）', [['tools/verify.js',
  'const flat50 = s => ws50(stripBlockComments(s));', 'const flat50 = s => ws50(s);']],
  'flat50 定义行没走那把共享剥刀');
t('S02 view50 退回「文档也剥注释」那一支（README 的批次 8 那条登记天生要写那句死话的原文）', [['tools/verify.js',
  'const view50 = f => /\\.md$/.test(f) ? ws50(rd50(f)) : flat50(rd50(f));', 'const view50 = f => flat50(rd50(f));']],
  '文档也剥注释');
t('S03 盲区哨兵表里那一枚换成树上没有的串（这一带又变成盲窗，住在里面的期望 0 会静默满足）', [['tools/verify.js',
  `['settings.html', 'id="wdHelp"']`, `['settings.html', 'id="wdHelpX"']`]],
  '盲区哨兵');
t('S04 A50 有一条多塞一个字段（四元组形状不整即红，跳过不再静默 return）', [['tools/verify.js',
  '"var APP_PW = \'坚果云 / Nextcloud / 群晖要填在网页版单独生成的「应用密码」，不是登录密码\';", 1, \'出口只写一次',
  '"var APP_PW = \'坚果云 / Nextcloud / 群晖要填在网页版单独生成的「应用密码」，不是登录密码\';", 1, 1, \'出口只写一次']],
  'A50 有一条不是');
t('S05 ZERO50 有一条多塞一个字段（那条期望 0 的正向对照等于没有）', [['tools/verify.js',
  '["sync-webdav.js", "record(false, e.message); cb(e);",', '["sync-webdav.js", \'zz\', "record(false, e.message); cb(e);",']],
  'ZERO50 有一条不是');
t('S06 A50 登记了本节没读的文件（锚等于没跑）', [['tools/verify.js',
  "['tools/smoke-webdav.js', 'const VW = 328, VH = 723;', 1,", "['wishlist.html', 'const VW = 328, VH = 723;', 1,"]],
  '登记了 §50 没读的文件');
t('S07 ZERO50 的正向对照失效（那个 0 就不是证据：对照串里读不到 needle）', [['tools/verify.js',
  `      "    if (status === 401 || status === 403) return '账号或密码不对（' + status + '）';"`,
  `      "    if (status === 401 || status === 403) return '账号或密码被拒绝（' + status + '）：' + APP_PW;"`]],
  '正向对照失效了');
t('S08 死话那把刀的自校准期望从 6 抬成 7（干净树当场红并印出消息，证这一支活着）', [['tools/verify.js',
  '    if (calN !== 6) F50(\'死话句式那把刀自校准失准', '    if (calN !== 7) F50(\'死话句式那把刀自校准失准']],
  '死话句式那把刀自校准失准');
t('S09 产品面分母下界抬到 600（readdir 或过滤条件被动过时，这把刀不再覆盖全产品却自己不说）', [['tools/verify.js',
  'if (ROOT50.length < 60)', 'if (ROOT50.length < 600)']],
  '产品面扫描的分母掉成这样');
t('S10 「裸 App 内不许进黑名单」那条自指纪律取反（加进去会把八处合法用法判红，然后整把刀被人关掉）', [['tools/verify.js',
  "if (DEAD50.indexOf('App 内') >= 0)", "if (DEAD50.indexOf('App 内') >= -1)"],],
  '产品面有八处合法用法');
t('S11 出口句式那把刀自校准期望从 3 抬成 4（读不到分支就等于没检查）', [['tools/verify.js',
  'if (arms50(CAL50B).length !== 3)', 'if (arms50(CAL50B).length !== 4)']],
  '出口句式那把刀自校准失准');
t('S12 出口句式那把刀的反向自校准挪成 2（合成样本里那句没出口的分支不再必须被抓到＝真代码里那句照样过）', [['tools/verify.js',
  'if (bad50arms(CAL50B).length !== 1)', 'if (bad50arms(CAL50B).length !== 2)']],
  '反向自校准失准');
t('S13 netHint 两头查找串换掉（读不到那一段时，③(b) 的逐条要求不作数）', [['tools/verify.js',
  "const s50b = raw50b.findIndex(L => L.indexOf('function netHint(c, reached) {') >= 0);",
  "const s50b = raw50b.findIndex(L => L.indexOf('function netHintX(c, reached) {') >= 0);"]],
  '读不到 netHint 的两头');
t('S14 reach 两头查找串换掉（下面那几项关于「裸请求」的判据当场失明）', [['tools/verify.js',
  "const s50c = raw50c.findIndex(L => L.indexOf('function reach(c) {') >= 0);",
  "const s50c = raw50c.findIndex(L => L.indexOf('function reachX(c) {') >= 0);"]],
  '读不到 reach 的两头');
t('S15 redact 那把刀的自校准期望从 1 挪成 0（抓不到就等于下面那句 0 是假的）', [['tools/verify.js',
  'if (CAL50D.filter(isBad).length !== 1 ||', 'if (CAL50D.filter(isBad).length !== 0 ||']],
  'redact 那把刀自校准失准');
t('S16 netHint 分支数阈值抬成 4（现场读 3 也算对，表自己说谎时没人管）', [['tools/verify.js',
  'const ARMS50 = 3;', 'const ARMS50 = 4;']],
  '句分支文案，期望 4');
t('S17 e.message 例外计数阈值抬成 2（登记的唯一例外从此没人守）', [['tools/verify.js',
  'if (bads.length !== 1 || bads[0].indexOf(ONLY50) < 0)', 'if (bads.length !== 2 || bads[0].indexOf(ONLY50) < 0)']],
  '登记的例外只有 send() 里那一行');
t('S18 redact 落点下界那一支条件取反（8 > 6 干净树当场红，证这一支活着；原样摘掉不会独红）', [['tools/verify.js',
  "if (cnt50(V50['sync-webdav.js'], 'redact(') < 7)", "if (cnt50(V50['sync-webdav.js'], 'redact(') > 6)"]],
  '每条失败路径都过一遍脱敏');
t('S19 ④ 那条数守卫的期望次数抬成 2（W01–W15 里任意一条被改名就不会红在「恰 1 处」上）', [['tools/verify.js',
  "if (cnt50(S50, 'checks >= 14') !== 1)", "if (cnt50(S50, 'checks >= 14') !== 2)"]],
  '条数守卫不在了或阈值被挪');
t('S20 ④ 齐备检循环上限收窄一格（W14 从此没人守，而且它自己永远不会红）', [['tools/verify.js',
  '    for (let i = 1; i <= 14; i++) {\n      const lab = "ok(\'W"', '    for (let i = 1; i <= 13; i++) {\n      const lab = "ok(\'W"']],
  '循环上限是 13');
t('S21 ④ 那条句式表在场判据抬成 2（把表改名或整枚删掉就不再红在「恰 1 处」上）', [['tools/verify.js',
  "') !== 1 || cnt50(S50, 'const NO_EXIT_OK =') !== 1) {", "') !== 2 || cnt50(S50, 'const NO_EXIT_OK =') !== 2) {"],],
  '两个都要恰 1');
t('S22 上限与真实最大编号的对账挪成「等于编号本身」（少守一条判据却自称对过账）', [['tools/verify.js',
  'else if (Number(BOUND50) !== MAXN50 - 1)', 'else if (Number(BOUND50) !== MAXN50)'],],
  '而这条腿里真实最大编号是 W15');

/* ---------- ③ 浏览器腿脚手架与登记 ---------- */
t('T01 屏档退回 452×995（量的不是用户那块屏，「失败时页面上落哪一句」就不是同一件事）', [['tools/smoke-webdav.js',
  'const VW = 328, VH = 723;', 'const VW = 452, VH = 995;']],
  '必须量用户那块屏');
t('T02 不打 tn_onboarded 标记（首启引导蒙层 z9990 吃掉真鼠标点击，症状酷似「失败文案没落地」）', [['tools/smoke-webdav.js',
  "localStorage.setItem('tn_onboarded', '1');", "localStorage.setItem('tn_onboarded_off', '1');"]],
  '不打这个标记');
t('T03 「测试连接」那颗钮被改名（真鼠标点空＝那一发从没发生，而判据会读到上一发的旧字）', [['tools/smoke-webdav.js',
  "await page.click('#wdTestBtn');", "await page.click('#wdTestBtnX');"]],
  '判据必须由真鼠标点出来');
t('T04 等落定的谓词挪一格（不再等「那句话落定」而是睡固定毫秒，读回来的可能是「正在连接 …」）', [['tools/smoke-webdav.js',
  "e.textContent.indexOf('正在连接') !== 0;", "e.textContent.indexOf('正在连接') !== 1;"]],
  '等的是「那句话落定」');
t('T05 腿里那张死话句式表改名带缩窄（上一版这条只钉「const NO_EXIT」六个字，这么改照样命中 1、两腿全绿；现在钉整行）', [['tools/smoke-webdav.js',
  'const NO_EXIT = /弹不出来|做不到|App 内|不允许浏览器直连|此环境不支持|无解/;', 'const NO_EXIT_Q = /弹不出来|做不到/;']],
  'W06 那张死话句式表');
t('T16 腿里那张表自己的「有牙」自校准被摘掉（表在、名单缩了，W06 会绿着放行本批要拦的东西）', [['tools/smoke-webdav.js',
  'const NO_EXIT_OK =', 'const NO_EXIT_TEETH =']],
  '自校准现读 0');
t('T06 条数守卫阈值被挪低（判据少 13 条也算「跑完了」）', [['tools/smoke-webdav.js',
  'checks >= 14,', 'checks >= 2,']],
  '条数守卫不在了或阈值被挪');
t('T07 判据 W09 被改名（齐备检按字面 ok(\'W09 逐条数，改名＝这一条从证据链上消失）', [['tools/smoke-webdav.js',
  "ok('W09 ", "ok('W09b "]],
  '里 W09 这条判据');
t('T08 判据 W15 被改名（这条腿自己也是会被删的）', [['tools/smoke-webdav.js',
  "ok('W15 ", "ok('W15b "]],
  'W15（条数守卫）不在场');
t('T09 直调反证那一发换成 http://（协议换成合法的就不再走 netHint 第三档，那一档重新没人守）', [['tools/smoke-webdav.js',
  "{ url: 'ftp://probe.invalid/', user: u, pass: p, dir: '' });", "{ url: 'http://probe.invalid/', user: u, pass: p, dir: '' });"]],
  '用直调反证一次');
t('T10 「什么都不听」那一档的端口挪成 8798（档还在但落点漂了，不可达那一支的读数不再对应这条腿登记的那一发）', [['tools/smoke-webdav.js',
  'const P_DEAD = 8799;', 'const P_DEAD = 8798;']],
  '什么都不听的那一档');
t('T11 桩侧裸 GET 的读数判据改打 /dav/（探活的落点由桩侧读数证明，不是由代码看起来对证明）', [['tools/smoke-webdav.js',
  "h.method === 'GET' && h.path === '/' && !h.hasAuth", "h.method === 'GET' && h.path === '/dav/' && !h.hasAuth"]],
  '探活的落点由桩侧读数证明');
t('T12 W07 退回读 #wdStatus 那一档的 ok（点「测试连接」不刷新那一行，这条就长期是哑靶）', [['tools/smoke-webdav.js',
  "L.ok === false && /应用密码/.test(L.msg || '')", "L.ok === true && /应用密码/.test(L.msg || '')"]],
  'W07 读的是 tn_webdav_last');
t('T13 口令对账退回 new RegExp 家族（PASS 是单字母加 USER 里的点号，等于没检查）', [['tools/smoke-webdav.js',
  'const leaky = [PASS, WRONG].filter(function (v) {', 'const leaky = [PASS, WRONG].some(function (v) {']],
  '口令泄露那一条用 indexOf 家族');
tAll('T14 README 抹掉 §50 的登记（新闸门不写进 README 就等于没装）', 'README.md', '§50', '§5Y', '的 verify 清单没提 §50');
tAll('T15 README 抹掉这条腿的登记（腿在跑，登记表里却没有它）', 'README.md', 'smoke-webdav', 'smoke-wd-off', '没登记 tools/smoke-webdav.js');

/* ---------- ④ 两条腿的分工样本：源码腿必须全绿，浏览器腿必须红在指名那条 ---------- */
gBoth('U01 settings 把测试结果一律写成 err 档（§50 钉的是那句文案与颜色判据的字符串，不是这行的三元选择；「成功落绿档」只有屏上知道）——期望红在 W01',
  [['settings.html', "line('wdResult', r.msg, r.ok ? 'ok' : 'err');", "line('wdResult', r.msg, 'err');"]], 'W01');
gBoth('U02 test() 的 catch 把失败记成 ok:true（A50 钉的是 redact 与 record 的落点存在，不是那个布尔；自动上传失败时用户只看得到这条记录）——期望红在 W07',
  [['sync-webdav.js',
    '      record(false, redact(e.message));\n      cb({ ok: false, msg: redact(e.message) });',
    '      record(true, redact(e.message));\n      cb({ ok: false, msg: redact(e.message) });']], 'W07');
gBoth('U03 桩不再校密码（§50 钉的是 dropMethods / requireChallenge 两个开关在不在，不是 authed 的判据；「错凭据必须被拒」这件事只有真发一发才知道）——期望红在 W02',
  [['tools/webdav-stub.js', '    return raw === authUser + \':\' + authPass;', '    return true;']], 'W02');
gBoth('U04 offline() 恒 false（§50 钉的是「离线那句说什么」，不是这个判据本身；离线时到底落哪一句只有切了网络再点一次知道）——期望红在 W12',
  [['sync-webdav.js', '  function offline() { return navigator.onLine === false; }', '  function offline() { return false; }']], 'W12');

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
console.log('=== mut-verify50 · 靶子 ' + CASES.length + ' 条（红 ' + CASES.filter(c => c.kind === 'red').length +
  '／抹登记 ' + CASES.filter(c => c.kind === 'all').length + '／静默 ' + CASES.filter(c => c.kind === 'silentB').length +
  '），预检 ' + (PBF ? '失败 ' + PBF + ' 处' : '全过') + ' ===');
if (PBF) { process.exit(2); }
if (process.argv.indexOf('--selfcheck') >= 0) {
  /* 内部自测：这张网自己也得有反证——塞一条 from 串压根不在树上的靶子，预检必须抓到它。 */
  const SNAP = CASES.slice();
  CASES.length = 0;
  t('SC00 这条是故意坏的（from 串在树上根本不存在，预检必须抓到它）', [['sync-webdav.js',
    '  const 这一段串压根不在树上 = 1;', '  x;']], '随便什么 token');
  const g = preflight();
  CASES.length = 0; SNAP.forEach(c => CASES.push(c));
  console.log('内部自测：塞一条坏靶子 → 预检抓到 ' + g + ' 处（要 ≥1）' + (g >= 1 ? '：网形自己是有牙的 ✓' : '：预检失灵，这张网的「全过」不可信'));
  process.exit(g >= 1 ? 0 : 2);
}
if (process.env.MUT_PREFLIGHT) { console.log('MUT_PREFLIGHT＝1：只预检，没动树'); process.exit(0); }

/* ============ 基准：两条腿都得先是绿的，否则后面全是空判 ============ */
function tail2(e) { return '\nTHROW ' + String((e && e.message) || e).slice(0, 200) + '\nSTDERR ' + String((e && e.stderr) || '').split('\n').slice(-6).join('\n'); }
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
function runSmoke() {
  const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') });
  try { return { out: cp.execFileSync(process.execPath, ['tools/smoke-webdav.js'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024, timeout: 540000 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + tail2(e), green: false }; }
}
const S50 = o => String(o).split('\n').filter(l => l.indexOf('FAIL §50') === 0);
const B50 = o => String(o).split('\n').filter(l => /FAIL W\d/.test(l));

const why = r => String(r.out).split('\n').filter(l => l.indexOf('THROW') >= 0 || l.indexOf('STDERR') >= 0).join(' | ') || '(没抓到 THROW 行)';
const vbase = runVerify(), f0 = S50(vbase.out);
if (f0.length || !vbase.green) { console.log('中止：基准 verify.js 的 §50 有 ' + f0.length + ' 条红；整跑' + (vbase.green ? '绿（那就是 §50 自己红了）' : '不绿，原因：' + why(vbase)) + '\n' + f0.slice(0, 4).join('\n')); process.exit(2); }
if (String(vbase.out).indexOf('=== ALL CHECKS PASSED ===') < 0) { console.log('中止：基准 verify.js 整跑不绿（§50 之外也有红，后面的读数不可比）'); process.exit(2); }
const SUM50 = String(vbase.out).split('\n').filter(l => l.indexOf('云同步失败出口闸门:') === 0)[0] || '';
const LEN50 = (SUM50.match(/A50 表长 (\d+) 条、ZERO50 表长 (\d+) 条/) || []).slice(1);
if (LEN50.join('/') !== '45/9') { console.log('中止：基准摘要里的表长是 ' + LEN50.join('/') + '，而本网登记的是 A50 45／ZERO50 9——先对齐再打靶（表长一变，抬阈值类靶子的期望值全错位）'); process.exit(2); }
console.log('基准 verify 全绿 ✓（A50 表长 ' + LEN50[0] + '／ZERO50 表长 ' + LEN50[1] + '，与本网登记一致）');
const sbase = runSmoke(), c0 = B50(sbase.out);
if (c0.length || !sbase.green) {
  console.log('中止：基准 smoke-webdav 有 ' + c0.length + ' 条红；整跑' + (sbase.green ? '绿（那就是判据自己红了）' : '不绿，原因：' + why(sbase)));
  console.log((c0.length ? c0.slice(0, 4).join('\n') : String(sbase.out).split('\n').filter(l => l.trim()).slice(-8).join('\n')));
  process.exit(2);
}
console.log('基准 smoke-webdav 判据全绿 ✓（' + sbase.out.split('\n').filter(l => l.indexOf('PASS W') >= 0).length + ' 条）');

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
  const reds = S50(vr.out);
  if (c.kind === 'silentB') {
    const sm = runSmoke(), dd = B50(sm.out);
    const named = dd.filter(l => l.indexOf(c.want) >= 0).length > 0;
    if (!reds.length && vr.green && dd.length && named && !sm.green) {
      okSilent++; console.log('OK   ' + c.name.slice(0, 44) + '  → 源码腿 0 红且整跑绿，浏览器腿红在 ' + c.want + '（共 ' + dd.length + ' 条红）');
    } else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → 源码腿红 ' + reds.length + ' 条' + (reds[0] ? '（' + reds[0].slice(0, 76) + '）' : '') + (vr.green ? '／整跑仍绿' : '／整跑不绿') +
        '，浏览器腿红 ' + dd.length + ' 条' + (dd[0] ? '（首条 ' + dd[0].slice(0, 26) + '）' : '') + (named ? '' : '；指名的 ' + c.want + ' 没红'));
    }
  } else {
    const hit = reds.filter(l => l.indexOf(c.token) >= 0);
    if (hit.length && !vr.green) { okRed++; console.log('OK   ' + c.name.slice(0, 44) + '  → ' + hit[0].slice(11, 96)); }
    else {
      weird++; console.log('异常 ' + c.name.slice(0, 44) + '  → §50 红 ' + reds.length + ' 条，' + (vr.green ? '整跑还绿＝退出码没跟上：' : '没有一条含「' + c.token + '」') +
        (reds[0] ? '：' + reds[0].slice(0, 96) : (String(vr.out).indexOf('=== ALL CHECKS PASSED ===') >= 0 ? '（红字压根没印，整跑还绿＝那条锚是假绿灯）' : '（＝这条变异压根打不红）')));
    }
  }
  restore();
});

console.log('=== mut-verify50: ' + CASES.length + ' 条靶子 → 红对 ' + okRed + '／静默对 ' + okSilent + '／异常 ' + weird + (skipped ? '／跳过 ' + skipped : '') + ' ===');
console.log('注意：U 类重跑过 smoke-webdav，它按固定文件名落读数 tools/out/b36-smoke-webdav.txt；跑完要在干净树上复跑一次这条腿并把读数盖回去。');
process.exit(weird ? 1 : 0);
