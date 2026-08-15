/* 验证：多图查看器 + 日历视图 + 地图位置记忆 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ① 行程计划复制（wishlist：copyPlan 存在 + __planDays） */
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs1 = [];
  p1.on('pageerror', e => errs1.push(e.message.slice(0, 100)));
  await p1.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2000);
  const w = await p1.evaluate(() => {
    window.__planDays = [[{ label: '故宫' }, { label: '长城' }], [{ label: '颐和园' }]];
    let copied = '';
    const orig = window.UI.toast;
    try { window.copyPlan(); } catch (e) { return { err: e.message }; }
    return { hasCopyPlan: typeof window.copyPlan === 'function', hasCopyWish: typeof window.copyWishlist === 'function' };
  });
  ok('①④ 复制函数存在', w.hasCopyPlan && w.hasCopyWish, JSON.stringify(w));
  ok('④ 复制清单按钮', await p1.evaluate(() => [...document.querySelectorAll('.wl-btn')].some(b => b.textContent.includes('复制清单'))));
  const real1 = errs1.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('wishlist 无脚本错误', real1.length === 0, real1.join('|').slice(0, 60));
  await p1.close();

  /* ② 搜索历史 + 最近浏览（search 页空输入展示） */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message.slice(0, 100)));
  await p2.goto('file:///' + path.join(ROOT, 'search.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(3000);
  await p2.evaluate(() => {
    localStorage.setItem('tn_search_hist', JSON.stringify(['拉萨', '故宫']));
    localStorage.setItem('tn_recent', JSON.stringify([{ n: '云冈石窟', k: 'sx', ts: Date.now() }]));
  });
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const hist = await p2.evaluate(() => ({
    hist: document.querySelectorAll('.chip[data-h]').length,
    recent: document.querySelectorAll('.item[data-rk]').length,
    recentName: (document.querySelector('.item[data-rk] .nm') || {}).textContent || ''
  }));
  ok('② 搜索历史展示', hist.hist === 2, 'hist=' + hist.hist);
  ok('② 最近浏览展示', hist.recent === 1 && hist.recentName === '云冈石窟', JSON.stringify(hist));
  const real2 = errs2.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('search 无脚本错误', real2.length === 0, real2.join('|').slice(0, 60));
  await p2.close();

  /* ⑤⑥ 日历视图 + 多图查看器（travel-notes 列表） */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs3 = [];
  p3.on('pageerror', e => errs3.push(e.message.slice(0, 100)));
  await p3.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  await p3.evaluate(() => new Promise(function (resolve) {
    var req = indexedDB.open('gujian-notes', 1);
    req.onsuccess = function () {
      var db = req.result;
      var tx = db.transaction('notes', 'readwrite');
      var st = tx.objectStore('notes');
      st.clear();
      var base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      st.put({ id: 'c1', title: '石窟之行', siteName: '云冈石窟', lat: 40.1, lng: 113.1, ts: 1, date: '2026-08-01', text: '好震撼', photos: [base64, base64], raw: '' });
      st.put({ id: 'c2', title: '长城', siteName: '八达岭', lat: 40.3, lng: 116.0, ts: 2, date: '2026-08-05', text: '人很多', raw: '' });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    };
  }));
  await p3.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await p3.evaluate(() => { if (window.TravelNotes) TravelNotes.openList(); });
  await sleep(1000);
  await p3.evaluate(() => { const b = document.getElementById('tnViewCal'); if (b) b.click(); });
  await sleep(800);
  const cal = await p3.evaluate(() => ({
    hasCalTab: !!document.getElementById('tnViewCal'),
    grid: document.querySelectorAll('.tn-cal-d').length,
    hasDays: document.querySelectorAll('.tn-cal-d.has').length
  }));
  ok('⑥ 日历 tab + 网格', cal.hasCalTab && cal.grid > 20, 'grid=' + cal.grid);
  ok('⑥ 有游记日期高亮', cal.hasDays >= 2, 'has=' + cal.hasDays);
  /* 点击有游记的日期 */
  await p3.evaluate(() => { const d = document.querySelector('.tn-cal-d.has'); if (d) d.click(); });
  await sleep(600);
  const dayList = await p3.evaluate(() => (document.querySelector('.tn-cal-day') || {}).textContent || '');
  ok('⑥ 点击日期显示当天游记', dayList.includes('篇') || dayList.includes('石窟') || dayList.includes('长城'), dayList.slice(0, 40));
  /* 多图查看器 */
  await p3.evaluate(() => { window.TravelNotes.zoomPhotoIdx('c1', 0); });
  await sleep(600);
  const viewer = await p3.evaluate(() => ({
    open: !!document.querySelector('.tn-viewer'),
    counter: (document.querySelector('.tn-viewer-i') || {}).textContent || '',
    nav: document.querySelectorAll('.tn-viewer-nav').length
  }));
  ok('⑤ 多图查看器打开', viewer.open && viewer.counter === '1 / 2' && viewer.nav === 2, JSON.stringify(viewer));
  await p3.evaluate(() => { const r = document.querySelector('.tn-viewer-nav.r'); if (r) r.click(); });
  await sleep(400);
  const next = await p3.evaluate(() => (document.querySelector('.tn-viewer-i') || {}).textContent || '');
  ok('⑤ 查看器翻页', next === '2 / 2', next);
  const real3 = errs3.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('travel-notes 无脚本错误', real3.length === 0, real3.join('|').slice(0, 60));
  await p3.close();

  await browser.close();
  console.log(fails ? '=== SIX-FEATURES FAIL ===' : '=== SIX-FEATURES ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
