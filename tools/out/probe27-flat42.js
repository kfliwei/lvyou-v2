/* tools/out/probe27-flat42.js — 为什么 flat42 把 tn-confirm 那行吃掉了：把 travel-notes.js
   过一遍 §42 的 view 变换，逐字符定位被剥掉的注释区间边界。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const B = String.fromCharCode(92);
const raw = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8')
  .replace('  <div class="tn-quotes" id="tnQuotes">' + B,
    '  <div class="tn-confirm" id="tnConfirm" style="display:none"></div>' + B + '\n' +
    '  <div class="tn-quotes" id="tnQuotes">' + B);
console.log('raw 里 id="tnConfirm"', raw.split('id="tnConfirm"').length - 1);
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('剥注释后 id="tnConfirm"', stripped.split('id="tnConfirm"').length - 1);
const i = raw.indexOf('id="tnConfirm"');
console.log('它在 raw 里的行号', raw.slice(0, i).split('\n').length);
/* 找出包住它的那个注释区间 */
const re = /\/\*[\s\S]*?\*\//g;
let m;
while ((m = re.exec(raw))) {
  const s = raw.slice(0, m.index).split('\n').length, e = raw.slice(0, m.index + m[0].length).split('\n').length;
  if (m.index <= i && i < m.index + m[0].length) {
    console.log('包住它的注释区间：行 ' + s + ' → ' + e + '，开头 60 字符：' + JSON.stringify(m[0].slice(0, 60)));
  }
}
console.log('tnQuotes 在剥注释后还在：', stripped.indexOf('id="tnQuotes"') >= 0);
