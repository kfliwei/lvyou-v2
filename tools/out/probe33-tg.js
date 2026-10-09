/* probe33-tg.js — 批次 33-B 尾巴：时间线卡内动作行（.tn-item .tg）为什么每枚只有 35px 宽
 *
 * 33-B 把高度抬到 44 后，probe33-touch 腿① 仍标出 18 枚「低于地板」，全是
 * 「编辑/复制/卡片/MD/文档/删除」这六枚一排的宽度问题（真值 tools/out/b33-probe-33c-run.txt:47）。
 * 修法只有两种：给 min-width 让它换行，或横向滚动把两枚藏起来。选哪种得先看三件事的真读数：
 *   ① .tg 容器到底多宽（六枚 35 + 五条 gap 反推不出来，要看 offsetWidth）；
 *   ② 这族现在到底是谁的规则在生效（design.css:1023 与 travel-notes.js:464/465 两条都写着，
 *      flex-wrap 是逐条层叠的，不能想当然认为后写的覆盖了前写的）；
 *   ③ 六枚的文字各自多宽（= min-width:auto 撑出来的那个下限，换行后每行能坐几枚由它决定）。
 * 只读探针，不改产品码。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-tg.js \
 *        > tools/out/b33-probe-tg.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8181', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-tg.txt'), lines.join('\n') + '\n'); }
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
      var st = tx.objectStore('notes');
      st.clear();
      [{ id: 't1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
         ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12', day: '2026-10-02', text: '正文一', photos: [], audio: '' },
       { id: 't2', title: '悬空寺', siteName: '悬空寺', lat: 39.66, lng: 113.7,
         ts: new Date('2026-10-03T14:37:00+08:00').getTime(), date: '2026-10-03 14:37', day: '2026-10-03', text: '正文二', photos: [], audio: '' }
      ].forEach(function (n) { st.put(n); });
      tx.oncomplete = function () { db.close(); resolve('seeded-2'); };
      tx.onerror = function () { db.close(); resolve('notes-write-fail'); };
    };
    r1.onerror = function () { resolve('notes-open-fail'); };
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
  } catch (e) { say('   （4s 内有限动画没收尾，按现状继续读：' + e.message.slice(0, 60) + '）'); }
  await sleep(extra || 260);
}

async function waitShown(page, sel) {
  await page.waitForFunction(s => {
    const e = document.querySelector(s);
    return !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  }, { timeout: 10000 }, sel);
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
      return navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      });
    });
    await page.evaluate(seedLocal);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
    await settle(page, 500);

    await page.evaluate('TravelNotes.openList()');
    await waitShown(page, '.tn-list');
    await page.evaluate('var t=document.getElementById("tnViewTime");if(t)t.click();');
    await settle(page, 400);

    const geo = await page.evaluate(function () {
      var tgs = Array.from(document.querySelectorAll('.tn-list .tn-item .tg'));
      if (!tgs.length) return { none: true };
      var tg = tgs[0];
      var cs = getComputedStyle(tg);
      var kids = Array.from(tg.querySelectorAll('button')).map(function (b) {
        var r = b.getBoundingClientRect();
        var bc = getComputedStyle(b);
        var range = document.createRange();
        range.selectNodeContents(b);
        return {
          text: b.textContent.trim(),
          rect: Math.round(r.width) + '×' + Math.round(r.height),
          textW: Math.round(range.getBoundingClientRect().width),
          fontSize: bc.fontSize, padLR: bc.paddingLeft + '/' + bc.paddingRight,
          flex: bc.flex, minW: bc.minWidth, whiteSpace: bc.whiteSpace
        };
      });
      var item = tg.closest('.tn-item');
      var ir = item.getBoundingClientRect();
      return {
        count: tgs.length,
        tg: tg.getBoundingClientRect().width.toFixed(1),
        tgClientW: tg.clientWidth,
        itemW: ir.width.toFixed(1),
        display: cs.display, flexWrap: cs.flexWrap, gap: cs.gap, justify: cs.justifyContent,
        scrollW: tg.scrollWidth,
        kids: kids,
        sumKids: kids.reduce(function (a, k) { return a + parseFloat(k.rect); }, 0)
      };
    });
    say('· .tg 容器：宽度=' + geo.tg + '（clientW=' + geo.tgClientW + ' scrollW=' + geo.scrollW + '） 卡片宽=' + geo.itemW);
    say('  display=' + geo.display + ' flex-wrap=' + geo.flexWrap + ' gap=' + geo.gap + ' justify=' + geo.justify);
    say('  六枚宽度反推合计=' + geo.sumKids + '（+5×gap 应≈容器宽）');
    (geo.kids || []).forEach(function (k) {
      say('   ' + k.text + '  rect=' + k.rect + ' 纯文字宽=' + k.textW + ' font=' + k.fontSize + ' pad=' + k.padLR + ' flex=' + k.flex + ' min-width=' + k.minW);
    });

    /* 谁在生效：把两条规则体原文打出来，别按「后写的覆盖」猜——flex-wrap 是逐条层叠的 */
    const owners = await page.evaluate(function () {
      var out = [];
      Array.from(document.styleSheets).forEach(function (ss) {
        var rules = null;
        try { rules = ss.cssRules; } catch (e) { return; }
        if (!rules) return;
        Array.from(rules).forEach(function (r) {
          if (r.type !== 1) return;
          if (/\.tg(\s+button)?\b/.test(r.selectorText) && /tn-item/.test(r.selectorText)) {
            out.push({ sheet: (ss.ownerNode && ss.ownerNode.tagName) || '?', sel: r.selectorText, css: r.style.cssText.slice(0, 220) });
          }
        });
      });
      return out;
    });
    say('· 命中 .tg 族的规则（sheet=STYLE 表示 travel-notes.js 注入的那份）：');
    owners.forEach(function (o) { say('   ' + o.sheet + '  ' + o.sel + '  →  ' + o.css); });

    /* 换行试演：只在这个探针里临时注入 min-width，量「会不会变成两行、每行几枚、卡片长多高」
       ——不改产品码，为的是把版式代价先量出来再决定。 */
    const trial = await page.evaluate(function () {
      var st = document.createElement('style');
      st.textContent = 'body .tn-item .tg button{min-width:44px}';
      document.head.appendChild(st);
      var r = document.querySelector('.tn-list .tn-item .tg');
      var item = r.closest('.tn-item');
      var kids = Array.from(r.querySelectorAll('button'));
      var rows = {};
      kids.forEach(function (b) {
        var t = Math.round(b.getBoundingClientRect().top);
        rows[t] = (rows[t] || 0) + 1;
      });
      var out = {
        tgH: Math.round(r.getBoundingClientRect().height),
        itemH: Math.round(item.getBoundingClientRect().height),
        widths: kids.map(function (b) { return Math.round(b.getBoundingClientRect().width); }),
        rowsByTop: Object.keys(rows).length, perRow: Object.keys(rows).map(function (k) { return rows[k]; }),
        overflowX: r.scrollWidth > r.clientWidth + 1
      };
      st.remove();
      return out;
    });
    say('· 试演（临时 min-width:44px，不写进产品码）：行数=' + trial.rowsByTop + ' 每行枚数=' + JSON.stringify(trial.perRow)
      + ' 各枚宽=' + JSON.stringify(trial.widths) + ' .tg 高=' + trial.tgH + ' 卡片高=' + trial.itemH
      + ' 横向溢出=' + trial.overflowX);

    /* 卡片整高在 328 档会不会顶出屏幕：量「抬够 44 后」时间线一屏能看到几张卡 */
    const fit = await page.evaluate(function () {
      var items = Array.from(document.querySelectorAll('.tn-list .tn-item'));
      return { n: items.length, heights: items.map(function (e) { return Math.round(e.getBoundingClientRect().height); }),
               listH: Math.round(document.querySelector('.tn-list').getBoundingClientRect().height) };
    });
    say('· 卡片数=' + fit.n + ' 各自高=' + JSON.stringify(fit.heights) + '（视口 723，列表区高=' + fit.listH + '）');

    say('· 未捕获报错：' + errs.length + ' 条');
  } catch (e) {
    say('FATAL: ' + (e && e.message));
    say(String(e && e.stack).split('\n').slice(0, 5).join('\n'));
  } finally {
    dump();
    await browser.close();
    server.close();
  }
})();
