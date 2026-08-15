/* 验证：高德规划先排序（弹层顺序更新 + 不跳排期），再点开始排期出结果 */
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
  /* stub 高德：destination 经度越接近 105 距离越短（构造确定排序） */
  await p.evaluateOnNewDocument(() => {
    window.__fetchOrig = window.fetch;
    window.fetch = function (url, opt) {
      const u = String(url);
      if (u.includes('restapi.amap.com/v3/direction/driving')) {
        const m = u.match(/destination=([\d.]+),([\d.]+)/);
        const dist = m ? Math.abs(parseFloat(m[1]) - 105) * 80 + Math.abs(parseFloat(m[2]) - 30) * 60 : 50000;
        return Promise.resolve({ json: () => Promise.resolve({ status: '1', route: { paths: [{ distance: String(Math.max(8000, dist * 1000)) }] } }) });
      }
      return window.__fetchOrig(url, opt);
    };
  });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => localStorage.setItem('tn_amap_key', 'testkey'));
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去云南玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  /* 勾选 3 个，记录原始顺序 */
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand, [class*="cand"]'); for (let i = 0; i < 3; i++) cs[i].click(); });
  await sleep(500);
  const before = await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    const picked = [];
    cs.forEach(c => { if (/on|sel|✓/.test(c.className)) picked.push(c.textContent.slice(0, 12)); });
    return picked;
  });
  /* 点浏览 → 点高德规划 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  await sleep(3000);
  const after = await p.evaluate(() => ({
    maskOpen: !!document.getElementById('browseMask'),
    stageResultHidden: !document.getElementById('stageResult') || document.getElementById('stageResult').style.display === 'none',
    order: [...document.querySelectorAll('#browseMask [style*="border-bottom"]')].map(x => x.textContent.slice(0, 14))
  }));
  ok('排序后仍在浏览弹层（不跳排期）', after.maskOpen && after.stageResultHidden, 'mask=' + after.maskOpen + ' resultHidden=' + after.stageResultHidden);
  ok('弹层显示排序后新顺序', after.order.length === 3, JSON.stringify(after.order));
  /* 再点开始排期 → 出结果 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('关闭')); if (b) b.click(); });
  await sleep(300);
  await p.evaluate(() => { const b = document.getElementById('scheduleBtn'); if (b) b.click(); });
  await sleep(2500);
  const r3 = await p.evaluate(() => ({
    result: document.getElementById('stageResult') && document.getElementById('stageResult').style.display !== 'none',
    days: document.querySelectorAll('.day-card').length
  }));
  ok('排序后点开始排期出结果', r3.result && r3.days > 0, 'days=' + r3.days);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== SORT-FIRST FAIL ===' : '=== SORT-FIRST ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
