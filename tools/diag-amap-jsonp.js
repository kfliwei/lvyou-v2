/* 直接测高德 JSONP 响应 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  const AMAP_KEY = process.env.AMAP_KEY || '';
  p.on('console', m => console.log('C:', m.text().slice(0, 160)));
  p.on('requestfailed', r => console.log('REQFAIL:', r.url().slice(0, 100), r.failure().errorText));
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  const r = await p.evaluate((k) => new Promise(resolve => {
    const cb = 'testCb' + Date.now();
    window[cb] = function (d) {
      resolve({ got: true, status: d && d.status, info: d && d.info, pois: d && d.pois ? d.pois.length : 0, photo: d && d.pois && d.pois[0] && d.pois[0].photos ? (d.pois[0].photos[0] || {}).url || 'none' : 'none' });
    };
    const sc = document.createElement('script');
    sc.src = 'https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(k) + '&keywords=' + encodeURIComponent('善化寺') + '&city=' + encodeURIComponent('大同') + '&offset=1&extensions=all&callback=' + cb;
    sc.onerror = function () { resolve({ got: false, err: 'script onerror' }); };
    document.head.appendChild(sc);
    setTimeout(function () { resolve({ got: false, err: 'timeout' }); }, 8000);
  }), AMAP_KEY);
  console.log('JSONP 结果:', JSON.stringify(r));
  await browser.close();
})();
