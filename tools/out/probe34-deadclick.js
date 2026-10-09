/* probe34-deadclick.js — 批次 34-A 的地基实测：报告 S2-4／S2-5 那两条到底哪几处是真的
 *
 * 为什么要有这一支：报告 §3 第 4 条把四处写在同一张名单上（story.html:137／results.js:328／
 * md-manager.html:420／album-edit.html:236），第 5 条写 me.html 的「最近记录」是死胡同。
 * 逐处读码之后先怀疑这条名单本身：results.js 那两处是**导出文档**的正文，在 app 内被 `saveDoc`
 * 转义成文本预览（results.js:79 `esc(html.slice(0,2000))`），根本不渲染；album-edit 那行的 onclick
 * 是「选这篇的记忆」（album-edit.html:242）；md-manager 的 `.md-item` 整行 onclick 开详情（:428）。
 * 这三条推断必须落成读数，不能只靠读码——尤其不能把「闸门没抓」写成「产品没做」。
 *
 * 四条腿：
 *   ① story.html —— `.sc-pics img` 真鼠标点中心，看查看器（`.tn-viewer`）开不开、图自身有没有 onclick。
 *   ② me.html —— `.rec` 首行真点，读 location.href 变没变、有没有 viewer、行高够不够 44 地板
 *      （一条行如果本来就不达标，接成入口就是造一枚低于地板的新钮，得连尺寸一起量）。
 *   ③ review.html —— **正向对照**：那一页的 `.md-item .thumbs img` 已接 zoomPhotoIdx（批次 30-E），
 *      点同一族动作必须开出查看器。对照不红，① 的红才不是「查看器在这台环境里压根打不开」。
 *   ④ md-manager.html —— 点 `.thumbs img`：如果详情视图被打开，就证明它是「行已可点，只是缩略图
 *      没有独立放大」，与「看得见点不着」不同罪。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、种子直写 IndexedDB（`gujian-notes`/`notes`）、
 * 先打 tn_onboarded 才读、反注册 SW + 关缓存、动画收尾再量、waitForFunction 一律函数式。
 * 落盘名走 PROBE_OUT（批次 31 那次原地覆盖改前读数的教训，见 probe31-divergence.js 头部）。
 *
 * 改后复跑时补的两处（也是这一支自己的坑，写在这是为了让下一份日志别再犯）：
 *   · ①-b —— 首枚缩略图原位就落在底导航带里（改前 ① 读到 hit=a.bottom-nav__item），真点被导航抢走；
 *     所以「接了 onclick 也没用」和「压根没接」必须分两次点才数得清，滚进导航带之上再点一次。
 *   · ② 取点 —— 改前那份日志里 ② 那行「url 未变」是在 cy=916（视口高 723，元素在屏外）点的，
 *     mouse.click 打不到，等于没点。**那一行不算证据**；② 的「死胡同」结论只认同一行里的
 *     onclickAttr / dataGo / cursor 三个 DOM 属性读数（与几何无关）。改后这版先 scrollIntoView 再量再点。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe34-deadclick.js \
 *        > tools/out/b34-probe-deadclick.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8234', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;
const OUT = process.env.PROBE_OUT || path.join(__dirname, 'b34-probe-deadclick.txt');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(OUT, lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
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

const IMGS = ['images/sites/034ab1d51239cd1e.jpg', 'images/sites/04b44c7e76f9c59c.jpg'];

function seedLocal() {
  /* 这一支会被 evaluateOnNewDocument 序列化后在新文档里裸跑，**闭包带不进去**：
     首跑这里写的是外层 const IMGS，页面报 "IMGS is not defined"，于是 seed 一篇没灌，
     四条腿全读 miss=true —— 那是「空跑」不是「产品没做」，所以种子数由腿 0 自校准后再往下量。 */
  var IMGS = ['images/sites/034ab1d51239cd1e.jpg', 'images/sites/04b44c7e76f9c59c.jpg'];
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
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
      /* 三篇都带坐标（story 只收带坐标的）、都带两张图，ts 递增 */
      [['s1', '应县木塔', 39.66, 113.19, '2026-10-02T09:12:00+08:00'],
       ['s2', '云冈石窟', 40.11, 113.13, '2026-10-03T10:30:00+08:00'],
       ['s3', '五台山', 39.08, 113.55, '2026-10-04T08:05:00+08:00']].forEach(function (t, i) {
        os.put({ id: t[0], title: t[1], siteName: t[1], lat: t[2], lng: t[3],
          ts: new Date(t[4]).getTime(), date: t[4].slice(0, 16).replace('T', ' '), day: t[4].slice(0, 10),
          province: '山西', city: '大同', text: '正文' + (i + 1) + '，这一段的字数够多，好让滚动位落在条带下面时能数出被压的行。',
          photos: IMGS.slice(), audio: '', tags: ['实测'], weather: '晴 18℃' });
      });
      tx.oncomplete = function () { db.close(); resolve('seeded-3'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
}

const HELPERS = function () {
  window.__L = {
    label: function (e) {
      if (!e) return 'null';
      var s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
      if (c.length) s += '.' + c.join('.');
      return s.slice(0, 70);
    },
    rect: function (e) {
      var b = e.getBoundingClientRect();
      return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
        cx: Math.round(b.left + b.width / 2), cy: Math.round(b.top + b.height / 2) };
    },
    box: function (sel) {
      var e = document.querySelector(sel);
      if (!e) return { miss: true };
      var r = window.__L.rect(e);
      var hit = document.elementFromPoint(r.cx, r.cy);
      return { n: document.querySelectorAll(sel).length, rect: r.w + '×' + r.h + '@' + r.x + ',' + r.y,
        cx: r.cx, cy: r.cy, hit: window.__L.label(hit),
        own: !!hit && (hit === e || e.contains(hit)),
        onclickAttr: (e.getAttribute('onclick') || '').slice(0, 60),
        cursor: getComputedStyle(e).cursor,
        dataGo: e.getAttribute('data-go') || '' };
    },
    viewer: function () {
      var v = document.querySelector('.tn-viewer');
      if (!v) return null;
      var img = v.querySelector('#tvImg');
      return { idx: (v.querySelector('#tvI') || {}).textContent,
        src: img ? String(img.getAttribute('src') || '').split('/').pop() : '' };
    }
  };
};

async function settle(page, extra) {
  try { await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} })); } catch (e) {}
  await sleep(extra || 500);
}

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
  /* 瓦片请求在本机的静态 http 环境里注定失败（换页时还是一串 ERR_ABORTED），把它们记进另一个计数器：
     混进 errs 之后，「报错 4 条／50 条」这种读数就没法分辨是真页面异常还是环境噪声了。 */
  let tileNoise = 0;
  const isTile = u => /appmaptile|\/tile\//.test(u);
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  page.on('requestfailed', r => {
    const u = String(r.url());
    if (isTile(u)) { tileNoise++; return; }
    errs.push('[请求失败] ' + u.slice(-58) + ' ' + (r.failure() || {}).errorText);
  });
  page.on('response', r => { const u = String(r.url()); if (r.status() === 404 && !isTile(u)) errs.push('[404] ' + u.slice(-58)); });
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 80)); });
  await page.evaluateOnNewDocument(() => {
    try { navigator.serviceWorker && navigator.serviceWorker.getRegistrations
      && navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); } catch (e) {}
  });
  await page.evaluateOnNewDocument(seedLocal);
  await page.evaluateOnNewDocument(HELPERS);

  const P = p => BASE + '/' + p;
  const box = sel => page.evaluate(s => {
    const b = window.__L.box(s);
    b.sel = s;
    return b;
  }, sel);
  const clickAt = async (x, y) => { await page.mouse.click(x, y); await sleep(600); };

  /* ---------------- 腿 0：种子自校准（下面四条腿的 miss 只有在分母不是 0 时才是产品的事） ---------------- */
  say('==================== 腿 0 自校准：种子真的灌进去了吗 ====================');
  await page.goto(P('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1500);
  const ZC = await page.evaluate(() => ({
    seeded: (window.TravelNotes && TravelNotes.list) ? TravelNotes.list().length : -1,
    withPics: (window.TravelNotes && TravelNotes.list)
      ? TravelNotes.list().filter(n => n.photos && n.photos.length).length : -1
  }));
  say('· 库里 ' + ZC.seeded + ' 篇，其中带图的 ' + ZC.withPics + ' 篇（期望各 3）');
  if (ZC.seeded !== 3 || ZC.withPics !== 3) {
    say('· 分母不对，下面所有 miss 都不能算产品缺陷 —— 直接崩，别把空跑写进真值。');
    await browser.close(); srv.close(); dump(); process.exit(2);
  }
  errs.length = 0;

  /* ---------------- ① story：照片框能不能点开 ---------------- */
  say('');
  say('==================== 腿 ① story.html：.sc-pics img ====================');
  const S1 = await box('.story-card .sc-pics img');
  say('· 首枚缩略图：' + JSON.stringify(S1));
  const S1N = await page.evaluate(() => document.querySelectorAll('.story-card .sc-pics img').length);
  const S1Attr = await page.evaluate(() => Array.prototype.filter.call(
    document.querySelectorAll('.story-card .sc-pics img'),
    e => e.getAttribute('onclick')).length);
  say('· 在场缩略图 ' + S1N + ' 枚，其中带 onclick 属性的 ' + S1Attr + ' 枚');
  if (!S1.miss) await clickAt(S1.cx, S1.cy);
  say('· 原位真点之后查看器读数：' + JSON.stringify(await page.evaluate(() => window.__L.viewer()))
    + ' ｜ 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 4).join(' | ') : ''));
  /* 顶命中是底导航那一枚链接，所以这一条必须回答两件事：底导航带在屏上占到哪一行、那一点把用户带去哪儿 */
  const NB = await page.evaluate(() => {
    var n = document.querySelector('.bottom-nav') || document.querySelector('a.bottom-nav__item');
    if (!n) return null;
    var r = n.getBoundingClientRect();
    return { el: window.__L.label(n), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  });
  say('· 底导航带：' + JSON.stringify(NB) + '（视口高 ' + VH + '，落在这一带里的内容点了归导航，不归内容）');
  say('· 那一点之后 url：' + page.url().slice(-46));
  errs.length = 0;
  /* ①-b 把同一枚缩略图滚进视口中位（顶/底两条带之外）再点：这一条分清「接线没接上」与
     「接上了但手指落点被浮带抢走」。上一条的 click 已经把人带去 travel-map，所以这里必须重新进站。 */
  await page.goto(P('story.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1500);
  const SB = await page.evaluate(() => {
    var e = document.querySelector('.story-card .sc-pics img');
    if (!e) return { miss: true };
    e.scrollIntoView({ block: 'center' });
    var r = e.getBoundingClientRect();
    return { rect: Math.round(r.width) + '×' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top),
      cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
      hit: window.__L.label(document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))) };
  });
  say('· 滚进视口中位之后同一枚：' + JSON.stringify(SB) + '（block:start 会把这枚送到 y=0，中心命中的是吸顶的 .story-bar——取点又要落在两条浮带之外才算点它）');
  if (!SB.miss) await clickAt(SB.cx, SB.cy);
  say('· 滚进视口后真点：查看器 ' + JSON.stringify(await page.evaluate(() => window.__L.viewer()))
    + ' ｜ url ' + page.url().slice(-30) + ' ｜ 报错 ' + errs.length + ' 条'
    + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- ② me：最近记录那一行点了走不走 ---------------- */
  say('');
  say('==================== 腿 ② me.html：#meRecent .rec ====================');
  await page.goto(P('me.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1400);
  const M1 = await box('#meRecent .rec');
  say('· 首行读数（未滚动）：' + JSON.stringify(M1));
  const MH = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#meRecent .rec'), e => Math.round(e.getBoundingClientRect().height)));
  say('· 各行实测高度：' + JSON.stringify(MH) + '（项目自定地板 44，见 design.css 触控口径那段）');
  /* 首屏在 328×723 里排不到这一行（cy 落在视口外，mouse.click 到不了），必须滚进视口再点——
     上一条腿的「url 未变」就是这样读出来的，那不是产品结论，是取点错了。 */
  const MC = await page.evaluate(() => {
    var e = document.querySelector('#meRecent .rec');
    if (!e) return { miss: true };
    e.scrollIntoView({ block: 'center' });
    var r = e.getBoundingClientRect();
    return { rect: Math.round(r.width) + '×' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top),
      cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
      hit: window.__L.label(document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))) };
  });
  say('· 滚进视口后首行：' + JSON.stringify(MC));
  const before = page.url();
  if (!MC.miss) await clickAt(MC.cx, MC.cy);
  const after = page.url();
  say('· 真点首行之后：url ' + (before === after ? '未变（' + after.slice(-24) + '）' : '变成 ' + after.slice(-40))
    + ' ｜ 查看器 ' + JSON.stringify(await page.evaluate(() => window.__L.viewer())));
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- ③ 正向对照：review 那一族已接放大 ---------------- */
  say('');
  say('==================== 腿 ③ 正向对照 review.html：同一族动作必须开查看器 ====================');
  await page.goto(P('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1600);
  const R0 = await page.evaluate(() => {
    var e = document.querySelector('.md-item .thumbs img');
    return e ? { n: document.querySelectorAll('.md-item .thumbs img').length,
      attr: (e.getAttribute('onclick') || '').slice(0, 46) } : { miss: true };
  });
  say('· 对照落点在场性：' + JSON.stringify(R0));
  let Rb = null;
  try {
    await page.evaluate(() => {
      window.__R = null;
      var e = document.querySelector('.md-item .thumbs img');
      e.scrollIntoView({ block: 'center' });
      var r = e.getBoundingClientRect();
      window.__R = { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) };
    });
    Rb = await page.evaluate(() => window.__R);
  } catch (e) { say('· 对照取点失败：' + e.message.slice(0, 60)); }
  if (Rb) await clickAt(Rb.cx, Rb.cy);
  const RV = await page.evaluate(() => window.__L.viewer());
  say('· 真点对照之后查看器读数：' + JSON.stringify(RV)
    + '（这一条必须不是 null，否则 ①／② 的「没反应」就分不清是产品漏接线还是这台环境打不开查看器）');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- ④ md-manager：缩略图所在行本就有出口 ---------------- */
  say('');
  say('==================== 腿 ④ md-manager.html：点 .thumbs img 走的是行的出口 ====================');
  await page.goto(P('md-manager.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1500);
  const D0 = await box('.md-item .thumbs img');
  say('· 首枚缩略图：' + JSON.stringify(D0));
  const V1 = await page.evaluate(() => ({
    art: !!(document.querySelector('#artBox') && document.querySelector('#artBox').offsetParent),
    list: !!document.querySelector('.md-item') && !!document.querySelector('.md-item').offsetParent
  }));
  say('· 点之前：详情视图在场=' + V1.art + '｜列表在场=' + V1.list);
  if (!D0.miss) await clickAt(D0.cx, D0.cy);
  const V2 = await page.evaluate(() => ({
    art: !!(document.querySelector('#artBox') && document.querySelector('#artBox').offsetParent),
    list: !!document.querySelector('.md-item') && !!document.querySelector('.md-item').offsetParent,
    viewer: window.__L.viewer()
  }));
  say('· 点之后：详情视图在场=' + V2.art + '｜列表在场=' + V2.list + '｜查看器=' + JSON.stringify(V2.viewer));
  say('   （若详情开了而查看器没开＝行已可点、只是缩略图没有独立放大；这与「点了没反应」不同罪）');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));

  say('');
  say('==================== 附：results.js 那两处的渲染上下文（导出件在 app 内是文本预览） ====================');
  say('· 这一条不靠浏览器：results.js:79 把 docShell 的 html 用 esc() 塞进 #rzPrev 当纯文本，'
    + 'results.js:328/:353 的 <img> 只存在于另存为 .html 之后那份文档里，屏上没有那一枚。');
  say('· 读数存证（源码原文，逐字节从盘上读）：');
  try {
    const rs = fs.readFileSync(path.join(ROOT, 'results.js'), 'utf8').split(/\r?\n/);
    say('  results.js:79 → ' + rs[78].trim().slice(0, 150));
    say('  results.js:328 → ' + rs[327].trim().slice(0, 120));
  } catch (e) { say('  （读 results.js 失败：' + e.message.slice(0, 40) + '）'); }

  await browser.close();
  srv.close();
  say('');
  say('· 全程被排除的瓦片请求噪声：' + tileNoise + ' 条（静态 http 环境里取不到在线瓦片，与这一支要量的四条腿无关，单记不混进 errs）');
  say('=== probe34 结束 ===');
})().catch(e => { say('探针崩：' + e.message); dump(); process.exit(1); });
