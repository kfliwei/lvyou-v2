/* ============================================================
   topic-common.js — 省份专题页通用引擎（topic.html 专用）
   数据驱动：window.TOPIC_META 提供省份配置，window.SITES / window.FOOD 提供数据
   由 topic.html 的启动器加载数据文件后调用 window.TopicEngine.init()
   省份新增流程：sc-data.js(+sc-food.js) + 注册表一条 + 入口卡片，无需复制页面
   ============================================================ */
(function () {
  var M = null;              // TOPIC_META（init 时读取）
  var SITES = [], FOOD = [];
  var map, markerLayer, useGCJ = true, lastMarkerList = null, lastRouteRi = null;
  var markers = new Map();
  var routeLayer = null, curSite = null, tripRouteLayer = null;
  var userLatLng = null, userMarker = null, watchId = null, pickMode = false;
  var trip = [], routeOrders = {};
  var nearLayer = null, nearP = null, nearBar = null;
  var state = { q: "", region: "", theme: "", city: "", sort: "" };
  var FOOD_STATE = { q: "", prov: "", city: "", type: "" };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function $(id) { return document.getElementById(id); }

  /* ---------- 坐标 / 距离 ---------- */
  function haversine(a, b) { var R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
    var s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s)); }
  function havKm(aLat, aLng, bLat, bLng) { var R = 6371, r = Math.PI / 180; var dLa = (bLat - aLat) * r, dLo = (bLng - aLng) * r;
    var s = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))); }
  function refPoint() { if (state.sort === "me" && userLatLng) return userLatLng; if (state.sort && M.REF[state.sort]) return M.REF[state.sort]; return null; }
  function _tlat(lng, lat) { var r = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng)); r += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3; r += (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3; r += (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3; return r; }
  function _tlng(lng, lat) { var r = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng)); r += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3; r += (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3; r += (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3; return r; }
  var _A = 6378245.0, _EE = 0.00669342162296594323;
  function gcj02Of(lat, lng) {
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
    var dlat = _tlat(lng - 105, lat - 35), dlng = _tlng(lng - 105, lat - 35);
    var rl = lat / 180 * Math.PI, m = Math.sin(rl), mm = 1 - _EE * m * m, sm = Math.sqrt(mm);
    dlat = (dlat * 180) / ((_A * (1 - _EE)) / (mm * sm) * Math.PI);
    dlng = (dlng * 180) / (_A / sm * Math.cos(rl) * Math.PI);
    return [lat + dlat, lng + dlng];
  }
  function pt(s) { return useGCJ ? gcj02Of(s.lat, s.lng) : [s.lat, s.lng]; }
  function gxy(lat, lng) { return useGCJ ? gcj02Of(lat, lng) : [lat, lng]; }
  function colorOf(s) { return M.themes[s.theme] || "#7D7970"; }

  /* ---------- 筛选 ---------- */
  function getFiltered() {
    var q = state.q.trim().toLowerCase();
    var arr = SITES.filter(function (s) {
      if (state.region && s.region !== state.region) return false;
      if (state.theme && s.theme !== state.theme) return false;
      if (state.city && s.city !== state.city) return false;
      if (q) { var hay = (s.name + s.label + s.region + s.city + s.county + s.theme + s.desc + (s.best || "")).toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    var rp = refPoint();
    if (rp) arr = arr.map(function (s) { var c = {}; for (var k in s) c[k] = s[k]; c._d = haversine(rp, [s.lat, s.lng]); return c; }).sort(function (a, b) { return a._d - b._d; });
    return arr;
  }

  /* ---------- 地图 ---------- */
  function initMap() {
    map = L.map('mapEl', { zoomControl: false, attributionControl: false }).setView(M.center, M.zoom);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
    var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
    var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '&copy; Esri' });
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenTopoMap' });
    markerLayer = L.layerGroup().addTo(map);
    var amapStreet = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图' });
    amapStreet.addTo(map);
    amapStreet.on('tileerror', function () { if (!map.hasLayer(osmLayer)) { try { amapStreet.remove(); } catch (e) {} osmLayer.addTo(map); } });
    var amapSat = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图' });
    var amapLabel = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '' });
    var amapSatL = L.layerGroup([amapSat, amapLabel]);
    var BASE_LAYERS = [
      { id: 'osm', name: '街道地图', sw: 'linear-gradient(#f0f0ec,#d8d8d2)', layer: osmLayer },
      { id: 'sat', name: '卫星实景', sw: 'linear-gradient(#3c5d52,#27423f)', layer: satLayer },
      { id: 'topo', name: '等高线地形', sw: 'linear-gradient(#d9c9a8,#b8a878)', layer: topoLayer },
      { id: 'amapStreet', name: '高德街道', sw: 'linear-gradient(#c9d3c0,#8fa893)', layer: amapStreet },
      { id: 'amapSat', name: '高德卫星', sw: 'linear-gradient(#27423f,#101f1b)', layer: amapSat },
      { id: 'amapSatL', name: '高德卫星+注记', sw: 'linear-gradient(#3c5d52,#0f2a24)', layer: amapSatL }
    ];
    var layMenu = $('layMenu');
    BASE_LAYERS.forEach(function (b) {
      var li = document.createElement('div'); li.className = 'li' + (b.layer === amapStreet ? ' on' : ''); li.dataset.id = b.id;
      li.innerHTML = '<span class="sw" style="background:' + b.sw + '"></span>' + b.name + '<span class="ck" style="display:' + (b.layer === amapStreet ? '' : 'none') + '">✓</span>';
      li.onclick = function () {
        BASE_LAYERS.forEach(function (x) { if (map.hasLayer(x.layer)) map.removeLayer(x.layer); });
        b.layer.addTo(map);
        layMenu.querySelectorAll('.li').forEach(function (x) { var on = x.dataset.id === b.id; x.classList.toggle('on', on); x.querySelector('.ck').style.display = on ? '' : 'none'; });
        var isGCJ = (b.id === 'amapStreet' || b.id === 'amapSat' || b.id === 'amapSatL');
        if (isGCJ !== useGCJ) { useGCJ = isGCJ; if (lastMarkerList) renderMarkers(lastMarkerList); if (lastRouteRi != null) showRouteOnMap(lastRouteRi); if (userLatLng && userMarker) userMarker.setLatLng(gxy(userLatLng[0], userLatLng[1])); }
      };
      layMenu.appendChild(li);
    });
    $('layBtn').onclick = function (e) { e.stopPropagation(); layMenu.classList.toggle('show'); };
    $('zoomIn').onclick = function () { map.zoomIn(); };
    $('zoomOut').onclick = function () { map.zoomOut(); };
    map.on('click', function () { layMenu.classList.remove('show'); });
    map.on('movestart', function () { layMenu.classList.remove('show'); });
    map.on('click', function (e) {
      if (pickMode) { pickMode = false; hidePickHint(); locateSuccess({ coords: { latitude: e.latlng.lat, longitude: e.latlng.lng } }); return; }
      if (M.nearEnabled) { nearPick(e.latlng); return; }
      spotRec(e.latlng.lat, e.latlng.lng);
    });
    /* LOD 分级：平移 / 缩放时按当前视野与级别重渲染（仅全国页） */
    if (M.lodEnabled) {
      map.on('moveend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });
      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });
    }
  }

  /* ---------- 全国页：点击查附近（M.nearEnabled） ---------- */
  var nearHits = [];
  function clearNearLayer() { if (nearLayer) { map.removeLayer(nearLayer); nearLayer = null; } }
  function hideNearBar() { if (nearBar) nearBar.style.display = 'none'; }
  function restoreMarkers() {
    /* 恢复被「查附近」高亮的节点为普通图标 */
    if (nearHits.length && lastMarkerList) renderMarkers(lastMarkerList);
    nearHits = [];
  }
  /* 附近高亮图标：主题色实心圆点 + 扩散光环 + 放大，明显区别于普通节点 */
  function nearIcon(s) {
    var theme = colorOf(s);
    var html = '<div class="tr-node tr-major"><span class="tr-halo" style="--tint:' + theme + '"></span><span class="tr-ring" style="--tint:' + theme + ';opacity:.85"></span><span class="tr-dot" style="background:' + theme + '"></span></div>';
    return L.divIcon({ className: '', html: html, iconSize: [40, 40], iconAnchor: [20, 20] });
  }
  function nearPick(latlng) {
    restoreMarkers();
    clearNearLayer();
    nearLayer = L.layerGroup().addTo(map);
    L.circleMarker([latlng.lat, latlng.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#C86D4B', fillOpacity: 1 }).addTo(nearLayer);
    nearP = [latlng.lat, latlng.lng];
    if (!nearBar) {
      nearBar = document.createElement('div');
      nearBar.id = 'nearBar';
      nearBar.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:4px;background:rgba(250,248,243,.96);border:1px solid rgba(32,32,29,.08);border-radius:999px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:5px 6px;z-index:1200;backdrop-filter:blur(16px);max-width:calc(100vw - 24px)';
      nearBar.innerHTML = [10, 30, 50, 100].map(function (k) { return '<span class="nk" data-k="' + k + '" style="padding:6px 9px;border-radius:999px;font-size:12px;color:var(--color-ink-soft);cursor:pointer;font-family:var(--font-sans);white-space:nowrap">' + k + 'km</span>'; }).join('') +
        '<span id="nearX" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--color-bg-soft);color:var(--color-muted);font-size:11px;cursor:pointer;flex-shrink:0">✕</span>';
      document.getElementById('mapEl').appendChild(nearBar);
      /* 关键：禁止 nearBar 的点击冒泡到地图（否则点半径/✕ 会触发地图 click 重新弹回半径条） */
      if (L.DomEvent && L.DomEvent.disableClickPropagation) L.DomEvent.disableClickPropagation(nearBar);
      nearBar.querySelectorAll('.nk').forEach(function (c) {
        c.onclick = function (ev) { if (ev) ev.stopPropagation(); hideNearBar(); nearQuery(nearP[0], nearP[1], +c.dataset.k); };
      });
      nearBar.querySelector('#nearX').onclick = function (ev) { if (ev) ev.stopPropagation(); hideNearBar(); clearNearLayer(); restoreMarkers(); };
    }
    nearBar.style.display = 'flex';
  }
  function nearQuery(lat, lng, km) {
    clearNearLayer();
    nearLayer = L.layerGroup().addTo(map);
    L.circle([lat, lng], { radius: km * 1000, color: '#C86D4B', weight: 1.5, dashArray: '4 6', fillColor: '#C86D4B', fillOpacity: .06 }).addTo(nearLayer);
    var hits = SITES.map(function (s) { return { s: s, d: haversine([lat, lng], [s.lat, s.lng]) }; })
      .filter(function (h) { return h.d <= km; })
      .sort(function (a, b) { return a.d - b.d; });
    /* 圈内节点高亮：nearIcon（主题色圆点+光环+放大），
       LOD 聚合下未单独渲染的补画高亮图标到 nearLayer —— 不切列表视图 */
    restoreMarkers();
    nearHits = hits.map(function (h) { return h.s.__i; });
    hits.forEach(function (h) {
      var m = markers.get(h.s.__i);
      if (m) m.setIcon(nearIcon(h.s));
      else L.marker(pt(h.s), { icon: nearIcon(h.s), zIndexOffset: 800 }).addTo(nearLayer);
    });
    showTripToast('📍 附近 ' + km + 'km · ' + hits.length + ' 处（高亮显示，点击地图其他位置恢复）');
  }

  /* ---------- 随手记 ---------- */
  function spotRec(lat, lng) {
    var m = L.marker([lat, lng], { icon: L.divIcon({ html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))">🎙️</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 22] }) }).addTo(map);
    m.bindPopup('<div class="pop"><div class="pscroll"><b>途经点随手记</b><div class="pm">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div><div class="pm pa">在此以 GPS 位置语音记录一段见闻，保存后成为游记节点。</div></div><div class="pfoot"><button class="addtrip tnvo" onclick="window.__tnSpot(' + lat + ',' + lng + ')">🎙 在此语音记录</button></div></div>', { maxWidth: 260, className: 'trippop', autoPan: true }).openPopup();
    m.on('popupclose', function () { if (map.hasLayer(m)) map.removeLayer(m); });
  }
  window.__tnSpot = function (lat, lng) { window.TravelNotes.openPanel({ label: '途经点', lat: lat, lng: lng }); };
  window.__tnAnywhere = function () {
    var open = function (p) { window.TravelNotes.openPanel({ label: '当前位置（GPS）', lat: p.lat, lng: p.lng }); };
    var tip = function (msg) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(31,122,90,.95);color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;z-index:9600;box-shadow:0 2px 12px rgba(0,0,0,.2);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis';
      d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2400);
    };
    var fallback = function () {
      if (userLatLng) { open({ lat: userLatLng[0], lng: userLatLng[1] }); }
      else { if (!$('map').classList.contains('active')) switchTab('map'); tip('⚠️ 无法获取位置：可点 📍 定位，或直接在地图上点想记录的地点'); }
    };
    try {
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { open({ lat: p.coords.latitude, lng: p.coords.longitude }); }, fallback, { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 });
      else fallback();
    } catch (e) { fallback(); }
  };

  /* ---------- 节点 / Sheet ---------- */
  function isMajorSite(s) { return (M.majorThemes || []).indexOf(s.theme) >= 0; }
  function nodeIcon(s, active) {
    var theme = colorOf(s);
    var inT = inTrip(s.__i);
    var num = inT ? (trip.indexOf(s.__i) + 1) : null;
    var cls = 'tr-node' + (active ? ' tr-active' : '') + (isMajorSite(s) ? ' tr-major' : '');
    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + theme + '"></span><span class="tr-dot"></span>';
    if (num) html += '<span class="node-num">' + num + '</span>';
    html += '</div>';
    return L.divIcon({ className: '', html: html, iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  function setActiveNode(i) { markers.forEach(function (m, idx) { if (SITES[idx]) m.setIcon(nodeIcon(SITES[idx], idx === i)); }); }
  /* 省级聚合点图标（LOD 最低层，全国视野）：胶囊形 省简称 + 数量 */
  function provIcon(name, n, tint) {
    var html = '<div style="display:flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:999px;background:' + tint + ';color:#fff;font-size:12.5px;font-weight:600;font-family:var(--font-sans);box-shadow:0 3px 12px rgba(0,0,0,.3);border:2px solid #fff;white-space:nowrap">' + name + '<b style="font-size:11px;opacity:.85">' + n + '</b></div>';
    return L.divIcon({ className: '', html: html, iconSize: [54, 34], iconAnchor: [27, 17] });
  }
  /* 城市聚合点图标（LOD 中层，省视野）：圆形数字徽标 */
  function clusterIcon(n, tint) {
    var html = '<div style="width:32px;height:32px;border-radius:50%;background:' + tint + ';color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.28);font-family:var(--font-sans);letter-spacing:-.02em">' + n + '</div>';
    return L.divIcon({ className: '', html: html, iconSize: [32, 32], iconAnchor: [16, 16] });
  }
  /* LOD 三级渲染（M.lodEnabled，全国页）：
     zoom < 5.5 省级聚合（全国视野）→ 5.5-7.5 城市聚合（省视野）→ >=7.5 具体节点（市视野，含视野裁剪与重要主题过滤） */
  function renderLOD(list) {
    var z = map.getZoom(), b = map.getBounds();
    markerLayer.clearLayers(); markers.clear();
    if (z < 5.5) {
      var byProv = {};
      list.forEach(function (s) {
        if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
        (byProv[s.region] = byProv[s.region] || []).push(s);
      });
      Object.keys(byProv).forEach(function (prov) {
        var arr = byProv[prov], s0 = arr[0];
        var bnd = L.latLngBounds(arr.map(pt));
        var short = M.regionShort[prov] || prov;
        var m = L.marker(bnd.getCenter(), { icon: provIcon(short, arr.length, colorOf(s0)), zIndexOffset: -600 });
        m.on('click', function () { map.flyToBounds(bnd, { padding: [50, 70], maxZoom: 6.8 }); });
        markerLayer.addLayer(m); markers.set('p:' + prov, m);
      });
      return;
    }
    if (z < 7.5) {
      var byCity = {};
      list.forEach(function (s) {
        if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
        var key = s.region + '|' + (s.city || '其他');
        (byCity[key] = byCity[key] || []).push(s);
      });
      Object.keys(byCity).forEach(function (key) {
        var arr = byCity[key], s0 = arr[0];
        var bnd = L.latLngBounds(arr.map(pt));
        var m = L.marker(bnd.getCenter(), { icon: clusterIcon(arr.length, colorOf(s0)), zIndexOffset: -500 });
        m.on('click', function () { map.flyToBounds(bnd, { padding: [50, 70], maxZoom: 10 }); });
        markerLayer.addLayer(m); markers.set('c:' + key, m);
      });
      return;
    }
    list.forEach(function (s) {
      if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
      if (z < 9 && !isMajorSite(s)) return; /* 中缩放只显示重要主题 */
      if (!b.contains(pt(s))) return;       /* 视野裁剪 */
      var m = L.marker(pt(s), { icon: nodeIcon(s, false) });
      m.on('click', function () { openSheet(s.__i); });
      markerLayer.addLayer(m); markers.set(s.__i, m);
    });
  }
  function renderMarkers(list) {
    lastMarkerList = list;
    if (M.lodEnabled) { renderLOD(list); return; }
    markerLayer.clearLayers(); markers.clear();
    list.forEach(function (s) {
      if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
      var m = L.marker(pt(s), { icon: nodeIcon(s, false) });
      m.on('click', function () { openSheet(s.__i); });
      markerLayer.addLayer(m); markers.set(s.__i, m);
    });
  }
  function buildSheet(i) {
    var s = SITES[i]; if (!s) return '';
    var inT = inTrip(i);
    var img = s.img ? '<div class="ls-img"><img src="' + s.img + '" alt="' + esc(s.label) + '" onerror="this.style.display=\'none\'"></div>' : '';
    return '<div class="ls-place">' + esc(s.label) + '</div>' +
      '<div class="ls-loc">' + (M.themeIcons[s.theme] || '') + ' ' + esc(s.theme) + ' · ' + esc(s.region) + esc(s.city) + (s.county ? (' · ' + esc(s.county)) : '') + '</div>' +
      img +
      '<div class="ls-desc">' + esc(s.desc) + '</div>' +
      (s.best ? '<div class="ls-hist">🗓 最佳季节 · ' + esc(s.best) + '</div>' : '') +
      '<div class="ls-actions">' +
      '<button class="btn-primary" style="min-height:46px;font-size:13.5px;padding:0 18px" onclick="window.TravelNotes.explain(' + i + ')">🎧 听讲解</button>' +
      '<button class="btn-secondary" style="min-height:46px;font-size:13.5px;padding:0 16px" onclick="window.TravelNotes.openPanel(' + i + ')">🎙 语音记录</button>' +
      '<span class="ls-add' + (inT ? ' done' : '') + '" onclick="window.TopicEngine.toggleTrip(' + i + ')">' + (inT ? '✓ 已加入行程' : '+ 加入行程') + '</span>' +
      '</div>' +
      '<div class="ls-more"><span onclick="window.TopicEngine.flyToSite(' + i + ',true)">在地图查看</span><span onclick="window.TopicEngine.closeSheet()">收起</span></div>';
  }
  function openSheet(i) {
    curSite = i;
    $('lsBody').innerHTML = buildSheet(i);
    $('locSheet').classList.add('show');
    setActiveNode(i);
    document.querySelector('.tabbar').classList.add('is-hidden');
    highlightCard(i);
    if (map) setTimeout(function () { map.panBy([0, -160], { duration: 420 }); }, 80);
  }
  function closeSheet() {
    $('locSheet').classList.remove('show');
    document.querySelector('.tabbar').classList.remove('is-hidden');
    curSite = null; setActiveNode(-1);
    if (map) setTimeout(function () { map.panBy([0, 160], { duration: 420 }); }, 80);
  }
  function refreshSheet() { if (curSite != null && $('locSheet').classList.contains('show')) $('lsBody').innerHTML = buildSheet(curSite); }
  function drawTripRoute() {
    if (tripRouteLayer) { tripRouteLayer.remove(); tripRouteLayer = null; }
    if (trip.length < 2) return;
    var pts = trip.map(function (i) { return pt(SITES[i]); });
    tripRouteLayer = L.polyline(pts, { color: '#C86D4B', weight: 3, opacity: .7, dashArray: '6 6' }).addTo(map);
  }
  function showTripToast(msg) {
    var t = $('tripToast');
    if (!t) { t = document.createElement('div'); t.id = 'tripToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- 我的行程 ---------- */
  function inTrip(i) { return trip.indexOf(i) >= 0; }
  function saveTrip() { try { localStorage.setItem(M.tripKey, JSON.stringify(trip)); } catch (e) {} }
  function toggleTrip(i) {
    var k = trip.indexOf(i);
    var isAdd = k < 0;
    if (k >= 0) trip.splice(k, 1); else trip.push(i);
    saveTrip(); renderTripBar(); drawTripRoute();
    if (isAdd) showTripToast('+1 已加入今天的行程');
    refreshSheet();
  }
  function renderTripBar() {
    var bar = $('tripBar');
    $('tripCnt').textContent = trip.length;
    var row = $('tripRow'); row.innerHTML = '';
    trip.forEach(function (i, n) {
      var s = SITES[i]; if (!s) return;
      var c = document.createElement('div'); c.className = 'chip';
      c.innerHTML = '<span class="no">' + (n + 1) + '</span><span class="nm" style="cursor:pointer">' + s.label + '</span><span class="mv" data-d="up">▲</span><span class="mv" data-d="dn">▼</span><span class="x">✕</span>';
      c.querySelector('.nm').onclick = function () { flyToSite(i); };
      c.querySelector('[data-d="up"]').onclick = function (e) { e.stopPropagation(); if (n > 0) { trip.splice(n, 1); trip.splice(n - 1, 0, i); saveTrip(); renderTripBar(); } };
      c.querySelector('[data-d="dn"]').onclick = function (e) { e.stopPropagation(); if (n < trip.length - 1) { trip.splice(n, 1); trip.splice(n + 1, 0, i); saveTrip(); renderTripBar(); } };
      c.querySelector('.x').onclick = function (e) { e.stopPropagation(); toggleTrip(i); };
      row.appendChild(c);
    });
    $('tripBadge').textContent = trip.length;
    var fab = $('tripFab');
    fab.style.display = trip.length > 0 ? 'flex' : 'none';
    if (trip.length === 0) bar.classList.remove('open');
  }
  function sortTripNN() {
    if (trip.length < 2) { showTripToast('至少需要 2 个地点才能排序'); return; }
    if (!userLatLng) { showTripToast('先点 📍 定位，才能按距离排序'); return; }
    var rest = trip.slice(), out = [], cur = userLatLng;
    while (rest.length) {
      var bi = 0, bd = 1e12;
      rest.forEach(function (i, k) { var s = SITES[i]; var d = (s.lat - cur[0]) ** 2 + (s.lng - cur[1]) ** 2; if (d < bd) { bd = d; bi = k; } });
      var pick = rest.splice(bi, 1)[0]; out.push(pick); cur = [SITES[pick].lat, SITES[pick].lng];
    }
    trip = out; saveTrip(); renderTripBar(); drawTripRoute();
    showTripToast('我帮你重新排了一下顺序');
  }
  function navAmap() {
    if (trip.length === 0) return;
    var pts = trip.map(function (i) { var s = SITES[i]; var g = gcj02Of(s.lat, s.lng); return { lng: g[1], lat: g[0], name: s.label }; });
    var sLng, sLat, sName = '我的位置';
    if (userLatLng) { var g0 = gcj02Of(userLatLng[0], userLatLng[1]); sLng = g0[1]; sLat = g0[0]; }
    else { var f = pts.shift(); sLng = f.lng; sLat = f.lat; sName = f.name; }
    if (pts.length === 0) { window.location.href = 'https://uri.amap.com/marker?position=' + sLng + ',' + sLat + '&name=' + encodeURIComponent(sName) + '&src=行迹&coordinate=gaode&callnative=1'; return; }
    var dest = pts[pts.length - 1], ways = pts.slice(0, -1);
    var viaLons = ways.map(function (w) { return w.lng; }).join('|'), viaLats = ways.map(function (w) { return w.lat; }).join('|'), viaNames = ways.map(function (w) { return encodeURIComponent(w.name); }).join('|');
    var deep = 'amapuri://route/plan/?sourceApplication=' + encodeURIComponent('行迹') + '&slat=' + sLat + '&slon=' + sLng + '&sname=' + encodeURIComponent(sName) + '&dlat=' + dest.lat + '&dlon=' + dest.lng + '&dname=' + encodeURIComponent(dest.name) + '&dev=0&t=0';
    if (ways.length) deep += '&vian=' + ways.length + '&vialons=' + viaLons + '&vialats=' + viaLats + '&vianames=' + viaNames;
    var web = 'https://uri.amap.com/navigation?from=' + sLng + ',' + sLat + ',' + encodeURIComponent(sName) + '&to=' + dest.lng + ',' + dest.lat + ',' + encodeURIComponent(dest.name) + '&mode=car&policy=1&src=行迹&coordinate=gaode&callnative=1';
    if (ways.length) web += '&waypoints=' + ways.map(function (w) { return w.lng + ',' + w.lat + ',' + encodeURIComponent(w.name); }).join(';');
    $('tripBar').classList.remove('open');
    if (/GuJianApp/.test(navigator.userAgent)) { window.location.href = deep; return; }
    var t0 = Date.now();
    window.location.href = deep;
    setTimeout(function () { if (Date.now() - t0 < 2200) window.location.href = web; }, 1900);
  }
  function openArrive() {
    if (!trip.length) { showTripToast('先加入地点，再开始今天的旅行'); return; }
    var s = SITES[trip[0]];
    $('arPlace').textContent = s ? esc(s.label) : '—';
    $('arSub').textContent = trip.length + ' 站 · ' + (s ? (s.region || '') : '');
    $('arriveDlg').classList.add('show');
  }
  function closeArrive() { $('arriveDlg').classList.remove('show'); }
  function flyToSite(i, fromSheet) {
    var s = SITES[i]; if (!s) return;
    map.flyTo(pt(s), Math.max(map.getZoom(), 12), { duration: .6 });
    switchTab('map');
    if (fromSheet) { $('locSheet').classList.remove('show'); document.querySelector('.tabbar').classList.remove('is-hidden'); curSite = i; setActiveNode(i); }
    else { openSheet(i); }
  }

  /* ---------- 列表 ---------- */
  function detHtml(s) {
    var g = [["best", "最佳季节"], ["desc", "看点"]];
    var h = "";
    g.forEach(function (kv) { var k = kv[0], lab = kv[1]; if (s[k]) h += '<div class="grp"><span class="lab">' + lab + '</span>' + s[k] + '</div>'; });
    return h;
  }
  function makeCard(s) {
    var rp = refPoint();
    var c = colorOf(s);
    var card = document.createElement('div');
    card.className = 'card'; card.dataset.i = s.__i;
    var km = (rp && s._d != null) ? '<span class="km">📍 ' + s._d.toFixed(0) + ' km</span>' : '';
    var alt = (s.elev && +s.elev >= 5000) ? '<span class="tag" style="background:var(--cinnabar-500)">⚠ 极高海拔</span>' : '';
    var dh = detHtml(s);
    card.innerHTML = '<div class="ph"><div class="bar" style="background:' + c + '"></div>' + alt +
      '<img loading="lazy" src="' + s.img + '" alt="' + s.label + '" onerror="this.style.display=\'none\'">' +
      '<span class="tag">' + (M.themeIcons[s.theme] || '') + ' ' + s.theme + '</span></div>' +
      '<div class="body"><div class="nm">' + s.label + '</div>' +
      '<div class="meta">' + s.region + ' · ' + s.city + (s.county ? (' · ' + s.county) : '') + (s.elev ? (' · 海拔' + s.elev + 'm') : '') + '</div>' +
      '<div class="ds">' + s.desc + (s.best ? ('　🗓 最佳 ' + s.best) : '') + '</div>' +
      '<div class="detail">' + dh + '</div>' + km + '</div>' +
      '<div class="arr">›</div>';
    card.onclick = function () {
      flyToSite(s.__i);
      var d = card.querySelector('.detail');
      if (d && d.innerHTML.trim()) { d.classList.toggle('sh'); card.querySelector('.arr').textContent = d.classList.contains('sh') ? '˄' : '›'; }
    };
    return card;
  }
  /* 批量插入卡片（分批防卡） */
  function batchAppend(body, arr) {
    var BATCH = 120, idx = 0;
    (function next() {
      var end = Math.min(idx + BATCH, arr.length);
      for (; idx < end; idx++) body.appendChild(makeCard(arr[idx]));
      if (idx < arr.length) setTimeout(next, 40);
    })();
  }
  var lvState = {}; /* 省分组折叠/渲染状态 */
  function renderList(list) {
    var grid = $('grid');
    grid.innerHTML = '';
    $('listEmpty').style.display = list.length ? 'none' : 'block';
    /* 全国页：按省分组可折叠（默认收起，点开懒加载该省卡片） */
    if (M.listGroupByRegion) {
      var groups = {};
      list.forEach(function (s) { (groups[s.region] = groups[s.region] || []).push(s); });
      var provs = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
      provs.forEach(function (prov) {
        var arr = groups[prov];
        var grp = document.createElement('div'); grp.className = 'lv-group'; grp.dataset.prov = prov;
        var head = document.createElement('div'); head.className = 'lv-head';
        var short = M.regionShort[prov] || prov;
        head.innerHTML = '<span class="lv-badge">' + short + '</span><span class="lv-name">' + prov + '</span><span class="lv-cnt">' + arr.length + ' 处</span><span class="lv-arr">▾</span>';
        var body = document.createElement('div'); body.className = 'lv-body';
        var st = lvState[prov] || (lvState[prov] = { open: false, rendered: false });
        if (st.open) { grp.classList.add('open'); if (!st.rendered) { st.rendered = true; batchAppend(body, arr); } body.style.display = ''; }
        head.onclick = function () {
          var isOpen = grp.classList.toggle('open');
          st.open = isOpen;
          if (isOpen && !st.rendered) { st.rendered = true; batchAppend(body, arr); }
          body.style.display = isOpen ? '' : 'none';
        };
        grp.appendChild(head); grp.appendChild(body);
        grid.appendChild(grp);
      });
      $('listCnt').textContent = '共 ' + list.length + ' 处 · 按省';
      return;
    }
    /* 其他专题：原有平铺逻辑（分批） */
    if (list.length > 120) batchAppend(grid, list);
    else list.forEach(function (s) { grid.appendChild(makeCard(s)); });
    $('listCnt').textContent = '共 ' + list.length + ' 处';
  }
  function highlightCard(i) {
    document.querySelectorAll('.card.hl').forEach(function (c) { c.classList.remove('hl'); });
    var el = $('grid').querySelector('.card[data-i="' + i + '"]');
    if (el) { el.classList.add('hl'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    /* 全国页：该节点所在省组未展开时，先展开再高亮 */
    if (M.listGroupByRegion) {
      var s = SITES[i]; if (!s) return;
      var grp = $('grid').querySelector('.lv-group[data-prov="' + s.region + '"]');
      if (grp && !grp.classList.contains('open')) {
        grp.querySelector('.lv-head').click();
        setTimeout(function () { highlightCard(i); }, 80);
      }
    }
  }

  /* ---------- 主题 ---------- */
  var thState = {}; /* 主题折叠状态 */
  function renderThemes(list) {
    var tl = $('tl'); tl.innerHTML = '';
    M.themeOrder.forEach(function (th) {
      var items = list.filter(function (s) { return s.theme === th; }); if (!items.length) return;
      var sec = document.createElement('div'); sec.className = 'tl-era'; sec.dataset.th = th;
      var head = document.createElement('div'); head.className = 'tl-head';
      head.innerHTML = '<span class="d" style="background:' + M.themes[th] + '"></span><h3>' + th + ' ' + (M.themeIcons[th] || '') + '</h3><span class="cnt">' + items.length + ' 处</span><span class="tl-arr">▾</span>';
      var body = document.createElement('div'); body.className = 'tl-body';
      items.forEach(function (s) {
        var row = document.createElement('div'); row.className = 'tl-row';
        var elev = s.elev ? ('· ' + s.elev + 'm') : '';
        var rs = s.region; for (var k in M.regionShort) { rs = rs.replace(k, M.regionShort[k]); }
        row.innerHTML = '<div class="t">' + rs + '</div><div><div class="n">' + s.label + '</div><div class="c">' + s.city + (s.county ? ('·' + s.county) : '') + ' ' + elev + '</div></div>';
        row.onclick = function () { flyToSite(s.__i); };
        body.appendChild(row);
      });
      /* 点击主题头折叠/展开该主题的行；默认折叠（thState 记录展开态，undefined=折叠） */
      if (thState[th] !== true) sec.classList.add('collapsed');
      head.onclick = function () {
        var isColl = sec.classList.toggle('collapsed');
        thState[th] = !isColl;
      };
      sec.appendChild(head); sec.appendChild(body);
      tl.appendChild(sec);
    });
  }

  /* ---------- 路线 ---------- */
  function resolveStop(name) {
    var r = SITES.find(function (s) { return s.name === name; }) || SITES.find(function (s) { return s.label === name; });
    if (!r) { var b = name.replace(/（.*?）/g, "").replace(/[县市乡镇区县]$/, "").trim(); r = SITES.find(function (s) { return s.name.replace(/（.*?）/g, "").replace(/[县市乡镇区县]$/, "").trim() === b; }); }
    if (!r) r = SITES.find(function (s) { return s.name.includes(name) || s.label.includes(name); });
    return r;
  }
  function dayNames(ri, di) { var k = ri + ':' + di; return routeOrders[k] || M.routes[ri].days[di].stops; }
  function fmtDur(min) { min = Math.max(1, Math.round(min)); return min < 60 ? min + '分钟' : (Math.floor(min / 60) + '小时' + (min % 60 ? (min % 60 + '分') : '')); }
  function legEst(aLat, aLng, bLat, bLng) { var km = havKm(aLat, aLng, bLat, bLng) * 1.35; return { km: km, min: km / 48 * 60 }; }
  function firstStop(ri, di) { var ns = dayNames(ri, di); for (var i = 0; i < ns.length; i++) { var s = resolveStop(ns[i]); if (s) return s; } return null; }
  function lastStop(ri, di) { var ns = dayNames(ri, di); for (var i = ns.length - 1; i >= 0; i--) { var s = resolveStop(ns[i]); if (s) return s; } return null; }
  function dayConnectHtml(ri, di, c) {
    if (di <= 0) return '';
    var pl = lastStop(ri, di - 1), tf = firstStop(ri, di);
    if (!pl || !tf) return '';
    var e = legEst(pl.lat, pl.lng, tf.lat, tf.lng);
    return '<div class="dayconn" style="border-left:4px solid ' + c + '">🔗 承接 D' + di + ' 终点：<b>' + pl.label + '</b> → <b>' + tf.label + '</b>　约 ' + e.km.toFixed(0) + ' km · 建议预留 ' + fmtDur(e.min) + '（已含在下方导航起点）</div>';
  }
  function renderRoutes() {
    var box = $('routes'); box.innerHTML = '';
    var DAY_COLORS = M.dayColors;
    M.routes.forEach(function (rt, ri) {
      var total = rt.days.reduce(function (n, d) { return n + d.stops.length; }, 0);
      var el = document.createElement('div'); el.className = 'route';
      var keyHtml = rt.days.map(function (d, di) { return '<span class="dayKey"><span class="dk" style="background:' + DAY_COLORS[di % DAY_COLORS.length] + '"></span>D' + (di + 1) + ' ' + (d.title.split(' · ')[1] || d.title) + '</span>'; }).join('');
      var daysHtml = '';
      rt.days.forEach(function (d, di) {
        var c = DAY_COLORS[di % DAY_COLORS.length];
        var names = dayNames(ri, di);
        var stopsHtml = names.map(function (nm) {
          var s = resolveStop(nm);
          return s ? '<div class="stop"><div class="num" style="background:' + c + '">' + (names.indexOf(nm) + 1) + '</div><div class="si"><div class="sn">' + s.label + '</div><div class="sd">' + s.theme + ' · ' + s.region + s.county + ' · ' + (s.elev ? ('海拔' + s.elev + 'm') : '') + '</div></div></div>'
            : '<div class="stop"><div class="num" style="background:' + c + '">' + (names.indexOf(nm) + 1) + '</div><div class="si"><div class="sn">' + nm + '</div><div class="sd">（未收录）</div></div></div>';
        }).join('');
        var connHtml = dayConnectHtml(ri, di, c);
        daysHtml += '<div class="day">' + connHtml + '<div class="dayh" style="border-left:5px solid ' + c + '"><span class="dnt" style="background:' + c + '">D' + (di + 1) + '</span><b>' + d.title + '</b></div><div class="daytip">💡 ' + d.tip + '</div>' + stopsHtml +
          '<div class="dayacts"><button class="dbtn" data-sort="' + ri + ':' + di + '">↻ 按距离排序</button><button class="dbtn send" data-send="' + ri + ':' + di + '">🚗 发高德导航</button></div></div>';
      });
      el.innerHTML = '<div class="rh" style="background:linear-gradient(135deg,' + rt.color + ',' + rt.color + '99)"><h3>' + rt.name + '</h3><p>⏱ ' + rt.days.length + ' 天 ｜ ' + total + ' 站 ｜ ' + rt.desc + '</p><div class="dkey">🎨 每日轨迹色：' + keyHtml + '</div></div><div class="stops">' + daysHtml + '</div>' +
        '<div class="acts"><button class="btn" data-show="' + ri + '">🗺️ 在地图查看（按天配色）</button><button class="btn alt" data-route="' + ri + '">📋 生成路线清单</button></div>';
      box.appendChild(el);
    });
    box.querySelectorAll('[data-show]').forEach(function (b) { b.onclick = function () { showRouteOnMap(+b.dataset.show); }; });
    box.querySelectorAll('[data-route]').forEach(function (b) { b.onclick = function () { buildRouteList(+b.dataset.route); }; });
    box.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { var p = b.dataset.sort.split(':').map(Number); sortRouteDay(p[0], p[1]); }; });
    box.querySelectorAll('[data-send]').forEach(function (b) { b.onclick = function () { var p = b.dataset.send.split(':').map(Number); sendRouteDayAmap(p[0], p[1]); }; });
  }
  function sortRouteDay(ri, di) {
    var names = dayNames(ri, di);
    var sites = names.map(resolveStop);
    var idx = sites.map(function (s, i) { return s ? i : -1; }).filter(function (i) { return i >= 0; });
    if (idx.length < 2) return;
    var _pl = di > 0 ? lastStop(ri, di - 1) : null;
    var cur = _pl ? [_pl.lat, _pl.lng] : (userLatLng ? userLatLng : [sites[idx[0]].lat, sites[idx[0]].lng]);
    var rest = idx.slice(), out = [];
    while (rest.length) {
      var bi = 0, bd = 1e12;
      rest.forEach(function (i, k) { var s = sites[i]; var d = (s.lat - cur[0]) ** 2 + (s.lng - cur[1]) ** 2; if (d < bd) { bd = d; bi = k; } });
      var pick = rest.splice(bi, 1)[0]; out.push(pick); cur = [sites[pick].lat, sites[pick].lng];
    }
    routeOrders[ri + ':' + di] = out.map(function (i) { return names[i]; });
    renderRoutes();
  }
  function sendRouteDayAmap(ri, di) {
    var names = dayNames(ri, di);
    var sites = names.map(resolveStop).filter(Boolean);
    if (sites.length === 0) return;
    var pts = sites.map(function (s) { var g = gcj02Of(s.lat, s.lng); return { lng: g[1], lat: g[0], name: s.name || s.label }; });
    var sLng, sLat, sName;
    var _pl = di > 0 ? lastStop(ri, di - 1) : null;
    if (_pl) { var g1 = gcj02Of(_pl.lat, _pl.lng); sLng = g1[1]; sLat = g1[0]; sName = '昨日终点·' + _pl.label; }
    else if (userLatLng) { var g2 = gcj02Of(userLatLng[0], userLatLng[1]); sLng = g2[1]; sLat = g2[0]; sName = '我的位置'; }
    else { var f = pts.shift(); sLng = f.lng; sLat = f.lat; sName = f.name; }
    if (pts.length === 0) { window.location.href = 'https://uri.amap.com/marker?position=' + sLng + ',' + sLat + '&name=' + encodeURIComponent(sName) + '&src=行迹&coordinate=gaode&callnative=1'; return; }
    var dest = pts[pts.length - 1], ways = pts.slice(0, -1);
    var viaLons = ways.map(function (w) { return w.lng; }).join('|'), viaLats = ways.map(function (w) { return w.lat; }).join('|'), viaNames = ways.map(function (w) { return encodeURIComponent(w.name); }).join('|');
    var deep = 'amapuri://route/plan/?sourceApplication=' + encodeURIComponent('行迹') + '&slat=' + sLat + '&slon=' + sLng + '&sname=' + encodeURIComponent(sName) + '&dlat=' + dest.lat + '&dlon=' + dest.lng + '&dname=' + encodeURIComponent(dest.name) + '&dev=0&t=0';
    if (ways.length) deep += '&vian=' + ways.length + '&vialons=' + viaLons + '&vialats=' + viaLats + '&vianames=' + viaNames;
    var web = 'https://uri.amap.com/navigation?from=' + sLng + ',' + sLat + ',' + encodeURIComponent(sName) + '&to=' + dest.lng + ',' + dest.lat + ',' + encodeURIComponent(dest.name) + '&mode=car&policy=1&src=行迹&coordinate=gaode&callnative=1';
    if (ways.length) web += '&waypoints=' + ways.map(function (w) { return w.lng + ',' + w.lat + ',' + encodeURIComponent(w.name); }).join(';');
    if (/GuJianApp/.test(navigator.userAgent)) { window.location.href = deep; return; }
    var t0 = Date.now(); window.location.href = deep;
    setTimeout(function () { if (Date.now() - t0 < 2200) window.location.href = web; }, 1900);
  }
  function showRouteOnMap(ri) {
    lastRouteRi = ri;
    var rt = M.routes[ri];
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.layerGroup().addTo(map);
    var DAY_COLORS = M.dayColors;
    var all = [];
    rt.days.forEach(function (d, di) {
      var pts = d.stops.map(resolveStop).filter(Boolean).map(function (s) { return pt(s); });
      if (pts.length < 1) return;
      all.push.apply(all, pts);
      var c = DAY_COLORS[di % DAY_COLORS.length];
      var line = L.polyline(pts, { color: c, weight: 4, opacity: .9, dashArray: "1,9", lineCap: "round" }).addTo(routeLayer);
      line.bindPopup('<b style="color:' + c + '">' + d.title + '</b>');
    });
    if (all.length) map.fitBounds(all, { padding: [40, 40] });
    switchTab('map');
    var banner = $('routeBanner');
    banner.style.display = 'block'; banner.textContent = '🗺️ ' + rt.name + '  ✕';
    banner.title = '点击清除路线';
    banner.onclick = clearRoute;
    var dl = $('dayLegend');
    dl.innerHTML = '<b>每日轨迹色</b><br>' + rt.days.map(function (d, di) { return '<span class="dl"><span class="dd" style="background:' + DAY_COLORS[di % DAY_COLORS.length] + '"></span>D' + (di + 1) + ' ' + (d.title.split(' · ')[1] || d.title) + '</span>'; }).join('');
    dl.style.display = 'none';
    var dlBtn = $('dayLegendBtn');
    dlBtn.textContent = '🎨 每日色';
    dlBtn.style.display = 'block';
    dlBtn.onclick = function () {
      var open = dl.style.display === 'block';
      dl.style.display = open ? 'none' : 'block';
      dlBtn.textContent = open ? '🎨 每日色' : '🎨 收起每日色';
    };
  }
  function clearRoute() {
    lastRouteRi = null;
    if (routeLayer) map.removeLayer(routeLayer); routeLayer = null;
    $('routeBanner').style.display = 'none';
    $('dayLegend').style.display = 'none';
    $('dayLegendBtn').style.display = 'none';
  }
  function buildRouteList(ri) {
    var rt = M.routes[ri];
    var resolved = rt.days.flatMap(function (d) { return d.stops; }).map(resolveStop).filter(Boolean);
    state.q = ""; $('search').value = "";
    var set = new Set(resolved.map(function (s) { return s.__i; }));
    var list = SITES.filter(function (s) { return set.has(s.__i); });
    renderList(list); switchTab('list');
    $('listCnt').textContent = '路线清单 · ' + list.length + ' 站（来自路线页）';
  }

  /* ---------- 我的位置 ---------- */
  function userDotIcon() { return L.divIcon({ className: '', html: '<div class="uwrap"><span class="upulse"></span><span class="udot"></span></div>', iconSize: [46, 46], iconAnchor: [23, 23] }); }
  var locateTried = false;
  function locateSuccess(pos) {
    userLatLng = [pos.coords.latitude, pos.coords.longitude];
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(gxy(userLatLng[0], userLatLng[1]), { icon: userDotIcon(), zIndexOffset: 1000 }).addTo(map);
    userMarker.bindPopup('<b>📍 我的位置</b>').openPopup();
    if (!watchId && navigator.geolocation) watchId = navigator.geolocation.watchPosition(function (p) {
      userLatLng = [p.coords.latitude, p.coords.longitude];
      if (userMarker) userMarker.setLatLng(gxy(userLatLng[0], userLatLng[1]));
    }, function () {}, { enableHighAccuracy: true, maximumAge: 10000 });
  }
  function showPickHint() { $('pickHint').style.display = 'block'; }
  function hidePickHint() { $('pickHint').style.display = 'none'; }
  function enterPickMode() { pickMode = true; if (!$('map').classList.contains('active')) switchTab('map'); showPickHint(); }
  function locate(manual) {
    if (!navigator.geolocation) { if (manual) enterPickMode(); return; }
    if (manual) $('locBtn').textContent = '⏳'; $('locBtn').className = 'fab loading';
    navigator.geolocation.getCurrentPosition(function (p) {
      locateSuccess(p);
      $('locBtn').className = 'fab ok'; setTimeout(function () { $('locBtn').className = 'fab'; }, 1500); $('locBtn').textContent = '📍';
      if (manual) { if ($('map').classList.contains('active')) map.setView(gxy(userLatLng[0], userLatLng[1]), Math.max(map.getZoom(), 11)); else switchTab('map'); }
    }, function (e) {
      $('locBtn').textContent = '📍';
      if (manual) enterPickMode();
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
  function autoLocate() { if (locateTried) return; locateTried = true; if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(locateSuccess, function () {}, { enableHighAccuracy: true, timeout: 8000 }); }

  /* ---------- 渲染调度 ---------- */
  function renderAll() {
    var list = getFiltered();
    renderMarkers(list);
    renderList(list);
    renderThemes(list);
    $('totalTag').textContent = '· 共 ' + SITES.length + ' 处' + (M.totalTagSuffix || '');
  }
  function attachIndex() { SITES.forEach(function (s, i) { s.__i = i; }); }
  function switchTab(tab) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    $(tab).classList.add('active');
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (tab === 'map') { setTimeout(function () { map.invalidateSize(); }, 60); autoLocate(); }
  }

  /* ---------- 筛选 chips ---------- */
  function mkChip(label, on, dot) {
    var c = document.createElement('button'); c.className = 'chip'; c.dataset.f = label;
    if (dot) c.style.borderColor = dot;
    c.innerHTML = (dot ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + dot + ';margin-right:5px"></span>' : '') + label;
    if (on) c.classList.add('on');
    return c;
  }
  function syncChips() {
    document.querySelectorAll('#dynChips .chip').forEach(function (c) {
      var f = c.dataset.f;
      if (f === '全部') { c.classList.toggle('on', !state.theme && !state.region && !state.city); return; }
      if (f === state.theme || f === state.region || f === state.city) c.classList.add('on'); else c.classList.remove('on');
    });
    /* 图例选中态与顶部 chips 同步（M.legendFilter） */
    document.querySelectorAll('#legBody .lg').forEach(function (el) {
      var isAll = (el.dataset.th === '');
      el.classList.toggle('on', isAll ? !state.theme : el.dataset.th === state.theme);
    });
  }
  function buildChips() {
    var dynChips = $('dynChips'); dynChips.innerHTML = '';
    var c = mkChip('全部', true); c.className = 'chip all on';
    c.onclick = function () { state.theme = ''; state.region = ''; state.city = ''; syncChips(); renderAll(); };
    dynChips.appendChild(c);
    if (M.themeChips !== false) {
      M.themeOrder.forEach(function (th) {
        var cc = mkChip((M.themeIcons[th] || '') + ' ' + th, false, M.themes[th]);
        cc.onclick = function () { state.theme = (state.theme === th ? '' : th); syncChips(); renderAll(); };
        dynChips.appendChild(cc);
      });
    }
    [...new Set(SITES.map(function (s) { return s.region; }))].sort().forEach(function (r) {
      var cc = mkChip(r, false);
      cc.onclick = function () {
        state.region = (state.region === r ? '' : r);
        if (state.city && (!state.region || !SITES.some(function (s) { return s.region === state.region && s.city === state.city; }))) state.city = '';
        syncChips(); renderAll();
      };
      dynChips.appendChild(cc);
    });
    if (M.cityChips !== false) {
      [...new Set(SITES.map(function (s) { return s.city; }))].sort().forEach(function (city) {
        var cc = mkChip(city, false);
        cc.onclick = function () {
          state.city = (state.city === city ? '' : city);
          if (state.city) { var r = SITES.find(function (s) { return s.city === state.city; }); if (r && r.region !== state.region) state.region = r.region; }
          syncChips(); renderAll();
        };
        dynChips.appendChild(cc);
      });
    }
    var legBody = $('legBody'); legBody.innerHTML = '';
    /* 图例首行：全部（清除主题筛选） */
    var allRow = document.createElement('div'); allRow.className = 'lg'; allRow.dataset.th = '';
    allRow.innerHTML = '<span class="dot" style="background:linear-gradient(135deg,#C86D4B,#3E7CB1,#5F8A6B,#8A5A44)"></span>全部主题<span class="cnt" style="margin-left:auto;font-size:10.5px;color:var(--color-faint);font-family:var(--font-sans)">' + SITES.length + '</span>';
    allRow.onclick = function () { state.theme = ''; syncChips(); renderAll(); };
    legBody.appendChild(allRow);
    M.themeOrder.forEach(function (th) {
      if (!SITES.some(function (s) { return s.theme === th; })) return;
      var r = document.createElement('div'); r.className = 'lg'; r.dataset.th = th;
      var cnt = SITES.filter(function (s) { return s.theme === th; }).length;
      r.innerHTML = '<span class="dot" style="background:' + M.themes[th] + '"></span>' + (M.themeIcons[th] || '') + ' ' + th + '<span class="cnt" style="margin-left:auto;font-size:10.5px;color:var(--color-faint);font-family:var(--font-sans)">' + cnt + '</span>';
      /* 图例即标签：点击切换该主题筛选（与顶部 chips 联动） */
      r.onclick = function () {
        state.theme = (state.theme === th ? '' : th);
        syncChips(); renderAll();
      };
      legBody.appendChild(r);
    });
    var legEl = $('legend'), legOpen = $('legOpen');
    function legSet(h) { legEl.classList.toggle('hidden', h); legOpen.classList.toggle('show', h); }
    $('legTg').onclick = function () { legSet(true); };
    legOpen.onclick = function () { legSet(false); };
  }

  /* ---------- 美食 ---------- */
  var FTYPE_ICON = { "面食": "🍜", "小吃": "🥟", "硬菜": "🍲", "宴席": "🍱", "特产": "🎁", "饮品": "🍶" };
  var FTYPE_COLOR = { "面食": "#C86D4B", "小吃": "#71806C", "硬菜": "#C86D4B", "宴席": "#8C7B66", "特产": "#6D7D88", "饮品": "#71806C" };
  function foodCountInCity(city) { return SITES.filter(function (s) { return s.city === city; }).length; }
  function getFoodFiltered() {
    var q = (FOOD_STATE.q || "").trim().toLowerCase();
    return FOOD.filter(function (d) {
      if (FOOD_STATE.prov && d.province !== FOOD_STATE.prov) return false;
      if (FOOD_STATE.city && d.city !== FOOD_STATE.city) return false;
      if (FOOD_STATE.type && d.type !== FOOD_STATE.type) return false;
      if (q) { var hay = (d.name + d.city + (d.county || "") + (d.province || "") + d.desc + (d.feature || "") + (d.with || "")).toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
  }
  function renderFood() {
    if (!M.foodEnabled) return;
    var list = getFoodFiltered();
    var grid = $('foodGrid');
    $('foodCnt').textContent = '共 ' + list.length + ' 道 · ' + (M.foodLabel || '');
    if (!list.length) { grid.innerHTML = '<div class="empty">没有匹配的美食，换个关键词试试。</div>'; return; }
    grid.innerHTML = '';
    list.forEach(function (d) {
      var ic = FTYPE_ICON[d.type] || "🍽️", col = FTYPE_COLOR[d.type] || "#7D7970";
      var nSites = foodCountInCity(d.city);
      var card = document.createElement('div'); card.className = 'fcard';
      card.innerHTML = '<div class="fh"><span class="fic">' + ic + '</span><span class="ft" style="background:' + col + '">' + d.type + '</span></div>' +
        '<div class="fn">' + d.name + '</div>' +
        '<div class="floc">📍 ' + d.city + (d.county ? (' · ' + d.county) : '') + '</div>' +
        '<div class="fdesc">' + d.desc + '</div>' +
        '<div class="fmore">▾ 特色 / 配着吃</div>' +
        '<div class="fdetail">' + (d.feature ? ('<b>特色：</b>' + d.feature + '<br>') : '') + (d.with ? ('<b>配着吃：</b>' + d.with) : '') + '</div>' +
        '<button class="fgo">🗺️ 同市景点 ' + nSites + ' 处 · 去逛逛</button>';
      card.querySelector('.fmore').onclick = function () {
        var det = card.querySelector('.fdetail'); var open = det.style.display === 'block';
        det.style.display = open ? 'none' : 'block';
        card.querySelector('.fmore').textContent = (open ? '▾' : '▴') + ' 特色 / 配着吃';
      };
      card.querySelector('.fgo').onclick = function () {
        state.q = ""; state.theme = ""; state.city = d.city; state.sort = "";
        $('search').value = "";
        var rg = SITES.find(function (s) { return s.city === d.city; });
        state.region = rg ? rg.region : "";
        $('sortSel').value = "";
        syncChips();
        renderAll(); switchTab('list');
        $('listCnt').textContent = d.city + ' · 景点 ' + nSites + ' 处（来自美食「' + d.name + '」）';
      };
      grid.appendChild(card);
    });
  }
  function buildFoodBar() {
    if (!M.foodEnabled || !FOOD.length) return;
    var provSel = $('foodProv'), citySel = $('foodCity'), typeSel = $('foodType');
    [...new Set(FOOD.map(function (d) { return d.province; }).filter(Boolean))].sort().forEach(function (p) { var o = document.createElement('option'); o.value = p; o.textContent = p; provSel.appendChild(o); });
    [...new Set(FOOD.map(function (d) { return d.type; }))].sort().forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t; typeSel.appendChild(o); });
    /* 省→城市联动：按当前省重建城市下拉 */
    function rebuildCity(keep) {
      var cur = FOOD_STATE.city;
      citySel.innerHTML = '<option value="">全部城市</option>';
      [...new Set(FOOD.filter(function (d) { return !FOOD_STATE.prov || d.province === FOOD_STATE.prov; }).map(function (d) { return d.city; }).filter(Boolean))].sort()
        .forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); });
      FOOD_STATE.city = (keep && cur && [...citySel.options].some(function (o) { return o.value === cur; })) ? cur : '';
      citySel.value = FOOD_STATE.city;
    }
    rebuildCity();
    $('foodSearch').oninput = function (e) { FOOD_STATE.q = e.target.value; renderFood(); };
    provSel.onchange = function (e) {
      FOOD_STATE.prov = e.target.value;
      if (!FOOD_STATE.prov) { FOOD_STATE.city = ''; rebuildCity(); }
      else rebuildCity();
      renderFood();
    };
    citySel.onchange = function (e) {
      FOOD_STATE.city = e.target.value;
      if (FOOD_STATE.city && !FOOD_STATE.prov) {
        /* 选城市自动锁定省份 */
        var d = FOOD.find(function (x) { return x.city === FOOD_STATE.city; });
        if (d && d.province) { FOOD_STATE.prov = d.province; provSel.value = d.province; rebuildCity(true); }
      }
      renderFood();
    };
    typeSel.onchange = function (e) { FOOD_STATE.type = e.target.value; renderFood(); };
  }

  /* ---------- 启动 ---------- */
  function init() {
    M = window.TOPIC_META;
    SITES = window.SITES || [];
    FOOD = window.FOOD || [];
    try { trip = JSON.parse(localStorage.getItem(M.tripKey) || '[]'); } catch (e) { trip = []; }
    // 排序下拉
    var sortSel = $('sortSel');
    sortSel.innerHTML = '<option value="">默认</option><option value="me">距我</option>';
    for (var k in M.REF) sortSel.appendChild((function (k) { var o = document.createElement('option'); o.value = k; o.textContent = '距' + k; return o; })(k));
    // 标题（由 topic.html 启动器设置，此处不再重复）
    // 地图
    initMap();
    // 交互绑定
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });
    $('locBtn').onclick = function () { if (userLatLng) { map.setView(gxy(userLatLng[0], userLatLng[1]), Math.max(map.getZoom(), 12)); if (userMarker) userMarker.openPopup(); } else locate(true); };
    $('search').oninput = function (e) { state.q = e.target.value; renderAll(); };
    (function () { var m = location.search.match(/[?&]q=([^&]+)/); if (m) { var q = decodeURIComponent(m[1]); var s = $('search'); if (s) { s.value = q; state.q = q; renderAll(); } } })();
    $('sortSel').onchange = function (e) { state.sort = e.target.value; renderAll(); };
    $('pickHint').onclick = function () { pickMode = false; hidePickHint(); };
    $('tripClear').onclick = function () { trip = []; saveTrip(); renderTripBar(); refreshSheet(); };
    $('tripSort').onclick = sortTripNN;
    $('tripGo').onclick = openArrive;
    $('arVoice').onclick = function () { closeArrive(); if (trip.length) window.TravelNotes.openPanel(trip[0]); else showTripToast('先加入地点'); };
    $('arGo').onclick = function () { closeArrive(); navAmap(); };
    $('tripFab').onclick = function () { $('tripBar').classList.toggle('open'); };
    $('tripClose').onclick = function () { $('tripBar').classList.remove('open'); };
    // 数据
    attachIndex();
    // 首屏视野：按全省数据边界自适应（避免默认中心只看到省会周边）
    try {
      var _b = L.latLngBounds([]);
      SITES.forEach(function (s) { if (s.lat != null && s.lng != null && !isNaN(+s.lat) && !isNaN(+s.lng)) { var _p = pt(s); _b.extend(_p); } });
      if (_b.isValid()) map.fitBounds(_b, { padding: [46, 70], maxZoom: 7 });
    } catch (e) {}
    window.TravelNotes.init({ map: map, getSite: function (i) { return SITES[i]; } });
    // chips / 图例
    buildChips();
    // 美食
    buildFoodBar();
    // 路线：聚合省份专题路线到全国页（M.routesFrom: {sc:'川',...}）
    if (M.routesFrom && window.TOPIC_REGISTRY) {
      var _merged = [];
      Object.keys(M.routesFrom).forEach(function (pid) {
        var sub = window.TOPIC_REGISTRY[pid];
        if (!sub || !sub.routes || !sub.routes.length) return;
        var tag = M.routesFrom[pid];
        sub.routes.forEach(function (rt) {
          _merged.push({
            name: tag + ' · ' + rt.name,
            color: rt.color, desc: rt.desc,
            days: rt.days
          });
        });
      });
      if (_merged.length) M.routes = M.routes.concat(_merged);
    }
    // 路线
    renderRoutes();
    var routeSel = $('routeSel');
    M.routes.forEach(function (rt, ri) { var o = document.createElement('option'); o.value = ri; o.textContent = '🧭 ' + rt.name; routeSel.appendChild(o); });
    routeSel.onchange = function () {
      var ri = +routeSel.value;
      if (!isFinite(ri) || ri < 0) return;
      switchTab('route');
      setTimeout(function () {
        var els = document.querySelectorAll('#routes .route');
        var el = els[ri];
        if (el) { els.forEach(function (e) { e.classList.remove('flash'); }); el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { el.classList.remove('flash'); }, 2600); }
      }, 120);
    };
    // 渲染
    renderTripBar();
    renderFood();
    renderAll();
    autoLocate();
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  window.TopicEngine = {
    init: init,
    toggleTrip: toggleTrip,
    flyToSite: flyToSite,
    closeSheet: closeSheet,
    openSheet: openSheet
  };
})();
