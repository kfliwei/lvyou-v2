const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    try { localStorage.setItem('tn_guide', '1'); localStorage.setItem('tn_onboarded', '1'); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    localStorage.setItem('tn_amap_key', 'mock');
    window.__tnShowPlacePicker('北京市东城区景山前街4号', [
      { label: '故宫博物院', lat: 39.916, lng: 116.397, dist: 120, addr: '景山前街4号' },
      { label: '景山公园', lat: 39.928, lng: 116.397, dist: 450, addr: '景山西街44号' },
      { label: '天安门广场', lat: 39.903, lng: 116.397, dist: 900, addr: '东长安街' },
      { label: '王府井步行街', lat: 39.91, lng: 116.41, dist: 1300, addr: '王府井大街' }
    ], 39.916, 116.397, function () {}, function () {});
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'F:\\MyAi\\trace\\.openclaw\\tmp\\picker-v2.png' });
  const d = await page.evaluate(() => {
    const sheet = document.getElementById('placePicker');
    const rows = [...document.querySelectorAll('#placePicker div')].filter(x => x.textContent.includes('米') && x.textContent.length < 20);
    return { shown: !!sheet, distBadges: rows.length, hasSeal: sheet ? sheet.textContent.includes('记') : false, hasCur: sheet ? sheet.textContent.includes('当前位置') : false };
  });
  console.log(JSON.stringify(d));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
