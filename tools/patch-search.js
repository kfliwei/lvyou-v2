/* tools/patch-search.js — search.html 切换到 nation-index 轻量索引 + 无障碍/键盘支持 */
const fs = require('fs');
const p = 'search.html';
let s = fs.readFileSync(p, 'utf8');
const CRLF = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

const subs = [
  // 1. 加载轻量索引并解析
  [
    "s.src='nation-data.js?v=20260813';\n    s.onload=function(){\n      SITES=window.NATION_SITES||window.SITES||[];",
    "s.src='nation-index.js?v=20260813';\n    s.onload=function(){\n      SITES=(window.NATION_SITES_RAW||'').split('\\n').map(function(line){\n        var p=line.split('|');\n        return {name:p[0],label:p[1],region:p[2],city:p[3],county:p[4],theme:p[5],flag:p[6],lat:+p[7],lng:+p[8]};\n      });"
  ],
  // 2. 景点卡片：去 desc 行，加 role/tabindex/aria-label
  [
    '<div class="item" data-go="\'+(key?\'topic.html?p=\'+key+\'&q=\'+encodeURIComponent(s.name):\'topic.html?p=nation&q=\'+encodeURIComponent(s.name))+\'"><span class="dot" style="background:#8C7B66"></span><div class="main"><div class="nm">\'+esc(s.label)+flagHtml(s)+\'</div><div class="sub">\'+esc(s.region+\' · \'+(s.city||\'\')+(s.county?\' · \'+s.county:\'\')+(s.theme?\' · \'+s.theme:\'\'))+\'</div><div class="ds">\'+esc((s.desc||\'\').slice(0,60))+\'</div></div>',
    '<div class="item" role="button" tabindex="0" aria-label="\'+esc(s.label)+\'" data-go="\'+(key?\'topic.html?p=\'+key+\'&q=\'+encodeURIComponent(s.name):\'topic.html?p=nation&q=\'+encodeURIComponent(s.name))+\'"><span class="dot" style="background:#8C7B66"></span><div class="main"><div class="nm">\'+esc(s.label)+flagHtml(s)+\'</div><div class="sub">\'+esc(s.region+\' · \'+(s.city||\'\')+(s.county?\' · \'+s.county:\'\')+(s.theme?\' · \'+s.theme:\'\'))+\'</div></div>'
  ],
  // 3. item 键盘 Enter/Space 支持
  [
    "it.onclick=function(){ location.href=it.dataset.go; };\n    });",
    "it.onclick=function(){ location.href=it.dataset.go; };\n      it.onkeydown=function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); location.href=it.dataset.go; } };\n    });"
  ]
];

let ok = 0;
for (const [from, to] of subs) {
  if (!s.includes(from)) { console.error('NOT FOUND:', from.slice(0, 90)); continue; }
  s = s.replace(from, to);
  ok++;
}
fs.writeFileSync(p, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('applied', ok, '/', subs.length);
