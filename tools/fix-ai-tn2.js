/* travel-notes 剩余 2 处替换（当前行号 559 讲解 / 685 语录） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const lines = t.split('\n');
function rep(s, c, txt, tag) {
  const from = lines.slice(s - 1, s - 1 + c).join('\n');
  if (!from.includes('api.deepseek.com')) { console.log('MISMATCH', tag, 'L' + s); return; }
  lines.splice(s - 1, c, ...txt.split('\n'));
  console.log('OK  ', tag, 'L' + s);
}
rep(559, 29, `      var text = '';
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
      });`, 'guide stream');
rep(685, 28, `      Ai.chat(body.messages).then(function (txt) {
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
      });`, 'quote chat');
fs.writeFileSync('travel-notes.js', crlf ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'), 'utf8');
console.log('=== done ===');
