/* 行级重写 p3 注入块：KEY→travelNotes + IDB 写入 */
const fs = require('fs');
const f = 'check-six-features.js';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const lines = s.split('\n');

/* 找到注入块（63 行 evaluate 起 到 69 行 }); 止）——按内容定位 */
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const KEY =')) { start = i - 1; break; }
}
if (start >= 0) {
  /* 找 }); 结束（start 后第一个 "  });" 或 "});" 行） */
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '});') { end = i; break; }
  }
}
console.log('注入块行:', start + 1, '-', end + 1);
if (start >= 0 && end > start) {
  const block = [
    "  await p3.evaluate(() => new Promise(function (resolve) {",
    "    var req = indexedDB.open('gujian-notes', 1);",
    "    req.onsuccess = function () {",
    "      var db = req.result;",
    "      var tx = db.transaction('notes', 'readwrite');",
    "      var st = tx.objectStore('notes');",
    "      st.clear();",
    "      var base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';",
    "      st.put({ id: 'c1', title: '石窟之行', siteName: '云冈石窟', lat: 40.1, lng: 113.1, ts: 1, date: '2026-08-01', text: '好震撼', photos: [base64, base64], raw: '' });",
    "      st.put({ id: 'c2', title: '长城', siteName: '八达岭', lat: 40.3, lng: 116.0, ts: 2, date: '2026-08-05', text: '人很多', raw: '' });",
    "      tx.oncomplete = function () { resolve(true); };",
    "      tx.onerror = function () { resolve(false); };",
    "    };",
    "  }));"
  ].join('\n');
  lines.splice(start, end - start + 1, block);
  fs.writeFileSync(f, crlf ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'), 'utf8');
  console.log('注入块已重写');
}
/* 验证 */
const after = fs.readFileSync(f, 'utf8');
console.log('含 IDB 注入:', after.includes("indexedDB.open('gujian-notes'"));
console.log('含 travelNotes 字样:', after.includes("const KEY = 'travelNotes'") || after.includes("travelNotes"));
