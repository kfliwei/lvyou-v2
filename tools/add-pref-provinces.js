/* 偏好增强：省→该省主题标签 两级选择 + 【我的】节点候选 */
const fs = require('fs');

/* ===== planner.html：意图卡加容器 ===== */
let h = fs.readFileSync('planner.html', 'utf8');
const hcrlf = h.includes('\r\n');
if (hcrlf) h = h.replace(/\r\n/g, '\n');
if (!h.includes('intentProvs')) {
  const anchor = 'id="intentPrefs"';
  const i = h.indexOf(anchor);
  if (i >= 0) {
    /* 在 intentPrefs 容器闭合后插入（找该 div 结束） */
    const divEnd = h.indexOf('</div>', i);
    if (divEnd > 0) {
      const insert = '\n    <div class="ph" style="font-size:11px;color:var(--color-muted);margin-top:8px">省份主题 <span style="color:var(--color-faint)">（点省 → 选该省标签，更精确）</span></div>\n    <div id="intentProvs" style="display:flex;flex-wrap:wrap;gap:6px"></div>\n    <div id="intentProvThemes" style="display:none;margin-top:6px"></div>';
      h = h.slice(0, divEnd) + insert + h.slice(divEnd);
      fs.writeFileSync('planner.html', hcrlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
      console.log('OK  html 容器');
    }
  }
} else console.log('html 容器 exists');

/* ===== planner.js ===== */
let s = fs.readFileSync('planner.js', 'utf8');
const scrlf = s.includes('\r\n');
if (scrlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. pool 支持自定义主题标签直接匹配 */
rep(
  `var isHit = !prefs || !prefs.length || prefs.some(function (p) { return prefHit(p, s.theme); });`,
  `var isHit = !prefs || !prefs.length || prefs.some(function (p) { return prefHit(p, s.theme) || normTheme(p) === normTheme(s.theme); });`,
  '1 pool custom theme'
);

/* 2. 省主题 + 我的节点 + 渲染（插在 renderIntent 前） */
rep(
  `  /* ---------- 意图卡渲染 ---------- */`,
  `  /* ---------- 偏好增强：省主题 + 我的节点（2026-08-15） ---------- */
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

  /* ---------- 意图卡渲染 ---------- */`,
  '2 features'
);

/* 3. 偏好 chips 加【我的】+ 省行渲染 */
rep(
  `    /* 偏好 chips */
    var pc = PREF_KEYS.map(function (p) { return '<span class="chip' + (state.prefs.indexOf(p) >= 0 ? ' on' : '') + '" onclick="window.plannerTogglePref(\\'' + esc(p) + '\\')">' + p + '</span>'; }).join('');
    $id('intentPrefs').innerHTML = pc;`,
  `    /* 偏好 chips（6 大类 + 我的节点） */
    var pc = PREF_KEYS.map(function (p) { return '<span class="chip' + (state.prefs.indexOf(p) >= 0 ? ' on' : '') + '" onclick="window.plannerTogglePref(\\'' + esc(p) + '\\')">' + p + '</span>'; }).join('');
    pc += '<span class="chip mine" onclick="window.plannerAddMine()">📌 我的</span>';
    $id('intentPrefs').innerHTML = pc;
    /* 省份主题行 */
    var pv = Object.keys(regionSet || {}).map(function (r) { return '<span class="chip' + (provSel === r ? ' on' : '') + '" data-p="' + esc(r) + '" onclick="window.plannerPickProv(\\'' + esc(r) + '\\')">' + esc(r) + '</span>'; }).join('');
    $id('intentProvs').innerHTML = pv;`,
  '3 chips'
);

fs.writeFileSync('planner.js', scrlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('planner.js patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
