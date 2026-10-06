/* 探针：面板打开后 puppeteer 鼠标点击打不中，究竟是不是 View Transition 没收尾 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.resolve(__dirname, '..', '..', f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(U('index.html'), { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: 'zz-live', name: '进行中趟', startDate: '2026-10-05', logStart: '2026-10-05', realDays: 3, days: [{}, {}, {}] }
    ]));
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(500);
  await p.evaluate(() => TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' }));
  await sleep(600);

  const diag = () => p.evaluate(() => {
    const q = s => document.querySelector(s);
    const el = q('#tnTabExp');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const anims = document.getAnimations().map(a => (a.animationName || a.id || a.constructor.name) + ':' + a.playState);
    return {
      rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      cx: Math.round(cx), cy: Math.round(cy),
      hit: hit ? (hit.tagName + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).split(' ')[0] : '')) : 'null',
      stack: document.elementsFromPoint(cx, cy).map(e => e.tagName + (e.id ? '#' + e.id : '')).slice(0, 5),
      anims: anims.slice(0, 8),
      vt: !!document.startViewTransition,
      panelCls: q('.tn-panel').className,
      visState: document.visibilityState
    };
  });

  console.log('before', JSON.stringify(await diag()));
  await p.evaluate(() => { document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} }); });
  await sleep(200);
  console.log('afterFinish', JSON.stringify(await diag()));
  await p.click('#tnTabExp').catch(e => console.log('clickErr', e.message.split('\n')[0]));
  await sleep(400);
  console.log('afterClick', JSON.stringify(await p.evaluate(() => ({
    cls: document.querySelector('.tn-panel').className,
    exp: getComputedStyle(document.querySelector('.tn-expense')).display
  }))));
  await browser.close();
})();
