/* 验证：openSettings 跳设置页 + travel-map 按钮图标 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* travel-map 按钮图标 */
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto('file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);
  const btns = await p.evaluate(() => {
    const b = [...document.querySelectorAll('.t-row .act')];
    return b.map(x => ({ txt: x.textContent.trim(), svg: !!x.querySelector('svg') }));
  });
  ok('travel-map 按钮带图标', btns.length === 2 && btns.every(x => x.svg), JSON.stringify(btns));
  /* 随手记无 key 时 openSettings 跳转（模拟无 key 调 openSettings） */
  await p.evaluate(() => {
    localStorage.removeItem('tn_aiKey');
    try { window.TravelNotes.openSettings(); } catch (e) { console.log('openSettings err', e.message); }
  });
  await sleep(2500);
  ok('openSettings 跳转设置页', p.url().includes('settings.html'), p.url().split('/').pop());
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await p.close();
  await browser.close();
  console.log(fails ? '=== TN-SET FAIL ===' : '=== TN-SET ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
