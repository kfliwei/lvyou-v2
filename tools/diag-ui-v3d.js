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
    const out = [];
    for (const sheet of document.styleSheets) {
      let rs;
      try { rs = sheet.cssRules; } catch (e) { continue; }
      for (let i = 0; i < rs.length; i++) {
        const r = rs[i];
        if (r.selectorText === '.tn-head') {
          out.push({ i, css: r.style.cssText.slice(0, 120) });
        }
      }
    }
    // 也输出 v3 注释附近规则
    const head = document.querySelector('.tn-head');
    const hcs = getComputedStyle(head);
    return { rules: out, headPadTop: hcs.paddingTop, headColor: hcs.color, headBgImg: hcs.backgroundImage.slice(0, 50) };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
