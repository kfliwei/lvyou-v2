/* 诊断 loadSitePhoto */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('request', r => { if (r.url().includes('restapi.amap.com')) console.log('AMAP REQ:', r.url().slice(0, 120)); });
  p.on('console', m => console.log('CONSOLE:', m.text().slice(0, 140)));
  const AMAP_KEY = process.env.AMAP_KEY || '';
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const r = await p.evaluate((k) => {
    localStorage.setItem('tn_amap_key', k);
    const all = window.SITES || [];
    const m = window.SITE_IMAGES || {};
    const target = all.find(s => !m[s.name] && s.name) || all[0];
    const i = all.indexOf(target);
    window.TopicEngine.openSheet(i);
    /* 手动调 loadSitePhoto 看回调 */
    const out = { name: target.name };
    try {
      loadSitePhoto(target, function (u) {
        out.cbUrl = u;
        const img = document.querySelector('#locSheet .ls-img img');
        out.imgSrc = img ? img.getAttribute('src') : 'no-img';
        if (u && img) { img.src = u; out.afterSet = img.getAttribute('src'); }
      });
    } catch (e) { out.err = e.message; }
    return out;
  }, AMAP_KEY);
  console.log('result:', JSON.stringify(r));
  await sleep(5000);
  const img2 = await p.evaluate(() => {
    const el = document.querySelector('#locSheet .ls-img img');
    return el ? el.getAttribute('src') : null;
  });
  console.log('5s后 img src:', img2);
  await browser.close();
})();
