/* 验证：首页入口替换 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  const txt = await p.evaluate(() => document.body.textContent);
  ok('hero 显示「行程规划」', txt.includes('行程规划'), '');
  ok('「我的足迹」入口存在', txt.includes('我的足迹'), '');
  /* 点 hero 行程规划 → planner.html */
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(x => x.textContent.trim().startsWith('行程规划'));
    if (el) el.click();
  });
  await sleep(2500);
  ok('行程规划跳转 planner.html', p.url().includes('planner.html'), p.url().split('/').pop());
  /* 返回 → 点我的足迹 → travel-map.html */
  await p.evaluate(() => { if (window.history.length > 1) window.history.back(); });
  await sleep(2500);
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('.text-link')].find(x => x.textContent.trim().startsWith('我的足迹'));
    if (el) el.click();
  });
  await sleep(2500);
  ok('我的足迹跳转 travel-map.html', p.url().includes('travel-map.html'), p.url().split('/').pop());
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== HOME-ENTRY FAIL ===' : '=== HOME-ENTRY ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
