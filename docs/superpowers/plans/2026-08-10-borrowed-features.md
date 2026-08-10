# 借鉴功能 8 项 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从同类项目借鉴 8 个功能/UI，全部落在现有代码上：Obsidian 地图打通 / 今日重现 / 足迹统计+streak+省热力 / 轨迹回放 / 按标签着色节点 / AI 年度报告 / 每日心情 / 逆地理编码补全。

**Architecture:** 纯前端无构建。改动集中在 5 个文件：`vault.js`（Obsidian/GPX 导出）、`review.html`（今日重现/统计/年度报告/心情）、`travel-map.html`（回放/着色）、`travel-notes.js`（逆地理编码）、`settings.html`（补全按钮）。不新增后端、不加依赖（逆地理用 BigDataCloud 免费无 key API）。

**Tech Stack:** 原生 JS、Leaflet、IndexedDB、DeepSeek API、BigDataCloud reverse-geocode。

**验证约定**（本仓库无测试框架）：
- JS 语法：`node --check <file>`；HTML 内联脚本用「提取后 node --check」。
- 结构：grep 确认注入点。
- 运行时人工验收（用户实机，深色/浅色各过一遍）。

---

## 任务 1：Obsidian 地图打通（vault.js）

**Files:**
- Modify: `vault.js`（`mdFor` frontmatter 加 `coordinates`；`buildVault` 生成整库 GPX 轨迹）

- [ ] **Step 1: frontmatter 对齐 obsidian-map-view**

`vault.js` 的 `mdFor()` 中，在
```js
      (n.lng != null ? 'lng: ' + n.lng : null),
```
后插入一行：
```js
      (n.lat != null ? 'coordinates: ' + escYaml('' + n.lat + ', ' + n.lng) : null),
```
这样导出的每篇 YAML 同时有 `lat`/`lng`（自家用）和 `coordinates: "lat, lng"`（obsidian-map-view 识别）。

- [ ] **Step 2: buildVault 生成整库 GPX 轨迹**

`vault.js` 的 `buildVault()` 中，在
```js
    files['README.md'] = [
```
之前插入：
```js
    /* 整库轨迹 GPX（供 Obsidian advanced-maps / 其他工具加载） */
    var gpxPts = sorted.filter(function (n) { return n.lat != null && n.lng != null; });
    if (gpxPts.length >= 2) {
      function gx(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      var gl = ['<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="行迹 TRACE" xmlns="http://www.topografix.com/GPX/1/1">',
        '  <trk><name>我的旅程轨迹</name><trkseg>'];
      gpxPts.forEach(function (n) {
        var t = n.ts ? new Date(n.ts).toISOString() : '';
        gl.push('    <trkpt lat="' + n.lat + '" lon="' + n.lng + '">' + (t ? '<time>' + t + '</time>' : '') + '<name>' + gx(n.title || n.siteName || '') + '</name></trkpt>');
      });
      gl.push('  </trkseg></trk>', '</gpx>');
      files['我的旅程轨迹.gpx'] = gl.join('\n');
    }
```

- [ ] **Step 3: 验证**

Run: `node --check vault.js`
Expected：无输出、退出码 0。

- [ ] **Step 4: 提交**

```bash
git add vault.js
git commit -m "feat: Obsidian 地图打通 — frontmatter 对齐 coordinates，整库导出 GPX 轨迹"
```

---

## 任务 2：今日重现（review.html）

**Files:**
- Modify: `review.html`

- [ ] **Step 1: 加容器**

`review.html` 中，在
```html
    <div class="stats" id="stats"></div>
```
后插入：
```html
    <div id="todayBox" style="display:none"></div>
```

- [ ] **Step 2: 加渲染函数与调用**

`review.html` 脚本中，在 `renderStats` 之前插入：
```js
function renderToday(){
  var box = document.getElementById('todayBox');
  var now = new Date();
  var md = pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var hits = notes.filter(function (n) {
    var d = dayOf(n);
    return d.slice(5) === md && d.slice(0, 4) !== String(now.getFullYear());
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (!hits.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="eyebrow">今日重现 · ' + md + '</div>' + hits.slice(0, 6).map(function (n) {
    return '<div class="md-item"><h3>' + esc(n.title || n.siteName || '未命名') + ' <span style="font-size:12px;color:var(--color-muted)">' + (n.date || dayOf(n) || '').slice(0, 4) + '</span></h3>' +
      '<div class="meta">' + esc(n.date || '') + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>' +
      '<div class="txt">' + esc((n.text || n.raw || '').slice(0, 160)) + '</div></div>';
  }).join('');
}
```
在 `render()` 里 `renderStats();` 后加 `renderToday();`。

- [ ] **Step 3: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-rv.js',s)" && node --check .tmp-rv.js && echo OK && rm -f .tmp-rv.js
```
Expected：`OK`。

- [ ] **Step 4: 提交**

```bash
git add review.html
git commit -m "feat: 回顾页「今日重现」— 展示往年今天（同日不同年）的记忆"
```

---

## 任务 3：足迹统计 + streak + 省份热力（review.html）

**Files:**
- Modify: `review.html`

- [ ] **Step 1: 加第二统计行 + 省份热力区**

`review.html` 中，在 `<div class="stats" id="stats"></div>` 后插入：
```html
    <div class="stats" id="stats2"></div>
```
在 `<div class="sec"><div class="sec-title">月份分布</div>...` 之前插入：
```html
    <div class="sec"><div class="sec-title">省份足迹</div><div class="provbar" id="provBar"></div></div>
```

- [ ] **Step 2: CSS**

`review.html` 的 `<style>` 中 `.places span{...}` 后追加：
```css
  .provbar{display:flex;flex-wrap:wrap}
  .prov{display:inline-flex;align-items:center;gap:4px;margin:4px 6px 4px 0;padding:6px 12px;border-radius:999px;background:var(--color-primary);color:#fff;font-size:11.5px}
  .prov b{font-weight:700;margin-left:2px}
```

- [ ] **Step 3: JS：streak + 第二统计行 + 省热力**

`review.html` 脚本中，在 `renderStats` 后插入：
```js
function maxStreak(){
  var days = Object.keys(dayMap).sort(), best = 0, cur = 0, prev = null;
  days.forEach(function (d) {
    if (prev) {
      var a = new Date(prev + 'T00:00:00'), b = new Date(d + 'T00:00:00');
      cur = (b - a) / 86400000 === 1 ? cur + 1 : 1;
    } else cur = 1;
    if (cur > best) best = cur;
    prev = d;
  });
  return best;
}
function haversineKm(a, b){
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(s));
}
function renderStats2(){
  var provs = {}, cities = {}, km = 0;
  var ordered = notes.filter(function (n) { return n.lat != null; }).sort(function (a, b) { return a.ts - b.ts; });
  for (var i = 1; i < ordered.length; i++) km += haversineKm(ordered[i - 1], ordered[i]);
  notes.forEach(function (n) {
    if (n.province) provs[n.province] = 1;
    if (n.city) cities[n.city] = 1;
  });
  document.getElementById('stats2').innerHTML =
    '<div><b>' + Object.keys(provs).length + '</b><span>省份</span></div>' +
    '<div><b>' + Object.keys(cities).length + '</b><span>城市</span></div>' +
    '<div><b>' + maxStreak() + '</b><span>最长连续(天)</span></div>' +
    '<div><b>' + (km > 0 ? km.toFixed(0) : '—') + '</b><span>公里</span></div>';
}
function renderProv(){
  var p = {};
  notes.forEach(function (n) { var k = n.province || '未分类'; p[k] = (p[k] || 0) + 1; });
  var arr = Object.keys(p).sort(function (a, b) { return p[b] - p[a]; });
  var max = 0; arr.forEach(function (k) { if (p[k] > max) max = p[k]; });
  document.getElementById('provBar').innerHTML = arr.map(function (k) {
    return '<span class="prov" style="opacity:' + (0.45 + p[k] / max * 0.55).toFixed(2) + '">' + esc(k) + ' <b>' + p[k] + '</b></span>';
  }).join('') || '<span class="prov">还没有记录</span>';
}
```
在 `render()` 里 `renderStats();` 后加 `renderStats2(); renderProv();`。

- [ ] **Step 4: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-rv.js',s)" && node --check .tmp-rv.js && echo OK && rm -f .tmp-rv.js
```

- [ ] **Step 5: 提交**

```bash
git add review.html
git commit -m "feat: 回顾页足迹统计(省份/城市/最长连续/公里) + 省份热力排条"
```

---

## 任务 4：轨迹回放（travel-map.html）

**Files:**
- Modify: `travel-map.html`

- [ ] **Step 1: 回放按钮**

`travel-map.html` 统计条中，在
```html
    <button class="tbBtn" id="shareBtn" onclick="shareTrack()" style="display:none;flex:0 0 auto">制图分享</button>
```
后插入：
```html
    <button class="tbBtn" id="playBtn" onclick="togglePlay()" style="display:none;flex:0 0 auto">▶ 回放</button>
```
在 `refresh()` 里 `document.getElementById('shareBtn').style.display=ordered.length>=2?'block':'none';` 后加一行：
```js
  document.getElementById('playBtn').style.display=ordered.length>=2?'block':'none';
```

- [ ] **Step 2: 回放逻辑**

`travel-map.html` 脚本末尾（`window.__tnAnywhere` 之前）插入：
```js
let _playTimer=null,_playIdx=0,_playOrder=[];
function togglePlay(){
  if(_playTimer){ stopPlay(); return; }
  _playOrder = TravelNotes.list().filter(function(n){return n.lat!=null&&n.lng!=null;}).sort(function(a,b){return a.ts-b.ts;});
  if(_playOrder.length<2){ flash('至少需要 2 个游记节点'); return; }
  _playIdx=0;
  document.getElementById('playBtn').textContent='⏹ 停止';
  stepPlay();
}
function stepPlay(){
  if(_playIdx>=_playOrder.length){ stopPlay(); return; }
  var n=_playOrder[_playIdx];
  if(map) map.flyTo(gxy(n.lat,n.lng),Math.max(map.getZoom(),13),{duration:.8});
  openMemSheet(n);
  _playIdx++;
  _playTimer=setTimeout(stepPlay,1600);
}
function stopPlay(){
  clearTimeout(_playTimer); _playTimer=null;
  var b=document.getElementById('playBtn');
  if(b) b.textContent='▶ 回放';
}
```
（`flash`/`gxy`/`openMemSheet` 均已存在。）

- [ ] **Step 3: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('travel-map.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-tm.js',s)" && node --check .tmp-tm.js && echo OK && rm -f .tmp-tm.js
```

- [ ] **Step 4: 提交**

```bash
git add travel-map.html
git commit -m "feat: 游记地图轨迹回放（逐节点 flyTo + 弹出记忆）"
```

---

## 任务 5：按标签着色节点（travel-map.html）

**Files:**
- Modify: `travel-map.html`

- [ ] **Step 1: 标签→颜色映射**

`travel-map.html` 脚本中，`refresh` 之前插入：
```js
function tagColor(n){
  var rules=[
    ['美食','吃','食','#71806C'],['日出','日落','晨','昏','#C86D4B'],
    ['山','徒步','爬','#6D7D88'],['海','湖','江','河','#5F6D76'],
    ['建筑','古迹','寺','庙','塔','#A9563B'],['雨','雪','#8C7B66']
  ];
  var hay=((n.tags||[]).join(' ')+' '+(n.siteName||'')+' '+(n.title||''));
  for(var i=0;i<rules.length;i++){
    for(var j=0;j<rules[i].length-1;j++){ if(hay.indexOf(rules[i][j])>=0) return rules[i][rules[i].length-1]; }
  }
  return '#C86D4B';
}
```

- [ ] **Step 2: 节点墨点着色**

`refresh()` 中单篇节点构建处：
```js
        ?'<img src="'+photo+'" alt="" onerror="this.remove()">'
        :(isStart?'<span class="mem-ring"></span><span class="mem-dot"></span>':isEnd?'<span class="mem-ring"></span><span class="mem-dot"></span>':'<span class="mem-dot"></span>');
```
改为（给墨点加内联颜色）：
```js
        ?'<img src="'+photo+'" alt="" onerror="this.remove()">'
        :(isStart?'<span class="mem-ring"></span><span class="mem-dot" style="background:'+tagColor(n)+'"></span>':isEnd?'<span class="mem-ring"></span><span class="mem-dot" style="background:'+tagColor(n)+'"></span>':'<span class="mem-dot" style="background:'+tagColor(n)+'"></span>');
```
聚合节点处：
```js
      const nodeInner=photo?'<img src="'+photo+'" alt="" onerror="this.remove()">':'<span class="mem-dot"></span>';
```
改为：
```js
      const nodeInner=photo?'<img src="'+photo+'" alt="" onerror="this.remove()">':'<span class="mem-dot" style="background:'+tagColor(first)+'"></span>';
```
（聚合节点用 `first=items[0]` 的标签色。）

- [ ] **Step 3: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('travel-map.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-tm.js',s)" && node --check .tmp-tm.js && echo OK && rm -f .tmp-tm.js
```

- [ ] **Step 4: 提交**

```bash
git add travel-map.html
git commit -m "feat: 游记地图节点按标签着色（美食/日出/山海/古建等，缺省陶土）"
```

---

## 任务 6：AI 年度报告（review.html）

**Files:**
- Modify: `review.html`

- [ ] **Step 1: 报告按钮**

`review.html` 中，在 `<div class="stats" id="stats"></div>` 后插入：
```html
    <button class="btn-secondary" id="aiReport" style="width:100%;margin:0 0 14px">📖 生成年度报告</button>
```

- [ ] **Step 2: CSS（报告卡复用 .md-item，对话框用底升面板）**

`<style>` 末尾追加：
```css
  .report-dlg{position:fixed;left:10px;right:10px;bottom:10px;z-index:9000;max-height:80dvh;overflow-y:auto;background:var(--color-surface);border:1px solid var(--color-line);border-radius:20px;box-shadow:var(--shadow-float);padding:18px 20px 22px}
  .report-dlg h4{font-family:var(--font-serif);font-weight:400;color:var(--color-ink);margin:0 0 10px;font-size:18px}
  .report-dlg .txt{font-family:var(--font-serif);font-size:14.5px;line-height:1.9;color:var(--color-ink-soft);white-space:pre-wrap}
  .report-dlg .acts{display:flex;gap:10px;margin-top:16px}
  .report-dlg .acts button{flex:1;min-height:44px;border:0;border-radius:999px;background:var(--color-primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer}
  .report-dlg .acts button.x{background:var(--color-bg-soft);color:var(--color-muted)}
```

- [ ] **Step 3: AI 调用 + 渲染**

`review.html` 脚本末尾（`TravelNotes.init` 之前）插入：
```js
function toast(msg){
  var d=document.createElement('div');
  d.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px)+14px);left:50%;transform:translateX(-50%);background:rgba(32,32,29,.92);color:#fff;padding:12px 22px;border-radius:999px;font-size:13px;z-index:9800;box-shadow:0 8px 24px rgba(30,30,28,.18)';
  d.textContent=msg; document.body.appendChild(d);
  setTimeout(function(){ d.remove(); },2200);
}
document.getElementById('aiReport').onclick=function(){
  if(!notes.length){ toast('还没有游记'); return; }
  var key=localStorage.getItem('tn_aiKey');
  if(!key){ toast('请先在设置填 DeepSeek API key'); return; }
  var model=localStorage.getItem('tn_model')||'deepseek-v4-flash';
  var alias={'deepseek-chat':'deepseek-v4-flash','deepseek-reasoner':'deepseek-v4-pro'};
  model=alias[model]||model;
  var list=notes.slice().sort(function(a,b){return a.ts-b.ts;});
  var provs={},sites={};
  list.forEach(function(n){ if(n.province)provs[n.province]=1; if(n.lat!=null)sites[n.lat.toFixed(4)+','+n.lng.toFixed(4)]=1; });
  var timeline=list.map(function(n){
    return (n.date||'')+' 在'+(n.siteName||'某处')+(n.weather?'（'+n.weather+'）':'')+'：'+(n.text||n.raw||'').slice(0,100);
  }).join('\n');
  var prompt='我有 '+list.length+' 篇游记，'+Object.keys(sites).length+' 个地点，覆盖 '+Object.keys(provs).length+' 个省份。请写一篇 400-600 字的年度旅行回顾散文，温暖有画面感，按时间推进，可穿插感悟，不要编造未出现的史实。时间线如下：\n'+timeline;
  var dlg=document.createElement('div');
  dlg.className='report-dlg';
  dlg.innerHTML='<h4>年度报告</h4><div class="txt">正在写作…</div><div class="acts"><button class="x" id="rptClose">关闭</button></div>';
  document.body.appendChild(dlg);
  var body={model:model,messages:[
    {role:'system',content:'你是资深旅行作家。把用户一年的游记时间线写成一篇完整、有画面感与情感的年度旅行回顾散文。'},
    {role:'user',content:prompt}
  ],temperature:0.7};
  if(model==='deepseek-v4-pro') body.reasoning_effort='high';
  body.stream=true;
  fetch('https://api.deepseek.com/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify(body)
  }).then(function(r){
    if(!r.ok) throw new Error('http');
    var reader=r.body.getReader(),dec=new TextDecoder(),buf='',text='';
    function pump(){
      return reader.read().then(function(res){
        if(res.done){
          dlg.querySelector('.txt').textContent=text;
          dlg.querySelector('h4').textContent='年度报告';
          return;
        }
        buf+=dec.decode(res.value,{stream:true});
        var lines=buf.split('\n'); buf=lines.pop();
        lines.forEach(function(line){
          if(line.indexOf('data: ')!==0) return;
          var json=line.slice(6).trim(); if(json==='[DONE]') return;
          try{ var c=JSON.parse(json).choices[0].delta; if(c&&c.content) text+=c.content; }catch(e){}
        });
        dlg.querySelector('.txt').textContent=text;
        return pump();
      });
    }
    return pump();
  }).catch(function(err){
    dlg.querySelector('.txt').textContent='生成失败：'+String(err&&err.message||err);
  });
  dlg.querySelector('#rptClose').onclick=function(){ dlg.remove(); };
};
```
（注意：按钮点击时先建 dlg 再异步填充；`reportBox` 容器保留为备用，不强制使用。）

- [ ] **Step 4: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-rv.js',s)" && node --check .tmp-rv.js && echo OK && rm -f .tmp-rv.js
```

- [ ] **Step 5: 提交**

```bash
git add review.html
git commit -m "feat: 回顾页 AI 年度报告（DeepSeek 流式生成年度散文）"
```

---

## 任务 7：每日心情标记（review.html）

**Files:**
- Modify: `review.html`

- [ ] **Step 1: 心情数据 + 日历渲染**

`review.html` 脚本顶部（`var notes=...` 附近）加：
```js
var dayMoods={};
try{ dayMoods=JSON.parse(localStorage.getItem('tn_dayMoods')||'{}'); }catch(e){ dayMoods={}; }
function saveMoods(){ try{ localStorage.setItem('tn_dayMoods',JSON.stringify(dayMoods)); }catch(e){} }
```
`renderCal()` 中给 `cal-cell has` 加心情角标——把
```js
    html+='<div class="cal-cell'+cls+'" data-d="'+dd+'">'+d+(list.length?'<span class="dot"></span><span class="cnt">'+list.length+'</span>':'')+'</div>';
```
改为：
```js
    html+='<div class="cal-cell'+cls+'" data-d="'+dd+'">'+d+(list.length?'<span class="dot"></span><span class="cnt">'+list.length+'</span>':'')+(dayMoods[dd]?'<span class="mood">'+dayMoods[dd]+'</span>':'')+'</div>';
```

- [ ] **Step 2: CSS 心情角标**

`<style>` 中 `.cal-cell .cnt{...}` 后加：
```css
  .cal-cell .mood{position:absolute;top:2px;left:6px;font-size:11px;line-height:1}
```

- [ ] **Step 3: 当天心情选择器**

`renderDay()` 中，在 `box.innerHTML='...'+items;` 前，给有记录的当天加心情行——把
```js
  box.innerHTML='<div class="eyebrow">'+selDay+' · '+list.length+' 篇</div>'+items;
```
改为：
```js
  var moods=['😀','😐','😭','⛰️','🍜','🧭'];
  var cur=dayMoods[selDay]||'';
  var moodRow='<div class="moodrow">'+moods.map(function(m){return '<span class="mk'+(m===cur?' on':'')+'" data-m="'+m+'">'+m+'</span>';}).join('')+'<span class="mk clear" data-m="">✕</span></div>';
  box.innerHTML='<div class="eyebrow">'+selDay+' · '+list.length+' 篇</div>'+moodRow+items;
  box.querySelectorAll('.mk').forEach(function(k){
    k.onclick=function(){
      if(k.dataset.m){ dayMoods[selDay]=k.dataset.m; }else{ delete dayMoods[selDay]; }
      saveMoods(); renderCal(); renderDay();
    };
  });
```

- [ ] **Step 4: CSS 心情行**

`<style>` 中 `.cal-cell .mood{...}` 后加：
```css
  .moodrow{display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .moodrow .mk{width:34px;height:34px;border:1px solid var(--color-line);border-radius:999px;display:grid;place-items:center;font-size:16px;cursor:pointer;background:var(--color-surface)}
  .moodrow .mk.on{border-color:var(--color-primary);background:var(--color-primary-soft)}
  .moodrow .mk.clear{font-size:12px;color:var(--color-muted)}
```

- [ ] **Step 5: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-rv.js',s)" && node --check .tmp-rv.js && echo OK && rm -f .tmp-rv.js
```

- [ ] **Step 6: 提交**

```bash
git add review.html
git commit -m "feat: 回顾页每日心情标记（localStorage 持久化，日历角标+当日选择）"
```

---

## 任务 8：逆地理编码补全（travel-notes.js + settings.html）

**Files:**
- Modify: `travel-notes.js`（`reverseGeo` + `backfillGeo` + saveNote 自动补 + 导出）
- Modify: `settings.html`（数据管理加「补全地点」按钮）

- [ ] **Step 1: travel-notes.js 加 reverseGeo + backfillGeo**

`travel-notes.js` 中 `attachWeather` 函数附近（任意位置）插入：
```js
  /* 逆地理编码（BigDataCloud 免费无 key）：坐标 → 省/市/县 */
  function reverseGeo(lat, lng, cb) {
    fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=zh')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        cb({ province: j.principalSubdivision || '', city: j.city || j.locality || '', county: j.locality || '' });
      })
      .catch(function () { cb(null); });
  }
  /* 批量补全：遍历缺省/市的坐标游记，成功后持久化 */
  function backfillGeo(cb) {
    var todo = notes.filter(function (n) { return n.lat != null && n.lng != null && !n.province; });
    var done = 0, filled = 0, n = todo.length;
    if (!n) { cb && cb(0, 0); return; }
    todo.forEach(function (note) {
      reverseGeo(note.lat, note.lng, function (g) {
        if (g && g.province) {
          note.province = g.province;
          if (g.city) note.city = g.city;
          if (g.county) note.county = g.county;
          filled++;
        }
        done++;
        if (done === n) { if (filled) persist(); if (cb) cb(filled, n); }
      });
    });
  }
```

- [ ] **Step 2: saveNote 对途经点自动补全**

`saveNote()` 中，在
```js
    attachWeather(note);
```
前插入：
```js
    if (!note.province && note.lat != null) {
      reverseGeo(note.lat, note.lng, function (g) {
        if (g && g.province) { note.province = g.province; if (g.city) note.city = g.city; if (g.county) note.county = g.county; persist(); }
      });
    }
```

- [ ] **Step 3: 导出 backfillGeo**

`window.TravelNotes = {` 中，在 `queryRange: ...` 后（`}` 前）加：
```js
    backfillGeo: backfillGeo,
```

- [ ] **Step 4: settings.html 数据管理加按钮**

`settings.html` 中，在
```html
        <button class="btn-secondary" onclick="location.href='review.html'">旅程回顾</button>
```
后插入：
```html
        <button class="btn-secondary" onclick="backfillGeoBtn()">补全地点信息</button>
```
在 `clearAll()` 前加：
```js
  function backfillGeoBtn(){
    if (!window.TravelNotes || !TravelNotes.backfillGeo) { toast('不可用'); return; }
    TravelNotes.backfillGeo(function (filled, total) {
      toast(total ? ('已补全 ' + filled + '/' + total + ' 处地点信息') : '所有游记都有地点信息');
    });
  }
```

- [ ] **Step 5: 验证**

Run:
```bash
node --check travel-notes.js
node -e "var s=require('fs').readFileSync('settings.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-set.js',s)" && node --check .tmp-set.js && echo OK && rm -f .tmp-set.js
```

- [ ] **Step 6: 提交**

```bash
git add travel-notes.js settings.html
git commit -m "feat: 逆地理编码补全地点（BigDataCloud 无 key）— 途经点自动补 + 设置批量补全"
```

---

## 收尾：全量校验

- [ ] **Step 1: 语法全检**

Run:
```bash
node --check vault.js && node --check travel-notes.js && echo "core OK"
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('/tmp/_r.js',s)" && node --check /tmp/_r.js && echo "review OK"
node -e "var s=require('fs').readFileSync('travel-map.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('/tmp/_t.js',s)" && node --check /tmp/_t.js && echo "travel-map OK"
node -e "var s=require('fs').readFileSync('settings.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('/tmp/_s.js',s)" && node --check /tmp/_s.js && echo "settings OK"
rm -f /tmp/_r.js /tmp/_t.js /tmp/_s.js
```

- [ ] **Step 2: 冒烟**

`python -m http.server 8125`，浏览器人工验收（深浅色各一次）：
- 成果工坊 → 导出 Obsidian 库：解压后含 `我的旅程轨迹.gpx`；单篇 YAML 含 `coordinates: "lat, lng"`；
- 回顾页：今日重现区块（若往年今天有记录）、第二统计行、省份热力、年度报告按钮（需已填 DeepSeek key）、点日历某天设心情；
- 游记地图：回放按钮逐点播放、节点按标签分色；
- 设置 → 补全地点信息：缺省/市的坐标游记被填上（联网时）。

- [ ] **Step 3: 已知残留（计划内接受）**
- 省份足迹为「热力排条」而非真实中国地图色块——完整地图需引入中国省界 GeoJSON 大资产，另行排期；
- 滚动叙事地图（StoryMap 式）未纳入，属二期；
- 逆地理编码依赖 BigDataCloud 外网（断网时跳过，不影响保存）。

---

## 自检（覆盖用户选的「全部八条」）
- [x] ① Obsidian 地图打通 → 任务 1
- [x] ② 今日重现 → 任务 2
- [x] ③ 足迹统计+streak+省热力 → 任务 3
- [x] ④ 轨迹回放 → 任务 4
- [x] ⑤ 按标签着色节点 → 任务 5
- [x] ⑥ AI 年度报告 → 任务 6
- [x] ⑦ 每日心情 → 任务 7
- [x] ⑧ 逆地理编码 → 任务 8
- 打印记忆卡：`results.js` 导出 HTML 已含 `@media print` 基础，无需改；月历照片联动已在回顾页（点日出缩略图）；滚动叙事为二期，已注明。
