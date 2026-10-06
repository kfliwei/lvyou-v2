/* 批次 23-C 探针：UI.sheet 单点补的右上角关闭 X，在两枚「此前没有任何关闭控件」的弹层上长什么样。
   #locSheet（topic.html，TopicEngine.openSheet 直接开）与 #infoSheet（node-manager.html，
   走本地搜索 → 结果项 → openSysInfo 这条真实腿）。
   同轮反证：自带关闭控件的四枚（rsSheet/memSheet/nearSheet/arriveDlg）声明了 data-sheet-x="off"，
   不许再叠第二枚 X。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const X = (sel) => {
  const el = document.querySelector(sel), x = el.querySelector(':scope > .ui-sheet-x');
  const off = el.getAttribute('data-sheet-x');
  const own = el.querySelectorAll('.x, .nx, .ms-close, .pclose').length;
  if (!x) return { sel: sel, has: false, off: off, own: own,
    n: el.querySelectorAll('.ui-sheet-x').length };
  const r = x.getBoundingClientRect(), er = el.getBoundingClientRect();
  const cs = getComputedStyle(x);
  const first = el.firstElementChild === x;
  /* 重叠判定只认真会挡字的：与 X 同一条水平带里的块级元素 */
  const hits = [];
  el.querySelectorAll('*').forEach(n => {
    if (n === x || n.contains(x) || x.contains(n)) return;
    const nr = n.getBoundingClientRect();
    if (!nr.width || !nr.height) return;
    if (nr.bottom <= r.top + 1 || nr.top >= r.bottom - 1) return;
    if (nr.right <= r.left + 1 || nr.left >= r.right - 1) return;
    hits.push((n.id ? '#' + n.id : n.tagName.toLowerCase() + '.' + String(n.className || '').split(' ')[0]) +
      Math.round(nr.width) + 'x' + Math.round(nr.height));
  });
  return { sel: sel, has: true, off: off, own: own, first: first,
    w: Math.round(r.width), h: Math.round(r.height),
    rightGap: Math.round(er.right - r.right), topGap: Math.round(r.top - er.top),
    float: cs.cssFloat, bg: cs.backgroundColor, label: x.getAttribute('aria-label'),
    hits: hits.slice(0, 4) };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 90)));

  /* --- 1. topic.html #locSheet --- */
  await page.goto('file:///' + ROOT + 'topic.html?theme=古城', { waitUntil: 'load', timeout: 40000 });
  await sleep(3200);
  const opened = await page.evaluate(() => {
    if (!window.TopicEngine || !TopicEngine.openSheet) return 'no-api';
    TopicEngine.openSheet(0); return 'ok';
  });
  await sleep(900);
  console.log('locSheet 开启方式: ' + opened);
  console.log(JSON.stringify(await page.evaluate(X, '#locSheet')));
  await page.screenshot({ path: ROOT + 'tools/out/b23-sheet-loc.png' });
  /* 关掉再开另一枚：X 只应有一枚，且不随开关累积 */
  await page.evaluate(() => TopicEngine.closeSheet());
  await sleep(300);
  await page.evaluate(() => TopicEngine.openSheet(1));
  await sleep(700);
  console.log('二次开启后 X 数: ' + await page.evaluate(() => document.querySelectorAll('#locSheet .ui-sheet-x').length));
  /* 点 X 真的关得掉 */
  await page.evaluate(() => { const x = document.querySelector('#locSheet .ui-sheet-x'); if (x) x.click(); });
  await sleep(400);
  console.log('点 X 后 isOpen: ' + await page.evaluate(() => document.getElementById('locSheet').classList.contains('show')));

  /* --- 2. node-manager.html #infoSheet --- */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 328, height: 723, deviceScaleFactor: 1 });
  p2.on('pageerror', e => errs.push('nm pageerror: ' + e.message.slice(0, 90)));
  await p2.goto('file:///' + ROOT + 'node-manager.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2600);
  await p2.evaluate(() => { const q = document.getElementById('q'); q.value = '故宫'; });
  await p2.click('#qGo');
  await sleep(1200);
  const rs = await p2.evaluate(() => {
    const it = document.querySelector('#rsBody .rs-item[data-k="local"]');
    const n = document.querySelectorAll('#rsBody .rs-item').length;
    if (it) it.click();
    return { items: n, clicked: !!it };
  });
  console.log('rsSheet 结果: ' + JSON.stringify(rs));
  await sleep(900);
  console.log(JSON.stringify(await p2.evaluate(X, '#infoSheet')));
  console.log('rsSheet 自带控件反证: ' + JSON.stringify(await p2.evaluate(X, '#rsSheet')));
  await p2.screenshot({ path: ROOT + 'tools/out/b23-sheet-info.png' });

  /* --- 3. travel-map.html #memSheet（自带 .ms-close，不许叠 X） --- */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 328, height: 723, deviceScaleFactor: 1 });
  p3.on('pageerror', e => errs.push('tm pageerror: ' + e.message.slice(0, 90)));
  await p3.goto('file:///' + ROOT + 'travel-map.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2600);
  console.log('memSheet 反证: ' + JSON.stringify(await p3.evaluate(() => {
    const el = document.getElementById('memSheet');
    return { off: el.getAttribute('data-sheet-x'), own: el.querySelectorAll('.ms-close').length };
  })));

  console.log(errs.length ? '页面报错: ' + errs.join(' | ') : '页面报错: 无');
  await browser.close();
})();
