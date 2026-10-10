/* probe35a-leak.js — 批次 35-A 第二腿：把「注入串污染 :root」量到像素上
 * 用法: node tools/out/probe35a-leak.js
 * 为什么还要这一条：probe35a-font.js 的宽度对照对中文**结构性失明**——
 *   14 个全角字 × 24px 在任何中文字族下都是 336.00 px（1em 一字宽），
 *   「正对照 monospace 342.56」不同只是因为那一路落到了别的回落族，不是尺子变灵了。
 *   ⇒ 判「字族换没换」只能比像素，不能比宽度（同 [[feedback-visual-baseline-scope-proof]] 那条
 *     「像素腿对文字内容结构性失明」的反面：这次是宽度腿对字形失明）。
 * 三件事：
 *   A. 同一页（index.html）只做一件事——多注入一枚 <style>（TravelNotes.ensureUI()，面板不弹），
 *      截图前后做 pixelmatch ⇒ 差异 100% 归因于那 16 个别名被改写，没有别的变量
 *   B. 17 个基线页逐页读 body 的 computed 背景色，看哪几页被换成注入串的 #f6f1e5
 *      （settings.html:739 在载入时就 ensureUI，它就在名单里）
 *   C. 字族像素对照：把同一串中文分别用 品牌族 / 泄漏族 / "Songti SC",serif / 'TRACE Serif' 画进 canvas，
 *      比整张位图 sha 与 pixelmatch 差异像素 ⇒ 这才读得出「画出来的是不是同一套字」
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

function pm(aBuf, bBuf, tag) {
  const a = PNG.sync.read(Buffer.from(aBuf)), b = PNG.sync.read(Buffer.from(bBuf));
  if (a.width !== b.width || a.height !== b.height) return { err: '尺寸不合 ' + a.width + '×' + a.height + ' vs ' + b.width + '×' + b.height };
  const diff = new PNG({ width: a.width, height: a.height });
  const n = match(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.02 });
  fs.writeFileSync(path.join(SHOTS, tag + '.diff.png'), PNG.sync.write(diff));
  return { w: a.width, h: a.height, n, pct: +(n / (a.width * a.height) * 100).toFixed(4) };
}

const PAGES = ['index.html', 'me.html', 'settings.html', 'story.html', 'topic.html', 'planner.html', 'review.html', 'search.html', 'trip.html', 'expense.html', 'checklist.html', 'album.html', 'album-edit.html', 'travel-map.html', 'node-manager.html', 'md-manager.html', 'wishlist.html'];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const pg0 of await browser.pages()) await pg0.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  const goto = async (file) => {
    await pg.goto(pathToFileURL(path.join(ROOT, file)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  };
  const shot = async tag => {
    await pg.evaluate(() => document.querySelectorAll('.ui-toast, #nmTip, .toast, .ui-tilewarn').forEach(e => e.remove()));
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    fs.writeFileSync(path.join(SHOTS, tag + '.png'), buf);
    return buf;
  };
  const tokRead = () => pg.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = k => (cs.getPropertyValue(k) || '').trim();
    return {
      fd: g('--fd'), fb: g('--fb'), bg: g('--bg'), sm: g('--sm'), tf: g('--tf'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      hasTnStyle: [...document.querySelectorAll('style')].some(s => /(^|[;\s{])--fd\s*:/.test(s.textContent)),
      styleN: document.querySelectorAll('style').length,
      linkN: document.querySelectorAll('link[rel="stylesheet"]').length,
      panelInDom: !!document.querySelector('.tn-panel'),
    };
  });

  p('== A. 同一页只多注入一枚 <style>（面板不弹）：像素归因');
  await goto('index.html');
  const b0 = await tokRead();
  const s0 = await shot('A-before');
  p('   改前  --bg=' + b0.bg + '  body背景=' + b0.bodyBg + '  <style>数=' + b0.styleN + '  含--fd的style=' + b0.hasTnStyle + '  面板在DOM=' + b0.panelInDom);
  const injected = await pg.evaluate(() => {
    if (!window.TravelNotes || !TravelNotes.ensureUI) return 'NO-API';
    TravelNotes.ensureUI();
    return 'ok';
  });
  await new Promise(r => setTimeout(r, 900));
  const b1 = await tokRead();
  const s1 = await shot('A-after');
  p('   改后  --bg=' + b1.bg + '  body背景=' + b1.bodyBg + '  <style>数=' + b1.styleN + '  含--fd的style=' + b1.hasTnStyle + '  面板在DOM=' + b1.panelInDom + '（ensureUI→' + injected + '）');
  p('   逐条：' + ['--fd', '--fb', '--bg', '--sm', '--tf'].map(k => {
    const a = b0[k.replace('--', '')], c = b1[k.replace('--', '')];
    return k + (a === c ? ' 不变' : ' 变');
  }).join(' | '));
  const dA = pm(s0, s1, 'A-before-vs-after');
  p('   pixelmatch(0.02): ' + JSON.stringify(dA) + '   两图 sha ' + sha(s0) + ' / ' + sha(s1));
  p('   ⇒ 唯一的变量就是那枚 <style>（页面没有弹面板、没有点任何控件、时钟与随机数全钉死）');

  p('');
  p('== B. 17 个基线页逐页读 body 背景色（谁已被注入串换过纸色）');
  for (const f of PAGES) {
    await goto(f);
    const r = await tokRead();
    p('   ' + f.padEnd(19) + ' style含--fd=' + (r.hasTnStyle ? '是' : '否') + '  --bg=' + (r.bg || '(未定义)') + '  body=' + r.bodyBg + '  <link>数=' + r.linkN);
  }

  p('');
  p('== C. 字族像素对照（canvas 画同一串中文，比位图）');
  await goto('index.html');
  const face = await pg.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const stacks = {
      '品牌族 var(--font-serif)': (cs.getPropertyValue('--font-serif') || '').trim(),
      '泄漏族 --fd（改后）': '"LXGW WenKai","Kaiti SC",serif',
      '① 档字面 "Songti SC",serif': '"Songti SC",serif',
      '① 档字面 "Noto Sans SC",sans-serif': '"Noto Sans SC",sans-serif',
      '负对照 TRACE Serif（应==品牌族）': "'TRACE Serif'",
      'UA serif': 'serif',
      'UA sans-serif': 'sans-serif',
      '正对照 monospace（应与众不同）': 'monospace',
    };
    const TXT = '留下这一刻鹳雀楼九月二十六日';
    const res = {};
    for (const [k, stack] of Object.entries(stacks)) {
      const cv = document.createElement('canvas');
      cv.width = 460; cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 460, 64);
      g.fillStyle = '#000'; g.font = '700 28px ' + stack; g.textBaseline = 'top';
      g.fillText(TXT, 4, 8);
      const px = g.getImageData(0, 0, 460, 64).data;
      let ink = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 200) ink++;
      res[k] = { stack, digest: djb2(cv.toDataURL('image/png')), ink };
    }
    /* 位图摘要用 djb2 逐字符哈希整串（不是 sha，也不装作是）——这里只要求「同图⇒同摘要」这一方向 */
    function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16) + '/' + s.length; }
    return res;
  });
  const keys = Object.keys(face);
  for (const k of keys) p('   ' + k.padEnd(34) + ' 墨迹像素=' + String(face[k].ink).padStart(6) + '  位图摘要(djb2)=' + face[k].digest);
  p('');
  const pairs = [['品牌族 var(--font-serif)', '负对照 TRACE Serif（应==品牌族）'],
  ['品牌族 var(--font-serif)', '泄漏族 --fd（改后）'],
  ['品牌族 var(--font-serif)', '① 档字面 "Songti SC",serif'],
  ['UA serif', '泄漏族 --fd（改后）'],
  ['UA sans-serif', '① 档字面 "Noto Sans SC",sans-serif'],
  ['正对照 monospace（应与众不同）', '品牌族 var(--font-serif)']];
  p('   两两比位图（摘要相同＝同一套字）：');
  for (const [x, y] of pairs) p('   ' + (face[x].digest === face[y].digest ? '同图  ' : '不同图') + '  ' + x + '  vs  ' + y);
  const uniq = new Set(keys.map(k => face[k].digest)).size;
  p('');
  p('   自校准（两把都过才许读上面的账）：');
  p('   · 负对照: 品牌族 vs 单写 \'TRACE Serif\' 应同图 → ' + (face['品牌族 var(--font-serif)'].digest === face['负对照 TRACE Serif（应==品牌族）'].digest ? '过' : '不过（这台机器上品牌族没生效，整档作废）'));
  p('   · 正对照: 品牌族 vs monospace 应不同图 → ' + (face['品牌族 var(--font-serif)'].digest !== face['正对照 monospace（应与众不同）'].digest ? '过' : '不过（尺子失明）'));
  p('   · 八档去重后摘要种类数 = ' + uniq + '（= 1 说明这把尺子压根没在量字族）');

  p('');
  p('   注：这一档在 Windows Chrome 上量。手机上 ' + 'Songti SC/Kaiti SC/LXGW WenKai/PingFang SC 同样不命中，');
  p('   而 Microsoft YaHei 在 Windows 命中、Android 不命中 ⇒ 手机侧的差异只会≥本机读数，不会更小。');
  fs.writeFileSync(path.join(__dirname, 'b35a-leak.txt'), out.join('\n') + '\n');
  await browser.close();
})().catch(e => { p('THROW ' + (e && e.message)); fs.writeFileSync(path.join(__dirname, 'b35a-leak.txt'), out.join('\n') + '\n' + (e && e.stack)); process.exit(1); });
