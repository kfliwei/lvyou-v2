/* ①④ 行程计划复制 + 想去清单导出文本（wishlist.html） */
const fs = require('fs');
let w = fs.readFileSync('wishlist.html', 'utf8');
const crlf = w.includes('\r\n');
if (crlf) w = w.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!w.includes(from)) { console.log('SKIP', tag); return; }
  w = w.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. 复制工具 + copyPlan/copyWishlist（插在 planTrip 前） */
rep(
  '  function planTrip() {',
  `  /* 复制文本（剪贴板 + execCommand 兜底） */
  function copyText(txt) {
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        ta.remove(); UI.toast('已复制');
      } catch (e) { UI.toast('复制失败'); }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(function () { UI.toast('已复制'); }, legacy);
    } else legacy();
  }
  /* ① 行程计划文本分享 */
  window.copyPlan = function () {
    var days = window.__planDays; if (!days || !days.length) { UI.toast('请先规划行程'); return; }
    var txt = '🚗 行程计划（行迹 TRACE）\\n';
    days.forEach(function (d, di) {
      txt += 'Day' + (di + 1) + '：' + d.map(function (s) { return s.label; }).join(' → ') + '\\n';
    });
    copyText(txt);
  };
  /* ④ 想去清单文本分享 */
  window.copyWishlist = function () {
    var list = window.Wish ? Wish.list() : [];
    if (!list.length) { UI.toast('清单是空的'); return; }
    var txt = '⭐ 想去清单（行迹 TRACE）\\n';
    list.forEach(function (w, i) { txt += (i + 1) + '. ' + w.label + (w.city ? '（' + w.city + '）' : '') + '\\n'; });
    copyText(txt);
  };

  function planTrip() {`,
  '1 copy utils'
);

/* 2. 规划面板按钮加"复制计划" */
rep(
  `    html += '<div style="display:flex;gap:10px;margin-top:14px"><button class="wl-btn" style="flex:1;justify-content:center" onclick="window.__exportPlan()">导出 GPX</button><button class="wl-btn" style="flex:1;justify-content:center" id="wlPlanClose">收起计划</button></div></div>';`,
  `    html += '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="wl-btn" style="flex:1;justify-content:center;min-width:100px" onclick="window.copyPlan()">📋 复制计划</button><button class="wl-btn" style="flex:1;justify-content:center;min-width:100px" onclick="window.__exportPlan()">导出 GPX</button><button class="wl-btn" style="flex:1;justify-content:center;min-width:100px" id="wlPlanClose">收起计划</button></div></div>';`,
  '2 plan copy btn'
);

fs.writeFileSync('wishlist.html', crlf ? w.replace(/\n/g, '\r\n') : w, 'utf8');
console.log('①④ patches:', n);
