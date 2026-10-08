/* ============================================================
   topic-common.js — 省份专题页通用引擎（topic.html 专用）
   数据驱动：window.TOPIC_META 提供省份配置，window.SITES / window.FOOD 提供数据
   由 topic.html 的启动器加载数据文件后调用 window.TopicEngine.init()
   省份新增流程：sc-data.js(+sc-food.js) + 注册表一条 + 入口卡片，无需复制页面
   ============================================================ */
(function () {
  var M = null;              // TOPIC_META（init 时读取）
  var R = null;              // TOPIC_ROUTES（routesKey 时读取）
  var SITES = [], FOOD = [];
  var restorePos = null;
  var map, markerLayer, useGCJ = true, lastMarkerList = null, lastRouteRi = null;
  var markers = new Map();
  var routeLayer = null, curSite = null, tripRouteLayer = null;
  var routeDayLines = [];   /* 批次18：showRouteOnMap 按天建的线，左列悬停时按索引加粗 */
  var userLatLng = null, userMarker = null, watchId = null, pickMode = false;
  var trip = [], routeOrders = {};
  var nearLayer = null, nearP = null, nearBar = null;
  var state = { q: "", region: "", theme: "", city: "", elev: "", sort: "" };
  var FOOD_STATE = { q: "", prov: "", city: "", type: "" };

  var esc = (window.UI && UI.esc) ? UI.esc : function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  function $(id) { return document.getElementById(id); }

  /* ---------- 坐标 / 距离 ---------- */
  function haversine(a, b) { return window.Geo.havA(a, b); }
  function havKm(aLat, aLng, bLat, bLng) { return window.Geo.hav(aLat, aLng, bLat, bLng); }
  function refPoint() { if (state.sort === "me" && userLatLng) return userLatLng; if (state.sort && M.REF && M.REF[state.sort]) return M.REF[state.sort]; return null; }
  function _tlat(lng, lat) { return window.Geo._tlat(lng, lat); }
  function _tlng(lng, lat) { return window.Geo._tlng(lng, lat); }
  function gcj02Of(lat, lng) { return window.Geo.gcj02Of(lat, lng); }
  function pt(s) { if (s && s.gcj) return [+s.lat, +s.lng]; return useGCJ ? gcj02Of(s.lat, s.lng) : [s.lat, s.lng]; }
  function gxy(lat, lng) { return useGCJ ? gcj02Of(lat, lng) : [lat, lng]; }
  function normTheme(t) { return (window.THEME_ALIAS && window.THEME_ALIAS[t]) || t; }
  /* tk 统一返回归一后主题：筛选/配色/图例/计数/图标/isMajorSite 全部在此收口 */
  function tk(s) { return normTheme(s[M.themeKey || 'theme']); }
  function colorOf(s) { return M.themes[tk(s)] || "#7D7970"; }

  /* ---------- 筛选 ---------- */
  function getFilterFn() {
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
    /* 瓦片容错：高德连续失败 ≥5 片才降级 OSM（个别瓦片失败/限流不切换，避免地图风格突变） */
    var amapFail = 0;
    amapStreet.on('tileerror', function () { amapFail++; if (amapFail >= 5 && !map.hasLayer(osmLayer)) { try { amapStreet.remove(); } catch (e) {} osmLayer.addTo(map); } });
    amapStreet.on('tileload', function () { amapFail = 0; });
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
    /* 全图层失败时的用户提示（自动降级逻辑保留在上方 amapStreet.on('tileerror')） */
    if (window.UI) {
      [osmLayer, satLayer, topoLayer, amapStreet, amapSat, amapLabel].forEach(function (l) {
        UI.tileWarn(l, '地图');
      });
    }
    var layMenu = $('layMenu');
    /* 图层选择记忆：用户切到卫星/OSM 等后保存，下次打开保持（全专题共用） */
    var savedLayer = 'amapStreet';
    try { savedLayer = localStorage.getItem('tn_layer') || 'amapStreet'; } catch (e) {}
    var initialLayer = null;
    BASE_LAYERS.forEach(function (b) {
      var isOn = b.id === savedLayer;
      if (isOn) initialLayer = b;
      var li = document.createElement('div'); li.className = 'li' + (isOn ? ' on' : ''); li.dataset.id = b.id;
      li.innerHTML = '<span class="sw" style="background:' + b.sw + '"></span>' + b.name + '<span class="ck" style="display:' + (isOn ? '' : 'none') + '">' + TI('check', 11) + '</span>';
      li.onclick = function () {
        BASE_LAYERS.forEach(function (x) { if (map.hasLayer(x.layer)) map.removeLayer(x.layer); });
        b.layer.addTo(map);
        layMenu.querySelectorAll('.li').forEach(function (x) { var on = x.dataset.id === b.id; x.classList.toggle('on', on); x.querySelector('.ck').style.display = on ? '' : 'none'; });
        var isGCJ = (b.id === 'amapStreet' || b.id === 'amapSat' || b.id === 'amapSatL');
        if (isGCJ !== useGCJ) { useGCJ = isGCJ; if (lastMarkerList) renderMarkers(lastMarkerList); if (lastRouteRi != null) showRouteOnMap(lastRouteRi); if (userLatLng && userMarker) userMarker.setLatLng(gxy(userLatLng[0], userLatLng[1])); }
        try { localStorage.setItem('tn_layer', b.id); } catch (e) {}
      };
      layMenu.appendChild(li);
    });
    /* 应用记忆图层 */
    if (initialLayer && initialLayer.layer !== amapStreet) {
      try { map.removeLayer(amapStreet); } catch (e) {}
      initialLayer.layer.addTo(map);
      useGCJ = (initialLayer.id === 'amapStreet' || initialLayer.id === 'amapSat' || initialLayer.id === 'amapSatL');
    }
    $('layBtn').onclick = function (e) { e.stopPropagation(); layMenu.classList.toggle('show'); };
    $('zoomIn').onclick = function () { zoomUsable(1); };
    $('zoomOut').onclick = function () { zoomUsable(-1); };
    map.on('click', function () { layMenu.classList.remove('show'); });
    map.on('movestart', function () { layMenu.classList.remove('show'); });
    map.on('click', function (e) {
      var _t = e.originalEvent && e.originalEvent.target;
      if (_t && _t.closest && _t.closest('.leaflet-marker-icon')) return;
      if (pickMode) { pickMode = false; hidePickHint(); locateSuccess({ coords: { latitude: e.latlng.lat, longitude: e.latlng.lng } }); return; }
      /* 批次 21：全国页维持「点图即查附近」；其它专题页改由「这一带」chip 触发（nearMode 一次性），
         没 armed 时行为与改前完全一致（落到 spotRec），免得省页误点就弹半径条 */
      if (nearMode || M.nearEnabled) { nearMode = false; syncChips(); nearPick(e.latlng); return; }
      spotRec(e.latlng.lat, e.latlng.lng);
    });
    /* LOD 分级：平移 / 缩放时按当前视野与级别重渲染（仅全国页） */
    if (M.lodEnabled) {
      map.on('moveend', function () {
      if (lastMarkerList) renderMarkers(lastMarkerList);
      /* 记住上次位置（防抖 500ms，2026-08-15） */
      clearTimeout(map._savePosT);
      map._savePosT = setTimeout(function () {
        try {
          var c = map.getCenter();
          localStorage.setItem('tn_mappos_' + (M.key || 't'), JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom(), ts: Date.now() }));
        } catch (e) {}
      }, 500);
    });
      map.on('zoomend', function () { if (lastMarkerList) renderMarkers(lastMarkerList); });
      }
    /* 区域统计：全专题生效（规范 §32） */
    map.on('moveend', scheduleRegionStats);
    map.on('zoomend', scheduleRegionStats);
    /* 避让重排：平移/缩放后重测屏幕占位（node-lod 重渲染是异步的，延迟一拍）。
       以前标签避让只挂在渲染回调上，而那次回调可能跑在节点入场动画的第一帧里
       （见 refitAvoid 的注释），量到的是 0.6 倍矩形，动画结束后没人补测 →
       首屏留下「两个名称叠在一起」的残态，同一份代码两次拍屏结果还不一样。 */
    map.on('moveend zoomend', function () { clearTimeout(capsuleAvoid._t); capsuleAvoid._t = setTimeout(refitAvoid, 170); });
    /* 节点入场动画收尾再补测一次：减动效档（.01ms）与正常档（--motion-enter）都走这条路 */
    document.addEventListener('animationend', function (e) {
      if (!e.animationName || e.animationName.indexOf('node-fade-in') !== 0) return;
      clearTimeout(refitAvoid._t); refitAvoid._t = setTimeout(refitAvoid, 120);
    });
    /* 空白区域提示 */
    map.on('moveend', scheduleEmptyHint);
    map.on('zoomend', scheduleEmptyHint);
  }

  /* ---------- 查附近：全国页点图（M.nearEnabled）+ 各页「这一带」chip（批次 21） ---------- */
  var nearHits = [];
  var nearMode = false;      /* chip 武装后的一次性取点标记 */
  var nearSheet = null;      /* 结果面板（内置优先，实时查询另标来源） */
  var nearNodeLayer = null;   /* 圈内未渲染节点的补画层（LOD 重渲染时清理，避免残留拦截点击） */
  function clearNearLayer() { if (nearLayer) { map.removeLayer(nearLayer); nearLayer = null; } if (nearNodeLayer) { map.removeLayer(nearNodeLayer); nearNodeLayer = null; } }
  function hideNearBar() { if (nearBar) nearBar.style.display = 'none'; }
  function hideNearSheet() { if (nearSheet) UI.sheet(nearSheet, { cls: 'open' }).close(); }
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
    hideNearSheet();
    nearLayer = L.layerGroup().addTo(map);
    L.circleMarker([latlng.lat, latlng.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#AE5738', fillOpacity: 1 }).addTo(nearLayer);
    nearP = [latlng.lat, latlng.lng];
    if (!nearBar) {
      nearBar = document.createElement('div');
      nearBar.id = 'nearBar';
      nearBar.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:4px;background:var(--paper-bar);border:1px solid var(--edge-hair-soft);border-radius:999px;box-shadow:var(--shadow-medium);padding:5px 6px;z-index:1200;max-width:calc(100vw - 24px)';
      nearBar.innerHTML = [10, 30, 50, 100].map(function (k) { return '<span class="nk" data-k="' + k + '" style="padding:6px 9px;border-radius:999px;font-size:var(--fs-3);color:var(--color-ink-soft);cursor:pointer;font-family:var(--font-sans);white-space:nowrap">' + k + 'km</span>'; }).join('') +
        '<span id="nearX" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--color-bg-soft);color:var(--color-muted);font-size:var(--fs-2);cursor:pointer;flex-shrink:0">' + TI('close', 12) + '</span>';
      document.getElementById('mapEl').appendChild(nearBar);
      /* 关键：禁止 nearBar 的点击冒泡到地图（否则点半径/关闭按钮会触发地图 click 重新弹回半径条） */
      if (L.DomEvent && L.DomEvent.disableClickPropagation) L.DomEvent.disableClickPropagation(nearBar);
      nearBar.querySelectorAll('.nk').forEach(function (c) {
        c.onclick = function (ev) { if (ev) ev.stopPropagation(); hideNearBar(); nearQuery(nearP[0], nearP[1], +c.dataset.k); };
      });
      nearBar.querySelector('#nearX').onclick = function (ev) { if (ev) ev.stopPropagation(); hideNearBar(); hideNearSheet(); clearNearLayer(); restoreMarkers(); };
    }
    nearBar.style.display = 'flex';
  }
  function nearQuery(lat, lng, km) {
    clearNearLayer();
    nearLayer = L.layerGroup().addTo(map);
    L.circle([lat, lng], { radius: km * 1000, color: '#AE5738', weight: 1.5, dashArray: '4 6', fillColor: '#AE5738', fillOpacity: .06, interactive: false, bubblingMouseEvents: false }).addTo(nearLayer);
    /* §34 的灵魂顺序：内置腿（Nearby.nearbySites，纯本地秒回）先跑；凑不满 BUILTIN_ENOUGH 条
       且 navigator.onLine 不为 false 时，才发一次 Overpass 补位（8s 超时，失败静默）。
       点到的位置若正压在某个景点上，把它当锚点排除——「这一带还有什么」不该把用户已经站着的那处再列一遍。 */
    Nearby.queryNearby(lat, lng, km, null, function (res) {
      highlightNearHits(res.items);
      renderNearSheet(res, km);
    }, anchorNameAt(lat, lng));
  }
  /* 取点 200m 内的第一个内置条目＝锚点本身 */
  function anchorNameAt(lat, lng) {
    var a = Nearby.nearbySites(lat, lng, 0.2);
    return a.length ? a[0].name : null;
  }
  function siteIndexOf(name) {
    for (var i = 0; i < SITES.length; i++) if (SITES[i].name === name) return i;
    return -1;
  }
  function highlightNearHits(items) {
    /* 圈内节点高亮：nearIcon（主题色圆点+光环+放大），
       LOD 聚合下未单独渲染的补画高亮图标（绑定点击，LOD 重渲染时清理） —— 不切列表视图 */
    restoreMarkers();
    if (!nearNodeLayer) nearNodeLayer = L.layerGroup().addTo(map);
    items.forEach(function (h) {
      var i = siteIndexOf(h.name);
      if (i < 0) return;   /* 实时查询补来的 OSM 点不在包内索引里，只进列表，不画高亮 */
      var s = SITES[i];
      nearHits.push(i);
      var m = markers.get(i);
      /* 换图标＝换 DOM：这一支也要补回名字与 Enter，理由同 setActiveNode */
      if (m) {
        m.setIcon(nearIcon(s));
        if (window.UI) { UI.markerLabel(m, siteAria(s)); UI.markerKeys(m, function () { openSheet(i); }); }
      } else {
        var nm = L.marker(pt(s), { icon: nearIcon(s), zIndexOffset: 800 });
        nm.on('click', function () { openSheet(i); });
        nm.addTo(nearNodeLayer);
        if (window.UI) { UI.markerLabel(nm, siteAria(s)); UI.markerKeys(nm, function () { openSheet(i); }); }
      }
    });
  }
  function nearDistText(d) { return d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km'; }
  function ensureNearSheet() {
    if (nearSheet) return nearSheet;
    nearSheet = document.createElement('div');
    nearSheet.id = 'nearSheet';
    nearSheet.className = 'near-sheet';
    nearSheet.setAttribute('role', 'dialog');
    nearSheet.setAttribute('aria-label', '这一带还有什么');
    /* 头部自带 .nx 关闭按钮，别再让 UI.sheet 补一枚（两枚 X 会叠在同一角） */
    nearSheet.setAttribute('data-sheet-x', 'off');
    $('mapEl').appendChild(nearSheet);
    /* 同 nearBar：点击不许冒泡到地图，否则点列表项会重新弹回半径条 */
    if (L.DomEvent && L.DomEvent.disableClickPropagation) L.DomEvent.disableClickPropagation(nearSheet);
    return nearSheet;
  }
  function renderNearSheet(res, km) {
    var sh = ensureNearSheet();
    var items = res.items || [];
    var src = res.live ? ('内置 ' + res.builtin + ' · 实时 ' + res.osm) : ('内置库 · ' + res.builtin + ' 处');
    var head = '<div class="nh"><b>这一带 ' + km + 'km</b><span class="nsrc">' + esc(src) + '</span>' +
      '<button type="button" class="nx" id="nearSheetX" aria-label="关闭这一带结果">' + TI('close', 12) + '</button></div>';
    var body = items.length
      ? '<div class="nl">' + items.map(function (h, i) {
        return '<button type="button" class="ni' + (h.src === '实时查询' ? ' osm' : '') + '" data-n="' + i + '">' +
          '<span class="nn">' + esc(h.label || h.name) +
          (h.flag && h.flag.indexOf('m') >= 0 ? '<i class="nb">必去</i>' : '') + '</span>' +
          '<span class="nsub">' + esc([h.city, h.theme].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="nd">' + esc(nearDistText(h.d)) + '</span></button>';
      }).join('') + '</div>'
      : '<div class="nl"><div class="nz">这一带内置库里没有记录' + (res.offline ? '，离线也补不了实时查询' : '，实时查询这次也没返回') + '</div></div>';
    /* 来源口径必须写进 DOM（§34 文案锚 + smoke N 族都读它） */
    var foot = '<div class="nf">' + (res.live ? esc(Nearby.LIVE_NOTE) : '来源：包内景点库，离线可用') + '</div>';
    sh.innerHTML = head + body + foot;
    UI.sheet(sh, { cls: 'open' }).open();
    raiseCenterClear(sh);
    $('nearSheetX').onclick = function (ev) { if (ev) ev.stopPropagation(); hideNearSheet(); };
    sh.querySelectorAll('.ni').forEach(function (b) {
      b.onclick = function (ev) { if (ev) ev.stopPropagation(); nearPickItem(items[+b.getAttribute('data-n')]); };
    });
  }
  /* 面板开在地图下半部：用户点在屏幕下 1/3 时，圆心与刚画的圈会被整块盖住（商用软件不会这样）。
     只做纵向平移把取点抬到面板上沿之上，不新增聚焦入口（§31 的 flyToUsable 计数因此不变），
     也不改 USABLE_BANDS（面板是结果列表不是常驻浮层，进带名单会让 fitBounds 留白二次内缩）。 */
  function raiseCenterClear(sh) {
    if (!nearP || !sh.getBoundingClientRect) return;
    var p = map.latLngToContainerPoint(L.latLng(nearP[0], nearP[1]));
    var cr = sh.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect();
    var want = (cr.top - mr.top) - 40;   /* 40 = 进场动画 translateY 的余量 + 一点呼吸 */
    /* panBy 的符号是「视口往哪走」，不是「内容往哪走」：实测 panBy([0,-120]) 会让同一个点的
       容器 y 从 430 变 550（点被推下去）。要把点抬上来，位移取 p.y - want（正数）。 */
    if (p.y > want) map.panBy([0, p.y - want], { animate: false });
  }
  function nearPickItem(h) {
    if (!h) return;
    var i = siteIndexOf(h.name);
    if (i >= 0) {
      /* 半径条与这一带面板的层级都在 #locSheet(50) 之上（1200/1210），不收起就会浮在景点卡上 */
      hideNearBar(); hideNearSheet();
      flyToSite(i); openSheet(i); return;
    }
    /* 实时查询的点：落一个临时标记 + 弹层，别让它点了没反应 */
    if (!nearLayer) nearLayer = L.layerGroup().addTo(map);
    var mk = L.circleMarker(gxy(h.lat, h.lng), { radius: 7, color: '#AE5738', weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(nearLayer);
    mk.bindPopup('<b style="font-size:var(--fs-5)">' + esc(h.label) + '</b>' +
      '<div class="pm">' + esc(h.theme) + ' · ' + esc(nearDistText(h.d)) + '</div>' +
      '<div class="pm pa">' + esc(Nearby.LIVE_NOTE) + '</div>', { maxWidth: 240, className: 'trippop', autoPan: true });
    flyToUsable(gxy(h.lat, h.lng), Math.max(map.getZoom(), 14));
    mk.openPopup();
  }

  /* ---------- 随手记 ---------- */
  function spotRec(lat, lng) {
    var m = L.marker([lat, lng], { icon: L.divIcon({ html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))">' + TI('mic', 22) + '</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 22] }) }).addTo(map);
    m.bindPopup('<div class="pop"><div class="pscroll"><b>途经点随手记</b><div class="pm">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div><div class="pm pa">在此以 GPS 位置语音记录一段见闻，保存后成为游记节点。</div></div><div class="pfoot"><button class="addtrip tnvo" onclick="window.__tnSpot(' + lat + ',' + lng + ')">' + TI('mic', 13) + '在此语音记录</button></div></div>', { maxWidth: 260, className: 'trippop', autoPan: true }).openPopup();
    m.on('popupclose', function () { if (map.hasLayer(m)) map.removeLayer(m); });
    if (window.UI) { UI.markerLabel(m, '途经点随手记'); UI.markerKeys(m, function () { m.openPopup(); }); }
  }
  window.__tnSpot = function (lat, lng) { window.TravelNotes.openPanel({ label: '途经点', lat: lat, lng: lng }); };
  window.__tnAnywhere = function () {
    var open = function (p) {
      /* 定位成功后：高德逆地理给出地点，多地点供选择（无 Key/失败回退当前位置） */
      __tnPickPlace(p.lat, p.lng, function (pick) { window.TravelNotes.openPanel({ label: pick.label, lat: pick.lat, lng: pick.lng }); }, function () {});
    };
    var tip = function (msg) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(31,122,90,.95);color:#fff;padding:8px 16px;border-radius:999px;font-size:var(--fs-4);z-index:9600;box-shadow:0 2px 12px rgba(0,0,0,.2);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis';
      d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2400);
    };
    var fallback = function () {
      if (userLatLng) { open({ lat: userLatLng[0], lng: userLatLng[1] }); }
      else { if (!$('map').classList.contains('active')) switchTab('map'); tip('无法获取位置：可点「定位」按钮，或直接在地图上点想记录的地点'); }
    };
    try {
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { open({ lat: p.coords.latitude, lng: p.coords.longitude }); }, fallback, { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 });
      else fallback();
    } catch (e) { fallback(); }
  };

  /* ---------- 节点 / Sheet ---------- */
  function isMajorSite(s) { return (M.majorThemes || []).indexOf(tk(s)) >= 0 || (s.flag && s.flag.indexOf('m') >= 0); }
  /* 节点的读屏名（批次 22-C）：地图上的标记是 divIcon，Leaflet 只给了 tabindex/role，
     不给名字，读屏念得出「按钮」念不出「青海湖」。这串就是那缺的一个名字。 */
  function siteAria(s) {
    var bits = [s.label || s.name];
    bits.push(s.city || s.region);
    bits.push(tk(s));
    if (s.flag && s.flag.indexOf('m') >= 0) bits.push('必去');
    if (s.__i === curSite) bits.push('当前正在看');
    return bits.filter(Boolean).join('，');
  }
  /* 实景照映射（tools/fetch-site-images.js 本地镜像优先，tools/gen-site-images.js 远端兜底，图源高德 POI） */
  function imgSrc(s) {
    try {
      var lm = window.SITE_IMAGES_LOCAL || {};
      var u = lm[s.name];
      if (u) return u;
    } catch (e) {}
    try {
      var m = window.SITE_IMAGES || {};
      var r = m[s.id] || m[s.name];
      if (r) return r;
    } catch (e) {}
    return s.img || '';
  }
  /* sheet 图框兜底：加载失败时用品牌占位（首字 + 提示文案），不留空框 */
  window.SITE_IMG_FAIL = function (el) {
    try {
      var box = el.parentNode;
      if (!box || !box.classList.contains('ls-img')) { el.style.display = 'none'; return; }
      box.innerHTML = '<div class="ls-img-ph"><span class="ls-img-ph-ch">' + esc(el.dataset.ch || '景') + '</span><i>暂无实景图</i></div>';
    } catch (e) { try { el.style.display = 'none'; } catch (e2) {} }
  };
  function nodeIcon(s, active, dim) {
    var f = s.flag || '';
    /* 配色收敛（规范 §47）：地图节点不再按主题 38 色着色，统一中性色 + 重点强调 */
    var tint = s.source === 'user' ? '#5F7A4E' : (f.indexOf('m') >= 0 ? '#AE5738' : (f.indexOf('h') >= 0 ? '#E0915C' : '#8C7B66'));
    var inT = inTrip(s.__i);
    var num = inT ? (trip.indexOf(s.__i) + 1) : null;
    var cls = 'tr-node' + (active ? ' tr-active' : '') + (dim ? ' tr-dim' : '') + (isMajorSite(s) ? ' tr-major' : '') +
      (f.indexOf('m') >= 0 ? ' tr-must' : '') + (f.indexOf('h') >= 0 ? ' tr-hot' : '') +
      (s.source === 'user' ? ' tr-user' : '');
    var html = '<div class="' + cls + '"><span class="tr-ring" style="--tint:' + tint + '"></span><span class="tr-dot"></span>';
    if (f.indexOf('m') >= 0) html += '<span class="tr-seal">必</span>';
    if (num) html += '<span class="node-num">' + num + '</span>';
    /* 半透明名称标签（详细层 zoom ≥ 10 显示；筛选降透明时同步淡化） */
    if (map && map.getZoom() >= 10 && s.label) {
      html += '<span class="node-label' + (dim ? ' dim' : '') + '">' + esc(s.label) + '</span>';
    }
    html += '</div>';
    return L.divIcon({ className: '', html: html, iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  /* setIcon 会把标记的 DOM 整个换掉，而 Leaflet 1.1.1 没有 iconchange 事件：重画之后不补回去，
     aria-label 和 Enter 键位跟着旧节点一起消失——点开一趟景点卡回来，全图标记就成了「按不动的
     无名点」（452×995 实测 Esc 之后焦点掉到 body）。批次 22-C：可达名要活得过每一次重画。 */
  function setActiveNode(i) {
    markers.forEach(function (m, idx) {
      if (!SITES[idx]) return;
      m.setIcon(nodeIcon(SITES[idx], idx === i));
      if (window.UI) { UI.markerLabel(m, siteAria(SITES[idx])); UI.markerKeys(m, function () { openSheet(idx); }); }
    });
  }
  /* 避让补测的统一入口。为什么要等两拍 rAF：.tr-node 带入场动画 node-fade-in
     （design.css:940，from 是 scale(.6)），节点创建的同一帧里 getBoundingClientRect
     量到的是动画首帧的盒子（实测标签宽 67px，稳定后 112px），labelAvoid 据此判重叠就漏隐藏。
     两拍之后动画至少推进过一帧；正常档（非减动效）动画更长，由 initMap 里的 animationend 再补一次。 */
  /* ---------- 可用视口（批次13：节点与合集胶囊跑到屏幕外的根因收口） ----------
     #mapEl 的矩形 ≠ 用户看得见的地图：顶部路线横幅、底部「当前区域」统计卡 + tabbar 都盖在
     元素上面（452×995 实测底部死带 155px）。Leaflet 的视野裁剪、fitBounds、缩放锚点全部按
     元素矩形算，于是内容一格一格挪进那条死带——34 页 × 4 档实测 4134 枚标记里 20.2% 越界，
     放大三档后下溢中位 108px（正好是死带深度）。
     只把「成带」的浮层算内缩：横向压满元素 60% 以上是上下带，纵向压满 60% 以上是左右带
     （批次 18 补的横向分支——双栏桌面档要能算出 ins.left/ins.right，此前这两个值结构上恒 0）。
     452 档实测 tabbar 占宽 .947、region-stats .856~.92、routeBanner .326~.62（横幅文字短时确实不成带）。
     .ctl / .laymenu 那种右上角小方块是「点」不是「带」，两个方向都不成带，扣进去等于把整条右边判成死区。
     成带判据与 tools/smoke-usable.js 的 PROBE 逐条同形（±2px 对账就靠这个同形）。 */
  var USABLE_BANDS = ['#routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];
  var MARK_HALF = 16;   /* 最高标记的半高：胶囊 31px / 节点 30px。内容区再让出这一条，半枚被切就不会发生 */
  var lastUsableKey = null;   /* 上一次渲染用的内缩快照，带出现/消失时据此判断要不要重算 LOD */
  function usableInsets() {
    var el = map.getContainer().getBoundingClientRect();
    var size = map.getSize();
    var ins = { top: 0, right: 0, bottom: 0, left: 0 };
    USABLE_BANDS.forEach(function (sel) {
      var n = document.querySelector(sel);
      if (!n) return;
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      var r = n.getBoundingClientRect();
      var ix = Math.max(0, Math.min(r.right, el.right) - Math.max(r.left, el.left));
      var iy = Math.max(0, Math.min(r.bottom, el.bottom) - Math.max(r.top, el.top));
      if (ix < 12 || iy < 12) return;
      if (ix >= el.width * 0.6) {
        if ((r.top + r.bottom) / 2 < el.top + el.height / 2) ins.top = Math.max(ins.top, r.bottom - el.top);
        else ins.bottom = Math.max(ins.bottom, el.bottom - r.top);
      } else if (iy >= el.height * 0.6) {
        /* 左右带：压在地图某一侧、纵向吃掉大半屏的固定浮层（贴哪一侧的内缩就归哪一侧） */
        if ((r.left + r.right) / 2 > el.left + el.width / 2) ins.right = Math.max(ins.right, el.right - r.left);
        else ins.left = Math.max(ins.left, r.right - el.left);
      }
    });
    /* 任何一条带都不许把可用区吃到只剩 40px（横屏 / 极矮视口下的保险） */
    ins.top = Math.max(0, Math.min(ins.top, size.y - 40));
    ins.bottom = Math.max(0, Math.min(ins.bottom, size.y - 40));
    ins.left = Math.max(0, Math.min(ins.left, size.x - 40));
    ins.right = Math.max(0, Math.min(ins.right, size.x - 40));
    return ins;
  }
  function contentInsets() {
    var i = usableInsets();
    return { top: i.top + MARK_HALF, right: i.right + MARK_HALF, bottom: i.bottom + MARK_HALF, left: i.left + MARK_HALF };
  }
  function usableRectPx() {
    var s = map.getSize(), i = usableInsets();
    return { l: i.left, t: i.top, r: s.x - i.right, b: s.y - i.bottom };
  }
  /* LOD 的裁剪矩形：被不透明浮层压住的那一条里不该再画胶囊 */
  function contentBounds() {
    var s = map.getSize(), i = contentInsets();
    return L.latLngBounds(
      map.containerPointToLatLng(L.point(i.left, i.top)),
      map.containerPointToLatLng(L.point(s.x - i.right, s.y - i.bottom)));
  }
  /* Leaflet 的真实选项是 paddingTopLeft / paddingBottomRight（没有 paddingTL），
     fitBounds 与 flyToBounds 都经 _getBoundsCenterZoom 按 (BR−TL)/2 重定心，所以不对称内缩两处同样有效 */
  function fitUsable(bounds, opts) {
    var i = contentInsets();
    var o = { paddingTopLeft: [i.left, i.top], paddingBottomRight: [i.right, i.bottom] };
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    map.fitBounds(bounds, o);
  }
  /* 缩放锚点：zoomIn/zoomOut 绕元素中心缩放，而元素中心比可用区中心低 53px，
     每按一次 + 就把整幅地图往底部死带里推进 53px。改成绕内容区中心（setZoomAround 保持该点的屏幕位置不动） */
  function zoomUsable(delta) {
    var z = map.getZoom();
    var nz = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z + delta));
    var s = map.getSize(), i = contentInsets();
    var p = L.point((s.x + i.left - i.right) / 2, (s.y + i.top - i.bottom) / 2);
    try { map.setZoomAround(map.containerPointToLatLng(p), nz); }
    catch (e) { if (delta > 0) map.zoomIn(); else map.zoomOut(); }
  }
  function contentCenterPx() {
    var s = map.getSize(), i = contentInsets();
    return L.point((s.x + i.left - i.right) / 2, (s.y + i.top - i.bottom) / 2);
  }
  /* 点聚焦的单点：把「那个点」落到内容中心，而不是元素中心。
     批次 13 收口时登记过一条残留——flyToSite / 定位我的位置仍然直接 flyTo，元素比可用区低
     53px，被聚焦的站点就停在可见区偏下那一截里；批次 18 双栏档把左右内缩也算进内容中心，
     聚焦路径一律走这里，不再各处自己算偏移。 */
  function flyToUsable(latlng, zoom, opts) {
    var s = map.getSize();
    var want = map.project(latlng, zoom).add(L.point(s.x / 2, s.y / 2).subtract(contentCenterPx()));
    var at = map.unproject(want, zoom);
    if (opts && opts.instant) { map.setView(at, zoom); return; }
    map.flyTo(at, zoom, { duration: (opts && opts.duration) || .5 });
  }
  /* 聚合胶囊聚焦：region 层给的是固定缩放，要让「那个中心」落到内容中心而不是元素中心 */
  function focusUsable(t) {
    var i = contentInsets();
    if (t.center) { flyToUsable(t.center, t.zoom); return; }
    map.flyToBounds(t.bounds, { paddingTopLeft: [i.left, i.top], paddingBottomRight: [i.right, i.bottom], maxZoom: t.maxZoom, duration: .5 });
  }
  /* 边缘内收：实测胶囊最宽 203px（半宽 102），贴边放就把半枚推出屏幕。
     溢出多少收多少（≤半盒），只挪视觉盒，地理锚点不动；比"藏掉边缘内容"便宜 */
  function clampCapsules() {
    var el = map.getContainer().getBoundingClientRect();
    var u = usableRectPx();
    var lim = { l: el.left + u.l, t: el.top + u.t, r: el.left + u.r, b: el.top + u.b };
    lastUsableKey = JSON.stringify(usableInsets());
    [].forEach.call(document.querySelectorAll('#mapEl .lod-cl'), function (n) {
      /* 锚点取容器（divIcon 是 0×0，其左上就是投影点）：胶囊自己的 transform 带 160ms 过渡，
         量胶囊盒会读到位移中间态，多轮内收后残留 1.9~4.7px 偏移（smoke-usable 的 U5/U12 因此时红时绿）。
         宽高用 offsetWidth/Height——布局盒，不吃 transform。 */
      var cont = n.parentNode;
      if (!cont || !cont.getBoundingClientRect) return;
      var c = cont.getBoundingClientRect();
      var ax = c.left + c.width / 2, ay = c.top + c.height / 2;
      var w = n.offsetWidth, h = n.offsetHeight;
      var dx = 0, dy = 0;
      if (w < lim.r - lim.l) dx = Math.min(Math.max(ax, lim.l + w / 2), lim.r - w / 2) - ax;
      if (h < lim.b - lim.t) dy = Math.min(Math.max(ay, lim.t + h / 2), lim.b - h / 2) - ay;
      n.style.setProperty('--lod-dx', Math.round(dx) + 'px');
      n.style.setProperty('--lod-dy', Math.round(dy) + 'px');
    });
  }

  function refitAvoid() {
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (window.capsuleAvoid) capsuleAvoid('#mapEl');
      if (window.labelAvoid) labelAvoid('#mapEl');
      clampCapsules();   /* mini 化之后盒子变窄，内收量要按新宽度重算一次 */
    }); });
  }
  function renderMarkers(list) {
    lastMarkerList = list;
    /* 标签避让（2026-08-15）：重叠隐藏低优先级 */
    clearTimeout(renderMarkers._av);
    renderMarkers._av = setTimeout(refitAvoid, 120);
    /* LOD 重渲染：清理「查附近」补画节点层（残留高亮 marker 会盖住重画节点并拦截点击） */
    if (nearNodeLayer) { try { nearNodeLayer.clearLayers(); } catch (e) {} }
    /* TRACE v2 统一分层分级（node-lod.js 引擎）：
       region 多 → 区域/省聚合 → 市聚合 → 节点；region 单一 → 市聚合 → 县聚合 → 节点
       数据量小时引擎自动降级为直接节点 */
    /* 筛选双态（规范 §11）：主题/区域/城市等筛选时渲染全量，非匹配节点降透明而非删除 */
    var fn = getFilterFn();
    var hasFilter = !!(state.theme || state.region || state.city || state.flag || state.elev);
    NodeLOD.init({
      map: map, layer: markerLayer,
      list: function () { return hasFilter ? SITES : list; },
      pt: pt,
      icon: function (s) { return nodeIcon(s, s.__i === curSite, hasFilter && !fn(s)); },
      colorOf: colorOf,
      onNode: function (s) { openSheet(s.__i); },
      majorOf: isMajorSite,
      labelOf: siteAria,
      onRendered: function () { clampCapsules(); clearTimeout(window.__cavT); window.__cavT = setTimeout(refitAvoid, 80); },
      vb: contentBounds,
      focus: focusUsable,
      regionOf: function (s) { return s.region; },
      cityOf: function (s) { return s.city; },
      countyOf: function (s) { return s.county; },
      detailZoom: 9,
      filterActive: hasFilter,
      isMatch: fn,
      onClear: function () { markers.clear(); },
      onMarker: function (m, s) { markers.set(s.__i, m); }
    });
  }
  function buildSheet(i) {
    var s = SITES[i]; if (!s) return '';
    var inT = inTrip(i);
    var img = '<div class="ls-img" id="lsImgBox">' + (imgSrc(s)
    ? '<img loading="lazy" decoding="async" src="' + imgSrc(s) + '" alt="' + esc(s.label) + '" data-ch="' + esc((s.label || '景').charAt(0)) + '" onerror="window.SITE_IMG_FAIL&&SITE_IMG_FAIL(this)">'
    : '<div class="ls-img-ph"><span class="ls-img-ph-ch">' + esc((s.label || '景').charAt(0)) + '</span><i>实景照加载中…</i></div>') + '</div>';
    return '<div class="ls-place">' + esc(s.label) + '</div>' +
      '<div class="ls-loc"><span class="ls-thdot" style="background:' + colorOf(s) + '"></span>' + esc(tk(s)) + ' · ' + locParts(s).join(' · ') + '</div>' +
      (s.elev ? '<div class="ls-elev">' + elevSvg(s) + '</div>' : '') +
      '<div class="ls-weather" id="lsWeather" style="display:none;font-size:var(--fs-3);color:var(--color-muted);margin-bottom:8px"></div>' +
      img +
      '<div class="ls-desc">' + esc(s.desc) + '</div>' +
      (function(){ try { var _mn = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list().filter(function(n){ return n.lat != null && Math.abs(n.lat - s.lat) < 0.02 && Math.abs(n.lng - s.lng) < 0.02; }) : []; if (_mn.length) return '<div class="ls-mine" onclick="location.href=\'travel-map.html\'">我在 ' + _mn.length + ' 篇记录 · 查看足迹地图</div>'; return ''; } catch(e){ return ''; } })() +
      '<div class="ls-hist" id="lsTicket" style="display:none"></div>' + (s.best ? '<div class="ls-hist"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5H20.5M8 3v4M16 3v4"/></svg><span>最佳季节 · ' + esc(s.best) + '</span></div>' : '') +      '<div class="ls-actions">' +
            '<button class="btn-primary" aria-label="听讲解" style="min-height:46px;font-size:var(--fs-4);padding:0 14px;display:inline-flex;align-items:center;gap:6px" onclick="window.TravelNotes.explain(' + i + ')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10 V14 M8 7 V17 M12 4 V20 M16 7 V17 M20 10 V14"/></svg>听讲解</button>' +
      '<button class="btn-secondary" aria-label="语音记录" style="min-height:46px;font-size:var(--fs-4);padding:0 12px;display:inline-flex;align-items:center;gap:6px" onclick="window.TravelNotes.openPanel(' + i + ')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 v3"/></svg>语音记录</button>' +
      '<span class="ls-morebtn" aria-label="更多操作" onclick="window.TopicEngine.toggleMore(this)">更多 <b style="font-size:var(--fs-1)">▾</b></span>' +
      '</div>' +
      '<div class="ls-more" id="lsMore">' +
      '<span onclick="window.TopicEngine.toggleTrip(' + i + ')">' + (inT ? TI('check', 12) + ' 已加入行程' : TI('plus', 12) + ' 加入行程') + '</span>' +
      '<span onclick="window.TopicEngine.flyToSite(' + i + ',true)">在地图查看</span>' +
      '<span class="ls-wish' + (window.Wish && Wish.isWished(s) ? ' done' : '') + '" onclick="window.TopicEngine.toggleWish(' + i + ')">' + (window.Wish && Wish.isWished(s) ? TI('check', 12) + ' 已想去' : TI('plus', 12) + ' 想去') + '</span>' +
      '<span onclick="window.TopicEngine.customItinerary()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>定制路书</span>' +
      '<span onclick="window.TopicEngine.closeSheet()">收起</span></div>';
  }
  /* ---------- 海拔标尺（SVG 迷你地形可视化，纯本地） ---------- */
  var ELEV_MAX = 8848; /* 珠峰 */
  function elevSvg(s) {
    var e = Math.max(0, Math.min(+s.elev || 0, ELEV_MAX));
    /* viewBox 自适应：SVG 设为 width:100%（CSS）+ viewBox 0 0 300 92，等比缩放，右侧文字不会挤出 */
    var W = 300, H = 92, padL = 10, padR = 60, top = 6, bot = H - 14;
    var band = bot - top;
    function yOf(m) { return bot - (Math.min(Math.max(m, 0), ELEV_MAX) / ELEV_MAX) * band; }
    var refs = [[0, '海平面'], [1000, '1000m'], [2000, '2000m'], [3000, '3000m'], [4500, '雪线'], [6000, '6000m'], [8848, '珠峰']];
    var g = '';
    refs.forEach(function (r) {
      var y = yOf(r[0]).toFixed(1);
      g += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="var(--color-line)" stroke-width="1" stroke-dasharray="2 4"/>' +
        '<text x="' + (W - padR + 6) + '" y="' + (yOf(r[0]) + 3) + '" font-size="9" fill="var(--color-muted)" font-family="var(--font-sans)">' + r[1] + '</text>';
    });
    var ey = yOf(e);
    var zone = e >= 4500 ? '<div class="elev-zone" style="color:var(--cinnabar-500)">' + TI('warn', 12) + '高海拔 · 注意高原反应</div>'
      : (e >= 2500 ? '<div class="elev-zone" style="color:var(--gold-700)">海拔不低 · 适量活动</div>' : '<div class="elev-zone" style="color:var(--color-muted)">低海拔 · 舒适</div>');
    g += '<line x1="' + padL + '" y1="' + ey.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ey.toFixed(1) + '" stroke="var(--color-primary)" stroke-width="2"/>' +
      '<circle cx="' + padL + '" cy="' + ey.toFixed(1) + '" r="4" fill="var(--color-primary)" stroke="#fff" stroke-width="1.5"/>' +
      '<text x="' + (W - padR + 6) + '" y="' + (ey + 3) + '" font-size="10" font-weight="700" fill="var(--color-primary)" font-family="var(--font-sans)">' + Math.round(e) + 'm</text>';
    return '<div class="elev-head">海拔 ' + Math.round(e) + ' 米</div>' +
      '<div class="elev-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" fill="none">' +
      '<line x1="' + padL + '" y1="' + top + '" x2="' + padL + '" y2="' + bot + '" stroke="var(--color-line-strong)" stroke-width="2"/>' + g + '</svg></div>' + zone;
  }
  /* ---------- 全国页按省懒加载详情（审核修复批次 2） ---------- */
  var PROV_FILE = {
    '北京':'bj-data.js','天津':'tj-data.js','河北':'he-data.js','山西':'data.js','内蒙古':'nmg-data.js',
    '辽宁':'ln-data.js','吉林':'jl-data.js','黑龙江':'hlj-data.js','上海':'sh-data.js','江苏':'js-data.js',
    '浙江':'zj-data.js','安徽':'ah-data.js','福建':'fj-data.js','江西':'jx-data.js','山东':'sd-data.js',
    '河南':'ha-data.js','湖北':'hb-data.js','湖南':'hn-data.js','广东':'gd-data.js','广西':'gxyn-data.js',
    '海南':'hi-data.js','重庆':'cq-data.js','四川':'sc-data.js','贵州':'gz-data.js','云南':'gxyn-data.js',
    '西藏':'xz-data.js','陕西':'sx-data.js','甘肃':'gs-data.js','青海':'qh-data.js','宁夏':'nx-data.js',
    '新疆':'xj-data.js','香港':'hk-data.js','澳门':'mo-data.js','台湾':'tw-data.js'
  };
  var provLoaded = {};
  function loadProvince(file, cb) {
    if (provLoaded[file]) { cb(); return; }
    provLoaded[file] = 1; /* loading 中 */
    var base = window.SITES.slice(); /* 快照（加载前全局，防省文件覆盖） */
    var s2 = document.createElement('script');
    s2.src = file;
    s2.onload = function () {
      var prov = window.SITES || [];
      window.SITES = base; /* 恢复全局（省文件会覆盖 window.SITES） */
      prov.forEach(function (x) {
        if (!x.desc) return;
        for (var i = 0; i < SITES.length; i++) {
          if (SITES[i].name === x.name && !SITES[i].desc) {
            SITES[i].desc = x.desc; SITES[i].best = x.best; SITES[i].img = x.img;
            SITES[i].dy = x.dy; SITES[i].ty = x.ty;
            if (x.elev) SITES[i].elev = x.elev;
          }
        }
      });
      cb();
    };
    s2.onerror = function () { provLoaded[file] = 2; cb(); };
    document.head.appendChild(s2);
  }
  /* ---------- 节点天气（Open-Meteo，免 Key，30 分钟缓存） ---------- */
  var WMO = { 0: '晴', 1: '多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻雨', 57: '冻雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴冰雹', 99: '雷暴冰雹' };
  function weatherIcon(code) { var c = +code; if (c === 0) return TI('sun', 14); if (c <= 3) return TI('cloudsun', 14); if (c <= 48) return TI('cloud', 14); if (c <= 67) return TI('rain', 14); if (c <= 77) return TI('snow', 14); if (c <= 86) return TI('rain', 14); return TI('bolt', 14); }
  /* 实景照四级获取：本地镜像(SITE_IMAGES_LOCAL) → 远端映射(SITE_IMAGES) → localStorage 7天缓存 → 高德实时拉取；全落空返回 null 由调用方画占位 */
  function loadSitePhoto(s, cb) {
    if (!s) { cb && cb(null); return; }
    var u = imgSrc(s);
    if (u && u.indexOf('http') !== 0) { cb && cb(u); return; }
    if (u && u.indexOf('http') === 0 && u.indexOf('autonavi') >= 0) { cb && cb(u); return; }
    try {
      var c = JSON.parse(localStorage.getItem('tn_photo_' + s.name) || 'null');
      if (c && c.u && Date.now() - c.ts < 7 * 24 * 3600 * 1000) { cb && cb(c.u); return; }
    } catch (e) {}
    var key = '';
    try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb && cb(null); return; }
    fetch('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(key) +
      '&keywords=' + encodeURIComponent(s.name) +
      '&city=' + encodeURIComponent(s.city || '') +
      '&offset=1&page=1&extensions=all')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var ph = '';
        try { if (d && d.status === '1' && d.pois && d.pois[0] && d.pois[0].photos && d.pois[0].photos[0]) ph = d.pois[0].photos[0].url; } catch (e) {}
        if (ph) { try { localStorage.setItem('tn_photo_' + s.name, JSON.stringify({ ts: Date.now(), u: ph })); pruneKV('tn_photo_', 200); } catch (e) {} cb && cb(ph); }
        else cb && cb(null);
      })
      .catch(function () { cb && cb(null); });
  }

  /* 带时间戳的缓存按前缀限量（LRU 淘汰最旧），防 localStorage 无界膨胀 */
  function pruneKV(prefix, max) {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(prefix) === 0) keys.push(k); }
      if (keys.length <= max) return;
      var ages = keys.map(function (k) { var t = 0; try { t = (JSON.parse(localStorage.getItem(k)) || {}).ts || 0; } catch (e) {} return [k, t]; });
      ages.sort(function (a, b) { return a[1] - b[1]; });
      ages.slice(0, ages.length - max).forEach(function (x) { localStorage.removeItem(x[0]); });
    } catch (e) {}
  }

  function loadWeather(lat, lng, cb) {
    try {
      var key = 'tn_weather_' + lat.toFixed(2) + '_' + lng.toFixed(2);
      var c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.ts < 30 * 60 * 1000) { cb && cb(c.d); return; }
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current_weather=true&timezone=auto')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var w = d && d.current_weather;
          if (!w) { cb && cb(null); return; }
          var out = { code: w.weathercode, temp: Math.round(w.temperature), wind: Math.round(w.windspeed) };
          try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), d: out })); pruneKV('tn_weather_', 150); } catch (e) {}
          cb && cb(out);
        }).catch(function () { cb && cb(null); });
    } catch (e) { cb && cb(null); }
  }

  function ensureDetail(s, cb) {
    if (!s || s.desc || !window.SITES_LAZY) { if (cb) cb(); return; }
    var k = PROV_FILE[s.region];
    if (!k || provLoaded[k] === 2) { if (cb) cb(); return; }
    loadProvince(k, cb);
  }
  /* 票价/营业时间（site-tickets.js 三级：种子 → 30 天缓存 → 高德 v5） */
  function loadTicket(s) {
    if (!s || !s.label || !window.SiteTickets) return;
    SiteTickets.get(s, function (t) {
      var el = document.getElementById('lsTicket');
      if (!el) { return; }
      if (!t || (!t.h && !t.p)) { el.style.display = 'none'; return; }
      var parts = [];
      if (t.h) parts.push(TI('clock', 13) + '<span>' + esc(t.h) + '</span>');
      if (t.p) parts.push(TI('ticket', 13) + '<span>' + esc(t.p) + '</span>');
      if (!parts.length) { el.style.display = 'none'; return; }
      var note = t.u ? '更新于 ' + esc(t.u) + (t.src === 'amap' ? '（高德实时）' : '')
        : (t.src === 'seed' ? '人工收录，未标核验时间' : '来自高德，未标核验时间');
      el.innerHTML = parts.map(function (x) { return '<div style="display:flex;align-items:flex-start;gap:6px">' + x + '</div>'; }).join('<span style="display:block;height:4px"></span>') + '<div style="opacity:.55;font-size:var(--fs-1);margin-top:3px">' + note + '</div>';
      el.style.display = 'block';
    });
  }
  /* 底部详情卡会把它正在讲的这一站盖在下面：只挪「被盖住的那一截」，够露出来就停手（同 raiseCenterClear 的口径）。
     旧写法是 map.panBy([0,-160])，符号反了——panBy 的负值把这个点往屏幕「下」推，正好推进卡片里；
     它一直没露馅，是因为 duration 写成 420 而 Leaflet 的单位是「秒」（七分半＝等于没动）。 */
  var sheetRaised = 0;
  function locSheetClear() {
    sheetRaised = 0;
    if (!map || curSite == null || !$('locSheet').classList.contains('show')) return;
    var s = SITES[curSite];
    if (!s || s.lat == null || s.lng == null) return;
    var cr = $('locSheet').getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect(), band = cr.top - mr.top;
    if (band < 120) return;   /* 卡片快占满屏：上面没地方看，挪了白挪 */
    var p = map.latLngToContainerPoint(pt(s)), want = band - 24, dy = p.y - want;
    /* 不足 1px 就不发这次瞬移：map.panBy([0, 0]) 照样派发 moveend（travel-map 那边被它自激出过 1253 帧爆栈） */
    if (dy >= 1) { sheetRaised = Math.round(dy); map.panBy([0, sheetRaised], { animate: false }); }
  }
  function openSheet(i) {
    curSite = i;
    /* 最近浏览记录（2026-08-15）：最近 8 个，搜索页展示 */
    try {
      var _s = SITES[i];
      if (_s && _s.label) {
        var rec = JSON.parse(localStorage.getItem('tn_recent') || '[]');
        rec = rec.filter(function (x) { return x.n !== _s.label; });
        rec.unshift({ n: _s.label, k: M.key || 'nation', ts: Date.now() });
        localStorage.setItem('tn_recent', JSON.stringify(rec.slice(0, 8)));
      }
    } catch (e) {}
    $('lsBody').innerHTML = buildSheet(i);
    /* 弹层统一走 UI.sheet：role=dialog + 名字跟着这一站 + Esc 关闭 + 焦点归还点开的标记 */
    UI.sheet($('locSheet')).open((SITES[i] && (SITES[i].label || SITES[i].name) || '景点') + ' 详情');
    setActiveNode(i);
    /* 全国页：按省懒加载详情后刷新面板 */
    var _s0 = SITES[i];
    if (_s0 && window.SITES_LAZY && !_s0.desc) {
      ensureDetail(_s0, function () { refreshSheet(); });
    }
    /* 节点天气 */
    if (_s0 && _s0.lat != null) {
      loadWeather(+_s0.lat, +_s0.lng, function (w) {
        var el = document.getElementById('lsWeather');
        if (!el) return;
        if (!w) { el.style.display = 'none'; return; }
        el.innerHTML = weatherIcon(w.code) + ' ' + (WMO[w.code] || '未知') + ' · ' + w.temp + '°C · 风 ' + w.wind + 'km/h';
        el.style.display = 'block';
      });
    }
    /* 票价/营业时间 */
    if (_s0) loadTicket(_s0);
    /* 实景照按需拉取（静态映射未命中时） */
    if (_s0) {
      loadSitePhoto(_s0, function (u) {
        var box = document.getElementById('lsImgBox');
        if (!box) return;
        if (!u) {
          var ph = box.querySelector('.ls-img-ph i');
          if (ph && ph.textContent === '实景照加载中…') ph.textContent = '暂无实景图';
          return;
        }
        var img = box.querySelector('img');
        if (!img) {
          box.innerHTML = '<img loading="lazy" decoding="async" src="' + u + '" alt="' + esc(_s0.label) + '" data-ch="' + esc((_s0.label || '景').charAt(0)) + '" style="width:100%;height:100%;object-fit:cover" onerror="window.SITE_IMG_FAIL&&SITE_IMG_FAIL(this)">';
        } else if (img.getAttribute('src') !== u) {
          img.src = u;
          img.onerror = function () { window.SITE_IMG_FAIL && SITE_IMG_FAIL(img); };
        }
      });
    }
    document.querySelector('.tabbar').classList.add('is-hidden');
    highlightCard(i);
    /* 节点 → 图例/标签联动：闪烁提示该节点所属主题（不改动筛选状态） */
    var _s = SITES[i];
    if (_s) {
      var _th = tk(_s);
      document.querySelectorAll('#legBody .lg').forEach(function (el) {
        var hit = el.dataset.th === _th;
        el.classList.toggle('flash', hit);
        if (hit) { el.scrollIntoView({ behavior: UI.scrollBehavior(), block: 'nearest' }); }
      });
      document.querySelectorAll('#dynChips .chip').forEach(function (c) {
        var f = c.dataset.f || '';
        if (f && (f === _th || f.indexOf(_th) >= 0)) {
          c.classList.add('flash');
          setTimeout(function () { c.classList.remove('flash'); }, 1400);
        }
      });
      setTimeout(function () {
        document.querySelectorAll('#legBody .lg.flash').forEach(function (el) { el.classList.remove('flash'); });
      }, 1400);
    }
    setTimeout(locSheetClear, 80);
  }
  function closeSheet() {
    UI.sheet($('locSheet')).close();
    document.querySelector('.tabbar').classList.remove('is-hidden');
    curSite = null; setActiveNode(-1);
    /* 开卡时挪了多少，关卡就原样还多少（animate:false：带 duration 的平移会被同帧的其他视图动画吞掉） */
    if (map && sheetRaised) map.panBy([0, -sheetRaised], { animate: false });
    sheetRaised = 0;
  }
  function refreshSheet() { if (curSite != null && $('locSheet').classList.contains('show')) { $('lsBody').innerHTML = buildSheet(curSite); loadTicket(SITES[curSite]); } }
  function drawTripRoute() {
    if (tripRouteLayer) { tripRouteLayer.remove(); tripRouteLayer = null; }
    if (trip.length < 2) return;
    var pts = trip.map(function (i) { return pt(tripSite(i)); });
    tripRouteLayer = L.polyline(pts, { color: '#AE5738', weight: 3, opacity: .7, dashArray: '6 6' }).addTo(map);
  }
  /* 行程项解析：-1 = 我的位置（临时途经点） */
  function tripSite(i) {
    if (i === -1) return { name: '我的位置', label: '我的位置', lat: userLatLng ? userLatLng[0] : 0, lng: userLatLng ? userLatLng[1] : 0, region: '', city: '', theme: '' };
    return SITES[i];
  }
  function addTripPos() {
    if (!userLatLng) { showTripToast('先定位，才能加入我的位置'); return; }
    if (trip.indexOf(-1) >= 0) { showTripToast('我的位置已在行程中'); return; }
    trip.push(-1); saveTrip(); renderTripBar(); drawTripRoute();
    showTripToast('已加入行程 · 我的位置');
  }
  function showTripToast(msg) {
    if (window.UI && UI.toast) { UI.toast(msg); return; }
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
  function toggleWish(i) {
    var s = SITES[i]; if (!s) return;
    var on = window.Wish ? Wish.toggle(s) : false;
    showTripToast(on ? '已加入想去清单' : '已从想去清单移除');
    refreshSheet();
  }

  function renderTripBar() {
    var bar = $('tripBar');
    $('tripCnt').textContent = trip.length;
    var row = $('tripRow'); row.innerHTML = '';
    trip.forEach(function (i, n) {
      var s = tripSite(i); if (!s) return;
      var c = document.createElement('div'); c.className = 'chip';
      c.innerHTML = '<span class="no">' + (n + 1) + '</span><span class="nm" style="cursor:pointer">' + s.label + '</span><span class="mv" data-d="up">▲</span><span class="mv" data-d="dn">▼</span><span class="x">' + TI('close', 12) + '</span>';
      c.querySelector('.nm').onclick = function () { if (i === -1) { flyToUsable(gxy(userLatLng[0], userLatLng[1]), Math.max(map.getZoom(), 12), { duration: .6 }); } else flyToSite(i); };
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
    if (!userLatLng) { showTripToast('先点「定位」，才能按距离排序'); return; }
    var rest = trip.slice(), out = [], cur = userLatLng;
    while (rest.length) {
      var bi = 0, bd = 1e12;
      rest.forEach(function (i, k) { var s = tripSite(i); var d = (s.lat - cur[0]) ** 2 + (s.lng - cur[1]) ** 2; if (d < bd) { bd = d; bi = k; } });
      var pick = rest.splice(bi, 1)[0]; out.push(pick); cur = [tripSite(pick).lat, tripSite(pick).lng];
    }
    trip = out; saveTrip(); renderTripBar(); drawTripRoute();
    showTripToast('我帮你重新排了一下顺序');
  }
  function navAmap() {
    if (trip.length === 0) return;
    var pts = trip.map(function (i) { var s = tripSite(i); var g = gcj02Of(s.lat, s.lng); return { lng: g[1], lat: g[0], name: s.label }; });
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
    var s = tripSite(trip[0]);
    $('arPlace').textContent = s ? esc(s.label) : '—';
    $('arSub').textContent = trip.length + ' 站 · ' + (s ? (s.region || '') : '');
    UI.sheet($('arriveDlg'), { label: '到了这一带，想留下些什么', modal: true }).open();
  }
  function closeArrive() { UI.sheet($('arriveDlg')).close(); }
  function flyToSite(i, fromSheet) {
    var s = SITES[i]; if (!s) return;
    /* 先切 tab 再聚焦：#map 不是当前视图时容器 display:none，getSize() 量到 0×0，
       内容中心就成了垃圾偏移（改前 map.flyTo 不吃容器尺寸，所以这条从没暴露）。
       80ms 是 switchTab 里那次 invalidateSize(60ms) 之后。 */
    switchTab('map');
    setTimeout(function () { flyToUsable(pt(s), Math.max(map.getZoom(), 12), { duration: .6 }); }, 80);
    if (fromSheet) { UI.sheet($('locSheet')).close(); document.querySelector('.tabbar').classList.remove('is-hidden'); curSite = i; setActiveNode(i); }
    else { openSheet(i); }
  }

  /* ---------- 列表 ---------- */
  /* 行政地名去重：单省专题省略省名；市/县同名只保留一个（北京·北京·东城 → 北京·东城） */
  function locParts(s) {
    var single = (M.regionShort && Object.keys(M.regionShort).length === 1) ? Object.keys(M.regionShort)[0] : '';
    var parts = [];
    if (s.region && !(single && s.region === single)) parts.push(s.region);
    if (s.city && s.city !== s.region && !(single && s.city === single)) parts.push(s.city);
    if (s.county && s.county !== s.city && s.county !== s.region) parts.push(s.county);
    if (!parts.length && s.region) parts.push(s.region);
    return parts.map(esc);
  }
  var SVG_CAL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5H20.5M8 3v4M16 3v4"/></svg>';
  var SVG_PIN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-10.4A6.5 6.5 0 0 1 18.5 10.6C18.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/></svg>';
  var SVG_ALERT = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21.5 20H2.5Z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>';
  var SVG_CHEV = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  function makeCard(s) {
    var rp = refPoint();
    var c = colorOf(s);
    var theme = tk(s);
    var card = document.createElement('div');
    card.className = 'card'; card.dataset.i = s.__i;
    var src = imgSrc(s);
    var badges = (s.flag && s.flag.indexOf('m') >= 0 ? '<span class="bdg bdg-m">必去</span>' : '') +
      (s.flag && s.flag.indexOf('h') >= 0 ? '<span class="bdg bdg-h">网红</span>' : '');
    var chips = '';
    if (s.best) chips += '<span class="cc cc-best">' + SVG_CAL + esc(s.best) + '</span>';
    if (s.elev && +s.elev >= 5000) chips += '<span class="cc cc-high">' + SVG_ALERT + Math.round(+s.elev) + 'm</span>';
    if (rp && s._d != null) chips += '<span class="cc cc-km">' + SVG_PIN + s._d.toFixed(0) + ' km</span>';
    card.innerHTML =
      '<div class="ph' + (src ? '' : ' is-ph') + '" style="--tint:' + c + '">' +
      (src ? '<img loading="lazy" src="' + src + '" alt="' + esc(s.label) + '" onerror="this.parentNode.classList.add(\'is-ph\');this.style.display=\'none\'">' : '') +
      '<span class="ph-ch">' + esc((s.label || '景').charAt(0)) + '</span></div>' +
      '<div class="body"><div class="nm">' + esc(s.label) + badges + '</div>' +
      '<div class="meta"><span class="mt-seg"><i class="mt-dot" style="background:' + c + '"></i>' + esc(theme) + '</span><span class="mt-seg">' + locParts(s).join(' · ') + '</span>' + (s.elev ? '<span class="mt-seg">海拔 ' + Math.round(+s.elev) + 'm</span>' : '') + '</div>' +
      (s.desc ? '<div class="ds">' + esc(s.desc) + '</div>' : '') +
      (chips ? '<div class="cchips">' + chips + '</div>' : '') + '</div>' +
      '<div class="arr">' + SVG_CHEV + '</div>';
    card.onclick = function () { flyToSite(s.__i); };
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
        var short = (M.regionShort || {})[prov] || prov;
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
    if (el) { el.classList.add('hl'); el.scrollIntoView({ block: 'center', behavior: UI.scrollBehavior() }); return; }
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
    (M.themeOrder || []).forEach(function (th) {
      var items = list.filter(function (s) { return tk(s) === th; }); if (!items.length) return;
      var sec = document.createElement('div'); sec.className = 'tl-era'; sec.dataset.th = th;
      var head = document.createElement('div'); head.className = 'tl-head';
      head.innerHTML = '<span class="d" style="background:' + M.themes[th] + '"></span><h3>' + th + '</h3><span class="cnt">' + items.length + ' 处</span><span class="tl-arr">▾</span>';
      var body = document.createElement('div'); body.className = 'tl-body';
      items.forEach(function (s) {
        var row = document.createElement('div'); row.className = 'tl-row';
        var elev = s.elev ? ('· ' + s.elev + 'm') : '';
        var rs = s.region; for (var k in (M.regionShort || {})) { rs = rs.replace(k, M.regionShort[k]); }
        row.innerHTML = '<div class="t">' + esc(rs) + '</div><div><div class="n">' + esc(s.label) + '</div><div class="c">' + s.city + (s.county ? ('·' + s.county) : '') + ' ' + elev + '</div></div>';
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
    return '<div class="dayconn" style="border-left:4px solid ' + c + '">' + TI('link') + '承接 D' + di + ' 终点：<b>' + pl.label + '</b> → <b>' + tf.label + '</b>　约 ' + e.km.toFixed(0) + ' km · 建议预留 ' + fmtDur(e.min) + '（已含在下方导航起点）</div>';
  }
  function renderRoutes() {
    var box = $('routes'); box.innerHTML = '';
    var DAY_COLORS = M.dayColors;
    (M.routes || []).forEach(function (rt, ri) {
      var total = rt.days.reduce(function (n, d) { return n + d.stops.length; }, 0);
      var el = document.createElement('div'); el.className = 'route';
      var keyHtml = rt.days.map(function (d, di) { return '<span class="dayKey"><span class="dk" style="background:' + DAY_COLORS[di % DAY_COLORS.length] + '"></span>D' + (di + 1) + ' ' + (d.title.split(' · ')[1] || d.title) + '</span>'; }).join('');
      var daysHtml = '';
      rt.days.forEach(function (d, di) {
        var c = DAY_COLORS[di % DAY_COLORS.length];
        var cb = (window.UI && UI.badge) ? UI.badge(c) : c; /* P0-4：白字徽章底压深到 ≥4.6:1，原始色仍用于圆点/连线 */
        var names = dayNames(ri, di);
        var stopsHtml = names.map(function (nm) {
          var s = resolveStop(nm);
          return s ? '<div class="stop" data-site="' + s.__i + '"><div class="num" style="background:' + cb + '">' + (names.indexOf(nm) + 1) + '</div><div class="si"><div class="sn">' + s.label + '</div><div class="sd">' + [s.theme, s.region + (s.county || ''), s.elev ? ('海拔' + s.elev + 'm') : ''].filter(Boolean).join(' · ') + '</div></div></div>'
            : '<div class="stop"><div class="num" style="background:' + cb + '">' + (names.indexOf(nm) + 1) + '</div><div class="si"><div class="sn">' + nm + '</div><div class="sd">（未收录）</div></div></div>';
        }).join('');
        var connHtml = dayConnectHtml(ri, di, c);
        daysHtml += '<div class="day" data-day="' + ri + ':' + di + '">' + connHtml + '<div class="dayh" style="border-left:5px solid ' + c + '"><span class="dnt" style="background:' + cb + '">D' + (di + 1) + '</span><b>' + d.title + '</b></div><div class="daytip">' + TI('info', 12) + ' ' + d.tip + '</div>' + stopsHtml +
          '<div class="dayacts"><button class="dbtn" data-sort="' + ri + ':' + di + '">↻ 按距离排序</button><button class="dbtn send" data-send="' + ri + ':' + di + '">'+ TI('car') + '发高德导航</button></div></div>';
      });
      el.innerHTML = '<div class="rh" style="border-left-color:' + rt.color + '"><span class="rh-dot" style="background:' + rt.color + '"></span><h3>' + rt.name + '</h3><p>⏱ ' + rt.days.length + ' 天 ｜ ' + total + ' 站 ｜ ' + rt.desc + '</p><div class="dkey"><span class="dkey-label">每日轨迹色</span>' + keyHtml + '</div></div><div class="stops">' + daysHtml + '</div>' +
        '<div class="acts"><button class="btn" data-show="' + ri + '">' + TI('map') + '在地图查看（按天配色）</button><button class="btn alt" data-route="' + ri + '">' + TI('copy') + '生成路线清单</button></div>';
      box.appendChild(el);
    });
    box.querySelectorAll('[data-show]').forEach(function (b) { b.onclick = function () { showRouteOnMap(+b.dataset.show); }; });
    box.querySelectorAll('[data-route]').forEach(function (b) { b.onclick = function () { buildRouteList(+b.dataset.route); }; });
    box.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { var p = b.dataset.sort.split(':').map(Number); sortRouteDay(p[0], p[1]); }; });
    box.querySelectorAll('[data-send]').forEach(function (b) { b.onclick = function () { var p = b.dataset.send.split(':').map(Number); sendRouteDayAmap(p[0], p[1]); }; });
    /* 批次18 双栏：路线面板在桌面就是左栏，悬停某日让右栏只留那天的线；点站名走 flyToSite
       （内部已是 flyToUsable，聚焦按内容中心而不是元素中心）。手机档没有悬停指针，不触发。 */
    box.querySelectorAll('.day[data-day]').forEach(function (el) {
      var p = el.dataset.day.split(':').map(Number);
      el.addEventListener('mouseenter', function () { hlRouteDay(p[0], p[1]); });
      el.addEventListener('mouseleave', function () { hlRouteDay(null); });
    });
    box.querySelectorAll('.stop[data-site]').forEach(function (el) {
      el.style.cursor = 'pointer'; el.title = '在地图查看';
      el.addEventListener('click', function () { flyToSite(+el.dataset.site); });
    });
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
  /* 批次18 双栏：左列悬停某条路线的某一日 → 右栏把那天加粗、其余压淡。
     手机档没有悬停指针，这段在手机上永远不触发，不改手机行为。 */
  function hlRouteDay(ri, di) {
    if (!routeDayLines.length) return;
    routeDayLines.forEach(function (ln, k) {
      if (!ln) return;
      var off = ri !== null && !(lastRouteRi === ri && k === di);
      ln.setStyle({ weight: ri === null ? 4 : (off ? 2.5 : 7), opacity: ri === null ? .9 : (off ? .22 : 1) });
    });
  }
  function showRouteOnMap(ri) {
    lastRouteRi = ri;
    var rt = M.routes[ri];
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.layerGroup().addTo(map);
    routeDayLines = [];
    var DAY_COLORS = M.dayColors;
    var all = [];
    rt.days.forEach(function (d, di) {
      var pts = d.stops.map(resolveStop).filter(Boolean).map(function (s) { return pt(s); });
      if (pts.length < 1) { routeDayLines.push(null); return; }   /* 占位：routeDayLines 的下标必须等于天序号 */
      all.push.apply(all, pts);
      var c = DAY_COLORS[di % DAY_COLORS.length];
      var line = L.polyline(pts, { color: c, weight: 4, opacity: .9, dashArray: "1,9", lineCap: "round" }).addTo(routeLayer);
      line.bindPopup('<b style="color:' + c + '">' + d.title + '</b>');
      routeDayLines.push(line);
    });
    var banner = $('routeBanner');
    banner.style.display = 'block'; banner.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>' + esc(rt.name) + '<span style="margin-left:9px">' + TI('close', 13) + '</span>';   /* 不再叠 opacity：12px + .75 透明在暗底上只剩 2.36:1 */
    banner.title = '点击清除路线';
    banner.onclick = clearRoute;
    /* 顺序：横幅先挂上（它是可用区顶带的来源之一，452 档实测占宽 .326~.62），
       再切地图 tab（「当前区域」统计条只在地图 tab 显示），最后才按可用区 fit——
       反过来的话这两条带永远拿不到位置，路线首屏就会把终点胶囊塞进底部死带 */
    switchTab('map');
    if (restorePos && restorePos.zoom) { map.setView([restorePos.lat, restorePos.lng], restorePos.zoom); }
    else if (all.length) fitUsable(all);
    var dl = $('dayLegend');
    dl.innerHTML = '<b>每日轨迹色</b><br>' + rt.days.map(function (d, di) { return '<span class="dl"><span class="dd" style="background:' + DAY_COLORS[di % DAY_COLORS.length] + '"></span>D' + (di + 1) + ' ' + (d.title.split(' · ')[1] || d.title) + '</span>'; }).join('');
    dl.style.display = 'none';
    var dlBtn = $('dayLegendBtn');
    var DL_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4 C16 8 16 16 12 20 C8 16 8 8 12 4 Z"/></svg>';
    dlBtn.innerHTML = DL_ICON + ' 每日色';
    dlBtn.style.display = 'block';
    dlBtn.onclick = function () {
      var open = dl.style.display === 'block';
      dl.style.display = open ? 'none' : 'block';
      dlBtn.innerHTML = open ? DL_ICON + ' 每日色' : DL_ICON + ' 收起每日色';
    };
  }
  function clearRoute() {
    lastRouteRi = null;
    if (routeLayer) map.removeLayer(routeLayer); routeLayer = null;
    routeDayLines = [];
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
    if (window.UI) UI.markerLabel(userMarker, '我的位置');
    userMarker.bindPopup('<div style="text-align:center;min-width:130px"><b style="font-size:var(--fs-5)">' + TI('pin', 13) + '我的位置</b><br><button onclick="window.TopicEngine.addTripPos()" style="margin-top:9px;padding:7px 18px;border:0;border-radius:999px;background:var(--color-primary);color:var(--bg);font-size:var(--fs-4);font-weight:600;cursor:pointer">＋ 加入行程</button></div>').openPopup();
    /* 聚焦标记按 Enter 要能把这张卡再叫出来：库的 Keyboard handler 只管平移/缩放/Esc */
    if (window.UI) UI.markerKeys(userMarker, function () { userMarker.openPopup(); });
    if (!watchId && navigator.geolocation) watchId = navigator.geolocation.watchPosition(function (p) {
      userLatLng = [p.coords.latitude, p.coords.longitude];
      if (userMarker) userMarker.setLatLng(gxy(userLatLng[0], userLatLng[1]));
    }, function () {}, { enableHighAccuracy: true, maximumAge: 10000 });
  }
  /* 离开页面即停持续定位，防后台耗电 */
  window.addEventListener('pagehide', function () {
    try { if (watchId != null && navigator.geolocation) { navigator.geolocation.clearWatch(watchId); watchId = null; } } catch (e) {}
  });
  function showPickHint() { $('pickHint').style.display = 'block'; }
  function hidePickHint() { $('pickHint').style.display = 'none'; }
  function enterPickMode() { pickMode = true; if (!$('map').classList.contains('active')) switchTab('map'); showPickHint(); }
  function locate(manual) {
    if (!navigator.geolocation) { if (manual) enterPickMode(); return; }
    if (manual) $('locBtn').textContent = '⏳'; $('locBtn').className = 'fab loading';
    navigator.geolocation.getCurrentPosition(function (p) {
      locateSuccess(p);
      $('locBtn').className = 'fab ok'; setTimeout(function () { $('locBtn').className = 'fab'; }, 1500); $('locBtn').innerHTML = TI('locate', 18);
      if (manual) { if ($('map').classList.contains('active')) flyToUsable(gxy(userLatLng[0], userLatLng[1]), Math.max(map.getZoom(), 11), { instant: true }); else switchTab('map'); }
    }, function (e) {
      $('locBtn').innerHTML = TI('locate', 18);
      if (manual) enterPickMode();
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
  function autoLocate() {
    if (locateTried) return; locateTried = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(locateSuccess, function () {
      try { if (!localStorage.getItem('tn_loc_hint_done')) { localStorage.setItem('tn_loc_hint_done', '1'); showTripToast('定位未成功：请在系统设置授予「行迹」定位权限'); } } catch (e) {}
    }, { enableHighAccuracy: true, timeout: 8000 });
  }

  /* ================= 区域统计（规范 §32） ================= */
  var statEl = null, statTimer = null;
  function scheduleRegionStats() {
    if (statTimer) clearTimeout(statTimer);
    statTimer = setTimeout(updateRegionStats, 400);
  }
  /* 空白区域提示：放大到没有收录景点的区域时轻提示，避免"节点消失"困惑 */
  var emptyHintEl = null, emptyHintTimer = null;
  function scheduleEmptyHint() {
    if (emptyHintTimer) clearTimeout(emptyHintTimer);
    emptyHintTimer = setTimeout(updateEmptyHint, 450);
  }
  /* 弱网提示：断网时顶部轻提示（瓦片/数据可能加载失败） */
  var netHintEl = null;
  function showNetHint(on) {
    if (!netHintEl) {
      netHintEl = document.createElement('div');
      netHintEl.id = 'netHint';
      netHintEl.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:9400;background:rgba(180,84,58,.92);color:#fff;border-radius:999px;padding:8px 16px;font-size:var(--fs-3);pointer-events:none;opacity:0;transition:opacity var(--motion-normal);white-space:nowrap;max-width:88vw;overflow:hidden;text-overflow:ellipsis';
      document.body.appendChild(netHintEl);
    }
    netHintEl.textContent = on ? '网络已断开 · 地图瓦片可能无法加载' : '';
    netHintEl.style.opacity = on ? '1' : '0';
  }
  window.addEventListener('offline', function () { showNetHint(true); });
  window.addEventListener('online', function () { showNetHint(false); });
  if (navigator.onLine === false) showNetHint(true);
  function updateEmptyHint() {
    if (!map || !SITES.length) return;
    if (!emptyHintEl) {
      emptyHintEl = document.createElement('div');
      emptyHintEl.id = 'emptyHint';
      emptyHintEl.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:9400;background:rgba(32,32,29,.85);color:#fff;border-radius:999px;padding:8px 16px;font-size:var(--fs-3);pointer-events:none;opacity:0;transition:opacity var(--motion-normal);white-space:nowrap;max-width:88vw;overflow:hidden;text-overflow:ellipsis';
      document.body.appendChild(emptyHintEl);
    }
    var b = map.getBounds();
    var n = 0;
    for (var i = 0; i < SITES.length; i++) {
      var s = SITES[i];
      if (s && s.lat != null && !isNaN(+s.lat) && b.contains(pt(s))) { n++; if (n > 5) break; }
    }
    var z = map.getZoom();
    if (n === 0 && z >= 8) {
      emptyHintEl.textContent = '这一带还没有收录的景点，缩小或拖动试试';
      emptyHintEl.style.opacity = '1';
    } else {
      emptyHintEl.style.opacity = '0';
    }
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
    if (!inView.length) { statEl.style.display = 'none'; recheckInsets(); return; }
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
    recheckInsets();
  }
  /* 这张卡自己就是底带的来源：它挂上/收起等于可用区变了。刚 fit 好的内容如果在 400ms
     后被它盖掉一排胶囊，就是用户看到的「点跑到边缘」，所以内缩一变就把 LOD 重算一遍
     （重算会按新的内容区重新裁剪，并重新做边缘内收）。 */
  function recheckInsets() {
    var k = JSON.stringify(usableInsets());
    if (lastUsableKey && lastUsableKey !== k && window.NodeLOD) NodeLOD.refresh();
  }

  /* ---------- 渲染调度 ---------- */
  function renderAll() {
    var list = getFiltered();
    renderMarkers(list);
    renderList(list);
    renderThemes(list);
    $('totalTag').textContent = '· 共 ' + SITES.length + ' 处' + (M.totalTagSuffix || '');
    /* 图例"全部"行计数随节点增删动态更新 */
    var _allCnt = document.querySelector('#legBody .lg[data-th=""] .cnt');
    if (_allCnt) _allCnt.textContent = SITES.length;
  }
  function attachIndex() { SITES.forEach(function (s, i) { s.__i = i; }); }
  function switchTab(tab) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    $(tab).classList.add('active');
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    /* 批次18 双栏：CSS 靠这个属性决定左栏放哪个面板（design.css 的 body.topic-page[data-view=...]） */
    document.body.dataset.view = tab;
    /* 「当前区域」统计条仅地图 tab 显示（2026-08-15） */
    if (statEl) statEl.style.display = (tab === 'map') ? 'flex' : 'none';
    if (tab === 'map') { setTimeout(function () { map.invalidateSize(); }, 60); autoLocate(); scheduleRegionStats(); }
  }

  /* ---------- 筛选 chips ---------- */
  function mkChip(label, on, dot) {
    var c = document.createElement('button'); c.className = 'chip'; c.dataset.f = label;
    if (dot) c.style.setProperty('--dot', dot);
    c.innerHTML = (dot ? '<span class="chip-dot"></span>' : '') + label;
    if (on) c.classList.add('on');
    return c;
  }
  function syncChips() {
    document.querySelectorAll('#dynChips .chip').forEach(function (c) {
      var f = c.dataset.f;
      if (f === '全部') { c.classList.toggle('on', !state.theme && !state.region && !state.city && !state.elev && !state.flag); return; }
      if (f === '必去') { c.classList.toggle('on', state.flag === 'm'); return; }
      if (f === '网红') { c.classList.toggle('on', state.flag === 'h'); return; }
      if (f === '这一带') { c.classList.toggle('on', !!nearMode); return; }
      if ((state.theme && (f === state.theme || f.indexOf(state.theme) >= 0)) || f === state.region || f === state.city) c.classList.add('on');
      else if (f === '低海拔 <3000m' && state.elev === 'low') c.classList.add('on');
      else if (f === '中海拔 3000-4000m' && state.elev === 'mid') c.classList.add('on');
      else if (f === '高海拔 >4000m' && state.elev === 'high') c.classList.add('on');
      else c.classList.remove('on');
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
    c.onclick = function () { state.theme = ''; state.region = ''; state.city = ''; state.flag = ''; syncChips(); renderAll(); };
    dynChips.appendChild(c);
    var mkFlag = function (f, label, dot) {
      var cc = mkChip(label, false, dot);
      cc.onclick = function () { state.flag = (state.flag === f ? '' : f); syncChips(); renderAll(); };
      dynChips.appendChild(cc);
    };
    mkFlag('m', '必去', '#C9A227');
    mkFlag('h', '网红', '#FF7A50');
    /* 批次 21：查附近原先只有全国页能进（点图即弹半径条，topic 专题页一律「记一笔」）。
       这颗 chip 把同一套能力带进所有专题页，放在必去/网红之后＝与既有筛选同框；
       它是「武装一次取点」而不是常驻开关，所以取点完就自动复位，不改变地图的默认点击语义。 */
    if (window.Nearby) {
      var nc = mkChip('这一带', false, '#AE5738');
      nc.id = 'nearChip';
      nc.title = '点地图任选一点，看这一带还有什么（内置库优先，离线可用）';
      nc.onclick = function () {
        if (nearMode) { nearMode = false; syncChips(); showTripToast('已取消「这一带」取点'); return; }
        nearMode = true; syncChips();
        showTripToast('点击地图任意位置作为圆心');
      };
      dynChips.appendChild(nc);
    }
    if (M.themeChips !== false) {
      (M.themeOrder || []).forEach(function (th) {
        var cc = mkChip(th, false, M.themes[th]);
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
    if (M.elevFilter) {
      [['low', '低海拔 <3000m'], ['mid', '中海拔 3000-4000m'], ['high', '高海拔 >4000m']].forEach(function (ev) {
        var cc = mkChip(ev[1], false);
        cc.onclick = function () { state.elev = (state.elev === ev[0] ? '' : ev[0]); syncChips(); renderAll(); };
        dynChips.appendChild(cc);
      });
    }
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
    allRow.innerHTML = '<span class="dot" style="background:linear-gradient(135deg,#AE5738,#3E7CB1,#5F8A6B,#8A5A44)"></span>全部主题<span class="cnt" style="margin-left:auto;font-size:var(--fs-2);color:var(--color-muted);font-family:var(--font-sans)">' + SITES.length + '</span>';
    allRow.onclick = function () { state.theme = ''; syncChips(); renderAll(); };
    legBody.appendChild(allRow);
    (M.themeOrder || []).forEach(function (th) {
      if (!SITES.some(function (s) { return tk(s) === th; })) return;
      var r = document.createElement('div'); r.className = 'lg'; r.dataset.th = th;
      var cnt = SITES.filter(function (s) { return tk(s) === th; }).length;
      r.innerHTML = '<span class="dot" style="background:' + M.themes[th] + '"></span>' + th + '<span class="cnt" style="margin-left:auto;font-size:var(--fs-2);color:var(--color-muted);font-family:var(--font-sans)">' + cnt + '</span>';
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
    /* 图例默认收起：不遮挡地图视野，需要时点「图例」按钮展开 */
    legSet(true);
  }

  /* ---------- 美食 ---------- */
  var FTYPE_ICON = { "面食": "🍜", "小吃": "🥟", "硬菜": "🍲", "宴席": "🍱", "特产": "🎁", "饮品": "🍶" };   /* emoji-ok: 美食类目彩色徽章；lucide 单色描边表达不了"面食/小吃/硬菜/宴席/特产/饮品"的类目差异 */
  var FTYPE_COLOR = { "面食": "#AE5738", "小吃": "#71806C", "硬菜": "#AE5738", "宴席": "#8C7B66", "特产": "#6D7D88", "饮品": "#71806C" };
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
      var ic = FTYPE_ICON[d.type] || "🍽️", col = FTYPE_COLOR[d.type] || "#6A675E";   /* emoji-ok: 同上一行 FTYPE_ICON 的未知类目兜底徽章 */
      var cb = (window.UI && UI.badge) ? UI.badge(col) : col; /* P0-4：.ft 白字 10px，压深到达标 */
      var nSites = foodCountInCity(d.city);
      var card = document.createElement('div'); card.className = 'fcard';
      card.innerHTML = '<div class="fh"><span class="fic">' + ic + '</span><span class="ft" style="background:' + cb + '">' + d.type + '</span></div>' +
        '<div class="fn">' + d.name + '</div>' +
        '<div class="floc">' + TI('pin', 12) + ' ' + d.city + (d.county ? (' · ' + d.county) : '') + '</div>' +
        '<div class="fdesc">' + d.desc + '</div>' +
        '<div class="fmore">▾ 特色 / 配着吃</div>' +
        '<div class="fdetail">' + (d.feature ? ('<b>特色：</b>' + d.feature + '<br>') : '') + (d.with ? ('<b>配着吃：</b>' + d.with) : '') + '</div>' +
        '<button class="fgo">' + TI('map') + '同市景点 ' + nSites + ' 处 · 去逛逛</button>';
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

  /* ---------- 用户节点（node-manager.html 创建，专题/全国地图显示） ---------- */
  var USER_KEY = 'tn_userNodes';
  function loadUserNodes() { try { return JSON.parse(localStorage.getItem(USER_KEY) || '[]'); } catch (e) { return []; } }
  function mergeUserNodes() {
    loadUserNodes().forEach(function (u) {
      /* 与既有景点同名且距离 <~3km 视为重复（用户节点多为高德 GCJ 坐标，与库内坐标有偏移），不再重复上屏 */
      var nm = (u.name || '').trim();
      if (nm && SITES.some(function (s) {
        if ((s.name || s.label || '') !== nm) return false;
        return Math.abs(s.lat - u.lat) < 0.05 && Math.abs(s.lng - u.lng) < 0.05;
      })) return;
      SITES.push({
        id: 'u' + u.id, name: u.name, label: u.name, region: u.province || '其他',
        city: u.city || '', county: '', theme: u.category || '其他', desc: u.desc || '',
        best: '', lat: +u.lat, lng: +u.lng, flag: '', source: 'user', uid: u.id,
        tags: u.tags || [], gcj: !!u.gcj, elev: u.elev || ''
      });
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    M = window.TOPIC_META;
    if (M.routesKey && window.TOPIC_ROUTES) M.routes = window.TOPIC_ROUTES[M.routesKey] || M.routes || [];
    SITES = window.SITES || [];
    mergeUserNodes();
    FOOD = window.FOOD || [];
    try { trip = JSON.parse(localStorage.getItem(M.tripKey) || '[]'); } catch (e) { trip = []; }
    /* 地图记住上次位置（每专题独立，2026-08-15） */
    try {
      var _pos = JSON.parse(localStorage.getItem('tn_mappos_' + (M.key || 't')) || 'null');
      if (_pos && _pos.lat != null && _pos.zoom) restorePos = _pos;
    } catch (e) {}
    // 排序下拉
    var sortSel = $('sortSel');
    sortSel.innerHTML = '<option value="">默认</option><option value="me">距我</option>';
    for (var k in M.REF) sortSel.appendChild((function (k) { var o = document.createElement('option'); o.value = k; o.textContent = '距' + k; return o; })(k));
    // 标题（由 topic.html 启动器设置，此处不再重复）
    // 地图
    initMap();
    // 交互绑定
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });
    $('locBtn').onclick = function () { if (userLatLng) { flyToUsable(gxy(userLatLng[0], userLatLng[1]), Math.max(map.getZoom(), 12), { instant: true }); if (userMarker) userMarker.openPopup(); } else locate(true); };
    $('search').oninput = (function () { var t = null; return function (e) { var v = e.target.value; clearTimeout(t); t = setTimeout(function () { state.q = v; renderAll(); }, 250); }; })();
    (function () { var m = location.search.match(/[?&]q=([^&]+)/); if (m) { var q = decodeURIComponent(m[1]); var s = $('search'); if (s) { s.value = q; state.q = q; renderAll(); } } })();
    $('sortSel').onchange = function (e) { state.sort = e.target.value; renderAll(); };
    $('pickHint').onclick = function () { pickMode = false; hidePickHint(); };
    $('tripClear').onclick = function () {
      if (!trip.length) return;
      var go = function () { trip = []; saveTrip(); renderTripBar(); refreshSheet(); };
      if (window.UI && UI.confirm) UI.confirm({ title: '清空行程', text: '将清空当前加入的 ' + trip.length + ' 个地点。', okText: '清空', danger: true }, function (ok) { if (ok) go(); });
      else go();
    };
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
      if (restorePos && restorePos.zoom) map.setView([restorePos.lat, restorePos.lng], restorePos.zoom);
    else if (_b.isValid()) {
      /* 两遍 fit：「当前区域」统计条原本要等 400ms 计时器才挂上，只 fit 一次等于底部永远
         少让 73px，首屏最下一排胶囊正好压在它下面。先按「没有它」落视野（同一任务内不会
         绘制），立刻把卡补出来，再按真实可用区 fit 第二次——用户只看到最终那一帧。 */
      fitUsable(_b, { maxZoom: 7, animate: false });
      updateRegionStats();
      fitUsable(_b, { maxZoom: 7, animate: false });
    }
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
    (M.routes || []).forEach(function (rt, ri) { var o = document.createElement('option'); o.value = ri; o.textContent = '🧭 ' + rt.name; routeSel.appendChild(o); });   /* emoji-ok: option 文本里渲染不了 SVG 图标 */
    routeSel.onchange = function () {
      var ri = +routeSel.value;
      if (!isFinite(ri) || ri < 0) return;
      switchTab('route');
      setTimeout(function () {
        var els = document.querySelectorAll('#routes .route');
        var el = els[ri];
        if (el) { els.forEach(function (e) { e.classList.remove('flash'); }); el.classList.add('flash'); el.scrollIntoView({ behavior: UI.scrollBehavior(), block: 'start' }); setTimeout(function () { el.classList.remove('flash'); }, UI.motionMs('flash', 2600)); }
      }, 120);
    };
    // 渲染
    renderTripBar();
    renderFood();
    renderAll();
    // 默认展示第一条预设路线（承接老专题页「打开地图即有长征线路」的体验）
    if (M.routes && M.routes.length) showRouteOnMap(0);
    autoLocate();
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function toggleMore(btn) {
    var box = document.getElementById('lsMore');
    if (!box) return;
    var open = box.classList.toggle('open');
    if (btn) btn.innerHTML = open ? '更多 <b style="font-size:var(--fs-1)">▴</b>' : '更多 <b style="font-size:var(--fs-1)">▾</b>';
  }
  window.TopicEngine = { get _map() { return map; },
    init: init,
    /* 闸门侧独立复算可用区要用（tools/smoke-usable.js U2：产品看到内缩 == 页面上真有的带） */
    usableInsets: usableInsets,
    contentInsets: contentInsets,
    usableRectPx: usableRectPx,
    /* 批次18 闸门侧要复算聚焦偏移（flyToUsable 是否真按内容中心而不是元素中心） */
    contentCenterPx: contentCenterPx,
    flyToUsable: flyToUsable,
    /* 左列悬停高亮的可观测出口：返回每日线的当前线宽，null（那天没画线）给 0 */
    dayLineWeights: function () { return routeDayLines.map(function (l) { return l ? l.options.weight : 0; }); },
    toggleTrip: toggleTrip,
    addTripPos: addTripPos,
    toggleMore: toggleMore,
    toggleWish: toggleWish,
    flyToSite: flyToSite,
    closeSheet: closeSheet,
    openSheet: openSheet,
    customItinerary: function () { if (window.Results && Results.itinerary) Results.itinerary(SITES, (M && M.title) || ''); }
  };
})();
