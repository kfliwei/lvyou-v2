/* probe33-editpage.js — 批次 33-B 尾巴：#tnEditAddPhoto 中心点打不到自己，压着的是谁
 *
 * probe33-touch 腿① 报 `64×44 top=544 命中=div`（真值 tools/out/b33-probe-33d-run.txt:69）。
 * 探针的可达判据是 hit===e || e.contains(hit) || hit.contains(e)，报红说明那个 div 既不是它的
 * 祖先也不是它的后代——那就真是有东西盖在上面。但它是一个「没有 class 没有 id」的裸 div，
 * 光看名字猜不出来是谁，所以这里把三件事量清楚：
 *   ① 按钮那一行的 DOM 结构（父/兄弟/各自的 rect）；
 *   ② 中心点 elementFromPoint 的完整命中链（从最深往上 6 层，连 rect 与 computed position/z）；
 *   ③ 那条裸 div 的 outerHTML 开头 80 字（对上源码里哪一行）。
 * 只读，不改产品码。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-editpage.js \
 *        > tools/out/b33-probe-editpage.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8183', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-editpage.txt'), lines.join('\n') + '\n'); }
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
      [{ id: 'e1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
         ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02',
         text: '正文一', photos: ['images/sites/034ab1d51239cd1e.jpg'], audio: '', tags: ['木塔'] }].forEach(function (n) { tx.objectStore('notes').put(n); });
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

;(async function main() {
  const server = staticServer();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e && e.message || e)));
    await page.setCacheEnabled(false);
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(function () {
      return navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())));
    });
    await page.evaluate(seedLocal);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
    await settle(page, 500);

    await page.evaluate('TravelNotes.ensureUI && TravelNotes.ensureUI(); TravelNotes.openList();');
    await settle(page, 400);
    say('· 开列表后在场：.tn-list=' + await page.evaluate('!!document.querySelector(".tn-list")')
      + ' .tn-item=' + await page.evaluate('document.querySelectorAll(".tn-item").length')
      + ' [data-a=edit]=' + await page.evaluate('document.querySelectorAll("[data-a=edit]").length'));
    await page.evaluate(function () {
      var t = document.getElementById('tnViewTime');
      if (t) t.click();
    });
    await settle(page, 400);
    say('· 切时间线后：.tn-item=' + await page.evaluate('document.querySelectorAll(".tn-item").length')
      + ' [data-a=edit]=' + await page.evaluate('document.querySelectorAll("[data-a=edit]").length'));
    const editClick = await page.evaluate(function () {
      var b = document.querySelector('.tn-item [data-a="edit"]') || document.querySelector('[data-a="edit"]');
      if (!b) return 'no-btn';
      b.click();
      return 'clicked:' + (b.getAttribute('data-a') || '?');
    });
    say('· 点编辑：' + editClick);
    await settle(page, 600);
    say('· 编辑页在场=' + await page.evaluate('!!document.querySelector(".tn-editpage")')
      + ' display=' + await page.evaluate('(function(){var e=document.querySelector(".tn-editpage");return e?getComputedStyle(e).display:"none";})()')
      + ' #tnEditAddPhoto=' + await page.evaluate('!!document.getElementById("tnEditAddPhoto")'));
    await page.waitForFunction(s => {
      var e = document.querySelector(s);
      return !!e && getComputedStyle(e).display !== 'none';
    }, { timeout: 10000 }, '.tn-editpage');
    await settle(page, 400);

    const r = await page.evaluate(function () {
      var btn = document.getElementById('tnEditAddPhoto');
      if (!btn) return { none: true };
      function label(e) {
        var s = e.tagName.toLowerCase();
        if (e.id) s += '#' + e.id;
        var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
        if (c.length) s += '.' + c.join('.');
        return s.slice(0, 90);
      }
      function rect(e) { var b = e.getBoundingClientRect(); return Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + '×' + Math.round(b.height); }
      var b = btn.getBoundingClientRect();
      var cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2);
      var chain = [];
      document.elementsFromPoint(cx, cy).slice(0, 6).forEach(function (e) {
        var cs = getComputedStyle(e);
        chain.push({ el: label(e), rect: rect(e), pos: cs.position, z: cs.zIndex, op: cs.opacity, pe: cs.pointerEvents });
      });
      var fam = [];
      Array.from(btn.parentElement.children).forEach(function (e) {
        fam.push({ el: label(e), rect: rect(e), display: getComputedStyle(e).display, flex: getComputedStyle(e).flex });
      });
      return {
        btnRect: rect(btn), center: [cx, cy],
        parentRow: { label: label(btn.parentElement), rect: rect(btn.parentElement), outer: btn.parentElement.outerHTML.slice(0, 150) },
        hitChain: chain, siblings: fam,
        scrollBody: (function () { var bd = document.querySelector('.tn-editpage .body'); return { sh: bd.scrollHeight, ch: bd.clientHeight, st: bd.scrollTop }; })()
      };
    });
    say('· #tnEditAddPhoto rect=' + r.btnRect + ' 中心点=' + JSON.stringify(r.center));
    say('  所在行：' + r.parentRow.label + ' rect=' + r.parentRow.rect);
    say('  该行 outerHTML：' + r.parentRow.outer);
    say('  同排兄弟：');
    r.siblings.forEach(function (s) { say('    ' + s.el + ' rect=' + s.rect + ' display=' + s.display + ' flex=' + s.flex); });
    say('  中心点 elementsFromPoint（深→浅）：');
    r.hitChain.forEach(function (h, i) { say('    [' + i + '] ' + h.el + ' rect=' + h.rect + ' pos=' + h.pos + ' z=' + h.z + ' pointer-events=' + h.pe); });
    say('  .tn-editpage .body 滚动：scrollH=' + r.scrollBody.sh + ' clientH=' + r.scrollBody.ch + ' scrollTop=' + r.scrollBody.st);
    say('  未捕获报错：' + errs.length + ' 条');
  } catch (e) {
    say('FATAL: ' + (e && e.message));
    say(String(e && e.stack).split('\n').slice(0, 5).join('\n'));
  } finally {
    dump();
    await browser.close();
    server.close();
  }
})();
