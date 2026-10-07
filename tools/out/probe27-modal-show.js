const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => TravelNotes.openList());
  await p.evaluate(() => {
    const btn = document.querySelector('#tnExpBtn');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  });
  for (const t of [0, 50, 300, 1200]) {
    if (t) await new Promise(r => setTimeout(r, t === 0 ? 0 : t));
    const out = await p.evaluate(() => {
      const m = document.querySelector('.ui-modal-mask');
      if (!m) return { mask: null };
      const mo = m.querySelector('.ui-modal'), x = m.querySelector('#tnExpX');
      const cs = getComputedStyle(mo), r = x.getBoundingClientRect();
      return {
        maskCls: m.className,
        transform: cs.transform,
        transition: cs.transition.slice(0, 60),
        xCss: getComputedStyle(x).width + 'x' + getComputedStyle(x).height,
        xRect: Math.round(r.width) + 'x' + Math.round(r.height),
        anims: (document.getAnimations ? document.getAnimations().length : -1),
        animNames: (document.getAnimations || []).length ? document.getAnimations().map(a => a.animationName || a.transitionProperty).slice(0, 5) : [],
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
      };
    });
    console.log('t=' + t + ' ' + JSON.stringify(out));
  }
  await b.close();
})();
