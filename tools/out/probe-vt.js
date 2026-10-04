/* 探针：Chrome 里 View Transitions 到底哪些面可观测（为 smoke-motion 的断言挑锚点） */
const puppeteer = require('puppeteer-core');
const path = require('path'), http = require('http'), fs = require('fs');
const REAL = 'F:/MyAi/trace/lvyou-v2';
(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(REAL, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end('x'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8' : p.endsWith('.css') ? 'text/css' : 'text/javascript' });
      res.end(d);
    });
  });
  await new Promise(r => server.listen(8199, '127.0.0.1', r));
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
  await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'load' });
  const r = await pg.evaluate(() => {
    const out = {
      ua: navigator.userAgent.slice(-16),
      startVT: typeof document.startViewTransition,
      cssAtRules: typeof CSS.atRules,
      supportsVtn: CSS.supports('view-transition-name', 'search-field'),
    };
    try { out.has = CSS.atRules.has('view-transition'); } catch (e) { out.has = 'err:' + e.message; }
    const rules = [];
    for (const sh of document.styleSheets) {
      try {
        for (const ru of sh.cssRules || []) {
          const t = (ru.cssText || '');
          if (t.indexOf('view-transition') >= 0) rules.push(ru.constructor.name + ' :: ' + t.slice(0, 80));
        }
      } catch (e) { rules.push('读取失败 ' + e.message); }
    }
    out.rules = rules.slice(0, 8);
    out.heroVtn = getComputedStyle(document.querySelector('.hero__search')).viewTransitionName;
    out.rootNormal = getComputedStyle(document.documentElement).getPropertyValue('--motion-normal');
    const tst = document.createElement('div'); tst.className = 'ui-toast'; document.body.appendChild(tst);
    out.toastDur = getComputedStyle(tst).transitionDuration; tst.remove();
    const st = document.createElement('div'); st.className = 'fade-stagger';
    st.innerHTML = '<i></i><i></i><i></i>'; document.body.appendChild(st);
    out.stagger3 = getComputedStyle(st.children[2]).animationDelay;
    out.motionStep = getComputedStyle(document.documentElement).getPropertyValue('--motion-step');
    st.remove();
    out.reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  /* 跨文档导航：脚本发起的跳转是否照常到达（转场不许拦路） */
  await pg.evaluate(() => { location.href = 'topic.html'; });
  await new Promise(r => setTimeout(r, 1500));
  console.log('nav url=' + pg.url());
  const r2 = await pg.evaluate(() => {
    const el = document.querySelector('.topbar .search');
    const vt = [];
    for (const sh of document.styleSheets) {
      try { for (const ru of sh.cssRules || []) if (ru.constructor.name === 'CSSViewTransitionRule') vt.push(ru.cssText); } catch (e) {}
    }
    return { topicVtn: el ? getComputedStyle(el).viewTransitionName : 'no .search', designParsedVT: vt, title: document.title };
  });
  console.log(JSON.stringify(r2));

  /* 减动效档：同一套 CSS 在 reduce 下应当把 duration/delay 全压成 1e-05s */
  const pg2 = await b.newPage();
  await pg2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg2.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'load' });
  const r3 = await pg2.evaluate(() => {
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; };
    const tst = mk('ui-toast'), sk = mk('skeleton'), st = mk('fade-stagger');
    st.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
    const g = getComputedStyle(document.documentElement);
    return {
      reduced: matchMedia('(prefers-reduced-motion:reduce)').matches,
      uiMotion: window.UI ? UI.motionMs('normal', 999) : 'no UI',
      scroll: window.UI ? UI.scrollBehavior() : 'no UI',
      toastDur: getComputedStyle(tst).transitionDuration,
      skelAnim: getComputedStyle(sk).animationDuration + ' / ' + getComputedStyle(sk).animationIterationCount,
      stagger8: getComputedStyle(st.children[7]).animationDelay,
      htmlScroll: g ? getComputedStyle(document.documentElement).scrollBehavior : '',
      vtWrap: (function () { let n = 0; const o = document.startViewTransition; document.startViewTransition = function (f) { n++; return o.call(document, f); }; if (window.UI) UI.vt(function () {}); document.startViewTransition = o; return n; })()
    };
  });
  console.log('REDUCE ' + JSON.stringify(r3));
  await b.close(); server.close();
})();
