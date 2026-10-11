/* tools/smoke-story-map.js — 批次 38-C 浏览器腿：旅程叙事顶部那张地图进屏该给什么
 *
 * 用户问（逐字，2026-10-11）：「旅程叙事上面的地图要展示什么？」
 * 地基实测读数在 tools/out/b38-probe-album-story.txt 的 D 段：改前是「讲到哪画到哪」——
 * 进屏那一刻只有 1 个点、0 条线，视野锁死在第一站，另一座城完全不在屏上；
 * 每翻一页 flyTo 还把缩放档抬到 ≥10，全程要翻到末站才第一次看见。
 * 这一腿验修好之后的现场：全程点线进屏就在、视野框住两座城、翻页只讲「现在到哪」不再跳图。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-story-map.js
 * 口径：328×723 dpr2；每腿独立 IndexedDB（createBrowserContext）；证据由脚本自己写盘。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const LOG = path.join(ROOT, 'tools', 'out', 'b38-smoke-story-map.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const out = [];
let fails = 0, total = 0;
const ERRS = [];
function say(s) { out.push(s); console.log(s); }
function ok(id, name, cond, extra) {
  total++;
  say((cond ? 'PASS  ' : 'FAIL  ') + id + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T09:00:00+08:00').getTime();
function dd(i, site, lat, lng, city) {
  const ts = T0 + i * D;
  return {
    id: 'm38_' + site, title: site + '·记', siteName: site, siteIndex: -1,
    lat: lat, lng: lng, ts: ts, date: new Date(ts).toISOString().slice(0, 10), day: '',
    province: '山西', city: city, county: '',
    raw: '正文·' + site, text: '正文·' + site, style: 'plain', photos: [], audio: '', tags: []
  };
}
const DAT = [
  dd(0, '云冈石窟', 40.032, 113.135, '大同'),
  dd(1, '华严寺', 40.091, 113.259, '大同'),
  dd(2, '大同博物馆', 40.083, 113.310, '大同'),
  dd(3, '晋祠', 37.712, 112.455, '太原'),
  dd(4, '山西博物院', 37.869, 112.449, '太原')
];

async function seed(browser, rows) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => ERRS.push('pageerror: ' + String(e.message).slice(0, 120)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(U('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear(); rs.forEach(function (r) { os.put(r); });
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
  await page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) {
    return window.TravelNotes && TravelNotes.list().length === n;
  }, { timeout: 25000, polling: 150 }, rows.length).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.story-card') || document.querySelector('.story-empty'),
    { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1500);
  return { ctx, page };
}

/* 地图那一屏的现场读数：点数 / 线段（含颜色与虚实）/ 视野 / 缩放 / 当前站 */
const READ = function () {
  const marks = Array.prototype.slice.call(document.querySelectorAll('#storyMap .leaflet-marker-icon'));
  const lines = Array.prototype.slice.call(document.querySelectorAll('#storyMap path.leaflet-interactive'));
  const m = window.map;
  const cards = Array.prototype.slice.call(document.querySelectorAll('.story-card'));
  return {
    notes: window.TravelNotes ? TravelNotes.list().length : -1,
    cards: cards.length,
    markers: marks.length,
    markerMax: Math.max.apply(null, marks.map(function (e) { return Math.round(e.getBoundingClientRect().width); }).concat([0])),
    polylines: lines.length,
    segs: lines.map(function (e) { return (e.getAttribute('stroke') || '').toLowerCase() + '/' + (e.getAttribute('stroke-dasharray') || 'solid'); }),
    zoom: m ? m.getZoom() : -1,
    bounds: m ? [m.getBounds().getSouth(), m.getBounds().getNorth(), m.getBounds().getWest(), m.getBounds().getEast()] : [],
    active: cards.findIndex(function (e) { return e.classList.contains('active'); }),
    navSub: ((document.querySelector('#snSub') || {}).textContent || '').trim(),
    skip: ((document.querySelector('.sc-skip') || {}).textContent || '').trim(),
    empty: !!document.querySelector('.story-empty')
  };
};
const inView = (b, p) => p[0] >= b[0] && p[0] <= b[1] && p[1] >= b[2] && p[1] <= b[3];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 38-C 浏览器腿：旅程叙事顶部地图＝全程可见 + 当前站跟读（328×723）===');

  const A = await seed(browser, DAT);
  const s0 = await A.page.evaluate(READ);
  ok('S00', '种子自校准：5 篇全带坐标', s0.notes === 5 && s0.cards === 5, '游记 ' + s0.notes + ' 篇，卡片 ' + s0.cards + ' 张');
  ok('S01', '进屏就有 5 枚站点标记（改前只有 1 枚）', s0.markers === 5, '标记 ' + s0.markers + ' 枚');
  ok('S02', '进屏就有 4 段连线（改前 0 段）', s0.polylines === 4, '折线 ' + s0.polylines + ' 段 ' + JSON.stringify(s0.segs));
  /* 进屏时还没有「走过的路」：当前站在第一站，任何一段都还没讲到。所以这一档全是虚线，
     一条实线都不该有。（改前判据写成「第一段已实」是把「讲到哪亮到哪」理解成了「第一站已讲完」。） */
  ok('S03', '进屏这一档零实线：城内三段都还是淡陶土虚线，等讲到才亮', s0.segs[0] === '#ae5738/6 6' && s0.segs.filter(function (x) { return x === '#ae5738/solid'; }).length === 0, '第一段 ' + s0.segs[0] + '，实线 ' + s0.segs.filter(function (x) { return x === '#ae5738/solid'; }).length + ' 段');
  ok('S04', '跨城那一段（大同→太原）不画成走过的路：灰 + 点线', s0.segs[2].indexOf('#9c9a92') === 0 && s0.segs[2] !== '#ae5738/solid', '第三段 ' + s0.segs[2]);
  ok('S05', '没讲到的城内段用淡陶土虚线等着', s0.segs[3] === '#ae5738/6 6', '第四段 ' + s0.segs[3]);
  ok('S06', '视野框住两座城（太原两站在屏内）', inView(s0.bounds, [37.712, 112.455]) && inView(s0.bounds, [40.032, 113.135]),
    'bounds 南' + s0.bounds[0].toFixed(3) + ' 北' + s0.bounds[1].toFixed(3) + ' 西' + s0.bounds[2].toFixed(3) + ' 东' + s0.bounds[3].toFixed(3) + '，zoom ' + s0.zoom);
  ok('S07', '当前站那枚最大（≥16px）', s0.markerMax >= 16, '最大 ' + s0.markerMax + 'px');
  ok('S08', '底部条说清「第 1 / 5 站」', s0.navSub.indexOf('第 1 / 5 站') === 0, '读到「' + s0.navSub + '」');

  const z0 = s0.zoom;
  await A.page.click('#snNext');
  await sleep(900);
  const s1 = await A.page.evaluate(READ);
  ok('S09', '翻一站不改缩放档（不再 flyTo 抬到 ≥10）', s1.zoom === z0, 'zoom ' + z0 + ' → ' + s1.zoom);
  ok('S10', '翻一站后点数不减（全程还在屏上）', s1.markers === 5 && s1.polylines === 4, '标记 ' + s1.markers + '，折线 ' + s1.polylines);
  /* 讲到第 2 站＝只走完了「第 1 站 → 第 2 站」那一段：实线恰好 1 段，第 2 段仍要等下一次翻页。 */
  ok('S11', '讲到第二站：第一段转实，第二段仍虚，实线恰好一段', s1.segs[0] === '#ae5738/solid' && s1.segs[1] === '#ae5738/6 6' && s1.segs.filter(function (x) { return x === '#ae5738/solid'; }).length === 1, JSON.stringify(s1.segs));
  ok('S12', '当前站标记跟着换（激活第 2 张卡）', s1.active === 1 && s1.navSub.indexOf('第 2 / 5 站') === 0, 'active ' + s1.active + '，条「' + s1.navSub + '」');

  await A.page.evaluate(function () {
    const btn = document.getElementById('snNext');
    for (let i = 0; i < 10 && btn && !btn.disabled; i++) btn.click();
  });
  await sleep(1200);
  const s2 = await A.page.evaluate(READ);
  ok('S13', '翻到末站：全程四段都亮起来且缩放档仍是取景那一档', s2.segs.filter(function (x) { return x === '#ae5738/solid'; }).length === 3 && s2.zoom === z0,
    JSON.stringify(s2.segs) + '，zoom ' + z0 + ' → ' + s2.zoom);
  ok('S14', '末站仍看得见第一城（没有飞走）', inView(s2.bounds, [40.032, 113.135]), 'bounds 同 S06 口径');
  await A.ctx.close();

  /* ---------- 没坐标的那一篇要交代，不许静默消失 ---------- */
  const B = await seed(browser, DAT.slice(0, 3).concat([dd(5, '双塔寺', null, null, '太原')]));
  const b0 = await B.page.evaluate(READ);
  ok('S15', '四篇游记里 1 篇没坐标 → 卡片 3 张且屏上有一句说明', b0.cards === 3 && b0.skip === '另有 1 篇没填位置，不进路线', '卡 ' + b0.cards + '，说明「' + b0.skip + '」');
  await B.ctx.close();

  /* ---------- 只有 1 站：不许顶到最大缩放档 ---------- */
  const C = await seed(browser, DAT.slice(0, 1));
  const c0 = await C.page.evaluate(READ);
  ok('S16', '单站进屏：1 枚标记、0 段线、缩放停在可读的 10 档（改前顶到最大档，只剩一个点占满屏）',
    c0.markers === 1 && c0.polylines === 0 && c0.zoom === 10, '标记 ' + c0.markers + '，折线 ' + c0.polylines + '，zoom ' + c0.zoom);
  ok('S17', '单站时那一枚仍看得见（在视野内）', inView(c0.bounds, [40.032, 113.135]), 'bounds ' + JSON.stringify(c0.bounds.map(x => Number(x.toFixed(4)))));
  await C.ctx.close();

  /* ---------- 全空库：空态不报错（回归到 smoke-story 那四条之外的第五态） ---------- */
  const E = await seed(browser, []);
  const e0 = await E.page.evaluate(READ);
  ok('S18', '零游记时走空态而不是白屏', e0.empty === true, 'empty=' + e0.empty);
  await E.ctx.close();

  ok('S19', '全程零未捕获报错', ERRS.length === 0, ERRS.slice(0, 3).join(' | '));
  ok('S20', '本腿条数守卫（≥20 条）', total >= 20, '实际执行 ' + total + ' 条');

  await browser.close();
  say('');
  say(fails ? ('=== ' + fails + ' 项失败 ===') : '=== 全部通过 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
  process.exit(fails ? 1 : 0);
})().catch(e => {
  say('腿异常：' + e.message);
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(2);
});
