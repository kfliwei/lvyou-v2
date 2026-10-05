/* probe-mappos.js — 给 topic.1440（有时 topic.768）的双态定性：首屏视野是不是被"上一个视口的 moveend"决定了？
 *
 * 用法：node tools/out/probe-mappos.js [--fix]
 *   --fix = 在 evaluateOnNewDocument 里先把 tn_mappos_* 键删掉（候选修复），看串扰是否消失。
 *
 * 每档做三件事：进页前读 localStorage 里的 tn_mappos_t（=这一档会被 restore 的视野），
 * 等够 SETTLE 后读地图标记的屏幕坐标签名，再按闸门口径截图。
 * 判读：签名随访问顺序变 ⇒ 双态来自 tn_mappos_* 的跨态串扰（闸门没有 per-state 清库）；
 *      --fix 后 5 档签名彼此一致且与单独跑一致 ⇒ 删键就是收口。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FIX = process.argv.includes('--fix');
const VPS = [[320, 640], [390, 844], [452, 995], [768, 1024], [1440, 900]];

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const m = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc);
if (!m) { console.error('抽不到 visual-check.js 的 CLOCK 桩：钉帧口径已换，先改这里再探针'); process.exit(2); }
const CLOCK = m[1];

const SIGN = () => {
  const pre = localStorage.getItem('tn_mappos_t') || '(无)';
  const els = [...document.querySelectorAll('.leaflet-marker-icon')].slice(0, 12);
  return {
    pre,
    sig: els.map(e => { const r = e.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y); }).join(' '),
    n: document.querySelectorAll('.leaflet-marker-icon').length
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => {
    const u = req.url();
    if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  if (FIX) {
    await pg.evaluateOnNewDocument(() => {
      try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf('tn_mappos_') === 0) localStorage.removeItem(k); } } catch (e) {}
    });
  }
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const baseDir = path.join(ROOT, 'tools', 'out', 'visual-baseline');
  const shots = {};
  const sigs = {};
  for (const [W, H] of VPS) {
    const tag = 'topic.' + W + 'x' + H;
    await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    const s = await pg.evaluate(SIGN);
    await pg.evaluate(() => document.querySelectorAll('.ui-toast').forEach(e => e.remove()));
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    shots[tag] = buf; sigs[tag] = s;
    console.log(tag + '  载入前 tn_mappos_t=' + s.pre + '  标记 ' + s.n + ' 个');
    console.log('   签名 ' + s.sig);
    fs.writeFileSync(path.join(ROOT, 'tools', 'out', '_mappos-' + tag + (FIX ? '.fix' : '') + '.png'), buf);
  }

  /* 与基线互差：谁不在基线那一态，一目了然 */
  const d = (a, b) => {
    const A = PNG.sync.read(a), B = PNG.sync.read(b);
    const o = new PNG({ width: A.width, height: A.height });
    return (match(A.data, B.data, o.data, A.width, A.height, { threshold: 0.02 }) / (A.width * A.height) * 100).toFixed(3) + '%';
  };
  console.log('\n--- 对基线 ---');
  for (const [W, H] of VPS) {
    const tag = 'topic.' + W + 'x' + H;
    const f = path.join(baseDir, tag + '.png');
    console.log(tag + ' ↔ 基线 ' + (fs.existsSync(f) ? d(shots[tag], fs.readFileSync(f)) : '缺基线'));
  }
  console.log('\n--- 1440 档：本轮 vs 单独跑（探针 A）---');
  const alone = path.join(ROOT, 'tools', 'out', '_font-topic.1440x900-A.png');
  if (fs.existsSync(alone)) console.log('diff ' + d(shots['topic.1440x900'], fs.readFileSync(alone)));
  else console.log('（没有 _font-topic.1440x900-A.png 可比）');
  await browser.close();
})();
