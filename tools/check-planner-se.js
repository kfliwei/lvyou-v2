const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGE:', e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const d = await page.evaluate(() => ({
    hasStart: !!document.getElementById('planStart'),
    hasEnd: !!document.getElementById('planEnd'),
    hasLoop: !!document.getElementById('planLoop'),
    hasDatalist: !!document.getElementById('wlList'),
    syncLoop: typeof window.syncLoop === 'function',
    dlOptions: document.getElementById('wlList') ? document.getElementById('wlList').children.length : -1
  }));
  console.log(JSON.stringify(d));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });