/* 验证：candHint 提示 + 按钮文案 */
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
    inp.value = '喀纳斯周边2天';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  const r = await p.evaluate(() => ({
    genBtn: document.getElementById('genBtn').textContent.trim(),
    schedBtn: document.getElementById('scheduleBtn').textContent.trim(),
    hint: (document.getElementById('candHint') || {}).textContent || 'no-el',
    hintDisp: document.getElementById('candHint') ? getComputedStyle(document.getElementById('candHint')).display : 'none',
    cands: document.querySelectorAll('.cand').length
  }));
  ok('按钮文案已改', r.genBtn === '开始规划' && r.schedBtn.includes('开始排期'), r.genBtn + ' / ' + r.schedBtn);
  ok('候选少时提示补位', r.cands < 8 && r.hintDisp === 'block', 'cands=' + r.cands + ' hint=' + r.hintDisp);
  await browser.close();
  console.log(fails ? '=== FIX FAIL ===' : '=== FIX ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
