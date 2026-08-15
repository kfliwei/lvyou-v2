/* 验证：单一省份列表 + 点目的地chip展开省主题 */
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
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('云南')); if (c) c.click(); });
  await sleep(1500);
  /* 1. 只有一个省份列表（intentRegions），无独立 intentProvs */
  const r1 = await p.evaluate(() => ({
    regions: document.querySelectorAll('#intentRegions .chip').length,
    provsBox: !!document.getElementById('intentProvs'),
    provsChips: document.querySelectorAll('#intentProvs .chip').length
  }));
  ok('仅一个省份列表', r1.regions >= 30 && r1.provsChips === 0, 'regions=' + r1.regions + ' provs=' + r1.provsChips);
  /* 2. 点目的地"四川" → 展开省主题 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '四川'); if (c) c.click(); });
  await sleep(600);
  const r2 = await p.evaluate(() => {
    const box = document.getElementById('intentProvThemes');
    return { shown: box.style.display === 'block', chips: box.querySelectorAll('.chip').length, text: (box.textContent || '').slice(0, 40) };
  });
  ok('点目的地chip展开省主题', r2.shown && r2.chips > 0, r2.text);
  /* 3. 点主题 → 并入偏好 on */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip'); if (c) c.click(); });
  await sleep(500);
  const on = await p.evaluate(() => document.querySelectorAll('#intentProvThemes .chip.on').length);
  ok('省主题选中', on === 1, 'on=' + on);
  /* 4. 目的地选中态仍在（四川 on） */
  const rgOn = await p.evaluate(() => [...document.querySelectorAll('#intentRegions .chip')].filter(c => c.classList.contains('on')).map(c => c.textContent.trim()).join(','));
  ok('目的地选中保留', rgOn.includes('四川'), rgOn);
  /* 5. 📌 我的 */
  await p.evaluate(() => { localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'm1', name: '我家后山观景台', lat: 30.5, lng: 104.0, gcj: false, province: '四川', city: '成都', category: '观景台', tags: [], desc: '', createdAt: Date.now() }])); });
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentCard .chip')].find(x => x.textContent.includes('我的节点')); if (c) c.click(); });
  await sleep(600);
  const mine = await p.evaluate(() => [...document.querySelectorAll('.cand')].some(c => c.textContent.includes('我家后山')));
  ok('📌 我的节点加入候选', mine);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== MERGE FAIL ===' : '=== MERGE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
