# TRACE v2 四方向改进 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修小问题 + 深色模式 + PWA（可安装/离线缓存）+ 独立回顾页 + 定制路书修复。

**Architecture:** 纯前端无构建。新增 `theme.js`（head 先加载，管深色 + SW 注册）、`manifest.webmanifest`、`sw.js`、`images/icon.svg`、`review.html`；修改 `settings.html`（深色 UI + 回顾入口）、`results.js`（文案 + 路书泛化）、`workshop.html`（加载 4 专题数据 + 选专题）、`design.css`/`map.css`（`.theme-dark` 深色覆盖块）、11 个页面的 `<head>`（注入 theme.js + manifest link）。

**Tech Stack:** 原生 HTML/CSS/JS、Leaflet、IndexedDB（游记库）、Service Worker。无测试框架 —— 用 `node --check` 语法校验 + grep 结构校验 + 本地 HTTP 冒烟替代。

**环境注意：**
- 工作区已有**未提交改动**（gx-yn.html / map.css / md-manager.html / travel-map.html / travel-notes.js / vault.js）。每步 `git add` 只加本步改的文件，绝不用 `git add -A`。
- 本仓库无测试框架；验证 = `node --check`（JS 语法）+ grep（注入检查）+ `python -m http.server` 冒烟（HTTP 下 PWA/SW 生效）。

---

## 任务 0：修小问题（results.js 文案 + settings 文案）

**Files:**
- Modify: `results.js:5,317,318,321,323,337,338`
- Modify: `settings.html`（游记开关文案）

- [ ] **Step 1: 改 results.js 文案**

将 `results.js` 中：
- 第 5 行注释 `· 个人古建图鉴：探访景点成册` → `· 个人旅行图鉴：探访景点成册`
- 第 317/318 行 `docShell('我的古建旅行纪念册',` / `saveDoc('我的古建旅行纪念册',` → `我的旅行纪念册`
- 第 321/323 行注释 `个人古建图鉴` → `个人旅行图鉴`
- 第 337/338 行 `docShell('我的古建图鉴',` / `saveDoc('我的古建图鉴',` → `个人旅行图鉴`

用 Edit 逐个精确替换。

- [ ] **Step 2: 改 settings.html 游记开关文案**

`settings.html` 中：
```html
        <div><div class="sw-label">主题游记</div><div class="sw-sub">给游记加主题样式</div></div>
```
改为：
```html
        <div><div class="sw-label">地图显示游记节点</div><div class="sw-sub">在专题地图上显示 📝 游记节点</div></div>
```

- [ ] **Step 3: 验证**

Run: `node --check results.js`
Expected: 无输出、退出码 0。

- [ ] **Step 4: 提交**

```bash
git add results.js settings.html
git commit -m "fix: 纪念册/图鉴去掉'古建'文案，设置页游记开关改名称符"
```

---

## 任务 1：新建 theme.js + manifest + icon + sw.js

**Files:**
- Create: `theme.js`
- Create: `manifest.webmanifest`
- Create: `images/icon.svg`
- Create: `sw.js`

- [ ] **Step 1: 创建 theme.js**

`theme.js`（完整文件）：
```js
/* ============================================================
   theme.js — 深色模式 + PWA 注册
   深色：读 localStorage('tn_dark') = auto|light|dark，默认 auto 跟随系统。
   必须最先加载（<head>），避免深色下白屏闪烁。
   PWA：http(s) 下注册 service worker（离线缓存应用壳）。
   ============================================================ */
(function () {
  function isDark() {
    var m = 'auto';
    try { m = localStorage.getItem('tn_dark') || 'auto'; } catch (e) {}
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function apply() { document.documentElement.classList.toggle('theme-dark', isDark()); }
  apply();
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  /* PWA：仅 http/https 注册（file:// 与 Android WebView 内不注册，功能不受影响） */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
```

- [ ] **Step 2: 创建 manifest.webmanifest**

`manifest.webmanifest`（完整文件）：
```json
{
  "name": "行迹 TRACE",
  "short_name": "行迹",
  "description": "语音游记 · 旅行记忆地图",
  "lang": "zh-CN",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F7F5EF",
  "theme_color": "#C86D4B",
  "icons": [
    { "src": "images/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

- [ ] **Step 3: 创建 images/icon.svg**

`images/icon.svg`（完整文件，品牌图标：陶土圆角方 + 轨迹线，与 App 的"轨迹连线"叙事一致）：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#C86D4B"/>
  <path d="M96 384 C 200 256 268 176 416 128" fill="none" stroke="#F7F5EF" stroke-width="26" stroke-linecap="round"/>
  <circle cx="96" cy="384" r="20" fill="#F7F5EF"/>
  <circle cx="416" cy="128" r="20" fill="#F7F5EF"/>
  <circle cx="256" cy="250" r="10" fill="#F7F5EF"/>
</svg>
```

- [ ] **Step 4: 创建 sw.js**

`sw.js`（完整文件）：
```js
/* sw.js — 行迹 TRACE 离线缓存（应用壳预缓存 + 数据文件运行时缓存） */
var CACHE = 'trace-v1';
var SHELL = [
  './', './index.html', './explore-map.html', './travel-map.html',
  './workshop.html', './settings.html', './md-manager.html', './review.html',
  './changzheng.html', './gx-yn.html', './qinghai-tibet.html', './shanxi.html',
  './test-data.html',
  './design.css', './map.css', './theme.js',
  './travel-notes.js', './results.js', './vault.js', './quotes.js',
  './vendor/leaflet/leaflet.css', './vendor/leaflet/leaflet.js',
  './images/icon.svg', './manifest.webmanifest'
];
var RUNTIME = /(data\.js|gxyn-data\.js|qz-data\.js|changzheng-data\.js|food\.js|food-gxyn\.js)$/;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    /* 逐条 add + catch：单个文件缺失不影响整体安装 */
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;              /* 第三方（瓦片/API）不缓存 */
  if (req.mode === 'navigate') {                            /* 离线导航 → 首页 */
    e.respondWith(caches.match('./index.html'));
    return;
  }
  if (RUNTIME.test(url.pathname)) {                         /* 数据文件：stale-while-revalidate */
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var f = fetch(req).then(function (res) {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        });
        return hit || f;
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {     /* 其余同源：缓存优先 */
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); });
      }
      return res;
    });
  }));
});
```

- [ ] **Step 5: 验证**

Run:
```bash
node --check theme.js && node --check sw.js
node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8')); console.log('manifest ok')"
```
Expected: `manifest ok`，无语法错误。

- [ ] **Step 6: 提交**

```bash
git add theme.js manifest.webmanifest images/icon.svg sw.js
git commit -m "feat: 深色模式核心(theme.js) + PWA manifest/icon/sw.js"
```

---

## 任务 2：全站注入 theme.js + manifest link

**Files:**
- Modify: `index.html:7`, `explore-map.html:7`, `workshop.html:7`, `settings.html:7`, `test-data.html:7`, `qinghai-tibet.html:7`, `changzheng.html:7`, `shanxi.html:7`, `md-manager.html:7`, `travel-map.html:8`, `gx-yn.html:1`

**注入片段**（每个页面插入到 design.css link 之后）：
```html
<link rel="manifest" href="manifest.webmanifest">
<script src="theme.js"></script>
```

- [ ] **Step 1: 10 个普通页面**

对除 gx-yn.html 外的 10 页（index / explore-map / workshop / settings / test-data / qinghai-tibet / changzheng / shanxi / md-manager / travel-map），用 Edit 把
```html
<link rel="stylesheet" href="design.css">
```
替换为
```html
<link rel="stylesheet" href="design.css">
<link rel="manifest" href="manifest.webmanifest">
<script src="theme.js"></script>
```
（每页一次，10 次编辑）。

- [ ] **Step 2: gx-yn.html（单行合并，子串替换）**

gx-yn.html 第 1 行是单行 head，用 Edit 把子串
```html
<link rel="stylesheet" href="design.css"><link rel="stylesheet" href="vendor/leaflet/leaflet.css"><link rel="stylesheet" href="map.css">
```
替换为
```html
<link rel="stylesheet" href="design.css"><link rel="stylesheet" href="vendor/leaflet/leaflet.css"><link rel="stylesheet" href="map.css"><link rel="manifest" href="manifest.webmanifest"><script src="theme.js"></script>
```

- [ ] **Step 3: 验证注入**

Run:
```bash
for f in index.html explore-map.html workshop.html settings.html test-data.html qinghai-tibet.html changzheng.html shanxi.html md-manager.html travel-map.html gx-yn.html; do
  echo "$f: $(grep -c 'theme.js' $f) 处 theme.js / $(grep -c 'manifest.webmanifest' $f) 处 manifest"
done
```
Expected：每页均为 `1 处 theme.js / 1 处 manifest`。

- [ ] **Step 4: 提交**

```bash
git add index.html explore-map.html workshop.html settings.html test-data.html qinghai-tibet.html changzheng.html shanxi.html md-manager.html travel-map.html gx-yn.html
git commit -m "feat: 全站注入 theme.js 与 manifest（深色/PWA 就绪）"
```

---

## 任务 3：深色 CSS 覆盖块（design.css + map.css）

**Files:**
- Modify: `design.css`（追加 `.theme-dark` 共享组件覆盖）
- Modify: `map.css`（追加 `.theme-dark` 地图页覆盖）

- [ ] **Step 1: design.css 末尾追加深色块**

在 `design.css` 文件末尾追加：
```css

/* ============================================================
   TRACE v2 深色模式（.theme-dark · 覆盖页面内联/浮动浅色面）
   ============================================================ */
.theme-dark .topbar{background:rgba(29,28,25,.9);border-bottom-color:var(--color-line)}
.theme-dark .t-row .back{background:var(--color-bg-soft);border-color:var(--color-line);color:var(--color-ink)}
.theme-dark .t-row .title,.theme-dark .t-row .title small{color:var(--color-ink)}
.theme-dark .t-row .act.sec{background:rgba(255,255,255,.06);color:var(--color-muted);border-color:var(--color-line-strong)}
.theme-dark .bottom-nav{background:rgba(29,28,25,.9);border-color:var(--color-line)}
.theme-dark .bottom-nav__item{color:var(--color-muted)}
.theme-dark .bottom-nav__item.active{color:var(--color-ink);background:rgba(255,255,255,.06)}
.theme-dark .hero__search{background:rgba(255,255,255,.06);border-color:var(--color-line)}
.theme-dark .hero__search input{color:var(--color-ink)}
.theme-dark .hero__search input::placeholder{color:var(--color-faint)}
.theme-dark .search-panel{background:rgba(29,28,25,.97);border-color:var(--color-line)}
.theme-dark .sp-note:hover,.theme-dark .sp-topic:hover{background:var(--color-bg-soft)}
.theme-dark .story-item__desc{color:var(--color-ink-soft)}
.theme-dark .md-item,.theme-dark .group,.theme-dark .stats{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .md-item h3,.theme-dark .group-title,.theme-dark .stat b{color:var(--color-ink)}
.theme-dark .md-item .loc,.theme-dark .md-item .meta,.theme-dark .group-sub,.theme-dark .stat span{color:var(--color-muted)}
.theme-dark .search-bar input,.theme-dark input[type=text],.theme-dark input[type=password]{background:var(--color-bg-soft);border-color:var(--color-line);color:var(--color-ink)}
.theme-dark .search-bar input::placeholder{color:var(--color-faint)}
.theme-dark .chips button{background:var(--color-surface);border-color:var(--color-line-strong);color:var(--color-ink-soft)}
.theme-dark .detail-bar,.theme-dark .savebar{background:rgba(29,28,25,.9)}
.theme-dark .month b,.theme-dark .sec-title,.theme-dark .cal-head b{color:var(--color-ink)}
.theme-dark .rz-row{background:var(--color-surface);border-color:var(--color-line);border-left-color:var(--color-primary)}
.theme-dark .rz-row__tx b{color:var(--color-ink)}
.theme-dark .rz-row__tx small{color:var(--color-muted)}
```

- [ ] **Step 2: map.css 末尾追加深色块**

在 `map.css` 文件末尾追加：
```css

/* ============================================================
   TRACE v2 深色模式（.theme-dark · 覆盖地图页写死的浅色面）
   ============================================================ */
.theme-dark #mapEl{background:#1a1a17}
.theme-dark .leaflet-tile-pane .leaflet-tile{filter:sepia(.2) saturate(.45) brightness(.6) contrast(1.05)}
.theme-dark .card{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .card .nm{color:var(--color-ink)}
.theme-dark .card .meta,.theme-dark .card .ds{color:var(--color-ink-soft)}
.theme-dark .leaflet-popup-content-wrapper{background:var(--color-surface);color:var(--color-ink);border-color:var(--color-line)}
.theme-dark .leaflet-popup-tip{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .leaflet-popup-close-button{color:var(--color-muted)!important}
.theme-dark .route{background:var(--color-surface)}
.theme-dark .route .rh{background:var(--color-surface);color:var(--color-ink);border-bottom-color:var(--color-line)}
.theme-dark .route .rh p{color:var(--color-muted)}
.theme-dark .stop .sn{color:var(--color-ink)}
.theme-dark .stop .sd{color:var(--color-muted)}
.theme-dark .dayh{background:var(--color-bg-soft)}
.theme-dark .dayh b{color:var(--color-ink)}
.theme-dark .daytip,.theme-dark .routeNote{color:var(--color-muted);background:var(--color-bg-soft)}
.theme-dark .tripbar{background:rgba(29,28,25,.97);border-color:var(--color-line)}
.theme-dark .tripbar .th{background:var(--color-bg-soft)}
.theme-dark .tripbar .th .tt{color:var(--color-ink)}
.theme-dark .tripbar .chip{background:var(--color-bg-soft);border-color:var(--color-line)}
.theme-dark .tripbar .chip .nm{color:var(--color-ink)}
.theme-dark .fab,.theme-dark .tripfab{background:rgba(29,28,25,.9);border-color:var(--color-line-strong);color:var(--color-ink)}
.theme-dark .ctl{background:rgba(29,28,25,.9);border-color:var(--color-line)}
.theme-dark .ctl button{color:var(--color-ink-soft)}
.theme-dark .laymenu{background:rgba(29,28,25,.97);border-color:var(--color-line)}
.theme-dark .laymenu .li{color:var(--color-ink-soft)}
.theme-dark .legend,.theme-dark .dayLegend{background:rgba(29,28,25,.92);border-color:var(--color-line)}
.theme-dark .legend h4,.theme-dark .legend .lg,.theme-dark .dayLegend dt,.theme-dark .dayLegend dd{color:var(--color-ink-soft)}
.theme-dark .foodbar{background:var(--color-bg)}
.theme-dark .fcard{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .fcard .fn{color:var(--color-ink)}
.theme-dark .fcard .fdesc{color:var(--color-ink-soft)}
.theme-dark .cntbar{background:var(--color-bg)}
.theme-dark .tl-row .n{color:var(--color-ink)}
.theme-dark .tl-row .t,.theme-dark .tl-row .c{color:var(--color-muted)}
.theme-dark .routeSelBar select,.theme-dark .foodbar select,.theme-dark .foodbar input{background:var(--color-surface);border-color:var(--color-line);color:var(--color-ink)}
.theme-dark .reset-chip{color:var(--color-muted);border-color:var(--color-line-strong)}
```

- [ ] **Step 3: 验证**

Run: `grep -c "theme-dark" design.css map.css`
Expected：两文件均 > 1（有深色块）。

- [ ] **Step 4: 提交**

```bash
git add design.css map.css
git commit -m "style: 深色模式 CSS 覆盖块（design.css + map.css）"
```

---

## 任务 4：settings.html 深色 UI + 回顾入口

**Files:**
- Modify: `settings.html`（新增深色模式分组 + 旅程回顾按钮 + JS）

- [ ] **Step 1: 新增「深色模式」分组**

`settings.html` 中，在 `    <!-- 存储 -->` 前插入：
```html
    <!-- 深色模式 -->
    <div class="group">
      <div class="group-title">深色模式</div>
      <div class="group-sub">跟随系统偏好，或手动选择。</div>
      <div class="chips" id="chDark">
        <button data-d="auto">跟随系统</button>
        <button data-d="light">浅色</button>
        <button data-d="dark">深色</button>
      </div>
    </div>
```

- [ ] **Step 2: 数据管理加「旅程回顾」入口**

`settings.html` 中，在
```html
        <button class="btn-secondary" onclick="location.href='md-manager.html'">管理 MD 库</button>
```
后插入：
```html
        <button class="btn-secondary" onclick="location.href='review.html'">旅程回顾</button>
```

- [ ] **Step 3: JS 加深色芯片状态与切换**

`settings.html` 的 `loadSettings()` 末尾（`refreshVoiceDiag();` 后）加：
```js
    var dark = localStorage.getItem('tn_dark') || 'auto';
    document.querySelectorAll('#chDark button').forEach(function(b){ b.classList.toggle('on', b.dataset.d === dark); });
```
在文件底部现有 chips 事件绑定后（`document.querySelector('#chVad').addEventListener(...)` 之后）加：
```js
  document.querySelector('#chDark').addEventListener('click', function(e){
    if (e.target.tagName !== 'BUTTON') return;
    this.querySelectorAll('button').forEach(function(b){ b.classList.remove('on'); });
    e.target.classList.add('on');
    localStorage.setItem('tn_dark', e.target.dataset.d);
    var dark = e.target.dataset.d === 'dark' ||
      (e.target.dataset.d === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('theme-dark', dark);
    toast('已切换深色模式');
  });
```

- [ ] **Step 4: 验证**

Run:
```bash
grep -n "chDark\|review.html\|地图显示游记节点" settings.html
```
Expected：三处均命中。再 `node --check settings.html` 不可用（HTML），改人工检查 JS 无语法错误。

- [ ] **Step 5: 提交**

```bash
git add settings.html
git commit -m "feat: 设置页深色模式三态开关 + 旅程回顾入口"
```

---

## 任务 5：独立回顾页 review.html

**Files:**
- Create: `review.html`

- [ ] **Step 1: 创建 review.html（完整文件）**

`review.html`：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>旅程回顾 · 行迹</title>
<link rel="manifest" href="manifest.webmanifest">
<script src="theme.js"></script>
<link rel="stylesheet" href="design.css">
<style>
  html,body{height:100%;margin:0;font-family:var(--font-sans);background:var(--color-bg);color:var(--color-ink)}
  .page{max-width:560px;margin:0 auto;min-height:100dvh;padding-bottom:60px}
  .topbar{position:sticky;top:0;z-index:100;background:rgba(250,248,243,.9);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(32,32,29,.07);padding:calc(env(safe-area-inset-top,0px)+8px) 14px 10px}
  .t-row{display:flex;align-items:center;gap:8px;height:42px}
  .t-row .back{width:34px;height:34px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-ink);font-size:15px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer}
  .t-row .back:active{transform:scale(.92)}
  .t-row .title{flex:1;min-width:0;font-family:var(--font-serif);font-weight:400;font-size:18px;color:var(--color-ink);letter-spacing:.02em}
  .content{padding:16px 16px 40px}
  .stats{display:flex;gap:0;margin:2px 0 14px;background:var(--color-surface);border:1px solid var(--color-line);border-radius:18px;box-shadow:var(--shadow-soft);overflow:hidden}
  .stats div{flex:1;text-align:center;padding:12px 2px}
  .stats b{display:block;font-family:var(--font-serif);font-size:20px;font-weight:400;color:var(--color-ink)}
  .stats span{font-size:10.5px;color:var(--color-muted);letter-spacing:.06em}
  .eyebrow{font-size:11px;color:var(--color-muted);letter-spacing:.28em;text-transform:uppercase;margin:0 2px 8px}
  .cal-card{background:var(--color-surface);border:1px solid var(--color-line);border-radius:18px;box-shadow:var(--shadow-soft);padding:14px;margin-bottom:14px}
  .cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .cal-head b{font-family:var(--font-serif);font-size:17px;font-weight:400;color:var(--color-ink)}
  .cal-head .nav{display:flex;gap:6px}
  .cal-head .nav button{width:34px;height:34px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-muted);font-size:15px;cursor:pointer}
  .cal-head .nav button:active{transform:scale(.92)}
  .cal-week,.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .cal-week{font-size:11px;color:var(--color-muted);text-align:center;margin-bottom:4px}
  .cal-week span{padding:4px 0}
  .cal-cell{position:relative;aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--color-ink-soft);cursor:pointer;border:1px solid transparent}
  .cal-cell:hover{background:var(--color-bg-soft)}
  .cal-cell.has{background:var(--color-primary-soft);color:var(--color-primary-dark);font-weight:600}
  .cal-cell.has .dot{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--color-primary)}
  .cal-cell .cnt{position:absolute;top:3px;right:5px;font-size:9px;color:var(--color-primary-dark)}
  .cal-cell.off{color:transparent;cursor:default}
  .cal-cell.off:hover{background:none}
  .cal-cell.today{border-color:var(--color-primary)}
  .md-item{display:block;width:100%;text-align:left;background:var(--color-surface);border:1px solid var(--color-line);border-radius:16px;box-shadow:var(--shadow-soft);padding:14px 16px;margin-bottom:12px;box-sizing:border-box}
  .md-item h3{margin:0;font-family:var(--font-serif);font-size:17px;font-weight:400;color:var(--color-ink)}
  .md-item .meta{font-size:11.5px;color:var(--color-muted);margin-top:4px}
  .md-item .txt{font-size:13.5px;color:var(--color-ink-soft);line-height:1.8;margin-top:8px;white-space:pre-wrap;max-height:90px;overflow:hidden}
  .md-item .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
  .md-item .tags span{font-size:11px;color:var(--color-primary-dark);background:var(--color-primary-soft);padding:2px 9px;border-radius:999px}
  .md-item .thumbs{display:flex;gap:6px;margin-top:10px;overflow:hidden}
  .md-item .thumbs img{width:50px;height:50px;object-fit:cover;border-radius:10px;flex:0 0 auto}
  .sec{border-top:1px solid var(--color-line);padding:16px 2px}
  .sec-title{font-family:var(--font-serif);font-size:16px;font-weight:400;color:var(--color-ink);margin-bottom:10px}
  .monthbar{display:flex;align-items:flex-end;gap:5px;height:120px;padding:0 2px;overflow-x:auto}
  .monthbar .mb{flex:0 0 34px;display:flex;flex-direction:column;align-items:center;gap:4px}
  .monthbar .mb i{display:block;width:100%;border-radius:4px 4px 0 0;background:var(--color-primary);opacity:.85;min-height:2px}
  .monthbar .mb span{font-size:10px;color:var(--color-muted)}
  .tagcloud{display:flex;flex-wrap:wrap;gap:7px}
  .tagcloud span{font-size:11.5px;color:var(--color-primary-dark);background:var(--color-primary-soft);padding:4px 12px;border-radius:999px}
  .places{display:flex;flex-wrap:wrap;gap:8px}
  .places span{font-size:11.5px;color:var(--color-ink-soft);background:var(--color-bg-soft);border:1px solid var(--color-line);padding:5px 12px;border-radius:999px}
  .empty{text-align:center;padding:48px 20px}
  .empty .em{font-family:var(--font-serif);font-size:44px;color:var(--color-faint)}
  .empty b{display:block;margin-top:12px;font-family:var(--font-serif);font-weight:400;font-size:18px;color:var(--color-ink)}
  .empty span{display:block;margin-top:6px;font-size:12.5px;color:var(--color-muted)}
</style>
</head>
<body>
<div class="page">
  <header class="topbar">
    <div class="t-row">
      <button class="back" onclick="location.href='settings.html'">←</button>
      <div class="title">旅程回顾</div>
    </div>
  </header>
  <div class="content">
    <div class="stats" id="stats"></div>
    <div class="cal-card">
      <div class="cal-head">
        <b id="calTitle"></b>
        <div class="nav">
          <button id="calPrev">‹</button>
          <button id="calNext">›</button>
        </div>
      </div>
      <div class="cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="cal-grid" id="calGrid"></div>
    </div>
    <div id="dayBox"></div>
    <div class="sec"><div class="sec-title">月份分布</div><div class="monthbar" id="monthBar"></div></div>
    <div class="sec"><div class="sec-title">标签</div><div class="tagcloud" id="tagCloud"></div></div>
    <div class="sec"><div class="sec-title">到过的地方</div><div class="places" id="places"></div></div>
  </div>
</div>
<script src="travel-notes.js"></script>
<script>
/* 旅程回顾页：月历热力 + 当日游记 + 年鉴数据 */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function pad(n){return (n<10?'0':'')+n;}
var notes=[], dayMap={}, curYm='', _init=false, selDay='';
function dayOf(n){return (n.day||(n.date||'').slice(0,10)||'').slice(0,10);}
function render(){
  notes=(window.TravelNotes?TravelNotes.list():[]);
  dayMap={};
  notes.forEach(function(n){var d=dayOf(n);if(d)(dayMap[d]=dayMap[d]||[]).push(n);});
  if(!_init){
    _init=true;
    var yms=Object.keys(dayMap).map(function(d){return d.slice(0,7);}).sort();
    if(yms.length)curYm=yms[yms.length-1];
    else{var n=new Date();curYm=n.getFullYear()+'-'+pad(n.getMonth()+1);}
    selDay=Object.keys(dayMap).sort().pop()||'';
  }
  renderStats(); renderCal(); renderMonthBar(); renderTags(); renderPlaces(); renderDay();
}
function renderStats(){
  var sites={},days=0,photos=0;
  notes.forEach(function(n){if(n.lat!=null)sites[n.lat.toFixed(4)+','+n.lng.toFixed(4)]=1;if(dayOf(n))days++;photos+=(n.photos||[]).length;});
  document.getElementById('stats').innerHTML=
    '<div><b>'+notes.length+'</b><span>篇游记</span></div>'+
    '<div><b>'+Object.keys(sites).length+'</b><span>地点</span></div>'+
    '<div><b>'+days+'</b><span>记录日</span></div>'+
    '<div><b>'+photos+'</b><span>照片</span></div>';
}
function renderCal(){
  var p=curYm.split('-'),y=+p[0],m=+p[1];
  var first=new Date(y,m-1,1).getDay(),dim=new Date(y,m,0).getDate();
  document.getElementById('calTitle').textContent=y+' 年 '+m+' 月';
  var html='';
  for(var i=0;i<first;i++)html+='<div class="cal-cell off"></div>';
  var today=new Date(),td=today.getFullYear()===y&&today.getMonth()+1===m?today.getDate():0;
  for(var d=1;d<=dim;d++){
    var dd=curYm+'-'+pad(d),list=dayMap[dd]||[];
    var cls='cal-cell'+(list.length?' has':'')+(d===td?' today':'');
    html+='<div class="cal-cell'+cls+'" data-d="'+dd+'">'+d+(list.length?'<span class="dot"></span><span class="cnt">'+list.length+'</span>':'')+'</div>';
  }
  var grid=document.getElementById('calGrid');
  grid.innerHTML=html;
  grid.querySelectorAll('.cal-cell.has').forEach(function(c){
    c.onclick=function(){selDay=c.dataset.d;renderDay();grid.querySelectorAll('.cal-cell').forEach(function(x){x.style.outline='none';});c.style.outline='2px solid var(--color-primary)';};
  });
}
function renderDay(){
  var box=document.getElementById('dayBox');
  if(!selDay||!dayMap[selDay]){box.innerHTML='<div class="empty"><div class="em">选</div><b>选一天，看看那天</b><span>点日历里有记录的日期</span></div>';return;}
  var list=dayMap[selDay].slice().sort(function(a,b){return a.ts-b.ts;});
  var items=list.map(function(n){
    var tags=(n.tags&&n.tags.length)?'<div class="tags">'+n.tags.map(function(t){return '<span>#'+esc(t)+'</span>';}).join('')+'</div>':'';
    var thumbs=(n.photos&&n.photos.length)?'<div class="thumbs">'+n.photos.slice(0,4).map(function(p){return '<img src="'+esc(p)+'" onerror="this.remove()">';}).join('')+'</div>':'';
    return '<div class="md-item"><h3>'+esc(n.title||n.siteName||'未命名')+'</h3>'+
      '<div class="meta">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+(n.lat!=null?' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4):'')+'</div>'+
      '<div class="txt">'+esc(n.text||n.raw)+'</div>'+tags+thumbs+'</div>';
  }).join('');
  box.innerHTML='<div class="eyebrow">'+selDay+' · '+list.length+' 篇</div>'+items;
}
function renderMonthBar(){
  var yms={};
  notes.forEach(function(n){var d=dayOf(n);if(d)yms[d.slice(0,7)]=(yms[d.slice(0,7)]||0)+1;});
  var keys=Object.keys(yms).sort(),max=0;
  keys.forEach(function(k){if(yms[k]>max)max=yms[k];});
  document.getElementById('monthBar').innerHTML=keys.map(function(k){
    return '<div class="mb"><i style="height:'+Math.max(4,Math.round(yms[k]/max*100))+'px"></i><span>'+k.slice(5)+'</span></div>';
  }).join('')||'<div class="empty" style="padding:20px"><span>还没有记录</span></div>';
}
function renderTags(){
  var t={};
  notes.forEach(function(n){(n.tags||[]).forEach(function(x){t[x]=(t[x]||0)+1;});});
  var arr=Object.keys(t).sort(function(a,b){return t[b]-t[a];}).slice(0,20);
  document.getElementById('tagCloud').innerHTML=arr.map(function(x){return '<span>#'+esc(x)+'</span>';}).join('')||'<span>还没有标签</span>';
}
function renderPlaces(){
  var p={};
  notes.forEach(function(n){var k=n.siteName||n.title||'';if(k)p[k]=(p[k]||0)+1;});
  var arr=Object.keys(p).sort(function(a,b){return p[b]-p[a];}).slice(0,24);
  document.getElementById('places').innerHTML=arr.map(function(x){return '<span>'+esc(x)+' <b style="color:var(--color-primary-dark)">'+p[x]+'</b></span>';}).join('')||'<span>还没有地点</span>';
}
document.getElementById('calPrev').onclick=function(){
  var p=curYm.split('-'),y=+p[0],m=+p[1]-1;
  if(m<1){m=12;y--;}
  curYm=y+'-'+pad(m);renderCal();renderDay();
};
document.getElementById('calNext').onclick=function(){
  var p=curYm.split('-'),y=+p[0],m=+p[1]+1;
  if(m>12){m=1;y++;}
  curYm=y+'-'+pad(m);renderCal();renderDay();
};
window.TravelNotes._onReady=render;
window.TravelNotes._afterSave=render;
TravelNotes.init({});
</script>
</body>
</html>
```

- [ ] **Step 2: 验证 JS 语法**

Run:
```bash
node -e "var s=require('fs').readFileSync('review.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('.tmp-review.js',s)" && node --check .tmp-review.js && rm .tmp-review.js
```
Expected：退出码 0，无输出。

- [ ] **Step 3: 提交**

```bash
git add review.html
git commit -m "feat: 独立旅程回顾页（月历热力 + 当日游记 + 年鉴数据）"
```

---

## 任务 6：定制路书修复（workshop 数据加载 + 选专题 + results.js 泛化）

**Files:**
- Modify: `workshop.html`（加载 4 数据文件 + 选专题面板 + 合并 SITES_ALL）
- Modify: `results.js`（buildItinerary 支持入参 + 字段泛化 + 文案）

- [ ] **Step 1: workshop.html 加载 4 个数据文件并捕获**

`workshop.html` 现有 script 区为：
```html
<script src="travel-notes.js"></script>
<script src="quotes.js"></script>
<script src="results.js"></script>
<script src="vault.js"></script>
```
在其后追加 4 个数据文件（onload 逐个捕获，不改数据文件本身）：
```html
<script src="data.js" onload="window.__SITES_X=(window.SITES||[]).map(function(s){return Object.assign({topic:'山西古建'},s);})"></script>
<script src="gxyn-data.js" onload="window.__SITES_G=(window.SITES||[]).map(function(s){return Object.assign({topic:'广西云南'},s);})"></script>
<script src="qz-data.js" onload="window.__SITES_Q=(window.SITES||[]).map(function(s){return Object.assign({topic:'青藏风光'},s);})"></script>
<script src="changzheng-data.js" onload="window.__SITES_C=(window.SITES||[]).map(function(s){return Object.assign({topic:'红军长征'},s);})"></script>
```

- [ ] **Step 2: workshop.html 加选专题面板 + 改「定制路书」入口**

在主脚本 `render()` 里，把 `定制路书` 的处理从
```js
        else if (k === 'iti') Results.itinerary();
```
改为
```js
        else if (k === 'iti') openItinerary();
```
在 `render()` 函数之后新增：
```js
  /* 定制路书：先选专题，再调用 results.buildItinerary（兼容 4 专题字段） */
  function openItinerary(){
    var topics = [
      { label:'山西古建', sites: window.__SITES_X || [] },
      { label:'广西云南', sites: window.__SITES_G || [] },
      { label:'青藏风光', sites: window.__SITES_Q || [] },
      { label:'红军长征', sites: window.__SITES_C || [] }
    ];
    if (!topics.some(function(t){return t.sites.length;})) { toast('暂无专题数据'); return; }
    if (!window.__itiEl) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(32,32,29,.5);display:flex;align-items:center;justify-content:center;padding:20px';
      d.innerHTML = '<div style="background:var(--color-surface,#FAF8F3);border-radius:20px;max-width:340px;width:100%;padding:20px;box-shadow:0 18px 50px rgba(30,30,28,.3)">'
        + '<div style="font-family:var(--font-serif);font-size:18px;color:var(--color-ink,#20201D);margin-bottom:4px">定制路书</div>'
        + '<div style="font-size:12.5px;color:var(--color-muted,#7D7970);margin-bottom:14px">先选一个专题，基于真实景点生成每日行程</div>'
        + '<div id="itiList"></div>'
        + '<button id="itiX" style="width:100%;height:46px;border:0;border-radius:12px;background:var(--color-bg-soft,#E6E1D7);color:var(--color-muted,#7D7970);font-size:14px;cursor:pointer;margin-top:6px">取消</button></div>';
      d.onclick = function(e){ if (e.target === d) d.remove(); };
      d.querySelector('#itiX').onclick = function(){ d.remove(); };
      document.body.appendChild(d);
      window.__itiEl = d;
    }
    var box = window.__itiEl.querySelector('#itiList');
    box.innerHTML = '';
    topics.forEach(function(t){
      if (!t.sites.length) return;
      var b = document.createElement('button');
      b.textContent = t.label + '（' + t.sites.length + ' 处）';
      b.style.cssText = 'width:100%;min-height:48px;border:0;border-radius:12px;background:var(--color-primary,#C86D4B);color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:9px';
      b.onclick = function(){ window.__itiEl.remove(); if (window.Results) Results.itinerary(t.sites, t.label); };
      box.appendChild(b);
    });
    window.__itiEl.style.display = 'flex';
  }
```

- [ ] **Step 3: results.js buildItinerary 泛化**

`results.js` 中，把
```js
  function buildItinerary() {
    var sites = window.SITES || [];
    if (!sites.length) { flash('当前页面没有景点数据'); return; }
```
改为
```js
  function buildItinerary(sitesIn, topicLabel) {
    var sites = (sitesIn && sitesIn.length) ? sitesIn : (window.SITES || []);
    if (!sites.length) { flash('当前页面没有景点数据'); return; }
```
把弹窗标题行
```js
      + '<div style="display:flex;justify-content:space-between;align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:18px;color:#20201D;margin-bottom:14px">定制路书 <button id="ix" ...
```
改为（标题带专题名）：
```js
      + '<div style="display:flex;justify-content:space-between;align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:18px;color:#20201D;margin-bottom:14px">定制路书' + (topicLabel ? ' · ' + topicLabel : '') + ' <button id="ix" ...
```
把景点池行
```js
      var pool = sites.slice(0, 80).map(function (s) { return s.label + '（' + s.dy + '·' + s.ty + '·' + (s.county || s.city || '') + '）'; }).join('、');
```
改为（兼容 4 专题字段差异）：
```js
      var pool = sites.slice(0, 80).map(function (s) {
        var tag = [s.ty || s.theme || '', s.dy || '', s.county || s.city || ''].filter(Boolean).join('·');
        return s.label + (tag ? '（' + tag + '）' : '');
      }).join('、');
```
把导出处
```js
    itinerary: buildItinerary,
```
改为
```js
    itinerary: function (sitesIn, topicLabel) { buildItinerary(sitesIn, topicLabel); },
```

- [ ] **Step 4: 验证**

Run:
```bash
node --check results.js
grep -c "__SITES_X\|openItinerary\|SITES_ALL" workshop.html
```
Expected：`node --check` 无输出；workshop.html 命中 ≥ 3。

- [ ] **Step 5: 提交**

```bash
git add workshop.html results.js
git commit -m "feat: 定制路书加选专题步骤，results 字段泛化兼容四专题"
```

---

## 收尾：全量冒烟

- [ ] **Step 1: 语法全检**

Run:
```bash
node --check theme.js && node --check sw.js && node --check results.js && node --check travel-notes.js && node --check vault.js && node --check quotes.js
```
Expected：全部无输出、退出码 0。

- [ ] **Step 2: HTTP 冒烟（PWA/SW 生效前提）**

Run:
```bash
python -m http.server 8000
```
然后在浏览器打开 `http://localhost:8000/index.html`，人工确认：
- 浅色/深色/跟随系统三态切换正常，地图页、游记列表、语音面板无刺眼白底；
- DevTools → Application → Service Workers：`sw.js` 已激活；Manifest 可安装；
- 断网（DevTools Network → Offline）刷新，首页/专题页/回顾页仍可打开；
- 回顾页：月历有记录日标点，点某天列出当天游记，月份可切换；
- 设置 → 数据管理 → 定制路书：可选 4 个专题之一生成，景点名无 `undefined`。

若 `python` 不可用，改用 `npx serve .` 或 `php -S localhost:8000`。

- [ ] **Step 3: 已知残留记录**

确认以下已知残留（计划内接受，不改）：
- 深色下个别页面内联白底（如首页 hero 大图占位、部分卡片内联 `background:#fff`）可能仍偏亮；
- `shanxi-ancient-architecture.html`（遗留独立页）未注入 theme.js/manifest，无深色能力。

---

## 自检清单（计划覆盖 spec）

- [x] spec ① 修小问题 → 任务 0（results 文案 / settings 文案）
- [x] spec ② 深色模式 → 任务 1（theme.js）+ 任务 2（注入）+ 任务 3（CSS）+ 任务 4（设置 UI）
- [x] spec ③ PWA → 任务 1（manifest/icon/sw.js）+ 任务 2（注册）+ 收尾冒烟
- [x] spec ④ 回顾页 → 任务 5（review.html）+ 任务 4（设置入口）
- [x] spec ⑤ 路书修复 → 任务 6（workshop + results 泛化）
- [x] 类型一致性：`theme.js` 读写 `tn_dark`（任务 1/4 一致）；`Results.itinerary(sites,label)`（任务 6 一致）；sw.js 缓存 `trace-v1` 且 `RUNTIME` 正则匹配 6 个数据文件名（与任务 1 列表一致）。
