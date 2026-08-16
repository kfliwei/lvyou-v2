# 行迹TRACE v2.0（GuJianMap）Android 项目审核报告

> 审核维度：**综合代码审查 + 性能与资源**（按用户选定）
> 审核对象：本地 `android_app/` 工程 + `行迹TRACE-v2.0-debug.apk`
> 审核日期：2026-08-11
>
> **⚠️ 审核前提**：用户明确本 APP 为**个人自用**，安全性/隐私合规**非重点考量**。
> 因此本报告将重心放在**性能与资源、可维护性、上架就绪度**；原安全/隐私项降为「可选（公开发布前再处理）」，仅保留低成本顺手项。

---

## 一、项目概况

| 项 | 值 |
|---|---|
| 应用名 / 包名 | 古建地图 / `com.gujian.guditu` |
| 版本 | versionName `2.0`，versionCode `9` |
| 平台基线 | compileSdk / targetSdk **34**，minSdk **26**（Android 8.0）|
| 应用形态 | **WebView 混合应用（Hybrid）**：Web 前端全部打包进 `assets`，`MainActivity` 用 `file:///android_asset/index.html` 加载 |
| 原生代码量 | 仅 2 个 Java 类：`MainActivity`、`XfVoiceEngine` |
| 第三方依赖 | 讯飞语音 SDK（`libs/Msc.jar` 504K + `jniLibs` 双 ABI `libmsc.so` 约 2.5M）；Web 库（Leaflet 等）走 assets 本地引入 |
| 当前产物 | **debug 包**（文件名含 debug，未签名、可调试）|

---

## 二、综合代码审查

### 🟠 A. 建议优化（功能 / 体验 / 可维护性）—— 个人自用也值得做

**1. WebView 未在 `onDestroy` 中 `destroy()`**
- 位置：`MainActivity.onDestroy` 仅销毁了讯飞/Google 识别器，`webView` 未调用 `destroy()`。
- 影响：WebView 持有 Activity 引用，**内存泄漏**；频繁进出页面会累积。
- 建议：`onDestroy` 中 `webView.destroy(); webView = null;`（并在 destroy 前 `webView.loadUrl("about:blank")` 释放渲染资源）。

**2. 未实现 `onRequestPermissionsResult`**
- `onCreate` 与 `startVoice` 申请的定位/录音权限无回调；用户拒绝定位后地图静默失效且无任何提示/降级。
- 建议：重写回调，在权限被拒时通过 JS 桥通知页面给出友好提示，而非静默失败。

**3. 已弃用 API**
- `startActivityForResult` / `onActivityResult` 与 `Activity.requestPermissions` 在 targetSdk 34 下已弃用。
- 建议：迁移到 **Activity Result API**（`registerForActivityResult`），否则后续 `targetSdk` 升级（如 35）会受限甚至编译告警。这是关乎"未来还能不能继续构建/上架"的关键项。

**4. 讯飞 APPID 硬编码**（`XfVoiceEngine.APPID = "546224f8"`）
- 建议外置到 `BuildConfig`/资源，便于多环境与回收（低成本，顺手做）。

### 🟢 B. 安全 / 隐私（个人自用可暂缓，公开发布前再处理）

> 以下项在"仅自己使用、不联网暴露给第三方"的场景下风险有限；但均为**低成本**改动，若顺手处理可提升健壮性。如未来要上架或分享给他人，则必须处理。

- **B1. `MIXED_CONTENT_ALWAYS_ALLOW`**：允许 `file://` 加载明文 HTTP，存在 MITM 注入风险。→ 地图瓦片改 HTTPS 即可消除。
- **B2. JS Bridge 无来源校验**：`AndroidVoice` 的写文件方法对 WebView 内所有页面开放。自用场景下页面可信，风险低；外发前需加 URL 白名单。
- **B3. 定位自动授权**：`onGeolocationPermissionsShowPrompt` 对所有 origin 自动 `remember=true`。自用可保留（省去每次确认）；若介意可改默认确认弹窗。
- **B4. `android:allowBackup="true"`**：`adb backup` 可导出私有照片/录音。自用无所谓；注重隐私可设 `false`。

### 🟢 代码质量亮点（正面）
- 语音双引擎容错设计良好：讯飞为主、Google 兜底，`voiceBusy` 锁防重入，回调语义完整。
- `jsStr()` 转义、录音空值保护、`stopRecorderAndSend` 释放顺序合理。
- 运行时显式申请权限；`configChanges` 避免旋转重建丢失 WebView 状态。
- 注释充分，整体可读性较好。

---

## 三、性能与资源优化（重点）

### 体积（APK 12.4MB）
- `assets` 占约 **12MB**：svg 地图图标约 **10.3MB（1385 个）**、html+js+css 1.4MB、Leaflet 等 164K；外加讯飞 native 约 2.5MB。
- 优化建议：
  1. **ABI 精简**：显式 `ndk { abiFilters 'arm64-v8a' }`（2020 后设备基本 64 位，可省约 1.2MB；如需兼容老设备再保留 `armeabi-v7a`）。
  2. **开启 R8 + 资源压缩**（release）：`minifyEnabled true` + `shrinkResources true` + 编写 proguard 规则 keep 讯飞/WebBridge 回调，预期缩减 10–20%。
  3. **svg 图标整合**：1385 个独立 svg 首次读取有 I/O 与解压开销；建议合并雪碧图/字体图标，或按地图区域**按需分包**（只打包当前地图所需图标集）。
  4. 上架优先采用 **Android App Bundle（AAB）**，将不同地图资源模块化分发。

### 运行时性能（对个人体验影响最直接）
- **每次冷启动 `clearCache(true)`** ⭐：意图是避免旧 JS 残留，但副作用是清空 HTTP 缓存（地图瓦片），导致**每次首屏都要重新下载瓦片**，流量与首屏时间增加。建议：移除每次 `clearCache`，改为**版本号变化时清理一次**（比对 versionName 后清），日常保留缓存。
- **录音回传走 Base64 data URL** ⭐：`stopRecorderAndSend` 将整段录音读入内存再 Base64 经 `evaluateJavascript` 注入 JS，大录音会双倍占内存且 JS 侧解析吃力。建议：复用 `savePhotoFile` 思路，落盘到 `files` 目录后直接回传 `file://` 路径供 `<audio>` 播放，避免巨大字符串跨桥。
- **讯飞初始化在主线程**：`SpeechUtility.createUtility` / `createRecognizer` 在 `onCreate` 主线程调用；建议移至后台线程（Executor），减轻冷启卡顿。
- **缓存模式矛盾**：`LOAD_DEFAULT` 与每次 `clearCache` 冲突；统一为合理策略（如 assets 本地用 `LOAD_CACHE_ELSE_NETWORK`，瓦片用 HTTP 缓存）。

### 内存
- 除上述 WebView 未 `destroy()`、Base64 大对象外，未见明显泄漏；语音录音文件用完即删，处理得当。

---

## 四、上架就绪度（重点：当前 debug 包无法安装/分发）

> 即使是个人自用，若要在自己手机上稳定运行或分享给亲友，也需要一个 **release 签名包**（debug 包有调试标识、易失效、部分渠道不认）。

- ❌ 当前为 **debug 构建**（未签名、可调试），必须产出 **release 签名包**。
- ❌ `build.gradle` 中两个 buildType 均 `minifyEnabled false`，且无 proguard 规则文件、无 `signingConfig`。
- ✅ 修复路径（最简）：
  1. 在 `android` 块配置 `signingConfigs { release { storeFile / storePassword / keyAlias / keyPassword } }`，并在 `buildTypes.release` 引用。
  2. release 开启 `minifyEnabled true` + `shrinkResources true`，并新建 `proguard-rules.pro` keep 讯飞类与 `AndroidVoice` 桥（否则混淆会破坏反射/js 回调）。
  3. `./gradlew assembleRelease` 产出可安装的 release APK / AAB。

---

## 五、优先级修复清单（按个人自用语境重排）

| 优先级 | 项 | 类别 | 说明 |
|---|---|---|---|
| ★1 | 产出 release 签名包（signingConfig + assembleRelease）| 上架/可用 | 否则无法稳定安装使用 |
| ★1 | `onDestroy` 中 `webView.destroy()` | 内存泄漏 | 防止累积泄漏 |
| ★1 | 冷启 `clearCache` 改为按版本清理 | 性能 | 首屏/流量直接改善 |
| ★2 | 迁移弃用 API 到 Activity Result API | 可维护性 | 关乎未来 targetSdk 升级 |
| ★2 | 录音回传改用 `file://` 路径而非 Base64 | 内存/性能 | 大录音更稳 |
| ★2 | release 开启 R8 + 资源压缩 | 体积/上架 | 缩减 10–20% |
| ★2 | ABI 精简（arm64-v8a）| 体积 | 省约 1.2MB |
| ★3 | 实现 `onRequestPermissionsResult` | 体验 | 拒绝权限后友好提示 |
| ★3 | 讯飞 APPID 外置到 BuildConfig | 配置 | 低成本 |
| ○ | `MIXED_CONTENT_ALWAYS_ALLOW` 改 HTTPS（B1）| 安全 | 个人自用可暂缓 |
| ○ | JS 桥来源白名单（B2）/ 定位自动授权（B3）/ allowBackup（B4）| 安全/隐私 | 个人自用可暂缓，外发前处理 |

> ★ = 个人自用仍建议做；○ = 个人自用可暂缓，公开发布前处理。

---

*审核人：Mobile App Builder（掌中灵）*
*说明：本报告基于静态代码与资源配置审查，未执行动态运行/真机测试。安全项已按"个人自用"语境降级，不影响功能与性能优化建议的有效性。*
