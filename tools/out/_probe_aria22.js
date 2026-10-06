/* 一次性：批次 22 地基实测的浏览器腿（跑完即删）。落 tools/out/b22-probe-aria.txt
 * 要回答三件事，全部影响实施形状：
 *  ① 这版 Leaflet 给 divIcon 标记生出来的 DOM 到底带不带 tabindex / role / alt（决定「aria-label 自己给」这句是否成立）；
 *  ② 默认焦点环（design.css 的 :focus-visible）在真机档 452×995 上量不量得到（决定本批要不要上 tabindex）；
 *  ③ page.accessibility.snapshot() 在这个 puppeteer 版本里能不能拿到 accessible name（决定 smoke-aria 的快照口径可不可用）。
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8188', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const L = [];
const say = s => { L.push(s); process.stdout.write(s + '\n'); };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_layer', 'amapStreet'); } catch (e) {}
  });
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });

  /* ① topic.html 的标记 DOM */
  await page.goto(BASE + '/topic.html?p=nation', { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => say('goto 异常: ' + e.message.slice(0, 60)));
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-marker-icon').length > 0, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  const mk = await page.evaluate(() => {
    const a = Array.prototype.slice.call(document.querySelectorAll('.leaflet-marker-icon'));
    const one = a[0];
    return {
      n: a.length,
      tag: one ? one.tagName : '',
      cls: one ? one.className : '',
      tabindex: a.map(e => e.getAttribute('tabindex')).slice(0, 6),
      role: a.map(e => e.getAttribute('role')).slice(0, 6),
      alt: a.map(e => e.getAttribute('alt')).slice(0, 6),
      ariaLabel: a.map(e => e.getAttribute('aria-label')).slice(0, 6),
      html: one ? one.outerHTML.slice(0, 260) : '',
      inner: one ? (one.innerHTML || '').slice(0, 160) : '',
    };
  });
  say('=== ① topic.html（nation 档）divIcon 标记 DOM ===');
  say('标记数：' + mk.n + '  首枚 tagName=' + mk.tag + '  class=' + mk.cls);
  say('  tabindex 前 6：' + JSON.stringify(mk.tabindex) + '  role：' + JSON.stringify(mk.role) + '  alt：' + JSON.stringify(mk.alt) + '  aria-label：' + JSON.stringify(mk.ariaLabel));
  say('  outerHTML：' + mk.html);
  say('  innerHTML：' + mk.inner);
  /* 聚合层与节点层各看一遍：胶囊层是 .lod-cl，节点是 .tr-node */
  const kinds = await page.evaluate(() => {
    const a = Array.prototype.slice.call(document.querySelectorAll('.leaflet-marker-icon'));
    const g = {};
    a.forEach(e => {
      const k = e.querySelector('.lod-cl') ? 'cluster' : (e.querySelector('.tr-node') ? 'node' : (e.querySelector('.map-pin') ? 'pin' : 'other'));
      g[k] = (g[k] || 0) + 1;
    });
    return g;
  });
  say('  按形态分类：' + JSON.stringify(kinds));

  /* ② 焦点环：程序 focus 与 Tab 键盘 focus 两种都要量（:focus-visible 只在后者一定命中） */
  const ring1 = await page.evaluate(() => {
    const e = document.querySelector('.leaflet-marker-icon');
    if (!e) return { err: '无标记' };
    e.setAttribute('tabindex', '0');      /* 探针临时加，只为量「加了 tabindex 之后焦点环长什么样」 */
    e.focus();
    const st = getComputedStyle(e);
    return { active: document.activeElement === e, outline: st.outlineWidth + ' ' + st.outlineStyle + ' ' + st.outlineColor, fv: e.matches(':focus-visible') };
  });
  say('=== ② 焦点环（程序 focus + 临时 tabindex=0）===');
  say('  ' + JSON.stringify(ring1));
  await page.keyboard.press('Tab');
  const ring2 = await page.evaluate(() => {
    const e = document.activeElement;
    const st = getComputedStyle(e);
    return { tag: e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''), outline: st.outlineWidth + ' ' + st.outlineStyle + ' ' + st.outlineColor, fv: e.matches(':focus-visible') };
  });
  say('  Tab 一次后落点与环：' + JSON.stringify(ring2));
  /* 顺序 Tab 八次，看焦点走到哪（判断「列表→标记→弹层」这条 Tab 序现状） */
  const seq = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => {
      const e = document.activeElement;
      return (e.tagName || '').toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '');
    }));
  }
  say('  连按 Tab 的焦点序列：' + seq.join(' → '));

  /* ③ 快照可用性与当前 accessible name */
  let snapInfo = '';
  try {
    const snap = await page.accessibility.snapshot();
    const flat = [];
    (function walk(n, d) { if (!n) return; if (flat.length < 40) flat.push('  '.repeat(Math.min(d, 4)) + n.role + (n.name ? ' "' + n.name.slice(0, 40) + '"' : '')); (n.children || []).forEach(c => walk(c, d + 1)); })(snap, 0);
    snapInfo = '快照节点数(前 40 条已列)\n' + flat.join('\n');
  } catch (e) { snapInfo = 'page.accessibility.snapshot 不可用：' + String(e.message).slice(0, 120); }
  say('=== ③ accessibility.snapshot ===');
  say(snapInfo);

  /* 日卡侧现状：planner 结果页的容器与卡 */
  const planner = await browser.newPage();
  planner.on('pageerror', e => errs.push('planner: ' + String(e.message).slice(0, 90)));
  await planner.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await planner.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  await planner.goto(BASE + '/planner.html', { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => say('planner goto 异常: ' + e.message.slice(0, 50)));
  const rb = await planner.evaluate(() => {
    const b = document.getElementById('resultBody');
    return b ? { children: b.children.length, role: b.getAttribute('role'), own: b.outerHTML.slice(0, 120) } : { missing: true };
  });
  say('=== ④ planner #resultBody 现状：' + JSON.stringify(rb));
  const dc = await planner.evaluate(() => {
    const e = document.querySelector('.day-card');
    if (!e) return null;
    const cs = getComputedStyle(e.parentNode);
    return { parentTag: e.parentNode.tagName, parentDisplay: cs.display, role: e.getAttribute('role'), label: e.getAttribute('aria-label') };
  });
  say('  日卡（若有）：' + JSON.stringify(dc));

  say('未捕获页面异常：' + (errs.length ? errs.join(' | ') : '0 条'));
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(__dirname, 'b22-probe-aria.txt'), L.join('\n') + '\n', 'utf8');
  say('证据落盘 tools/out/b22-probe-aria.txt');
})().catch(e => { say('探针失败: ' + e.stack); fs.writeFileSync(path.join(__dirname, 'b22-probe-aria.txt'), L.join('\n') + '\n', 'utf8'); process.exit(1); });
