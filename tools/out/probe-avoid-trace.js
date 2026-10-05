/* probe-avoid-trace.js — 谁在最后一次避让之后又动了地图 DOM？
 *
 * 用法：node tools/out/probe-avoid-trace.js [W] [H]
 * 默认 1440 900（负载下稳定复现重叠的那一态）。
 *
 * 探针在页面里做三件事：
 *   1) 抢在 CLOCK 桩之前存下真实 performance.now（记作 t，单位 ms，从导航起算）；
 *   2) 包装 labelAvoid / capsuleAvoid，每次调用记下 t、当时可见标签数、跑完后的重叠对数；
 *   3) MutationObserver 盯 #mapEl 子树，记下最后一次 DOM 变动的 t 与类型。
 * 判读：若「最后一次避让的 t」< 「最后一次 DOM 变动的 t」⇒ 避让没有覆盖终态，双态根因就是它；
 *      若避让在变动之后仍留下重叠 ⇒ 是 rect 量到了缩放动画中途，得改测量时机（等 leaflet-zoom-anim 结束）。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
const LOAD = process.argv.includes('--load');

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const CLOCK = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc)[1];

const TRACE = `
(function () {
  var pn = performance.now.bind(performance);
  window.__t0 = pn();
  var T = function () { return Math.round(pn() - window.__t0); };
  window.__ev = [];
  function overlaps() {
    var vis = [].slice.call(document.querySelectorAll('.node-label')).filter(function (e) { return !e.classList.contains('hidden'); });
    var R = vis.map(function (e) { return e.getBoundingClientRect(); }), n = 0, txt = [];
    for (var i = 0; i < R.length; i++) for (var j = i + 1; j < R.length; j++) {
      var a = R[i], b = R[j];
      if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) { n++; txt.push(vis[i].textContent + '×' + vis[j].textContent); }
    }
    return { n: n, txt: txt.join(','), smp: vis.slice(0, 3).map(function (e) { var r = e.getBoundingClientRect(); return e.textContent + '@' + Math.round(r.x) + ',' + Math.round(r.y) + 'w' + Math.round(r.width); }).join(' '),
      fs: document.fonts.status,
      chk: document.fonts.check('500 11.5px "TRACE Serif"'),
      fam: vis[0] ? getComputedStyle(vis[0]).fontFamily.split(',')[0] : '-',
      fz: vis[0] ? getComputedStyle(vis[0]).fontSize : '-',
      probe: (function () { var s = document.createElement('span'); s.style.cssText = 'position:absolute;left:-9999px;white-space:nowrap;font:' + (vis[0] ? getComputedStyle(vis[0]).font : '11.5px sans-serif'); s.textContent = '成都大熊猫繁育研究基地'; document.body.appendChild(s); var w = Math.round(s.getBoundingClientRect().width); s.remove(); return w; })(),
      /* 祖先链的 transform / 尺寸：宽度按 0.59 倍缩放说明量的那一刻有个祖先带 scale，点名是谁 */
      chain: (function () { var e = vis[0], out = []; while (e && out.length < 8) { var cs = getComputedStyle(e); var r = e.getBoundingClientRect(); out.push((e.id || e.className || e.nodeName) + ' t=' + (cs.transform === 'none' ? '-' : cs.transform) + ' w=' + Math.round(r.width) + ' op=' + cs.opacity + ' an=' + (cs.animationName === 'none' ? '-' : cs.animationName + '/' + cs.animationPlayState)); e = e.parentElement; } return out.join(' << '); })() };
  }
  window.__ov = overlaps;
  function wrap(name) {
    var real = null;
    Object.defineProperty(window, name, {
      configurable: true,
      get: function () { return function (sel) { var before = overlaps(); var r = real ? real.apply(this, arguments) : null; var after = overlaps();
        window.__ev.push({ e: name, t: T(), before: before.n, after: after.n, anim: !!document.querySelector('.leaflet-zoom-anim,.leaflet-drag-target .leaflet-zoom-animated'), txt: after.txt, smp: after.smp, fs: after.fs, chk: after.chk, fam: after.fam, fz: after.fz, probe: after.probe, chain: after.chain }); return r; }; },
      set: function (f) { real = f; }
    });
  }
  wrap('labelAvoid'); wrap('capsuleAvoid');
  var last = null;
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('#mapEl');
    if (!root) return;
    new MutationObserver(function (ms) {
      var o = ms[0];
      last = { t: T(), type: o.type, target: (o.target.className || o.target.nodeName || '') + '', n: ms.length };
      window.__ev.push({ e: 'dom', t: T(), type: o.type, n: ms.length, anim: !!document.querySelector('.leaflet-zoom-anim') });
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.__lastDom = function () { return last; };
  });
})();
`;

(async () => {
  const burners = [];
  if (LOAD) for (let i = 0; i < 4; i++) burners.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) req.abort().catch(() => {}); else req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(TRACE);
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 5000));
  const out = await pg.evaluate(() => ({ ev: window.__ev, last: window.__lastDom && window.__lastDom(), now: window.__ev.length ? null : null, final: window.__ov(), labels: document.querySelectorAll('.node-label').length }));
  console.log('视口 ' + W + 'x' + H + (LOAD ? '（负载）' : '') + '  标签 ' + out.labels + '  终态重叠对 ' + out.final.n + (out.final.txt ? ' → ' + out.final.txt : ''));
  const doms = out.ev.filter(e => e.e === 'dom');
  const las = out.ev.filter(e => e.e === 'labelAvoid');
  const cas = out.ev.filter(e => e.e === 'capsuleAvoid');
  console.log('事件 ' + out.ev.length + ' 条：labelAvoid ' + las.length + ' 次 / capsuleAvoid ' + cas.length + ' 次 / DOM 变动 ' + doms.length + ' 批');
  out.ev.slice(-14).forEach(e => console.log('  t=' + e.t + 'ms ' + e.e + (e.type ? ' ' + e.type + '×' + e.n : ' 前重叠 ' + e.before + ' → 后 ' + e.after + (e.anim ? ' [缩放动画中]' : '') + (e.txt ? ' ' + e.txt : ''))));
  const lastLa = las[las.length - 1];
  if (lastLa) console.log('最后一次 labelAvoid 当时: 字体状态=' + lastLa.fs + ' check(TRACE Serif)=' + lastLa.chk + ' 首选族=' + lastLa.fam + ' ' + lastLa.fz + ' 探针宽=' + lastLa.probe + ' 样本 ' + lastLa.smp);
  console.log('终态: 字体状态=' + out.final.fs + ' check=' + out.final.chk + ' 首选族=' + out.final.fam + ' ' + out.final.fz + ' 探针宽=' + out.final.probe);
  console.log('避让时祖先链: ' + (lastLa ? lastLa.chain : '-'));
  console.log('终态祖先链:  ' + out.final.chain);
  console.log('最后一次避让 t=' + (las.length ? las[las.length - 1].t : '从未') + 'ms | 最后一次 DOM 变动 t=' + (doms.length ? doms[doms.length - 1].t : '无') + 'ms');
  /* 关键一问：终态那 4 对重叠，是"位置又变了"还是"避让没再跑"？
     现在补跑一次并等 400ms 再看——若补跑后为 0 且 400ms 后仍为 0，说明位置早已稳定，
     只是最后一次避让跑在稳定之前；若 400ms 后又长出重叠，说明还在动，得改测量时机。 */
  const late = await pg.evaluate(() => {
    const one = [].slice.call(document.querySelectorAll('.node-label')).filter(e => !e.classList.contains('hidden')).slice(0, 3).map(e => { const r = e.getBoundingClientRect(); return e.textContent + '@' + Math.round(r.x) + ',' + Math.round(r.y) + 'w' + Math.round(r.width); }).join(' ');
    const before = window.__ov();
    if (window.labelAvoid) labelAvoid('#mapEl');
    return { one, before: before.n, afterImmediate: window.__ov().n, txt: before.txt };
  });
  await new Promise(r => setTimeout(r, 400));
  const after400 = await pg.evaluate(() => ({ n: window.__ov().n, one: [].slice.call(document.querySelectorAll('.node-label')).filter(e => !e.classList.contains('hidden')).slice(0, 3).map(e => { const r = e.getBoundingClientRect(); return e.textContent + '@' + Math.round(r.x) + ',' + Math.round(r.y) + 'w' + Math.round(r.width); }).join(' ') }));
  console.log('终态样本矩形: ' + late.one);
  console.log('补跑避让：前 ' + late.before + ' 对 → 立刻 ' + late.afterImmediate + ' 对 → 400ms 后 ' + after400.n + ' 对');
  console.log('400ms 后样本矩形: ' + after400.one);
  await browser.close();
  for (const b of burners) b.kill();
})();
