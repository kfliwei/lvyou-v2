/* 验证：页面加载省份空选 + Key 自动写入 */
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
  /* 1. 初始：输入框空、意图卡未显示 */
  const r1 = await p.evaluate(() => ({
    input: document.getElementById('promptInput') ? document.getElementById('promptInput').value : '?',
    intentCardShown: document.getElementById('intentCard') ? document.getElementById('intentCard').innerHTML.length > 0 : false,
    stagePick: document.getElementById('stagePick') ? document.getElementById('stagePick').style.display : '?'
  }));
  ok('页面加载无意图卡/输入框空', !r1.intentCardShown && r1.input === '', JSON.stringify(r1));
  /* 2. Key 自动写入 localStorage */
  const r2 = await p.evaluate(() => ({
    global: !!window.__TN_AMAP_KEY__,
    stored: localStorage.getItem('tn_amap_key') || ''
  }));
  ok('tn-key.js 加载 + 自动写入 localStorage', r2.global && r2.stored.length === 32, 'global=' + r2.global + ' storedLen=' + r2.stored.length);
  /* 3. 点示例（川西）→ 意图卡四川选中（用户操作才选中） */
  await p.evaluate(() => { const b = document.getElementById('seedExample'); if (b) b.click(); });
  await sleep(2500);
  const r3 = await p.evaluate(() => ({
    regionsOn: [...document.querySelectorAll('#intentRegions .chip.on')].map(c => c.textContent.trim()).join(','),
    cands: document.querySelectorAll('.cand, [class*="cand"]').length
  }));
  ok('点示例后四川选中（操作触发）', r3.regionsOn === '四川' && r3.cands > 0, JSON.stringify(r3));
  /* 4. 刷新后重置（无残留选中） */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const r4 = await p.evaluate(() => ({
    input: document.getElementById('promptInput') ? document.getElementById('promptInput').value : '?',
    intentCardShown: document.getElementById('intentCard') ? document.getElementById('intentCard').innerHTML.length > 0 : false
  }));
  ok('刷新后无残留（输入框空、无意图卡）', !r4.intentCardShown && r4.input === '', JSON.stringify(r4));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== DEFAULT-REGION FAIL ===' : '=== DEFAULT-REGION ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
