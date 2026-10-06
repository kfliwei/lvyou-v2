/* ui.js — 设计内 Toast 与确认对话框（替代原生 alert/confirm）
 * 用法:
 *   UI.toast('已保存')                        // 轻提示，自动消失
 *   UI.confirm({title:'删除', text:'确定？', okText:'删除', danger:true}, function(ok){ if(ok) ... })
 */
(function () {
  /* 播报要两步：活区先「空着」入 DOM，文案晚一帧再写。带着文案一次性插入的话，
     读屏把它当成静态内容（新增节点）而不是状态变更，一个字都不播（批次 22 实测，
     toast / tileWarn / errorBox 原本全是这个形状）。aria-live 必须随节点一起进去。 */
  function toast(msg, ms, action) {
    var d = document.createElement('div');
    d.className = 'ui-toast';
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    document.body.appendChild(d);
    requestAnimationFrame(function () {
      d.appendChild(document.createTextNode(msg));
      if (action && action.text) {
        d.classList.add('act');
        var b = document.createElement('button');
        b.className = 'ui-toast-act';
        b.type = 'button';
        b.textContent = action.text;
        b.onclick = function () { d.remove(); if (action.fn) action.fn(); };
        d.appendChild(b);
      }
      d.classList.add('show');
    });
    setTimeout(function () {
      d.classList.remove('show');
      /* 退场等待跟 .ui-toast 的 CSS transition 同源，谁改 token 都不会把 toast 截在半空 */
      setTimeout(function () { d.remove(); }, motionMs('normal', 320));
    }, ms || (action && action.text ? 5000 : 2600));
  }

  /* 焦点圈定（批次 22 从 confirm 抽成单点，弹层共用）。返回 keydown 处理器：
     命中 Tab 返回 true（已处理）。verify.js §36 钉这里「function trapFocus」声明数 === 1，
     复制粘贴出第二份 trap 一定红。
     清单要过滤：默认选择器里的 [href] 会命中 SVG 的 <use href>（图标 <svg><use>），
     而 <use> 根本聚焦不上——last 是个按不动的节点，e.preventDefault() 后焦点原地不动，
     「转到末尾回第一枚」永远不触发，实测第三次 Tab 就跑到 tabbar 上（452×995 topic.html）。 */
  function trapFocus(container, sel) {
    return function (e) {
      if (!e || e.key !== 'Tab') return false;
      var nodes = container.querySelectorAll(sel || 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var f = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
        if (n.disabled || n.getAttribute && n.getAttribute('disabled') !== null) continue;
        f.push(n);
      }
      if (!f.length) return false;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return true;
    };
  }

  function confirm(o, cb) {
    if (typeof o === 'string') o = { text: o };
    var m = document.createElement('div');
    m.className = 'ui-modal-mask';
    m.innerHTML =
      '<div class="ui-modal" role="alertdialog" aria-modal="true" aria-label="' + esc(o.title || '提示') + '">' +
      (o.title ? '<div class="ui-modal-title"></div>' : '') +
      '<div class="ui-modal-text"></div>' +
      '<div class="ui-modal-acts">' +
      '<button class="ui-btn ui-btn-ghost" type="button"></button>' +
      '<button class="ui-btn ui-btn-primary" type="button"></button>' +
      '</div></div>';
    if (o.title) m.querySelector('.ui-modal-title').textContent = o.title;
    m.querySelector('.ui-modal-text').textContent = o.text || '';
    var ok = m.querySelector('.ui-btn-primary');
    var cancel = m.querySelector('.ui-btn-ghost');
    ok.textContent = o.okText || '确定';
    cancel.textContent = o.cancelText || '取消';
    if (o.danger) ok.classList.add('danger');
    var opener = document.activeElement;
    var trap = trapFocus(m, 'button');
    function close(rs) {
      m.remove();
      document.removeEventListener('keydown', kd);
      try { if (opener && opener.focus) opener.focus(); } catch (e) {}
      if (cb) cb(rs);
    }
    function kd(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      trap(e);
    }
    ok.onclick = function () { close(true); };
    cancel.onclick = function () { close(false); };
    m.onclick = function (e) { if (e.target === m) close(false); };
    document.addEventListener('keydown', kd);
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); ok.focus(); });
  }

  /* 页内一次性提示条（产品唯一的提醒位：不做系统推送）。文案一律走 textContent，
     调用方把用户可控的字拼进 html 串是注入面，这里不给那个口子。 */
  function nudge(o) {
    if (!o || (!o.text && !o.strong)) return null;
    var d = document.createElement('div');
    d.className = 'ui-nudge';
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    document.body.appendChild(d);
    requestAnimationFrame(function () {
      var msg = document.createElement('span');
      msg.className = 'txt';
      if (o.pre) msg.appendChild(document.createTextNode(o.pre));
      if (o.strong) { var b = document.createElement('b'); b.textContent = o.strong; msg.appendChild(b); }
      msg.appendChild(document.createTextNode(o.text || ''));
      d.appendChild(msg);
      if (o.actionText) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = o.actionText;
        btn.onclick = function () { d.remove(); if (o.onAction) o.onAction(); };
        d.appendChild(btn);
      }
    });
    /* 10s 自移除是提醒纪律，不是可选项：常驻会把页面挤成广告位 */
    setTimeout(function () { if (d.parentNode) d.remove(); }, o.ms || 10000);
    return d;
  }

  /* 图片附件的统一压缩档（800px / jpeg .72）：随手记的照片与「我的票」的票据截图共用一把尺子 */
  function compressImage(dataUrl, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        var max = 800, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.72));
        cv.width = cv.height = 0;
      };
      img.onerror = function () { cb(null); };
      img.src = dataUrl;
    } catch (e) { cb(null); }
  }

  function tileWarn(layer, name) {
    if (!layer || !layer.on) return;
    layer.on('tileerror', function () {
      /* P1-8（批次6）：离线信号统一交给离线条，瓦片告警不再抢顶部 toast（旧实现盖住页头标题）；
         全局 15s 节流，travel-map 六瓦片层共用一条、底部定位、4s 自动消失 */
      if (navigator.onLine === false) return;
      var now = Date.now();
      if (now - tileWarnLast < 15000) return;
      tileWarnLast = now;
      showTileWarn((name || '地图') + '瓦片加载失败，请检查网络');
    });
  }
  var tileWarnLast = 0, tileWarnEl = null, tileWarnTimer = null;
  function showTileWarn(msg) {
    if (typeof document === 'undefined' || !document.body) return;
    if (!tileWarnEl) {
      tileWarnEl = document.createElement('div');
      tileWarnEl.className = 'ui-tilewarn';
      tileWarnEl.setAttribute('role', 'status');
      tileWarnEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(tileWarnEl);
    }
    if (!document.querySelector('.bottom-nav')) tileWarnEl.classList.add('bare');
    /* 同上：文案晚一帧写，首次那条才播得出来 */
    requestAnimationFrame(function () {
      if (!tileWarnEl) return;
      tileWarnEl.textContent = msg;
      tileWarnEl.classList.add('show');
    });
    if (tileWarnTimer) clearTimeout(tileWarnTimer);
    tileWarnTimer = setTimeout(function () { if (tileWarnEl) tileWarnEl.classList.remove('show'); }, 4000);
  }

  /* P1-8 离线条（批次6）：底部导航之上常驻，online/offline 事件 + 初始 navigator.onLine 驱动；
     ui.js 载入即自动安装，所有引 ui.js 的页（含 file:// 与 APK 壳）无需逐页接线 */
  function offlineBar() {
    if (window.__uiOfflineBarOn || typeof document === 'undefined') return;
    window.__uiOfflineBarOn = true;
    var bar = null;
    function show() {
      if (!document.body) return;
      if (bar && document.body.contains(bar)) { requestAnimationFrame(function () { bar.classList.add('show'); }); return; }
      bar = document.createElement('div');
      bar.className = 'ui-offlinebar';
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      if (!document.querySelector('.bottom-nav')) bar.classList.add('bare');
      document.body.appendChild(bar);
      /* 同上：空活区先入 DOM，文案下一帧再写，「当前离线」这件事才播得出来（批次 22） */
      requestAnimationFrame(function () {
        if (!bar) return;
        bar.innerHTML = '<span class="oic">' + (window.TI ? TI('wifioff', 16) : '') + '</span>' +
          '<span>当前离线 · 已缓存内容仍可浏览，联网后自动恢复</span>';
        bar.classList.add('show');
      });
    }
    function hide() {
      if (!bar) return;
      var b = bar; bar = null;
      b.classList.remove('show');
      setTimeout(function () { b.remove(); }, motionMs('normal', 320));
    }
    window.addEventListener('offline', show);
    window.addEventListener('online', hide);
    if (navigator.onLine === false) show();
  }

  /* P1-8 错误卡（批次6）：把"加载失败 + 真实可用的重试"标准化。host=元素或选择器；
     opts.onRetry 返回 Promise/布尔：falsy 复位按钮并提示，truthy 交调用方替换 host 内容。
     未传 onRetry 时默认 location.reload()。 */
  function errorBox(host, opts) {
    opts = opts || {};
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return null;
    host.innerHTML =
      '<div class="ui-errorbox" role="alert" aria-live="assertive">' +
      '<span class="eb-ic">' + (window.TI ? TI('warn', 24) : '') + '</span>' +
      '<div class="eb-t"></div><div class="eb-d"></div>' +
      '<button class="ui-btn ui-btn-primary eb-retry" type="button"></button>' +
      '</div>';
    var btn = host.querySelector('.eb-retry');
    var label = opts.retryText || '重试';
    /* 带 role=alert 的活区先入 DOM，标题/正文/按钮字下一帧再写：
       同一次插入里既建区又填字，读屏当静态内容，出错那句话播不出来（批次 22） */
    requestAnimationFrame(function () {
      var t = host.querySelector('.eb-t'), dd = host.querySelector('.eb-d');
      if (!t || !dd || !btn) return;   /* 调用方已把卡换掉 */
      t.textContent = opts.title || '加载失败';
      dd.textContent = opts.text || '请检查网络后重试。';
      btn.textContent = label;
    });
    btn.onclick = function () {
      if (!opts.onRetry) { location.reload(); return; }
      btn.disabled = true; btn.textContent = opts.retryingText || '重试中…';
      var r;
      try { r = opts.onRetry(); } catch (e) { r = Promise.reject(e); }
      Promise.resolve(r).then(function (ok) {
        if (ok === false) {
          btn.disabled = false; btn.textContent = label;
          if (opts.onFail) opts.onFail(); else toast('仍未恢复，请稍后再试');
        } else if (host.querySelector('.ui-errorbox')) {
          /* 调用方成功却没清卡：复位按钮，不报错 */
          btn.disabled = false; btn.textContent = label;
        }
      }, function () { btn.disabled = false; btn.textContent = label; toast('重试失败，请检查网络'); });
    };
    return btn;
  }

  /* 地图标记的 accessible name（批次 22-C）：Leaflet 1.1.1 会给 marker 容器加
     tabindex="0" + role="button"，但 divIcon 的 alt 根本落不成属性（452 档实测 11 枚标记
     aria-label/alt 全 null），读屏只念得到「按钮」。名字钉在标记的 DOM 元素上；
     还没入图的挂 add 事件补。node-lod.js 比 ui.js 先载入，调用方一律带 window.UI 运行时保护。 */
  function markerLabel(m, label) {
    if (!m || !label) return;
    function set() {
      var el = m._icon || (m.getElement ? m.getElement() : null);
      if (el && el.setAttribute) el.setAttribute('aria-label', label);
    }
    if (m._icon) set();
    else if (m.on) m.on('add', set);
  }

  /* 标记的键盘激活（批次 22-C）：Leaflet 1.1.1 的 Keyboard handler 只做平移/缩放/Esc 关
     popup，聚焦标记后按 Enter 什么也不会发生——Tab 停得下来却打不开，等于只做了半个可达。
     这里把 Enter/Space 等同点一下。Space 默认会滚页，必须 preventDefault。 */
  function markerKeys(m, fn) {
    if (!m || typeof fn !== 'function') return;
    function bind() {
      var el = m._icon || (m.getElement ? m.getElement() : null);
      if (!el || !el.addEventListener || el.__uiKeys) return;
      el.__uiKeys = 1;
      el.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && e.keyCode !== 13 && e.keyCode !== 32) return;
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      });
    }
    if (m._icon) bind();
    else if (m.on) m.on('add', bind);
  }

  /* 弹层单点（批次 22-D）：抽屉/对话框此前只是 classList.add('show') 一塞了之——
     读屏进得去也出不来，Esc 无效，焦点留在背后的地图上。这里一次补齐
     role=dialog + aria-label + Esc 关闭 + 焦点归还触发元素 + aria-expanded，
     并把 Tab 圈在弹层内。开合仍认同一个 class（opts.cls，默认 'show'），各页显隐逻辑不变。
     aria-modal 只在真模态上挂（opts.modal）：locSheet 升起时地图照样能点，
     报「外面不可达」是谎报。控制器缓存在元素上，重复 UI.sheet(el) 拿同一个。 */
  function sheet(el, opts) {
    if (!el) return null;
    if (el.__uiSheet) return el.__uiSheet;
    opts = opts || {};
    var cls = opts.cls || 'show';
    /* 页面建好时就写死的 aria-label 归页面管（nearSheet 的「这一带还有什么」），
       没写的才由这里跟着内容更新（locSheet 的名字要跟着这一站走） */
    var pageLabel = !!el.getAttribute('aria-label');
    var opener = null, keyH = null, trap = null;
    function detach() { if (keyH) { document.removeEventListener('keydown', keyH); keyH = null; } }
    var api = {
      el: el,
      isOpen: function () { return el.classList.contains(cls); },
      open: function (label) {
        var lb = typeof label === 'function' ? label() : (label === undefined ? opts.label : label);
        if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
        if (!pageLabel && lb) el.setAttribute('aria-label', lb);
        /* 已经开着再调一次 = 只换内容（node-manager 的「想去」开关会重画整张卡）：
           opener / 焦点 / 监听都不重记，否则焦点会归还到一个已被 innerHTML 换掉的按钮上 */
        if (api.isOpen()) return;
        if (opts.modal) el.setAttribute('aria-modal', 'true');
        opener = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
        if (opener) opener.setAttribute('aria-expanded', 'true');
        el.classList.add(cls);
        trap = trapFocus(el, opts.focus);
        detach();
        keyH = function (e) {
          if (!api.isOpen()) { detach(); return; }   /* 别的路径关掉的：监听器自我回收，不留在文档上 */
          if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
          trap(e);
        };
        document.addEventListener('keydown', keyH);
        /* 焦点落进弹层本身（tabindex=-1），读屏从这里开始念整块内容，
           也不会在没按钮的弹层里把焦点丢回 body */
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
      },
      close: function () {
        var was = api.isOpen();
        el.classList.remove(cls);
        el.removeAttribute('aria-modal');
        detach();
        if (!was) return;
        if (opener) {
          opener.setAttribute('aria-expanded', 'false');
          /* 归还要认「还活着的那一枚」：开一趟景点卡会触发标记层整层重建（探针实测 clearLayers 1 /
             addLayer 36 / _initIcon 108 / removeIcon 36），点开它的那枚 DOM 当场离场，
             opener.focus() 静默失败（实测焦点落到 body，键盘用户从页首重新 Tab）。
             注意不是 setIcon 那条腿：vendor/leaflet 1.1.1 的 DivIcon.createIcon 复用同一枚 DIV，
             实测 setIcon 36 次、节点换手 0 次。同站点的替代者按 aria-label 找回；都找不到就交还给
             地图容器，焦点至少还停在这张图上。 */
          var back = opener;
          if (!back.isConnected) {
            var want = back.getAttribute && back.getAttribute('aria-label');
            back = (want ? document.querySelector('.leaflet-marker-icon[aria-label="' + want.replace(/["\\]/g, '\\$&') + '"]') : null) ||
              document.querySelector('.leaflet-container') || null;
          }
          if (back) { try { back.focus({ preventScroll: true }); } catch (e) { try { back.focus(); } catch (e2) {} } }
          opener = null;
        }
      }
    };
    el.__uiSheet = api;
    return api;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 图片容器（P0-2）：比例 token 防 CLS + lazy + 出错切品牌占位，永不破图 ---------- */
  /* 出错时用等尺寸占位节点原位替换 img（不删不留洞），适配任意容器（imgbox / 裸 img 缩略图） */
  function imgFail(el) {
    try {
      var st = window.getComputedStyle(el);
      var hh = el.offsetHeight || parseInt(st.height, 10) || 0;
      var ch = el.getAttribute('data-ch') || '景';
      var d = document.createElement('div');
      d.className = 'img-fallback ifb-inline';
      d.style.width = st.width;
      d.style.height = st.height;
      d.style.borderRadius = st.borderRadius;
      d.style.flex = st.flex;
      /* 无固定尺寸的裸 img（按内在尺寸撑开）出错后高度为 0，给 4/3 兜底框防止塌陷留洞 */
      if (hh < 12) { d.style.height = 'auto'; d.style.aspectRatio = '4 / 3'; if (st.width === '0px') d.style.width = '100%'; }
      d.innerHTML = '<span class="ifb-ch">' + ch + '</span>' +
        (hh >= 88 && window.TI ? '<span class="ifb-ti">' + TI('pin', 12) + '暂无实景图</span>' : '');
      el.parentNode && el.parentNode.replaceChild(d, el);
    } catch (e) { try { el.remove(); } catch (e2) {} }
  }
  function imgBox(src, name, opts) {
    opts = opts || {};
    var ch = esc((name || '景').charAt(0));
    var ph = '<div class="img-fallback"><span class="ifb-ch">' + ch + '</span>' +
      (window.TI ? '<span class="ifb-ti">' + TI('pin', 12) + esc(opts.phText || '暂无实景图') + '</span>' : '') + '</div>';
    var body = src
      ? '<img src="' + src + '" alt="' + esc(name || '') + '" loading="lazy" decoding="async" onerror="window.UI&&UI.imgFail(this)" data-ch="' + ch + '"' +
        (opts.imgStyle ? ' style="' + opts.imgStyle + '"' : '') + '>'
      : ph;
    return '<div class="imgbox ar-' + (opts.ar || 'list') + (opts.cls ? ' ' + opts.cls : '') + '">' + body + '</div>';
  }
  /* 按景点名解析实景照：本地镜像(SITE_IMAGES_LOCAL) → 远端映射(SITE_IMAGES) → 占位 */
  function siteImg(name, opts) {
    opts = opts || {};
    var src = opts.src || '';
    try {
      var lm = window.SITE_IMAGES_LOCAL || {};
      src = lm[name] || src;
      if (!src) { var m = window.SITE_IMAGES || {}; src = m[name] || ''; }
    } catch (e) {}
    return imgBox(src, name, opts);
  }

  /* P0-4：动态色板徽章底 —— 保证白字标签 ≥4.6:1。
     分类/每日色板（topic-meta dayColors、FTYPE_COLOR 等）同时喂给圆点/折线（图形级 3:1 即可）
     和 .dnt/.num/.ft 这类 10~11.5px 白字徽章（正文级需 4.5）。数据色相不动，
     在徽章渲染点用本函数把底色压深到达标，色相经 HSL 保持。 */
  function lum255(r, g, b) {
    var f = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function parseHex(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    function q(p, q2, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q2 - p) * 6 * t : t < 1 / 2 ? q2 : t < 2 / 3 ? p + (q2 - p) * (2 / 3 - t) * 6 : p; }
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q2 = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q2;
    return [Math.round(q(p, q2, h + 1 / 3) * 255), Math.round(q(p, q2, h) * 255), Math.round(q(p, q2, h - 1 / 3) * 255)];
  }
  function badge(hex) {
    var rgb = parseHex(hex);
    if (!rgb) return hex;
    var ratio = 1.05 / (lum255(rgb[0], rgb[1], rgb[2]) + 0.05);
    if (ratio >= 4.6) return hex;
    var hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]);
    for (var i = 0; i < 40 && ratio < 4.6; i++) {
      hsl[2] = Math.max(0.04, hsl[2] - 0.02);
      var c = hsl2rgb(hsl[0], hsl[1], hsl[2]);
      ratio = 1.05 / (lum255(c[0], c[1], c[2]) + 0.05);
      rgb = c;
    }
    return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* P2-7 动效编排（批次11-B）：JS 侧时序的唯一入口，值回读 design.css 的 --motion-* 阶梯。
     CSS 与 JS 各写一套时长一定漂（toast 的退场就是这个），所以这里只认 token，字面量仅当
     「这一页没载 design.css」的兜底传入。见 verify.js §19。 */
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches); } catch (e) { return false; }
  }
  function motionMs(name, fb) {
    if (reducedMotion()) return 0;
    var v = '';
    try { v = '' + getComputedStyle(document.documentElement).getPropertyValue('--motion-' + name); } catch (e) { return fb; }
    var n = parseFloat(v);
    if (!(n >= 0)) return fb;
    var t = v.trim();
    return /(^|[^m])s$/.test(t) ? n * 1000 : n;
  }
  function scrollBehavior() { return reducedMotion() ? 'auto' : 'smooth'; }
  /* View Transition 包装：减动效 / 老内核 / file:// 不支持时直接改 DOM，绝不拦导航也绝不报错。
     连着切两次阶段时前一个转场会被 abort（AbortError: Transition was skipped），这是预期行为，
     必须就地吞掉，否则它变成未捕获的 promise 拒绝，在壳里以「页面报错」的形式冒出来
     （批次 11 smoke-motion D4 抓到）。三条 promise 都要挂 catch：实测拒绝是从 ready 冒出来的，
     只 catch finished/updateCallbackDone 依然是红的。 */
  function vt(fn) {
    if (reducedMotion() || !document.startViewTransition) { fn(); return null; }
    try {
      var t = document.startViewTransition(fn);
      ['ready', 'updateCallbackDone', 'finished'].forEach(function (k) {
        var p = t && t[k];
        if (p && typeof p.catch === 'function') p.catch(function () {});
      });
      return t;
    } catch (e) { fn(); return null; }
  }

  window.UI = { toast: toast, confirm: confirm, nudge: nudge, compressImage: compressImage, tileWarn: tileWarn, esc: esc, imgFail: imgFail, imgBox: imgBox, siteImg: siteImg, badge: badge, offlineBar: offlineBar, errorBox: errorBox, reducedMotion: reducedMotion, motionMs: motionMs, scrollBehavior: scrollBehavior, vt: vt, sheet: sheet, markerLabel: markerLabel, markerKeys: markerKeys, trapFocus: trapFocus };

  /* 载入即安装离线条（幂等，见 __uiOfflineBarOn）；引 ui.js 的每个页面自动获得离线态，无需逐页接线 */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', offlineBar);
    else offlineBar();
  }
})();

/* 标签避让（2026-08-15）：地图名称标签重叠时保留高优先级，低优先级隐藏 */
window.labelAvoid = function (rootSel) {
  var root = document.querySelector(rootSel || '#mapEl');
  if (!root) return;
  var labels = Array.prototype.slice.call(root.querySelectorAll('.node-label'));
  if (labels.length < 2) return;
  function prio(el) {
    var n = el.closest('.tr-node');
    if (!n) return 0;
    if (n.classList.contains('tr-active')) return 9;
    if (n.classList.contains('tr-must')) return 7;
    if (n.classList.contains('tr-hot')) return 6;
    if (n.classList.contains('tr-user')) return 5;
    return 4;
  }
  labels.forEach(function (el) { el.classList.remove('hidden'); });
  labels.sort(function (a, b) { return prio(b) - prio(a); });
  var kept = [];
  labels.forEach(function (el) {
    var r = el.getBoundingClientRect();
    var hit = kept.some(function (k) {
      var kk = k.getBoundingClientRect();
      return !(r.right < kk.left || r.left > kk.right || r.bottom < kk.top || r.top > kk.bottom);
    });
    if (hit) el.classList.add('hidden');
    else kept.push(el);
  });
};
/* 聚合胶囊避让（2026-10-03）：屏幕空间贪心，两级降级——
 * 第一级收缩为紧凑数字徽章（lod-mini，隐去组名与必去章），
 * 仍与已保留者重叠则整颗淡化（lod-hide，保留可点，放大后 LOD 重排自然恢复）。
 * 优先级：必去多 > 数量大。node-lod 胶囊渲染后由 topic-common 调用。 */
window.capsuleAvoid = function (rootSel) {
  var root = document.querySelector(rootSel || '#mapEl');
  if (!root) return;
  var caps = Array.prototype.slice.call(root.querySelectorAll('.lod-cl'));
  if (caps.length < 2) return;
  function prio(el) {
    var m = el.querySelector('.lod-cl__m'), n = el.querySelector('.lod-cl__n');
    return (m ? parseInt(m.textContent.replace(/D/g, ''), 10) || 0 : 0) * 1000 + (n ? parseInt(n.textContent, 10) || 0 : 0);
  }
  function hit(a, b, pad) { return !(a.right + pad < b.left || a.left - pad > b.right || a.bottom + pad < b.top || a.top - pad > b.bottom); }
  caps.forEach(function (el) { el.classList.remove('lod-mini', 'lod-hide'); });
  caps.sort(function (a, b) { return prio(b) - prio(a); });
  var kept = [];
  caps.forEach(function (el) {
    var r = el.getBoundingClientRect();
    var clash = kept.some(function (k) { return hit(k._r, r, 6); });
    if (clash) {
      el.classList.add('lod-mini');
      var r2 = el.getBoundingClientRect();   /* mini 后实际占位变小，重测 */
      if (kept.some(function (k) { return hit(k._r, r2, 4); })) {
        el.classList.remove('lod-mini'); el.classList.add('lod-hide'); return;
      }
      kept.push({ _r: r2 });
    } else kept.push({ _r: r });
  });
};

