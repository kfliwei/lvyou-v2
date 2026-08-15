/* ③ 备份引导（修正：匹配文本转义） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "    if (mb > 3) flash('存储快满（' + mb.toFixed(1) + 'MB）：可关闭保留录音或导出备份');";
const to = "    if (mb > 3) flash('存储快满（' + mb.toFixed(1) + 'MB）：可关闭保留录音或导出备份');\n    /* 首次保存后建议备份（2026-08-15） */\n    try {\n      if (localStorage.getItem('tn_backupHinted') !== '1') {\n        localStorage.setItem('tn_backupHinted', '1');\n        setTimeout(function () {\n          if (window.UI && UI.confirm) {\n            UI.confirm({ title: '建议备份', text: '游记保存在本机。为避免换机/卸载丢失，建议定期导出备份：设置 → 数据与备份 → 导出。', okText: '去备份', cancelText: '知道了' }, function (ok) { if (ok) location.href = 'settings.html'; });\n          }\n        }, 900);\n      }\n    } catch (e) {}";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('③ backup hint added');
} else console.log('SKIP ③');
