# 行迹 TRACE v2 · 四方向改进设计

日期：2026-08-10
状态：已获用户确认（四方向全部通过）

## 背景

纯前端旅行记录 App「行迹 TRACE」。基于对代码的通读，确认存在若干小问题，并确定四个改进方向：
① 修已确认的小问题；② 深色模式（跟随系统 + 手动开关）；③ PWA（可安装 + 离线缓存）；④ 独立回顾页（旅程日历）；⑤ 定制路书修复（加选专题）。

用户对每项的范围决策：
- 深色模式：**跟随系统 + 手动开关**（三态）
- PWA：**可安装 + 离线缓存**
- 旅程日历：**独立回顾页** `review.html`
- 定制路书：**workshop 内加「选专题」步骤**

## ① 修小问题

1. `results.js` 标题写死"古建"：
   - `buildAlbum`：`docShell('我的古建旅行纪念册', …)` → `docShell('我的旅行纪念册', …)`（`317/318`）
   - `buildAtlas`：`docShell('我的古建图鉴', …)` → `docShell('个人旅行图鉴', …)`（`337/338`）
   - 文件头部注释同步（`5/321/323`）。
2. `settings.html`：开关文案「主题游记」→「地图显示游记节点」，`swTheme` / `tn_themeNotes` 逻辑不变。

## ② 深色模式

### 触发
- 新增 `theme.js`（约 30 行），每页 `<head>` 最先加载（在 `design.css` 之后）。
- 逻辑：
  - 读 `localStorage('tn_dark')`：`'auto' | 'light' | 'dark'`，缺省 `'auto'`。
  - `'auto'` → `matchMedia('(prefers-color-scheme: dark)').matches`。
  - 命中深色 → 给 `document.documentElement`（`<html>`）加 `.theme-dark` 类。
  - `'auto'` 下监听系统主题变化，实时增删类。
- 所有页面 `<head>` 引入 `<script src="theme.js"></script>`（避免 FOUC）。

### 入口
- `settings.html` 新增「深色模式」分组：三态 chips（跟随系统 / 浅色 / 深色）。
- 选择即写入 `tn_dark` 并立即应用（切换当前页类 + 提示）。

### 覆盖成本
- `design.css` 已有 `.theme-dark` token 与组件覆盖，绝大多数组件走 `var(--color-*)` 自动适配。
- 需补：**`map.css` 深色覆盖块**（`.theme-dark` 作用域）：
  - `.card` 白底 → 深色面；`.leaflet-popup-content-wrapper` / tip / close-button；
  - `.tripbar` / `.fab` / `.ctl` 等浮动控件；
  - `#mapEl` 底色（当前 `#dde3da`）→ 深色；
  - `.leaflet-tile-pane .leaflet-tile` 在 `.theme-dark` 下加低亮度滤镜（瓦片不换源）。
- 专题页复用 map.css 类，主要被该覆盖块覆盖；个别内联写死白底作为已知残留接受。

## ③ PWA（可安装 + 离线缓存）

### 新增文件
- `manifest.webmanifest`：
  - `name: 行迹 TRACE`，`short_name: 行迹`，`start_url: ./index.html`，`display: standalone`，
  - `background_color: #F7F5EF`，`theme_color: #C86D4B`，
  - icons：192 / 512。优先提供 SVG；若环境有工具则生成 PNG。
- `sw.js`：
  - 预缓存应用壳：全部 `.html`（index / explore-map / travel-map / workshop / settings / md-manager / test-data / 四个专题页）+ `design.css` + `map.css` + `theme.js` + 核心 JS（`travel-notes.js` / `results.js` / `vault.js` / `quotes.js`）+ `vendor/leaflet/*`。
  - 运行时缓存（stale-while-revalidate）：数据文件 `data.js` / `gxyn-data.js` / `qz-data.js` / `changzheng-data.js` / `food.js` / `food-gxyn.js`。
  - 第三方请求（瓦片 / `api.deepseek.com` / `archive-api.open-meteo.com`）直接放行，不缓存。
  - 版本号 `trace-v1`，安装时清理旧缓存。
- 每页 `<head>` 追加 3 行注册片段：
  ```js
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
  ```

### 已知限制（需向用户说明）
- Service Worker 仅在 HTTP(S)/localhost 下生效；直接 `file://` 打开或 Android WebView 内不注册（功能不受影响，只是无安装/离线缓存能力）。

## ④ 独立回顾页 `review.html`

### 结构
- 顶栏：`.t-row` 体系（返回 / 标题「旅程回顾」）。
- 统计行：游记数 / 地点 / 天数 / 公里 / 照片 / 录音（复用 workshop 的 haversine 口径）。
- **月历热力**：
  - 月份切换（← 上月 / → 下月，默认最近有记录月）；
  - 每天一格：有记录 → 圆点标记，当日条数多 → 颜色加深；
  - 点某天 → 下方列出当天游记。
- 下方：当天游记卡片（复用 md-manager 的杂志卡样式：标题 / 时间 / 正文截断 / 缩略图 / 标签）。
- 底部：月份分布条 + 标签云 + 地点 Top（轻量年鉴感）。

### 入口
- `settings.html`「数据管理」新增「旅程回顾」按钮 → `review.html`。

### 依赖
- 加载 `travel-notes.js`（`TravelNotes.list()` 读全部游记）+ `design.css`。约 250 行内联脚本。

## ⑤ 定制路书修复（加选专题）

### workshop.html
- 加载 4 个数据文件，用 `onload` 逐个捕获（不改数据文件本身）：
  ```html
  <script src="data.js" onload="window.__SITES_X=(window.SITES||[]).map(s=>Object.assign({topic:'山西古建'},s))"></script>
  <script src="gxyn-data.js" onload="window.__SITES_G=(window.SITES||[]).map(s=>Object.assign({topic:'广西云南'},s))"></script>
  <script src="qz-data.js" onload="window.__SITES_Q=(window.SITES||[]).map(s=>Object.assign({topic:'青藏风光'},s))"></script>
  <script src="changzheng-data.js" onload="window.__SITES_C=(window.SITES||[]).map(s=>Object.assign({topic:'红军长征'},s))"></script>
  ```
  合并为 `window.SITES_ALL`（带 `topic` 标签）。
- 「定制路书」点击 → 先弹专题选择面板（4 按钮），选中后以该数据集调用 `Results.itinerary(sites, topicLabel)`。

### results.js
- `buildItinerary(sitesIn, topicLabel)`：支持传入数据集；无参时回退 `window.SITES`。
- 景点池文案泛化，兼容 4 个专题字段差异：
  `s.label + (s.ty || s.theme || '') + (s.dy ? '·' + s.dy : '') + (s.county || s.city || '')`
  （顺带修复专题页直接调用时 `dy/ty` 显示 `undefined` 的问题）。
- 弹窗标题/说明带上专题名（如「定制路书 · 山西古建」）。

## 范围外（明确不做）
- 四大专题页公共代码抽取重构（另行排期，不动）。
- 首页搜索纳入专题景点（另行排期）。
- 一键成册 / 地图瓦片换源 / 实景照片素材替换。

## 验收
- 深色模式：`auto` 跟随系统切换；手动三态可用；地图页、列表、语音面板无刺眼白底。
- PWA：HTTP 服务下可安装、断网可打开壳页面与专题数据页；file:// 下不报错。
- 回顾页：月历标点正确，点某天出当天游记，月份可切换。
- 路书：workshop 可选 4 专题之一生成，无 `undefined` 字段；旧小问题（文案）已改。
