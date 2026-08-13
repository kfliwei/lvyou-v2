/* 恢复：用户节点合并进专题/全国地图（topic-common.js）
 * 1. 恢复 USER_KEY / loadUserNodes / mergeUserNodes（精简版，无管理 UI）
 * 2. init 中 SITES 赋值后调用 mergeUserNodes()
 * 3. pt() 支持 gcj 标记节点（高德 POI 添加的节点是 GCJ-02，不再二次纠偏）
 */
const fs = require('fs');
const p = 'topic-common.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. 恢复用户节点数据层（插入到"启动"段前） */
rep(
  `  /* ---------- 启动 ---------- */`,
  `  /* ---------- 用户节点（node-manager.html 创建，专题/全国地图显示） ---------- */
  var USER_KEY = '***';
  function loadUserNodes() { try { return JSON.parse(localStorage.getItem(USER_KEY) || '[]'); } catch (e) { return []; } }
  function mergeUserNodes() {
    loadUserNodes().forEach(function (u) {
      SITES.push({
        id: 'u' + u.id, name: u.name, label: u.name, region: u.province || '其他',
        city: u.city || '', county: '', theme: u.category || '其他', desc: u.desc || '',
        best: '', lat: +u.lat, lng: +u.lng, flag: '', source: 'user', uid: u.id,
        tags: u.tags || [], gcj: !!u.gcj
      });
    });
  }

  /* ---------- 启动 ---------- */`,
  '1.restore user node data layer'
);

/* 2. init 合并用户节点 */
rep(
  `    SITES = window.SITES || [];
    FOOD = window.FOOD || [];`,
  `    SITES = window.SITES || [];
    mergeUserNodes();
    FOOD = window.FOOD || [];`,
  '2.merge user nodes in init'
);

/* 3. pt() 支持 gcj 节点 */
rep(
  `  function pt(s) { return useGCJ ? gcj02Of(s.lat, s.lng) : [s.lat, s.lng]; }`,
  `  function pt(s) { if (s && s.gcj) return [+s.lat, +s.lng]; return useGCJ ? gcj02Of(s.lat, s.lng) : [s.lat, s.lng]; }`,
  '3.pt gcj support'
);

fs.writeFileSync(p, s, 'utf8');
console.log('=== applied', n, 'patches ===');
