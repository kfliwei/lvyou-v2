const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
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
  await page.evaluate(() => {
    const orig = L.map;
    L.map = function () { const m = orig.apply(this, arguments); window.__lastMap = m; return m; };
    const origM = L.marker;
    window.__mks = [];
    L.marker = function (latlng, opts) { window.__mks.push(JSON.parse(JSON.stringify(latlng))); return origM.apply(this, arguments); };
  });
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const map = window.__lastMap;
    const before = [...document.querySelectorAll('#wlMap .leaflet-marker-icon')].map(m => m.style.transform);
    // 手动触发 move 事件，看 transform 是否更新
    map.fire('move');
    const after = [...document.querySelectorAll('#wlMap .leaflet-marker-icon')].map(m => m.style.transform);
    // 手动 invalidateSize
    map.invalidateSize();
    const after2 = [...document.querySelectorAll('#wlMap .leaflet-marker-icon')].map(m => m.style.transform);
    return { mks: window.__mks, before, after, after2, zoom: map.getZoom(), center: map.getCenter() };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
