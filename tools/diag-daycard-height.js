/* 诊断 day-card 5000px 高度来源 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '10天，全国经典路线';
    document.getElementById('genBtn').click();
  });
  await sleep(3500);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand'); for (let i = 0; i < 25; i++) cs[i].click(); });
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(3000);
  const r = await p.evaluate(() => {
    const d1 = document.querySelector('.day-card');
    if (!d1) return {};
    /* 统计子元素 */
    const stops = d1.querySelectorAll('.stop').length;
    const children = [...d1.children].map(c => ({ tag: c.tagName, cls: c.className.slice(0, 15), h: Math.round(c.getBoundingClientRect().height) }));
    /* 找最高的子元素 */
    const stopsDetailed = [...d1.querySelectorAll('.stop')].slice(0, 2).map(st => {
      const kids = [...st.children].map(k => ({ tag: k.tagName, cls: (k.className || '').slice(0, 12), h: Math.round(k.getBoundingClientRect().height), txt: (k.textContent || '').slice(0, 40) }));
      return kids;
    });
    return { stops, children, stopsDetailed, htmlLen: d1.innerHTML.length };
  });
  console.log(JSON.stringify(r).slice(0, 900));
  await browser.close();
})();
