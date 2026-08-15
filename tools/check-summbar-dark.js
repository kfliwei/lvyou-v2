/* 验证：summbar 暗色模式 */
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
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); window.location.reload(); });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand'); for (let i = 0; i < 2; i++) cs[i].click(); });
  await sleep(500);
  const r = await p.evaluate(() => {
    const bar = document.querySelector('.summbar');
    if (!bar || getComputedStyle(bar).display === 'none') return { shown: false };
    const cs = getComputedStyle(bar);
    const lum = c => { const m = c.match(/\d+/g); if (!m) return 0; return (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3; };
    return { bg: cs.backgroundColor, color: cs.color, bgLum: Math.round(lum(cs.backgroundColor)), txt: bar.textContent.trim().slice(0, 20) };
  });
  ok('汇总条显示', r.shown || r.bg, JSON.stringify(r));
  if (r.bg) {
    ok('暗色下非浅宣纸底', r.bgLum < 180 && r.bg !== 'rgb(239, 233, 220)', 'bg=' + r.bg + ' lum=' + r.bgLum);
  }
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'auto'); });
  await browser.close();
  console.log(fails ? '=== SUMMBAR FAIL ===' : '=== SUMMBAR ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
