/* tools/out/probe26-cal2.js — 「我的游记 · 日历 tab 只有裸日号」成因定量探针（批次 26-A）
 * 每条腿一个独立 browser context（隔开 file:// 下共享的那份 IndexedDB），
 * 只改笔记的 date 形状，其余字段照 saveNote（travel-notes.js:1505）逐字段写。
 * 读四样：日历格子（cells/has/digitsOnly）、#calDay 默认与点击后的文案、时间线视图是否抛错、pageerror 计数。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe26-cal2.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const p = n => (n < 10 ? '0' : '') + n;

/* 造一条日期形状可控的笔记 */
function note(tsDate, dateStr, title, day) {
  return {
    id: 'tn2_' + title.replace(/[^\w]/g, ''),
    title: title, siteName: '鹳雀楼', siteIndex: -1,
    lat: 34.84, lng: 110.49, ts: tsDate.getTime(),
    date: dateStr, day: day || '',
    province: '山西', city: '运城', county: '永济',
    raw: '正文·' + title, text: '正文·' + title, style: 'plain',
    photos: [], audio: '', tags: ['古建']
  };
}

async function seed(page, rows) {
  await page.evaluate(function (rs) {
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
        const os = tx.objectStore('notes');
        os.clear();
        rs.forEach(r => os.put(r));
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
}

const READ = function () {
  const q = s => document.querySelector(s);
  const txt = e => ((e && e.textContent) || '').trim();
  const out = { notes: window.TravelNotes ? TravelNotes.list().length : -1, errs: [] };
  try { TravelNotes.openList(); } catch (e) { out.errs.push('openList: ' + e.message); return out; }
  const cal = q('#tnViewCal'), tim = q('#tnViewTime');
  if (!cal) { out.errs.push('没有 #tnViewCal'); return out; }
  cal.click();
  const cells = Array.prototype.slice.call(document.querySelectorAll('.tn-cal-d[data-day]'));
  out.calHead = txt(q('.tn-cal-head b'));
  out.cells = cells.length;
  out.has = cells.filter(c => c.classList.contains('has')).length;
  out.digitsOnly = cells.filter(c => /^\d+$/.test(txt(c))).length;
  out.dayBoxDefault = txt(q('#calDay')).slice(0, 40);
  /* 点每一枚高亮格（没有高亮就点本月 8 号），记 #calDay 反应 */
  const pick = cells.filter(c => c.classList.contains('has'))[0] || cells[7];
  if (pick) { pick.click(); out.clickedDay = pick.getAttribute('data-day'); out.afterClick = txt(q('#calDay')).slice(0, 60); }
  /* 时间线视图（renderTimeView:1781 用 n.date.slice 无守卫） */
  tim.click();
  const body = q('#tnListBody');
  out.timelineNodes = body ? body.children.length : -1;
  out.timelineText = body ? txt(body).slice(0, 60) : '';
  /* 旅程视图（默认那档，renderItems:1732 同样裸 slice） */
  q('#tnViewTrip').click();
  out.tripNodes = body ? body.children.length : -1;
  /* 翻到空月：应出现「最近有记录的一天是 X」+ 跳过去 */
  cal.click();
  const prev = q('#calPrev');
  if (prev) {
    prev.click();
    out.afterPrevHead = txt(q('.tn-cal-head b'));
    out.prevMonthTip = txt(q('#calDay')).slice(0, 70);
    const goto = q('#calGoto');
    out.hasGoto = !!goto;
    if (goto) { goto.click(); out.afterGotoHead = txt(q('.tn-cal-head b')); out.hasAfterGoto = document.querySelectorAll('.tn-cal-d.has').length; }
  }
  return out;
};

(async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const back = k => new Date(y, m - k, 8, 9, 12);
  const dkey = (dd, mo, yy) => yy + '-' + p(mo + 1) + '-' + p(dd);
  const cm = (dd) => dkey(dd, m, y);           // 本月补零键
  const unpad = (dd) => y + '-' + (m + 1) + '-' + dd;   // 未补零
  const dot = (dd) => y + '.' + p(m + 1) + '.' + p(dd);
  const cn = (dd) => y + '年' + (m + 1) + '月' + dd + '日';

  const legs = [
    ['S0 对照·本月两条合格日期', [note(new Date(y, m, 5, 9, 12), cm(5) + ' 09:12', '本月五日', cm(5)), note(new Date(y, m, 8, 9, 12), cm(8) + ' 09:12', '本月八日', cm(8))]],
    ['S1 只有往月的笔记（本月一格没有）', [note(back(1), dkey(8, m - 1 < 0 ? 11 : m - 1, m - 1 < 0 ? y - 1 : y) + ' 09:12', '上月八日'), note(back(2), dkey(8, m - 2 < 0 ? m + 10 : m - 2, m - 2 < 0 ? y - 1 : y) + ' 09:12', '两月前八日')]],
    ['S2 未补零 2026-10-8', [note(new Date(y, m, 8, 9, 12), unpad(8) + ' 09:12', '未补零')]],
    ['S3 点号 2026.10.08（地图页那种写法）', [note(new Date(y, m, 8, 9, 12), dot(8) + ' 15:30', '点号格式')]],
    ['S4 中文 2026年10月8日', [note(new Date(y, m, 8, 9, 12), cn(8) + ' 09:12', '中文格式')]],
    ['S5 date 缺失（只有 ts）', [note(new Date(y, m, 8, 9, 12), '', '无date')]],
    ['S6 date=null 字段整个没有', [(function () { const n = note(new Date(y, m, 8, 9, 12), '', '无字段'); delete n.date; delete n.day; return n; })()]]
  ];

  for (const [name, rows] of legs) {
    rows.forEach(function (r, i) { r.id = 'tn2_' + i; });   /* 标题里的中文被剥掉后 id 会撞，按序号钉死 */
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 70)));
    await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(function () { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
    await seed(page, rows);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.TravelNotes && TravelNotes.list().length >= 1; }, { timeout: 15000, polling: 150 }).catch(function () {});
    const r = await page.evaluate(READ);
    r.pageerrors = errs.length ? errs : 0;
    console.log('\n== ' + name + ' ==');
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
