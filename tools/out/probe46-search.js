/* 探针：search.html?q=测试点 到底渲染出没渲染游记结果（census 读到 0 命中，要么是没渲出结果，要么是日期那格空） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEED = () => {
  const DAY_TS = new Date(2026, 9, 8, 14, 23).getTime();
  const mk = o => Object.assign({ province: '山西', city: '大同', photos: [], audio: '', tags: ['古城'], weather: '晴 18℃' }, o);
  const list = [
    mk({ id: 'dA', title: '形状A点号缺', siteName: '测试点A', lat: 39.5606, lng: 114.0862, ts: DAY_TS, date: '2026-10-8', text: 'A 的正文', raw: 'A 的正文' }),
    mk({ id: 'dB', title: '形状B点号齐', siteName: '测试点B', lat: 39.5606, lng: 114.0862, ts: DAY_TS + 3600e3, date: '2026.10.08', text: 'B 的正文', raw: 'B 的正文' }),
    mk({ id: 'dC', title: '形状C中文', siteName: '测试点C', lat: 39.6605, lng: 113.7086, ts: DAY_TS + 7200e3, date: '2026年10月8日', text: 'C 的正文', raw: 'C 的正文' }),
    mk({ id: 'dD', title: '形状D只有ts', siteName: '测试点D', lat: 39.6605, lng: 113.7086, ts: DAY_TS + 10800e3, date: '十月八号', text: 'D 的正文', raw: 'D 的正文' }),
    mk({ id: 'dE', title: '形状E日期全坏', siteName: '测试点E', lat: 40.0, lng: 113.0, date: '十月八号', text: 'E 的正文', raw: 'E 的正文' }),
  ];
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
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear(); list.forEach(r => os.put(r));
      tx.oncomplete = () => { db.close(); res(list.length); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    rq.onerror = () => rej(rq.error);
  });
};
(async () => {
  const out = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => out.push('pageerror: ' + String(e.message).slice(0, 200)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(SEED);
  await page.goto(P('search.html') + '?q=' + encodeURIComponent('测试点'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (const ms of [1500, 3000, 6000]) {
    await sleep(ms);
    out.push('--- 累计等 ' + ms + 'ms ---');
    out.push(JSON.stringify(await page.evaluate(() => ({
      q: (document.getElementById('q') || {}).value,
      listLen: window.TravelNotes ? TravelNotes.list().length : 'no lib',
      secs: Array.from(document.querySelectorAll('#result .sec-t')).map(x => x.textContent.trim()),
      items: document.querySelectorAll('#result .item').length,
      subs: Array.from(document.querySelectorAll('#result .sub')).slice(0, 6).map(x => x.textContent.trim()),
      empty: Array.from(document.querySelectorAll('#result .empty')).map(x => x.textContent.trim().slice(0, 30)),
    }))));
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'b31-search-probe.txt'), out.join('\n') + '\n');
  console.log('done');
})().catch(e => { console.log('FATAL ' + ((e && e.stack) || e)); process.exit(1); });
