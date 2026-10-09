/* 批次 30-B 现场标定四：TravelNotes.openList() 在 travel-map.html 里到底渲染成什么形状。
 * smoke-coord 的 CO01 读到 0 张卡，先分清是「面板没建起来」还是「默认视图是折叠的聚合列表」。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe45-list.js */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await b.newPage();
  page.on('pageerror', e => console.log('PAGEERROR ' + String(e.message).slice(0, 200)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('tn_onboarded', '1'));
  await page.evaluate(() => {
    const mk = o => Object.assign({ photos: [], audio: '', tags: ['古城'], weather: '晴 18℃', style: 'ink', province: '山西', city: '大同' }, o);
    const list = [
      mk({ id: 'cogA', title: '大同古城', siteName: '大同古城', lat: 39.5606, lng: 114.0862, ts: Date.now() - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: 'AAAA', raw: 'AAAA' }),
      mk({ id: 'cogB', title: '华严寺', siteName: '大同古城', lat: 39.5606, lng: 114.0862, ts: Date.now() - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: 'BBBB', raw: 'BBBB' }),
      mk({ id: 'cogC', title: '悬空寺', siteName: '悬空寺', lat: 39.6605, lng: 113.7086, ts: Date.now() - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', text: 'CCCC', raw: 'CCCC' }),
    ];
    return new Promise((res, rej) => {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('notes')) { const st = db.createObjectStore('notes', { keyPath: 'id' }); st.createIndex('by_city', 'city'); st.createIndex('by_day', 'day'); st.createIndex('by_ts', 'ts'); } };
      rq.onsuccess = () => { const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes'); os.clear(); list.forEach(r => os.put(r)); tx.oncomplete = () => { db.close(); res(1); }; tx.onerror = () => rej(tx.error); };
      rq.onerror = () => rej(rq.error);
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { polling: 150, timeout: 20000 });
  await sleep(1800);

  const dump = async label => {
    const d = await page.evaluate(() => {
      const body = document.getElementById('tnListBody');
      const list = body && body.closest('[id]');
      return {
        hasBody: !!body,
        panelId: list ? list.id : '', panelDisp: list ? getComputedStyle(list).display : '',
        items: body ? body.querySelectorAll('.tn-item').length : -1,
        trips: body ? body.querySelectorAll('.tn-trip, .tn-tl-year, .tn-cal').length : -1,
        html: body ? body.innerHTML.slice(0, 300) : '',
        tms: body ? Array.from(body.querySelectorAll('.tm')).map(e => e.textContent) : [],
      };
    });
    console.log('--- ' + label + ' ---');
    console.log(JSON.stringify(d, null, 1));
  };

  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(600);
  await dump('openList 之后（默认视图）');
  await page.evaluate(() => { const t = document.getElementById('tnViewTime'); if (t) t.click(); });
  await sleep(600);
  await dump('切到时间视图之后');
  await page.evaluate(() => { const t = document.getElementById('tnViewTrip'); if (t) t.click(); });
  await sleep(600);
  await dump('切回聚合视图之后');
  await b.close();
})().catch(e => { console.log('FATAL ' + ((e && e.stack) || e)); process.exit(1); });
