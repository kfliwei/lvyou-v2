/* vp-shoot.js — 真机档对比拍摄器（与 visual-check 同一前置态：跳引导 / 冻时钟 / 钉减动效 / 拦外网）
 * 用法: NODE_PATH=… node tools/vp-shoot.js <W>x<H> <tag> [page…]
 * 存在的理由：tools/shot.js 不写 tn_onboarded，拍出来是首启引导蒙层，比不了页面本体；
 * 而 visual-check.js 的视口表是固定的，改前/改后要跨两棵工作树拍，需要能指定输出目录。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [WH, TAG, ...PAGES] = process.argv.slice(2);
const [W, H] = WH.split('x').map(Number);
const pages = PAGES.length ? PAGES : ['index.html', 'review.html', 'topic.html', 'planner.html', 'search.html'];
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

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  for (const p of pages) {
    await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1600));
    const f = path.join(OUT, p.replace('.html', '') + '.' + W + 'x' + H + '.png');
    await pg.screenshot({ path: f });
    const m = await pg.evaluate(() => ({
      root: getComputedStyle(document.documentElement).fontSize,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      n: document.querySelectorAll('body *').length
    }));
    console.log('OK ' + path.basename(f) + '  根字号 ' + m.root + '  横向溢出 ' + m.over + 'px  节点 ' + m.n);
  }
  await browser.close();
})();
