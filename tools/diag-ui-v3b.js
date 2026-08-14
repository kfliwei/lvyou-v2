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
  const rules = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rs;
      try { rs = sheet.cssRules; } catch (e) { continue; }
      for (const r of rs) {
        if (r.selectorText && /\.tn-(panel|head|now|mic|recbox)/.test(r.selectorText)) {
          out.push(r.selectorText + ' { ' + (r.style.background || r.style.cssText.slice(0, 90)) + ' }');
        }
      }
    }
    return out.slice(0, 12);
  });
  console.log(rules.join('\n'));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
