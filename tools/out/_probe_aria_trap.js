/* tools/out/_probe_aria_trap.js — 临时探针：摸 A16 Tab 逃逸的真实落点 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200)));
  await p.goto(fileUrl('topic.html') + '?p=bj', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await sleep(2500);
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await sleep(2000);

  await p.evaluate(() => { document.querySelector('.leaflet-marker-icon[aria-label]').focus(); });
  await p.keyboard.press('Enter');
  await sleep(1000);

  const info = await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    const def = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return {
      open: s.classList.contains('show'),
      bodyChildren: s.children.length + ':' + Array.from(s.children).map(c => c.id || c.className).join(','),
      list: Array.from(s.querySelectorAll(def)).map(e => e.tagName + '"' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 10)) + '"'),
      inBody: document.contains(s)
    };
  });
  console.log('开层后清单:', JSON.stringify(info));

  for (let i = 0; i <= 8; i++) {
    if (i) { await p.keyboard.press('Tab'); await sleep(70); }
    const r = await p.evaluate(() => {
      const ae = document.activeElement, s = document.getElementById('locSheet');
      return {
        t: ae.tagName + '"' + ((ae.getAttribute && ae.getAttribute('aria-label')) || (ae.textContent || '').trim().slice(0, 10)) + '"',
        inSheet: s.contains(ae), connected: ae.isConnected,
        chain: (() => { let n = ae, out = []; while (n && out.length < 6) { out.push(n.id || n.className || n.tagName); n = n.parentElement; } return out.join(' < '); })()
      };
    });
    console.log('hop' + i + ':', JSON.stringify(r));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
