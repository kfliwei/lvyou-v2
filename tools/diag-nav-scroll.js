/* 诊断：底部导航是否随页面滚动 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pages = ['index.html', 'me.html', 'settings.html', 'review.html', 'search.html', 'story.html'];
  for (const f of pages) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto('file:///' + path.join(ROOT, f).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2500);
    const r = await p.evaluate(async () => {
      const nav = document.querySelector('.bottom-nav, .tabbar');
      if (!nav) return { nav: false };
      const before = nav.getBoundingClientRect().top;
      const pos = getComputedStyle(nav).position;
      window.scrollTo(0, 600);
      await new Promise(r => setTimeout(r, 300));
      const after = nav.getBoundingClientRect().top;
      /* 找到滚动容器 */
      const scroller = document.scrollingElement || document.documentElement;
      return { nav: true, pos, before: Math.round(before), after: Math.round(after), scrollY: scroller.scrollTop, parent: nav.parentElement.className };
    });
    console.log(f, JSON.stringify(r));
    await p.close();
  }
  await browser.close();
})();
