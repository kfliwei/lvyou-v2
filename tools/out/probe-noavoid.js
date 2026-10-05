/* probe-noavoid.js — 反向验证：把标签避让掐掉，能不能精确复现基线那一态（模式 A）？
 *
 * 用法：node tools/out/probe-noavoid.js [label|capsule|both] [轮数]
 * 判读：掐掉后 ↔基线 0.000% ⇒ 基线拍到的就是「避让没生效」那一态，双态根因锁定在
 *      labelAvoid/capsuleAvoid 的调用时机（它们只在渲染后 80/120ms 各跑一次，跑早了不会补跑）；
 *      掐掉后仍 ~0.02% ⇒ 双态另有出处，回来查 LOD 重排。
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
const MODE = process.argv[2] || 'label';
const RUNS = +(process.argv[3] || 2);
const W = 1440, H = 900;

const vcSrc = fs.readFileSync(path.join(ROOT, 'tools', 'visual-check.js'), 'utf8');
const CLOCK = /const CLOCK = `([\s\S]*?)`;/.exec(vcSrc)[1];

const STUB = mode => `
  window.__avoidCalls = [];
  ${mode !== 'capsule' ? "Object.defineProperty(window,'labelAvoid',{configurable:true,get(){return function(){window.__avoidCalls.push('label:'+performance.now());};},set(){}});" : ''}
  ${mode !== 'label' ? "Object.defineProperty(window,'capsuleAvoid',{configurable:true,get(){return function(){window.__avoidCalls.push('capsule:'+performance.now());};},set(){}});" : ''}
`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const p of await browser.pages()) await p.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) req.abort().catch(() => {}); else req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(STUB(MODE));
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

  const BASE = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'tools', 'out', 'visual-baseline', 'topic.' + W + 'x' + H + '.png')));
  const d = a => { const I = PNG.sync.read(a), o = new PNG({ width: I.width, height: I.height }); return (match(BASE.data, I.data, o.data, I.width, I.height, { threshold: 0.02 }) / (I.width * I.height) * 100).toFixed(3) + '%'; };

  for (let i = 1; i <= RUNS; i++) {
    await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    const calls = await pg.evaluate(() => ({ n: (window.__avoidCalls || []).length, list: (window.__avoidCalls || []).join(','), hidden: document.querySelectorAll('.node-label.hidden').length, caps: document.querySelectorAll('.lod-cl.lod-mini,.lod-cl.lod-hide').length }));
    await pg.evaluate(() => document.querySelectorAll('.ui-toast').forEach(e => e.remove()));
    const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
    fs.writeFileSync(path.join(ROOT, 'tools', 'out', '_noavoid-' + MODE + '-' + i + '.png'), buf);
    console.log('轮' + i + ' [' + MODE + '] ↔基线 ' + d(buf) + '  避让被调 ' + calls.n + ' 次(' + calls.list + ') 隐藏标签 ' + calls.hidden + ' 降级胶囊 ' + calls.caps);
  }
  await browser.close();
})();
