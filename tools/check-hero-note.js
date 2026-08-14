/* 验证：hero 随手记文字入口 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const note = document.querySelector('.hero-note');
    if (!note) return { exists: false };
    const r = note.getBoundingClientRect();
    return {
      exists: true,
      text: note.textContent.trim(),
      seal: !!note.querySelector('.hero-note__seal'),
      svg: !!note.querySelector('svg'),
      inHero: !!document.querySelector('.hero') && note.closest('.hero') !== null,
      visible: r.width > 0 && r.height > 0 && r.top < 844
    };
  });
  ok('hero 随手记入口存在', d.exists, '');
  ok('入口为文字+印章形态（非按钮）', d.seal && !d.svg && /随手记/.test(d.text), d.text);
  ok('入口在 hero 内且首屏可见', d.inHero && d.visible, '');
  // 点击触发随手记（hook）
  await page.evaluate(() => { window.__tnAnywhere = function () { window.__fired = true; }; });
  await page.evaluate(() => { const n = document.querySelector('.hero-note'); if (n) n.click(); });
  await new Promise(r => setTimeout(r, 400));
  const fired = await page.evaluate(() => window.__fired);
  ok('点击入口触发随手记', fired === true, '');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== HERO-NOTE CHECK FAIL ===' : '=== HERO-NOTE CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
