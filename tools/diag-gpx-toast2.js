const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 250)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '西湖|30.24|120.15', label: '西湖', lat: 30.24, lng: 120.15, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2500));

  const env = await page.evaluate(() => ({
    uiToast: typeof UI !== 'undefined' ? typeof UI.toast : 'UI undefined',
    exportFn: typeof window.__exportPlan,
    planDays: (window.__planDays || []).length,
    androidVoice: typeof window.AndroidVoice,
    bodyDivs: document.body.children.length
  }));
  console.log('环境:', JSON.stringify(env));

  // 手动调用并捕获结果
  const result = await page.evaluate(() => {
    try {
      window.__exportPlan();
      return 'called-ok';
    } catch (e) {
      return 'THREW: ' + e.message;
    }
  });
  console.log('调用结果:', result);
  await new Promise(r => setTimeout(r, 600));
  const toasts = await page.evaluate(() => {
    return [...document.querySelectorAll('body > div')].filter(d => d.style.position === 'fixed').map(d => ({ t: d.textContent.slice(0, 40), bg: d.style.background || d.style.backgroundColor }));
  });
  console.log('fixed divs:', JSON.stringify(toasts));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
