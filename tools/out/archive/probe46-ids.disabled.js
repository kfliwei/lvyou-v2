/* tools/out/probe46-ids.js — 定性 smoke-date 那一支「读数里混进 2024-11-05 的真实记录」
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe46-ids.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await b.newPage();
  page.on('pageerror', e => console.log('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto('file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  const dump0 = await page.evaluate(() => ({
    count: window.TravelNotes ? TravelNotes.count() : -1,
    ids: TravelNotes.list().map(n => n.id + '@' + n.ts).slice(0, 12),
    keys: Object.keys(localStorage).filter(k => /note|tn_|gujian|backup|sync/i.test(k)),
  }));
  console.log('载入后(未播种) ' + JSON.stringify(dump0));
  await page.evaluate(() => new Promise((res, rej) => {
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
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.getAll().onsuccess = e => console.log('store 里原有 ' + e.target.result.length + ' 条：' + e.target.result.map(x => x.id).join(','));
      os.clear();
      os.put({ id: 'dA', title: '形状A', siteName: '测试点A', lat: 39.5, lng: 114.0, ts: new Date(2026, 9, 8, 14, 23).getTime(), date: '2026-10-8', text: 'A', raw: 'A', city: '大同', province: '山西', photos: [], audio: '', tags: [], weather: '晴 18℃' });
      tx.oncomplete = () => { db.close(); res(1); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    rq.onerror = () => rej(rq.error);
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const snaps = [];
  for (const t of [800, 2000, 2200, 4000]) {
    await sleep(t === 800 ? 800 : 0);
    if (t === 2000) await sleep(1200);
    if (t === 2200) await sleep(200);
    if (t === 4000) await sleep(1800);
    snaps.push(await page.evaluate(() => ({
      count: TravelNotes.count(),
      ids: TravelNotes.list().map(n => n.id + '@' + (n.date || '') + '@' + TravelNotes.dayText(n)).slice(0, 12),
    })));
  }
  snaps.forEach((s, i) => console.log('t' + i + ' ' + JSON.stringify(s)));
  const store = await page.evaluate(() => new Promise(res => {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readonly');
      tx.objectStore('notes').getAll().onsuccess = e => { res(e.target.result.map(x => x.id + '@' + x.date)); db.close(); };
      tx.onerror = () => res('(tx error)');
    };
    rq.onerror = () => res('(open error)');
  }));
  console.log('store 终态 ' + JSON.stringify(store));
  console.log('localStorage 键 ' + JSON.stringify(Object.keys(await page.evaluate(() => Object.assign({}, localStorage)))));
  await b.close();
})();
