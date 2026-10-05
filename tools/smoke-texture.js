/* tools/smoke-texture.js — UI-5 质感语言的浏览器侧闸门
 *
 * verify.js §23 只能证明「源码里写了这个 token、挂在这个选择器上」，证明不了三件事：
 *   ① 计算值真的落地（var() 拼错、后发覆盖、这条规则没被加载，源码看着一样绿）；
 *   ② 手机上看得见的是哪一层——本轮就是这一档抓到 18 处真 bug：
 *      每个页自己 <style> 里的 body{background:var(--color-bg)} 是简写，会把 design.css 铺在
 *      body 上的 --grain-page 复位成 none，纸颗粒「源码里写着、屏幕上没有」，CSS 不报错；
 *   ③ 质感不随机型变（452dp 与 393dp 上同一套 token 必须同值：字号随机型变是刻意的，纸和影不是）。
 * 前置态与 smoke-photo / smoke-motion 一致：跳引导、冻时钟、钉 reduced-motion、起本地 http（不吃外网）。
 * NODE_PATH 需指到 tools/node_modules。用法：
 *   NODE_PATH=tools/node_modules node tools/smoke-texture.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8151', 10);
const BASE = 'http://127.0.0.1:' + PORT;

let failures = 0, passed = 0;
function check(name, pass, detail) {
  if (pass) passed++; else failures++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  [' + detail + ']'));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* 自定义属性走 getPropertyValue 拿到的是源码原文（rgba(250,248,243,.82)），
   而计算样式给的是规范化写法（rgba(250, 248, 243, 0.82)）。两边都归一再比，
   否则这个闸门从第一天起就全是假红。 */
const nrm = s => String(s === undefined ? '' : s).replace(/\s+/g, '').replace(/0\./g, '.').toLowerCase();

const server = http.createServer(function (req, res) {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
      : p.endsWith('.css') ? 'text/css;charset=utf-8'
      : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
      : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    res.end(data);
  });
});

const CLOCK = `const __T = new Date('2026-10-05T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;`;

/* 读一次：:root 的质感 token + 各挂点的计算值。
   元素当前没渲染出来时（图层菜单要点击、Sheet 要有数据）临时造一个同 class 的探针节点：
   这一档问的是「这条 CSS 规则计算出来是什么」，节点在不在场由 smoke-states 那类闸门管。 */
const READ_ALL = `()=>{
  const cs = getComputedStyle(document.documentElement);
  const tok = n => (cs.getPropertyValue(n) || '');
  const el = (sel, cls) => {
    let e = document.querySelector(sel);
    let synthetic = false;
    if (!e && cls) { e = document.createElement('div'); e.className = cls; e.id = 'tx-probe-' + cls.replace(/[^a-z]/g, ''); document.body.appendChild(e); synthetic = true; }
    if (!e) return null;
    const c = getComputedStyle(e);
    return { bf: c.backdropFilter || c.webkitBackdropFilter || 'none',
      bgColor: c.backgroundColor, bgImg: c.backgroundImage, bgSize: c.backgroundSize,
      shadow: c.boxShadow, borderColor: c.borderTopColor, synthetic: synthetic };
  };
  return {
    tokens: {
      'blur-bar': tok('--blur-bar'), 'blur-sheet': tok('--blur-sheet'),
      'glass-bar': tok('--glass-bar'), 'glass-sheet': tok('--glass-sheet'), 'paper-bar': tok('--paper-bar'),
      'edge-hair': tok('--edge-hair'), 'edge-hair-soft': tok('--edge-hair-soft'),
      grain: tok('--grain'), 'grain-page': tok('--grain-page'),
      'shadow-soft': tok('--shadow-soft'), 'shadow-medium': tok('--shadow-medium'),
      'shadow-float': tok('--shadow-float'), 'shadow-rise': tok('--shadow-rise'), 'shadow-pop': tok('--shadow-pop'),
      'scrim-cover': tok('--scrim-cover'), 'scrim-modal': tok('--scrim-modal'), 'scrim-photo': tok('--scrim-photo')
    },
    els: {
      body: el('body'), card: el('.card', 'card'), nav: el('.bottom-nav'), sheet: el('.sheet', 'sheet'),
      tabbar: el('.tabbar', 'tabbar'), nsearch: el('.nsearch-bar', 'nsearch-bar'),
      locSheet: el('.location-sheet', 'location-sheet'), memSheet: el('#memSheet', 'mem-missing-cls'),
      ctl: el('.ctl', 'ctl'), legend: el('.legend', 'legend'), laymenu: el('.laymenu', 'laymenu'),
      lod: el('.lod-cl', 'lod-cl')
    }
  };
}`;

const PIX = async buf => pg.evaluate(async b => {
  const blob = await (await fetch('data:image/png;base64,' + b)).blob();
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0);
  const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
  let s = 0, sq = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const L = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; s += L; sq += L * L; n++; }
  const mean = s / n;
  return { mean: mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}, buf.toString('base64'));

let pg, browser;

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  pg = await browser.newPage();
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const read = () => pg.evaluate(new Function('return ' + READ_ALL)());

  /* ============ A 452dp（一加 Ace 6T 落档）index.html：token 在计算样式里逐值对账 ============ */
  await pg.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(3500);
  const A = await read(), T = A.tokens;
  const TOK = {
    'blur-bar': 'blur(20px) saturate(1.5)', 'blur-sheet': 'blur(26px) saturate(1.6)',
    'glass-bar': 'rgba(250,248,243,.82)', 'glass-sheet': 'rgba(250,248,243,.90)', 'paper-bar': '#FAF8F3',
    'edge-hair': 'rgba(33,26,19,.14)', 'edge-hair-soft': 'rgba(33,26,19,.08)',
    'scrim-cover': 'rgba(32,32,29,.22)', 'scrim-modal': 'rgba(32,32,29,.45)', 'scrim-photo': 'rgba(0,0,0,.55)',
    'shadow-soft': '0 1px 2px rgba(33,26,19,.04),0 12px 30px -14px rgba(33,26,19,.14)',
    'shadow-medium': '0 2px 6px rgba(33,26,19,.05),0 22px 48px -18px rgba(33,26,19,.22)',
    'shadow-float': '0 4px 14px rgba(33,26,19,.08),0 30px 66px -22px rgba(33,26,19,.32)',
    'shadow-rise': '0 -2px 6px rgba(33,26,19,.05),0 -22px 48px -18px rgba(33,26,19,.22)',
    'shadow-pop': '0 20px 44px -18px rgba(27,23,19,.42)'
  };
  Object.keys(TOK).forEach(k => check('A' + ' 质感 ' + k + ' 计算值逐值核定', nrm(T[k]) === nrm(TOK[k]), '实际 ' + JSON.stringify(T[k])));

  /* ============ B 纸是真的纸：颗粒确实铺在 body 上（就是这一条抓到 18 处简写复位） ============ */
  check('B1 body 的 background-image 里有纸颗粒（没被页内 background 简写抹掉）',
    /url\(/.test(A.els.body.bgImg), 'background-image=' + A.els.body.bgImg.slice(0, 48));
  check('B2 body 颗粒平铺尺寸 = 140px 140px（尺寸错了颗粒粗细就变了）',
    nrm(A.els.body.bgSize) === nrm('140px 140px'), 'background-size=' + A.els.body.bgSize);
  check('B3 卡面干净：.card 不带任何 background-image（纸上再糊一层沙就是脏）',
    !!A.els.card && A.els.card.bgImg === 'none',
    A.els.card ? (A.els.card.synthetic ? '合成节点' : '真实节点') + ' bgImg=' + A.els.card.bgImg.slice(0, 40) : '取不到 .card');
  check('B4 .card 的描边吃到暖墨一族', !!A.els.card && nrm(A.els.card.borderColor) === nrm('rgba(33, 26, 19, 0.14)'), A.els.card && A.els.card.borderColor);
  check('B5 卡面不靠影靠线：.card 的 box-shadow 必须是 none（UI-2 定案，淡影在米底上只会读成脏）',
    !!A.els.card && A.els.card.shadow === 'none', A.els.card && A.els.card.shadow.slice(0, 92));
  check('B6 底部导航吃 bar 档：blur 与 .82 透底同体', (() => {
    const e = A.els.nav; return !!e && nrm(e.bf) === nrm('blur(20px) saturate(1.5)') && nrm(e.bgColor) === nrm('rgba(250, 248, 243, 0.82)');
  })(), A.els.nav && ('bf=' + A.els.nav.bf + ' bg=' + A.els.nav.bgColor));

  /* ============ C 名单外一律实心纸（travel-map 的地图浮层是最贵的一档：底是 WebGL 地图） ============ */
  await pg.goto(BASE + '/travel-map.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(4000);
  const M = await read();
  const solid = (label, key) => {
    const e = M.els[key];
    check(label + ' 名单外换实心纸（无 blur + 不透明米白）',
      !!e && nrm(e.bf) === 'none' && nrm(e.bgColor) === nrm('rgb(250, 248, 243)'),
      e ? (e.synthetic ? '合成节点 ' : '') + 'bf=' + e.bf + ' bg=' + e.bgColor : '取不到');
  };
  solid('C1 地图控件 .ctl', 'ctl');
  solid('C2 图例 .legend', 'legend');
  solid('C3 图层菜单 .laymenu', 'laymenu');
  check('C5 地图浮层的影也吃暖墨档', !M.els.ctl || /rgba\(33, 26, 19/.test(M.els.ctl.shadow), M.els.ctl && M.els.ctl.shadow.slice(0, 80));
  const ms = M.els.memSheet;
  check('C6 记忆面板吃 sheet 档（blur + .90 透底同体）',
    !!ms && nrm(ms.bf) === nrm('blur(26px) saturate(1.6)') && nrm(ms.bgColor) === nrm('rgba(250, 248, 243, 0.9)'),
    ms ? 'bf=' + ms.bf + ' bg=' + ms.bgColor : '取不到 #memSheet');

  /* ============ D 专题页：tabbar 走 bar 档，后发的 .location-sheet 覆盖不许把 blur 挤掉 ============ */
  await pg.goto(BASE + '/topic.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(4000);
  const TP = await read();
  check('D1 专题 tabbar 吃 bar 档', !!TP.els.tabbar && nrm(TP.els.tabbar.bf) === nrm('blur(20px) saturate(1.5)') &&
    nrm(TP.els.tabbar.bgColor) === nrm('rgba(250, 248, 243, 0.82)'), TP.els.tabbar && ('bf=' + TP.els.tabbar.bf + ' bg=' + TP.els.tabbar.bgColor));
  const ls = TP.els.locSheet;
  check('D2 详情 Sheet 在 map.css 后发覆盖之后仍然是「blur + .90 透底」（后发只该改圆角底色，不该把挂点拆了）',
    !!ls && nrm(ls.bf) === nrm('blur(26px) saturate(1.6)') && nrm(ls.bgColor) === nrm('rgba(250, 248, 243, 0.9)'),
    ls ? (ls.synthetic ? '合成节点 ' : '') + 'bf=' + ls.bf + ' bg=' + ls.bgColor : '取不到 .location-sheet');
  check('D3 body 颗粒在专题页也在（每个页的 background 简写都会抹掉它，逐页验才拦得住）',
    /url\(/.test(TP.els.body.bgImg), 'background-image=' + TP.els.body.bgImg.slice(0, 40));
  /* 聚合胶囊归专题页管：node-lod.js 只在 topic.html 渲染，而 travel-map.html 根本不加载 map.css
     （它自带一份浮层样式），在那儿探 .lod-cl 只会拿到「没有这条规则」的透明底——首跑就是这么假红的。 */
  const lod = TP.els.lod;
  check('D4 聚合胶囊 .lod-cl 名单外换实心纸（无 blur + 不透明米白）',
    !!lod && nrm(lod.bf) === 'none' && nrm(lod.bgColor) === nrm('rgb(250, 248, 243)'),
    lod ? (lod.synthetic ? '合成节点 ' : '') + 'bf=' + lod.bf + ' bg=' + lod.bgColor : '取不到 .lod-cl');

  /* ============ E 暗档：玻璃/纸/描边翻，blur 与影不翻 ============ */
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(3000);
  await pg.evaluate(() => document.documentElement.classList.add('theme-dark'));
  await sleep(600);
  const DK = (await read()).tokens;
  check('E1 暗档 --glass-bar 翻 rgba(29,28,25,.82)', nrm(DK['glass-bar']) === nrm('rgba(29,28,25,.82)'), DK['glass-bar']);
  check('E2 暗档 --glass-sheet 翻 rgba(29,28,25,.90)', nrm(DK['glass-sheet']) === nrm('rgba(29,28,25,.90)'), DK['glass-sheet']);
  check('E3 暗档 --paper-bar 翻 #1D1C19', nrm(DK['paper-bar']) === nrm('#1D1C19'), DK['paper-bar']);
  check('E4 暗档描边翻暖米（写死的 rgba(32,32,29,…) 在暗底上等于没有线）',
    nrm(DK['edge-hair']) === nrm('rgba(239,233,220,.16)') && nrm(DK['edge-hair-soft']) === nrm('rgba(239,233,220,.09)'),
    DK['edge-hair'] + ' / ' + DK['edge-hair-soft']);
  ['blur-bar', 'blur-sheet', 'shadow-soft', 'shadow-medium', 'shadow-float', 'shadow-rise', 'shadow-pop', 'grain', 'grain-page']
    .forEach(k => check('E5 暗档 ' + k + ' 不翻（影和模糊是物理量，纸翻深了不会自己变浅）', nrm(DK[k]) === nrm(T[k]), '实际 ' + JSON.stringify(DK[k])));

  /* ============ F grain 强度核定：纯纸区 on/off 的亮度标准差 ============ */
  await pg.setContent('<html><head><link rel="stylesheet" href="' + BASE + '/design.css"></head><body></body></html>');
  await sleep(1200);
  const paper = await pg.evaluate(() => {
    const c = getComputedStyle(document.body);
    return { img: c.backgroundImage.slice(0, 30), size: c.backgroundSize };
  });
  check('F1 空白纸面上 body 仍铺 grain 且 140px 平铺（这条排除了「页面内容挡住了」的解释）',
    /url\(/.test(paper.img) && nrm(paper.size) === nrm('140px 140px'), JSON.stringify(paper));
  const clip = { x: 20, y: 400, width: 160, height: 160 };
  const on = await PIX(await pg.screenshot({ clip: clip }));
  await pg.evaluate(() => document.documentElement.style.setProperty('--grain-page', 'none'));
  await sleep(300);
  const off = await PIX(await pg.screenshot({ clip: clip }));
  await pg.evaluate(() => document.documentElement.style.removeProperty('--grain-page'));
  const dSd = on.sd - off.sd;
  console.log('     （grain 开 σ=' + on.sd.toFixed(3) + ' / 关 σ=' + off.sd.toFixed(3) + ' / 纸面均值 ' + off.mean.toFixed(1) + '）');
  check('F2 grain 真的落到像素上（Δσ ≥ 0.4：低于这个值等于白铺一层看不见的图）', dSd >= 0.4, 'Δσ=' + dSd.toFixed(3));
  check('F3 grain 没铺成脏斑（Δσ ≤ 2.0：超过这个值纸面开始出现斑团，商用纸感就没了）', dSd <= 2.0, 'Δσ=' + dSd.toFixed(3));

  /* ============ G 质感不随机型变 ============ */
  await pg.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(3000);
  const S = (await read()).tokens;
  const drift = Object.keys(TOK).filter(k => nrm(S[k]) !== nrm(T[k]));
  check('G1 15 个质感 token 在 393dp 与 452dp 上同值（字号随机型变是刻意的，纸和影不是）',
    drift.length === 0, drift.length ? drift.map(k => k + '=' + JSON.stringify(S[k])).join(' | ') : '两档一致');
  check('G2 393dp 上 body 仍铺 grain 且尺寸不变',
    nrm((await pg.evaluate(() => getComputedStyle(document.body).backgroundSize))) === nrm('140px 140px'), '');

  console.log('\n=== smoke-texture: ' + passed + ' 项通过 / ' + failures + ' 项失败 ===');
  process.exitCode = failures ? 1 : 0;
})().catch(e => {
  console.log('FAIL 运行异常: ' + (e && e.message ? e.message : e));
  failures++;
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  server.close();
});
