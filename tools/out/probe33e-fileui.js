/* 批次 33-E 地基探针 第四支：smoke-topbar 用的是 file:///，那条腿能不能测到面板族
   probe33e-panel.js 已经用 http + IndexedDB 把真值量出来了（.tn-x 44×44、#tnDocBtn 51×44、
   .tn-tagbar button 两枚各 44、#tnSearch 182×44，两档一致）。但 K34/K35 要住进 smoke-topbar.js，
   那一支全程走 file:///（没有 http 服务、没有 IndexedDB 授权）。这一支就回答一个问题：
   在 file:// 下 ensureUI() / openPanel() / openList() 之后，哪些元素有真 rect、哪些只能读 computed。
   只读数，不改盘。 */
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer-core'));
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SNAP = function () {
  const r = [];
  const q = sel => document.querySelector(sel);
  const info = (label, el, cs) => {
    if (!el) { r.push(label + '=缺'); return; }
    const b = el.getBoundingClientRect();
    r.push(label + '=' + Math.round(b.width) + 'x' + Math.round(b.height) +
      (cs ? ' computed ' + cs.minHeight + '/' + cs.width + '/' + cs.height : ''));
  };
  info('panel', q('.tn-panel'));
  info('list', q('.tn-list'));
  info('listbar', q('.tn-listbar'));
  info('head-x', q('.tn-panel .tn-head .tn-x'));
  info('pill-doc', q('#tnDocBtn'));
  info('viewtab', q('#tnViewTrip'));
  info('search', q('#tnSearch'));
  info('quote-btn', q('#tnQuote'));
  const bar = q('.tn-tagbar');
  r.push('tagbar=' + (bar ? getComputedStyle(bar).display : '缺'));
  if (bar) {
    const b = document.createElement('button');
    b.textContent = '#木塔';
    bar.appendChild(b);
    const cs = getComputedStyle(b);
    r.push('tagbar合成钮 computed minH=' + cs.minHeight + ' rect=' + Math.round(b.getBoundingClientRect().height));
    b.remove();
  }
  /* design.css 那条 body .tn-x 对合成钮生效吗（证明单点读得到，且注入串没盖住它） */
  const bx = document.createElement('button');
  bx.className = 'tn-x';
  (q('.tn-panel .tn-head') || document.body).appendChild(bx);
  const c2 = getComputedStyle(bx), r2 = bx.getBoundingClientRect();
  r.push('tn-x合成钮 ' + Math.round(r2.width) + 'x' + Math.round(r2.height) + ' computed ' + c2.width + '/' + c2.height);
  bx.remove();
  /* 无牙自校准：同一枚 .tn-x 挂上 inline 34px。inline 的特异度高于 body .tn-x，
     所以这一枚一定回到 34×34 —— 它证明「浏览器腿量的是 CSS 出处，不是调用点」。
     尺子对 inline 覆盖结构性失明，K34 的注释必须把这条盲区写清，不能声称守住了落点。 */
  const bz = document.createElement('button');
  bz.className = 'tn-x';
  bz.style.cssText = 'width:34px;height:34px';
  (q('.tn-panel .tn-head') || document.body).appendChild(bz);
  const c3 = getComputedStyle(bz), r3 = bz.getBoundingClientRect();
  r.push('tn-x带inline34 ' + Math.round(r3.width) + 'x' + Math.round(r3.height) + ' computed ' + c3.width + '/' + c3.height);
  bz.remove();
  return r.join(' | ');
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const p = await browser.newPage();
  await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + String(m.text()).slice(0, 90)); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p.goto('file:///' + ROOT + 'index.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(2600);
  const hasTN = await p.evaluate(() => !!(window.TravelNotes && window.TravelNotes.ensureUI));
  console.log('TravelNotes.ensureUI 在场：' + hasTN);
  console.log('[载入即测] ' + await p.evaluate(SNAP));
  await p.evaluate(() => { if (window.TravelNotes) TravelNotes.ensureUI(); });
  await sleep(300);
  console.log('[ensureUI 后] ' + await p.evaluate(SNAP));
  await p.evaluate(() => { TravelNotes.openPanel({ label: '应县木塔', lat: 39.66, lng: 113.13, __i: 0 }); });
  await sleep(900);
  console.log('[openPanel 后] ' + await p.evaluate(SNAP));
  await p.evaluate(() => { TravelNotes.openList(); });
  await sleep(1200);
  console.log('[openList 后] ' + await p.evaluate(SNAP));
  console.log('报错 ' + errs.length + ' 条：' + errs.slice(0, 4).join(' || '));

  const pm = await browser.newPage();
  await pm.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  await pm.goto('file:///' + ROOT + 'me.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(1800);
  const ics = await pm.evaluate(() => [...document.querySelectorAll('.entry .ic')].slice(0, 3).map(function (e) {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return Math.round(r.width) + 'x' + Math.round(r.height) + ' radius=' + cs.borderRadius + ' bg=' + cs.backgroundImage.slice(0, 24) + ' display=' + cs.display;
  }));
  console.log('\n[me.html file://] .entry .ic 实测：' + JSON.stringify(ics));
  await browser.close();
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(2); });
