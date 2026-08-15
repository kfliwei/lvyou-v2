/* 意图卡模板加"省份主题"区（动态 HTML 内，替代静态容器方案） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = "    h += '<div class=\"fld\"><label>偏好</label><div class=\"chips\" id=\"intentPrefs\"></div></div>';";
const to = "    h += '<div class=\"fld\"><label>偏好</label><div class=\"chips\" id=\"intentPrefs\"></div></div>';\n    h += '<div class=\"fld\"><label>省份主题 <span style=\"font-size:11px;color:var(--color-faint)\">（点省 → 选该省标签）</span></label><div class=\"chips\" id=\"intentProvs\"></div><div id=\"intentProvThemes\" style=\"display:none;margin-top:6px\"></div></div>';";
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('intentCard 模板加省份主题区');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
