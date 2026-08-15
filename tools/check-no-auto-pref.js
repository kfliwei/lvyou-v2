/* 验证：解析偏好隐形（标题不再出现自然风光），手动主题才显示 */
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

  /* 1. 输入含"自然"的意图 → 开始规划 */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去自然风光好的地方玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  const t1 = await p.evaluate(() => ({
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent,
    first: (document.querySelector('.cand, [class*="cand"]') || { textContent: '' }).textContent.slice(0, 40)
  }));
  ok('标题不再显示解析偏好「自然风光」', !t1.title.includes('自然风光'), t1.title);
  ok('候选仍按解析偏好召回（自然类景点优先）', /山川|湖泊|自然|风景|峡谷|草原|森林|雪山|冰川|名山|湿地|公园|风光/.test(t1.first), t1.first);

  /* 2. 点省「云南」→ 标题含省、无自然风光 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '云南'); if (c) c.click(); });
  await sleep(900);
  const t2 = await p.evaluate(() => (document.getElementById('candTitle') || { textContent: '' }).textContent);
  ok('点省后标题只含省', t2.includes('云南') && !t2.includes('自然风光'), t2);

  /* 3. 点主题「古城古镇」→ 标题含省+主题 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentProvThemes .chip')].find(x => x.textContent.trim() === '古城古镇'); if (c) c.click(); });
  await sleep(900);
  const t3 = await p.evaluate(() => (document.getElementById('candTitle') || { textContent: '' }).textContent);
  ok('手动主题正常显示', t3.includes('古城古镇') && !t3.includes('自然风光'), t3);

  /* 4. 取消主题 → 无主题、无自然风光（手动接管后解析偏好已作废） */
  await p.evaluate(() => { const c = document.querySelector('#intentProvThemes .chip.on'); if (c) c.click(); });
  await sleep(900);
  const t4 = await p.evaluate(() => (document.getElementById('candTitle') || { textContent: '' }).textContent);
  ok('取消主题后无残留偏好', !t4.includes('古城古镇') && !t4.includes('自然风光'), t4);

  /* 5. 输入不含省的文本 → 省份空选 */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '随便走走玩2天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2000);
  const t5 = await p.evaluate(() => document.querySelectorAll('#intentRegions .chip.on').length);
  ok('无省份意图时省份空选', t5 === 0, 'on=' + t5);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== NO-AUTO-PREF FAIL ===' : '=== NO-AUTO-PREF ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
