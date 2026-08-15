/* IDB 增量写：persist 改为 diff 增量（只写变化的记录），调用点零改动 */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');

const oldPersist = `  function persist() {
    // 内存已更新；异步写回 IDB（失败回退 localStorage 兼容）
    var snap = notes.slice();
    openDB(function (db) {
      if (!db) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} return; }
      try {
        var tx = db.transaction('notes', 'readwrite');
        var st = tx.objectStore('notes');
        st.clear();
        snap.forEach(function (n) { st.put(n); });
        tx.onerror = function () { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} };
      } catch (e) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e2) {} }
    });`;

const newPersist = `  /* 上次持久化快照（id → JSON 字符串），用于增量 diff */
  var lastSnap = null;
  function persist() {
    // 内存已更新；增量写回 IDB（diff：只写变化的记录；删除消失的；首次全量）
    var snap = notes.slice();
    var curIds = {}, changed = [], removed = [];
    snap.forEach(function (n) {
      curIds[n.id] = 1;
      var j = JSON.stringify(n);
      if (!lastSnap || lastSnap[n.id] !== j) changed.push(n);
    });
    if (lastSnap) {
      Object.keys(lastSnap).forEach(function (id) { if (!curIds[id]) removed.push(id); });
    }
    openDB(function (db) {
      if (!db) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} return; }
      try {
        var tx = db.transaction('notes', 'readwrite');
        var st = tx.objectStore('notes');
        if (!lastSnap) st.clear();          // 首次：全量重建
        removed.forEach(function (id) { st.delete(id); });
        changed.forEach(function (n) { st.put(n); });
        tx.onerror = function () { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} };
      } catch (e) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e2) {} }
      // 更新快照
      var ns = {};
      snap.forEach(function (n) { ns[n.id] = JSON.stringify(n); });
      lastSnap = ns;
    });`;

if (t.includes(oldPersist)) {
  t = t.split(oldPersist).join(newPersist);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('persist → incremental diff');
} else {
  console.log('SKIP persist (pattern changed)');
}

/* SPA 体验层：全局页面进入过渡（零页面改动） */
let d = fs.readFileSync('design.css', 'utf8');
const dcrlf = d.includes('\r\n');
if (dcrlf) d = d.replace(/\r\n/g, '\n');
const anim = `
/* ============================================================
   SPA 体验层 2026-08-15：全局页面进入过渡（file:// 多页架构的轻量替代）
   全量 SPA 需 WebView 开启 file fetch 或打包合并，见 docs/spa-route-plan
   ============================================================ */
@keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
body{animation:pageIn .32s var(--ease-standard) both}
`;
if (!d.includes('SPA 体验层 2026-08-15')) {
  fs.writeFileSync('design.css', dcrlf ? (d + anim).replace(/\n/g, '\r\n') : d + anim, 'utf8');
  console.log('page transition added');
} else {
  console.log('transition exists');
}
