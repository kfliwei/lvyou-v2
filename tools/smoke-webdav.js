/* tools/smoke-webdav.js — 云同步失败路径的常驻浏览器腿（批次 36 / §50）
 *
 * 为什么这一族非要有一条腿：批次 36 的起因是一条真机反馈——用户拿坚果云测云同步，看到
 * 「…它会要求弹窗认证，App 内弹不出来」，就此认定「云存储好看不能用」，之后再没点过第二次。
 * 那句话是 sync-webdav.js netHint() 自己写的，不是网盘回的。源码锚能钉住「这句话此刻不在代码里」，
 * 钉不住「失败的时候页面上落的究竟是哪一句」——所以这里按真鼠标点「测试连接」，读 #wdResult 落的那行字。
 *
 * 桩用现成的 tools/webdav-stub.js，四档：
 *   正常桩       —— 401 不带挑战（凭据不对时页面能拿到状态码）
 *   带挑战桩     —— 401 + WWW-Authenticate: Basic，坚果云的真实形状
 *   掐连接桩     —— dropMethods:['PROPFIND']，页面拿到的是网络层失败而不是状态码，
 *                    这正是 APK 壳 handler.cancel() 之后用户看到的那一发
 *   没人听的端口 —— 这台设备根本摸不到那台服务器
 * 前两档各对一个分支（可达 / 不可达）；第三档「探不出来」按钮那条路走不到，由 W14 直调反证一次。
 *
 * 口径照全站浏览器腿：328×723 dpr2（§37 真机主档）、静态 http、先打 tn_onboarded、反注册 SW、
 * 关缓存、动画等收尾（[[geometry-measure-after-animation]]）。
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/smoke-webdav.js \
 *        > tools/out/b36-smoke-webdav.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const webdav = require('./webdav-stub.js');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8191', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const P_OK = 8791;      /* 正常桩：401 不带挑战 */
const P_CHAL = 8792;    /* 带挑战桩：坚果云形状 */
const P_DROP = 8793;    /* 掐连接桩：PROPFIND 直接断，根路径照常应答 */
const P_DEAD = 8799;    /* 什么都不听：这台设备摸不到那台服务器 */
const VW = 328, VH = 723;
const USER = 'you@example.com', PASS = 'Ap9f3c7bQe', WRONG = 'WRONG9x';

let checks = 0, fails = 0;
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b36-smoke-webdav.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
}
function ok(name, cond, extra) {
  checks++;
  if (cond) { say('  PASS ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fails++; say('  FAIL ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function settle(page, extra) {
  try {
    await page.waitForFunction(
      () => document.getAnimations().every(a => a.playState !== 'running'
        || (a.effect && a.effect.getTiming().iterations === Infinity)),
      { timeout: 4000 });
  } catch (e) { say('   （动画未收尾：' + e.message.slice(0, 50) + '）'); }
  await sleep(extra || 300);
}

async function openSettings(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.setCacheEnabled(false);
  await page.goto(BASE + '/settings.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function () {
    return navigator.serviceWorker.getRegistrations()
      .then(rs => Promise.all(rs.map(r => r.unregister())));
  });
  await page.evaluate(function () {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.WebDAV && window.Backup && window.UI', { timeout: 20000 });
  await settle(page, 400);
  return { page, errs };
}

/* 把配置写进表单（不是写 localStorage：产品那四个钮读的是输入框的当前值），再真鼠标点「测试连接」，
   等 #wdResult 从「正在连接 …」变成落定的那句。 */
async function clickTest(page, cfg) {
  await page.evaluate(function (c) {
    var set = function (id, v) { var e = document.getElementById(id); if (e) { e.value = v; } };
    set('wdUrl', c.url); set('wdDir', c.dir || ''); set('wdUser', c.user); set('wdPass', c.pass);
    var r = document.getElementById('wdResult'); if (r) r.textContent = '';
  }, cfg);
  await page.click('#wdTestBtn');
  await page.waitForFunction(function () {
    var e = document.getElementById('wdResult');
    return !!e && e.textContent && e.textContent.indexOf('正在连接') !== 0;
  }, { timeout: 45000, polling: 200 }).catch(function () {});
  const out = await page.evaluate(function () {
    var r = document.getElementById('wdResult'), s = document.getElementById('wdStatus');
    var last = null;
    try { last = JSON.parse(localStorage.getItem('tn_webdav_last') || 'null'); } catch (e) {}
    return { result: r ? r.textContent : null, cls: r ? r.className : null,
      status: s ? s.textContent : null, last: last };
  });
  return out;
}

const NO_EXIT = /弹不出来|做不到|App 内|不允许浏览器直连|此环境不支持|无解/;
/* 这张表自己必须有牙。上一版 W06 只写 !NO_EXIT.test(allText)：表被改名带缩窄之后，「屏上没死话」
 * 就自动成立，这一条会绿着放行正是本批要拦的那个东西（变异网 T05 抓出来的假绿灯）。
 * 拿表里四种句式各正向命中一次，名单缩到两条以下或换成永远匹配不上的形状都会让这里当场假。 */
const NO_EXIT_OK = ['弹不出来', 'App 内', '做不到', '无解'].every(function (s) { return NO_EXIT.test(s); });

(async function main() {
  say('=== 批次 36 · 云同步失败路径（§50 浏览器腿，328×723 dpr2）===');
  const server = staticServer();
  await new Promise(function (res, rej) { server.once('error', rej); server.listen(PORT, '127.0.0.1', res); });
  const sOk = await new Promise(r => webdav.start({ port: P_OK, user: USER, pass: PASS }, r));
  const sChal = await new Promise(r => webdav.start({ port: P_CHAL, user: USER, pass: PASS, requireChallenge: true }, r));
  const sDrop = await new Promise(r => webdav.start({ port: P_DROP, user: USER, pass: PASS, dropMethods: ['PROPFIND'] }, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const { page, errs } = await openSettings(browser);

  const U = 'http://127.0.0.1:' + P_OK + '/';
  const C = 'http://127.0.0.1:' + P_CHAL + '/';
  const D = 'http://127.0.0.1:' + P_DROP + '/';
  const X = 'http://127.0.0.1:' + P_DEAD + '/';

  say('');
  say('— W01–W02 正常桩：对 / 错 —');
  const g1 = await clickTest(page, { url: U, user: USER, pass: PASS, dir: '' });
  say('   #wdResult = ' + g1.result);
  ok('W01 正确凭据点「测试连接」落在成功那句（绿色那一档，不是报错那一档）',
    /连接成功/.test(g1.result || '') && /(^|\s)ok(\s|$)/.test(g1.cls || ''), g1.cls);

  const g2 = await clickTest(page, { url: U, user: USER, pass: WRONG, dir: '' });
  say('   #wdResult = ' + g2.result);
  ok('W02 凭据被拒那句点名「应用密码」（不许只报一个 401 就完）', /应用密码/.test(g2.result || '') && /401/.test(g2.result || ''));

  say('');
  say('— W03–W05 真机那一发：拿不到状态码的三种形状 —');
  const g3 = await clickTest(page, { url: X, user: USER, pass: WRONG, dir: '' });
  say('   没人听的端口 #wdResult = ' + g3.result);
  ok('W03 摸不到服务器时说的是「这台设备打不开这个地址」，不赖给环境', /打不开这个地址/.test(g3.result || '') && /应用密码/.test(g3.result || ''));

  const g4 = await clickTest(page, { url: D, user: USER, pass: WRONG, dir: '' });
  say('   连接被掐断 #wdResult = ' + g4.result);
  ok('W04 请求发出去了但被掐断：先按「账号或密码被拒绝」来查（可达性探活起作用）', /能连上这台服务器/.test(g4.result || '') && /应用密码/.test(g4.result || ''));

  const g5 = await clickTest(page, { url: C, user: USER, pass: WRONG, dir: '' });
  say('   带挑战桩（坚果云形状）#wdResult = ' + g5.result);
  ok('W05 带 WWW-Authenticate 挑战的 401 仍能拿到状态码（钉住这条，不许再拿「挑战会吞掉 401」当修法依据）', /401/.test(g5.result || ''), g5.result);

  const allText = [g1.result, g2.result, g3.result, g4.result, g5.result, g2.status, g3.status, g4.status]
    .filter(Boolean).join(' | ');
  ok('W06 这几句里一句都没有出口以外的死话（弹不出来 / App 内 / 做不到 / 不允许浏览器直连）',
    NO_EXIT_OK && !NO_EXIT.test(allText), '表有牙=' + NO_EXIT_OK + '｜屏上命中的死话=' + ((allText.match(NO_EXIT) || [''])[0]));
  /* 「上次同步」那一行点完测试不刷新（测试不是同步），所以这里读的是它背后那条记录：
     tn_webdav_last 是自动上传失败时 toast 的唯一落点，那句必须同样带出口。 */
  const L = g4.last;
  ok('W07 记进 tn_webdav_last 的那句也带出口（自动上传失败时用户只能看到这一条）',
    !!L && L.ok === false && /应用密码/.test(L.msg || ''), L ? String(L.msg).slice(0, 46) : '没写记录');
  const leaky = [PASS, WRONG].filter(function (v) { return (allText + '|' + (L ? L.msg : '')).indexOf(v) >= 0; });
  ok('W08 任何一句可见文案里都不出现口令原文（含写进本机记录的那句）', leaky.length === 0, leaky.join(','));

  say('');
  say('— W09–W11 入口与探活的落点 —');
  await page.evaluate(function () { document.getElementById('wdUrl').value = ''; });
  await page.click('#wdPresetJg');
  await settle(page, 200);
  const pre = await page.evaluate(function () {
    return { url: document.getElementById('wdUrl').value, line: document.getElementById('wdResult').textContent };
  });
  ok('W09 点「坚果云：填标准地址」真的把地址填进去了（不是死控件）', pre.url === 'https://dav.jianguoyun.com/dav/', pre.url);
  ok('W10 点完这颗钮页面上有回执（说了下一步是账号与应用密码）', /应用密码/.test(pre.line || ''), pre.line);

  const rootHits = sDrop.hits.filter(h => h.method === 'GET' && h.path === '/' && !h.hasAuth).length;
  ok('W11 探活只打根路径且不带凭据（打到 /dav/ 就会撞上它自己要诊断的那个认证框）', rootHits >= 1, 'GET / 裸请求 ' + rootHits + ' 发');

  say('');
  say('— W12 离线那一发 —');
  await page.setOfflineMode(true);
  const g6 = await clickTest(page, { url: U, user: USER, pass: PASS, dir: '' });
  await page.setOfflineMode(false);
  say('   离线 #wdResult = ' + g6.result);
  ok('W12 离线时说的是离线，不绕到「账号密码」那支去', /离线/.test(g6.result || '') && !/应用密码/.test(g6.result || ''), g6.result);

  /* netHint 的第三档（探活探不出来 → reached === null）按钮那条路走不到：settings.html 在调
     WebDAV.test 之前就用 /^https?:\/\//i 挡掉了畸形地址，而探活只在离线那一发之后才可能返回 null。
     这一支按「设计内的静默」处理，用直调补第二条腿反证一次——不反证就没人知道那句还在不在。
     用一个 https 之外的协议：fetch 当场 reject，而 reach() 的地址正则不认它，正好落到 null 那一档。 */
  const g7 = await page.evaluate(function (u, p) {
    return new Promise(function (res) {
      var t = setTimeout(function () { res({ msg: '(没有回调)' }); }, 20000);
      window.WebDAV.test(function (r) { clearTimeout(t); res({ msg: r && r.msg, ok: !!(r && r.ok) }); },
        { url: 'ftp://probe.invalid/', user: u, pass: p, dir: '' });
    });
  }, USER, PASS);
  say('   探不出来 #wdResult(直调 cb.msg) = ' + g7.msg);
  ok('W14 探活探不出来那一档说的是「没测出来」并给一次重试点，不把 null 读成「这台设备打不开」',
    /没测出这台设备能不能到那台服务器/.test(g7.msg || '') && /再点一次/.test(g7.msg || '') && /应用密码/.test(g7.msg || ''), String(g7.msg).slice(0, 46));

  ok('W13 全程零未捕获报错', errs.length === 0, errs.join(' | '));
  ok('W15 判据条数 ≥ 14（这一节自己也是会被删的）', checks >= 14, 'checks=' + checks);

  say('');
  say('— 桩侧收到的方法序列（预检/探活/真请求各几发，读出来登记，不据此判红绿）—');
  say('   正常桩：' + sOk.hits.map(h => h.method + (h.hasAuth ? '[带凭据]' : '[裸]')).join(' → '));
  say('   带挑战桩：' + sChal.hits.map(h => h.method + (h.hasAuth ? '[带凭据]' : '[裸]')).join(' → '));
  say('   掐连接桩：' + sDrop.hits.map(h => h.method + (h.hasAuth ? '[带凭据]' : '[裸]')).join(' → '));

  await browser.close();
  sOk.close(function () {}); sChal.close(function () {}); sDrop.close(function () {});
  server.close();

  say('');
  say('合计 ' + checks + ' 条，失败 ' + fails + ' 条');
  dump();
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  say('腿炸了：' + (e && e.stack || e));
  dump();
  process.exit(1);
});
