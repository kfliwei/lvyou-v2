/* 验证：浏览弹层【高德规划行程】— 有Key走真实距离排序直出排期；无Key提示 */
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
  /* stub 高德 driving：按坐标返回固定距离（体现矩阵排序） */
  await p.evaluateOnNewDocument(() => {
    window.__fetchOrig = window.fetch;
    window.fetch = function (url, opt) {
      const u = String(url);
      if (u.includes('restapi.amap.com/v3/direction/driving')) {
        const m = u.match(/origin=([\d.]+),([\d.]+)&destination=([\d.]+),([\d.]+)/);
        const dist = m ? Math.abs(parseFloat(m[1]) - parseFloat(m[3])) * 111 + Math.abs(parseFloat(m[2]) - parseFloat(m[4])) * 95 : 50000;
        return Promise.resolve({ json: () => Promise.resolve({ status: '1', route: { paths: [{ distance: String(Math.max(1000, dist * 1000)) }] } }) });
      }
      return window.__fetchOrig(url, opt);
    };
  });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 无 Key 场景：点高德规划 → 提示 */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去云南玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand, [class*="cand"]'); for (let i = 0; i < 2; i++) cs[i].click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  const r1 = await p.evaluate(() => ({
    btn: [...document.querySelectorAll('#browseMask button')].map(b => b.textContent.trim()),
    has: [...document.querySelectorAll('#browseMask button')].some(b => b.textContent.includes('高德规划'))
  }));
  ok('弹层有【高德规划行程】按钮', r1.has, r1.btn.join('|'));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  await sleep(500);
  const r2 = await p.evaluate(() => ({
    stillPick: document.getElementById('stagePick') && document.getElementById('stagePick').style.display !== 'none',
    toast: (document.querySelector('[class*="toast"]') || { textContent: '' }).textContent
  }));
  ok('无 Key 提示未配置', r2.stillPick, r2.toast.slice(0, 40));

  /* 有 Key 场景：真实距离排序 + 直出排期 */
  await p.evaluate(() => localStorage.setItem('tn_amap_key', 'testkey123'));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  await sleep(3000);
  const r3 = await p.evaluate(() => ({
    result: document.getElementById('stageResult') && document.getElementById('stageResult').style.display !== 'none',
    days: document.querySelectorAll('.day-card').length,
    title: (document.getElementById('resultTitle') || { textContent: '' }).textContent.slice(0, 30)
  }));
  ok('有 Key 直出排期结果', r3.result && r3.days > 0, 'days=' + r3.days + ' ' + r3.title);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== AMAP-PLAN FAIL ===' : '=== AMAP-PLAN ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
