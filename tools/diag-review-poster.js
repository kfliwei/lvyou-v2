/* 复现：review 页海报按钮点击行为 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 250)));
  await page.goto('file:///' + path.join(ROOT, 'review.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  const env = await page.evaluate(() => ({
    flash: typeof window.flash,
    fp: typeof window.FootprintPoster,
    posterBtn: !!document.getElementById('posterBtn'),
    posterBtnH: !!document.getElementById('posterBtnH'),
    posterCarto: !!document.getElementById('posterCarto'),
    notes: window.TravelNotes ? window.TravelNotes.list().length : -1,
    notesWithPos: window.TravelNotes ? window.TravelNotes.list().filter(n => n.lat != null).length : -1
  }));
  console.log('环境:', JSON.stringify(env));

  // 点击足迹海报
  await page.evaluate(() => { const b = document.getElementById('posterBtn'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const after = await page.evaluate(() => {
    const fixed = [...document.querySelectorAll('body > div')].filter(d => d.style.position === 'fixed').map(d => d.textContent.slice(0, 40));
    const canvases = document.querySelectorAll('canvas').length;
    return { fixed, canvases };
  });
  console.log('点击后:', JSON.stringify(after));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
