/* probe33-ancestry.js — 批次 33-A 补测：名言检索层「点不到」的层叠根因
 * 上一轮（tools/out/b33-probe-run2.txt 行 15/19）实测：#tnQuoteClear 中心 (292,83) 的
 * elementFromPoint 是背后的 #tnTabExp，真鼠标点下去 → 搜索框没清空、面板跳到「记开销」档、名言层还开着。
 * 这一轮只回答两件事：
 *   ① 整条搜索行（含 #tnQuoteSearch 输入框）是不是都被盖住，还是只盖住右边那颗钮；
 *   ② 盖住它的层叠链是什么——候选假设：.tn-quotes 虽写 z-index:9005，但它是 .tn-body（position:relative;z-index:2）
 *      的后代，被父级层叠上下文困住，而 .tn-seg 自己 z-index:3 > 2，于是档条画在整层浮层之上。
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-ancestry.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8174', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-ancestry.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
}

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('x'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
      : p.endsWith('.css') ? 'text/css;charset=utf-8'
      : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
      : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} localStorage.setItem('tn_onboarded', '1'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.TravelNotes', { timeout: 20000 });
  await sleep(600);
  await page.evaluate('TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await page.waitForFunction(() => { const e = document.querySelector('.tn-panel');
    return !!e && getComputedStyle(e).display !== 'none'; }, { timeout: 10000 });
  await sleep(700);
  await page.evaluate('var q=document.getElementById("tnQuote");if(q)q.click();');
  await sleep(700);

  const r = await page.evaluate(function () {
    const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')
      + ((typeof e.className === 'string' && e.className) ? '.' + e.className.trim().split(/\s+/).join('.') : '');
    const stack = e => {
      const out = [];
      let n = e;
      while (n && n.nodeType === 1) {
        const cs = getComputedStyle(n);
        out.push({ node: desc(n).slice(0, 70), pos: cs.position, z: cs.zIndex,
          createsContext: (cs.position !== 'static' && cs.zIndex !== 'auto') || cs.transform !== 'none'
            || cs.opacity !== '1' || (cs.backdropFilter && cs.backdropFilter !== 'none')
            || cs.filter !== 'none',
          rect: (() => { const b = n.getBoundingClientRect();
            return Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + '×' + Math.round(b.height); })() });
        n = n.parentElement;
      }
      return out;
    };
    const probe = sel => {
      const e = document.querySelector(sel);
      if (!e) return { sel: sel, missing: true };
      const b = e.getBoundingClientRect();
      const pts = [];
      for (const fx of [0.15, 0.5, 0.85]) {
        const x = Math.round(b.left + b.width * fx), y = Math.round(b.top + b.height / 2);
        const t = document.elementFromPoint(x, y);
        pts.push({ at: x + ',' + y, top: t ? desc(t).slice(0, 46) : 'null',
          mine: !!t && (t === e || e.contains(t)) });
      }
      return { sel: sel, rect: Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + '×' + Math.round(b.height), pts: pts };
    };
    return {
      quotesDisplay: (() => { const e = document.getElementById('tnQuotes');
        return e ? getComputedStyle(e).display : 'missing'; })(),
      seg: probe('.tn-seg'),
      searchRow: probe('#tnQuotes .sr'),
      searchInput: probe('#tnQuoteSearch'),
      clearBtn: probe('#tnQuoteClear'),
      backBtn: probe('#tnQuoteBack'),
      quoteCard: probe('.tn-quote'),
      bodyAncestors: (() => { const e = document.getElementById('tnQuotes'); return e ? stack(e) : []; })(),
      segAncestors: (() => { const e = document.querySelector('.tn-seg'); return e ? stack(e) : []; })()
    };
  });

  say('名言层 display=' + r.quotesDisplay);
  ['seg', 'searchRow', 'searchInput', 'clearBtn', 'backBtn', 'quoteCard'].forEach(function (k) {
    const x = r[k];
    if (!x || x.missing) { say('· ' + k + '：不在场'); return; }
    say('· ' + k + ' rect=' + x.rect);
    x.pts.forEach(function (p) { say('    取点 ' + p.at + ' → 顶层=' + p.top + (p.mine ? '（自己的）' : '（别人的）')); });
  });
  say('');
  say('#tnQuotes 祖先链（谁创建层叠上下文）：');
  r.bodyAncestors.forEach(function (a) {
    say('  ' + (a.createsContext ? '[建上下文] ' : '             ') + a.node + '  pos=' + a.pos + ' z=' + a.z + '  ' + a.rect);
  });
  say('.tn-seg 祖先链：');
  r.segAncestors.forEach(function (a) {
    say('  ' + (a.createsContext ? '[建上下文] ' : '             ') + a.node + '  pos=' + a.pos + ' z=' + a.z + '  ' + a.rect);
  });
  dump();
  await browser.close();
  server.close();
})().catch(e => { say('探针异常：' + (e && e.stack || e)); dump(); process.exit(1); });
