const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const d = await page.evaluate(() => {
    const card = document.getElementById('startEndCard');
    if (!card) return { found: false };
    const r = card.getBoundingClientRect();
    const destCard = document.getElementById('destCard');
    const dr = destCard ? destCard.getBoundingClientRect() : null;
    return {
      found: true,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      inFirstScreen: r.top < 844,
      destTop: dr ? Math.round(dr.top) : -1,
      destBottom: dr ? Math.round(dr.bottom) : -1
    };
  });
  console.log(JSON.stringify(d));
  await page.screenshot({ path: 'F:\\MyAi\\trace\\.openclaw\\tmp\\planner.png' });
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });