/* audit-reality2 修正版：key 修正 + 首页交互用真实点击 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* 1. 首页：点搜索容器 → search.html */
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const e1 = [];
  p1.on('pageerror', e => e1.push(e.message.slice(0, 120)));
  await p1.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  const searchClickable = await p1.evaluate(() => {
    const el = document.querySelector('.hero__search');
    if (el) { el.click(); return true; }
    return false;
  });
  await sleep(2500);
  ok('首页搜索入口真实可点', searchClickable && p1.url().includes('search.html'), p1.url().split('/').pop());

  /* 2. 首页季节推荐 → 专题页 */
  await p1.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  await p1.evaluate(() => {
    const s = document.querySelector('.season-item');
    if (s) { s.click(); return true; }
    return false;
  });
  await sleep(2500);
  ok('季节推荐真实可跳转', /topic\.html/.test(p1.url()), p1.url().split('/').pop());
  const r1 = e1.filter(x => !/Failed to load resource|net::|ERR_|manifest/.test(x));
  ok('首页链路无脚本错误', r1.length === 0, r1.join('|').slice(0, 80));
  await p1.close();

  /* 3. 想去清单：Wish API 添加 → reload 渲染 → 打卡 */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const e3 = [];
  p3.on('pageerror', e => e3.push(e.message.slice(0, 120)));
  await p3.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2000);
  await p3.evaluate(() => {
    localStorage.removeItem('tn_wishlist');
    if (window.Wish) Wish.toggle({ label: '故宫', theme: '古建寺院', region: '北京', city: '北京', lat: 39.9, lng: 116.4 });
  });
  await sleep(400);
  await p3.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const wl = await p3.evaluate(() => ({
    item: !!document.querySelector('.wl-item'),
    btn: (document.querySelector('.wl-btn.primary') || {}).textContent || ''
  }));
  ok('想去清单渲染+打卡按钮', wl.item && wl.btn.indexOf('打卡') >= 0, wl.btn || 'no-item');
  await p3.evaluate(() => { const b = document.querySelector('.wl-btn.primary'); if (b) b.click(); });
  await sleep(1500);
  const checked = await p3.evaluate(() => {
    const it = document.querySelector('.wl-item');
    return it ? /已打卡|已在旅途/.test(it.textContent) : false;
  });
  ok('打卡真实生效', checked);
  const r3 = e3.filter(x => !/Failed to load resource|net::|ERR_|manifest/.test(x));
  ok('想去清单无脚本错误', r3.length === 0, r3.join('|').slice(0, 80));
  await p3.evaluate(() => localStorage.removeItem('tn_wishlist'));
  await p3.close();

  /* 4. 深色主题：tn_dark */
  const p4 = await browser.newPage();
  await p4.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p4.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(1500);
  await p4.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); });
  await p4.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const darkOn = await p4.evaluate(() => {
    const on = document.documentElement.classList.contains('theme-dark') || document.body.classList.contains('theme-dark');
    localStorage.setItem('tn_dark', 'auto');
    return on;
  });
  ok('深色主题真实生效', darkOn);
  await p4.close();

  await browser.close();
  console.log(fails ? '=== REALITY2 FAIL: ' + fails + ' ===' : '=== REALITY2 ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
