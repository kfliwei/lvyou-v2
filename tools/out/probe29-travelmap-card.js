/* tools/out/probe29-travelmap-card.js — 真机档 328×723 复现「足迹页下方记录点不开 / 文字看不全 / 照片不显示」
 * 只读探针：播种 3 条游记（长正文 + 内嵌照片 + 同地点聚合），逐条按真实触摸点位走，读几何与图片解码状态。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-travelmap-card.txt');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
function say(s) { log.push(s); console.log(s); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + String(m.text()).slice(0, 120)); });
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  /* 播种：长正文 + 两枚内嵌照片 + 同地点两条（聚合） */
  const rows = await page.evaluate(() => {
    function pic(seed) {
      const c = document.createElement('canvas'); c.width = 900; c.height = 600;
      const g = c.getContext('2d');
      const lin = g.createLinearGradient(0, 0, 900, 600);
      lin.addColorStop(0, ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]); lin.addColorStop(1, '#20201D');
      g.fillStyle = lin; g.fillRect(0, 0, 900, 600);
      g.fillStyle = '#FAF8F3'; g.font = '90px sans-serif'; g.fillText('P' + seed, 40, 140);
      return c.toDataURL('image/jpeg', 0.82);
    }
    const long = ('那天的风很大，木塔的影子在地上拉得很长。'+
      '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。'+
      '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。'+
      '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
    const now = Date.now();
    const mk = (o) => Object.assign({
      id: 'p29' + Math.random().toString(36).slice(2, 8),
      title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', county: '应县',
      lat: 39.5606, lng: 114.0862, photos: [], audio: '', tags: ['古建'], weather: '晴 18℃', style: 'ink',
    }, o);
    const list = [
      mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [pic(1), pic(2)], title: '大同古城' }),
      mk({ ts: now - 3 * 3600e3, date: '2026-10-02 12:00', day: '2026-10-02', text: '悬空寺很险，栈道只容一人。', raw: '悬空寺很险，栈道只容一人。', lat: 39.6630, lng: 113.6940, title: '悬空寺' }),
      mk({ ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '第二次上木塔，云层很低。', raw: '第二次上木塔，云层很低。', title: '应县木塔', photos: [pic(3)] }),
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
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(n => window.TravelNotes && TravelNotes.list().length === n, { timeout: 20000, polling: 150 }, rows);
  await sleep(2200);

  say('=== 播种 ' + rows + ' 条 · 视口 ' + VW + 'x' + VH + ' ===');

  /* ---- A. 时间线 chips 的几何与可达 ---- */
  const A = await page.evaluate(() => {
    const tl = document.getElementById('mmTimeline');
    const r = tl.getBoundingClientRect();
    const kids = Array.from(tl.children).map(el => {
      const b = el.getBoundingClientRect();
      const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2);
      const hit = document.elementFromPoint(cx, cy);
      return {
        cls: el.className, tag: el.tagName, text: (el.textContent || '').trim(),
        w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top),
        aria: el.getAttribute('aria-label'),
        hitSelf: !!hit && (hit === el || el.contains(hit)), hitCls: hit ? (hit.className || hit.tagName) : 'null',
      };
    });
    return { tlRect: { top: Math.round(r.top), h: Math.round(r.height), left: Math.round(r.left), w: Math.round(r.width) }, kids };
  });
  say('A 时间线容器 top=' + A.tlRect.top + ' h=' + A.tlRect.h + ' w=' + A.tlRect.w);
  A.kids.forEach((k, i) => say('  A' + (i + 1) + ' ' + k.cls + ' “' + k.text + '” ' + k.w + 'x' + k.h + ' top=' + k.top + ' 命中自己=' + k.hitSelf + ' 命中于=' + String(k.hitCls) + ' aria=' + (k.aria || '(无)')));

  /* ---- B. 真点：触摸点位落在 chip 中心，读 Sheet 状态 ---- */
  const chipIdx = A.kids.findIndex(k => k.cls.indexOf('tl-chip') >= 0);
  const chipBox = await page.evaluate(i => {
    const el = document.getElementById('mmTimeline').children[i];
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  }, chipIdx);
  await page.touchscreen.tap(chipBox.x, chipBox.y);
  await sleep(1600);
  const B = await page.evaluate(() => {
    const s = document.getElementById('memSheet'), body = document.getElementById('msBody');
    const cs = getComputedStyle(s), bs = getComputedStyle(body);
    const sr = s.getBoundingClientRect(), br = body.getBoundingClientRect();
    const story = body.querySelector('.ms-story');
    const pics = Array.from(body.querySelectorAll('.ms-photos img'));
    const fb = Array.from(body.querySelectorAll('.img-fallback'));
    const cxs = Math.round(sr.left + sr.width / 2), cys = Math.round(sr.top + sr.height / 2);
    const hit = document.elementFromPoint(cxs, cys);
    return {
      cls: s.className, display: cs.display, maxH: cs.maxHeight, overflow: cs.overflow,
      sheetRect: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), left: Math.round(sr.left), w: Math.round(sr.width), h: Math.round(sr.height) },
      vh: window.innerHeight, dvh: CSS.supports('height', '100dvh'),
      bodyRect: { top: Math.round(br.top), h: Math.round(br.height) },
      bodyScroll: { sh: body.scrollHeight, ch: body.clientHeight, overflowY: bs.overflowY, flex: bs.flex, minH: bs.minHeight },
      canScroll: (() => { body.scrollTop = 99999; const got = body.scrollTop; body.scrollTop = 0; return got; })(),
      story: story ? { text: (story.textContent || '').length, rectH: Math.round(story.getBoundingClientRect().height), scrollH: story.scrollHeight, clipped: getComputedStyle(story).webkitLineClamp } : null,
      lastLineVisible: story ? (() => {
        const rg = document.createRange(); rg.selectNodeContents(story);
        const rects = Array.from(rg.getClientRects()); const last = rects[rects.length - 1];
        const b2 = body.getBoundingClientRect();
        return last ? { lineTop: Math.round(last.top), bodyBottom: Math.round(b2.bottom), inView: last.top <= b2.bottom } : 'no-rect';
      })() : null,
      pics: pics.map(p => ({ complete: p.complete, nw: p.naturalWidth, nh: p.naturalHeight, cw: Math.round(p.getBoundingClientRect().width), chH: Math.round(p.getBoundingClientRect().height), srcHead: String(p.getAttribute('src') || '').slice(0, 28), len: String(p.getAttribute('src') || '').length, cur: String(p.currentSrc || '').slice(0, 18) })),
      fallbacks: fb.length,
      hitAtSheetCenter: hit ? (hit.id || hit.className || hit.tagName) : 'null',
      chipsActive: Array.from(document.querySelectorAll('.tl-chip.active')).map(e => (e.textContent || '').trim()),
    };
  });
  say('');
  say('=== B 点了单条记录之后 ===');
  say('B1 #memSheet class="' + B.cls + '" computed display=' + B.display + '（.show 规则要 display:flex）');
  say('B2 Sheet 矩形 top=' + B.sheetRect.top + ' bottom=' + B.sheetRect.bottom + ' h=' + B.sheetRect.h + ' w=' + B.sheetRect.w + ' 视口高=' + B.vh + ' maxHeight=' + B.maxH);
  say('B3 Sheet 中心命中=' + B.hitAtSheetCenter + ' · 高亮的 chip=' + JSON.stringify(B.chipsActive));
  say('B4 #msBody 矩形高=' + B.bodyRect.h + ' scrollHeight=' + B.bodyScroll.sh + ' clientHeight=' + B.bodyScroll.ch + ' overflowY=' + B.bodyScroll.overflowY + ' flex=' + B.bodyScroll.flex + ' minH=' + B.bodyScroll.minH + ' 实滚到的 scrollTop=' + B.canScroll);
  say('B5 正文长度=' + (B.story ? B.story.text : '-') + ' 显示高=' + (B.story ? B.story.rectH : '-') + ' 需要高=' + (B.story ? B.story.scrollH : '-') + ' lineClamp=' + (B.story ? B.story.clipped : '-'));
  say('B6 正文末行位置=' + JSON.stringify(B.lastLineVisible) + '（inView=false 表示尾部读不到）');
  say('B7 照片枚数=' + B.pics.length + ' 占位替换数=' + B.fallbacks);
  B.pics.forEach((p, i) => say('  图' + (i + 1) + ' complete=' + p.complete + ' natural=' + p.nw + 'x' + p.nh + ' 版面=' + p.cw + 'x' + p.chH + ' src 头=' + p.srcHead + ' src 长=' + p.len));

  /* ---- C. 聚合节点：同地点两条 → 列表 → 单篇 ---- */
  await page.evaluate(() => { const s = document.getElementById('memSheet'); s.classList.remove('show'); });
  await sleep(400);
  const C0 = await page.evaluate(() => {
    const ms = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    const g = ms.find(m => /段记忆/.test(m.getAttribute('aria-label') || ''));
    return { total: ms.length, agg: g ? (g.getAttribute('aria-label') || '') : null, hasAgg: !!g };
  });
  say('');
  say('=== C 地图节点 ===');
  say('C0 标记枚数=' + C0.total + ' 聚合标记="' + C0.agg + '"');
  if (C0.hasAgg) {
    await page.evaluate(() => {
      const g = Array.from(document.querySelectorAll('.leaflet-marker-icon')).find(m => /段记忆/.test(m.getAttribute('aria-label') || ''));
      g.click();
    });
    await sleep(1200);
    const C1 = await page.evaluate(() => {
      const s = document.getElementById('memSheet'), body = document.getElementById('msBody');
      const items = Array.from(body.querySelectorAll('.ms-item'));
      return { cls: s.className, head: (body.querySelector('.ms-time') || {}).textContent, n: items.length, texts: items.map(i => (i.textContent || '').trim().slice(0, 30)) };
    });
    say('C1 聚合列表 class="' + C1.cls + '" 说明="' + String(C1.head).trim() + '" 行数=' + C1.n);
    C1.texts.forEach((t, i) => say('  行' + (i + 1) + ' ' + t));
    if (C1.n) {
      const box = await page.evaluate(i => {
        const el = document.querySelectorAll('#msBody .ms-item')[i];
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) };
      }, 0);
      say('C2 行几何 ' + box.w + 'x' + box.h + '（<44px 高即触控不达标）');
      await page.touchscreen.tap(box.x, box.y);
      await sleep(1200);
      const C3 = await page.evaluate(() => {
        const body = document.getElementById('msBody');
        return {
          place: (body.querySelector('.ms-place') || {}).textContent,
          story: (body.querySelector('.ms-story') || {}).textContent,
          pics: body.querySelectorAll('.ms-photos img').length,
          picOk: Array.from(body.querySelectorAll('.ms-photos img')).map(p => p.naturalWidth),
        };
      });
      say('C3 点行后进单篇：地点="' + String(C3.place).trim() + '" 正文="' + String(C3.story).trim().slice(0, 24) + '…" 照片=' + C3.pics + ' 解码宽=' + JSON.stringify(C3.picOk));
    }
  }

  /* ---- D. 顶栏「游记」列表入口对照 ---- */
  await page.evaluate(() => { document.getElementById('memSheet').classList.remove('show'); });
  await sleep(300);
  const D = await page.evaluate(() => {
    try { TravelNotes.openList(); } catch (e) { return { err: String(e).slice(0, 80) }; }
    return { err: null };
  });
  await sleep(1200);
  const D1 = await page.evaluate(() => {
    const box = document.querySelector('.tn-list, #tnList, .tn-overlay');
    const imgs = Array.from(document.querySelectorAll('img')).filter(i => /data:image/.test(i.getAttribute('src') || ''));
    return {
      listOpen: !!box, listCls: box ? box.className : null,
      noteCards: document.querySelectorAll('.tn-card, .tn-note, .ncard').length,
      dataImgs: imgs.length,
      dataImgOk: imgs.map(i => ({ nw: i.naturalWidth, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })),
    };
  });
  say('');
  say('=== D 顶栏「游记」列表对照 ===');
  say('D1 openList err=' + (D && D.err) + ' 列表容器=' + D1.listCls + ' 卡数=' + D1.noteCards + ' 内嵌图枚数=' + D1.dataImgs);
  D1.dataImgOk.slice(0, 6).forEach((x, i) => say('  D图' + (i + 1) + ' natural宽=' + x.nw + ' 版面=' + x.w + 'x' + x.h));

  say('');
  say('=== 页面异常 ' + errs.length + ' 条 ===');
  errs.slice(0, 12).forEach(e => say('  ' + e));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})().catch(e => { say('FATAL ' + (e && e.stack || e)); fs.writeFileSync(OUT, log.join('\n') + '\n'); process.exit(1); });
