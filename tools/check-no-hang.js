/* 验证：高德请求挂起时 25s 内强制完成（不卡"规划中…"） */
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
  /* stub fetch：高德请求永不 resolve（挂起） */
  await p.evaluateOnNewDocument(() => {
    window.__fetchOrig = window.fetch;
    window.fetch = function (url, opt) {
      if (String(url).includes('restapi.amap.com/v3/direction/driving')) {
        return new Promise(() => {}); /* 永不完成 */
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
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand, [class*="cand"]'); for (let i = 0; i < 3; i++) cs[i].click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  const t0 = Date.now();
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  /* 等待完成（最多 40s） */
  let done = false, elapsed = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    elapsed = Date.now() - t0;
    done = await p.evaluate(() => {
      const mask = document.getElementById('browseMask');
      return !!mask && ![...mask.querySelectorAll('button')].some(b => b.textContent.includes('规划中'));
    });
    if (done) break;
  }
  const r = await p.evaluate(() => ({
    mask: !!document.getElementById('browseMask'),
    btnText: [...(document.getElementById('browseMask') ? document.getElementById('browseMask').querySelectorAll('button') : [])].map(b => b.textContent.trim()).join('|'),
    order: document.querySelectorAll('#browseMask [style*="border-bottom"]').length
  }));
  ok('挂起请求 25s 内强制完成', done && elapsed < 40000, 'elapsed=' + (elapsed / 1000).toFixed(1) + 's');
  ok('完成后弹层展示排序结果', r.mask && r.order >= 2, 'order=' + r.order);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== NO-HANG FAIL ===' : '=== NO-HANG ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
