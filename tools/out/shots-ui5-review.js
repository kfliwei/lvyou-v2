/* shots-ui5-review.js — UI-5 改版前后对比图（人审用，不是闸门）
 * 为什么单独写：tools/shot.js 不钉态，拍出来前后两张 md5 逐字节相同（动效未定格 + 引导蒙层盖住内容），
 *   对比无效。这里复用 visual-check.js 的同一套钉帧口径。
 * 钉帧口径不重抄：CLOCK 桩用正则从 tools/visual-check.js 里抽，抽不到就直接炸——
 *   闸门改了钉帧方式而这里没跟上，对比图就重新变成噪声，宁可不开跑。
 * 用法: node tools/out/shots-ui5-review.js <改前副本目录> [页名...] [--vp=320x640,1440x900]
 *   改前副本一般由 `git archive HEAD | tar -x -C <dir>` 导出。
 *   --vp 用来只补离群档（visual-report 里 diff 最大的那几个视口），默认 452x995 + 390x844。
 * 输出: tools/out/ui5-review/{before,after,diff}/，并在末尾打印每态 diff%。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(ROOT, 'tools', 'out', 'ui5-review');
const VP_DEFAULT = [[452, 995], [390, 844]];
const DEFAULT_PAGES = ['index.html', 'topic.html', 'me.html', 'travel-map.html', 'album.html', 'md-manager.html'];
/* 这三页空库只有空态，毛玻璃/纸/影都挂在真实内容上；种子态才拍得到东西（口径同 visual-check 的 SEED_PAGES） */
const SEED_PAGES = ['travel-map.html', 'album.html'];

const argv = process.argv.slice(2);
const BEFORE = argv[0];
if (!BEFORE || !fs.existsSync(path.join(BEFORE, 'design.css'))) {
  console.error('缺改前副本：先跑 `git archive HEAD | tar -x -C <dir>`，把 <dir> 作为第一个参数传进来');
  process.exit(2);
}
/* --vp=320x640,1440x900：只补离群档用（visual-report 里 diff 最大的那几个态往往在 320 与 1440 两端） */
const vpArg = argv.map(a => /^--vp=(.*)$/.exec(a)).filter(Boolean)[0];
const VP = vpArg ? vpArg[1].split(',').map(s => s.split('x').map(Number)) : VP_DEFAULT;
if (VP.some(v => v.length !== 2 || v.some(n => !n))) { console.error('--vp 写错了，要 WxH[,WxH…]'); process.exit(2); }
/* --no-seed：拍空库态，用来对账 visual-report 里那些空库态的离群读数（种子态与空库态不是同一张图） */
const NOSEED = argv.includes('--no-seed');
const SEED = NOSEED ? [] : SEED_PAGES;
const pages = argv.slice(1).filter(a => !a.startsWith('--'));
const PAGES = pages.length ? pages : DEFAULT_PAGES;

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const m = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc);
if (!m) { console.error('抽不到 visual-check.js 的 CLOCK 桩：钉帧口径已换，先改这里再拍图'); process.exit(2); }
const CLOCK = m[1];
/* toast 摘除名单同样不重抄：与 CLOCK 一个道理，闸门那边换了名单而这里还认 `.ui-toast`，
   拍出来的对比图就会带上 node-manager `#nmTip` 那一类退场中间帧（批次 13-G 实测）。 */
const mSel = /const TOAST_SEL = '([^']*)';/.exec(vcSrc);
if (!mSel) { console.error('抽不到 visual-check.js 的 TOAST_SEL 名单：摘除口径已换，先改这里再拍图'); process.exit(2); }
const TOAST_SEL = mSel[1];

async function shoot(root, tag) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const dir = path.join(OUT, tag);
  fs.mkdirSync(dir, { recursive: true });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => {
    const u = req.url();
    if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  let seeded = false;
  const out = {};
  for (const [W, H] of VP) {
    for (const p of PAGES) {
      if (SEED.includes(p)) {
        if (!seeded) {
          await pg.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
          await pg.addScriptTag({ path: path.join(root, 'test-data.js') });
          await pg.evaluate(async () => {
            const r = window.loadTestData && window.loadTestData();
            if (r && r.idb) { try { await r.idb; } catch (e) {} }
          });
          seeded = true;
        }
      }
      await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
      await pg.goto(pathToFileURL(path.join(root, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      const SETTLE = (p === 'topic.html' || p === 'explore-map.html' || p === 'travel-map.html') ? 5000 : 1400;
      await new Promise(r => setTimeout(r, SETTLE));
      /* 与 visual-check 同一口径摘掉短命 toast：本轮就是靠包围盒发现 album 的 4.8% 差全在
         「已从 8 篇游记生成图册」那条 toast 带上（活 2.9s vs SETTLE 1.4s = 掷硬币），不摘就没法判断 UI-5 到底改了多少像素。 */
      const toasts = await pg.evaluate(s => {
        const n = document.querySelectorAll(s).length;
        document.querySelectorAll(s).forEach(e => e.remove());
        return n;
      }, TOAST_SEL);
      if (toasts) console.log('  摘除 toast ' + toasts + ' 条 @ ' + p + ' ' + W + 'x' + H);
      const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
      const tag2 = p.replace('.html', '') + (SEED.includes(p) ? '.seed' : '') + '.' + W + 'x' + H + '.png';
      fs.writeFileSync(path.join(dir, tag2), buf);
      out[tag2] = buf;
    }
  }
  await browser.close();
  return out;
}

(async () => {
  console.log('钉帧口径来源 CLOCK 长度 ' + CLOCK.length + '（取自 tools/visual-check.js）；toast 摘除名单 ' + TOAST_SEL);
  const after = await shoot(ROOT, 'after');
  const before = await shoot(BEFORE, 'before');
  const ddir = path.join(OUT, 'diff');
  fs.mkdirSync(ddir, { recursive: true });
  const rows = [];
  const pcts = [];
  for (const k of Object.keys(after)) {
    const a = PNG.sync.read(before[k]);
    const b = PNG.sync.read(after[k]);
    if (a.width !== b.width || a.height !== b.height) { rows.push([k, 'SIZE ' + a.width + 'x' + a.height + '→' + b.width + 'x' + b.height]); pcts.push(1); continue; }
    const d = new PNG({ width: a.width, height: a.height });
    const px = match(a.data, b.data, d.data, a.width, a.height, { threshold: 0.02 });
    fs.writeFileSync(path.join(ddir, k.replace(/\.png$/, '.diff.png')), PNG.sync.write(d));
    const pct = px / (a.width * a.height) * 100;
    pcts.push(pct);
    rows.push([k, pct.toFixed(3) + '%  (' + px + 'px)']);
  }
  console.log('--- 改前(HEAD) vs 改后(工作区) ---');
  rows.forEach(r => console.log(r[0].padEnd(30) + r[1]));
  /* 全 0 一定是对比失效（本轮就踩过：shot.js 不钉态导致前后 md5 逐字节相同），不是"改版没影响"。
     宁可这里炸，也不要交一堆看上去很干净的无效图。 */
  if (!pcts.some(x => x > 0.01)) {
    console.error('每态 diff 全为 0：要么前后是同一份代码，要么钉帧把变更也钉死了。别把这些图当对比图看。');
    process.exit(1);
  }
  console.log('图在 tools/out/ui5-review/{before,after,diff}/');
})();
