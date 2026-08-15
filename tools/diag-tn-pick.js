/* 调试：地点选择器 DOM 结构 */
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
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4500);
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); window.location.reload(); });
  await sleep(4500);
  const r = await p.evaluate(() => {
    const out = { pick: typeof window.__tnPickPlace };
    try {
      window.__tnPickPlace(39.9, 116.4, function () {}, function () {});
    } catch (e) { out.err = e.message; }
    return out;
  });
  console.log('call:', JSON.stringify(r));
  await sleep(1000);
  const dom = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('b')].map(b => b.textContent.slice(0, 15));
    const masks = document.querySelectorAll('.mask, [class*="mask"], [class*="pick"]').length;
    const bodyText = document.body.textContent.slice(0, 300);
    return { bs, masks, bodyText: bodyText.slice(0, 200) };
  });
  console.log(JSON.stringify(dom));
  await browser.close();
})();
