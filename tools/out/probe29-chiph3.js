/* tools/out/probe29-chiph3.js — 分清「胶囊为什么压不小」：是 flex stretch 由同排兄弟撑起来（b），
 * 还是 Chromium 给 form 控件的 44px 整机下限（a）。上一支探针只压一枚 chip，两种解释都成立，判不了。
 * 这一支一次压整排（chip + 行程分组那颗兄弟），并读每枚的 computed min-height。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe29-chiph3.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const READ = (css) => {
  let st = document.getElementById('probe29chiph3');
  if (!st) { st = document.createElement('style'); st.id = 'probe29chiph3'; document.head.appendChild(st); }
  st.textContent = css;
  const tl = document.getElementById('mmTimeline');
  return {
    align: getComputedStyle(tl).alignItems,
    kids: Array.from(tl.children).map(c => ({
      cls: c.className, tag: c.tagName,
      h: Math.round(c.getBoundingClientRect().height),
      minH: getComputedStyle(c).minHeight,
      boxH: Math.round(parseFloat(getComputedStyle(c).height) || 0),
    })),
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(() => new Promise((res, rej) => {
    const now = Date.now();
    const mk = o => Object.assign({ id: 'tmg' + Math.random().toString(36).slice(2, 8), title: '应县木塔', siteName: '应县木塔', city: '朔州', lat: 39.56, lng: 114.08, photos: [], tags: [], weather: '', style: 'ink' }, o);
    const list = [
      mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', title: '大同古城', text: 'aaa', raw: 'aaa' }),
      mk({ ts: now - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', title: '悬空寺', siteName: '悬空寺', text: 'bbb', raw: 'bbb' }),
      mk({ ts: now - 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: 'ccc', raw: 'ccc' }),
    ];
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('notes')) { const st = db.createObjectStore('notes', { keyPath: 'id' }); st.createIndex('by_city', 'city', { unique: false }); st.createIndex('by_day', 'day', { unique: false }); st.createIndex('by_ts', 'ts', { unique: false }); } };
    rq.onsuccess = () => { const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes'); os.clear(); list.forEach(r => os.put(r)); tx.oncomplete = () => { db.close(); res(1); }; tx.onerror = () => rej(tx.error); };
    rq.onerror = () => rej(rq.error);
  }));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => { const tl = document.getElementById('mmTimeline'); return tl && tl.querySelector('.tl-chip'); }, { timeout: 20000, polling: 150 });
  await sleep(1600);

  const CASES = [
    ['原样', ''],
    ['整排一起压到 8px（chip + 兄弟）', '.tl-chip,.tl-trip{min-height:8px!important}'],
    ['整排一起压到 8px 且去掉行内高（看内容自然高）', '.tl-chip,.tl-trip{min-height:8px!important;font-size:8px;padding:0 4px!important}'],
    ['兄弟压到 8px、chip 不动（看 chip 会不会塌）', '.tl-trip{min-height:8px!important}'],
  ];
  for (const [label, css] of CASES) {
    const r = await page.evaluate(READ, css);
    console.log('=== ' + label + ' ===  align-items=' + r.align);
    r.kids.forEach(k => console.log('   ' + k.tag + '.' + k.cls + '  真实高=' + k.h + '  computed min-height=' + k.minH + '  computed height=' + k.boxH));
  }

  /* 这条整机下限是不是只在「移动端形态」生效？换成非 mobile 的桌面档再压一次，别把话说过头
     （页内那行 min-height 到底还有没有用，取决于这里）。 */
  await page.setViewport({ width: 1280, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await sleep(500);
  console.log('--- 桌面档（isMobile:false）---');
  for (const [label, css] of [['桌面·原样', ''], ['桌面·整排压到 8px', '.tl-chip,.tl-trip{min-height:8px!important;font-size:8px;padding:0 4px!important}']]) {
    const r = await page.evaluate(READ, css);
    console.log('=== ' + label + ' ===  align-items=' + r.align);
    r.kids.forEach(k => console.log('   ' + k.tag + '.' + k.cls + '  真实高=' + k.h + '  computed min-height=' + k.minH + '  computed height=' + k.boxH));
  }
  await browser.close();
  console.log('判读：真实高随注入规则一起塌 → 是 flex 交叉轴 stretch 由同排最高那枚决定（b）；' +
    'computed min-height 恒 44px 而行内 !important 按不动 → 才是 form 控件的整机下限（a）。');
})();
