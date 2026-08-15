/* 验证：深色收敛后三页渲染正常 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const f of ['review.html', 'settings.html', 'story.html']) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
    await p.goto('file:///' + path.join(ROOT, f).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2000);
    await p.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); window.location.reload(); });
    await sleep(2500);
    const st = await p.evaluate(() => {
      const dark = document.documentElement.classList.contains('theme-dark') || document.body.classList.contains('theme-dark');
      const topbar = document.querySelector('.topbar, .story-bar');
      const tb = topbar ? getComputedStyle(topbar).backgroundColor : 'none';
      const title = document.querySelector('.t-row .title, .story-bar .title');
      const tc = title ? getComputedStyle(title).color : 'none';
      return { dark, tb, tc };
    });
    ok(f + ' 深色生效且顶栏可读', st.dark && st.tc !== 'none' && st.tb !== 'none', JSON.stringify(st));
    const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
    ok(f + ' 无脚本错误', real.length === 0, real.join('|').slice(0, 60));
    await p.evaluate(() => { localStorage.setItem('tn_dark', 'auto'); });
    await p.close();
  }
  await browser.close();
  console.log(fails ? '=== DARK-CONSOLIDATE FAIL ===' : '=== DARK-CONSOLIDATE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
