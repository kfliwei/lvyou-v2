/* probe32-fold.js — 批次 32 的「基线要不要重拍」判据探针
 * 只读那一跑（tools/out/b32-baseline-readonly1.txt）读到 109 张全 0.00%，而本批确实改了页面上的字：
 *   ① settings.html:248 那颗按钮「清除全部数据」→「清除全部游记」；② 云同步卡片那颗上传钮的两段式文案；
 *   ③ 录音面板新增的 .tn-cfm 确认层（travel-notes.js）。
 * 三种解释必须先分开：
 *   A 像素腿对改字失明（那 109 张全是假绿灯）；
 *   B 改的东西根本不在取景框里（settings 那两处要滚到 1815px/2538px 才露脸；面板在 index 静止态不存在）；
 *   C 基线截图是 viewport 尺寸、不带 fullPage（visual-check.js:312），所以「首屏之外」＝结构性不在帧内。
 * 判据两条，缺一不算：
 *   · 噪声地板：同页同档连拍两张、DOM 一字不改 → 必须 0（证明两跑之间有可比性）；
 *   · 信号地板：同页同档只把**取景框内**的一个字换掉 → 必须 >0（证明像素腿看得见字）。
 *   两条一起才叫「109 张 0.00% 是取景外，不是失明」。
 * 第一版探针栽在两处（读数 tools/out/b32-probe-fold.txt 里那行「『null』→『null』 0.4053%」）：
 *   ① 控制组与大档位测量写在 goto(index.html) 之后、还用 reload()，等于在错的文档上量；
 *   ② 没继承基线的冻结口径（CLOCK 桩 + 拦 http + prefers-reduced-motion），静止态自己就飘 0.4%。
 *   现在两件事一起修：整页 setup 抄 visual-check.js:181/194-211/272-278，每次换档一律重新 goto。
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe32-fold.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* 与 tools/visual-check.js:35 VIEWPORTS 逐档对齐——六档全量，缺档就等于范围证明有洞 */
const VIEWPORTS = [[320, 640], [328, 723], [390, 844], [452, 995], [768, 1024], [1440, 900]];

/* 抄 visual-check.js:158 CLOCK——同款桩，噪声地板才和基线那跑同口径 */
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

const pm = require('pixelmatch');
const match = pm.default || pm;
const { PNG } = require('pngjs');

const shotDiff = async (p, bufA, bufB) => {
  const A = PNG.sync.read(bufA), B = PNG.sync.read(bufB);
  const changed = match(A.data, B.data, null, A.width, A.height, { threshold: 0.02 });
  return { changed: changed, pct: 100 * changed / (A.width * A.height), dims: A.width + 'x' + A.height };
};

/* 页内读数：本批改过的三处可见面，各自在不在取景框内 */
const READ = () => {
  const inFrame = r => r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
  const q = sel => { const e = document.querySelector(sel); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26),
      top: Math.round(r.top), h: Math.round(r.height), inFrame: inFrame(r) }; };
  const clear = Array.from(document.querySelectorAll('.data-acts button'))
    .find(x => /清除全部/.test(x.textContent));
  /* 找一个「确实在框内、又是文字节点」的落点给控制组用：标题族里第一个整行落在视口内的 */
  let ctrl = null;
  document.querySelectorAll('.group-title, .group-sub, .brand, .appbar__title, h1, h2').forEach(el => {
    if (ctrl) return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight && (el.textContent || '').trim().length >= 2) {
      ctrl = { sel: el.className || el.tagName, txt: el.textContent.trim().slice(0, 12) };
      el.setAttribute('data-ctrl', '1');
    }
  });
  return {
    vh: window.innerHeight, scrollY: Math.round(window.scrollY), docH: document.body.scrollHeight,
    clear: clear ? (r => ({ txt: clear.textContent.trim().replace(/\s+/g, ' '), top: Math.round(r.top),
      h: Math.round(r.height), inFrame: inFrame(r) }))(clear.getBoundingClientRect()) : null,
    push: q('#wdPushBtn'), pull: q('#wdPullBtn'), ctrl,
    panel: q('#tnPanel'), cfm: document.querySelectorAll('.tn-cfm').length,
    tnNodes: document.querySelectorAll('[class^="tn-"],[class*=" tn-"]').length,
    toasts: document.querySelectorAll('.ui-toast, #nmTip, .toast, .ui-tilewarn').length
  };
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const p = await b.newPage();

  /* —— 与基线完全同款的环境：拦 http、破首启蒙层、钉时钟、减动效 —— */
  await p.setRequestInterception(true);
  p.on('request', req => {
    const u = req.url();
    if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p.evaluateOnNewDocument(CLOCK);
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const gotoSettle = async (file, W, H) => {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await p.goto(pathToFileURL(path.join(ROOT, file)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1400));            /* 基线 SETTLE 同值 */
  };

  /* ========== ① settings 六档：本批改的字在不在取景框内 ========== */
  console.log('=== settings.html 逐档取景范围证明（改后代码）===');
  const bigShots = {};
  for (const [W, H] of VIEWPORTS) {
    await gotoSettle('settings.html', W, H);
    const g = await p.evaluate(READ);
    const f = (x) => x ? ('top=' + x.top + ' h=' + x.h + ' → ' + (x.inFrame ? '在帧内' : '不在帧内')) : '节点不存在';
    console.log(W + 'x' + H + '（视口高 ' + g.vh + '，scrollY=' + g.scrollY + '，文档高 ' + g.docH + '）');
    console.log('   「' + (g.clear ? g.clear.txt : '(无)') + '」 ' + f(g.clear && { top: g.clear.top, h: g.clear.h, inFrame: g.clear.inFrame }));
    console.log('   「' + (g.push ? g.push.txt : '(无)') + '」 ' + f(g.push));
    console.log('   ' + (g.pull ? '「' + g.pull.txt + '」 ' + f(g.pull) : ''));
    console.log('   控制组落点: ' + (g.ctrl ? g.ctrl.sel + '「' + g.ctrl.txt + '」' : '框内找不到可改的标题（这一档跳控制组）'));
    console.log('   面板节点: #tnPanel ' + (g.panel ? f(g.panel) : '不存在') + '，.tn-cfm 数=' + g.cfm +
      '，tn-* 数=' + g.tnNodes + '，toast 数=' + g.toasts);
    /* 噪声地板要在「本批改的字不在帧内」的档上量才有意义：拿 328 与 1440 两档各拍一对 */
    if (W === 328 || W === 1440) bigShots[W] = await p.screenshot({ type: 'png', animations: 'disabled' });
  }

  /* ========== ② 噪声地板：同页同档连拍两张，DOM 一字不改 ========== */
  console.log('\n=== 噪声地板（同页同档连拍两张，不改任何东西）——必须 0 ===');
  await gotoSettle('settings.html', 328, 723);
  const nA = await p.screenshot({ type: 'png', animations: 'disabled' });
  const nB = await p.screenshot({ type: 'png', animations: 'disabled' });
  const nd = await shotDiff(p, nA, nB);
  console.log('328x723 settings 零改动两拍: 色差 ' + nd.changed + ' 像素 = ' + nd.pct.toFixed(4) + '%（图 ' + nd.dims + '）→ ' +
    (nd.changed === 0 ? '噪声为 0，两跑有可比性' : '噪声非 0，说明这一族的 0.00% 是靠阈值而非确定性，判定要另配'));

  /* ========== ③ 信号地板：只把取景框内的一个字换掉，diff 必须量得出来 ========== */
  console.log('\n=== 信号地板（同页同档改框内一个字）——必须 >0，否则像素腿对字失明 ===');
  for (const [W, H] of [[328, 723], [768, 1024], [1440, 900]]) {
    await gotoSettle('settings.html', W, H);
    const before = await p.screenshot({ type: 'png', animations: 'disabled' });
    const n = await p.evaluate(() => {
      const el = document.querySelector('[data-ctrl]') ||
        Array.from(document.querySelectorAll('.group-title,.group-sub,h1,h2')).find(e => {
          const r = e.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight && (e.textContent || '').trim().length >= 2;
        });
      if (!el) return null;
      const old = el.textContent;
      el.textContent = old.slice(0, old.length - 1) + '傺';    /* 只换最后一个字，行宽不变 */
      return { old: old, now: el.textContent };
    });
    const after = await p.screenshot({ type: 'png', animations: 'disabled' });
    const d = await shotDiff(p, before, after);
    console.log(W + 'x' + H + ' 改一个字: ' + (n ? ('「' + n.old + '」→「' + n.now + '」') : '(落点缺失)') +
      ' → 色差 ' + d.changed + ' 像素 = ' + d.pct.toFixed(4) + '%  ' +
      (d.changed > 0 ? '✔ 像素腿看得见字' : '✘ 失明——那 109 张 0.00% 全是假绿灯'));
  }

  /* ========== ④ index 静止态：录音面板与新增确认层压根不在这份 DOM 里 ========== */
  console.log('\n=== index.html 静止态（面板不打开）===');
  await gotoSettle('index.html', 328, 723);
  const i = await p.evaluate(READ);
  console.log('#tnPanel ' + (i.panel ? ('disp/尺寸 ' + JSON.stringify(i.panel)) : '不存在（null）') +
    ' | .tn-cfm 节点数=' + i.cfm + ' | 全站 tn-* 节点数=' + i.tnNodes +
    '（0＝录音面板不在这份 DOM 里，任何基线帧都拍不到它，本批新增的确认层自然也不可能改变像素）');

  /* ========== ⑤ 反向自证：真把面板打开，确认层在不在帧内 ========== */
  console.log('\n=== index.html 打开录音面板后（本批新增的 .tn-cfm 会不会进帧）===');
  const opened = await p.evaluate(() => {
    try {
      if (window.TravelNotes && window.TravelNotes.openPanel) { window.TravelNotes.openPanel({ lat: 0, lng: 0, place: '探针点' }); return 'openPanel()'; }
      const btn = document.querySelector('#tnFloat, .tn-fab, [data-act="note"]');
      if (btn) { btn.click(); return 'click ' + (btn.id || btn.className); }
      return 'no-entry';
    } catch (e) { return 'ERR ' + e.message; }
  });
  await new Promise(r => setTimeout(r, 900));
  const o = await p.evaluate(READ);
  console.log('入口: ' + opened + ' → #tnPanel ' + (o.panel ? JSON.stringify(o.panel) : 'null') +
    ' | .tn-cfm 节点数=' + o.cfm + ' | tn-* 节点数=' + o.tnNodes);
  console.log('（.tn-cfm 只在脏内容关闭时才挂载；静止/刚开面板读到 0 是预期的——登记为「面板需先有内容才可能出现，基线 109 态里没有任何一态走到这条路径」）');

  await b.close();
})().catch(e => { console.log('PROBE_FAIL ' + (e && e.message)); process.exit(1); });
