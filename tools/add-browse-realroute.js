/* ① 浏览弹层 + ② 重新规划升级(2-opt) + ③ 地图真实高德导航路线 */
const fs = require('fs');

/* ===== planner.html：summbar 加【浏览】按钮 ===== */
let h = fs.readFileSync('planner.html', 'utf8');
const hcrlf = h.includes('\r\n');
if (hcrlf) h = h.replace(/\r\n/g, '\n');
const hFrom = `      <div class="info" id="summInfo"></div>
      <button class="btn primary" id="scheduleBtn">▶ 开始排期</button>`;
const hTo = `      <div class="info" id="summInfo"></div>
      <button class="btn" id="browseBtn" onclick="window.plannerOpenBrowse()">👁 浏览</button>
      <button class="btn primary" id="scheduleBtn">▶ 开始排期</button>`;
if (h.includes(hFrom)) {
  h = h.split(hFrom).join(hTo);
  fs.writeFileSync('planner.html', hcrlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
  console.log('OK  html 浏览按钮');
} else console.log('SKIP html 浏览按钮');

/* ===== planner.js ===== */
let s = fs.readFileSync('planner.js', 'utf8');
const scrlf = s.includes('\r\n');
if (scrlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. 浏览弹层 + 当前位/清空 + 2-opt + 高德真实路线（插在 renderMap 前） */
rep(
  `  function renderMap() {`,
  `  /* ---------- 浏览已选弹层 ---------- */
  window.plannerOpenBrowse = function () {
    var old = $id('browseSheet');
    if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'browseMask';
    m.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(20,16,12,.45);display:flex;align-items:flex-end;justify-content:center';
    var items = state.selected.map(function (s, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--color-line)">' +
        '<span style="min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:var(--color-primary);color:#fff;font-size:11px">' + (i + 1) + '</span>' +
        '<span style="flex:1;font-size:13.5px">' + esc(s.name || s.label) + '<span style="display:block;font-size:11px;color:var(--color-muted)">' + esc(s.city || s.region || '') + (s.__cur ? ' · 当前位置' : '') + '</span></span>' +
        '<button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="window.plannerRemovePick(' + i + ')">删除</button></div>';
    }).join('');
    m.innerHTML = '<div style="width:100%;max-width:430px;max-height:78vh;overflow:auto;background:var(--color-surface,#FBF6EC);border-radius:18px 18px 0 0;padding:16px;box-shadow:0 -8px 30px rgba(0,0,0,.25)">' +
      '<div style="display:flex;align-items:center;margin-bottom:8px"><b style="font-size:15px">已选景点（' + state.selected.length + '）</b><span style="flex:1"></span>' +
      '<button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="document.getElementById(\'browseSheet\')&&document.getElementById(\'browseSheet\').remove();document.getElementById(\'browseMask\')&&document.getElementById(\'browseMask\').remove()">✕ 关闭</button></div>' +
      (items || '<div style="font-size:12px;color:var(--color-muted);padding:20px 0;text-align:center">还没有选景点</div>') +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button class="btn" style="flex:1" onclick="window.plannerAddCurLoc()">📍 当前位置</button>' +
      '<button class="btn" style="flex:1" onclick="window.plannerClearPicks()">🗑 清空</button></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m) { m.remove(); } });
    document.body.appendChild(m);
  };
  window.plannerRemovePick = function (i) {
    if (state.selected[i]) state.selected.splice(i, 1);
    renderCandidates(); renderSumm();
    window.plannerOpenBrowse();
  };
  window.plannerClearPicks = function () {
    state.selected = [];
    renderCandidates(); renderSumm();
    var mk = $id('browseMask'); if (mk) mk.remove();
    toast('已清空');
  };
  window.plannerAddCurLoc = function () {
    var add = function (lat, lng) {
      var dup = state.selected.some(function (x) { return x.__cur; });
      if (dup) { toast('当前位置已在列表中'); return; }
      state.selected.push({ name: '当前位置', label: '当前位置', region: '', city: '', theme: '', flag: '', lat: lat, lng: lng, __cur: true });
      renderCandidates(); renderSumm();
      window.plannerOpenBrowse();
      toast('已加入当前位置');
    };
    if (!navigator.geolocation) { toast('当前环境不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(function (p) { add(p.coords.latitude, p.coords.longitude); },
      function () { toast('定位失败，可在地图收藏点或手动添加'); }, { timeout: 8000 });
  };

  /* ---------- 高德真实导航路线（按段拉取，缓存，失败降级直线） ---------- */
  function amapRoutePolyline(a, b, cb) {
    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb(null); return; }
    var ck = 'tn_rt_' + a.lat.toFixed(3) + ',' + a.lng.toFixed(3) + '_' + b.lat.toFixed(3) + ',' + b.lng.toFixed(3);
    try { var hit = localStorage.getItem(ck); if (hit) { cb(JSON.parse(hit)); return; } } catch (e) {}
    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=all&strategy=0&key=' + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var pts = [];
        if (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) {
          (j.route.paths[0].steps || []).forEach(function (st) {
            if (!st.polyline) return;
            st.polyline.split(';').forEach(function (p) { var c = p.split(','); if (c.length >= 2) pts.push([parseFloat(c[1]), parseFloat(c[0])]); });
          });
        }
        if (pts.length > 1) { try { localStorage.setItem(ck, JSON.stringify(pts)); } catch (e) {} cb(pts); } else cb(null);
      })
      .catch(function () { cb(null); });
  }
  var routeHintShown = false;

  function renderMap() {`,
  '1 浏览弹层+真实路线工具'
);

/* 2. renderMap 逐段：先画虚线占位，异步换真实实线 */
rep(
  `    for (var i = 1; i < seq.length; i++) {
      var a = [seq[i - 1].lat, seq[i - 1].lng], b = [seq[i].lat, seq[i].lng];
      if (a[0] == null || b[0] == null) continue;
      bnd.push(a, b);
      L.polyline([a, b], { color: '#C86D4B', weight: 3, opacity: .8, dashArray: '7 7' }).addTo(mapLayer);
    }`,
  `    var routeReal = 0;
    for (var i = 1; i < seq.length; i++) {
      var a = [seq[i - 1].lat, seq[i - 1].lng], b = [seq[i].lat, seq[i].lng];
      if (a[0] == null || b[0] == null) continue;
      bnd.push(a, b);
      var seg = L.layerGroup().addTo(mapLayer);
      L.polyline([a, b], { color: '#C86D4B', weight: 3, opacity: .8, dashArray: '7 7' }).addTo(seg);
      (function (aa, bb, sg) {
        amapRoutePolyline({ lat: aa[0], lng: aa[1] }, { lat: bb[0], lng: bb[1] }, function (pts) {
          if (pts && pts.length > 1) {
            sg.clearLayers();
            L.polyline(pts, { color: '#C86D4B', weight: 4, opacity: .9 }).addTo(sg);
            routeReal++;
          } else if (!localStorage.getItem('tn_amap_key') && !routeHintShown) {
            routeHintShown = true;
            try { toast('未配置高德 Key，地图显示直线示意；配置后可显示真实导航路线'); } catch (e) {}
          }
        });
      })(a, b, seg);
    }`,
  '2 renderMap 真实路线'
);

/* 3. orderStops 加 2-opt */
rep(
  `      var nx = pts.splice(idx, 1)[0]; ordered.push(nx); cur = nx;
    }
    return ordered;
  }`,
  `      var nx = pts.splice(idx, 1)[0]; ordered.push(nx); cur = nx;
    }
    /* 2-opt 优化：交换线段缩短总里程 */
    var N = ordered.length;
    if (N > 3) {
      var improved = true;
      while (improved) {
        improved = false;
        for (var i2 = 0; i2 < N - 1; i2++) {
          for (var k2 = i2 + 1; k2 < N; k2++) {
            var pa = (i2 === 0 && start && start.lat != null) ? start : ordered[i2 - 1];
            var pb = ordered[i2], pc = ordered[k2], pd = (k2 + 1 < N) ? ordered[k2 + 1] : null;
            if (!pa || !pc || !pb || !pd) continue;
            var d1 = window.Geo.hav(pa.lat, pa.lng, pb.lat, pb.lng) + window.Geo.hav(pc.lat, pc.lng, pd.lat, pd.lng);
            var d2 = window.Geo.hav(pa.lat, pa.lng, pc.lat, pc.lng) + window.Geo.hav(pb.lat, pb.lng, pd.lat, pd.lng);
            if (d2 + 0.5 < d1) {
              var seg2 = ordered.slice(i2, k2 + 1).reverse();
              ordered = ordered.slice(0, i2).concat(seg2, ordered.slice(k2 + 1));
              improved = true;
            }
          }
        }
      }
    }
    return ordered;
  }`,
  '3 orderStops 2-opt'
);

fs.writeFileSync('planner.js', scrlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('planner.js patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
