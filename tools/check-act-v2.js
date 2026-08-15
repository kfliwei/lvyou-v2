/* 验证：topic/travel-map 顶栏 act 按钮 v2 胶囊 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const [f, sel] of [['topic.html?p=bj', '.t-row .act'], ['travel-map.html', '.t-row .act']]) {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
    await p.goto('file:///' + path.join(ROOT, f).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);
    const st = await p.evaluate(sel => {
      const btns = [...document.querySelectorAll(sel)];
      if (!btns.length) return null;
      const b = btns[0];
      const cs = getComputedStyle(b);
      return {
        n: btns.length,
        h: Math.round(b.getBoundingClientRect().height),
        radius: cs.borderRadius,
        bg: cs.backgroundColor,
        labels: btns.map(x => x.textContent.trim()).join('|')
      };
    }, sel);
    ok(f + ' act 按钮 v2 胶囊', st && st.h >= 44 && st.radius === '999px' && st.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(st));
    const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
    ok(f + ' 无脚本错误', real.length === 0, real.join('|').slice(0, 60));
    await p.close();
  }
  await browser.close();
  console.log(fails ? '=== ACT FAIL ===' : '=== ACT ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
