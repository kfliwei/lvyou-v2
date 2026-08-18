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
  await page.evaluate(() => { document.getElementById('seedExample').click(); });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => {
    const ck = document.querySelectorAll('#candList .cand .ck');
    for (let i = 0; i < Math.min(5, ck.length); i++) ck[i].click();
  });
  await new Promise(r => setTimeout(r, 800));

  async function gotoWizardStep3() {
    await page.evaluate(() => { document.getElementById('scheduleBtn').click(); });
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => { document.getElementById('wNext').click(); });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => { document.getElementById('wNext').click(); });
    await new Promise(r => setTimeout(r, 400));
  }
  async function readOrder() {
    await page.evaluate(() => { document.getElementById('wNext').click(); });
    await new Promise(r => setTimeout(r, 400));
    const w4 = await page.evaluate(() => document.getElementById('wizardBox').textContent);
    await page.evaluate(() => { document.getElementById('wDone').click(); });
    await new Promise(r => setTimeout(r, 2500));
    const stops = await page.evaluate(() => [...document.querySelectorAll('#resultBody .stop .lbl')].map(e => e.textContent.trim()).filter(Boolean));
    return { first: stops[0] || '', last: stops[stops.length - 1] || '', w4HasDesc: w4.includes('倒序') };
  }

  // 正序
  await gotoWizardStep3();
  const asc = await readOrder();
  console.log('正序:', JSON.stringify(asc));

  // 回向导 → 第 3 步 → 倒序
  await page.evaluate(() => { window.plannerReschedule(); });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wOrderDesc').click(); });
  await new Promise(r => setTimeout(r, 400));
  const desc = await readOrder();
  console.log('倒序:', JSON.stringify(desc));

  ok('倒序已选（第4步显示倒序）', desc.w4HasDesc, '');
  ok('倒序与正序顺序不同', asc.first !== desc.first || asc.last !== desc.last, 'asc=' + asc.first + ' desc=' + desc.first);
  console.log(fails ? '=== ORDER CHECK FAIL ===' : '=== ORDER CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
