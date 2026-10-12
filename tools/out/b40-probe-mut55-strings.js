const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const EOL = f => ((rd(f).match(/\r\n/g) || []).length > 0 ? '\r\n' : '\n');
const eol = (s, f) => s.replace(/\r\n/g, '\n').replace(/\n/g, EOL(f));
const P = [];
const q = (f, s) => P.push([f, s]);

/* ---- ⓪ 自指纪律 ---- */
q('tools/verify.js', 'const flat55 = s => ws55(stripBlockComments(s));');
q('tools/verify.js', 'const view55 = f => /\\.md$/.test(f) ? ws55(rd55(f)) : flat55(rd55(f));');
q('tools/verify.js', "if (V55[p[0]].indexOf(p[1]) < 0) F55('盲区哨兵");
/* ---- ① ② 表与循环 ---- */
q('tools/verify.js', "if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'number' || typeof a[3] !== 'string') {\n      F55('A55 有一条");
q('tools/verify.js', "if (!Array.isArray(a) || a.length !== 4 || typeof a[1] !== 'string' || typeof a[2] !== 'string' || typeof a[3] !== 'string') {\n      F55('ZERO55 有一条");
q('tools/verify.js', "if (!(f in V55)) { F55('A55 登记了 §55 没读的文件");
q('tools/verify.js', "if (!(f in V55)) { F55('ZERO55 登记了 §55 没读的文件");
q('tools/verify.js', 'if (cnt55(flat55(ctrl), needle) < 1) F55');
q('tools/verify.js', "['topic-common.js', 'function canonThemes() {', 1,");
q('tools/verify.js', "['topic-common.js', 'canonThemes();', 1,");
/* ---- ③(a) ---- */
q('tools/verify.js', 'const PAGE_MIN55 = 30, SITE_MIN55 = 7000;');
q('tools/verify.js', 'if (pages < PAGE_MIN55) F55');
q('tools/verify.js', 'if (sites < SITE_MIN55) F55');
q('tools/verify.js', "if (!(CAL55.length === 1 && CAL55[0] === n55('古建寺院'))) F55");
q('tools/verify.js', 'if (CALK55.length !== 1) F55');
q('tools/verify.js', 'if (aliasGray !== 0) F55');
q('tools/verify.js', 'if (aliasKeyLeft !== 0) F55');
q('tools/verify.js', 'if (majorDead !== 0) F55');
q('tools/verify.js', 'if (dupCanon !== 0) F55');
q('tools/verify.js', 'if (allDeadPages !== 0) F55');
q('tools/verify.js', 'if (!(aliasGrayRaw > 0)) F55');
q('tools/verify.js', 'if (!(majorDeadRaw > 0)) F55');
/* ---- ③(b) ---- */
q('tools/verify.js', 'if (m55.length !== 2) F55');
q('tools/verify.js', 'if (!/innerHeight|scrollHeight/.test(flat55(SYN2))) F55');
q('tools/verify.js', 'if (AE === null) F55');
q('tools/verify.js', 'if (SPY === null) F55');
q('tools/verify.js', "if (cnt55(SPY, 'atEnd()') !== 1) F55");
/* ---- ④ ---- */
q('tools/verify.js', 'for (let i = 0; i <= 20; i++) {');
q('tools/verify.js', 'if (cnt55(S, "ok(\'S20\'") !== 1) F55');
q('tools/verify.js', "const SEG55 = (rd55('tools/verify.js').split('/* ④ 两条常驻腿的齐备检 */')[1] || '');");
q('tools/verify.js', 'const BOUND55 = (SEG55.match(/for \\\\(let i = 0; i <= (\\\\d+); i\\\\+\\\\+\\\\)/) || [])[1];');
q('tools/verify.js', "const BOUND55 = (SEG55.match(/for \\(let i = 0; i <= (\\d+); i\\+\\+\\)/) || [])[1];");
q('tools/verify.js', "'无脚本错误', '本腿条数守卫（≥18 条）'];");
q('tools/verify.js', 'if (cnt55(N, "ok(\'") !== NAMES55.length) F55');
q('tools/verify.js', "if (V55['README.md'].indexOf('§55') < 0) F55");
q('tools/verify.js', "['smoke-nodes.js', 'smoke-story-map.js'].forEach(f => {");
q('tools/verify.js', 'if (cnt55(N, "ok(\'") !== NAMES55.length)');
/* ---- 产品：topic-common.js ---- */
q('topic-common.js', 'function normTheme(t) { return (window.THEME_ALIAS && window.THEME_ALIAS[t]) || t; }');
q('topic-common.js', "function tk(s) { return normTheme(s[M.themeKey || 'theme']); }");
q('topic-common.js', 'function colorOf(s) { return M.themes[tk(s)] || "#7D7970"; }');
q('topic-common.js', 'if (state.theme && tk(s) !== state.theme) return false;');
q('topic-common.js', "function isMajorSite(s) { return (M.majorThemes || []).indexOf(tk(s)) >= 0 || (s.flag && s.flag.indexOf('m') >= 0); }");
q('topic-common.js', 'function canonThemes() {');
q('topic-common.js', 'canonThemes();');
q('topic-common.js', 'if (M.themes) M.themes = mapKeys(M.themes);');
q('topic-common.js', 'if (M.themeIcons) M.themeIcons = mapKeys(M.themeIcons);');
q('topic-common.js', 'Object.keys(src || {}).forEach(function (t) { var n = normTheme(t); if (out[n] == null) out[n] = src[t]; });');
q('topic-common.js', 'M.themeOrder.forEach(function (t) { var n = normTheme(t); if (order.indexOf(n) < 0) order.push(n); });');
q('topic-common.js', 'M.majorThemes.forEach(function (t) { var n = normTheme(t); if (mt.indexOf(n) < 0) mt.push(n); });');
q('topic-common.js', 'if (!SITES.some(function (s) { return tk(s) === th; })) return;');
q('topic-common.js', 'var cc = mkChip(th, false, M.themes[th]);');
q('topic-common.js', "  function canonThemes() {\n"});
q('topic-common.js', "    canonThemes();\n"});
q('topic-common.js', "    canonThemes();\r\n");
q('topic-common.js', 'canonThemes();\n');
q('topic-common.js', 'var ok = 1; canonThemes();');
/* init 附近与 chip 构建附近的上下文 */
q('topic-common.js', "  var CHAIN;");
/* ---- 产品：story.html ---- */
q('story.html', 'function atEnd(){');
q('story.html', 'var maxS=document.documentElement.scrollHeight-window.innerHeight;');
q('story.html', 'return maxS>4&&window.scrollY>=maxS-4;');
q('story.html', 'if(best>=0&&els.length&&atEnd())best=els.length-1;');
q('story.html', 'if(best>=0 && best!==lastActive){ lastActive=best; setActive(best); }');
/* ---- 腿 ---- */
q('tools/smoke-nodes.js', "ok('每颗主题 chip 在本页至少命中 1 个景点'");
q('tools/smoke-nodes.js', 'total >= 18');
q('tools/smoke-nodes.js', "'var A=window.THEME_ALIAS||{},M=window.TOPIC_META||{},S=window.SITES||[];'");
q('tools/smoke-nodes.js', 'filter(x => x.textContent.trim() === l)[0]');
q('tools/smoke-nodes.js', '}, shape.order);');
q('tools/smoke-story-map.js', 'total >= 20');
q('tools/smoke-story-map.js', "s2.segs.filter(function (x) { return x === '#ae5738/solid'; }).length === 3");
q('tools/smoke-irreversible.js', 'hstate: JSON.stringify(history.state || null)');
q('tools/smoke-irreversible.js', "e1.hstate.indexOf('tnEdit') >= 0");
/* ---- 配色 / 名单 ---- */
q('topic-meta.js', "'江河湖泊': '#3E7CB1', '古城古镇': '#8A5A44'");
q('topic-meta.js', "'古城古镇': '#8A5A44', '宗教圣地': '#96472F'");
q('topic-meta.js', "'红色遗迹': '#AE5738'}, themeIcons");
q('topic-meta.js', "window.THEME_ALIAS = {");
q('topic-meta.js', 'THEME_ALIAS');
q('topic-meta.js', 'themeOrder');
q('README.md', '§55');
q('README.md', 'smoke-nodes.js');
q('README.md', 'smoke-story-map.js');

P.forEach(([f, s]) => {
  const n = rd(f).split(eol(s, f)).length - 1;
  console.log(n + ' | ' + f + ' | EOL=' + JSON.stringify(EOL(f)) + ' | ' + JSON.stringify(s.slice(0, 54)));
});
