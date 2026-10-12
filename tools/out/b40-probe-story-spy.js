/* tools/out/b40-probe-story-spy.js — 末站到底去没去成：包一层 setActive 记录调用序列
 * 用法: NODE_PATH=tools/node_modules node tools/out/b40-probe-story-spy.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const D = 24 * 3600 * 1000, T0 = new Date('2026-09-28T09:00:00+08:00').getTime();
function dd(i, site, lat, lng, city) { const ts = T0 + i * D;
  return { id: 'p40s_' + site, title: site + '·记', siteName: site, siteIndex: -1, lat, lng, ts,
    date: new Date(ts).toISOString().slice(0, 10), day: '', province: '山西', city, county: '',
    raw: '正文·' + site, text: '正文·' + site, style: 'plain', photos: [], audio: '', tags: [] }; }
const DAT = [dd(0,'云冈石窟',40.032,113.135,'大同'),dd(1,'华严寺',40.091,113.259,'大同'),
  dd(2,'大同博物馆',40.083,113.310,'大同'),dd(3,'晋祠',37.712,112.455,'太原'),dd(4,'山西博物院',37.869,112.449,'太原')];

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR: ' + e.message.slice(0, 140)));
  await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p.evaluate(function (rs) { return new Promise(function (res, rej) {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = function (e) { const db = e.target.result; if (!db.objectStoreNames.contains('notes')) {
      const st = db.createObjectStore('notes', { keyPath: 'id' });
      st.createIndex('by_city', 'city', { unique: false }); st.createIndex('by_day', 'day', { unique: false }); st.createIndex('by_ts', 'ts', { unique: false }); } };
    rq.onsuccess = function () { const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear(); rs.forEach(function (r) { os.put(r); }); tx.oncomplete = function () { db.close(); res(1); }; tx.onerror = function () { db.close(); rej(tx.error); }; };
    rq.onerror = function () { rej(rq.error); }; }); }, DAT);
  await p.goto(U('story.html'), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('.story-card').length === 5, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);

  await p.evaluate(function () {
    window.__log = [];
    var orig = window.setActive;
    window.setActive = function (i, initial) {
      window.__log.push('setActive(' + i + ') from=' + (initial ? 'init' : (window.__stackHint || '?')) +
        ' scrollY=' + Math.round(window.scrollY) + ' t=' + Math.round(performance.now()));
      return orig(i, initial);
    };
    var og = window.goStep;
    window.goStep = function (d) { window.__stackHint = '按钮'; window.__log.push('goStep(' + d + ') lastActive=' + window.__la());
      var r = og(d); window.__stackHint = '?'; return r; };
    var os = window.onScroll;
    window.__spyOn = true;
    window.onScroll = function () { if (!window.__spyOn) return; window.__stackHint = '滚动判读'; os(); };
    window.__la = function () { return -2; };
  });
  /* lastActive 是脚本内 var，不在 window 上；改用 DOM 的 active 卡读数代替 */
  const activeIdx = () => p.evaluate(() => [].slice.call(document.querySelectorAll('.story-card')).findIndex(e => e.classList.contains('active')));
  const nav = () => p.evaluate(() => (document.getElementById('snSub') || {}).textContent.trim().slice(0, 10));
  const log = () => p.evaluate(() => window.__log.slice());

  console.log('--- 逐次点「下一站」，每次给 1.6s 落定 ---');
  for (let k = 1; k <= 4; k++) {
    await p.evaluate(() => { window.__log = []; });
    await p.evaluate(() => { const btn = document.getElementById('snNext'); if (btn && !btn.disabled) btn.click(); });
    await sleep(160); const early = await p.evaluate(() => window.__log.slice());
    const eAct = await activeIdx(), eNav = await nav();
    await sleep(1500);
    const l = await log(), act = await activeIdx(), nv = await nav();
    console.log('第' + k + '次点 → 160ms: active=' + eAct + ' 条「' + eNav + '」 | 1.6s后: active=' + act + ' 条「' + nv + '」 nextDisabled=' +
      await p.evaluate(() => !!document.getElementById('snNext').disabled));
    console.log('   160ms 调用: ' + early.join(' / '));
    console.log('   1.6s 调用: ' + l.join(' / '));
  }
  console.log('--- 末站手动滚到底再等 spy ---');
  await p.evaluate(() => { window.__log = []; window.scrollTo(0, document.documentElement.scrollHeight); });
  await sleep(1500);
  console.log('   调用: ' + (await log()).join(' / ') + ' | active=' + await activeIdx() + ' 条「' + await nav() + '」');
  await ctx.close(); await b.close();
})().catch(e => { console.log('探针异常: ' + e.message); process.exit(1); });
