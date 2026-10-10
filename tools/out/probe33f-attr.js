/* probe33f-attr.js — 把「story 那 7 张红」归因到具体哪一处改动，而不是读着像那么回事
 * 用法: node tools/out/probe33f-attr.js
 * 做法（反向腿，产品码一行不动）：在运行时造出「改前那一屏」——
 *   ① 给 #snPrev/#snNext 打 inline 40×40（33-B 之前 story.html:37 写死的值）
 *   ② 把 #snSub 与 .sc-date 的文本退回不带时分的写法（33-D 之前 dayText 的读数）
 *   然后与**基线本体**（tools/out/visual-baseline/*.png，批次 31 拍的）做 pixelmatch，
 *   用与闸门同一个 threshold(0.02) 口径。判据：
 *     「现状 vs 基线」应复现闸门报的百分数；「两处都退回 vs 基线」应 ≈0.00%
 *     ⇒ 红的全部来源就是这两处，没有第三个未知改动混在里面。
 * 为什么不用「量宽度判断有没有溢出」：`.sn-info{flex:1;min-width:0}` 让 #snSub 的
 *   scrollWidth 恒等于 clientWidth（block 元素不横向溢出自己的盒子），那种判据是恒等式、没有牙
 *   （本轮第一次量就读到「加长 0px」，就是这么来的）。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = path.join(ROOT, 'tools', 'out', 'visual-baseline');
const ARCH = path.join(ROOT, 'tools', 'out', 'b33f-shots');
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

const out = [];
function p(s) { out.push(s); console.log(s); }
fs.mkdirSync(ARCH, { recursive: true });

function pctAgainst(file, shotBuf) {
  const a = PNG.sync.read(fs.readFileSync(path.join(BASE, file)));
  const b = PNG.sync.read(Buffer.from(shotBuf));
  if (a.width !== b.width || a.height !== b.height) return '尺寸不合 ' + a.width + '×' + a.height + ' vs ' + b.width + '×' + b.height;
  const diff = new PNG({ width: a.width, height: a.height });
  /* pixelmatch 收的是像素数组，不是 PNG 对象（照 visual-check.js:345 的调用约定） */
  const n = match(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.02 });
  return { diffPixels: n, pct: +(n / (a.width * a.height) * 100).toFixed(4) };
}
const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
/* 「退回去的那一屏」与基线整文件同哈希，比「0 个差异像素」更强：连 PNG 编码器输出都一样，
 * 说明既没有第三个改动，也没有时钟噪声混进来。不同哈希时把两支都印出来，别只印「否」 */
const sameBytes = (f1, f2) => { const h1 = sha(f1), h2 = sha(f2); return h1 === h2 ? '是（sha ' + h1 + '）' : '否（基线 ' + h1 + ' / 当前 ' + h2 + '）'; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const pg0 of await browser.pages()) await pg0.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const goto = async (file, W, H) => {
    await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, file)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1400));
  };
  const readBtns = () => pg.evaluate(() => {
    const g = id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, cw: getComputedStyle(e).width }; };
    return { prev: g('snPrev'), next: g('snNext') };
  });
  const revertBtns = async () => {
    await pg.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = '#snPrev,#snNext{width:40px!important;height:40px!important}';
      document.head.appendChild(st);
    });
    return readBtns();
  };
  const revertText = () => pg.evaluate(() => {
    const strip = s => s.replace(/ · \d{2}:\d{2}$/, '');
    const sub = document.getElementById('snSub');
    const before = sub ? sub.textContent : null;
    if (sub) sub.textContent = strip(sub.textContent);
    document.querySelectorAll('.sc-date').forEach(e => { e.textContent = strip(e.textContent); });
    return { before: before, after: sub ? sub.textContent : null };
  });
  const shot = async tag => {
    /* 与闸门同一口径：截图前摘掉短命 toast，否则「有没有 toast 在画面里」混进归因里 */
    const toasts = await pg.evaluate(sel => {
      const n = document.querySelectorAll(sel).length;
      document.querySelectorAll(sel).forEach(e => e.remove());
      return n;
    }, '.ui-toast, #nmTip, .toast, .ui-tilewarn');
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    fs.writeFileSync(path.join(ARCH, tag + '.png'), buf);
    if (toasts) p('  NOTE 摘除 ' + toasts + ' 条 toast');
    return buf;
  };

  /* ---------- 空库态：红只可能来自 .sn-btn（那一屏没有卡面）——六档逐个测，不靠外推 ---------- */
  for (const [W, H] of [[320, 640], [328, 723], [390, 844], [452, 995], [768, 1024], [1440, 900]]) {
    const bf = 'story.' + W + 'x' + H + '.png';
    p('\n=== 空库态 ' + bf + ' ===');
    await goto('story.html', W, H);
    const cards = await pg.evaluate(() => document.querySelectorAll('.story-card').length);
    p('  卡面数 ' + cards + '（0 → 这一屏没有 .sc-date，33-D 结构性不参与）');
    const A = await shot('empty-' + W + '-A-now');
    p('  A 现状 vs 基线 → ' + JSON.stringify(pctAgainst(bf, A)));
    await revertBtns();
    p('  注入 #snPrev,#snNext{width:40px!important;height:40px!important} → 实读 ' + JSON.stringify(await readBtns()));
    const B = await shot('empty-' + W + '-B-btn40');
    p('  B 只退钮 vs 基线 → ' + JSON.stringify(pctAgainst(bf, B)) + '  与基线整文件同字节? ' + sameBytes(path.join(BASE, bf), path.join(ARCH, 'empty-' + W + '-B-btn40.png')));
    p('  截图后钮尺寸复查 ' + JSON.stringify(await readBtns()));
  }

  /* ---------- 种子态：红来自 .sn-btn + 两处日期文字 ---------- */
  p('\n=== 种子态 story.seed.390x844（闸门报 0.60%） ===');
  await goto('index.html', 390, 844);
  await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
  await pg.evaluate(async () => { const r = window.loadTestData && window.loadTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
  await goto('story.html', 390, 844);
  /* 种子态两条腿各退一项，四项读数互为对照（不是只证「都退了就没红」，那一条证不了账能拆开）：
   *   A 都没退 = 总红；C 只退文字 = 剩钮那一笔；D 都退 = 应 ≈0；E 只退钮 = 剩文字那一笔
   *   拆得开的判据：A−C ≈ E 且 A−E ≈ C */
  const nOf = r => (r && r.diffPixels !== undefined) ? r.diffPixels : -1;
  const cards = await pg.evaluate(() => document.querySelectorAll('.story-card').length);
  const scd = await pg.evaluate(() => { const e = document.querySelector('.sc-date'); return e ? e.textContent : null; });
  p('  卡面数 ' + cards + '  首张 .sc-date=『' + scd + '』');
  const ra = pctAgainst('story.seed.390x844.png', await shot('seed-390-A-now'));
  p('  A 现状 vs 基线 → ' + JSON.stringify(ra));
  const rt = await revertText();
  p('  只退文字：#snSub 『' + rt.before + '』→『' + rt.after + '』（.sc-date 同口径）');
  const rc = pctAgainst('story.seed.390x844.png', await shot('seed-390-C-text'));
  p('  C 只退文字 vs 基线 → ' + JSON.stringify(rc));
  await revertBtns();
  const rd = pctAgainst('story.seed.390x844.png', await shot('seed-390-D-both'));
  p('  D 文字 + 钮都退 vs 基线 → ' + JSON.stringify(rd) + '  与基线整文件同字节? ' + sameBytes(path.join(BASE, 'story.seed.390x844.png'), path.join(ARCH, 'seed-390-D-both.png')));
  await goto('story.html', 390, 844);
  await revertBtns();
  const re = pctAgainst('story.seed.390x844.png', await shot('seed-390-E-btn'));
  p('  E 只退钮（另起一屏，文字保持现状）vs 基线 → ' + JSON.stringify(re));
  p('  拆账复核：A−C＝' + (nOf(ra) - nOf(rc)) + ' 对比 E＝' + nOf(re) + '；A−E＝' + (nOf(ra) - nOf(re)) + ' 对比 C＝' + nOf(rc));

  await browser.close();
  p('\n截图归档目录 tools/out/b33f-shots/');
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-attr.txt'), out.join('\n') + '\n');
})().catch(e => {
  const msg = '探针异常：' + (e && e.stack || e);
  console.error(msg); out.push(msg);
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-attr.txt'), out.join('\n') + '\n');
  process.exit(1);
});
