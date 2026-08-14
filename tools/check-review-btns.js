/* 验证 review.html 按钮无重复 + 页面正常 */
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
  await page.goto('file:///' + path.join(ROOT, 'review.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => ({
    posterCarto: document.querySelectorAll('#posterCarto').length,
    posterBtn: document.querySelectorAll('#posterBtn').length,
    posterBtnH: document.querySelectorAll('#posterBtnH').length,
    aiReport: document.querySelectorAll('#aiReport').length,
    btnTexts: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t.includes('海报'))
  }));
  ok('制图海报按钮唯一', d.posterCarto === 1, 'count=' + d.posterCarto);
  ok('足迹海报按钮唯一', d.posterBtn === 1);
  ok('横版海报按钮唯一', d.posterBtnH === 1);
  ok('生成年度报告按钮唯一', d.aiReport === 1);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== REVIEW CHECK FAIL ===' : '=== REVIEW CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
