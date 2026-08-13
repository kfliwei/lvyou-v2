/* 诊断 NM.edit */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 300)));
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'test1', name: '测试茶馆', lat: 39.92, lng: 116.40, gcj: false, province: '北京市', city: '北京', category: '茶馆', tags: [], desc: '', createdAt: Date.now() }]));
  });
  const r = await page.evaluate(() => {
    const out = { nm: typeof window.NM, edit: typeof window.NM.edit };
    try {
      window.NM.edit('test1');
      out.form = !!document.getElementById('nmName');
      out.modals = document.querySelectorAll('.nm-mask').length;
      out.val = document.getElementById('nmName') ? document.getElementById('nmName').value : null;
    } catch (e) {
      out.err = e.message;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
