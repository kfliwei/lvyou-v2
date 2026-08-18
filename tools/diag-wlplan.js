const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGE:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed/.test(m.text())) console.log('CONSOLE:', m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const d = await page.evaluate(() => {
    const wlPlan = document.getElementById('wlPlan');
    const allDivs = [...document.querySelectorAll('.wrap > div')].map(d => d.id);
    return {
      wlPlan: !!wlPlan,
      wlPlanParent: wlPlan ? wlPlan.parentElement.className : 'none',
      wrapDivs: allDivs,
      wlPlanBtn: !!document.getElementById('wlPlanBtn'),
      bodyInnerHTML: document.getElementById('wlBody') ? document.getElementById('wlBody').innerHTML.slice(0, 80) : 'none'
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });