/* 修复：图例/标签与节点联动
 * A. syncChips 主题匹配带 emoji 前缀的 dataset.f（f.indexOf(state.theme)）
 * B. openSheet 时节点主题在图例/顶部 chip 闪烁提示 + 图例滚动到该行
 * C. renderAll 动态更新图例"全部"行计数（用户节点增删后同步）
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

/* A. syncChips 主题 chip 匹配修复（label 带图标前缀） */
rep(
  `      if (f === state.theme || f === state.region || f === state.city) c.classList.add('on');`,
  `      if (f === state.theme || f.indexOf(state.theme) >= 0 || f === state.region || f === state.city) c.classList.add('on');`,
  'A.syncChips theme match'
);

/* B. openSheet 节点主题联动（图例/标签闪烁 + 图例滚动） */
rep(
  `  function openSheet(i) {
    curSite = i;
    $('lsBody').innerHTML = buildSheet(i);
    $('locSheet').classList.add('show');
    setActiveNode(i);
    document.querySelector('.tabbar').classList.add('is-hidden');
    highlightCard(i);
    if (map) setTimeout(function () { map.panBy([0, -160], { duration: 420 }); }, 80);
  }`,
  `  function openSheet(i) {
    curSite = i;
    $('lsBody').innerHTML = buildSheet(i);
    $('locSheet').classList.add('show');
    setActiveNode(i);
    document.querySelector('.tabbar').classList.add('is-hidden');
    highlightCard(i);
    /* 节点 → 图例/标签联动：闪烁提示该节点所属主题（不改动筛选状态） */
    var _s = SITES[i];
    if (_s) {
      var _th = tk(_s);
      document.querySelectorAll('#legBody .lg').forEach(function (el) {
        var hit = el.dataset.th === _th;
        el.classList.toggle('flash', hit);
        if (hit) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      });
      document.querySelectorAll('#dynChips .chip').forEach(function (c) {
        var f = c.dataset.f || '';
        if (f && (f === _th || f.indexOf(_th) >= 0)) {
          c.classList.add('flash');
          setTimeout(function () { c.classList.remove('flash'); }, 1400);
        }
      });
      setTimeout(function () {
        document.querySelectorAll('#legBody .lg.flash').forEach(function (el) { el.classList.remove('flash'); });
      }, 1400);
    }
    if (map) setTimeout(function () { map.panBy([0, -160], { duration: 420 }); }, 80);
  }`,
  'B.openSheet legend flash'
);

/* C. renderAll 动态更新图例"全部"行计数 */
rep(
  `    $('totalTag').textContent = '· 共 ' + SITES.length + ' 处' + (M.totalTagSuffix || '');`,
  `    $('totalTag').textContent = '· 共 ' + SITES.length + ' 处' + (M.totalTagSuffix || '');
    /* 图例"全部"行计数随节点增删动态更新 */
    var _allCnt = document.querySelector('#legBody .lg[data-th=""] .cnt');
    if (_allCnt) _allCnt.textContent = SITES.length;`,
  'C.renderAll legend count'
);

fs.writeFileSync(p, s, 'utf8');
console.log('=== applied', n, 'patches ===');
