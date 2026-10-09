/* tools/smoke-layer.js — 批次 33-C「层叠与互斥」浏览器闸门（§48 的腿）
 *
 * 改了两处，每处都有「改了等于没改」的失败模式，所以两条腿各自要量到反证：
 *   ① index.html 那条备份提醒条 z-index 9500 → 8000。
 *      改前的现场（tools/out/b33-probe-editpage.txt:13）：编辑页里「加照片」64×44 完好，
 *      中心点 elementsFromPoint[0] 却是这条首页提示。那句「真鼠标点下去 #tnEditFile 收到 0 次 click」
 *      从前只是顺着命中链推的，现由反向腿量出来：tools/out/probe33-prefix.js 把这条 div 的 inline z
 *      临时覆盖回 9500 → tools/out/b33-probe-prefix.txt:9 click=0；同一枚钮恢复成 8000 → :15 click=1。
 *      要验三件事：无浮层时它还看得见（降过头＝埋了，功能等于消失）；三类浮层在场时
 *      中心点不再命中它；以及那句新判定（tn_lastBackup 与 tn_webdav_last 取较近）
 *      的正反四档对照——ok:true 新鲜 → 不弹，两键全无 / ok:false / 已 90 天 → 照弹。
 *      期望 0 的判据一律配正向对照，否则「没弹」可能只是整个函数没跑。
 *   ② #tnQuotes 从 .tn-foot(z:2) 里搬到 body 上。
 *      光看 computed z-index 不够（从前它就是 9005，被父级堆叠上下文关住，实际按 2 参加排序），
 *      必须真鼠标点 #tnQuoteClear 中心：改前那一点会把背后的「记开销」档切走、搜索框没清干净
 *      （真值 tools/out/b33-probe-33b.txt:15、:19 与 tools/out/b33-probe-ancestry.txt 那条祖先链；
 *      「切档」这一半由反向腿在运行时把这一层 appendChild 回 .tn-foot 复现，读数
 *      tools/out/b33-probe-prefix.txt:28，同页搬回 body 即 :34 三归零）。
 *      顺带验 $X(qq,…) 的四处改线没把 hint/back/clear 打空。
 *
 * 提醒条 12s 自己摘走，会让「浮层在场时不遮挡」这条判据变成读一个已经不存在的元素——
 * 那是假绿，所以用 evaluateOnNewDocument 把 ms===12000 那一次 setTimeout 的回调截下来存进
 * window.__barTimer（不执行）。产品代码一行没动，真用户照样 12s 后看到它消失；这里只是让
 * 命中测试有一个稳定的被测对象。截到的条数本身也是一条判据（L08）：全站只有那一处用 12000。
 *
 * 启动屏 #bootSplash(design.css:1438) 是 z:9999 的 inset:0 不透明全屏层，900ms 加 .hide、
 * 再 600ms remove()。它还盖着的时候页面上任何一点的 elementFromPoint 都是它，跟这条是 8000
 * 还是 9500 一点关系都没有——上一轮探针在这里报成「降过头：无浮层时它自己都命中不到」，
 * 那是取早了，不是产品遮挡。所以量之前先等它退场，等不到要单独报「整页被启动屏吃住」。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、seed 直写 IndexedDB、
 * 关缓存 + 反注册 SW、打 tn_onboarded 才读、动画收尾再量、waitForFunction 一律函数式。
 *
 * 名字前缀 L（layer）。
 * 用法：PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/smoke-layer.js \
 *        > tools/out/b33-smoke-layer-run.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8172', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;            /* 一加 Ace 6T 真机档（§37 口径） */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
let checks = 0, fails = 0;
let barErrs = 0, quoteErrs = 0;   /* 两条腿各自收集到的页面未捕获报错，最后一条判据读它们 */
function ok(name, cond, detail) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (detail === undefined || detail === '' ? '' : '  [' + detail + ']');
  if (!cond) fails++;
  lines.push(s);
  console.log(s);
}
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b33-smoke-layer.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('读数落盘失败：' + e.message); }
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
    if (extra) Object.keys(extra).forEach(function (k) { localStorage.setItem(k, extra[k]); });
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

/* 页内共用的小量具：找提醒条 / 量 rect / 中心点命中链 / 可达判据 */
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
          pos: cs.position, z: cs.zIndex, isBar: e === bar });
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
    },
    /* 提醒条中心点的顶命中是谁：这一条只有「是不是这条 div」一个真值有意义 */
    barHit: function () {
      var d = window.__L.bar();
      if (!d) return { gone: true };
      var r = window.__L.rect(d);
      var hit = document.elementFromPoint(r.cx, r.cy);
      return { rect: r, hit: window.__L.label(hit), isBar: hit === d, z: getComputedStyle(d).zIndex };
    }
  };
};

async function newPage(browser, url, extra) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.on('filechooser', ch => { try { ch.cancel(); } catch (e) {} });
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
    say('      [' + h.i + '] ' + h.el + ' rect=' + h.rect + ' pos=' + h.pos + ' z=' + h.z
      + (h.isBar ? ' · 就是那条提醒条' : ''));
  });
}

/* ================= 腿 ①：备份提醒条（z:8000 之后「看得见」与「不压人」两都要） ============ */
async function legBar(browser) {
  say('');
  say('==================== 腿 ① 备份提醒条 ====================');
  const { page, errs } = await newPage(browser, '/index.html');
  const tS = Date.now();
  let splashGone = true;
  await page.waitForFunction(() => {
    const b = document.getElementById('bootSplash');
    return !b || getComputedStyle(b).pointerEvents === 'none';
  }, { timeout: 8000, polling: 100 }).catch(async () => {
    splashGone = false;
    const st = await page.evaluate(function () {
      const b = document.getElementById('bootSplash');
      return b ? { cls: b.className, pe: getComputedStyle(b).pointerEvents, op: getComputedStyle(b).opacity } : null;
    });
    say('  ❗ 8s 还没等到启动屏退场：' + JSON.stringify(st) + '——那不是压提醒条，是整页被启动屏吃住');
  });
  say('  （启动屏 #bootSplash(z:9999 inset:0) 退场等了 ' + (Date.now() - tS) + 'ms，之后才量提醒条）');
  ok('L01 量之前启动屏已退场（它盖着时任何 z 都命中不到，那种红是探针的锅）', splashGone, '等 ' + (Date.now() - tS) + 'ms');

  const bare = await page.evaluate(function (vh) {
    const d = window.__L.bar();
    if (!d) return { none: true, hijack: window.__timersHijacked };
    const r = window.__L.rect(d), cs = getComputedStyle(d);
    const hit = document.elementFromPoint(r.cx, r.cy);
    return { r: r, z: cs.zIndex, pos: cs.position,
      hit: window.__L.label(hit), hitIsBarOrKin: hit === d || d.contains(hit) || (hit && hit.contains(d)),
      inView: r.y >= 0 && r.y + r.h <= vh,
      bkGo: !!document.getElementById('bkGo'), hijack: window.__timersHijacked };
  }, VH);

  ok('L02 空库里这条真的出现了（判定落空时下面全是空转）', !bare.none, bare.none ? 'seeded 库里 1 篇、两键全无' : 'rect=' + bare.r.x + ',' + bare.r.y + ' ' + bare.r.w + '×' + bare.r.h);
  if (bare.none) { say('  ❗ 判据落空，先查 last 的取数'); barErrs = errs.length; await page.close(); return; }
  ok('L03 computed z-index 就是 8000（那一族浮层最低的一档是 9000）', bare.z === '8000', '现场 z=' + bare.z);
  ok('L04 position=fixed（它靠这个住在视口下沿，与页面滚动无关）', bare.pos === 'fixed', '现场 position=' + bare.pos);
  ok('L05 无浮层时中心点顶命中它自己或其后代（降过头＝功能被埋，这条是「看得见」那半边）', bare.hitIsBarOrKin, '顶命中=' + bare.hit);
  ok('L06 整条落在 328×723 取景框内（bottom:…104px 那条算式没把它推出屏）', bare.inView, 'top=' + bare.r.y + ' bottom=' + (bare.r.y + bare.r.h) + '／屏高 ' + VH);
  ok('L07 「去备份」钮 #bkGo 在场（提示要能一步走到设置页）', bare.bkGo, 'bkGo=' + bare.bkGo);
  ok('L08 12s 摘除计时器被截到恰 1 条（产品仍会自己摘走；全站用 12000 的只有这一处）', bare.hijack === 1, '截到 ' + bare.hijack + ' 条');

  /* 三类全屏浮层在场时，中心点都不该再命中这条 */
  await page.evaluate(function () { TravelNotes.ensureUI && TravelNotes.ensureUI(); TravelNotes.openList(); });
  await waitShown(page, '.tn-list'); await settle(page, 400);
  let h = await page.evaluate('window.__L.barHit()');
  ok('L09 .tn-list(z:9000) 在场时提醒条中心点顶命中不是它', !h.gone && !h.isBar, h.gone ? '条子已经不在了' : '顶命中=' + h.hit);

  await page.evaluate(function () { var b = document.querySelector('.tn-list .tn-x'); if (b) b.click(); });
  await settle(page, 400);
  await page.evaluate(function () {
    TravelNotes.openPanel({ label: '应县木塔', lat: 39.66, lng: 113.19, __i: 0 });
  });
  await waitShown(page, '.tn-panel'); await settle(page, 400);
  h = await page.evaluate('window.__L.barHit()');
  ok('L10 .tn-panel(z:9001，design.css 里 background:var(--color-bg) 不透明) 在场时不压', !h.gone && !h.isBar, h.gone ? '条子已经不在了' : '顶命中=' + h.hit);

  /* 编辑页：整页 inset:0 不透明，改前被这条盖住的正是它的 .tn-acts 一行 */
  await page.evaluate(function () { var t = document.getElementById('tnViewTime'); if (t) t.click(); });
  await settle(page, 300);
  await page.evaluate(function () {
    var b = document.querySelector('.tn-item [data-a="edit"]') || document.querySelector('[data-a="edit"]');
    if (b) b.click();
  });
  await waitShown(page, '.tn-editpage'); await settle(page, 500);
  h = await page.evaluate('window.__L.barHit()');
  ok('L11 .tn-editpage(z:9010) 在场时不压（改前中心点 elementsFromPoint[0] 就是这条 div）', !h.gone && !h.isBar, h.gone ? '条子已经不在了' : '顶命中=' + h.hit);
  const stillThere = await page.evaluate('!!window.__L.bar()');
  ok('L12 编辑页里这条仍在 DOM（不遮挡是靠层级，不是靠六处开屏各挂一次「摘条子」的钩子）', stillThere, '还在 DOM=' + stillThere);

  const pre = await page.evaluate(function () {
    const btn = document.getElementById('tnEditAddPhoto');
    if (!btn) return { none: true };
    const r = window.__L.rect(btn);
    document.getElementById('tnEditFile').addEventListener('click', function () {
      window.__fileClicks = (window.__fileClicks || 0) + 1;
    });
    const ch = window.__L.chain(r.cx, r.cy, 5);
    const hit = document.elementFromPoint(r.cx, r.cy);
    return { r: r, chain: ch, topIsBar: ch.length > 0 && ch[0].isBar,
      reach: !!hit && (hit === btn || btn.contains(hit) || hit.contains(btn)),
      hitLabel: window.__L.label(hit), base: window.__fileClicks || 0 };
  });
  ok('L13 #tnEditAddPhoto 中心点命中链的 [0] 不是提醒条', !pre.none && !pre.topIsBar, pre.none ? '编辑页里没数到这颗钮' : '顶命中=' + pre.hitLabel);
  ok('L14 #tnEditAddPhoto 中心点顶命中是自己或其后代', !pre.none && pre.reach, pre.none ? '' : pre.r.w + '×' + pre.r.h + ' 顶命中=' + pre.hitLabel);
  if (!pre.none) printChain(pre.chain);
  let clicked = -1;
  if (!pre.none) {
    await page.mouse.click(pre.r.cx, pre.r.cy);
    await settle(page, 400);
    clicked = await page.evaluate('window.__fileClicks || 0') - pre.base;
  }
  ok('L15 真鼠标点它之后 #tnEditFile 收到 click 恰 1 次（改前恒 0：那一点被那条 div 吃了）', clicked === 1, '实得 ' + clicked + ' 次');

  /* 备份判定的正反四档（同一份代码，只换 localStorage）。
     判据标签一律写字面串：§48 的齐备检是按「ok('L16 」这种字面形状逐条数的，
     把名字拼出来（ok(name + …)）会让那四条在闸门里读不到——腿自己在跑，闸门却不知道它在不在。 */
  say('  · 判定的四档：');
  const DAY = 864e5;
  const judge = async function (extra) {
    const { page: p2 } = await newPage(browser, '/index.html', extra);
    const got = await p2.evaluate(function () {
      const d = window.__L.bar();
      if (!d) return { shown: '不弹', z: '' };
      return { shown: '弹', z: getComputedStyle(d).zIndex };
    });
    await p2.close();
    return got;
  };
  const wv = function (o) { return { tn_webdav_last: JSON.stringify(o) }; };
  let g16 = await judge(null);
  ok('L16 两键全无（新用户）→ 弹', g16.shown === '弹', '读到「' + g16.shown + '(' + g16.z + ')」');
  let g17 = await judge(wv({ ts: Date.now() - DAY, ok: true, msg: '同步成功' }));
  ok('L17 WebDAV 成功且新鲜→ 不弹（这句就是本批修的那句假话：开了自动同步的人不该被告知「数据只在本机」）', g17.shown === '不弹', '读到「' + g17.shown + '(' + g17.z + ')」');
  let g18 = await judge(wv({ ts: Date.now() - DAY, ok: false, msg: '网络错误' }));
  ok('L18 WebDAV 失败（ok:false）→ 弹（期望 0 的那一档必须配正向对照，否则「不弹」可能只是整块没跑）', g18.shown === '弹', '读到「' + g18.shown + '(' + g18.z + ')」');
  let g19 = await judge(wv({ ts: Date.now() - 90 * DAY, ok: true, msg: '同步成功' }));
  ok('L19 WebDAV 成功但已 90 天→ 弹（新鲜度判的是「距上次」，不是「有没有成功过」）', g19.shown === '弹', '读到「' + g19.shown + '(' + g19.z + ')」');
  say('  腿① 未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  barErrs = errs.length;
  await page.close();
}

/* ================= 腿 ②：#tnQuotes 搬出 .tn-foot(z:2) ================= */
async function legQuotes(browser) {
  say('');
  say('==================== 腿 ② #tnQuotes：真鼠标点得到自己吗 ====================');
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
    while (e && up.length < 6) { up.push({ label: window.__L.label(e), cls: (typeof e.className === 'string' ? e.className : ''), z: getComputedStyle(e).zIndex, pos: getComputedStyle(e).position }); e = e.parentElement; }
    return { up: up, z: getComputedStyle(q).zIndex, onBody: q.parentElement === document.body,
      cnt: document.querySelectorAll('.tn-quotes').length };
  });
  ok('L20 页面上 .tn-quotes 只有 1 份（insertAdjacentHTML 住在 buildUI 的守卫里，重复开屏不许再插一层）', !st.none && st.cnt === 1, st.none ? '整块没数到' : '实得 ' + st.cnt + ' 份');
  if (st.none) { say('❗ #tnQuotes 整块没数到——搬层的判据落空'); quoteErrs = errs.length; await page.close(); return; }
  ok('L21 #tnQuotes 直接住 body（改前它住在 .tn-foot 里，父级建了堆叠上下文，孩子的 9005 出不去）', st.onBody, st.up.map(u => u.label).join(' → '));
  ok('L22 computed z-index 仍是 9005（抬的不是数字，是它参加排序的那一层）', st.z === '9005', '现场 z=' + st.z);
  ok('L23 祖先链里再没有 .tn-foot / .tn-seg（链上只剩 body、html）', !st.up.slice(1).some(u => /tn-foot|tn-seg|tn-panel/.test(u.cls)), st.up.map(u => u.label + '(z=' + u.z + ')').join(' → '));

  await page.evaluate(function () { var b = document.getElementById('tnQuote'); if (b) b.click(); });
  await waitShown(page, '#tnQuotes'); await settle(page, 400);
  const open = await page.evaluate('getComputedStyle(document.getElementById("tnQuotes")).display');
  ok('L24 点「追加名言」之后浮层真的铺开（触发钮留在 .tn-foot 里、浮层在 body 上，两头都得接住）', open === 'flex', 'display=' + open);

  const hint = await page.evaluate(function () {
    const h = document.getElementById('tnQuoteHint');
    return h ? h.textContent : 'no-el';
  });
  ok('L25 #tnQuoteHint 写到了当前地点（$X(qq,…) 四处改线的第一处证据，打空就是 no-el）', hint.indexOf('云冈石窟') >= 0, '「' + hint.slice(0, 30) + '」');

  const reachOf = async function (sel) {
    const r = await page.evaluate(function (s) { return window.__L.reach(s); }, sel);
    if (r.miss) return r;
    if (!r.ok) printChain(await page.evaluate((x, y, n) => window.__L.chain(x, y, n), r.rect.cx, r.rect.cy, 5));
    return r;
  };
  const e26 = await reachOf('#tnQuoteClear');
  ok('L26 #tnQuoteClear 中心点顶命中自己（改前那一点落在背后的 button#tnTabExp 上）', !e26.miss && e26.ok, e26.miss ? '没数到这个元素' : e26.rect.w + '×' + e26.rect.h + ' 顶命中=' + e26.hit);
  const e27 = await reachOf('#tnQuoteBack');
  ok('L27 #tnQuoteBack 中心点顶命中自己（收起这一层的唯一屏上出口，点不到就出不去）', !e27.miss && e27.ok, e27.miss ? '没数到这个元素' : e27.rect.w + '×' + e27.rect.h + ' 顶命中=' + e27.hit);
  const e28 = await reachOf('#tnQuoteSearch');
  ok('L28 #tnQuoteSearch 中心点顶命中自己（输入框在整条 .sr 行里，那一行从前也被档位条压着）', !e28.miss && e28.ok, e28.miss ? '没数到这个元素' : e28.rect.w + '×' + e28.rect.h + ' 顶命中=' + e28.hit);

  /* 反证照 33-B：清框之前先污染搜索框，再真鼠标点清钮中心。
     改前那一点会同时干三件错事：框没清、背后的「记开销」档被切走、浮层还在但已经是别人的世界了。 */
  await page.evaluate(function () {
    const q = document.getElementById('tnQuoteSearch');
    if (q) { q.value = '云冈'; q.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  const polluted = await page.evaluate(function () {
    const q = document.getElementById('tnQuoteSearch');
    return { v: q ? q.value : 'gone', n: document.querySelectorAll('#tnQuoteList > *').length };
  });
  say('  · 污染之后（点之前）：搜索框=「' + polluted.v + '」 结果条数=' + polluted.n);
  const cc = await page.evaluate(function () {
    const e = document.getElementById('tnQuoteClear');
    return e ? window.__L.rect(e) : null;
  });
  let after = { value: 'no-rect', expOn: true, panelExpense: true, quotesShown: false };
  if (cc) {
    await page.mouse.click(cc.cx, cc.cy);
    await settle(page, 450);
    after = await page.evaluate(function () {
      const q = document.getElementById('tnQuoteSearch');
      const exp = document.getElementById('tnTabExp');
      const pn = document.querySelector('.tn-panel');
      const qq = document.getElementById('tnQuotes');
      return { value: q ? q.value : 'layer-gone',
        expOn: !!(exp && exp.classList.contains('on')),
        panelExpense: !!pn && pn.classList.contains('is-expense'),
        quotesShown: !!qq && getComputedStyle(qq).display !== 'none' };
    });
  }
  ok('L29 真鼠标点清钮中心之后搜索框清空', after.value === '', 'value=「' + after.value + '」');
  ok('L30 同一次点击没有把档位切到「记开销」（改前那一点落在背后的 #tnTabExp 上）', !after.expOn && !after.panelExpense, JSON.stringify(after));
  ok('L31 同一次点击之后浮层还开着（清钮不是关钮，别把这一层顺手关掉）', after.quotesShown, 'quotesShown=' + after.quotesShown);

  const bk = await page.evaluate(function () {
    const e = document.getElementById('tnQuoteBack');
    return e ? window.__L.rect(e) : null;
  });
  let back = { quotes: 'no-rect', panel: 'no-rect', pre: 'no-rect' };
  if (bk) {
    /* 点之前先把面板按进幕内。浮层住 body 且整屏不透明，开着的时候面板其实从没被藏过，
       所以「返回钮把 panel 恢复成 flex」这一句在本页是恢复、不是装饰：不先造出被藏的那个状态，
       下面读到的 flex 就是它本来就有的样子，这条判据等于没跑（变异自测 U05 第一次就栽在这里）。 */
    const pre = await page.evaluate(function () {
      const pn = document.querySelector('.tn-panel');
      if (!pn) return 'gone';
      pn.style.display = 'none';
      return getComputedStyle(pn).display;
    });
    await page.mouse.click(bk.cx, bk.cy);
    await settle(page, 450);
    const aft = await page.evaluate(function () {
      const qq = document.getElementById('tnQuotes');
      const pn = document.querySelector('.tn-panel');
      return { quotes: qq ? getComputedStyle(qq).display : 'gone', panel: pn ? getComputedStyle(pn).display : 'gone' };
    });
    back = { pre: pre, quotes: aft.quotes, panel: aft.panel };
  }
  ok('L32 真鼠标点返回钮之后浮层收起（display=none）', back.quotes === 'none', 'display=' + back.quotes);
  ok('L33 真鼠标点返回钮之后面板回到台前（点前先把它按进幕内，否则这条读的是它本来就有的样子）', back.pre === 'none' && back.panel === 'flex', '点前=' + back.pre + '／点后=' + back.panel);

  /* 追加整链路：结果项也住在那一层里，真点得到才说明搬层搬对了 */
  await page.evaluate(function () { document.getElementById('tnQuote').click(); });
  await waitShown(page, '#tnQuotes'); await settle(page, 400);
  const lenBefore = await page.evaluate(function () {
    const ta = document.querySelector('.tn-panel textarea') || document.getElementById('tnText');
    return ta ? (ta.value || '').length : -1;
  });
  const it = await page.evaluate(function () {
    var e = document.querySelector('#tnQuoteList > *');
    if (!e) return { miss: true };
    var r = window.__L.rect(e);
    var hit = document.elementFromPoint(r.cx, r.cy);
    return { r: r, hit: window.__L.label(hit), text: (e.textContent || '').slice(0, 14),
      ok: !!hit && (hit === e || e.contains(hit) || hit.contains(e)) };
  });
  ok('L34 浮层里的结果项中心点顶命中自己', !it.miss && it.ok, it.miss ? '#tnQuoteList 里没有结果项' : it.r.w + '×' + it.r.h + ' 顶命中=' + it.hit);
  let ap = { disp: 'no-item', len: -1, flash: '' };
  if (!it.miss && it.ok) {
    await page.mouse.click(it.r.cx, it.r.cy);
    await settle(page, 400);
    ap = await page.evaluate(function () {
      const q = document.getElementById('tnQuotes');
      const ta = document.querySelector('.tn-panel textarea') || document.getElementById('tnText');
      const fl = document.querySelector('.tn-flash');
      return { disp: q ? getComputedStyle(q).display : 'gone',
        len: ta ? (ta.value || '').length : -1,
        flash: fl ? (fl.textContent || '') : 'no-el' };
    });
  }
  ok('L35 真点结果项追加之后浮层收起（appendQuote 那一支改的是 body 上这一层的 display）', ap.disp === 'none', 'display=' + ap.disp);
  ok('L36 追加之后正文真的变长了', ap.len > lenBefore, '正文长度 ' + lenBefore + ' → ' + ap.len);
  ok('L37 追加之后的浮层提示说的是「已追加名言」', ap.flash.indexOf('已追加名言') === 0, '「' + ap.flash.slice(0, 20) + '」');
  say('  腿② 未捕获报错：' + errs.length + ' 条' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  quoteErrs = errs.length;
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
    ok('L38 两条腿全程 0 条页面未捕获报错', barErrs + quoteErrs === 0, '腿① ' + barErrs + ' 条／腿② ' + quoteErrs + ' 条');
    ok('L39 判据条数 ≥ 38（这一节自己也是会被删的）', checks >= 38, 'checks=' + checks);
  } catch (e) {
    say('FATAL: ' + (e && e.message));
    say((e && e.stack || '').split('\n').slice(0, 6).join('\n'));
    ok('L40 两条腿跑完没有抛出（抛在中间＝后面的判据一条都没执行）', false, String(e && e.message).slice(0, 90));
  } finally {
    /* 收工行要在 dump 之前进 lines：落盘那份读数就是判据本身，缺了「共 N 项」等于证据断了尾。 */
    say((fails ? 'FAIL' : 'PASS') + '  共 ' + checks + ' 项，失败 ' + fails);
    dump();
    await browser.close();
    server.close();
  }
  process.exit(fails ? 1 : 0);
})();
