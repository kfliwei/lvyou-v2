/* tools/patch-nm-spec.js — 规范 §3/§15-16/§19/§26-31 节点管理功能补齐（保留现有功能）
 * 1. FAB ＋（地图选点/当前位置/搜索地点/我的节点）
 * 2. 长按地图快速添加（500ms）
 * 3. 表单：地址字段 + 添加照片(压缩base64) + 重新选点(移动位置)
 * 4. 用户节点详情：想去/语音记录/我的记录N篇/封面图/海拔地址
 * 5. 系统节点详情：想去/语音记录
 * 6. 我的节点列表：封面缩略图 + 想去徽标
 * 7. 数据模型：address / coverImage / updatedAt
 */
const fs = require('fs');
const p = 'node-manager.html';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. 表单：地址 + 照片 + 重新选点 */
rep(
  `      '<div class="ui-modal-text nm-body">' +
      (preset && preset.lat != null ? '<div class="nm-coord">📍 ' + (+preset.lat).toFixed(5) + ', ' + (+preset.lng).toFixed(5) + (preset.gcj ? ' · 高德坐标' : '') + '</div>' : '') +
      '<input id="nmName" class="nm-in" placeholder="名称（必填）" value="' + esc((preset && preset.name) || '') + '">' +
      '<input id="nmCity" class="nm-in" placeholder="城市（如 长沙）" value="' + esc((preset && preset.city) || '') + '">' +`,
  `      '<div class="ui-modal-text nm-body">' +
      '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">' +
      '<div style="flex:0 0 64px;height:64px;border-radius:12px;overflow:hidden;background:var(--color-bg-soft);display:grid;place-items:center;color:var(--color-faint);font-size:10px;text-align:center;position:relative" id="nmPhotoBox">' +
      (preset && preset.coverImage ? '<img id="nmPhotoImg" src="' + preset.coverImage + '" style="width:100%;height:100%;object-fit:cover">' : '<span id="nmPhotoTxt">封面<br>照片</span>') +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
      (preset && preset.lat != null ? '<div class="nm-coord" style="margin-bottom:6px">📍 ' + (+preset.lat).toFixed(5) + ', ' + (+preset.lng).toFixed(5) + (preset.gcj ? ' · 高德坐标' : '') + (preset.uid ? ' <button id="nmRepick" type="button" style="border:0;background:none;color:var(--color-primary-dark);font-size:11.5px;cursor:pointer;padding:0">移动位置 ›</button>' : '') + '</div>' : '') +
      '<input id="nmName" class="nm-in" placeholder="名称（必填）" value="' + esc((preset && preset.name) || '') + '">' +
      '<input id="nmCity" class="nm-in" placeholder="城市（如 长沙）" value="' + esc((preset && preset.city) || '') + '">' +
      '</div></div>' +
      '<input id="nmAddr" class="nm-in" placeholder="地址（自动获取，可改）" value="' + esc((preset && preset.address) || '') + '">' +
      '<input type="file" id="nmFile" accept="image/*" style="display:none">' +`,
  '1.form address/photo/repick'
);

/* 2. 表单打开：照片选择绑定 + 重新选点绑定 */
rep(
  `    document.getElementById('nmName').focus();
    if (preset && preset.lat != null) { autoFill(preset.lat, preset.lng); }`,
  `    document.getElementById('nmName').focus();
    /* 添加照片：压缩到 240px base64 */
    var fileEl = m.querySelector('#nmFile');
    m.querySelector('#nmPhotoBox').onclick = function () { fileEl.click(); };
    fileEl.onchange = function () {
      var f = fileEl.files && fileEl.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas'), w = 240, h = Math.round(img.height * w / img.width);
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          var b64 = c.toDataURL('image/jpeg', 0.7);
          var box = m.querySelector('#nmPhotoBox');
          box.innerHTML = '<img id="nmPhotoImg" src="' + b64 + '" style="width:100%;height:100%;object-fit:cover">';
          box.dataset.cover = b64;
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    var rp = m.querySelector('#nmRepick');
    if (rp) {
      rp.onclick = function () {
        m.remove();
        UI.toast('在地图上点击新位置');
        map.once('click', function (e) {
          openForm({
            uid: preset.uid, name: preset.name, lat: e.latlng.lat, lng: e.latlng.lng,
            gcj: false, city: preset.city, category: preset.category, tags: preset.tags,
            desc: preset.desc, elev: preset.elev, coverImage: preset.coverImage,
            address: preset.address, province: preset.province, createdAt: preset.createdAt
          });
        });
      };
    }
    if (preset && preset.lat != null) { autoFill(preset.lat, preset.lng); }`,
  '2.photo + repick binding'
);

/* 3. 保存：address/coverImage/updatedAt */
rep(
  `        var rec = {
          id: (preset && preset.uid) || Date.now().toString(36),
          name: name,
          lat: preset.lat, lng: preset.lng,
          gcj: !!(preset && preset.gcj),
          province: (preset && preset.province) || window.__nmProvince || '',
          city: document.getElementById('nmCity').value.trim(),
          category: document.getElementById('nmCat').value.trim() || '其他',
          tags: document.getElementById('nmTags').value.trim().split(/\\s+/).filter(Boolean),
          elev: document.getElementById('nmElev').value.trim(),
          desc: document.getElementById('nmDesc').value.trim(),
          createdAt: (preset && preset.createdAt) || Date.now()
        };`,
  `        var photoBox = m.querySelector('#nmPhotoBox');
        var rec = {
          id: (preset && preset.uid) || Date.now().toString(36),
          name: name,
          lat: preset.lat, lng: preset.lng,
          gcj: !!(preset && preset.gcj),
          province: (preset && preset.province) || window.__nmProvince || '',
          city: document.getElementById('nmCity').value.trim(),
          category: document.getElementById('nmCat').value.trim() || '其他',
          tags: document.getElementById('nmTags').value.trim().split(/\\s+/).filter(Boolean),
          elev: document.getElementById('nmElev').value.trim(),
          address: document.getElementById('nmAddr').value.trim(),
          coverImage: (photoBox && photoBox.dataset.cover) || (preset && preset.coverImage) || '',
          desc: document.getElementById('nmDesc').value.trim(),
          createdAt: (preset && preset.createdAt) || Date.now(),
          updatedAt: Date.now()
        };`,
  '3.save address/cover/updatedAt'
);

/* 4. 用户节点详情：封面/海拔地址/想去/语音记录/我的记录 */
rep(
  `  function openUserInfo(u) {
    var box = $('isBody');
    box.innerHTML =
      '<div class="is-place">' + esc(u.name) + ' <span style="font-size:11px;color:#5F7A4E;vertical-align:2px">我的节点</span></div>' +
      '<div class="is-loc">' + esc([u.category, u.city].filter(Boolean).join(' · ') + (u.elev ? ' · 海拔 ' + u.elev + 'm' : '')) + '</div>' +
      (u.desc ? '<div class="is-desc">' + esc(u.desc) + '</div>' : '') +
      (u.tags && u.tags.length ? '<div class="is-tags">' + u.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="is-coord">' + (+u.lat).toFixed(5) + ', ' + (+u.lng).toFixed(5) + '</div>' +
      '<div class="is-acts">' +
      '<button class="is-btn" onclick="window.NM.edit(\\'' + u.id + '\\')">编辑</button>' +
      '<button class="is-btn danger" onclick="window.NM.remove(\\'' + u.id + '\\')">删除</button>' +
      '<button class="is-btn primary" onclick="window.NM.closeInfo()">关闭</button></div>';
    $('infoSheet').classList.add('show');
    $('rsSheet').classList.remove('show');
  }`,
  `  function openUserInfo(u) {
    var box = $('isBody');
    var wished = window.Wish && Wish.isWished(u);
    var notesN = 0;
    try {
      var _all = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list() : [];
      notesN = _all.filter(function (n) { return n.lat != null && Math.abs(n.lat - u.lat) < 0.02 && Math.abs(n.lng - u.lng) < 0.02; }).length;
    } catch (e) {}
    var loc = [u.category, u.city].filter(Boolean).join(' · ') + (u.elev ? ' · 海拔 ' + u.elev + 'm' : '') + (u.address ? ' · ' + u.address : '');
    box.innerHTML =
      (u.coverImage ? '<div style="width:100%;height:150px;border-radius:14px;overflow:hidden;margin-bottom:10px"><img src="' + u.coverImage + '" alt="' + esc(u.name) + '" style="width:100%;height:100%;object-fit:cover"></div>' : '') +
      '<div class="is-place">' + esc(u.name) + ' <span style="font-size:11px;color:#5F7A4E;vertical-align:2px">我的节点</span></div>' +
      '<div class="is-loc">' + esc(loc) + '</div>' +
      (u.desc ? '<div class="is-desc">' + esc(u.desc) + '</div>' : '') +
      (u.tags && u.tags.length ? '<div class="is-tags">' + u.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="is-coord">' + (+u.lat).toFixed(5) + ', ' + (+u.lng).toFixed(5) + '</div>' +
      '<div class="is-acts" style="flex-wrap:wrap">' +
      '<button class="is-btn" onclick="window.NM.edit(\\'' + u.id + '\\')">编辑</button>' +
      '<button class="is-btn" onclick="window.NM.toggleWish(\\'' + u.id + '\\')">' + (wished ? '✓ 已想去' : '+ 想去') + '</button>' +
      '<button class="is-btn" onclick="window.NM.record(\\'' + u.id + '\\')">🎙 语音记录</button>' +
      (notesN ? '<button class="is-btn" onclick="location.href=\\'travel-map.html\\'">📖 记录 ' + notesN + ' 篇</button>' : '') +
      '<button class="is-btn danger" onclick="window.NM.remove(\\'' + u.id + '\\')">删除</button>' +
      '<button class="is-btn primary" onclick="window.NM.closeInfo()">关闭</button></div>';
    $('infoSheet').classList.add('show');
    $('rsSheet').classList.remove('show');
  }
  function toggleWish(uid) {
    var u = loadUserNodes().find(function (x) { return x.id === uid; });
    if (!u) return;
    if (!window.Wish) { UI.toast('想去功能不可用'); return; }
    var on = Wish.toggle(u);
    UI.toast(on ? '已加入想去清单' : '已从想去清单移除');
    openUserInfo(loadUserNodes().find(function (x) { return x.id === uid; }));
  }
  function record(uid) {
    var u = loadUserNodes().find(function (x) { return x.id === uid; });
    if (!u) return;
    if (window.TravelNotes && TravelNotes.openPanel) {
      try { TravelNotes.openPanel({ label: u.name, lat: +u.lat, lng: +u.lng }); } catch (e) { UI.toast('记录面板打开失败'); }
    } else UI.toast('当前环境不支持语音记录');
  }`,
  '4.user info actions'
);

/* 5. 系统节点详情：想去 + 语音记录 */
rep(
  `      '<div class="is-acts"><button class="is-btn" onclick="window.NM.flyToSys(' + s.__i + ')">在地图查看</button><button class="is-btn primary" onclick="window.NM.closeInfo()">关闭</button></div>';`,
  `      '<div class="is-acts" style="flex-wrap:wrap">' +
      '<button class="is-btn" onclick="window.NM.sysWish(' + s.__i + ')">' + (window.Wish && Wish.isWished(s) ? '✓ 已想去' : '+ 想去') + '</button>' +
      '<button class="is-btn" onclick="window.NM.sysRecord(' + s.__i + ')">🎙 语音记录</button>' +
      '<button class="is-btn" onclick="window.NM.flyToSys(' + s.__i + ')">在地图查看</button>' +
      '<button class="is-btn primary" onclick="window.NM.closeInfo()">关闭</button></div>';`,
  '5.sys info actions'
);

/* 6. sysWish / sysRecord */
rep(
  `  function flyToSys(i) {
    var s = SITES[i]; if (!s) return;`,
  `  function sysWish(i) {
    var s = SITES[i]; if (!s) return;
    if (!window.Wish) { UI.toast('想去功能不可用'); return; }
    var on = Wish.toggle(s);
    UI.toast(on ? '已加入想去清单' : '已从想去清单移除');
    openSysInfo(s);
  }
  function sysRecord(i) {
    var s = SITES[i]; if (!s) return;
    if (window.TravelNotes && TravelNotes.openPanel) {
      try { TravelNotes.openPanel({ label: s.label || s.name, lat: +s.lat, lng: +s.lng }); } catch (e) { UI.toast('记录面板打开失败'); }
    } else UI.toast('当前环境不支持语音记录');
  }
  function flyToSys(i) {
    var s = SITES[i]; if (!s) return;`,
  '6.sys wish/record'
);

/* 7. 我的节点列表：封面缩略图 + 想去徽标 */
rep(
  `      return '<div class="nm-item">' +
        '<div class="nm-item-main"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.category].filter(Boolean).join(' · ') + (u.elev ? ' · ' + u.elev + 'm' : '')) + '</small></div>' +`,
  `      var _w = window.Wish && Wish.isWished(u);
      return '<div class="nm-item">' +
        (u.coverImage ? '<div style="flex:0 0 44px;height:44px;border-radius:10px;overflow:hidden"><img src="' + u.coverImage + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>' : '') +
        '<div class="nm-item-main"><b>' + esc(u.name) + (_w ? ' <span style="font-size:10px;color:var(--color-primary-dark)">想去</span>' : '') + '</b><small>' + esc([u.city, u.category].filter(Boolean).join(' · ') + (u.elev ? ' · ' + u.elev + 'm' : '')) + '</small></div>' +`,
  '7.mine list thumb+wish'
);

/* 8. FAB ＋（地图选点/当前位置/搜索地点/我的节点）+ 长按地图快速添加 */
rep(
  `  /* ---------- 启动 ---------- */
  window.NM = { edit: edit, remove: remove, closeInfo: closeInfo, flyToSys: flyToSys, locate: locate };`,
  `  /* ---------- 右下 ＋ 入口（规范 §19/§26-27） ---------- */
  function initFab() {
    var fab = document.createElement('button');
    fab.className = 'nm-fab';
    fab.textContent = '＋';
    fab.setAttribute('aria-label', '添加节点');
    fab.onclick = function () {
      var m = document.createElement('div');
      m.className = 'ui-modal-mask nm-mask';
      m.innerHTML =
        '<div class="ui-modal nm-menu" role="dialog" aria-modal="true">' +
        '<div class="ui-modal-title">添加 / 管理节点</div>' +
        '<div class="ui-modal-text nm-menu-items">' +
        '<button class="nm-menu-item" data-a="pick">📍 地图选点</button>' +
        '<button class="nm-menu-item" data-a="cur">⌖ 使用当前位置</button>' +
        '<button class="nm-menu-item" data-a="search">🔍 搜索地点</button>' +
        '<button class="nm-menu-item" data-a="mine">📋 我的节点</button>' +
        '</div>' +
        '<div class="ui-modal-acts"><button class="ui-btn ui-btn-ghost" id="nmMenuClose">取消</button></div></div>';
      document.body.appendChild(m);
      requestAnimationFrame(function () { m.classList.add('show'); });
      m.querySelector('#nmMenuClose').onclick = function () { m.remove(); };
      m.onclick = function (e) { if (e.target === m) m.remove(); };
      m.querySelectorAll('.nm-menu-item').forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.a;
          m.remove();
          if (a === 'pick') startPick();
          else if (a === 'cur') addAtCurrent();
          else if (a === 'search') { $('q').focus(); }
          else if (a === 'mine') openMine();
        };
      });
    };
    document.body.appendChild(fab);
  }
  /* 地图选点（FAB 用）：点击地图 → 表单 */
  function startPick() {
    closeSheets();
    UI.toast('在地图上点击选择位置');
    map.once('click', function (e) {
      var lat = e.latlng.lat, lng = e.latlng.lng;
      putMarker(lat, lng);
      openForm({ lat: lat, lng: lng });
    });
  }
  /* 当前位置添加（FAB 用） */
  function addAtCurrent() {
    if (!navigator.geolocation) { UI.toast('当前环境不支持定位'); return; }
    UI.toast('定位中…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      openForm({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, function () { UI.toast('定位失败，请检查定位权限'); }, { enableHighAccuracy: true, timeout: 10000 });
  }
  /* 长按地图快速添加（规范 §29）：500ms 长按 → 表单 */
  function initLongPress() {
    var t0 = 0, timer = null, moved = false;
    map.on('touchstart', function (e) {
      moved = false;
      t0 = Date.now();
      timer = setTimeout(function () {
        if (moved) return;
        var ll = e.latlng;
        if (!ll) return;
        putMarker(ll.lat, ll.lng);
        UI.toast('快速添加：填写名称即可保存');
        openForm({ lat: ll.lat, lng: ll.lng });
      }, 500);
    });
    map.on('touchmove', function () { moved = true; });
    map.on('touchend touchcancel', function () { if (timer) { clearTimeout(timer); timer = null; } });
    map.on('contextmenu', function (e) { /* 桌面右键等效长按 */
      putMarker(e.latlng.lat, e.latlng.lng);
      openForm({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
  }

  /* ---------- 启动 ---------- */
  window.NM = { edit: edit, remove: remove, closeInfo: closeInfo, flyToSys: flyToSys, locate: locate, toggleWish: toggleWish, record: record, sysWish: sysWish, sysRecord: sysRecord };
  initFab();
  initLongPress();`,
  '8.fab + longpress'
);

fs.writeFileSync(p, s, 'utf8');
console.log('=== applied', n, 'patches ===');
