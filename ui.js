/* ui.js — 设计内 Toast 与确认对话框（替代原生 alert/confirm）
 * 用法:
 *   UI.toast('已保存')                        // 轻提示，自动消失
 *   UI.confirm({title:'删除', text:'确定？', okText:'删除', danger:true}, function(ok){ if(ok) ... })
 */
(function () {
  function toast(msg, ms, action) {
    var d = document.createElement('div');
    d.className = 'ui-toast';
    d.setAttribute('role', 'status');
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
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('show'); });
    setTimeout(function () {
      d.classList.remove('show');
      setTimeout(function () { d.remove(); }, 320);
    }, ms || (action && action.text ? 5000 : 2600));
  }

  function confirm(o, cb) {
    if (typeof o === 'string') o = { text: o };
    var m = document.createElement('div');
    m.className = 'ui-modal-mask';
    m.innerHTML =
      '<div class="ui-modal" role="alertdialog" aria-modal="true" aria-label="' + (o.title || '提示') + '">' +
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
    function close(rs) {
      m.remove();
      document.removeEventListener('keydown', kd);
      try { if (opener && opener.focus) opener.focus(); } catch (e) {}
      if (cb) cb(rs);
    }
    function kd(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key === 'Tab') { /* 焦点圈定在对话框内 */
        var f = m.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    ok.onclick = function () { close(true); };
    cancel.onclick = function () { close(false); };
    m.onclick = function (e) { if (e.target === m) close(false); };
    document.addEventListener('keydown', kd);
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); ok.focus(); });
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
      document.body.appendChild(tileWarnEl);
    }
    if (!document.querySelector('.bottom-nav')) tileWarnEl.classList.add('bare');
    tileWarnEl.textContent = msg;
    requestAnimationFrame(function () { tileWarnEl && tileWarnEl.classList.add('show'); });
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
      bar.innerHTML = '<span class="oic">' + (window.TI ? TI('wifioff', 16) : '') + '</span>' +
        '<span>当前离线 · 已缓存内容仍可浏览，联网后自动恢复</span>';
      document.body.appendChild(bar);
      requestAnimationFrame(function () { bar && bar.classList.add('show'); });
    }
    function hide() {
      if (!bar) return;
      var b = bar; bar = null;
      b.classList.remove('show');
      setTimeout(function () { b.remove(); }, 320);
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
      '<div class="ui-errorbox" role="alert">' +
      '<span class="eb-ic">' + (window.TI ? TI('warn', 24) : '') + '</span>' +
      '<div class="eb-t"></div><div class="eb-d"></div>' +
      '<button class="ui-btn ui-btn-primary eb-retry" type="button"></button>' +
      '</div>';
    host.querySelector('.eb-t').textContent = opts.title || '加载失败';
    host.querySelector('.eb-d').textContent = opts.text || '请检查网络后重试。';
    var btn = host.querySelector('.eb-retry');
    var label = opts.retryText || '重试';
    btn.textContent = label;
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

  window.UI = { toast: toast, confirm: confirm, tileWarn: tileWarn, esc: esc, imgFail: imgFail, imgBox: imgBox, siteImg: siteImg, badge: badge, offlineBar: offlineBar, errorBox: errorBox };

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

