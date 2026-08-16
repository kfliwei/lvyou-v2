/* 深度诊断：nation-index 动态加载状态 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  p.on('console', m => { const t = m.text(); if (/error|Error|Failed/i.test(t)) console.log('C-ERR:', t.slice(0, 160)); });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 160)));
  await p.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  const r = await p.evaluate(() => {
    const s = [...document.scripts].find(x => x.src.includes('nation-index'));
    return {
      scriptFound: !!s,
      src: s ? s.src : '',
      readyState: s ? s.readyState : '',
      hasRaw: !!window.NATION_SITES_RAW,
      rawLen: window.NATION_SITES_RAW ? window.NATION_SITES_RAW.length : 0,
      sites: (window.SITES || []).length
    };
  });
  console.log('状态:', JSON.stringify(r));
  /* 手动再触发一次 loadIndex（直接改 src 无 query） */
  await p.evaluate(() => {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'nation-index.js';
      s.onload = function () { resolve({ rawLen: (window.NATION_SITES_RAW || '').length }); };
      s.onerror = function () { resolve({ err: 'onerror' }); };
      document.head.appendChild(s);
    });
  }).then(r2 => console.log('无query加载:', JSON.stringify(r2)));
  await browser.close();
})();
