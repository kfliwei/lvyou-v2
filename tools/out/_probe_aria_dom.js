/* 一次性探针：摸 topic.html 在 452×995 下标记与弹层的可访问性 DOM，用完即删 */
const puppeteer = require('../../tools/node_modules/puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  await p.goto(fileUrl('topic.html') + '?p=bj', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const low = await p.evaluate(() => ({
    zoom: window.TopicEngine._map.getZoom(),
    icons: Array.from(document.querySelectorAll('.leaflet-marker-icon')).slice(0, 6)
      .map(e => ({ al: e.getAttribute('aria-label'), role: e.getAttribute('role'), ti: e.getAttribute('tabindex') })),
    n: document.querySelectorAll('.leaflet-marker-icon').length
  }));
  console.log('LOW', JSON.stringify(low));
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await new Promise(r => setTimeout(r, 2000));
  const hi = await p.evaluate(() => ({
    zoom: window.TopicEngine._map.getZoom(),
    n: document.querySelectorAll('.leaflet-marker-icon').length,
    icons: Array.from(document.querySelectorAll('.leaflet-marker-icon')).slice(0, 8)
      .map(e => ({ al: e.getAttribute('aria-label'), role: e.getAttribute('role'), ti: e.getAttribute('tabindex'), cls: String(e.className).slice(0, 40) }))
  }));
  console.log('HI', JSON.stringify(hi, null, 1));
  const snap = await p.accessibility.snapshot({ interestingOnly: true });
  const walk = (n, out) => { if (!n) return out; if (n.role === 'button' || n.role === 'image') out.push(n.role + '|' + (n.name || '')); (n.children || []).forEach(c => walk(c, out)); return out; };
  console.log('SNAP', JSON.stringify(walk(snap, []).slice(0, 20)));
  console.log('ERRS', errs.slice(0, 3));
  await b.close();
})().catch(e => console.log('FATAL', e.message));
