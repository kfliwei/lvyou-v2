/* 临时 debug v2：时间序列观察滚动 */
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
  page.on('console', m => { if (m.type() === 'log') console.log('CONSOLE:', m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const snap = async (tag) => {
    const s = await page.evaluate(() => {
      const cards = document.querySelectorAll('.ed-chapter');
      const last = cards[cards.length - 1];
      const el = last ? last.querySelector('.ech-text') : null;
      return {
        scrollY: Math.round(window.scrollY),
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        docH: document.documentElement.scrollHeight,
        bodyPadB: getComputedStyle(document.body).paddingBottom,
        bottom: el ? Math.round(el.getBoundingClientRect().bottom) : -1,
        barTop: Math.round(document.querySelector('.add-bar').getBoundingClientRect().top),
        barH: Math.round(document.querySelector('.add-bar').getBoundingClientRect().height)
      };
    });
    console.log(tag + ':', JSON.stringify(s));
  };

  await snap('初始');
  // 注入探针
  await page.evaluate(() => {
    window.__scrollLog = [];
    const orig = window.scrollBy.bind(window);
    window.scrollBy = function (o) { window.__scrollLog.push({ t: Date.now(), top: o.top, st: Math.round(window.scrollY) }); return orig(o); };
    const orig2 = window.scrollTo.bind(window);
    window.scrollTo = function (a, b) { window.__scrollLog.push({ t: Date.now(), to: b, st: Math.round(window.scrollY) }); return orig2(a, b); };
    // 也探针 scrollLastChapterIntoView 调用
    document.getElementById('addText').addEventListener('click', function () { window.__clickT = Date.now(); });
  });
  await page.evaluate(() => { document.getElementById('addText').click(); });
  await sleep(50); await snap('+50ms');
  await sleep(100); await snap('+150ms');
  await sleep(200); await snap('+350ms');
  await sleep(700); await snap('+1050ms');
  const log = await page.evaluate(() => window.__scrollLog);
  console.log('scrollLog:', JSON.stringify(log, null, 1));
  const clickT = await page.evaluate(() => window.__clickT);
  console.log('clickT:', clickT);

  // 手动滚动测试（page 层）
  await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'auto' }));
  await sleep(300);
  await snap('手动scrollBy100');

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
