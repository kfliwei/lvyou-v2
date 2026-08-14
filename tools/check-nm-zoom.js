/* 验证：我的地点页缩放按钮右上位置 */
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
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const zoom = document.querySelector('.leaflet-control-zoom');
    if (!zoom) return { found: false };
    const r = zoom.getBoundingClientRect();
    const topbar = document.querySelector('.nm-topbar');
    const tb = topbar ? topbar.getBoundingClientRect() : null;
    return {
      found: true,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      right: Math.round(r.right),
      left: Math.round(r.left),
      topbarBottom: tb ? Math.round(tb.bottom) : -1,
      inRight: r.right > 300,
      belowTopbar: tb ? r.top >= tb.bottom : false,
      btns: zoom.querySelectorAll('a').length,
      radius: getComputedStyle(zoom).borderRadius
    };
  });
  ok('缩放控件存在（+/-）', d.found && d.btns === 2, JSON.stringify(d));
  ok('位于页面右侧', d.right > 300, 'right=' + d.right);
  ok('在顶栏下方（不遮挡）', d.belowTopbar, 'top=' + d.top + ' topbarBottom=' + d.topbarBottom);
  ok('圆角风格', d.radius === '14px', d.radius);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== NM-ZOOM CHECK FAIL ===' : '=== NM-ZOOM CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
