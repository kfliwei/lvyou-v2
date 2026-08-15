/* 调试日历/查看器 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  await p.evaluate(() => {
    localStorage.setItem('travelNotes', JSON.stringify([
      { id: 'c1', title: '石窟之行', siteName: '云冈石窟', lat: 40.1, lng: 113.1, ts: 1, date: '2026-08-01', text: '好震撼', photos: ['data:image/png;base64,AA==', 'data:image/png;base64,BB=='], raw: '' }
    ]));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const r1 = await p.evaluate(() => {
    TravelNotes.openList();
    return new Promise(function (resolve) {
      setTimeout(function () {
        const cal = document.getElementById('tnViewCal');
        resolve({
          hasCalBtn: !!cal,
          viewMode: cal ? 'ok' : 'no',
          calText: cal ? cal.textContent : ''
        });
      }, 800);
    });
  });
  console.log('1. 日历按钮:', JSON.stringify(r1));
  const r2 = await p.evaluate(() => {
    const cal = document.getElementById('tnViewCal');
    if (cal) cal.click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        const grid = document.querySelectorAll('.tn-cal-d').length;
        const body = document.querySelector('#tnListBody');
        resolve({ grid, bodyHtml: body ? body.innerHTML.slice(0, 200) : 'no body' });
      }, 800);
    });
  });
  console.log('2. 日历渲染:', JSON.stringify(r2));
  const r3 = await p.evaluate(() => {
    try {
      TravelNotes.zoomPhotoIdx('c1', 0);
      return new Promise(function (resolve) {
        setTimeout(function () { resolve({ viewer: !!document.querySelector('.tn-viewer'), imgs: document.querySelectorAll('.tn-viewer img').length }); }, 600);
      });
    } catch (e) { return { err: e.message }; }
  });
  console.log('3. 查看器:', JSON.stringify(r3));
  await browser.close();
})();
