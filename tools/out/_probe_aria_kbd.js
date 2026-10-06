/* 一次性探针：摸 topic.html 在 452×995 下标记与弹层的可访问性 DOM，用完即删 */
const puppeteer = require('../../tools/node_modules/puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  await p.goto(fileUrl('topic.html') + '?p=bj', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await sleep(2500);
  console.log('LOW', JSON.stringify(await p.evaluate(() => ({
    zoom: window.TopicEngine._map.getZoom(),
    n: document.querySelectorAll('.leaflet-marker-icon').length,
    al: Array.from(document.querySelectorAll('.leaflet-marker-icon')).slice(0, 4).map(e => e.getAttribute('aria-label'))
  }))));
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await sleep(2000);
  /* 键盘腿：聚焦一枚标记 → 真按 Enter → 看弹层；Esc → 看焦点归还 */
  const info = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon')).filter(e => e.getAttribute('aria-label'));
    if (!els.length) return null;
    els[0].focus();
    return { n: els.length, first: els[0].getAttribute('aria-label'), active: document.activeElement === els[0], ax: els[0].getAttribute('aria-expanded') };
  });
  console.log('FOCUS', JSON.stringify(info));
  await p.keyboard.press('Enter');
  await sleep(700);
  console.log('AFTER-ENTER', JSON.stringify(await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    return { open: s.classList.contains('show'), role: s.getAttribute('role'), label: s.getAttribute('aria-label'), modal: s.getAttribute('aria-modal'), active: document.activeElement.id || document.activeElement.className, ax: document.querySelector('.leaflet-marker-icon[aria-expanded="true"]') ? 'true' : 'none', scrollY: window.scrollY };
  })));
  await p.keyboard.press('Escape');
  await sleep(500);
  console.log('AFTER-ESC', JSON.stringify(await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    const ae = document.activeElement;
    return { open: s.classList.contains('show'), activeIsMarker: !!(ae && ae.classList && ae.classList.contains('leaflet-marker-icon')), activeLabel: ae && ae.getAttribute && ae.getAttribute('aria-label'), ax: document.querySelector('.leaflet-marker-icon[aria-expanded="true"]') ? 'still-true' : 'cleared' };
  })));
  /* Space 腿 */
  await p.evaluate(() => { const e = document.querySelector('.leaflet-marker-icon[aria-label]'); e.focus(); window.scrollTo(0, 0); });
  await p.keyboard.press('Space');
  await sleep(700);
  console.log('AFTER-SPACE', JSON.stringify(await p.evaluate(() => ({ open: document.getElementById('locSheet').classList.contains('show'), scrollY: window.scrollY }))));
  await p.keyboard.press('Escape');
  await sleep(300);
  /* 弹层内 Tab 圈住 */
  await p.evaluate(() => { const e = document.querySelector('.leaflet-marker-icon[aria-label]'); e.focus(); });
  await p.keyboard.press('Enter');
  await sleep(600);
  const inside = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    await sleep(80);
    inside.push(await p.evaluate(() => {
      const ae = document.activeElement, s = document.getElementById('locSheet');
      return (s.contains(ae) ? 'IN:' : 'OUT:') + (ae.id || String(ae.className).slice(0, 24) || ae.tagName);
    }));
  }
  console.log('TAB', JSON.stringify(inside));
  console.log('ERRS', errs.slice(0, 4));
  await b.close();
})().catch(e => console.log('FATAL', e.message, e.stack));
