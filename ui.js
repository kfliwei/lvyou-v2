/* ui.js — 设计内 Toast 与确认对话框（替代原生 alert/confirm）
 * 用法:
 *   UI.toast('已保存')                        // 轻提示，自动消失
 *   UI.confirm({title:'删除', text:'确定？', okText:'删除', danger:true}, function(ok){ if(ok) ... })
 */
(function () {
  function toast(msg, ms) {
    var d = document.createElement('div');
    d.className = 'ui-toast';
    d.setAttribute('role', 'status');
    d.textContent = msg;
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('show'); });
    setTimeout(function () {
      d.classList.remove('show');
      setTimeout(function () { d.remove(); }, 320);
    }, ms || 2600);
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
    function close(rs) {
      m.remove();
      document.removeEventListener('keydown', kd);
      if (cb) cb(rs);
    }
    function kd(e) { if (e.key === 'Escape') close(false); }
    ok.onclick = function () { close(true); };
    cancel.onclick = function () { close(false); };
    m.onclick = function (e) { if (e.target === m) close(false); };
    document.addEventListener('keydown', kd);
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); });
  }

  function tileWarn(layer, name) {
    var warned = false;
    layer.on('tileerror', function () {
      if (warned) return;
      warned = true;
      toast((name || '地图') + '瓦片加载失败，请检查网络');
      setTimeout(function () { warned = false; }, 20000);
    });
  }

  window.UI = { toast: toast, confirm: confirm, tileWarn: tileWarn };
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
