/* tools/test-geo.js — 地理工具单测：node tools/test-geo.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'geo.js'), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const G = ctx.window.Geo;
let pass = 0, fail = 0;
function eq(name, got, want) {
  let ok;
  if (typeof want === 'number') ok = Math.abs(got - want) < 1e-6;
  else if (Array.isArray(want)) ok = JSON.stringify(got) === JSON.stringify(want);
  else ok = got === want;
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + ' got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)); }
}
/* GCJ-02：北京天安门 WGS84 (39.9087, 116.3975)，纠偏后应有数百米级偏移（<0.01 度）且非零 */
const g = G.gcj02Of(39.9087, 116.3975);
eq('gcj 偏移量级 <0.01度', Math.abs(g[0] - 39.9087) < 0.01 && Math.abs(g[1] - 116.3975) < 0.01, true);
eq('gcj 偏移非零', Math.abs(g[0] - 39.9087) > 0.0001 || Math.abs(g[1] - 116.3975) > 0.0001, true);
eq('gcj 界外原样返回', G.gcj02Of(0, 0), [0, 0]);
/* haversine：北京→上海 约 1067km（容差 30km） */
const d = G.hav(39.9042, 116.4074, 31.2304, 121.4737);
eq('hav 北京-上海 ~1067km', Math.abs(d - 1067) < 30, true);
eq('hav 同点=0', G.hav(30, 120, 30, 120), 0);
eq('havA 数组版一致', Math.abs(G.havA([39.9042, 116.4074], [31.2304, 121.4737]) - d) < 1e-9, true);
/* 广州→北京 ~1888km */
eq('hav 广州-北京 ~1888km', Math.abs(G.hav(23.1291, 113.2644, 39.9042, 116.4074) - 1888) < 40, true);
console.log('--- ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
