/* tools/smoke-aria.js — 批次 22「无障碍三类关键结构」浏览器闸门
 *
 * 这一批的源码锚点（§36）能钉住「串在不在」，钉不住两件只有浏览器知道的事：
 *   ① accessible name 是**浏览器算出来的**：aria-label 拼成空串、拼成 undefined、
 *      被 innerHTML 换掉，DOM 层grep 全绿，读屏念出来却是空的——快照口径是这批唯一
 *      值得上浏览器的理由；
 *   ② 交互闭环：Tab 停得下来吗？停下之后按 Enter 打得开吗？Esc 关得掉吗？关掉之后
 *      焦点回到点开它的那枚标记吗？Tab 会不会跑出弹层摸到背后的地图？
 *      Leaflet 1.1.1 的 Keyboard handler 只管平移/缩放/Esc 关 popup，Enter 什么都不做，
 *      「只补 aria-label」的半个可达在快照里照样绿，这条腿才打得死它。
 * 外加两件时序与视觉：aria-live 的「先空插入、下一帧写字」（同帧写入读屏不播）、
 * 焦点环在本批没有新增 CSS（:focus-visible 已在案，实测 outlineWidth ≥2px）。
 *
 * 用法: node tools/smoke-aria.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fileUrl = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 452, VH = 995;                 /* 一加 Ace 6T 真机档 */

let fails = 0, checks = 0;
function ok(name, cond, extra) {
  checks++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']'));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 快照遍历：把 AX 树拍平成 {role,name} 列表，好按角色取名字 */
function flatten(node, out) {
  if (!node) return out;
  out.push({ role: node.role, name: node.name || '' });
  (node.children || []).forEach(c => flatten(c, out));
  return out;
}

async function mkPage(browser, errs, url) {
  const p = await browser.newPage();
  await p.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::|ERR_/.test(t)) return;   /* 本机没有的外网瓦片是环境噪声 */
    errs.push('console: ' + t.slice(0, 160));
  });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return p;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const errs = [];

  /* ================= A 组：地图标记可达 + 键盘闭环（topic.html?p=bj） ================= */
  const p = await mkPage(browser, errs, fileUrl('topic.html') + '?p=bj');
  await p.waitForFunction('!!(window.TopicEngine && window.TopicEngine._map)', { timeout: 30000 });
  await sleep(2500);
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await sleep(2000);

  const A1 = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    return {
      n: els.length,
      named: els.filter(e => (e.getAttribute('aria-label') || '').trim().length > 1).length,
      role: els.filter(e => e.getAttribute('role') === 'button').length,
      tab: els.filter(e => e.getAttribute('tabindex') === '0').length,
      labels: els.slice(0, 6).map(e => e.getAttribute('aria-label')),
      placeholder: els.filter(e => /^(undefined|null|按钮)$/.test((e.getAttribute('aria-label') || '').trim())).length
    };
  });
  ok('A01 地图上真有标记（否则后面全是恒真判据）', A1.n > 0, A1.n + ' 枚');
  ok('A02 每枚标记都有非空 aria-label（divIcon 的 alt 落不成属性，名字只能钉在容器上）',
    A1.n > 0 && A1.named === A1.n, A1.named + '/' + A1.n);
  ok('A03 名字里没有占位串（undefined/null/空）', A1.placeholder === 0, '占位 ' + A1.placeholder);
  ok('A04 Leaflet 自带的 role=button 与 tabindex=0 没被抹掉', A1.role === A1.n && A1.tab === A1.n,
    'role ' + A1.role + '／tabindex ' + A1.tab + '／共 ' + A1.n);
  ok('A05 标记名带地名与城市（读屏念得出「恭王府，北京市…」而不是「按钮」）',
    A1.labels.every(l => l && l.indexOf('，') > 0 && /[一-龥]{2,}/.test(l)), A1.labels.slice(0, 2).join(' | '));

  const ax1 = flatten(await p.accessibility.snapshot({ interestingOnly: true }), []);
  const markNames = ax1.filter(x => x.role === 'button' && /，[一-龥]{2,}(，|$)/.test(x.name));
  ok('A06 快照口径：浏览器算出来的 accessible name 里能读到标记（含「站点，城市」逗号结构）',
    markNames.length > 0, markNames.slice(0, 2).map(x => x.name).join(' | '));

  /* 低 zoom：聚合胶囊也要念得出名字 */
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 6));
  await sleep(2000);
  const A7 = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon')).filter(e => e.getAttribute('aria-label'));
    return { n: els.length, cnt: els.filter(e => /处/.test(e.getAttribute('aria-label') || '')).length, s: els.slice(0, 3).map(e => e.getAttribute('aria-label')) };
  });
  ok('A07 聚合胶囊也有可访问名（名字里带「N 处」，读屏报得出这一片有几处）', A7.n > 0 && A7.cnt === A7.n, A7.s.join(' | '));

  /* 键盘闭环：回到节点层，聚焦一枚标记真按 Enter */
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 13));
  await sleep(2000);
  const F = await p.evaluate(() => {
    const e = document.querySelector('.leaflet-marker-icon[aria-label]');
    if (!e) return null;
    e.focus();
    return { label: e.getAttribute('aria-label'), active: document.activeElement === e, expanded: e.getAttribute('aria-expanded') };
  });
  ok('A08 Tab/焦点停得下来（focus() 后 activeElement 就是那枚标记）', !!F && F.active, F && F.label);
  ok('A09 未打开时不带 aria-expanded=true', !!F && F.expanded !== 'true', F && String(F.expanded));

  await p.keyboard.press('Enter');
  await sleep(800);
  const A10 = await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    const op = document.querySelector('.leaflet-marker-icon[aria-expanded="true"]');
    return {
      open: s.classList.contains('show'), role: s.getAttribute('role'),
      label: s.getAttribute('aria-label') || '', modal: s.getAttribute('aria-modal'),
      focusIn: s.contains(document.activeElement), expanded: !!op
    };
  });
  ok('A10 聚焦标记按 Enter 打得开弹层（库的 Keyboard handler 不管 Enter，全靠 UI.markerKeys）', A10.open);
  ok('A11 弹层带 role=dialog（由 UI.sheet 单点补，页面没写）', A10.role === 'dialog', A10.role);
  ok('A12 弹层名跟着这一站走（含「详情」）', /详情$/.test(A10.label), A10.label);
  ok('A13 焦点落进弹层内（读屏从这里开始念整块内容）', A10.focusIn);
  ok('A14 开启态把触发标记标成 aria-expanded=true', A10.expanded);
  ok('A15 景点卡不是真模态：不挂 aria-modal（地图照样能点，报「外面不可达」是谎报）',
    A10.modal === null, String(A10.modal));

  /* 弹层内 Tab 圈住：不许跑到背后的地图/底栏 */
  const hops = [];
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press('Tab');
    await sleep(60);
    hops.push(await p.evaluate(() => {
      const ae = document.activeElement, s = document.getElementById('locSheet');
      return s.contains(ae) ? 1 : 0;
    }));
  }
  ok('A16 弹层开着时 Tab 十次全留在弹层内（焦点 trap 生效）', hops.every(x => x === 1), hops.join(''));

  /* Space 也要能激活，且不许把页面滚走 */
  await p.evaluate(() => { const s = document.getElementById('locSheet'); window.UI && UI.sheet(s).close(); });
  await sleep(400);
  await p.evaluate(() => { window.scrollTo(0, 0); const e = document.querySelector('.leaflet-marker-icon[aria-label]'); e && e.focus(); });
  await p.keyboard.press('Space');
  await sleep(800);
  const A17 = await p.evaluate(() => ({ open: document.getElementById('locSheet').classList.contains('show'), sy: window.scrollY }));
  ok('A17 聚焦标记按 Space 同样打得开，且 preventDefault 没把页面滚走', A17.open && A17.sy === 0, 'open=' + A17.open + ' scrollY=' + A17.sy);

  /* Esc 关闭 + 焦点归还 */
  await p.keyboard.press('Escape');
  await sleep(600);
  const A18 = await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    const ae = document.activeElement;
    return {
      open: s.classList.contains('show'),
      isMarker: !!(ae && ae.classList && ae.classList.contains('leaflet-marker-icon')),
      label: ae && ae.getAttribute ? ae.getAttribute('aria-label') : '',
      expandedLeft: !!document.querySelector('.leaflet-marker-icon[aria-expanded="true"]'),
      modalLeft: s.getAttribute('aria-modal')
    };
  });
  ok('A18 Esc 关得掉弹层', !A18.open);
  ok('A19 关闭后焦点归还到点开它的那枚标记', A18.isMarker && !!A18.label, A18.label);
  ok('A20 关闭后 aria-expanded 不留在 true（否则读屏报的还是「已展开」）', !A18.expandedLeft);

  /* 真模态那一头：arriveDlg 要挂 aria-modal */
  const A21 = await p.evaluate(() => {
    const d = document.getElementById('arriveDlg');
    window.UI.sheet(d, { label: '到了这一带，想留下些什么', modal: true }).open();
    const r = { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-label'), focusIn: d.contains(document.activeElement) };
    window.UI.sheet(d).close();
    return r;
  });
  ok('A21 真模态弹层挂 aria-modal=true（与 locSheet 形成对照，两种弹层不许混成一套口径）',
    A21.modal === 'true' && A21.role === 'dialog', A21.role + '/' + A21.modal);

  /* 已开着再 open = 只换内容：不重记 opener */
  const A22 = await p.evaluate(() => {
    const e = document.querySelector('.leaflet-marker-icon[aria-label]');
    /* 一枚有名标记都拿不到时不许抛（抛了整条 smoke 就中断，A02 那条真红反而看不见）：
       返回一个注定不满足判据的读数，让红留在它该在的那条上 */
    if (!e) return { firstOpen: false, stillOpen: false, label: '', expanded: null, afterClose: null };
    e.focus();
    const s = document.getElementById('locSheet');
    const api = window.UI.sheet(s);
    api.open('第一站 详情');
    const firstOpen = s.classList.contains('show');
    api.open('第二站 详情');
    const r = { firstOpen, stillOpen: s.classList.contains('show'), label: s.getAttribute('aria-label'), expanded: e.getAttribute('aria-expanded') };
    api.close();
    r.afterClose = e.getAttribute('aria-expanded');
    return r;
  });
  ok('A22 已开着再调 open 只换名字（opener 不重记，焦点不会归还到被 innerHTML 换掉的按钮上）',
    A22.firstOpen && A22.stillOpen && /^第二站 /.test(A22.label) && A22.expanded === 'true' && A22.afterClose === 'false',
    A22.label + ' / ' + A22.expanded + '→' + A22.afterClose);

  /* 页面写死的 aria-label 不许被覆盖（#nearSheet 的那句「这一带还有什么」） */
  const A23 = await p.evaluate(() => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', '这一带还有什么');
    document.body.appendChild(el);
    window.UI.sheet(el, { label: '不该覆盖页面写死的名字' }).open();
    const keep = el.getAttribute('aria-label');
    window.UI.sheet(el).close();
    el.remove();
    return keep;
  });
  ok('A23 页面写死的 aria-label 不被 sheet 覆盖（近邻面板那句「这一带还有什么」归页面管）',
    A23 === '这一带还有什么', A23);

  /* setIcon 会把标记的 DOM 整块换掉，而 Leaflet 1.1.1 没有 iconchange 事件：
     重画之后不显式补回，全图标记当场集体失名、Enter 也全废（绑的是旧节点）。
     这两条是修完才加的——改前的 topic-common.setActiveNode 在这里必红。 */
  await p.evaluate(() => { const e = document.querySelector('.leaflet-marker-icon[aria-label]'); e && e.focus(); });
  await p.keyboard.press('Enter');
  await sleep(1000);
  const A24 = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    return { n: els.length, named: els.filter(e => (e.getAttribute('aria-label') || '').trim().length > 1).length };
  });
  ok('A24 点开一趟景点卡（setActiveNode 重画所有标记）之后，全图标记仍然个个体面有名',
    A24.n > 0 && A24.named === A24.n, A24.named + '/' + A24.n);
  await p.keyboard.press('Escape');
  await sleep(700);
  const A25 = await p.evaluate(() => {
    /* 取「另一枚」站点标记（名字里带顿号的是节点，聚合胶囊是「N 处」）；整层重绘时它是新建的节点 */
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon[aria-label]'))
      .filter(e => (e.getAttribute('aria-label') || '').indexOf('，') > 0);
    const e = els[els.length - 1];
    if (!e) return { label: '', active: false, n: 0 };
    e.focus();
    return { label: e.getAttribute('aria-label'), active: document.activeElement === e, n: els.length };
  });
  await p.keyboard.press('Enter');
  await sleep(1000);
  const A25b = await p.evaluate(() => {
    const s = document.getElementById('locSheet');
    const r = { open: s.classList.contains('show'), label: s.getAttribute('aria-label') || '' };
    window.UI.sheet(s).close();
    return r;
  });
  ok('A25 被重画过的那枚标记按 Enter 照样打得开（键位绑在旧 DOM 上会跟着一起死）',
    A25.active && A25.n > 1 && A25b.open && A25b.label.indexOf(A25.label.split('，')[0]) === 0,
    A25.label + ' → ' + A25b.label);

  await p.close();

  /* ================= C 组：aria-live 两步时序（先空插入，下一帧写字） ================= */
  const pc = await mkPage(browser, errs, fileUrl('index.html'));
  await pc.waitForFunction('!!window.UI', { timeout: 30000 });
  await sleep(1200);
  const C1 = await pc.evaluate(async () => {
    const two = (fn, sel) => new Promise(res => {
      const node = fn();
      const el = node || document.querySelector(sel);
      const at = (el.textContent || '').trim().length;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const after = (el.textContent || '').trim().length;
        res({ at, after, live: el.getAttribute('aria-live'), role: el.getAttribute('role') });
      }));
    });
    const t = await two(() => { UI.toast('两步时序·甲'); return document.querySelector('.ui-toast'); }, '.ui-toast');
    const n = await two(() => UI.nudge({ pre: '提醒：', strong: '甲', text: '两步时序' }), '.ui-nudge');
    return { t, n };
  });
  ok('C01 toast 插入那一帧文本为空、下一帧才有字（带字一次插入读屏当静态内容，一个字不播）',
    C1.t.at === 0 && C1.t.after > 0, '同帧 ' + C1.t.at + ' 字 → 次帧 ' + C1.t.after + ' 字');
  ok('C02 toast 活区带 role=status + aria-live=polite（live 属性必须随节点一起进 DOM）',
    C1.t.live === 'polite' && C1.t.role === 'status', C1.t.role + '/' + C1.t.live);
  ok('C03 提醒条 nudge 同样两步（它比 toast 长驻，播不出来就等于没提醒）',
    C1.n.at === 0 && C1.n.after > 0 && C1.n.live === 'polite', '同帧 ' + C1.n.at + ' → 次帧 ' + C1.n.at + '/' + C1.n.after);

  const C4 = await pc.evaluate(async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    UI.errorBox(host, { title: '加载失败·甲', text: '正文·甲', retryText: '重试' });
    const box = host.querySelector('.ui-errorbox');
    const at = (box.querySelector('.eb-t').textContent || '') + (box.querySelector('.eb-d').textContent || '');
    const labelAt = (host.querySelector('.eb-retry').textContent || '');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = (box.querySelector('.eb-t').textContent || '') + (box.querySelector('.eb-d').textContent || '');
    const labelAfter = (host.querySelector('.eb-retry').textContent || '');
    host.remove();
    return { atLen: at.length, afterLen: after.length, labelAt: labelAt.length, labelAfter: labelAfter.length, live: box.getAttribute('aria-live'), role: box.getAttribute('role') };
  });
  ok('C04 错误卡两步：先入 DOM 的空区带 role=alert，出错那句话下一帧才写（assertive 才播得出来）',
    C4.atLen === 0 && C4.afterLen > 0 && C4.labelAt === 0 && C4.labelAfter > 0 && C4.live === 'assertive' && C4.role === 'alert',
    '同帧 ' + C4.atLen + ' → 次帧 ' + C4.afterLen + '；按钮 ' + C4.labelAt + '→' + C4.labelAfter + '；' + C4.role + '/' + C4.live);

  const C5 = await pc.evaluate(async () => {
    /* 这里一次都不许等：dispatch 与读数必须在同一个 task 里，rAF 还没跑。
       等 120ms 再读＝测到了「次帧之后」，同帧那条判据自己就失效了（上一版就是这么红的）。 */
    window.dispatchEvent(new Event('offline'));
    const bar = document.querySelector('.ui-offlinebar');
    if (!bar) return { missing: true };
    const at = (bar.textContent || '').trim().length;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = (bar.textContent || '').trim().length;
    const live = bar.getAttribute('aria-live'), role = bar.getAttribute('role');
    window.dispatchEvent(new Event('online'));
    return { at, after, live, role };
  });
  ok('C05 离线条同样两步（它是常驻状态，进 DOM 就带字＝这一句永远播不出来）',
    !C5.missing && C5.at === 0 && C5.after > 0 && C5.live === 'polite' && C5.role === 'status',
    C5.missing ? '没出条' : '同帧 ' + C5.at + ' → 次帧 ' + C5.after + '；' + C5.role + '/' + C5.live);
  const cAll = await pc.evaluate(() => Array.from(document.querySelectorAll('[aria-live]')).map(e => String(e.className).slice(0, 20)));
  ok('C06 页面上每个 aria-live 区都由 ui.js 造（toast/nudge/tileWarn/offlineBar/errorBox 五个名字之外不许有第二套）',
    cAll.every(c => /ui-/.test(c)), cAll.join(' | '));
  await pc.close();

  /* ================= D 组：日卡结构（planner.html，播种 2 常规日 + 1 转场日） ================= */
  const TRIP = {
    id: 'aria1', name: '无障碍验证线', createdAt: 1759000000000, startDate: '', aiLevel: 'off', travelBy: 'drive',
    dist: {}, start: { name: '出发地', lat: 34.8, lng: 110.4 }, end: null,
    days: [
      { date: '2026-09-28', driveKm: 40, driveH: .8, playH: 5, totalH: 6.4, stops: [{ name: '鹳雀楼', city: '运城市', lat: 34.84, lng: 110.49 }, { name: '普救寺', city: '运城市', lat: 34.85, lng: 110.46 }] },
      { transit: true, from: '运城市', to: '西安市', driveKm: 240, driveH: 3.6, playH: 0, totalH: 3.6, stops: [] },
      { date: '2026-09-30', driveKm: 30, driveH: .6, playH: 4, totalH: 5.2, stops: [{ name: '大雁塔', city: '西安市', lat: 34.22, lng: 108.96 }] }
    ]
  };
  const pd = await browser.newPage();
  await pd.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  pd.on('pageerror', e => errs.push('pageerror( planner): ' + e.message.slice(0, 160)));
  await pd.evaluateOnNewDocument(t => { try { localStorage.setItem('tn_trips', JSON.stringify([t])); localStorage.setItem('tn_planner_weather', '0'); } catch (e) {} }, TRIP);
  await pd.goto(fileUrl('planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);
  await pd.evaluate(() => window.plannerOpenTrip(0));
  await sleep(1500);
  const D1 = await pd.evaluate(() => {
    const list = document.querySelectorAll('#resultBody .day-list[role="list"]');
    const cards = Array.from(document.querySelectorAll('#resultBody .day-card'));
    const items = Array.from(document.querySelectorAll('#resultBody .day-card[role="listitem"]'));
    return {
      lists: list.length,
      listLabel: list[0] ? list[0].getAttribute('aria-label') : '',
      cards: cards.length, items: items.length,
      labels: items.map(e => e.getAttribute('aria-label') || ''),
      empties: items.filter(e => !(e.getAttribute('aria-label') || '').trim()).length,
      transit: items.filter(e => /赶路日/.test(e.getAttribute('aria-label') || '')).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  ok('D01 日卡容器是恰一个 role=list（读屏报得出「列表，共 3 项」）', D1.lists === 1 && D1.cards === 3, 'list ' + D1.lists + ' / 卡 ' + D1.cards);
  ok('D02 每张日卡都是 listitem，数量与卡片数相等（漏一张就有一天的内容读屏跳不过去）',
    D1.items === D1.cards && D1.cards >= 3, D1.items + '/' + D1.cards);
  ok('D03 没有 aria-label 为空串的卡（DOM 层看不出这个失败，只有浏览器算的名字能看出）', D1.empties === 0, '空名 ' + D1.empties);
  ok('D04 每卡名字以「第 N 天」开头并带站点数与里程',
    D1.labels.every((l, i) => l.indexOf('第 ' + (i + 1) + ' 天') === 0 && /约 \d+ km/.test(l)), D1.labels.join(' | '));
  ok('D05 转场日的名字明说「赶路日」（否则读屏只念得出 0 站，听不出这天本来就没有景点）',
    D1.transit === 1 && /赶路日/.test(D1.labels[1]), D1.labels[1]);
  ok('D06 列表容器名带「共 N 天」且不含 undefined（拼串漏值最容易在这里露出来）',
    /共 3 天/.test(D1.listLabel) && D1.listLabel.indexOf('undefined') < 0, D1.listLabel);
  ok('D07 role=list 没把版式顶宽（.day-list 是中性 wrapper，手机档不许出现横向溢出）',
    D1.overflow <= 0, '溢出 ' + D1.overflow + 'px');
  /* interestingOnly 必须关掉：AX 快照默认只留「有意义的」节点，generic/列表容器会被剪掉，
     于是 list/listitem 全 0——上一版 D08 红在这里，是眼睛的问题不是结构的问题（A06 已证明
     快照能念出标记名）。全量树慢一点，但这条判据要的就是「树上真有这两类节点」。 */
  const ax2 = flatten(await pd.accessibility.snapshot({ interestingOnly: false }), []);
  ok('D08 快照口径：AX 树里真有 list + listitem，且每个 listitem 的 name 非空',
    ax2.filter(x => x.role === 'list').length >= 1 && ax2.filter(x => x.role === 'listitem' && x.name.trim().length > 4).length >= 3,
    'list ' + ax2.filter(x => x.role === 'list').length + ' / listitem ' + ax2.filter(x => x.role === 'listitem').length);

  /* 焦点环：本批没加 CSS，默认/既有 :focus-visible 必须真的看得见 */
  await pd.evaluate(() => { const b = document.querySelector('#resultBody .day-card button'); b && b.focus(); });
  await pd.keyboard.press('Tab');
  await sleep(200);
  const D9 = await pd.evaluate(() => {
    const ae = document.activeElement, st = window.getComputedStyle(ae);
    return { w: parseFloat(st.outlineWidth) || 0, color: st.outlineColor, style: st.outlineStyle };
  });
  ok('D09 键盘聚焦有可见焦点环（outline ≥2px；本批不新增 CSS，靠既有 :focus-visible 一档）',
    D9.w >= 2 && D9.style !== 'none', D9.w + 'px ' + D9.style + ' ' + D9.color);
  await pd.close();

  /* ================= S 组：分享页日卡（同一套结构要在只读页也站得住） ================= */
  const ps = await mkPage(browser, errs, fileUrl('planner.html'));
  await sleep(2500);
  const built = await ps.evaluate(t => {
    /* file:// 下 linkBase() 是空的，Share.build 走 no-base 降级分支，返回值里根本没有 hash 字段
       （实测 keys = ok/degrade/text/payload/chars）。这一组要的是 hash，就直接按编码那一步取，
       别拿 build 的返回值猜——smoke-share 能拿到是因为它跑在有 base 的档。 */
    try { return window.Share ? { hash: window.Share.encodePayload(window.Share.payloadOf(t)) } : null; } catch (e) { return { err: e.message }; }
  }, TRIP);
  await ps.close();
  if (!built || !built.hash) {
    ok('S01 分享载荷出得来（出不来这一组没测），实得 ' + JSON.stringify(built && built.err || Object.keys(built || {})), false);
  } else {
    const psh = await mkPage(browser, errs, fileUrl('share.html') + '#' + built.hash);
    await psh.waitForFunction('document.querySelectorAll(".day-card").length>0', { timeout: 30000 }).catch(() => {});
    await sleep(1200);
    const S = await psh.evaluate(() => {
      const list = document.querySelectorAll('.day-list[role="list"]');
      const items = Array.from(document.querySelectorAll('.day-card[role="listitem"]'));
      const cards = document.querySelectorAll('.day-card');
      const mk = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      return {
        lists: list.length, listLabel: list[0] ? list[0].getAttribute('aria-label') : '',
        items: items.length, cards: cards.length,
        empties: items.filter(e => !(e.getAttribute('aria-label') || '').trim()).length,
        head: items.map(e => (e.getAttribute('aria-label') || '').slice(0, 5)),
        mkNamed: mk.filter(e => (e.getAttribute('aria-label') || '').trim().length > 1).length, mkAll: mk.length
      };
    });
    ok('S01 分享页同样是恰一个 role=list 且条目数与卡片数相等',
      S.lists === 1 && S.items === S.cards && S.cards >= 3, 'list ' + S.lists + ' / item ' + S.items + ' / card ' + S.cards);
    ok('S02 分享页每卡有非空可访问名（分享出去的是别人，读屏更不能给个空串）',
      S.empties === 0 && S.head.every(h => h.indexOf('第 ') === 0), S.head.join(' | '));
    ok('S03 分享页列表名带「共 N 天」', /共 \d+ 天/.test(S.listLabel), S.listLabel);
    ok('S04 分享页地图针脚也念得出站名（分享页引 ui.js，可达名同一条腿）',
      S.mkAll > 0 && S.mkNamed === S.mkAll, S.mkNamed + '/' + S.mkAll);
    await psh.close();
  }

  /* ================= E 组：全程零未捕获异常 ================= */
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest|favicon|瓦片|tile|Failed to fetch|geolocation|NotAllowed/i.test(e));
  ok('E01 全程零页面未捕获异常（可达属性不许把任何一页改崩）', real.length === 0, real.slice(0, 3).join(' | '));

  await browser.close();
  console.log('smoke-aria: ' + checks + ' 项，失败 ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE-ARIA ERROR:', e.message, e.stack); process.exit(2); });
