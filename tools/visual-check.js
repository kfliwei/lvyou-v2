/* visual-check.js — P0-0 视觉回归闸门
 * 用法:
 *   node tools/visual-check.js              # 全量状态 × 视口，与基线比对
 *   node tools/visual-check.js --update     # 有意改版时更新基线（diff 图保留供人审）
 *   node tools/visual-check.js index.html   # 只跑指定页
 * 原理: 固定视口 + 清空存储 + 冻结时钟截屏，与 tools/out/visual-baseline/ 基线做像素 diff。
 * 阈值: 差异像素 > 0.5% 判 FAIL。地图页瓦片属外部资源，基线比对时容忍瓦片差异（视口内蒙层不比对不可行，
 *       故地图页以 DOM 检查为主、截图为辅——比对时地图页差异阈值放宽到 8%，瓦片漂移不会误报交互层回归）。
 * 入库策略: 截图本体（visual-baseline/ 与 visual-diff/ 的 PNG）不入库（见 .gitignore），
 *   入库的是 tools/out/visual-baseline.json（基线指纹清单）与 tools/out/visual-report.json（本次比对报告）。
 *   ⇒ 基线缺失时**判 FAIL 并报错**，不静默重建——否则新克隆上闸门会拿当前的坏状态当真相，永远绿。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;   /* pixelmatch v6+ 为 ESM default 导出 */

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const DIFF = path.join(ROOT, 'tools', 'out', 'visual-diff');
const MANIFEST = path.join(ROOT, 'tools', 'out', 'visual-baseline.json');
const REPORT = path.join(ROOT, 'tools', 'out', 'visual-report.json');
fs.mkdirSync(BASE, { recursive: true });
fs.mkdirSync(DIFF, { recursive: true });

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const REINDEX = argv.includes('--reindex');
const onlyPages = argv.filter(a => !a.startsWith('--'));

/* 状态清单：page → 视口列表。地图页（瓦片随时间变化）用宽阈值。 */
const PAGES = ['index.html', 'topic.html', 'search.html', 'wishlist.html', 'review.html',
  'settings.html', 'me.html', 'node-manager.html', 'album.html', 'album-edit.html',
  'story.html', 'planner.html', 'md-manager.html', 'explore-map.html'];
const MAP_PAGES = new Set(['topic.html', 'explore-map.html']);
const VIEWPORTS = [[390, 844], [768, 1024]];
const THRESH = 0.005, THRESH_MAP = 0.08;

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { return null; }
}
function writeManifest(files) {
  fs.writeFileSync(MANIFEST, JSON.stringify({
    note: '视觉基线指纹清单。截图本体 PNG 不入库；缺文件=闸门失效，visual-check 会判 FAIL。重建：node tools/visual-check.js --update',
    generatedAt: new Date().toISOString(),
    viewports: VIEWPORTS.map(v => v[0] + 'x' + v[1]),
    count: Object.keys(files).length,
    files: files
  }, null, 2));
}

/* 冻结时钟：首页问候语/时间戳不再影响 diff */
const CLOCK = `Date.now = () => new Date('2026-10-03T10:00:00+08:00').getTime();
  const _d = new Date('2026-10-03T10:00:00+08:00');
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });`;

(async () => {
  /* --reindex：把当前基线本体（已人审过的）登记进指纹清单，不重新截图。
     只在首次建立清单或清单丢失时用——它等于承认"现有基线就是真相"。 */
  if (REINDEX) {
    const files = {};
    for (const f of fs.readdirSync(BASE).filter(x => x.endsWith('.png'))) {
      const buf = fs.readFileSync(path.join(BASE, f));
      files[f] = { sha: sha(buf), bytes: buf.length };
    }
    writeManifest(files);
    console.log('已登记基线指纹 ' + Object.keys(files).length + ' 张 → ' + path.relative(ROOT, MANIFEST));
    return;
  }
  const t0 = Date.now();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const pages = onlyPages.length ? onlyPages : PAGES;
  let failN = 0, baseN = 0, testN = 0;
  const manifestOld = readManifest();
  const manifest = (manifestOld && manifestOld.files) ? Object.assign({}, manifestOld.files) : {};
  const report = [];
  const onlyOne = onlyPages.length > 0;

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

      if (UPDATE) {
        fs.writeFileSync(baseF, buf);
        manifest[tag] = { sha: sha(buf), bytes: buf.length };
        baseN++;
        console.log('UPD 基线 ' + tag);
        continue;
      }
      if (!fs.existsSync(baseF)) {
        /* 基线缺失绝不能静默重建：那会让坏状态变成"新的真相"，闸门从此永远绿 */
        console.log('FAIL ' + tag + ' — 基线文件不存在（闸门失效，非视觉问题）。跑 node tools/visual-check.js --update 重建并人审 diff 后提交清单');
        report.push({ state: tag, status: 'no-baseline' });
        failN++; continue;
      }
      const cur = sha(fs.readFileSync(baseF));
      if (manifest[tag] && manifest[tag].sha !== cur) {
        console.log('FAIL ' + tag + ' — 基线本体与入库清单指纹不符（被人手替换或半截 --update）：' + manifest[tag].sha + ' → ' + cur);
        report.push({ state: tag, status: 'baseline-drift', manifestSha: manifest[tag].sha, actualSha: cur });
        failN++; continue;
      }
      if (!manifest[tag]) console.log('NOTE ' + tag + ' — 基线在但清单没登记（--update 时会补上）');
      const a = PNG.sync.read(fs.readFileSync(baseF));
      const b = PNG.sync.read(buf);
      if (a.width !== b.width || a.height !== b.height) {
        console.log('FAIL ' + tag + ' — 尺寸变化 ' + a.width + 'x' + a.height + ' → ' + b.width + 'x' + b.height);
        report.push({ state: tag, status: 'size-change', from: a.width + 'x' + a.height, to: b.width + 'x' + b.height });
        failN++; continue;
      }
      const diffPng = new PNG({ width: a.width, height: a.height });
      const diffPx = match(a.data, b.data, diffPng.data, a.width, a.height, { threshold: 0.12 });
      const ratio = diffPx / (a.width * a.height);
      const lim = MAP_PAGES.has(p) ? THRESH_MAP : THRESH;
      const ok = ratio <= lim;
      fs.writeFileSync(path.join(DIFF, tag), PNG.sync.write(diffPng));
      report.push({ state: tag, status: ok ? 'PASS' : 'FAIL', diffPct: +(ratio * 100).toFixed(3), limitPct: +(lim * 100).toFixed(2) });
      if (ok) console.log('PASS ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '%');
      else { console.log('FAIL ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '% > ' + (lim * 100) + '%  → tools/out/visual-diff/' + tag); failN++; }
    }
  }
  await browser.close();
  const ms = Date.now() - t0;
  /* 单页跑不动改写清单与总报告（只覆盖本次涉及的页，避免半截 --update 把别的基线登记丢掉） */
  if (UPDATE && !onlyOne) writeManifest(manifest);
  fs.writeFileSync(REPORT, JSON.stringify({
    ranAt: new Date().toISOString(), mode: UPDATE ? 'update' : 'check',
    scope: onlyOne ? onlyPages : 'all', viewports: VIEWPORTS.map(v => v[0] + 'x' + v[1]),
    states: testN, fail: failN, elapsedSec: +(ms / 1000).toFixed(1), results: report
  }, null, 2));
  console.log('---');
  console.log('耗时 ' + (ms / 1000).toFixed(1) + 's（' + testN + ' 张，报告 tools/out/visual-report.json）');
  console.log(UPDATE ? (onlyOne ? '单页更新：' + baseN + ' 张基线已覆盖（清单未改写，跑全量 --update 才入库指纹）' : '基线已更新: ' + baseN + ' 张，清单已写入 ' + path.relative(ROOT, MANIFEST))
    : ('比对 ' + testN + ' 张: ' + (testN - failN) + ' PASS, ' + failN + ' FAIL' + (baseN ? ', 新建基线 ' + baseN : '')));
  if (!UPDATE) process.exit(failN ? 1 : 0);
})();

