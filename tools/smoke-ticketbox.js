/* tools/smoke-ticketbox.js — 「我的票」真实浏览器冒烟（批次 17-C）
 * A 组：trace-attachments 库与 TicketBox 数据层（库/store/索引实名、字段校验、字节 round-trip、排序、隔离）
 * B 组：checklist.html 的票卡 UI（表单入库、附件走压缩档、上限、确认删除）
 * C 组：24h 页内横幅（出现 / 10s 自移除 / 一次会话一次 / 窗口外不出）+ 零 Notification 反证
 * 判据一律取自 IndexedDB 与 DOM 实况；源码锚点是 verify.js §30 的活，这里不重复。
 * 视口 452×995 = 一加 Ace 6T 真机档。
 * 用法: node tools/smoke-ticketbox.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const OUT = path.join(ROOT, 'tools', 'out');

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function freshPage(browser, url, errs) {
  const wipe = await browser.newPage();
  await wipe.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* IDB 与 localStorage 同源共享，清场要连票库一起清，否则「上限 12」「排序」这类判据会被上一段残留顶掉。
     只清 store 不删库：deleteDatabase 撞上别的连接会一直 pending，把整个闸门吊死在超时里。 */
  await wipe.evaluate(() => new Promise(res => {
    setTimeout(res, 8000);
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    var req = indexedDB.open('trace-attachments', 1);
    req.onupgradeneeded = function (e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('attachments')) {
        d.createObjectStore('attachments', { keyPath: 'id' }).createIndex('byTrip', 'tripId');
      }
    };
    req.onsuccess = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('attachments')) { db.close(); res(); return; }
      var tx = db.transaction('attachments', 'readwrite');
      tx.objectStore('attachments').clear();
      tx.oncomplete = function () { db.close(); res(); };
      tx.onerror = function () { db.close(); res(); };
    };
    req.onerror = function () { res(); };
  }));
  await wipe.close();
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.evaluateOnNewDocument(() => {
    /* Notification 一根线都不许碰（提醒只有页内横幅）。桩子在新文档脚本最前面装，
       这样连启动期就构造 Notification 的代码也躲不过计数。 */
    window.__notif = 0;
    var Real = window.Notification;
    if (Real) {
      var Stub = function (t, o) { window.__notif++; return new Real(t, o); };
      Stub.prototype = Real.prototype;
      Stub.permission = Real.permission;
      Stub.requestPermission = function () { return Promise.resolve(Real.permission || 'denied'); };
      /* 用 getter 而不是赋值：属性一旦是只读访问器，页面里的赋值也拿不到真构造器，计数才关得住 */
      try { Object.defineProperty(window, 'Notification', { configurable: true, get: function () { return Stub; } }); } catch (e) {}
    }
  });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return p;
}

/* 附件真从磁盘进 input：puppeteer 25 把 uploadFile 收在 ElementHandle 上（page 层没有这个方法），
   它在 setFileInputFiles 之后自己 dispatch change，所以不要手补事件——onchange 会被跑两遍。 */
async function attach(p, file) {
  const el = await p.$('#tbFile');
  await el.uploadFile(file);
  await el.dispose();
}

const pad = n => (n < 10 ? '0' : '') + n;
function localInput(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const PNG_PATH = path.join(OUT, 'tb-sample.png');
  const PDF_PATH = path.join(OUT, 'tb-sample.pdf');
  const PDF_TEXT = '%PDF-1.4 我的票附件样本 · 字节要原样回来\n';
  fs.writeFileSync(PDF_PATH, PDF_TEXT, 'utf8');
  const PDF_B64 = fs.readFileSync(PDF_PATH).toString('base64');

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    /* 协议超时压到 2 分钟：默认 10 分钟会让「挂在某个 evaluate 上」这种事故一小时都问不出原因 */
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const errs = [];
  const c = await freshPage(browser, U('checklist.html'), errs);

  /* 一张 1200×900 的真 PNG（给压缩档用），在页面里画出来再落盘，省掉二进制样本文件 */
  const pngB64 = await c.evaluate(() => {
    var cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900;
    var g = cv.getContext('2d');
    g.fillStyle = '#c86d4b'; g.fillRect(0, 0, 1200, 900);
    g.fillStyle = '#fff'; g.fillRect(60, 60, 400, 200);
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(PNG_PATH, Buffer.from(pngB64.split(',')[1], 'base64'));

  await c.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: 'p111', name: '川西三日', startDate: '2026-11-08', days: [{ stops: [] }] },
      { id: 'p222', name: '别趟行程', startDate: '2026-12-01', days: [{ stops: [] }] }
    ]));
  });

  /* ================= A 组：数据层 ================= */
  await c.goto(U('checklist.html') + '?trip=p111', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const A0 = await c.evaluate(() => new Promise(res => {
    var d;
    try { d = indexedDB.open('trace-attachments', 1); } catch (e) { res({ err: 'open-throw:' + e.message }); return; }
    var done = false;
    /* 自带上限：IDB 请求一旦 pending（有连接没关就是永久 blocked），没有这个定时器整个闸门会吊死在协议超时里，
       连「挂在哪一步」都问不出来。到点把 request.readyState 交出来，红得可读。 */
    var fin = function (v) { if (!done) { done = true; res(v); } };
    setTimeout(function () { fin({ err: 'open-pending', state: d.readyState }); }, 5000);
    d.onsuccess = function () {
      try {
        var db = d.result;
        var has = db.objectStoreNames.contains('attachments');
        var idx = [];
        if (has) {
          var t = db.transaction('attachments').objectStore('attachments');
          /* DOMStringList 没有 forEach：写成 forEach 会在事件回调里静默抛错，request 已是 done 而 promise 永远 pending */
          for (var k = 0; k < t.indexNames.length; k++) idx.push(t.indexNames.item(k));
        }
        db.close();
        fin({ ver: db.version, has: has, idx: idx });
      } catch (e) { fin({ err: 'onsuccess-throw:' + e.message }); }
    };
    d.onerror = function () { fin({ err: 'open-failed' }); };
  }));
  ok('T0 库/store/索引实名（trace-attachments · attachments · byTrip）',
    A0.has === true && A0.idx.indexOf('byTrip') >= 0, JSON.stringify(A0));

  const A1 = await c.evaluate(async () => {
    var r = await TicketBox.put({ tripId: 'p111', kind: '机票', title: 'CA4113 成都→九寨', code: '32A', at: '2026-11-08T07:20', note: '提前 2h 到' });
    var back = await TicketBox.get(r.id);
    return { sent: r, back: back };
  });
  ok('T1 写入→读回：字段逐条相等且 id 由数据层生成',
    !!A1.sent && A1.back && A1.back.title === A1.sent.title && A1.back.code === '32A' && A1.back.kind === '机票' && /^tb/.test(A1.back.id),
    JSON.stringify(A1.back || {}).slice(0, 160));

  const A2 = await c.evaluate(async (b64) => {
    var r = await TicketBox.put({ tripId: 'p111', kind: '门票', title: 'PDF 门票', blob: 'data:application/pdf;base64,' + b64, mime: 'application/pdf' });
    var back = await TicketBox.get(r.id);
    return { same: back.blob === r.blob, mime: back.mime, bytes: atob(back.blob.split(',')[1]).length };
  }, PDF_B64);
  ok('T2 附件字节 round-trip（PDF 原样存，读回字符串完全相等）',
    A2.same && A2.mime === 'application/pdf' && A2.bytes === Buffer.byteLength(PDF_TEXT, 'utf8'), JSON.stringify(A2));

  const A3 = await c.evaluate(async () => {
    var cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900;
    cv.getContext('2d').fillRect(0, 0, 1200, 900);
    var raw = cv.toDataURL('image/png');
    var out = await new Promise(res => UI.compressImage(raw, res));
    var img = await new Promise(res => { var i = new Image(); i.onload = () => res(i); i.src = out; });
    var r = await TicketBox.put({ tripId: 'p111', kind: '车票', title: '截图票', blob: out, mime: 'image/jpeg' });
    var back = await TicketBox.get(r.id);
    return { w: img.naturalWidth, h: img.naturalHeight, mime: back.mime, stored: back.blob === out, kb: Math.round(back.blob.length * 0.75 / 1024) };
  });
  ok('T3 图片走随手记同一档压缩（长边 ≤800、落库是 jpeg）',
    A3.stored && A3.mime === 'image/jpeg' && Math.max(A3.w, A3.h) <= 800, JSON.stringify(A3));

  const A4 = await c.evaluate(async () => {
    /* readFile 的回车口径是 (附件, 错误文案)，两个都要接住：只取第一个参数会在拒收分支上拿到 null */
    var bad = await new Promise(res => TicketBox.readFile(new File(['hello'], 'x.txt', { type: 'text/plain' }), function (att, msg) { res({ att: att, msg: msg }); }));
    var rec = await TicketBox.put({ tripId: 'p111', kind: '签证', title: '乱写的种类', code: 'X' });
    var empty = await TicketBox.put({ tripId: 'p111', kind: '机票' });
    var badat = await TicketBox.put({ tripId: 'p111', kind: '酒店', title: '时间乱码', at: '明天早上' });
    return { err: bad.msg, kind: rec.kind, empty: empty, at: badat.at, total: (await TicketBox.list('p111')).length };
  });
  ok('T4 非图非 PDF 直接拒收并讲清', A4.err === '只收图片或 PDF', String(A4.err));
  ok('T5 kind 白名单：表外的值落库变「其他」', A4.kind === '其他', String(A4.kind));
  ok('T6 at 格式校验：解析不了的时间不入库', A4.at === '', JSON.stringify(A4.at));
  ok('T7 空条目不落库（title/code/blob 全空＝没这条票）',
    A4.empty === null && A4.total === 5, '本趟 ' + A4.total + ' 条');

  const A5 = await c.evaluate(async () => {
    await TicketBox.put({ tripId: 'p222', kind: '机票', title: '别趟的票', code: 'ZZZ' });
    var mine = await TicketBox.list('p111');
    var order = mine.map(r => r.at || '∞');
    return { n: mine.length, hasOther: mine.some(r => r.tripId !== 'p111'), order: order };
  });
  ok('T8 按行程隔离：list(p111) 里不混别趟', A5.n === 5 && !A5.hasOther, 'p111 ' + A5.n + ' 条');
  ok('T9 排序＝要用的在前（at 升序，没填时间的垫底）',
    A5.order.join('|') === '2026-11-08T07:20|∞|∞|∞|∞', A5.order.join(' | '));

  await c.reload({ waitUntil: 'domcontentloaded' });
  await sleep(600);
  const A6 = await c.evaluate(() => TicketBox.list('p111').then(rows => ({
    n: rows.length, titles: rows.map(r => r.title), order: rows.map(r => r.at || '∞')
  })));
  ok('T10 刷新后票还在（IndexedDB 真落盘，不是内存态）', A6.n === 5 && A6.titles.indexOf('CA4113 成都→九寨') >= 0,
    A6.n + ' 条：' + A6.titles.join('、').slice(0, 80));
  ok('T11 刷新后排序口径不变', A6.order.join('|') === '2026-11-08T07:20|∞|∞|∞|∞', A6.order.join(' | '));

  const A7 = await c.evaluate(async () => {
    var rows = await TicketBox.list('p111');
    var victim = rows.filter(r => r.title === '时间乱码')[0];
    await TicketBox.remove(victim.id);
    var after = await TicketBox.list('p111');
    return { left: after.length, gone: !after.some(r => r.id === victim.id), otherTrip: (await TicketBox.list('p222')).length };
  });
  ok('T12 删除只删这一条，别趟不受影响', A7.left === 4 && A7.gone && A7.otherTrip === 1,
    'p111 剩 ' + A7.left + ' / p222 ' + A7.otherTrip);

  /* ================= B 组：票卡 UI ================= */
  await c.goto(U('checklist.html') + '?trip=p111', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const B0 = await c.evaluate(() => ({
    tb: document.getElementById('tbCard').style.display,
    kinds: [].map.call(document.querySelectorAll('#tbKinds .chip'), el => el.textContent),
    on: (document.querySelector('#tbKinds .chip.on') || {}).textContent || '',
    note: document.querySelector('#tbCard .note').textContent,
    rows: document.querySelectorAll('#tbList .tb-row').length
  }));
  ok('T13 选定行程后票卡在场，五种 kind 一个不缺',
    B0.tb === 'block' && B0.kinds.join('、') === '机票、车票、酒店、门票、其他', JSON.stringify(B0.kinds));
  ok('T14 票卡跟着清单同一趟（列表已渲染 ' + B0.rows + ' 行）', B0.rows === 4, String(B0.rows));
  ok('T15 能力边界写在卡上：附件不进云备份（用户必须知道）', /不进云备份/.test(B0.note), B0.note.slice(0, 60));

  const soon = new Date(Date.now() + 3 * 3600 * 1000);
  await c.evaluate(() => {
    [].filter.call(document.querySelectorAll('#tbKinds .chip'), el => el.textContent === '酒店')[0].click();
  });
  await c.evaluate(at => {
    document.getElementById('tbTitle').value = '九寨天堂酒店';
    document.getElementById('tbCode').value = '房号 8802';
    document.getElementById('tbAt').value = at;
    document.getElementById('tbSave').click();
  }, localInput(soon));
  await sleep(700);
  const B1 = await c.evaluate(() => {
    const row = [].filter.call(document.querySelectorAll('#tbList .tb-row'), el => /九寨天堂酒店/.test(el.textContent))[0];
    return {
      kind: row ? row.querySelector('.tb-kind').textContent : 'no-row',
      meta: row ? (row.querySelector('small') || {}).textContent : '',
      cleared: document.getElementById('tbTitle').value === '' && document.getElementById('tbCode').value === '',
      rows: document.querySelectorAll('#tbList .tb-row').length,
      toast: ([].slice.call(document.querySelectorAll('.ui-toast')).pop() || {}).textContent || ''
    };
  });
  ok('T16 表单存票：kind 取当前 chip、票号与时间上了行',
    B1.kind === '酒店' && /房号 8802/.test(B1.meta) && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(B1.meta), JSON.stringify(B1.meta));
  ok('T17 存完清空表单、行数 +1', B1.cleared && B1.rows === 5, 'cleared=' + B1.cleared + ' rows=' + B1.rows);

  await c.evaluate(() => { document.getElementById('tbTitle').value = ''; document.getElementById('tbCode').value = ''; document.getElementById('tbSave').click(); });
  await sleep(300);
  const B2 = await c.evaluate(() => ({
    toast: ([].slice.call(document.querySelectorAll('.ui-toast')).pop() || {}).textContent || '',
    rows: document.querySelectorAll('#tbList .tb-row').length
  }));
  ok('T18 三样全空的保存被挡下并讲清（不产幽灵票）',
    /至少写个名字/.test(B2.toast) && B2.rows === 5, JSON.stringify(B2));

  await c.evaluate(() => { document.getElementById('tbTitle').value = '高铁截图票'; });
  await attach(c, PNG_PATH);
  await sleep(900);
  const B3 = await c.evaluate(() => ({ name: document.getElementById('tbAttName').textContent }));
  ok('T19 选完图片附件：文件名 + 压缩后体积上屏（用户看得见自己占了多少）',
    /tb-sample\.png/.test(B3.name) && /KB/.test(B3.name), B3.name);
  await c.evaluate(() => { [].filter.call(document.querySelectorAll('#tbKinds .chip'), el => el.textContent === '车票')[0].click(); document.getElementById('tbSave').click(); });
  await sleep(900);
  const B4 = await c.evaluate(() => TicketBox.list('p111').then(rows => {
    const r = rows.filter(x => x.title === '高铁截图票')[0];
    return { kind: r && r.kind, mime: r && r.mime, hasImg: !!document.querySelector('#tbList .tb-row img') };
  }));
  ok('T20 附件真进了库（image/jpeg）并上了缩略图', B4.kind === '车票' && B4.mime === 'image/jpeg' && B4.hasImg, JSON.stringify(B4));

  const B5 = await c.evaluate(() => new Promise(res => {
    var keys = Object.keys(localStorage);
    var leak = keys.filter(k => { try { return localStorage.getItem(k).indexOf('data:image') >= 0 || localStorage.getItem(k).length > 200000; } catch (e) { return false; } });
    res({ leak: leak, n: keys.length });
  }));
  ok('T21 附件没漏进 localStorage（不进备份的前提：它压根不在 LS 里）',
    B5.leak.length === 0, '泄漏键：' + B5.leak.join(',') + ' / 共 ' + B5.n + ' 键');

  /* 上限 12：把带附件的票灌到 12 张，第 13 次点保存必须被挡 */
  const B6 = await c.evaluate(async () => {
    var need = TicketBox.MAX_ATT - (await TicketBox.list('p111')).filter(r => r.blob).length;
    for (var j = 0; j < need; j++) {
      await TicketBox.put({ tripId: 'p111', kind: '门票', title: '凑数附件 ' + j, blob: 'data:application/pdf;base64,AAAA', mime: 'application/pdf' });
    }
    var rows = await TicketBox.list('p111');
    return { max: TicketBox.MAX_ATT, att: rows.filter(r => r.blob).length, all: rows.length };
  });
  ok('T22 每行程附件上限是 12（常量与实灌张数对上）',
    B6.max === 12 && B6.att === 12, '上限 ' + B6.max + ' / 已灌 ' + B6.att);
  /* 这批是从数据层直接灌的，票卡没被叫过重画；不 reload 就在旧 DOM 上找新行，找不到的是渲染而不是丢失 */
  await c.reload({ waitUntil: 'domcontentloaded' });
  await sleep(700);
  /* 先填标题再挂附件：中间不能点保存，否则第一次把表单清空，第二次测的就是「只有附件」那条分支 */
  await c.evaluate(() => { document.getElementById('tbTitle').value = '第十三个附件'; });
  await attach(c, PDF_PATH);
  await sleep(400);
  await c.evaluate(() => { document.getElementById('tbSave').click(); });
  await sleep(600);
  const B7 = await c.evaluate(() => TicketBox.list('p111').then(rows => ({
    att: rows.filter(r => r.blob).length,
    toast: ([].slice.call(document.querySelectorAll('.ui-toast')).pop() || {}).textContent || ''
  })));
  ok('T23 第 13 个附件被挡下，并说清上限与出路',
    B7.att === 12 && /最多存 12 个附件/.test(B7.toast), B7.att + ' 张 / ' + B7.toast);

  await c.evaluate(() => {
    [].filter.call(document.querySelectorAll('#tbList .tb-row'), el => /凑数附件 0/.test(el.textContent))[0].querySelector('.ck-remove').click();
  });
  await sleep(400);
  const B8 = await c.evaluate(() => ({
    title: (document.querySelector('.ui-modal-title') || {}).textContent || '',
    text: (document.querySelector('.ui-modal-text') || {}).textContent || '',
    danger: !!document.querySelector('.ui-modal .ui-btn-primary')
  }));
  ok('T24 删除走确认卡（不是原生 confirm），并讲清删掉的票不会自己长回来',
    B8.title === '删除这张票' && /不会自己长回来/.test(B8.text), JSON.stringify(B8).slice(0, 120));
  await c.evaluate(() => document.querySelector('.ui-modal .ui-btn-primary').click());
  await sleep(500);
  const B9 = await c.evaluate(() => TicketBox.list('p111').then(rows => ({
    att: rows.filter(r => r.blob).length, gone: !rows.some(r => r.title === '凑数附件 0')
  })));
  ok('T25 确认后真删（库里少一张，行也少一行）', B9.att === 11 && B9.gone, JSON.stringify(B9));

  /* ================= C 组：24h 页内横幅 ================= */
  const C0 = await c.evaluate(async () => {
    sessionStorage.clear();
    document.querySelectorAll('.ui-nudge').forEach(el => el.remove());
    await TicketBox.nudge();
    await new Promise(r => setTimeout(r, 120));
    var d = document.querySelector('.ui-nudge');
    var cs = d ? getComputedStyle(d) : null;
    /* CSSStyleDeclaration 是实时对象，跨 evaluate 传回 node 就只剩空壳（三个值全成 undefined，断言假红）。
       必须在页面里把要判的三个字符串取出来。 */
    return {
      shown: !!d, text: d ? d.textContent : '',
      pos: cs ? cs.position : '', z: cs ? cs.zIndex : '', br: cs ? cs.borderRadius : '',
      seen: JSON.parse(sessionStorage.getItem('tb_nudged') || '[]').length,
      notif: window.__notif
    };
  });
  ok('T26 出发前 24h 内的票 → 页内横幅出现', C0.shown && /九寨天堂酒店/.test(C0.text), C0.text.slice(0, 70));
  ok('T27 横幅讲的是「什么时候」不是「离得多远」', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(C0.text), C0.text.slice(0, 80));
  /* 这一条只证「.ui-nudge 的样式在本页真的生效」（design.css 挂上了、类名没写错），不是证数值来源；
     数值是否还等于收口前那行内联 cssText 由 verify.js §30 的源码锚点看着（全站只允许 design.css 定义 .ui-nudge）。 */
  ok('T28 横幅用的是 .ui-nudge 组件样式（design.css 在本页已生效）',
    C0.pos === 'fixed' && C0.z === '9500' && C0.br === '16px',
    [C0.pos, C0.z, C0.br].join('/'));
  ok('T29 横幅触发时零 Notification 构造（提醒只有页内这一条腿）', C0.notif === 0, 'Notification 调用 ' + C0.notif + ' 次');

  const C1 = await c.evaluate(async () => {
    document.querySelectorAll('.ui-nudge').forEach(el => el.remove());
    await TicketBox.nudge();
    await new Promise(r => setTimeout(r, 100));
    return { again: document.querySelectorAll('.ui-nudge').length, seen: JSON.parse(sessionStorage.getItem('tb_nudged') || '[]').length };
  });
  ok('T30 同一张票一次会话只提醒一次（换页不重复轰炸）', C1.again === 0 && C1.seen === 1, JSON.stringify(C1));

  const C2 = await c.evaluate(async (far) => {
    var rows = await TicketBox.list('p111');
    var ticket = rows.filter(r => r.title === '九寨天堂酒店')[0];
    ticket.at = far;                     /* 时间一律按本地档写，toISOString 会把 UTC 串当本地时间读，窗口算歪 8h */
    await TicketBox.put(ticket);
    sessionStorage.clear();
    document.querySelectorAll('.ui-nudge').forEach(el => el.remove());
    await TicketBox.nudge();
    await new Promise(r => setTimeout(r, 120));
    var over = document.querySelectorAll('.ui-nudge').length;
    ticket.at = '2020-01-01T08:00';
    await TicketBox.put(ticket);
    sessionStorage.clear();
    await TicketBox.nudge();
    await new Promise(r => setTimeout(r, 120));
    return { over: over, past: document.querySelectorAll('.ui-nudge').length };
  }, localInput(new Date(Date.now() + 30 * 3600 * 1000)));
  ok('T31 24h 之外不提醒（30h 后的票不是催命符）', C2.over === 0, String(C2.over));
  ok('T32 已经过点的票不提醒（过期票不该天天弹）', C2.past === 0, String(C2.past));

  const C3 = await c.evaluate(async (near) => {
    var rows = await TicketBox.list('p111');
    var ticket = rows.filter(r => r.title === '九寨天堂酒店')[0];
    ticket.at = near;
    await TicketBox.put(ticket);
    sessionStorage.clear();
    document.querySelectorAll('.ui-nudge').forEach(el => el.remove());
    await TicketBox.nudge();
    await new Promise(r => setTimeout(r, 100));
    var live = document.querySelectorAll('.ui-nudge').length;
    await new Promise(r => setTimeout(r, 10400));
    return { live: live, after: document.querySelectorAll('.ui-nudge').length };
  }, localInput(new Date(Date.now() + 2 * 3600 * 1000)));
  ok('T33 横幅 10s 自移除（常驻会把页面挤成广告位）', C3.live === 1 && C3.after === 0,
    '出现 ' + C3.live + ' → 10.5s 后 ' + C3.after);

  const CN = await c.evaluate(() => window.__notif);
  ok('T34 到收尾累计仍为零 Notification（C 组共触发过 5 次 nudge）', CN === 0, '累计 ' + CN + ' 次');

  /* 正向对照：桩子自己得能数到东西，否则上面两条「为零」永远为真，测了个寂寞 */
  const CPROBE = await c.evaluate(() => {
    try { new Notification('探针'); } catch (e) {}
    return window.__notif;
  });
  ok('T34b Notification 计数是活的（主动构造一次就抓到一次）', CPROBE === 1, '抓到 ' + CPROBE + ' 次');

  ok('Z 全程零页面报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? '\n=== SMOKE FAIL: ' + fails + ' 条 ===' : '\n=== SMOKE ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASH', e); process.exit(2); });
