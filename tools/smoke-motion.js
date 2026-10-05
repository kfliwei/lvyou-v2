/* tools/smoke-motion.js — 批次 11 P2-7 动效编排行为验证
 * 三档跑法（同一份断言只在「减动效」那一档换预期）：
 *   A 时序 token 在浏览器里真的解析（不是只写在 CSS 里没落地）
 *   B 系统「减弱动态效果」开起来之后：连 vendor 的动画都压到 ≤1 帧，JS 侧读到的时序归零
 *   C 三处转场接线：跨文档（首页→专题）、同文档（planner 阶段切换、随手记面板开合）
 *   D file:// 降级：APK 壳就是这个环境，转场不许拦导航、不许报错
 * 锚点全部走「浏览器实测」而不是读源码——读源码那部分在 verify.js §19。
 * NODE_PATH 需指到 tools/node_modules。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8137', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const FILE = pathToFileURL(ROOT + '/').href;

const results = [];
let failures = 0;
function check(name, pass, detail) {
  results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  if (!pass) failures++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  [' + detail + ']'));
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const server = http.createServer(function (req, res) {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
      : p.endsWith('.css') ? 'text/css;charset=utf-8'
      : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
      : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    res.end(data);
  });
});

/* 一条行程的最小形态：renderDaysBody 会读 driveH/playH/totalH 做 toFixed，字段缺一个就整页崩 */
const TRIP = [{ id: 'm1', name: '动效验证一日', createdAt: 1760000000000, dest: '永济', startDate: '2026-10-10',
  days: [{ date: '2026-10-10', driveKm: 12, driveH: 0.4, playH: 3.2, totalH: 4.6,
    stops: [{ name: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' }] }] }];

/* CSSOM 里扫「声明值里带裸时序」的 transition/animation 规则。
   token 化之后 cssText 里应当只剩 var(--motion-*)。
   vendor/** 故意不扫：第三方样式不改写（fork 一次就得跟着维护），它的动画由 B8 那条
   运行时实测守住——全局 !important 归零连 vendor 一起压住。 */
const SCAN_BARE = function () {
  const bad = [];
  /* Chrome 把 animation:none 规范成 "auto ease 0s 1 normal none running none"，
     那个 0s 不是源码里的魔法数字，必须放过：只抓非零时序字面量 */
  const RAW = /(^|[^A-Za-z0-9_.-])(?!0(\.0*)?(ms|s)\b)\d*\.?\d+(ms|s)\b/;
  for (const sh of document.styleSheets) {
    if (/\/vendor\//.test(sh.href || '')) continue;
    let rules;
    try { rules = sh.cssRules; } catch (e) { continue; }
    (function walk(list, media) {
      for (const ru of list || []) {
        if (ru.cssRules && !(ru instanceof CSSStyleRule)) { walk(ru.cssRules, ru.conditionText || media); continue; }
        const tx = ru.cssText || '';
        const m = tx.match(/(?:^|[\s;{])(transition|animation)(-duration|-delay)?:[^;}]*/g);
        if (m) m.forEach(function (seg) {
          if (RAW.test(seg) && seg.indexOf('var(--motion-') < 0) bad.push((media ? '@media ' + media.slice(0, 24) + ' ' : '') + tx.slice(0, 70));
        });
      }
    })(rules, '');
  }
  return bad;
};

/* 减动效档的实测：把全页每个元素的 computed duration/delay 都读出来，超过 1 帧（16.7ms）的列出来 */
const SCAN_SLOW = function () {
  const over = [];
  const ms = function (v) {
    return ('' + v).split(',').reduce(function (acc, part) {
      const t = part.trim();
      const n = t.indexOf('ms') >= 0 ? parseFloat(t) : t.indexOf('s') >= 0 ? parseFloat(t) * 1000 : 0;
      return Math.max(acc, n || 0);
    }, 0);
  };
  document.querySelectorAll('*').forEach(function (el) {
    const c = getComputedStyle(el);
    [['animationDuration', c.animationDuration], ['transitionDuration', c.transitionDuration],
      ['animationDelay', c.animationDelay], ['transitionDelay', c.transitionDelay]].forEach(function (pair) {
      const v = ms(pair[1]);
      if (v > 16.7) over.push((el.className || el.tagName) + '.' + pair[0] + '=' + pair[1]);
    });
  });
  return over.slice(0, 6);
};

/* 计数 startViewTransition：在 Document.prototype 上打补丁，UI.vt 运行时取到的就是它 */
const PATCH_VT = function () {
  window.__vt = 0;
  const o = Document.prototype.startViewTransition;
  Document.prototype.startViewTransition = function (f) { window.__vt++; return o.call(this, f); };
  window.__vtOrig = o;
};

async function newPage(browser, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  page.on('pageerror', function (e) { (opts && opts.errors || []).push(e.message); });
  return page;
}

(async function main() {
  await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];

  /* ================= A · token 在浏览器里解析 ================= */
  const pa = await newPage(browser, { errors: errs });
  await pa.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(900);
  const a = await pa.evaluate(function () {
    const g = getComputedStyle(document.documentElement);
    const mk = function (cls) { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; };
    const tst = mk('ui-toast'), st = mk('fade-stagger');
    st.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
    const o = {
      normal: g.getPropertyValue('--motion-normal').trim(),
      step: g.getPropertyValue('--motion-step').trim(),
      page: g.getPropertyValue('--motion-page').trim(),
      toastDur: getComputedStyle(tst).transitionDuration,
      stagger8: getComputedStyle(st.children[7]).animationDelay,
      motionRead: UI.motionMs('normal', 999),
      motionFallback: UI.motionMs('nosuchrung', 456),
      motionNaN: UI.motionMs('normal', 999)
    };
    tst.remove(); st.remove();
    return o;
  });
  check('A1 :root 上 --motion-normal 计算值就是 280ms', a.normal === '280ms', a.normal);
  check('A2 token 落到声明上：.ui-toast 的 transition-duration = 0.28s', a.toastDur === '0.28s, 0.28s', a.toastDur);
  check('A3 逐条入场用 calc(token×n)：第 8 项 delay = 0.32s（8×40ms）', a.stagger8 === '0.32s', a.stagger8 + ' / --motion-step=' + a.step);
  check('A4 JS 侧时序回读同一本账：UI.motionMs("normal") = 280', a.motionRead === 280, String(a.motionRead));
  check('A5 token 缺失时退回调用方兜底，不返回 NaN', a.motionFallback === 456, String(a.motionFallback));
  const bareA = await pa.evaluate(SCAN_BARE);
  check('A6 首页 CSSOM 里 transition/animation 声明零裸时序（第一方样式表）', bareA.length === 0, bareA.slice(0, 2).join(' | ') || '0 处');

  /* ================= C · 转场接线（跨文档） ================= */
  const c = await pa.evaluate(async function () {
    const __o = Document.prototype.startViewTransition; window.__vt = 0; Document.prototype.startViewTransition = function (f) { window.__vt++; return __o.call(this, f); };
    const vtRules = [];
    for (const sh of document.styleSheets) {
      try { for (const ru of sh.cssRules || []) if (ru.constructor.name === 'CSSViewTransitionRule') vtRules.push(ru.cssText.replace(/\s+/g, ' ')); } catch (e) {}
    }
    let rootDur = '';
    for (const sh of document.styleSheets) {
      try { for (const ru of sh.cssRules || []) {
        const t = ru.cssText || '';
        if (t.indexOf('::view-transition-old(root)') >= 0) rootDur = t.replace(/\s+/g, ' ').slice(0, 160);
      } } catch (e) {}
    }
    const hs = document.querySelector('.hero__search');
    /* startViewTransition 的回调是异步跑的，必须等 finished 再判「回调有没有被执行」 */
    const v0 = window.__vt; let ran = 0;
    const t = UI.vt(function () { ran++; });
    if (t && t.finished) { try { await t.finished; } catch (e) {} }
    return {
      hasStartVT: typeof document.startViewTransition === 'function',
      vtRules: vtRules, rootDur: rootDur,
      heroVtn: hs ? getComputedStyle(hs).viewTransitionName : 'no .hero__search',
      uiVtRan: ran,
      uiVtCalls: window.__vt - v0
    };
  });
  check('C1 引擎支持同文档转场（不支持时本节其余断言不成立，必须红）', c.hasStartVT);
  check('C2 design.css 的 @view-transition{navigation:auto} 被 CSSOM 认下（不是被当未知规则丢掉）',
    c.vtRules.some(function (t) { return t.indexOf('navigation') >= 0 && t.indexOf('auto') >= 0; }), JSON.stringify(c.vtRules));
  check('C3 跨文档转场时长走 token，不写字面量', /--motion-page/.test(c.rootDur) && !/\d+(ms|s)\b/.test(c.rootDur.replace(/var\([^)]*\)/g, '')), c.rootDur);
  check('C4 首页搜索框挂了共享元素名 search-field', c.heroVtn === 'search-field', c.heroVtn);
  check('C5 UI.vt 在支持的环境里真的走 startViewTransition，回调没被吞', c.uiVtRan === 1 && c.uiVtCalls === 1, 'ran=' + c.uiVtRan + ' calls=' + c.uiVtCalls);

  await pa.evaluate(function () { location.href = 'topic.html'; });
  await sleep(1200);
  const tb = await pa.evaluate(function () {
    const el = document.querySelector('.topbar .search');
    return { url: location.pathname, vt: el ? getComputedStyle(el).viewTransitionName : 'no .search',
      title: (document.querySelector('.topic-title') || {}).textContent || document.title };
  });
  check('C6 脚本发起的跨文档导航照常到达（转场不许拦路）', /topic\.html$/.test(tb.url), tb.url);
  check('C7 专题页搜索框同名，共享元素这才配得上对', tb.vt === 'search-field', tb.vt);
  const bareT = await pa.evaluate(SCAN_BARE);
  check('C8 专题页（含 map.css）CSSOM 里零裸时序', bareT.length === 0, bareT.slice(0, 2).join(' | ') || '0 处');

  /* ================= C · 转场接线（同文档两处） ================= */
  const pp = await newPage(browser, { errors: errs });
  await pp.evaluateOnNewDocument(function (trip) {
    localStorage.setItem('tn_trips', JSON.stringify(trip));
    /* 天气开关关掉：这个 smoke 不测天气，别让日卡往 open-meteo 发真请求 */
    localStorage.setItem('tn_planner_weather', '0');
  }, TRIP);
  await pp.goto(BASE + '/planner.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(1200);
  await pp.evaluate(PATCH_VT);
  await pp.evaluate(function () { window.plannerOpenTrip(0); });
  await sleep(700);
  const pl = await pp.evaluate(function () {
    return { vt: window.__vt, stage: document.getElementById('stageResult').style.display,
      days: document.querySelectorAll('#resultBody .day-card').length,
      back: (function () { const before = window.__vt; window.plannerBack(); return { before: before, after: window.__vt }; })() };
  });
  await sleep(400);
  const plBack = await pp.evaluate(function () {
    return { vt: window.__vt, input: document.getElementById('stageInput').style.display };
  });
  check('C9 planner 阶段切换走了 View Transition', pl.vt >= 1, '__vt=' + pl.vt);
  check('C10 走了转场之后结果页照旧渲染（VT 不能把改动吞掉）', pl.stage === 'block' && pl.days >= 1, 'display=' + pl.stage + ' 日卡=' + pl.days);
  check('C11 返回键回输入页同样走转场且真的切回去了', plBack.vt > pl.vt && plBack.input === 'block', '__vt=' + plBack.vt + ' display=' + plBack.input);

  const tp = await newPage(browser, { errors: errs });
  await tp.goto(BASE + '/topic.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(1400);
  await tp.evaluate(PATCH_VT);
  const tnOpen = await tp.evaluate(async function () {
    const v0 = window.__vt;
    TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城' });
    await new Promise(function (r) { setTimeout(r, 260); });
    const p = document.querySelector('.tn-panel'), m = document.querySelector('.tn-mask');
    /* 开态必须在点关闭键之前读：p 是元素引用，读晚了拿到的是关掉之后的值 */
    const open = { display: p ? p.style.display : 'no panel', mask: m ? m.style.display : 'no mask' };
    const v1 = window.__vt;
    const x = document.getElementById('tnX');
    if (x) x.click(); else return { err: 'no #tnX' };
    await new Promise(function (r) { setTimeout(r, 260); });
    return { openVt: v1 - v0, closeVt: window.__vt - v1,
      openDisplay: open.display, maskDisplay: open.mask, afterClose: p ? p.style.display : 'gone' };
  });
  check('C12 随手记面板开合各走一次转场', tnOpen.openVt >= 1 && tnOpen.closeVt >= 1, '开=' + tnOpen.openVt + ' 关=' + tnOpen.closeVt);
  check('C13 开面板时面板与遮罩真的显形、关掉真的消失', tnOpen.openDisplay === 'flex' && tnOpen.maskDisplay === 'block' && tnOpen.afterClose === 'none',
    '开=' + tnOpen.openDisplay + '/' + tnOpen.maskDisplay + ' 关=' + tnOpen.afterClose);

  /* ================= B · 系统「减弱动态效果」 ================= */
  const pr = await newPage(browser, { errors: errs });
  await pr.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pr.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(900);
  const b = await pr.evaluate(function () {
    const __o = Document.prototype.startViewTransition; window.__vt = 0; Document.prototype.startViewTransition = function (f) { window.__vt++; return __o.call(this, f); };
    const mk = function (cls) { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; };
    const tst = mk('ui-toast'), sk = mk('skeleton'), st = mk('fade-stagger');
    st.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
    const num = function (v) { const t = '' + v; return t.indexOf('ms') >= 0 ? parseFloat(t) : t.indexOf('s') >= 0 ? parseFloat(t) * 1000 : 0; };
    const o = {
      reduced: UI.reducedMotion(),
      motion: UI.motionMs('normal', 999),
      scroll: UI.scrollBehavior(),
      toastDur: getComputedStyle(tst).transitionDuration,
      skel: getComputedStyle(sk).animationDuration + ' / ' + getComputedStyle(sk).animationIterationCount,
      stagger8: getComputedStyle(st.children[7]).animationDelay,
      htmlScroll: getComputedStyle(document.documentElement).scrollBehavior,
      vtCalls: (function () { const v0 = window.__vt; let ran = 0; UI.vt(function () { ran++; }); return { calls: window.__vt - v0, ran: ran }; })()
    };
    tst.remove(); sk.remove(); st.remove();
    return o;
  });
  const slow = await pr.evaluate(SCAN_SLOW);
  check('B1 减动效档读得到（UI.reducedMotion = true）', b.reduced === true);
  check('B2 JS 侧时序同步归零（toast 不再空等 280ms 才移除）', b.motion === 0, String(b.motion));
  check('B3 滚动改直落：UI.scrollBehavior() = auto', b.scroll === 'auto' && b.htmlScroll === 'auto', b.scroll + ' / html=' + b.htmlScroll);
  check('B4 CSS 退场压到 1 帧内：.ui-toast transition-duration', parseFloat(b.toastDur) * 1000 <= 1, b.toastDur);
  check('B5 常驻循环也停：.skeleton 时长 1 帧内且只跑 1 遍', /\/ 1$/.test(b.skel) && parseFloat(b.skel) * 1000 <= 1, b.skel);
  check('B6 delay 同样归零（否则减动效下元素先空等一拍再出现）', parseFloat(b.stagger8) * 1000 <= 1, b.stagger8);
  check('B7 减动效下 UI.vt 不调 startViewTransition，但改动照样执行', b.vtCalls.calls === 0 && b.vtCalls.ran === 1, 'calls=' + b.vtCalls.calls + ' ran=' + b.vtCalls.ran);
  check('B8 验收口径「所有动画时长 ≤1 帧」实测：全页元素无超帧（含 vendor leaflet 的动画）', slow.length === 0, slow.join(' | ') || '0 个');

  /* ================= D · file:// 降级（APK 壳的环境） ================= */
  const pf = await newPage(browser, { errors: errs });
  await pf.evaluateOnNewDocument(function (trip) {
    try {
      localStorage.setItem('tn_trips', JSON.stringify(trip));
      localStorage.setItem('tn_planner_weather', '0');
    } catch (e) { window.__lsErr = '' + e.message; }
  }, TRIP);
  await pf.goto(FILE + 'planner.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(1400);
  const dcatch = await pf.evaluate(function () {
    try { UI.vt(function () { document.getElementById('stageResult').style.display = 'block'; }); return []; }
    catch (e) { return ['vt:' + e.message]; }
  });
  await pf.evaluate(function () { window.plannerOpenTrip(0); });
  await sleep(700);
  const d = await pf.evaluate(function () {
    return { stage: document.getElementById('stageResult').style.display, days: document.querySelectorAll('#resultBody .day-card').length,
      ls: window.__lsErr || '' };
  });
  check('D1 file:// 下 planner 阶段切换照常生效（转场不支持也不能影响功能）', d.stage === 'block' && d.days >= 1, 'display=' + d.stage + ' 日卡=' + d.days + (d.ls ? ' 存储=' + d.ls : ''));
  check('D2 file:// 下 UI.vt 不抛（异常数组为空）', dcatch.length === 0, dcatch.join(' | ') || '无异常');
  await pf.goto(FILE + 'index.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(900);
  await pf.evaluate(function () { location.href = 'topic.html'; });
  await sleep(1200);
  const durl = await pf.evaluate(function () { return location.href; });
  check('D3 file:// 下跨文档导航到达（@view-transition 在 opaque origin 不许拦路）', /topic\.html$/.test(durl), durl);

  /* ================= E · 节点入场动画 × 标签避让 ================= */
  /* .tr-node 的入场动画从 scale(.6) 起（design.css:939–940，--motion-enter:480ms），
     而 labelAvoid/capsuleAvoid 用 getBoundingClientRect 判重叠。避让若跑在动画进行中，
     量到的是缩过 0.6 倍的盒子 → 该隐藏的标签漏隐藏，首屏留下叠字；
     像素闸门 topic.1440/768 的 0.02%/0.05% 双态就是这个竞态（同一份代码两种终态）。
     这一档故意用**正常动效**跑：480ms 的窗口足够宽，漏挂补测必挂。 */
  const pe = await newPage(browser, { errors: errs });
  /* 390 档 LOD 只到聚合胶囊，一个 .node-label 都没有 → E1/E2 会因"没东西可测"假绿。
     桌面宽才落到节点层（实测 452 档标签 0 个、768 档 24 个）。 */
  await pe.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await pe.goto(BASE + '/topic.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(2600);
  const e1 = await pe.evaluate(function () {
    const vis = [].slice.call(document.querySelectorAll('.node-label')).filter(function (x) { return !x.classList.contains('hidden'); });
    const R = vis.map(function (x) { return x.getBoundingClientRect(); });
    const pairs = [];
    for (var i = 0; i < R.length; i++) for (var j = i + 1; j < R.length; j++) {
      var a = R[i], b = R[j];
      if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) pairs.push(vis[i].textContent + '×' + vis[j].textContent);
    }
    return { labels: document.querySelectorAll('.node-label').length, hidden: document.querySelectorAll('.node-label.hidden').length, pairs: pairs };
  });
  check('E1 地图标签确实渲染出来了（0 个标签会让 E2 假绿）', e1.labels >= 8, '标签=' + e1.labels);
  check('E2 避让真的动过手：至少隐藏 1 个重叠标签（正向对照）', e1.hidden >= 1, '隐藏=' + e1.hidden);
  check('E3 动画全部结束后，可见标签两两不重叠', e1.pairs.length === 0, e1.pairs.slice(0, 3).join(' ,') || '0 对');
  /* E4 视野变化之后：光量几何会被假绿——实测 zoomIn 之后标签互相散开，隐藏数归 0、
     一对重叠都量不出来，摘掉补测照样绿。所以取 zoomOut（标签互相靠拢，才暴露漏补测），
     并且同时要求「避让确实又被调过一次」。
     取样时机必须是**入场动画全部结束之后**，不是固定 900ms：`tools/out/probe-e4-timeline.js`
     实测 zoomOut 之后 +700/+900ms 那两帧有 37 个节点还在跑 node-fade-in（避让此时量到的仍是
     0.6 倍盒）→ 重叠 2 对；+1400ms 动画跑完、animationend 那条补测路生效才归 0。
     固定 900ms 等于拿中间态当终态——同一份代码一次绿一次红，变异自测的"打死"也就成了撞运气。 */
  const e4 = await pe.evaluate(async function () {
    window.__la = 0;
    const real = window.labelAvoid;
    window.labelAvoid = function () { window.__la++; return real.apply(this, arguments); };
    const running = function () {
      return [].slice.call(document.querySelectorAll('.tr-node,.mem-node')).some(function (el) {
        return el.getAnimations && el.getAnimations().some(function (a) {
          return a.animationName === 'node-fade-in' && a.playState === 'running';
        });
      });
    };
    document.getElementById('zoomOut').click();
    let waited = 0, sawRun = 0;
    while (waited < 5000) {
      if (running()) sawRun = 1;
      else if (sawRun || waited >= 800) break;   /* 没观察到动画也要给 zoomend 一点时间，别把"没跑到"当成"跑完了" */
      await new Promise(function (r) { setTimeout(r, 50); }); waited += 50;
    }
    await new Promise(function (r) { setTimeout(r, 250); });
    const vis = [].slice.call(document.querySelectorAll('.node-label')).filter(function (x) { return !x.classList.contains('hidden'); });
    const R = vis.map(function (x) { return x.getBoundingClientRect(); });
    let n = 0;
    for (var i = 0; i < R.length; i++) for (var j = i + 1; j < R.length; j++) {
      const a = R[i], b = R[j];
      if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) n++;
    }
    return { calls: window.__la, n: n, waited: waited, hidden: document.querySelectorAll('.node-label.hidden').length };
  });
  check('E4 缩小视野后补测真的又跑过、且可见标签仍不重叠', e4.calls >= 1 && e4.n === 0,
    '避让被调 ' + e4.calls + ' 次 / 重叠 ' + e4.n + ' 对 / 隐藏 ' + e4.hidden + '（等动画跑完用了 ' + e4.waited + 'ms）');

  check('D4 全程无页面未捕获异常', errs.length === 0, errs.slice(0, 3).join(' | ') || '0 条');

  await browser.close();
  server.close();
  console.log('\nsmoke-motion: ' + results.length + ' 项，失败 ' + failures);
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  console.log('smoke-motion 崩了: ' + (e && e.stack || e));
  try { server.close(); } catch (e2) {}
  process.exit(2);
});
