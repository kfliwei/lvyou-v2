/* 合并省份选择：删除独立"省份主题"行，点目的地省chip展开该省主题 */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. 模板：删省份主题 fld 行，目的地行后加主题展开容器 */
rep(
  "    h += '<div class=\"fld\"><label>偏好</label><div class=\"chips\" id=\"intentPrefs\"></div></div>';\n    h += '<div class=\"fld\"><label>省份主题 <span style=\"font-size:11px;color:var(--color-faint)\">（点省 → 选该省标签）</span></label><div class=\"chips\" id=\"intentProvs\"></div><div id=\"intentProvThemes\" style=\"display:none;margin-top:6px\"></div></div>';",
  "    h += '<div class=\"fld\"><label>偏好</label><div class=\"chips\" id=\"intentPrefs\"></div></div>';\n    h += '<div id=\"intentProvThemes\" style=\"display:none;margin-top:6px\"></div>';",
  '1 模板合并'
);

/* 2. 渲染：删独立省份行渲染，目的地 chips 带 data-p */
rep(
  `    /* 省份主题行 */
    var pv = Object.keys(regionSet || {}).map(function (r) { return '<span class="chip' + (provSel === r ? ' on' : '') + '" data-p="' + esc(r) + '" onclick="window.plannerPickProv(\\'' + esc(r) + '\\')">' + esc(r) + '</span>'; }).join('');
    $id('intentProvs').innerHTML = pv;`,
  '',
  '2 删独立省份行渲染'
);

/* 3. renderProvThemes 不再依赖 intentProvs（bar 可能为空时跳过 on 切换） */
rep(
  `    var box = $id('intentProvThemes');
    var bar = $id('intentProvs');
    if (!box || !bar) return;
    bar.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.p === provSel); });
    if (!provSel) { box.style.display = 'none'; box.innerHTML = ''; return; }`,
  `    var box = $id('intentProvThemes');
    if (!box) return;
    if (!provSel) { box.style.display = 'none'; box.innerHTML = ''; return; }`,
  '3 renderProvThemes 去 bar 依赖'
);

/* 4. 点目的地省 chip 联动展开主题 */
rep(
  `  window.plannerToggleRegion = function (r) {
    var i = state.regions.indexOf(r);
    if (i >= 0) state.regions.splice(i, 1); else state.regions.push(r);
    renderIntent(); doRecall();
  };`,
  `  window.plannerToggleRegion = function (r) {
    var i = state.regions.indexOf(r);
    if (i >= 0) state.regions.splice(i, 1); else state.regions.push(r);
    window.plannerPickProv(r); /* 联动：展开该省主题（再点收起） */
    renderIntent(); doRecall();
  };`,
  '4 目的地chip联动省主题'
);

/* 5. 主题区标题补充：展开说明放在省名里（已在标题显示 provSel） */
fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
