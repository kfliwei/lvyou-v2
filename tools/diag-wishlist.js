/* 实测 wishlist：无数据点规划按钮 */
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
  p.on('console', m => { const t = m.text(); if (/error|Error|warn/i.test(t)) console.log('C:', t.slice(0, 120)); });
  await p.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  const r0 = await p.evaluate(() => ({
    btn: !!document.getElementById('wlPlanBtn'),
    toastFn: !!(window.UI && window.UI.toast),
    geo: !!window.Geo
  }));
  console.log('初始:', JSON.stringify(r0));
  /* 清空 wishlist 数据 */
  await p.evaluate(() => localStorage.removeItem('tn_wishlist'));
  await p.evaluate(() => { const b = document.getElementById('wlPlanBtn'); if (b) b.click(); });
  await sleep(600);
  const r1 = await p.evaluate(() => ({
    toast: !!document.querySelector('.ui-toast, [class*="toast"]'),
    toastText: (document.querySelector('.ui-toast, [class*="toast"]') || { textContent: '' }).textContent.slice(0, 40),
    bodySnippet: document.body.textContent.slice(0, 100).replace(/\s+/g, ' ')
  }));
  console.log('点击后:', JSON.stringify(r1));
  await browser.close();
})();
