/* probe33-repolish.js —— 批次 33-B 的定点复查
   目的：抬完 44px 地板后，探针复量只剩 #tnQuote.tn-repolish 仍是 60×32。
   同一条 design.css:1469 规则体里的 .tn-pill / .tn-viewtab / .tg button 都吃到 44 了，
   所以这不是「规则没生效」，而是这一枚有别的出处在管。本脚本把 #tnQuote 的
   computed 读数 + 所有命中的 CSS 规则逐条打出来，坐实是谁盖的。
   用法：PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-repolish.js
   可选环境变量：PORT（默认 8179，换个端口就是换掉 SW 缓存的键） */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8179', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-repolish.txt'), lines.join('\n') + '\n'); }
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
        : p.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg' });
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
      st.put({ id: 's1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19,
        ts: new Date('2026-10-02T09:12:00+08:00').getTime(), date: '2026-10-02 09:12',
        day: '2026-10-02', text: '正文一', photos: [], audio: '', city: '大同' });
      tx.oncomplete = function () { resolve('seeded'); };
      tx.onerror = function () { resolve('seed-err:' + tx.error); };
    };
    r1.onerror = function () { resolve('idb-err'); };
  });
}

(async function () {
  const srv = staticServer();
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2'] });
  try {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
    await page.setCacheEnabled(false);
    page.on('pageerror', e => say('   页面报错：' + String(e.message).slice(0, 120)));
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(seedLocal);
    await page.evaluate(async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r => r.unregister()));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.UI && window.TravelNotes, { timeout: 15000 });
    await sleep(900);
    await page.evaluate(() => { TravelNotes.ensureUI();
      TravelNotes.openPanel({ label: '应县木塔', lat: 39.66, lng: 113.19, __i: 0 }); });
    await page.waitForFunction(() => { const e = document.querySelector('.tn-panel');
      return !!e && getComputedStyle(e).display !== 'none'; }, { timeout: 10000 });
    await sleep(700);

    const out = await page.evaluate(() => {
      const b = document.querySelector('#tnQuote');
      if (!b) return { missing: true };
      const cs = getComputedStyle(b);
      const rect = b.getBoundingClientRect();
      const hits = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { hits.push({ href: sheet.href, err: '读不到规则：' + e.name }); continue; }
        for (const r of rules) {
          if (!r.selectorText) continue;
          let m = false;
          try { m = b.matches(r.selectorText); } catch (e) { continue; }
          if (!m) continue;
          const s = r.style;
          const props = ['min-height', 'height', 'display', 'align-items', 'padding-top', 'padding-bottom', 'box-sizing', 'font-size', 'line-height', 'flex']
            .filter(p => s.getPropertyValue(p))
            .map(p => p + ':' + s.getPropertyValue(p) + (s.getPropertyPriority(p) ? '!' : ''));
          if (!props.length) continue;
          hits.push({ sel: r.selectorText, href: sheet.href || '（注入的 <style>）', props: props.join(' | ') });
        }
      }
      const parent = b.parentElement;
      return {
        rect: Math.round(rect.width) + '×' + Math.round(rect.height),
        computed: { minH: cs.minHeight, h: cs.height, disp: cs.display, padT: cs.paddingTop, padB: cs.paddingBottom,
          box: cs.boxSizing, fs: cs.fontSize, lh: cs.lineHeight },
        parentCls: parent ? parent.className + ' / display=' + getComputedStyle(parent).display
          + ' / alignItems=' + getComputedStyle(parent).alignItems : '?',
        // 命中的规则按「谁最终赢」的顺序排不出，全部列出，尺寸类属性逐条
        hits,
      };
    });
    say('· #tnQuote rect=' + out.rect + ' 父容器=' + out.parentCls);
    say('· computed：' + JSON.stringify(out.computed));
    say('· 命中规则 ' + out.hits.length + ' 条（只列带尺寸类声明的）：');
    out.hits.forEach(h => say('   [' + (h.href || '?') + '] ' + h.sel + '  →  ' + h.props));

    /* 反向对照：同一个 .tn-acts 里的 .tn-save 也在这族里，量它有没有 44（若 save 够高而 quote 不够，
       说明差别在「哪条规则只管 quote」，不在 .tn-acts 那一层） */
    const cmp = await page.evaluate(() => {
      const pick = sel => { const e = document.querySelector(sel); if (!e) return sel + '=不在场';
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return sel + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ' minH=' + cs.minHeight + ' disp=' + cs.display; };
      return ['.tn-save', '.tn-polish', '#tnPolish', '.tn-acts', '#tnQuote'].map(pick);
    });
    say('· 同族对照：' + JSON.stringify(cmp));
  } finally {
    say('\n=== probe33-repolish 跑完 ===');
    dump();
    await browser.close();
    srv.close();
  }
})().catch(e => { say('FATAL ' + e.message); dump(); process.exit(1); });
