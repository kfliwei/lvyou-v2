/* tools/smoke-states.js — 批次 6 状态组件行为验证。
 * puppeteer 加载 http://127.0.0.1:PORT 各页，触发 offline / online，
 * 检查 UI.offlineBar 出现/消失；触发 UI.errorBox 渲染并点重试回调；
 * 截图入 tools/out/shots/<日期>-b6-states/。NODE_PATH 需指到 tools/node_modules。 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
/* 带日期目录是入库前提：`.gitignore` 忽略 tools/out/shots/*.png，散在根上的截图只活在本地
 * （批次 6 那 9 张就这么飘了两天，后来手工归位 2026-10-04-b6-states/）。
 * 日期取本地：toISOString() 是 UTC，凌晨跑会写进昨天的目录。 */
const _d = new Date();
const OUT = path.join(__dirname, 'out', 'shots',
  [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-') + '-b6-states');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8123', 10);
const BASE = 'http://127.0.0.1:' + PORT;

const PAGES = [
  'index.html','search.html','topic.html','wishlist.html',
  'travel-map.html','planner.html','album.html','review.html'
];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function boot() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage']
  });
  const results = [];
  const http = require('http');
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream'});
      res.end(data);
    });
  });
  await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });

  for (const file of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(BASE + '/' + file, { waitUntil: 'load', timeout: 30000 });
    await sleep(1200); // 让 ui.js DOMContentLoaded 自动装 offlineBar
    const entry = { file, checks: {} };
    // 1. 初始 navigator.onLine=true → 离线条不在 DOM
    entry.checks.onlineInit = await page.evaluate(function () {
      return !document.querySelector('.ui-offlinebar');
    });
    // 2. 派发 offline 事件 → 离线条出现
    await page.evaluate(function () {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    await sleep(450);
    entry.checks.offlineShows = await page.evaluate(function () {
      var b = document.querySelector('.ui-offlinebar');
      return !!b && b.classList.contains('show') && b.textContent.indexOf('离线') >= 0;
    });
    await page.screenshot({ path: path.join(OUT, file.replace('.html','') + '.offline.png') });
    // 3. 派发 online 事件 → 离线条消失（含 320ms 淡出）
    await page.evaluate(function () {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    await sleep(500);
    entry.checks.onlineHides = await page.evaluate(function () {
      return !document.querySelector('.ui-offlinebar');
    });
    // 4. errorBox 渲染（仅测 API 契约）：调用 UI.errorBox(host,{...}) 断言 .ui-errorbox 出现
    entry.checks.errorBoxRenders = await page.evaluate(function () {
      if (!window.UI || !UI.errorBox) return false;
      var host = document.createElement('div'); document.body.appendChild(host);
      UI.errorBox(host, { title: 'T', text: 'D', retryText: 'R', onRetry: function(){ return Promise.resolve(true); } });
      var box = host.querySelector('.ui-errorbox');
      var ok = !!box && !!box.querySelector('.eb-retry');
      host.remove();
      return ok;
    });
    // 5. errorBox 重试按钮回调真触发：初始 counter=0，点一次期望 +1
    entry.checks.errorBoxRetryFires = await page.evaluate(function () {
      if (!window.UI || !UI.errorBox) return false;
      window.__retryFired = 0;
      var host = document.createElement('div'); document.body.appendChild(host);
      UI.errorBox(host, { title: 'T', text: 'D', onRetry: function () { window.__retryFired++; return new Promise(function(r){ setTimeout(function(){ r(true); }, 50); }); } });
      window.__retryHost = host;
      var btn = host.querySelector('.eb-retry');
      btn.click();
      return true; // 触发即算成功，异步结果下一步读
    });
    await sleep(200);
    entry.checks.errorBoxRetryCount = await page.evaluate(function () {
      var ok = window.__retryFired === 1;
      if (window.__retryHost) window.__retryHost.remove();
      return ok;
    });
    results.push(entry);
    await page.close();
  }

  // planner AI 生成：断网 + 拦掉所有 fetch → 点「生成」→ errorBox 出现且重试按钮存在
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await p.evaluateOnNewDocument(function () {
      try {
        localStorage.setItem('tn_aiSite','custom');
        localStorage.setItem('tn_aiBase','http://127.0.0.1:1/v1/chat/completions');
        localStorage.setItem('tn_key_custom','sk-dummy');
        localStorage.setItem('tn_model_custom','test');
      } catch (e) {}
      // 拦掉远程 fetch，模拟断网失败（保留本地相对路径）
      var of = window.fetch;
      window.fetch = function (u, opt) {
        if (typeof u === 'string' && /^https?:/.test(u) && u.indexOf(location.origin) !== 0) {
          return Promise.reject(new TypeError('Failed to fetch (stub)'));
        }
        return of.apply(window, arguments);
      };
    });
    await p.goto(BASE + '/planner.html', { waitUntil: 'load', timeout: 30000 });
    await sleep(1200);
    await p.evaluate(function () {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
      var dest = document.getElementById('arDest'); if (dest) dest.value = '云南';
      var btn = document.getElementById('arBtn'); if (btn) btn.click();
    });
    await sleep(2500);
    const aiErr = await p.evaluate(function () {
      var host = document.getElementById('aiRouteOut');
      return !!(host && host.querySelector('.ui-errorbox') && host.querySelector('.ui-errorbox .eb-retry'));
    });
    results.push({ file: 'planner.html#ai', checks: { errorBoxOnFail: aiErr } });
    await p.screenshot({ path: path.join(OUT, 'planner.ai-error.png') });
    await p.close();
  } catch (e) {
    results.push({ file: 'planner.html#ai', checks: { error: String(e).slice(0, 120) } });
  }

  await browser.close();
  server.close();

  // 断言
  let bad = 0;
  console.log('状态组件行为验证（smoke-states.js）');
  for (const r of results) {
    var ok = Object.keys(r.checks).every(function (k) { return r.checks[k] === true; });
    var line = '  ' + (ok ? 'PASS' : 'FAIL') + ' ' + r.file + ' :: ' + JSON.stringify(r.checks);
    console.log(line);
    if (!ok) bad++;
  }
  fs.writeFileSync(path.join(__dirname, 'out', 'smoke-states-report.json'),
    JSON.stringify({ fail: bad, results: results }, null, 2));
  console.log('smoke-states: ' + results.length + ' 项，失败 ' + bad);
  process.exit(bad ? 1 : 0);
}

boot().catch(function (e) { console.log('BOOT FAIL:', e && e.message); process.exit(2); });
