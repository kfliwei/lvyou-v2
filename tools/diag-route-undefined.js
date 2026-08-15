/* 复现：宁夏专题路线页底部 undefined */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=nx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { const b = document.querySelector('.tabbar button[data-tab="route"]'); if (b) b.click(); });
  await sleep(1500);
  /* 全页找 undefined 文本 */
  const hits = await p.evaluate(() => {
    const all = document.querySelectorAll('*');
    const out = [];
    all.forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().includes('undefined')) {
        const r = el.getBoundingClientRect();
        out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 30), txt: el.textContent.trim().slice(0, 40), y: Math.round(r.top), bottom: Math.round(r.bottom) });
      }
    });
    return out;
  });
  console.log('undefined 元素:', hits.length);
  hits.forEach(h => console.log(JSON.stringify(h)));
  /* 也检查 select 选项文本 */
  const sel = await p.evaluate(() => [...document.querySelectorAll('#routeSel option')].map(o => o.textContent));
  console.log('routeSel options:', JSON.stringify(sel));
  await browser.close();
})();
