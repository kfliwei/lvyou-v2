/* tools/smoke-backup.js — 批次 8 备份/云同步行为验证
 * 起两个服务：静态页（PORT）+ WebDAV 桩（DAV_PORT），在真浏览器里跑 settings.html：
 *   采集白名单 / 密钥禁入 / 合并语义 / 替换式恢复 / 刷新后 IDB 真落盘 /
 *   push（401 → 409 → MKCOL → PUT）/ pull 合并 / pull 覆盖 / 离线 / 自动上传防抖
 * 截图入 tools/out/shots/<本地日期>-b8-backup/。NODE_PATH 需指到 tools/node_modules。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const webdav = require('./webdav-stub');

const ROOT = path.resolve(__dirname, '..');
const _d = new Date();
const OUT = path.join(__dirname, 'out', 'shots',
  [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-') + '-b8-backup');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8131', 10);
const DAV_PORT = parseInt(process.env.DAV_PORT || '8791', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const SECRET_AI = 'SECRET-AI-KEY-DO-NOT-SYNC';
const SECRET_DS = 'SECRET-DS-KEY-DO-NOT-SYNC';
const SECRET_AMAP = 'SECRET-AMAP-KEY';
const SECRET_PHOTO = 'SECRET-BASE64-PHOTO-CACHE';

const results = [];
function check(name, ok, detail) {
  results.push({ name: name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail == null ? '' : '   [' + detail + ']'));
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* 页内种子：IDB 两篇游记 + 一本图册，localStorage 业务键 + 三类禁入密钥 */
function seedInPage(s) {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_wishlist', JSON.stringify([{ id: '鹳雀楼|40.5|110.2', label: '鹳雀楼', lat: 40.5, lng: 110.2, ts: 1, visited: 0 }]));
    localStorage.setItem('tn_trips', JSON.stringify([{ id: 'p1', name: '川西6日', days: [] }]));
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'u1', name: '我家', lat: 1, lng: 2 }]));
    localStorage.setItem('tn_dayMoods', JSON.stringify({ '2026-10-01': '晴·好' }));
    localStorage.setItem('tn_recent', JSON.stringify([{ n: '鹳雀楼', k: 'shanxi', ts: 1 }]));
    localStorage.setItem('tn_search_hist', JSON.stringify(['黄河']));
    localStorage.setItem('tn_mappos_t', JSON.stringify({ lat: 30, lng: 104, zoom: 6 }));
    localStorage.setItem('tn_dark', 'auto');
    localStorage.setItem('tn_model_deepseek', 'deepseek-v4-flash');
    localStorage.setItem('tn_aiKey', s.ai);
    localStorage.setItem('tn_key_deepseek', s.ds);
    localStorage.setItem('tn_amap_key', s.amap);
    localStorage.setItem('tn_photo_鹳雀楼', JSON.stringify({ ts: 1, u: 'data:image/png;base64,' + s.photo }));
    localStorage.setItem('tn_storefail_warned', '1');

    var notes = [
      { id: 'sm_a', title: 'A 鹳雀楼', siteName: '鹳雀楼', ts: 1000, date: '2026-10-01', day: '2026-10-01', city: '运城', text: '本地原文 A', photos: [], audio: '' },
      { id: 'sm_b', title: 'B 永济', siteName: '永济', ts: 2000, date: '2026-10-02', day: '2026-10-02', city: '运城', text: '本地原文 B', photos: [], audio: '' }
    ];
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
      var st = tx.objectStore('notes');
      st.clear();
      notes.forEach(function (n) { st.put(n); });
      tx.oncomplete = function () {
        var r2 = indexedDB.open('trace-albums', 2);
        r2.onupgradeneeded = function (ev) {
          var d2 = ev.target.result;
          if (!d2.objectStoreNames.contains('albums')) d2.createObjectStore('albums', { keyPath: 'id' });
        };
        r2.onsuccess = function (ev) {
          var d2 = ev.target.result;
          var t2 = d2.transaction('albums', 'readwrite');
          var s2 = t2.objectStore('albums');
          s2.clear();
          s2.put({ id: 'album_sm1', title: '测试图册', pages: [] });
          t2.oncomplete = function () { db.close(); d2.close(); resolve('seeded'); };
          t2.onerror = function () { db.close(); resolve('album-write-fail'); };
        };
        r2.onerror = function () { db.close(); resolve('album-open-fail'); };
      };
      tx.onerror = function () { db.close(); resolve('notes-write-fail'); };
    };
    r1.onerror = function () { resolve('notes-open-fail'); };
  });
}

function pageCollect() {
  return new Promise(function (res) { window.Backup.collect(function (e, env) { res({ err: e && e.message, env: e ? null : env }); }); });
}

async function main() {
  const server = staticServer();
  await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });
  const stub = await new Promise(function (r) {
    webdav.start({ port: DAV_PORT, user: 'trace', pass: 'rightpass' }, r);
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  page.on('pageerror', function (e) { console.log('PAGEERROR ' + e.message); });

  const load = async function (reseed) {
    await page.goto(BASE + '/settings.html', { waitUntil: 'load', timeout: 30000 });
    await sleep(900);
    if (reseed) {
      await page.evaluate(seedInPage, { ai: SECRET_AI, ds: SECRET_DS, amap: SECRET_AMAP, photo: SECRET_PHOTO });
      await page.reload({ waitUntil: 'load' });
      await sleep(1100);
    }
  };

  await load(true);
  check('种子就绪：游记从 IDB 载入内存', (await page.evaluate(function () { return window.TravelNotes ? TravelNotes.list().length : -1; })) === 2,
    await page.evaluate(function () { return TravelNotes.list().map(function (n) { return n.id; }).join(','); }));

  /* ---------- 采集 ---------- */
  const col = await page.evaluate(pageCollect);
  const env = col.env;
  check('Backup.collect 无错且拿到 2 篇游记 + 1 本图册', !col.err && env && env.notes.length === 2 && env.albums.length === 1,
    col.err || (env && (env.notes.length + ' notes / ' + env.albums.length + ' albums')));
  check('备份包 schema=2 且 kind 正确', env && env.schema === 2 && env.kind === 'trace-backup-full', env && env.kind);

  const dataKeys = Object.keys(env.storage.data).sort();
  const prefKeys = Object.keys(env.storage.prefs).sort();
  const positive = ['tn_wishlist', 'tn_trips', 'tn_userNodes', 'tn_dayMoods', 'tn_recent', 'tn_search_hist'];
  check('正向对照：6 个业务键全部入包', positive.every(function (k) { return dataKeys.indexOf(k) >= 0; }), dataKeys.join(','));
  check('前缀规则：tn_mappos_t 归到 prefs', prefKeys.indexOf('tn_mappos_t') >= 0, prefKeys.join(','));
  check('前缀规则：tn_model_deepseek 入包（模型名不是密钥）', prefKeys.indexOf('tn_model_deepseek') >= 0, prefKeys.join(','));

  const text = JSON.stringify(env);
  const secretsOut = [SECRET_AI, SECRET_DS, SECRET_AMAP, SECRET_PHOTO].filter(function (s) { return text.indexOf(s) >= 0; });
  check('密钥值一个都不在备份里', secretsOut.length === 0, secretsOut.join(',') || 'clean');
  const bannedNames = ['tn_aiKey', 'tn_key_deepseek', 'tn_amap_key', 'tn_photo_鹳雀楼', 'tn_storefail_warned']
    .filter(function (k) { return dataKeys.indexOf(k) >= 0 || prefKeys.indexOf(k) >= 0; });
  check('禁入键名被白名单挡在外面（含媒体缓存与一次性告警位）', bannedNames.length === 0, bannedNames.join(',') || 'blocked');
  check('serialize 带哨兵扫描：把禁入键塞回去就拒绝出包', await page.evaluate(function (k) {
    var e = { kind: 'trace-backup-full', schema: 2, notes: [], albums: [], storage: { data: {}, prefs: {} } };
    e.storage.prefs[k] = 'x';
    try { window.Backup.serialize(e); return 'no-throw'; } catch (err) { return /禁入键/.test(err.message) ? 'threw' : 'wrong-throw:' + err.message; }
  }, 'tn_key_deepseek') === 'threw');

  /* ---------- 校验 ---------- */
  check('validate 接受自己出的包', await page.evaluate(function (t) { return window.Backup.validate(t).ok === true; }, text));
  const v1 = await page.evaluate(function () {
    return window.Backup.validate(JSON.stringify({ schema: 1, notes: [] }));
  });
  check('validate 拒绝旧版单游记备份并说明原因', v1.ok === false && /schema/.test(v1.error), v1.error);
  const vBad = await page.evaluate(function () {
    return window.Backup.validate(JSON.stringify({ kind: 'trace-backup-full', schema: 2, notes: 'x' }));
  });
  check('validate 拒绝结构不符的包', vBad.ok === false, vBad.error);

  /* ---------- 合并语义（纯函数） ---------- */
  const merge = await page.evaluate(function () {
    var local = [{ id: 'a', v: 'L' }, { id: 'b', v: 'L' }];
    var remote = [{ id: 'b', v: 'R' }, { id: 'c', v: 'R' }];
    var lp = window.Backup.mergeById(local, remote, 'local');
    var rp = window.Backup.mergeById(local, remote, 'remote');
    return {
      localIds: lp.map(function (x) { return x.id; }).join(','),
      localB: lp.filter(function (x) { return x.id === 'b'; })[0].v,
      remoteB: rp.filter(function (x) { return x.id === 'b'; })[0].v,
      dict: window.Backup.mergeDict({ d1: 'L', d2: 'L' }, { d2: 'R', d3: 'R' }, 'local')
    };
  });
  check('mergeById 取并集（a,b,c 三条都在）', merge.localIds === 'a,b,c', merge.localIds);
  check('同 id 冲突：本机优先时留本机版', merge.localB === 'L', merge.localB);
  check('同 id 冲突：指定云端优先时留云端版', merge.remoteB === 'R', merge.remoteB);
  check('mergeDict 按属性并集且同名本机赢', merge.dict.d1 === 'L' && merge.dict.d3 === 'R' && merge.dict.d2 === 'L', JSON.stringify(merge.dict));

  /* ---------- 恢复：合并模式 ---------- */
  const mergedEnv = {
    kind: 'trace-backup-full', schema: 2, createdAt: Date.now(), app: 'trace',
    notes: [
      { id: 'sm_a', title: 'A 鹳雀楼', ts: 1000, text: '云端改写版 A', photos: [], audio: '' },
      { id: 'sm_c', title: 'C 蒲津渡', ts: 3000, text: '云端新记录', photos: [], audio: '' }
    ],
    albums: [{ id: 'album_sm2', title: '云端图册' }],
    storage: {
      data: { tn_wishlist: JSON.stringify([{ id: '西厢记|1|2', label: '西厢记', lat: 1, lng: 2, ts: 9, visited: 0 }]) },
      prefs: { tn_font: 'lg', tn_dark: 'dark' }
    }
  };
  const applyMerge = await page.evaluate(function (e) {
    return new Promise(function (res) { window.Backup.apply(e, { mode: 'merge', prefer: 'local' }, function (err, st) { res({ err: err && err.message, st: st }); }); });
  }, mergedEnv);
  check('apply(merge) 无错', !applyMerge.err, applyMerge.err);
  const afterMerge = await page.evaluate(function () {
    var l = TravelNotes.list();
    return {
      ids: l.map(function (n) { return n.id; }).join(','),
      textA: (l.filter(function (n) { return n.id === 'sm_a'; })[0] || {}).text,
      wish: JSON.parse(localStorage.getItem('tn_wishlist')).map(function (x) { return x.id; }).join(','),
      font: localStorage.getItem('tn_font'),
      dark: localStorage.getItem('tn_dark'),
      trips: JSON.parse(localStorage.getItem('tn_trips')).length
    };
  });
  check('合并恢复：云端新记录进来（a,b,c 三篇）', afterMerge.ids === 'sm_a,sm_b,sm_c', afterMerge.ids);
  check('合并恢复：同 id 的本机原文没被云端版盖掉', afterMerge.textA === '本地原文 A', afterMerge.textA);
  check('合并恢复：想去清单按 id 并集（本机的鹳雀楼 + 云端的西厢记）', afterMerge.wish === '鹳雀楼|40.5|110.2,西厢记|1|2', afterMerge.wish);
  check('合并恢复：本机没有的偏好从云端补进来（tn_font）', afterMerge.font === 'lg', afterMerge.font);
  check('合并恢复：本机已有的偏好保持不动（tn_dark）', afterMerge.dark === 'auto', afterMerge.dark);
  check('合并恢复：本机独有的数据键原样保留（tn_trips）', afterMerge.trips === 1, String(afterMerge.trips));

  await page.reload({ waitUntil: 'load' });
  await sleep(1100);
  const persisted = await page.evaluate(function () { return TravelNotes.list().map(function (n) { return n.id; }).join(','); });
  check('刷新后仍是 3 篇：恢复真的写进了 IndexedDB（replaceNotes 走 persist 通道）', persisted === 'sm_a,sm_b,sm_c', persisted);
  const albumsNow = await page.evaluate(function () {
    return new Promise(function (res) {
      var db = indexedDB.open('trace-albums', 2);
      db.onsuccess = function () {
        var rq = db.result.transaction('albums', 'readonly').objectStore('albums').getAll();
        rq.onsuccess = function () { res(rq.result.map(function (a) { return a.id; }).sort().join(',')); db.result.close(); };
        rq.onerror = function () { res('read-fail'); };
      };
      db.onerror = function () { res('open-fail'); };
    });
  });
  check('图册也并集进库（本机 + 云端各一本）', albumsNow === 'album_sm1,album_sm2', albumsNow);

  /* ---------- 恢复：替换模式 ---------- */
  const replaceEnv = {
    kind: 'trace-backup-full', schema: 2, createdAt: Date.now(), app: 'trace',
    notes: [{ id: 'sm_z', title: 'Z 云端唯一', ts: 9000, text: '替换式恢复只留这条', photos: [], audio: '' }],
    albums: [{ id: 'album_z', title: '云端唯一图册' }],
    storage: { data: { tn_wishlist: JSON.stringify([{ id: '云楼|3|4', label: '云楼', lat: 3, lng: 4, ts: 5, visited: 0 }]) }, prefs: {} }
  };
  const applyRepl = await page.evaluate(function (e) {
    return new Promise(function (res) { window.Backup.apply(e, { mode: 'replace' }, function (err, st) { res({ err: err && err.message, st: st }); }); });
  }, replaceEnv);
  check('apply(replace) 无错', !applyRepl.err, applyRepl.err);
  await page.reload({ waitUntil: 'load' });
  await sleep(1100);
  const afterRepl = await page.evaluate(function () {
    return {
      ids: TravelNotes.list().map(function (n) { return n.id; }).join(','),
      wish: localStorage.getItem('tn_wishlist'),
      trips: localStorage.getItem('tn_trips'),
      mappos: localStorage.getItem('tn_mappos_t'),
      aiKey: localStorage.getItem('tn_aiKey'),
      dsKey: localStorage.getItem('tn_key_deepseek'),
      amap: localStorage.getItem('tn_amap_key')
    };
  });
  check('替换式恢复：游记整库只剩云端那一条', afterRepl.ids === 'sm_z', afterRepl.ids);
  check('替换式恢复：登记键里云端没有的会被清掉（tn_trips/tn_mappos_t）', afterRepl.trips == null && afterRepl.mappos == null,
    'trips=' + afterRepl.trips + ' mappos=' + afterRepl.mappos);
  check('替换式恢复不动密钥：tn_aiKey / tn_key_deepseek / tn_amap_key 全部存活',
    afterRepl.aiKey === SECRET_AI && afterRepl.dsKey === SECRET_DS && afterRepl.amap === SECRET_AMAP,
    [afterRepl.aiKey, afterRepl.dsKey, afterRepl.amap].join(' / '));

  /* ---------- WebDAV 端到端 ---------- */
  const cfgWrong = { url: 'http://127.0.0.1:' + DAV_PORT + '/', dir: '行迹备份/2026', user: 'trace', pass: 'wrongpass' };
  const badPush = await page.evaluate(function (c) {
    localStorage.setItem('tn_webdav', JSON.stringify(c));
    return new Promise(function (res) { window.WebDAV.push(function (e, r) { res({ err: e && e.message, ok: !e && r.status }); }); });
  }, cfgWrong);
  check('密码错时 push 报「账号或密码不对」而不是裸 HTTP', /账号或密码不对/.test(badPush.err || ''), badPush.err);
  check('失败信息里不含任何口令内容', String(badPush.err).indexOf('wrongpass') < 0 && String(badPush.err).indexOf('rightpass') < 0, badPush.err);

  /* 真机形态：服务器带 Basic 挑战时 WebView 拿不到 401 状态码，只会看到网络层失败 →
     网络错误文案必须把「账号或密码被拒」说出来（指向一个必然拒绝连接的端口来触发） */
  const dead = await page.evaluate(function (c) {
    localStorage.setItem('tn_webdav', JSON.stringify(c));
    return new Promise(function (res) { window.WebDAV.push(function (e, r) { res({ err: e && e.message }); }); });
  }, { url: 'http://127.0.0.1:1/', dir: '', user: 'trace', pass: 'rightpass' });
  check('网络层失败也提示可能是账号或密码被拒', /连不上/.test(dead.err || '') && /密码/.test(dead.err || ''), dead.err);
  check('网络层失败信息里同样不带口令', String(dead.err).indexOf('rightpass') < 0, dead.err);

  const before = stub.hits.length;
  const okPush = await page.evaluate(function (c) {
    localStorage.setItem('tn_webdav', JSON.stringify(c));
    return new Promise(function (res) { window.WebDAV.push(function (e, r) { res({ err: e && e.message, st: e ? null : r.status }); }); });
  }, Object.assign({}, cfgWrong, { pass: 'rightpass' }));
  const seq = stub.hits.slice(before).map(function (h) { return h.method + ' ' + h.path; });
  const mkcols = stub.hits.slice(before).filter(function (h) { return h.method === 'MKCOL'; }).map(function (h) { return h.path; });
  const puts = stub.hits.slice(before).filter(function (h) { return h.method === 'PUT'; });
  check('push 成功（自动建目录后 PUT 拿到 201）', !okPush.err, okPush.err || 'HTTP ' + okPush.st);
  check('409 后逐级 MKCOL 再重试 PUT（PUT→MKCOL×3→PUT 的真实顺序，不是 PUT 顺手建目录）',
    mkcols.indexOf('/行迹备份/') >= 0 && mkcols.indexOf('/行迹备份/2026/') >= 0
      && puts.length >= 2 && stub.files.has('/行迹备份/2026/trace-full-backup.json'),
    seq.join(' | '));
  const remoteRaw = stub.read('/行迹备份/2026/trace-full-backup.json');
  const remoteEnv = JSON.parse(remoteRaw);
  check('远端文件是 schema 2 全量包且带回了刚恢复的那篇', remoteEnv.schema === 2 && remoteEnv.notes.length === 1 && remoteEnv.notes[0].id === 'sm_z',
    remoteEnv.notes.map(function (n) { return n.id; }).join(','));
  check('上传到远端的正文里没有密钥值', [SECRET_AI, SECRET_DS, SECRET_AMAP].every(function (s) { return remoteRaw.indexOf(s) < 0; }));
  check('备份正文里没有 WebDAV 账号口令', remoteRaw.indexOf('rightpass') < 0 && remoteRaw.indexOf('"tn_webdav"') < 0);

  const info = await page.evaluate(function () {
    return new Promise(function (res) { window.WebDAV.remoteInfo(function (e, r) { res({ err: e && e.message, r: r }); }); });
  });
  check('remoteInfo 读回云端摘要', !info.err && info.r && info.r.exists && /篇游记/.test(info.r.summary || ''), info.err || (info.r && info.r.summary));

  const tResult = await page.evaluate(function () {
    return new Promise(function (res) { window.WebDAV.test(function (r) { res(r); }); });
  });
  check('测试连接走 PROPFIND 并回报成功', tResult.ok === true, tResult.msg);

  /* 无墓碑边界：本机把云端有的那条删掉，再 pull 合并 → 它会被并回来（文档登记的语义，钉成测试） */
  await page.evaluate(function () {
    TravelNotes.replaceNotes([{ id: 'sm_local_only', title: '本机新增', ts: 9500, text: '云端没有', photos: [], audio: '' }]);
  });
  await sleep(500);
  const beforePullIds = await page.evaluate(function () { return TravelNotes.list().map(function (n) { return n.id; }).join(','); });
  check('pull 前本机已删掉云端那条（只剩 sm_local_only）', beforePullIds === 'sm_local_only', beforePullIds);
  const pulled = await page.evaluate(function () {
    return new Promise(function (res) {
      window.WebDAV.pull({ force: false }, function (e, r) {
        res({ err: e && e.message, st: r, ids: TravelNotes.list().map(function (n) { return n.id; }).join(',') });
      });
    });
  });
  check('pull 合并：本机新增留下、云端已删的记录回得来（无墓碑的既定语义）',
    !pulled.err && pulled.ids.indexOf('sm_local_only') >= 0 && pulled.ids.indexOf('sm_z') >= 0, pulled.err || pulled.ids);

  /* 覆盖式恢复必须先 danger 确认 */
  const forced = await page.evaluate(function () {
    var seen = null;
    var orig = window.UI.confirm;
    window.UI.confirm = function (opts, cb) { seen = opts; cb(true); };
    return new Promise(function (res) {
      window.WebDAV.pull({ force: true }, function (e, r) {
        window.UI.confirm = orig;
        res({ err: e && e.message, dialog: seen, ids: TravelNotes.list().map(function (n) { return n.id; }).join(',') });
      });
    });
  });
  check('覆盖式恢复弹危险确认（danger + 说清会被清掉）',
    forced.dialog && forced.dialog.danger === true && /覆盖/.test(forced.dialog.title || '') && /清掉/.test(forced.dialog.text || ''),
    forced.dialog ? forced.dialog.title : 'no dialog');
  check('确认后本机独有条目被清掉，只剩云端那一条', forced.ids === 'sm_z', forced.ids);

  /* 离线：直接给「当前离线」，不发请求 */
  const offCount0 = stub.hits.length;
  const offline = await page.evaluate(function () {
    var real = navigator.onLine;
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    return new Promise(function (res) {
      window.WebDAV.push(function (e, r) {
        Object.defineProperty(window.navigator, 'onLine', { value: real, configurable: true });
        res({ err: e && e.message, ok: !e });
      });
    });
  });
  check('离线时 push 立刻报「当前离线」', /当前离线/.test(offline.err || ''), offline.err);
  check('离线时确实一个请求都没发出去', stub.hits.length === offCount0, stub.hits.length - offCount0 + ' hits');

  /* 自动上传：默认关 + 开关生效 */
  const autoDefault = await page.evaluate(function () {
    localStorage.removeItem('tn_webdav_autosync');
    return window.WebDAV.autosyncOn();
  });
  check('自动上传默认关闭', autoDefault === false, String(autoDefault));
  const beforeOff = stub.hits.length;
  await page.evaluate(function () { localStorage.removeItem('tn_webdav_autosync'); window.WebDAV.scheduleSync(150); });
  await sleep(600);
  check('关着时 scheduleSync 不发请求', stub.hits.length === beforeOff, (stub.hits.length - beforeOff) + ' hits');
  const beforeOn = stub.hits.length;
  await page.evaluate(function () { window.WebDAV.setAutosync(true); window.WebDAV.scheduleSync(150); });
  await sleep(900);
  const autoHits = stub.hits.slice(beforeOn).filter(function (h) { return h.method === 'PUT'; });
  check('开着时防抖到点真的 PUT 一次', autoHits.length === 1, autoHits.length + ' PUT');
  check('自动上传挂在 TravelNotes 保存回调链上（_afterSave 已被接管）', await page.evaluate(function () {
    return typeof window.TravelNotes._afterSave === 'function';
  }));
  await page.evaluate(function () { window.WebDAV.setAutosync(false); });

  /* ---------- 设置页卡片 + 截图 ---------- */
  const card = await page.evaluate(function () {
    var ids = ['wdUrl', 'wdDir', 'wdUser', 'wdPass', 'wdTestBtn', 'wdSaveBtn', 'wdPushBtn', 'wdPullBtn', 'wdForceBtn', 'swWdAuto', 'wdStatus'];
    var missing = ids.filter(function (i) { return !document.getElementById(i); });
    var g = document.querySelector('#wdUrl').closest('.group');
    function h(el) { var r = el.getBoundingClientRect(); return Math.min(r.height, r.width); }
    var small = ['wdTestBtn', 'wdSaveBtn', 'wdPushBtn', 'wdPullBtn', 'wdForceBtn'].filter(function (i) { return h(document.getElementById(i)) < 44; });
    return { missing: missing, small: small, title: g ? g.querySelector('.group-title').textContent : '', sub: g ? (g.querySelector('.group-sub') || {}).textContent : '' };
  });
  check('云同步卡片 11 个控件全在且挂在「云同步」组里', card.missing.length === 0 && card.title === '云同步', card.missing.join(',') || card.title);
  check('卡片说明写清密钥不进备份', /绝不进备份/.test(card.sub) && /WebDAV/.test(card.sub), card.sub.slice(0, 40) + '…');
  check('五个同步按钮触控目标 ≥44px', card.small.length === 0, card.small.join(',') || 'ok');
  await page.screenshot({ path: path.join(OUT, 'settings-webdav-light.png') });
  await page.evaluate(function () { document.documentElement.classList.add('theme-dark'); });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, 'settings-webdav-dark.png') });

  /* ---------- 汇总 ---------- */
  await browser.close();
  stub.close(function () {});
  server.close();
  const failed = results.filter(function (r) { return !r.ok; });
  console.log('\n=== smoke-backup: ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL / 共 ' + results.length + ' ===');
  failed.forEach(function (r) { console.log('FAIL  ' + r.name + (r.detail ? '   [' + r.detail + ']' : '')); });
  fs.writeFileSync(path.join(OUT, 'smoke-backup-report.json'), JSON.stringify({ when: new Date().toISOString(), results: results }, null, 1));
  console.log('截图与报告目录：' + OUT);
  process.exit(failed.length ? 1 : 0);
}

main().catch(function (e) { console.error('SMOKE CRASH ' + (e && e.stack || e)); process.exit(2); });
