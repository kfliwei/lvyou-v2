/* ⑤⑥ 视图 tab 加日历 + 多图查看器（travel-notes.js） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!t.includes(from)) { console.log('SKIP', tag); return; }
  t = t.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. 视图 tab 加"日历" */
rep(
  `'<button class="tn-viewtab on" id="tnViewTrip">旅程</button><button class="tn-viewtab" id="tnViewTime">时间线</button>'`,
  `'<button class="tn-viewtab on" id="tnViewTrip">旅程</button><button class="tn-viewtab" id="tnViewTime">时间线</button><button class="tn-viewtab" id="tnViewCal">日历</button>'`,
  '6a cal tab'
);
rep(
  `    $X(list, '#tnViewTime').onclick = function () { viewMode = 'timeline'; setViewTabs(); renderList(); };`,
  `    $X(list, '#tnViewTime').onclick = function () { viewMode = 'timeline'; setViewTabs(); renderList(); };
    $X(list, '#tnViewCal').onclick = function () { viewMode = 'calendar'; setViewTabs(); renderList(); };`,
  '6b cal bind'
);
rep(
  `    t1.classList.toggle('on', viewMode === 'trip');
    t2.classList.toggle('on', viewMode === 'timeline');`,
  `    t1.classList.toggle('on', viewMode === 'trip');
    t2.classList.toggle('on', viewMode === 'timeline');
    var t3 = $X(ui.list, '#tnViewCal');
    if (t3) t3.classList.toggle('on', viewMode === 'calendar');`,
  '6c cal toggle'
);

/* 2. renderList 日历分支 */
rep(
  `    if (viewMode === 'trip') renderTripView(body, list);
    else renderTimeView(body, list);`,
  `    if (viewMode === 'trip') renderTripView(body, list);
    else if (viewMode === 'calendar') renderCalView(body, list);
    else renderTimeView(body, list);`,
  '6d cal branch'
);

/* 3. renderCalView 实现（插在 renderItem 前） */
rep(
  `  /* 单篇卡片（两个视图共用） */
  function renderItem(body, n) {`,
  `  /* 日历视图（2026-08-15）：按月浏览，有游记日期高亮，点击看当天 */
  var calState = { ym: null };
  function pad2(x) { return x < 10 ? '0' + x : '' + x; }
  function renderCalView(body, list) {
    var now = new Date();
    if (!calState.ym) calState.ym = now.getFullYear() * 100 + (now.getMonth() + 1);
    var y = Math.floor(calState.ym / 100), mo = calState.ym % 100;
    /* 当天有游记的集合 */
    var days = {};
    list.forEach(function (x) {
      var m = String(x.date || '').match(/(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
      if (m) days[m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3])] = (days[m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3])] || 0) + 1;
    });
    var first = new Date(y, mo - 1, 1);
    var startDow = first.getDay(); /* 0=日 */
    var dim = new Date(y, mo, 0).getDate();
    var html = '<div class="tn-cal-head"><button class="tn-cal-nav" id="calPrev">‹</button><b>' + y + ' 年 ' + mo + ' 月</b><button class="tn-cal-nav" id="calNext">›</button><button class="tn-cal-today" id="calToday">本月</button></div>';
    html += '<div class="tn-cal-grid">' + ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<span class="tn-cal-w">' + w + '</span>'; }).join('');
    for (var i = 0; i < startDow; i++) html += '<span class="tn-cal-d empty"></span>';
    for (var d = 1; d <= dim; d++) {
      var key = y + '-' + pad2(mo) + '-' + pad2(d);
      var cnt = days[key] || 0;
      var isToday = (y === now.getFullYear() && mo === now.getMonth() + 1 && d === now.getDate());
      html += '<span class="tn-cal-d' + (cnt ? ' has' : '') + (isToday ? ' today' : '') + '" data-day="' + key + '">' + d + (cnt ? '<i>' + cnt + '</i>' : '') + '</span>';
    }
    html += '</div><div class="tn-cal-day" id="calDay"></div>';
    body.innerHTML = html;
    $X(body, '#calPrev').onclick = function () { calState.ym = (mo === 1 ? (y - 1) * 100 + 12 : calState.ym - 1); renderCalView(body, list); };
    $X(body, '#calNext').onclick = function () { calState.ym = (mo === 12 ? (y + 1) * 100 + 1 : calState.ym + 1); renderCalView(body, list); };
    $X(body, '#calToday').onclick = function () { calState.ym = now.getFullYear() * 100 + (now.getMonth() + 1); renderCalView(body, list); };
    body.querySelectorAll('.tn-cal-d[data-day]').forEach(function (el) {
      el.onclick = function () {
        var k = el.dataset.day;
        var dayList = list.filter(function (x) { return String(x.date || '').indexOf(k) >= 0; });
        var box = $X(body, '#calDay');
        if (!dayList.length) { box.innerHTML = '<div class="tn-empty" style="padding:16px"><span>当天没有游记</span></div>'; return; }
        box.innerHTML = '<div class="tn-cal-day-t">' + k + ' · ' + dayList.length + ' 篇</div>';
        dayList.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (x) {
          var item = document.createElement('div');
          item.className = 'tn-item tn-cal-item';
          item.innerHTML = '<h4>' + esc(x.title || x.siteName) + '</h4><div class="tm">' + esc(x.date || '') + '</div><div class="tx">' + esc((x.text || x.raw || '').slice(0, 120)) + '</div><div class="tg"><button data-a="edit">编辑</button><button data-a="del" class="danger">删除</button></div>';
          item.querySelector('[data-a=edit]').onclick = function () { openEdit(x.id); };
          item.querySelector('[data-a=del]').onclick = function () {
            confirmDialog('删除这篇游记？此操作不可恢复。', function () {
              notes = notes.filter(function (y) { return y.id !== x.id; });
              persist(); renderTNLayer(); renderList(); renderTagBar(); renderStats();
              if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
            });
          };
          box.appendChild(item);
        });
      };
    });
  }

  /* 单篇卡片（两个视图共用） */
  function renderItem(body, n) {`,
  '6e cal view'
);

/* 4. ⑤ 多图查看器：zoomPhoto 升级（保留单图兼容） */
rep(
  `  function genCard(n) {`,
  `  /* 多图查看器（2026-08-15）：全屏 + 左右滑动/箭头 */
  var viewer = null;
  function openViewer(photos, idx) {
    if (!photos || !photos.length) return;
    if (viewer) viewer.remove();
    viewer = document.createElement('div');
    viewer.className = 'tn-viewer';
    viewer.innerHTML = '<button class="tn-viewer-x" id="tvX">✕</button>' +
      '<img id="tvImg" src="' + esc(photos[idx]) + '" alt="">' +
      (photos.length > 1 ? '<button class="tn-viewer-nav l" id="tvL">‹</button><button class="tn-viewer-nav r" id="tvR">›</button>' : '') +
      '<div class="tn-viewer-i" id="tvI">' + (idx + 1) + ' / ' + photos.length + '</div>';
    document.body.appendChild(viewer);
    var cur = idx;
    function show(i) {
      cur = (i + photos.length) % photos.length;
      viewer.querySelector('#tvImg').src = photos[cur];
      var ii = viewer.querySelector('#tvI'); if (ii) ii.textContent = (cur + 1) + ' / ' + photos.length;
    }
    var x = viewer.querySelector('#tvX');
    x.onclick = function () { viewer.remove(); viewer = null; };
    viewer.onclick = function (e) { if (e.target === viewer) { viewer.remove(); viewer = null; } };
    var l = viewer.querySelector('#tvL'), r = viewer.querySelector('#tvR');
    if (l) l.onclick = function () { show(cur - 1); };
    if (r) r.onclick = function () { show(cur + 1); };
    /* 触控滑动 */
    var sx = 0;
    viewer.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    /* 键盘 */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { viewer.remove(); viewer = null; }
    });
  }
  /* 多图入口：按游记 id + 图索引 */
  window.TravelNotes.zoomPhotoIdx = function (id, idx) {
    var x = notes.find(function (z) { return z.id === id; });
    var ph = (x && x.photos) || [];
    if (!ph.length) return;
    openViewer(ph, Math.max(0, Math.min(idx || 0, ph.length - 1)));
  };
  function zoomPhoto(src) {
    var x = notes.find(function (z) { return (z.photos || []).indexOf(src) >= 0; });
    var ph = (x && x.photos && x.photos.length) ? x.photos : [src];
    openViewer(ph, ph.indexOf(src) >= 0 ? ph.indexOf(src) : 0);
  }

  function genCard(n) {`,
  '5 viewer'
);

/* 5. renderItem 图片点击改为多图入口 */
rep(
  `    var pics = (n.photos && n.photos.length) ? '<div class="pics">' + n.photos.map(function (p) { return '<img src="' + esc(p) + '" onclick="TravelNotes.zoomPhoto(this.src)">'; }).join('') + '</div>' : '';`,
  `    var pics = (n.photos && n.photos.length) ? '<div class="pics">' + n.photos.map(function (p, pi) { return '<img src="' + esc(p) + '" onclick="TravelNotes.zoomPhotoIdx(\'' + n.id + '\',' + pi + ')" alt="">'; }).join('') + '</div>' : '';`,
  '5 pics idx'
);

fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('⑤⑥ patches:', n);
