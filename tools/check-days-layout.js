/* 实测：多天排期结果滚动到底部最后一天 */
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
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '10天，全国经典路线，自然+人文';
    document.getElementById('genBtn').click();
  });
  await sleep(3500);
  /* 全选候选（尽量多 → 天数多） */
  const sel = await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand');
    for (let i = 0; i < Math.min(25, cs.length); i++) cs[i].click();
    return cs.length;
  });
  console.log('候选:', sel);
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(3000);
  const r = await p.evaluate(() => {
    const days = document.querySelectorAll('.day-card').length;
    const last = document.querySelector('.day-card:last-of-type');
    const first = document.querySelector('.day-card');
    const rects = [];
    document.querySelectorAll('.day-card').forEach((d, i) => { const rc = d.getBoundingClientRect(); rects.push({ i: i + 1, h: Math.round(rc.height), top: Math.round(rc.top), bottom: Math.round(rc.bottom) }); });
    /* 滚动到底 */
    window.scrollTo(0, document.body.scrollHeight);
    return new Promise(function (resolve) {
      setTimeout(function () {
        const lastR = last ? last.getBoundingClientRect() : null;
        const firstR = first ? first.getBoundingClientRect() : null;
        resolve({
          days, rects: rects.slice(0, 6),
          lastH: lastR ? Math.round(lastR.height) : 0,
          lastBottom: lastR ? Math.round(lastR.bottom) : 0,
          vh: window.innerHeight,
          lastVisible: lastR ? lastR.top < window.innerHeight : false,
          scrollY: window.scrollY,
          bodyScroll: document.body.scrollHeight
        });
      }, 400);
    });
  });
  console.log(JSON.stringify(r).slice(0, 500));
  ok('多天渲染（≥3 天）', r.days >= 3, 'days=' + r.days);
  /* 最后一天不是细线（高 > 40px） */
  const lastH = r.rects.length ? r.rects[r.rects.length - 1].h : r.lastH;
  ok('最后一天卡片高度正常（非细线）', lastH > 40, 'lastH=' + lastH + ' rects=' + JSON.stringify(r.rects.slice(-2)));
  ok('滚动到底最后一天可见', r.lastVisible || r.days <= 2, 'lastBottom=' + r.lastBottom + ' vh=' + r.vh);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== DAYS-LAYOUT FAIL ===' : '=== DAYS-LAYOUT ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
