/* 临时 debug：观察 album-edit 滚动行为 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'file:///' + path.join(ROOT, 'album-edit.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERR:', e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
    bodyH: document.body.scrollHeight,
    innerH: window.innerHeight,
    bodyPadB: getComputedStyle(document.body).paddingBottom,
    scrollingEl: document.scrollingElement === document.documentElement ? 'html' : (document.scrollingElement === document.body ? 'body' : 'other'),
    chapters: document.querySelectorAll('.ed-chapter').length,
    barH: document.querySelector('.add-bar').getBoundingClientRect().height
  }));
  console.log('初始:', JSON.stringify(before));

  // 点击添加文字
  await page.evaluate(() => { document.getElementById('addText').click(); });
  await sleep(200);
  const afterRender = await page.evaluate(() => ({
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
    chapters: document.querySelectorAll('.ed-chapter').length,
    lastTextBottom: Math.round(document.querySelectorAll('.ed-chapter')[document.querySelectorAll('.ed-chapter').length - 1].querySelector('.ech-text').getBoundingClientRect().bottom)
  }));
  console.log('render后:', JSON.stringify(afterRender));

  await sleep(1000);
  const afterScroll = await page.evaluate(() => ({
    scrollY: window.scrollY,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    lastTextBottom: Math.round(document.querySelectorAll('.ed-chapter')[document.querySelectorAll('.ed-chapter').length - 1].querySelector('.ech-text').getBoundingClientRect().bottom),
    barTop: Math.round(document.querySelector('.add-bar').getBoundingClientRect().top)
  }));
  console.log('1s后:', JSON.stringify(afterScroll));

  // 手动 scrollBy 测试
  const manual = await page.evaluate(() => {
    window.scrollBy({ top: 100, behavior: 'auto' });
    return { scrollY: window.scrollY };
  });
  console.log('手动scrollBy(100):', JSON.stringify(manual));

  // scrollTo 底部测试
  const toBottom = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return { scrollY: window.scrollY, lastTextBottom: Math.round(document.querySelectorAll('.ed-chapter')[document.querySelectorAll('.ed-chapter').length - 1].querySelector('.ech-text').getBoundingClientRect().bottom), barTop: Math.round(document.querySelector('.add-bar').getBoundingClientRect().top), docH: document.documentElement.scrollHeight };
  });
  console.log('scrollTo底:', JSON.stringify(toBottom));

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
