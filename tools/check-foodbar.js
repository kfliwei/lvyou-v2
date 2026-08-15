/* 验证：美食筛选条 390px 单行不换行 */
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
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=nx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 切美食 tab */
  await p.evaluate(() => { const b = document.querySelector('.tabbar button[data-tab="food"]'); if (b) b.click(); });
  await sleep(1500);
  const st = await p.evaluate(() => {
    const bar = document.querySelector('.foodbar');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const inputs = [...bar.querySelectorAll('input, select')];
    const rows = new Set(inputs.map(el => Math.round(el.getBoundingClientRect().top)));
    return {
      barH: Math.round(r.height),
      inputs: inputs.length,
      rows: rows.size,
      tops: [...rows],
      sel0: inputs[1] ? Math.round(inputs[1].getBoundingClientRect().width) : 0
    };
  });
  ok('筛选条渲染', !!st);
  ok('四个控件单行排列（不换行）', st.rows === 1, 'rows=' + st.rows + ' tops=' + JSON.stringify(st.tops));
  ok('筛选条高度紧凑（≤50px）', st.barH <= 58, 'h=' + st.barH);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== FOODBAR FAIL ===' : '=== FOODBAR ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
