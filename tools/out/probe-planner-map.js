/* tools/out/probe-planner-map.js — 规划结果页地图三症状量化探针（452×995 = 一加 Ace 6T）
 * 症状：1 地图显示不全 / 2 只有节点没有路线 / 3 点节点不出信息
 * 两条路径各测一遍：A 排期直进结果页；B 刷新走 sessionStorage 恢复（planner.js:1963 顺序反了）
 * 用法: node tools/out/probe-planner-map.js > tools/out/b14-probe-planner-map.txt 2>&1
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const URL_ = 'file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/');

function measureInPage() {
  const box = document.getElementById('mapBox');
  if (!box) return { missing: '没有 #mapBox' };
  const br = box.getBoundingClientRect();
  const cont = box.querySelector('.leaflet-container');
  const cr = cont ? cont.getBoundingClientRect() : null;
  const cs = getComputedStyle(box);
  const tiles = Array.from(box.querySelectorAll('.leaflet-tile'));
  const loaded = tiles.filter(t => t.classList.contains('leaflet-tile-loaded'));
  const painted = loaded.filter(t => t.naturalWidth > 0);
  const svg = box.querySelector('.leaflet-overlay-pane svg');
  const paths = Array.from(box.querySelectorAll('.leaflet-overlay-pane path'));
  const vis = r => r.right > br.left + 1 && r.left < br.right - 1 && r.bottom > br.top + 1 && r.top < br.bottom - 1;
  const pathsIn = paths.filter(p => { const r = p.getBoundingClientRect(); return r.width > 1 && r.height > 1 && vis(r); });
  const marks = Array.from(box.querySelectorAll('.leaflet-marker-icon .map-pin'));
  const marksIn = marks.filter(m => vis(m.getBoundingClientRect()));
  let cov = { samples: 0, tileHits: 0, pct: -1 };
  {
    // 底图铺满度：瓦片矩形与容器盒的交集面积 / 容器面积（hit-test 会被 Leaflet 的 pointer-events 骗到，不用）
    const clamped = (v, a, b) => Math.max(a, Math.min(b, v));
    let area = 0;
    loaded.forEach(t => {
      const r = t.getBoundingClientRect();
      const w = clamped(r.right, br.left, br.right) - clamped(r.left, br.left, br.right);
      const h = clamped(r.bottom, br.top, br.bottom) - clamped(r.top, br.top, br.bottom);
      if (w > 0 && h > 0) area += w * h;
    });
    const boxArea = Math.max(1, br.width * br.height);
    cov = { samples: loaded.length, tileHits: 0, pct: +(100 * Math.min(area, boxArea) / boxArea).toFixed(1) };
  }
  return {
    stageDisp: getComputedStyle(document.getElementById('stageResult')).display,
    boxDisp: cs.display,
    boxRect: { y: +br.y.toFixed(1), w: +br.width.toFixed(1), h: +br.height.toFixed(1) },
    contRect: cr ? { w: +cr.width.toFixed(1), h: +cr.height.toFixed(1) } : null,
    paneTransform: (() => { const p = box.querySelector('.leaflet-map-pane'); return p ? p.style.transform : null; })(),
    tiles: { total: tiles.length, loaded: loaded.length, painted: painted.length },
    zoom: (() => { const t = box.querySelector('.leaflet-tile'); const m = /z=(\d+)/.exec((t && t.src) || ''); return m ? +m[1] : null; })(),
    svg: svg ? { attr: svg.getAttribute('width') + 'x' + svg.getAttribute('height'), painted: +svg.getBoundingClientRect().width.toFixed(1) + 'x' + svg.getBoundingClientRect().height.toFixed(1) } : null,
    paths: { total: paths.length, inBox: pathsIn.length, sample: paths.slice(0, 3).map(p => { const c = getComputedStyle(p); const r = p.getBoundingClientRect(); return c.stroke + '/w' + c.strokeWidth + '/o' + c.opacity + '@' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }) },
    markers: { total: marks.length, inBox: marksIn.length },
    coverage: cov,
    tileWarn: !!document.querySelector('.ui-tilewarn')
  };
}

function fmt(tag, m) {
  console.log('== ' + tag);
  if (m.missing) { console.log('  ' + m.missing); return; }
  console.log('  stageResult.display=' + m.stageDisp + ' | #mapBox display=' + m.boxDisp + ' rect y=' + m.boxRect.y + ' ' + m.boxRect.w + '×' + m.boxRect.h + ' | .leaflet-container=' + JSON.stringify(m.contRect));
  console.log('  mapPane transform=' + m.paneTransform + ' | 瓦片 zoom=' + m.zoom);
  console.log('  瓦片 total=' + m.tiles.total + ' loaded类=' + m.tiles.loaded + ' 已解码=' + m.tiles.painted + ' | 视口采样瓦片覆盖率=' + m.coverage.pct + '% (' + m.coverage.tileHits + '/' + m.coverage.samples + ')');
  console.log('  overlay svg=' + JSON.stringify(m.svg) + ' | path 总数=' + m.paths.total + ' 落在框内=' + m.paths.inBox);
  console.log('  path 明细=' + JSON.stringify(m.paths.sample));
  console.log('  针脚=' + m.markers.total + ' 落在框内=' + m.markers.inBox + ' | tileWarn=' + m.tileWarn);
}

async function tapFirstMarker(page) {
  const g = await page.evaluate(() => {
    const m = document.querySelector('#mapBox .leaflet-marker-icon');
    if (!m) return { none: '没有针脚可点' };
    const r = m.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pin: (m.textContent || '').trim() };
  });
  if (g.none) return g;
  await page.mouse.click(g.x, g.y);
  await sleep(800);
  const res = await page.evaluate((cx, cy) => {
    const box = document.getElementById('mapBox').getBoundingClientRect();
    const p = document.querySelector('#mapBox .leaflet-popup');
    if (!p) return { popup: false, point: Math.round(cx) + ',' + Math.round(cy), frontAtPoint: (() => { const e = document.elementFromPoint(cx, cy); return e ? (e.className && String(e.className).slice(0, 40)) || e.tagName : null; })() };
    const r = p.getBoundingClientRect();
    const c = getComputedStyle(p);
    const mid = { x: r.left + r.width / 2, y: Math.max(1, Math.min(window.innerHeight - 2, r.top + r.height / 2)) };
    const front = document.elementFromPoint(mid.x, mid.y);
    return {
      popup: true, text: (p.innerText || '').replace(/\s+/g, ' ').slice(0, 50),
      rect: Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + '×' + Math.round(r.height),
      style: 'op' + c.opacity + '/' + c.visibility + '/' + c.display,
      clipped: (r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.right > box.right + 1),
      hitIsPopup: !!(front && (front === p || p.contains(front))),
      frontTag: front ? ((front.className && String(front.className).slice(0, 40)) || front.tagName) : null
    };
  }, g.x, g.y);
  res.pin = g.pin;
  return res;
}

/* 在页面里拦一次 L.map：拿到 Leaflet 实例 + 记录"建图那一刻容器的真实尺寸"。
   没有这两样，"显示不全"只能靠眼睛判断；有了就能直接比 map.getSize() 与容器 rect。 */
const HOOK = () => {
  let real;
  window.__mapLog = [];
  window.__vtSeen = 0;
  try {
    const origStart = document.startViewTransition && document.startViewTransition.bind(document);
    if (origStart) {
      document.startViewTransition = function (cb) {
        window.__vtSeen++;
        return origStart(function () {
          const r = document.getElementById('stageResult');
          window.__mapLog.push({ ev: 'vt-callback', stageDisp: r ? r.style.display : null, boxW: document.getElementById('mapBox').clientWidth });
          return cb && cb();
        });
      };
    }
  } catch (e) {}
  try {
    Object.defineProperty(window, 'L', {
      configurable: true,
      get() { return real; },
      set(v) {
        try {
          const orig = v.map;
          v.map = function (el, o) {
            const c = typeof el === 'string' ? document.getElementById(el) : el;
            const r = c ? c.getBoundingClientRect() : null;
            const st = document.getElementById('stageResult');
            window.__mapLog.push({
              ev: 'L.map', rect: r ? Math.round(r.width) + '×' + Math.round(r.height) : 'no-el',
              boxDisp: c ? getComputedStyle(c).display : null,
              stageInlineDisp: st ? st.style.display : null,
              stageComputedDisp: st ? getComputedStyle(st).display : null,
              vtSeen: window.__vtSeen
            });
            const m = orig.call(v, el, o);
            window.__plannerMap = m;
            return m;
          };
        } catch (e) {}
        real = v;
      }
    });
  } catch (e) {}
};

function internalState() {
  const m = window.__plannerMap;
  if (!m) return { hooked: false };
  const sz = m.getSize();
  const el = document.getElementById('mapBox');
  const box = el.getBoundingClientRect();
  const bnd = m.getBounds ? m.getBounds() : null;
  const created = (window.__mapLog || []).filter(e => e.ev === 'L.map')[0] || {};
  return {
    hooked: true,
    createdWhen: created.rect,
    stageInlineWhenCreated: created.stageInlineDisp,
    stageComputedWhenCreated: created.stageComputedDisp,
    vtSeenWhenCreated: created.vtSeen,
    mapSize: Math.round(sz.x) + '×' + Math.round(sz.y),
    containerNow: Math.round(box.width) + '×' + Math.round(box.height),
    clientNow: el.clientWidth + '×' + el.clientHeight,
    sizeMatch: Math.round(sz.x) === el.clientWidth && Math.round(sz.y) === el.clientHeight,
    zoom: m.getZoom(),
    center: m.getCenter().wrap().lat.toFixed(4) + ',' + m.getCenter().wrap().lng.toFixed(4),
    bounds: bnd ? [bnd.getNorth().toFixed(3), bnd.getWest().toFixed(3), bnd.getSouth().toFixed(3), bnd.getEast().toFixed(3)].join(',') : null,
    popupOpen: !!m._popup && m._popup.isOpen(),
    layers: (() => { let n = 0; m.eachLayer(function () { n++; }); return n; })()
  };
}

async function planOnce(page) {
  await page.type('#promptInput', '我想去川西玩5天，喜欢自然风光');
  await page.click('#genBtn');
  await sleep(1600);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(180);
  }
  await sleep(400);
  await page.click('#scheduleBtn');
  await sleep(500);
  for (let s = 1; s <= 3; s++) { await page.click('#wNext'); await sleep(400); }
  await page.click('#wDone');
  await sleep(2200);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  /* ---------- 路径 A：排期完成后直进结果页 ---------- */
  const pa = await browser.newPage();
  const errsA = [];
  pa.on('pageerror', e => errsA.push('pageerror: ' + e.message.slice(0, 140)));
  await pa.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await pa.evaluateOnNewDocument(HOOK);
  await pa.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  await planOnce(pa);
  fmt('路径A · 排期直进结果页', await pa.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pa.evaluate(internalState)));
  console.log('  点第一个针脚 → ' + JSON.stringify(await tapFirstMarker(pa)));
  const scrollA = await pa.evaluate(() => ({ sy: Math.round(window.scrollY), sh: document.documentElement.scrollHeight }));
  console.log('  页面滚动 ' + JSON.stringify(scrollA));
  console.log('  建图时序日志 ' + JSON.stringify(await pa.evaluate(() => window.__mapLog)));
  console.log('  环境 ' + JSON.stringify(await pa.evaluate(() => ({
    vt: typeof document.startViewTransition,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    amapKey: !!localStorage.getItem('tn_amap_key')
  }))));
  console.log('  JS 报错: ' + (errsA.length ? errsA.join(' | ') : '无'));
  await pa.screenshot({ path: path.join(__dirname, 'b14-planner-map-A.png') });

  /* ---------- 路径 A2：只补一次 invalidateSize（不重画），看几何能否自愈 ---------- */
  await pa.evaluate(() => { const m = window.__plannerMap; if (m) { m.invalidateSize(); } });
  await sleep(900);
  console.log('== 路径A2 · 事后 invalidateSize（不重画）');
  fmt('路径A2', await pa.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pa.evaluate(internalState)));

  /* ---------- 路径 A3：缩放一次，看瓦片/折线是否回来（判断"仅补尺寸"够不够）---------- */
  await pa.evaluate(() => { const m = window.__plannerMap; if (m) { m.invalidateSize(); m.setZoom(m.getZoom() - 1); } });
  await sleep(1500);
  console.log('== 路径A3 · invalidateSize + 缩放一次');
  fmt('路径A3', await pa.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pa.evaluate(internalState)));
  await pa.screenshot({ path: path.join(__dirname, 'b14-planner-map-A3.png') });

  /* ---------- 路径 B：留在结果页刷新（sessionStorage 恢复）---------- */
  await pa.evaluateOnNewDocument(HOOK);
  await pa.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3500);
  const restored = await pa.evaluate(() => ({
    stage: document.getElementById('stageResult').style.display,
    toast: (document.querySelector('.ui-toast') || {}).textContent || '',
    days: document.querySelectorAll('#resultBody .day-card').length
  }));
  console.log('== 路径B · 刷新恢复  ' + JSON.stringify(restored));
  fmt('路径B · 刷新恢复（planner.js:1963 renderResult 先于 showStage）', await pa.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pa.evaluate(internalState)));
  console.log('  点第一个针脚 → ' + JSON.stringify(await tapFirstMarker(pa)));
  await pa.screenshot({ path: path.join(__dirname, 'b14-planner-map-B.png') });

  /* ---------- 路径 C：从「已保存的行程」进结果页（planner.js:1689，顺序正确）
     行程直接从路径 A/B 的 sessionStorage 快照里取真实形状，不自己编——编出来的缺字段会在
     renderResult 里炸（实测炸在 planner.js:1029 .toFixed），那是探针的 bug 不是产品的。 ---------- */
  const realTrip = await pa.evaluate(() => {
    try { return (JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null') || {}).trip || null; } catch (e) { return null; }
  });
  const pc = await browser.newPage();
  await pc.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await pc.evaluateOnNewDocument(HOOK);
  await pc.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  await pc.evaluate(t => { localStorage.setItem('tn_trips', t); }, JSON.stringify([realTrip]));
  await pc.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const opened = await pc.evaluate(() => { if (typeof window.plannerOpenTrip === 'function') { window.plannerOpenTrip(0); return true; } return false; });
  await sleep(2200);
  console.log('== 路径C · plannerOpenTrip(0) 打开已保存行程（入口命中=' + opened + '，行程形状来自真实快照=' + (!!realTrip && !!realTrip.days) + '）');
  fmt('路径C', await pc.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pc.evaluate(internalState)));
  console.log('  点第一个针脚 → ' + JSON.stringify(await tapFirstMarker(pc)));
  await pc.screenshot({ path: path.join(__dirname, 'b14-planner-map-C.png') });

  /* ---------- 路径 D：减动效档（prefers-reduced-motion: reduce）——UI.vt 退化为同步，
     这条就是"79 态像素基线 + smoke-planner 为什么全绿"的证据：闸门跑的那一档根本不触发本 bug ---------- */
  const pd = await browser.newPage();
  await pd.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await pd.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pd.evaluateOnNewDocument(HOOK);
  await pd.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  await planOnce(pd);
  console.log('== 路径D · 减动效档（UI.vt 同步执行）');
  fmt('路径D', await pd.evaluate(measureInPage));
  console.log('  内部 ' + JSON.stringify(await pd.evaluate(internalState)));
  console.log('  建图时序 ' + JSON.stringify(await pd.evaluate(() => window.__mapLog)));
  console.log('  点第一个针脚 → ' + JSON.stringify(await tapFirstMarker(pd)));
  await pd.screenshot({ path: path.join(__dirname, 'b14-planner-map-D.png') });

  await browser.close();
  console.log('完成');
})().catch(e => { console.log('探针异常: ' + e.message + '\n' + e.stack.slice(0, 500)); process.exit(1); });
