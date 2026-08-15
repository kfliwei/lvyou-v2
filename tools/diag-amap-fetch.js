/* 验证：file:// 下 fetch 直调高德（CORS） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  const AMAP_KEY = process.env.AMAP_KEY || '';
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  const r = await p.evaluate((k) => {
    return fetch('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(k) +
      '&keywords=' + encodeURIComponent('善化寺') + '&city=' + encodeURIComponent('大同') +
      '&offset=1&extensions=all')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return { status: d.status, info: d.info, pois: d.pois ? d.pois.length : 0, photo: (d.pois && d.pois[0] && d.pois[0].photos && d.pois[0].photos[0]) ? d.pois[0].photos[0].url : 'none' };
      })
      .catch(function (e) { return { err: e.message }; });
  }, AMAP_KEY);
  console.log('fetch 结果:', JSON.stringify(r));
  await browser.close();
})();
