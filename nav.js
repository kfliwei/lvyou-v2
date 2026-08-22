/* nav.js — 全局底部导航（统一注入，页面只需 <div id="bnav"></div> + 本脚本）
   用法：<script src="nav.js" data-active="index"></script>
   data-active 取值：index | explore-map | travel-map | review | me */
(function () {
  var ITEMS = [
    { id: 'index', href: 'index.html', label: '探索', svg: '<path d="M4 12 L12 4 L20 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 10.5 V20 H17.5 V10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'explore-map', href: 'explore-map.html', label: '专题', svg: '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>' },
    { id: 'travel-map', href: 'travel-map.html', label: '足迹', svg: '<path d="M4 19 C6 15 8 15 10 19 C12 15 14 15 16 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 6 C6 3 8 3 10 6 C12 3 14 3 16 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'review', href: 'review.html', label: '回顾', svg: '<path d="M4 5 H20 V19 H4 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 9 H20" stroke="currentColor" stroke-width="1.6"/><path d="M8 3 V6 M16 3 V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'me', href: 'me.html', label: '我的', svg: '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.2" opacity=".5"/>' }
  ];
  var cur = (document.currentScript && document.currentScript.getAttribute('data-active')) || '';
  var html = '<nav class="bottom-nav" aria-label="主导航">' + ITEMS.map(function (it) {
    var on = it.id === cur ? ' active' : '';
    var aria = it.id === cur ? ' aria-current="page"' : '';
    return '<a class="bottom-nav__item' + on + '" href="' + it.href + '"' + aria + '>' +
      '<span class="ic"><span aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none">' + it.svg + '</svg></span></span>' + it.label + '</a>';
  }).join('') + '</nav>';
  function mount() {
    var box = document.getElementById('bnav');
    if (box) box.innerHTML = html;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
