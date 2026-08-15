/* 审核：planner.html 全流程实测（无 AI Key 降级路径） */
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
  p.on('pageerror', e => errs.push(e.message.slice(0, 130)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 100)); });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);

  /* 1. 页面初始化 */
  const init = await p.evaluate(() => ({
    title: document.title,
    idx: (window.NATION_SITES_RAW || '').split('\n').length,
    seeds: document.querySelectorAll('.seed').length,
    aiSwitch: !!document.querySelector('.ai-switch'),
    input: !!document.querySelector('.input-bar input')
  }));
  ok('planner 初始化（索引' + init.idx + ' / 种子' + init.seeds + ' / AI开关' + init.aiSwitch + '）', init.idx > 7000 && init.seeds > 0 && init.aiSwitch && init.input);

  /* 2. 种子点击（快捷意图）→ 目的地 chips */
  await p.evaluate(() => { const s = document.querySelector('.seed'); if (s) s.click(); });
  await sleep(1200);
  const afterSeed = await p.evaluate(() => ({
    destChips: document.querySelectorAll('#destChips .chip, [id*=dest] .chip, .chip').length,
    intentShown: !!(document.querySelector('.card') && document.querySelector('.card').textContent.length > 0)
  }));
  ok('种子快捷意图生效', afterSeed.intentShown, JSON.stringify(afterSeed));

  /* 3. 手动输入意图（无 AI Key 降级路径） */
  await p.evaluate(() => {
    const inp = document.querySelector('.input-bar input');
    if (inp) { inp.value = '6天，西双版纳周边+广西，喜欢自然风光'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await sleep(800);
  /* 找触发按钮（生成/规划/分析） */
  const btnTxt = await p.evaluate(() => [...document.querySelectorAll('.input-bar button, .btn')].map(b => b.textContent.trim()).join('|'));
  console.log('按钮:', btnTxt);
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll('.input-bar button, .btn')];
    const b = btns.find(x => /生成|规划|分析|开始/.test(x.textContent)) || btns[0];
    if (b) b.click();
  });
  await sleep(3000);
  const afterInput = await p.evaluate(() => ({
    regions: (document.body.textContent.match(/西双版纳|广西/g) || []).length,
    days: (document.body.textContent.match(/天/g) || []).length,
    candidates: document.querySelectorAll('.cand, [class*="cand"]').length,
    body: document.body.textContent.slice(0, 200)
  }));
  console.log('输入后:', JSON.stringify(afterInput).slice(0, 200));
  ok('意图解析（区域/天数）', afterInput.regions > 0 && afterInput.days > 0);
  ok('候选列表渲染', afterInput.candidates > 0, 'candidates=' + afterInput.candidates);

  /* 4. 勾选候选 → 排期 → 结果 */
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    for (let i = 0; i < Math.min(2, cs.length); i++) cs[i].click();
  });
  await sleep(800);
  const afterPick = await p.evaluate(() => ({
    summ: (document.body.textContent.match(/已选|预计|天/g) || []).slice(0, 4).join(','),
    btn: [...document.querySelectorAll('.btn')].map(b => b.textContent.trim()).join('|')
  }));
  console.log('勾选后:', JSON.stringify(afterPick));
  /* 触发排期按钮 */
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll('.btn')];
    const b = btns.find(x => /生成|排|行程/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2000);
  const result = await p.evaluate(() => ({
    days: document.querySelectorAll('[class*="day"]').length,
    map: !!document.querySelector('.leaflet-container'),
    narrative: (document.body.textContent.match(/Day|D1|第一天/g) || []).length,
    saveBtn: [...document.querySelectorAll('.btn')].some(b => /保存|复制|GPX/.test(b.textContent))
  }));
  ok('排期结果渲染（天/地图/操作）', result.days > 0 || result.map, JSON.stringify(result));

  /* 5. 无脚本错误（过滤环境噪声） */
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));

  await browser.close();
  console.log(fails ? '=== PLANNER AUDIT FAIL ===' : '=== PLANNER AUDIT ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
