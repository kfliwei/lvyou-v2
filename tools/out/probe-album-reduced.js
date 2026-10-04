/* 探针：album 封面「向下翻阅」提示在 reduced-motion 截图里为什么变暗。
   现象：批次 11-A 把 `animation:alScroll 2.4s …` 换成 `var(--motion-boot)` 后，visual-check 的
   album.seed 稳定差 0.06%——那块文字整体变暗（最亮像素 199 → 106，即 opacity .8 → .35，
   正好是 alScroll 的 0%/100% 关键帧值）。
   已排除：计算值层面减动效覆盖是生效的（animation-duration 1e-05s / iteration-count 1 / opacity .8），
   且不带 visual-check 环境桩时截图也是 199。所以这里逐项复刻 visual-check 的环境再关掉，
   看是哪一项把动画拉回 .35。跑法：node tools/out/probe-album-reduced.js [--no-clock|--no-block] */
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const pg = await b.newPage();
  /* 逐项复刻 visual-check 的环境，再一项项关掉，看哪一项让提示从 .8 掉到 .35 */
  const NO_CLOCK = process.argv.includes('--no-clock');
  const NO_BLOCK = process.argv.includes('--no-block');
  if (!NO_BLOCK) {
    await pg.setRequestInterception(true);
    pg.on('request', req => {
      const u = req.url();
      if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
      req.continue().catch(() => {});
    });
  }
  const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;
  if (!NO_CLOCK) await pg.evaluateOnNewDocument(CLOCK);
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  /* 封面只在有游记时渲染：先按 visual-check 同一口径灌种子数据 */
  await pg.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
  await pg.evaluate(async () => { const r = window.loadTestData && window.loadTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
  /* visual-check 的 --seed 顺序是 review → album，且 review 那张先截了一次。
     这一步单独试：它是不是让 album 的截图把动画"定格"到了关键帧上。 */
  if (process.argv.includes('--with-review')) {
    await pg.goto('file:///' + path.join(ROOT, 'review.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1400));
    await pg.screenshot({ type: 'png', animations: 'disabled' });
  }
  await pg.goto('file:///' + path.join(ROOT, 'album.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  /* 顺序本身就是变量：先截图、不做任何 evaluate，再读计算值、再截一次。
     若第一张是 .35、第二张是 .8，说明差的是「主线程有没有被 getComputedStyle 推过一帧」。 */
  {
    const PNG = require('pngjs').PNG;
    const lum = buf => { const p = PNG.sync.read(buf); let mx = 0;
      for (let y = 1600; y < 1660; y++) for (let x = 300; x < 470; x++) {
        const i = ((p.width * y) + x) << 2; const l = p.data[i] * 0.299 + p.data[i + 1] * 0.587 + p.data[i + 2] * 0.114;
        if (l > mx) mx = l; } return mx; };
    const first = await lum(await pg.screenshot({ type: 'png', animations: 'disabled' }));
    const cs = await pg.evaluate(() => { const e = getComputedStyle(document.querySelector('.al-cover__scroll')); return e.opacity + ' / ' + e.animationDuration; });
    const second = await lum(await pg.screenshot({ type: 'png', animations: 'disabled' }));
    console.log('第一张最亮 ' + first.toFixed(0) + ' → 读计算值 ' + cs + ' → 第二张最亮 ' + second.toFixed(0));
  }
  const out = await pg.evaluate(() => {
    const el = document.querySelector('.al-cover__scroll');
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    /* 现场再补一条纯字面量写法，量同族长写是否受影响 */
    el.style.animation = 'alScroll 2.4s ease-in-out infinite';
    const cs2 = getComputedStyle(el);
    return {
      inlineNone: cs.animationName + ' / ' + cs.animationDuration + ' / ' + cs.animationIterationCount + ' / opacity ' + cs.opacity,
      afterLiteral: cs2.animationName + ' / ' + cs2.animationDuration + ' / ' + cs2.animationIterationCount + ' / opacity ' + cs2.opacity,
      motionNone: getComputedStyle(document.documentElement).getPropertyValue('--motion-none'),
      motionBoot: getComputedStyle(document.documentElement).getPropertyValue('--motion-boot'),
      api: !!(window.getAnimations && el.getAnimations)
    };
  });
  console.log(JSON.stringify(out, null, 2));
  /* 真跑一遍 getAnimations：减动效下这条动画不该还在跑 */
  const live = await pg.evaluate(() => {
    const el = document.querySelector('.al-cover__scroll');
    return (el.getAnimations() || []).map(a => ({ playState: a.playState, dur: a.effect && a.effect.getTiming().duration }));
  });
  console.log('getAnimations: ' + JSON.stringify(live));
  console.log('UA: ' + await pg.evaluate(() => navigator.userAgent));
  await pg.evaluate(() => { document.querySelector('.al-cover__scroll').style.animation = ''; });
  /* 决定性一步：同一页面分别用 animations:'disabled' / 'allow' 各截一张，量提示那块的最亮像素。
     .8 → 240·.8 上下（实测基线最亮 199），.35 → 约 105。 */
  const lum = async (f) => {
    const PNG = require('pngjs').PNG;
    const buf = await pg.screenshot(f);
    const p = PNG.sync.read(buf);
    let mx = 0;
    for (let y = 1600; y < 1660; y++) for (let x = 300; x < 470; x++) {
      const i = ((p.width * y) + x) << 2;
      const l = p.data[i] * 0.299 + p.data[i + 1] * 0.587 + p.data[i + 2] * 0.114;
      if (l > mx) mx = l;
    }
    return mx;
  };
  console.log('最亮像素 animations:disabled → ' + (await lum({ type: 'png', animations: 'disabled' })).toFixed(0)
    + ' · allow → ' + (await lum({ type: 'png', animations: 'allow' })).toFixed(0));
  await b.close();
})().catch(e => { console.log('ERR ' + e.message); process.exit(1); });
