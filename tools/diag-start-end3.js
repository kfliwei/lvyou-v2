const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERR:', e.message.slice(0, 250)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: 'A|39.9|116.4', label: '北京站', lat: 39.9, lng: 116.4, region: '北京市', city: '北京', theme: '城市地标', ts: Date.now(), visited: 0 },
      { id: 'B|30.2|120.1', label: '杭州站', lat: 30.2, lng: 120.1, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2000));
  const d = await page.evaluate(() => ({
    wlPlan: !!document.getElementById('wlPlan'),
    wrapHTML: document.querySelector('.wrap').innerHTML.slice(0, 400)
  }));
  console.log(JSON.stringify(d));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });