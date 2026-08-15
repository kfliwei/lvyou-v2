/* 综合验证：a11y 属性 + IDB 迁移框架 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* 1. index：底导 aria */
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2000);
  const a11y = await p.evaluate(() => ({
    nav: document.querySelector('.bottom-nav') ? document.querySelector('.bottom-nav').getAttribute('aria-label') : null,
    current: document.querySelector('.bottom-nav__item.active') ? document.querySelector('.bottom-nav__item.active').getAttribute('aria-current') : null
  }));
  ok('底导 aria-label + aria-current', a11y.nav === '主导航' && a11y.current === 'page', JSON.stringify(a11y));
  await p.close();

  /* 2. topic：tabbar role */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message.slice(0, 100)));
  await p2.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const tab = await p2.evaluate(() => ({
    list: (document.querySelector('.tabbar') || {}).getAttribute ? document.querySelector('.tabbar').getAttribute('role') : null,
    btns: document.querySelectorAll('.tabbar button[role="tab"]').length
  }));
  ok('tabbar role=tablist + 5 tab', tab.list === 'tablist' && tab.btns >= 5, JSON.stringify(tab));
  const real2 = errs2.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('专题页无脚本错误', real2.length === 0, real2.join('|').slice(0, 80));
  await p2.close();

  /* 3. IDB 迁移框架可用（页面正常读写） */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p3.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  const idb = await p3.evaluate(() => new Promise(resolve => {
    const req = indexedDB.open('gujian-notes', 1);
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('notes', 'readonly'); tx.objectStore('notes').count().onsuccess = e => resolve({ ok: true, count: e.target.result }); };
    req.onerror = () => resolve({ ok: false });
  }));
  ok('IDB 迁移框架下正常读写', idb.ok, 'count=' + idb.count);
  await p3.close();

  await browser.close();
  console.log(fails ? '=== A11Y-IDB FAIL ===' : '=== A11Y-IDB ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
