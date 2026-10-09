/* tools/out/audit32-verify4.js — 用 ux-audit 报告里逐字引用的原文回对真文件（needle 取自它的引文） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const C = [
  ['nav.js', 14, "href: 'index.html?shortcut=anywhere'", 'H1 记录FAB=整页重载'],
  ['index.html', 390, 'window.__tnShortcut', 'H1b 600ms 后才发起'],
  ['index.html', 416, 'timeout: 6000', 'H1c GPS 6s'],
  ['index.html', 410, '无法获取位置', 'H2 定位失败踢出流程'],
  ['index.html', 412, '去地图选点', 'H2b'],
  ['travel-map.html', 842, '__tnPickPlace', 'H3 足迹页记一笔'],
  ['travel-map.html', 851, '_busy', 'H3b busy 锁'],
  ['travel-notes.js', 2497, 'if (onCancel) onCancel()', 'H3c cancel 回调'],
  ['topic-common.js', 592, 'ls-morebtn', 'H4 更多藏在展开后'],
  ['topic-common.js', 595, '加入行程', 'H4b'],
  ['me.html', 253, 'meRecent', 'H5 最近记录死胡同'],
  ['travel-notes.js', 643, 'mask.onclick = closePanel', 'H6 遮罩即关不确认'],
  ['travel-notes.js', 1881, "#tnEditBack', function () { pg.remove", 'H7 编辑返回无条件丢'],
  ['travel-notes.js', 1881, 'tnEditBack', 'H7b'],
  ['settings.html', 419, 'WebDAV.push', 'H8 上传零确认'],
  ['sync-webdav.js', 15, '整包 PUT 覆盖远端', 'H8b'],
  ['settings.html', 582, '清除全部数据', 'H9 名不符实'],
  ['travel-notes.js', 2311, 'clearNotes', 'H9b'],
  ['travel-notes.js', 2311, '已清除全部数据', 'H9c 谎报'],
  ['planner.html', 126, 'min-width:96px', 'H10 12 颗等宽按钮'],
  ['planner.js', 1425, '开始旅行', 'H10b'],
  ['planner.js', 1431, '导出日历', 'H10c 长文案撑格'],
  ['planner.js', 2332, "state.startDate = ''", 'N-默认 抹掉出发日期'],
  ['expense-form.js', 86, "pickCat = '餐饮'", 'N-默认 分类'],
  ['expense-form.js', 146, 'todayISO', 'N-默认 日期'],
  ['wishlist.html', 244, '可以开始记录啦', 'N-反馈 谎报'],
  ['wishlist.html', 245, 'openPanel', 'N-反馈b catch 吞'],
  ['settings.html', 443, 'location.reload()', 'N-反馈 强制刷新'],
  ['sync-webdav.js', 245, 'UI.tileWarn', 'N-反馈 自动同步静默'],
  ['search.html', 169, "removeItem('tn_search_hist')", 'N-破坏 清空无确认'],
  ['travel-notes.js', 1485, 'catch(function () {})', 'N-静默 天气'],
  ['topic-common.js', 906, '才能按距离排序', 'M-前置 先定位'],
  ['planner.js', 1705, '至少选 2 个景点', 'M-前置'],
  ['planner.js', 1707, '未配置高德 Key', 'M-前置b'],
  ['planner.js', 2525, '先去地图收藏至少', 'M-前置c'],
  ['index.html', 236, 'readonly', 'L-首页搜索只读'],
  ['planner.html', 104, 'height:30px', 'M-触控 .mv 30px'],
  ['planner.html', 115, 'min-height:28px', 'M-触控b mini 28px'],
  ['expense-form.js', 150, 'preventScroll', 'M-键盘压住'],
  ['travel-notes.js', 1086, 'preventScroll', 'M-键盘b'],
  ['checklist.html', 269, "pickKind = '机票'", 'L-默认 票种'],
  ['results.js', 463, 'value="3"', 'L-默认 3 天'],
  ['planner.html', 222, 'value="5"', 'L-默认 5 天'],
  ['planner.js', 2306, '可在 5 秒内撤销', 'M-撤销分布'],
  ['expense.html', 330, '已删除这笔账', 'M-撤销缺失'],
  ['travel-notes.js', 1751, '此操作不可恢复', 'M-撤销缺失b'],
  ['topic-common.js', 1648, '清空行程', 'M-破坏c'],
  ['planner.js', 1255, 'writeSnap()', 'M-快照续接'],
  ['travel-map.html', 709, 'flyTo', 'M-搜索落点'],
  ['settings.html', 197, 'md-manager.html', 'M-三级埋点'],
  ['topic-common.js', 870, 'M.tripKey', 'M-两套行程'],
  ['backup.js', 30, 'tn_trips', 'M-备份白名单'],
  ['node-manager.html', 1013, 'confirm', '对照 反馈完备'],
  ['planner.js', 1657, 'locked', 'N11 锁定'],
  ['planner.js', 1744, 'origin', 'N12 出发地'],
  ['planner.js', 1865, '第 1 天', 'N13 日期缺'],
  ['planner.js', 2415, '向导', 'N21'],
  ['review.html', 556, 'provs', 'N36 省份'],
  ['review.html', 483, 'km.toFixed', 'N37 公里'],
  ['review.html', 580, 'days', 'N35'],
  ['review.html', 514, 'esc(n.date', 'N34'],
];
const cache = {};
function read(f) { if (!cache[f]) cache[f] = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/) : null; return cache[f]; }
const out = []; let hit = 0, drift = 0, miss = 0;
C.forEach(function (c) {
  const f = c[0], ln = c[1], nd = c[2], tag = c[3];
  const L = read(f);
  if (!L) { out.push('NOFILE  ' + tag + '  ' + f); return; }
  let ok = false;
  for (let i = Math.max(0, ln - 4); i < Math.min(L.length, ln + 3); i++) if (L[i].indexOf(nd) >= 0) ok = true;
  const found = [];
  for (let i = 0; i < L.length; i++) if (L[i].indexOf(nd) >= 0 && found.length < 10) found.push(i + 1);
  if (ok) { out.push('HIT     ' + tag + '  ' + f + ':' + ln); hit++; }
  else if (found.length) { out.push('DRIFT   ' + tag + '  声明 ' + f + ':' + ln + ' 实际 ' + found.join(',')); drift++; }
  else { out.push('MISS    ' + tag + '  ' + f + ':' + ln + ' 全文无 «' + nd + '»'); miss++; }
});
out.push(''); out.push('=== 对账 命中' + hit + ' / 漂移' + drift + ' / 查无此串' + miss + ' / 共 ' + C.length + ' ===');
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'audit32-verify4.txt'), out.join('\n'));
console.log('written');
