const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => { window.TravelNotes.openPanel({ label: '故宫博物院', lat: 39.916, lng: 116.397 }); });
  await new Promise(r => setTimeout(r, 1000));
  const d = await page.evaluate(() => {
    const panel = document.querySelector('.tn-panel');
    const head = document.querySelector('.tn-head');
    const cs = getComputedStyle(panel);
    const hcs = getComputedStyle(head);
    return {
      panelBg: cs.background,
      panelBgImage: cs.backgroundImage,
      panelBgColor: cs.backgroundColor,
      headBg: hcs.background,
      headBlur: hcs.backdropFilter,
      headBorder: hcs.borderBottomColor,
      headPadding: hcs.padding
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
