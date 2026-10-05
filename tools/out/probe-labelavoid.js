/* probe-labelavoid.js — 定性 topic.1440/768 的双态：标签避让跑在字体换脸之前还是之后？
 *
 * 用法：node tools/out/probe-labelavoid.js [延迟ms…]
 *      默认 0 3000（不拦 = 复现模式 B；把 woff2 推迟 3s = 逼出模式 A）
 *
 * 机理假设：design.css:11–12 用 font-display:block，块期内标签用「隐形后备字体」的度量排版，
 * 宽度与换脸后的宋体不同；ui.js:305 labelAvoid / :330 capsuleAvoid 只在渲染后 ~200ms 各跑一次，
 * 跑的那一刻字体在不在 ⇒ 隐藏集合不同，而且这个决定会一路保留到截图（5s SETTLE 也不会重排）。
 * 判读：延迟档 ↔ 基线 0.000%、不延迟档 ↔ 基线 ~0.02% ⇒ 基线拍到的就是「避让跑在换脸前」那一态，
 *      双态根因是字体到达时机，不是网络/瓦片/聚合随机性。
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
const DELAYS = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const LIST = DELAYS.length ? DELAYS : [0, 3000];
const W = 1440, H = 900;

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const CLOCK = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc)[1];

const SNAP = () => {
  const ls = [...document.querySelectorAll('.node-label')];
  const vis = ls.filter(e => !e.classList.contains('hidden'));
  const R = vis.map(e => e.getBoundingClientRect());
  let ov = 0;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) ov++;
  }
  return {
    n: ls.length,
    hidden: ls.filter(e => e.classList.contains('hidden')).length,
    hiddenTxt: ls.filter(e => e.classList.contains('hidden')).map(e => e.textContent).join('|'),
    /* 可见标签两两重叠对数：>0 就是 labelAvoid 的后置条件被破坏（没跑 / 用了过期矩形） */
    overlaps: ov,
    ovTxt: (() => { const t = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], b = R[j]; if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) t.push(vis[i].textContent + '×' + vis[j].textContent); } return t.join(' , '); })(),
    /* 换脸前后标签宽度是否不同：sans 栈不含 TRACE Serif，这一列用来否掉字体假设 */
    widths: vis.slice(0, 6).map(e => Math.round(e.getBoundingClientRect().width)).join(','),
    fonts: document.fonts.status,
    serif: [...document.fonts].map(f => f.family.replace(/["']/g, '') + '/' + f.weight + ':' + f.status).join(' ')
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  const baseF = path.join(ROOT, 'tools', 'out', 'visual-baseline', 'topic.' + W + 'x' + H + '.png');
  const BASE = PNG.sync.read(fs.readFileSync(baseF));
  const d = a => {
    const I = PNG.sync.read(a), o = new PNG({ width: I.width, height: I.height });
    return (match(BASE.data, I.data, o.data, I.width, I.height, { threshold: 0.02 }) / (I.width * I.height) * 100).toFixed(3) + '%';
  };

  let curDelay = 0;
  await pg.setRequestInterception(true);
  pg.on('request', req => {
    const u = req.url();
    if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; }
    if (curDelay && /\.woff2(\?|$)/i.test(u)) { setTimeout(() => req.continue().catch(() => {}), curDelay); return; }
    req.continue().catch(() => {});
  });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  for (const delay of LIST) {
    curDelay = delay;
    await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    const s = await pg.evaluate(SNAP);
    await pg.evaluate(() => document.querySelectorAll('.ui-toast').forEach(e => e.remove()));
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    const tag = 'delay' + delay;
    fs.writeFileSync(path.join(ROOT, 'tools', 'out', '_label-' + tag + '.png'), buf);
    console.log(tag + '  ↔基线 ' + d(buf) + '  标签 ' + s.n + ' 隐藏 ' + s.hidden + ' 重叠对 ' + s.overlaps + '  fonts=' + s.fonts);
    console.log('   faces: ' + s.serif);
    console.log('   可见标签宽度(前6): ' + s.widths);
    console.log('   仍重叠: ' + (s.ovTxt || '(无)'));
    console.log('   被隐藏: ' + (s.hiddenTxt || '(无)'));
    /* 补跑一次避让：如果这一句把两个模式收敛到同一张图，产品侧修法定了 */
    await pg.evaluate(() => { if (window.labelAvoid) labelAvoid('#mapEl'); if (window.capsuleAvoid) capsuleAvoid('#mapEl'); });
    await new Promise(r => setTimeout(r, 200));
    const buf2 = await pg.screenshot({ type: 'png', animations: 'disabled' });
    fs.writeFileSync(path.join(ROOT, 'tools', 'out', '_label-' + tag + '-rerun.png'), buf2);
    const s2 = await pg.evaluate(SNAP);
    console.log('   补跑避让后 ↔基线 ' + d(buf2) + ' 隐藏 ' + s2.hidden + ' 重叠对 ' + s2.overlaps + ' 宽度 ' + s2.widths);
    console.log('   补跑后仍重叠: ' + (s2.ovTxt || '(无)') + ' | 补跑后隐藏: ' + (s2.hiddenTxt || '(无)'));
  }
  await browser.close();
})();
