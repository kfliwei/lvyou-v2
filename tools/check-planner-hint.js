/* 冷门词验证候选补位提示 */
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
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    localStorage.removeItem('tn_amap_key');
    const inp = document.getElementById('promptInput');
    inp.value = '新西兰南岛玩3天';
    document.getElementById('genBtn').click();
  });
  await sleep(3500);
  const r = await p.evaluate(() => {
    const el = document.getElementById('candHint');
    return {
      cands: document.querySelectorAll('.cand').length,
      hint: el ? el.textContent.slice(0, 30) : 'no-el',
      hintDisp: el ? getComputedStyle(el).display : 'none',
      hintElExists: !!el
    };
  });
  console.log(JSON.stringify(r));
  ok('候选少时提示条显示', r.cands < 8 && r.hintDisp === 'block', 'cands=' + r.cands + ' disp=' + r.hintDisp);
  await browser.close();
  console.log(fails ? '=== HINT FAIL ===' : '=== HINT ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
