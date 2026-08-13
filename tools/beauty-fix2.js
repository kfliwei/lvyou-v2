/* 修正：index 启动遮罩（CRLF 归一化）+ sysRecord 按钮图标 */
const fs = require('fs');

let s = fs.readFileSync('index.html', 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function repIdx(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP index:' + tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK   index:' + tag);
}
repIdx(
  '<body>\n<div class="app-page">',
  '<body>\n<div id="bootSplash" aria-hidden="true"><div class="bs-seal">迹</div><div class="bs-name">行迹 TRACE</div><div class="bs-sub">My Journey Map</div></div>\n<div class="app-page">',
  'boot splash html'
);
repIdx(
  '})();\n</script>\n</body>\n</html>',
  '})();\n</script>\n<script>\n/* 启动遮罩淡出 */\n(function(){var bs=document.getElementById(\'bootSplash\');if(!bs)return;var t=setTimeout(function(){bs.classList.add(\'hide\');setTimeout(function(){bs.remove();},600);clearTimeout(t);},900);})();\n</script>\n</body>\n</html>',
  'boot splash hide script'
);
fs.writeFileSync('index.html', s, 'utf8');
console.log('index patches:', n);

/* sysRecord 按钮图标 */
let m = fs.readFileSync('node-manager.html', 'utf8');
const from = "'<button class=\"is-btn\" onclick=\"window.NM.sysRecord(' + s.__i + ')\">🎙 语音记录</button>' +";
const to = "'<button class=\"is-btn\" style=\"display:inline-flex;align-items:center;gap:5px;justify-content:center\" onclick=\"window.NM.sysRecord(' + s.__i + ')\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" style=\"vertical-align:-2px\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11 a7 7 0 0 0 14 0 M12 18 v3\"/></svg>语音记录</button>' +";
if (m.includes(from)) {
  m = m.split(from).join(to);
  fs.writeFileSync('node-manager.html', m, 'utf8');
  console.log('OK   nm:sysRecord icon');
} else {
  console.log('SKIP nm:sysRecord icon');
}
