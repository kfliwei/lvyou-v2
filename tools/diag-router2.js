/* 诊断 Router.go 全链路 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..');
const demoA = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="app"><h1 id="pageTitle">页面A</h1></div><script src="app-router.js"></script><script>Router.register({a:{url:"a.html"},b:{url:"b.html"}});Router.go("a");</script></body></html>';
const demoB = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="app"><h1 id="pageTitle">页面B</h1></div></body></html>';
const demoSrc = fs.readFileSync(path.join(ROOT, 'app-router.js'), 'utf8');
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/' || u === '/a.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(demoA); }
  else if (u === '/b.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(demoB); }
  else if (u === '/app-router.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(demoSrc); }
  else res.end('404');
}).listen(0);
const port = server.address().port;
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));
  const r = await page.evaluate(async () => {
    const out = {};
    out.init = document.getElementById('pageTitle').textContent;
    out.stack = window.Router ? 'router ok' : 'no router';
    try {
      const p = Router.go('b');
      out.goType = typeof p;
      out.goHasThen = p && typeof p.then;
      const result = await p;
      out.goResolved = true;
    } catch (e) { out.goErr = e.message; }
    await new Promise(r => setTimeout(r, 500));
    out.after = document.getElementById('pageTitle').textContent;
    out.url = location.href;
    return out;
  });
  console.log(JSON.stringify(r));
  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.log('ERR:', e.message); server.close(); process.exit(2); });
