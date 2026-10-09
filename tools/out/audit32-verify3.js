/* tools/out/audit32-verify3.js — 复核 ux-audit（实用性/操作便利性）那份的 file:line */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const C = [
  ['planner.js', 2061, '第 ', 'N3 空日卡'],
  ['planner.html', 175, 'candList', 'N4 候选无反馈'],
  ['planner.js', 2425, 'tripPick', 'N5 我的行程空态'],
  ['planner.js', 2385, 'name', 'N6 同名重复'],
  ['planner.js', 2023, "must_see", 'N7 必去偏好'],
  ['planner.html', 105, 'chip', 'N7 chip'],
  ['planner.js', 2299, 'tripPick', 'N8 载入无确认'],
  ['planner.js', 1845, 'confirm', 'N9 重排确认'],
  ['planner.js', 2381, 'sortStops', 'N10 改名自动重排'],
  ['planner.js', 1657, 'locked', 'N11 锁定仍可拖'],
  ['planner.js', 1744, 'originMode', 'N12 出发地无重定位'],
  ['planner.js', 1865, '第 1 天', 'N13 无日期'],
  ['planner.html', 135, '进行中', 'N19 进行中标签'],
  ['me.html', 483, '进行中', 'N19b'],
  ['planner.html', 223, 'sel', 'N20 三下拉'],
  ['planner.js', 2415, '向导', 'N21 预选'],
  ['planner.js', 2230, '天', 'N22 天号当日期'],
  ['planner.js', 2104, 'download', 'N23 路书'],
  ['planner.js', 2107, '路书', 'N23b toast'],
  ['planner.js', 1639, 'viewer', 'N24 查看器无关闭'],
  ['results.js', 557, '工坊', 'N25 无锚点'],
  ['me.html', 547, '清空', 'N26 清空所有数据'],
  ['me.html', 368, '删除', 'N27 删票无确认'],
  ['me.html', 369, 'catch', 'N28 票卡静默'],
  ['me.html', 180, 'me-recent', 'N29 入口'],
  ['review.html', 289, 'share', 'N30 分享反馈'],
  ['review.html', 287, 'export', 'N31 导出'],
  ['review.html', 586, 'poster', 'N32 海报'],
  ['review.html', 530, 'copy', 'N33 复制'],
  ['review.html', 514, 'n.date', 'N34 老格式'],
  ['review.html', 580, '篇', 'N35 天数'],
  ['review.html', 556, 'province', 'N36 省份'],
  ['review.html', 483, 'km', 'N37 公里'],
  ['me.html', 300, '待办', 'N38 待办空态'],
  ['me.html', 451, '导出', 'N39 导出反馈'],
  ['me.html', 386, 'Key', 'N40 设置四步'],
  ['expense.html', 187, 'fTrip', 'N41 默认值'],
  ['me.html', 511, '缓存', 'N42 清缓存'],
  ['me.html', 241, '随手记', 'N43 入口'],
  ['index.html', 402, 'tip', 'N1 toast'],
  ['planner.js', 2429, 'trip', 'N2 行程入口'],
];
const cache = {};
function read(f) { if (!cache[f]) cache[f] = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/) : null; return cache[f]; }
const out = []; let hit = 0, drift = 0, miss = 0;
C.forEach(function (c) {
  const f = c[0], ln = c[1], nd = c[2], tag = c[3];
  const L = read(f);
  if (!L) { out.push('NOFILE  ' + tag + '  ' + f); return; }
  let ok = false;
  for (let i = Math.max(0, ln - 3); i < Math.min(L.length, ln + 2); i++) if (L[i].indexOf(nd) >= 0) ok = true;
  const found = [];
  for (let i = 0; i < L.length; i++) if (L[i].indexOf(nd) >= 0 && found.length < 10) found.push(i + 1);
  if (ok) { out.push('HIT     ' + tag + '  ' + f + ':' + ln + '  «' + nd + '»'); hit++; }
  else if (found.length) { out.push('DRIFT   ' + tag + '  声明 ' + f + ':' + ln + ' 实际 ' + found.join(',')); drift++; }
  else { out.push('MISS    ' + tag + '  ' + f + ':' + ln + ' 全文无 «' + nd + '»'); miss++; }
});
out.push(''); out.push('=== ux-audit 对账 命中' + hit + ' / 漂移' + drift + ' / 查无此串' + miss + ' / 共 ' + C.length + ' ===');
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'audit32-verify3.txt'), out.join('\n'));
console.log('written');
