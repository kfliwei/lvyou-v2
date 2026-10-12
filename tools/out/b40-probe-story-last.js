/* tools/out/b40-probe-story-last.js — 逐次翻页读到落定，判 S13 那条红是「腿太松」还是「末站被 scroll-spy 抢回去」
 * 用法: NODE_PATH=tools/node_modules node tools/out/b40-probe-story-last.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T09:00:00+08:00').getTime();
function dd(i, site, lat, lng, city) {
  const ts = T0 + i * D;
  return { id: 'p40_' + site, title: site + '·记', siteName: site, siteIndex: -1,
    lat, lng, ts, date: new Date(ts).toISOString().slice(0, 10), day: '',
    province: '山西', city, county: '', raw: '正文·' + site, text: '正文·' + site,
    style: 'plain', photos: [], audio: '', tags: [] };
}
const DAT = [dd(0,'云冈石窟',40.032,113.135,'大同'),dd(1,'华严寺',40.091,113.259,'大同'),
  dd(2,'大同博物馆',40.083,113.310,'大同'),dd(3,'晋祠',37.712,112.455,'太原'),
  dd(4,'山西博物院',37.869,112.449,'太原')];

async function seed(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR: ' + e.message.slice(0, 140)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) { const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) { const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false }); st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false }); } };
      rq.onsuccess = function () { const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear(); rs.forEach(function (r) { os.put(r); });
        tx.oncomplete = function () { db.close(); res(rs.length); }; tx.onerror = function () { db.close(); rej(tx.error); }; };
      rq.onerror = function () { rej(rq.error); };
    });
  }, DAT);
  await page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.story-card').length === 5, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);
  return { ctx, page };
}

const READ = function () {
  const cards = [].slice.call(document.querySelectorAll('.story-card'));
  const lines = [].slice.call(document.querySelectorAll('#storyMap path.leaflet-interactive'));
  const mp = document.getElementById('storyMap').offsetHeight;
  const barH = document.querySelector('.story-bar').offsetHeight;
  const navTop = document.getElementById('storyNav').getBoundingClientRect().top;
  const y = window.scrollY;
  const band = { top: Math.max(mp - y, 0) + barH, bottom: navTop };
  const mid = (band.top + band.bottom) / 2;
  const cs = cards.map(function (e, i) {
    const r = e.getBoundingClientRect();
    return { i: i, center: Math.round(r.top + r.height / 2), h: Math.round(r.height), d: Math.round(Math.abs(r.top + r.height / 2 - mid)) };
  });
  let best = -1, bd = 1e9;
  cs.forEach(function (c) { if (c.d < bd) { bd = c.d; best = c.i; } });
  return {
    segs: lines.map(function (e) { return (e.getAttribute('stroke') || '').toLowerCase() + '/' + (e.getAttribute('stroke-dasharray') || 'solid'); }),
    solid: lines.filter(function (e) { return (e.getAttribute('stroke-dasharray') || 'solid') === 'solid'; }).length,
    active: cards.findIndex(function (e) { return e.classList.contains('active'); }),
    navSub: ((document.getElementById('snSub') || {}).textContent || '').trim(),
    nextDisabled: !!(document.getElementById('snNext') || {}).disabled,
    scrollY: Math.round(y), maxScroll: Math.round(document.documentElement.scrollHeight - window.innerHeight),
    bandTop: Math.round(band.top), bandBottom: Math.round(band.bottom), mid: Math.round(mid),
    spyWouldPick: best, dist: bd, centers: cs.map(function (c) { return c.i + ':' + c.center + '(d' + c.d + ')'; }).join(' '),
    lastCardBottom: Math.round(cards[cards.length - 1].getBoundingClientRect().bottom)
  };
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  const { ctx, page } = await seed(b);
  const show = (tag, r) => console.log(tag + ' | ' + r.navSub + ' active=' + r.active + ' solid=' + r.solid +
    ' nextDisabled=' + r.nextDisabled + ' scrollY=' + r.scrollY + '/' + r.maxScroll +
    ' 带=' + r.bandTop + '-' + r.bandBottom + ' 中点=' + r.mid + ' spy会选=' + r.spyWouldPick + '(d' + r.dist + ')' +
    ' 末卡底=' + r.lastCardBottom + ' | ' + JSON.stringify(r.segs));

  show('进屏     ', await page.evaluate(READ));
  for (let k = 1; k <= 4; k++) {
    await page.evaluate(() => { const btn = document.getElementById('snNext'); if (btn && !btn.disabled) btn.click(); });
    await sleep(500); show('第' + k + '次点 500ms', await page.evaluate(READ));
    await sleep(700); show('第' + k + '次落定', await page.evaluate(READ));
    await sleep(1500); show('第' + k + '次+1.5s', await page.evaluate(READ));
  }

  /* 腿原来的点法：同步连点 + 1200ms 就读 */
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await sleep(1500);
  await page.evaluate(() => { document.querySelectorAll('.story-card').forEach(function (e) { e.classList.remove('active'); }); });
  await page.evaluate(function () { window.__a = -1; });
  /* 重跑：把状态回正（重新选一次行程即可） */
  await page.evaluate(() => { const s = document.getElementById('tripSel'); s.value = 'all'; s.onchange(); });
  await sleep(1500);
  show('回正后   ', await page.evaluate(READ));
  await page.evaluate(function () {
    const btn = document.getElementById('snNext');
    for (let i = 0; i < 10 && btn && !btn.disabled; i++) btn.click();
  });
  await sleep(1200); show('连点后1.2s', await page.evaluate(READ));
  await sleep(2000); show('连点后3.2s', await page.evaluate(READ));
  await ctx.close();
  await b.close();
})().catch(e => { console.log('探针异常: ' + e.message); process.exit(1); });
