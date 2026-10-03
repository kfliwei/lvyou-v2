/* tools/audit-deadclicks.js — 全站"看得见但点不动"探针（puppeteer-core + 本机 Chrome）
 * 判据：页面加载后，对每个"长得像可点"的元素（button/a/[onclick]/.btn/.chip… 或 computed cursor:pointer）
 * 用 CDP DOMDebugger.getEventListeners 查它到底有没有 click/pointer/touch 处理器。
 * 另查：内联 onclick 里引用的全局函数是否真的存在（打字错误 / 已删函数留下的死按钮）。
 * 用法: node tools/audit-deadclicks.js [页面名 ...]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ALL = ['index.html', 'topic.html', 'explore-map.html', 'travel-map.html', 'search.html', 'wishlist.html',
  'review.html', 'settings.html', 'me.html', 'node-manager.html', 'album.html', 'album-edit.html',
  'story.html', 'planner.html', 'md-manager.html'];
const PAGES = process.argv.slice(2).filter(a => !a.startsWith('-'));
const LIST = PAGES.length ? PAGES : ALL;

const SEL = 'button,a[href],[onclick],[role="button"],[data-action],.btn,.chip,.tab,.seg,.mini,.card,.icon-btn,input[type=button],input[type=submit]';

function label(h) { return (h.tag + (h.id ? '#' + h.id : '') + (h.cls ? '.' + h.cls.split(' ').filter(Boolean).slice(0, 2).join('.') : '')).slice(0, 46); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const out = [];

  for (const pg of LIST) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 120)));
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {}
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    try {
      await page.goto('file:///' + path.join(ROOT, pg).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
      out.push({ page: pg, fatal: 'load failed: ' + e.message }); await page.close(); continue;
    }
    await new Promise(r => setTimeout(r, pg.indexOf('topic') >= 0 || pg === 'explore-map.html' ? 6000 : 3000));

    const caps = await page.evaluate(() => ({
      geolocation: !!navigator.geolocation, share: typeof navigator.share === 'function',
      clipboard: !!(navigator.clipboard && navigator.clipboard.writeText), notify: typeof window.Notification === 'function',
      speech: !!(window.SpeechRecognition || window.webkitSpeechRecognition), sw: 'serviceWorker' in navigator,
      secure: window.isSecureContext, aiKey: !!localStorage.getItem('tn_aiKey'), amapKey: !!(localStorage.getItem('tn_amap_key') || window.__TN_AMAP_KEY__),
      native: !!window.AndroidBridge || !!window.__gstNative
    }));

    const nodes = await page.evaluate((SEL) => {
      var seen = new Set(), list = [], arr = [];
      var SVG = { svg: 1, path: 1, g: 1, circle: 1, rect: 1, polygon: 1, line: 1, text: 1, tspan: 1, defs: 1, use: 1 };
      var INNER = 'div,span,li,label,tr,img,svg,path,td,h3,h4';
      function push(e, why) {
        if (SVG[e.tagName.toLowerCase()]) return;
        var host = e.closest && e.closest('button,a[href],[onclick],[role=button],.btn');
        if (host && host !== e) { if (SVG[host.tagName.toLowerCase()]) return; e = host; }
        if (seen.has(e)) return; seen.add(e);
        var tag = e.tagName.toLowerCase();
        if (SVG[tag]) return;
        var cs = getComputedStyle(e);
        var r = e.getBoundingClientRect();
        list.push({
          tag: tag, id: e.id || '', cls: (e.className && e.className.baseVal !== undefined ? '' : String(e.className || '')),
          text: (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 26),
          inline: e.getAttribute('onclick') || '', why: why,
          href: e.getAttribute('href') || '',
          lf: Object.keys(e).some(function (k) { return k.indexOf('_leaflet') === 0; }) ||
            !!(e.closest && e.closest('.leaflet-container,.lod-cl,.leaflet-marker-icon,.cal-cell,.story-item')),
          vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled,
          w: Math.round(r.width), hgt: Math.round(r.height),
          off: r.right <= 0 || r.left > (window.innerWidth || 390) || r.left + r.width > (window.innerWidth || 390) + 2
        });
        arr.push(e);
      }
      document.querySelectorAll(SEL).forEach(e => push(e, 'class/attr'));
      document.querySelectorAll(INNER).forEach(e => {
        if (getComputedStyle(e).cursor === 'pointer') push(e, 'cursor');
      });
      window.__AUD = arr;
      return { list: list, total: document.querySelectorAll('*').length };
    }, SEL);

    const cdp = await page.createCDPSession();
    const listenersOf = async (expr) => {
      const h = await cdp.send('Runtime.evaluate', { expression: expr, objectGroup: 'aud' }).catch(() => null);
      if (!h || !h.result || h.result.subtype !== 'node') return null;
      const ls = await cdp.send('DOMDebugger.getEventListeners', { objectId: h.result.objectId, depth: 0 }).catch(() => ({ listeners: [] }));
      return (ls.listeners || []).map(l => l.type);
    };
    for (let idx = 0; idx < nodes.list.length; idx++) {
      const n = nodes.list[idx];
      if (!n.vis) continue;
      await cdp.send('Runtime.evaluate', { expression: '__AUDP=__AUD[' + idx + ']', objectGroup: 'aud' }).catch(() => null);
      for (let up = 0; up < 12; up++) {
        const types = await listenersOf('__AUDP');
        if (types === null) { n.probe = 'lost'; break; }
        const hit = types.some(t => ['click', 'pointerdown', 'pointerup', 'tap', 'touchstart', 'change'].indexOf(t) >= 0);
        if (up === 0) { n.lc = hit; n.types = types.slice(0, 6); }
        else if (hit) { n.deleg = true; break; }
        const goUp = await cdp.send('Runtime.evaluate', { expression: '__AUDP=__AUDP.parentElement?__AUDP.parentElement:__AUDP' }).catch(() => null);
        void goUp;
        const isBody = await cdp.send('Runtime.evaluate', { expression: '__AUDP===document.body||__AUDP===document.documentElement?1:0' }).catch(() => null);
        if (isBody && isBody.result && isBody.result.value === 1) break;
      }
    }

    const dead = nodes.list.filter(n => n.vis && !n.inline && !n.lf && !n.deleg && n.lc === false &&
      !(n.tag === 'a' && n.href && n.href !== '#' && n.href.indexOf('javascript') !== 0));
    const tiny = nodes.list.filter(n => n.vis && (n.w < 28 || n.hgt < 28) && (n.inline || n.lc));
    const offscreen = nodes.list.filter(n => n.vis && n.off);
    const inlineBad = await page.evaluate(() => {
      var bad = [];
      document.querySelectorAll('[onclick]').forEach(e => {
        var s = e.getAttribute('onclick') || '';
        var re = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*\(/g, m;
        while ((m = re.exec(s))) {
          var p = m[1].split('.'), o = window, ok = true;
          for (var i = 0; i < p.length; i++) { if (o == null || !(p[i] in o)) { ok = false; break; } o = o[p[i]]; }
          if (!ok || typeof o !== 'function') bad.push({ name: m[1], el: (e.id || e.tagName + '.' + String(e.className || '').split(' ')[0]), snip: s.slice(0, 60) });
        }
      });
      var seen = {}, u = [];
      bad.forEach(b => { if (!seen[b.name]) { seen[b.name] = 1; u.push(b); } });
      return u;
    });

    await cdp.detach().catch(() => {});
    await page.close();
    out.push({
      page: pg, clickable: nodes.list.filter(n => n.vis).length, scanned: nodes.list.length,
      dead: dead.map(n => ({ el: label(n), text: n.text, why: n.why })),
      deadN: dead.length, tinyN: tiny.length,
      tiny: tiny.map(n => ({ el: label(n), text: n.text, size: n.w + 'x' + n.hgt })).slice(0, 12),
      offscreen: offscreen.map(n => ({ el: label(n), text: n.text })),
      inlineBad: inlineBad, caps: caps, errs: errs.slice(0, 4)
    });
    console.log((pg + ' ').padEnd(22) + '可点外观 ' + String(nodes.list.filter(n => n.vis).length).padStart(4) +
      ' · 零绑定 ' + String(dead.length).padStart(3) + ' · 过小 ' + String(tiny.length).padStart(3) +
      ' · 屏外 ' + String(offscreen.length).padStart(2) + ' · 死引用 ' + inlineBad.length + ' · 报错 ' + errs.length);
  }

  await browser.close();
  const f = path.join(__dirname, 'out');
  try { fs.mkdirSync(f); } catch (e) {}
  fs.writeFileSync(path.join(f, 'deadclicks.json'), JSON.stringify(out, null, 1));
  console.log('\n→ tools/out/deadclicks.json');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
