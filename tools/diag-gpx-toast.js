/* 验证：点击导出 GPX 是否出现提示 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|manifest/.test(m.text())) console.log('CONSOLE:', m.text().slice(0, 150)); });
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

  // 检查按钮
  const btn = await page.evaluate(() => {
    const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]');
    return b ? { exists: true, text: b.textContent, onclick: b.getAttribute('onclick') } : { exists: false };
  });
  console.log('按钮:', JSON.stringify(btn));

  // 点击
  await page.evaluate(() => { const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 800));

  // 检查 toast 类提示（UI.toast 创建 fixed 定位 div）
  const toast = await page.evaluate(() => {
    // flash 提示 = 内联 fixed div（top 14px，陶土橙背景）；ui-toast = CSS 类
    const divs = [...document.querySelectorAll('body > div')].filter(d => {
      const st = d.style;
      return (st.position === 'fixed' && /GPX|导出|规划/.test(d.textContent)) || (d.className === 'ui-toast' && /GPX|导出|规划/.test(d.textContent));
    });
    return divs.map(d => d.textContent);
  });
  console.log('toast:', JSON.stringify(toast));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
