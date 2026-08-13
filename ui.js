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
