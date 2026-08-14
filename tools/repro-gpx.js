/* 复现：规划地图显示完整性 + GPX 导出按钮 */
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
      { id: '西湖|30.24|120.15', label: '西湖', lat: 30.24, lng: 120.15, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: '外滩|31.24|121.49', label: '外滩', lat: 31.24, lng: 121.49, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 3000));

  const d = await page.evaluate(() => {
    const map = document.getElementById('wlMap');
    const mr = map.getBoundingClientRect();
    const markers = [...document.querySelectorAll('#wlMap .leaflet-marker-icon')].map(m => {
      const r = m.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const inside = markers.filter(m => m.x >= mr.left && m.x + m.w <= mr.right && m.y >= mr.top && m.y + m.h <= mr.bottom).length;
    const linesVisible = [...document.querySelectorAll('#wlMap .leaflet-overlay-pane path')].filter(p => { const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
    return {
      mapRect: { w: Math.round(mr.width), h: Math.round(mr.height) },
      markers: markers.length,
      markersInside: inside,
      linesVisible,
      gpxBtn: !!document.querySelector('#wlPlan [onclick*="__exportPlan"]'),
      exportDefined: typeof window.__exportPlan === 'function',
      planDays: (window.__planDays || []).length
    };
  });
  console.log(JSON.stringify(d, null, 1));

  // 点击导出 GPX，观察下载事件
  const downloadPromise = new Promise(res => {
    page.on('download', dl => res('download:' + dl.suggestedFilename()));
    setTimeout(() => res('no-download-event'), 3000);
  });
  await page.evaluate(() => { const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]'); if (b) b.click(); });
  const dl = await downloadPromise;
  console.log('导出结果:', dl);
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
