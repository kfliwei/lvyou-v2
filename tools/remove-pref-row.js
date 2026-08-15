/* 偏好区改造：删「偏好」行，省→主题→候选实时联动 */
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

/* 1. 模板：删「偏好」fld，📌 我的 挪到省份主题 label 旁（始终可见） */
rep(
  "    h += '<div class=\"fld\"><label>偏好</label><div class=\"chips\" id=\"intentPrefs\"></div></div>';\n    h += '<div id=\"intentProvThemes\" style=\"display:none;margin-top:6px\"></div>';",
  "    h += '<div id=\"intentProvThemes\" style=\"display:none;margin-top:6px\"></div>';\n    h += '<div class=\"chips\" style=\"margin-top:4px\"><span class=\"chip mine\" onclick=\"window.plannerAddMine()\">📌 我的节点</span></div>';",
  '1 模板删偏好行+我的独立行'
);

/* 2. 删偏好 chips 渲染段（intentPrefs 已不存在，防止 null 报错） */
rep(
  `    /* 偏好 chips（6 大类 + 我的节点） */
    var pc = PREF_KEYS.map(function (p) { return '<span class="chip' + (state.prefs.indexOf(p) >= 0 ? ' on' : '') + '" onclick="window.plannerTogglePref(\\'' + esc(p) + '\\')">' + p + '</span>'; }).join('');
    pc += '<span class="chip mine" onclick="window.plannerAddMine()">📌 我的</span>';
    $id('intentPrefs').innerHTML = pc;
`,
  '',
  '2 删偏好渲染段'
);

/* 3. 主题点击联动候选：doRecall */
rep(
  `    renderIntent();
    renderProvThemes();`,
  `    renderIntent();
    renderProvThemes();
    doRecall();`,
  '3 主题点击联动候选'
);

/* 4. 标题文案：与下方景点联动 */
rep(
  "esc(provSel) + ' 的主题（多选，并入偏好过滤）'",
  "esc(provSel) + ' 的主题（多选，下方景点实时联动）'",
  '4 联动文案'
);

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('patches:', n);
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 80)); }
