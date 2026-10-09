/* probe33-quotesdiag.js — 33-C 复验里那一条 ❗：真鼠标点 #tnQuoteBack 之后 #tnQuotes 仍 display=flex
 *
 * probe33-layer 腿② 报（真值 tools/out/b33-probe-33c-layer.txt）：
 *   · #tnQuoteBack rect=14,85 44×44 中心点顶命中=button#tnQuoteBack ✅
 *   · 真鼠标点下去之后 #tnQuotes display=flex（期望 none）
 * 命中没问题、处理器一行代码就是 `qq.style.display='none'`——那就只有几种可能，逐条数清楚：
 *   ① 页里有不止一份 `.tn-quotes`（搬层是 insertAdjacentHTML，buildUI 若跑两次就会插两份），
 *      我看见的那份和 qq 指向的那份不是同一份；
 *   ② 处理器根本没绑上（$X(qq,…)/行号顺序问题），那 onclick 是 null；
 *   ③ display 是被别处的 style 或动画按住的（读 inline vs computed）。
 * 只读，不改产品码。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-quotesdiag.js \
 *        > tools/out/b33-probe-quotesdiag.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8187', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-quotesdiag.txt'), lines.join('\n') + '\n'); }
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
      tx.objectStore('notes').put({ id: 'd1', title: '云冈石窟', siteName: '云冈石窟', lat: 40.07, lng: 113.13,
        ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02',
        text: '正文一', photos: [], audio: '', tags: [] });
      tx.oncomplete = function () { db.close(); resolve('seeded'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
}

async function settle(page, extra) {
  try { await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} })); } catch (e) {}
  await sleep(extra || 300);
}

/* 每份 .tn-quotes 的身份卡：在 body 的第几个孩子、inline/computed display、它的 back 钮在不在自己身上 */
const SNAP = function () {
  return Array.prototype.map.call(document.querySelectorAll('.tn-quotes'), function (q, i) {
    const cs = getComputedStyle(q);
    const back = q.querySelector('#tnQuoteBack');
    const clear = q.querySelector('#tnQuoteClear');
    const hint = q.querySelector('#tnQuoteHint');
    const r = back ? back.getBoundingClientRect() : null;
    return {
      i: i,
      parentId: q.parentElement ? (q.parentElement.id || q.parentElement.className || q.parentElement.tagName) : 'null',
      isGetById: q === document.getElementById('tnQuotes'),
      inline: q.style.display,
      computed: cs.display,
      z: cs.zIndex,
      rect: Math.round(q.getBoundingClientRect().left) + ',' + Math.round(q.getBoundingClientRect().top)
        + ' ' + Math.round(q.getBoundingClientRect().width) + '×' + Math.round(q.getBoundingClientRect().height),
      backOnclick: back ? typeof back.onclick : 'no-el',
      clearOnclick: clear ? typeof clear.onclick : 'no-el',
      backIsInThis: !!back && q.contains(back),
      backRect: r ? Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) : 'none',
      hint: hint ? (hint.textContent || '').slice(0, 20) : 'no-el'
    };
  });
};

;(async function main() {
  const server = staticServer();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  const print = function (arr, tag) {
    say('  ' + tag + ' 共 ' + arr.length + ' 份 .tn-quotes');
    arr.forEach(function (s) {
      say('    [' + s.i + '] 父=' + s.parentId + ' 是 getElementById 那一份=' + s.isGetById
        + '｜inline display=' + (s.inline || '(空)') + ' computed=' + s.computed + ' z=' + s.z + ' rect=' + s.rect);
      say('         back.onclick=' + s.backOnclick + ' clear.onclick=' + s.clearOnclick
        + ' back rect=' + s.backRect + ' hint=「' + s.hint + '」');
    });
  };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e && e.message || e)));
    await page.setCacheEnabled(false);
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => navigator.serviceWorker.getRegistrations()
      .then(rs => Promise.all(rs.map(r => r.unregister()))));
    await page.evaluate(seedLocal);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
    await settle(page, 500);

    print(await page.evaluate(SNAP), '· 只加载页面（buildUI 还没跑）');

    await page.evaluate(function () {
      TravelNotes.ensureUI && TravelNotes.ensureUI();
      TravelNotes.openPanel({ label: '云冈石窟', lat: 40.07, lng: 113.13, __i: 0 });
    });
    await settle(page, 500);
    print(await page.evaluate(SNAP), '· ensureUI + openPanel 之后');

    await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
    await settle(page, 400);
    print(await page.evaluate(SNAP), '· 点 #tnQuote 打开浮层之后');

    /* ① 直接 el.click()：绕开命中测试，只看处理器在不在、绑在哪一份 */
    await page.evaluate(function () {
      var b = document.getElementById('tnQuoteBack');
      window.__clickedOn = b ? (b.closest('.tn-quotes') === document.getElementById('tnQuotes')) : null;
      if (b) b.click();
    });
    await settle(page, 400);
    say('  · el.click() 那一下：那个 back 属于 getElementById 那一份='
      + await page.evaluate('window.__clickedOn'));
    print(await page.evaluate(SNAP), '· el.click() #tnQuoteBack 之后');

    /* ② 真鼠标再点一次（先重新打开） */
    await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
    await settle(page, 400);
    const bk = await page.evaluate(function () {
      var b = document.getElementById('tnQuoteBack');
      if (!b) return null;
      var r = b.getBoundingClientRect();
      return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
        topHit: (function () { var h = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)); return h ? (h.id || h.className || h.tagName) : 'null'; })() };
    });
    if (bk) {
      await page.mouse.click(bk.cx, bk.cy);
      await settle(page, 400);
      say('  · 真鼠标点 (' + bk.cx + ',' + bk.cy + ')，那一点顶命中=' + bk.topHit);
      print(await page.evaluate(SNAP), '· 真鼠标点 back 之后');
    } else {
      say('  ❗ 没数到 #tnQuoteBack');
    }

    /* ③ 面板那一侧：#tnQuote 的打开动作到底改的是哪一份（两份都在的话，改一份露一份） */
    say('  · 每份的 display 时间线（open→close 各读一次 inline/computed）：');
    const tl = await page.evaluate(function () {
      var out = [];
      document.querySelectorAll('.tn-quotes').forEach(function (q, i) {
        out.push({ i: i, inline: q.style.display, computed: getComputedStyle(q).display,
          firstInDoc: q === document.querySelector('.tn-quotes') });
      });
      return out;
    });
    tl.forEach(function (t) { say('    [' + t.i + '] inline=' + (t.inline || '(空)') + ' computed=' + t.computed + ' 是文档里第一份=' + t.firstInDoc); });

    /* ④ 追加那一条读数：probe33-layer 报「真点结果项之后 #tnQuotes 仍 display=flex」，
        而 appendQuote 的最后一行就是 qq.style.display='none'。两种可能必须分开：
        (a) 我的搬层把 qq 指错了元素；(b) 有东西在后面又把它打开（focus/滚动/异步回调/探针自己的 settle）。
        这里不点别的，只 el.click() 一枚结果项，然后 0ms/120ms/400ms 各读一次 inline+computed，
        并把 appendQuote 里的三处依赖（#tnRawEdit / #tnRaw / #tnPolish / #tnSave）逐个数出来。 */
    await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
    await settle(page, 300);
    const preAppend = await page.evaluate(function () {
      var q = document.getElementById('tnQuotes');
      var it = q ? q.querySelector('.tn-quote') : null;
      return { opened: q ? getComputedStyle(q).display : 'gone',
        items: q ? q.querySelectorAll('.tn-quote').length : -1,
        target: it ? (it.textContent || '').slice(0, 12) : 'no-el',
        deps: {
          rawEdit: !!document.querySelector('.tn-panel #tnRawEdit'),
          raw: !!document.querySelector('.tn-panel #tnRaw'),
          polish: !!document.querySelector('.tn-panel #tnPolish'),
          save: !!document.querySelector('.tn-panel #tnSave')
        } };
    });
    say('  · 追加前：浮层=' + preAppend.opened + ' 可点条数=' + preAppend.items
      + ' 第一条=「' + preAppend.target + '」 依赖在场=' + JSON.stringify(preAppend.deps));
    await page.evaluate(function () {
      var q = document.getElementById('tnQuotes');
      var it = q ? q.querySelector('.tn-quote') : null;
      if (it) it.click();
    });
    for (const [tag, ms] of [['即刻', 0], ['+120ms', 120], ['+400ms', 400]]) {
      if (ms) await sleep(ms);
      const s = await page.evaluate(function () {
        var q = document.getElementById('tnQuotes');
        var ed = document.querySelector('.tn-panel #tnRawEdit');
        var fl = document.querySelector('.tn-flash');
        return { inline: q ? q.style.display : 'gone', computed: q ? getComputedStyle(q).display : 'gone',
          bodyLen: ed ? (ed.value || '').length : -1,
          flash: fl ? (fl.textContent || '').slice(0, 12) : 'no-el',
          flashDisp: fl ? getComputedStyle(fl).display : 'no-el' };
      });
      say('    ' + tag + '：inline=' + (s.inline || '(空)') + ' computed=' + s.computed
        + ' 正文长度=' + s.bodyLen + ' 浮层提示=「' + s.flash + '」(display=' + s.flashDisp + ')');
    }
    say('    （append 那一支若真跑到 display=none，即刻那一读必须是 none；后面两档又变 flex＝有别的东西重开）');

    say('  未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 4).join(' | ') : ''));
  } catch (e) {
    say('FATAL: ' + (e && e.message));
    say((e && e.stack || '').split('\n').slice(0, 5).join('\n'));
    process.exitCode = 1;
  } finally {
    dump();
    await browser.close();
    server.close();
  }
})();
