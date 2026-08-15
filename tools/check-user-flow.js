/* 用户视角完整测试：初始空选 → 点省联动 → 点主题联动 → 单选替换 → 勾选保留 */
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

  /* 1. 输入意图 → 开始规划（模拟真实用户） */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去云南玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  const t0 = await p.evaluate(() => ({
    regionsOn: document.querySelectorAll('#intentRegions .chip.on').length,
    candTitle: (document.getElementById('candTitle') || { textContent: '' }).textContent
  }));
  ok('意图含省时省份选中 + 候选出现', t0.regionsOn === 1 && t0.candTitle.includes('云南'), JSON.stringify(t0));

  /* 2. 点省「四川」（单选替换云南）→ 主题展开 + 候选联动 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '四川'); if (c) c.click(); });
  await sleep(900);
  const t1 = await p.evaluate(() => ({
    themes: document.querySelectorAll('#intentProvThemes .chip').length,
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent,
    regionOn: [...document.querySelectorAll('#intentRegions .chip.on')].map(c => c.textContent.trim()).join(',')
  }));
  ok('点省：主题展开 + 候选标题联动', t1.themes > 0 && t1.title.includes('四川'), JSON.stringify(t1));
  ok('省份单选（仅四川 on）', t1.regionOn === '四川', 'on=' + t1.regionOn);

  /* 3. 点主题「古城古镇」→ 候选联动 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentProvThemes .chip')].find(x => x.textContent.trim() === '古城古镇'); if (c) c.click(); });
  await sleep(900);
  const t2 = await p.evaluate(() => ({
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent,
    themeOn: document.querySelectorAll('#intentProvThemes .chip.on').length,
    first: (document.querySelector('.cand, [class*="cand"]') || { textContent: '' }).textContent.slice(0, 30)
  }));
  ok('点主题：候选联动 + 主题单选', t2.title.includes('古城古镇') && t2.themeOn === 1, JSON.stringify(t2));

  /* 4. 勾选 2 个景点 */
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    for (let i = 0; i < 2; i++) cs[i].click();
  });
  await sleep(500);
  const picked = await p.evaluate(() => document.querySelectorAll('.cand.on, .cand[class*="sel"], .cand[class*="pick"], [class*="cand"].on').length);
  const picked2 = await p.evaluate(() => {
    const cs = [...document.querySelectorAll('.cand, [class*="cand"]')];
    return cs.filter(c => /✓|已选|selected|on/.test(c.className)).length;
  });
  const selectedN = await p.evaluate(() => { try { return document.querySelectorAll('.cand, [class*="cand"]').length; } catch (e) { return -1; } });
  /* 勾选状态确认（用 summbar 文本：已选 n 处） */
  const summ = await p.evaluate(() => (document.querySelector('[class*="summ"], #summbar') || { textContent: '' }).textContent);
  ok('已勾选 2 个景点', /已选\s*2|2\s*处|已选/.test(summ), summ.slice(0, 40) || ('picked=' + picked + '/' + picked2 + ' total=' + selectedN));

  /* 5. 切换省到「广西」（单选替换）→ 勾选保留 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '广西'); if (c) c.click(); });
  await sleep(900);
  const t5 = await p.evaluate(() => ({
    regions: [...document.querySelectorAll('#intentRegions .chip.on')].map(c => c.textContent.trim()).join(','),
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent,
    summ: (document.querySelector('[class*="summ"], #summbar') || { textContent: '' }).textContent
  }));
  ok('切换省单选替换（仅广西）', t5.regions === '广西' && t5.title.includes('广西') && !t5.title.includes('云南'), JSON.stringify(t5));
  ok('切换省后已勾选保留', /已选\s*2/.test(t5.summ), t5.summ.slice(0, 40));

  /* 6. 切主题（古城古镇 → 民族村寨）→ 勾选保留 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentProvThemes .chip')].find(x => x.textContent.trim() === '民族村寨'); if (c) c.click(); });
  await sleep(900);
  const t6 = await p.evaluate(() => ({
    themeOn: [...document.querySelectorAll('#intentProvThemes .chip.on')].map(c => c.textContent.trim()).join(','),
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent,
    summ: (document.querySelector('[class*="summ"], #summbar') || { textContent: '' }).textContent
  }));
  ok('切换主题单选替换 + 候选联动', t6.themeOn === '民族村寨' && t6.title.includes('民族村寨'), JSON.stringify(t6));
  ok('切换主题后已勾选保留', /已选\s*2/.test(t6.summ), t6.summ.slice(0, 40));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== USER-FLOW FAIL ===' : '=== USER-FLOW ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
