/* 验证：热门目的地点击 → 跳转意图卡阶段 + 候选联动 */
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
  /* 1. 初始在输入阶段 */
  const r0 = await p.evaluate(() => ({
    inputShown: document.getElementById('stageInput').style.display !== 'none',
    pickShown: document.getElementById('stagePick').style.display !== 'none'
  }));
  ok('初始在输入阶段', r0.inputShown && !r0.pickShown, JSON.stringify(r0));
  /* 2. 点热门目的地「四川」→ 跳转意图卡阶段 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#destChips .chip')].find(x => x.textContent.includes('四川')); if (c) c.click(); });
  await sleep(1200);
  const r1 = await p.evaluate(() => ({
    pickShown: document.getElementById('stagePick').style.display !== 'none',
    inputHidden: document.getElementById('stageInput').style.display === 'none',
    intentCard: document.getElementById('intentCard').innerHTML.length > 0,
    regionsOn: [...document.querySelectorAll('#intentRegions .chip.on')].map(c => c.textContent.trim()).join(','),
    cands: document.querySelectorAll('.cand, [class*="cand"]').length,
    title: (document.getElementById('candTitle') || { textContent: '' }).textContent
  }));
  ok('点击省跳转到意图卡阶段', r1.pickShown && r1.inputHidden && r1.intentCard, JSON.stringify(r1).slice(0, 120));
  ok('省份选中 + 候选联动', r1.regionsOn === '四川' && r1.cands > 0 && r1.title.includes('四川'), r1.title);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== HOTDEST-JUMP FAIL ===' : '=== HOTDEST-JUMP ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
