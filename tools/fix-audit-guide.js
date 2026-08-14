/* 双引导合并：删除 tnGuide 2 步引导脚本块（保留 tn_onboarded 3 步） */
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

/* 起：<script>\n(function(){\n  var seen=false;...tn_guide... 止：该 IIFE 的 });\n</script> */
const startMark = '<script>\n(function(){\n  var seen=false; try{seen=localStorage.getItem(\'tn_guide\')';
const endMark = '</script>';
const si = s.indexOf(startMark);
if (si < 0) { console.log('guide block start not found'); process.exit(1); }
const ei = s.indexOf(endMark, si);
if (ei < 0) { console.log('guide block end not found'); process.exit(1); }
const block = s.slice(si, ei + endMark.length);
/* 安全校验：块内含 tn_guide 且是引导 IIFE */
if (!block.includes('tn_guide') || !block.includes('gNext')) { console.log('block mismatch, abort'); process.exit(1); }
s = s.slice(0, si) + s.slice(ei + endMark.length);
/* 删除 tnGuide 浮层 div（display:none 默认，删干净） */
const dStart = '<!-- 首启引导 -->\n<div id="tnGuide"';
const dEnd = '</div>\n</div>\n</div>\n';
const ds = s.indexOf(dStart);
if (ds >= 0) {
  const de = s.indexOf(dEnd, ds);
  if (de >= 0) s = s.slice(0, ds) + s.slice(de + dEnd.length);
  else console.log('guide div end not found, div kept');
} else console.log('guide div not found, div kept');
fs.writeFileSync('index.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('tnGuide script + div removed');
