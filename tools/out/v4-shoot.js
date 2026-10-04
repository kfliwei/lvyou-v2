/* UI-4 · 实景图拍摄器：只拍「真有照片」的那几处表面，改前/改后各拍一趟出对比图
 * 用法: NODE_PATH=… node tools/out/v4-shoot.js 452x995 v4-before-452
 * 存在的理由：visual-check 的默认态是地图/空库，实景照一处都不在画面里；vp-shoot 也只拍首屏。
 *   这一轮要判断「压色 + 内描边」到底统一没统一，必须把 .card .ph / .ls-img / .trip-feature__img /
 *   .al-ch-img / .photo-wall img 五类表面都拉进画面，所以要在页面里做交互（切列表、开面板、灌种子数据）。
 * 前置态与 vp-shoot / visual-check 一致：跳引导、冻时钟、钉 reduced-motion、拦外网（只吃本地镜像图）。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [WH, TAG] = process.argv.slice(2);
const [W, H] = WH.split('x').map(Number);
const OUT = path.join(ROOT, 'tools', 'out', 'shots', TAG);
fs.mkdirSync(OUT, { recursive: true });

const CLOCK = `const __T = new Date('2026-10-04T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); });
  Math.random = (function () { var s = 20261004; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  const url = f => pathToFileURL(path.join(ROOT, f)).href;
  const shot = async name => {
    const f = path.join(OUT, name + '.' + W + 'x' + H + '.png');
    await pg.screenshot({ path: f });
    const imgs = await pg.evaluate(() => {
      const live = [].slice.call(document.images).filter(i => i.getBoundingClientRect().width > 0);
      return {
        loaded: live.filter(i => i.complete && i.naturalWidth > 0).length,
        total: live.length,
        wide: live.filter(i => i.naturalWidth > 200).slice(0, 6).map(i => {
          const r = i.getBoundingClientRect(), cs = getComputedStyle(i);
          return Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (i.currentSrc || i.src).split('/').pop() +
            ' filter=' + cs.filter + ' shadow=' + cs.boxShadow.slice(0, 40);
        })
      };
    });
    console.log('SHOT ' + name + ' 图=' + imgs.loaded + '/' + imgs.total);
    imgs.wide.forEach(s => console.log('     ' + s));
  };

  /* ① 专题页列表态：.card .ph 56px 缩略图（75 处有本地镜像实景照，其余是 images/s{N}.svg 生成图） */
  await pg.goto(url('topic.html'), { waitUntil: 'networkidle2', timeout: 40000 });
  await wait(5000);
  await pg.evaluate(() => { var b = document.querySelector('[data-tab="list"]'); b && b.click(); });
  await wait(2500);
  const hit = await pg.evaluate(() => {
    var im = [].slice.call(document.querySelectorAll('.card .ph img'))
      .filter(i => i.getAttribute('src').indexOf('images/sites/') === 0);
    if (!im.length) return 0;
    im[0].scrollIntoView({ block: 'center' });
    return im.length;
  });
  console.log('LIST 实景照缩略图 ' + hit + ' 张（已滚到第一张）');
  await wait(1500);
  await shot('topic-list');

  /* ② 专题页详情面板：.ls-img 封面（aspect-ratio var(--ar-cover)） */
  const sheet = await pg.evaluate(() => {
    var T = window.TopicEngine, S = window.SITES || [], map = window.SITE_IMAGES_LOCAL || {};
    if (!T || !T.openSheet) return 'no TopicEngine.openSheet';
    for (var i = 0; i < S.length; i++) if (S[i] && map[S[i].name]) { T.openSheet(i); return S[i].name; }
    return 'no site with local photo';
  });
  console.log('SHEET ' + sheet);
  await wait(2500);
  await shot('topic-sheet');

  /* ③ 种子数据态：首页精选大图 .trip-feature__img / 相册 .al-ch-img / 随笔墙 .photo-wall img
        （种子图是 art/photo-*.svg 生成图，但表面样式与真照片同一条，压色一致才谈得上统一） */
  await pg.goto(url('index.html'), { waitUntil: 'networkidle2', timeout: 40000 });
  await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
  await pg.evaluate(async () => { const r = window.loadTestData && window.loadTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
  for (const p of ['index.html', 'album.html', 'md-manager.html']) {
    await pg.goto(url(p), { waitUntil: 'networkidle2', timeout: 40000 });
    await wait(2500);
    await shot(p.replace('.html', '') + (p === 'index.html' ? '' : '.seed'));
  }
  await browser.close();
})().catch(e => { console.error('SHOOT_FAIL ' + e.message); process.exit(1); });
