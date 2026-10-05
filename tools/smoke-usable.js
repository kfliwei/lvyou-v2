/* tools/smoke-usable.js — 批次 13「地图可用视口」行为闸门
 *
 * 用户报的：34 个省专题页上，节点和合集胶囊在放大后跑到屏幕外、散在地图边缘，要一个个找。
 * 基线实测（tools/out/b13-edge-before-452.txt / b13-edge-attribution-452.txt，34 页 × 4 档）：
 *   4134 枚标记里 834 枚（20.2%）视觉盒越出可用区/屏幕或被浮层盖住；
 *   纯几何越界 555 枚（13.4%），逐档 5.0% → 11.2% → 11.3% → 27.8%（连点三次放大）；
 *   越界形态：init/z+1 以右溢为主（43→78 枚，中位 26→60px），z+2/z+3 以下溢为主（71→223 枚，
 *   中位 43→108px）；390×844 同口径 3990 枚里 25.7% 越界。
 *
 * 这里钉的是四条口径，不是一个数：
 *   ① 合集胶囊以地理锚点为中心（改前 clusterIcon 用 iconSize[0,0]+iconAnchor[0,0] 且 CSS 无
 *      居中 transform → 158px 宽的胶囊从锚点向右下悬出，右缘能捅到 551px，屏只有 452px）；
 *   ② 首屏 / 放大 / 点聚合聚焦后，所有渲染出的标记视觉盒必须完整落在「可用区」内
 *      （可用区＝#mapEl 矩形扣掉压在它上面成带的固定浮层：顶部路线横幅 / 底部统计卡 + tabbar；
 *      452×995 档实测底带 155px = 元素高 18%）；
 *   ③ +/− 缩放以可用区中心为锚（改前 map.zoomIn() 锚在元素几何中心，比可用区中心低 53px，
 *      连按三次就把整幅地图推进底部死带）；
 *   ④ 产品自报的内缩必须等于闸门在页面上独立量到的内缩——否则「全在可用区内」这句话的分母
 *      是产品自己声明的，改成 0 就绿灯了。
 *   边缘内收（clampCapsules）单独判：只在盒子真会出可用区时才挪，且挪动量 ≤ 半盒；
 *   锚点离边界还有一整个半盒时，盒中心必须严丝合缝等于锚点（防止「一律往中间挤」蒙过 ②）。
 *
 * 取样口径（批次 12 的教训）：一律 poll 到「连续两轮盒子逐枚相等且无在跑动画」再断言，
 * 不许 setTimeout(400) 拍中间态。
 *
 * NODE_PATH 需指到 tools/node_modules。用法：
 *   NODE_PATH=…/tools/node_modules node tools/smoke-usable.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8168', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const results = [];
let failures = 0;
function check(name, pass, detail) {
  results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  if (!pass) failures++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  [' + detail + ']'));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

/* ---------- 浏览器侧探针 ----------
   闸门自己独立量一遍内缩（不读产品函数），再和产品报的对账：两边都错才会漏，
   但「产品把 .tabbar 漏了」「产品量到 0」这类单侧退化一定对不上。 */
const PROBE = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const BANDS = ['.routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];
  let t = 0, r = 0, b = 0, l = 0;
  const hits = [];
  BANDS.forEach(function (sel) {
    [].slice.call(document.querySelectorAll(sel)).forEach(function (n) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      const rr = n.getBoundingClientRect();
      const ix = Math.max(0, Math.min(rr.right, mr.right) - Math.max(rr.left, mr.left));
      const iy = Math.max(0, Math.min(rr.bottom, mr.bottom) - Math.max(rr.top, mr.top));
      if (ix < 12 || iy < 12) return;
      hits.push(sel);
      if (ix / mr.width >= 0.6) {
        if ((rr.top + rr.bottom) / 2 < mr.top + mr.height / 2) t = Math.max(t, rr.bottom - mr.top);
        else b = Math.max(b, mr.bottom - rr.top);
      } else if (iy / mr.height >= 0.6) {
        if ((rr.left + rr.right) / 2 > mr.left + mr.width / 2) r = Math.max(r, mr.right - rr.left);
        else l = Math.max(l, rr.right - mr.left);
      }
    });
  });
  t = Math.max(0, Math.min(t, mr.height - 40)); b = Math.max(0, Math.min(b, mr.height - 40));
  l = Math.max(0, Math.min(l, mr.width - 40)); r = Math.max(0, Math.min(r, mr.width - 40));
  const arr = o => o ? [o.top, o.right, o.bottom, o.left] : null;
  const TE = window.TopicEngine;
  const marks = [];
  /* 与普查探针同一枚举口径：认 .leaflet-marker-icon 容器（节点/胶囊/自建点都在这层） */
  [].slice.call(document.querySelectorAll('#mapEl .leaflet-marker-icon')).forEach(function (cont) {
    const cap = cont.querySelector('.lod-cl');
    const cr = cont.getBoundingClientRect();
    let rr;
    if (cap) rr = cap.getBoundingClientRect();
    else { const inner = cont.firstElementChild ? cont.firstElementChild.getBoundingClientRect() : cr; rr = (inner.height < 4 && cr.height >= 4) ? cr : inner; }
    if (!rr.width && !rr.height) return;
    marks.push({
      k: cap ? 'cl' : 'nd',
      t: (cont.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 14),
      box: [rr.left, rr.top, rr.right, rr.bottom],
      /* 容器盒中心＝地理锚点（胶囊容器 0×0，其中心就是 iconAnchor 吃掉偏移后的那个点） */
      anch: [cr.left + cr.width / 2, cr.top + cr.height / 2],
      dx: parseFloat((cap || cont).style.getPropertyValue('--lod-dx')) || 0,
      dy: parseFloat((cap || cont).style.getPropertyValue('--lod-dy')) || 0
    });
  });
  return {
    vp: [innerWidth, innerHeight], el: [mr.left, mr.top, mr.width, mr.height],
    gate: [t, r, b, l], prod: TE && TE.usableInsets ? arr(TE.usableInsets()) : null,
    prodC: TE && TE.contentInsets ? arr(TE.contentInsets()) : null,
    clampFn: !!(TE && TE.usableInsets), bands: hits,
    zoom: TE && TE._map ? TE._map.getZoom() : null, marks: marks
  };
})()`;

/* 等 LOD 重渲染与飞行动画都停：连续两轮「全部盒子逐枚相等」才算稳 */
const BOXES = '(() => [].slice.call(document.querySelectorAll("#mapEl .leaflet-marker-icon")).map(e => { const q = e.getBoundingClientRect(); const c = e.querySelector(".lod-cl"); const s = c ? c.getBoundingClientRect() : q; return [e.textContent.slice(0,10), Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)].join("|"); }).join(";"))()';
const MOVING = '(() => [].slice.call(document.querySelectorAll("#mapEl .leaflet-marker-icon")).filter(e => e.getAnimations && e.getAnimations().some(a => a.playState === "running")).length)()';
async function settle(page, maxMs) {
  let prev = null, same = 0, waited = 0;
  const limit = maxMs || 6000;
  while (waited < limit) {
    await sleep(120); waited += 120;
    const cur = await page.evaluate(BOXES);
    const n = await page.evaluate(MOVING);
    if (cur && cur === prev && n === 0) { if (++same >= 2) return { stable: true, waited: waited, moving: n }; }
    else same = 0;
    prev = cur;
  }
  return { stable: false, waited: waited, moving: await page.evaluate(MOVING) };
}

/* 派生判定：可用区矩形 + 每枚标记的越界 / 居中（含边缘内收的期望位置） */
function analyze(s) {
  const mr = s.el, ins = s.gate;
  const use = { l: mr[0] + ins[3], t: mr[1] + ins[0], r: mr[0] + mr[2] - ins[1], b: mr[1] + mr[3] - ins[2] };
  const TOL = 2;
  const out = [];
  s.marks.forEach(m => {
    const bx = m.box;
    const over = Math.max(0, use.l - bx[0], bx[2] - use.r) + Math.max(0, use.t - bx[1], bx[3] - use.b);
    if (over > TOL) out.push({ t: m.k + ':' + m.t, over: Math.round(over), bx: bx.map(Math.round), use: [use.l, use.t, use.r, use.b].map(Math.round) });
  });
  /* 居中 + 边缘内收：期望盒中心 = 锚点被夹进「可用区收掉半盒」之后的位置。
     锚点本来就离边界够远时夹不动 → 期望值就是锚点本身（防「一律往中间挤」） */
  const offC = [], clamped = [];
  s.marks.forEach(m => {
    const w = m.box[2] - m.box[0], h = m.box[3] - m.box[1];
    const ex = Math.min(Math.max(m.anch[0], use.l + w / 2), Math.max(use.l + w / 2, use.r - w / 2));
    const ey = Math.min(Math.max(m.anch[1], use.t + h / 2), Math.max(use.t + h / 2, use.b - h / 2));
    const d = Math.abs((m.box[0] + m.box[2]) / 2 - ex) + Math.abs((m.box[1] + m.box[3]) / 2 - ey);
    if (d > 1.5) offC.push(m.k + ':' + m.t + '=' + d.toFixed(1) + 'px');
    if (m.k === 'cl' && (Math.abs(m.dx) > 0.5 || Math.abs(m.dy) > 0.5)) {
      const shift = Math.abs(m.dx) + Math.abs(m.dy);
      if (shift > w / 2 + 2 && shift > h / 2 + 2) clamped.push(m.t + ' 挪' + Math.round(shift) + 'px > 半盒');
    }
  });
  return {
    use: use, out: out, offCenter: offC, overHalf: clamped,
    nCl: s.marks.filter(m => m.k === 'cl').length, nNd: s.marks.filter(m => m.k === 'nd').length
  };
}
const brief = a => a.out.length ? a.out.slice(0, 3).map(o => o.t + ' 越' + o.over + 'px 盒' + o.bx.join('/') + ' 区' + o.use.join('/')).join(' ') : '';

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  const net404 = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  /* 控制台里的 404 是瓦片/图片这类外网资源，不是页面逻辑挂了；单独列出来看，别混进 U13 */
  page.on('console', m => { if (m.type() === 'error') (/Failed to load resource/.test(m.text()) ? net404 : errs).push(m.text().slice(0, 80)); });
  page.on('response', r => { if (r.status() === 404) net404.push(r.url().slice(-60)); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_layer', 'amapStreet'); } catch (e) {} });

  /* ---------- 452×995（一加 Ace 6T 档）：山西（省内多市）+ 全国（跨省区域层） ---------- */
  for (const id of ['sx', 'nation']) {
    await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
    await page.goto(BASE + '/topic.html?p=' + id, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    const st = await settle(page, 8000);
    const s = await page.evaluate(PROBE);
    const a = analyze(s);
    const tag = id === 'sx' ? '山西' : '全国';
    check('U0 ' + tag + ' 页稳定收敛（连续两轮盒子逐枚相等且无在跑动画）', st.stable, 'waited=' + st.waited + 'ms moving=' + st.moving);
    check('U1 ' + tag + ' 底带量到 ≥70px（tabbar + 统计卡真在扣，不是内缩恒 0 蒙绿）', s.gate[2] >= 70, '内缩(上右下左)=' + s.gate.join(',') + ' 命中浮层=' + s.bands.join('+'));
    check('U2 ' + tag + ' 产品内缩＝闸门独立内缩（±2px）且内容区 = 可用区再让 16px', s.prod && s.prod.length === 4 && s.prod.every((v, i) => Math.abs(v - s.gate[i]) <= 2) && s.prodC && s.prodC.every((v, i) => Math.abs(v - (s.prod[i] + 16)) <= 0.51),
      '产品=' + (s.prod ? s.prod.join(',') : '未导出 usableInsets') + ' 闸门=' + s.gate.join(',') + ' 内容区=' + (s.prodC || []).join(','));
    check('U3 ' + tag + ' 首屏：' + a.nCl + ' 枚合集胶囊盒中心＝锚点（边缘内收后 ±1.5px）', a.nCl > 0 && a.offCenter.length === 0, '偏移 ' + (a.offCenter.slice(0, 3).join(' ') || '0'));
    check('U4 ' + tag + ' 首屏：' + s.marks.length + ' 枚标记视觉盒全部在可用区内（胶囊未被挪超半盒）', s.marks.length > 0 && a.out.length === 0 && a.overHalf.length === 0, brief(a) + a.overHalf.join(' '));
    if (id === 'sx') {
      /* ③ +/− 以可用区中心为锚 */
      const hold = async (dir, name) => {
        const before = await page.evaluate(PROBE);
        const ll = await page.evaluate(`(() => { const q = window.TopicEngine._map, i = window.TopicEngine.usableInsets();
          const el = document.getElementById('mapEl').getBoundingClientRect();
          const p = [i.left + (el.width - i.left - i.right) / 2, i.top + (el.height - i.top - i.bottom) / 2];
          const c = q.containerPointToLatLng(p); window.__holdLL = c; return c; })()`);
        await page.evaluate(dir > 0 ? "document.getElementById('zoomIn').click()" : "document.getElementById('zoomOut').click()");
        const s2t = await settle(page, 6000);
        const after = await page.evaluate(PROBE);
        const a2 = analyze(after);
        const px = await page.evaluate(`(() => { const q = window.TopicEngine._map, i = window.TopicEngine.usableInsets();
          const el = document.getElementById('mapEl').getBoundingClientRect();
          const c = [i.left + (el.width - i.left - i.right) / 2, i.top + (el.height - i.top - i.bottom) / 2];
          const p = q.latLngToContainerPoint(window.__holdLL);
          return [Math.round(p.x), Math.round(p.y), Math.round(c[0]), Math.round(c[1])]; })()`);
        check(name + '：可用区中心那个经纬度缩放后仍在中心（±4px）', s2t.stable && Math.abs(px[0] - px[2]) <= 4 && Math.abs(px[1] - px[3]) <= 4,
          '点位=' + px[0] + ',' + px[1] + ' 中心=' + px[2] + ',' + px[3] + ' 缩放 ' + before.zoom + '→' + after.zoom);
        check(name + '：缩放后 ' + after.marks.length + ' 枚标记仍在可用区内', a2.out.length === 0 && a2.offCenter.length === 0,
          '越界 ' + a2.out.length + '：' + brief(a2) +
          (a2.offCenter.length ? ' 偏移 ' + a2.offCenter.length + ' 枚：' + a2.offCenter.slice(0, 4).join(' ') : '') +
          ' 稳定' + s2t.stable + '/' + s2t.waited + 'ms');
      };
      await hold(1, 'U5 点 + 一次');
      await hold(1, 'U6 点 + 两次');
      await hold(-1, 'U7 点 − 一次');
      /* ④ 点聚合胶囊 → 聚焦后的视野同样不许把内容甩出可用区 */
      const clicked = await page.evaluate(`(() => {
        const caps = [].slice.call(document.querySelectorAll('#mapEl .lod-cl'));
        if (!caps.length) return 0;
        const n = e => { const q = e.querySelector('.lod-cl__n'); return q ? (parseInt(q.textContent, 10) || 0) : 0; };
        caps.sort((a, b) => n(b) - n(a));
        caps[0].click(); return caps.length;
      })()`);
      const s4t = await settle(page, 8000);
      const s4 = await page.evaluate(PROBE);
      const a4 = analyze(s4);
      check('U8 点最大聚合胶囊聚焦：稳定且 ' + s4.marks.length + ' 枚标记全在可用区内', clicked > 0 && s4t.stable && a4.out.length === 0,
        '胶囊 ' + clicked + ' 枚 → 稳定' + s4t.stable + ' 越界 ' + a4.out.length + '：' + brief(a4));
      check('U9 聚焦后胶囊盒中心仍＝锚点（内收后）', a4.offCenter.length === 0 && a4.nCl > 0, a4.nCl + ' 枚，偏移 ' + (a4.offCenter.slice(0, 3).join(' ') || '0'));
    }
  }

  /* ---------- 390×844 复跑首屏（可用区随宽度与面板高度变，不是 452 档写死的数） ---------- */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE + '/topic.html?p=sc', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  const st390 = await settle(page, 8000);
  const s390 = await page.evaluate(PROBE);
  const a390 = analyze(s390);
  check('U10 390 档：元素宽度真的变了且底带仍 ≥60px', s390.el[2] < 452 && s390.gate[2] >= 60, '元素=' + s390.el[2].toFixed(0) + '×' + s390.el[3].toFixed(0) + ' 内缩=' + s390.gate.join(','));
  check('U11 390 档：产品内缩＝闸门内缩', !!s390.prod && s390.prod.every((v, i) => Math.abs(v - s390.gate[i]) <= 2), '产品=' + (s390.prod || []).join(',') + ' 闸门=' + s390.gate.join(','));
  check('U12 390 档：首屏 ' + s390.marks.length + ' 枚标记全在可用区内且胶囊居中', st390.stable && a390.out.length === 0 && a390.offCenter.length === 0, '稳定' + st390.stable + ' 越界 ' + a390.out.length + '：' + brief(a390) + ' 偏移 ' + a390.offCenter.slice(0, 2).join(' '));

  /* ---------- 批次 18 · 横向内缩 + 双栏桌面档 ----------
     U14/U15 不动布局：把带名单里真有的 #routeBanner 临时摆成一条「左右带」，就能测出横向分支
     真的产出 ins.left/right（改前这两个值结构上恒 0，页面左边压着多宽的浮层都一样）。
     必须借道真带元素：usableInsets 只遍历 USABLE_BANDS 那四个选择器，新插一个无名 div 它看不见，
     那条绿光是假绿。条宽 120、纵向压满整屏 ⇒ 过 `iy ≥ 0.6·h` 而不过 `ix ≥ 0.6·w`，只能走侧带分支。 */
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  const bandProbe = side => page.evaluate(`(() => {
    const mr = document.getElementById('mapEl').getBoundingClientRect();
    const b = document.getElementById('routeBanner');
    const old = b.getAttribute('style') || '';
    b.setAttribute('style', 'display:block;position:fixed;top:0;height:100vh;width:120px;transform:none;opacity:1;' +
      ('${side}' === 'left' ? 'left:' + Math.round(mr.left) + 'px' : 'left:' + Math.round(mr.right - 120) + 'px'));
    const i = window.TopicEngine.usableInsets();
    const g = [i.left, i.right];
    if (old) b.setAttribute('style', old); else b.removeAttribute('style');
    return g;
  })()`);
  const bl = await bandProbe('left'), br = await bandProbe('right');
  check('U14 临时左带 120px → 产品算出 ins.left≈120 且没伪造右内缩（改前结构性恒 0）',
    Math.abs(bl[0] - 120) <= 2 && bl[1] === 0, '左带时(左,右)=' + bl.join(','));
  check('U15 临时右带 120px → 产品算出 ins.right≈120 且左右不串',
    Math.abs(br[1] - 120) <= 2 && br[0] === 0, '右带时(左,右)=' + br.join(','));

  /* U16/U17：1440×900 桌面档 */
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3200);
  const dv = await page.evaluate(`(() => {
    const side = Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dv-side')) || 0);
    const mr = document.getElementById('mapEl').getBoundingClientRect();
    const lr = document.getElementById('list').getBoundingClientRect();
    const i = window.TopicEngine.usableInsets();
    return { side: side, mleft: Math.round(mr.left), mwidth: Math.round(mr.width), vw: innerWidth,
      lright: Math.round(lr.right), listShown: getComputedStyle(document.getElementById('list')).display !== 'none',
      tab: document.body.dataset.view, insL: i.left, insR: i.right };
  })()`);
  check('U16 1440 双栏：地图可视盒从侧栏右缘起算（' + dv.mleft + 'px），且产品对侧栏零内缩（双份内缩＝症状「内容整体偏右」）',
    dv.tab === 'map' && dv.listShown && Math.abs(dv.mleft - dv.side) <= 2 && Math.abs(dv.lright - dv.side) <= 2 && Math.abs(dv.mwidth - (dv.vw - dv.side)) <= 2 && dv.insL === 0 && dv.insR === 0,
    '--dv-side=' + dv.side + ' 地图左=' + dv.mleft + ' 宽=' + dv.mwidth + '/视口 ' + dv.vw + ' 列表右=' + dv.lright + ' 内缩(左,右)=' + dv.insL + ',' + dv.insR);
  const hv = await page.evaluate(`(() => {
    document.querySelector('.tabbar button[data-tab="route"]').click();
    const w0 = window.TopicEngine.dayLineWeights();
    const di = w0.findIndex(w => w > 0);
    if (di < 0) return null;
    const el = document.querySelector('#routes .day[data-day="0:' + di + '"]');
    if (!el) return null;
    return { sel: '#routes .day[data-day="0:' + di + '"]', di: di, w0: w0, nOther: w0.filter((w, k) => k !== di && w > 0).length };
  })()`);
  await sleep(400);
  let hw = null;
  if (hv) {
    await page.hover(hv.sel);
    await sleep(260);
    const w1 = await page.evaluate('window.TopicEngine.dayLineWeights()');
    await page.mouse.move(1000, 420);   /* 移出左列触发 mouseleave */
    await sleep(260);
    hw = { w1: w1, w2: await page.evaluate('window.TopicEngine.dayLineWeights()') };
  }
  check('U17 1440 左列悬停 D' + (hv ? hv.di + 1 : '?') + '：该日线段加粗到 7、其余 ' + (hv ? hv.nOther : 0) + ' 条压到 2.5，离开后逐条回到基准',
    !!hv && !!hw && hw.w1[hv.di] === 7 && (hv.nOther === 0 || hw.w1.filter((w, k) => k !== hv.di && w > 0).every(w => w === 2.5)) && hw.w2.join(',') === hv.w0.join(','),
    hv ? '基准=' + hv.w0.join(',') + ' 悬停=' + (hw ? hw.w1.join(',') : '未读到') + ' 离开=' + (hw ? hw.w2.join(',') : '未读到') : '没找到可悬停的日块');

  /* U18：768×1024 横屏保持单栏（阈值 900 的理由：两栏后地图只剩 428px，比手机还挤） */
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
  await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  const q768 = await page.evaluate(`(() => {
    const mr = document.getElementById('mapEl').getBoundingClientRect();
    return { mleft: Math.round(mr.left), mwidth: Math.round(mr.width), vw: innerWidth,
      listShown: getComputedStyle(document.getElementById('list')).display !== 'none' };
  })()`);
  check('U18 768×1024 仍单栏：地图满宽且左列表没有偷偷变成侧栏',
    q768.mleft <= 1 && Math.abs(q768.mwidth - q768.vw) <= 1 && !q768.listShown,
    '地图左=' + q768.mleft + ' 宽=' + q768.mwidth + '/视口 ' + q768.vw + ' 列表显示=' + q768.listShown);

  /* U19/U20：手机三档几何不变＝本批「不动手机档一根 CSS」的最有力反证 */
  const mob = [];
  for (const w of [320, 390, 452]) {
    await page.setViewport({ width: w, height: w === 320 ? 640 : (w === 390 ? 844 : 995), deviceScaleFactor: 2 });
    await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2800);
    mob.push({ w: w, r: await page.evaluate(`(() => {
      const mr = document.getElementById('mapEl').getBoundingClientRect();
      const i = window.TopicEngine.usableInsets();
      return { mleft: Math.round(mr.left), mwidth: Math.round(mr.width), vw: innerWidth,
        l: i.left, rr: i.right, t: i.top, b: i.bottom,
        listShown: getComputedStyle(document.getElementById('list')).display !== 'none' };
    })()`) });
  }
  check('U19 手机三档：地图容器仍满宽贴着视口左边（双栏 CSS 一条都没漏进手机档）',
    mob.every(m => m.r.mleft <= 1 && Math.abs(m.r.mwidth - m.r.vw) <= 1 && !m.r.listShown),
    mob.map(m => m.w + '→左' + m.r.mleft + '/宽' + m.r.mwidth).join(' '));
  check('U20 手机三档：横向内缩恒 0，纵向仍扣到底带（横向分支没把手机档算出新的死区）',
    mob.every(m => m.r.l === 0 && m.r.rr === 0 && m.r.b >= 60),
    mob.map(m => m.w + '→(左' + m.r.l + ',右' + m.r.rr + ',底' + m.r.b + ')').join(' '));

  check('U13 全程无页面未捕获异常', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log('\n=== smoke-usable: ' + (results.length - failures) + '/' + results.length + ' PASS ===');
  console.log('（信息）404/资源类控制台报错 ' + net404.length + ' 条：' + net404.slice(0, 4).join(' | '));
  process.exit(failures ? 1 : 0);
})();
