/* probe33g-obskip.js — 一次性地基实测：首启引导蒙层那一屏的触控档，两腿都没有视野
 *
 * 由来：§39 的口径是「尺寸只在 design.css 单点点名」。33-E 补的是面板那一族，普查时顺着
 *       「运行时注入 <style>」这个形状又捞出两支：
 *         ① expense-form.js:52 injectCSS()——串里确实写尺寸，但逐条读下来全都 ≥44
 *            （.x-btn min-height:44px／.chip min-height:44px／input height:44px），无症状，本批不动；
 *         ② index.html:551 首启引导蒙层——同串里 .ob-btn 有 min-height:44px，
 *            而 .ob-skip（「跳过 ›」）只有 padding:9px 14px + font-size:var(--fs-4)＝13px，
 *            没有任何 min-height。按 CSS 算约 34–38px，但**算的不是量**，这一支就是要把它量出来。
 *       为什么两腿都看不见：index.html 既不在 verify.js §39 的 FILES39（17 文件）里，
 *       也不在 smoke-topbar 的 BAR_PAGES（13 页）里；而像素基线**明确把这屏排除在外**
 *       （visual-check.js:204-205 提前写 tn_onboarded=1，注释说「由 tools/smoke.js 的断言 + 点击探针覆盖」，
 *       可 smoke.js:39-49 只断言蒙层出现/消失与标志位，一条几何没量）。
 *       ⇒ 「这屏只有跳过钮，而跳过钮矮于地板」这件事，今天没有任何常驻证据。
 *
 * 用法：node tools/out/probe33g-obskip.js      （只读，不改产品文件；读数自己写盘）
 * 口径：与闸门逐字相同的前置（拦 http / CLOCK 桩 / reduce / dsf=2），但**反过来**要清掉
 *       tn_onboarded，否则蒙层根本不挂载。动画收尾再量（跳过钮在 .ob-mask 里，reduce 已关掉过渡）。
 * 自纠（第一版就栽在这儿）：初版把每一枚选中节点都拿去比 44，于是 .ob-dot（<span> 进度指示点，
 *       设计就是 8×8）被印成「低于 44 地板」——那是探针自己在说谎。现在按 tagName/onclick/role
 *       分交互与非交互两类，只有交互件参与地板判定，非交互件明写「不参与」。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');
const LOG = path.join(ROOT, 'tools', 'out', 'b33g-obskip.txt');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };`;
const lines = [];
const p = s => { console.log(s); lines.push(s); fs.writeFileSync(LOG, lines.join('\n') + '\n'); };

const VIEWS = [{ W: 328, H: 723 }, { W: 320, H: 640 }];
const SELS = ['.ob-skip', '.ob-btn', '.ob-dot', '.ob-mask'];

const MEASURE = (sels) => {
  const r = {};
  for (const sel of sels) {
    const nodes = Array.from(document.querySelectorAll(sel));
    r[sel] = nodes.map(n => {
      const b = n.getBoundingClientRect(), c = getComputedStyle(n);
      return {
        text: (n.textContent || '').trim().slice(0, 8),
        w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
        x: Math.round(b.x), y: Math.round(b.y),
        minH: c.minHeight, pad: c.padding, fs: c.fontSize, lh: c.lineHeight,
        /* 命中测试：中心点落下来第一个是不是它自己（z9990 全屏蒙层里唯一的逃逸口） */
        top: (() => {
          const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return el ? (el.className || el.tagName) + (el === n ? ' [自己]' : ' [不是自己]') : '(无)';
        })(),
        /* 是不是交互元素：只有可点的才参与 44 地板。
           .ob-dot 是 <span> 进度指示点（8×8，设计如此），把它算成「低于地板」就是探针自己在说谎。 */
        interactive: /^(button|a|input|select|textarea)$/i.test(n.tagName) ||
          n.onclick != null || !!n.getAttribute('onclick') ||
          ['button', 'link'].indexOf(n.getAttribute('role') || '') >= 0,
      };
    });
  }
  return r;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const q of await browser.pages()) await q.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.evaluateOnNewDocument(() => { try { localStorage.removeItem('tn_onboarded'); } catch (e) {} });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  p('=== 首启引导蒙层触控档实测（33-G 地基，两腿无视野的那一屏）===');
  p('前提：tn_onboarded 已清（index.html:538 那条 if 不放行就没有蒙层）；拦 http / CLOCK 桩 / reduce / dsf=2 与闸门同口径');
  for (const v of VIEWS) {
    await pg.setViewport({ width: v.W, height: v.H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    const mounted = await pg.evaluate(() => !!document.querySelector('.ob-mask'));
    p('');
    p('--- ' + v.W + '×' + v.H + '  蒙层挂载=' + mounted + '  根字号=' + await pg.evaluate(() => getComputedStyle(document.documentElement).fontSize) + ' ---');
    if (!mounted) { p('  中止：这一档没挂载，量不到（不是「够 44」，是没样本）'); continue; }
    const m = await pg.evaluate(MEASURE, SELS);
    for (const sel of SELS) {
      for (const n of m[sel]) {
        p('  ' + sel + '「' + n.text + '」 rect=' + n.w + '×' + n.h + ' @' + n.x + ',' + n.y +
          '  min-height=' + n.minH + '  padding=' + n.pad + '  font=' + n.fs + '  line-height=' + n.lh +
          '  中心命中=' + n.top +
          (n.interactive
            ? '  → 交互件：高' + (n.h >= 44 ? '达标(' + n.h + '≥44)' : '**低于 44 地板**(' + n.h + ')') +
              '  宽' + (n.w >= 44 ? '达标' : '**低于 44 地板**(' + n.w + ')')
            : '  → 非交互（指示点/容器），不参与 44 地板判定'));
      }
    }
    /* 自校准（与 K34 同口径）：给同一枚挂 inline min-height:44px，必须当场读到 ≥44。
       读不到就是尺子没量对（蒙层在动画里／选择器打错／量的是另一枚），下面的「低于地板」就不可信。 */
    const cal = await pg.evaluate(() => {
      const n = document.querySelector('.ob-skip');
      if (!n) return { ok: false, why: '没有 .ob-skip' };
      n.style.minHeight = '44px';
      const h = Math.round(n.getBoundingClientRect().height * 10) / 10;
      n.style.minHeight = '';
      const back = Math.round(n.getBoundingClientRect().height * 10) / 10;
      return { ok: h >= 44, h, back };
    });
    p('  自校准（给 .ob-skip 挂 inline min-height:44px 再读）：' + (cal.ok ? '读到 ' + cal.h + ' ≥44 → 尺子灵；' : '读到 ' + cal.h + ' → 尺子不灵，本档读数作废') +
      ' 摘回 inline 后=' + cal.back + '（这一条同时明写：浏览器腿对 inline 覆写有视野，对注入串里那条 padding 式高度只能读结果）');
  }
  p('');
  /* 源码侧的三条分母，用来判断「要不要连 design.css 单点一起改」 */
  const fsHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'design.css'), 'utf8');
  p('=== 出处对账（源码侧）===');
  p('  index.html 里 .ob-skip 的规则体出现次数=' + (fsHtml.match(/\.ob-skip\{/g) || []).length + '（全在 :551 那条注入串里）');
  p('  design.css 里 .ob- 命中行数=' + css.split('\n').filter(l => l.indexOf('.ob-') >= 0).length + '（0 ⇒ 这一族完全在单点之外）');
  const vjs = fs.readFileSync(path.join(ROOT, 'tools', 'verify.js'), 'utf8');
  const arr = (vjs.match(/const FILES39 = \[[\s\S]*?\];/) || ['(抽不出 FILES39 名单)'])[0];
  p('  verify.js §39 的 FILES39 含 index.html=' + (arr.indexOf("'index.html'") >= 0) + '（名单长度=' + (arr.match(/'[^']+\.js'|'[^']+\.html'|'[^']+\.css'|'[^']+\.md'/g) || []).length + ' 项）');
  const stj = fs.readFileSync(path.join(ROOT, 'tools', 'smoke-topbar.js'), 'utf8');
  const bars = (stj.match(/const BAR_PAGES = \[[\s\S]*?\];/) || ['(抽不出 BAR_PAGES 名单)'])[0];
  p('  smoke-topbar 的 BAR_PAGES 含 index.html=' + (bars.indexOf("'index.html'") >= 0) + '（名单里 ' + (bars.match(/'[^']+\.html'/g) || []).length + ' 页）');
  p('  expense-form.js 注入串里的尺寸声明逐条：min-height:44px ×' + ((fs.readFileSync(path.join(ROOT, 'expense-form.js'), 'utf8').match(/min-height:44px/g) || []).length) +
    '、height:44px ×' + ((fs.readFileSync(path.join(ROOT, 'expense-form.js'), 'utf8').match(/height:44px/g) || []).length) +
    '（无 <44 ⇒ 同族形状、无当前症状）');
  await browser.close();
  p('');
  p('落盘：tools/out/b33g-obskip.txt');
})().catch(e => {
  p('探针异常：' + (e && e.stack || e));
  process.exit(1);
});
