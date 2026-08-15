/* 收口 ③：Ai 模块 + 替换 5 处 DeepSeek 调用（travel-notes×3 / review×1 / node-manager×1） */
const fs = require('fs');
const path = require('path');

/* ===== Ai 模块文本（内嵌 travel-notes.js 顶部） ===== */
const AI_MODULE = `/* ===== Ai 统一调用模块（审核收口 ③）：DeepSeek chat/stream，全站唯一入口 ===== */
window.Ai = (function () {
  var ALIAS = { 'deepseek-chat': 'deepseek-v4-flash', 'deepseek-reasoner': 'deepseek-v4-pro' };
  function key() { try { return localStorage.getItem('tn_aiKey') || ''; } catch (e) { return ''; } }
  function model() { var r = localStorage.getItem('tn_model') || 'deepseek-v4-flash'; return ALIAS[r] || r; }
  function head() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key() }; }
  function chat(messages) {
    var body = { model: model(), messages: messages, temperature: 0.7 };
    if (model() === 'deepseek-v4-pro') body.reasoning_effort = 'high';
    return fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: head(), body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) {
        var t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (!t) throw new Error((d && d.error && d.error.message) || 'empty');
        return t;
      });
  }
  function stream(messages, onDelta) {
    var body = { model: model(), messages: messages, temperature: 0.7, stream: true };
    if (model() === 'deepseek-v4-pro') body.reasoning_effort = 'high';
    return fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: head(), body: JSON.stringify(body) })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        var reader = r.body.getReader(), decoder = new TextDecoder(), buf = '', text = '';
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) return text;
            buf += decoder.decode(res.value, { stream: true });
            var lines = buf.split('\\n'); buf = lines.pop();
            lines.forEach(function (line) {
              if (!line.startsWith('data: ')) return;
              var json = line.slice(6).trim(); if (json === '[DONE]') return;
              try { var c = JSON.parse(json).choices[0].delta; if (c && c.content) { text += c.content; if (onDelta) onDelta(c.content); } } catch (e) {}
            });
            return pump();
          });
        }
        return pump();
      });
  }
  return { chat: chat, stream: stream, hasKey: function () { return !!key(); } };
})();

`;

/* ===== 1. travel-notes.js：内嵌模块 + 3 处替换 ===== */
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
let n = 0;
function repTn(from, to, tag) {
  if (!t.includes(from)) { console.log('SKIP tn:' + tag); return; }
  t = t.split(from).join(to);
  n++;
  console.log('OK   tn:' + tag);
}
if (!t.includes('window.Ai = (function')) {
  t = AI_MODULE + t;
  console.log('OK   tn:ai module embedded');
} else console.log('SKIP tn:ai module (exists)');

/* 516：AI 语录（非流式） */
const b516 = fs.readFileSync(path.join(__dirname, '_b516.txt'), 'utf8').replace(/\r/g, '');
repTn(b516,
  `      Ai.chat(body.messages).then(function (txt) {
        var list = [];
        try { list = JSON.parse(txt.replace(/\\\`\\\`\\\`json|\\\`\\\`\\\`/g,'').trim()); }
        catch(e){ list = []; }
        if(!list.length){
          qlist.innerHTML = '<div class="empty">AI 未能生成有效结果，可换个关键词重试。</div>';
          return;
        }
        qlist.innerHTML = '<div class="hint" style="padding:4px 2px 8px;color:var(--b6)">为你找到 · '+esc(kw)+'</div>';
        list.forEach(function(it){
          if(!it || !it.t) return;
          var d = document.createElement('div');
          d.className = 'tn-quote';
          d.innerHTML = '<div class="qt">' + esc(it.t) + '</div>'
            + '<div class="qa">' + esc(it.a||'佚名') + '<span class="at"> · ' + esc(it.s||'') + '</span></div>'
            + '<span class="add">＋ 追加到正文</span>';
          d.onclick = function(){ appendQuote(it); };
          qlist.appendChild(d);
        });
      }).catch(function(err){
        qlist.innerHTML = '<div class="empty">AI 检索失败：' + esc(String(err && err.message || err)) + '。<br>请检查网络或 API key 后重试。</div>';
      });`,
  '516 quote chat');

/* 642：讲解（流式） */
const b642 = fs.readFileSync(path.join(__dirname, '_b642.txt'), 'utf8').replace(/\r/g, '');
repTn(b642,
  `      var text = '';
      Ai.stream(body.messages, function (delta) {
        text += delta;
        gBody.textContent = text;
        gBody.scrollTop = gBody.scrollHeight;
      }).then(function (full) {
        gLoad.style.display = 'none';
        showGuide(site.label || site.name || '', full);
      }).catch(function (err) {
        gLoad.style.display = 'none';
        gBody.style.display = 'block';
        gBody.textContent = '讲解生成失败：' + String(err && err.message || err) + '。请检查网络后重试。';
      });`,
  '642 guide stream');

/* 1010：润色（流式） */
const b1010 = fs.readFileSync(path.join(__dirname, '_b1010.txt'), 'utf8').replace(/\r/g, '');
repTn(b1010,
  `    Ai.stream(body.messages, function (delta) {
      ai.textContent += delta;
      ai.scrollTop = ai.scrollHeight;
    }).then(function () {
      load.style.display = 'none';
      $X(ui.panel, '#tnSave').disabled = false;
      var p = $X(ui.panel, '#tnPolish');
      p.style.display = 'block';
      p.textContent = '↻ 换风格重润';
      $X(ui.panel, '#tnNote').textContent = '润色完成：' + st.icon + st.name + '（不满意可换风格重润）';
    }).catch(function () {
      load.style.display = 'none';
      flash('润色失败（网络或 key 无效），可保存原文');
      $X(ui.panel, '#tnSave').disabled = false;
    });`,
  '1010 polish stream');

fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('travel-notes patches:', n);

/* ===== 2. review.html：年报（流式） ===== */
let r = fs.readFileSync('review.html', 'utf8');
const rcrlf = r.includes('\r\n');
if (rcrlf) r = r.replace(/\r\n/g, '\n');
/* 提取 review 的 fetch 块 */
const rlines = r.split('\n');
let rStart = -1;
for (let k = 0; k < rlines.length; k++) { if (rlines[k].includes('api.deepseek.com')) { rStart = k; break; } }
if (rStart >= 0) {
  let depth = 0, rEnd = -1;
  for (let k = rStart; k < rlines.length; k++) {
    for (const ch of rlines[k]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth <= 0 && k > rStart) { rEnd = k; break; }
  }
  const rBlock = rlines.slice(rStart, rEnd + 1).join('\n');
  const rNew = `  Ai.stream(body.messages, function (delta) {
    var el = dlg.querySelector('.txt');
    el.textContent += delta;
  }).then(function (full) {
    dlg.querySelector('.txt').textContent = full;
  }).catch(function (err) {
    fallbackLocal('（AI 生成失败：' + String(err && err.message || err) + '，已为你生成本地版年度回顾。）');
  });`;
  if (r.includes(rBlock)) {
    r = r.split(rBlock).join(rNew);
    fs.writeFileSync('review.html', rcrlf ? r.replace(/\n/g, '\r\n') : r, 'utf8');
    console.log('OK   review:year report stream');
  } else console.log('SKIP review (block mismatch)');
} else console.log('SKIP review (no fetch)');

/* ===== 3. node-manager.html：生成介绍（非流式） ===== */
let m = fs.readFileSync('node-manager.html', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const mFrom = `    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': '***' + key },
      body: JSON.stringify({
        model: (function (r) { var A = { 'deepseek-chat': 'deepseek-v4-flash', 'deepseek-reasoner': 'deepseek-v4-pro' }; return A[r] || r; })(localStorage.getItem('tn_model') || 'deepseek-v4-flash'),
        messages: [
          { role: 'system', content: '你是旅行地点编辑助手，输出简洁准确的介绍。' },
          { role: 'user', content: '为旅行地点「' + name + '」' + ([city, cat].filter(Boolean).length ? '（' + [city, cat].filter(Boolean).join('，') + '）' : '') + '写一段 60-100 字的介绍：亮点、适合季节、注意事项。口语化，不要列表编号，不要编造不确定的史实。' }
        ],
        temperature: 0.7
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (t) { document.getElementById('nmDesc').value = t.trim(); UI.toast('介绍已生成，可再手动微调'); }
      else { UI.toast('生成失败：' + ((d && d.error && d.error.message) || '未知错误')); }
    }).catch(function () { UI.toast('生成失败，请检查网络'); })
      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });`;
const mTo = `    Ai.chat([
      { role: 'system', content: '你是旅行地点编辑助手，输出简洁准确的介绍。' },
      { role: 'user', content: '为旅行地点「' + name + '」' + ([city, cat].filter(Boolean).length ? '（' + [city, cat].filter(Boolean).join('，') + '）' : '') + '写一段 60-100 字的介绍：亮点、适合季节、注意事项。口语化，不要列表编号，不要编造不确定的史实。' }
    ]).then(function (t) {
      document.getElementById('nmDesc').value = t.trim();
      UI.toast('介绍已生成，可再手动微调');
    }).catch(function () { UI.toast('生成失败，请检查网络或 Key'); })
      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });`;
if (m.includes(mFrom)) {
  m = m.split(mFrom).join(mTo);
  fs.writeFileSync('node-manager.html', mcrlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
  console.log('OK   nm:genDesc chat');
} else console.log('SKIP nm (block mismatch)');

console.log('=== ai consolidation done ===');
