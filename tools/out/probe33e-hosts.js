/* probe33e-hosts.js — 批次 33-E 地基实测：tn 族控件的尺寸「写点」有几处、各在谁身上（只读，不改产品码）
 *
 * 要量清三件事，全部先数再定修法（§39 的立论是「同一族几何被写了几遍」，而它从没读过 travel-notes.js，
 * 所以这一族在新宿主上到底有几处写点，谁都不知道）：
 *   ① 逐宿主文件抽出「选择器 → 该规则体里的尺寸声明」：design.css / travel-notes.js（注入的那份 <style>）
 *      / index.html / story.html / map.css。尺寸口径照 §39 的 GEO39：width 与 height 两族，
 *      含 min- 与 max- 前缀。
 *   ② 按「控件族」归类，只数闸门该管的那族（可点/可输入的 tn 控件 + story 翻页条 + me 最近记录行），
 *      装饰性尺寸（.tn-mic 88、.tn-ring 172、.tn-photo 64…）单独列出来但不算违规。
 *   ③ 对每条 tn 控件族的选择器，数它有几个宿主文件在写尺寸：>1 就是 §39 那族根因（值对、出处也错）。
 *
 * 选择器归一：把 design.css 的 `body ` 前缀剥掉再对账——33-B 的整套单点就是靠 `body X` 抬一档特异度
 * 压住注入 style 的同名选择器，不归一就会把「同一个控件」读成两个不同选择器，那一族的双写正好溜过去。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe33e-hosts.js > tools/out/b33e-hosts.txt 2>&1
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const rd = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; } };
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const lines = [];
const say = s => { lines.push(s); console.log(s); };

/* CSS 语境：.css 全文；.js 只吃「像样式表的那一段」（travel-notes.js 的注入 style）；.html 只吃 <style> 段 */
function cssChunks(f, src) {
  if (/\.css$/.test(f)) return [stripComments(src)];
  if (/\.html$/.test(f)) return (stripComments(src).match(/<style[\s\S]*?<\/style>/g) || [])
    .map(s => s.replace(/<\/?style[^>]*>/g, ''));
  const out = [];
  /* travel-notes.js 的那份样式表住在 `var CSS = '…'`（330→641 行 s.textContent = CSS 注入），
     串里用反斜杠续行；按 <style> 字面量去找会一段也数不到——那正是「探针探错落点」的形状。 */
  const m = stripComments(src).match(/var CSS = '([\s\S]*?)\n';/);
  if (m) out.push(m[1].replace(/\\\r?\n/g, '\n'));
  return out;
}

/* 规则体抽取：按花括号深度扫，@media/@supports 递归进内层，@keyframes 整块跳过
 * （选择器取 { 前那一段，keyframe 的 0%/50%/100% 段不算规则） */
function matchBrace(t, open) {              /* open 指向 '{'，返回配对 '}' 的下标 */
  let d = 0;
  for (let i = open; i < t.length; i++) {
    if (t[i] === '{') d++;
    else if (t[i] === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}
function rules(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const close = matchBrace(text, open);
    if (close < 0) break;
    const sel = text.slice(i, open).replace(/[\r\n\t]+/g, ' ').trim().replace(/^}/, '').trim();
    const inner = text.slice(open + 1, close);
    if (/^@media|^@supports/.test(sel)) out.push.apply(out, rules(inner));
    else if (!/^@keyframes/.test(sel) && sel && !/%\s*$/.test(sel)) out.push({ sel: sel.replace(/\s+/g, ' '), body: inner });
    i = close + 1;
  }
  return out;
}

const GEO = /(?:^|[;\s])(min-|max-)?(width|height)\s*:/;
const SIZE_DECL = /(?:^|[;{\s])(min-width|max-width|min-height|max-height|width|height)\s*:\s*([^;}]+)/g;

/* 归一：剥 body 前缀、剥 :active/.on 之类的态后缀只看主 compound，便于跨宿主对账 */
function norm(sel) {
  return sel.split(',').map(s => s.trim().replace(/^body\s+/, '').replace(/\s+/g, ' '))
    .filter(Boolean);
}

/* 只管「可点/可输入」这一族：口径取自 design.css 33-B 那几条单点 + 全站 tn 控件类名 */
const CONTROL = /(^|\s|>|\+|~|,|\.)(tn-x|tn-pill|tn-viewtab|tn-repolish|tn-tagbar|tn-style|tn-acts|tn-cfm|tn-item|tg|sn-btn|tn-editpage|tn-guide|tn-quotes|tn-listbar|tn-settings|tn-dlg|tn-wall|tn-viewer|tn-cal|meRecent|rec)\b|\bbutton\b|\binput\b|role="button"/;

const HOSTS = ['design.css', 'map.css', 'travel-notes.js', 'index.html', 'story.html', 'me.html'];
const map = {};        /* 归一选择器 → { host → [尺寸声明] } */
const perHost = {};
HOSTS.forEach(f => {
  const src = rd(f);
  const chunks = cssChunks(f, src);
  let n = 0;
  chunks.forEach(c => {
    rules(c).forEach(r => {
      const sizes = [];
      let m;
      SIZE_DECL.lastIndex = 0;
      while ((m = SIZE_DECL.exec(r.body))) sizes.push(m[1] + ':' + m[2].trim());
      if (!sizes.length) return;
      n++;
      norm(r.sel).forEach(s => {
        if (!CONTROL.test(s)) return;
        if (!map[s]) map[s] = {};
        (map[s][f] = map[s][f] || []).push(sizes.join(' '));
        if (!map[s]['__sel__']) map[s]['__sel__'] = r.sel;
      });
    });
  });
  perHost[f] = { chunks: chunks.length, sizeRules: n };
});

say('=== 每个宿主的样式段数与「带尺寸的规则条数」（含装饰性尺寸，只说明扫描有没有跑到位）===');
HOSTS.forEach(f => say('  ' + f + '：样式段 ' + perHost[f].chunks + ' 段，带尺寸的规则 ' + perHost[f].sizeRules + ' 条'));

const keys = Object.keys(map).sort();
say('');
say('=== 控件族选择器的尺寸写点（只列可点/可输入那一族）：共 ' + keys.length + ' 个选择器 ===');
const multi = [];
keys.forEach(k => {
  const hs = Object.keys(map[k]).filter(x => x !== '__sel__');
  const flag = hs.length > 1 ? '[双写]' : '    ';
  if (hs.length > 1) multi.push(k);
  say(flag + k);
  hs.forEach(h => map[k][h].forEach(v => say('      ' + h + ' → ' + v)));
});

say('');
say('=== 结论读数 ===');
say('  控件族选择器总数：' + keys.length);
say('  其中有两个及以上宿主在写尺寸的：' + multi.length + ' 个');
say('  名单：' + (multi.join(' | ') || '（无）'));

try { fs.writeFileSync(path.join(__dirname, 'b33e-hosts.txt'), lines.join('\n') + '\n'); }
catch (e) { say('落盘失败：' + e.message); }
