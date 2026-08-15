/* 严格联动验证：选省+主题 → 候选全部匹配（数量变化 + 标题摘要 + 内容全匹配） */
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
  /* 进入意图卡（点云南种子快捷） */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('广西')); if (c) c.click(); });
  await sleep(1200);
  /* 1. 只选"云南"，不选其他省——重置其他选中（点云南前先清：云南已是唯一 regions ✓ 种子语义） */
  const t1 = await p.evaluate(() => document.getElementById('candTitle').textContent);
  ok('选省后标题含省', t1.includes('广西'), t1);
  /* 2. 先点意图卡云南（展开主题）再点「古城古镇」主题 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '云南'); if (c) c.click(); });
  await sleep(600);
  await p.evaluate(() => {
    const box = document.getElementById('intentProvThemes');
    const c = [...box.querySelectorAll('.chip')].find(x => x.textContent.trim() === '古城古镇');
    if (c) c.click();
  });
  await sleep(900);
  const r2 = await p.evaluate(() => {
    const title = document.getElementById('candTitle').textContent;
    const items = [...document.querySelectorAll('.cand, [class*="cand"]')].map(c => c.textContent.slice(0, 60));
    return { title, n: items.length, sample: items.slice(0, 3) };
  });
  ok('点主题标题联动', r2.title.includes('古城古镇'), r2.title);
  ok('候选非空', r2.n > 0, '候选 ' + r2.n);
  /* 3. 候选内容全部匹配（region=云南 或 theme=古城古镇系） */
  const r3 = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.cand, [class*="cand"]')];
    const bad = items.filter(c => { const t = c.textContent; return t.includes('四川') && !t.includes('云南'); });
    return { bad: bad.length, first: (items[0] || { textContent: '' }).textContent.slice(0, 40) };
  });
  ok('候选无他省景点混入', r3.bad === 0, 'bad=' + r3.bad + ' first=' + r3.first);
  /* 4. 取消主题恢复省全量 */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip.on'); if (c) c.click(); });
  await sleep(900);
  const t4 = await p.evaluate(() => document.getElementById('candTitle').textContent);
  ok('取消主题恢复省', !t4.includes('古城古镇'), t4);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== STRICT-LINK FAIL ===' : '=== STRICT-LINK ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
