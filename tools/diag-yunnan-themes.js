/* 查看云南主题列表 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('云南')); if (c) c.click(); });
  await sleep(1200);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '云南'); if (c) c.click(); });
  await sleep(600);
  const r = await p.evaluate(() => [...document.querySelectorAll('#intentProvThemes .chip')].map(c => c.textContent.trim()));
  console.log('云南主题:', r.join(' / '));
  await browser.close();
})();
