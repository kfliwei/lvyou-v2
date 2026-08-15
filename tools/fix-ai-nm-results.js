/* node-manager genDesc → Ai.chat；results.js aiCall → Ai 薄包装 */
const fs = require('fs');

/* ===== node-manager.html ===== */
let m = fs.readFileSync('node-manager.html', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
/* 提取 fetch 块 */
const ml = m.split('\n');
let md = 0, mend = -1;
for (let k = 233; k < ml.length; k++) {
  for (const ch of ml[k]) { if (ch === '{') md++; else if (ch === '}') md--; }
  if (md <= 0 && k > 233) { mend = k; break; }
}
const mFrom = ml.slice(233, mend + 1).join('\n');
if (!mFrom.includes('api.deepseek.com')) { console.log('SKIP nm (fetch not at 234)'); }
else {
  const mTo = `    Ai.chat([
      { role: 'system', content: '你是旅行地点编辑助手，输出简洁准确的介绍。' },
      { role: 'user', content: '为旅行地点「' + name + '」' + ([city, cat].filter(Boolean).length ? '（' + [city, cat].filter(Boolean).join('，') + '）' : '') + '写一段 60-100 字的介绍：亮点、适合季节、注意事项。口语化，不要列表编号，不要编造不确定的史实。' }
    ]).then(function (t) {
      document.getElementById('nmDesc').value = t.trim();
      UI.toast('介绍已生成，可再手动微调');
    }).catch(function () { UI.toast('生成失败，请检查网络或 Key'); })
      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });`;
  ml.splice(233, mend - 233 + 1, ...mTo.split('\n'));
  fs.writeFileSync('node-manager.html', mcrlf ? ml.join('\n').replace(/\n/g, '\r\n') : ml.join('\n'), 'utf8');
  console.log('OK   nm:genDesc → Ai.chat');
}

/* ===== results.js aiCall → Ai 薄包装 ===== */
let r = fs.readFileSync('results.js', 'utf8');
const rcrlf = r.includes('\r\n');
if (rcrlf) r = r.replace(/\r\n/g, '\n');
const oldCall = `  function aiCall(messages, cb, stream) {
    var key = aiKey();
    if (!key) { if (cb) cb(null, '未配置 AI key，请到 设置 → AI 润色 填入 DeepSeek key 后重试'); return; }
    var body = { model: aiModel(), messages: messages, temperature: 0.7 };
    if (aiModel() === 'deepseek-v4-pro') body.reasoning_effort = 'high';
    if (stream !== false) body.stream = true;
    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      if (stream === false) return r.json().then(function (d) { cb(d.choices[0].message.content); });
      var reader = r.body.getReader(), decoder = new TextDecoder(), buf = '', text = '';
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) { cb(text); return; }
          buf += decoder.decode(res.value, { stream: true });
          var lines = buf.split('\\n'); buf = lines.pop();
          lines.forEach(function (line) {
            if (!line.startsWith('data: ')) return;
            var json = line.slice(6).trim(); if (json === '[DONE]') return;
            try { var c = JSON.parse(json).choices[0].delta; if (c && c.content) text += c.content; } catch (e) {}
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (e) { cb(null, String(e && e.message || e)); });
  }`;
const newCall = `  function aiCall(messages, cb, stream) {
    if (!(window.Ai && Ai.hasKey())) { if (cb) cb(null, '未配置 AI key，请到 设置 → AI 润色 填入 DeepSeek key 后重试'); return; }
    if (stream === false) {
      Ai.chat(messages).then(function (t) { cb(t); }).catch(function (e) { cb(null, String(e && e.message || e)); });
      return;
    }
    Ai.stream(messages).then(function (t) { cb(t); }).catch(function (e) { cb(null, String(e && e.message || e)); });
  }`;
if (r.includes(oldCall)) {
  r = r.split(oldCall).join(newCall);
  fs.writeFileSync('results.js', rcrlf ? r.replace(/\n/g, '\r\n') : r, 'utf8');
  console.log('OK   results:aiCall → Ai');
} else {
  console.log('SKIP results (oldCall mismatch)');
}
