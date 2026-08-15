/* 调试省主题点击 */
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
  p.on('console', m => console.log('C:', m.text().slice(0, 120)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('四川'));
    if (c) c.click();
  });
  await sleep(1200);
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#intentProvs .chip')].find(x => x.textContent.trim() === '四川');
    if (c) c.click();
  });
  await sleep(600);
  /* 打印第一个主题 chip 的 onclick 属性 */
  const r1 = await p.evaluate(() => {
    const c = document.querySelector('#intentProvThemes .chip');
    return c ? { onclick: c.getAttribute('onclick'), text: c.textContent, prefs: (window.state && window.state.prefs) || 'no-state' } : { none: true };
  });
  console.log('chip:', JSON.stringify(r1));
  /* 点击它 */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip'); if (c) c.click(); });
  await sleep(600);
  const r2 = await p.evaluate(() => ({
    prefs: (window.state && window.state.prefs) || 'no-state',
    onChips: document.querySelectorAll('#intentProvThemes .chip.on').length
  }));
  console.log('点击后:', JSON.stringify(r2));
  await browser.close();
})();
