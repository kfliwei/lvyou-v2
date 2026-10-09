/* tools/out/probe47-counts.js — §47 锚点取数探针（从 verify.js 里 eval 出那把共享剥刀，不手抄） */
const fs = require('fs');
const V = fs.readFileSync('tools/verify.js', 'utf8');
const def = V.match(/function stripBlockComments\(s\) \{[\s\S]*?\n\}/)[0];
eval(def);
const ws = s => s.replace(/\s+/g, ' ');
const flat = f => ws(stripBlockComments(fs.readFileSync(f, 'utf8')));
const cnt = (t, n) => t.split(n).length - 1;

const t = flat('sync-webdav.js');
const RE47E = /\b(?:WebDAV\.)?(confirmPush|pushAuto|coverPlan)\s*\(/g;
console.log('家族命中 =', (t.match(RE47E) || []).join(' | '));

const tn = flat('travel-notes.js');
console.log('closePanel 旧刀 [;(] 命中 =', (tn.match(/closePanel\s*[;(]/g) || []).length);
console.log('closePanel 原刀 ( 命中 =', (tn.match(/closePanel\s*\(/g) || []).length);
console.log('CAL [;(] on synth =', ('  function closePanel(force) { x.onclick = closePanel; closePanel(); }').match(/closePanel\s*[;(]/g) || []);
console.log('篇游记 needle =', cnt(tn, '篇游记，图册/行程/账目/设置都没动'), '| 带引号 =', cnt(tn, "'篇游记，图册/行程/账目/设置都没动'"));

const s = flat('settings.html');
console.log("settings 引号串 '清除全部数据' =", cnt(s, "'清除全部数据'"), '| </button> 形 =', cnt(s, '清除全部数据</button>'));

const sm = fs.readFileSync('tools/smoke-irreversible.js', 'utf8');
console.log('scheduleSync(400) =', cnt(sm, "await page.evaluate('WebDAV.scheduleSync(400)')"));
console.log('classList.contains tn-cfm =', cnt(sm, "m.classList.contains('tn-cfm') ? 'tn-cfm' : 'ui-modal'"));
console.log('checks >= 57 =', cnt(sm, 'checks >= 57'));
