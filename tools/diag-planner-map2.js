/* 深挖 mapBox 状态 */
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
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西，喜欢自然风光';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand'); for (let i = 0; i < 3; i++) cs[i].click(); });
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(2500);
  const r = await p.evaluate(() => {
    const box = document.getElementById('mapBox');
    return {
      cls: box.className,
      inner: box.innerHTML.slice(0, 200),
      paths: box.querySelectorAll('path').length,
      svgCount: box.querySelectorAll('svg').length
    };
  });
  console.log('mapBox:', JSON.stringify(r));
  /* 手动再次调用 L.map 看报错 */
  const r2 = await p.evaluate(() => {
    try {
      const m = L.map('mapBox', { zoomControl: false });
      return { ok: true, cls: document.getElementById('mapBox').className };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  console.log('手动 L.map:', JSON.stringify(r2));
  await browser.close();
})();
