/* probe33-layer.js — 批次 33-C 的浏览器腿：层叠与互斥改完之后，逐条命中测试复验
 *
 * 改了两处，每处都有「改了等于没改」的失败模式，所以两条腿各自要量到反证：
 *   ① index.html 那条备份提醒条 z-index 9500 → 8000。
 *      要验三件事：无浮层时它还看得见（降过头＝埋了，等于功能消失）；三类浮层在场时
 *      中心点不再命中它；以及那句新判定（tn_lastBackup 与 tn_webdav_last 取较近）
 *      的正反两对照——ok:true 新鲜 → 不弹，ok:false / 过期 → 照弹。ZERO 判据一律配正向对照。
 *   ② #tnQuotes 从 .tn-foot(z:2) 里搬到 body 上。
 *      光看 computed z-index 不够（从前它就是 9005，是被父级上下文关住的），必须真鼠标点
 *      #tnQuoteClear 中心：改前那一点会把背后的「记开销」档切走、搜索框没清干净
 *      （真值 tools/out/b33-probe-33b.txt:38）。顺带验 $X(qq,…) 的四处改线没把 hint/back 打空。
 *   ③ 编辑页 #tnEditAddPhoto（改前 elementsFromPoint[0] 就是那条 div，
 *      真值 tools/out/b33-probe-editpage.txt）：真鼠标点下去要真的把 click 送到 #tnEditFile。
 *
 * 提醒条 12s 自己摘走，会让「浮层在场时不遮挡」这条判据变成读一个已经不存在的元素——
 * 那是假绿，所以用 evaluateOnNewDocument 把 ms===12000 那一次 setTimeout 的回调截下来存进
 * window.__barTimer（不执行）。产品代码一行没动，真用户照样 12s 后看到它消失；这里只是让
 * 命中测试有一个稳定的被测对象。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、seed 直写 IndexedDB、
 * 关缓存 + 反注册 SW、打 tn_onboarded 才读、动画收尾再量、waitForFunction 一律函数式。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-layer.js \
 *        > tools/out/b33-probe-33c-layer.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8185', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-33c-layer.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
}

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml'
        : p.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* extra：往 localStorage 里多塞几个键（备份判定的正反对照要用），值一律先 JSON.stringify 传串 */
function seedLocal(extra) {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
    if (extra) {
      Object.keys(extra).forEach(function (k) { localStorage.setItem(k, extra[k]); });
    }
    var r1 = indexedDB.open('gujian-notes', 1);
    r1.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    r1.onsuccess = function (e) {
      var db = e.target.result;
      var tx = db.transaction('notes', 'readwrite');
      tx.objectStore('notes').clear();
      [{ id: 'e1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
         ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02',
         text: '正文一', photos: ['images/sites/034ab1d51239cd1e.jpg'], audio: '', tags: ['木塔'] }].forEach(function (n) {
        tx.objectStore('notes').put(n);
      });
      tx.oncomplete = function () { db.close(); resolve('seeded-1'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
}

async function settle(page, extra) {
  try {
    await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} }));
  } catch (e) {}
  try {
    await page.waitForFunction(
      () => document.getAnimations().every(a => a.playState !== 'running'
        || (a.effect && a.effect.getTiming().iterations === Infinity)),
      { timeout: 4000 });
  } catch (e) { say('   （动画未收尾：' + e.message.slice(0, 50) + '）'); }
  await sleep(extra || 300);
}

async function waitShown(page, sel, ms) {
  await page.waitForFunction(s => {
    const e = document.querySelector(s);
    return !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  }, { timeout: ms || 10000 }, sel);
}

/* 页内共用的小量具：找提醒条 / 量 rect / 中心点命中链 */
const HELPERS = function () {
  window.__L = {
    bar: function () {
      var out = null;
      Array.prototype.forEach.call(document.body.children, function (e) {
        if (e.tagName === 'DIV' && e.textContent.indexOf('距上次备份') >= 0) out = e;
      });
      return out;
    },
    label: function (e) {
      if (!e) return 'null';
      var s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
      if (c.length) s += '.' + c.join('.');
      return s.slice(0, 80);
    },
    rect: function (e) {
      var b = e.getBoundingClientRect();
      return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
        cx: Math.round(b.left + b.width / 2), cy: Math.round(b.top + b.height / 2) };
    },
    chain: function (cx, cy, n) {
      var out = [];
      var bar = window.__L.bar();
      document.elementsFromPoint(cx, cy).slice(0, n || 5).forEach(function (e, i) {
        var cs = getComputedStyle(e), r = window.__L.rect(e);
        out.push({ i: i, el: window.__L.label(e), rect: r.x + ',' + r.y + ' ' + r.w + '×' + r.h,
          pos: cs.position, z: cs.zIndex, iz: (e.style && e.style.zIndex) || '(空)', op: cs.opacity, pe: cs.pointerEvents,
          isBar: e === bar });
      });
      return out;
    },
    /* 顶命中的层是不是目标自己（或它的祖先/后代）——与触控探针同一判据 */
    reach: function (sel) {
      var e = document.querySelector(sel);
      if (!e) return { miss: 'no-el' };
      var r = window.__L.rect(e);
      var hit = document.elementFromPoint(r.cx, r.cy);
      return { rect: r, hit: window.__L.label(hit),
        ok: !!hit && (hit === e || e.contains(hit) || hit.contains(e)) };
    }
  };
};

async function newPage(browser, url, extra) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  try {
    page.on('filechooser', ch => { try { ch.cancel(); } catch (e) {} });
  } catch (e) {}
  await page.evaluateOnNewDocument(function () {
    const t = window.setTimeout;
    window.__timersHijacked = 0;
    window.setTimeout = function (fn, ms) {
      if (ms === 12000 && typeof fn === 'function') {
        window.__barTimer = fn; window.__timersHijacked++; return 0;
      }
      return t.apply(window, arguments);
    };
  });
  await page.setCacheEnabled(false);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(function () {
    return navigator.serviceWorker.getRegistrations()
      .then(rs => Promise.all(rs.map(r => r.unregister())));
  });
  await page.evaluate(seedLocal, extra || null);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
  await page.evaluate(HELPERS);
  await settle(page, 500);
  return { page, errs };
}

function printChain(arr) {
  arr.forEach(function (h) {
    say('    [' + h.i + '] ' + h.el + ' rect=' + h.rect + ' pos=' + h.pos + ' z=' + h.z
      + '（inline z=' + h.iz + (h.isBar ? ' · 就是那条提醒条' : '') + '） pointer-events=' + h.pe);
  });
}

/* ================= 腿 ①：备份提醒条 ================= */
async function legBar(browser) {
  say('');
  say('==================== 腿 ① 备份提醒条：z:8000 之后「看得见」与「不压人」两都要 ====================');
  const { page, errs } = await newPage(browser, '/index.html');
  /* 空库那一眼的取样时机必须排在启动屏之后：#bootSplash(design.css:1438) 是 z:9999 的 inset:0
     不透明全屏层，900ms 加 .hide、再 600ms 才 remove()。它还盖着的时候，页面上任何一点的
     elementFromPoint 都是它，跟这条是 8000 还是 9500 一点关系都没有——上一轮这里报成
     「降过头：无浮层时它自己都命中不到」，那是探针取早了，不是产品遮挡。
     等不到是另一回事：启动屏吃住整页，那要单独报出来。 */
  const tS = Date.now();
  await page.waitForFunction(() => {
    const b = document.getElementById('bootSplash');
    return !b || getComputedStyle(b).pointerEvents === 'none';
  }, { timeout: 8000, polling: 100 }).catch(async () => {
    const st = await page.evaluate(function () {
      const b = document.getElementById('bootSplash');
      return b ? { cls: b.className, pe: getComputedStyle(b).pointerEvents, op: getComputedStyle(b).opacity } : null;
    });
    say('  ❗ 8s 还没等到启动屏退场：' + JSON.stringify(st) + '——那不是压提醒条，是整页被启动屏吃住');
  });
  say('  （启动屏 #bootSplash(z:9999 inset:0) 退场等了 ' + (Date.now() - tS) + 'ms，之后才量提醒条）');
  const bare = await page.evaluate(function (vh) {
    const d = window.__L.bar();
    if (!d) return { none: true, hijack: window.__timersHijacked };
    const r = window.__L.rect(d), cs = getComputedStyle(d);
    const hit = document.elementFromPoint(r.cx, r.cy);
    return { r: r, z: cs.zIndex, pos: cs.position,
      hit: window.__L.label(hit), hitIsBarOrKin: hit === d || d.contains(hit) || (hit && hit.contains(d)),
      inView: r.y >= 0 && r.y + r.h <= vh,
      bkGo: !!document.getElementById('bkGo') };
  }, VH);
  if (bare.none) say('· 空库里这条没出现（hijack=' + bare.hijack + '）——判据落空，先查 last 的取数');
  else {
    say('· 无浮层：rect=' + bare.r.x + ',' + bare.r.y + ' ' + bare.r.w + '×' + bare.r.h
      + '  computed z=' + bare.z + ' position=' + bare.pos);
    say('  中心点顶命中=' + bare.hit + ' 是它自己或其后代=' + bare.hitIsBarOrKin
      + '｜在取景框内=' + bare.inView + '｜「去备份」钮在场=' + bare.bkGo
      + '（截下的 12s 计时器条数=' + await page.evaluate('window.__timersHijacked') + '）');
    if (bare.z !== '8000') say('  ❗ z 不是 8000，现场读到的值如上');
    if (!bare.hitIsBarOrKin) say('  ❗ 降过头：无浮层时它自己都命中不到，功能等于被埋');
  }

  /* 三类浮层在场时，中心点都不该再命中这条 */
  await page.evaluate(function () { TravelNotes.ensureUI && TravelNotes.ensureUI(); TravelNotes.openList(); });
  await waitShown(page, '.tn-list'); await settle(page, 400);
  await probeCover(page, '.tn-list(9000)');
  await page.evaluate(function () { var b = document.querySelector('.tn-list .tn-x'); if (b) b.click(); });
  await settle(page, 400);

  /* 面板 */
  await page.evaluate(function () {
    TravelNotes.openPanel({ label: '应县木塔', lat: 39.66, lng: 113.19, __i: 0 });
  });
  await waitShown(page, '.tn-panel'); await settle(page, 400);
  await probeCover(page, '.tn-panel(9001)');

  /* 编辑页：整页 inset:0 不透明，从前被这条盖住的正是它的 .tn-acts 一行 */
  await page.evaluate(function () {
    var t = document.getElementById('tnViewTime'); if (t) t.click();
  });
  await settle(page, 300);
  await page.evaluate(function () {
    var b = document.querySelector('.tn-item [data-a="edit"]') || document.querySelector('[data-a="edit"]');
    if (b) b.click();
  });
  await waitShown(page, '.tn-editpage'); await settle(page, 500);
  const ep = await probeCover(page, '.tn-editpage(9010)');
  say('  编辑页里那条 div 还在 DOM=' + await page.evaluate('!!window.__L.bar()'));

  /* #tnEditAddPhoto：命中链 + 真鼠标点下去，click 到不到 #tnEditFile */
  const pre = await page.evaluate(function () {
    const btn = document.getElementById('tnEditAddPhoto');
    if (!btn) return { none: true };
    const r = window.__L.rect(btn);
    document.getElementById('tnEditFile').addEventListener('click', function () {
      window.__fileClicks = (window.__fileClicks || 0) + 1;
    });
    return { r: r, chain: window.__L.chain(r.cx, r.cy, 5), base: window.__fileClicks || 0 };
  });
  if (pre.none) say('  ❗ 编辑页里没数到 #tnEditAddPhoto，这一段的判据落空');
  else {
    say('  · #tnEditAddPhoto rect=' + pre.r.x + ',' + pre.r.y + ' ' + pre.r.w + '×' + pre.r.h + ' 中心点=' + pre.r.cx + ',' + pre.r.cy);
    printChain(pre.chain);
    await page.mouse.click(pre.r.cx, pre.r.cy);
    await settle(page, 400);
    const after = await page.evaluate('window.__fileClicks || 0');
    say('  · 真鼠标点中心之后 #tnEditFile 收到 click=' + (after - pre.base) + ' 次（改前恒 0：那一点被 div 吃了）'
      + (after - pre.base === 1 ? ' ✅' : ' ❗'));
  }

  /* 备份判定的正反对照（ZERO 判据必须配正向对照，否则「没弹」可能是整个函数没跑） */
  say('  · 判定的四档（同一份代码，只换 localStorage）：');
  const DAY = 864e5;
  const cases = [
    ['两键全无（新用户）', null, '弹'],
    ['WebDAV 成功且新鲜', { tn_webdav_last: JSON.stringify({ ts: Date.now() - DAY, ok: true, msg: '同步成功' }) }, '不弹'],
    ['WebDAV 失败（ok:false）', { tn_webdav_last: JSON.stringify({ ts: Date.now() - DAY, ok: false, msg: '网络错误' }) }, '弹'],
    ['WebDAV 成功但已 90 天', { tn_webdav_last: JSON.stringify({ ts: Date.now() - 90 * DAY, ok: true, msg: '同步成功' }) }, '弹']
  ];
  for (const [name, extra, want] of cases) {
    const { page: p2 } = await newPage(browser, '/index.html', extra);
    const got = await p2.evaluate(function () {
      const d = window.__L.bar();
      if (!d) return '不弹';
      const cs = getComputedStyle(d);
      return '弹(' + cs.zIndex + ')';
    });
    const ok = got.indexOf(want) === 0;
    say('    ' + (ok ? '✅' : '❗') + ' ' + name + ' → 期望「' + want + '」读到「' + got + '」');
    await p2.close();
  }
  say('  未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

async function probeCover(page, tag) {
  const r = await page.evaluate(function () {
    const d = window.__L.bar();
    if (!d) return { gone: true };
    const rr = window.__L.rect(d);
    const hit = document.elementFromPoint(rr.cx, rr.cy);
    return { rr: rr, hit: window.__L.label(hit), isBar: hit === d,
      z: getComputedStyle(d).zIndex };
  });
  if (r.gone) { say('  · ' + tag + ' 在场时这条已经不在了（判据落空，要查是不是被摘了）'); return r; }
  say('  · ' + tag + ' 在场时中心点顶命中=' + r.hit + ' 还是这条 div=' + r.isBar
    + '（该层 z=' + r.z + '）' + (r.isBar ? ' ❗ 仍在压' : ' ✅'));
  return r;
}

/* ================= 腿 ②：名言检索层搬 body ================= */
async function legQuotes(browser) {
  say('');
  say('==================== 腿 ② #tnQuotes：搬出 .tn-foot(z:2) 之后，真鼠标点得到自己吗 ====================');
  const { page, errs } = await newPage(browser, '/index.html');
  await page.evaluate(function () {
    TravelNotes.ensureUI && TravelNotes.ensureUI();
    TravelNotes.openPanel({ label: '云冈石窟', lat: 40.07, lng: 113.13, __i: 0 });
  });
  await waitShown(page, '.tn-panel'); await settle(page, 400);

  const st = await page.evaluate(function () {
    const q = document.getElementById('tnQuotes');
    if (!q) return { none: true };
    const up = [];
    let e = q;
    while (e && up.length < 6) { up.push(window.__L.label(e) + '(z=' + getComputedStyle(e).zIndex + ',pos=' + getComputedStyle(e).position + ')'); e = e.parentElement; }
    return { up: up, z: getComputedStyle(q).zIndex, onBody: q.parentElement === document.body };
  });
  if (st.none) { say('❗ #tnQuotes 整块没数到——搬层的判据落空'); return; }
  say('· 祖先链：' + st.up.join(' → '));
  say('  直接住 body=' + st.onBody + '｜computed z=' + st.z);

  await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
  await waitShown(page, '#tnQuotes'); await settle(page, 400);

  const hint = await page.evaluate(function () {
    const h = document.getElementById('tnQuoteHint');
    return h ? h.textContent.slice(0, 40) : 'no-el';
  });
  say('· 打开后 #tnQuoteHint 文案（$X(qq,…) 改线的第一处证据）：「' + hint + '」'
    + (hint === 'no-el' ? ' ❗ 读不到，改线打空' : ' ✅'));

  const trio = ['#tnQuoteClear', '#tnQuoteBack', '#tnQuoteSearch'];
  for (const sel of trio) {
    const r = await page.evaluate(function (s) { return window.__L.reach(s); }, sel);
    if (r.miss) { say('  ❗ ' + sel + ' 没数到'); continue; }
    say('  · ' + sel + ' rect=' + r.rect.x + ',' + r.rect.y + ' ' + r.rect.w + '×' + r.rect.h
      + ' 中心点顶命中=' + r.hit + (r.ok ? ' ✅' : ' ❗ 打不到自己'));
    if (!r.ok) printChain(await page.evaluate((x, y, n) => window.__L.chain(x, y, n), r.rect.cx, r.rect.cy, 5));
  }

  /* 反证照 33-B 那条：清框之前先污染搜索框，再真鼠标点清钮中心
     判据看三件事：框清空了（清钮赢了）、档位没跳到「记开销」（背后的档钮没吃到这发）、浮层还在 */
  await page.evaluate(function () {
    const q = document.getElementById('tnQuoteSearch');
    if (q) { q.value = '云冈'; q.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  const polluted = await page.evaluate(function () {
    const q = document.getElementById('tnQuoteSearch');
    return { v: q ? q.value : 'gone', n: document.querySelectorAll('#tnQuoteList > *').length };
  });
  say('· 污染之后（点之前）：搜索框=「' + polluted.v + '」 结果条数=' + polluted.n);
  const cc = await page.evaluate(function () {
    const e = document.getElementById('tnQuoteClear');
    return e ? window.__L.rect(e) : null;
  });
  if (cc) {
    await page.mouse.click(cc.cx, cc.cy);
    await settle(page, 450);
    const after = await page.evaluate(function () {
      const q = document.getElementById('tnQuoteSearch');
      const exp = document.getElementById('tnTabExp');
      const pn = document.querySelector('.tn-panel');
      const qq = document.getElementById('tnQuotes');
      return { value: q ? q.value : 'layer-gone',
        expOn: !!(exp && exp.classList.contains('on')),
        panelExpense: !!pn && pn.classList.contains('is-expense'),
        quotesShown: !!qq && getComputedStyle(qq).display !== 'none' };
    });
    const pass = after.value === '' && !after.expOn && !after.panelExpense && after.quotesShown;
    say('· 真鼠标点 #tnQuoteClear 中心（' + cc.cx + ',' + cc.cy + '）之后：' + JSON.stringify(after)
      + (pass ? ' ✅' : ' ❗'));
  }

  /* 返回钮也走真鼠标：它改的是 display，顺带证明这一层不是靠 z 抬出来的 */
  const bk = await page.evaluate(function () {
    const e = document.getElementById('tnQuoteBack');
    return e ? window.__L.rect(e) : null;
  });
  if (bk) {
    await page.mouse.click(bk.cx, bk.cy);
    await settle(page, 450);
    const back = await page.evaluate(function (midX) {
      const qq = document.getElementById('tnQuotes');
      const pn = document.querySelector('.tn-panel');
      return { quotes: qq ? getComputedStyle(qq).display : 'gone',
        panel: pn ? getComputedStyle(pn).display : 'gone',
        panelTopHit: window.__L.label(document.elementFromPoint(midX, 300)) };
    }, Math.round(VW / 2));
    say('· 真鼠标点 #tnQuoteBack 之后：#tnQuotes display=' + back.quotes
      + '（期望 none） .tn-panel display=' + back.panel + '（期望 flex） 面板中部顶命中=' + back.panelTopHit
      + (back.quotes === 'none' && back.panel === 'flex' ? ' ✅' : ' ❗'));
  }

  /* 追加一条名言的整链路：浮层里的结果项也得真点得到（它住在搬出来的那一层里） */
  const item = await page.evaluate(function () {
    document.getElementById('tnQuote').click();
    var it = document.querySelector('#tnQuoteList > *');
    return it ? { label: window.__L.label(it), r: window.__L.rect(it),
      text: (it.textContent || '').slice(0, 18) } : null;
  });
  if (item) {
    await settle(page, 350);
    const re = await page.evaluate(function () {
      var it = document.querySelector('#tnQuoteList > *');
      if (!it) return { miss: true };
      var r = window.__L.rect(it);
      var hit = document.elementFromPoint(r.cx, r.cy);
      return { r: r, hit: window.__L.label(hit), ok: !!hit && (hit === it || it.contains(hit) || hit.contains(it)) };
    });
    if (re.miss) say('  ❗ 重新打开后结果项没数到');
    else {
      say('· 结果项「' + item.text + '」 rect=' + re.r.x + ',' + re.r.y + ' ' + re.r.w + '×' + re.r.h
        + ' 顶命中=' + re.hit + (re.ok ? ' ✅' : ' ❗'));
      if (re.ok) {
        await page.mouse.click(re.r.cx, re.r.cy);
        /* 即刻读一次（不 settle），settle 之后再读一次：diag 探针（tools/out/probe33-quotesdiag.js）
           用 el.click() 量到 0/120/400ms 三档都是 inline=none，而这里用真鼠标量到过 flex。
           两份仪器的读数对不上就必须把差异定到某一步，不能靠猜。 */
        const snap = function () {
          return page.evaluate(function () {
            const q = document.getElementById('tnQuotes');
            const ta = document.querySelector('.tn-panel textarea') || document.querySelector('#tnText');
            const fl = document.querySelector('.tn-flash');
            return { cnt: document.querySelectorAll('.tn-quotes').length,
              inline: q ? q.style.display : 'gone',
              computed: q ? getComputedStyle(q).display : 'gone',
              css: q ? (q.style.cssText || '(空)').slice(0, 44) : 'gone',
              len: ta ? (ta.value || '').length : -1,
              flash: fl ? (fl.textContent || '').slice(0, 16) : 'no-el' };
          });
        };
        const s0 = await snap();
        await settle(page, 400);
        const s1 = await snap();
        say('  真点之后（即刻）：.tn-quotes 份数=' + s0.cnt + ' inline=' + (s0.inline || '(空)')
          + ' computed=' + s0.computed + ' 正文长度=' + s0.len + ' 浮层提示=「' + s0.flash + '」');
        say('  真点之后（+settle）：inline=' + (s1.inline || '(空)') + ' computed=' + s1.computed
          + ' style 串=「' + s1.css + '」 正文长度=' + s1.len + ' 浮层提示=「' + s1.flash + '」'
          + (s1.computed === 'none' ? ' ✅ append 后浮层收起'
            : s0.computed === 'none' ? ' ❗ 即刻是收的，settle 那一下被别的东西重开'
              : ' ❗ append 那一支没关掉浮层（inline=' + (s1.inline || '(空)') + '）'));
      }
    }
  } else {
    say('  · 「云冈」这一档没有结果项（seed 库里的名言表没命中），追加链这腿跳过');
  }

  say('  未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

;(async function main() {
  const server = staticServer();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  try {
    await legBar(browser);
    await legQuotes(browser);
  } catch (e) {
    say('FATAL: ' + (e && e.message));
    say((e && e.stack || '').split('\n').slice(0, 6).join('\n'));
    process.exitCode = 1;
  } finally {
    dump();
    await browser.close();
    server.close();
  }
})();
