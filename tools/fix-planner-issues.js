/* 修复：按钮语义 + POI 补位降级提示 */
const fs = require('fs');

/* 1. planner.html：按钮文案 */
let h = fs.readFileSync('planner.html', 'utf8');
const hcrlf = h.includes('\r\n');
if (hcrlf) h = h.replace(/\r\n/g, '\n');
let n = 0;
function repH(from, to, tag) {
  if (!h.includes(from)) { console.log('SKIP', tag); return; }
  h = h.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}
repH('<button class="btn primary" id="genBtn">生成</button>', '<button class="btn primary" id="genBtn">开始规划</button>', '1a genBtn 文案');
repH('<button class="btn primary" id="scheduleBtn">生成行程</button>', '<button class="btn primary" id="scheduleBtn">▶ 开始排期</button>', '1b scheduleBtn 文案');
fs.writeFileSync('planner.html', hcrlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');

/* 2. planner.js：候选区降级提示（renderCandidates 加提示条） */
let s = fs.readFileSync('planner.js', 'utf8');
const scrlf = s.includes('\r\n');
if (scrlf) s = s.replace(/\r\n/g, '\n');
let m = 0;
function repS(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  m++;
  console.log('OK  ', tag);
}
/* renderCandidates 顶部加提示条逻辑 */
repS(
  `  function renderCandidates() {`,
  `  function renderCandidates() {
    /* 候选少且未配置高德 Key：提示可补位 */
    try {
      if (state.candidates.length < 8 && !localStorage.getItem('tn_amap_key')) {
        var hb = document.getElementById('candHint');
        if (hb) hb.style.display = 'block';
      }
    } catch (e) {}`,
  '2a cand hint logic'
);
/* 在 doRecall 的 renderCandidates 调用处重置提示状态？不需要——显示逻辑即时判断 */
fs.writeFileSync('planner.js', scrlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('planner.js patches:', m);

/* 3. planner.html：加 candHint 容器（候选区） */
let h2 = fs.readFileSync('planner.html', 'utf8');
const h2crlf = h2.includes('\r\n');
if (h2crlf) h2 = h2.replace(/\r\n/g, '\n');
const anchor = '<div id="candList"';
const hintHtml = '<div id="candHint" style="display:none;font-size:12px;color:var(--color-muted);background:var(--color-bg-soft);border-radius:10px;padding:8px 12px;margin-bottom:8px">候选较少？到「设置」配置高德 Key，可补充更多地点（POI 临时点）</div>\n';
if (h2.includes(anchor) && !h2.includes('candHint')) {
  h2 = h2.split(anchor).join(hintHtml + anchor);
  fs.writeFileSync('planner.html', h2crlf ? h2.replace(/\n/g, '\r\n') : h2, 'utf8');
  console.log('3 candHint 容器 added');
} else console.log(h2.includes('candHint') ? 'exists' : 'anchor miss');
