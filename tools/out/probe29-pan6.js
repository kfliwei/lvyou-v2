/* tools/out/probe29-pan6.js — TM25 定性第五步：谁在开卡后把地图按回原位
 * 已排除：Leaflet 夹紧（probe5：退化种子 zoom18 下手工 panBy 稳稳挪 0.001269° 不回弹）。
 * 已排除：duration 单位（本批已改 .52，且 probe3 记账里 panBy 确实带着 [0,-307] 发出去了）。
 * 剩下的唯一解释：开卡之后有代码把视图重设回 fitBounds 的位置。
 * travel-map 里 refresh() 会 map.fitBounds(...)，而 TravelNotes._afterSave = refresh，
 * 所以这里把 refresh / fitBounds / setView / panTo / invalidateSize 全包起来记调用栈。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-pan6.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [], say = s => { log.push(s); console.log(s); };

const SEED = () => {
  function pic(seed) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]; g.fillRect(0, 0, 900, 600);
    return c.toDataURL('image/jpeg', 0.82);
  }
  const long = ('那天的风很大，木塔的影子在地上拉得很长。' +
    '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。' +
    '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    id: 'tmg' + Math.random().toString(36).slice(2, 8),
    title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州',
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
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { const t = m.text(); if (t.indexOf('P6:') === 0) say('    ' + t); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });
  await sleep(2200);

  await page.evaluate(() => {
    const t0 = Date.now(), at = () => Date.now() - t0;
    const who = () => {
      const st = (new Error().stack || '').split('\n').slice(2, 6).map(s => s.trim().replace(/file:\/\/\/\S*?travel-map\.html/g, 'TM')).join(' <- ');
      return st.slice(0, 220);
    };
    const wrap = (obj, name) => {
      const o = obj[name];
      if (typeof o !== 'function') return;
      obj[name] = function () { say2('P6:' + name + ' @' + at() + ' 中心=' + map.getCenter().lat.toFixed(6) + ' z=' + map.getZoom() + ' ← ' + who()); return o.apply(obj, arguments); };
    };
    window.say2 = s => console.log(s);
    ['fitBounds', 'setView', 'panTo', 'panBy', 'invalidateSize', 'flyTo', 'setZoom', 'stop'].forEach(k => wrap(map, k));
    const orf = refresh;
    refresh = function () { say2('P6:refresh() @' + at() + ' ← ' + who()); return orf.apply(null, arguments); };
    const oafter = TravelNotes._afterSave;
    TravelNotes._afterSave = function () { say2('P6:_afterSave @' + at() + ' ← ' + who()); return oafter.apply(null, arguments); };
  });
  const C = () => page.evaluate(() => ({ lat: +map.getCenter().lat.toFixed(6), zoom: map.getZoom() }));

  say('0.1 起手 ' + JSON.stringify(await C()));
  const pre = await C();
  await page.evaluate(() => openMemSheetById(TravelNotes.list().filter(n => n.title === '大同古城')[0].id));
  await sleep(1100);
  say('1.1 开卡 1.1s ' + JSON.stringify(await C()) + '（pre ' + JSON.stringify(pre) + '）');
  await sleep(700);
  say('1.2 开卡 1.8s ' + JSON.stringify(await C()));
  await page.evaluate(() => closeMemSheet());
  await sleep(1400);
  say('2.1 关卡 ' + JSON.stringify(await C()));
  say('9 异常 ' + errs.length + ' ' + errs.slice(0, 2).join('|'));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + ((e && e.stack) || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
