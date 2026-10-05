/* tools/smoke-tickets.js — 批次 15 门票三级机制的真实浏览器闸门。
 * 覆盖 §27 抓不到的那半：三级优先序真的按序走、无 Key 时**一次请求都不发**（数 fetch 调用，
 * 不是读代码）、UI 那行小字真的印出「更新于 YYYY-MM」并在实时源上缀「（高德实时）」、
 * 未收录景点整行隐藏且 DOM 里不出现「元」字（防编造价格的最后一道）。
 * 全程拦掉外部请求 + 页内 stub window.fetch：高德响应是造出来的，不烧配额也不需要真 Key。
 * NODE_PATH 需指到 tools/node_modules。 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const _d = new Date();
const OUT = path.join(__dirname, 'out', 'shots',
  [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-') + '-b15-tickets');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* 端口每次换：SW 与 HTTP 缓存会吃掉上一轮的旧文件（既有教训：断言前必须先破缓存） */
const PORT = parseInt(process.env.PORT || String(8160 + (Date.now() % 40)), 10);
const BASE = 'http://127.0.0.1:' + PORT;

const SEED_NAME = '晋祠';                 /* 9 条种子之一：h 与 p 都有 */
/* 种子名单（site-tickets.js 实测 9 条，与 §27 的逐条口径同源）：用来在页面列表里现挑样本 */
const SEED_NAMES = ['晋祠', '平遥古城', '云冈石窟', '故宫', '西湖', '外滩', '鼓浪屿', '黄山', '九寨沟'];
const PLAIN_NAME = '大雁塔';              /* 数据层三条判据用的合成站名（不在种子里就行，不依赖页面） */
const PLAIN_LAT = 34.218, PLAIN_LNG = 108.964;
const SEED_LAT = 37.72, SEED_LNG = 112.56;

const checks = [];
function ok(id, pass, detail) { checks.push({ id, pass: !!pass, detail: detail === undefined ? '' : String(detail) }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function boot() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const http = require('http');
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  return { browser, server };
}

/* 打开页面并破掉 SW / HTTP 缓存 / 本机键，保证每档从干净态起 */
async function openPage(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  /* 外部请求一律拦掉：闸门要证明「无 Key 时腿都不迈」，不是「迈了但失败」 */
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (r.url().startsWith(BASE) || r.url().startsWith('data:') || r.url().startsWith('blob:')) r.continue();
    else r.abort();
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(async () => {
    try {
      const rs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r => r.unregister()));
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
  });
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  return page;
}

/* 页内 fetch 桩：数 restapi 调用次数；mode='amap' 时造 text/detail 两腿的成功响应。
 * text 腿回吐的 POI 坐标必须用「当页真挑出来那条景点」的经纬度——±0.2° 同名异地保护
 * 是产品自己的判据（site-tickets.js:70-75），桩编一个固定坐标就会被打回 null，
 * 那测的是桩不是产品。 */
async function installFetchStub(page, mode, site) {
  await page.evaluate((m, st) => {
    window.__amapCalls = [];
    const real = window.fetch.bind(window);
    window.fetch = function (u) {
      const s = String(u);
      if (s.indexOf('restapi.amap.com') < 0) return real(u);
      window.__amapCalls.push(s);
      const body = m === 'amap'
        ? (s.indexOf('place/text') >= 0
            ? { status: '1', pois: [{ id: 'B0STUB', name: st.label || st.name, location: st.lng + ',' + st.lat }] }
            : { status: '1', pois: [{ business: { opentime_week: '08:00-17:40（造样本）' } }] })
        : { status: '0', info: 'STUB_OFF', infocode: '0' };
      return Promise.resolve({ json: () => Promise.resolve(body) });
    };
  }, mode, site || { name: 'STUB', label: 'STUB', lat: PLAIN_LAT, lng: PLAIN_LNG });
}

const calls = page => page.evaluate(() => window.__amapCalls.length);
const ask = (page, name, lat, lng) => page.evaluate((n, la, ln) => new Promise(res => {
  SiteTickets.get({ name: n, label: n, lat: la, lng: ln }, t => res(t));
}), name, lat, lng);

/* 从页面自己的列表里挑一张卡：卡片带 data-i（topic-common.js:822），
 * `window.SITES[data-i]` 就是那条景点，能当场拿到 name/lat/lng。
 * 为什么要现挑而不是硬编码站名：`?q=大雁塔` 在 p=sx 这一档是 0 命中（晋祠在 routes-data.js，
 * 大雁塔根本不在这一页），写死样本会挑到一条不存在的路径（探针 tools/out/probe-b15-q.js）。 */
async function findCard(page, wantSeed) {
  for (let i = 0; i < 20; i++) {
    const got = await page.evaluate((names, seed) => {
      const cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
      for (let k = 0; k < cards.length; k++) {
        const c = cards[k];
        const s = window.SITES && window.SITES[+c.dataset.i];
        if (!s || !isFinite(+s.lat) || !isFinite(+s.lng)) continue;
        const isSeed = names.indexOf(s.name) >= 0 || names.indexOf(s.label) >= 0;
        if (isSeed === seed) return { found: true, idx: c.dataset.i, name: s.name, label: s.label || s.name, lat: +s.lat, lng: +s.lng, n: cards.length };
      }
      return { found: false, n: cards.length };
    }, SEED_NAMES, wantSeed);
    if (got.found) return got;
    await sleep(250);
  }
  return null;
}

/* 点卡（card.onclick → flyToSite → openSheet → loadTicket）。
 * 桩必须在点卡之前装好，所以这里只点不选。 */
const clickCard = (page, idx) => page.evaluate((i) => {
  const c = document.querySelector('.card[data-i="' + i + '"]');
  if (!c) return false;
  c.click();
  return true;
}, idx);

/* 轮询门票那行到稳定终态。两个坑都在案：
 * ① 实时腿的 display 可能只在 class 上（style.display 从没被 JS 碰过），所以要兜 computed；
 * ② 弹层会在后续渲染里被重建，`#locSheet.show` 不能当硬前置——改为「行拿到就算」。 */
async function ticketRow(page) {
  let snap = null;
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    snap = await page.evaluate(() => {
      const el = document.getElementById('lsTicket');
      if (!el) return null;
      return {
        inline: el.style.display || getComputedStyle(el).display,
        text: el.textContent,
        sheet: !!document.querySelector('#locSheet.show'),
      };
    });
    if (snap && snap.inline && snap.inline !== '') break;
  }
  return snap;
}

(async () => {
  const { browser, server } = await boot();
  try {
    /* ===== 一、三级机制（数据层） ===== */
    let page = await openPage(browser, BASE + '/topic.html?p=sx');
    ok('T1 site-tickets.js 已加载且导出 get', await page.evaluate(() => !!(window.SiteTickets && window.SiteTickets.get)));
    await installFetchStub(page, 'off');

    const seedHit = await ask(page, SEED_NAME, SEED_LAT, SEED_LNG);
    ok('T2 种子优先命中且 src=seed', seedHit && seedHit.src === 'seed' && !!seedHit.h, seedHit && seedHit.src);
    ok('T3 种子的 u 形如 YYYY-MM', /^\d{4}-\d{2}$/.test((seedHit && seedHit.u) || ''), seedHit && seedHit.u);

    const noKey = await ask(page, PLAIN_NAME, PLAIN_LAT, PLAIN_LNG);
    ok('T4 无 Key 的非种子返回 null', noKey === null, JSON.stringify(noKey));
    ok('T5 无 Key 时零次高德请求', (await calls(page)) === 0, 'calls=' + await calls(page));

    await page.evaluate((n) => {
      localStorage.setItem('tn_tk_' + n, JSON.stringify({ h: '09:00-17:00（缓存样本）', p: '', t: Date.now() - 3 * 3600 * 1000, u: '2026-09' }));
    }, PLAIN_NAME);
    const cacheHit = await ask(page, PLAIN_NAME, PLAIN_LAT, PLAIN_LNG);
    ok('T6 30 天内吃缓存且 src=cache', cacheHit && cacheHit.src === 'cache' && /缓存样本/.test(cacheHit.h), cacheHit && cacheHit.src);
    ok('T7 缓存路径同样零次请求', (await calls(page)) === 0, 'calls=' + await calls(page));

    await page.evaluate((n) => {
      localStorage.setItem('tn_tk_' + n, JSON.stringify({ h: '早过期的营业时间', p: '', t: Date.now() - 31 * 24 * 3600 * 1000, u: '2026-08' }));
    }, PLAIN_NAME);
    const stale = await ask(page, PLAIN_NAME, PLAIN_LAT, PLAIN_LNG);
    ok('T8 过期缓存不复活（返回 null）', stale === null, JSON.stringify(stale));
    await page.close();

    /* ===== 二、UI 那行小字（四档各一个干净页）=====
     * 三条实测坑：① 同一页里连续点第二张卡时，前一次 flyToSite 已把列表重渲染带走
     *   （探针 tools/out/probe-b15-card.js：点完晋祠后 cards=0、#lsTicket 整块不在 DOM）；
     * ② `#search` 派发 input 撞 :1444 的 250ms 防抖，cards 时 1 时 0（probe-b15-plain2.js），
     *   那是取样竞态不是产品缺陷；③ 写死站名会挑到该页根本没有的样本（probe-b15-q.js：
     *   `?q=大雁塔` 在 p=sx 是 0 命中）。所以四档各起新页、样本从当页列表现挑。 */
    const ui = [
      { id: 'T9 种子景点整行可见并印「更新于 YYYY-MM」', seed: true, mode: 'off', q: SEED_NAME,
        want: s => s.inline === 'block' && /更新于 \d{4}-\d{2}/.test(s.text) },
      { id: 'T10 旧文案「核对」在这行零残留', seed: true, mode: 'off', q: SEED_NAME,
        want: s => s.inline === 'block' && s.text.indexOf('核对') < 0 },
      { id: 'T11 未收录景点整行隐藏且行内不出现「元」', seed: false, mode: 'off', q: '',
        want: s => s.inline === 'none' && s.text.indexOf('元') < 0 },
      { id: 'T12 实时营业时间缀「（高德实时）」', seed: false, mode: 'amap', q: '',
        want: s => s.inline === 'block' && /（高德实时）/.test(s.text) && /更新于 \d{4}-\d{2}/.test(s.text) && /造样本/.test(s.text) },
    ];
    for (const u of ui) {
      /* 种子档用 ?q=晋祠 把样本缩到眼前几条（实测该页 4 条命中）；非种子档不需要过滤 */
      const p = await openPage(browser, BASE + '/topic.html?p=sx' + (u.q ? '&q=' + encodeURIComponent(u.q) : ''));
      const sample = await findCard(p, u.seed);
      if (!sample) {
        ok(u.id, false, '当页没挑到' + (u.seed ? '种子' : '非种子') + '景点样本');
        await p.close();
        continue;
      }
      await installFetchStub(p, u.mode, sample);
      if (u.mode === 'amap') await p.evaluate(() => localStorage.setItem('tn_amap_key', 'SMOKE_FAKE_KEY'));
      const clicked = await clickCard(p, sample.idx);
      const snap = clicked ? await ticketRow(p) : null;
      ok(u.id + '（样本 ' + sample.name + '）', snap && u.want(snap),
        snap ? snap.inline + '|' + snap.text.slice(0, 60) : (clicked ? '门票行始终没进 DOM' : '点卡失败'));
      if (u.mode === 'amap') await p.screenshot({ path: path.join(OUT, 'ui-' + sample.name + '-label.png') });
      await p.close();
    }
  } catch (e) {
    ok('EXCEPTION', false, e.message);
  } finally {
    await browser.close();
    server.close();
  }

  const pass = checks.filter(c => c.pass).length;
  checks.forEach(c => console.log((c.pass ? 'PASS ' : 'FAIL ') + c.id + (c.detail ? '  [' + c.detail + ']' : '')));
  console.log('smoke-tickets: ' + pass + ' PASS / ' + (checks.length - pass) + ' FAIL（共 ' + checks.length + ' 条）');
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ checks, pass, at: new Date().toISOString() }, null, 2));
  process.exit(pass === checks.length ? 0 : 1);
})();
