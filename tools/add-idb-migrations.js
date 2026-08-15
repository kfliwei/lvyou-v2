/* IDB 版本迁移框架：DB_VERSION + DB_MIGRATIONS 表驱动，onupgradeneeded 依次执行 */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = `  function openDB(cb) {
    if (DB) { cb && cb(DB); return; }
    if (!window.indexedDB) { loadLocalStorageLegacy(cb); return; }
    try {
      var req = indexedDB.open('gujian-notes', 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          var st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };`;
const to = `  /* ---- IDB 版本迁移框架（2026-08-15）：数据结构变化时新增迁移函数，勿改历史函数 ---- */
  var DB_VERSION = 1;
  var DB_MIGRATIONS = {
    1: function (db) {
      /* v1：初始建表（notes + 索引） */
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    }
    /* 示例（未来版本）：
    2: function (db) {
      // 新增 photos 表 / 加索引 / 数据改写
    }
    */
  };
  function openDB(cb) {
    if (DB) { cb && cb(DB); return; }
    if (!window.indexedDB) { loadLocalStorageLegacy(cb); return; }
    try {
      var req = indexedDB.open('gujian-notes', DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        /* 从旧版本逐级迁移到当前版本 */
        for (var v = e.oldVersion + 1; v <= DB_VERSION; v++) {
          if (DB_MIGRATIONS[v]) DB_MIGRATIONS[v](db);
        }
      };`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('IDB migration framework added');
} else console.log('SKIP');
