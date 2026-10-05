/* ticketbox.js — 「我的票」：机票/车票/酒店/门票的凭据卡（文本手填 + 附件）。
 * 三条边界是刻意的，改之前先读 docs/功能完善实施方案-2026-10-05.md §5.3：
 *   ① 不做订票、不做 OCR / 票面解析（那是服务端量级）；
 *   ② 附件只进 IndexedDB ⇒ 不进 backup.js KEYS，换机不会带过去，UI 必须把这条说给用户；
 *   ③ 提醒只有页内横幅一条腿，禁止 Notification / showNotification（系统推送要改壳重打包，是隐形债）。
 */
(function () {
  var DB_NAME = 'trace-attachments', DB_VER = 1, STORE = 'attachments';
  var KINDS = ['机票', '车票', '酒店', '门票', '其他'];
  var MAX_ATT = 12;                    /* 每行程附件张数上限：800px JPEG 约 100–200KB，一沓票不能悄悄吃掉配额 */
  var MAX_RAW = 8 * 1024 * 1024;       /* PDF 不压缩、原样存，所以单张要有天花板 */
  var SOON = 24 * 3600 * 1000;         /* 「快要用了」窗口：出发前 24h 内提醒一次 */

  function db() {
    return new Promise(function (res, rej) {
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { rej(e); return; }
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id' }).createIndex('byTrip', 'tripId');
        }
      };
      req.onsuccess = function (e) { res(e.target.result); };
      req.onerror = function (e) { rej(e); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), out;
        try { out = fn(t.objectStore(STORE)); } catch (e) { d.close(); rej(e); return; }
        t.oncomplete = function () { d.close(); res(out && 'result' in out ? out.result : undefined); };
        t.onabort = function (e) { d.close(); rej(e.target.error); };
      });
    });
  }
  function uid() { return 'tb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* at 升序排在前（要先用的票在最上面），没填时间的按录入时间倒序垫底 */
  function sortRows(a, b) {
    var x = a.at ? Date.parse(a.at) : Infinity, y = b.at ? Date.parse(b.at) : Infinity;
    if (x !== y) return x - y;
    return (b.ts || 0) - (a.ts || 0);
  }
  function list(tripId) {
    return tx('readonly', function (s) {
      return tripId ? s.index('byTrip').getAll(tripId) : s.getAll();
    }).then(function (rows) { return (rows || []).sort(sortRows); });
  }
  function get(id) { return tx('readonly', function (s) { return s.get(id); }); }

  function put(rec) {
    if (!rec || !rec.tripId) return Promise.resolve(null);
    var r = {
      id: rec.id || uid(),
      tripId: String(rec.tripId),
      kind: KINDS.indexOf(rec.kind) >= 0 ? rec.kind : '其他',
      title: String(rec.title || '').slice(0, 80),
      code: String(rec.code || '').slice(0, 60),
      at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rec.at || '') ? rec.at : '',
      note: String(rec.note || '').slice(0, 200),
      blob: rec.blob || '',
      mime: rec.mime || '',
      ts: rec.ts || Date.now()
    };
    if (!r.title && !r.code && !r.blob) return Promise.resolve(null);
    return tx('readwrite', function (s) { return s.put(r); }).then(function () { return r; });
  }
  function remove(id) { return tx('readwrite', function (s) { s.delete(id); }); }

  /* 附件：图片一律走 UI.compressImage 那一档（与随手记照片同尺子）；PDF 原样存 */
  function readFile(file, cb) {
    if (!file) { cb(null, '没选中文件'); return; }
    var isImg = /^image\//.test(file.type || '');
    if (!isImg && !/^application\/pdf$/.test(file.type || '')) { cb(null, '只收图片或 PDF'); return; }
    if (!isImg && file.size > MAX_RAW) { cb(null, 'PDF 超过 8MB，截个图更省地方'); return; }
    var fr = new FileReader();
    fr.onerror = function () { cb(null, '附件读不出来'); };
    fr.onload = function () {
      var url = String(fr.result || '');
      if (!isImg) { cb({ blob: url, mime: file.type }, null); return; }
      UI.compressImage(url, function (out) {
        if (!out) { cb(null, '这张图解不开'); return; }
        cb({ blob: out, mime: 'image/jpeg' }, null);
      });
    };
    fr.readAsDataURL(file);
  }
  function openFile(rec) {
    if (!rec || !rec.blob) return;
    var a = document.createElement('a');
    a.href = rec.blob;
    a.download = (rec.title || '我的票') + (/pdf/.test(rec.mime) ? '.pdf' : '.jpg');
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* 24h 页内横幅：每张票一次会话只提醒一次（换页不重复轰炸），点它进那趟行程的清单页 */
  function nudge(tripId) {
    var seen;
    try { seen = JSON.parse(sessionStorage.getItem('tb_nudged') || '[]'); } catch (e) { seen = []; }
    return list(tripId || '').then(function (rows) {
      var now = Date.now();
      var hit = rows.filter(function (r) {
        if (!r.at || seen.indexOf(r.id) >= 0) return false;
        var t = Date.parse(r.at);
        return t > now && t - now <= SOON;
      })[0];
      if (!hit) return;
      seen.push(hit.id);
      try { sessionStorage.setItem('tb_nudged', JSON.stringify(seen)); } catch (e) {}
      UI.nudge({
        pre: '「', strong: hit.title || hit.kind, text: '」' + hit.kind + '就在 ' + fmt(hit.at) + '，还有不到 24 小时。',
        actionText: '看票', onAction: function () { location.href = 'checklist.html?trip=' + encodeURIComponent(hit.tripId); }
      });
    }).catch(function () {});
  }
  function fmt(at) { return at ? at.replace('T', ' ') : ''; }

  window.TicketBox = {
    DB_NAME: DB_NAME, STORE: STORE, KINDS: KINDS, MAX_ATT: MAX_ATT,
    list: list, get: get, put: put, remove: remove, readFile: readFile, openFile: openFile, nudge: nudge, fmt: fmt
  };
})();
