/* 验证 router（v3：入口页注册，片段页无重复注册） */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..');
const entry = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="app"><h1 id="pageTitle">首页</h1></div><script src="app-router.js"></script><script>Router.register({a:{url:"a.html"},b:{url:"b.html"}});Router.go("a");</script></body></html>';
const fragA = '<div id="app"><h1 id="pageTitle">页面A</h1><p>A内容</p></div>';
const fragB = '<div id="app"><h1 id="pageTitle">页面B</h1><p>B内容</p></div><script>window.__demoB=1;</script>';
const demoSrc = fs.readFileSync(path.join(ROOT, 'app-router.js'), 'utf8');
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (u === '/') res.end(entry);
  else if (u === '/a.html') res.end('<!DOCTYPE html><html><body>' + fragA + '</body></html>');
  else if (u === '/b.html') res.end('<!DOCTYPE html><html><body>' + fragB + '</body></html>');
  else if (u === '/app-router.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(demoSrc); }
  else res.end('404');
}).listen(0);
const port = server.address().port;
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));
  const a = await page.evaluate(() => document.getElementById('pageTitle').textContent);
  console.log('1.初始(go a):', a);
  await page.evaluate(() => Router.go('b'));
  await new Promise(r => setTimeout(r, 800));
  const b = await page.evaluate(() => ({ title: document.getElementById('pageTitle').textContent, script: window.__demoB }));
  console.log('2.go b:', JSON.stringify(b));
  await page.evaluate(() => Router.back());
  await new Promise(r => setTimeout(r, 800));
  const backA = await page.evaluate(() => document.getElementById('pageTitle').textContent);
  console.log('3.back:', backA);
  const ok = a === '页面A' && b.title === '页面B' && b.script === 1 && backA === '页面A';
  console.log(ok ? '=== ROUTER ALL PASSED ===' : '=== ROUTER FAIL ===');
  console.log('errs:', errs.join('|') || 'none');
  await browser.close();
  server.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERR:', e.message); server.close(); process.exit(2); });
