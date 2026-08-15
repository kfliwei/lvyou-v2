/* 浏览弹层加【高德规划行程】：真实距离矩阵排序 + 直出排期 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. schedule 支持保留顺序（高德排序后不被贪心重排冲掉） */
rep(
  `  function schedule(sel, start, targetDays) { return splitIntoDays(orderStops(sel, start), start, targetDays); }`,
  `  function schedule(sel, start, targetDays, preserveOrder) { return splitIntoDays(preserveOrder ? sel : orderStops(sel, start), start, targetDays); }`,
  '1 schedule preserveOrder'
);

/* 2. 高德距离工具 + 矩阵排序 + plannerAmapPlan（插在 amapRoutePolyline 后） */
rep(
  `  var routeHintShown = false;

  function renderMap() {`,
  `  /* 高德真实驾车距离（米→km，缓存） */
  function amapDriveDist(a, b, cb) {
    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb(null); return; }
    var ck = 'tn_d_' + a.lat.toFixed(3) + ',' + a.lng.toFixed(3) + '_' + b.lat.toFixed(3) + ',' + b.lng.toFixed(3);
    try { var hit = localStorage.getItem(ck); if (hit) { cb(parseFloat(hit)); return; } } catch (e) {}
    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=base&key=*** + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var km = (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) ? (parseFloat(j.route.paths[0].distance) / 1000) : null;
        if (km != null && isFinite(km)) { try { localStorage.setItem(ck, String(km)); } catch (e) {} cb(km); } else cb(null);
      })
      .catch(function () { cb(null); });
  }
  /* 距离矩阵最近邻 + 2-opt（真实距离优先，缺失用直线兜底） */
  function orderByMatrix(sel, start, dist) {
    var N = sel.length;
    function dd(i, j) {
      var k = i < j ? (i + '|' + j) : (j + '|' + i);
      if (dist[k] != null) return dist[k];
      return window.Geo.hav(sel[i].lat, sel[i].lng, sel[j].lat, sel[j].lng);
    }
    var startPt = (start && start.lat != null) ? { lat: start.lat, lng: start.lng } : null;
    var remain = sel.map(function (x, i) { return { s: x, i: i }; });
    var ordered = [], last = null;
    while (remain.length) {
      var bi = 0, best = Infinity;
      for (var k = 0; k < remain.length; k++) {
        var d = last ? dd(last.i, remain[k].i) : (startPt ? window.Geo.hav(startPt.lat, startPt.lng, remain[k].s.lat, remain[k].s.lng) : 0);
        if (d < best) { best = d; bi = k; }
      }
      last = remain[bi]; ordered.push(remain[bi].s); remain.splice(bi, 1);
    }
    /* 2-opt */
    if (N > 3) {
      var improved = true;
      while (improved) {
        improved = false;
        for (var i2 = 0; i2 < N - 1; i2++) {
          for (var k2 = i2 + 1; k2 < N; k2++) {
            var pa = (i2 === 0 && startPt) ? startPt : { lat: ordered[i2 - 1].lat, lng: ordered[i2 - 1].lng };
            var pb = ordered[i2], pc = ordered[k2], pd = (k2 + 1 < N) ? ordered[k2 + 1] : null;
            if (!pa || !pc || !pb || !pd) continue;
            var d1 = window.Geo.hav(pa.lat, pa.lng, pb.lat, pb.lng) + window.Geo.hav(pc.lat, pc.lng, pd.lat, pd.lng);
            var d2 = window.Geo.hav(pa.lat, pa.lng, pc.lat, pc.lng) + window.Geo.hav(pb.lat, pb.lng, pd.lat, pd.lng);
            if (d2 + 0.5 < d1) {
              ordered = ordered.slice(0, i2).concat(ordered.slice(i2, k2 + 1).reverse(), ordered.slice(k2 + 1));
              improved = true;
            }
          }
        }
      }
    }
    return ordered;
  }
  /* 并发拉距离矩阵（节流 6） */
  function fetchDistMatrix(sel, cbAll) {
    var N = sel.length, dist = {}, failed = 0;
    var pairs = [];
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) pairs.push([i, j]);
    if (!pairs.length) { cbAll(dist, 0); return; }
    var idx = 0, active = 0, done = 0, total = pairs.length;
    function next() {
      while (active < 6 && idx < total) {
        var p = pairs[idx++]; active++;
        (function (pi, pj) {
          amapDriveDist(sel[pi], sel[pj], function (km) {
            active--; done++;
            if (km != null) dist[pi < pj ? (pi + '|' + pj) : (pj + '|' + pi)] = km; else failed++;
            if (done >= total) cbAll(dist, failed); else next();
          });
        })(p[0], p[1]);
      }
    }
    next();
  }
  /* 浏览弹层：【高德规划行程】— 真实道路距离排序 + 直出排期 */
  window.plannerAmapPlan = function () {
    if (state.selected.length < 2) { toast('至少选 2 个景点才能规划'); return; }
    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { toast('未配置高德 Key，无法用高德规划行程（设置页可配置）'); return; }
    var btn = null;
    var mk = $id('browseMask');
    if (mk) { btn = mk.querySelector('button[onclick*="plannerAmapPlan"]'); if (btn) { btn.disabled = true; btn.textContent = '规划中…'; } }
    fetchDistMatrix(state.selected, function (dist, failed) {
      if (failed && !Object.keys(dist).length) { toast('高德路线获取失败，已改用本地直线距离排序'); }
      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      state.days = parseInt(($id('intentDays') && $id('intentDays').value) || state.days || 0, 10) || 0;
      state.startDate = $id('intentDate') ? $id('intentDate').value : '';
      state.start = $id('intentStart') && $id('intentStart').value ? (matchStart($id('intentStart').value) || state.start) : state.start;
      var days = schedule(ordered, state.start, state.days, true);
      var name = (state.regions.join('/') || '旅行') + ' ' + days.length + ' 日' + (state.prefs.length ? state.prefs.join('·') : '') + '之旅';
      state.trip = { name: name, createdAt: Date.now(), start: state.start, startDate: state.startDate, aiLevel: getAILevel(), days: days, narrative: null };
      showStage('stageResult'); renderResult();
      if (mk) mk.remove();
      toast(failed && !Object.keys(dist).length ? '已按高德真实道路距离重新规划' : '已按高德真实道路距离重新规划' + (failed ? '（部分路段缺失，已兜底）' : ''));
    });
  };

  var routeHintShown = false;

  function renderMap() {`,
  '2 高德规划行程核心'
);

/* 3. 弹层按钮区加【高德规划行程】 */
rep(
  `      '<button class="btn" style="flex:1" onclick="window.plannerAddCurLoc()">📍 当前位置</button>' +
      '<button class="btn" style="flex:1" onclick="window.plannerClearPicks()">🗑 清空</button></div></div>';`,
  `      '<button class="btn" style="flex:1" onclick="window.plannerAddCurLoc()">📍 当前位置</button>' +
      '<button class="btn" style="flex:1" onclick="window.plannerClearPicks()">🗑 清空</button></div>' +
      '<button class="btn primary" style="width:100%;margin-top:8px" onclick="window.plannerAmapPlan()">🚗 高德规划行程</button></div>';`,
  '3 弹层高德规划按钮'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 100)); }
