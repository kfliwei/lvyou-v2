/* 验证：节点详情显示实景照（SITE_IMAGES 优先） */
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
  /* 山西专题（云冈石窟有实景照） */
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const idx = await p.evaluate(() => {
    const i = (window.SITES || []).findIndex(s => s.name === '云冈石窟');
    if (i >= 0) window.TopicEngine.openSheet(i);
    return i;
  });
  await sleep(1500);
  const img = await p.evaluate(() => {
    const el = document.querySelector('#locSheet .ls-img img');
    return el ? { src: el.src.slice(0, 60), shown: getComputedStyle(el).display !== 'none' } : null;
  });
  ok('云冈石窟详情打开', idx >= 0);
  ok('实景照显示（高德图源）', img && img.shown && img.src.includes('autonavi'), img ? img.src : 'no img');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== IMAGES FAIL ===' : '=== IMAGES ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
