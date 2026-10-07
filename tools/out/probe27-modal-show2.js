const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const PH = 'data:image/gif;base64,R0lGODlhAQABAIAAAMhtSwAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const PH2 = 'data:image/gif;base64,R0lGODlhAQABAIAAADyMggAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const note = (d, t, ph) => ({ id: 'pm_' + t, title: t, siteName: '鹳雀楼', lat: 34.84, lng: 110.49, ts: new Date(2026, 8, d, 9, 12).getTime(), date: '2026-09-' + (d < 10 ? '0' + d : d) + ' 09:12', day: '2026-09-' + (d < 10 ? '0' + d : d), province: '山西', city: '运城', county: '永济', raw: '正文', text: '正文', style: 'plain', photos: ph, audio: '', tags: [] });
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear(); rs.forEach(r => os.put(r));
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, [note(18, '两张照片', [PH, PH2]), note(17, '一张照片', [PH])]);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { TravelNotes.openList(); document.querySelector('#tnViewTime').click(); });
  await p.evaluate(() => document.querySelector('.tn-item .pics img').click());
  console.log('viewer open, then Escape');
  await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await p.evaluate(() => document.querySelector('#tnViewCal').click());
  await p.evaluate(() => { const h = document.querySelectorAll('.tn-cal-d.has[data-day]'); h[h.length - 1].click(); });
  await p.evaluate(() => document.querySelector('#tnExpBtn').click());
  for (const t of [10, 200, 1000]) {
    await new Promise(r => setTimeout(r, t));
    console.log('t+' + t, JSON.stringify(await p.evaluate(() => {
      const ms = Array.prototype.slice.call(document.querySelectorAll('.ui-modal-mask'));
      return {
        n: ms.length,
        each: ms.map(m => {
          const mo = m.querySelector('.ui-modal'), x = m.querySelector('#tnExpX');
          const r = x ? x.getBoundingClientRect() : null;
          return {
            cls: m.className,
            tf: mo ? getComputedStyle(mo).transform : 'no-modal',
            xr: r ? Math.round(r.width) + 'x' + Math.round(r.height) : 'no-x',
            xVisible: r ? (r.width > 0 && r.height > 0) : false
          };
        })
      };
    })));
  }
  await b.close();
})();
