/* tools/out/probe29-pan3.js — TM25 定性第三步：照 smoke-travelmap 的步序走一遍，全程记账
 * probe2 单独开卡是能动的（39.57209 → 39.73439），闸门里却三个读数全等，
 * 差别只可能在前面那几步：点胶囊（会 flyTo 到 zoom13）、关卡、统计条收/展。
 * 这里把 panSheetBy / map.panBy / map.flyTo 全包起来记时间线，逐步看中心。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-pan3.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

const SEED = () => {
  function pic(seed) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]; g.fillRect(0, 0, 900, 600);
    g.fillStyle = '#FAF8F3'; g.font = '90px sans-serif'; g.fillText('P' + seed, 40, 140);
    return c.toDataURL('image/jpeg', 0.82);
  }
  const long = ('那天的风很大，木塔的影子在地上拉得很长。' +
    '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。' +
    '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    id: 'tmg' + Math.random().toString(36).slice(2, 8),
    title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', county: '应县',
    lat: 39.5606, lng: 114.0862, photos: [], audio: '', tags: ['古建'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [pic(1), pic(2)], title: '大同古城' }),
    mk({ ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '第二次上木塔，云层很低。', raw: '第二次上木塔，云层很低。' }),
  ];
  return new Promise((res, rej) => {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        const st = db.createObjectStore('notes', { keyPath: 'id' });
        ['by_city', 'by_day', 'by_ts'].forEach(k => st.createIndex(k, k === 'by_city' ? 'city' : (k === 'by_day' ? 'day' : 'ts'), { unique: false }));
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

const GEOM = () => {
  const tl = document.getElementById('mmTimeline');
  return Array.from(tl.querySelectorAll('.tl-chip')).map(c => {
    const b = c.getBoundingClientRect();
    return { name: (c.querySelector('.tl-name') || {}).textContent || '', x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), onScreen: Math.round(b.left + b.width / 2) <= window.innerWidth };
  });
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { const t = m.text(); if (t.indexOf('PAN3:') === 0) say('    ' + t.slice(5)); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });
  await sleep(2200);

  await page.evaluate(() => {
    window.__pan = [];
    const t0 = Date.now();
    const at = () => Date.now() - t0;
    const orig = panSheetBy;
    panSheetBy = function (h, up) { console.log('PAN3:panSheetBy h=' + h + ' up=' + up + ' @' + at()); orig(h, up); };
    const op = map.panBy.bind(map);
    map.panBy = function (off, opt) { console.log('PAN3:map.panBy ' + JSON.stringify(off) + ' ' + JSON.stringify(opt) + ' @' + at() + ' zoom=' + map.getZoom()); return op(off, opt); };
    const of_ = map.flyTo.bind(map);
    map.flyTo = function (c, z, o) {
      const lat = (c && c.lat != null) ? c.lat : (Array.isArray(c) ? c[0] : NaN);
      const lng = (c && c.lng != null) ? c.lng : (Array.isArray(c) ? c[1] : NaN);
      console.log('PAN3:map.flyTo ' + JSON.stringify([+lat.toFixed(4), +lng.toFixed(4), z]) + ' @' + at() + ' 起手中心=' + map.getCenter().lat.toFixed(5));
      return of_(c, z, o);
    };
    const osv = map.setView.bind(map);
    const latOf = c => (c && c.lat != null) ? +c.lat : (Array.isArray(c) ? +c[0] : NaN);
    const lngOf = c => (c && c.lng != null) ? +c.lng : (Array.isArray(c) ? +c[1] : NaN);
    map.setView = function (c, z, o) { console.log('PAN3:map.setView ' + JSON.stringify([+latOf(c).toFixed(4), +lngOf(c).toFixed(4), z, !!(o && o.animate)]) + ' @' + at() + ' 起手中心=' + map.getCenter().lat.toFixed(5)); return osv(c, z, o); };
    window.__center = () => ({ lat: +map.getCenter().lat.toFixed(6), lng: +map.getCenter().lng.toFixed(6), zoom: map.getZoom() });
  });
  const C = () => page.evaluate(() => window.__center());
  const trace = () => page.evaluate(() => ({ panRun: !!(map._panAnim && map._panAnim._inProgress), flyFrame: !!map._flyEndFrame, zoomAnim: !!(map._zoomAnimated && map._zoomAnim) }));

  say('0.1 起手 ' + JSON.stringify(await C()));

  /* 一 点胶囊（真点，会 flyTo） */
  const chips = await page.evaluate(GEOM);
  const tap = chips.filter(c => c.onScreen)[0];
  say('1.1 点 ' + tap.name + ' @(' + tap.x + ',' + tap.y + ')');
  await page.touchscreen.tap(tap.x, tap.y);
  await sleep(1600);
  say('1.2 开后 ' + JSON.stringify(await C()) + ' ' + JSON.stringify(await trace()) + ' cls=' + JSON.stringify(await page.evaluate(() => ({ c: document.getElementById('memSheet').className, h: Math.round(document.getElementById('memSheet').getBoundingClientRect().height) }))) + ' 笔记点位=' + JSON.stringify(await page.evaluate(() => TravelNotes.list().map(n => [n.title, +n.lat.toFixed(6)]))));
  await page.evaluate(() => closeMemSheet());
  await sleep(900);
  say('1.3 关后 ' + JSON.stringify(await C()) + ' ' + JSON.stringify(await trace()));

  /* 二 统计条收/展 */
  await page.evaluate(() => document.getElementById('statClose').click());
  await sleep(500);
  await page.evaluate(() => document.getElementById('statOpen').click());
  await sleep(500);

  /* 三 按 id 开长文卡（闸门 TM25 那一步） */
  const pre = await C();
  say('3.1 centerPre ' + JSON.stringify(pre) + ' ' + JSON.stringify(await trace()));
  await page.evaluate(() => openMemSheetById(TravelNotes.list().filter(n => n.title === '大同古城')[0].id));
  await sleep(1100);
  say('3.2 开卡 1.1s ' + JSON.stringify(await C()) + ' ' + JSON.stringify(await trace()));
  await sleep(700);
  say('3.3 开卡 1.8s ' + JSON.stringify(await C()) + ' ' + JSON.stringify(await trace()));
  await page.evaluate(() => closeMemSheet());
  await sleep(1200);
  say('3.4 关卡 ' + JSON.stringify(await C()) + ' ' + JSON.stringify(await trace()));

  say('4.1 全程 ' + JSON.stringify(await page.evaluate(() => window.__pan)));
  say('9 异常 ' + errs.length + ' ' + errs.slice(0, 3).join('|'));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
