/* 验证：图例默认收起，点按钮展开 */
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
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  const initial = await page.evaluate(() => ({
    legendHidden: document.getElementById('legend').classList.contains('hidden'),
    legOpenShown: document.getElementById('legOpen').classList.contains('show'),
    legendDisplay: getComputedStyle(document.getElementById('legend')).display,
    legOpenDisplay: getComputedStyle(document.getElementById('legOpen')).display
  }));
  ok('图例默认收起', initial.legendHidden && initial.legendDisplay === 'none', JSON.stringify(initial));
  ok('图例按钮默认显示', initial.legOpenShown && initial.legOpenDisplay !== 'none', '');

  // 点图例按钮展开
  await page.evaluate(() => { document.getElementById('legOpen').click(); });
  await new Promise(r => setTimeout(r, 400));
  const opened = await page.evaluate(() => ({
    legendHidden: document.getElementById('legend').classList.contains('hidden'),
    legendDisplay: getComputedStyle(document.getElementById('legend')).display
  }));
  ok('点击后图例展开', !opened.legendHidden && opened.legendDisplay !== 'none', JSON.stringify(opened));

  // 再点 ✕ 收起
  await page.evaluate(() => { document.getElementById('legTg').click(); });
  await new Promise(r => setTimeout(r, 400));
  const closed = await page.evaluate(() => document.getElementById('legend').classList.contains('hidden'));
  ok('✕ 可再次收起', closed, '');

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== LEGEND CHECK FAIL ===' : '=== LEGEND CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
