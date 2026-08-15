/* 补 patch2：插入省主题/我的节点功能（实际锚点） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const anchor = '  /* 阶段二：意图卡 + 候选 */\n  function renderIntent() {';
const insert = `  /* ---------- 偏好增强：省主题 + 我的节点（2026-08-15） ---------- */
  var provSel = '';
  function provThemes(prov) {
    var cnt = {};
    parseIndex().forEach(function (x) { if (x.region === prov) { var t = normTheme(x.theme); if (t) cnt[t] = (cnt[t] || 0) + 1; } });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 12);
  }
  window.plannerPickProv = function (prov) {
    provSel = (provSel === prov ? '' : prov);
    var box = $id('intentProvThemes');
    var bar = $id('intentProvs');
    if (!box || !bar) return;
    bar.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.p === provSel); });
    if (!provSel) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var ts = provThemes(provSel);
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:11px;color:var(--color-muted);margin-bottom:4px">' + esc(provSel) + ' 的主题（多选，并入偏好过滤）</div>' +
      (ts.length ? ts.map(function (t) { return '<span class="chip' + (state.prefs.indexOf(t) >= 0 ? ' on' : '') + '" onclick="window.plannerToggleCustomPref(\\'' + esc(t) + '\\')">' + esc(t) + '</span>'; }).join('') : '<span style="font-size:12px;color:var(--color-muted)">该省暂无主题数据</span>');
  };
  window.plannerToggleCustomPref = function (t) {
    var i = state.prefs.indexOf(t);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(t);
    renderIntent();
    if (provSel) window.plannerPickProv(provSel);
  };
  /* 【我的】节点：加入候选 */
  window.plannerAddMine = function () {
    var nodes = [];
    try { nodes = JSON.parse(localStorage.getItem('tn_userNodes') || '[]'); } catch (e) {}
    if (!nodes.length) { toast('还没有自己添加的节点，可到「节点管理」添加'); return; }
    var before = state.candidates.length;
    nodes.forEach(function (u) {
      if (u.lat == null) return;
      var k = String(+u.lat).toFixed(3) + ',' + String(+u.lng).toFixed(3);
      var dup = state.candidates.some(function (c) { return c.lat != null && String(+c.lat).toFixed(3) + ',' + String(+c.lng).toFixed(3) === k; });
      if (!dup) state.candidates.push({ name: u.name, label: u.name, region: u.province || '其他', city: u.city || '', county: '', theme: u.category || '其他', flag: '', lat: +u.lat, lng: +u.lng, __mine: true });
    });
    renderCandidates();
    toast('已加入 ' + (state.candidates.length - before) + ' 个我的节点');
  };

  /* 阶段二：意图卡 + 候选 */
  function renderIntent() {`;
if (s.includes(anchor)) {
  s = s.split(anchor).join(insert);
  fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('OK  features inserted');
} else console.log('miss');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
