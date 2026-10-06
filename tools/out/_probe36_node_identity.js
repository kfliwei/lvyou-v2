/* tools/out/_probe36_node_identity.js — 批次 22 收口前的一个成因复核（一次性探针，不留产品代码）
 *
 * 为什么要打这一针：B4（把 close() 里的「还活着的那一枚」找回摘掉）实测能把 A19 打红，
 * 说明开一趟景点卡之后 opener 那枚 DOM 确实不在文档上了；而 ui.js 的注释与 §36 的报错文案
 * 都把它记在 `setIcon` 头上。可 vendor/leaflet/leaflet.js 反解出来的 DivIcon._createIcon
 * 是 `t && "DIV" === t.tagName ? t : document.createElement("div")`，也就是**复用同一枚 DIV**，
 * Marker._initIcon 只在 `i !== this._icon` 时才 _removeIcon——两条读数互相打架。
 * B6（补名挪到 setIcon 之前）打不出红，正是「复用」那头的预期。
 *
 * 这个探针只回答两个问题：① 那枚 opener 节点开层后还在不在文档里、还是不是同一枚对象；
 * ② 这期间 _initIcon / _removeIcon / setIcon / clearLayers / addLayer 各被调了几次。
 * 用法: NODE_PATH=tools/node_modules node tools/out/_probe36_node_identity.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('pageerror: ' + e.message.slice(0, 160)));
  await p.goto(fileUrl('topic.html') + '?p=bj', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await new Promise(r => setTimeout(r, 2000));

  await p.evaluate(() => {
    const L = window.L, M = L.Marker.prototype;
    const log = window.__log = { initIcon: 0, removeIcon: 0, setIcon: 0, clearLayers: 0, addLayer: 0, removeLayer: 0 };
    const w = (proto, name, key) => {
      const o = proto[name];
      proto[name] = function () { log[key]++; return o.apply(this, arguments); };
    };
    w(M, '_initIcon', 'initIcon');
    w(M, '_removeIcon', 'removeIcon');
    w(M, 'setIcon', 'setIcon');
    w(L.LayerGroup.prototype, 'clearLayers', 'clearLayers');
    w(L.Map.prototype, 'addLayer', 'addLayer');
    w(L.Map.prototype, 'removeLayer', 'removeLayer');
    /* 给第一枚有名标记打对象戳，并在 close() 归还之前把 opener 暴露出来 */
    const e = document.querySelector('.leaflet-marker-icon[aria-label]');
    e.__tag = 'T1';
    window.__opener = e;
    e.focus();
  });
  await p.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 1200));

  const R = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    const same = els.filter(e => e.__tag === 'T1');
    return {
      log: window.__log,
      total: els.length,
      openerConnected: window.__opener.isConnected,
      sameNodeStillInDoc: same.length,
      openerLabel: window.__opener.getAttribute('aria-label'),
      sheetOpen: document.getElementById('locSheet').classList.contains('show'),
      activeIsOpener: document.activeElement === window.__opener
    };
  });
  /* Esc 归还之后再读一次焦点（A19 量的是这一刻） */
  await p.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 700));
  const R2 = await p.evaluate(() => ({
    activeTag: document.activeElement && document.activeElement.__tag,
    activeIsOpener: document.activeElement === window.__opener,
    activeClass: document.activeElement && String(document.activeElement.className).slice(0, 40),
    activeLabel: document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('aria-label')
  }));
  console.log(JSON.stringify({ R, R2 }, null, 1));
  await browser.close();
})().catch(e => { console.log('PROBE ERROR ' + e.message); process.exit(1); });
