/* 批次 33-E 地基探针 第三支：面板触控族在真机档的真实 rect
   §39 的浏览器腿 K00–K33 只覆盖 13 个「顶栏宿主」，随手记面板不在里面（面板不是顶栏），
   而 33-B 把面板那一族的尺寸从 travel-notes.js 注入串剥干净、搬进 design.css 单点之后，
   **没有任何一条腿量过面板里的可点控件今天多高**。这一支先把真值量出来，再决定 K34 写什么。
   两档取样（328×723 真机主档 + 320×640 最紧档），三态：录音屏 / 清单屏 / 日历屏。
   只读数，不改盘。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require(path.join(path.resolve(__dirname, '..'), 'node_modules', 'puppeteer-core'));

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8177', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

const SEED = function () {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
    var r1 = indexedDB.open('gujian-notes', 1);
    r1.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    r1.onsuccess = function (e) {
      var db = e.target.result;
      var tx = db.transaction('notes', 'readwrite');
      tx.objectStore('notes').clear();
      tx.objectStore('notes').put({ id: 'e1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
        ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02',
        text: '正文一', photos: [], audio: '', tags: ['木塔'] });
      tx.oncomplete = function () { db.close(); resolve('ok'); };
      tx.onerror = function () { db.close(); resolve('fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
};

const MEAS = function () {
  const out = [];
  const seen = {};
  document.querySelectorAll('.tn-panel *, .tn-listbar *, .tn-editpage *, .tn-quotes *').forEach(function (el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    let cls = (el.className && String(el.className).baseVal !== undefined ? String(el.className.baseVal) : String(el.className || '')).trim();
    if (!cls && el.id) cls = '#' + el.id;
    if (!cls) return;
    const first = cls.split(/\s+/)[0];
    if (!/^(tn-x|tn-pill|tn-viewtab|tn-repolish|tn-tagbar|tn-listbar)$/.test(first) &&
        !(el.tagName === 'INPUT' && el.closest('.tn-listbar'))) return;
    const key = first + '|' + Math.round(r.width) + 'x' + Math.round(r.height);
    if (seen[key]) { seen[key]++; return; }
    seen[key] = 1;
    out.push({ sel: first, tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '.' + first.replace('tn-', 'tn-')),
      w: Math.round(r.width), h: Math.round(r.height), mh: cs.minHeight, mw: cs.minWidth });
  });
  const tabBtns = [...document.querySelectorAll('.tn-tagbar button')].filter(b => b.getBoundingClientRect().height > 0)
    .map(b => Math.round(b.getBoundingClientRect().height));
  const inputs = [...document.querySelectorAll('.tn-listbar input')].filter(b => b.getBoundingClientRect().height > 0)
    .map(b => Math.round(b.getBoundingClientRect().height));
  return { out: out, tagbarHeights: tabBtns, listbarInputHeights: inputs,
    tagbarShown: (function () { var b = document.getElementById('tnTagBar'); return b ? getComputedStyle(b).display : 'none'; })() };
};

(async () => {
  const srv = staticServer();
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  for (const vp of [{ width: 328, height: 723 }, { width: 320, height: 640 }]) {
    const p = await browser.newPage();
    await p.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.evaluate(SEED);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction('window.TravelNotes', { timeout: 20000 });
    await sleep(2600);   /* 启动屏 900ms + .hide 600ms + remove */

    console.log('\n=========== ' + vp.width + 'x' + vp.height + ' ===========');
    await p.evaluate(function () { TravelNotes.openPanel({ label: '应县木塔', lat: 39.66, lng: 113.13, __i: 0 }); });
    await p.waitForSelector('.tn-panel', { visible: true, timeout: 15000 }); await sleep(700);
    let m = await p.evaluate(MEAS);
    console.log('[录音屏] ' + JSON.stringify(m, null, 0).slice(0, 700));

    await p.evaluate(function () { var q = document.getElementById('tnQuote'); if (q) q.click(); });
    await sleep(500);
    m = await p.evaluate(MEAS);
    console.log('[+名言浮层] ' + JSON.stringify(m.out).slice(0, 400));

    await p.evaluate(function () { var x = document.querySelector('.tn-quotes .tn-x'); if (x) x.click(); });
    await p.evaluate(function () { var b = document.querySelector('.tn-list .tn-x') || document.getElementById('tnPanelClose'); if (b) b.click(); });
    await sleep(400);
    await p.evaluate(function () { TravelNotes.openList(); });
    await sleep(900);
    m = await p.evaluate(MEAS);
    console.log('[清单屏] tagbar=' + m.tagbarShown + ' pill/viewtab 高：' + JSON.stringify(m.out));
    console.log('   .tn-tagbar button 逐枚高：' + JSON.stringify(m.tagbarHeights));
    console.log('   .tn-listbar input 逐枚高：' + JSON.stringify(m.listbarInputHeights));

    await p.evaluate(function () { var t = document.getElementById('tnViewCal'); if (t) t.click(); });
    await sleep(700);
    m = await p.evaluate(MEAS);
    console.log('[日历屏] ' + JSON.stringify(m.out));
    console.log('   报错 ' + errs.length + ' 条 ' + errs.slice(0, 2).join(' | '));
    await p.close();
  }
  /* me.html 那颗 .entry .ic：两条同名规则，今天实际生效的是哪一档 */
  const pm = await browser.newPage();
  await pm.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  await pm.goto(BASE + '/me.html', { waitUntil: 'load' });
  await sleep(1500);
  const ics = await pm.evaluate(function () {
    return [...document.querySelectorAll('.entry .ic')].map(function (e) {
      const r = e.getBoundingClientRect();
      return Math.round(r.width) + 'x' + Math.round(r.height);
    });
  });
  console.log('\n=========== me.html .entry .ic 实测 rect：' + JSON.stringify(ics) + '（源码里 34 与 40 两条同名，:61 后加载者胜）');
  await browser.close();
  srv.close();
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(2); });
