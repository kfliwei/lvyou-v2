/* visual-check.js — P0-0 视觉回归闸门
 * 用法:
 *   node tools/visual-check.js              # 全量状态 × 视口，与基线比对
 *   node tools/visual-check.js --update     # 有意改版时更新基线（diff 图保留供人审）
 *   node tools/visual-check.js --seed       # 只跑种子数据态（4 个内容页 × 390）
 * 注意: --seed 单独跑与全量跑的后半程**不是同一前置态**（全量跑先访问 45 个空库态，
 *   页面加载会写 localStorage），种子基线一律用全量 --update 拍，别用 --seed --update。
 *   node tools/visual-check.js index.html   # 只跑指定页的空库态
 *   node tools/visual-check.js --reindex    # 把当前基线本体登记进指纹清单（不重新截图）
 * 原理: 固定视口 + 清空存储 + 冻结时钟 + 跳过首启引导蒙层后截屏，与 tools/out/visual-baseline/ 基线做像素 diff。
 * 阈值: 普通页 > 0.1% FAIL；种子态 > 0.05%。数值按实测噪声定，见 THRESH 注释。
 * 稳定性: 时钟、performance.now、rAF 时间戳、Math.random、CSS 动画全部钉死，所有 http(s) 请求拦掉
 *         （瓦片一类的外部内容不进基线），并统一在 prefers-reduced-motion 下拍（hero 粒子的
 *         IntersectionObserver 重启会补跳步，同代码连跑能飘 0.35%）——49 状态连跑两遍每态 0.00%。
 *         所以阈值能收得这么紧（收不紧的闸门守不住改色）。
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
const SEEDONLY = argv.includes('--seed');
/* FAIL 定位用：把本次截图也落一份（visual-diff/*.cur.png），与基线、diff 三张并排看，
   不然只有一张 diff 图，分不清"改了色"还是"挪了位"。不影响任何判定。 */
const KEEP = argv.includes('--keep-current');
const onlyPages = argv.filter(a => !a.startsWith('--'));

/* 状态清单：page → 视口列表。地图页不再有宽阈值（拦掉请求后它和普通页一样确定，理由见下方阈值注释）。
 * 两种数据态：
 *   空库态（默认）——全新浏览器档案，localStorage/IDB 皆空，抓的是"新用户第一眼"；
 *   种子态（--seed 或全量跑的后半程）——用项目自带的 test-data.js 灌 8 条示例游记，
 *   抓的是"有数据时"的列表/统计/地图。两态基线分文件命名（*.seed.WxH.png），互不覆盖。 */
const PAGES = ['index.html', 'topic.html', 'search.html', 'wishlist.html', 'review.html',
  'settings.html', 'me.html', 'node-manager.html', 'album.html', 'album-edit.html',
  'story.html', 'planner.html', 'md-manager.html', 'explore-map.html', 'travel-map.html'];
/* 种子态只跑"内容随游记数据变化"的页。选页判据（实测，不是猜的）：与同页空库态做像素差，
 * 差异可见才算有覆盖增量；wishlist / node-manager 曾入列但差 0.00%（示例数据只写游记库），已剔除。
 * index 也已剔除：它的有数据区（RECENT JOURNEY）在折叠线以下，视口内与空库态差 0.02%，等于白拍。
 * 放在 390 一档：种子态要的是"内容对不对"，不是"布局对不对"（布局由空库态 × 四视口覆盖）。 */
const SEED_PAGES = ['review.html', 'album.html', 'story.html', 'travel-map.html'];
/* 种子态页必须同时在 PAGES 里——否则它的种子基线没有同页空库基线可比，"这态有没有增量"就无从量。 */
/* 320 档是批次 7-C 补的：竖排题签这类"一个字宽也要占位"的组件，判不破版的下限就是 320
   （最小在售安卓机 CSS 宽度）。加一档 = 多 15 个基线，重建要跑 --update。 */
const VIEWPORTS = [[320, 640], [390, 844], [768, 1024], [1440, 900]];
const SEED_VIEWPORTS = [[390, 844]];
/* 阈值按实测噪声定，不是拍脑袋：时间/随机/CSS 动画钉死 + 所有 http(s) 请求拦掉 + 基线在
 * prefers-reduced-motion 下拍之后，64 个状态连跑两遍**每一态都是 0.00%**（批次 7-D 复跑 293.6s + 282.5s，
 * 日志 tools/out/b7d-gate-battery.txt；四视口之前是 49 态，那两遍的日志归档
 * tools/out/shots/2026-10-03-visualgate-mutation2/vc-rm-{1,2}.log）。
 * 0.1% 不是贴着噪声留的，是给跨机器留余量：本机零噪声不代表别的字体渲染环境也零噪声。
 * 反向验证（改 --color-primary）实测最小 diff 0.11%，所以这条线再往下收才有意义，先不动。
 * 地图页不再有单独宽松阈值：以前松到 1% 是因为瓦片是外部资源（同代码连跑飘 1–5.5%），
 * 拦掉请求后 topic/explore-map/travel-map 这三页各态全部 0.00%，"地图页"就只是普通页；
 * 留着那个 if 等于给网络依赖留一道后门——反向验证时 explore-map/travel-map 的 0.11–0.27%
 * 正是被这道后门放过去的（旧基线那次 21 FAIL，删掉特例后同一改动 26 FAIL）。
 * 对照：改阈值前是 0.5%/8%，那时把 --color-primary 整体改色（195 处引用）闸门 49 张全绿——
 * 阈值松到守不住品牌色，等于没有闸门。 */
const THRESH = 0.001;
/* 种子态用严阈值：它要守的是"数据有没有渲染出来"，而这类内容往往只占视口一小块
 * （review 种子态与空库态差 0.16%，用 0.5% 阈值等于数据全丢也不会 FAIL）。 */
const THRESH_SEED = 0.0005;

/* 配置自检：种子态页若不在 PAGES 里，就没有同页空库基线可比，"增量"无法验证；
   视口/清单打错也是同类静默失效。宁可开跑前炸，不要拍出一堆没人能判读的图。 */
for (const p of SEED_PAGES) {
  if (!PAGES.includes(p)) { console.error('配置错误: ' + p + ' 在 SEED_PAGES 但不在 PAGES（种子态缺同页空库基线）'); process.exit(1); }
}

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { return null; }
}
function writeManifest(files) {
  fs.writeFileSync(MANIFEST, JSON.stringify({
    note: '视觉基线指纹清单。截图本体 PNG 不入库；缺文件=闸门失效，visual-check 会判 FAIL。重建：node tools/visual-check.js --update',
    generatedAt: new Date().toISOString(),
    viewports: VIEWPORTS.map(v => v[0] + 'x' + v[1]),
    count: Object.keys(files).length,
    files: orderFiles(files)
  }, null, 2));
}
/* 清单是入库文件，键序必须钉在状态清单上：--reindex 走 readdirSync（文件系统给的顺序），
   不排序的话一次重登记就造出 60 多行纯顺序噪声，人审 diff 时看不出到底哪张基线真变了。 */
function orderFiles(files) {
  const want = [];
  for (const p of PAGES) for (const [W, H] of VIEWPORTS) want.push(p.replace('.html', '') + '.' + W + 'x' + H + '.png');
  for (const p of SEED_PAGES) for (const [W, H] of SEED_VIEWPORTS) want.push(p.replace('.html', '') + '.seed.' + W + 'x' + H + '.png');
  const out = {};
  want.filter(k => files[k]).forEach(k => { out[k] = files[k]; });
  Object.keys(files).filter(k => !out[k]).sort().forEach(k => { out[k] = files[k]; });
  return out;
}

/* 把"会动的东西"全部钉死，否则 diff 里混的是时钟噪声而不是改版信号：
 *   Date / performance.now / rAF 时间戳 —— 首页问候语、粒子场、CSS 动画进度
 *   Math.random —— 首页星尘粒子用随机撒点（index.html:583/596），不钉种子则每次截屏都是另一张图
 * 实测：只冻 Date 时首页噪声 0.41%（三档视口都非 0，比一次全局改色的信号还大）；
 *   补齐随机种子 + animations:'disabled' 后，49 态连跑两遍最大噪声 0.04%（地图瓦片）/0.01%（其余）。 */
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

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
  /* 闸门不许依赖网络：瓦片（OSM/高德/天地图）与任何 CDN 请求一律拦掉。
     之前没拦，topic/node-manager 四个态在同一份代码连跑两次就飘 1-5.5%（瓦片到没到、到哪张），
     "确定性"其实只在有缓存的机器上成立。拦掉后地图页只剩矢量覆盖物，是可复现的。 */
  await pg.setRequestInterception(true);
  pg.on('request', req => {
    const u = req.url();
    if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  /* 首启引导蒙层（z-index 9990）盖在所有内容之上：不跳过它就等于把蒙层截成"页面基线"，
     此后页面真改版闸门也不会动。与 audit-clicktest.js:52 同一口径，必须在文档加载前写入。
     代价：蒙层本身不进视觉基线——它由 tools/smoke.js 的 tn_onboarded 断言 + 点击探针覆盖。 */
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  /* 钉在 prefers-reduced-motion 上拍基线——这是应用自己的一等渲染模式（design.css:235、
   * travel-notes.js:308 的全局降级、index.html staticFrame 静帧路径），不是为测试造的假态。
   * 原因是首页 hero 粒子：它每帧按真实 rAF 时间戳推进，时钟桩把每帧 dt 压成 0，
   * 但 IntersectionObserver 每次 stop→start 会把 t0 清零，下一帧就补一个 0.05s 的跳步——
   * 跳几次取决于截图前那 1.4s 真实窗口里触发了几轮，同代码连跑 768 档实测 0.00%↔0.35% 乱跳。
   * 代价：动效路径不进像素基线（它本质不可复现），由静帧墨量断言 + 真机/人审覆盖。 */
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  /* 状态矩阵：空库态全量 × 四视口，种子态只跑内容页 × 390；
     带页名参数只跑该页空库态，--seed 只跑种子态（两者分开跑，--update 时清单是合并写入不会丢登记） */
  const states = [];
  if (onlyPages.length) {
    for (const p of pages) {
      if (!PAGES.includes(p)) { console.log('SKIP(不在状态清单): ' + p); continue; }
      for (const [W, H] of VIEWPORTS) states.push({ p, W, H, seed: false });
    }
  } else {
    if (!SEEDONLY) for (const p of PAGES) for (const [W, H] of VIEWPORTS) states.push({ p, W, H, seed: false });
    for (const p of SEED_PAGES) for (const [W, H] of SEED_VIEWPORTS) states.push({ p, W, H, seed: true });
  }

  /* 全量 --update 时清掉"配置里已经没有的状态"的登记，否则从 SEED_PAGES 摘掉的页会留下幽灵条目，
     清单条数与实际状态数从此对不上，也没人知道哪个是真。 */
  if (UPDATE && !onlyOne) {
    const valid = new Set();
    for (const p of PAGES) for (const [W, H] of VIEWPORTS) valid.add(p.replace('.html', '') + '.' + W + 'x' + H + '.png');
    for (const p of SEED_PAGES) for (const [W, H] of SEED_VIEWPORTS) valid.add(p.replace('.html', '') + '.seed.' + W + 'x' + H + '.png');
    for (const k of Object.keys(manifest)) if (!valid.has(k)) { delete manifest[k]; console.log('PRUNE 清单已摘除的状态: ' + k); }
  }

  let seeded = false;
  const ensureSeed = async () => {
    if (seeded) return;
    /* 用项目自己的载入函数，不手抄存储键——键名/双写口径变了会在这里暴露，而不是悄悄拍到旧数据 */
    await pg.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
    await pg.evaluate(async () => {
      const r = window.loadTestData && window.loadTestData();
      if (r && r.idb) { try { await r.idb; } catch (e) {} }
    });
    seeded = true;
  };

  for (const st of states) {
    const { p, W, H } = st;
    const tag = p.replace('.html', '') + (st.seed ? '.seed' : '') + '.' + W + 'x' + H + '.png';
    const baseF = path.join(BASE, tag);
    if (st.seed) await ensureSeed();
    await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    /* 与 audit-clicktest 同口径：topic/地图页数据链路长，固定 1400ms 在整趟连跑的负载下会抢时机
       （实测 topic.390 全量跑飘 3.57%、单页跑恒 0.00%）——重页等足 5s，普通页 1.4s 不变。 */
    const SETTLE = (p === 'topic.html' || p === 'explore-map.html' || p === 'travel-map.html') ? 5000 : 1400;
    await new Promise(r => setTimeout(r, SETTLE));
    /* 装饰层覆盖断言：钉 reduced-motion 换来的是静帧渲染路径，如果那条路径哪天失效
       （staticFrame 没调用、canvas 尺寸塌成 0），基线会安静地少一层像素、闸门照样绿。这里补一刀。 */
    if (p === 'index.html') {
      const ink = await pg.evaluate(() => {
        const cv = document.getElementById('heroParticles');
        if (!cv || !cv.getContext || !cv.width) return -1;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      });
      if (ink <= 0) {
        testN--;
        console.log('FAIL ' + tag + ' — hero 粒子静帧无墨（ink=' + ink + '），装饰层没进基线');
        report.push({ state: tag, status: 'FAIL', reason: 'decoration-blank', ink });
        failN++; continue;
      }
    }
    /* 确定性来自上面 emulateMediaFeatures(reduce) + design.css 的减动效块（duration .01ms、
       iteration-count 1、delay 0s），不是来自 animations:'disabled'：实测 puppeteer-core 25.6.0
       根本没实现这个选项（包里 grep 不到 animations，同一页 disabled / allow 两张图像素一致）。
       留着它是为了将来内核真实现时口径不变，别把它当「动画已定格」的依据。 */
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    if (KEEP) fs.writeFileSync(path.join(DIFF, tag.replace(/\.png$/, '') + '.cur.png'), buf);
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
    const diffPx = match(a.data, b.data, diffPng.data, a.width, a.height, { threshold: 0.02 });
    const ratio = diffPx / (a.width * a.height);
    const lim = st.seed ? THRESH_SEED : THRESH;
    const ok = ratio <= lim;
    fs.writeFileSync(path.join(DIFF, tag), PNG.sync.write(diffPng));
    report.push({ state: tag, status: ok ? 'PASS' : 'FAIL', diffPct: +(ratio * 100).toFixed(3), limitPct: +(lim * 100).toFixed(2) });
    if (ok) console.log('PASS ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '%');
    else { console.log('FAIL ' + tag + '  diff ' + (ratio * 100).toFixed(2) + '% > ' + (lim * 100) + '%  → tools/out/visual-diff/' + tag); failN++; }
  }
  /* ---------- 性能预算（P0-2 验收项）：LCP < 2.5s、CLS < 0.05 ----------
     单独干净页测：不装 CLOCK 桩（performance.now 被钉成常量，时间戳会失真）。
     390x844 + CDP 4x CPU 节流模拟中端安卓；外部 http 仍拦掉（与像素基线同一口径），
     页面与实景照镜像都是本地文件，测的是"离线壳+中端机"的首屏，不是 CDN 速度。 */
  {
    const pp = await browser.newPage();
    await pp.setRequestInterception(true);
    pp.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) req.abort().catch(() => {}); else req.continue().catch(() => {}); });
    await pp.evaluateOnNewDocument(() => {
      try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {}
      window.__perf = { lcp: 0, lcpEl: '', cls: 0 };
      try {
        new PerformanceObserver(function (l) { var es = l.getEntries(); var e = es[es.length - 1]; window.__perf.lcp = e.startTime; window.__perf.lcpEl = (e.element && (e.element.tagName + (e.element.id ? '#' + e.element.id : ''))) || e.url || '?'; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (!e.hadRecentInput) window.__perf.cls += e.value; }); }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
    });
    const cdp = await pp.target().createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await pp.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    for (const pn of ['index.html', 'topic.html']) {
      await pp.goto(pathToFileURL(path.join(ROOT, pn)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      const perf = await pp.evaluate(() => window.__perf);
      const ok = perf.lcp > 0 && perf.lcp < 2500 && perf.cls < 0.05;
      report.push({ state: 'perf.' + pn, status: ok ? 'PASS' : 'FAIL', lcpMs: Math.round(perf.lcp), lcpEl: perf.lcpEl, cls: +perf.cls.toFixed(4) });
      console.log((ok ? 'PASS' : 'FAIL') + ' 性能预算 ' + pn + ' — LCP ' + Math.round(perf.lcp) + 'ms(<2500) 元素=' + perf.lcpEl + ' | CLS ' + perf.cls.toFixed(4) + '(<0.05)');
      if (!ok) failN++;
    }
    await cdp.detach().catch(() => {});
    await pp.close();
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

