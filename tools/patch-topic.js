/* tools/patch-topic.js — 规范推进：筛选双态 + 配色收敛 + 区域统计 + 用户节点管理
 * 修改 topic-common.js（幂等，可重复执行）
 */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
function repRe(re, to, tag) {
  if (!re.test(s)) { console.log('SKIP', tag); return; }
  s = s.replace(re, to);
  n++;
  console.log('OK  ', tag);
}

/* 1. getFilterFn 抽取（筛选谓词复用）— 幂等：已存在则跳过 */
if (s.includes('function getFilterFn()')) {
  console.log('SKIP', '1.getFilterFn');
} else {
  repRe(
    /  function getFiltered\(\) \{[\s\S]*?    var rp = refPoint\(\);/,
    `  function getFilterFn() {
    return function (s) {
      var q = state.q.trim().toLowerCase();
      if (state.region && s.region !== state.region) return false;
      if (state.theme && tk(s) !== state.theme) return false;
      if (state.elev && M.elevFilter) { var _e = +s.elev || 0; if (state.elev === 'low' && !(_e < 3000)) return false; if (state.elev === 'mid' && !(_e >= 3000 && _e < 4000)) return false; if (state.elev === 'high' && !(_e >= 4000)) return false; }
      if (state.city && s.city !== state.city) return false;
      if (state.flag && (!s.flag || s.flag.indexOf(state.flag) < 0)) return false;
      if (q) { var hay = (s.name + s.label + s.region + s.city + s.county + tk(s) + s.desc + (s.best || "")).toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    };
  }
  function getFiltered() {
    var arr = SITES.filter(getFilterFn());
    var rp = refPoint();`,
    '1.getFilterFn'
  );
}

/* 2. nodeIcon：配色收敛 + dim + 用户节点样式 */
rep(
  `  function nodeIcon(s, active) {
    var theme = colorOf(s);
    var inT = inTrip(s.__i);
    var num = inT ? (trip.indexOf(s.__i) + 1) : null;
    var f = s.flag || '';
    var cls = 'tr-node' + (active ? ' tr-active' : '') + (isMajorSite(s) ? ' tr-major' : '') +
      (f.indexOf('m') >= 0 ? ' tr-must' : '') + (f.indexOf('h') >= 0 ? ' tr-hot' : '');
    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + theme + '"></span><span class="tr-dot"></span>';`,
  `  function nodeIcon(s, active, dim) {
    var f = s.flag || '';
    /* 配色收敛（规范 §47）：地图节点不再按主题 38 色着色，统一中性色 + 重点强调 */
    var tint = s.source === 'user' ? '#5F7A4E' : (f.indexOf('m') >= 0 ? '#C86D4B' : (f.indexOf('h') >= 0 ? '#E0915C' : '#8C7B66'));
    var inT = inTrip(s.__i);
    var num = inT ? (trip.indexOf(s.__i) + 1) : null;
    var cls = 'tr-node' + (active ? ' tr-active' : '') + (dim ? ' tr-dim' : '') + (isMajorSite(s) ? ' tr-major' : '') +
      (f.indexOf('m') >= 0 ? ' tr-must' : '') + (f.indexOf('h') >= 0 ? ' tr-hot' : '') +
      (s.source === 'user' ? ' tr-user' : '');
    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + tint + '"></span><span class="tr-dot"></span>';`,
  '2.nodeIcon'
);

/* 3. renderMarkers：筛选双态（渲染全量 + 降透明） */
rep(
  `      list: function () { return list; },
      pt: pt,
      icon: function (s) { return nodeIcon(s, s.__i === curSite); },`,
  `      /* 筛选双态（规范 §11）：主题/区域/城市等筛选时渲染全量，非匹配节点降透明而非删除 */
      var fn = getFilterFn();
      var hasFilter = !!(state.theme || state.region || state.city || state.flag || state.elev);
      list: function () { return hasFilter ? SITES : list; },
      pt: pt,
      icon: function (s) { return nodeIcon(s, s.__i === curSite, hasFilter && !fn(s)); },`,
  '3.renderMarkers'
);

/* 4. moveend/zoomend 挂钩区域统计 */
rep(
  `      map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });
      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });`,
  `      map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); scheduleRegionStats(); });
      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); scheduleRegionStats(); });`,
  '4.stats hooks'
);

/* 5. init：合并用户节点（attachIndex 前） */
rep(
  `    SITES = window.SITES || [];
    FOOD = window.FOOD || [];`,
  `    SITES = window.SITES || [];
    mergeUserNodes();
    FOOD = window.FOOD || [];`,
  '5.merge user nodes'
);

/* 6. init：注入节点管理 FAB */
rep(
  `    // 数据
    attachIndex();`,
  `    // 数据
    attachIndex();
    initNodeMgmt();`,
  '6.init fab'
);

/* 7. 大块插入：区域统计 + 用户节点管理（渲染调度前） */
rep(
  `  /* ---------- 渲染调度 ---------- */`,
  `  /* ================= 区域统计（规范 §32） ================= */
  var statEl = null, statTimer = null;
  function scheduleRegionStats() {
    if (statTimer) clearTimeout(statTimer);
    statTimer = setTimeout(updateRegionStats, 400);
  }
  function updateRegionStats() {
    if (!map || !SITES.length) return;
    var b = map.getBounds();
    var inView = SITES.filter(function (s) { return s.lat != null && s.lng != null && !isNaN(+s.lat) && b.contains([+s.lat, +s.lng]); });
    if (!statEl) {
      statEl = document.createElement('div');
      statEl.className = 'region-stats';
      document.body.appendChild(statEl);
    }
    if (!inView.length) { statEl.style.display = 'none'; return; }
    var cnt = {};
    inView.forEach(function (s) { var t = tk(s) || '其他'; cnt[t] = (cnt[t] || 0) + 1; });
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 4);
    var html = '<span class="rs-total">当前区域 <b>' + inView.length + '</b> 处</span>';
    top.forEach(function (t) {
      html += '<button class="rs-chip' + (state.theme === t ? ' on' : '') + '" data-th="' + esc(t) + '">' + esc(t) + ' ' + cnt[t] + '</button>';
    });
    statEl.innerHTML = html;
    statEl.style.display = 'flex';
    statEl.querySelectorAll('.rs-chip').forEach(function (ch) {
      ch.onclick = function () {
        var th = ch.dataset.th;
        state.theme = (state.theme === th ? '' : th);
        syncChips(); renderAll();
      };
    });
  }

  /* ================= 用户节点管理（规范 §3/§17-31 USER_CREATED） ================= */
  var USER_KEY = 'tn_userNodes';
  function loadUserNodes() { try { return JSON.parse(localStorage.getItem(USER_KEY) || '[]'); } catch (e) { return []; } }
  function saveUserNodes(arr) { try { localStorage.setItem(USER_KEY, JSON.stringify(arr)); } catch (e) {} }
  function mergeUserNodes() {
    loadUserNodes().forEach(function (u) {
      SITES.push({
        id: 'u' + u.id, name: u.name, label: u.name, region: u.province || '其他',
        city: u.city || '', county: '', theme: u.category || '其他', desc: u.desc || '',
        best: '', lat: +u.lat, lng: +u.lng, flag: '', source: 'user', uid: u.id, tags: u.tags || []
      });
    });
  }
  /* 重复检测（规范 §23：名称相似 + 距离 <100m） */
  function findDup(name, lat, lng) {
    var n2 = String(name || '').trim(); if (!n2) return [];
    return SITES.filter(function (s) {
      var sn = s.name || s.label || '';
      if (!sn) return false;
      var nameHit = sn.indexOf(n2) >= 0 || n2.indexOf(sn) >= 0;
      if (!nameHit) return false;
      if (lat != null && s.lat != null) return havKm(+lat, +lng, +s.lat, +s.lng) < 0.1;
      return true;
    }).slice(0, 3);
  }
  var nodePickMarker = null;
  function openNodeForm(preset) {
    var m = document.createElement('div');
    m.className = 'ui-modal-mask nm-mask';
    m.innerHTML =
      '<div class="ui-modal nm-form" role="dialog" aria-modal="true">' +
      '<div class="ui-modal-title">' + (preset && preset.uid ? '编辑节点' : '添加节点') + '</div>' +
      '<div class="ui-modal-text nm-body">' +
      (preset && preset.lat != null ? '<div class="nm-coord">📍 ' + (+preset.lat).toFixed(5) + ', ' + (+preset.lng).toFixed(5) + '</div>' : '') +
      '<input id="nmName" class="nm-in" placeholder="名称（必填）" value="' + esc((preset && preset.name) || '') + '">' +
      '<input id="nmCity" class="nm-in" placeholder="城市（如 长沙）" value="' + esc((preset && preset.city) || '') + '">' +
      '<input id="nmCat" class="nm-in" placeholder="分类（如 茶馆 / 观景台 / 拍照点）" value="' + esc((preset && preset.category) || '') + '">' +
      '<input id="nmTags" class="nm-in" placeholder="标签（空格分隔，如 拍照 小众）" value="' + esc(((preset && preset.tags) || []).join(' ')) + '">' +
      '<textarea id="nmDesc" class="nm-ta" placeholder="简介 / 备注（可选）" rows="2">' + esc((preset && preset.desc) || '') + '</textarea>' +
      '<div class="nm-dup" id="nmDup"></div>' +
      '</div>' +
      '<div class="ui-modal-acts"><button class="ui-btn ui-btn-ghost" id="nmCancel">取消</button><button class="ui-btn ui-btn-primary" id="nmSave">保存</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); });
    m.querySelector('#nmCancel').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.getElementById('nmName').focus();
    var dupEl = m.querySelector('#nmDup');
    m.querySelector('#nmName').oninput = function () {
      var v = this.value.trim();
      if (!v || !preset || preset.lat == null) return;
      var hits = findDup(v, preset.lat, preset.lng);
      dupEl.innerHTML = hits.length ? '<span class="nm-dup-warn">⚠ 附近已有相似节点：' + hits.map(function (h) { return esc(h.label || h.name); }).join('、') + '</span>' : '';
    };
    m.querySelector('#nmSave').onclick = function () {
      var name = document.getElementById('nmName').value.trim();
      if (!name) { UI.toast('请填写名称'); return; }
      if (!preset || preset.lat == null) { UI.toast('请先在地图上选择位置'); return; }
      var hits = findDup(name, preset.lat, preset.lng);
      function doSave() {
        var rec = {
          id: (preset && preset.uid) || Date.now().toString(36),
          name: name,
          lat: preset.lat, lng: preset.lng,
          province: (preset && preset.province) || '',
          city: document.getElementById('nmCity').value.trim(),
          category: document.getElementById('nmCat').value.trim() || '其他',
          tags: document.getElementById('nmTags').value.trim().split(/\\s+/).filter(Boolean),
          desc: document.getElementById('nmDesc').value.trim(),
          createdAt: (preset && preset.createdAt) || Date.now()
        };
        var arr = loadUserNodes();
        var idx = arr.findIndex(function (x) { return x.id === rec.id; });
        if (idx >= 0) arr[idx] = rec; else arr.push(rec);
        saveUserNodes(arr);
        var si = SITES.findIndex(function (x) { return x.source === 'user' && x.uid === rec.id; });
        if (si >= 0) {
          var o = SITES[si];
          o.name = rec.name; o.label = rec.name; o.city = rec.city; o.theme = rec.category; o.desc = rec.desc;
          o.lat = +rec.lat; o.lng = +rec.lng; o.tags = rec.tags; o.region = rec.province || '其他';
        } else {
          SITES.push({ id: 'u' + rec.id, name: rec.name, label: rec.name, region: rec.province || '其他', city: rec.city, county: '', theme: rec.category || '其他', desc: rec.desc, best: '', lat: +rec.lat, lng: +rec.lng, flag: '', source: 'user', uid: rec.id, tags: rec.tags });
        }
        attachIndex();
        renderAll();
        m.remove();
        UI.toast('已保存「' + rec.name + '」');
      }
      if (hits.length) {
        UI.confirm({ title: '重复节点', text: '附近已有相似节点：' + hits.map(function (h) { return h.label || h.name; }).join('、') + '\\n仍然添加？', okText: '仍然添加', danger: true }, function (ok) { if (ok) doSave(); });
      } else doSave();
    };
  }
  function openNodePick() {
    if (!map) return;
    UI.toast('在地图上点击选择位置');
    map.once('click', function (e) {
      var lat = e.latlng.lat, lng = e.latlng.lng;
      if (nodePickMarker) nodePickMarker.remove();
      nodePickMarker = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div style="width:26px;height:26px;border-radius:50%;background:rgba(200,109,75,.9);border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.3)"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);
      openNodeForm({ lat: lat, lng: lng });
    });
  }
  function addNodeAtCurrent() {
    if (!navigator.geolocation) { UI.toast('当前环境不支持定位'); return; }
    UI.toast('定位中…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      openNodeForm({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, function () { UI.toast('定位失败，请检查定位权限'); }, { enableHighAccuracy: true, timeout: 10000 });
  }
  function openMyNodes() {
    var arr = loadUserNodes();
    var m = document.createElement('div');
    m.className = 'ui-modal-mask nm-mask';
    m.innerHTML =
      '<div class="ui-modal nm-form" role="dialog" aria-modal="true">' +
      '<div class="ui-modal-title">我的节点 <small style="font-size:12px;color:var(--color-muted)">' + arr.length + ' 个</small></div>' +
      '<div class="ui-modal-text nm-list" id="nmList"></div>' +
      '<div class="ui-modal-acts"><button class="ui-btn ui-btn-ghost" id="nmClose">关闭</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); });
    m.querySelector('#nmClose').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    var box = m.querySelector('#nmList');
    if (!arr.length) {
      box.innerHTML = '<div style="text-align:center;color:var(--color-muted);padding:20px 0">还没有自己添加的节点<br><span style="font-size:12px">地图右下「＋」→ 地图选点 / 使用当前位置</span></div>';
      return;
    }
    box.innerHTML = arr.map(function (u) {
      return '<div class="nm-item">' +
        '<div class="nm-item-main"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.category].filter(Boolean).join(' · ')) + '</small></div>' +
        '<button class="nm-item-btn" onclick="window.TopicEngine.editUserNode(\\'' + u.id + '\\')">编辑</button>' +
        '<button class="nm-item-btn danger" onclick="window.TopicEngine.delUserNode(\\'' + u.id + '\\')">删除</button></div>';
    }).join('');
  }
  function editUserNode(uid) {
    var u = loadUserNodes().find(function (x) { return x.id === uid; });
    if (!u) return;
    closeTopModal();
    openNodeForm({ uid: u.id, name: u.name, lat: u.lat, lng: u.lng, city: u.city, category: u.category, tags: u.tags, desc: u.desc, province: u.province, createdAt: u.createdAt });
  }
  function delUserNode(uid) {
    var u = loadUserNodes().find(function (x) { return x.id === uid; });
    if (!u) return;
    UI.confirm({ title: '删除节点', text: '确定删除「' + u.name + '」？', okText: '删除', danger: true }, function (ok) {
      if (!ok) return;
      saveUserNodes(loadUserNodes().filter(function (x) { return x.id !== uid; }));
      for (var i = SITES.length - 1; i >= 0; i--) { if (SITES[i].source === 'user' && SITES[i].uid === uid) SITES.splice(i, 1); }
      attachIndex();
      renderAll();
      closeTopModal();
      UI.toast('已删除');
    });
  }
  function closeTopModal() { document.querySelectorAll('.nm-mask').forEach(function (x) { x.remove(); }); }
  /* 右下 ＋ 入口（规范 §19） */
  function initNodeMgmt() {
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
          if (a === 'pick') openNodePick();
          else if (a === 'cur') addNodeAtCurrent();
          else if (a === 'search') location.href = 'search.html';
          else if (a === 'mine') openMyNodes();
        };
      });
    };
    document.body.appendChild(fab);
    window.TopicEngine.editUserNode = editUserNode;
    window.TopicEngine.delUserNode = delUserNode;
  }

  /* ---------- 渲染调度 ---------- */`,
  '7.big block'
);

/* 8. buildSheet：用户节点操作菜单（编辑/删除） */
rep(
  `      '<span onclick="window.TopicEngine.closeSheet()">收起</span></div>';`,
  `      (s.source === 'user' ? '<span onclick="window.TopicEngine.editUserNode(\\'' + s.uid + '\\')">编辑节点</span>' : '') +
      (s.source === 'user' ? '<span style="color:var(--color-danger)" onclick="window.TopicEngine.delUserNode(\\'' + s.uid + '\\')">删除节点</span>' : '') +
      '<span onclick="window.TopicEngine.closeSheet()">收起</span></div>';`,
  '8.buildSheet'
);

fs.writeFileSync(p, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('=== applied', n, 'patches ===');
