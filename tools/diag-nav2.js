/* 验证：body 过渡动画是否破坏 fixed 定位 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  /* 情况A：动画存在时滚动 */
  const a = await p.evaluate(async () => {
    const nav = document.querySelector('.bottom-nav');
    const before = nav.getBoundingClientRect().top;
    window.scrollTo(0, 500);
    await new Promise(r => setTimeout(r, 300));
    return { before: Math.round(before), after: Math.round(nav.getBoundingClientRect().top), anim: getComputedStyle(document.body).animationName };
  });
  console.log('A 有动画:', JSON.stringify(a));
  /* 情况B：移除动画后滚动 */
  const b = await p.evaluate(async () => {
    document.body.style.animation = 'none';
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
    const nav = document.querySelector('.bottom-nav');
    const before = nav.getBoundingClientRect().top;
    window.scrollTo(0, 500);
    await new Promise(r => setTimeout(r, 300));
    return { before: Math.round(before), after: Math.round(nav.getBoundingClientRect().top) };
  });
  console.log('B 无动画:', JSON.stringify(b));
  await browser.close();
})();
