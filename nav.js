/* nav.js — 全局底部导航（统一注入，页面只需 <div id="bnav"></div> + 本脚本）
   用法：<script src="nav.js" data-active="index"></script>
   依赖：icons.js 必须先于本脚本载入（底部导航是全站组件，图标必须走同一 sprite，
   否则同一个"记录"在导航里和页面里会长得不一样——这正是收口前的实际状态）。
   主线 5 Tab：首页 | 足迹 | ＋记录 | 规划 | 我的
   data-active 取值（含别名）：
     index | travel-map | planner | me 为真实 Tab；
     explore-map/topic/search→index，wishlist→planner，
     review/story/album/settings/node-manager/md-manager→me */
(function () {
  var TABS = [
    { id: 'index', href: 'index.html', label: '首页', icon: 'home' },
    { id: 'travel-map', href: 'travel-map.html', label: '足迹', icon: 'footprints' },
    { id: 'rec', href: 'index.html?shortcut=anywhere', label: '记录', fab: true, icon: 'mic' },
    { id: 'planner', href: 'planner.html', label: '规划', icon: 'route' },
    { id: 'me', href: 'me.html', label: '我的', icon: 'user' }
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
    '.bottom-nav__fab__btn{width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,var(--color-primary),var(--color-primary-dark));color:var(--bg);display:grid;place-items:center;box-shadow:0 8px 20px rgba(200,109,75,.38);border:3px solid var(--color-surface,#fffdf8);margin-top:-24px;transition:transform var(--duration-fast,var(--motion-fast)) var(--ease-standard,ease)}' +
    '.bottom-nav__fab:active .bottom-nav__fab__btn{transform:scale(.92)}' +
    /* 暗色主题把 --color-primary 调亮（为了文字对比），但 FAB 是实心砖红底 + 白描边图标，
       跟着调亮后白字对底只有 2.9:1；这里按图形 3:1 底线单独压深，不走 token */
    '.theme-dark .bottom-nav__fab__btn{box-shadow:0 8px 24px rgba(0,0,0,.55);background:linear-gradient(145deg,#B4593A,#8F422B)}';
  var html = '<style>' + css + '</style><nav class="bottom-nav" aria-label="主导航">' + TABS.map(function (it) {
    if (it.fab) {
      return '<a class="bottom-nav__fab" href="' + it.href + '" aria-label="随手记：语音记录此刻"><span class="bottom-nav__fab__btn">' + TI(it.icon, 22) + '</span>' + it.label + '</a>';
    }
    var on = it.id === cur ? ' active' : '';
    var aria = it.id === cur ? ' aria-current="page"' : '';
    return '<a class="bottom-nav__item' + on + '" href="' + it.href + '"' + aria + '>' +
      '<span class="ic">' + TI(it.icon, 20) + '</span>' + it.label + '</a>';
  }).join('') + '</nav>';
  function mount() {
    var box = document.getElementById('bnav');
    if (box) box.innerHTML = html;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
