/* tools/out/probe30-tripopen.js — 定性 smoke-coord CO01 的随机红（一次读数 旅程卡=1 卡片=0，重跑就绿）
 * 三种可能：① 一进来就是展开态，那一点把它折回去；② 点击落在还没渲染完的 DOM 上；③ 展开是异步的、500ms 不够读。
 * 播种直接从 tools/smoke-coord.js 里抠 SEED（抄一份就会和真腿播种漂移）。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe30-tripopen.js */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const src = fs.readFileSync(path.join(ROOT, 'tools', 'smoke-coord.js'), 'utf8');
const s0 = src.indexOf('const SEED = ');
const s1 = src.indexOf('\n};', s0) + 3;
if (s0 < 0 || s1 <= s0) { console.log('抠不到 SEED，别猜'); process.exit(2); }
const SEED_DECL = src.slice(s0, s1);

const SNAP = () => {
  const c = document.querySelector('#tnListBody .tn-trip');
  const body = c ? c.querySelector('.tn-trip-body') : null;
  const lb = document.getElementById('tnListBody');
  return {
    trips: document.querySelectorAll('#tnListBody .tn-trip').length,
    heads: document.querySelectorAll('#tnListBody .tn-trip-head').length,
    cls: c ? c.className : '(无旅程卡)',
    items: document.querySelectorAll('#tnListBody .tn-item').length,
    bodyDisp: body ? getComputedStyle(body).display : '(无 body)',
    listDisplay: lb ? getComputedStyle(lb).display : '(没有 #tnListBody)',
  };
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], defaultViewport: { width: 328, height: 723 } });
  const page = await b.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate('(function(){' + SEED_DECL + ' return SEED(); })()');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(2200);
  const click = () => page.evaluate(() => { const h = document.querySelector('#tnListBody .tn-trip-head'); if (h) h.click(); return !!h; });
  for (let run = 1; run <= 3; run++) {
    console.log('r' + run + ' S0 reload 后            ' + JSON.stringify(await page.evaluate(SNAP)));
    await page.evaluate(() => { window.TravelNotes.openList(); });
    await sleep(500);
    console.log('r' + run + ' S1 openList+500        ' + JSON.stringify(await page.evaluate(SNAP)));
    const got = await click();
    await sleep(200);
    console.log('r' + run + ' S2 点一次+200  钮在场=' + got + ' ' + JSON.stringify(await page.evaluate(SNAP)));
    await sleep(400);
    console.log('r' + run + ' S3 点一次+600          ' + JSON.stringify(await page.evaluate(SNAP)));
    await click();
    await sleep(600);
    console.log('r' + run + ' S4 再点一次+600        ' + JSON.stringify(await page.evaluate(SNAP)));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
    await sleep(1500);
  }
  console.log('页内报错: ' + (errs.length ? errs.join(' | ') : '无'));
  await b.close();
})();
