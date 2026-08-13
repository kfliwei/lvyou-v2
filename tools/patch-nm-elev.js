/* 补充：编辑回填海拔 + 信息面板显示海拔 + 专题引擎合并 elev */
const fs = require('fs');

/* A. node-manager.html */
let s = fs.readFileSync('node-manager.html', 'utf8');
let n = 0;
function repA(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
repA(
  "openForm({ uid: u.id, name: u.name, lat: u.lat, lng: u.lng, gcj: !!u.gcj, city: u.city, category: u.category, tags: u.tags, desc: u.desc, province: u.province, createdAt: u.createdAt })",
  "openForm({ uid: u.id, name: u.name, lat: u.lat, lng: u.lng, gcj: !!u.gcj, city: u.city, category: u.category, tags: u.tags, desc: u.desc, elev: u.elev, province: u.province, createdAt: u.createdAt })",
  'A1.edit elev backfill'
);
repA(
  "'<div class=\"is-loc\">' + esc([u.category, u.city].filter(Boolean).join(' · ')) + '</div>'",
  "'<div class=\"is-loc\">' + esc([u.category, u.city].filter(Boolean).join(' · ') + (u.elev ? ' · 海拔 ' + u.elev + 'm' : '')) + '</div>'",
  'A2.info elev'
);
repA(
  "      return '<div class=\"nm-item\">' +\n        '<div class=\"nm-item-main\"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.category].filter(Boolean).join(' · ')) + '</small></div>' +",
  "      return '<div class=\"nm-item\">' +\n        '<div class=\"nm-item-main\"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.category].filter(Boolean).join(' · ') + (u.elev ? ' · ' + u.elev + 'm' : '')) + '</small></div>' +",
  'A3.list elev'
);
fs.writeFileSync('node-manager.html', s, 'utf8');
console.log('node-manager patches:', n);

/* B. topic-common.js mergeUserNodes 加 elev */
let t = fs.readFileSync('topic-common.js', 'utf8');
const fromB = "        best: '', lat: +u.lat, lng: +u.lng, flag: '', source: 'user', uid: u.id,\n        tags: u.tags || [], gcj: !!u.gcj";
const toB = "        best: '', lat: +u.lat, lng: +u.lng, flag: '', source: 'user', uid: u.id,\n        tags: u.tags || [], gcj: !!u.gcj, elev: u.elev || ''";
if (t.includes(fromB)) {
  t = t.split(fromB).join(toB);
  fs.writeFileSync('topic-common.js', t, 'utf8');
  console.log('OK   B.merge elev');
} else {
  console.log('SKIP B.merge elev');
}
