/* tools/out/probe-b37-editloss.js — 批次 37-A 地基实测探针（只读，不改产品文件）
 *
 * 要坐实的问题（审核报告 §3 第 3 条）：编辑游记屏左上角那枚返回钮
 *   travel-notes.js:1931  $X(pg,'#tnEditBack').onclick = function(){ pg.remove(); }
 * 会把整轮编辑（题目/正文/照片/标签）静默丢掉。
 *
 * 三条腿：
 *   L1 入口穷举：这一屏到底有几个能把层摘掉的出口（返回钮 / 遮罩 / Escape / 物理返回键）
 *   L2 丢失现场：真点之后库里那篇逐条没动、无确认层、重开看到的是原值（＝整轮作废，无草稿）
 *   L3 第二条门：壳里 MainActivity.java:547 用 webView.goBack()，DOM 层不入历史；
 *      所以必须实测 history.pushState 在 http:// 与 file:// 两种来源下各能不能用、
 *      以及 back() 时 popstate 到底会不会响——这决定 JS 侧能不能拦住物理返回键（不改 Java＝不出包）。
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8191', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;               /* 一加 Ace 6T 真机档（§37 口径） */

const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  const p = path.join(ROOT, 'tools', 'out', 'b37-probe-editloss.txt');
  fs.writeFileSync(p, lines.join('\n') + '\n');
  console.log('--- 读数已落 ' + p);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticServer() {
  return http.createServer(function (req, res) {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html;charset=utf-8'
        : f.endsWith('.css') ? 'text/css;charset=utf-8'
        : f.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* 一篇带 2 张照片的游记（照片用 1px 透明 PNG dataURL，够 renderEp 出两个 .rm 钮） */
const PIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function seedOne(pix) {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
    var r = indexedDB.open('gujian-notes', 1);
    r.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    r.onsuccess = function (e) {
      var db = e.target.result;
      var tx = db.transaction('notes', 'readwrite');
      var st = tx.objectStore('notes');
      st.clear();
      st.put({ id: 'b37a', title: '应县木塔', siteName: '应县木塔', city: '朔州', ts: 9000,
        date: '2026-10-01', day: '2026-10-01', text: '库里原有的正文。', raw: '库里原有的正文。',
        photos: [pix, pix], tags: ['辽代'], audio: '', lat: 39.5, lng: 113.5 });
      tx.oncomplete = function () { db.close(); resolve('seeded'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r.onerror = function () { resolve('open-fail'); };
  });
}

async function realClick(page, sel) {
  const h = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), hh: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  }, sel);
  if (!h) return { ok: false, why: 'no such node ' + sel };
  await page.mouse.click(h.x, h.y);
  return { ok: true, ...h };
}

async function snap(page) {
  return page.evaluate(() => {
    const g = (s) => document.querySelectorAll(s).length;
    const n = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list()[0] : null;
    const ed = document.querySelector('.tn-editpage');
    const vis = (el) => !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
    const masks = ['.tn-mask', '.ui-modal-mask', '.tn-cfm'].map(s => s + '=' + g(s) + (vis(document.querySelector(s)) ? '/shown' : '/hidden'));
    return {
      editpage: g('.tn-editpage'),
      editpageShown: vis(ed),
      zOfEdit: ed ? getComputedStyle(ed).zIndex : '-',
      masks: masks.join(' '),
      cfm: g('.tn-cfm'),
      list: g('.tn-list'),
      store: n ? { title: n.title, text: n.text, photos: (n.photos || []).length, tags: (n.tags || []).join(','), edited: n.edited || '' } : 'no-note',
      histLen: history.length,
      histState: JSON.stringify(history.state),
    };
  });
}

(async () => {
  const srv = staticServer();
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    protocolTimeout: 240000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH });
  page.on('pageerror', e => say('  [pageerror] ' + e.message));

  /* ================= L1 + L2：http:// 来源（浏览器腿口径） ================= */
  say('=== 批次 37-A 地基实测：编辑游记屏返回即丢 ===');
  say('口径：' + VW + '×' + VH + '（一加 Ace 6T 真机档）；来源 http://127.0.0.1:' + PORT + '/index.html');
  say('');

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedOne, PIX);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.TravelNotes && (TravelNotes.list() || []).length > 0, { timeout: 20000 });
  await sleep(600);

  say('— 打开列表 —');
  await page.evaluate(() => TravelNotes.openList());
  await page.waitForFunction(() => { const l = document.querySelector('.tn-list'); return l && getComputedStyle(l).display !== 'none'; }, { timeout: 10000 });
  /* 默认视图是「旅程聚合」(travel-notes.js:135)，而每一趟初始是收起的（renderTripView 里
     tripOpen[t.id] 为假就不拼 .tn-item），所以列表里根本没有单篇行；切「时间线」最短 */
  const tv = await realClick(page, '#tnViewTime');
  say('  切到时间线视图: ' + JSON.stringify(tv));
  await page.waitForFunction(() => !!document.querySelector('.tn-item [data-a="edit"]'), { timeout: 10000 });
  const s0 = await snap(page);
  say('  库里初值: ' + JSON.stringify(s0.store));
  say('  编辑层枚数(未开): ' + s0.editpage + ' | history.length=' + s0.histLen + ' state=' + s0.histState);

  say('');
  say('— L1 入口穷举：这一屏有几个出口 —');
  const e1 = await realClick(page, '.tn-item [data-a="edit"]');
  say('  点「编辑」: ' + JSON.stringify(e1));
  await page.waitForFunction(() => { const e = document.querySelector('.tn-editpage'); return e && getComputedStyle(e).display !== 'none'; }, { timeout: 10000 });
  await sleep(400);
  const s1 = await snap(page);
  say('  开层后: ' + JSON.stringify(s1));
  /* 这一屏是 position:fixed;inset:0 全屏层：量它盖不盖得住整屏（盖得住就没有「点遮罩」这种出口） */
  const geom = await page.evaluate(() => {
    const e = document.querySelector('.tn-editpage');
    const r = e.getBoundingClientRect();
    const pts = [];
    for (let y = 6; y < 723; y += 118) for (let x = 6; x < 328; x += 63) {
      const top = document.elementFromPoint(x, y);
      if (!e.contains(top) && top) pts.push(x + ',' + y + '→' + top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : ''));
    }
    return { r: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }, vw: innerWidth, vh: innerHeight, cover: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, outside: pts.slice(0, 8), outsideN: pts.length };
  });
  say('  层几何: ' + JSON.stringify(geom.r) + ' vs 视口 ' + geom.vw + '×' + geom.vh + ' → 全铺=' + geom.cover);
  say('  网格 42 点里有 ' + geom.outsideN + ' 点命中的不是这一层；前 8 条: ' + (geom.outside.join(' | ') || '（无）'));
  const closeNodes = await page.evaluate(() => Array.from(document.querySelectorAll('.tn-editpage button, .tn-editpage .tn-x')).map(b => (b.id || b.className) + '[' + (b.textContent || '').trim().slice(0, 6) + ']'));
  say('  层内可见钮: ' + closeNodes.join('  '));

  /* Escape 腿 */
  await page.evaluate(() => { document.querySelector('#tnEditTxt').value = '用 Escape 之前打的字'; });
  await page.keyboard.press('Escape');
  await sleep(250);
  const sEsc = await snap(page);
  say('  按 Escape 后：编辑层枚数=' + sEsc.editpage + ' 展示中=' + sEsc.editpageShown + ' 确认层=' + sEsc.cfm);

  /* ================= L2 丢失现场 ================= */
  say('');
  say('— L2 丢失现场：改四处（题目/正文/标签/删一张照片），然后真点左上角返回 —');
  const before = await page.evaluate(() => {
    document.querySelector('#tnEditTitle').value = '应县木塔·第二次上去';
    document.querySelector('#tnEditTxt').value = '改过的正文，这一句在库里从来没有过。';
    document.querySelector('#tnEditTags').value = '辽代 木构 应县';
    const rm = document.querySelector('.tn-editpage .tn-photo .rm');
    if (rm) rm.click();
    return { onScreen: { title: document.querySelector('#tnEditTitle').value,
      text: document.querySelector('#tnEditTxt').value,
      tags: document.querySelector('#tnEditTags').value,
      photos: document.querySelectorAll('.tn-editpage .tn-photo').length } };
  });
  say('  屏上现值: ' + JSON.stringify(before.onScreen));
  const b2 = await snap(page);
  say('  点返回前库里: ' + JSON.stringify(b2.store) + ' | 确认层枚数=' + b2.cfm);

  const back = await realClick(page, '#tnEditBack');
  say('  真点 #tnEditBack: ' + JSON.stringify(back));
  await sleep(500);
  const a2 = await snap(page);
  say('  点返回后: 编辑层枚数=' + a2.editpage + ' 展示中=' + a2.editpageShown + ' | 确认层枚数=' + a2.cfm);
  say('  点返回后库里: ' + JSON.stringify(a2.store));
  const lost = {
    title: before.onScreen.title !== a2.store.title,
    text: before.onScreen.text !== a2.store.text,
    tags: a2.store.tags !== '辽代',
    photos: a2.store.photos !== 1,
  };
  say('  逐条是否被丢弃: ' + JSON.stringify(lost) + '（true=屏上改的没进库）');
  say('  丢失期间是否问过一次: ' + (a2.cfm > 0 ? '问了' : '零追问'));

  /* 重开看得到什么 */
  const re = await realClick(page, '.tn-item [data-a="edit"]');
  say('  重开编辑: ' + JSON.stringify(re.ok));
  await sleep(400);
  const reopened = await page.evaluate(() => ({
    title: document.querySelector('#tnEditTitle') && document.querySelector('#tnEditTitle').value,
    text: document.querySelector('#tnEditTxt') && document.querySelector('#tnEditTxt').value,
    tags: document.querySelector('#tnEditTags') && document.querySelector('#tnEditTags').value,
    photos: document.querySelectorAll('.tn-editpage .tn-photo').length,
  }));
  say('  重开后屏上读到的: ' + JSON.stringify(reopened) + '（若无草稿＝库里原值）');
  const dirtyDom = await page.evaluate(() => {
    const t = document.querySelector('#tnEditTitle'), x = document.querySelector('#tnEditTxt'), g = document.querySelector('#tnEditTags');
    return { titleDirty: t.value !== t.getAttribute('value'), textDirty: x.value !== x.defaultValue, tagsDirty: g.value !== g.getAttribute('value') };
  });
  say('  DOM 原生脏标记可用?(input.value!==getAttribute(value)) ' + JSON.stringify(dirtyDom) + '（true=能当脏判据）');
  const photoSig = await page.evaluate(() => {
    const n = TravelNotes.list()[0];
    return { orig: (n.photos || []).map(p => p.length).join(','), origLen: (n.photos || []).length };
  });
  say('  照片廉价签名口径(库里原值): ' + JSON.stringify(photoSig));

  /* ================= L3 第二条门：物理返回键能不能在 JS 侧拦 ================= */
  say('');
  say('— L3 物理返回键（壳 MainActivity.java:547 → webView.goBack()）能否在 JS 侧拦 —');
  say('  事实：全树无 popstate 监听（grep pushState|popstate 只命中 4 处 history.replaceState，且都包在 try/catch 里）');
  const h1 = await page.evaluate(() => {
    const out = {};
    try { history.pushState({ b37: 1 }, '', location.href); out.pushHttp = 'ok'; } catch (e) { out.pushHttp = 'THROW ' + e.name + ': ' + e.message; }
    out.stateAfterPush = JSON.stringify(history.state);
    out.lenAfterPush = history.length;
    return out;
  });
  say('  http:// 下 pushState: ' + JSON.stringify(h1));
  const popFired = await page.evaluate(async () => {
    window.__b37pop = 0;
    addEventListener('popstate', function () { window.__b37pop++; });
    history.back();
    await new Promise(r => setTimeout(r, 700));
    return { fired: window.__b37pop, state: JSON.stringify(history.state), len: history.length };
  });
  say('  http:// 下 history.back() 后 popstate: ' + JSON.stringify(popFired));

  /* file:// 腿：APK 真实来源（file:///android_asset/index.html） */
  const filePath = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const fp = await browser.newPage();
  await fp.setViewport({ width: VW, height: VH });
  fp.on('pageerror', e => say('  [file pageerror] ' + e.message));
  try {
    await fp.goto(filePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const f = await fp.evaluate(() => {
      const o = { origin: location.origin, href: location.href.slice(0, 46) };
      try { history.pushState({ b37: 1 }, '', location.href); o.pushFile = 'ok'; } catch (e) { o.pushFile = 'THROW ' + e.name; }
      o.stateAfter = JSON.stringify(history.state);
      try { history.replaceState({ b37: 2 }, '', location.href); o.replaceFile = 'ok'; } catch (e) { o.replaceFile = 'THROW ' + e.name; }
      o.notesReady = !!(window.TravelNotes && TravelNotes.list);
      return o;
    });
    say('  file:// 下: ' + JSON.stringify(f));
    const fpop = await fp.evaluate(async () => {
      window.__b37pop = 0;
      addEventListener('popstate', function () { window.__b37pop++; });
      history.back();
      await new Promise(r => setTimeout(r, 800));
      return { fired: window.__b37pop, state: JSON.stringify(history.state) };
    });
    say('  file:// 下 history.back() 后 popstate: ' + JSON.stringify(fpop));
    /* file:// 下这一屏本身起不起得来（编辑层是否可用） */
    const fedit = await fp.evaluate(async () => {
      try {
        if (!window.TravelNotes) return 'no TravelNotes';
        await (TravelNotes._ready || Promise.resolve());
        window.TravelNotes.openList && TravelNotes.openList();
        const it = document.querySelector('.tn-item [data-a="edit"]');
        if (!it) return 'no edit row (库里无篇，file:// 是同一 profile 的新 origin)';
        it.click();
        await new Promise(r => setTimeout(r, 350));
        const e = document.querySelector('.tn-editpage');
        return e ? 'editpage shown=' + (getComputedStyle(e).display !== 'none') : 'no editpage';
      } catch (err) { return 'ERR ' + err.message; }
    });
    say('  file:// 下编辑屏: ' + fedit);
  } catch (e) {
    say('  file:// 腿失败: ' + e.message);
  }
  await fp.close();

  say('');
  say('— 同族清点（全树「层持有用户输入 + 无条件 remove」）—');
  say('  travel-notes.js:1931  tn-editpage / #tnEditBack → pg.remove()          【本报告 §3-3，本批目标】');
  say('  travel-notes.js:2118-2120  importNotes / #tnImpX 与点遮罩 → close()=m.remove()，层内有 #tnImpTxt 粘贴框 【同族：粘进去的备份 JSON 也是人手打的】');
  say('  results.js:426  定制路书 / #ix 与点遮罩 → d.remove()，层内有 #idays/#ipref 输入 【同族，但丢的是参数不是内容】');
  say('  results.js:84  saveDoc / rzX；travel-notes.js:1967/1995 统计与导出预览 → 层内无输入 【不算】');
  say('  node-manager.html:491/606/860/980/1047、planner.js:1479、album-edit.html:215 —— 本探针未逐条读输入项，留 37-B 定性');

  await browser.close();
  srv.close();
  dump();
})().catch(e => { say('探针崩: ' + (e && e.stack || e)); dump(); process.exit(1); });
