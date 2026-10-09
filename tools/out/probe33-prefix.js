/* probe33-prefix.js — 批次 33-C 的反向腿：把「改前」那一半真的量出来
 *
 * 为什么要有这一支：交付的注释与 §48 里各写了一句「改前」——
 *   · verify.js:6741／design.css 注释：备份条「真鼠标点下去 #tnEditFile 收到 0 次 click」
 *   · travel-notes.js:729／smoke-layer.js:13：#tnQuoteClear 那一点「会把背后的记开销档切走、搜索框没清干净」
 * 这两句原本只有**命中链**证据（b33-probe-editpage.txt:13 的 elementsFromPoint[0]、b33-probe-33b.txt:15 的
 * 顶命中），「0 次 click」「档被切走」是顺着命中链推出来的，没有一条落盘的读数。
 * 记忆里那条纪律说得明白：「设计内静默要第二条腿反证一次」，同理，「反向自证」也不能只靠推理。
 *
 * 做法：产品码一行不动，**在当前代码上把改前的条件在运行时造出来**，这样变量只剩一个：
 *   ① 备份条 —— 把那条 div 的 inline z 从 8000 打回 9500（改前它写死 9500），真鼠标点
 *      #tnEditAddPhoto 中心，数 #tnEditFile 收到几次 click；再撤掉 inline z 复点一次（期望 1）。
 *   ② 名言浮层 —— 把 #tnQuotes 从 body 搬回 .tn-foot(z:2)（改前它住在那儿），先污染搜索框，
 *      真鼠标点 #tnQuoteClear 中心，读四件事：框清没清／「记开销」档有没有被切走／面板有没有进
 *      expense 态／浮层还在不在；再搬回 body 复点一次。
 *   触控地板这一族 33-B 已经归位（44×44 在场），所以这里量到的失败**只可能**来自层归属，
 *   不会和尺寸混在一起——那正是 33-A 当初要分成两条腿的原因。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、seed 直写 IndexedDB、
 * 反注册 SW + 关缓存、打 tn_onboarded 才读、动画收尾再量、waitForFunction 一律函数式。
 * 提醒条 12s 自己摘走 → 用 evaluateOnNewDocument 截下那次 setTimeout（产品码没动）。
 * 启动屏 #bootSplash(z:9999 inset:0) 没退场时任何一点都命中它，先等它 pointer-events=none。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-prefix.js \
 *        > tools/out/b33-probe-prefix.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8191', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-prefix.txt'), lines.join('\n') + '\n'); }
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

function seedLocal() {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
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
      tx.objectStore('notes').put({ id: 'p1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
        ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02',
        text: '正文一', photos: ['images/sites/034ab1d51239cd1e.jpg'], audio: '', tags: ['木塔'] });
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
          pos: cs.position, z: cs.zIndex, pe: cs.pointerEvents, isBar: e === bar });
      });
      return out;
    },
    reach: function (sel) {
      var e = document.querySelector(sel);
      if (!e) return { miss: true };
      var r = window.__L.rect(e);
      var hit = document.elementFromPoint(r.cx, r.cy);
      return { rect: r, hit: window.__L.label(hit),
        ok: !!hit && (hit === e || e.contains(hit) || hit.contains(e)) };
    },
    up: function (sel) {
      var e = document.querySelector(sel);
      if (!e) return 'no-el';
      var out = [];
      while (e && out.length < 6) {
        out.push(window.__L.label(e) + '(z=' + getComputedStyle(e).zIndex + ',pos=' + getComputedStyle(e).position + ')');
        e = e.parentElement;
      }
      return out.join(' → ');
    }
  };
};

async function newPage(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  try { page.on('filechooser', ch => { try { ch.cancel(); } catch (e) {} }); } catch (e) {}
  await page.evaluateOnNewDocument(function () {
    const t = window.setTimeout;
    window.setTimeout = function (fn, ms) {
      if (ms === 12000 && typeof fn === 'function') { window.__barTimer = fn; return 0; }
      return t.apply(window, arguments);
    };
  });
  await page.setCacheEnabled(false);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(function () {
    return navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())));
  });
  await page.evaluate(seedLocal);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
  await page.evaluate(HELPERS);
  await page.waitForFunction(() => {
    const b = document.getElementById('bootSplash');
    return !b || getComputedStyle(b).pointerEvents === 'none';
  }, { timeout: 8000, polling: 100 }).catch(() => {});
  await settle(page, 500);
  return { page, errs };
}

function printChain(arr) {
  arr.forEach(function (h) {
    say('    [' + h.i + '] ' + h.el + ' rect=' + h.rect + ' pos=' + h.pos + ' z=' + h.z
      + (h.isBar ? ' · 就是那条提醒条' : '') + ' pointer-events=' + h.pe);
  });
}

async function openEditPage(page) {
  await page.evaluate(function () {
    TravelNotes.ensureUI && TravelNotes.ensureUI();
    TravelNotes.openList();
  });
  await waitShown(page, '.tn-list'); await settle(page, 400);
  await page.evaluate(function () { var t = document.getElementById('tnViewTime'); if (t) t.click(); });
  await settle(page, 300);
  await page.evaluate(function () {
    var b = document.querySelector('.tn-item [data-a="edit"]') || document.querySelector('[data-a="edit"]');
    if (b) b.click();
  });
  await waitShown(page, '.tn-editpage'); await settle(page, 500);
}

/* ============ 腿 ① 备份提醒条：把 z 打回 9500，真点一次才知道「0 次」是不是事实 ============ */
async function legBar(browser) {
  say('');
  say('==================== 腿 ① 提醒条 z：9500（造出来的改前）vs 8000（现场） ============');
  const { page, errs } = await newPage(browser, '/index.html');
  await openEditPage(page);

  const base = await page.evaluate(function () {
    const btn = document.getElementById('tnEditAddPhoto'), f = document.getElementById('tnEditFile');
    if (!btn || !f) return { none: true };
    window.__fileClicks = 0;
    f.addEventListener('click', function () { window.__fileClicks++; });
    const r = window.__L.rect(btn);
    const d = window.__L.bar();
    return { r: r, size: r.w + '×' + r.h,
      ownZ: d ? (d.style.zIndex || '(inline 没写)') : 'no-bar',
      barZ: d ? getComputedStyle(d).zIndex : 'no-bar',
      barRect: d ? window.__L.rect(d) : null };
  });
  if (base.none) { say('❗ 编辑页里没数到 #tnEditAddPhoto / #tnEditFile，这一腿落空'); await page.close(); return; }
  say('· #tnEditAddPhoto rect=' + base.r.x + ',' + base.r.y + ' ' + base.size + ' 中心点=' + base.r.cx + ',' + base.r.cy
    + '｜提醒条 computed z=' + base.barZ + '（inline 就是 ' + base.ownZ + '，现场值＝33-C 已降到 8000）'
    + ' 条 rect=' + (base.barRect ? base.barRect.x + ',' + base.barRect.y + ' ' + base.barRect.w + '×' + base.barRect.h : 'no-bar'));

  for (const z of ['9500', base.ownZ === '(inline 没写)' ? null : base.ownZ]) {
    const tag = z === '9500' ? '造出来的改前 z=9500' : '现场 z=' + base.ownZ + '（把 inline 恢复成它自己的原值）';
    await page.evaluate(function (zz) {
      const d = window.__L.bar();
      if (!d) return;
      if (zz === null) d.style.removeProperty('z-index'); else d.style.zIndex = zz;
    }, z);
    const st = await page.evaluate(function (b) {
      const d = window.__L.bar();
      if (!d) return { gone: true };
      const r = window.__L.rect(d);
      return { z: getComputedStyle(d).zIndex, rect: r,
        covers: b.cx >= r.x && b.cx <= r.x + r.w && b.cy >= r.y && b.cy <= r.y + r.h };
    }, base.r);
    if (st.gone) { say('  ❗ ' + tag + '：提醒条已经不在了，这一档落空'); continue; }
    const pre = await page.evaluate(function (x, y) {
      return { chain: window.__L.chain(x, y, 4), n: window.__fileClicks };
    }, base.r.cx, base.r.cy);
    say('  · ' + tag + '（computed z=' + st.z + '）条 rect=' + st.rect.x + ',' + st.rect.y + ' '
      + st.rect.w + '×' + st.rect.h + ' 是否罩住那个中心点=' + st.covers);
    printChain(pre.chain);
    await page.mouse.click(base.r.cx, base.r.cy);
    await settle(page, 400);
    const got = await page.evaluate('window.__fileClicks') - pre.n;
    /* 这一档的期望跟着「顶命中是不是那条 bar」定，而不是跟着几何重叠定：
       z=8000 时条子的矩形照样罩得住中心点（covers=true），但它在 .tn-editpage(9010) 之下，
       点得到的是钮——按几何重叠许愿「0 次」会把这一档判成假失败。 */
    const topIsBar = !!(pre.chain[0] && pre.chain[0].isBar);
    const want = topIsBar ? 0 : 1;
    say('  → 真鼠标点下去 #tnEditFile 收到 click=' + got + ' 次（顶命中是那条 bar=' + topIsBar
      + ' → 这一档期望 ' + want + '）'
      + (got === want ? ' ✅' : ' ❗ 与命中链不符，要再拆'));
  }
  say('  未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

/* ============ 腿 ② 名言浮层：搬回 .tn-foot(z:2)，真点清钮才知道档是不是被切走 ============ */
async function legQuotes(browser) {
  say('');
  say('==================== 腿 ② #tnQuotes：住在 .tn-foot（造出来的改前）vs 住 body（现场） ============');
  const { page, errs } = await newPage(browser, '/index.html');
  await page.evaluate(function () {
    TravelNotes.ensureUI && TravelNotes.ensureUI();
    TravelNotes.openPanel({ label: '云冈石窟', lat: 40.07, lng: 113.13, __i: 0 });
  });
  await waitShown(page, '.tn-panel'); await settle(page, 400);

  for (const where of ['foot', 'body']) {
    const tag = where === 'foot' ? '造出来的改前：搬回 .tn-foot（父级 z:2 建上下文）' : '现场：住 body';
    await page.evaluate(function (w) {
      const q = document.getElementById('tnQuotes');
      if (!q) return;
      if (w === 'foot') {
        const f = document.querySelector('.tn-panel .tn-foot');
        if (f) f.appendChild(q);
        window.__moved = !!f && q.parentElement === f;
      } else {
        document.body.appendChild(q);
        window.__moved = q.parentElement === document.body;
      }
      q.style.display = 'none';
    }, where);
    /* 搬完立刻读一次：上一轮这里出现「foot 找到了、也 appendChild 了，可下一步父级又变回 body」，
       不在这里坐实时机，就分不清是被产品码搬回去的，还是页面重建模把那份 innerHTML 重建了。 */
    const just = await page.evaluate(function () {
      return { n: document.querySelectorAll('.tn-quotes').length,
        parent: document.getElementById('tnQuotes') ? window.__L.label(document.getElementById('tnQuotes').parentElement) : 'gone',
        byIdParent: Array.prototype.map.call(document.querySelectorAll('.tn-quotes'), function (e) {
          return window.__L.label(e.parentElement) + (e.id ? '#tnQuotes' : '(无 id)');
        }).join(' / ') };
    });
    say('  （刚搬完：.tn-quotes 份数=' + just.n + ' getElementById 的父级=' + just.parent + ' 逐份=' + just.byIdParent + '）');
    await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
    await waitShown(page, '#tnQuotes'); await settle(page, 400);
    /* 每一档开点之前先把档位按回「记此刻」：上一档（搬回 .tn-foot）那一发真点已经把面板切进 expense 态，
       不清这个残留，下一档读到的 expOn/panelExpense 就是上一档造成的，现场那一档会被判成假失败。
       ——这一发是被自己前一行污染出来的，不是产品码。 */
    await page.evaluate(function () {
      var b = document.getElementById('tnTabNote');
      if (b) b.click();
    });
    await settle(page, 300);
    const preExp = await page.evaluate(function () {
      const exp = document.getElementById('tnTabExp');
      const pn = document.querySelector('.tn-panel');
      return { expOn: !!(exp && exp.classList.contains('on')), panelExpense: !!pn && pn.classList.contains('is-expense') };
    });
    if (preExp.expOn || preExp.panelExpense) say('    ❗ 复位没清干净（档位还在 expense），这一档的读数不可用');
    /* 先污染搜索框：清钮要是被背后那枚档钮吃掉，框里那串字就得留在屏上 */
    await page.evaluate(function () {
      const q = document.getElementById('tnQuoteSearch');
      if (q) { q.value = '云冈'; q.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    const geom = await page.evaluate(function () {
      const c = document.getElementById('tnQuoteClear');
      if (!c) return { miss: true };
      const r = window.__L.rect(c);
      return { r: r, size: r.w + '×' + r.h, reach: window.__L.reach('#tnQuoteClear'), up: window.__L.up('#tnQuotes'),
        moved: window.__moved, parent: window.__L.label(document.getElementById('tnQuotes').parentElement) };
    });
    if (geom.miss) { say('❗ ' + tag + '：#tnQuoteClear 没数到，这一档落空'); continue; }
    say('  · ' + tag);
    say('    搬动成功=' + geom.moved + '｜当前直接父级=' + geom.parent
      + '｜点之前档位残留已清（expOn=' + preExp.expOn + ' panelExpense=' + preExp.panelExpense + '）');
    say('    祖先链：' + geom.up);
    say('    #tnQuoteClear ' + geom.size + ' 中心点=' + geom.reach.rect.cx + ',' + geom.reach.rect.cy
      + ' 顶命中=' + geom.reach.hit + (geom.reach.ok ? '（自己的）' : '（别人的）'));
    if (!geom.reach.ok) printChain(await page.evaluate((x, y, n) => window.__L.chain(x, y, n),
      geom.reach.rect.cx, geom.reach.rect.cy, 4));
    if (geom.parent.indexOf('tn-foot') < 0 && where === 'foot') {
      say('    ❗ 没能搬进 .tn-foot（顶命中＝' + geom.reach.hit + '），这一档落空：不是「搬回去也不挡」，是没搬成');
      continue;
    }
    await page.mouse.click(geom.reach.rect.cx, geom.reach.rect.cy);
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
    if (where === 'foot') {
      const bad = after.value !== '' || after.expOn || after.panelExpense;
      say('    真点之后：' + JSON.stringify(after)
        + (bad ? ' ✅ 复现改前那种「清钮没赢、档被切走」' : ' ❗ 搬回 .tn-foot 也照样点得到——遮挡的说法要重查'));
    } else {
      const good = after.value === '' && !after.expOn && !after.panelExpense && after.quotesShown;
      say('    真点之后：' + JSON.stringify(after) + (good ? ' ✅ 清钮赢、档位没动、浮层还在' : ' ❗ 现场这一档不该失败'));
    }
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
