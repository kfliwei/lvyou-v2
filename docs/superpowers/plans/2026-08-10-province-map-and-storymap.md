# 省份色块地图 + 滚动叙事地图 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans.

**Goal:** 二期两项：① 回顾页省份色块地图（Leaflet + 阿里 DataV 中国省界 GeoJSON，按到访次数着色）；② 新页 `story.html` 滚动叙事地图（scroll-spy，地图跟随滚动在旅程上飞行）。

**Architecture:** 纯前端。`review.html` 懒加载 Leaflet + DataV GeoJSON；`story.html` 新页面，复用 travel-notes 数据 + trip 分组（间隔 ≤3 天）。不新增后端。

**验证约定：** JS 语法 `node --check` / 内联脚本提取检查；DataV URL 已验证可达（200, 582KB, 35 features）。

---

## 任务 A：回顾页省份色块地图（review.html）

**Files:**
- Modify: `review.html`

- [ ] **Step 1: head 引入 Leaflet**

`review.html` 中，在
```html
<link rel="stylesheet" href="design.css">
```
后插入：
```html
<link rel="stylesheet" href="vendor/leaflet/leaflet.css">
```
在
```html
<script src="travel-notes.js"></script>
```
前插入：
```html
<script src="vendor/leaflet/leaflet.js"></script>
```

- [ ] **Step 2: 省份地图容器**

`review.html` 省份足迹 sec 中，把
```html
    <div class="sec"><div class="sec-title">省份足迹</div><div class="provbar" id="provBar"></div></div>
```
改为：
```html
    <div class="sec"><div class="sec-title">省份足迹</div><div class="provbar" id="provBar"></div>
      <button class="btn-secondary" id="provBtn" style="width:100%;margin-top:10px;display:none">🗺 展开省份地图</button>
      <div id="provMap" style="display:none;height:340px;border-radius:14px;overflow:hidden;border:1px solid var(--color-line);margin-top:10px"></div>
    </div>
```

- [ ] **Step 3: JS：省份计数 + 地图加载**

`review.html` 脚本中，`renderProv` 末尾追加一行（有省份才显示按钮）：
```js
  document.getElementById('provBtn').style.display = Object.keys(p).length ? 'block' : 'none';
```
在 `renderProv` 之后插入：
```js
var _provMap = null, _provLoaded = false;
document.getElementById('provBtn').onclick = function () {
  if (_provLoaded) return; _provLoaded = true;
  var btn = document.getElementById('provBtn');
  btn.textContent = '加载中…';
  var counts = {};
  notes.forEach(function (n) { if (n.province) counts[n.province] = (counts[n.province] || 0) + 1; });
  var max = 0; Object.keys(counts).forEach(function (k) { if (counts[k] > max) max = counts[k]; });
  fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var el = document.getElementById('provMap');
      el.style.display = 'block';
      _provMap = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([35, 104], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, attribution: '© OpenStreetMap' }).addTo(_provMap);
      L.geoJSON(j, {
        style: function (f) {
          var n = counts[f.properties.name] || 0;
          var op = n ? (0.35 + (n / max) * 0.6) : 0.06;
          return { color: '#C86D4B', weight: 1, fillColor: '#C86D4B', fillOpacity: op };
        }
      }).addTo(_provMap);
      _provMap.fitBounds([[3, 73], [54, 135]]);
      btn.style.display = 'none';
    })
    .catch(function () {
      btn.textContent = '地图加载失败，请检查网络';
      setTimeout(function () { btn.textContent = '🗺 展开省份地图'; }, 2000);
      _provLoaded = false;
    });
};
```

- [ ] **Step 4: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.chk.js',s)" && node --check .chk.js && echo OK && rm -f .chk.js
grep -c "leaflet\|provBtn\|provMap" review.html
```
Expected：`OK`，grep ≥ 5。

- [ ] **Step 5: 提交**

```bash
git add review.html
git commit -m "feat: 回顾页省份色块地图（Leaflet + DataV 省界，按到访次数着色）"
```

---

## 任务 B：滚动叙事地图 story.html

**Files:**
- Create: `story.html`

- [ ] **Step 1: 创建 story.html（完整文件）**

`story.html`（完整文件）：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>旅程叙事 · 行迹</title>
<link rel="manifest" href="manifest.webmanifest">
<script src="theme.js"></script>
<link rel="stylesheet" href="design.css">
<link rel="stylesheet" href="vendor/leaflet/leaflet.css">
<style>
  html,body{height:100%;margin:0;font-family:var(--font-sans);background:var(--color-bg);color:var(--color-ink)}
  #storyMap{position:sticky;top:0;height:44vh;z-index:50;background:var(--map-bg)}
  #storyWrap{position:relative;z-index:60;background:var(--color-bg)}
  .story-bar{position:sticky;top:0;z-index:70;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px)+8px) 14px 10px;background:rgba(250,248,243,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid var(--color-line)}
  .story-bar .back{width:34px;height:34px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-ink);font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto}
  .story-bar .title{flex:1;font-family:var(--font-serif);font-weight:400;font-size:17px;color:var(--color-ink)}
  .story-bar select{flex:0 0 auto;max-width:140px;height:34px;border:1px solid var(--color-line);border-radius:999px;background:var(--color-surface);color:var(--color-ink);font-size:12px;padding:0 10px}
  #cards{padding:10px 16px 60px}
  .story-card{background:var(--color-surface);border:1px solid var(--color-line);border-radius:18px;box-shadow:var(--shadow-soft);padding:18px 18px 16px;margin-bottom:14px;transition:box-shadow .3s}
  .story-card.active{box-shadow:0 0 0 2px var(--color-primary)}
  .story-card .sc-date{font-size:11.5px;color:var(--color-muted);letter-spacing:.06em}
  .story-card .sc-place{font-family:var(--font-serif);font-size:22px;font-weight:400;color:var(--color-ink);margin-top:6px;line-height:1.3}
  .story-card .sc-meta{font-size:12px;color:var(--color-muted);margin-top:5px}
  .story-card .sc-txt{font-family:var(--font-serif);font-size:14px;line-height:1.9;color:var(--color-ink-soft);margin-top:10px;white-space:pre-wrap}
  .story-card .sc-pics{display:flex;gap:6px;margin-top:10px;overflow-x:auto}
  .story-card .sc-pics img{width:90px;height:90px;object-fit:cover;border-radius:10px;flex:0 0 auto}
  .story-card .sc-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .story-card .sc-tags span{font-size:11px;color:var(--color-primary-dark);background:var(--color-primary-soft);padding:2px 9px;border-radius:999px}
  .story-empty{padding:60px 20px;text-align:center;color:var(--color-muted)}
</style>
</head>
<body>
<div id="storyMap"></div>
<div id="storyWrap">
  <div class="story-bar">
    <button class="back" onclick="location.href='settings.html'">←</button>
    <div class="title">旅程叙事</div>
    <select id="tripSel"></select>
  </div>
  <div id="cards"></div>
</div>
<script src="vendor/leaflet/leaflet.js"></script>
<script src="travel-notes.js"></script>
<script>
/* 滚动叙事地图：滚动卡片，地图跟随飞至对应节点 */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
var GAP=3*24*3600*1000;
var notes=[], trips=[], curTrip='all', cards=[];
var map=L.map('storyMap',{zoomControl:false,attributionControl:true,scrollWheelZoom:false}).setView([35,104],4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
var curMarker=null;

function groupTrips(list){
  var sorted=list.slice().sort(function(a,b){return a.ts-b.ts;});
  var out=[];
  sorted.forEach(function(n){
    var last=out[out.length-1];
    if(last && n.ts-last.end<=GAP){ last.notes.push(n); last.end=n.ts; }
    else out.push({start:n.ts,end:n.ts,notes:[n]});
  });
  return out;
}
function renderSel(){
  var sel=document.getElementById('tripSel');
  sel.innerHTML='<option value="all">全部旅程</option>'+trips.map(function(t,i){
    return '<option value="'+i+'">'+(t.notes[0].date||'').slice(0,10)+' ~ '+(t.notes[t.notes.length-1].date||'').slice(0,10)+'（'+t.notes.length+' 篇）</option>';
  }).join('');
}
function render(){
  notes=(window.TravelNotes?TravelNotes.list():[]);
  trips=groupTrips(notes.filter(function(n){return n.lat!=null&&n.lng!=null;}));
  renderSel();
  var list = curTrip==='all' ? trips.reduce(function(a,t){return a.concat(t.notes);},[]) : (trips[+curTrip]?trips[+curTrip].notes:[]);
  cards=list.slice().sort(function(a,b){return a.ts-b.ts;});
  var box=document.getElementById('cards');
  if(!cards.length){ box.innerHTML='<div class="story-empty">还没有带坐标的游记，先在地图上记录几篇。</div>'; return; }
  box.innerHTML=cards.map(function(n,i){
    var pics=(n.photos&&n.photos.length)?'<div class="sc-pics">'+n.photos.map(function(p){return '<img src="'+esc(p)+'" onerror="this.remove()">';}).join('')+'</div>':'';
    var tags=(n.tags&&n.tags.length)?'<div class="sc-tags">'+n.tags.map(function(t){return '<span>#'+esc(t)+'</span>';}).join('')+'</div>':'';
    return '<div class="story-card" data-i="'+i+'">'
      +'<div class="sc-date">'+esc(n.date||'')+'</div>'
      +'<div class="sc-place">'+esc(n.title||n.siteName||'未命名')+'</div>'
      +'<div class="sc-meta">'+esc(n.siteName||'')+(n.weather?' · '+esc(n.weather):'')+'</div>'
      +'<div class="sc-txt">'+esc(n.text||n.raw)+'</div>'+pics+tags+'</div>';
  }).join('');
  fitBounds();
  setActive(0);
}
function fitBounds(){
  var pts=cards.map(function(n){return [n.lat,n.lng];});
  if(pts.length) map.fitBounds(pts,{padding:[30,30]});
}
function setActive(i){
  var els=document.querySelectorAll('.story-card');
  els.forEach(function(e){e.classList.remove('active');});
  if(els[i]) els[i].classList.add('active');
  var n=cards[i]; if(!n) return;
  if(curMarker) map.removeLayer(curMarker);
  curMarker=L.marker([n.lat,n.lng],{icon:L.divIcon({className:'',html:'<div style="width:16px;height:16px;border-radius:50%;background:#C86D4B;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
  map.flyTo([n.lat,n.lng],Math.max(map.getZoom(),10),{duration:.7});
}
/* scroll-spy：以卡片相对视口中位判断激活 */
var _spyTimer=null;
function onScroll(){
  if(_spyTimer) return;
  _spyTimer=setTimeout(function(){
    _spyTimer=null;
    var els=document.querySelectorAll('.story-card');
    var best=-1,bestD=1e9;
    var mid=window.innerHeight*0.55;
    els.forEach(function(e,i){
      var r=e.getBoundingClientRect();
      var d=Math.abs((r.top+r.height/2)-mid);
      if(d<bestD){bestD=d;best=i;}
    });
    if(best>=0 && best!==lastActive){ lastActive=best; setActive(best); }
  },120);
}
var lastActive=-1;
window.addEventListener('scroll',onScroll,{passive:true});
document.getElementById('tripSel').onchange=function(){ curTrip=this.value; lastActive=-1; render(); };
window.TravelNotes._onReady=render;
window.TravelNotes._afterSave=render;
TravelNotes.init({});
setTimeout(function(){ map.invalidateSize(); },300);
</script>
</body>
</html>
```

- [ ] **Step 2: 入口**

`settings.html` 数据管理中，在「旅程回顾」按钮后插入：
```html
        <button class="btn-secondary" onclick="location.href='story.html'">旅程叙事</button>
```

- [ ] **Step 3: 验证**

Run:
```bash
node -e "var s=require('fs').readFileSync('story.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.chk.js',s)" && node --check .chk.js && echo "story OK" && rm -f .chk.js
node -e "var s=require('fs').readFileSync('settings.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.chk.js',s)" && node --check .chk.js && echo "settings OK" && rm -f .chk.js
```
Expected：`story OK`、`settings OK`。

- [ ] **Step 4: 提交**

```bash
git add story.html settings.html
git commit -m "feat: 旅程叙事页 story.html（滚动叙事地图，scroll-spy 地图跟随）"
```

---

## 收尾

- [ ] **Step 1: 全量校验**
```bash
node --check travel-notes.js && node --check vault.js && echo core OK
for f in review.html story.html travel-map.html settings.html; do node -e "var s=require('fs').readFileSync('$f','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.chk.js',s)" && node --check .chk.js && echo "$f OK" && rm -f .chk.js; done
```
- [ ] **Step 2: 冒烟**：`python -m http.server 8125`；浏览器验收：
  - 回顾页「🗺 展开省份地图」：首次点击加载 DataV 省界，去过省份色块更深，fitBounds 到中国；
  - 旅程叙事页：顶部地图 + 卡片流，滚动时地图飞至当前卡片节点并高亮；顶部下拉切旅程；设置 → 数据管理可进入。
- [ ] **Step 3: 已知残留**：省份地图与瓦片依赖外网（DataV 582KB 按需拉取、不预缓存进 SW，断网时该区块不显示）；叙事页地图瓦片在线加载。

## 自检
- [x] 省份色块地图 → 任务 A（数据源已实测可达）
- [x] 滚动叙事 → 任务 B
- [x] 类型一致：`render/setActive/fitBounds` 命名自洽；`lastActive` 初始化 -1 防误触发；story 页 `.chk.js` 提取命令与其它页一致。
