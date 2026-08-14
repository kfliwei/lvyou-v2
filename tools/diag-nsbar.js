const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const bar = document.querySelector('.nsearch-bar');
    if (!bar) return { found: false };
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      found: true,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) },
      position: cs.position,
      bottom: cs.bottom,
      borderRadius: cs.borderRadius,
      blur: cs.backdropFilter
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await page.screenshot({ path: 'F:\\MyAi\\trace\\.openclaw\\tmp\\nsbar.png' });
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
