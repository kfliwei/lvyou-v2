/* ============================================================
   node-lod.js — 节点分层分级渲染引擎（LOD）
   ============================================================
   设计依据：
   - 行迹TRACE_设计蓝图_v2.0 §4.2：1200+ 节点分层
     Zoom1 区域 Cluster → Zoom2 省/市 Cluster → Zoom3 景点节点 → Zoom4 详细
   - 行迹_TRACE_首页_地图深度打磨规范_v1.0 §二十四/二十五：
     Cluster = 米白 rgba(247,245,239,.88) + 1px rgba(32,32,29,.14) 细边框 + 轻阴影，
     不是大彩色圆球；放大时节点从 Cluster 自然散开（300~500ms）。

   用法（任一专题页）：
   <script src="node-lod.js"></script>
   window.NodeLOD.init({
     map,                 // Leaflet 地图实例
     layer,               // L.layerGroup() 承载所有 marker
     list: fn,            // () => 当前筛选后的节点数组（每次渲染实时取）
     pt: fn,              // (s) => [lat,lng]  含 GCJ-02 纠偏
     icon: fn,            // (s, active) => L.divIcon  景点节点图标
     colorOf: fn,         // (s) => 主题色
     onNode: fn,          // (s) => 节点点击回调（打开 Sheet）
     majorOf: fn,         // (s) => bool 可选：中缩放优先显示的重要节点
     nameOf: fn,          // (s) => 名称（用于聚合胶囊文案）
     regionOf: fn,        // (s) => 区域/省份字段（默认 s.region || s.province）
     cityOf: fn,          // (s) => 市级字段（默认 s.city）
     countyOf: fn,        // (s) => 县级字段（默认 s.county）
     labelOf: fn,         // (s) => 详细层名称标签（默认 nameOf）
     detailZoom: 11,      // Zoom4 详细层：显示名称小标签的缩放阈值
     pad: [40, 55]        // flyToBounds 边距
   });
   事件由引擎自挂：map.on('moveend zoomend', 防抖渲染)
   外部可调用 NodeLOD.render() 强制刷新（筛选变化后）
   ============================================================ */
(function () {
  'use strict';
  /* 用户 LOD 参数（设置页 tn_lod）：展开速度 / 聚合密度 / 必去优先 */
  var CFG = window.TN_LOD || {};
  var SCALE = CFG.speed === 'fast' ? 0.72 : (CFG.speed === 'slow' ? 1.35 : 1);
  var MAXCAP = CFG.cap === 'dense' ? 20 : (CFG.cap === 'sparse' ? 34 : 26);
  var MAJOR = CFG.major !== false;
  var C = null;             // 当前配置
  var levelCache = null;    // 缓存层级推导结果
  var renderTimer = null;

  /* 行政区名称归一化：全称/简称混用合并为同一分组（如
     "黔东南苗族侗族自治州" ≡ "黔东南州"、"新疆维吾尔自治区" ≡ "新疆"） */
  var ADMIN_NORM = (function () {
    var RE_SUFFIX = /维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区/g;
    var RE_ETHNIC = /苗族侗族|布依族苗族|藏族羌族|土家族苗族|哈尼族彝族|傈僳族|朝鲜族|蒙古族|回族|白族|彝族|傣族|藏族|苗族|侗族/g;
    return function (s) {
      if (!s) return s || '';
      return String(s).replace(RE_SUFFIX, '').replace(RE_ETHNIC, '').replace(/自治州/g, '州');
    };
  })();

  /* ---------- 层级推导（自适应行政粒度） ----------
     返回 [{zMin, zMax, key, label}, ...]，key: 'region'|'city'|'county'|'node'|'detail' */
  function deriveLevels(list) {
    var hasR = {}, hasC = {}, hasCo = {};
    list.forEach(function (s) {
      if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
      var r = ADMIN_NORM(C.regionOf(s)), ci = ADMIN_NORM(C.cityOf(s)), co = ADMIN_NORM(C.countyOf(s));
      if (r) hasR[r] = 1;
      if (ci) hasC[ci] = 1;
      if (co) hasCo[co] = 1;
    });
    var nR = Object.keys(hasR).length;
    var nC = Object.keys(hasC).length;
    var nCo = Object.keys(hasCo).length;

    if (nR > 1) {
      /* 跨省/跨区域页：区域 → 城市 → 县区 → 节点（县区层延伸到 z10.2，点击市胶囊可聚焦看到县区） */
      if (nC > 1) {
        if (nCo > 1 && list.length > 200) {
          return [
            { zMin: 0,   zMax: 5.2 * SCALE, key: 'region', label: '区域' },
            { zMin: 5.2, zMax: 7.2 * SCALE, key: 'city',   label: '城市' },
            { zMin: 7.2, zMax: 10.2 * SCALE, key: 'county', label: '县区' },
            { zMin: 10.2, zMax: Infinity, key: 'node' }
          ];
        }
        return [
          { zMin: 0,   zMax: 5.5 * SCALE, key: 'region', label: '区域' },
          { zMin: 5.5, zMax: 7.2 * SCALE, key: 'city',   label: '城市' },
          { zMin: 7.2, zMax: 10.2 * SCALE, key: 'county', label: '县区' },
          { zMin: 10.2, zMax: Infinity, key: 'node' }
        ];
      }
      return [
        { zMin: 0,   zMax: 5.5 * SCALE, key: 'region', label: '区域' },
        { zMin: 5.5, zMax: 7.8 * SCALE, key: 'county', label: '县区' },
        { zMin: 7.8, zMax: Infinity, key: 'node' }
      ];
    }
    if (nC > 1) {
      /* 省内页：城市 → 县区 → 节点（大省）或 城市 → 节点（小省） */
      if (nCo > 1 && list.length > 150) {
        return [
          { zMin: 0,   zMax: 8.0 * SCALE, key: 'city',   label: '城市' },
          { zMin: 8.0, zMax: 10.2 * SCALE, key: 'county', label: '县区' },
          { zMin: 10.2, zMax: Infinity, key: 'node' }
        ];
      }
      return [
        { zMin: 0,   zMax: 8.2 * SCALE, key: 'city',   label: '城市' },
        { zMin: 8.2, zMax: Infinity, key: 'node' }
      ];
    }
    if (nCo > 1) {
      return [
        { zMin: 0,  zMax: 6.2 * SCALE, key: 'county', label: '县区' },
        { zMin: 6.2, zMax: Infinity, key: 'node' }
      ];
    }
    return [{ zMin: 0, zMax: Infinity, key: 'node' }];
  }

  function levelAt(z, levels) {
    for (var i = 0; i < levels.length; i++) {
      if (z < levels[i].zMax) return levels[i];
    }
    return levels[levels.length - 1];
  }

  /* ---------- 分组聚合（聚合层仅聚合视野内节点，避免超大数据集渲染上千胶囊） ---------- */
  function groupBy(list, key) {
    var b = C.map.getBounds();
    var g = {};
    var parent = {};   /* 每组所在父级集合（city/county 的父级是 region/province），用于聚焦判断 */
    list.forEach(function (s) {
      if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
      var p = C.pt(s);
      if (!b.contains(p)) return;
      var r = ADMIN_NORM(C.regionOf(s) || '');
      var ci = ADMIN_NORM(C.cityOf(s) || '');
      var co = ADMIN_NORM(C.countyOf(s) || '');
      var k, par = r;
      if (key === 'region') { k = r || '其他'; par = ''; }
      else if (key === 'city') { k = ci || (r ? r + '·其他' : '其他'); par = r; }
      else if (key === 'county') { k = co || (ci || '其他'); par = ci; }
      else { k = 'node'; par = ''; }
      (g[k] = g[k] || []).push(s);
      if (par && !parent[k]) parent[k] = par;
    });
    g.__parent = parent;
    return g;
  }

  /* ---------- 规范 Cluster 胶囊（米白 + 细边框 + 轻阴影，非彩色圆球）
     数字徽标固定墨色（--color-ink），不随主题变色，避免"彩色数字+白胶囊"割裂
     dim=true 时降透明：筛选下 0 匹配组 */
  function clusterIcon(label, n, tint, mustN, dim) {
    var html = '<div class="lod-cl' + (dim ? ' lod-dim' : '') + '"><span class="lod-cl__n">' + n + '</span>' +
      '<span class="lod-cl__t">' + label + '</span>' +
      (mustN > 0 ? '<span class="lod-cl__m">必去' + mustN + '</span>' : '') + '</div>';
    return L.divIcon({ className: '', html: html, iconSize: [0, 0], iconAnchor: [0, 0] });
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    if (!C) return;
    var list = C.list ? C.list() : [];
    if (C.onClear) C.onClear();
    if (!list || !list.length) { C.layer.clearLayers(); return; }

    levelCache = levelCache || deriveLevels(list);
    var z = C.map.getZoom();
    var layer = C.layer;
    var lvIdx = 0;
    var lv = levelAt(z, levelCache);
    lvIdx = levelCache.indexOf(lv);

    /* 节点层渲染（独立函数，供聚合过密回退兜底复用）：
       视野裁剪 + 中缩放重要优先（majorOf） */
    function renderNodes() {
      var b = C.map.getBounds();
      var showAll = z >= (C.detailZoom || 11);
      /* 视野内节点稀疏时不做"必去优先"过滤：避免放大后普通节点全部消失 */
      var sparse = false;
      if (!showAll && MAJOR && C.majorOf) {
        var cnt = 0;
        for (var j = 0; j < list.length; j++) {
          var sj = list[j];
          if (!sj || sj.lat == null || sj.lng == null || isNaN(+sj.lat) || isNaN(+sj.lng)) continue;
          if (b.contains(C.pt(sj))) { cnt++; if (cnt > 40) break; }
        }
        sparse = cnt <= 40;
      }
      var i = 0;
      var drawn = {};   /* 已画节点防重（补全循环不再重复渲染） */
      var posUsed = {}; /* 同坐标避让：重复收录的同一景点相邻偏移，避免完全重叠 */
      layer.clearLayers();
      list.forEach(function (s) {
        if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
        var p = C.pt(s);
        if (!b.contains(p)) return;
        if (!showAll && MAJOR && C.majorOf && !C.majorOf(s) && !sparse) return;
        var key = s.__i != null ? s.__i : (s.lat + '|' + s.lng);
        if (drawn[key]) return;
        drawn[key] = 1;
        p = avoidOverlap(p, posUsed, z);
        var m = L.marker(p, { icon: C.icon(s, false) });
        m.on('click', function () { C.onNode && C.onNode(s); });
        layer.addLayer(m);
        if (C.onMarker) C.onMarker(m, s);
        i++;
      });
      /* 视野内节点很少时自动补全重要节点，避免地图空荡（小数据集）；已画节点不再重复 */
      if (i < 3 && C.majorOf) {
        list.forEach(function (s) {
          if (!s || s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng)) return;
          if (i >= 12) return;
          var p = C.pt(s);
          if (!b.contains(p)) return;
          var key = s.__i != null ? s.__i : (s.lat + '|' + s.lng);
          if (drawn[key]) return;
          drawn[key] = 1;
          p = avoidOverlap(p, posUsed, z);
          var m = L.marker(p, { icon: C.icon(s, false) });
          m.on('click', function () { C.onNode && C.onNode(s); });
          layer.addLayer(m);
          if (C.onMarker) C.onMarker(m, s);
          i++;
        });
      }
    }
    /* 同坐标避让：同一坐标第 n 个节点向相邻方向偏移（恒定约 8px，视觉分开可点击） */
    function avoidOverlap(p, posUsed, zoom) {
      var pk = p[0].toFixed(5) + ',' + p[1].toFixed(5);
      var n = posUsed[pk] || 0;
      posUsed[pk] = n + 1;
      if (n === 0) return p;
      var mpp = 156543.03392 * Math.cos(p[0] * Math.PI / 180) / Math.pow(2, zoom); /* 米/像素 */
      var d = 8 * mpp / 111320; /* 8px 对应的纬度差 */
      var ring = Math.ceil(n / 4);
      var dir = n % 4;
      var dd = d * ring;
      var dx = dir === 0 ? dd : (dir === 2 ? -dd : 0);
      var dy = dir === 1 ? dd : (dir === 3 ? -dd : 0);
      return [p[0] + dy, p[1] + dx];
    }

    /* 聚合层：按行政粒度分组 → 胶囊。
       防重叠：聚合组过多时逐级回退到上一级聚合，但仅当**跨多个父级区域**时才回退——
       若视野内 city/county 组都集中在同一 region/city（即用户已聚焦到该行政区），
       即使组数较多也不回退（密集但可点击），保持聚焦层级让用户能看到县级 */
    if (lv.key !== 'node') {
      var maxCap = MAXCAP;
      var gi = lvIdx;
      var groups = groupBy(list, levelCache[gi].key);
      var gKeys = Object.keys(groups).filter(function (k) { return k !== '__parent'; });
      while (gi > 0 && gKeys.length > maxCap) {
        /* 检查是否跨多父级：若所有组 parent 相同（聚焦状态）则不回退 */
        var parents = {};
        gKeys.forEach(function (k) { var p = (groups.__parent || {})[k] || ''; parents[p] = 1; });
        if (Object.keys(parents).length <= 1) break;
        gi--;
        groups = groupBy(list, levelCache[gi].key);
        gKeys = Object.keys(groups).filter(function (k) { return k !== '__parent'; });
      }
      /* 最粗层仍过密且跨多父级 → 兜底节点层（region 层除外：省胶囊最多几十个，是正确展示，不兜底） */
      if (gKeys.length > maxCap && lv.key !== 'region') {
        renderNodes();
        return;
      }
      lv = levelCache[gi];
      layer.clearLayers();
      gKeys.forEach(function (k) {
        var arr = groups[k];
        var s0 = arr[0];
        var bnd = L.latLngBounds(arr.map(C.pt));
        var tint = C.colorOf(s0);
        var lbl = k.replace('市', '');
        var mcnt = arr.filter(function (x) { return x.flag && x.flag.indexOf('m') >= 0; }).length;
        /* 筛选联动：聚合胶囊数字显示匹配数，0 匹配组降透明（规范 §11 双态在聚合层的体现） */
        var matched = (C.filterActive && C.isMatch) ? arr.filter(C.isMatch) : null;
        var n = matched ? matched.length : arr.length;
        var dim = matched ? matched.length === 0 : false;
        var m = L.marker(bnd.getCenter(), { icon: clusterIcon(lbl, n, tint, mcnt, dim), zIndexOffset: -600 });
        m.on('click', function () {
          /* 点击聚合 → 聚焦该行政区。
             region（省）直接 flyTo(中心, 8) 跳过市级直达 county 层，
             因为省 bounds 宽高比在 16:9 屏上 fitBounds 受高度方向限制只能到 z~6，无法聚焦单省；
             city/county 用 flyToBounds 让市/县占满屏 */
          if (lv.key === 'region') {
            C.map.flyTo(bnd.getCenter(), 10, { duration: .5 });
            return;
          }
          var nextLv = (gi < levelCache.length - 1) ? levelCache[gi + 1] : null;
          var mz;
          if (nextLv && nextLv.key !== 'node') {
            mz = nextLv.zMax;
          } else {
            mz = 11.5;
          }
          C.map.flyToBounds(bnd, { padding: C.pad || [24, 40], maxZoom: mz, duration: .5 });
        });
        layer.addLayer(m);
      });
      return;
    }

    renderNodes();
  }

  function schedule() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { levelCache = null; render(); }, 220);
  }

  window.NodeLOD = {
    init: function (cfg) {
      C = cfg;
      /* 默认字段映射：region = 省/区域；city = 市级；county = 县级 */
      C.regionOf = C.regionOf || function (s) { return s.region || s.province; };
      C.cityOf = C.cityOf || function (s) { return s.city; };
      C.countyOf = C.countyOf || function (s) { return s.county; };
      levelCache = null;
      if (C.map && !C.map._lodBound) {
        C.map.on('moveend', schedule);
        C.map.on('zoomend', schedule);
        C.map._lodBound = true;
      }
      window.__nodeLOD = { map: C.map, getLevels: function () { return levelCache ? levelCache.slice() : null; } };
      render();
    },
    render: function () { levelCache = null; render(); },
    refresh: function () { levelCache = null; render(); }
  };
})();
