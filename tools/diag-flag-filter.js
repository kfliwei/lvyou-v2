/* 诊断：专题页"必去/网红"标签与地图节点联动 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('file:///' + path.join(ROOT, 'topic.html').replace(/\\/g, '/') + '?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  const info = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#dynChips .chip')].map(c => c.textContent.trim());
    const flagChips = chips.filter(t => t === '全部' || t === '必去' || t === '网红');
    return {
      flagChips,
      hasState: typeof window.TopicEngine !== 'undefined',
      totalTag: document.querySelector('#totalTag') ? document.querySelector('#totalTag').textContent : '',
      chipCount: chips.length
    };
  });
  console.log('chips:', JSON.stringify(info));

  // 点击"必去"
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#dynChips .chip')];
    const bq = btns.find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  const after = await page.evaluate(() => {
    const markers = [...document.querySelectorAll('.leaflet-marker-icon')];
    const dims = markers.filter(m => /dim/.test(m.className)).length;
    const listItems = [...document.querySelectorAll('.site-list .si, .list .si')];
    return {
      markers: markers.length,
      dimMarkers: dims,
      markerSample: markers.slice(0, 3).map(m => m.className),
      listCount: listItems.length
    };
  });
  console.log('after 必去:', JSON.stringify(after));

  // 点"全部"恢复
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#dynChips .chip')];
    const all = btns.find(c => c.textContent.trim() === '全部');
    if (all) all.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  const restored = await page.evaluate(() => ({
    markers: document.querySelectorAll('.leaflet-marker-icon').length,
    dimMarkers: [...document.querySelectorAll('.leaflet-marker-icon')].filter(m => /dim/.test(m.className)).length
  }));
  console.log('恢复全部:', JSON.stringify(restored));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
