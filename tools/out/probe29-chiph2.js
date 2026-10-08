/* tools/out/probe29-chiph2.js — 上一支探针里注入的 min-height 完全没落地（computed 恒 44px），
 * 先弄清是谁在写这个 44：样式表注入有没有生效、行内 important 生不生效、以及这条规则到底来自哪。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe29-chiph2.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const READ = () => {
  const tl = document.getElementById('mmTimeline');
  const c = tl.querySelector('.tl-chip');
  const before = { h: Math.round(c.getBoundingClientRect().height), minH: getComputedStyle(c).minHeight };
  c.style.setProperty('min-height', '8px', 'important');
  const afterInline = { h: Math.round(c.getBoundingClientRect().height), minH: getComputedStyle(c).minHeight, attr: c.getAttribute('style') };
  c.style.removeProperty('min-height');
  /* 谁在写 44：把所有样式表里命中这枚元素的规则都列出来 */
  const hits = [];
  Array.from(document.styleSheets).forEach(ss => {
    let rules;
    try { rules = Array.from(ss.cssRules); } catch (e) { hits.push('<<不可读 ' + (ss.href || 'inline') + ' ' + e.name + '>>'); return; }
    const walk = (list, ctx) => list.forEach(r => {
      if (r.selectorText) {
        try { if (c.matches(r.selectorText) && /min-height|height/.test(r.style.cssText)) hits.push((ctx || ss.ownerNode.tagName + '#' + (ss.ownerNode.id || '')) + ' {' + r.selectorText + ' -> ' + r.style.cssText + '}'); } catch (e) {}
      }
      if (r.cssRules && r.cssRules.length) walk(Array.from(r.cssRules), (ctx || '') + '@' + (r.conditionText || r.name || ''));
    });
    walk(rules, '');
  });
  return { before, afterInline, tag: c.tagName, matchesBtn: c.matches('button'), hits };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {}
    const now = Date.now();
    const mk = (o) => Object.assign({ id: 'tmg' + Math.random().toString(36).slice(2, 8), title: '应县木塔', siteName: '应县木塔', city: '朔州', lat: 39.56, lng: 114.08, photos: [], text: 'x', raw: 'x', day: '2026-10-02', tags: [], weather: '', style: 'ink' }, o);
    const list = [mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', title: '大同古城', text: 'aaa', raw: 'aaa' }), mk({ ts: now - 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: 'bbb', raw: 'bbb' })];
    return new Promise((res, rej) => {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('notes')) { const st = db.createObjectStore('notes', { keyPath: 'id' }); ['by_city', 'by_day', 'by_ts'].forEach(ix => st.createIndex(ix, ix === 'by_city' ? 'city' : ix === 'by_day' ? 'day' : 'ts', { unique: false })); } };
      rq.onsuccess = () => { const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes'); os.clear(); list.forEach(r => os.put(r)); tx.oncomplete = () => { db.close(); res(1); }; tx.onerror = () => rej(tx.error); };
      rq.onerror = () => rej(rq.error);
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => { const tl = document.getElementById('mmTimeline'); return tl && tl.querySelector('.tl-chip'); }, { timeout: 20000, polling: 150 });
  await sleep(1200);
  const r = await page.evaluate(READ);
  console.log('chip 标签=' + r.tag + '  isButton=' + r.matchesBtn);
  console.log('改前 h=' + r.before.h + ' minH=' + r.before.minH);
  console.log('行内 !important min-height:8px 之后 h=' + r.afterInline.h + ' minH=' + r.afterInline.minH + ' style="' + r.afterInline.attr + '"');
  console.log('命中这枚元素且写了 height/min-height 的规则：');
  r.hits.forEach(h => console.log('   ' + h));
  await browser.close();
})();
