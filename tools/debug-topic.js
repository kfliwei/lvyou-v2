/* tools/debug-topic.js — 专题页节点显示排查（无 SW 环境，区分代码问题/缓存问题） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const topics = ['bj', 'tj', 'he', 'ha', 'sd', 'ln', 'jl', 'hlj', 'sh', 'js', 'zj', 'ah', 'fj', 'jx', 'gd', 'hi', 'hk', 'mo', 'tw'];

  for (const p of topics) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 120)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
    try {
      await page.goto('file:///' + path.join(ROOT, 'topic.html?p=' + p).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);
      const st = await page.evaluate(() => {
        const markers = document.querySelectorAll('#mapEl path.leaflet-interactive, #mapEl .leaflet-marker-icon, #mapEl svg path').length;
        return {
          title: document.title,
          totalTag: (document.getElementById('totalTag') || {}).textContent || '',
          sites: (window.SITES || []).length,
          mapReady: !!document.querySelector('#mapEl.leaflet-container'),
          markers: markers
        };
      });
      const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
      console.log(p.padEnd(4), '| sites:', String(st.sites).padEnd(4), '| markers:', String(st.markers).padEnd(4), '| totalTag:', st.totalTag.slice(0, 30).padEnd(32), '| errs:', real.length ? real.join(' ;; ').slice(0, 100) : 'none');
    } catch (e) {
      console.log(p.padEnd(4), '| NAV ERROR:', e.message.slice(0, 80));
    }
    await page.close();
  }
  await browser.close();
})();
