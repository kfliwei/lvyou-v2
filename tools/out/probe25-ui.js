/* 批次 25-B 探针：三处在案缺口在 328×723（本机真机 CSS 视口 = ColorOS「显示大小」拉满后的那一屏）
   下的 rect 读数。判据全是几何量，不读源码字符串——改前必红、改后绿才有意义。
   取样腿尽量走真实路径（搜索→结果项→详情卡），因为 .is-btn 的宽度是 flex 分配的结果，
   只有在真实 DOM 里才作数。
   用法：node tools/out/probe25-ui.js [改后复跑同名] */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 一个元素里的文字被排成几行：Range 的 client rects 按 top 聚类。
   断字（「语音记／录」）在界面上不产生溢出，只产生第二行——所以必须数行，不能只比 scrollWidth。 */
const LINES = `function __lines(el){
  const r = document.createRange(); r.selectNodeContents(el);
  const rects = Array.from(r.getClientRects()).filter(x => x.width > 0 && x.height > 0);
  const tops = [];
  rects.forEach(x => { if (!tops.some(t => Math.abs(t - x.top) < 4)) tops.push(x.top); });
  return tops.length;
}`;

const ROW = `function __row(sel){
  const row = document.querySelector(sel); if (!row) return null;
  const rr = row.getBoundingClientRect();
  return { sel: sel, w: Math.round(rr.width), kids: Array.from(row.children).map(n => {
    const r = n.getBoundingClientRect();
    return { cls: (n.className || n.tagName) + '', tag: n.tagName.toLowerCase(),
      txt: (n.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 18),
      w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(r.right), lines: __lines(n) };
  }) };
}`;

const TITLE = `function __title(){
  const t = document.querySelector('.t-row .title'); if (!t) return null;
  const cs = getComputedStyle(t);
  const sm = document.getElementById('statLabel');
  /* 顶栏整条高度：动作组换到第二行是要付垂直空间的，不量就不知道付了多少（723 高的屏上按 % 算） */
  const bar = t.closest('.topbar') || t.closest('.nm-topbar') || t.closest('.story-bar');
  return { text: t.textContent.trim().replace(/\\s+/g, ' '),
    clientW: t.clientWidth, scrollW: t.scrollWidth,
    truncated: t.scrollWidth > t.clientWidth + 1,
    fontSize: cs.fontSize, ellipsis: cs.textOverflow,
    barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    docScrollW: document.documentElement.scrollWidth,
    small: sm ? { text: sm.textContent.trim(), w: Math.round(sm.getBoundingClientRect().width) } : null,
    vw: window.innerWidth };
}`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const errs = [];
  const vp = { width: 328, height: 723, deviceScaleFactor: 1 };

  /* ---------- A. 所有顶栏标题宿主：谁在 328 被省略号切了 ---------- */
  const TITLES = ['travel-map.html', 'expense.html', 'trip.html', 'checklist.html', 'md-manager.html',
    'me.html', 'node-manager.html', 'planner.html', 'settings.html', 'wishlist.html',
    'explore-map.html', 'review.html', 'story.html', 'index.html'];
  for (const f of TITLES) {
    const pt = await browser.newPage();
    await pt.setViewport(vp);
    pt.on('pageerror', e => errs.push(f + ': ' + e.message.slice(0, 80)));
    await pt.goto('file:///' + ROOT + f, { waitUntil: 'load', timeout: 40000 });
    await sleep(2400);
    const t = await pt.evaluate(TITLE + '__title()');
    const r = await pt.evaluate(LINES + ROW + '__row(".t-row")');
    const acts = await pt.evaluate(LINES + ROW + '__row(".trow-acts")');
    /* 行几何常打（批次 25-B 起）：改前那一版只在 truncated 时才打 row，
       于是「按钮整组换行没换行」「≤360 退成纯图标圆钮」这两件事没有读数可对。 */
    if (r) console.log('A ' + f + ' row: ' + JSON.stringify(r));
    if (acts) console.log('A ' + f + ' acts: ' + JSON.stringify(acts));
    if (t) console.log('A ' + f + ' title: ' + JSON.stringify(t));
    await pt.close();
  }
  const pa = await browser.newPage();
  await pa.setViewport(vp);
  await pa.goto('file:///' + ROOT + 'travel-map.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2600);
  console.log('A3 travel-map 横向溢出: ' + JSON.stringify(await pa.evaluate(() => {
    const out = [];
    document.querySelectorAll('.topbar *').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width && (r.right > window.innerWidth + 1 || r.left < -1)) {
        out.push((n.className || n.tagName) + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      }
    });
    return { docScrollW: document.documentElement.scrollWidth, off: out.slice(0, 6) };
  })));
  await pa.close();

  /* ---------- B. node-manager.html 详情卡四枚 .is-btn ---------- */
  const pb = await browser.newPage();
  await pb.setViewport(vp);
  pb.on('pageerror', e => errs.push('node-manager: ' + e.message.slice(0, 80)));
  await pb.goto('file:///' + ROOT + 'node-manager.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2600);
  console.log('B1 nm-topbar: ' + JSON.stringify(await pb.evaluate(LINES + ROW + '__row(".nm-topbar")')));
  await pb.evaluate(() => { const q = document.getElementById('q'); q.value = '故宫'; });
  await pb.click('#qGo');
  await sleep(1400);
  await pb.evaluate(() => { const it = document.querySelector('#rsBody .rs-item[data-k="local"]'); if (it) it.click(); });
  await sleep(1000);
  console.log('B2 infoSheet is-acts: ' + JSON.stringify(await pb.evaluate(LINES + ROW + '__row("#infoSheet .is-acts")')));
  console.log('B3 infoSheet 容器宽: ' + JSON.stringify(await pb.evaluate(() => {
    const s = document.getElementById('infoSheet').getBoundingClientRect();
    const cs = getComputedStyle(document.getElementById('infoSheet'));
    return { sheetW: Math.round(s.width), padL: cs.paddingLeft, padR: cs.paddingRight,
      display: getComputedStyle(document.querySelector('#infoSheet .is-acts')).display,
      flexWrap: document.querySelector('#infoSheet .is-acts').style.flexWrap };
  })));
  await pb.screenshot({ path: ROOT + 'tools/out/b25-infoSheet-328.png' });
  await pb.close();

  /* ---------- C. wishlist.html 移除钮（破坏性） ---------- */
  const pc = await browser.newPage();
  await pc.setViewport(vp);
  pc.on('pageerror', e => errs.push('wishlist: ' + e.message.slice(0, 80)));
  await pc.evaluateOnNewDocument(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '鹳雀楼|40.5|110.2', label: '鹳雀楼', theme: '古城', region: '山西', city: '运城', lat: 40.5, lng: 110.2, ts: 1, visited: 0 },
      { id: '平遥古城|37.2|112.18', label: '平遥古城', theme: '古城', region: '山西', city: '晋中', lat: 37.2, lng: 112.18, ts: 2, visited: 0 }]));
    localStorage.setItem('tn_onboarded', '1');
  });
  await pc.goto('file:///' + ROOT + 'wishlist.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2600);
  console.log('C1 wl-remove: ' + JSON.stringify(await pc.evaluate(() => {
    const b = document.querySelector('.wl-remove');
    if (!b) return 'no-item';
    const r = b.getBoundingClientRect();
    const row = b.parentElement.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), rowW: Math.round(row.width),
      aria: b.getAttribute('aria-label') };
  })));
  console.log('C2 wl 条目行: ' + JSON.stringify(await pc.evaluate(LINES + ROW + '__row(".wl-item")')));
  await pc.close();

  /* ---------- D. search.html 麦克风 + topic.html tripbar 移动/移除 ---------- */
  const pd = await browser.newPage();
  await pd.setViewport(vp);
  pd.on('pageerror', e => errs.push('search: ' + e.message.slice(0, 80)));
  await pd.goto('file:///' + ROOT + 'search.html', { waitUntil: 'load', timeout: 40000 });
  await sleep(2200);
  console.log('D1 search mic: ' + JSON.stringify(await pd.evaluate(() => {
    const b = document.querySelector('.sbar .mic'); if (!b) return 'no-mic';
    const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) };
  })));
  console.log('D2 search sbar: ' + JSON.stringify(await pd.evaluate(LINES + ROW + '__row(".sbar")')));
  await pd.close();

  const pe = await browser.newPage();
  await pe.setViewport(vp);
  pe.on('pageerror', e => errs.push('topic: ' + e.message.slice(0, 80)));
  await pe.goto('file:///' + ROOT + 'topic.html?theme=古城', { waitUntil: 'load', timeout: 40000 });
  await sleep(3200);
  console.log('E1 tripbar mv/x（把真实类名的探针塞进 #tripRow，吃的是同一套级联）: ' + JSON.stringify(await pe.evaluate(() => {
    const row = document.getElementById('tripRow'); if (!row) return 'no-row';
    const mk = (cls, ch) => { const b = document.createElement('button'); b.className = cls; b.textContent = ch; row.appendChild(b); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { cls: cls, w: Math.round(r.width), h: Math.round(r.height), minW: cs.minWidth, minH: cs.minHeight }; };
    const out = [mk('mv', '↑'), mk('x', '×')];
    row.innerHTML = '';
    return { barDisplay: getComputedStyle(document.getElementById('tripBar')).display, probe: out };
  })));
  await pe.close();

  console.log(errs.length ? '页面报错: ' + errs.join(' | ') : '页面报错: 无');
  await browser.close();
})();
