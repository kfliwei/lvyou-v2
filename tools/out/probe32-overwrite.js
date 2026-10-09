/* tools/out/probe32-overwrite.js — 批次 32-A 地基实测（改前先跑，拿真读数定罪）
 * 四条腿，全部在 328×723 真机档 + 真 Chrome + 真 WebDAV 桩里跑：
 *   L1 手动「上传到云端」：云端有 3 篇 / 本机 0 篇 → 有没有确认层？云端那一份变成什么？
 *   L2 自动上传：autosync=1 → scheduleSync(短 delay) → 没人点按钮时 PUT 会不会自己发生？
 *   L3 「清除全部数据」：确认层文案、执行后各集合条数、以及它到底删了什么
 *   L4 录音面板：打了字之后点 ← / 点遮罩，内容还在吗？遮罩在 328×723 摸得到吗？
 * 用法：node tools/out/probe32-overwrite.js > tools/out/b32-probe-before.txt 2>&1
 * 只读产品代码，不写盘；判据全部现场量，不引用任何文档结论。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const webdav = require('../webdav-stub');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8151', 10);
const DAV_PORT = parseInt(process.env.DAV_PORT || '8751', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const FILE_PATH = '/trace-b32/trace-full-backup.json';

function log() { console.log.apply(console, arguments); }
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

/* 云端那一份：3 篇游记 + 1 本图册的合法 env（schema 2 / kind trace-backup-full） */
function remoteEnv() {
  var notes = [];
  for (var i = 1; i <= 3; i++) {
    notes.push({ id: 'rm_' + i, title: '云端第' + i + '篇', siteName: '鹳雀楼', ts: 1000 + i,
      date: '2026-09-0' + i + ' 08:0' + i, day: '2026-09-0' + i, text: '云端正文 ' + i, photos: [], audio: '' });
  }
  return { kind: 'trace-backup-full', schema: 2, createdAt: 1760000000000, app: 'trace',
    notes: notes, albums: [{ id: 'album_rm', title: '云端图册', pages: [] }],
    storage: { data: { tn_wishlist: JSON.stringify([{ id: 'x', label: '云端心愿', lat: 1, lng: 2 }]) }, prefs: {} } };
}

/* 页面种子：本机游记/图册条数按参数给，其它集合固定放几笔（L3 要靠它们证明「没删」） */
function seedLocal(noteCount, davPort) {
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
      for (var i = 0; i < noteCount; i++) {
        st.put({ id: 'lc_' + i, title: '本机第' + i + '篇', siteName: '应县木塔', ts: 5000 + i,
          date: '2026-10-0' + (i + 1) + ' 09:0' + i, day: '2026-10-0' + (i + 1), text: '本机正文', photos: [], audio: '' });
      }
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
          if (noteCount > 0) s2.put({ id: 'album_lc', title: '本机图册', pages: [] });
          t2.oncomplete = function () { db.close(); d2.close(); resolve('seeded-' + noteCount); };
          t2.onerror = function () { db.close(); resolve('album-write-fail'); };
        };
        r2.onerror = function () { db.close(); resolve('album-open-fail'); };
      };
      tx.onerror = function () { db.close(); resolve('notes-write-fail'); };
    };
    r1.onerror = function () { resolve('notes-open-fail'); };
  });
}

/* 现场盘点：各集合的真实条数（L3 的「名不符实」全靠它定量） */
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
        hasWebdavCfg: !!localStorage.getItem('tn_webdav'),
        autosync: localStorage.getItem('tn_webdav_autosync') };
    });
  });
}

/* 页面上现存的确认/提示层（UI.confirm 的 DOM 形状，实测取自 ui.js:61 confirm） */
const MODAL = '(' + function () {
  var m = document.querySelector('.ui-modal-mask, .tn-cfm');
  return m ? {
    cls: m.className,
    title: (m.querySelector('.ui-modal-title') || {}).textContent || '',
    text: (m.querySelector('.ui-modal-text') || m.querySelector('.tc-txt') || {}).textContent || '',
    ok: (m.querySelector('.ui-btn-primary') || m.querySelector('.tc-ok') || {}).textContent || '',
    no: (m.querySelector('.ui-btn-ghost') || m.querySelector('.tc-no') || {}).textContent || ''
  } : null;
} + ')()';

function modal(page) { return page.evaluate(MODAL); }

async function openSettings(browser, noteCount) {
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  await page.goto(BASE + '/settings.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedLocal, noteCount, DAV_PORT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.WebDAV && window.Backup && document.getElementById("wdPushBtn")', { timeout: 20000 });
  await sleep(400);
  return page;
}

function putHits(stub) { return stub.hits.filter(function (h) { return h.method === 'PUT'; }).length; }
function getHits(stub) { return stub.hits.filter(function (h) { return h.method === 'GET'; }).length; }
function remoteNotes(stub) {
  var t = stub.read(FILE_PATH);
  if (!t) return null;
  try { return JSON.parse(t).notes.length; } catch (e) { return 'parse-fail'; }
}

async function main() {
  const server = staticServer();
  await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });
  const stub = await new Promise(function (r) {
    webdav.start({ port: DAV_PORT, user: 'trace', pass: 'rightpass' }, r);
  });
  stub.mkdir('/trace-b32/');
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv()));

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });

  log('=== 批次 32-A 地基实测（当前＝改动前的产品代码） ===');
  log('桩：' + stub.root + '  云端预置 ' + remoteNotes(stub) + ' 篇游记（合法 schema 2 包）');

  /* ---------- L1 手动上传 ---------- */
  let page = await openSettings(browser, 0);
  log('\n[L1] 本机 0 篇、云端 3 篇，点一次「上传到云端」');
  log('  点击前：PUT 次数=' + putHits(stub) + ' GET 次数=' + getHits(stub) + ' 云端 notes=' + remoteNotes(stub));
  await page.click('#wdPushBtn');
  await sleep(600);
  var m1 = await modal(page);
  log('  点击后 600ms：确认层=' + (m1 ? JSON.stringify(m1) : '无（没有任何对话框）'));
  if (!m1) {
    await sleep(2500);
    log('  PUT 次数=' + putHits(stub) + ' 云端 notes=' + remoteNotes(stub) + ' ← 云端被替换成什么');
    log('  结果行文案="' + (await page.evaluate('(document.getElementById("wdResult")||{}).textContent')) + '"');
  } else {
    await page.evaluate('document.querySelector(".ui-btn-primary,.tc-ok").click()');
    await sleep(2500);
    log('  确认后 PUT 次数=' + putHits(stub) + ' 云端 notes=' + remoteNotes(stub));
  }
  await page.close();

  /* ---------- L2 自动上传 ---------- */
  page = await openSettings(browser, 0);
  log('\n[L2] autosync=1、本机 0 篇、云端 3 篇，没人点按钮（探针直接调 scheduleSync，产品默认 30s）');
  await page.evaluate('WebDAV.setAutosync(true)');
  var hits0 = putHits(stub);
  log('  调用前：autosyncOn=' + await page.evaluate('WebDAV.autosyncOn()') + ' PUT 次数=' + hits0);
  await page.evaluate('WebDAV.scheduleSync(500)');
  await sleep(2500);
  log('  调用后：PUT 次数=' + putHits(stub) + '（自增 ' + (putHits(stub) - hits0) + '）云端 notes=' + remoteNotes(stub));
  log('  期间出现过确认层吗=' + JSON.stringify(await modal(page)));
  log('  tn_webdav_last=' + await page.evaluate('localStorage.getItem("tn_webdav_last")'));
  await page.close();

  /* ---------- L3 清除全部数据 ---------- */
  page = await openSettings(browser, 2);
  log('\n[L3] 本机 2 篇，点「清除全部数据」');
  log('  按钮文案="' + await page.evaluate('(document.querySelector(".data-danger")||{}).textContent') + '"');
  log('  清前条数=' + JSON.stringify(await counts(page)));
  await page.click('button.data-danger');
  await sleep(400);
  var m3 = await modal(page);
  log('  确认层=' + JSON.stringify(m3));
  await page.evaluate('document.querySelector(".ui-btn-primary,.tc-ok").click()');
  await sleep(700);
  log('  清后条数=' + JSON.stringify(await counts(page)));
  log('  页面上现存的提示文案=' + JSON.stringify(await page.evaluate(
    '(function(){var a=[].slice.call(document.querySelectorAll(".tn-flash,.ui-toast,.toast"));return a.map(function(x){return x.className+"|"+x.textContent;});})()'
  )));
  log('  clearNotes 的源码串（现场读，不抄文档）=' + await page.evaluate(
    '(window.TravelNotes&&TravelNotes.clearNotes)?String(TravelNotes.clearNotes).slice(0,220):"n/a"'));
  log('  清完 PUT 次数=' + putHits(stub) + ' 云端 notes=' + remoteNotes(stub) + '（autosync 关，此步只看不判）');
  await page.close();

  /* ---------- L3b 清完 + 自动上传：S1-2 是否现场引爆 S1-1 ---------- */
  stub.files.set(FILE_PATH, JSON.stringify(remoteEnv()));   /* 云端复位成 3 篇，才看得出「被谁抹掉」 */
  page = await openSettings(browser, 2);
  await page.evaluate('WebDAV.setAutosync(true)');
  log('\n[L3b] autosync=1、本机 2 篇、云端 3 篇，点「清除全部数据」（完全不碰上传按钮）');
  log('  清前：云端 notes=' + remoteNotes(stub) + ' PUT 次数=' + putHits(stub) +
    ' 自动上传钩子挂着吗=' + await page.evaluate('(function(){var p=window.TravelNotes&&TravelNotes._afterSave;return p?String(p).slice(0,90):"无";})()'));
  var h3b = putHits(stub);
  await page.click('button.data-danger');
  await sleep(300);
  await page.evaluate('document.querySelector(".ui-btn-primary,.tc-ok").click()');
  await sleep(2000);
  log('  清除后 2s：PUT 自增 ' + (putHits(stub) - h3b) + '（默认防抖 30s，此刻还该是 0）');
  await sleep(31000);
  log('  清除后 33s：PUT 自增 ' + (putHits(stub) - h3b) + ' 云端 notes=' + remoteNotes(stub));
  log('  tn_webdav_last=' + await page.evaluate('localStorage.getItem("tn_webdav_last")'));
  log('  → 若云端 notes 从 3 变 0，则「清除游记」这一次点击独立把唯一备份抹了，全程没有任何上传确认');
  await page.close();

  /* ---------- L4 录音面板 ---------- */
  const tp = await browser.newPage();
  await tp.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  await tp.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await tp.evaluate(seedLocal, 2, DAV_PORT);
  await tp.reload({ waitUntil: 'domcontentloaded' });
  await tp.waitForFunction('window.TravelNotes && TravelNotes.ensureUI', { timeout: 20000 });
  await sleep(600);
  log('\n[L4] 录音面板：打字 → 点关闭 / 点遮罩');
  await tp.evaluate('TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await sleep(500);
  await tp.evaluate('(function(){var t=document.getElementById("tnRawEdit");' +
    't.value="我在木塔下说了一段话，还没保存";' +
    't.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await sleep(300);
  log('  打字后：panel display=' + await tp.evaluate('document.querySelector(".tn-panel").style.display') +
    '  textarea="' + await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value') + '"' +
    ' 保存钮 disabled=' + await tp.evaluate('document.getElementById("tnSave").disabled'));
  var geom = await tp.evaluate('(function(){' +
    'var p=document.querySelector(".tn-panel").getBoundingClientRect();' +
    'var pts=[[2,2],[164,360],[326,721],[10,700]];' +
    'return {panel:[Math.round(p.width),Math.round(p.height)],' +
    'hit:pts.map(function(q){var e=document.elementFromPoint(q[0],q[1]);' +
    'return q[0]+","+q[1]+"→"+(e?(e.className||e.tagName):"null")})}})()');
  log('  面板尺寸=' + JSON.stringify(geom.panel) + ' 四点命中=' + JSON.stringify(geom.hit));
  log('  9px 网格逐点 elementFromPoint 归属=' + JSON.stringify(await tp.evaluate(
    '(function(){var g={mask:0,panel:0,panelChild:0,other:0},total=0,otherSamples=[];' +
    'for(var y=2;y<723;y+=9){for(var x=2;x<328;x+=9){total++;var e=document.elementFromPoint(x,y);' +
    'if(!e){g.other++;continue;}' +
    'if(e.classList&&e.classList.contains("tn-mask"))g.mask++;' +
    'else if(e.closest&&e.closest(".tn-panel")===document.querySelector(".tn-panel"))g.panelChild++;' +
    'else if(e.classList&&e.classList.contains("tn-panel"))g.panel++;' +
    'else {g.other++;if(otherSamples.length<6)otherSamples.push(e.className||e.tagName);}}}' +
    'return {grid:total,by:g,otherSamples:otherSamples};})()')));
  log('  #tnX 位置与中心命中=' + JSON.stringify(await tp.evaluate(
    '(function(){var x=document.getElementById("tnX");if(!x)return "无 #tnX";var r=x.getBoundingClientRect();' +
    'var c=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);' +
    'return {rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],' +
    'topAtCenter:(c?(c.id||c.className||c.tagName):"null"),isSelf:c===x};})()')));
  await tp.evaluate('document.querySelector(".tn-mask").click()');
  await sleep(600);
  log('  代码里调 mask.click() 后：panel display=' + await tp.evaluate('document.querySelector(".tn-panel").style.display'));
  await tp.evaluate('TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await sleep(500);
  log('  重新打开后 textarea="' + await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value') + '"' +
    ' 保存钮 disabled=' + await tp.evaluate('document.getElementById("tnSave").disabled') +
    ' → 那段话还在不在');
  await tp.evaluate('(function(){var t=document.getElementById("tnRawEdit");t.value="第二次说的内容";' +
    't.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await sleep(300);
  await tp.click('#tnX');
  await sleep(600);
  log('  点 ← (#tnX) 后：panel display=' + await tp.evaluate('document.querySelector(".tn-panel").style.display') +
    ' 期间确认层=' + JSON.stringify(await modal(tp)));
  await tp.evaluate('TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await sleep(500);
  log('  再开一次 textarea="' + await tp.evaluate('(document.getElementById("tnRawEdit")||{}).value') + '"');
  log('  游记条数（内容没保存所以应还是 2）=' + await tp.evaluate('TravelNotes.count()'));
  await tp.close();

  await browser.close();
  stub.close(function () {});
  server.close(function () {});
  log('\n=== 探针结束 ===');
}

main().catch(function (e) { console.error('PROBE ERROR ' + (e && e.stack || e)); process.exit(1); });
