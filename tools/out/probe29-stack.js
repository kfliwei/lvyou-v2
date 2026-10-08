/* tools/out/probe29-stack.js — TM34「Maximum call stack size exceeded」定性：
 * 把 pageerror 的完整 stack 抓下来（闸门只留 160 字符，正好把回环那几帧切掉了），
 * 同时给 clearSheetCenter / onSheetMoveEnd 记重入次数与最深栈高，看是不是
 * onSheetMoveEnd → clearSheetCenter → panBy → moveend 自激。
 * 步序照抄闸门 TM26/TM27 那一段（先把点沉到卡片下面，再开卡、关卡）。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-stack.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

const SEED = () => new Promise((res, rej) => {
  const rq = indexedDB.open('gujian-notes', 1);
  rq.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('notes')) {
      const st = db.createObjectStore('notes', { keyPath: 'id' });
      ['by_city', 'by_day', 'by_ts'].forEach(k => st.createIndex(k, k.slice(3), { unique: false }));
    }
  };
  const now = Date.now();
  const long = ('那天的风很大，木塔的影子在地上拉得很长。我在塔下站了很久，抬头数斗拱，一层一层数不清。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。').repeat(4);
  rq.onsuccess = () => {
    const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
    os.clear();
    [{ id: 'L1', title: '大同古城', siteName: '大同古城', province: '山西', city: '朔州', lat: 39.5606, lng: 114.0862, ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [], audio: '', tags: [] },
     { id: 'L2', title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', lat: 39.5806, lng: 114.1862, ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '短。', raw: '短。', photos: [], audio: '', tags: [] },
     { id: 'L3', title: '悬空寺', siteName: '悬空寺', province: '山西', city: '大同', lat: 39.6644, lng: 113.7254, ts: now - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', text: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', raw: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', photos: [], audio: '', tags: [] }].forEach(r => os.put(r));
    tx.oncomplete = () => { db.close(); res(3); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  };
  rq.onerror = () => rej(rq.error);
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e.message).split('\n').slice(0, 14).join('\n  ')));
  page.on('console', m => { if (m.text().indexOf('TRACE:') === 0) say('  页内 ' + m.text()); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(2500);

  await page.evaluate(() => {
    window.__t = { depth: 0, maxDepth: 0, calls: [], moveends: 0, panbys: [] };
    const oc = clearSheetCenter;
    clearSheetCenter = function () {
      const d = ++window.__t.depth;
      window.__t.maxDepth = Math.max(window.__t.maxDepth, d);
      const s = document.getElementById('memSheet');
      let rec = { d: d, at: window.__t.calls.length, show: s.classList.contains('show'), focus: !!sheetFocus };
      try {
        if (map && sheetFocus && s.classList.contains('show')) {
          const cr = s.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect();
          rec.band = Math.round(cr.top - mr.top);
          rec.p = map.latLngToContainerPoint(gxy(sheetFocus[0], sheetFocus[1]));
          rec.p = { x: Math.round(rec.p.x), y: Math.round(rec.p.y) };
          rec.raised = sheetRaised;
        }
        oc();
      } finally {
        window.__t.calls.push(rec);
        window.__t.depth--;
        console.log('TRACE:' + JSON.stringify(rec));
      }
    };
    const om = onSheetMoveEnd;
    onSheetMoveEnd = function () { window.__t.moveends++; return om(); };
    const op = map.panBy.bind(map);
    map.panBy = function (off, opt) { window.__t.panbys.push([Math.round(off[0] || off.x || 0), JSON.stringify(opt || null)]); return op(off, opt); };
  });

  const C = () => page.evaluate(() => +map.getCenter().lat.toFixed(6));
  say('1.0 起手 lat=' + await C());
  const pre = await C();
  await page.evaluate(() => { map.panBy([0, -240], { animate: false }); });
  await sleep(120);
  say('2.0 沉点 lat=' + await C() + '（开前 ' + pre + '）');
  await page.evaluate(() => openMemSheetById('L3'));
  await sleep(1200);
  say('3.0 开卡 lat=' + await C() + ' 卡片上沿=' + await page.evaluate(() => { const s = document.getElementById('memSheet'), m = map.getContainer().getBoundingClientRect(); return Math.round(s.getBoundingClientRect().top - m.top) + '/h' + Math.round(s.getBoundingClientRect().height); }));
  await page.evaluate(() => closeMemSheet());
  await sleep(1200);
  say('4.0 关卡 lat=' + await C() + '（开前 ' + pre + '，差 ' + Math.abs(await C() - pre).toFixed(6) + '）');
  const T = await page.evaluate(() => ({ maxDepth: window.__t.maxDepth, n: window.__t.calls.length, moveends: window.__t.moveends, panbys: window.__t.panbys, raised: typeof sheetRaised !== 'undefined' ? sheetRaised : 'gone' }));
  say('5.0 计数 ' + JSON.stringify(T));
  say('5.1 逐次 ' + JSON.stringify(await page.evaluate(() => window.__t.calls)));
  say('9 异常 ' + errs.length);
  errs.slice(0, 3).forEach((e, i) => say('  E' + i + ' ' + e));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
