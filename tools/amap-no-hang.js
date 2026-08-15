/* 高德规划防卡死：fetch 超时 + 矩阵整体超时强制完成 */
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

/* 1. amapDriveDist：fetch 加 8s 超时 */
rep(
  `    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=base&ke' + 'y=' + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var km = (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) ? (parseFloat(j.route.paths[0].distance) / 1000) : null;
        if (km != null && isFinite(km)) { try { localStorage.setItem(ck, String(km)); } catch (e) {} cb(km); } else cb(null);
      })
      .catch(function () { cb(null); });`,
  `    var ctl1 = new AbortController();
    var to1 = setTimeout(function () { ctl1.abort(); }, 8000);
    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=base&ke' + 'y=' + encodeURIComponent(key), { signal: ctl1.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(to1);
        var km = (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) ? (parseFloat(j.route.paths[0].distance) / 1000) : null;
        if (km != null && isFinite(km)) { try { localStorage.setItem(ck, String(km)); } catch (e) {} cb(km); } else cb(null);
      })
      .catch(function () { clearTimeout(to1); cb(null); });`,
  '1 amapDriveDist 超时'
);

/* 2. amapRoutePolyline：fetch 加 8s 超时 */
rep(
  `    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=all&strategy=0&ke' + 'y=' + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var pts = [];`,
  `    var ctl2 = new AbortController();
    var to2 = setTimeout(function () { ctl2.abort(); }, 8000);
    fetch('https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&extensions=all&strategy=0&ke' + 'y=' + encodeURIComponent(key), { signal: ctl2.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(to2);
        var pts = [];`,
  '2 amapRoutePolyline 超时'
);
/* 其 catch 补 clearTimeout */
rep(
  `        if (pts.length > 1) { try { localStorage.setItem(ck, JSON.stringify(pts)); } catch (e) {} cb(pts); } else cb(null);
      })
      .catch(function () { cb(null); });
  }`,
  `        if (pts.length > 1) { try { localStorage.setItem(ck, JSON.stringify(pts)); } catch (e) {} cb(pts); } else cb(null);
      })
      .catch(function () { clearTimeout(to2); cb(null); });
  }`,
  '2b polyline catch 清超时'
);

/* 3. fetchDistMatrix：整体 25s 强制完成 */
rep(
  `    if (!pairs.length) { cbAll(dist, 0); return; }
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
    next();`,
  `    if (!pairs.length) { cbAll(dist, 0); return; }
    var idx = 0, active = 0, done = 0, total = pairs.length, finished = false;
    var hardTo = setTimeout(function () { if (!finished) { finished = true; cbAll(dist, failed + (total - done)); } }, 25000);
    function next() {
      while (active < 6 && idx < total) {
        var p = pairs[idx++]; active++;
        (function (pi, pj) {
          amapDriveDist(sel[pi], sel[pj], function (km) {
            if (finished) return;
            active--; done++;
            if (km != null) dist[pi < pj ? (pi + '|' + pj) : (pj + '|' + pi)] = km; else failed++;
            if (done >= total) { finished = true; clearTimeout(hardTo); cbAll(dist, failed); } else next();
          });
        })(p[0], p[1]);
      }
    }
    next();`,
  '3 矩阵整体超时'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 120)); }
