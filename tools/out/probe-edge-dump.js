/* probe-edge-dump.js — 把「这一屏到底画了什么」一次摊开
 *
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/probe-edge-dump.js [id] [zoom…]
 * probe-edge-points 报出「452 档 sx/sc 在 zoom 8~10 一个标记都没画」，先确认这是真的
 * 还是选择器没对上：把 markerPane 的 class 分布、LOD 层级表、视野内站点数三者一起打。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');

const PORT = 8164;
const BASE = 'http://localhost:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(d); });
});

const DUMP = `(() => {
  const mp = document.querySelector('#mapEl .leaflet-marker-pane');
  const cls = {};
  if (mp) [].slice.call(mp.children).forEach(function (el) {
    const key = (el.className || '').split(' ').filter(Boolean).slice(0, 3).join('.') || el.tagName;
    const inner = el.querySelector('.tr-node,.lod-cl,.mem-node');
    cls[(inner ? inner.className.split(' ')[0] : el.className.split(' ')[0])] = (cls[(inner ? inner.className.split(' ')[0] : el.className.split(' ')[0])] || 0) + 1;
  });
  const m = window.TopicEngine && window.TopicEngine._map;
  const b = m.getBounds();
  const sites = (window.TOPIC_SITES || (window.TopicData && window.TopicData.SITES) || null);
  let inView = null, total = null;
  try { const L2 = window.TopicEngine._map; const lst = (window.__lodList && window.__lodList()) || null; void lst; } catch (e) {}
  const lv = window.__nodeLOD && window.__nodeLOD.getLevels ? window.__nodeLOD.getLevels() : null;
  return {
    zoom: m.getZoom(), size: m.getSize(),
    bounds: [b.getSouth().toFixed(2), b.getWest().toFixed(2), b.getNorth().toFixed(2), b.getEast().toFixed(2)],
    markerPaneChildren: mp ? mp.children.length : -1,
    classHist: cls,
    levels: lv ? lv.map(function (x) { return x.key + '[' + x.zMin + '..' + x.zMax + ']'; }).join(' ') : 'null',
    mapElRect: (function () { const r = document.getElementById('mapEl').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    lodEnabled: !!(window.TOPIC_REGISTRY && window.TOPIC_REGISTRY[(location.search.match(/[?&]p=([^&]+)/) || [])[1] || 'sc'] || {}).lodEnabled
  };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 1 });
  const id = process.argv[2] || 'sx';
  const zooms = process.argv.slice(3).map(Number);
  await page.goto(`${BASE}/topic.html?p=${id}`, { waitUntil: 'load', timeout: 40000 });
  await sleep(5000);
  console.log(`=== topic.html?p=${id} @452×995 ===`);
  console.log(JSON.stringify(await page.evaluate(DUMP), null, 1));
  for (const z of zooms) {
    await page.evaluate(`window.TopicEngine._map.setView(window.TopicEngine._map.getCenter(), ${z}, {animate:false})`);
    await sleep(1800);
    const d = await page.evaluate(DUMP);
    console.log(`zoom=${z} → pane 子元素 ${d.markerPaneChildren} / 类分布 ${JSON.stringify(d.classHist)} / 层级 ${d.levels} / bounds ${d.bounds.join(',')}`);
  }
  await browser.close(); server.close();
})().catch(e => { console.log('ERR ' + e.message); process.exit(2); });
