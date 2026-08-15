/* 修 p3 数据注入：indexedDB 写入（替代 localStorage） */
const fs = require('fs');
let s = fs.readFileSync('check-six-features.js', 'utf8');
const from = `  await p3.evaluate(() => {
    const KEY = '***';
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'c1', title: '石窟之行', siteName: '云冈石窟', lat: 40.1, lng: 113.1, ts: 1, date: '2026-08-01', text: '好震撼', photos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='], raw: '' },
      { id: 'c2', title: '长城', siteName: '八达岭', lat: 40.3, lng: 116.0, ts: 2, date: '2026-08-05', text: '人很多', raw: '' }
    ]));
  });`;
const to = `  await p3.evaluate(() => new Promise(function (resolve) {
    var req = indexedDB.open('gujian-notes', 1);
    req.onsuccess = function () {
      var db = req.result;
      var tx = db.transaction('notes', 'readwrite');
      var st = tx.objectStore('notes');
      st.clear();
      var base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      st.put({ id: 'c1', title: '石窟之行', siteName: '云冈石窟', lat: 40.1, lng: 113.1, ts: 1, date: '2026-08-01', text: '好震撼', photos: [base64, base64], raw: '' });
      st.put({ id: 'c2', title: '长城', siteName: '八达岭', lat: 40.3, lng: 116.0, ts: 2, date: '2026-08-05', text: '人很多', raw: '' });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    };
  }));`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('check-six-features.js', s, 'utf8');
  console.log('p3 IDB injection fixed');
} else console.log('miss');
