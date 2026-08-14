/* 调试：sx 专题 zoom 12 节点层为何不渲染 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4500));

  const d1 = await page.evaluate(() => {
    const map = window.TopicEngine._map;
    return { zoom: map.getZoom(), center: map.getCenter(), bounds: map.getBounds().toBBoxString(), levels: window.__nodeLOD ? JSON.stringify(window.__nodeLOD.getLevels()) : null };
  });
  console.log('默认:', JSON.stringify(d1));

  await page.evaluate(() => {
    const map = window.TopicEngine._map;
    const c = map.getCenter();
    map.setView([c.lat, c.lng], 12);
  });
  await new Promise(r => setTimeout(r, 2500));
  const d2 = await page.evaluate(() => {
    const map = window.TopicEngine._map;
    const b = map.getBounds();
    // 统计视野内 SITES 节点数（直接算）
    const sites = window.__nodeLOD ? null : null;
    return {
      zoom: map.getZoom(),
      bounds: b.toBBoxString(),
      levels: window.__nodeLOD ? JSON.stringify(window.__nodeLOD.getLevels()) : null,
      markers: document.querySelectorAll('#mapEl .leaflet-marker-icon').length,
      trNodes: document.querySelectorAll('#mapEl .tr-node').length,
      trDims: document.querySelectorAll('#mapEl .tr-dim').length,
      lodCls: document.querySelectorAll('#mapEl .lod-cl').length
    };
  });
  console.log('zoom12:', JSON.stringify(d2));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
