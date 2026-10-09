/* tools/smoke-entry.js — 批次 34「入口接线与深链回执」浏览器闸门（§49 的腿）
 *
 * 这一节管的是三类「看得见但点不动」和「点了不吭声」，三类的失败模式都只能在屏上量：
 *
 *   ① story.html 的照片框。改前 6 枚 `.sc-pics img` 里 0 枚带 onclick
 *      （真值 tools/out/b34-probe-deadclick.txt 腿 ①），能看不能放大——同一族动作在
 *      review.html / travel-notes.js 里早就接好了（本腿 E25／E26 那条正向对照）。
 *   ② me.html 的「最近记录」。改前一排纯 div：无 onclick、无 data-go、cursor auto，
 *      行高 [32,33,33] 还低于项目自定 44 地板（同上文件腿 ②）。接成入口就必须连地板一起抬，
 *      否则是造一枚不合格的新钮。
 *      **这一腿自己踩过坑**：328×723 首屏排不到那一行（cy=916 在视口外），
 *      mouse.click 打不到，改前那份「url 未变」因此不算证据；本腿一律先 scrollIntoView 再量再点。
 *   ③ travel-map.html 的 `?id=` 深链。首页搜索栏（search.html:216）一直往这条链上送人，
 *      而它写在脚本解析期：那一刻 `TravelNotes.list()` 是空数组（notes 由 IndexedDB 异步灌入，
 *      init() 还要更晚），for 循环一次都没进过——不 flyTo、不改那行字、也不说为什么。
 *      直读证据 tools/out/b34-probe-deadlink.txt:10（插桩抓到「解析期:708 那次调用看到的条数 [0]」），
 *      同页那条不依赖 notes 的 `?lat=` 链在同一环境里能 flyTo 并回执（:27/:28），
 *      所以静默不是环境不通。改后 E15/E16 把这两档做成常驻判据。
 *
 *   顺带把三条「改判」固化成读数（都是批次 34-A 地基实测推翻了报告名单的部分）：
 *      · results.js 那两处 <img> 只活在导出文档里，app 内被 esc() 成纯文本预览，屏上没有那一枚；
 *      · album-edit.html 的缩略图住在 `.n-item` 那一行里，行本身有出口（选这篇记忆）；
 *      · md-manager.html 点缩略图实测打开的是详情视图（行的出口），不是「点了没反应」。
 *      E24–E29 就是把这几句钉在屏上的那几条腿。
 *
 *   回执分三档（找到 / 没找到 / 命中但没有坐标），少一档就是又回到沉默；
 *   `_deepId` 的一次性（E21）也有独立判据：不清零的话，保存之后 `_onReady` 再跑一次会把人抢回那一点。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、seed 直写 IndexedDB、
 * 关缓存 + 反注册 SW、打 tn_onboarded 才读、动画收尾再量、waitForFunction 一律函数式。
 * 落盘名由调用方重定向（固定名会被 U 类重跑覆写）。
 *
 * 名字前缀 E（entry）。
 * 用法：PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/smoke-entry.js \
 *        > tools/out/b34-smoke-entry.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8246', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;            /* 一加 Ace 6T 真机档（§37 口径） */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
let checks = 0, fails = 0;
let uncaught = 0;
function ok(name, cond, detail) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (detail === undefined || detail === '' ? '' : '  [' + detail + ']');
  if (!cond) fails++;
  lines.push(s);
  console.log(s);
}
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b34-smoke-entry.dump.txt'), lines.join('\n') + '\n'); } catch (e) {}
}
process.on('exit', dump);

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml'
        : p.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* 四篇：s1–s3 带坐标各两张图，s4 最新但没坐标也没图（E18 那档的靶子，也是 me.html 的首行）。
   ts 递增到 10-05，好让「最近记录」那一排的次序是可预期的。 */
function seedLocal() {
  /* 会被 evaluateOnNewDocument 序列化后裸跑，闭包带不进去——所有值写死在这里。 */
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
    var P = ['images/sites/034ab1d51239cd1e.jpg', 'images/sites/04b44c7e76f9c59c.jpg'];
    var r1 = indexedDB.open('gujian-notes', 1);
    r1.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    r1.onsuccess = function (e) {
      var db = e.target.result;
      var tx = db.transaction('notes', 'readwrite');
      var os = tx.objectStore('notes');
      os.clear();
      [['s1', '应县木塔', 39.66, 113.19, '2026-10-02T09:12'],
       ['s2', '云冈石窟', 40.11, 113.13, '2026-10-03T10:30'],
       ['s3', '五台山', 39.08, 113.55, '2026-10-04T08:05']].forEach(function (t, i) {
        os.put({ id: t[0], title: t[1], siteName: t[1], lat: t[2], lng: t[3],
          ts: new Date(t[4] + ':00+08:00').getTime(), date: t[4].replace('T', ' '), day: t[4].slice(0, 10),
          province: '山西', city: '大同', text: '正文' + (i + 1) + '，一段够长的文字，让卡面与抽屉都有东西可读。',
          photos: P.slice(), audio: '', tags: ['实测'], weather: '晴 18℃' });
      });
      os.put({ id: 's4', title: '没有坐标的一篇', siteName: '没有坐标的一篇', lat: null, lng: null,
        ts: new Date('2026-10-05T11:20:00+08:00').getTime(), date: '2026-10-05 11:20', day: '2026-10-05',
        province: '山西', city: '太原', text: '只为了测「命中但地图上定位不了」那一档该给用户读什么。',
        photos: [], audio: '', tags: [], weather: '' });
      tx.oncomplete = function () { db.close(); resolve('seeded-4'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
}

/* 插桩：每次有人调 TravelNotes.list() 就记下条数 + 调用处 + 当时的 readyState。
   这一条把「深链那次读到的分母是不是 0」从推断变成读数，也是 E19/E20 的取数口。
   栈里带查询串（travel-map.html?id=s3:721:22），所以判据不许写死 `html:708` 那种整串。 */
function instrumentList() {
  window.__LISTCALLS = [];
  var real;
  try {
    Object.defineProperty(window, 'TravelNotes', {
      configurable: true,
      get: function () { return real; },
      set: function (v) {
        real = v;
        try {
          var orig = v.list;
          v.list = function () {
            var r = orig.apply(v, arguments);
            try {
              var st = String((new Error()).stack || '').split('\n').slice(1, 4)
                .map(function (s) { return s.trim().replace(/^at\s+/, '').replace(/http:\/\/127\.0\.0\.1:\d+\//, ''); })
                .join(' <- ');
              window.__LISTCALLS.push({ n: r.length, ready: document.readyState, at: st.slice(0, 130) });
            } catch (e) {}
            return r;
          };
        } catch (e) {}
      }
    });
  } catch (e) {}
}

const HELPERS = function () {
  window.__E = {
    rect: function (e) { var b = e.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top),
        cx: Math.round(b.left + b.width / 2), cy: Math.round(b.top + b.height / 2) }; },
    label: function (e) { if (!e) return 'null';
      var s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id;
      var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
      if (c.length) s += '.' + c.join('.'); return s.slice(0, 60); },
    /* 把某枚元素滚进两条浮带之外（视口中位），返回可直接点的中心点 */
    ready: function (sel, idx) {
      var all = document.querySelectorAll(sel);
      var e = all[idx || 0];
      if (!e) return { miss: true, n: all.length };
      e.scrollIntoView({ block: 'center' });
      var r = window.__E.rect(e);
      r.hit = window.__E.label(document.elementFromPoint(r.cx, r.cy));
      r.n = all.length;
      return r;
    },
    viewer: function () {
      var v = document.querySelector('.tn-viewer');
      if (!v) return null;
      var img = v.querySelector('#tvImg');
      return { idx: (v.querySelector('#tvI') || {}).textContent || '',
        src: img ? String(img.getAttribute('src') || '').split('/').pop() : '' };
    },
    stat: function () { var sm = document.getElementById('statMain'); return sm ? sm.textContent : '(无 #statMain)'; },
    center: function () { try { var c = map.getCenter(); return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), zoom: Math.round(map.getZoom()) }; } catch (e) { return { err: String(e.message).slice(0, 30) }; } }
  };
};

(async function main() {
  const srv = staticServer().listen(PORT);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2', '--window-size=' + VW + ',' + VH]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  await page.setCacheEnabled(false);
  const errs = [];
  /* 瓦片在静态 http 环境里注定取不到，换页时更是一串 ERR_ABORTED；混进 errs 就没法分辨真异常 */
  let tileNoise = 0;
  const isTile = u => /appmaptile|\/tile\//.test(u);
  page.on('pageerror', e => { uncaught++; errs.push('[pageerror] ' + String(e.message).slice(0, 70)); });
  page.on('requestfailed', r => { const u = String(r.url()); if (isTile(u)) { tileNoise++; return; } errs.push('[请求失败] ' + u.slice(-46)); });
  page.on('response', r => { const u = String(r.url()); if (r.status() === 404 && !isTile(u)) errs.push('[404] ' + u.slice(-46)); });
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 60)); });
  await page.evaluateOnNewDocument(() => {
    try { navigator.serviceWorker && navigator.serviceWorker.getRegistrations
      && navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); } catch (e) {}
  });
  await page.evaluateOnNewDocument(seedLocal);
  await page.evaluateOnNewDocument(instrumentList);
  await page.evaluateOnNewDocument(HELPERS);

  const P = p => BASE + '/' + p;
  const goto = async (p, wait) => {
    await page.goto(P(p), { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} })); } catch (e) {}
    await sleep(wait || 2200);
  };
  const clickAt = async (x, y) => { await page.mouse.click(x, y); await sleep(700); };
  const EV = f => page.evaluate(f);

  try {
    /* ================= ⓪ 种子自校准：分母不对，下面所有 miss 都不能算产品缺陷 ================= */
    await goto('story.html');
    const ZC = await EV(() => {
      var l = window.TravelNotes && TravelNotes.list ? TravelNotes.list() : [];
      return { n: l.length, pics: l.filter(x => x.photos && x.photos.length).length,
        noCoord: l.filter(x => x.lat == null).length };
    });
    ok('E00 种子自校准（库里 4 篇／带图 3 篇／缺坐标 1 篇）',
      ZC.n === 4 && ZC.pics === 3 && ZC.noCoord === 1, JSON.stringify(ZC));
    if (ZC.n !== 4 || ZC.pics !== 3 || ZC.noCoord !== 1) {
      say('E97 分母不对，下面全部判据取消资格——直接收摊，不把空跑写成绿。');
      throw new Error('SEED_DENOMINATOR');
    }

    /* ================= ① story.html：照片框要能点开 ================= */
    const ST = await EV(() => {
      var all = document.querySelectorAll('.story-card .sc-pics img');
      var wired = Array.prototype.filter.call(all, e => e.getAttribute('onclick')).length;
      var cur = all.length ? getComputedStyle(all[0]).cursor : '';
      return { n: all.length, wired: wired, cursor: cur };
    });
    ok('E01 story 缩略图在场且每一枚都接了出口', ST.n >= 3 && ST.wired === ST.n,
      ST.wired + '/' + ST.n + ' 枚带 onclick（改前 0/6，tools/out/b34-probe-deadclick.txt 腿 ①）');
    ok('E02 story 缩略图 cursor 是 pointer（可点要有视觉承诺，不能只接不显）', ST.cursor === 'pointer', ST.cursor);
    /* 原位读数必须在 scrollIntoView 之前取：一旦滚进视口中位，「落在底导航带里」这件事就量不着了。
       这一条不是判据而是登记——接线已经对，首屏那一版式归谁是要点单的取舍，不替用户决定。 */
    const OV = await EV(() => {
      var e = document.querySelector('.story-card .sc-pics img');
      var n = document.querySelector('.bottom-nav');
      if (!e || !n) return null;
      var a = window.__E.rect(e), b = window.__E.rect(n);
      return { thumbTop: a.y, thumbBottom: a.y + a.h, thumbCx: a.cx, thumbCy: a.cy,
        navTop: b.y, navBottom: b.y + b.h, centerHit: window.__E.label(document.elementFromPoint(a.cx, a.cy)) };
    });
    say('· 现状登记（不计判据）：首屏原位那枚缩略图 ' + JSON.stringify(OV)
      + ' —— 中心点落在底导航带里，那一点把人带去 travel-map；这是报告 §3 第 14 条的读数，'
      + '接线已经对，版式取舍等点单。');
    const SR = await EV(() => window.__E.ready('.story-card .sc-pics img', 0));
    ok('E03 滚进视口中位后顶命中是它自己（不是浮带）', !SR.miss && SR.hit === 'img',
      JSON.stringify({ rect: SR.w + '×' + SR.h + '@' + SR.x + ',' + SR.y, hit: SR.hit })
      + '（原位中心命中的是 a.bottom-nav__item：那条带 639–709，见上面那条现状登记）');
    await clickAt(SR.cx, SR.cy);
    const SV = await EV(() => window.__E.viewer());
    ok('E04 真点之后查看器开出并落在第 1 张', !!SV && /^1 \/ 2$/.test(SV.idx), JSON.stringify(SV));
    ok('E05 查看器里那张就是被点的图（不是随手拿的第一枚）',
      !!SV && SV.src === '034ab1d51239cd1e.jpg', SV ? SV.src : 'viewer=null');
    await EV(() => { var x = document.querySelector('.tn-viewer-x'); if (x) x.click(); });
    await sleep(400);
    errs.length = 0;

    /* ================= ② me.html：最近记录那一排要能走，且是合格的钮 ================= */
    await goto('me.html');
    const MR = await EV(() => {
      var rows = Array.prototype.slice.call(document.querySelectorAll('#meRecent .rec'));
      return {
        n: rows.length,
        hs: rows.map(e => Math.round(e.getBoundingClientRect().height)),
        go: rows.filter(e => /^travel-map\.html\?id=.+/.test(e.getAttribute('data-go') || '')).length,
        aria: rows.filter(e => e.getAttribute('role') === 'button' && e.getAttribute('tabindex') === '0'
          && (e.getAttribute('aria-label') || '').length > 0).length,
        cur: rows.filter(e => getComputedStyle(e).cursor === 'pointer').length
      };
    });
    ok('E06 me 最近记录排满 4 行（种子 4 篇都该在）', MR.n === 4, 'n=' + MR.n);
    ok('E07 每一行都带 data-go 且 id 非空', MR.go === MR.n, MR.go + '/' + MR.n + ' 行（改前 0/3：一排纯 div）');
    ok('E08 每一行的 role/tabindex/aria-label 齐（接成入口就要可达）', MR.aria === MR.n, MR.aria + '/' + MR.n);
    ok('E09 每一行实测高度 ≥44（入口不能是新的低值钮）',
      MR.hs.length === MR.n && Math.min.apply(null, MR.hs) >= 44, JSON.stringify(MR.hs) + '（改前 [32,33,33]）');
    ok('E10 每一行 cursor 是 pointer', MR.cur === MR.n, MR.cur + '/' + MR.n);
    /* 挑「带坐标那一篇」对应的行——本种子里最新那篇（首行）恰好没有坐标，正是要分开量的两档 */
    const PK = await EV(() => {
      var rows = Array.prototype.slice.call(document.querySelectorAll('#meRecent .rec'));
      for (var i = 0; i < rows.length; i++) {
        var id = ((rows[i].getAttribute('data-go') || '').match(/id=(.+)$/) || [])[1] || '';
        var nn = TravelNotes.list().filter(function (n) { return n.id === id; })[0];
        if (nn && nn.lat != null) {
          var r = window.__E.ready('#meRecent .rec', i);
          return { row: i, id: id, title: nn.title, lat: nn.lat, lng: nn.lng, go: rows[i].getAttribute('data-go'), cx: r.cx, cy: r.cy, hit: r.hit };
        }
      }
      return { miss: true };
    });
    ok('E11 库里能挑到带坐标的那一行（挑不到＝这一腿在量一个不存在的东西）', !PK.miss, JSON.stringify({ row: PK.row, go: PK.go, hit: PK.hit }));
    await clickAt(PK.cx, PK.cy);
    await sleep(2400);
    ok('E12 真点之后落到 travel-map.html?id=（入口与深链接起来的那条通路）',
      /travel-map\.html\?id=/.test(page.url()), page.url().slice(-34));
    ok('E13 落地页那行字是「已定位：<那一篇>」（回执用库里的标题比对，不写死串）',
      (await EV(t => window.__E.stat())) === '已定位：' + PK.title, await EV(t => window.__E.stat()));
    const C1 = await EV(() => window.__E.center());
    ok('E14 地图中心就在那一篇的坐标上且已放大',
      Math.abs(C1.lat - PK.lat) < 0.02 && Math.abs(C1.lng - PK.lng) < 0.02 && C1.zoom >= 13,
      JSON.stringify(C1) + ' 期望≈' + PK.lat + ',' + PK.lng + ' z13');
    const LC = await EV(() => (window.__LISTCALLS || []).filter(c => /locateDeepNote/.test(c.at)).map(c => c.n));
    ok('E15 深链那一次找库看到的条数是全库（解析期读空数组就是这里露馅的）',
      LC.length === 1 && LC[0] === 4, 'locateDeepNote 调用 ' + JSON.stringify(LC) + ' 次/条数（改前那一次读 0，tools/out/b34-probe-deadlink.txt:10）');
    const LD = await EV(() => (window.__LISTCALLS || []).filter(c => c.ready === 'loading').length);
    ok('E16 解析期（readyState=loading）不再有人读游记库', LD === 0, 'loading 阶段的 list() 调用 ' + LD + ' 次（改前 1 次且条数 0）');

    /* ================= ③ 回执三档 + 一次性 ================= */
    await goto('travel-map.html?id=s9');
    const R1 = await EV(() => window.__E.stat());
    ok('E17 命中失败要说话：id 不存在 → 「没找到那篇游记…」', /没找到那篇游记/.test(R1), JSON.stringify(R1));
    await goto('travel-map.html?id=s4');
    const R2 = await EV(() => window.__E.stat());
    ok('E18 命中但没有坐标也要说话：→ 「…没有坐标，地图上定位不了」', /没有坐标/.test(R2), JSON.stringify(R2));
    await goto('travel-map.html?id=' + encodeURIComponent('%zz'));
    /* 这一档原本走 `?id=%zz`（不编码）的整页载入，但导航层会先把查询串规范化，
       到 :713 那一行读到的已经是安全形状，测不出 URIError。改成本页直接调用：
       坏串直接喂给 _deepId，问的就是那一句 try/catch 在不在。 */
    const R3 = await EV(() => {
      var out = { threw: '' };
      try { window._deepId = '%zz'; locateDeepNote(); } catch (e) { out.threw = String(e.message).slice(0, 40); }
      out.stat = window.__E.stat();
      return out;
    });
    ok('E19 坏 % 串不炸载入回调（decodeURIComponent 会抛 URIError，抛了就是整页刷新没跑完）',
      R3.threw === '' && /没找到那篇游记/.test(R3.stat), JSON.stringify(R3));
    errs.length = 0;
    /* 一次性：不清零的话，下一次 _onReady 会把人从全体视野抢回那一点 */
    await goto('travel-map.html?id=s3');
    const ONE = await EV(async () => {
      var before = window.__E.center();
      TravelNotes._onReady();                       /* 再触发一次载入回调（保存/重渲都会走这里） */
      await new Promise(r => setTimeout(r, 900));
      var after = window.__E.center();
      return { before: before, after: after, stat: window.__E.stat() };
    });
    ok('E20 深链只抢一次：再走 _onReady 之后中心回到全体视野，没被抢回那一点',
      ONE.after.zoom < 13 && Math.abs(ONE.after.lat - 39.59) < 0.15,
      JSON.stringify(ONE.before) + ' → ' + JSON.stringify(ONE.after));
    ok('E21 一次性之后那行字也不该再自称「已定位」（旧消息会盖住新的常态读数）',
      /游记/.test(ONE.stat), JSON.stringify(ONE.stat));

    /* ================= ④ 同族出口与三条改判的固化 ================= */
    await goto('travel-map.html?id=s3');
    /* .ms-photos 只在「这一篇的 Memory Sheet」打开之后才在 DOM 里（travel-map.html:678 由
       openMemSheet 发），所以先走本页自己的入口把抽屉打开——它正是图钉信息框那条路用的同一个函数。 */
    const OPEN = await EV(async () => {
      try { openMemSheetById('s3'); } catch (e) { return { err: String(e.message).slice(0, 40) }; }
      await new Promise(r => setTimeout(r, 800));
      var e = document.querySelector('.ms-photos img');
      return { n: document.querySelectorAll('.ms-photos img').length,
        attr: e ? (e.getAttribute('onclick') || '').slice(0, 40) : '' };
    });
    ok('E22 游记卡（ms-photos）那一族仍接在本页自己的放大上',
      OPEN.n > 0 && /zoomPhoto\(this\.src\)/.test(OPEN.attr || ''), JSON.stringify(OPEN));
    const OVW = await EV(async () => {
      var e = document.querySelector('.ms-photos img');
      if (!e) return null;
      var r = window.__E.ready('.ms-photos img', 0);
      e.click();
      await new Promise(x => setTimeout(x, 400));
      var z = Array.prototype.slice.call(document.querySelectorAll('body *'))
        .filter(el => el.style && el.style.zIndex === '9800');
      var img = z.length ? z[0].querySelector('img') : null;
      var got = { overlay: z.length, hit: r.hit, src: img ? String(img.getAttribute('src') || '').split('/').pop() : '' };
      if (z.length) z[0].click();
      await new Promise(x => setTimeout(x, 300));
      got.afterClose = Array.prototype.slice.call(document.querySelectorAll('body *'))
        .filter(el => el.style && el.style.zIndex === '9800').length;
      return got;
    });
    ok('E23 真点游记卡那枚缩略图会开全屏放大层，再点关掉（这条链断在导出页面上没人报错）',
      !!OVW && OVW.overlay === 1 && OVW.src !== '' && OVW.afterClose === 0, JSON.stringify(OVW));

    await goto('review.html');
    /* review 的缩略图只活在「日详情」那一屏（:605 renderDay），而默认选中的是最近那一天。
       本种子里最近那天恰好是没照片的 s4，所以直接问 `.md-item .thumbs img` 会读成 miss——
       那是种子与页面默认值撞出来的，不是参照物漂了。走真入口：点日历里有照片的那一天。 */
    const RD = await EV(() => {
      var dm = window.dayMap || {}, pick = '';
      Object.keys(dm).sort().forEach(function (d) {
        if ((dm[d] || []).some(function (n) { return n.photos && n.photos.length; })) pick = d;
      });
      var sel = pick ? '.cal-cell[data-d="' + pick + '"]' : '';
      var r = sel ? window.__E.ready(sel, 0) : { miss: true };
      return { pick: pick, cell: !r.miss, cx: r.cx || 0, cy: r.cy || 0, hit: r.hit || '' };
    });
    ok('E24 正向对照的落点能到场：日历里挑得出带照片的那一天，且那一格滚进视口后真能点',
      !!RD.cell && RD.pick !== '' && RD.hit !== 'null', JSON.stringify(RD)
      + '（顶命中读成 null＝那一格在视口外，mouse.click 打不到——上一版就是这么「点过」的）');
    if (RD.cell) await clickAt(RD.cx, RD.cy);
    const RV = await EV(() => {
      var e = document.querySelector('.md-item .thumbs img');
      return e ? { n: document.querySelectorAll('.md-item .thumbs img').length,
        attr: (e.getAttribute('onclick') || '').slice(0, 40) } : { miss: true };
    });
    ok('E25 正向对照 review 那一族仍在场（同族动作的参照物不许先漂）',
      RV.n >= 1 && /zoomPhotoIdx/.test(RV.attr || ''), JSON.stringify(RV));
    const RR = await EV(() => window.__E.ready('.md-item .thumbs img', 0));
    if (!RR.miss) await clickAt(RR.cx, RR.cy);
    ok('E26 正向对照 review 真点开出查看器（这台环境这条路是通的，① 的红才只能归给产品漏接线）',
      !RR.miss && !!(await EV(() => window.__E.viewer())), JSON.stringify(await EV(() => window.__E.viewer())));

    await goto('md-manager.html');
    const MD = await EV(() => {
      var r = window.__E.ready('.md-item .thumbs img', 0);
      return { r: r, artBefore: !!(document.querySelector('#artBox') && document.querySelector('#artBox').offsetParent) };
    });
    if (!MD.r.miss) await clickAt(MD.r.cx, MD.r.cy);
    const MD2 = await EV(() => ({
      art: !!(document.querySelector('#artBox') && document.querySelector('#artBox').offsetParent),
      list: !!document.querySelector('.md-item') && !!document.querySelector('.md-item').offsetParent,
      viewer: window.__E.viewer()
    }));
    ok('E27 md-manager 点缩略图开的是详情（行已可点，不是「点了没反应」——报告 S2-4 的改判靠这一条站住）',
      !MD.r.miss && MD2.art === true && MD2.viewer === null, '点前详情在场=' + MD.artBefore + ' → 点后=' + JSON.stringify(MD2));

    await goto('album-edit.html');
    /* album-edit 的 .n-item 只在「添加记忆」选择器打开之后才在 DOM 里（:233 pickNote 现拼），
       所以这一档必须走真入口：点 #addMemory → 行在场 → 点一行 → 选择器收掉且章节 +1。
       判据读的是 DOM 属性与计数，不是行上有没有内联 onclick——那族行是 JS 绑的（:241），
       拿 getAttribute('onclick') 去问会得到空串，那是探针的锅，不是产品的洞。 */
    const CH0 = await EV(() => document.querySelectorAll('.ed-chapter').length);
    const AM = await EV(() => window.__E.ready('#addMemory', 0));
    if (!AM.miss) await clickAt(AM.cx, AM.cy);
    const PK2 = await EV(() => {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.n-item'));
      var img = document.querySelector('.n-item .th img');
      var r = rows.length ? window.__E.rect(rows[0]) : null;
      return { picker: document.querySelectorAll('.picker').length, n: rows.length,
        cur: rows.length ? getComputedStyle(rows[0]).cursor : '', hasImg: !!img,
        ids: rows.map(e => e.getAttribute('data-id')).filter(Boolean).length,
        cx: r ? r.cx : 0, cy: r ? r.cy : 0, hit: r ? window.__E.label(document.elementFromPoint(r.cx, r.cy)) : '' };
    });
    ok('E28 album-edit「添加记忆」开出的选择器里每一行都带着可点的出口（改判：它不是死图，是「选这篇记忆」）',
      PK2.picker === 1 && PK2.n >= 1 && PK2.ids === PK2.n && PK2.cur === 'pointer' && PK2.hasImg,
      JSON.stringify({ rows: PK2.n, ids: PK2.ids, cursor: PK2.cur, img: PK2.hasImg, hit: PK2.hit }));
    if (PK2.n) await clickAt(PK2.cx, PK2.cy);
    const CH1 = await EV(() => ({ picker: document.querySelectorAll('.picker').length,
      ch: document.querySelectorAll('.ed-chapter').length }));
    ok('E29 真点其中一行之后选择器收掉且章节多出一条（行的出口真的落到编辑稿上）',
      CH1.picker === 0 && CH1.ch === CH0 + 1, '章节 ' + CH0 + ' → ' + CH1.ch + ' ｜ 选择器在场 ' + CH1.picker);

    /* ================= ⑤ 收尾：整条腿没抛出、条数守卫 ================= */
    ok('E30 全程未捕获报错为 0（腿是顺序跑的，中途炸了后面那些「绿」是空转出来的）',
      uncaught === 0, 'pageerror ' + uncaught + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
    ok('E31 条数守卫：本腿判据不少于 31 条（少一条就是有人删了证据，而删证据不会自己红）',
      checks >= 31, 'checks=' + checks);
    say('· 全程被排除的瓦片请求噪声：' + tileNoise + ' 条（静态 http 环境取不到在线瓦片，与本节要量的入口通路无关）');
  } catch (e) {
    ok('E32 两条腿跑完没有抛出（抛出即后面的判据一条都没执行，那种「全绿」是空转）', false, String(e.message).slice(0, 60));
  }

  await browser.close();
  srv.close();
  say('');
  say('=== smoke-entry: ' + checks + ' checks, ' + fails + ' failed ===');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { say('闸门崩：' + e.message); dump(); process.exit(1); });
