/* app-router.js — SPA 路由框架（路径 A）
 * 前置：WebView 已开 setAllowFileAccessFromFileURLs(true)（MainActivity 已配置）；
 *       浏览器预览需经 http server（file:// 下 fetch 被 CORS 拦截）。
 * 用法：
 *   Router.register({ 'topic': { url: 'topic.html', init: fn } });
 *   Router.go('topic?p=bj');        // 切换到 topic 片段
 *   Router.back();                  // 返回栈
 * 注意：页面接入需把 body 内容与内联脚本作为可重复执行的片段（脚本须 IIFE 隔离）。
 */
window.Router = (function () {
  var routes = {};
  var stack = [];

  function register(map) {
    Object.keys(map).forEach(function (k) { routes[k] = map[k]; });
  }
  function executeScripts(doc) {
    doc.querySelectorAll('script:not([src])').forEach(function (sc) {
      var s = document.createElement('script');
      s.textContent = sc.textContent;
      document.body.appendChild(s);
    });
    /* 带 src 的脚本：全局加载一次（去重） */
    doc.querySelectorAll('script[src]').forEach(function (sc) {
      var src = sc.getAttribute('src');
      var existing = document.querySelector('script[data-router-src="' + src + '"]');
      if (!existing) {
        var s = document.createElement('script');
        s.src = src;
        s.setAttribute('data-router-src', src);
        document.body.appendChild(s);
      }
    });
  }
  function go(hash) {
    var q = hash.indexOf('?');
    var name = q >= 0 ? hash.slice(0, q) : hash;
    var route = routes[name];
    if (!route) { /* 未注册：回退整页跳转 */
      location.href = hash + (q >= 0 ? '' : '.html');
      return;
    }
    return fetch(route.url).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var app = document.getElementById('app');
      if (!app) return;
      app.innerHTML = doc.body.innerHTML;
      executeScripts(doc);
      if (route.init) route.init(doc);
      stack.push(hash);
      history.pushState(null, '', '#/' + hash);
    }).catch(function () { location.href = route.url; /* fetch 失败回退整页 */ });
  }
  function back() {
    if (stack.length > 1) {
      stack.pop();
      return go(stack[stack.length - 1]);
    }
    history.back();
    return Promise.resolve();
  }
  window.addEventListener('popstate', function () {
    if (stack.length > 1) stack.pop();
  });
  return { register: register, go: go, back: back };
})();
