/* 调试 SITE_IMAGES 映射 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const r = await p.evaluate(() => {
    const m = window.SITE_IMAGES || {};
    const keys = Object.keys(m);
    const i = (window.SITES || []).findIndex(s => s.name === '云冈石窟');
    const s = window.SITES[i];
    return {
      imgLoaded: !!window.SITE_IMAGES,
      keys: keys.length,
      hasYungang: !!m['云冈石窟'],
      siteName: s ? s.name : 'none',
      siteImg: s ? s.img : 'none',
      imgSrc: s ? (typeof window.imgSrc === 'function' ? '' : 'not-exposed') : ''
    };
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
