/* probe-e4-timeline.js — E4 那条「缩小视野后仍不重叠」到底几毫秒才稳定
 *
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/probe-e4-timeline.js
 * 背景：smoke-motion E4 点 #zoomOut 后固定等 400ms 再量重叠对数，本批正常档里
 *       同一份代码一次绿（重叠 0）一次红（重叠 2）。要么断言的取样时机太早，
 *       要么 animationend 那条补测路真没兜住——只有把「时间 × 还在跑的动画 × 重叠对」
 *       三样一起摊开才分得清。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');

const PORT = 8162;
const BASE = 'http://localhost:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(d); });
});

const SNAP = `(() => {
  const run = [].slice.call(document.querySelectorAll('.tr-node,.mem-node')).filter(el => {
    const a = el.getAnimations ? el.getAnimations() : [];
    return a.some(x => x.animationName === 'node-fade-in' && x.playState === 'running');
  }).length;
  const vis = [].slice.call(document.querySelectorAll('#mapEl .node-label'))
    .filter(el => !el.classList.contains('hidden'))
    .map(el => ({ t: el.textContent.trim(), r: el.getBoundingClientRect() }));
  let pairs = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i].r, b = vis[j].r;
    if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) pairs.push(vis[i].t + '×' + vis[j].t);
  }
  return { running: run, labels: document.querySelectorAll('#mapEl .node-label').length,
    hidden: document.querySelectorAll('#mapEl .node-label.hidden').length, vis: vis.length, pairs: pairs };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + '/topic.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(2600);
  await page.evaluate(`window.__la = 0; const real = window.labelAvoid; window.labelAvoid = function () { window.__la++; return real.apply(this, arguments); };`);
  const before = await page.evaluate(SNAP);
  const la0 = await page.evaluate('window.__la');
  console.log('稳定态（点缩小时前）: 标签 ' + before.labels + ' / 可见 ' + before.vis + ' / 重叠 ' + before.pairs.length + ' 对 / 在跑的入场动画 ' + before.running);
  await page.evaluate("document.getElementById('zoomOut').click()");
  let acc = 0;
  for (const t of [200, 400, 700, 900, 1400, 2000, 3000]) {
    await sleep(t - acc); acc = t;
    const s = await page.evaluate(SNAP);
    const la = await page.evaluate('window.__la');
    console.log('点 zoomOut +' + t + 'ms: 避让被调 ' + (la - la0) + ' 次 / 标签 ' + s.labels + ' / 可见 ' + s.vis + ' / 隐藏 ' + s.hidden +
      ' / 重叠 ' + s.pairs.length + ' 对 / 还在跑的入场动画 ' + s.running + (s.pairs.length ? ' → ' + s.pairs.slice(0, 3).join(' ,') : ''));
  }
  await browser.close();
  server.close();
  console.log('---');
  console.log('判读：重叠随时间收敛到 0 ＝断言取样太早（等待要改成"动画全部结束"）；收敛不到 0 ＝避让在正常档真没兜住。');
})().catch(e => { console.log('ERR ' + e.message); process.exit(2); });
