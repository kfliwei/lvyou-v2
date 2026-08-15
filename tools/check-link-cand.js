/* 验证：无偏好行 + 省→主题→候选实时联动 */
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
  /* 0. 先触发意图卡渲染 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('云南')); if (c) c.click(); });
  await sleep(1200);
  /* 1. 意图卡无「偏好」行 */
  const r1 = await p.evaluate(() => ({
    prefFld: [...document.querySelectorAll('#intentCard .fld')].some(f => f.textContent.includes('偏好')),
    mineChip: [...document.querySelectorAll('#intentCard .chip')].some(c => c.textContent.includes('我的节点')),
    regions: document.querySelectorAll('#intentRegions .chip').length
  }));
  ok('意图卡无偏好行 + 📌我的独立可见', !r1.prefFld && r1.mineChip && r1.regions >= 30, JSON.stringify(r1));
  /* 2. 点目的地「四川」→ 主题展开 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '四川'); if (c) c.click(); });
  await sleep(700);
  const r2 = await p.evaluate(() => {
    const box = document.getElementById('intentProvThemes');
    return { shown: box.style.display === 'block', chips: box.querySelectorAll('.chip').length, title: (box.querySelector('div') || {}).textContent || '' };
  });
  ok('点省展开主题标签', r2.shown && r2.chips > 0, r2.title.slice(0, 40));
  /* 3. 记录联动前候选数（四川全量），点主题「古城古镇」→ 候选实时刷新且变化 */
  const c1 = await p.evaluate(() => ({
    n: document.querySelectorAll('.cand, [class*="cand"]').length,
    sample: (document.querySelector('.cand, [class*="cand"]') || { textContent: '' }).textContent.slice(0, 20)
  }));
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip'); if (c) c.click(); });
  await sleep(900);
  const r3 = await p.evaluate(() => ({
    on: document.querySelectorAll('#intentProvThemes .chip.on').length,
    n: document.querySelectorAll('.cand, [class*="cand"]').length,
    prefsHint: (document.querySelector('.summ, [class*="summ"]') || { textContent: '' }).textContent.slice(0, 30)
  }));
  ok('点主题候选实时联动', r3.on === 1 && r3.n > 0 && r3.n !== c1.n, '候选 ' + c1.n + '→' + r3.n);
  /* 4. 主题选中态：候选内容确为该主题景点（抽查首候选主题） */
  const r4 = await p.evaluate(() => {
    const c = document.querySelector('.cand, [class*="cand"]');
    return c ? c.textContent.slice(0, 30) : '';
  });
  ok('联动后候选可见', r4.length > 0, r4);
  /* 5. 再点一次同主题 → 取消 → 候选恢复省全量 */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip.on'); if (c) c.click(); });
  await sleep(900);
  const r5 = await p.evaluate(() => document.querySelectorAll('.cand, [class*="cand"]').length);
  ok('取消主题候选恢复', r5 === c1.n, '候选 ' + r5 + '（原 ' + c1.n + '）');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== LINK FAIL ===' : '=== LINK ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
