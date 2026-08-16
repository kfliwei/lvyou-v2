/* 带 console 执行一句话添加 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('console', m => { const t = m.text(); if (t.includes('[oneline]') || /error/i.test(t)) console.log('C:', t.slice(0, 140)); });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await p.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(8000);
  await p.evaluate(() => { const fab = document.querySelector('.nm-fab'); if (fab) fab.click(); });
  await sleep(400);
  await p.evaluate(() => { const item = document.querySelector('.nm-menu-item[data-a="ai"]'); if (item) item.click(); });
  await sleep(500);
  await p.evaluate(() => {
    const inp = document.getElementById('aiNodeInput');
    inp.value = '我想加成都武侯祠，三国文化';
    document.getElementById('aiNodeGo').click();
  });
  await sleep(3000);
  const r = await p.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('tn_userNodes') || '[]');
    return { saved: arr.map(x => x.name), modalClosed: !document.getElementById('aiNodeInput') };
  });
  console.log('结果:', JSON.stringify(r));
  await browser.close();
})();
