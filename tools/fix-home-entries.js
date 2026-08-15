/* 首页入口替换：探索地图→行程规划(planner) / 开始探索→我的足迹(travel-map) */
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
/* 1. hero 探索地图 → 行程规划 */
rep(
  '<span onclick="location.href=\'explore-map.html\'" role="button" tabindex="0" style="cursor:pointer">探索地图 <span ',
  '<span onclick="location.href=\'planner.html\'" role="button" tabindex="0" style="cursor:pointer">行程规划 <span ',
  '1 hero 探索地图→行程规划'
);
/* 2. 最近的旅行 开始探索 ×2 → 我的足迹 */
rep(
  '<span class="text-link" style="font-size:14px" onclick="location.href=\'explore-map.html\'">开始探索 <span class="ar',
  '<span class="text-link" style="font-size:14px" onclick="location.href=\'travel-map.html\'">我的足迹 <span class="ar',
  '2a 开始探索→我的足迹'
);
rep(
  '<span class="text-link" style="font-size:14px;margin-top:12px" onclick="location.href=\'explore-map.html\'">开始探索',
  '<span class="text-link" style="font-size:14px;margin-top:12px" onclick="location.href=\'travel-map.html\'">我的足迹',
  '2b 开始探索→我的足迹(空态)'
);
fs.writeFileSync('index.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
