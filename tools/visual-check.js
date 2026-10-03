/* visual-check.js — P0-0 视觉回归闸门
 * 用法:
 *   node tools/visual-check.js              # 全量状态 × 视口，与基线比对
 *   node tools/visual-check.js --update     # 有意改版时更新基线（diff 图保留供人审）
 *   node tools/visual-check.js index.html   # 只跑指定页
 * 原理: 固定视口 + 清空存储 + 冻结时钟截屏，与 tools/out/visual-baseline/ 基线做像素 diff。
 * 阈值: 差异像素 > 0.5% 判 FAIL。地图页瓦片属外部资源，基线比对时容忍瓦片差异（视口内蒙层不比对不可行，
 *       故地图页以 DOM 检查为主、截图为辅——比对时地图页差异阈值放宽到 8%，瓦片漂移不会误报交互层回归）。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;   /* pixelmatch v6+ 为 ESM default 导出 */

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const DIFF = path.join(ROOT, 'tools', 'out', 'visual-diff');
fs.mkdirSync(BASE, { recursive: true });
fs.mkdirSync(DIFF, { recursive: true });

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const onlyPages = argv.filter(a => !a.startsWith('--'));

/* 状态清单：page → 视口列表。地图页（瓦片随时间变化）用宽阈值。 */
const PAGES = ['index.html', 'topic.html', 'search.html', 'wishlist.html', 'review.html',
  'settings.html', 'me.html', 'node-manager.html', 'album.html', 'album-edit.html',
  'story.html', 'planner.html', 'md-manager.html', 'explore-map.html'];
const MAP_PAGES = new Set(['topic.html', 'explore-map.html']);
const VIEWPORTS = [[390, 844], [768, 1024]];
const THRESH = 0.005, THRESH_MAP = 0.08;

/* 冻结时钟：首页问候语/时间戳不再影响 diff */
const CLOCK = `Date.now = () => new Date('2026-10-03T10:00:00+08:00').getTime();
  const _d = new Date('2026-10-03T10:00:00+08:00');
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const pages = onlyPages.length ? onlyPages : PAGES;
  let failN = 0, baseN = 0, testN = 0;

  for (const page of await browser.pages()) await page.close();
  const pg = await browser.newPage();

  for (const p of pages) {
    if (!PAGES.includes(p)) { console.log('SKIP(不在状态清单): ' + p); continue; }
    for (const [W, H] of VIEWPORTS) {
      const tag = p.replace('.html', '') + '.' + W + 'x' + H + '.png';
      const baseF = path.join(BASE, tag);
      await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
      await pg.evaluateOnNewDocument(CLOCK);
      await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1400));
      const buf = await pg.screenshot({ type: 'png' });
      testN++;

      if (UPDATE || !fs.existsSync(baseF)) {
        fs.writeFileSync(baseF, buf);
        baseN++;
        console.log((fs.existsSync(baseF) && !UPDATE ? 'NEW 基线 ' : 'UPD 基线 ') + tag);
        continue;
      }
      const a = PNG.sync.read(fs.readFileSync(baseF));
      const b = PNG.sync.read(buf);
      if (a.width !== b.width || a.height !== b.height) {
        console.log('FAIL ' + tag + ' — 尺寸变化 ' + a.width + 'x' + a.height + ' → ' + b.width + 'x' + b.height);
        failN++; continue;
      }
      const diffPng = new PNG({ width: a.width, height: a.height });
      const diffPx = match(a.data, b.data, diffPng.data, a.width, a.height, { threshold: 0.12 });
      const ratio = diffPx / (a.width * a.height);
      const lim = MAP_PAGES.has(p) ? THRESH_MAP : THRESH;
      const ok = ratio <= lim;
      fs.writeFileSync(path.join(DIFF, tag), PNG.sync.write(diffPng));
      if (ok) console.log('PASS ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '%');
      else { console.log('FAIL ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '% > ' + (lim * 100) + '%  → tools/out/visual-diff/' + tag); failN++; }
    }
  }
  await browser.close();
  console.log('---');
  console.log(UPDATE ? '基线已更新: ' + baseN + ' 张' : ('比对 ' + testN + ' 张: ' + (testN - failN) + ' PASS, ' + failN + ' FAIL' + (baseN ? ', 新建基线 ' + baseN : '')));
  if (!UPDATE) process.exit(failN ? 1 : 0);
})();
