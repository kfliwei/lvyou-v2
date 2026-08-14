/* 验证：首页/专题页按钮 SVG 图标 */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));

  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  const home = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.ha-btn')];
    return {
      count: btns.length,
      hasSvg: btns.every(b => b.querySelector('svg')),
      texts: btns.map(b => b.textContent.trim()),
      noEmoji: ![...document.querySelectorAll('.ha-btn')].some(b => /🎙|🗺|📖/.test(b.textContent))
    };
  });
  ok('首页按钮均带 SVG 图标', home.count === 2 && home.hasSvg && home.noEmoji, JSON.stringify(home));

  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const tp = await page.evaluate(() => {
    const acts = [...document.querySelectorAll('.topbar .act')];
    return {
      count: acts.length,
      hasSvg: acts.every(b => b.querySelector('svg')),
      texts: acts.map(b => b.textContent.trim())
    };
  });
  ok('专题页顶栏按钮均带 SVG 图标', tp.count === 2 && tp.hasSvg, JSON.stringify(tp));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== BTN ICON CHECK FAIL ===' : '=== BTN ICON CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
