/* 诊断：排期链路 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  p.on('console', m => { const t = m.text(); if (/error|Error|ERR/i.test(t)) console.log('C:', t.slice(0, 150)); });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 种子快捷意图 */
  await p.evaluate(() => {
    const inp = document.querySelector('#inputText') || document.querySelector('input[type="text"]');
    if (inp) { inp.value = '想去西双版纳和广西玩3天'; }
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  /* 勾选前两个候选 */
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    for (let i = 0; i < Math.min(2, cs.length); i++) cs[i].click();
  });
  await sleep(600);
  const before = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t.includes('排'));
    return { buttons: btns, selected: (window.state ? 'state-visible' : 'state-hidden') };
  });
  console.log('排期前:', JSON.stringify(before));
  /* 点排期 */
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /排期/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  const after = await p.evaluate(() => ({
    dayCards: document.querySelectorAll('[class*="day"]').length,
    mapBox: !!document.getElementById('mapBox'),
    mapShown: (document.getElementById('mapBox') || {}).style ? document.getElementById('mapBox').style.display : '?',
    stage: [...document.querySelectorAll('[id*="stage"]')].filter(el => el.style.display !== 'none').map(el => el.id).join(','),
    resultHtml: (document.getElementById('stageResult') || { innerHTML: '' }).innerHTML.length
  }));
  console.log('排期后:', JSON.stringify(after));
  /* 直接调用 */
  const direct = await p.evaluate(() => {
    try { window.plannerSchedule(); return 'ok'; } catch (e) { return 'ERR: ' + e.message; }
  });
  console.log('直接调用:', direct);
  await browser.close();
})();
