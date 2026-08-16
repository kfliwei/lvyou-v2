/* 诊断：SITES 加载状态 + 一句话解析结果 */
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
  await p.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  const r0 = await p.evaluate(() => ({
    sites: (window.SITES || []).length,
    hasIdx: !!document.querySelector('script[src*="nation-index"]'),
    userKey: (function () { const m = document.documentElement.outerHTML.match(/var USER_KEY = ([^;]+);/); return m ? m[1] : '?'; })()
  }));
  console.log('SITES:', JSON.stringify(r0));
  await sleep(3000);
  const r1 = await p.evaluate(() => ({ sites: (window.SITES || []).length }));
  console.log('6s 后 SITES:', JSON.stringify(r1));
  /* 直接调 parseOneLineRule */
  const r2 = await p.evaluate(() => {
    try { return { parsed: window.parseOneLineRule ? parseOneLineRule('我想加成都武侯祠，三国文化') : 'no fn' }; }
    catch (e) { return { err: e.message }; }
  });
  console.log('解析:', JSON.stringify(r2));
  await browser.close();
})();
