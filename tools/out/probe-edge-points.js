/* probe-edge-points.js — 用户报的「放大后节点和合集点跑到屏幕外的地图边缘，要一个个找」
 *
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/probe-edge-points.js [id1 id2 …]
 *      环境变量：INIT_ONLY=1 只量初始态；ZSTEPS=1,2,3 自定义放大步数
 *
 * 要分清四件事，光看截图分不出来：
 *   ① 视觉盒被**视口**裁掉（中心 px>屏宽）——用户看到半枚胶囊贴在边上；
 *   ② 在地图元素之内、但整枚落在**被浮层压住的带**里（顶部横幅 / 底部统计卡 + tabbar）——
 *      Leaflet 的裁剪和 fitBounds 用的都是元素矩形，可用区其实更小；
 *   ③ 地理锚点在可用区内，但胶囊**视觉盒从锚点向右下悬出**
 *      （clusterIcon 用 iconSize:[0,0] + iconAnchor:[0,0]，CSS 无居中 transform）；
 *   ④ 整枚在地图元素之外（overflow 泄漏）。
 * 所以每枚标记同时报：地理锚点（Leaflet containerPoint）、视觉盒四边、与元素/可用区/视口的相交。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');

const PORT = 8163;
const BASE = 'http://localhost:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(d); });
});

/* 采集：地图元素矩形 + 压在地图上的浮层矩形 + 每枚标记的锚点/视觉盒三重判定 */
const SNAP = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  /* 压在地图之上的浮层：定位方式 fixed/absolute/sticky、z-index 高、且与地图矩形真实相交 */
  const overlays = [];
  [].slice.call(document.querySelectorAll('body *')).forEach(function (el) {
    if (el.contains(mapEl) || mapEl.contains(el)) return;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') return;
    if (parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
    const zi = parseInt(cs.zIndex || '0', 10);
    if (zi < 100) return;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) return;
    const ix = Math.max(0, Math.min(r.right, mr.right) - Math.max(r.left, mr.left));
    const iy = Math.max(0, Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top));
    if (ix * iy < 4000) return;           /* 相交面积太小的不算遮挡 */
    /* 只有「成带」的遮挡才计入四边内缩：横向铺满 ≥60% 才算上/下带，
       纵向铺满 ≥60% 才算左/右带；否则是点状遮挡（缩放按钮等），只用 covered 判。
       （2026-10-05 修正：顶栏 routeBanner 宽 269 曾被误判成左内缩 281，可用区整个偏掉） */
    const spanW = ix / mr.width, spanH = iy / mr.height;
    overlays.push({
      t: (el.id || el.className || el.tagName).toString().split(' ')[0].slice(0, 28), zi: zi,
      r: [r.left, r.top, r.right, r.bottom], area: Math.round(ix * iy),
      band: spanW >= 0.6 ? 'h' : (spanH >= 0.6 ? 'v' : 'spot')
    });
  });
  const covered = function (x, y) {
    for (const o of overlays) { const r = o.r; if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return o.t; }
    return null;
  };
  let insetT = 0, insetB = 0, insetL = 0, insetR = 0;
  overlays.forEach(function (o) {
    if (o.band === 'spot') return;
    const r = o.r;
    if (o.band === 'h') {
      const cyO = (r[1] + r[3]) / 2;
      if (cyO < mr.top + mr.height / 2) insetT = Math.max(insetT, r[3] - mr.top);
      else insetB = Math.max(insetB, mr.bottom - r[1]);
    } else {
      const cxO = (r[0] + r[2]) / 2;
      if (cxO > mr.left + mr.width / 2) insetR = Math.max(insetR, mr.right - r[0]);
      else insetL = Math.max(insetL, r[2] - mr.left);
    }
  });
  insetT = Math.max(0, Math.min(insetT, mr.height - 40));
  insetB = Math.max(0, Math.min(insetB, mr.height - 40));
  insetL = Math.max(0, Math.min(insetL, mr.width - 40));
  insetR = Math.max(0, Math.min(insetR, mr.width - 40));
  const useRect = { l: mr.left + insetL, t: mr.top + insetT, r: mr.right - insetR, b: mr.bottom - insetB };
  const pts = [];
  [].slice.call(document.querySelectorAll('#mapEl .tr-node, #mapEl .mem-node, #mapEl .lod-cl')).forEach(function (el) {
    /* divIcon 的容器是 iconSize:[0,0] → 0×0，必须量内层元素本身；
       锚点＝容器（leaflet-marker-icon）左上角，胶囊盒从锚点向右下悬出。
       节点反过来：.tr-node 内层高度 0（.tr-ring/.tr-dot 是绝对定位），量容器 30×30 才是真盒。 */
    const inner = el.getBoundingClientRect();
    const cont = el.closest('.leaflet-marker-icon') || el.parentElement;
    const cr = cont.getBoundingClientRect();
    const r = (inner.height < 4 && cr.height >= 4) ? cr : inner;
    if (!r.width && !r.height) return;
    const box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    const out = {
      k: el.classList.contains('lod-cl') ? '合集' : '节点',
      t: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 18),
      /* 锚点（相对地图元素）：负数＝元素外，>宽/高＝右/下外 */
      ax: Math.round(cr.left - mr.left), ay: Math.round(cr.top - mr.top),
      /* 视觉盒（相对地图元素） */
      bx: [Math.round(box.l - mr.left), Math.round(box.t - mr.top), Math.round(box.r - mr.left), Math.round(box.b - mr.top)],
      size: [Math.round(r.width), Math.round(r.height)],
      /* 四种失效 */
      offViewport: (box.r < 0 || box.l > vw || box.b < 0 || box.t > vh),
      cutByViewport: (box.l < 0 || box.r > vw || box.t < 0 || box.b > vh),
      cutByMapEl: (box.l < mr.left - 1 || box.r > mr.right + 1 || box.t < mr.top - 1 || box.b > mr.bottom + 1),
      underOverlay: covered(box.l + r.width / 2, box.t + r.height / 2),
      /* 视觉盒是否与可用区完整相交（不被内缩带切掉） */
      inUsable: (box.l >= useRect.l - 1 && box.r <= useRect.r + 1 && box.t >= useRect.t - 1 && box.b <= useRect.b + 1),
      hangW: Math.round(Math.max(0, box.r - useRect.r) + Math.max(0, useRect.l - box.l) + Math.max(0, box.b - useRect.b) + Math.max(0, useRect.t - box.t))
    };
    pts.push(out);
  });
  const z = window.TopicEngine && window.TopicEngine._map ? window.TopicEngine._map.getZoom() : null;
  const lv = window.__nodeLOD && window.__nodeLOD.getLevels ? (function () { const l = window.__nodeLOD.getLevels(); return l ? l.map(function (x) { return x.key + '@' + x.zMin + '-' + x.zMax; }).join(' ') : 'null'; })() : '无';
  return { vp: [vw, vh], mapRect: [Math.round(mr.left), Math.round(mr.top), Math.round(mr.width), Math.round(mr.height)],
    inset: [Math.round(insetT), Math.round(insetR), Math.round(insetB), Math.round(insetL)],
    usable: [Math.round(useRect.l - mr.left), Math.round(useRect.t - mr.top), Math.round(useRect.r - mr.left), Math.round(useRect.b - mr.top)],
    zoom: z, levels: lv, overlays: overlays.map(function (o) { return { t: o.t, zi: o.zi, r: o.r, band: o.band }; }), pts: pts };
})()`;

function report(tag, s) {
  const bad = s.pts.filter(p => p.offViewport || p.cutByViewport || p.underOverlay || !p.inUsable || p.cutByMapEl);
  const g = f => s.pts.filter(f).length;
  console.log(`  ${tag} z=${s.zoom} 层级[${s.levels}] 元素 ${s.mapRect[2]}×${s.mapRect[3]}@${s.mapRect[1]} 可用区(相对元素) ${s.usable.join(',')} 内缩(上右下左) ${s.inset.join(',')} 标记 ${s.pts.length}` +
    `｜出屏 ${g(p => p.offViewport)}｜被屏边切 ${g(p => !p.offViewport && p.cutByViewport)}｜被浮层盖 ${g(p => p.underOverlay)}｜出可用区 ${g(p => !p.underOverlay && !p.inUsable)}｜出元素 ${g(p => p.cutByMapEl)}`);
  const fmt = a => a.slice(0, 8).map(p => `${p.k}「${p.t}」锚${p.ax},${p.ay} 盒${p.bx.join('/')} ${p.size[0]}×${p.size[1]}${p.offViewport ? '[出屏]' : ''}${p.cutByViewport && !p.offViewport ? '[切边]' : ''}${p.underOverlay ? '[盖:' + p.underOverlay + ']' : ''}${p.cutByMapEl ? '[出元素]' : ''} 出区${p.hangW}px`).join('\n      ');
  if (bad.length) console.log('      ' + fmt(bad));
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  const vp = (process.env.VP || '452x995').split('x').map(Number);
  await page.setViewport({ width: vp[0], height: vp[1], deviceScaleFactor: 2 });   /* 一加 Ace 6T 档 */
  const steps = process.env.INIT_ONLY ? [] : (process.env.ZSTEPS || '1,2,3').split(',').map(Number);
  const ids = process.argv.slice(2);
  const rawPath = process.env.RAW_OUT ? path.join(ROOT, process.env.RAW_OUT) : null;
  const sum = {};
  const raw = [];
  for (const id of (ids.length ? ids : ['sx', 'sc', 'gs', 'xj', 'nmg', 'sh'])) {
    try {
      /* domcontentloaded：瓦片是 https 外网，'load' 会被限流/代理抖动拖成超时（首轮 hlj 就是这么断的）；
         产品逻辑全在本地脚本里，DOMContentLoaded 后再固定等 5s 足够首屏视野与 LOD 落位 */
      await page.goto(`${BASE}/topic.html?p=${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await sleep(6000);
      console.log(`\n=== topic.html?p=${id} @${vp[0]}×${vp[1]} ===`);
      const shots = [['初始 ', await page.evaluate(SNAP), 0]];
      for (const n of steps) {
        await page.evaluate("document.getElementById('zoomIn').click()");
        await sleep(1700);
        shots.push([`+z×${n}`, await page.evaluate(SNAP), n]);
      }
      shots.forEach(function (x) {
        report(x[0], x[1]);
        const k = x[2] === 0 ? 'init' : 'z+' + x[2];
        sum[k] = sum[k] || { page: 0, mark: 0, off: 0, cut: 0, cov: 0, out: 0 };
        const s = sum[k];
        s.page += x[1].pts.length ? 1 : 0;
        s.mark += x[1].pts.length;
        s.off += x[1].pts.filter(p => p.offViewport).length;
        s.cut += x[1].pts.filter(p => !p.offViewport && p.cutByViewport).length;
        s.cov += x[1].pts.filter(p => p.underOverlay).length;
        s.out += x[1].pts.filter(p => !p.underOverlay && !p.inUsable).length;
        /* 逐枚几何落盘：report 只印前 8 条，归因必须拿全量（首轮用正则读日志把
           带两个标记的行整批漏掉了，右溢几乎全在那批里） */
        x[1].pts.forEach(function (p) {
          raw.push({ page: id, st: k, vp: [vp[0], vp[1]], zoom: x[1].zoom, levels: x[1].levels, inset: x[1].inset, usable: x[1].usable, mapRect: x[1].mapRect, m: p });
        });
      });
      await page.screenshot({ path: path.join(ROOT, 'tools', 'out', `_edge-${id}-zoomed.png`) });
    } catch (err) {
      console.log(`\n=== topic.html?p=${id} 采集失败：${err.message} ===`);
      sum.fail = (sum.fail || 0) + 1;
    }
  }
  console.log('\n=== 汇总（' + ids.length + ' 页 @' + vp[0] + '×' + vp[1] + (sum.fail ? '，采集失败 ' + sum.fail + ' 页' : '') + '）===');  ['init', 'z+1', 'z+2', 'z+3'].forEach(function (k) {
    const s = sum[k]; if (!s) return;
    const n = s.mark || 1;
    console.log(`  ${k.padEnd(4)} 有标记页 ${String(s.page).padStart(2)}/${ids.length}｜标记 ${String(s.mark).padStart(4)} 枚｜出屏 ${String(s.off).padStart(3)} (${(s.off * 100 / n).toFixed(1)}%)｜被屏边切 ${String(s.cut).padStart(3)} (${(s.cut * 100 / n).toFixed(1)}%)｜被浮层盖 ${String(s.cov).padStart(3)} (${(s.cov * 100 / n).toFixed(1)}%)｜出可用区 ${String(s.out).padStart(3)} (${(s.out * 100 / n).toFixed(1)}%)`);
  });
  const anyBad = ['init', 'z+1', 'z+2', 'z+3'].reduce(function (a, k) { const s = sum[k]; if (!s) return a; a.mark += s.mark; a.bad += s.off + s.cut + s.cov + s.out; return a; }, { mark: 0, bad: 0 });
  console.log(`  合计 ${anyBad.mark} 枚标记，其中 ${anyBad.bad} 枚（${(anyBad.bad * 100 / (anyBad.mark || 1)).toFixed(1)}%）视觉盒越出可用区/屏幕/被浮层盖住`);
  if (rawPath) {
    fs.writeFileSync(rawPath, raw.map(x => JSON.stringify(x)).join('\n') + '\n');
    console.log('  逐枚几何 → ' + path.relative(ROOT, rawPath) + '（' + raw.length + ' 行，归因脚本 tools/out/b13-attr.js 读它）');
  }
  await browser.close();
  server.close();
  console.log('\n截图入 tools/out/_edge-<id>-zoomed.png（临时件，.gitignore 已挡）');
})().catch(e => { console.log('ERR ' + e.message); process.exit(2); });
