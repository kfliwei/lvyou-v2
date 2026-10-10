/* 批次 33-E 地基探针：§39 那把扫得着面板串吗
   三问，逐条落读数：
     Q1 travel-notes.js 里「斜杠星」有 126 处，多少处在字符串里（=CSS）多少处是真 JS 注释？
        §39 的 flat39 是 naive 剥注释，字符串里的开注释符会一路吃到下一个闭注释符，把中间真 CSS 吞掉
        ——吞掉的宽度声明扫不到，「各页只留皮肤」那条判据就成假绿。
     Q2 面板触控族（.tn-x/.tn-pill/.tn-viewtab/.tn-repolish/.tn-tagbar button/.tn-listbar input）
        注入串里今天还有几处 width:/height:/min-* ？design.css 那三条单点是不是唯一出处？
        verify.js 现在给这三条单点钉了几根锚？
     Q3 me.html .entry .ic 同选择器两条规则（34/40）——同名两处靠加载顺序取胜，是不是 §39 根因形状？
   只读数，不改盘。 */
const fs = require('fs');

const ws = s => s.replace(/\s+/g, ' ').trim();
/* 字符串感知的剥块注释：verify.js:5145 那把刀的副本（此处自包含，便于看它跟 naive 的差） */
function stripSmart(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === q) { out += q; i++; break; }
        out += src[i++];
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? src.length : e + 2;
      continue;
    }
    out += c; i++;
  }
  return out;
}
const stripNaive = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- Q1 ---------- */
const TN = fs.readFileSync('travel-notes.js', 'utf8');
const inStr = stripSmart(TN);
const naive = stripNaive(TN);
const smart = ws(inStr);

const opens = (TN.match(/\/\*/g) || []).length;
// 智能剥完之后，串里还剩多少 /*？剩下的就是「在字符串里」的那些
const leftInString = (inStr.match(/\/\*/g) || []).length;
console.log('Q1 travel-notes.js：/* 共 ' + opens + ' 处，其中在字符串字面量里（=CSS 内容）' + leftInString + ' 处，真 JS 块注释 ' + (opens - leftInString) + ' 处');
console.log('Q1 naive 剥完剩 ' + naive.length + ' 字符，智能剥完（归一后）剩 ' + smart.length + ' 字符，差 ' + (smart.length - ws(naive).length) + ' 字符被 naive 那把刀连 CSS 一起吞掉');

/* 被吞掉的到底是什么？把两种视图各自抽 .tn-x 规则体来比 */
function bodies(src, sel) {
  const out = [];
  for (let i = src.indexOf(sel); i >= 0; i = src.indexOf(sel, i + 1)) {
    const a = src.indexOf('{', i), b = src.indexOf('}', a);
    if (a < 0 || b < 0) break;
    out.push(src.slice(i, b + 1));
  }
  return out;
}
const FAM = ['.tn-x', '.tn-pill', '.tn-viewtab', '.tn-repolish', '.tn-tagbar button', '.tn-listbar input'];
const GEO = /width\s*:|height\s*:/;
console.log('\nQ1b 面板族在两种视图下的规则体条数（选择器只在那份 <style> 字符串里，naive 视图应当看不见）');
FAM.forEach(sel => {
  const nN = bodies(ws(naive), sel + '{').length;
  const nS = bodies(smart, sel + '{').length;
  console.log('  ' + sel.padEnd(20) + ' naive ' + String(nN).padStart(2) + ' 条 / 智能 ' + String(nS).padStart(2) + ' 条' + (nN < nS ? '   <-- naive 失明' : ''));
});

/* ---------- Q2 ---------- */
console.log('\nQ2 注入串里面板族的尺寸声明（智能视图，这才是页面真正会用到的字面量）');
let famDecl = 0, famRules = 0;
FAM.forEach(sel => {
  bodies(smart, sel + '{').forEach(b => {
    famRules++;
    const m = b.match(/(?:min-|max-)?(?:width|height)\s*:\s*[^;}]+/g) || [];
    if (m.length) { famDecl += m.length; console.log('  [' + sel + '] ' + m.join(' ; ')); }
  });
});
console.log('  → ' + FAM.length + ' 个选择器抽到 ' + famRules + ' 条规则体，其中尺寸声明 ' + famDecl + ' 处');

/* design.css 那三条单点 */
const D = fs.readFileSync('design.css', 'utf8');
const SING = [
  'body .tn-x{width:44px;height:44px;flex:0 0 auto}',
  'body .tn-listbar input,body .tn-quotes .sr input{min-height:44px}',
];
const V = fs.readFileSync('tools/verify.js', 'utf8');
console.log('\nQ2b design.css 单点串在场 / verify.js 里被锚了几次');
SING.concat(['body .tn-pill,body .tn-viewtab']).forEach(s => {
  const inCss = ws(D).includes(s) ? 'YES' : 'NO';
  const anchors = (V.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log('  ' + s.slice(0, 46).padEnd(48) + ' design.css ' + inCss + ' / verify.js 命中 ' + anchors + ' 次（含本节自己的文字）');
});
FAM.forEach(sel => {
  const c = (V.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log('  类名 ' + sel.padEnd(20) + ' verify.js 命中 ' + c + ' 次');
});

/* 浏览器侧：面板 44 地板有没有闸门腿 */
['smoke-topbar.js', 'smoke-layer.js', 'smoke-cal.js', 'smoke-viewer.js', 'smoke-travel-notes.js', 'smoke.js'].forEach(f => {
  const p = 'tools/' + f;
  if (!fs.existsSync(p)) { console.log('  (无 ' + f + ')'); return; }
  const src = fs.readFileSync(p, 'utf8');
  const hits = src.match(/\.tn-x|tn-pill|tn-viewtab|44/g) || [];
  console.log('  ' + f.padEnd(24) + ' 44/tn-* 相关 token ' + hits.length + ' 个，含 tn- 的：' + (src.match(/\.tn-[a-z]+/g) || []).filter((v, i, a) => a.indexOf(v) === i).join(','));
});

/* ---------- Q3 ---------- */
console.log('\nQ3 me.html .entry .ic 同选择器多规则');
const ME = fs.readFileSync('me.html', 'utf8');
bodies(ws(ME), '.entry .ic{').forEach((b, k) => console.log('  #' + (k + 1) + ' ' + b.slice(0, 92)));
const styleBlocks = ME.match(/<style[\s\S]*?<\/style>/g) || [];
console.log('  me.html <style> 块 ' + styleBlocks.length + ' 个；design.css 在 head 第 ' + (ME.indexOf('design.css') >= 0 ? '有' : '无') + '，me.html 内联 style 起始位 ' + ME.indexOf('<style') + ' vs link design.css 起始位 ' + ME.indexOf('design.css'));
console.log('  verify.js FILES39 是否含 me.html：' + (/FILES39[\s\S]{0,400}'me\.html'/.test(V) ? 'YES' : 'NO'));
console.log('  verify.js FILES39 是否含 travel-notes.js：' + (/FILES39[\s\S]{0,400}'travel-notes\.js'/.test(V) ? 'YES' : 'NO'));
