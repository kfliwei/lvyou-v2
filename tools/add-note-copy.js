/* ⑤ 补：游记"复制"快速分享（剪贴板，execCommand 兜底） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;

/* 1. 复制工具函数（插在 genCard 前） */
const from1 = '  function genCard(n) {';
const to1 = `  function copyNoteText(n) {
    var txt = (n.title || n.siteName || '游记') + '\\n' + (n.date || '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '\\n' + (n.text || n.raw || '');
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        flash('已复制到剪贴板');
      } catch (e) { flash('复制失败'); }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(function () { flash('已复制到剪贴板'); }, legacy);
    } else legacy();
  }
  function genCard(n) {`;
if (t.includes(from1)) { t = t.split(from1).join(to1); n++; console.log('OK  copyNoteText'); } else console.log('SKIP copy fn');

/* 2. 按钮组加"复制" */
const from2 = "'<button data-a=\"edit\">编辑</button><button data-a=\"card\">卡片</button><button data-a=\"md\">MD</button>";
const to2 = "'<button data-a=\"edit\">编辑</button><button data-a=\"copy\">复制</button><button data-a=\"card\">卡片</button><button data-a=\"md\">MD</button>";
if (t.includes(from2)) { t = t.split(from2).join(to2); n++; console.log('OK  copy btn'); } else console.log('SKIP copy btn');

/* 3. 绑定 */
const from3 = "    it.querySelector('[data-a=card]').onclick = function () { genCard(n); };";
const to3 = "    it.querySelector('[data-a=card]').onclick = function () { genCard(n); };\n    it.querySelector('[data-a=copy]').onclick = function () { copyNoteText(n); };";
if (t.includes(from3)) { t = t.split(from3).join(to3); n++; console.log('OK  copy bind'); } else console.log('SKIP copy bind');

fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('⑤ patches:', n);
