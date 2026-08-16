/* 验证 Chrome file:// + query 加载行为 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await browser.newPage();
  const res = [];
  p.on('requestfailed', r => res.push('FAIL ' + r.url().slice(0, 80)));
  p.on('response', r => { if (r.status() >= 400) res.push('HTTP' + r.status() + ' ' + r.url().slice(0, 80)); });
  await p.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  console.log('请求问题:', res.length ? res.join('\n') : '无');
  const r = await p.evaluate(() => ({ sites: (window.SITES || []).length }));
  console.log('SITES:', r.sites);
  await browser.close();
})();
