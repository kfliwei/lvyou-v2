/* 调试：nation 页 openSheet / 点击节点 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  const r1 = await page.evaluate(() => ({
    engine: typeof window.TopicEngine,
    sites: (window.SITES || []).length,
    lazy: !!window.SITES_LAZY,
    openSheet: typeof window.TopicEngine.openSheet
  }));
  console.log('state:', JSON.stringify(r1));
  /* 直接调 openSheet(0) */
  const r2 = await page.evaluate(() => {
    try {
      window.TopicEngine.openSheet(0);
      return { ok: true, sheet: !!document.querySelector('#locSheet.show'), body: (document.querySelector('#lsBody') || {}).textContent ? 'has' : 'empty' };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  console.log('openSheet(0):', JSON.stringify(r2));
  await new Promise(r => setTimeout(r, 3000));
  const r3 = await page.evaluate(() => ({
    sheet: !!document.querySelector('#locSheet.show'),
    desc: (document.querySelector('#locSheet .ls-desc') || {}).textContent || ''
  }));
  console.log('after 3s:', JSON.stringify(r3));
  await browser.close();
})();
