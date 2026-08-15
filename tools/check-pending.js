/* 验证：tripEmpty 空态 + 定位失败兜底 + haversine 钳制 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* tripEmpty 空态（清空游记数据） */
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p1.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p1.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2000);
  await p1.evaluate(() => { localStorage.removeItem('travelNotes'); });
  await p1.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const empty = await p1.evaluate(() => {
    const el = document.getElementById('tripEmpty');
    return el ? getComputedStyle(el).display : 'no-el';
  });
  ok('无记录时插画空态显示', empty === 'block', 'display=' + empty);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('首页无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await p1.close();

  /* haversine 钳制：对跖点不再 NaN（直接静态+行为验证） */
  const fs = require('fs');
  const src = fs.readFileSync(path.join(ROOT, 'review.html'), 'utf8');
  ok('haversine 钳制已加', src.includes('Math.min(1, Math.sqrt(s))'));
  /* 行为验证：对跖点算距离 */
  const d = await (async () => {
    const vm = require('vm');
    const ctx = { window: {}, console };
    vm.createContext(ctx);
    const code = src.match(/function haversineKm[\s\S]*?\n}/)[0];
    vm.runInContext(code, ctx);
    return vm.runInContext('haversineKm({lat:0,lng:0},{lat:0,lng:180})', ctx);
  })();
  ok('对跖点距离有限值', isFinite(d) && d > 20000, 'd=' + d);

  await browser.close();
  console.log(fails ? '=== PENDING FAIL ===' : '=== PENDING ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
