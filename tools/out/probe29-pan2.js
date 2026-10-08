/* tools/out/probe29-pan2.js — TM25 定性第二步：长正文那条开卡时 panSheetBy 到底收到了什么参数
 * 做法：把全局 panSheetBy 包一层，把 (h, up, map 在场?) 记进 window.__pan，再对照地图中心。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-pan2.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

const SEED = () => {
  const long = ('那天的风很大，木塔的影子在地上拉得很长。我在塔下站了很久，抬头数斗拱，一层一层数不清。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。').repeat(4);
  return new Promise((res, rej) => {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        const st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    const now = Date.now();
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear();
      [{ id: 'L1', title: '大同古城', siteName: '大同古城', province: '山西', city: '朔州', lat: 39.5606, lng: 114.0862, ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [], audio: '', tags: [] },
       { id: 'L2', title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', lat: 39.5806, lng: 114.1862, ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '短。', raw: '短。', photos: [], audio: '', tags: [] }].forEach(r => os.put(r));
      tx.oncomplete = () => { db.close(); res(2); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    rq.onerror = () => rej(rq.error);
  });
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.text().indexOf('PAN:') === 0) say('  页内 ' + m.text()); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });
  await sleep(2500);
  await page.evaluate(() => {
    window.__pan = [];
    const orig = panSheetBy;
    panSheetBy = function (h, up) { window.__pan.push({ h: h, up: up, hasMap: !!map, at: Date.now() }); console.log('PAN:' + h + ',' + up); orig(h, up); };
    window.__origPanBy = map.panBy.bind(map);
    map.panBy = function (off, opt) { window.__pan.push({ off: JSON.stringify(off), opt: JSON.stringify(opt) }); return window.__origPanBy(off, opt); };
  });
  const C = () => page.evaluate(() => ({ lat: +map.getCenter().lat.toFixed(5), lng: +map.getCenter().lng.toFixed(5), zoom: map.getZoom() }));
  say('0.0 起手 ' + JSON.stringify(await C()));
  const before = await C();
  await page.evaluate(() => openMemSheetById('L1'));
  await sleep(1600);
  say('1.1 开长文卡 1.6s 后 ' + JSON.stringify(await C()) + '（开前 ' + JSON.stringify(before) + '）');
  say('1.2 卡片矩形 ' + JSON.stringify(await page.evaluate(() => { const s = document.getElementById('memSheet'); const b = s.getBoundingClientRect(); return { h: Math.round(b.height), top: Math.round(b.top), disp: getComputedStyle(s).display, cls: s.className }; })));
  await page.evaluate(() => closeMemSheet());
  await sleep(1600);
  say('2.1 关卡 1.6s 后 ' + JSON.stringify(await C()));
  say('3.1 记账 ' + JSON.stringify(await page.evaluate(() => window.__pan)));
  say('9 异常 ' + errs.length + ' ' + errs.slice(0, 2).join('|'));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
