/* ② 修正版：历史记录(回车) + 空输入展示（实际文本） */
const fs = require('fs');
let s = fs.readFileSync('search.html', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 2a. 回车记录搜索历史 */
rep(
  `$q.onkeydown=function(e){ if(e.key==='Enter') render(); };`,
  `$q.onkeydown=function(e){ if(e.key==='Enter'){ recordHist($q.value.trim()); render(); } };`,
  '2a enter hist'
);
/* 记录函数（插在 oninput 前） */
rep(
  `$q.oninput=function(){`,
  `function recordHist(q){
  if(!q) return;
  try{
    var h=JSON.parse(localStorage.getItem('tn_search_hist')||'[]').filter(function(x){ return x!==q; });
    h.unshift(q);
    localStorage.setItem('tn_search_hist', JSON.stringify(h.slice(0,10)));
  }catch(e){}
}
$q.oninput=function(){`,
  '2a hist fn'
);

/* 2c. 空输入展示历史+最近浏览（锚点：骨架 return 后） */
rep(
  `if(!loaded){ $sk.style.display=''; $r.innerHTML='<div id="skel"></div>'; return; }`,
  `if(!loaded){ $sk.style.display=''; $r.innerHTML='<div id="skel"></div>'; return; }
  if(!state.q.trim()){
    var hist=[], rec=[];
    try{ hist=JSON.parse(localStorage.getItem('tn_search_hist')||'[]'); }catch(e){}
    try{ rec=JSON.parse(localStorage.getItem('tn_recent')||'[]'); }catch(e){}
    var html='';
    if(hist.length){
      html+='<div class="sec-t"><b>搜索历史</b><span style="font-size:11px;cursor:pointer" id="clrHist">清空</span></div><div class="chip-row" style="flex-wrap:wrap;gap:8px;padding:2px 0 10px" id="histChips">'+
        hist.map(function(w){ return '<button class="chip" data-h="'+esc(w)+'">'+esc(w)+'</button>'; }).join('')+'</div>';
    }
    if(rec.length){
      html+='<div class="sec-t"><b>最近浏览</b></div>';
      rec.forEach(function(r){
        html+='<div class="item" data-rk="'+esc(r.k)+'" data-rn="'+esc(r.n)+'" role="button" tabindex="0" aria-label="'+esc(r.n)+'"><span class="dot" style="background:#C86D4B"></span><div class="main"><div class="nm">'+esc(r.n)+'</div><div class="sub">最近查看 · 点击回看</div></div><span class="arr">›</span></div>';
      });
    }
    if(!html) html='<div class="empty" style="padding:24px 14px"><span>输入关键词搜索全部景点</span></div>';
    $r.innerHTML=html;
    $r.querySelectorAll('.chip[data-h]').forEach(function(c){
      c.onclick=function(){ $q.value=c.dataset.h; state.q=c.dataset.h; recordHist(c.dataset.h); render(); };
    });
    var clr=document.getElementById('clrHist');
    if(clr) clr.onclick=function(){ try{ localStorage.removeItem('tn_search_hist'); }catch(e){} render(); };
    $r.querySelectorAll('.item[data-rk]').forEach(function(it){
      it.onclick=function(){ location.href='topic.html?p='+it.dataset.rk+'&q='+encodeURIComponent(it.dataset.rn); };
      it.onkeydown=function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); it.onclick(); } };
    });
    return;
  }`,
  '2c hist+recent view'
);

fs.writeFileSync('search.html', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('② patches:', n);
