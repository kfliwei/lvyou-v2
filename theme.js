/* ============================================================
   theme.js — 深色模式 + PWA 注册
   深色：读 localStorage('tn_dark') = auto|light|dark，默认 auto 跟随系统。
   必须最先加载（<head>），避免深色下白屏闪烁。
   PWA：http(s) 下注册 service worker（离线缓存应用壳）。
   ============================================================ */
(function () {
  function isDark() {
    var m = 'auto';
    try { m = localStorage.getItem('tn_dark') || 'auto'; } catch (e) {}
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function apply() { document.documentElement.classList.toggle('theme-dark', isDark()); }
  apply();
  /* 字号档位：sm/md/lg（localStorage tn_font），控制正文阅读类字号 */
  (function () {
    var s = 'md';
    try { s = localStorage.getItem('tn_font') || 'md'; } catch (e) {}
    document.documentElement.classList.add('font-' + s);
  })();
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  /* PWA：仅 http/https 注册（file:// 与 Android WebView 内不注册，功能不受影响） */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
