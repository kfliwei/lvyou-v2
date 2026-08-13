/* 从 topic-common.js 移除节点管理功能（集中到 node-manager.html）：
 * 1. 删除 initNodeMgmt 调用
 * 2. 删除用户节点管理大块（保留区域统计）
 * 3. 删除 buildSheet 用户节点编辑/删除菜单
 * 保留：mergeUserNodes（用户节点仍在地图显示）、区域统计条
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

/* 1. init 里移除 FAB 注入 */
rep(
  `    // 数据
    attachIndex();
    initNodeMgmt();`,
  `    // 数据
    attachIndex();`,
  '1.remove initNodeMgmt call'
);

/* 2. 删除用户节点管理大块（起于注释，止于渲染调度注释前） */
const startMark = '  /* ================= 用户节点管理（规范 §3/§17-31 USER_CREATED） ================= */';
const endMark = '  /* ---------- 渲染调度 ---------- */';
const si = s.indexOf(startMark);
const ei = s.indexOf(endMark);
if (si >= 0 && ei > si) {
  s = s.slice(0, si) + s.slice(ei);
  n++;
  console.log('OK   2.remove user-node block');
} else {
  console.log('SKIP 2.remove user-node block (marks not found:', si, ei, ')');
}

/* 3. buildSheet 用户节点编辑/删除菜单移除 */
rep(
  `      (s.source === 'user' ? '<span onclick="window.TopicEngine.editUserNode(\\'' + s.uid + '\\')">编辑节点</span>' : '') +
      (s.source === 'user' ? '<span style="color:var(--color-danger)" onclick="window.TopicEngine.delUserNode(\\'' + s.uid + '\\')">删除节点</span>' : '') +
`,
  '',
  '3.remove buildSheet user menus'
);

fs.writeFileSync(p, s, 'utf8');
console.log('=== applied', n, 'patches ===');
