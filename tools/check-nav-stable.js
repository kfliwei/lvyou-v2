/* 补测：其余页面底导滚动稳定性 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const f of ['explore-map.html', 'travel-map.html', 'wishlist.html', 'md-manager.html', 'node-manager.html', 'index.html', 'me.html', 'review.html']) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto('file:///' + path.join(ROOT, f).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(3000);
    const r = await p.evaluate(async () => {
      const nav = document.querySelector('.bottom-nav, .tabbar, .nm-fab');
      if (!nav) return { nav: false };
      const before = nav.getBoundingClientRect().top;
      window.scrollTo(0, 500);
      await new Promise(r => setTimeout(r, 300));
      const after = nav.getBoundingClientRect().top;
      return { nav: true, cls: nav.className.slice(0, 20), stable: Math.abs(before - after) < 2 };
    });
    if (r.nav) ok(f + ' 底导/悬浮件滚动稳定', r.stable, r.cls + ' ' + Math.round(r.before) + '→' + Math.round(r.after));
    else console.log('INFO ' + f + ' 无底导');
    await p.close();
  }
  await browser.close();
  console.log(fails ? '=== NAV FAIL ===' : '=== NAV ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
