/* probe35a-scope.js — 批次 35-A 第三腿：settings.html 那一屏到底被这枚注入串改了多少像素
 * 用法: node tools/out/probe35a-scope.js
 * 为什么单挑 settings：B 段实测 17 页里只有 settings.html 在**载入时**就 ensureUI()
 *   （settings.html:739，为了让导出/导入弹层有样式），也就是它那 6 格基线是带着这枚注入串拍的。
 *   其余 16 页要等用户真打开面板才被污染，而像素基线从不弹面板 ⇒ 基线看不到那一半。
 * 做法：同一页同一屏，截两张——第二张之前**只把那枚含 --fd 的 <style> 摘掉**（不改任何别的），
 *   再与第一张做 pixelmatch，并数差块落在哪些元素上。
 *   ⇒ 这就是「如果 35-B 把这枚串里的 :root 别名摘掉，settings 那 6 格会不会重拍」的答案，不是靠猜。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = path.join(__dirname, 'b35a-shots');
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

const out = [];
const p = s => { out.push(s); console.log(s); };
const sha = buf => crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex').slice(0, 16);
fs.mkdirSync(SHOTS, { recursive: true });

/* 差块用连通域（4 邻接）数出来，只报面积 ≥ 24 像素的块，把抗锯齿散点滤掉 */
function clusters(aBuf, bBuf) {
  const a = PNG.sync.read(Buffer.from(aBuf)), b = PNG.sync.read(Buffer.from(bBuf));
  const W = a.width, H = a.height, seen = new Uint8Array(W * H);
  const diffs = [];
  for (let i = 0; i < W * H; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]));
    if (d > 0) diffs[i] = 1; else diffs[i] = 0;
  }
  const blocks = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = y * W + x;
    if (!diffs[id] || seen[id]) continue;
    const st = [[x, y]]; let n = 0, minx = x, miny = y, maxx = x, maxy = y;
    seen[id] = 1;
    while (st.length) {
      const [cx, cy] = st.pop(); n++;
      minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); miny = Math.min(miny, cy); maxy = Math.max(maxy, cy);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nid = ny * W + nx;
        if (diffs[nid] && !seen[nid]) { seen[nid] = 1; st.push([nx, ny]); }
      }
    }
    blocks.push({ n, x0: minx, x1: maxx, y0: miny, y1: maxy });
  }
  blocks.sort((u, v) => v.n - u.n);
  return { W, H, blocks };
}

const VP = [[320, 640], [328, 723], [390, 844], [452, 995], [768, 1024], [1440, 900]];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const pg0 of await browser.pages()) await pg0.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_font', 'md'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const shot = async tag => {
    await pg.evaluate(() => document.querySelectorAll('.ui-toast, #nmTip, .toast, .ui-tilewarn').forEach(e => e.remove()));
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    fs.writeFileSync(path.join(SHOTS, tag + '.png'), buf);
    return buf;
  };

  /* 两种摘法都要测，否则会高估 35-B 的改动范围：
   *   ① 精确摘（就是 35-B 真正要做的那一刀）：只从那枚注入串里删掉 --fd: / --fb: 两条声明，皮肤变量一个不动
   *   ② 整枚摘（上界）：把含 --fd 的那枚 <style> 整个移除
   * 差异＝①的像素影响一定 ≤ ②。只量②会把「皮肤变量没接回来」也算进 35-B 的账。 */
  const surgery = mode => pg.evaluate(m => {
    const hit = [...document.querySelectorAll('style')].filter(s => /(^|[;\s{])--fd\s*:/.test(s.textContent));
    const tok = k => (getComputedStyle(document.documentElement).getPropertyValue(k) || '').trim();
    const before = { bg: tok('--bg'), fd: tok('--fd'), fb: tok('--fb'), sf: tok('--sf') };
    const ids = hit.map(s => {
      if (m === 'exact') {
        s.textContent = s.textContent.replace(/(^|[^-\w])--(?:fd|fb)\s*:[^;}]*/g, '$1');
      } else s.remove();
      return s.textContent ? s.textContent.slice(0, 46) : '(整枚已删)';
    });
    return { n: hit.length, before, after: { bg: tok('--bg'), fd: tok('--fd'), fb: tok('--fb'), sf: tok('--sf') }, ids };
  }, mode);

  for (const [W, H] of VP) {
    const load = async () => {
      await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
      await pg.goto(pathToFileURL(path.join(ROOT, 'settings.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1600));
    };
    const cmp = (label, bufA, bufB) => {
      const a = PNG.sync.read(Buffer.from(bufA)), b = PNG.sync.read(Buffer.from(bufB));
      const diff = new PNG({ width: a.width, height: a.height });
      const n = match(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.02 });
      const cl = clusters(bufA, bufB);
      const big = cl.blocks.filter(x => x.n >= 24);
      p('  ' + label + '：pixelmatch(0.02) ' + n + ' / ' + (a.width * a.height) + ' = ' + (n / (a.width * a.height) * 100).toFixed(4) + '%'
        + '  sha ' + sha(bufA) + '/' + sha(bufB));
      p('    严格不等像素 ' + cl.blocks.reduce((s, x) => s + x.n, 0) + '，连通块 ' + cl.blocks.length + ' 枚，≥24 像素 ' + big.length + ' 枚');
      for (const x of big.slice(0, 8)) p('      块: ' + x.n + ' 像素 x=' + x.x0 + '-' + x.x1 + ' y=' + x.y0 + '-' + x.y1);
      fs.writeFileSync(path.join(SHOTS, 'settings.' + label + '-' + W + 'x' + H + '.png'), PNG.sync.write(diff));
    };

    await load();
    const withStyle = await shot('settings.with-' + W + 'x' + H);
    const ex = await surgery('exact');
    await new Promise(r => setTimeout(r, 500));
    const exact = await shot('settings.exact-' + W + 'x' + H);
    p(W + '×' + H + '  命中 <style> ' + ex.n + ' 枚：' + ex.ids.join(' | '));
    p('    --fd ' + (ex.before.fd.slice(0, 30) || '(空)') + ' → ' + (ex.after.fd.slice(0, 30) || '(空)'))
      ; p('    --fb ' + (ex.before.fb.slice(0, 30) || '(空)') + ' → ' + (ex.after.fb.slice(0, 30) || '(空)'))
      ; p('    --bg ' + ex.before.bg + '→' + ex.after.bg + '   --sf(皮肤,不该动) ' + ex.before.sf + '→' + ex.after.sf);
    cmp('exact', withStyle, exact);

    await load();
    const withStyle2 = await shot('settings.with2-' + W + 'x' + H);
    const rm = await surgery('whole');
    await new Promise(r => setTimeout(r, 500));
    const whole = await shot('settings.whole-' + W + 'x' + H);
    p('    [整枚摘·上界] --fd ' + (rm.before.fd.slice(0, 30) || '(空)') + ' → ' + (rm.after.fd.slice(0, 30) || '(空)')
      + '  --bg ' + rm.before.bg + '→' + rm.after.bg);
    cmp('whole', withStyle2, whole);
  }
  fs.writeFileSync(path.join(__dirname, 'b35a-scope.txt'), out.join('\n') + '\n');
  await browser.close();
})().catch(e => { p('THROW ' + (e && e.message)); fs.writeFileSync(path.join(__dirname, 'b35a-scope.txt'), out.join('\n') + '\n' + (e && e.stack)); process.exit(1); });
