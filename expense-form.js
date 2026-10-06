/* expense-form.js — 「记一笔开销」表单的唯一实现（批次 24-C）
   两个宿主共用这一份：
     · expense.html 底部「记一笔」弹层（容器由页面自己走 UI.sheet 单点）
     · 随手记面板顶部的「记开销」档（面板走自己的显隐——§36 明令 travel-notes.js 里不许出现
       UI.sheet(，混用会把两套弹层口径焊在一起，所以那一档是内嵌表单而不是叠一层弹层）
   为什么值得单独一个文件：金额／分类／日期这三样各写一套，漂的第一天就是「页面上六个分类、
   面板里五个」。分类全站只有 Expense.CATS 一份，表单也只认这一份。
   分工：宿主管容器与「记到哪一趟」，本模块只管表单本身与「记在哪天」这一行真话。
   一张页面只放一个宿主，因此下面的 id（adAmt/adCats/…）写死——现有冒烟判据认的也是这些 id。 */
var ExpenseForm = (function () {
  /* 表单自己的皮肤：作用域收在 .x-form 里，宿主页面的 .btn/.chip 一律不靠——
     面板那侧的页面 CSS 与记账页不同一套，靠宿主给样式就会在两处看着不一样。
     .x-hint 不作用域：记账页在按日期的列尾也用它（小字说明是同一族读数）。 */
  var CSS = '' +
    '.x-form .x-amtrow{display:flex;align-items:baseline;gap:8px}' +
    '.x-form .x-amt{flex:1;min-width:0;min-height:56px;padding:0 14px;border:1px solid var(--color-line-strong);border-radius:14px;background:var(--color-bg);color:var(--color-ink);font-size:var(--fs-10);font-variant-numeric:tabular-nums}' +
    '.x-form .x-amt:focus{outline:none;border-color:rgba(200,109,75,.5);box-shadow:0 0 0 3px rgba(200,109,75,.12)}' +
    '.x-form .x-unit{flex:0 0 auto;font-size:var(--fs-5);color:var(--color-muted)}' +
    '.x-form .x-cats{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}' +
    /* 分类是行中要点的东西：44px 是本项目的触控口径，不是设计偏好 */
    '.x-form .chip{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 13px;border-radius:999px;border:1px solid var(--color-line);background:var(--color-surface);color:var(--color-ink-soft);font-size:var(--fs-3);cursor:pointer}' +
    '.x-form .chip.on{background:var(--color-primary);border-color:transparent;color:#fff;font-weight:600}' +
    '.x-form .x-fields{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
    '.x-form .x-fields label{flex:1 1 46%;min-width:0;display:flex;flex-direction:column;gap:4px;font-size:var(--fs-2);color:var(--color-muted)}' +
    '.x-form .x-fields input{min-width:0;height:44px;padding:0 12px;border:1px solid var(--color-line);border-radius:12px;background:var(--color-surface);color:var(--color-ink);font-size:var(--fs-4)}' +
    '.x-form .x-fields .wide{flex:1 1 100%}' +
    '.x-form .x-acts{display:flex;gap:8px;margin-top:14px}' +
    '.x-form .x-btn{min-height:44px;padding:0 18px;border-radius:13px;font-size:var(--fs-4);border:1px solid var(--color-line-strong);background:var(--color-surface);color:var(--color-ink-soft);cursor:pointer;white-space:nowrap;transition:transform var(--motion-tap) var(--ease-pop)}' +
    '.x-form .x-btn:active{transform:scale(.96)}' +
    '.x-form .x-btn.ghost{flex:0 0 auto;background:transparent}' +
    '.x-form .x-btn.primary{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;background:var(--grad-primary);border-color:transparent;color:#fff;font-weight:600;box-shadow:var(--glow-ember)}' +
    '.x-hint{font-size:var(--fs-2);color:var(--color-muted);margin-top:9px;line-height:1.6}';

  var MARKUP = '' +
    '<div class="x-amtrow">' +
      '<input class="x-amt" id="adAmt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="金额（元）" autocomplete="off">' +
      '<span class="x-unit">元</span>' +
    '</div>' +
    '<div class="x-cats" id="adCats"></div>' +
    '<div class="x-fields">' +
      '<label>日期<input id="adDate" type="date" aria-label="花钱的日期"></label>' +
      '<label>谁付的<input id="adWho" type="text" maxlength="20" placeholder="可选" aria-label="垫付人" autocomplete="off"></label>' +
      '<label class="wide">备注<input id="adNote" type="text" maxlength="60" placeholder="可选，例如「索道往返」" aria-label="备注" autocomplete="off"></label>' +
    '</div>' +
    '<div class="x-acts">' +
      '<button type="button" class="x-btn ghost" id="adCancel">取消</button>' +
      '<button type="button" class="x-btn primary" id="adSave">记上</button>' +
    '</div>' +
    '<div class="x-hint" id="adHint"></div>';

  function esc(s) { return (window.UI && UI.esc) ? UI.esc(s) : String(s == null ? '' : s); }
  function injectCSS() {
    if (injectCSS.done) return;
    injectCSS.done = true;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* 这一行必须说真话，四种情况四种说法：
     free 桶（没有行程也能记）／行程没填出发日期／早于出发（买装备、体检、订金都在这一档，
     把它说成「计划外」等于告诉用户这笔钱记错了地方）／计划内／晚于排期（多走的那几天）。 */
  function hintFor(info, date) {
    if (!info || !info.id) {
      return '这一笔还没定记到哪一趟：点上面「记到」那一行选一趟，或者记进「未编排行程」。';
    }
    if (info.id === Expense.FREE_ID) {
      return '这一笔进「' + esc(Expense.FREE_NAME) + '」桶：没有行程也能记，预算与 CSV 单独算这一桶。';
    }
    if (!info.start) return '这趟没填出发日期，所以这一笔只有真实日期可依据。它永远排在按日期的那一列里。';
    var d = Expense.dayFromStart(info.start, date), n = info.days || 0;
    if (!d) return '记在 <b>' + date + '</b>（早于出发日期 ' + esc(info.start) + '，单列成「出发前」一行）。改一下日期就能补记路上那天。';
    if (n && d <= n) return '记在 <b>' + date + '</b>（计划的第 ' + d + ' 天）。改一下日期就能补记前一天。';
    return '记在 <b>' + date + '</b>（晚于计划排期，单列成「计划外」一行）。排期只是参考，多走的那几天照样记得下。';
  }

  /* cfg: { getTrip():{id,start,days}, onSaved(item), onCancel() } */
  function render(root, cfg) {
    if (!root || !window.Expense) return null;
    cfg = cfg || {};
    injectCSS();
    root.innerHTML = '<div class="x-form">' + MARKUP + '</div>';
    var q = function (id) { return root.querySelector('#' + id); };
    var catEl = q('adCats'), amtEl = q('adAmt'), dateEl = q('adDate'),
      whoEl = q('adWho'), noteEl = q('adNote'), hintEl = q('adHint');
    var pickCat = '餐饮';

    function drawCats() {
      catEl.innerHTML = Expense.CATS.map(function (c) {
        return '<span class="chip' + (c === pickCat ? ' on' : '') + '" data-c="' + esc(c) + '" role="button" tabindex="0">' + esc(c) + '</span>';
      }).join('');
    }
    /* 高亮与提交读同一个 pickCat：分叉的坏法是「界面显示餐饮、账本存成其他」 */
    catEl.onclick = function (e) {
      var t = e.target.closest ? e.target.closest('.chip') : null;
      if (!t) return;
      pickCat = t.getAttribute('data-c');
      drawCats();
    };
    catEl.onkeydown = function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var t = e.target.closest ? e.target.closest('.chip') : null;
      if (!t) return;
      e.preventDefault();
      pickCat = t.getAttribute('data-c');
      drawCats();
    };

    function info() { return (cfg.getTrip && cfg.getTrip()) || { id: '', start: '', days: 0 }; }
    function drawHint() { hintEl.innerHTML = hintFor(info(), Expense.isoOf(dateEl.value) || Expense.todayISO()); }
    dateEl.onchange = drawHint;

    function save() {
      var n = Number(amtEl.value);
      if (!isFinite(n) || n <= 0) {
        if (window.UI && UI.toast) UI.toast('先填一个大于 0 的金额');
        amtEl.focus();
        return;
      }
      var i = info();
      if (!i.id) {
        if (window.UI && UI.toast) UI.toast('先选这一笔记到哪一趟');
        return;
      }
      var date = Expense.isoOf(dateEl.value) || Expense.todayISO();
      var it = Expense.add(i.id, Expense.dayFromStart(i.start, date) || 1, n, pickCat, whoEl.value, noteEl.value, date);
      if (!it) return;                       /* 写满时 Expense.save 已经如实报过一句，不叠第二句 */
      if (window.UI && UI.toast) UI.toast('已记 ' + Expense.fmtMoney(it.cents) + ' 元 · ' + it.cat + ' · ' + it.date);
      amtEl.value = '';
      if (cfg.onSaved) cfg.onSaved(it);
    }
    q('adSave').onclick = save;
    q('adCancel').onclick = function () { if (cfg.onCancel) cfg.onCancel(); };
    amtEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });

    drawCats();
    return {
      el: root,
      cat: function () { return pickCat; },
      /* open({date})：复位四个字段、按当前日期把「记在哪天」这一行算好。
         焦点留给宿主安排（弹层那侧 UI.sheet 会先把焦点收进层里，这里只补一次金额框）。 */
      open: function (opts) {
        var o = opts || {};
        amtEl.value = '';
        whoEl.value = ''; noteEl.value = '';
        dateEl.value = Expense.isoOf(o.date) || Expense.todayISO();
        drawCats();
        drawHint();
        var at = o.focusAmount !== false;
        if (at) setTimeout(function () { try { amtEl.focus({ preventScroll: true }); } catch (e) { amtEl.focus(); } }, 60);
      },
      amount: function () { return amtEl; },
      /* 宿主换了「记到哪一趟」之后要重算那一行说明：不能拿旧行程的出发日期说话，
         也不能顺手把用户正敲着的金额清空（清框是 open() 的活）。 */
      sync: function () { drawHint(); }
    };
  }

  return { render: render, hintFor: hintFor };
})();
