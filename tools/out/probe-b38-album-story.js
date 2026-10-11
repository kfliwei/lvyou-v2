/* tools/out/probe-b38-album-story.js — 批次 38-A 地基实测探针（只读产品码，不改）
 *
 * 用户报（逐字，2026-10-11）：「我去了大同和太原，旅行图册只显示大同。旅程叙事上面的地图要展示什么？」
 * 这个探针要回答两件事，且都要现场读数，不许照代码注释写：
 *   ① 图册里「只有大同」到底是哪一手造成的：
 *      A 腿＝册子生成过一次之后就不再重算（新写的游记进不了册）；
 *      B 腿＝即便重算，封面那个地名取的是「篇数最多的一座城市」，另一座在封面上根本没有位置；
 *      C 腿＝重算之后太原的内容（章节 / 路线插页 / 统计）到底在不在。
 *   ② 旅程叙事顶部那张地图，进屏那一刻画了什么、翻到最后一站又画了什么（点 / 线 / 视野 / 是否看得见另一座城）。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe-b38-album-story.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = path.join(ROOT, 'tools', 'out', 'b38-probe-album-story.txt');

const out = [];
function say(s) { out.push(s); console.log(s); }

const D = 24 * 3600 * 1000;
const T0 = new Date('2026-09-28T09:00:00+08:00').getTime();

/* 大同 3 篇 + 太原 2 篇：连续 5 天，间隔都 ≤3 天 ⇒ 应算同一趟旅程 */
function dd(i, site, lat, lng, city) {
  const ts = T0 + i * D;
  return {
    id: 'p38_' + site, title: site + '·记', siteName: site, siteIndex: -1,
    lat: lat, lng: lng, ts: ts,
    date: new Date(ts).toISOString().slice(0, 10), day: '',
    province: '山西', city: city, county: '',
    raw: '正文·' + site, text: '正文·' + site, style: 'plain',
    photos: [], audio: '', tags: []
  };
}
const DAT = [
  dd(0, '云冈石窟', 40.032, 113.135, '大同'),
  dd(1, '华严寺', 40.091, 113.259, '大同'),
  dd(2, '大同博物馆', 40.083, 113.310, '大同'),
  dd(3, '晋祠', 37.712, 112.455, '太原'),
  dd(4, '山西博物院', 37.869, 112.449, '太原')
];

async function seed(browser, rows, tag) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
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
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) { return window.TravelNotes && TravelNotes.list().length === n; },
    { timeout: 20000, polling: 150 }, rows.length).catch(() => {});
  return { ctx, page, errs, tag };
}

/* 往同一个库里追加几篇（模拟「后来又记了太原」），不清库 */
async function append(page, rows) {
  await page.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        rs.forEach(function (r) { os.put(r); });
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
}

/* 图册页的现场读数：封面题、副题、统计、各章标题、路线插页的坐标点数 */
async function readAlbum(page) {
  await page.goto(U('album.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.al-cover__title') || document.querySelector('.al-empty'),
    { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(600);
  const r = await page.evaluate(function () {
    const q = s => document.querySelector(s);
    const t = e => ((e && e.textContent) || '').trim();
    const cover = q('.al-cover__title');
    const chapters = Array.prototype.slice.call(document.querySelectorAll('.al-ch-title'));
    const stats = Array.prototype.slice.call(document.querySelectorAll('.al-os')).map(e => t(e.querySelector('b')) + t(e.querySelector('span')));
    const lists = window.Album ? null : 'no Album';
    return {
      coverTitle: t(cover),
      coverSub: t(q('.al-cover__sub')),
      stats: stats.join(' / '),
      chapters: chapters.map(t),
      routePlateSvgs: document.querySelectorAll('.al-map-plate svg path[stroke="#AE5738"]').length,
      mapPlates: document.querySelectorAll('.al-map-plate').length,
      plateDots: document.querySelectorAll('.al-map-plate svg circle').length,
      hasEmpty: !!q('.al-empty'),
      note: lists
    };
  });
  const dbState = await page.evaluate(async function () {
    const l = await window.Album.list();
    return { albums: l.length, titles: l.map(a => a.title), chapterCounts: l.map(a => a.chapters.length), updatedAt: l.map(a => a.updatedAt) };
  });
  return { r, dbState };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });

  say('=== 批次 38-A 地基实测：图册为什么只有大同 + 旅程叙事顶部地图进屏画了什么 ===');
  say('数据：大同 3 篇（云冈石窟/华严寺/大同博物馆）+ 太原 2 篇（晋祠/山西博物院），连续 5 天，全部带坐标');
  say('');

  /* ---------- A：先只有大同 → 生成一册 → 再补太原 → 册子还认不认 ---------- */
  const A = await seed(browser, DAT.slice(0, 3), 'A');
  let x = await readAlbum(A.page);
  say('【A1 只种大同 3 篇，第一次进图册】');
  say('  封面题「' + x.r.coverTitle + '」  副题「' + x.r.coverSub + '」');
  say('  统计：' + x.r.stats);
  say('  章节：' + JSON.stringify(x.r.chapters));
  say('  库里册子：' + x.dbState.albums + ' 本，标题 ' + JSON.stringify(x.dbState.titles) + '，各册章节数 ' + JSON.stringify(x.dbState.chapterCounts));

  await append(A.page, DAT.slice(3));
  x = await readAlbum(A.page);
  say('');
  say('【A2 同一台机器上补记太原 2 篇后，再进图册（产品码 album.html:199-201：库里已有册子就直接渲染最后一本，不重算）】');
  say('  游记条数（现场读）：' + await A.page.evaluate(() => TravelNotes.list().length) + ' 篇');
  say('  封面题「' + x.r.coverTitle + '」');
  say('  统计：' + x.r.stats);
  say('  章节：' + JSON.stringify(x.r.chapters));
  say('  库里册子：' + x.dbState.albums + ' 本');
  const a2HasTaiyuan = x.r.chapters.join('|').indexOf('晋祠') >= 0 || x.r.chapters.join('|').indexOf('山西博物院') >= 0;
  say('  >>> 太原进册了吗：' + (a2HasTaiyuan ? '进了' : '没进（这就是「图册只显示大同」的第一条成因）'));
  await A.ctx.close();

  /* ---------- B/C：一次到位（库里没有册子）→ 重算 ---------- */
  const BC = await seed(browser, DAT, 'BC');
  x = await readAlbum(BC.page);
  say('');
  say('【B/C 五篇一次都在、库里没有旧册子 ⇒ 走 autoCreate 重算】');
  say('  封面题「' + x.r.coverTitle + '」  副题「' + x.r.coverSub + '」');
  say('  统计：' + x.r.stats);
  say('  章节：' + JSON.stringify(x.r.chapters));
  say('  路线插页里陶土色折线条数：' + x.r.routePlateSvgs);
  say('  库里册子：' + x.dbState.albums + ' 本');
  const bcHasTaiyuan = x.r.chapters.join('|').indexOf('晋祠') >= 0;
  say('  >>> 太原进册了吗：' + (bcHasTaiyuan ? '进了' : '没进'));
  say('  >>> 封面题只有' + x.r.coverTitle + '（dominantPlace 取篇数最多的那座城，album.js:233-241），另一座城在封面上没有任何位置');
  /* city 缺失时封面会退化成什么：现场量一次 */
  const degraded = await BC.page.evaluate(function () {
    const notes = TravelNotes.list();
    notes.forEach(function (n) { n.city = ''; n.province = ''; });
    const a = Album.buildFromNotes(notes);
    return { title: a.title, sites: a.stats.sites };
  });
  say('  >>> 把 city/province 抹空（异地无网定位失败时就是这个形状）再重算：封面题变成「' + degraded.title + '」（逐站点计数取众数），地点数 ' + degraded.sites);
  await BC.ctx.close();

  /* ---------- D：旅程叙事顶部那张地图 ---------- */
  const St = await seed(browser, DAT, 'D');
  await St.page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await St.page.waitForFunction(() => document.querySelectorAll('.story-card').length > 0, { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(1200);

  const READ = function () {
    const q = s => document.querySelector(s);
    const mapEl = q('#storyMap');
    const box = mapEl ? mapEl.getBoundingClientRect() : { top: -1, height: -1, width: -1 };
    const marks = Array.prototype.slice.call(document.querySelectorAll('#storyMap .leaflet-marker-icon'));
    const lines = Array.prototype.slice.call(document.querySelectorAll('#storyMap path.leaflet-interactive'));
    const m = window.map || null;
    return {
      mapBox: { top: Math.round(box.top), h: Math.round(box.height), w: Math.round(box.width) },
      vh: Math.round(window.innerHeight),
      markers: marks.length,
      markerLabels: marks.map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 12)),
      polylines: lines.length,
      polyClass: lines.map(e => e.getAttribute('stroke') + '/' + e.getAttribute('stroke-dasharray')),
      zoom: m ? m.getZoom() : -1,
      center: m ? [Number(m.getCenter().lat.toFixed(4)), Number(m.getCenter().lng.toFixed(4))] : [],
      bounds: m ? [Number(m.getBounds().getSouthWest().lat.toFixed(4)), Number(m.getBounds().getSouthWest().lng.toFixed(4)),
                   Number(m.getBounds().getNorthEast().lat.toFixed(4)), Number(m.getBounds().getNorthEast().lng.toFixed(4))] : [],
      cards: document.querySelectorAll('.story-card').length,
      activeIdx: Array.prototype.slice.call(document.querySelectorAll('.story-card')).findIndex(e => e.classList.contains('active')),
      navSub: (q('#snSub') || {}).textContent,
      selOptions: Array.prototype.slice.call(document.querySelectorAll('#tripSel option')).map(e => e.textContent.trim()),
      tiles: document.querySelectorAll('#storyMap img.leaflet-tile').length
    };
  };

  /* 地图对象在 story.html 是脚本内 var（顶层 var ⇒ window.map），直接读实例 */
  const d0 = await St.page.evaluate(READ);
  say('');
  say('【D1 旅程叙事进屏那一刻（顶部地图）】');
  say('  地图占位：top ' + d0.mapBox.top + '，高 ' + d0.mapBox.h + 'px（视口 ' + d0.vh + '），宽 ' + d0.mapBox.w);
  say('  瓦片张数：' + d0.tiles + '（0＝离线/取不到图，只剩底色）');
  say('  标记数：' + d0.markers + ' → ' + JSON.stringify(d0.markerLabels));
  say('  折线数：' + d0.polylines + ' ' + JSON.stringify(d0.polyClass));
  say('  卡片区：' + d0.cards + ' 张，当前激活第 ' + d0.activeIdx + ' 张，底部条「' + String(d0.navSub).trim() + '」');
  say('  旅程选择器：' + JSON.stringify(d0.selOptions));

  /* 翻到最后一站 */
  await St.page.evaluate(function () {
    const btn = document.getElementById('snNext');
    for (let i = 0; i < 30 && btn && !btn.disabled; i++) btn.click();
  });
  await sleep(1500);
  const d1 = await St.page.evaluate(READ);
  say('');
  say('【D2 按「下一站」翻到最后一站之后】');
  say('  标记数：' + d1.markers + ' → ' + JSON.stringify(d1.markerLabels));
  say('  折线数：' + d1.polylines + ' ' + JSON.stringify(d1.polyClass));
  say('  当前激活第 ' + d1.activeIdx + ' 张，底部条「' + String(d1.navSub).trim() + '」');

  /* 中途跳回大同那一站：看太原的点还在不在屏上 */
  await St.page.evaluate(function () {
    const btn = document.getElementById('snPrev');
    for (let i = 0; i < 30 && btn && !btn.disabled; i++) btn.click();
  });
  await sleep(1500);
  const d2 = await St.page.evaluate(READ);
  say('');
  say('【D3 一路按「上一站」退回第一站】');
  say('  标记数：' + d2.markers + '，折线数：' + d2.polylines + '，激活第 ' + d2.activeIdx + ' 张');

  /* 「全部旅程」档 vs 单程档 */
  const tripSplit = await St.page.evaluate(function () {
    return Array.prototype.slice.call(document.querySelectorAll('#tripSel option')).map(e => e.value + ':' + e.textContent.trim());
  });
  say('  旅程切分档（间隔 >3 天分一趟）：' + JSON.stringify(tripSplit));
  await St.ctx.close();

  /* ---------- E：没坐标的游记在叙事里怎么消失 ---------- */
  const noCoord = DAT.slice(0, 3).concat([dd(5, '双塔寺', null, null, '太原')]);
  const E = await seed(browser, noCoord, 'E');
  await E.page.goto(U('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await E.page.waitForFunction(() => document.querySelector('#cards'), { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(900);
  const e1 = await E.page.evaluate(function () {
    return {
      notes: TravelNotes.list().length,
      cards: document.querySelectorAll('.story-card').length,
      empty: !!document.querySelector('.story-empty'),
      says: ((document.querySelector('#cards') || {}).innerText || '').slice(0, 60).replace(/\n/g, ' / ')
    };
  });
  say('');
  say('【E 四篇游记里有一篇没坐标（大同 3 篇 + 太原·双塔寺，后者 lat/lng 为空）】');
  say('  游记 ' + e1.notes + ' 篇 → 叙事卡片 ' + e1.cards + ' 张；空态？' + e1.empty);
  say('  屏上第一行：' + e1.says);
  say('  >>> 少掉那一篇没有任何说明（story.html:130 直接 filter 掉 lat/lng 为空的）');
  await E.ctx.close();

  await browser.close();

  say('');
  say('=== 探针结束 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
})().catch(async e => {
  say('探针异常：' + e.message);
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(1);
});
