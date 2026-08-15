/* 浏览器端高德真实调用测试（file:// origin） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('console', m => { const t = m.text(); if (/INVALID|route|highway|网络/i.test(t)) console.log('C:', t.slice(0, 120)); });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  /* 1. tn-key.js 加载 + 自动写入 localStorage */
  const r1 = await p.evaluate(() => ({
    hasGlobal: !!window.__TN_AMAP_KEY__,
    stored: !!localStorage.getItem('tn_amap_key')
  }));
  console.log('Key 加载:', JSON.stringify(r1));
  /* 2. 页面内直接调真实 driving */
  const r2 = await p.evaluate(() => {
    return fetch('https://restapi.amap.com/v3/direction/driving?origin=104.06,30.57&destination=103.62,30.99&extensions=all&key=' + encodeURIComponent(localStorage.getItem('tn_amap_key')))
      .then(r => r.json())
      .then(j => ({ status: j.status, info: j.info, infocode: j.infocode, steps: j.route && j.route.paths && j.route.paths[0] ? j.route.paths[0].steps.length : 0 }))
      .catch(e => ({ err: e.message }));
  });
  console.log('浏览器真实调用:', JSON.stringify(r2));
  await browser.close();
})();
