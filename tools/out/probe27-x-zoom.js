/* tools/out/probe27-x-zoom.js — 定性两条用户报告（2026-10-07）
 * ① 「点导入／导出，弹出的窗口关闭按钮没有 X」
 * ② 「游记内容有照片的，点照片不能放大」
 * 全程真机档 328×723（批次 23-D 口径），逐形状读数打印，不改任何产品文件。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe27-x-zoom.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* 1x1 PNG，三个不同颜色好分辨 */
const PX = c => 'data:image/gif;base64,R0lGODlhAQABAIAAAP' + c + 'AAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

(async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().slice(0, 120)); });
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('tn_onboarded', '1'));
  await page.evaluate(function () {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear();
        const t = Date.now();
        os.put({
          id: 'pz_two', title: '鹳雀楼', siteName: '鹳雀楼', siteIndex: -1, lat: 34.84, lng: 110.49, ts: t,
          date: '2026-09-18 09:12', day: '2026-09-18', province: '山西', city: '运城', county: '永济',
          raw: '两张照片的那一篇', text: '两张照片的那一篇', style: 'plain',
          photos: ['PLACE_A', 'PLACE_B'], audio: '', tags: []
        });
        os.put({
          id: 'pz_one', title: ' solo 一张', siteName: '鹳雀楼', siteIndex: -1, lat: 34.84, lng: 110.49, ts: t - 86400000,
          date: '2026-09-17 09:12', day: '2026-09-17', province: '山西', city: '运城', county: '永济',
          raw: '只有一张照片', text: '只有一张照片', style: 'plain', photos: ['PLACE_A'], audio: '', tags: []
        });
        tx.oncomplete = function () { db.close(); res(2); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  });
  /* 占位换成真图（避免日志里躺两大串 base64） */
  await page.evaluate(function (a, b) {
    return new Promise(function (res) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        ['pz_two', 'pz_one'].forEach(function (id) {
          const g = os.get(id);
          g.onsuccess = function () {
            const n = g.result;
            n.photos = n.photos.map(function (p) { return p === 'PLACE_A' ? a : b; });
            os.put(n);
          };
        });
        tx.oncomplete = function () { db.close(); res(); };
      };
    });
  }, PX('t'), PX('n'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });

  const P = (...a) => console.log(...a);

  /* ---------- ② 照片放大：先在日历那条腿量，再在时间线那条腿量 ---------- */
  const CAL_CLICK = function () {
    const out = { step: [], viewer: null, img: null };
    TravelNotes.openList();
    document.querySelector('#tnViewCal').click();
    const cell = Array.prototype.slice.call(document.querySelectorAll('.tn-cal-d.has'))[0];
    out.step.push('日历格子 data-day=' + (cell && cell.getAttribute('data-day')));
    if (!cell) return out;
    cell.click();
    const img = document.querySelector('#calDay .tn-item .pics img');
    if (!img) { out.step.push('#calDay 里没有 .tn-item .pics img'); return out; }
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    out.img = { w: Math.round(r.width), h: Math.round(r.height), pe: cs.pointerEvents, cursor: cs.cursor, onclickAttr: img.getAttribute('onclick'), srcHead: (img.getAttribute('src') || '').slice(0, 22), complete: img.complete, natural: img.naturalWidth + 'x' + img.naturalHeight };
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.step.push('elementFromPoint 命中的是 ' + (hit ? hit.tagName + '.' + (hit.className || '') : 'null') + '（要 IMG）');
    /* 给出口装个探针，看点击到底有没有走到 */
    window.__pzCalls = [];
    const orig = TravelNotes.zoomPhotoIdx;
    TravelNotes.zoomPhotoIdx = function (id, i) { window.__pzCalls.push('zoomPhotoIdx(' + id + ',' + i + ')'); return orig.apply(this, arguments); };
    img.click();
    out.viewer = (function () {
      const v = document.querySelector('.tn-viewer');
      if (!v) return null;
      const cs2 = getComputedStyle(v), r2 = v.getBoundingClientRect();
      const im = v.querySelector('img');
      return { cls: v.className, pos: cs2.position, z: cs2.zIndex, disp: cs2.display, rect: Math.round(r2.width) + 'x' + Math.round(r2.height), imgSrc: im ? (im.getAttribute('src') || '').slice(0, 22) : '没有 IMG', counter: (v.querySelector('.tn-viewer-i') || {}).textContent, hasX: !!v.querySelector('.tn-viewer-x'), calls: window.__pzCalls.slice() };
    })();
    if (out.viewer) document.querySelector('.tn-viewer').remove();
    return out;
  };
  const r1 = await page.evaluate(CAL_CLICK);
  P('=== ② 日历里点照片 ===');
  r1.step.forEach(s => P('   ' + s));
  P('   IMG 读数: ' + JSON.stringify(r1.img));
  P('   查看器: ' + (r1.viewer ? JSON.stringify(r1.viewer) : '【没出现 .tn-viewer】'));

  /* 时间线那条腿 */
  const TL_CLICK = function () {
    const out = { found: 0, viewer: null };
    document.querySelector('#tnViewTime').click();
    const imgs = Array.prototype.slice.call(document.querySelectorAll('.tn-item .pics img'));
    out.found = imgs.length;
    if (!imgs.length) return out;
    /* 时间线的正文默认收起，先确认图在不在可视区 */
    const img = imgs[0], r = img.getBoundingClientRect();
    out.rect = Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    out.inViewport = r.top >= 0 && r.bottom <= innerHeight;
    out.onclickAttr = img.getAttribute('onclick');
    window.__pzCalls = [];
    img.click();
    const v = document.querySelector('.tn-viewer');
    out.viewer = v ? { z: getComputedStyle(v).zIndex, rect: Math.round(v.getBoundingClientRect().width) + 'x' + Math.round(v.getBoundingClientRect().height), calls: window.__pzCalls.slice() } : null;
    if (v) v.remove();
    return out;
  };
  const r2 = await page.evaluate(TL_CLICK);
  P('=== ② 时间线里点照片 ===');
  P('   ' + JSON.stringify(r2));

  /* ---------- ① 导出／导入弹层的 X ---------- */
  const MODAL = function (btnId, xId) {
    const out = {};
    const b = document.querySelector(btnId);
    if (!b) return { err: '入口按钮 ' + btnId + ' 不在' };
    b.click();
    const mask = document.querySelector('.ui-modal-mask');
    const x = document.querySelector(xId);
    out.maskShown = !!mask && getComputedStyle(mask).display !== 'none';
    if (!x) { out.x = '【没有 ' + xId + ' 这个节点】'; return out; }
    const cs = getComputedStyle(x), r = x.getBoundingClientRect();
    const svg = x.querySelector('svg');
    const use = x.querySelector('use');
    out.x = {
      rect: Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.left) + ',' + Math.round(r.top),
      color: cs.color, bg: cs.backgroundColor, overflow: cs.overflow, display: cs.display,
      svg: svg ? (getComputedStyle(svg).width + '/' + getComputedStyle(svg).height + ' vis=' + getComputedStyle(svg).visibility + ' disp=' + getComputedStyle(svg).display) : '【button 里没有 svg】',
      useHref: use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : 'no use',
      spriteHasSymbol: !!(window.SYMS_HINT),
      symbolFound: use ? !!document.querySelector(use.getAttribute('href')) : false,
      inner: x.innerHTML.slice(0, 90),
      text: JSON.stringify((x.textContent || '').trim())
    };
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.hitTest = hit ? (hit.tagName + '#' + (hit.id || '') + '.' + (hit.className && hit.className.baseVal !== undefined ? hit.className.baseVal : hit.className || '')) : 'null';
    out.sitsInsideMask = !!(hit && mask && mask.contains(hit.closest ? (hit.closest(xId) ? hit : document.querySelector(xId) && document.querySelector(xId).contains(hit) ? hit : hit) : hit));
    return out;
  };
  const exp = await page.evaluate(MODAL, '#tnExpBtn', '#tnExpX');
  P('=== ① 导出备份弹层的 X ===');
  P('   ' + JSON.stringify(exp, null, 1));
  await sleep(300);
  await page.screenshot({ path: path.join(ROOT, 'tools', 'out', 'b27-export-modal.png') });
  await page.evaluate(() => { const x = document.querySelector('#tnExpX'); if (x) x.click(); const m = document.querySelector('.ui-modal-mask'); if (m) m.remove(); });
  const imp = await page.evaluate(MODAL, '#tnImpBtn', '#tnImpX');
  P('=== ① 导入备份弹层的 X ===');
  P('   ' + JSON.stringify(imp, null, 1));
  await sleep(300);
  await page.screenshot({ path: path.join(ROOT, 'tools', 'out', 'b27-import-modal.png') });

  /* 顺带量一遍页面上其它「自带关闭钮」的控件尺寸（44px 触控线） */
  const OTHERS = await page.evaluate(function () {
    const sel = ['#tnDocX', '#tnExpX', '#tnImpX', '#tnZoomX', '.tn-viewer-x', '.tn-x'];
    const out = [];
    document.querySelectorAll('.tn-x, [id^=tn][id$=X], .tn-viewer-x').forEach(function (e) {
      const r = e.getBoundingClientRect();
      if (!r.width) return;
      out.push((e.id || e.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out.slice(0, 14);
  });
  P('=== 顺带：这一屏上自带关闭钮的实际尺寸 ===');
  OTHERS.forEach(s => P('   ' + s));

  P('=== 未捕获报错 ' + errs.length + ' 条 ===');
  errs.slice(0, 8).forEach(e => P('   ' + e));
  await browser.close();
})();
