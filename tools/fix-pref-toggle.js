/* 修复：拆出 renderProvThemes（纯渲染），PickProv=toggle 入口，toggleCustomPref 调纯渲染 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

/* 1. 移除所有探针 */
const probes = [
  "    try { console.log('[pref] before render: provSel=' + JSON.stringify(provSel)); } catch (e) {}\n",
  "    try { console.log('[pref] after render: provSel=' + JSON.stringify(provSel)); } catch (e) {}\n",
  "    try { console.log('[pref] t=' + t + ' prefs=' + state.prefs.join(',') + ' provSel=' + provSel); } catch (e) {}\n",
  "    try { console.log('[pref] after: on=' + document.querySelectorAll('#intentProvThemes .chip.on').length); } catch (e) {}\n",
  "    try { console.log('[pick] prov=' + provSel + ' ts=' + ts.length + ' box=' + !!box + ' bar=' + !!bar); } catch (e) {}\n"
];
let removed = 0;
probes.forEach(p => { if (s.includes(p)) { s = s.split(p).join(''); removed++; } });
console.log('探针移除:', removed);

/* 2. 重构 PickProv → toggle + renderProvThemes */
const oldPick = `  window.plannerPickProv = function (prov) {
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
  };`;
const newPick = `  /* 纯渲染（按当前 provSel） */
  function renderProvThemes() {
    var box = $id('intentProvThemes');
    var bar = $id('intentProvs');
    if (!box || !bar) return;
    bar.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.p === provSel); });
    if (!provSel) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var ts = provThemes(provSel);
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:11px;color:var(--color-muted);margin-bottom:4px">' + esc(provSel) + ' 的主题（多选，并入偏好过滤）</div>' +
      (ts.length ? ts.map(function (t) { return '<span class="chip' + (state.prefs.indexOf(t) >= 0 ? ' on' : '') + '" onclick="window.plannerToggleCustomPref(\\'' + esc(t) + '\\')">' + esc(t) + '</span>'; }).join('') : '<span style="font-size:12px;color:var(--color-muted)">该省暂无主题数据</span>');
  }
  /* 点省：toggle 展开/收起 */
  window.plannerPickProv = function (prov) {
    provSel = (provSel === prov ? '' : prov);
    renderProvThemes();
  };`;
if (s.includes(oldPick)) {
  s = s.split(oldPick).join(newPick);
  console.log('PickProv 重构完成');
} else console.log('SKIP PickProv 重构');

/* 3. toggleCustomPref 调纯渲染 */
const oldToggle = `    renderIntent();
    if (provSel) window.plannerPickProv(provSel);`;
const newToggle = `    renderIntent();
    renderProvThemes();`;
if (s.includes(oldToggle)) {
  s = s.split(oldToggle).join(newToggle);
  console.log('toggle 改调 renderProvThemes');
} else console.log('SKIP toggle');

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
