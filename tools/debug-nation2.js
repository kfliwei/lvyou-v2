/* 调试：nation 页手动加载 sx-data.js 验证合并链路 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  const reqs = [];
  page.on('request', r => { if (r.url().includes('data.js')) reqs.push(r.url().split('/').pop()); });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  const r = await page.evaluate(async () => {
    const out = { before: (window.SITES || []).length, first: window.SITES && window.SITES[0] && window.SITES[0].name };
    /* 手动加载 sx-data.js */
    await new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'sx-data.js';
      sc.onload = resolve;
      sc.onerror = () => reject(new Error('load fail'));
      document.head.appendChild(sc);
    });
    out.after = (window.SITES || []).length;
    out.afterFirst = window.SITES && window.SITES[0] && window.SITES[0].name;
    out.hasDesc = !!(window.SITES || []).find(x => x.name === '云冈石窟' && x.desc);
    return out;
  }).catch(e => ({ err: e.message }));
  console.log(JSON.stringify(r));
  console.log('data.js requests:', reqs.join(','));
  /* 打开 sheet 看 desc */
  await page.evaluate(() => { try { window.TopicEngine.openSheet(0); } catch (e) { console.log('openSheet err', e.message); } });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => ({
    sheet: !!document.querySelector('#locSheet.show'),
    desc: (document.querySelector('#locSheet .ls-desc') || {}).textContent || ''
  }));
  console.log('sheet:', JSON.stringify(d));
  console.log('all data.js requests:', reqs.join(','));
  await browser.close();
})();
