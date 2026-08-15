/* 调试 node-manager 页面错误 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 160)); });
  page.on('requestfailed', r => { if (r.url().includes('nation')) console.log('REQFAIL:', r.url().split('/').pop()); });
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  const st = await page.evaluate(() => ({
    map: !!document.querySelector('#mapEl.leaflet-container'),
    idx: (window.NATION_SITES_RAW || '').split('\n').length,
    nm: typeof window.NM,
    ai: typeof window.Ai
  }));
  console.log('state:', JSON.stringify(st));
  await browser.close();
})();
