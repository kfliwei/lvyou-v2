/* tools/out/probe45-copybranch.js — 复制那条出口在烟测环境里走的是哪一支
 * 为什么先量这个：mut-verify45 里有一条靶子想把 `} else legacy();` 摘掉，赌浏览器腿 CO07 会拦不到。
 * 但 file:// 在 Chromium 里算安全上下文，navigator.clipboard 可能压根就在——那一支是**恒等变异**
 * （摘掉一条本来就走不到的分支，两头都不红，读起来像闸门失灵）。先数清楚走哪支，再决定这条靶子留不留。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe45-copybranch.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  rq.onsuccess = () => {
    const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
    os.clear();
    os.put({ id: 'cbA', title: '大同古城', siteName: '大同古城', lat: 39.5606, lng: 114.0862,
      ts: Date.now() - 3600e3, date: '2026-10-02 09:00', day: '2026-10-02',
      text: '风很大。', raw: '风很大。', province: '山西', city: '大同', county: '平城区', photos: [], audio: '', tags: [], weather: '晴 18℃', style: 'ink' });
    tx.oncomplete = () => { db.close(); res(1); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  };
  rq.onerror = () => rej(rq.error);
});

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await b.newPage();
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 1, { timeout: 20000, polling: 150 });
  await sleep(2200);
  console.log('环境读数: ' + JSON.stringify(await page.evaluate(() => ({
    isSecureContext: window.isSecureContext,
    hasClipboard: !!(navigator.clipboard && navigator.clipboard.writeText),
    execCommand: typeof document.execCommand,
    protocol: location.protocol,
  }))));
  /* 先开列表并展开旅程卡：视图默认折叠，不点就是 0 张卡（§45 登记过的那个空跑坑，探针自己也踩过一次） */
  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(500);
  const N0 = await page.evaluate(() => {
    const h = document.querySelector('#tnListBody .tn-trip-head');
    if (h) h.click();
    return document.querySelectorAll('#tnListBody .tn-item').length;
  });
  await sleep(500);
  console.log('展开后卡片数=' + N0 + '（0 张卡＝下面这支还没开跑，读数无意义）');

  /* 两条腿各埋一次桩：只拦 clipboard 那一支，看这次点击会不会落到 legacy */
  const only = await page.evaluate(async () => {
    const cap = [];
    const realClip = navigator.clipboard;
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: t => { cap.push(['clipboard', t]); return Promise.resolve(); } }, configurable: true,
      });
    } catch (e) { cap.push(['defineProperty 失败', String(e.message)]); }
    const realExec = document.execCommand;
    document.execCommand = function (c) {
      const a = document.activeElement;
      if (c === 'copy' && a && a.tagName === 'TEXTAREA') cap.push(['execCommand', a.value]);
      return true;
    };
    const it = Array.from(document.querySelectorAll('#tnListBody .tn-item'))[0];
    if (!it) return { noCard: true };
    it.querySelector('[data-a=copy]').click();
    await new Promise(r => setTimeout(r, 400));
    document.execCommand = realExec;
    try { Object.defineProperty(navigator, 'clipboard', { value: realClip, configurable: true }); } catch (e) {}
    return cap;
  });
  console.log('点一次「复制」拦到的分支: ' + JSON.stringify(only).slice(0, 300));

  const branch = Array.isArray(only) && only.length ? only.map(x => x[0]).join('+') : (only && only.noCard ? '没卡片' : '一支都没拦到');
  console.log('走的那一支 = ' + branch);
  console.log('结论: ' + (only && only.noCard
    ? '列表里 0 张卡（展开那一步没生效），这条读数作废'
    : (branch === 'clipboard'
      ? '走 navigator.clipboard ⇒「摘掉 } else legacy();」是恒等变异，摘了 CO07 也不会红，不能当靶子'
      : '走了 legacy（或两支并存）⇒ 摘掉 `} else legacy();` 会让 CO07 拦不到，可以当靶子')));
  await b.close();
})().catch(e => { console.log('FATAL ' + ((e && e.stack) || e)); process.exit(1); });
