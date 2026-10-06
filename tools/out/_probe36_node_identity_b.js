/* tools/out/_probe36_node_identity_b.js — 批次 22 收口前的成因复核（第二针，一次性探针）
 *
 * 第一针（_probe36_node_identity.js）在「地图已稳定」的节奏下测：setIcon 36 次、opener 仍在文档、
 * 同一枚 DIV。但 B4（摘掉 close() 里的 isConnected 找回）实测能把 A19 打红，说明 smoke-aria
 * 那条时序里 opener 确实脱了文档。这一针照抄 smoke-aria 的时序（开→关→重新聚焦→Space→Esc），
 * 每一步都读「打戳的那枚还在不在文档」+ 各内部调用计数，回答唯一一个问题：
 * 换掉它的是 setIcon，还是整层重建（clearLayers/addLayer/_initIcon 新建节点）。
 * 用法: NODE_PATH=tools/node_modules node tools/out/_probe36_node_identity_b.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('pageerror: ' + e.message.slice(0, 160)));
  await p.goto(fileUrl('topic.html') + '?p=bj', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await sleep(2500);
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await sleep(2000);

  await p.evaluate(() => {
    const L = window.L, M = L.Marker.prototype;
    const log = window.__log = { initIcon: 0, removeIcon: 0, setIcon: 0, clearLayers: 0, addLayer: 0, removeLayer: 0, iconSwapped: 0 };
    const w = (proto, name, key, hook) => {
      const o = proto[name];
      proto[name] = function () {
        log[key]++;
        if (hook) hook(this);
        return o.apply(this, arguments);
      };
    };
    /* _initIcon 之后如果 this._icon 不再是进函数前那一枚，就是「换新节点」；
       _removeIcon 之前同理打一次，两个计数对冲才说明「复用」还是「重建」。 */
    const o1 = M._initIcon;
    M._initIcon = function () {
      log.initIcon++;
      const before = this._icon;
      o1.apply(this, arguments);
      if (before && this._icon !== before) log.iconSwapped++;
      return this;
    };
    w(M, '_removeIcon', 'removeIcon');
    w(M, 'setIcon', 'setIcon');
    w(L.LayerGroup.prototype, 'clearLayers', 'clearLayers');
    w(L.Map.prototype, 'addLayer', 'addLayer');
    w(L.Map.prototype, 'removeLayer', 'removeLayer');
    window.__snap = function (tag) {
      const els = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      return {
        step: tag,
        log: Object.assign({}, window.__log),
        total: els.length,
        tagged: els.filter(e => e.__tag).length,
        openerConnected: !!(window.__opener && window.__opener.isConnected),
        openerLabel: window.__opener && window.__opener.getAttribute('aria-label'),
        sheetOpen: document.getElementById('locSheet').classList.contains('show'),
        activeTag: document.activeElement && document.activeElement.__tag,
        activeIsOpener: document.activeElement === window.__opener,
        activeIsMarker: !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('leaflet-marker-icon'))
      };
    };
    /* 与 smoke-aria 一样：拿第一枚有名字的标记 */
    const e = document.querySelector('.leaflet-marker-icon[aria-label]');
    e.__tag = 'T1';
    window.__opener = e;
    e.focus();
  });

  const out = [];
  await p.keyboard.press('Enter');
  await sleep(800);
  out.push(await p.evaluate(() => window.__snap('A Enter 开后（与 smoke 的 A10 同刻）')));

  await p.evaluate(() => { const s = document.getElementById('locSheet'); window.UI && UI.sheet(s).close(); });
  await sleep(400);
  out.push(await p.evaluate(() => window.__snap('B API close 之后')));

  /* smoke 的 144 行：重新 querySelector 拿「第一枚有名字的」并 focus —— 这里额外看它拿回的是不是 T1 */
  out.push(await p.evaluate(() => {
    window.scrollTo(0, 0);
    const e = document.querySelector('.leaflet-marker-icon[aria-label]');
    const same = e === window.__opener;
    if (!e.__tag) e.__tag = 'T2';
    e.focus();
    const s = window.__snap('C 重新聚焦（144 行那一刻）');
    s.refocusGotSameNode = same;
    s.refocusTag = e.__tag;
    return s;
  }));

  await p.keyboard.press('Space');
  await sleep(800);
  out.push(await p.evaluate(() => window.__snap('D Space 开后')));

  await p.keyboard.press('Escape');
  await sleep(600);
  out.push(await p.evaluate(() => window.__snap('E Esc 归还后（A19 量这一瞬）')));

  /* 最后一刀：close 时刻 opener 的连接状态要在 close() 内部才知道，这里补一个直接观察：
     再开一次，然后在 close 之前读 __opener.isConnected */
  await p.evaluate(() => { const e = document.querySelector('.leaflet-marker-icon[aria-label]'); e.focus(); });
  await p.keyboard.press('Enter');
  await sleep(800);
  out.push(await p.evaluate(() => {
    const s = window.__snap('F 第二次开后（close 之前）');
    s.opener2Connected = !!(window.__opener && window.__opener.isConnected);
    s.opener2InDocNow = Array.from(document.querySelectorAll('.leaflet-marker-icon')).filter(e => e.__tag === 'T1').length;
    return s;
  }));

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.log('PROBE-B ERROR ' + e.message); process.exit(1); });
