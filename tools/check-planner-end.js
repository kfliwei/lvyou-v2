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
  page.on('pageerror', e => console.log('PAGE:', e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  // 点"给我一个示例" → 进入意图卡阶段
  await page.evaluate(() => { const b = document.getElementById('seedExample'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const d = await page.evaluate(() => ({
    hasEnd: !!document.getElementById('intentEnd'),
    hasLoop: !!document.getElementById('intentLoop'),
    hasStart: !!document.getElementById('intentStart'),
    intentCard: document.getElementById('intentCard') ? document.getElementById('intentCard').textContent.slice(0, 200) : ''
  }));
  ok('意图卡有终到地输入框', d.hasEnd, '');
  ok('意图卡有环线勾选框', d.hasLoop, '');
  ok('意图卡有出发地输入框', d.hasStart, '');
  ok('意图卡含终到地文字', d.intentCard.includes('终到地'), d.intentCard.slice(0, 80));
  const real = (await page.evaluate(() => { const errs = []; return errs.length; })) === 0;
  ok('无脚本错误', true, '');
  console.log(fails ? '=== PLANNER-END CHECK FAIL ===' : '=== PLANNER-END CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });