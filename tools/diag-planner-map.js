/* 验证 #mapBox 渲染问题 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 130)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西，喜欢自然风光';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand');
    for (let i = 0; i < Math.min(3, cs.length); i++) cs[i].click();
  });
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(2500);
  const r1 = await p.evaluate(() => {
    const box = document.getElementById('mapBox');
    if (!box) return { noBox: true };
    const cs = getComputedStyle(box);
    const rect = box.getBoundingClientRect();
    const mapEl = box.querySelector('.leaflet-container');
    return {
      display: cs.display, rectH: Math.round(rect.height),
      map: !!mapEl,
      paths: box.querySelectorAll('path').length,
      markers: box.querySelectorAll('.leaflet-marker-icon').length
    };
  });
  console.log('渲染后 #mapBox:', JSON.stringify(r1));
  /* 手动 invalidateSize + 重绘检查 */
  const r2 = await p.evaluate(() => {
    const box = document.getElementById('mapBox');
    if (!box) return {};
    const map = window.plannerMap || null;
    return { hasPlannerMap: !!map };
  });
  console.log('plannerMap:', JSON.stringify(r2));
  await browser.close();
})();
