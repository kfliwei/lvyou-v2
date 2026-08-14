/* 诊断：长征专题路线显示 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=cz').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  const d = await page.evaluate(() => {
    const M = window.TOPIC_REGISTRY ? window.TOPIC_REGISTRY['cz'] : null;
    return {
      hasRoutes: !!(M && M.routes && M.routes.length),
      routeCount: M && M.routes ? M.routes.length : 0,
      routeTitles: M && M.routes ? M.routes.map(r => r.name) : [],
      routeItems: document.querySelectorAll('#routes .route').length,
      polylines: document.querySelectorAll('#mapEl .leaflet-overlay-pane path').length,
      banner: document.querySelector('#routeBanner') ? document.querySelector('#routeBanner').style.display : 'n/a',
      daysStops: M && M.routes && M.routes[0] ? M.routes[0].days.map(d => d.stops.length) : []
    };
  });
  console.log(JSON.stringify(d, null, 1));
  // 尝试点"在地图查看"
  await page.evaluate(() => {
    const b = document.querySelector('#routes [data-show]');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 2500));
  const after = await page.evaluate(() => ({
    polylines: document.querySelectorAll('#mapEl .leaflet-overlay-pane path').length,
    banner: document.querySelector('#routeBanner') ? document.querySelector('#routeBanner').style.display : 'n/a',
    bannerTxt: document.querySelector('#routeBanner') ? document.querySelector('#routeBanner').textContent : ''
  }));
  console.log('点击后:', JSON.stringify(after));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
