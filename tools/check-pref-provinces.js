/* 修正测试：点 destChips 省份 chip 触发意图卡 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 1. 点 destChips 的"四川" */
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('四川'));
    if (c) c.click();
  });
  await sleep(1500);
  const provN = await p.evaluate(() => document.querySelectorAll('#intentProvs .chip').length);
  ok('省份 chips 渲染', provN >= 20, 'prov=' + provN);
  /* 2. 点省份"四川"（意图卡的省份行）→ 省主题标签 */
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#intentProvs .chip')].find(x => x.textContent.trim() === '四川');
    if (c) c.click();
  });
  await sleep(600);
  const themes = await p.evaluate(() => {
    const box = document.getElementById('intentProvThemes');
    return { shown: box.style.display === 'block', chips: box.querySelectorAll('.chip').length, sample: (box.textContent || '').slice(0, 30) };
  });
  ok('点省展开省主题标签', themes.shown && themes.chips > 0, themes.sample);
  /* 3. 点一个省主题 → 并入偏好 */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip'); if (c) c.click(); });
  await sleep(400);
  const prefOn = await p.evaluate(() => document.querySelectorAll('#intentProvThemes .chip.on').length);
  ok('省主题选中', prefOn === 1, 'on=' + prefOn);
  /* 4. 【我的】节点 */
  await p.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'm1', name: '我家后山观景台', lat: 30.5, lng: 104.0, gcj: false, province: '四川', city: '成都', category: '观景台', tags: [], desc: '', createdAt: Date.now() }]));
  });
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentPrefs .chip')].find(x => x.textContent.includes('我的')); if (c) c.click(); });
  await sleep(600);
  const mine = await p.evaluate(() => [...document.querySelectorAll('.cand')].some(c => c.textContent.includes('我家后山')));
  ok('【我的】节点加入候选', mine);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== PREF-PROV FAIL ===' : '=== PREF-PROV ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
