/* probe34-deadlink.js — 批次 34-B 的地基实测：travel-map.html 的 ?id= 深链到底走没走
 *
 * 为什么要有这一支：上一条腿（probe34-deadclick）给 me.html 的「最近记录」接的出口就是
 * `travel-map.html?id=`，而这条链是**首页搜索栏、search.html:216 已经在用的同一条**。
 * 读码看到的形状很可疑：那段自执行函数（travel-map.html:708）在**脚本解析期**就调
 * `TravelNotes.list()`，而 `list()` 返回的是模块内 `notes`（travel-notes.js:2378），
 * `notes` 只有 `loadNotes()` 走完 IndexedDB 事务才被灌上（:190、:2341），
 * 而 `TravelNotes.init({})` 在 :812 才被调用——**708 行跑得比它早**。
 * 若推断成立，这条链从写下来那天起就是静默 no-op：不 flyTo、不改统计条那行字、也不说为什么。
 * 这是「闸门没抓」还是「产品没做」必须有读数，不能停在读码。
 *
 * 七条腿：
 *   ① 插桩直读：在任意页面脚本之前把 `window.TravelNotes` 做成带 setter 的访问器，
 *      每次有人调 `list()` 就记下返回条数 + 调用处 + 当时的 document.readyState。
 *      这一条回答「708 那次调用看到的分母是不是 0」，是整支探针的地基。
 *   ② 效果读数：`travel-map.html?id=s2`，等载入完成（远超那个 500ms）后读
 *      统计条那行字（`#statMain`）与地图中心/缩放对没对上 s2 的坐标。
 *      改前期望＝字是「游记 N 篇…」（refresh 覆盖后的常态）、中心是全体 fitBounds，不是 s2。
 *   ③ 正向对照：同页 `?lat=&lng=&name=`（:710，那条不需要 notes）必须真的 flyTo 并把那行字
 *      改成「已定位：…」。对照绿 ⇒ ② 的静默不是「这台环境 flyTo/receipt 这条路不通」，
 *      而是「那条链压根没跑到」。
 *   ④ 缺坐标那篇（种子 s4，lat/lng 为 null）：`?id=s4` 现在读成什么。
 *      这一条是给修法用的——命中但定位不了时该说一句什么，而不是继续静默。
 *   ⑤ id 根本不存在（删除后的旧链接／手打错）：回执不许只有「定位成功」一种。
 *   ⑥ 手打的坏串 `?id=%zz`：给修法里那句 try 用的——decodeURIComponent('%zz') 抛 URIError
 *      （node 里直接验过一次：THROW URIError: URI malformed），抛了就等于把载入回调整条打断。
 *   ⑦ 端到端：me.html 那一行点下去 → 落地页真把地图带到那一篇。入口与深链两段各自绿
 *      不代表接起来绿，② 只证明深链本身能跑。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http、seed 直写 IndexedDB、
 * 反注册 SW + 关缓存、打 tn_onboarded 才读、动画收尾再量、waitForFunction 一律函数式。
 * 落盘名走 PROBE_OUT（不覆写改前真值）。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe34-deadlink.js \
 *        > tools/out/b34-probe-deadlink.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8241', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;
const OUT = process.env.PROBE_OUT || path.join(__dirname, 'b34-probe-deadlink.txt');

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

/* s1–s3 带坐标带图，s4 故意没有坐标（④ 那条腿的靶子）。全部 ts 递增。 */
function seedLocal() {
  /* 会被 evaluateOnNewDocument 序列化后裸跑，闭包带不进去——所有值写死在这里（教训见
     probe34-deadclick.js:65 头部：首跑就是靠外层 const 打成 0 种子空跑。 */
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
      [['s1', '应县木塔', 39.66, 113.19, '2026-10-02T09:12:00+08:00'],
       ['s2', '云冈石窟', 40.11, 113.13, '2026-10-03T10:30:00+08:00'],
       ['s3', '五台山', 39.08, 113.55, '2026-10-04T08:05:00+08:00']].forEach(function (t, i) {
        os.put({ id: t[0], title: t[1], siteName: t[1], lat: t[2], lng: t[3],
          ts: new Date(t[4]).getTime(), date: t[4].slice(0, 16).replace('T', ' '), day: t[4].slice(0, 10),
          province: '山西', city: '大同', text: '正文' + (i + 1) + '，够长的一段，让节点信息框和游记卡都有内容可读。',
          photos: ['images/sites/034ab1d51239cd1e.jpg'], audio: '', tags: ['实测'], weather: '晴 18℃' });
      });
      os.put({ id: 's4', title: '没有坐标的一篇', siteName: '没有坐标的一篇', lat: null, lng: null,
        ts: new Date('2026-10-05T11:20:00+08:00').getTime(), date: '2026-10-05 11:20', day: '2026-10-05',
        province: '山西', city: '太原', text: '这一篇只为了测「命中但地图上定位不了」那一档该给用户读什么。',
        photos: [], audio: '', tags: [], weather: '' });
      tx.oncomplete = function () { db.close(); resolve('seeded-4'); };
      tx.onerror = function () { db.close(); resolve('write-fail'); };
    };
    r1.onerror = function () { resolve('open-fail'); };
  });
}

/* 腿 ① 的插桩：必须在页面任何脚本之前装好，所以走 evaluateOnNewDocument，且内部不许引用外部变量 */
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
              window.__LISTCALLS.push({ n: r.length, ready: document.readyState, at: st.slice(0, 120) });
            } catch (e) {}
            return r;
          };
        } catch (e) {}
      }
    });
  } catch (e) { window.__LISTERR = String(e.message).slice(0, 60); }
}

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
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  page.on('response', r => { if (r.status() === 404) errs.push('[404] ' + String(r.url()).slice(-40)); });
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 70)); });
  await page.evaluateOnNewDocument(() => {
    try { navigator.serviceWorker && navigator.serviceWorker.getRegistrations
      && navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); } catch (e) {}
  });
  await page.evaluateOnNewDocument(seedLocal);
  await page.evaluateOnNewDocument(instrumentList);

  const P = p => BASE + '/' + p;
  const readMap = () => page.evaluate(() => {
    try {
      var c = map.getCenter();
      return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), zoom: Math.round(map.getZoom() * 10) / 10 };
    } catch (e) { return { err: String(e.message).slice(0, 40) }; }
  });
  const readStat = () => page.evaluate(() => {
    var sm = document.getElementById('statMain');
    return sm ? sm.textContent : '(无 #statMain)';
  });
  const readCalls = () => page.evaluate(() => window.__LISTCALLS.slice(0));

  /* ---------------- 腿 0：种子自校准（分母不对，下面所有读数都不算产品的事） ---------------- */
  say('==================== 腿 0 自校准 ====================');
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1800);
  const ZC = await page.evaluate(() => ({
    n: (window.TravelNotes && TravelNotes.list) ? TravelNotes.list().length : -1,
    markerless: (window.TravelNotes && TravelNotes.list)
      ? TravelNotes.list().filter(x => x.lat == null).length : -1
  }));
  say('· 库里 ' + ZC.n + ' 篇，其中不带坐标的 ' + ZC.markerless + ' 篇（期望 4 与 1）');
  if (ZC.n !== 4 || ZC.markerless !== 1) {
    say('· 分母不对，直接崩——不把空跑写进真值。');
    await browser.close(); srv.close(); dump(); process.exit(2);
  }
  errs.length = 0;

  /* ---------------- 腿 ①：?id= 那次 list() 调用看到的分母 ---------------- */
  say('');
  say('==================== 腿 ① 插桩：?id=s2 全页 list() 调用序列 ====================');
  await page.goto(P('travel-map.html?id=s2'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 2200);
  const C1 = await readCalls();
  say('· 插桩本身是否生效：' + (C1.length ? '生效（抓到 ' + C1.length + ' 次调用）' : '没抓到任何调用＝插桩失效，下面②③④ 只能算间接证据'));
  C1.slice(0, 8).forEach((c, i) => say('   #' + i + ' n=' + c.n + ' readyState=' + c.ready + ' ｜ ' + c.at));
  /* 栈里那个文件名带查询串（travel-map.html?id=s2:708:97），所以选择器不能写死 `html:708`——
     首跑这里写 /travel-map\.html:708/ 打成 0 命中，而 #0 那行明明就是 :708：判据自己的正则漏了，
     差点把「有读数」写成「没抓到」。中段用 [^:]* 兼容查询串，改后那版认函数名。 */
  const isDeep708 = c => /travel-map[^:]*:708/.test(c.at);
  const isLocate = c => /locateDeepNote/.test(c.at);
  const early = C1.filter(c => isDeep708(c) || isLocate(c));
  const loading = C1.filter(c => c.ready === 'loading');
  say('· 解析期（readyState=loading）发生的调用 ' + loading.length + ' 次，条数：' + JSON.stringify(loading.map(c => c.n)));
  say('· 命中深链那一处（:708 旧形状或 locateDeepNote 新形状）的调用 ' + early.length + ' 次'
    + '，看到的条数：' + JSON.stringify(early.map(c => c.n))
    + ' ｜ 形状：' + JSON.stringify(early.map(c => (isDeep708(c) ? '解析期:708' : '载入后locateDeepNote'))));
  say('· 判据：条数为 0 ⇒ 那个 for/find 一次都没进过，深链是 no-op；条数为全量 ⇒ 找得到那篇。');
  say('· 读码对账（源码原文，逐字节从盘上读）：');
  try {
    const tm = fs.readFileSync(path.join(ROOT, 'travel-map.html'), 'utf8').split(/\r?\n/);
    say('  travel-map.html:708 → ' + tm[707].trim().slice(0, 118));
    say('  travel-map.html:810 → ' + tm[809].trim().slice(0, 70));
    say('  travel-map.html:812 → ' + tm[811].trim().slice(0, 70));
    const tn = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8').split(/\r?\n/);
    say('  travel-notes.js:2378 → ' + tn[2377].trim().slice(0, 60));
    say('  travel-notes.js:2341 → ' + tn[2340].trim().slice(0, 60));
  } catch (e) { say('  （读源失败：' + e.message.slice(0, 40) + '）'); }

  /* ---------------- 腿 ②：效果读数——用户到底看见什么 ---------------- */
  say('');
  say('==================== 腿 ② 效果：?id=s2 载入完成后（s2 应在 40.11,113.13） ====================');
  say('· 统计条那行字：' + JSON.stringify(await readStat()));
  say('· 地图中心/缩放：' + JSON.stringify(await readMap()));
  const G02 = await page.evaluate(() => {
    var v = document.querySelector('.tn-viewer');
    var pop = document.querySelector('.leaflet-popup');
    return { viewer: !!v, popup: !!pop };
  });
  say('· 顺带读数（这条链本来说明跳详情）：' + JSON.stringify(G02));
  say('· 期望（改前）：那行字是「游记 4 篇 · 地点 3 处」这一类常态读数，不是「已定位：…」；'
    + '中心是全体 fitBounds 的结果，跟 s2 那一点无关。');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- 腿 ③：正向对照——同页另一条不依赖 notes 的链必须真生效 ---------------- */
  say('');
  say('==================== 腿 ③ 正向对照：?lat=&lng=&name= 必须 flyTo 并改那行字 ====================');
  await page.goto(P('travel-map.html?lat=40.11&lng=113.13&name=' + encodeURIComponent('云冈石窟')),
    { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 2400);
  say('· 统计条那行字：' + JSON.stringify(await readStat()));
  say('· 地图中心/缩放：' + JSON.stringify(await readMap()));
  say('· 这一条绿才说明 :710 那套 flyTo + #statMain 回执在本环境是通的，'
    + '于是 ② 的静默只能归给 :708「解析期读空数组」，不能赖环境。');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- 腿 ④：命中但没坐标那一篇 ---------------- */
  say('');
  say('==================== 腿 ④ 缺坐标那篇：?id=s4 读成什么 ====================');
  await page.goto(P('travel-map.html?id=s4'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 2200);
  say('· 统计条那行字：' + JSON.stringify(await readStat()));
  say('· 地图中心/缩放：' + JSON.stringify(await readMap()));
  const C4 = await readCalls();
  const early4 = C4.filter(c => isDeep708(c) || isLocate(c));
  say('· 深链那处调用看到的条数：' + JSON.stringify(early4.map(c => c.n)) + '（这一条与 ② 同因，写在这里是给修法留的前后对照）');
  say('· 这一档即便把解析期改成载入后再找，也仍要落一句可读回执：命中了但地图上没有那一点，'
    + '不能和用户点进来的期望之间留一片空白。');

  /* ---------------- 腿 ⑤：id 根本不存在（删除后旧链接／手打错） ---------------- */
  say('');
  say('==================== 腿 ⑤ id 不存在：?id=nope 读成什么 ====================');
  await page.goto(P('travel-map.html?id=nope'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 2200);
  say('· 统计条那行字：' + JSON.stringify(await readStat()));
  say('· 地图中心/缩放：' + JSON.stringify(await readMap()));
  say('· 这一档和 ④ 是同一条纪律的两端：找不到那篇也要说出来，回执不许只有「定位成功」一种。');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  errs.length = 0;

  /* ---------------- 腿 ⑥：坏 % 串——decodeURIComponent 会不会把 _onReady 打断 ---------------- */
  say('');
  say('==================== 腿 ⑥ 手打的坏串：?id=%zz ====================');
  try {
    await page.goto(BASE + '/travel-map.html?id=%zz', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle(page, 2200);
  } catch (e) { say('· goto 本身被拒（' + String(e.message).slice(0, 46) + '）——这一条只能算导航层拦掉了，读不到产品层'); }
  say('· 统计条那行字：' + JSON.stringify(await readStat()));
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.join(' | ') : '')
    + '（这一条是给修法里那句 try 用的：外面传进来的串，decodeURIComponent 会抛 URIError，'
    + '抛了就等于把载入回调整条打断）');

  /* ---------------- 腿 ⑦ 端到端：me 那一行点下去，落地页真把人带到那篇了吗 ---------------- */
  say('');
  say('==================== 腿 ⑦ 端到端 me.html 那一行 → travel-map 定位到那一篇 ====================');
  await page.goto(P('me.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1600);
  const ME = await page.evaluate(() => {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#meRecent .rec'));
    /* 这一支的种子把「最新那篇」排成没有坐标的 s4（⑦ 首跑就是这么读到的：落地页老实说了那句
       「没有坐标，地图上定位不了」）。要验的是打通的那条正向通路，所以这里挑第一行**带坐标**的，
       按 id 回库里判，不写死 s3——写死一次就再也发现不了入口排序变了。 */
    var pick = null;
    for (var i = 0; i < rows.length; i++) {
      var id = ((rows[i].getAttribute('data-go') || '').match(/id=(.+)$/) || [])[1] || '';
      var nn = TravelNotes.list().filter(function (n) { return n.id === id; })[0];
      if (nn && nn.lat != null) { pick = { row: i, id: id, t: nn.title, lat: nn.lat, lng: nn.lng }; break; }
    }
    if (!pick) return { miss: true, rows: rows.length };
    var e = rows[pick.row];
    e.scrollIntoView({ block: 'center' });
    var r = e.getBoundingClientRect();
    pick.go = e.getAttribute('data-go');
    pick.cx = Math.round(r.left + r.width / 2);
    pick.cy = Math.round(r.top + r.height / 2);
    pick.rows = rows.length;
    return pick;
  });
  say('· 在场 ' + ME.rows + ' 行，挑中带坐标那行：' + JSON.stringify(ME) + '（未滚动时这些行都在视口外，取点必须先滚进来）');
  if (!ME.miss) { await page.mouse.click(ME.cx, ME.cy); await sleep(1000); }
  await settle(page, 2400);
  say('· 点击之后 url：' + page.url().slice(-40));
  say('· 落地页统计条那行字：' + JSON.stringify(await readStat()));
  say('· 落地页地图中心/缩放：' + JSON.stringify(await readMap()));
  say('· 这一条是给用户的那条完整通路：入口 + 深链两段各自绿不代表接起来绿（② 只证明深链本身能跑）。');
  say('· 页面报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));

  say('');
  say('==================== 附：全站 ?id= 的入口清单（谁在往这条链上送人） ====================');
  try {
    const hits = [];
    fs.readdirSync(ROOT).filter(x => /\.html$/.test(x) || /\.js$/.test(x)).forEach(x => {
      const s = fs.readFileSync(path.join(ROOT, x), 'utf8').split(/\r?\n/);
      s.forEach((l, i) => { if (/travel-map\.html\?id=/.test(l)) hits.push(x + ':' + (i + 1)); });
    });
    say('· 引用「travel-map.html?id=」的落点 ' + hits.length + ' 处：' + hits.join(' | '));
  } catch (e) { say('· 扫描失败：' + e.message.slice(0, 50)); }

  await browser.close();
  srv.close();
  say('');
  say('=== probe34-deadlink 结束 ===');
})().catch(e => { say('探针崩：' + e.message); dump(); process.exit(1); });
