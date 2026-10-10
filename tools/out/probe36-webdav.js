/* probe36-webdav.js — 批次 36-A 地基实测：WebDAV 失败路径在页面上到底剩下什么读数
 *
 * 现场报告：用户在真机 APK 上测坚果云，看到一句「…弹窗…App 内弹不出来」，于是判定云存储不能用。
 * 那句话出自我们自己的 sync-webdav.js netHint()，不是坚果云回的。要定性的三件事：
 *   ① 服务器带 WWW-Authenticate 挑战时，页面侧的 fetch 到底看见什么（状态码？还是网络错误？
 *      要等多久？）。sync-webdav.js:85-89 记的是 2026-10-04 的一次性读数「带挑战 8s 不返回」，
 *      壳侧 MainActivity 后来又实现了 onReceivedHttpAuthRequest→handler.cancel()，
 *      那句注释是否还成立、成立到什么程度，必须重测。
 *   ② 挑战这一发会不会把 401 吞掉：吞掉则 httpHint(401)「账号或密码不对（401）」在 APK 是
 *      永远读不到的死分支，用户只剩一句没有出口的话。
 *   ③ 修法的第二条腿成不成立：坚果云对 /dav/ 任何方法都挑战，但对根路径 / 回 403 不带挑战
 *      （curl 实测）——所以「无凭据 no-cors GET 根路径」能当可达性探针用，先把这个数拿到。
 *
 * 桩服务器用现成的 tools/webdav-stub.js（requireChallenge 两档产品代码里没人传过，
 * 也就是这条链路至今没有常驻腿）。
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe36-webdav.js \
 *        > tools/out/b36-probe-webdav.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const webdav = require('../webdav-stub.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8181', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const STUB_PLAIN = 8791;   /* 401 不带挑战 */
const STUB_CHAL = 8792;    /* 401 带 WWW-Authenticate: Basic —— 坚果云就是这个形状 */

const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b36-probe-webdav.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* 每一发都在干净的页面里跑：WebDAV 把结果写进 localStorage 的 tn_webdav_last，
   同页连跑会让上一发的读数混进下一句「上次同步 …」。 */
async function open(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.setCacheEnabled(false);
  await page.goto(BASE + '/settings.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function () {
    return navigator.serviceWorker.getRegistrations()
      .then(rs => Promise.all(rs.map(r => r.unregister())));
  });
  await page.waitForFunction('window.WebDAV && window.Backup', { timeout: 20000 });
  return { page, errs };
}

/* 走产品自己的出口：WebDAV.test 的 cb 拿到什么、页面上落的句子是什么、耗时多少。
   cap 是自己加的保险丝：产品的 TIMEOUT 是 30s，若这一发挂在挑战上，不能让整支探针卡死。 */
async function runTest(browser, cfg, tag, cap) {
  const { page, errs } = await open(browser);
  const t0 = Date.now();
  let r, timedOut = false;
  try {
    r = await page.evaluate(function (c) {
      return new Promise(function (res) {
        window.WebDAV.test(function (rr) { res(rr); }, c);
      });
    }, cfg);
  } catch (e) {
    timedOut = true;
    r = { ok: false, msg: '（' + tag + ' 在 ' + cap + 'ms 内没有回调：' + String(e.message).slice(0, 60) + '）' };
  }
  const ms = Date.now() - t0;
  const shown = await page.evaluate(function () {
    var e = document.getElementById('wdResult');
    var s = document.getElementById('wdStatus');
    return { wdResult: e ? e.textContent : null, wdStatus: s ? s.textContent : null };
  });
  say('  ' + tag);
  say('    耗时 ' + ms + 'ms' + (timedOut ? '（探针上限截断，产品自己那 30s 还没到点）' : '')
    + ' · ok=' + r.ok + (r.status != null ? ' status=' + r.status : ''));
  say('    cb.msg = ' + r.msg);
  say('    页面 #wdResult = ' + shown.wdResult);
  say('    页面 #wdStatus = ' + shown.wdStatus);
  if (errs.length) say('    未捕获报错：' + errs.join(' | '));
  await page.close();
  return { ms: ms, ok: !!(r && r.ok), status: r.status, msg: r.msg, timedOut: timedOut };
}

(async function main() {
  const server = staticServer();
  await new Promise(function (res, rej) { server.once('error', rej); server.listen(PORT, '127.0.0.1', res); });
  const stubPlain = await new Promise(res => webdav.start({ port: STUB_PLAIN, user: 'u', pass: 'p' }, res));
  const stubChal = await new Promise(res => webdav.start({ port: STUB_CHAL, user: 'u', pass: 'p', requireChallenge: true }, res));
  say('=== 批次 36-A · WebDAV 失败路径实测 ===');
  say('桩：' + STUB_PLAIN + ' = 401 不带挑战；' + STUB_CHAL + ' = 401 带 WWW-Authenticate: Basic（坚果云形状）');
  say('产品 TIMEOUT = 30000ms；探针单发保险丝 = 45000ms');

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files']
  });
  const cap = 45000;
  const U = 'http://127.0.0.1:' + STUB_PLAIN + '/';
  const C = 'http://127.0.0.1:' + STUB_CHAL + '/';

  say('');
  say('— ① 无挑战这一档：正确凭据 / 错误凭据 ——');
  const a1 = await runTest(browser, { url: U, user: 'u', pass: 'p', dir: '' }, '无挑战 + 对', cap);
  const a2 = await runTest(browser, { url: U, user: 'u', pass: 'WRONG', dir: '' }, '无挑战 + 错', cap);

  say('');
  say('— ② 带挑战这一档（真机那一发就是这个形状）：正确凭据 / 错误凭据 ——');
  const b1 = await runTest(browser, { url: C, user: 'u', pass: 'p', dir: '' }, '带挑战 + 对', cap);
  const b2 = await runTest(browser, { url: C, user: 'u', pass: 'WRONG', dir: '' }, '带挑战 + 错', cap);

  say('');
  say('— 定性（三条判据自己算，不靠人眼比对上面四段）—');
  say('  D1 无挑战+错 能拿到 status 401 = ' + (a2.status === 401) + '（拿得到才说明 httpHint(401) 不是死分支）');
  say('  D2 带挑战+对 仍然成功 = ' + b1.ok + '，耗时 ' + b1.ms + 'ms（挑战只发生在被拒时，正确凭据不受影响）');
  say('  D3 带挑战+错 的读数：ok=' + b2.ok + ' status=' + (b2.status === undefined ? 'undefined（拿不到状态码）' : b2.status)
    + ' 耗时 ' + b2.ms + 'ms ' + (b2.timedOut ? '→ 卡住' : '→ 有回调'));
  say('  D3 那句话：' + b2.msg);
  say('    ⇒ 401 被挑战吞掉（status 读不到）＝' + (b2.ok === false && b2.status === undefined));
  say('    ⇒ 用户在这一发上先干等 ' + Math.round(b2.ms / 1000) + 's，再看到一句没有出口的话');

  say('');
  say('— ③ 第二条腿能不能立：坚果云根路径不带挑战，能不能当「这台设备可达吗」的探针 —');
  const probe = await page3probe(browser);
  say('  ' + JSON.stringify(probe));

  say('');
  say('— ④ 桩服务器收到的请求序列（看有没有多发一发 OPTIONS 预检）—');
  say('  无挑战桩：' + stubPlain.hits.map(h => h.method + (h.hasAuth ? '[带凭据]' : '[裸]')).join(' → '));
  say('  带挑战桩：' + stubChal.hits.map(h => h.method + (h.hasAuth ? '[带凭据]' : '[裸]')).join(' → '));

  await browser.close();
  stubPlain.close(function () {});
  stubChal.close(function () {});
  server.close();
  dump();
  console.log('\nDONE 四发耗时：' + JSON.stringify({ 无挑战对: a1.ms, 无挑战错: a2.ms, 带挑战对: b1.ms, 带挑战错: b2.ms }));
})().catch(function (e) { say('探针炸了：' + (e && e.stack || e)); dump(); process.exit(1); });

/* no-cors 探活：opaque response（status 恒 0），判的是「这一发 promise 成没成」。
   坚果云根路径 403 不带挑战（curl 实测），所以这一发不会再撞认证框。 */
async function page3probe(browser) {
  const { page } = await open(browser);
  const out = await page.evaluate(async function () {
    async function one(u) {
      const t0 = Date.now();
      try {
        const r = await fetch(u, { mode: 'no-cors', cache: 'no-store' });
        return { url: u, reached: true, type: r.type, status: r.status, ms: Date.now() - t0 };
      } catch (e) {
        return { url: u, reached: false, err: String(e && e.message || e).slice(0, 60), ms: Date.now() - t0 };
      }
    }
    return {
      坚果云根路径: await one('https://dav.jianguoyun.com/'),
      坚果云dav路径: await one('https://dav.jianguoyun.com/dav/'),
      不存在的域名: await one('https://nonexistent-host-9x7zz.example/')
    };
  });
  await page.close();
  return out;
}
