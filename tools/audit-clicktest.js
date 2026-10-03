/* tools/audit-clicktest.js — 全站"逐个点一遍"真实行为探针
 * 判据：每次点击前重载页面（干净起点），点击后 1.2s 内看四件事：
 *   ① 是否发生页面跳转  ② DOM 是否变化  ③ 是否弹出提示（toast/dialog）④ localStorage 是否写入
 *   四者全否 = "点了没反应"候选；期间 JS 报错 = "点了就崩"
 * 用一次性 user-data-dir，不污染日常浏览器；空库下破坏性按钮最多清掉空数据。
 * 用法: node tools/audit-clicktest.js [页面名 ...] [--max N]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ALL = ['index.html', 'topic.html', 'travel-map.html', 'search.html', 'wishlist.html', 'review.html',
  'settings.html', 'me.html', 'node-manager.html', 'album.html', 'album-edit.html', 'story.html',
  'planner.html', 'md-manager.html', 'explore-map.html'];
const argv = process.argv.slice(2);
const maxI = argv.indexOf('--max');
const MAX = maxI >= 0 ? parseInt(argv[maxI + 1], 10) : 26;
const positional = argv.filter((a, i) => !a.startsWith('--') && !(maxI >= 0 && i > maxI && i <= maxI + 1));
const LIST = positional.length ? positional : ALL;

const SNAP = `(function(){
  var t = document.querySelector('#toast,.toast,.tip,.snackbar,[role=status]');
  var vis = function(e){ if(!e) return false; var cs=getComputedStyle(e); return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>0.05; };
  var openDlg = !!document.querySelector('dialog[open]');
  var masks = 0; document.querySelectorAll('.mask,.modal,.overlay,#modalMask,.sheet,.dialog').forEach(function(e){ if(vis(e)) masks++; });
  return { url: location.href, len: (document.body.innerHTML||'').length,
    txt: (document.body.innerText||'').length, mu: (window.__mu|0),
    toast: vis(t) ? (t.innerText||'').trim().slice(0,40) : '',
    openDlg: openDlg, masks: masks, ls: JSON.stringify(window.localStorage), idb: '' };
})()`;

const CAND = 'button:not([type=file]),[onclick],[role=button],a.btn,.btn';

function labelOf(s) { return s.slice(0, 44); }

(async () => {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'audclick-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const report = [];

  for (const pg of LIST) {
    const url = 'file:///' + path.join(ROOT, pg).replace(/\\/g, '/');
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    page.on('dialog', d => d.accept().catch(() => {}));
    /* 首启引导遮罩 z-index 9990 高于所有面板——必须在文档加载前跳过，否则点击全打在遮罩上（假"无反应"） */
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
    const errBuf = [];
    page.on('pageerror', e => errBuf.push(e.message.slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') errBuf.push('console: ' + m.text().slice(0, 100)); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, pg.indexOf('topic') >= 0 || pg === 'explore-map.html' ? 5000 : 2200));

    const n = await page.evaluate(s => document.querySelectorAll(s).length, CAND);
    /* 漂移基线：不点任何东西，页面自身是否会改 DOM（懒加载数据/轮播/瓦片）——
       若会，则 DOM 长度变化不能当作"按钮有反应"的证据，只认 toast/弹窗/跳转/写入。 */
    let drifty = false;
    for (let k = 0; k < 2; k++) {
      const d1 = await page.evaluate(SNAP);
      await new Promise(r => setTimeout(r, 1400));
      const d2 = await page.evaluate(SNAP);
      if (d1.len !== d2.len || d1.txt !== d2.txt) drifty = true;
    }
    const openAll = () => page.evaluate(() => { document.querySelectorAll('details').forEach(function (d) { d.open = true; }); });
    await openAll();
    const take = Math.min(n, MAX);
    /* 均匀取样而非"只点前 N 个"，否则像设置页这种上半屏全是小 pill 的页面会漏掉真正的动作按钮 */
    const idxs = [];
    for (let k = 0; take > 0 && k < take; k++) idxs.push(n <= take ? k : Math.round(k * (n - 1) / (take - 1)));
    const uniqIdxs = idxs.filter((v, i) => idxs.indexOf(v) === i);
    const items = [];
    const settle = () => new Promise(r => setTimeout(r, pg.indexOf('topic') >= 0 || pg === 'explore-map.html' ? 4200 : 1800));
    const safe = (fn, dflt) => fn().catch(e => { if (dflt && typeof dflt === 'object') dflt.__fail = e.message; else dflt = { __fail: e.message }; return dflt; });
    for (const i of uniqIdxs) {
      errBuf.length = 0;
      /* 每次点击前重新导航到本页：起点一致，上一次点击造成的跳转不会串味 */
      await safe(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }), {});
      await settle();
      await openAll();
      const meta = await safe(() => page.evaluate((idx) => {
        var els = Array.prototype.slice.call(document.querySelectorAll('button:not([type=file]),[onclick],[role=button],a.btn,.btn'));
        var e = els[idx]; if (!e) return null;
        /* 盲区①修复：先滚到可视区再量——不滚动会把折叠线下元素误判成"被底栏遮挡" */
        try { e.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (err) {}
        var r = e.getBoundingClientRect(); var cs = getComputedStyle(e);
        return {
          text: (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 22),
          id: e.id || '', cls: String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'),
          tag: e.tagName.toLowerCase(), inline: !!e.getAttribute('onclick'),
          vis: r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden',
          disabled: !!e.disabled,
          offscreen: (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth),
          blocked: (function () {
            var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!top || top === e || e.contains(top) || top.contains(e)) return '';
            return top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (String(top.className || '').split(' ')[0] ? '.' + String(top.className || '').split(' ')[0] : '');
          })()
        };
      }, i), null);
      if (!meta || !meta.vis || meta.disabled) continue;
      if (meta.offscreen) { items.push({ i, el: labelOf(meta.tag + (meta.id ? '#' + meta.id : '') + (meta.cls ? '.' + meta.cls : '')), text: meta.text, outcome: 'offscreen', blocked: '', clicked: '-', toast: '', err: '' }); continue; }
      /* 盲区③修复：类名在等长按钮间切换时 innerHTML 总长不变（album-edit 版式键实测如此），
         长度判据看不见真反应——补一个 MutationObserver 计数器，属性级变化也算反应。 */
      await safe(() => page.evaluate('window.__mu=0; new MutationObserver(function(ms){window.__mu+=ms.length;}).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true}); "ok"'), {});
      const before = await safe(() => page.evaluate(SNAP), { url: '?', len: -1, txt: -1, toast: '', ls: '', masks: 0, mu: 0 });
      const clicked = await safe(() => page.evaluate((idx) => {
        var els = Array.prototype.slice.call(document.querySelectorAll('button:not([type=file]),[onclick],[role=button],a.btn,.btn'));
        if (!els[idx]) return 'gone';
        try { els[idx].click(); return 'ok'; } catch (e) { return 'throw:' + e.message; }
      }, i), { __fail: 1 });
      await new Promise(r => setTimeout(r, 1400));
      let after = await safe(() => page.evaluate(SNAP), null);
      const detached = !after;
      if (detached) after = { url: 'DETACHED', len: 0, txt: 0, toast: '', ls: '', masks: 0, mu: 0 };
      const jumped = detached || after.url !== before.url;
      const domChanged = !jumped && (after.len !== before.len || after.txt !== before.txt || after.mu > before.mu);
      const said = !jumped && !!after.toast && after.toast !== before.toast;
      const dlg = !jumped && (after.openDlg || after.masks > before.masks);
      const wrote = !jumped && after.ls !== before.ls;
      const strong = jumped || said || wrote || dlg;
      const errs = errBuf.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|tile|User denied|NotAllowedError/i.test(e));
      items.push({
        i, el: labelOf(meta.tag + (meta.id ? '#' + meta.id : '') + (meta.cls ? '.' + meta.cls : '')), text: meta.text,
        outcome: errs.length ? 'error' : jumped ? 'nav' : strong ? 'reacted'
          : domChanged ? (drifty ? 'unclear' : 'reacted') : (meta.blocked ? 'blocked' : 'noop'),
        blocked: meta.blocked || '',
        clicked: clicked === 'ok' ? 1 : String(clicked), toast: said ? after.toast : '', err: errs[0] || ''
      });
    }
    await page.close();
    /* 盲区②修复：被遮/出屏单独计数，不再混进"无反应"——否则同一批元素被计两次，数字不可信 */
    const noop = items.filter(x => x.outcome === 'noop');
    const blocked = items.filter(x => x.outcome === 'blocked');
    const offscr = items.filter(x => x.outcome === 'offscreen');
    const bad = items.filter(x => x.outcome === 'error');
    report.push({ page: pg, tried: items.length, noop: noop, errors: bad, items: items });
    console.log((pg + ' ').padEnd(20) + '实点 ' + String(items.length).padStart(3) +
      ' · 无反应 ' + String(noop.length).padStart(3) + ' · 被遮 ' + String(blocked.length).padStart(3) +
      ' · 出屏 ' + String(offscr.length).padStart(3) + ' · 报错 ' + String(bad.length).padStart(2));
  }

  await browser.close();
  try { fs.mkdirSync(path.join(__dirname, 'out')); } catch (e) {}
  fs.writeFileSync(path.join(__dirname, 'out', 'clicktest.json'), JSON.stringify(report, null, 1));
  console.log('\n→ tools/out/clicktest.json');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
