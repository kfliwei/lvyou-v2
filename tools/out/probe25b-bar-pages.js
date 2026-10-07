/* tools/out/probe25b-bar-pages.js — 把「顶栏一族」的量法补到 smoke-topbar 分母之外的页面
 *
 * 为什么需要：tools/smoke-topbar.js 的 BAR_PAGES 只有 13 页，topic.html / search.html /
 * album-edit.html / album.html / index.html 都不在名单里。K08（barH>70 只许 wishlist）
 * 因此从没量过专题页——像素闸门一跑就把漏网之鱼捞出来了：320/328 档 topic 的标题不再被
 * 压成「四川风…」，而是占满自然宽度，把「游记」那颗钮顶到第二行，顶栏从 63 涨到 ~108，
 * 地图可用区凭空少了 45 CSS px。这里用与 K08 同一把尺（.topbar 的 rect 高）逐页量一遍。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe25b-bar-pages.js
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || (function () {
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Chrome/Application/chrome.exe'];
  return c.find(f => fs.existsSync(f)) || '';
})();
const PAGES = ['topic.html', 'search.html', 'album.html', 'album-edit.html', 'index.html',
  'travel-map.html', 'wishlist.html', 'story.html', 'planner.html', 'trip.html', 'expense.html',
  'checklist.html', 'me.html', 'settings.html', 'node-manager.html', 'review.html',
  'explore-map.html', 'md-manager.html'];
const PROBE = `(() => {
  const bar = document.querySelector('.topbar') || document.querySelector('.nm-topbar') || document.querySelector('.story-bar');
  if (!bar) return { none: true };
  const r = bar.getBoundingClientRect();
  const rows = {};
  [].slice.call(bar.querySelectorAll('.t-row,.trow,a,button,select,input,.chip')).forEach(function (el) {
    const b = el.getBoundingClientRect();
    if (!b.height) return;
    const k = Math.round(b.top);
    rows[k] = (rows[k] || []).concat([(el.className || el.tagName) + ':' + Math.round(b.width) + 'x' + Math.round(b.height)]);
  });
  return { barH: Math.round(r.height), barBottom: Math.round(r.bottom),
    groups: Object.keys(rows).length, sample: Object.keys(rows).slice(0, 6).map(function (k) { return k + '→' + rows[k].slice(0, 5).join(','); }) };
})()`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  for (const w of [328, 320, 390]) {
    for (const f of PAGES) {
      const p = await browser.newPage();
      await p.setViewport({ width: w, height: Math.round(w * 2.2), deviceScaleFactor: 1 });
      await p.evaluateOnNewDocument(() => { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_planner_weather', '0'); });
      try {
        await p.goto('file:///' + (ROOT + '/' + f).replace(/\\/g, '/'), { waitUntil: 'load', timeout: 60000 });
        await new Promise(r => setTimeout(r, f === 'node-manager.html' ? 5200 : 2200));
        const b = await p.evaluate(PROBE);
        console.log(w + ' ' + f + '  ' + (b.none ? '无 .topbar' : 'barH=' + b.barH + ' 行组=' + b.groups + '  ' + b.sample.join(' | ').slice(0, 220)));
      } catch (e) {
        console.log(w + ' ' + f + '  读取失败：' + String(e.message).split('\n')[0].slice(0, 90));
      }
      await p.close();
    }
  }
  await browser.close();
})();
