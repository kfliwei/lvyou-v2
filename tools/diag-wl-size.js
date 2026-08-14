const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '长城|40.36|116.02', label: '长城', lat: 40.36, lng: 116.02, region: '北京市', city: '北京', theme: '关隘长城', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const rect = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), display: getComputedStyle(el).display }; };
    return {
      doc: { scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight, bodyScrollY: getComputedStyle(document.body).overflowY, htmlOverflowY: getComputedStyle(document.documentElement).overflowY },
      topbar: rect('.topbar'),
      wrap: rect('.wrap'),
      wlMap: rect('#wlMap'),
      wlPlan: rect('#wlPlan'),
      wlBody: rect('#wlBody'),
      items: document.querySelectorAll('.wl-item').length
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
