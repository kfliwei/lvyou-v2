/* 验证：桌面快捷入口逻辑（__tnShortcut + ?shortcut= 参数） */
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

  // 1. __tnShortcut 存在
  const hasFn = await page.evaluate(() => typeof window.__tnShortcut === 'function');
  ok('__tnShortcut 已定义', hasFn, '');

  // 2. shortcut=anywhere → 触发 __tnAnywhere（hook 它）
  await page.evaluate(() => {
    window.__tnAnywhere = function () { window.__shortcutFired = 'anywhere'; };
  });
  await page.evaluate(() => { window.__tnShortcut('anywhere'); });
  await new Promise(r => setTimeout(r, 400));
  const fired = await page.evaluate(() => window.__shortcutFired);
  ok('shortcut=anywhere 触发随手记', fired === 'anywhere', fired);

  // 3. shortcut=explore → 跳转探索地图
  await page.evaluate(() => { window.__tnShortcut('explore'); });
  await new Promise(r => setTimeout(r, 1500));
  const url = page.url();
  ok('shortcut=explore 跳转探索地图', /explore-map\.html/.test(url), url);

  // 4. 带 ?shortcut=anywhere 打开首页 → 自动触发随手记（真实副作用：定位失败提示出现）
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?shortcut=anywhere', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const auto = await page.evaluate(() => {
    const tips = [...document.querySelectorAll('body > div')].filter(d => d.style.position === 'fixed' && /无法获取位置|当前位置|记录/.test(d.textContent));
    return tips.map(d => d.textContent.slice(0, 30));
  });
  ok('首页 ?shortcut=anywhere 自动触发随手记', auto.length > 0, JSON.stringify(auto));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== SHORTCUT CHECK FAIL ===' : '=== SHORTCUT CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
