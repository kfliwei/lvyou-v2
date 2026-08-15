/* 诊断：意图卡渲染 */
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
  const r1 = await p.evaluate(() => ({
    seeds: document.querySelectorAll('.seed').length,
    intentCard: !!document.getElementById('intentCard'),
    intentCardHtml: (document.getElementById('intentCard') || { innerHTML: '' }).innerHTML.slice(0, 150)
  }));
  console.log('初始:', JSON.stringify(r1));
  await p.evaluate(() => { const s = document.querySelector('.seed'); if (s) s.click(); });
  await sleep(1500);
  const r2 = await p.evaluate(() => ({
    provs: document.getElementById('intentProvs') ? document.getElementById('intentProvs').innerHTML.length : 'NULL',
    themes: !!document.getElementById('intentProvThemes'),
    prefs: (document.getElementById('intentPrefs') || { innerHTML: '' }).innerHTML.slice(0, 80)
  }));
  console.log('种子后:', JSON.stringify(r2));
  await browser.close();
})();
