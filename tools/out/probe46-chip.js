/* 批次 31-D 探针：D07 时间线胶囊那条读空，先坐准「这一排到底渲染没渲染」。
   只读 DOM，不改任何文件。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
  const say = s => { out.push(s); };
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => say('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') say('console.error: ' + String(m.text()).slice(0, 160)); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 5, { timeout: 20000, polling: 150 });
  await sleep(2200);
  say('=== 起手（没开列表面板）===');
  say(JSON.stringify(await page.evaluate(() => ({
    statMain: (document.getElementById('statMain') || {}).textContent,
    tlExists: !!document.getElementById('mmTimeline'),
    tlDisplay: document.getElementById('mmTimeline') ? getComputedStyle(document.getElementById('mmTimeline')).display : 'NA',
    tlHtml: (document.getElementById('mmTimeline') || {}).innerHTML ? document.getElementById('mmTimeline').innerHTML.length : 0,
    chips: document.querySelectorAll('.tl-chip').length,
    trips: document.querySelectorAll('.tl-trip').length,
    firstChipText: (document.querySelector('.tl-chip') || {}).textContent,
    firstSpan: (document.querySelector('.tl-chip span') || {}).textContent,
  }))));
  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(700);
  say('=== 开列表面板后 ===');
  say(JSON.stringify(await page.evaluate(() => ({
    chips: document.querySelectorAll('.tl-chip').length,
    firstSpan: (document.querySelector('.tl-chip span') || {}).textContent,
    allSpans: Array.from(document.querySelectorAll('.tl-chip span:not(.tl-name)')).map(x => x.textContent),
    tlHtml: ((document.getElementById('mmTimeline') || {}).innerHTML || '').slice(0, 300),
  }))));
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'b31-chip-probe.txt'), out.join('\n') + '\n');
  console.log('done');
})().catch(e => { console.log('FATAL ' + ((e && e.stack) || e)); try { fs.writeFileSync(path.join(__dirname, 'b31-chip-probe.txt'), 'FATAL ' + ((e && e.stack) || e)); } catch (x) {} process.exit(1); });
