/* probe33f-floor.js — 一次性：给「topic 四档指纹变了而两遍只读像素 0.00%」出定罪读数
 * 问题：今天 --update 之后 tools/out/visual-baseline.json 有 11 条 sha 变了（story 7 + topic 4），
 *       但重拍后两遍只读 109/109 全绿（run-1 唯一非 0 是 topic.328 的 0.001%，run-2 连这条都归 0）。
 *       旧基线本体不入库、已被覆盖 → 「旧 vs 新」无法直接量。
 * 这一支量的不是旧新，而是**同一份代码在两个跑批之间能不能逐字节重现**：
 *       用与闸门逐字相同的前置（拦 http / tn_onboarded / CLOCK 桩 / reduce / 摘 toast / dsf=2 / 同 SETTLE），
 *       单页重拍一档，与「全量 --update 那一跑留下的基线」比三口径：
 *         ① 整文件 sha（清单登记用的就是这个）
 *         ② pixelmatch(threshold 0.02) 差异像素（闸门判定用的就是这个）
 *         ③ 严格不等像素（四通道全等才算同）+ 通道差分布 + 差异外接框
 *       对照组：非地图页 album/index（今天 sha 没变）与地图页 travel-map（今天 sha 也没变）。
 * 判读：若某页 ①不同 & ②=0 & ③>0 → 这一页的字节口径比像素口径敏感，「sha 变了」不需要任何代码变更来解释；
 *       若 ①相同 → 这一页在两个跑批间逐字节可重现，它的 sha 变化就必须由代码变更解释。
 * 用法：node tools/out/probe33f-floor.js      （只读，不改任何基线/清单）
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;
const ROOT = path.join(__dirname, '..', '..');
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const SHOTS = path.join(ROOT, 'tools', 'out', 'b33f-shots-floor');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TOAST_SEL = '.ui-toast, #nmTip, .toast, .ui-tilewarn';
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const out = [];
const p = s => { console.log(s); out.push(s); };

const STATES = [
  { page: 'topic.html', W: 320, H: 640, drift: true },
  { page: 'topic.html', W: 328, H: 723, drift: true },
  { page: 'topic.html', W: 390, H: 844, drift: false },
  { page: 'topic.html', W: 452, H: 995, drift: true },
  { page: 'topic.html', W: 768, H: 1024, drift: true },
  { page: 'topic.html', W: 1440, H: 900, drift: false },
  { page: 'travel-map.html', W: 320, H: 640, drift: false },
  { page: 'travel-map.html', W: 768, H: 1024, drift: false },
  { page: 'album.html', W: 320, H: 640, drift: false },
  { page: 'index.html', W: 390, H: 844, drift: false },
];

function strict(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { size: a.width + 'x' + a.height + ' vs ' + b.width + 'x' + b.height };
  const n = a.width * a.height;
  let diff = 0, maxD = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  const buck = { d1_2: 0, d3_5: 0, d6_20: 0, d21p: 0 };
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (a.data[o] === b.data[o] && a.data[o + 1] === b.data[o + 1] && a.data[o + 2] === b.data[o + 2] && a.data[o + 3] === b.data[o + 3]) continue;
    diff++;
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a.data[o + k] - b.data[o + k]));
    maxD = Math.max(maxD, d);
    if (d <= 2) buck.d1_2++; else if (d <= 5) buck.d3_5++; else if (d <= 20) buck.d6_20++; else buck.d21p++;
    const x = i % a.width, y = (i / a.width) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { diff, maxD, buck, bbox: diff ? (x0 + ',' + y0 + '→' + x1 + ',' + y1) : '(无)' };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const q of await browser.pages()) await q.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'out', 'visual-baseline.json'), 'utf8'));
  p('=== 单页重拍 vs 全量 --update 基线：三口径对账（同一份产品码，两个跑批）===');
  for (const st of STATES) {
    const tag = st.page.replace(/\.html$/, '') + '.' + st.W + 'x' + st.H + '.png';
    await pg.setViewport({ width: st.W, height: st.H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, st.page)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    const SETTLE = (st.page === 'topic.html' || st.page === 'explore-map.html' || st.page === 'travel-map.html') ? 5000 : 1400;
    await new Promise(r => setTimeout(r, SETTLE));
    const removed = await pg.evaluate(sel => { const n = document.querySelectorAll(sel).length; document.querySelectorAll(sel).forEach(e => e.remove()); return n; }, TOAST_SEL);
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    const baseF = path.join(BASE, tag);
    if (!fs.existsSync(baseF)) { p('  ' + tag + ' — 基线不存在（跳过）'); continue; }
    fs.writeFileSync(path.join(SHOTS, tag), buf);
    const A = PNG.sync.read(buf), B = PNG.sync.read(fs.readFileSync(baseF));
    const dm = new PNG({ width: A.width, height: A.height });
    const pm = match(A.data, B.data, dm.data, A.width, A.height, { threshold: 0.02 });
    const s = strict(A, B);
    p('  ' + tag + '  摘toast=' + removed + '  登记sha=' + (m.files[tag] || {}).sha + '  基线文件sha=' + sha(fs.readFileSync(baseF)) + '  本次sha=' + sha(buf) +
      '  → ①整字节' + (sha(buf) === sha(fs.readFileSync(baseF)) ? '相同' : '不同') +
      ' ②pixelmatch=' + pm + ' ③严格=' + s.diff + ' 最大通道差=' + s.maxD + ' 框=' + s.bbox +
      ' 档=' + JSON.stringify(s.buck) + ' 本次清单登记=' + JSON.stringify(m.files[tag]));
    fs.writeFileSync(path.join(SHOTS, 'diff-' + tag), PNG.sync.write(dm));
  }
  await browser.close();
  p('截图与 diff 图归档 tools/out/b33f-shots-floor/');
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-floor.txt'), out.join('\n') + '\n');
})().catch(e => {
  const msg = '探针异常：' + (e && e.stack || e);
  console.error(msg); out.push(msg);
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-floor.txt'), out.join('\n') + '\n');
  process.exit(1);
});
