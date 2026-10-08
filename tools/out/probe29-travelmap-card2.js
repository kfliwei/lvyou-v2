/* tools/out/probe29-travelmap-card2.js — 第 2 轮：遮挡量化 + Sheet 真开后的滚动/照片版面
 * 一：statBar 与时间线的重叠像素、chip 中心命中谁、收起 statBar 后能否命中自己
 * 二：Sheet 真开起来后 #msBody 能不能滚、正文末行读不读得到、照片枚与版面尺寸
 * 三：顶栏「游记」列表里逐枚 img 的归属选择器与 0 尺寸根因
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-travelmap-card2.txt');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
function say(s) { log.push(s); console.log(s); }

/* 播种在页内跑：照片用 canvas 现场生成 data URL（Node 侧没有 document） */
/* 播种整段在页内跑：照片要 canvas 现场生成（Node 侧没有 document） */
const SEED_IN_PAGE = () => {
  function pic(seed) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d');
    const lin = g.createLinearGradient(0, 0, 900, 600);
    lin.addColorStop(0, ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]); lin.addColorStop(1, '#20201D');
    g.fillStyle = lin; g.fillRect(0, 0, 900, 600);
    g.fillStyle = '#FAF8F3'; g.font = '90px sans-serif'; g.fillText('P' + seed, 40, 140);
    return c.toDataURL('image/jpeg', 0.82);
  }
  const long = ('那天的风很大，木塔的影子在地上拉得很长。' +
    '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。' +
    '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    id: 'p29b' + Math.random().toString(36).slice(2, 8),
    title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', county: '应县',
    lat: 39.5606, lng: 114.0862, photos: [], audio: '', tags: ['古建'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [pic(1), pic(2)], title: '大同古城' }),
    mk({ ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '第二次上木塔，云层很低。', raw: '第二次上木塔，云层很低。', photos: [pic(3)] }),
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

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 140)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED_IN_PAGE);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 2, { timeout: 20000, polling: 150 });
  await sleep(2000);
  say('=== 视口 ' + VW + 'x' + VH + ' · 播种 2 条 ===');

  /* ---- 一 遮挡 ---- */
  const G = await page.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), left: Math.round(b.left), w: Math.round(b.width) }; };
    const stat = document.getElementById('statBar'), tl = document.getElementById('mmTimeline');
    const chips = Array.from(tl.querySelectorAll('.tl-chip'));
    const probe = c => { const b = c.getBoundingClientRect(); const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2); const hit = document.elementFromPoint(x, y); return { x, y, hit: hit ? (hit.id || hit.className || hit.tagName) : 'null', self: !!hit && (hit === c || c.contains(hit)) }; };
    const nav = document.querySelector('.bottom-nav');
    return {
      stat: r(stat), statZ: getComputedStyle(stat).zIndex,
      tl: r(tl), tlZ: getComputedStyle(tl).zIndex,
      nav: nav ? r(nav) : null, navZ: nav ? getComputedStyle(nav).zIndex : null,
      overlap: Math.round(Math.max(0, Math.min(r(stat).bottom, r(tl).bottom) - Math.max(r(stat).top, r(tl).top))),
      chips: chips.map(c => ({ t: (c.textContent || '').trim(), aria: c.getAttribute('aria-label'), name: (c.querySelector('.tl-name') || {}).textContent || '-', h: Math.round(c.getBoundingClientRect().height), ...r(c), ...probe(c) })),
      tlh: { clip: tl.classList.contains('h-clipped'), cw: Math.round(tl.clientWidth), sw: Math.round(tl.scrollWidth) },
      sheet: (() => { const s = document.getElementById('memSheet'); const b = s.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; })(),
    };
  });
  say('');
  say('=== 一 底部三层几何 ===');
  say('1.1 统计条 #statBar top=' + G.stat.top + ' bottom=' + G.stat.bottom + ' h=' + G.stat.h + ' z=' + G.statZ);
  say('1.2 时间线   top=' + G.tl.top + ' bottom=' + G.tl.bottom + ' h=' + G.tl.h + ' z=' + G.tlZ);
  say('1.3 两者重叠=' + G.overlap + 'px（时间线被压在统计条下面）· 底栏 ' + JSON.stringify(G.nav) + ' z=' + G.navZ);
  G.chips.forEach((c, i) => say('1.' + (4 + i) + ' chip“' + c.t + '” 名=' + c.name + ' aria=' + (c.aria ? '有' : '(无)') + ' 高=' + c.h + 'px top=' + c.top + ' bottom=' + c.bottom + ' 中心(' + c.x + ',' + c.y + ') 命中=' + c.hit + ' 命中自己=' + c.self));

  say('1.' + (4 + G.chips.length) + ' 胶囊排横滚提示 h-clipped=' + G.tlh.clip + '（可见 ' + G.tlh.cw + ' / 内容 ' + G.tlh.sw + '，露不下时要 true）');

  /* 收起统计条 → 再点 chip（对照实验：证明遮挡是唯一拦路的） */
  await page.evaluate(() => document.getElementById('statClose').click());
  await sleep(700);
  const G2 = await page.evaluate(() => {
    const s = document.getElementById('statBar'), o = document.getElementById('statOpen'), tl = document.getElementById('mmTimeline');
    const rr = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    const ro = rr(o), rt = rr(tl);
    /* 收起统计条后时间线会往下落，chip 中心要按新位置重取（否则对照组点的是一张空位） */
    const c = tl.querySelector('.tl-chip'), cb = c.getBoundingClientRect();
    return {
      statDisplay: getComputedStyle(s).display, openDisplay: getComputedStyle(o).display,
      tlTop: rt.top, tlBottom: rt.bottom, openTop: ro.top, openBottom: ro.bottom,
      overlapOpen: Math.round(Math.max(0, Math.min(ro.bottom, rt.bottom) - Math.max(ro.top, rt.top))),
      tmGap: getComputedStyle(tl).getPropertyValue('--tm-gap').trim(),
      chip: { x: Math.round(cb.left + cb.width / 2), y: Math.round(cb.top + cb.height / 2) },
    };
  });
  await page.touchscreen.tap(G2.chip.x, G2.chip.y);
  await sleep(1500);
  const G3 = await page.evaluate(() => ({
    cls: document.getElementById('memSheet').className,
    active: Array.from(document.querySelectorAll('.tl-chip.active')).map(e => (e.textContent || '').trim()),
  }));
  say('');
  say('=== 二 对照：收起统计条后再点同一坐标 ===');
  say('2.1 收起后 #statBar display=' + G2.statDisplay + '，#statOpen display=' + G2.openDisplay + '；--tm-gap=' + G2.tmGap + ' 时间线 ' + G2.tlTop + '..' + G2.tlBottom + ' 圆钮 ' + G2.openTop + '..' + G2.openBottom + ' 重叠=' + G2.overlapOpen + 'px（要 0）');
  say('2.2 点这一下之后 #memSheet class="' + G3.cls + '" 高亮 chip=' + JSON.stringify(G3.active) + '（show=打得开）');

  /* ---- 三 Sheet 打开后的滚动与照片 ---- */
  const S = await page.evaluate(async () => {
    const s = document.getElementById('memSheet'), body = document.getElementById('msBody');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    /* 一次量全套：卡片可见底边在哪儿、正文末行与照片行落在可见区内没有 */
    function snap() {
      const sr = s.getBoundingClientRect(), br = body.getBoundingClientRect();
      const story = body.querySelector('.ms-story');
      const row = body.querySelector('.ms-photos');
      const rr = row ? row.getBoundingClientRect() : null;
      let lastTop = null;
      if (story) { const rg = document.createRange(); rg.selectNodeContents(story); const rc = Array.from(rg.getClientRects()); if (rc.length) lastTop = Math.round(rc[rc.length - 1].top); }
      return {
        sheet: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), h: Math.round(sr.height), maxH: getComputedStyle(s).maxHeight, display: getComputedStyle(s).display },
        body: { top: Math.round(br.top), h: Math.round(br.height), sh: body.scrollHeight, ch: body.clientHeight, scrollTop: body.scrollTop, overflowY: getComputedStyle(body).overflowY },
        clip: s.classList.contains('ms-clip'),
        clipText: getComputedStyle(s, '::after').content,
        story: story ? { chars: (story.textContent || '').length, top: Math.round(story.getBoundingClientRect().top), h: Math.round(story.getBoundingClientRect().height), lastLineTop: lastTop } : null,
        row: rr ? { top: Math.round(rr.top), bottom: Math.round(rr.bottom), h: Math.round(rr.height), clip: row.classList.contains('h-clipped'), cw: Math.round(row.clientWidth), sw: Math.round(row.scrollWidth) } : null,
        pics: Array.from(body.querySelectorAll('.ms-photos img')).map(p => { const b = p.getBoundingClientRect(); return { nat: p.naturalWidth + 'x' + p.naturalHeight, box: Math.round(b.width) + 'x' + Math.round(b.height), disp: getComputedStyle(p).display, loading: p.getAttribute('loading'), complete: p.complete, top: Math.round(b.top) }; }),
      };
    }
    const close = (() => { const e = s.querySelector('.ms-close'); if (!e) return null; const b = e.getBoundingClientRect(); const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2); const h = document.elementFromPoint(cx, cy); return { box: Math.round(b.width) + 'x' + Math.round(b.height), at: [cx, cy], self: !!h && (h === e || e.contains(h)), tag: h ? h.tagName : 'null' }; })();
    const atTop = snap();
    body.scrollTop = 999999;
    await wait(260);            /* scroll 事件是异步的，markClip 要等它跑一次 */
    const atBottom = snap();
    body.scrollTop = 0;
    return { close, atTop, atBottom };
  });
  say('');
  say('=== 三 Memory Sheet 打开后（长正文 + 内嵌照片）===');
  const inView = o => o.row ? (o.row.top >= o.sheet.top && o.row.bottom <= o.sheet.bottom ? '在可见区内' : '在可见区外') : '无照片行';
  say('3.1 Sheet top=' + S.atTop.sheet.top + ' bottom=' + S.atTop.sheet.bottom + ' h=' + S.atTop.sheet.h + ' display=' + S.atTop.sheet.display + ' maxHeight=' + S.atTop.sheet.maxH);
  say('3.2 #msBody 盒高=' + S.atTop.body.h + ' scrollHeight=' + S.atTop.body.sh + ' clientHeight=' + S.atTop.body.ch + ' overflowY=' + S.atTop.body.overflowY + ' 拉到最大后 scrollTop=' + S.atBottom.body.scrollTop);
  say('3.3 正文 ' + (S.atTop.story ? S.atTop.story.chars : '-') + ' 字：top=' + (S.atTop.story ? S.atTop.story.top : '-') + ' 高=' + (S.atTop.story ? S.atTop.story.h : '-') + ' 末行 top=' + (S.atTop.story ? S.atTop.story.lastLineTop : '-'));
  say('3.4 滚到底之后：scrollTop=' + S.atBottom.body.scrollTop + ' 末行 top=' + (S.atBottom.story ? S.atBottom.story.lastLineTop : '-') + '（卡片可见顶=' + S.atBottom.sheet.top + '，末行落在可见区内＝读得到全文）');
  say('3.5 照片行 .ms-photos=' + JSON.stringify(S.atTop.row) + ' → ' + inView(S.atTop) + '（卡片可见底=' + S.atTop.sheet.bottom + '）');
  S.atTop.pics.forEach((p, i) => say('3.' + (6 + i) + ' 图' + (i + 1) + ' 解码=' + p.nat + ' 版面=' + p.box + ' top=' + p.top + ' display=' + p.disp + ' loading=' + p.loading + ' complete=' + p.complete));
  say('3.8 卡内关闭钮=' + JSON.stringify(S.close));
  say('3.9 溢出提示 ms-clip：顶部=' + S.atTop.clip + '(文案 ' + S.atTop.clipText + ') / 滚到底=' + S.atBottom.clip + '（要一真一假）');

  /* ---- 四 顶栏「游记」列表里的 img 归属 ---- */
  await page.evaluate(() => { document.getElementById('memSheet').classList.remove('show'); });
  await sleep(300);
  await page.evaluate(() => TravelNotes.openList());
  await sleep(1500);
  const L = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter(i => /data:image/.test(i.getAttribute('src') || ''));
    const chain = el => { const out = []; let p = el.parentElement; for (let k = 0; k < 5 && p; k++) { out.push(p.className || p.tagName); p = p.parentElement; } return out.join(' < '); };
    return imgs.map(i => { const b = i.getBoundingClientRect(); const cs = getComputedStyle(i); return {
      nat: i.naturalWidth, box: Math.round(b.width) + 'x' + Math.round(b.height), disp: cs.display, w: cs.width, h: cs.height, flexBasis: cs.flexBasis, loading: i.getAttribute('loading'),
      parentCls: (i.parentElement && i.parentElement.className) || '-', chain: chain(i), hidden: !i.isConnected || b.width === 0 || b.height === 0, inScroller: (() => { let p = i.parentElement, f = null; while (p && !f) { const oy = getComputedStyle(p).overflowY; if (oy === 'auto' || oy === 'scroll') f = (p.className || p.tagName); p = p.parentElement; } return f || 'none'; })() }; });
  });
  say('');
  say('=== 四 顶栏「游记」列表里的内嵌照片 ===');
  L.forEach((x, i) => say('4.' + (i + 1) + ' 解码宽=' + x.nat + ' 版面=' + x.box + ' computed ' + x.w + '/' + x.h + ' display=' + x.disp + ' loading=' + x.loading + ' 父=' + x.parentCls + ' 链=' + x.chain + ' 滚动容器=' + x.inScroller));
  const vis = await page.evaluate(() => {
    const box = document.querySelector('.tn-list') || document.querySelector('#tnPanel') || document.body;
    return { cls: box.className, rect: (() => { const b = box.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; })(), cards: box.querySelectorAll('.tn-card, .ncard, [class*=card]').length, text: (box.textContent || '').trim().slice(0, 90) };
  });
  say('4.x 列表容器 ' + vis.cls + ' ' + JSON.stringify(vis.rect) + ' 卡数=' + vis.cards + ' 首段="' + vis.text + '"');

  say('');
  say('=== 页面异常 ' + errs.length + ' 条 ===');
  errs.slice(0, 10).forEach(e => say('  ' + e));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + (e && e.stack || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
