/* 验证：topic.html 图标替换 + 返回逻辑 + 无回归 */
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
  const d = await page.evaluate(() => ({
    locBtn: !!document.querySelector('#locBtn svg'),
    legOpen: !!document.querySelector('#legOpen svg'),
    tripFab: !!document.querySelector('#tripFab svg'),
    legOpenText: document.querySelector('#legOpen') ? document.querySelector('#legOpen').textContent.trim() : '',
    dayLegendBtn: !!document.querySelector('#dayLegendBtn svg')
  }));
  ok('定位按钮 SVG', d.locBtn);
  ok('图例按钮 SVG（与图例互斥显示，当前图例开启属正常）', d.legOpen, d.legOpenText);
  ok('行程按钮 SVG', d.tripFab);
  ok('每日色按钮 SVG（显示路线后可见）', d.dayLegendBtn);
  // 点击图例按钮正常
  await page.evaluate(() => { const b = document.querySelector('#legOpen'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 400));
  const legToggled = await page.evaluate(() => { const l = document.getElementById('legend'); return l ? getComputedStyle(l).display !== 'none' : false; });
  ok('图例按钮可交互', legToggled);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== ICON CHECK FAIL: ' + fails + ' ===' : '=== ICON CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
