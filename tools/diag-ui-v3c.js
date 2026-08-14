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
    const found = { v3comment: 0, panel175: 0, panelIn: 0, headV3: 0, total: 0 };
    for (const sheet of document.styleSheets) {
      let rs;
      try { rs = sheet.cssRules; } catch (e) { continue; }
      for (const r of rs) {
        const t = r.cssText || '';
        total0: if (t.includes('v3')) found.v3comment++;
        if (t.includes('175deg')) found.panel175++;
        if (t.includes('tnPanelIn')) found.panelIn++;
        if (t.includes('.tn-head') && t.includes('rgba(250,246,236')) found.headV3++;
      }
    }
    return found;
  });
  console.log(JSON.stringify(d));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
