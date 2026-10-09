/* tools/smoke-irreversible.js — 批次 32「三次点下去就找不回来」浏览器闸门
 *
 * 用户点单（逐字）：「全面审核 项目的功能和ui视觉的完整性、实用性和操作便利性」→ 报告 §8 第 1 条
 * 「先补 S1-1 / S1-2 这两颗数据不可逆的雷」；修的顺序由用户选定「2 → 3 → 1」。
 * 地基实测（tools/out/b32-probe-before.txt，改前四条腿）：
 *   L1 手动上传：本机 0 篇 / 云端 3 篇，点一次按钮 → 零确认 PUT 1 次，云端 notes 3→0。
 *   L2 自动上传：没人点按钮，scheduleSync 到点自己 PUT，同样零确认。
 *   L3b 连锁：只点「清除全部数据」，33s 后 autosync 自己把空包推上去，唯一云端备份 3→0。
 *   L3 名不符实：按钮与确认层都写「清除全部数据」，实得只有 notes 2→0，图册/行程/账目/设置全在，
 *       而 flash 报「已清除全部数据」。
 *   L4 录音面板：打了字点 #tnX → 面板收起，重开 textarea 为空，整段口语就地作废（全程零追问）。
 *       同时实测 328×723 下 .tn-panel 是 inset 0 全铺（z9001）盖死 .tn-mask（z9000），
 *       9px 网格 2997 点命中遮罩 0 处——「点遮罩丢内容」这个说法本身被实测推翻，
 *       可达出口只有 #tnX 一枚，所以两条入口都得接脏检查。
 *
 * 源码腿（§47）断言不了、必须由这一节断言的三件事：
 *   ① 覆盖真的被挡住了：确认层出现的那一刻 PUT 计数还是 0（判定发生在写之前，不是先写了再问），
 *      取消之后云端那一份逐条没动，确认后才会变成 0——少一条就成了「对话框是摆设」或「问了也不拦」。
 *   ② 确认层的文字在屏上说得清会丢什么：篇数/本数/数据键三类计数、danger 红色、按钮动词，
 *      源码腿只能钉住字符串在场，钉不住「这一档情形走的是哪一句话」。
 *   ③ 面板脏检查改变的是点击之后的世界：内容还在不在、保存钮还能不能用、干净态不许骚扰。
 *
 * 名字前缀 I（irreversible）。
 * 用法：PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/smoke-irreversible.js \
 *        > tools/out/b32-smoke-irreversible.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const webdav = require('./webdav-stub');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8171', 10);
const DAV_PORT = parseInt(process.env.DAV_PORT || '8771', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const FILE_PATH = '/trace-b32/trace-full-backup.json';
const VW = 328, VH = 723;            /* 一加 Ace 6T 真机档（§37 口径） */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
let checks = 0, fails = 0;
function ok(name, cond, detail) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (detail === undefined || detail === '' ? '' : '  [' + detail + ']');
  if (!cond) fails++;
  lines.push(s);
  console.log(s);
}
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b32-smoke-irreversible.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('读数落盘失败：' + e.message); }
}

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

/* ---------- 云端那一份 ---------- */
function remoteEnv(noteIds, albumIds, dataObj) {
  var notes = (noteIds || []).map(function (id, i) {
    return { id: id, title: '云端 ' + id, siteName: '鹳雀楼', ts: 1000 + i,
      date: '2026-09-0' + ((i % 8) + 1), day: '2026-09-0' + ((i % 8) + 1), text: '云端正文 ' + id, photos: [], audio: '' };
  });
  var albums = (albumIds || []).map(function (id) { return { id: id, title: '云端图册 ' + id, pages: [] }; });
  return { kind: 'trace-backup-full', schema: 2, createdAt: 1760000000000, app: 'trace',
    notes: notes, albums: albums, storage: { data: dataObj || {}, prefs: {} } };
}

/* ---------- 页面种子：本机游记按给定 id 铺，其它集合各放一笔（32-C 要靠它们证明「没删」） ---------- */
function seedLocal(ids, davPort, withAlbum) {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_wishlist', JSON.stringify([{ id: 'w1', label: '悬空寺', lat: 39.6, lng: 113.7, ts: 1, visited: 0 }]));
    localStorage.setItem('tn_trips', JSON.stringify([{ id: 't1', name: '大同两日', days: [] }]));
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'u1', name: '我家', lat: 1, lng: 2 }]));
    localStorage.setItem('tn_expense', JSON.stringify([{ id: 'e1', tripId: 't1', amount: 88, day: '2026-10-02' }]));
    localStorage.setItem('tn_budget', JSON.stringify({ t1: 1200 }));
    localStorage.setItem('tn_webdav', JSON.stringify({
      url: 'http://127.0.0.1:' + davPort + '/', user: 'trace', pass: 'rightpass', dir: 'trace-b32' }));
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
      var st = tx.objectStore('notes');
      st.clear();
      (ids || []).forEach(function (id, i) {
        st.put({ id: id, title: '本机 ' + id, siteName: '应县木塔', ts: 5000 + i,
          date: '2026-10-0' + ((i % 8) + 1), day: '2026-10-0' + ((i % 8) + 1), text: '本机正文', photos: [], audio: '' });
      });
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
          if (withAlbum) s2.put({ id: 'album_lc', title: '本机图册', pages: [] });
          t2.oncomplete = function () { db.close(); d2.close(); resolve('seeded-' + (ids || []).length); };
          t2.onerror = function () { db.close(); resolve('album-write-fail'); };
        };
        r2.onerror = function () { db.close(); resolve('album-open-fail'); };
      };
      tx.onerror = function () { db.close(); resolve('notes-write-fail'); };
    };
    r1.onerror = function () { resolve('notes-open-fail'); };
  });
}

/* 现场盘点：七类集合的真实条数（32-C 的「名实一致」全靠它定量） */
function counts(page) {
  return page.evaluate(function () {
    function n(x) { try { return JSON.parse(localStorage.getItem(x) || '[]').length; } catch (e) { return -1; } }
    function nk(x) { try { return Object.keys(JSON.parse(localStorage.getItem(x) || '{}')).length; } catch (e) { return -1; } }
    function idb(name, store) {
      return new Promise(function (res) {
        var r = indexedDB.open(name, name === 'gujian-notes' ? 1 : 2);
        r.onupgradeneeded = function () {};
        r.onsuccess = function () {
          var db = r.result;
          try {
            var rq = db.transaction(store, 'readonly').objectStore(store).count();
            rq.onsuccess = function () { db.close(); res(rq.result); };
            rq.onerror = function () { db.close(); res(-1); };
          } catch (e) { db.close(); res(-1); }
        };
        r.onerror = function () { res(-1); };
      });
    }
    return Promise.all([idb('gujian-notes', 'notes'), idb('trace-albums', 'albums')]).then(function (r) {
      return { notes: r[0], albums: r[1], wishlist: n('tn_wishlist'), trips: n('tn_trips'),
        userNodes: n('tn_userNodes'), expense: n('tn_expense'), budgetKeys: nk('tn_budget'),
        autosyncKey: localStorage.getItem('tn_webdav_autosync'),
        autosyncOn: !!(window.WebDAV && WebDAV.autosyncOn && WebDAV.autosyncOn()) };
    });
  });
}

/* 两套确认层读成一枚形状：UI.confirm（.ui-modal-*）与 travel-notes 自己的 .tn-cfm（.tc-*） */
const MODAL = '(' + function () {
  var m = document.querySelector('.ui-modal-mask') || document.querySelector('.tn-cfm');
  if (!m) return null;
  function t(sel) { var e = m.querySelector(sel); return e ? (e.textContent || '') : ''; }
  var okBtn = m.querySelector('.ui-btn-primary') || m.querySelector('.tc-ok');
  var noBtn = m.querySelector('.ui-btn-ghost') || m.querySelector('.tc-no');
  return {
    kind: m.classList.contains('tn-cfm') ? 'tn-cfm' : 'ui-modal',
    title: t('.ui-modal-title'),
    text: t('.ui-modal-text') || t('.tc-txt'),
    ok: okBtn ? okBtn.textContent : '',
    no: noBtn ? noBtn.textContent : '',
    danger: !!(okBtn && okBtn.classList.contains('danger')),
    inPanel: !!(okBtn && okBtn.closest('.tn-panel'))
  };
} + ')()';
function modal(page) { return page.evaluate(MODAL); }
function clickOk(page) { return page.evaluate('var b=document.querySelector(".ui-modal-mask .ui-btn-primary, .tn-cfm .tc-ok");if(b)b.click();'); }
function clickNo(page) { return page.evaluate('var b=document.querySelector(".ui-modal-mask .ui-btn-ghost, .tn-cfm .tc-no");if(b)b.click();'); }

const pStr = p => JSON.stringify(p);

async function openSettings(browser, seedIds, opts) {
  opts = opts || {};
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  page.on('pageerror', e => ERRS.push('settings: ' + (e && e.message || e)));
  await page.goto(BASE + '/settings.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedLocal, seedIds, DAV_PORT, !!opts.album);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.WebDAV && window.Backup && document.getElementById("wdPushBtn")', { timeout: 20000 });
  await sleep(400);
  return page;
}

const ERRS = [];
let PUT0 = 0, GET0 = 0;
function putHits(stub) { return stub.hits.filter(h => h.method === 'PUT').length; }
function getHits(stub) { return stub.hits.filter(h => h.method === 'GET').length; }
function remoteEnvOf(stub) {
  var t = stub.read(FILE_PATH);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return 'parse-fail'; }
}
function remoteNotes(stub) {
  var e = remoteEnvOf(stub);
  return e === null ? 'no-file' : (e === 'parse-fail' ? 'parse-fail' : (e.notes || []).length);
}

async function main() {
  const server = staticServer();
  await new Promise(r => { server.listen(PORT, '127.0.0.1', r); });
  const stub = await new Promise(r => { webdav.start({ port: DAV_PORT, user: 'trace', pass: 'rightpass' }, r); });
  stub.mkdir('/trace-b32/');

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 32 不可逆动作闸门（' + VW + '×' + VH + ' 真机档 · 真 Chrome · 真 WebDAV 桩） ===');
  PUT0 = putHits(stub); GET0 = getHits(stub);

  /* ============ S1 手动上传：云端有本机没有的记录 ============ */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv(['rm_1', 'rm_2', 'rm_3'], ['album_rm'],
    { tn_dayMoods: JSON.stringify({ '2026-09-01': '晴' }) })));
  let page = await openSettings(browser, []);
  say('\n[S1] 本机 0 篇 / 云端 3 篇 + 1 本图册 + 1 项本机没有的数据键，点一次「上传到云端」');
  var putBefore = putHits(stub);
  await page.click('#wdPushBtn');
  await sleep(120);
  var m1 = await modal(page);
  var putAtAsk = putHits(stub) - putBefore;
  ok('I01 点一次「上传到云端」会出确认层（改前：无任何对话框）', !!m1, m1 ? m1.kind : '无');
  ok('I02 判定发生在写之前：确认层出现那一刻 PUT 自增 ' + putAtAsk + '（必须为 0，先写了再问等于没问）',
    !!m1 && putAtAsk === 0, 'PUT 自增=' + putAtAsk);
  ok('I03 先 GET 读云端再判定（改前整个链路一次 GET 都不发）', getHits(stub) - GET0 >= 1, 'GET 自增=' + (getHits(stub) - GET0));
  ok('I04 标题点名「云端有本机没有的记录」而不是泛泛的「确定要上传吗」',
    !!m1 && m1.title === '云端有本机没有的记录', m1 && m1.title);
  ok('I05 这一档是危险档：主按钮带 danger（红）', !!m1 && m1.danger === true, m1 && 'danger=' + m1.danger);
  ok('I06 正文逐类说清会丢多少：整句「其中 3 篇游记、1 本图册、1 项数据在这台设备上找不到」（只查 3 篇/1 本/1 项 会被云端摘要喂饱——变异网 U03 实测把 loseAlbums 打成恒 0 照样绿，那一发把这半句钉死）',
    !!m1 && m1.text.indexOf('其中 3 篇游记、1 本图册、1 项数据在这台设备上找不到') >= 0, m1 && m1.text.slice(0, 90));
  ok('I07 正文说清「从云端恢复也读不回来」（不能只说覆盖，要说这是不可逆的那一半）',
    !!m1 && /找不回来|读不回来/.test(m1.text), m1 && (m1.text.match(/.{0,14}(找不回来|读不回来)/) || [''] )[0]);
  ok('I08 主按钮动词是「仍然覆盖」而不是「确定」（点下去干什么必须写在按钮上）',
    !!m1 && m1.ok === '仍然覆盖', m1 && m1.ok);

  await clickNo(page);
  await sleep(400);
  var cancelled = await page.evaluate('document.getElementById("wdResult").textContent');
  ok('I09 取消之后：PUT 仍 0、云端那一份逐条没动、结果行说「云端那一份没有改动」',
    putHits(stub) - putBefore === 0 && remoteNotes(stub) === 3 && /云端那一份没有改动/.test(cancelled),
    'PUT自增=' + (putHits(stub) - putBefore) + ' 云端notes=' + remoteNotes(stub) + ' 结果行="' + cancelled + '"');
  ok('I10 取消后确认层关掉，页面不残留遮罩',
    (await modal(page)) === null, pStr(await modal(page)));

  await page.click('#wdPushBtn');
  await sleep(900);
  var m1b = await modal(page);
  ok('I11 再点一次仍会问（不是只问第一次的一次性开关）', !!m1b, m1b && m1b.title);
  var h1 = putHits(stub);
  await clickOk(page);
  await sleep(2200);
  ok('I12 确认之后才真覆盖：PUT 自增 1、云端 notes 3→0（对话框不是摆设）',
    putHits(stub) - h1 === 1 && remoteNotes(stub) === 0, 'PUT自增=' + (putHits(stub) - h1) + ' 云端notes=' + remoteNotes(stub));
  var last1 = await page.evaluate('localStorage.getItem("tn_webdav_last")');
  ok('I13 上传成功后写 tn_webdav_last（ok:true），且里面不带口令',
    /"ok":true/.test(last1 || '') && !/rightpass/.test(last1 || ''), String(last1).slice(0, 70));
  await page.close();

  /* ============ S2 第一次备份不该被追问 ============ */
  try { stub.files.delete(FILE_PATH); } catch (e) {}
  page = await openSettings(browser, ['lc_0']);
  say('\n[S2] 云端还没有备份文件（404），本机 1 篇——这是「建第一份备份」，不该拦');
  var cbCount = await page.evaluate('new Promise(function(res){var n=0;' +
    'WebDAV.remoteInfo(function(){n++;if(n===1)setTimeout(function(){res(n);},700);});})');
  ok('I14b 一次 remoteInfo 只回调一次（改前 404 那一支没截断 Promise 链，第二级拿着 undefined 又报一次「备份内容不是对象」）',
    cbCount === 1, '回调 ' + cbCount + ' 次');
  var h2 = putHits(stub);
  await page.click('#wdPushBtn');
  await sleep(1800);
  ok('I14 远端 404 时不弹确认层，直接上传（低风险情形不多要一次点击）',
    (await modal(page)) === null && putHits(stub) - h2 === 1 && remoteNotes(stub) === 1,
    '层=' + pStr(await modal(page)) + ' PUT自增=' + (putHits(stub) - h2) + ' 云端notes=' + remoteNotes(stub));
  await page.close();

  /* ============ S3 本机是云端超集：话要说得不一样 ============ */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv(['lc_0'], [], {})));
  page = await openSettings(browser, ['lc_0', 'lc_1']);
  say('\n[S3] 云端 1 篇（id 与本机同一篇）/ 本机 2 篇，覆盖不会少东西');
  await page.click('#wdPushBtn');
  await sleep(900);
  var m3 = await modal(page);
  ok('I15 超集那一份仍要确认，但正文改口：说「这台设备全都有／覆盖不会少东西」',
    !!m3 && /全都有/.test(m3.text) && /不会少东西/.test(m3.text), m3 && m3.text.slice(0, 60));
  ok('I16 这一档不是危险档：主按钮无 danger，动词「覆盖上传」（红色只能留给真会丢的那几档）',
    !!m3 && m3.danger === false && m3.ok === '覆盖上传', m3 && 'danger=' + m3.danger + ' ok=' + m3.ok);
  await clickNo(page);
  await sleep(300);
  await page.close();

  /* ============ S4 云端那个文件不是行迹备份 ============ */
  stub.files.set(FILE_PATH, '{"hello":"world"}');
  page = await openSettings(browser, ['lc_0']);
  say('\n[S4] 云端同名文件存在但不是行迹备份包');
  await page.click('#wdPushBtn');
  await sleep(900);
  var m4 = await modal(page);
  ok('I17 读不出合法备份时也拦：标题「云端那个文件不是行迹备份」+ danger',
    !!m4 && m4.title === '云端那个文件不是行迹备份' && m4.danger === true, m4 && m4.title + ' danger=' + m4.danger);
  ok('I18 正文明说「会把整个文件替换掉」（用户得知道那个文件会没了，不是被合并）',
    !!m4 && /整个文件/.test(m4.text), m4 && m4.text.slice(0, 52));
  await clickNo(page);
  await sleep(300);
  await page.close();

  /* ============ S5 自动上传：会丢就一律不传 ============ */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv(['rm_1', 'rm_2', 'rm_3'], ['album_rm'],
    { tn_dayMoods: JSON.stringify({ '2026-09-01': '晴' }) })));
  page = await openSettings(browser, []);
  await page.click('#swWdAuto');
  say('\n[S5] autosync=1（真点开关，不写 localStorage）、本机 0 篇 / 云端 3 篇，没人点上传按钮（探针直调 scheduleSync，产品默认防抖 30s）');
  ok('I22b 开关点下去 UI 与状态同步（className 掉 off、autosyncOn() 为真）',
    (await page.evaluate('document.getElementById("swWdAuto").className')).indexOf('off') < 0 &&
    (await page.evaluate('WebDAV.autosyncOn()')) === true,
    'className="' + (await page.evaluate('document.getElementById("swWdAuto").className')) + '"');
  var h5 = putHits(stub);
  await page.evaluate('WebDAV.scheduleSync(400)');
  await sleep(600);
  var toast5 = await page.evaluate('(function(){var a=[].slice.call(document.querySelectorAll(".ui-toast"));return a.map(function(x){return x.textContent;}).join(" | ");})()');
  ok('I19 自动上传遇到「会丢」不发 PUT：改前到点自己覆盖，现到点一次都不写',
    putHits(stub) - h5 === 0 && remoteNotes(stub) === 3, 'PUT自增=' + (putHits(stub) - h5) + ' 云端notes=' + remoteNotes(stub));
  ok('I20 跳过原因写进 tn_webdav_last 且 ok:false（设置页那行「上次同步」看得见）',
    /自动上传已跳过/.test((await page.evaluate('localStorage.getItem("tn_webdav_last")')) || ''),
    String(await page.evaluate('localStorage.getItem("tn_webdav_last")')).slice(0, 64));
  ok('I21 跳过会当场报给用户：页面上飘出「自动上传已跳过」的 toast（改前那句走 UI.tileWarn(字符串)，签名是 (layer,name)，第一行就 return，永远上不了屏）',
    /自动上传已跳过/.test(toast5), toast5.slice(0, 60) || '页面上没有 toast');
  ok('I22 自动路径绝不弹确认层（没有任何一次点击，弹给谁看都是卡死）',
    (await modal(page)) === null, pStr(await modal(page)));
  var swCls = await page.evaluate('document.getElementById("swWdAuto").className');
  ok('I23 跳过之后开关仍是开的（拒绝这一次覆盖不等于替用户关掉功能）',
    /sw/.test(swCls) && !/\boff\b/.test(swCls), 'className="' + swCls + '"');
  await page.close();

  /* ============ S6 自动上传的正常工作没被废掉 ============ */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv(['lc_0'], [], {})));
  page = await openSettings(browser, ['lc_0', 'lc_1']);
  await page.click('#swWdAuto');
  say('\n[S6] 云端那一篇本机也有（超集），autosync 到点应当正常上传');
  var h6 = putHits(stub);
  await page.evaluate('WebDAV.scheduleSync(400)');
  await sleep(2000);
  ok('I24 不 risky 时自动上传照旧 PUT 一次并更新云端（这一节不是把自动上传整个关掉）',
    putHits(stub) - h6 === 1 && remoteNotes(stub) === 2, 'PUT自增=' + (putHits(stub) - h6) + ' 云端notes=' + remoteNotes(stub));
  await page.close();

  /* ============ S7 清除全部游记：名实一致 + 不再引爆连锁 ============ */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv(['rm_1', 'rm_2', 'rm_3'], [], {})));
  page = await openSettings(browser, ['lc_0', 'lc_1'], { album: true });
  await page.click('#swWdAuto');
  say('\n[S7] 本机 2 篇 + 一本图册，autosync=1（真点开关）、云端 3 篇，只点「清除全部游记」，完全不碰上传按钮');
  var btnTxt = await page.evaluate('document.querySelector("button.data-danger").textContent');
  ok('I25 按钮文案是「清除全部游记」（改前写「清除全部数据」而实际只删游记）',
    btnTxt === '清除全部游记', '"' + btnTxt + '"');
  var c7 = await counts(page);
  await page.click('button.data-danger');
  await sleep(500);
  var m7 = await modal(page);
  ok('I26 确认层标题同步改名，正文按本机真实篇数说话（「删掉本机 2 篇游记」）',
    !!m7 && m7.title === '清除全部游记' && /删掉本机 2 篇游记/.test(m7.text), m7 && m7.title + ' | ' + m7.text.slice(0, 40));
  ok('I27 正文明说哪些不受影响：图册 / 行程 / 开销 / 想去清单 / 设置（改前一句「清除全部数据」把六类没删的说成删了）',
    !!m7 && /图册/.test(m7.text) && /行程/.test(m7.text) && /开销/.test(m7.text) && /想去清单/.test(m7.text),
    m7 && m7.text.slice(0, 90));
  ok('I28 这一档是危险档且按钮动词带条数：「清除 2 篇」+ danger',
    !!m7 && m7.danger === true && m7.ok === '清除 2 篇', m7 && 'danger=' + m7.danger + ' ok=' + m7.ok);
  ok('I29 autosync 开着时正文追加「自动上传会先关掉」（告诉用户这一次不会把空包推上云端）',
    !!m7 && /自动上传会先关掉/.test(m7.text), m7 && (m7.text.match(/自动上传会先关掉[^。]*。/) || ['']) [0]);

  await clickNo(page);
  await sleep(400);
  var c7a = await counts(page);
  ok('I30 取消清除：一篇都没少，autosync 也没被顺手关掉',
    c7a.notes === 2 && c7a.autosyncOn === true, 'notes=' + c7a.notes + ' autosyncOn=' + c7a.autosyncOn);

  var h7 = putHits(stub);
  await page.click('button.data-danger');
  await sleep(500);
  await clickOk(page);
  await sleep(900);
  var c7b = await counts(page);
  ok('I31 确认之后只有游记归零：notes 2→0，而图册/想去/行程/自建点/开销/预算全在',
    c7b.notes === 0 && c7b.albums === 1 && c7b.wishlist === 1 && c7b.trips === 1 &&
    c7b.userNodes === 1 && c7b.expense === 1 && c7b.budgetKeys === 1, pStr(c7b));
  var flash7 = await page.evaluate('(function(){var f=document.querySelector(".tn-flash.on");return f?f.textContent:"（没有 flash）";})()');
  ok('I32 结果提示说实话：「已清除 2 篇游记…」，不再报「已清除全部数据」',
    /已清除 2 篇游记/.test(flash7) && !/全部数据/.test(flash7), '"' + flash7 + '"');
  ok('I33 清除会把 autosync 关掉（改前它继续跑，33s 后自己把唯一云端备份覆盖成空包）',
    c7b.autosyncOn === false && c7b.autosyncKey === '0', 'autosyncOn=' + c7b.autosyncOn + ' 键=' + c7b.autosyncKey);
  var sw7 = await page.evaluate('document.getElementById("swWdAuto").className');
  ok('I34 设置页那个开关跟着回落（UI 与状态不分叉）', /\boff\b/.test(sw7), 'className="' + sw7 + '"');
  await sleep(31000);
  ok('I35 清除后 33s（跨过默认防抖）PUT 自增仍为 0、云端仍是 3 篇：连锁被挡住两次（清前关开关 + pushAuto 自己拒覆盖）',
    putHits(stub) - h7 === 0 && remoteNotes(stub) === 3, 'PUT自增=' + (putHits(stub) - h7) + ' 云端notes=' + remoteNotes(stub));
  var bodyTxt = await page.evaluate('document.body.innerText');
  ok('I36 页面上不再有「清除全部数据 / 已清除全部数据」这两个名不符实的串',
    !/清除全部数据/.test(bodyTxt) && !/已清除全部数据/.test(bodyTxt),
    (bodyTxt.match(/.{0,10}全部数据.{0,10}/g) || []).slice(0, 2).join(' | ') || '零命中');
  await page.close();

  /* ============ S8 面板脏检查：手滑碰一下不该整段作废 ============ */
  const tp = await browser.newPage();
  tp.on('pageerror', e => ERRS.push('index: ' + (e && e.message || e)));
  await tp.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  await tp.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await tp.evaluate(seedLocal, ['lc_0', 'lc_1'], DAV_PORT, false);
  await tp.reload({ waitUntil: 'domcontentloaded' });
  await tp.waitForFunction('window.TravelNotes && TravelNotes.ensureUI', { timeout: 20000 });
  await sleep(600);
  const OPEN = 'TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})';
  const TYPE = '(function(){var t=document.getElementById("tnRawEdit");' +
    't.value="我在木塔下说了一段话，还没保存";t.dispatchEvent(new Event("input",{bubbles:true}));})()';
  say('\n[S8] 录音面板：打了字 → 点关闭钮 #tnX（328×723 下唯一可达的关闭出口）');
  await tp.evaluate(OPEN);
  await sleep(900);
  await tp.evaluate(TYPE);
  await sleep(300);
  var rawBefore = await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value');
  await tp.click('#tnX');
  await sleep(500);
  var m8 = await modal(tp);
  var disp8 = await tp.evaluate('document.querySelector(".tn-panel").style.display');
  ok('I37 有内容时点关闭先问一句：出 travel-notes 自己的 .tn-cfm 层（改前直接收起，一个字都不留）',
    !!m8 && m8.kind === 'tn-cfm', m8 ? m8.kind : '无层');
  ok('I38 问的时候面板还没关（display 仍 flex）：先收起再追问＝内容已经没了，问也是白问',
    disp8 === 'flex', 'panel display=' + disp8);
  ok('I39 正文说清「还没保存」并列出会丢的东西（转写/正文 N 字）',
    !!m8 && /还没保存/.test(m8.text) && /转写\/正文 \d+ 字/.test(m8.text), m8 && m8.text.slice(0, 56));
  ok('I40 两个按钮写的是「关掉不保存 / 继续编辑」，不是「确定 / 取消」',
    !!m8 && m8.ok === '关掉不保存' && m8.no === '继续编辑', m8 && m8.ok + ' / ' + m8.no);
  var rawAfterAsk = await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value');
  ok('I41 确认层出现期间内容一字未动', rawAfterAsk === rawBefore && rawAfterAsk.length > 0,
    'len=' + rawAfterAsk.length);
  var hitOk = await tp.evaluate('(function(){var b=document.querySelector(".tn-cfm .tc-ok");var r=b.getBoundingClientRect();' +
    'var e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);' +
    'return {rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],' +
    'top:(e?(e.id||e.className||e.tagName):"null"),isSelf:!!(e&&(e===b||b.contains(e)))};})()');
  ok('I42 确认层压在面板之上且钮真点得到（.tn-cfm z-index 9700 > 面板 9001）',
    hitOk.isSelf === true, pStr(hitOk));
  await clickNo(tp);
  await sleep(400);
  var disp8b = await tp.evaluate('document.querySelector(".tn-panel").style.display');
  var rawKeep = await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value');
  var saveDis = await tp.evaluate('document.getElementById("tnSave").disabled');
  ok('I43 选「继续编辑」：层消失、面板仍开、那段话还在、保存钮仍可用',
    (await modal(tp)) === null && disp8b === 'flex' && rawKeep === rawBefore && saveDis === false,
    'display=' + disp8b + ' len=' + rawKeep.length + ' 保存disabled=' + saveDis);

  await tp.click('#tnX');
  await sleep(500);
  var cntBefore = await tp.evaluate('TravelNotes.count()');
  await clickOk(tp);
  await sleep(1200);
  var disp8c = await tp.evaluate('document.querySelector(".tn-panel").style.display');
  var cntAfter = await tp.evaluate('TravelNotes.count()');
  ok('I44 选「关掉不保存」才真的收起（等转场收尾再量，见 §37 那条动画后复测的教训）',
    disp8c === 'none', 'display=' + disp8c);
  ok('I45 丢弃只由那一句点击造成：游记条数不变（没有偷偷保存，也没有连带删库）',
    cntAfter === cntBefore && cntAfter === 2, cntBefore + '→' + cntAfter);

  await tp.evaluate(OPEN);
  await sleep(900);
  await tp.click('#tnX');
  await sleep(1200);
  ok('I46 空面板直接关、不问（每次都要点两下＝把拦丢内容的代价摊成骚扰）',
    (await modal(tp)) === null && (await tp.evaluate('document.querySelector(".tn-panel").style.display')) === 'none',
    '层=' + pStr(await modal(tp)));

  await tp.evaluate(OPEN);
  await sleep(900);
  await tp.evaluate(TYPE);
  await sleep(300);
  await tp.evaluate('TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await sleep(200);
  var reopenRaw = await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value');
  ok('I47 脏面板没关掉时重复调用 openPanel 不会把内容擦掉（防重复弹出的那条早退要还在）',
    reopenRaw.length > 0, 'len=' + reopenRaw.length);
  var saveHint = await tp.evaluate('(function(){var b=document.getElementById("tnSave");' +
    'if(!b||b.disabled)return "保存钮不可用";b.click();return "clicked";})()');
  await sleep(2500);
  var savedCnt = await tp.evaluate('TravelNotes.count()');
  var mSaved = await modal(tp);
  ok('I48 保存路径不被脏检查打断（点保存不该再问一次「要不要保存」）',
    savedCnt === 3 && (mSaved === null || mSaved.kind !== 'tn-cfm'), '游记 ' + savedCnt + ' 篇 | 层=' + pStr(mSaved));
  await tp.evaluate('(function(){var b=document.getElementById("tnX");if(b)b.click();})()');
  await sleep(1200);
  ok('I49 保存之后内容已入面板外，此时点关闭不再追问（问句只留给真会丢的那一次）',
    (await modal(tp)) === null && (await tp.evaluate('document.querySelector(".tn-panel").style.display')) === 'none',
    '层=' + pStr(await modal(tp)));
  say('  ' + saveHint);

  /* 记开销档：那一档的钱也一样会丢 */
  await tp.evaluate(OPEN);
  await sleep(900);
  await tp.evaluate('document.getElementById("tnTabExp").click()');
  await sleep(500);
  var isExp = await tp.evaluate('document.querySelector(".tn-panel").classList.contains("is-expense")');
  await tp.evaluate('(function(){var a=document.getElementById("adAmt");a.value="128";' +
    'a.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await sleep(300);
  await tp.evaluate('document.getElementById("tnX").click()');
  await sleep(500);
  var m8e = await modal(tp);
  ok('I50 记开销档填了金额也追问，正文说「这一笔开销还没记上（128 元）」',
    isExp && !!m8e && /这一笔开销还没记上/.test(m8e.text) && /128/.test(m8e.text),
    'is-expense=' + isExp + ' | ' + (m8e ? m8e.text.slice(0, 48) : '无层'));
  await clickNo(tp);
  await sleep(300);
  await tp.evaluate('(function(){var a=document.getElementById("adAmt");a.value="";a.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await sleep(300);
  await tp.evaluate('document.getElementById("tnX").click()');
  await sleep(1200);
  ok('I51 记开销档金额没填 → 不追问直接关（空表单不该拦路）',
    (await modal(tp)) === null && (await tp.evaluate('document.querySelector(".tn-panel").style.display')) === 'none',
    '层=' + pStr(await modal(tp)));

  /* 遮罩可达性登记：S1-3 的定性要落在实测上 */
  await tp.evaluate(OPEN);
  await sleep(900);
  await tp.evaluate(TYPE);
  await sleep(300);
  var grid = await tp.evaluate('(function(){var g={mask:0,panel:0,panelChild:0,other:0},total=0,samples=[];' +
    'for(var y=2;y<' + VH + ';y+=9){for(var x=2;x<' + VW + ';x+=9){total++;' +
    'var e=document.elementFromPoint(x,y);if(!e){g.other++;continue;}' +
    'if(e.classList&&e.classList.contains("tn-mask"))g.mask++;' +
    'else if(e.closest&&e.closest(".tn-panel"))g.panelChild++;' +
    'else if(e.classList&&e.classList.contains("tn-panel"))g.panel++;' +
    'else{g.other++;if(samples.length<4)samples.push(e.tagName+(e.id?"#"+e.id:"")+"."+(e.className||""));}}}' +
    'return {total:total,by:g,samples:samples};})()');
  ok('I52 遮罩在真机档摸不到（面板 inset 0 全铺盖死它）：9px 网格命中遮罩 ' + grid.by.mask + ' 处——所以本批把两条入口都接上脏检查而不是只修遮罩',
    grid.by.mask === 0 && grid.by.panelChild + grid.by.panel > 0, pStr(grid.by));
  var xGeom = await tp.evaluate('(function(){var x=document.getElementById("tnX");var r=x.getBoundingClientRect();' +
    'return {w:Math.round(r.width),h:Math.round(r.height)};})()');
  ok('I53 唯一的可达出口 #tnX 实测尺寸登记（' + xGeom.w + '×' + xGeom.h + '，低于 44px 触控地板，作为下一条待点单登记而不混进本批）',
    xGeom.w > 0 && xGeom.h > 0, xGeom.w + '×' + xGeom.h);
  await tp.evaluate('document.querySelector(".tn-mask").click()');
  await sleep(600);
  ok('I54 代码里直接调 mask.click() 也走脏检查（两条关闭入口同一条判定，不留第二条裸 closePanel）',
    !!(await modal(tp)), pStr(await modal(tp)));
  await clickNo(tp);
  await tp.evaluate('document.getElementById("tnX").click()');
  await sleep(600);
  await clickOk(tp);
  await sleep(1200);

  /* ============ 收尾 ============ */
  ok('I55 全程零页面报错（脏检查读 DOM 状态、push 家族改接线，最容易在这里静默炸）',
    ERRS.length === 0, ERRS.slice(0, 3).join(' | '));
  ok('I56 判据条数 ≥ 57（这一节自己也是会被删的）', checks >= 57, 'checks=' + checks);

  say('\n=== smoke-irreversible: ' + checks + ' 项，失败 ' + fails + ' ===');
  console.log('=== smoke-irreversible: ' + checks + ' 项，失败 ' + fails + ' ===');
  dump();
  await browser.close();
  stub.close(function () {});
  server.close(function () {});
  process.exit(fails ? 1 : 0);
}

main().catch(function (e) {
  lines.push('FATAL ' + ((e && e.stack) || e));
  dump();
  console.log('FATAL ' + ((e && e.message) || e));
  process.exit(1);
});
