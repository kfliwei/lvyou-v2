/* 带 console 监听的省主题诊断 */
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
  p.on('console', m => console.log('C:', m.text().slice(0, 200)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('四川')); if (c) c.click(); });
  await sleep(1200);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentProvs .chip')].find(x => x.textContent.trim() === '四川'); if (c) c.click(); });
  await sleep(500);
  await p.evaluate(() => window.plannerToggleCustomPref('古城古镇'));
  await sleep(800);
  const r = await p.evaluate(() => ({
    on: document.querySelectorAll('#intentProvThemes .chip.on').length,
    themesHtml: document.getElementById('intentProvThemes').innerHTML.slice(0, 200)
  }));
  console.log('结果:', JSON.stringify(r));
  await browser.close();
})();
