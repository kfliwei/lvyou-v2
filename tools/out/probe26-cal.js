/* tools/out/probe26-cal.js — 「我的游记 / 日历视图只有数字没有内容」复现探针（批次 26 地基）
 * 两处日历都量：① review.html 的月历（.cal-cell / #dayBox）；② 随手记面板的日历视图
 * （.tn-cal-d / #calDay，travel-notes.js:1653）。种子笔记走产品自己那份 IDB（gujian-notes/notes），
 * 形状照 saveNote（travel-notes.js:1497）逐字段写，不自己发明字段。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe26-cal.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 三条笔记：两条落在本月不同天、一条落在上月（验「默认只显示本月」那一半） */
function seedNotes() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const p = n => (n < 10 ? '0' : '') + n;
  const mk = (dd, mo, title, text) => {
    const d = new Date(y, mo, dd, 9, 12);
    return {
      id: 'tn_probe_' + mo + '_' + dd,
      title: title, siteName: '鹳雀楼', siteIndex: -1,
      lat: 34.84, lng: 110.49, ts: d.getTime(),
      date: y + '-' + p(mo === m ? dd : dd) + ' 09:12',
      day: '',
      province: '山西', city: '运城', county: '永济',
      raw: text, text: text, style: 'plain',
      photos: [], audio: '', tags: ['古建']
    };
  };
  const dayOf = (dd, mo) => y + '-' + p(mo + 1) + '-' + p(dd);
  const out = [mk(5, m, '探针·五日', '今天在看鹳雀楼的屋檐。'), mk(7, m, '探针·七日', '清 Early 上桥，风很大。')];
  out[0].day = dayOf(5, m); out[0].date = out[0].day + ' 09:12';
  out[1].day = dayOf(7, m); out[1].date = out[1].day + ' 09:12';
  const pm = m === 0 ? 11 : m - 1;
  const py = m === 0 ? y - 1 : y;
  const last = mk(11, pm, '探针·上月', '上个月那条也该在日历上有个点。');
  last.day = py + '-' + p(pm + 1) + '-11';
  last.date = last.day + ' 09:12';
  last.ts = new Date(py, pm, 11, 9, 12).getTime();
  out.push(last);
  return out;
}

async function seedIdb(page) {
  await page.evaluate(function (rows) {
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
        const db = rq.result;
        const tx = db.transaction('notes', 'readwrite');
        rows.forEach(r => tx.objectStore('notes').put(r));
        tx.oncomplete = function () { db.close(); res(rows.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, seedNotes());
}

(async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  /* ---------- ① review.html 月历 ---------- */
  await page.goto(U('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(600);
  await seedIdb(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function () { return window.TravelNotes && TravelNotes.list().length >= 3; }, { timeout: 15000, polling: 150 }).catch(function () { console.log('  (review: 笔记没到货，按现状读)'); });
  const rv = await page.evaluate(function () {
    const cells = Array.prototype.slice.call(document.querySelectorAll('.cal-cell'));
    const has = cells.filter(function (c) { return c.classList.contains('has'); });
    const digitsOnly = cells.filter(function (c) { return /^\d+$/.test((c.textContent || '').trim()); }).length;
    let dayBox = null, clicked = null;
    if (has.length) { has[0].click(); clicked = has[0].getAttribute('data-d'); }
    const b = document.getElementById('dayBox');
    dayBox = b ? { len: (b.textContent || '').trim().length, head: (b.textContent || '').trim().slice(0, 90), imgs: b.querySelectorAll('img').length, imgsNoSrc: Array.prototype.filter.call(b.querySelectorAll('img'), function (i) { return !i.getAttribute('src'); }).length } : null;
    return {
      title: (document.getElementById('calTitle') || {}).textContent,
      cells: cells.length, has: has.length, digitsOnly: digitsOnly,
      clicked: clicked, dayBox: dayBox,
      notesLoaded: window.TravelNotes ? TravelNotes.list().length : -1,
      dayMapKeys: (function () { try { return Object.keys(window.dayMap || {}); } catch (e) { return ['<读不到>']; } })()
    };
  });
  console.log('REVIEW 月历: ' + JSON.stringify(rv, null, 1));
  await page.screenshot({ path: path.join(ROOT, 'tools/out/b26-review-cal.png'), fullPage: false });

  /* ---------- ② 随手记面板 日历视图 ---------- */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  p2.on('pageerror', e => errs.push('pageerror2: ' + e.message));
  await p2.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.evaluateOnNewDocument(function () { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(function () { return window.TravelNotes && TravelNotes.list().length >= 3; }, { timeout: 15000, polling: 150 }).catch(function () { console.log('  (面板: 笔记没到货)'); });
  const cal = await p2.evaluate(function () {
    TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' });
    const tab = document.getElementById('tnViewCal');
    if (!tab) return { err: '没有 #tnViewCal 这枚 tab' };
    tab.click();
    const cells = Array.prototype.slice.call(document.querySelectorAll('.tn-cal-d[data-day]'));
    const has = cells.filter(function (c) { return c.classList.contains('has'); });
    const head = document.querySelector('.tn-cal-head b');
    let out = {
      calHead: head ? head.textContent : null,
      cells: cells.length, has: has.length,
      digitsOnly: cells.filter(function (c) { return /^\d+$/.test((c.textContent || '').trim()); }).length,
      notes: TravelNotes.list().length,
      dates: TravelNotes.list().map(function (n) { return n.date + '|' + n.day; })
    };
    if (cells.length) { cells[0].click(); }
    const day = document.getElementById('calDay');
    out.clickEmptyDay = day ? (day.textContent || '').trim().slice(0, 60) : null;
    if (has.length) { has[0].click(); out.clickHasDay = day ? (day.textContent || '').trim().slice(0, 90) : null; }
    return out;
  });
  console.log('面板日历: ' + JSON.stringify(cal, null, 1));
  await p2.screenshot({ path: path.join(ROOT, 'tools/out/b26-panel-cal.png'), fullPage: false });

  console.log('未捕获报错: ' + (errs.length ? errs.join(' || ') : '0 条'));
  await browser.close();
})();
