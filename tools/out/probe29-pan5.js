/* tools/out/probe29-pan5.js — TM25 定性第四步：把产品摘掉，直接问 Leaflet
 * 现象：smoke/probe3 里 panBy([0,-307],{duration:.52}) 确实被调用了，但中心只挪了 ~2px 就回来；
 *       probe2（两条笔记纬度不同 → fitBounds 到 zoom 11）里同一句挪了 0.16°。
 * 唯一变量就是缩放档：两条笔记同点 → latLngBounds 退化 → fitBounds 给 maxZoom(18)。
 * 这里不开卡、不点胶囊，纯手工在 zoom 18 与 zoom 14 各跑一次 panBy，逐步采样。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-pan5.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [], say = s => { log.push(s); console.log(s); };

const SEED = () => new Promise((res, rej) => {
  const now = Date.now();
  const mk = (id, lat, lng, title) => ({ id, title, siteName: title, province: '山西', city: '朔州', lat, lng, ts: now - 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: '短。', raw: '短。', photos: [], audio: '', tags: [] });
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
    os.clear();
    /* 同点两条＝闸门现在播的种（大同/应县都落回默认经纬度） */
    os.put(mk('S1', 39.5606, 114.0862, '大同古城'));
    os.put(mk('S2', 39.5606, 114.0862, '应县木塔'));
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
  await sleep(2200);

  const C = () => page.evaluate(() => ({ lat: +map.getCenter().lat.toFixed(6), zoom: map.getZoom(), maxZoom: map.getMaxZoom(), pane: map._mapPane.style.transform }));
  const sweep = async (label, z) => {
    await page.evaluate(z => { map.setView(map.getCenter(), z, { animate: false }); }, z);
    await sleep(300);
    const a = await C();
    await page.evaluate(() => { map.panBy([0, -307], { duration: .52 }); });
    const t = [];
    for (let i = 0; i < 8; i++) { await sleep(150); t.push((await page.evaluate(() => +map.getCenter().lat.toFixed(6))) - a.lat); }
    say(label + ' 起手 ' + JSON.stringify(a) + ' 相对位移序列(°) ' + t.map(x => x.toFixed(6)).join(' '));
  };
  await sweep('1. 退化种子·当前档', await page.evaluate(() => map.getZoom()));
  await sweep('2. 退化种子·强设 zoom14', 14);
  say('3. 手工 setView 后 maxBounds=' + JSON.stringify(await page.evaluate(() => ({ mb: map.options.maxBounds ? map.options.maxBounds.toString() : null, visc: map.options.maxBoundsViscosity, world: map.options.worldCopyNav, minZ: map.getMinZoom() }))));
  say('9 异常 ' + errs.length + ' ' + errs.slice(0, 2).join('|'));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
