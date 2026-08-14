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
    const head = document.querySelector('.tn-head');
    const cs = getComputedStyle(head);
    const panel = document.querySelector('.tn-panel');
    const pcs = getComputedStyle(panel);
    return {
      headInline: head.getAttribute('style'),
      headClass: head.className,
      headBg: cs.background,
      headBgImg: cs.backgroundImage,
      headPad: cs.padding,
      headBackdrop: cs.backdropFilter,
      panelInline: panel.getAttribute('style'),
      panelBg: pcs.background,
      panelBgImg: pcs.backgroundImage,
      panelAnim: pcs.animationName,
      styleSheets: document.styleSheets.length
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
