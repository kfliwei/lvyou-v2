/* nav.js — 全局底部导航（统一注入，页面只需 <div id="bnav"></div> + 本脚本）
   用法：<script src="nav.js" data-active="index"></script>
   主线 5 Tab：首页 | 足迹 | ＋记录 | 规划 | 我的
   data-active 取值（含别名）：
     index | travel-map | planner | me 为真实 Tab；
     explore-map/topic/search→index，wishlist→planner，
     review/story/album/settings/node-manager/md-manager→me */
(function () {
  var TABS = [
    { id: 'index', href: 'index.html', label: '首页', svg: '<path d="M4 12 L12 4 L20 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 10.5 V20 H17.5 V10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'travel-map', href: 'travel-map.html', label: '足迹', svg: '<path d="M4 19 C6 15 8 15 10 19 C12 15 14 15 16 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 6 C6 3 8 3 10 6 C12 3 14 3 16 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'rec', href: 'index.html?shortcut=anywhere', label: '记录', fab: true, svg: '<rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 v3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>' },
    { id: 'planner', href: 'planner.html', label: '规划', svg: '<circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8.5 18 H14 A4 4 0 0 0 18 14 V8.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>' },
    { id: 'me', href: 'me.html', label: '我的', svg: '<circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5.5 20 C6.5 15.5 17.5 15.5 18.5 20" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>' }
  ];
  var ALIAS = {
    'explore-map': 'index', topic: 'index', search: 'index',
    wishlist: 'planner', 'travel-notes': 'travel-map',
    review: 'me', story: 'me', album: 'me', 'album-edit': 'me',
    settings: 'me', 'node-manager': 'me', 'md-manager': 'me'
  };
  var raw = (document.currentScript && document.currentScript.getAttribute('data-active')) || '';
  var cur = ALIAS[raw] || raw;
  var css = '.bottom-nav{z-index:1050}' +
    '.bottom-nav__fab{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;font-size:11px;letter-spacing:.04em;color:var(--color-muted);cursor:pointer;text-decoration:none;padding-bottom:6px}' +
    '.bottom-nav__fab__btn{width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,var(--color-primary),var(--color-primary-dark));color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(200,109,75,.38);border:3px solid var(--color-surface,#fffdf8);margin-top:-24px;transition:transform var(--duration-fast,150ms) var(--ease-standard,ease)}' +
    '.bottom-nav__fab:active .bottom-nav__fab__btn{transform:scale(.92)}' +
    '.theme-dark .bottom-nav__fab__btn{box-shadow:0 8px 24px rgba(0,0,0,.55)}';
  var html = '<style>' + css + '</style><nav class="bottom-nav" aria-label="主导航">' + TABS.map(function (it) {
    if (it.fab) {
      return '<a class="bottom-nav__fab" href="' + it.href + '" aria-label="随手记：语音记录此刻"><span class="bottom-nav__fab__btn"><svg width="22" height="22" viewBox="0 0 24 24" fill="none">' + it.svg + '</svg></span>' + it.label + '</a>';
    }
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
