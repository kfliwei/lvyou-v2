/* 查 amapRoutePolyline 的 key 拼接写法 */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
const L = s.split(/\r?\n/);
L.forEach((l, i) => { if (l.includes('restapi.amap.com/v3/direction/driving')) console.log((i + 1) + ': ' + JSON.stringify(l.slice(0, 160))); });
