const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const rules = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (r.style && /body/.test(r.selectorText || '') && r.style.overflow) {
          out.push((sheet.href || 'inline').split('/').pop() + ' | ' + r.selectorText + ' | overflow: ' + r.style.overflow + ' / x:' + r.style.overflowX + ' y:' + r.style.overflowY);
        }
      }
    }
    return out;
  });
  console.log(rules.join('\n'));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
