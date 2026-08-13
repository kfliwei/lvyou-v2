/* 调试 node-manager.html 初始化 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE:', m.type(), m.text().slice(0, 300)); });
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  const st = await page.evaluate(() => ({
    map: !!document.querySelector('#mapEl.leaflet-container'),
    fab: !!document.querySelector('.nm-fab'),
    tip: (document.querySelector('.nm-tip') || {}).textContent || '',
    geo: typeof window.Geo,
    nodeLod: typeof window.NodeLOD,
    ui: typeof window.UI
  }));
  console.log(JSON.stringify(st));
  await browser.close();
})();
