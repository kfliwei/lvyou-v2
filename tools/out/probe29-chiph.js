/* tools/out/probe29-chiph.js — G02 那条变异打不红，先量清楚「胶囊多高」到底由谁决定
 *
 * 背景：mut-verify44 的 G02 把 .tl-chip 的 min-height 从 44 改成 35，源码腿 0 红（预期，A44 不钉那个数），
 * 但浏览器腿 TM04 也 0 红（意外——TM04 断言的正是 chip 实测高 ≥44）。三种可能：
 *   a) chip 的自然高本来就 ≥44（那 min-height 是根没人靠的拐杖，G02 是几何恒等变异）；
 *   b) 同一 flex 行里的兄弟（.tl-trip 也写 min-height:44）把整行的交叉轴撑到 44，align-items 默认 stretch
 *      让 chip 自己被拉高（那 G02 只改一条腿＝改不到被测量的那个量）；
 *   c) TM04 量的根本不是页内那排 chip（取样错了）。
 * 探针一次跑完三种样式并印出同排里每个直接子元素的 tag/class/h，顺便印 alignItems。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe29-chiph.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SEED = () => {
  const long = ('那天的风很大，木塔的影子在地上拉得很长。' +
    '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。' +
    '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    id: 'tmg' + Math.random().toString(36).slice(2, 8),
    title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', county: '应县',
    lat: 39.5606, lng: 114.0862, photos: [], audio: '', tags: ['古建'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, title: '大同古城' }),
    mk({ ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '第二次上木塔，云层很低。', raw: '第二次上木塔，云层很低。' }),
    mk({ ts: now - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', title: '悬空寺', siteName: '悬空寺', text: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', raw: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。' }),
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

const READ = (css) => {
  let st = document.getElementById('probe29chiph');
  if (!st) { st = document.createElement('style'); st.id = 'probe29chiph'; document.head.appendChild(st); }
  st.textContent = css;
  const tl = document.getElementById('mmTimeline');
  const kids = Array.from(tl.children).map(c => {
    const b = c.getBoundingClientRect();
    return {
      cls: c.className, tag: c.tagName,
      h: Math.round(b.height),
      minH: getComputedStyle(c).minHeight,
      alignSelf: getComputedStyle(c).alignSelf,
      natural: (() => { const o = c.style.minHeight; c.style.minHeight = '0px'; const hh = Math.round(c.getBoundingClientRect().height); c.style.minHeight = o; return hh; })(),
    };
  });
  return { align: getComputedStyle(tl).alignItems, tlH: Math.round(tl.getBoundingClientRect().height), kids };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(2200);

  const CASES = [
    ['原样（chip min-height:44）', ''],
    ['只把 chip 降到 35（G02 的写法）', '.tl-chip{min-height:35px!important}'],
    ['chip 与同排兄弟一起降到 35', '.tl-chip{min-height:35px!important}.tl-trip{min-height:35px!important}'],
    ['chip 降到 0，看它自己的自然高', '.tl-chip{min-height:0!important}'],
  ];
  for (const [label, css] of CASES) {
    const r = await page.evaluate(READ, css);
    console.log('=== ' + label + ' ===  tl align-items=' + r.align + '  tl 高=' + r.tlH);
    r.kids.forEach(k => console.log('   ' + k.tag + '.' + k.cls + '  h=' + k.h + '  minH=' + k.minH + '  alignSelf=' + k.alignSelf + '  把 min-height 压成 0 后=' + k.natural));
  }
  await browser.close();
  console.log('判读：若「只把 chip 降到 35」那一档 h 仍是 44 而 natural < 44，就是 stretch 由同排兄弟撑起来的（b）——' +
    'G02 那条变异改不到被 TM04 测量的那个量，要么改成两条一起降，要么把它降级成登记在册的几何恒等变异。');
})();
