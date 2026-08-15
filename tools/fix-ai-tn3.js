/* 最后 1 处：语录搜索（当前 L669） */
const fs = require('fs');
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const lines = t.split('\n');
/* 提取块行数 */
let d = 0, end = -1;
for (let k = 668; k < lines.length; k++) {
  for (const ch of lines[k]) { if (ch === '{') d++; else if (ch === '}') d--; }
  if (d <= 0 && k > 668) { end = k; break; }
}
const count = end - 668 + 1;
const from = lines.slice(668, 668 + count).join('\n');
if (!from.includes('api.deepseek.com')) { console.log('MISMATCH at 669'); process.exit(1); }
const to = `      Ai.chat(body.messages).then(function (txt) {
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
      });`;
lines.splice(668, count, ...to.split('\n'));
fs.writeFileSync('travel-notes.js', crlf ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'), 'utf8');
console.log('OK quote chat L669 (' + count + ' lines)');
