/* probe-label-stable.js — 标签避让修好后的决定性检验：同一台机器上反复拍，还会不会换模式？
 *
 * 用法：node tools/out/probe-label-stable.js [--load]
 *   --load = 另起 4 个忙等进程抢 CPU，把「避让跑在缩放动画中途」的时机窗强行放大
 *            （修前正是这种负载让全量跑 1/3 概率飘到模式 A）。
 *
 * 每档拍 3 轮，报三件事：
 *   1) 后置不变量：可见标签两两重叠对数必须为 0（labelAvoid 的语义就是不许重叠）；
 *   2) 轮间互差：3 轮两两像素 diff 必须 0.000%（这才叫确定性，不是"这次没飘"）；
 *   3) 对旧基线差：旧基线是没补测那一态，修好后应当稳定地差一点，重拍基线后归零。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');
const _pm = require('pixelmatch');
const match = _pm.default || _pm;

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LOAD = process.argv.includes('--load');
const ROUNDS = 3;
const VPS = [[768, 1024], [1440, 900], [452, 995]];

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const CLOCK = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc)[1];

const SNAP = () => {
  const vis = [...document.querySelectorAll('.node-label')].filter(e => !e.classList.contains('hidden'));
  const R = vis.map(e => e.getBoundingClientRect());
  let ov = 0;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) ov++;
  }
  return { labels: document.querySelectorAll('.node-label').length, hidden: document.querySelectorAll('.node-label.hidden').length, overlaps: ov };
};

(async () => {
  const burners = [];
  if (LOAD) for (let i = 0; i < 4; i++) burners.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) req.abort().catch(() => {}); else req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const d = (a, b) => { const A = PNG.sync.read(a), B = PNG.sync.read(b), o = new PNG({ width: A.width, height: A.height }); return (match(A.data, B.data, o.data, A.width, A.height, { threshold: 0.02 }) / (A.width * A.height) * 100).toFixed(3) + '%'; };
  let bad = 0;
  for (const [W, H] of VPS) {
    const tag = 'topic.' + W + 'x' + H;
    const shots = [];
    for (let r = 1; r <= ROUNDS; r++) {
      await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
      await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r2 => setTimeout(r2, 5000));
      const s = await pg.evaluate(SNAP);
      await pg.evaluate(() => document.querySelectorAll('.ui-toast').forEach(e => e.remove()));
      const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
      shots.push(buf);
      const bf = path.join(ROOT, 'tools', 'out', 'visual-baseline', tag + '.png');
      console.log(tag + ' 轮' + r + ' 标签 ' + s.labels + ' 隐藏 ' + s.hidden + ' 重叠对 ' + s.overlaps + '  ↔旧基线 ' + (fs.existsSync(bf) ? d(buf, fs.readFileSync(bf)) : '缺'));
      if (s.overlaps) { bad++; console.log('   FAIL 后置不变量：仍有 ' + s.overlaps + ' 对可见标签重叠'); }
    }
    for (let i = 1; i < shots.length; i++) {
      const p = d(shots[0], shots[i]);
      console.log(tag + ' 轮1↔轮' + (i + 1) + ' 互差 ' + p);
      if (p !== '0.000%') bad++;
    }
    fs.writeFileSync(path.join(ROOT, 'tools', 'out', '_stable-' + tag + '.png'), shots[0]);
  }
  await browser.close();
  for (const b of burners) b.kill();
  console.log(bad ? '\n结论：' + bad + ' 项不合格' : '\n结论：' + (LOAD ? '负载下' : '') + '3 轮全一致、重叠对恒 0 —— 确定性成立');
  process.exit(bad ? 1 : 0);
})();
