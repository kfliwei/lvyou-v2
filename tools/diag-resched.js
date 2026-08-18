const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGE:', e.message.slice(0, 250)));
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => { document.getElementById('seedExample').click(); });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => {
    const ck = document.querySelectorAll('#candList .cand .ck');
    for (let i = 0; i < Math.min(3, ck.length); i++) ck[i].click();
  });
  await new Promise(r => setTimeout(r, 800));
  // 走向导排期
  await page.evaluate(() => { document.getElementById('scheduleBtn').click(); });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wDone').click(); });
  await new Promise(r => setTimeout(r, 2500));
  console.log('排期完成');
  // reschedule
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.evaluate(() => { window.plannerReschedule(); });
  await new Promise(r => setTimeout(r, 1000));
  const d = await page.evaluate(() => {
    const box = document.getElementById('wizardBox');
    return {
      boxDisplay: box ? box.style.display : 'no-box',
      boxHTML: box ? box.innerHTML.slice(0, 200) : '',
      hasNext: !!document.getElementById('wNext'),
      stagePick: document.getElementById('stagePick').style.display
    };
  });
  console.log(JSON.stringify(d));
  console.log('errors:', errs.join('|'));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
