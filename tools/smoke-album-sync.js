/* tools/smoke-album-sync.js — 批次 38-B/B2 浏览器腿：图册「落后了」必须看得见，并且有一个出口
 *
 * 用户报（逐字，2026-10-11）：「我去了大同和太原，旅行图册只显示大同。」
 * 地基实测读数在 tools/out/b38-probe-album-story.txt，两条独立成因：
 *   ① album.html 见库里已有册子就直接渲染最后一本，之后新写的游记永远进不去（章节/统计/路线插页全部缺席）；
 *   ② 就算重算，书名取的是「篇数最多的那座城」，另一座城在封面上没有任何位置；city/province 都空时书名退化成景点名。
 * 这一腿逐条验修好之后的现场：提示条出不出、点了动没动、手工编辑有没有被覆盖、旧册认不认。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-album-sync.js
 * 口径：328×723 dpr2（一加 Ace 6T 真机档）；每个上下文独立 IndexedDB（file://  origin 需在启动参数里放开）；
 *      证据由脚本自己写盘，不靠 shell 重定向。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const LOG = path.join(ROOT, 'tools', 'out', 'b38-smoke-album-sync.txt');
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
    id: 's38_' + site, title: site + '·记', siteName: site, siteIndex: -1,
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
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) { return window.TravelNotes && TravelNotes.list().length === n; },
    { timeout: 20000, polling: 150 }, rows.length).catch(() => {});
  return { ctx, page };
}

/* 同一个库里追加几篇（模拟「后来又记了太原」），不清库 */
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

async function openAlbum(page) {
  await page.goto(U('album.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.al-cover__title') || document.querySelector('.al-empty'),
    { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(700);
}

/* 一次读完屏上的读数 + 条子的几何与显隐 + 库里的册子 */
async function read(page) {
  return page.evaluate(function () {
    const q = s => document.querySelector(s);
    const t = e => ((e && e.textContent) || '').trim();
    const bar = q('#alPending');
    const btn = q('#alPendingAdd'), x = q('#alPendingClose');
    const bb = bar ? bar.getBoundingClientRect() : null;
    const gb = e => { const r = e ? e.getBoundingClientRect() : null; return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const chapters = Array.prototype.slice.call(document.querySelectorAll('.al-ch-title')).map(t);
    const stats = {};
    Array.prototype.slice.call(document.querySelectorAll('.al-os')).forEach(function (e) {
      stats[t(e.querySelector('span'))] = t(e.querySelector('b'));
    });
    return {
      coverTitle: t(q('.al-cover__title')),
      coverSub: t(q('.al-cover__sub')),
      chapters: chapters,
      stats: stats,
      plateDots: document.querySelectorAll('.al-map-plate svg circle[fill="#20201D"]').length,
      plates: document.querySelectorAll('.al-map-plate').length,
      barShown: !!bar && bar.classList.contains('show'),
      barText: t(q('#alPendingText')),
      barBox: bb ? { top: Math.round(bb.top), bottom: Math.round(bb.bottom), left: Math.round(bb.left), right: Math.round(bb.right) } : null,
      btnBox: gb(btn), xBox: gb(x),
      overflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    };
  });
}
const dbAlbum = page => page.evaluate(async function () {
  const l = await window.Album.list();
  const a = l[l.length - 1] || null;
  return a ? {
    albums: l.length, title: a.title, subtitle: a.subtitle || '', coverAuto: a.coverAuto,
    chapters: a.chapters.length, titles: a.chapters.map(c => c.title),
    withIds: a.chapters.filter(c => c.noteIds && c.noteIds.length).length,
    route: a.chapters.filter(c => String(c.id || '').indexOf('ch_route_') === 0).length,
    updatedAt: a.updatedAt, mem: a.stats.memory
  } : { albums: l.length };
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 38-B/B2 浏览器腿：图册落后检测 + 新游记入册 + 多城书名（328×723）===');

  /* ---------- 主腿：三篇生成 → 补两篇 → 提示 → 加进来 ---------- */
  const A = await seed(browser, DAT.slice(0, 3));
  await openAlbum(A.page);
  const n0 = await A.page.evaluate(() => TravelNotes.list().length);
  ok('A00', '种子自校准：库里 3 篇游记', n0 === 3, '实读 ' + n0 + ' 篇');
  let r = await read(A.page), d = await dbAlbum(A.page);
  ok('A01', '第一次进图册自动成册（库里 1 本）', d.albums === 1, '册子 ' + d.albums + ' 本，章节 ' + JSON.stringify(r.chapters));
  ok('A02', '单城书名＝「大同」且没有副题', r.coverTitle === '大同' && r.coverSub === '', '题「' + r.coverTitle + '」副「' + r.coverSub + '」');
  ok('A03', '没有新游记时提示条不出现', !r.barShown, 'barShown=' + r.barShown);

  await append(A.page, DAT.slice(3));
  await openAlbum(A.page);
  r = await read(A.page);
  ok('A04', '补记太原 2 篇后提示条出现', r.barShown, 'class 未含 show＝册子仍被当最新，读不到条子');
  ok('A05', '提示条点名篇数「还有 2 篇新游记没进这本册」', r.barText === '还有 2 篇新游记没进这本册', '屏上「' + r.barText + '」');
  ok('A06', '点之前册子还是旧的（章节里没有太原）', r.chapters.join('|').indexOf('晋祠') < 0, '章节 ' + JSON.stringify(r.chapters));
  ok('A07', '提示条整条在 328×723 取景框内', !!r.barBox && r.barBox.top >= 0 && r.barBox.bottom <= VH && r.barBox.left >= 0 && r.barBox.right <= VW,
    JSON.stringify(r.barBox));
  ok('A08', '页面不横向溢出', r.overflow, 'scrollWidth ' + r.sw + ' / clientWidth ' + r.cw);
  ok('A09', '「加进来」与关闭钮 ≥44×44', !!r.btnBox && r.btnBox.h >= 44 && r.btnBox.w >= 44 && !!r.xBox && r.xBox.h >= 44 && r.xBox.w >= 44,
    '加进来 ' + JSON.stringify(r.btnBox) + ' 关闭 ' + JSON.stringify(r.xBox));

  const before = await dbAlbum(A.page);
  await A.page.click('#alPendingAdd');
  await sleep(1200);
  r = await read(A.page);
  ok('A10', '点「加进来」后提示条收起（篇数归 0）', !r.barShown, 'barShown=' + r.barShown + ' 文案「' + r.barText + '」');
  ok('A11', '太原两站进了章节', r.chapters.join('|').indexOf('晋祠') >= 0 && r.chapters.join('|').indexOf('山西博物院') >= 0, '章节 ' + JSON.stringify(r.chapters));
  ok('A12', '书名并列两座城', r.coverTitle === '大同 · 太原', '题「' + r.coverTitle + '」');
  ok('A13', '副题交代了城数与段数', r.coverSub === '2 座城 · 5 段记忆', '副「' + r.coverSub + '」');
  ok('A14', '统计跟着重算（段记忆 5）', r.stats['段记忆'] === '5' || r.stats['记忆'] === '5', '统计 ' + JSON.stringify(r.stats));
  ok('A15', '路线插页里 5 个点（原来只有 3 个）', r.plateDots === 5, '插页 ' + r.plates + ' 张，点数 ' + r.plateDots);
  const after = await dbAlbum(A.page);
  ok('A16', '落盘的册子只有一本、章节 6 段且路线插页只有一张', after.albums === 1 && after.chapters === 6 && after.route === 1,
    '册子 ' + after.albums + ' 本，章节 ' + after.chapters + '，路线插页 ' + after.route);
  ok('A17', '章节带上了游记编号（落后检测的那把钥匙）', after.withIds === 5, '带 noteIds 的章节 ' + after.withIds + '/' + after.chapters);
  ok('A18', '旧章节没被推倒重来（原来那三章还在，只追加）', after.titles.slice(0, before.chapters - 1).join('|') === before.titles.slice(0, before.chapters - 1).join('|'),
    '前 ' + (before.chapters - 1) + ' 章 ' + JSON.stringify(after.titles.slice(0, before.chapters)));

  /* ---------- 关闭钮：收起条子但不动册子 ---------- */
  await append(A.page, [dd(9, '双塔寺', 37.874, 112.593, '太原')]);
  await openAlbum(A.page);
  r = await read(A.page);
  const keep = await dbAlbum(A.page);
  ok('A19', '再补一篇时提示条自己回来（条数 1）', r.barShown && r.barText === '还有 1 篇新游记没进这本册', '文案「' + r.barText + '」');
  await A.page.click('#alPendingClose');
  await sleep(500);
  const r2 = await read(A.page), keep2 = await dbAlbum(A.page);
  ok('A20', '关闭只收起条子，册子一个字没动', !r2.barShown && keep2.chapters === keep.chapters && keep2.updatedAt === keep.updatedAt,
    '章节 ' + keep.chapters + '→' + keep2.chapters + '，updatedAt ' + (keep.updatedAt === keep2.updatedAt ? '没变' : '变了'));
  await openAlbum(A.page);
  const r3 = await read(A.page);
  ok('A21', '关掉是「这一次」，下次进图册仍会提醒', r3.barShown, '重进后 barShown=' + r3.barShown);

  /* ---------- 旧册没有 noteIds：代理匹配仍只报真新的那几篇 ---------- */
  await A.page.evaluate(async function () {
    const l = await window.Album.list();
    const a = l[l.length - 1];
    a.chapters.forEach(function (c) { delete c.noteIds; });
    await window.Album.save(a);
  });
  await openAlbum(A.page);
  const legacy = await read(A.page);
  ok('A22', '旧册（章节没带 noteIds）也只报真没入册的那几篇', legacy.barText.indexOf('还有 1 篇') === 0, '文案「' + legacy.barText + '」＝把整本当新的会报 5/6 篇');
  await A.ctx.close();

  /* ---------- 手改书名受保护：编辑器改过名，「加进来」不许覆盖 ---------- */
  const B = await seed(browser, DAT.slice(0, 3));
  await openAlbum(B.page);
  const bId = await B.page.evaluate(async function () { const l = await window.Album.list(); return l[l.length - 1].id; });
  await B.page.goto(U('album-edit.html?id=' + encodeURIComponent(bId)), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await B.page.waitForFunction(() => document.querySelector('#cvTitle'), { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(600);
  await B.page.evaluate(function () {
    const el = document.querySelector('#cvTitle');
    el.value = '我们的秋天';
    el.dispatchEvent(new Event('change'));
    document.querySelector('#edDone').click();   // 走产品自己的「完成保存」
  });
  await sleep(1500);
  const manual = await dbAlbum(B.page);
  ok('A23', '编辑器里改过的书名落了盘且标记为手改', manual.title === '我们的秋天' && manual.coverAuto === false,
    '题「' + manual.title + '」coverAuto=' + manual.coverAuto);
  await append(B.page, DAT.slice(3));
  await openAlbum(B.page);
  const rb = await read(B.page);
  await B.page.click('#alPendingAdd');
  await sleep(1200);
  const mb = await dbAlbum(B.page);
  const coverNow = await read(B.page);
  ok('A24', '手改过的书名在「加进来」之后原样保留', mb.title === '我们的秋天' && coverNow.coverTitle === '我们的秋天',
    '库里「' + mb.title + '」屏上「' + coverNow.coverTitle + '」');
  ok('A25', '手改书名不影响正文入册（太原两章还是进来了）', coverNow.chapters.join('|').indexOf('晋祠') >= 0, '章节 ' + JSON.stringify(coverNow.chapters));
  ok('A26', '副题没被手写书名连坐改掉（改的是书名，副题仍空）', mb.subtitle === '', '副「' + mb.subtitle + '」');
  await B.ctx.close();

  /* ---------- 兜底：city/province 全空时不许拿景点名当书名 ---------- */
  const C = await seed(browser, DAT);
  await C.page.goto(U('album.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await C.page.waitForFunction(() => window.Album && document.querySelector('.al-cover__title'), { timeout: 25000, polling: 150 }).catch(() => {});
  await sleep(500);
  const degraded = await C.page.evaluate(function () {
    const notes = TravelNotes.list().map(function (n) { const c = Object.assign({}, n); c.city = ''; c.province = ''; return c; });
    return { withCity: Album.coverTitle(TravelNotes.list()), empty: Album.coverTitle(notes) };
  });
  ok('A27', 'city 有值时按城并列', degraded.withCity.title === '大同 · 太原', '题「' + degraded.withCity.title + '」');
  ok('A28', 'city/province 全空时退回「我的旅行」而不是某个景点名', degraded.empty.title === '我的旅行', '题「' + degraded.empty.title + '」');
  ok('A29', '只有省名时按省并列（不冒充城市）', await C.page.evaluate(function () {
    const notes = TravelNotes.list().map(function (n) { const c = Object.assign({}, n); c.city = ''; return c; });
    return Album.coverTitle(notes).title === '山西' && Album.coverTitle(notes).subtitle === '';
  }), await C.page.evaluate(function () {
    const notes = TravelNotes.list().map(function (n) { const c = Object.assign({}, n); c.city = ''; return c; });
    const a = Album.coverTitle(notes); return '题「' + a.title + '」副「' + a.subtitle + '」';
  }));
  ok('A30', '三城以上不挤爆封面（并列两座 + 一句「等 N 城」）', await C.page.evaluate(function () {
    const notes = TravelNotes.list().concat([{ id: 'x1', ts: 0, title: '平遥', siteName: '平遥古城', city: '晋中', province: '山西', lat: 37.2, lng: 112.18, text: 'x', photos: [] }]);
    const a = Album.coverTitle(notes);
    return a.title === '大同 · 太原 等 3 城';
  }), await C.page.evaluate(function () {
    const notes = TravelNotes.list().concat([{ id: 'x1', ts: 0, title: '平遥', siteName: '平遥古城', city: '晋中', province: '山西', lat: 37.2, lng: 112.18, text: 'x', photos: [] }]);
    return '题「' + Album.coverTitle(notes).title + '」';
  }));
  await C.ctx.close();

  ok('A31', '全程零未捕获报错', ERRS.length === 0, ERRS.slice(0, 3).join(' | '));
  ok('A32', '本腿条数守卫（≥32 条，少跑一段就是假绿）', total >= 32, '实际执行 ' + total + ' 条');

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
