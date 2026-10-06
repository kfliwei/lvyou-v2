/* 临时探针 2：puppeteer 真实键入/点击在面板开销档上到底落没落盘 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = d => { const p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await browser.newPage();
  const errs = [];
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(U('index.html'), { waitUntil: 'load', timeout: 60000 });
  await sleep(1200);
  await p.evaluate(d => {
    localStorage.clear();
    localStorage.setItem('tn_trips', JSON.stringify([{ id: 'zz-live', name: '进行中趟', startDate: d.y, logStart: d.y, realDays: 3, days: [{}, {}, {}] }]));
  }, { y: iso(new Date(Date.now() - 86400000)) });
  await p.goto(U('index.html'), { waitUntil: 'load', timeout: 60000 });
  await sleep(1000);
  await p.evaluate(() => { TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' }); });
  await sleep(400);
  await p.evaluate(() => {
    window.__hits = [];
    document.addEventListener('click', function (e) { window.__hits.push((e.target.id || e.target.className || e.target.tagName) + ':' + Math.round(e.clientX) + ',' + Math.round(e.clientY)); }, true);
  });
  console.log('opened', JSON.stringify(await p.evaluate(() => {
    const q = s => document.querySelector(s);
    return {
      hasExp: q('.tn-panel') ? q('.tn-panel').className : 'no panel',
      disp: q('.tn-panel') ? q('.tn-panel').style.display : '',
      expenseOn: typeof window.Expense, form: typeof window.ExpenseForm,
      seg: q('.tn-seg') ? getComputedStyle(q('.tn-seg')).display : 'no seg',
      tab: q('#tnTabExp') ? 'yes' : 'no'
    };
  })));
  console.log('hitTab', JSON.stringify(await p.evaluate(() => {
    const t = document.querySelector('#tnTabExp');
    const r = t.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      hit: hit ? (hit.id || hit.className || hit.tagName) : 'none', same: hit === t,
      stack: document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).map(e => (e.id || (typeof e.className === 'string' ? e.className : e.tagName))).slice(0, 8),
      panelPE: getComputedStyle(document.querySelector('.tn-panel')).pointerEvents,
      splash: document.getElementById('bootSplash') ? getComputedStyle(document.getElementById('bootSplash')).display + '/' + getComputedStyle(document.getElementById('bootSplash')).pointerEvents : 'no splash',
      vtState: document.documentElement.classList.toString() };
  })));
  await p.click('#tnTabExp');
  await sleep(400);
  console.log('hitsAfterTab', JSON.stringify(await p.evaluate(() => window.__hits)));
  console.log('switched', JSON.stringify(await p.evaluate(() => ({
    cls: document.querySelector('.tn-panel').className,
    expForm: document.querySelector('#tnExpForm') ? document.querySelector('#tnExpForm').innerHTML.length : 'no root'
  }))));
  console.log('pre', JSON.stringify(await p.evaluate(() => {
    const a = document.querySelector('#adAmt'), s = document.querySelector('#adSave');
    const r = s.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      amt: a ? a.value : 'no amt',
      saveRect: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      hit: hit ? (hit.id || hit.className || hit.tagName) : 'none',
      hitIsSave: hit === s || (s.contains && s.contains(hit)),
      vh: window.innerHeight,
      expScroll: { top: document.querySelector('.tn-expense').scrollTop, h: document.querySelector('.tn-expense').clientHeight, sh: document.querySelector('.tn-expense').scrollHeight }
    };
  })));
  await p.type('#adAmt', '66.6');
  console.log('typed', JSON.stringify(await p.evaluate(() => ({ amt: document.querySelector('#adAmt').value, active: document.activeElement && document.activeElement.id }))));
  await p.click('#adSave');
  await sleep(400);
  console.log('post', JSON.stringify(await p.evaluate(() => ({
    ledger: JSON.parse(localStorage.getItem('tn_expense') || '[]'),
    today: document.querySelector('#tnExpToday').textContent,
    note: document.querySelector('.tn-flash') ? document.querySelector('.tn-flash').textContent : '',
    toast: document.querySelector('.ui-toast') ? document.querySelector('.ui-toast').textContent : 'no toast',
    hits: window.__hits
  }))), 'ERRS', errs);
  await browser.close();
})().catch(e => { console.log('CRASH ' + e.stack); process.exit(1); });
