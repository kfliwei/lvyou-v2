const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 120)));
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  await p.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 12); });
  await new Promise(r => setTimeout(r, 1600));

  const pre = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('#mapEl .tr-node')];
    const themes = {};
    nodes.forEach(n => {
      const t = n.dataset.th || n.dataset.theme || (n.getAttribute('aria-label') || '').slice(0, 24) || '(无)';
      themes[t] = (themes[t] || 0) + 1;
    });
    return {
      nodeCount: nodes.length,
      sampleAttrs: nodes.slice(0, 3).map(n => ({ cls: n.className, ds: Object.assign({}, n.dataset), aria: n.getAttribute('aria-label') })),
      themes,
      chips: [...document.querySelectorAll('#dynChips .chip')].map(c => ({ txt: c.textContent.trim().slice(0, 12), ds: Object.assign({}, c.dataset), on: c.classList.contains('on') })),
      legs: [...document.querySelectorAll('#legBody .lg')].map(l => ({ ds: Object.assign({}, l.dataset), txt: l.textContent.trim().slice(0, 14), on: l.classList.contains('on') })),
      state: (window.TopicEngine && typeof TopicEngine.state === 'object') ? Object.keys(TopicEngine.state).join(',') : '(none)',
    };
  });
  console.log('BEFORE', JSON.stringify(pre, null, 1));

  await p.evaluate(() => {
    for (const c of document.querySelectorAll('#dynChips .chip')) { if (c.textContent.includes('古建')) { c.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 1600));
  const post = await p.evaluate(() => ({
    total: document.querySelectorAll('#mapEl .tr-node').length,
    dim: document.querySelectorAll('#mapEl .tr-dim').length,
    chipOn: [...document.querySelectorAll('#dynChips .chip.on')].map(c => c.textContent.trim().slice(0, 12)),
    legOn: [...document.querySelectorAll('#legBody .lg.on')].map(l => l.dataset.th),
    filt: (function () { try { return JSON.stringify(window.TopicEngine.filterState || window.TopicEngine._filter || null); } catch (e) { return 'err'; } })(),
  }));
  console.log('AFTER', JSON.stringify(post, null, 1));
  await b.close();
})();
