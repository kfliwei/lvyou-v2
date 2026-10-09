/* tools/out/audit32-verify.js — 复核三路普查代理给的每一条 file:line
   只认「我亲眼在那一行读到的原文」：needle 必须出现在声明行 ±1 内，否则判 MISS/漂移。
   用法: node tools/out/audit32-verify.js   → 落盘 tools/out/audit32-verify.txt */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/* [声明文件, 声明行, 必须在该行读到的原文片段, 归属条目] */
const CLAIMS = [
  ['md-manager.html', 156, 'TravelNotes.noteById', 'F1 死入口'],
  ['md-manager.html', 166, 'noteById', 'F1b'],
  ['md-manager.html', 571, 'allCities', 'F2 死入口'],
  ['md-manager.html', 556, 'saveNote', 'F3 编辑丢图'],
  ['md-manager.html', 419, 'n.city||n.province', 'F5 城市档恒空'],
  ['md-manager.html', 581, 'a.download=', 'F4 blob无revoke'],
  ['md-manager.html', 707, 'SyncWebDAV', 'F8 同步无入口'],
  ['md-manager.html', 549, '保存', 'F35 静默守卫'],
  ['md-manager.html', 110, '＋ 新建', 'U26 emoji'],
  ['md-manager.html', 332, 'font-weight:900', 'U12 字重'],
  ['md-manager.html', 431, ' · ', 'U20 meta无日期空白点'],
  ['planner.js', 2520, 'if (false)', 'F6 主题计数死码'],
  ['planner.html', 354, 'type="date"', 'F7 隐藏日期输入'],
  ['planner.js', 2107, '路书', 'F9 假成功toast'],
  ['planner.js', 2104, 'download', 'N23 路书落点'],
  ['planner.js', 1941, 'restoreLast', 'N18 载入行程'],
  ['planner.js', 2425, 'openTripPicker', 'N5 无空态'],
  ['planner.js', 1845, 'confirm', 'N9 重排重置'],
  ['planner.js', 2299, 'loadTripIntoPlanner', 'N8 载入无确认'],
  ['planner.js', 1744, '重新定位', 'N12 出发地'],
  ['planner.js', 1865, '第 1 天', 'N13 无日期'],
  ['me.html', 546, 'clearConfirm', 'F10 清空库'],
  ['me.html', 296, 'clipboard', 'F15 复制失败静默'],
  ['me.html', 451, '已导出', 'N39 导出反馈'],
  ['me.html', 254, "esc((n.date||'').slice(0,10))", 'B31 已登记'],
  ['travel-notes.js', 578, 't < 5', 'F11 只重试5次'],
  ['travel-notes.js', 1409, 'catch', 'F13 AI失败无文案'],
  ['travel-notes.js', 2215, 'ctx.fillText', 'F17 海报无兜底'],
  ['travel-notes.js', 1930, 'toLocaleDateString', 'B31 已登记'],
  ['travel-notes.js', 247, 'AndroidCard', 'F34 widget静默'],
  ['expense.html', 348, "a.download='旅行开销", 'F14 CSV无BOM'],
  ['expense.html', 263, 'fTrip', 'F23 筛选回弹'],
  ['expense.html', 71, '#addSheet', 'U中 z9500'],
  ['node-manager.html', 1122, "a.download='custom-nodes", 'F16 CSV无BOM'],
  ['node-manager.html', 262, 'confirm(', 'N-of 删节点裸confirm'],
  ['index.html', 442, 'todayNoteIds', 'F21 去重永不生效'],
  ['index.html', 552, 'suggestByDateRange', 'F24 空数组短路'],
  ['travel-map.html', 358, 'drawWeather', 'F22 死函数'],
  ['search.html', 256, 'pushState', 'F33 返回键'],
  ['explore-map.html', 447, '导出', 'F25 导出JSON无入口'],
  ['story.html', 140, "esc(n.date||'')", 'B31 已登记'],
  ['review.html', 513, "slice(0, 4)", 'B31 已登记'],
  ['review.html', 613, "esc(n.date)", 'B31 已登记'],
  ['album-edit.html', 238, "(n.date || '')", 'B31 已登记'],
  ['results.js', 333, 'esc(n.date)', 'B31 已登记'],
  ['results.js', 336, 'toLocaleDateString', 'B31 已登记'],
  ['vault.js', 392, 'escH(n.date)', 'B31 已登记'],
  ['search.html', 216, "(n.date||'')", 'B31 已登记'],
  ['settings.html', 243, 'modelWrap', 'F27 空下拉'],
  ['settings.html', 538, '已复制', 'F18 复制反馈'],
  ['share.js', 214, 'v3b', 'F26 解码器分叉'],
  ['travel-notes.js', 2299, 'btn-tn-export', 'F29 导出入口'],
];

const cache = {};
function read(f) {
  if (!cache[f]) cache[f] = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/) : null;
  return cache[f];
}
const lines = [];
let hit = 0, drift = 0, miss = 0, nofile = 0;
CLAIMS.forEach(function (c) {
  const f = c[0], ln = c[1], needle = c[2], tag = c[3];
  const L = read(f);
  if (!L) { lines.push('NOFILE  ' + tag + '  ' + f + ':' + ln); nofile++; return; }
  let ok = false, found = [];
  for (let i = Math.max(0, ln - 2); i < Math.min(L.length, ln + 1); i++) if (L[i].indexOf(needle) >= 0) ok = true;
  for (let i = 0; i < L.length; i++) if (L[i].indexOf(needle) >= 0 && found.length < 6) found.push(i + 1);
  if (ok) { lines.push('HIT     ' + tag + '  ' + f + ':' + ln + '  «' + needle + '»'); hit++; }
  else if (found.length) { lines.push('DRIFT   ' + tag + '  声明 ' + f + ':' + ln + ' 实际 ' + found.join(',') + '  «' + needle + '»'); drift++; }
  else { lines.push('MISS    ' + tag + '  ' + f + ':' + ln + ' 全文无 «' + needle + '»'); miss++; }
});
lines.push('');
lines.push('=== 对账 命中' + hit + ' / 行号漂移' + drift + ' / 全文无此串' + miss + ' / 文件不存在' + nofile + ' ===');
require('fs').writeFileSync(path.join(ROOT, 'tools', 'out', 'audit32-verify.txt'), lines.join('\n'));
console.log('written');
