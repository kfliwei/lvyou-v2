/* 收口 ③（行号法）：travel-notes 3 处替换为 Ai 调用 */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const lines = t.split('\n');

function replaceRange(startLine, count, newText) {
  const from = lines.slice(startLine - 1, startLine - 1 + count).join('\n');
  /* 校验：起点是 fetch 调用 */
  if (!from.includes('api.deepseek.com')) { console.log('MISMATCH at L' + startLine); return false; }
  lines.splice(startLine - 1, count, ...newText.split('\n'));
  console.log('OK   replaced L' + startLine + '-' + (startLine + count - 1));
  return true;
}

/* 516：AI 语录（非流式 chat） */
replaceRange(516, 30, `      Ai.chat(body.messages).then(function (txt) {
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
      });`);

/* 642：讲解（流式） */
replaceRange(642, 29, `      var text = '';
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
      });`);

/* 1010：润色（流式） */
replaceRange(1010, 47, `    Ai.stream(body.messages, function (delta) {
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
    });`);

fs.writeFileSync('travel-notes.js', crlf ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'), 'utf8');
console.log('=== travel-notes replaced ===');
