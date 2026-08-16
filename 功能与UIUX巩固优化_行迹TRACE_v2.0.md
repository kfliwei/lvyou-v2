# 行迹TRACE v2.0 — 功能与 UI/UX 巩固优化建议

> 维度：**功能完整性 + UI/UX 一致性/体验加固**（按用户选定，个人自用语境）
> 审核对象：本地 `android_app/app/src/main/assets/` 下 Web 前端 + `MainActivity` 壳
> 审核日期：2026-08-11
> 方法：静态读取 `index.html` / `explore-map.html` / `settings.html` / `travel-map.html` / `design.css` 等

---

## 〇、总体结论

项目已具备**相当成熟的设计系统与功能厚度**：

- **UI 底子好**：宣纸/墨/朱砂中式设计语言统一，杂志式排版、毛玻璃胶囊导航、安全区适配（`env(safe-area-inset-*)`）、动效克制、`prefers-reduced-motion` 降级、浅/深双主题、触控目标普遍 ≥44px。
- **功能面厚**：首页 / 探索 / 四大专题 / 我的游记地图（Leaflet + GCJ-02 纠偏 + 多底图 + 轨迹生长 + 节点聚合 + Memory Sheet）/ 随手记语音（讯飞+Google 双引擎）/ 成果工坊 / 设置（AI 润色/录音/VAD/诊断/深色/存储/数据管理/导出 Obsidian）。

因此本阶段**不是"加功能"，而是"巩固"**：把已存在的优秀设计真正**统一落地**、把**数据架构天花板**与**体验边界**补齐。重点如下。

---

## 一、功能巩固（稳定性优先）

### 🔴 F1. 数据存储架构存在容量天花板（最高优先）
- **证据**：`settings.html` 的 `refreshStorage()` 仅统计 `localStorage['travelNotes']` 与 `localStorage['tn_audio']`；`tn_audio` 为录音 base64。WebView `localStorage` 上限普遍 **5MB**，且 base64 使二进制体积膨胀 ~33%。游记一多（尤其带录音）极易触发 `QuotaExceededError`，导致**写入静默失败、数据丢失**。
- **现状割裂**：原生层 `MainActivity.savePhotoFile/saveAudioFile` 已实现"存 App 私有 `files/` 目录 + 返回 `file://` 路径"，但 JS 侧录音仍走 localStorage base64，未充分利用该桥。
- **巩固方向**：
  1. **媒体（照片/录音）改存原生 `files/` 目录或 IndexedDB**，`localStorage` 只保留轻量元数据 JSON（文字/坐标/标签/媒体引用路径）。
  2. 导出/备份逻辑同步改为打包 `files/` 媒体。
  3. 写操作加 `try/catch` 与"存储将满"提前告警（当前仅在设置页 `>3MB` 标红，且只统计了 localStorage 不含 `files/` 媒体，**统计口径不准**）。

### 🟠 F2. 离线地图能力缺失
- **证据**：所有底图瓦片来自在线源（OSM / 高德 / Esri / OpenTopo）；且 `MainActivity` 每次冷启 `clearCache(true)` 清空 HTTP 缓存。
- **影响**：个人自用常去山区/高原等弱信号地带时，地图空白、轨迹无法显示。
- **巩固方向**：引入瓦片离线缓存（如 `leaflet.offline` 存 IndexedDB）；或在 `clearCache` 改为"按版本清理"后保留瓦片缓存；弱网/离线时在地图页给出明确降级提示（见 U3）。

### 🟢 F3. 功能完整性微调（可选）
- 首页"最近的旅行"空态与专题入口已齐备；**建议增加**：① 设置页"载入示例数据"在生产包里应隐藏（当前任何人都可一键注入演示数据，易污染个人库）；② `shareTrack()`「制图分享」需回归确认导出清晰度与权限（写入下载目录在 Android 10+ 走 MediaStore，已正确，但分享到微信等需 `FileProvider`/临时授权，WebView 内直接分享可能失败）。

---

## 二、UI/UX 一致性巩固（统一落地）

### 🟠 U1. 新旧两套导航/顶栏组件并存（核心一致性隐患）
- **证据**：`design.css` 同时定义了旧 `.tabbar`（黛青实心底 `#1a1a17`）+ `.navbar`（黛青深底），以及新 `.bottom-nav`（毛玻璃胶囊）+ `.topbar`（浅色毛玻璃）。
- **现状**：`index` / `explore-map` / `settings` / `travel-map` 均用**新**组件；但需**全量排查** `changzheng/gx-yn/qinghai-tibet/shanxi*` 等专题页与 `md-manager/review/story/workshop` 等是否仍用旧 `.tabbar`/`.navbar`——一旦混用，同一 App 内底部导航会出现"黛青实心条"与"毛玻璃胶囊"两种风格。
- **巩固方向**：统一为新 v2 毛玻璃胶囊（`bottom-nav`/`topbar`）；删除或归档旧 `.tabbar`/`.navbar` 定义，避免后续维护者误用。

### 🟠 U2. 页面级内联样式泛滥（维护性与一致性双输）
- **证据**：`index.html`、`explore-map.html`、`settings.html`、`travel-map.html` 均有大段内联 `<style>`，且如 `.bottom-nav`、`.topbar`、`.t-row` 等在页面内**又重定义了一遍**，与 `design.css` 的 v2 类重复。
- **影响**：① 同一组件多处定义，改一处漏一处，长期漂移；② 深色模式每个页面手写 `.theme-dark` 覆盖（见 U3）。
- **巩固方向**：把页面内可复用片段**抽取为 `design.css` 的命名组件类**，页面只引用类名。优先抽取：顶栏（`.topbar`/`.t-row`/返回键/标题/操作按钮）、底部导航（`.bottom-nav`）、卡片、Sheet、Toast/Flash、空状态。

### 🟠 U3. 深色模式为"逐页覆盖式"，脆弱
- **证据**：`design.css` 注释明确写"design.css 把底写死浅色、文字走 var()，深色下会浅底浅字隐形"；`travel-map.html` 也内联一大段 `.theme-dark` 来补浮层。说明深色适配**依赖每个页面手工补全**，新增组件/页面极易漏掉 → 出现"浅底浅字看不见"。
- **巩固方向**：① 优先消灭"硬编码浅色底"——浮层/卡片底色统一走 `var(--color-surface)` 等变量（已大部分做到，但仍有 `rgba(250,248,243,.9x)` 硬编码残留需替换为变量或 `color-mix`）；② 收敛为**一套集中的深色覆盖层**（集中在 `design.css` 末尾，而非散落各页）；③ 加一个"深色模式回归清单"页面，逐一核对浮层。

### 🟢 U4. 大屏 / 平板 / 折叠屏适配薄弱
- **证据**：`.app-page` 限制 `width:min(100%,520px)` 居中 → 平板/折叠屏/桌面会留大片空白（地图页 `travel-map.html` 用 `#map{position:absolute;inset:0}` 全宽，但内容页仍是窄条）。`design.css` 已有 `grid-2/grid-3` 响应式，但内容页未采用。
- **巩固方向**：内容页宽度放宽到 `min(100%,720px)`；列表/卡片在 ≥680px 用双列（`grid-2`）；地图页可保持全宽。至少保证"不丑"（留白而非窄条）。

---

## 三、体验加固（边界与细节）

### 🟠 U5. 加载态 / 错误态 / 离线态不完整
- **地图瓦片失败无降级**：瓦片请求失败/超时无任何提示或重试，弱网直接空白（`F2` 同源）。
- **页面切换为整页刷新**：各页用 `location.href='x.html'` 跳转 → 每次重新加载整个 WebView 资源（再叠加每次 `clearCache`，首屏更慢，见性能报告）。建议改为**站内 SPA 路由**（hash 路由 + 局部渲染）或至少预加载，提升切换流畅度。
- **Toast/Flash 无动效**：`flash()`/`toast()` 直接出现消失，建议加轻微 `fade/slide`（已有大量 `fadeUp` 可用）。

### 🟠 U6. 键盘遮挡回归
- 编辑页 `textarea` 弹起时，WebView 已设 `windowSoftInputMode="adjustResize"`，但页面内 `position:fixed` 的底部导航/Sheet 可能被键盘顶起或与输入区重叠。需在真机回归"写游记/写笔记"场景。

### 🟢 U7. 手势与返回
- 原生 `onBackPressed` 已处理 WebView 返回上一页（✅）；但专题页内"返回"按钮用 `location.href='index.html'` 是**回卷首而非回退栈**，与系统返回键行为不一致，建议统一为 `history.back()` 优先。

### 🟢 U8. 触控目标与可读性
- 整体达标（按钮/导航 ≥44px）。个别细节：搜索框旁图标、`tl-chip` 等已 ≥44px；可再核一处：地图右下 `statOpen` 44px ✅、`ctl` 内按钮 40px 略小于 44 但属控件簇，可接受。

---

## 四、优先级清单（功能 / UI/UX 巩固）

| 优先级 | 项 | 类别 |
|---|---|---|
| ★★ | F1 媒体/大数据移出 localStorage（IndexedDB 或原生 files），localStorage 只存元数据 | 功能稳定性 |
| ★★ | U1 全量排查并统一为新 v2 导航/顶栏，删除旧 `.tabbar`/`.navbar` | UI 一致性 |
| ★★ | U2 抽取页面内联样式为 design.css 命名组件 | UI 一致性/可维护 |
| ★ | F2 瓦片离线缓存 + 弱网降级提示 | 功能/离线 |
| ★ | U3 收敛深色模式为集中覆盖层，消灭硬编码浅色底 | UI 一致性 |
| ★ | U5 页面切换改 SPA 路由 / 瓦片失败降级 / Toast 动效 | 体验 |
| ★ | U6 键盘遮挡真机回归 | 体验 |
| ○ | U4 大屏/平板适配（放宽宽度+双列）| UI 适配 |
| ○ | U7 返回键与返回按钮行为统一（`history.back()`）| 体验一致性 |
| ○ | F3 生产包隐藏"示例数据"、回归"制图分享" | 功能打磨 |

> ★★ = 巩固核心，建议先做；★ = 重要；○ = 可选优化。

---

## 五、落地建议（可选下一步）

若你希望我直接动手，建议按顺序：
1. **F1 + U2 联合**：先把 `travel-notes.js` 的媒体存储改为原生 `files/` 目录（复用现有 `savePhotoFile/saveAudioFile` 桥），并清理页面内联样式——这两项最能提升"稳定+整洁"。
2. **U1 + U3 联合**：统一导航组件 + 收敛深色模式。
3. **U5**：SPA 路由改造（工作量较大，可放最后）。

*审核人：Mobile App Builder（掌中灵）*
*说明：基于静态代码审查，未真机运行；F1 的"媒体实际落点"需结合 `travel-notes.js` 写操作进一步确认（本报告依据 `settings.html` 存储统计与 `MainActivity` 桥能力推断）。*
