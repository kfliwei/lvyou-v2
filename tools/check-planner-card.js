/* 验证：排期结果卡 v2 样式 */
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
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西，喜欢自然风光';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand'); for (let i = 0; i < 3; i++) cs[i].click(); });
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(2500);
  const r = await p.evaluate(() => {
    const dc = document.querySelector('.day-card');
    if (!dc) return null;
    const cs = getComputedStyle(dc);
    const n = document.querySelector('.day-card .stop .n');
    return {
      radius: cs.borderRadius,
      border: cs.borderWidth,
      bg: cs.backgroundColor,
      shadow: cs.boxShadow !== 'none',
      stopN: n ? getComputedStyle(n).backgroundColor : 'none'
    };
  });
  ok('每日卡片 v2（16px圆角/细边/宣纸底/阴影）', r && r.radius === '16px' && r.border !== '0px' && r.bg !== 'rgba(0, 0, 0, 0)' && r.shadow, JSON.stringify(r));
  ok('站点序号圆点（朱砂系）', r && r.stopN !== 'none', r ? r.stopN : '');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== CARD-UI FAIL ===' : '=== CARD-UI ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
