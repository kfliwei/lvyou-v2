/* 直接调 plannerToggleCustomPref 诊断 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  const r0 = await p.evaluate(() => ({
    fn: typeof window.plannerToggleCustomPref,
    pick: typeof window.plannerPickProv
  }));
  console.log('函数:', JSON.stringify(r0));
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('四川'));
    if (c) c.click();
  });
  await sleep(1200);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentProvs .chip')].find(x => x.textContent.trim() === '四川'); if (c) c.click(); });
  await sleep(500);
  const r1 = await p.evaluate(() => {
    try {
      window.plannerToggleCustomPref('古城古镇');
      return { called: true };
    } catch (e) { return { err: e.message }; }
  });
  console.log('直接调用:', JSON.stringify(r1));
  await sleep(600);
  const r2 = await p.evaluate(() => document.querySelectorAll('#intentProvThemes .chip.on').length);
  console.log('on chips:', r2);
  await browser.close();
})();
