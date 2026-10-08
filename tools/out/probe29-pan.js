/* tools/out/probe29-pan.js — TM25 定性：openMemSheet 的「地图让位」到底有没有发生
 * 三段取样：开卡前 / 开卡时 / 关卡后；并手工调 map.panBy 看它是不是被吞掉（_loaded / 动画被 stop）。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-pan.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

const SEED = () => new Promise((res, rej) => {
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
  const mk = (t, off) => ({ id: 'pn' + off, title: t, siteName: t, province: '山西', city: '朔州', lat: 39.5606 + off * 0.02, lng: 114.0862, ts: now - off * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: '正文', raw: '正文', photos: [], audio: '', tags: [] });
  rq.onsuccess = () => {
    const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
    os.clear(); [mk('大同古城', 0), mk('应县木塔', 1)].forEach(r => os.put(r));
    tx.oncomplete = () => { db.close(); res(2); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  };
  rq.onerror = () => rej(rq.error);
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });
  await sleep(2500);

  const C = () => page.evaluate(() => ({ lat: +map.getCenter().lat.toFixed(5), lng: +map.getCenter().lng.toFixed(5), zoom: map.getZoom(), loaded: map._loaded, anim: !!map._panAnim && map._panAnim._active }));
  const P = () => page.evaluate(() => { const b = document.getElementById('memSheet').getBoundingClientRect(); return { h: Math.round(b.height), d: Math.round(b.height / 2) + 10 }; });

  say('0.0 起手 ' + JSON.stringify(await C()));
  /* ① 手工 panBy：证明这条 API 在这张图上是走得通的（对照组） */
  await page.evaluate(() => map.panBy([0, -306], { duration: 0.42 }));
  await sleep(900);
  say('1.1 手工 map.panBy([0,-306],{duration:0.42}) 之后 ' + JSON.stringify(await C()));
  await page.evaluate(() => map.panBy([0, 306], { duration: 0.42 }));
  await sleep(900);
  say('1.2 手工再 pan 回来 ' + JSON.stringify(await C()));

  /* ② 走产品那条腿：openMemSheet → panSheetBy */
  const before = await C();
  await page.evaluate(() => openMemSheetById(TravelNotes.list()[0].id));
  await sleep(200);
  say('2.1 开卡 200ms（动画中途）' + JSON.stringify(await C()) + ' 卡片 ' + JSON.stringify(await P()));
  await sleep(900);
  const onOpen = await C();
  say('2.2 开卡动画收尾 ' + JSON.stringify(onOpen));
  await page.evaluate(() => closeMemSheet());
  await sleep(1200);
  const afterClose = await C();
  say('2.3 关卡之后 ' + JSON.stringify(afterClose) + '（要和 0.0/2.1 之前的 ' + JSON.stringify(before) + ' 对上）');
  say('2.4 净位移：开卡动了 ' + (Math.abs(onOpen.lat - before.lat) * 111).toFixed(1) + ' km·deg 折算，关后回到 ' + (Math.abs(afterClose.lat - before.lat) * 111).toFixed(1));

  /* ③ panSheetBy 自己的读数：把参数摊开 */
  say('3.1 panSheetBy 现场 ' + JSON.stringify(await page.evaluate(() => {
    const h = sheetHeight();
    return { sheetHeightNow: h, fn: String(panSheetBy).replace(/\s+/g, ' ').slice(0, 160) };
  })));
  say('9 页面异常 ' + errs.length + ' 条 ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
