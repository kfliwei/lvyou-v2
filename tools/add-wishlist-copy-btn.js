/* ④ 顶栏加复制清单按钮 */
const fs = require('fs');
let w = fs.readFileSync('wishlist.html', 'utf8');
const crlf = w.includes('\r\n');
if (crlf) w = w.replace(/\r\n/g, '\n');
const from = '<button class="wl-btn" style="min-height:34px;margin-left:6px" id="wlPlanBtn">规划行程</button>';
const to = '<button class="wl-btn" style="min-height:34px;margin-left:6px" id="wlPlanBtn">规划行程</button>\n    <button class="wl-btn" style="min-height:34px;margin-left:6px" onclick="window.copyWishlist()">复制清单</button>';
if (w.includes(from)) {
  w = w.split(from).join(to);
  fs.writeFileSync('wishlist.html', crlf ? w.replace(/\n/g, '\r\n') : w, 'utf8');
  console.log('复制清单按钮 added');
} else console.log('miss');
