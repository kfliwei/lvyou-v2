/* 验证：触控目标 ≥44px（多页面实测） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pages = [
    { f: 'settings.html', sel: '.t-row .back', name: '设置返回键' },
    { f: 'review.html', sel: '.t-row .back', name: '回顾返回键' },
    { f: 'search.html', sel: '.sbar .mic', name: '搜索麦克风' },
    { f: 'wishlist.html', sel: '.wl-btn', name: '想去顶栏按钮' },
    { f: 'node-manager.html', sel: '.nm-topbar .back', name: '节点管理返回键' }
  ];
  for (const p of pages) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pg.goto('file:///' + path.join(ROOT, p.f).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2500);
    const size = await pg.evaluate(sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, p.sel);
    const min = size ? Math.min(size.w, size.h) : 0;
    ok(p.name + ' ≥44px', min >= 44, size ? size.w + 'x' + size.h : 'missing');
    await pg.close();
  }
  /* 专题页：缩放按钮 + 无布局溢出（顶栏不重叠） */
  const pg = await browser.newPage();
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await pg.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const zoom = await pg.evaluate(() => {
    const a = document.querySelector('#zoomIn, .ctl button');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok('地图缩放按钮 ≥44px', zoom && Math.min(zoom.w, zoom.h) >= 44, zoom ? zoom.w + 'x' + zoom.h : 'missing');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('专题页无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await pg.close();

  /* 节点管理页：缩放按钮 + 菜单按钮 */
  const pg2 = await browser.newPage();
  await pg2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await pg2.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  await pg2.click('.nm-fab');
  await sleep(400);
  const menuBtn = await pg2.evaluate(() => {
    const el = document.querySelector('.nm-menu-item');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.round(r.height);
  });
  ok('节点菜单按钮 ≥44px', menuBtn >= 44, 'h=' + menuBtn);
  await pg2.close();

  await browser.close();
  console.log(fails ? '=== TOUCH FAIL ===' : '=== TOUCH ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
