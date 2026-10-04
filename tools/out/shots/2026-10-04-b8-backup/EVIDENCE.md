# 批次 8 物证（2026-10-04 · P1-4 WebDAV 云同步）

复跑方式（不需要另开服务器，脚本自己起内存 DAV 桩）：

```bash
node tools/smoke-backup.js    # 53 条断言
node tools/verify.js          # §16 备份闸门
node tools/out/mut-verify16.js  # §16 变异自测 11 项（harness，跑完逐字节还原）
```

## 文件

| 文件 | 是什么 | 看哪里 |
|---|---|---|
| `settings-webdav-light.png` | 设置页「云同步」卡亮色 390×844 | 4 输入 + 5 按钮 + 自动上传开关 + 两行状态；说明行写「密钥与口令绝不进备份」；`wdPass` 是 `type=password` |
| `settings-webdav-dark.png` | 同页暗色 | 卡片在暗色底上的对比与描边，按钮触控目标 ≥44px |
| `smoke-backup-report.json` | 53 条断言逐条结果（`when` + `results[]`） | `{pass:53, fail:0}` |

## 这批里最难的两条保证，各自靠哪条断言

1. **恢复真的落到 IndexedDB，不是只在内存里** → 断言 `刷新后仍是 3 篇`：`apply({mode:'replace'})` 之后重新 `page.reload()`，再数游记。原始 IDB 写会被下一次 `persist()` 用内存快照覆盖回去，所以写入口只认 `TravelNotes.replaceNotes()`。
2. **密钥一个字节都不上线** → 三层：白名单在采集前就挡住；`serialize()` 哨兵扫描命中即抛；**桩服务器落盘正文**里 `[SECRET_AI, SECRET_DS, SECRET_AMAP]` 三个探针值 0 命中（这是服务端侧证据，不是前端自说自话）。

## 已登记为「设计如此」的三条边界（别当 bug 修）

- **无墓碑**：A 机删掉的游记，从 B 机 `pull` 会并回来。钉在断言 `pull 合并：本机新增留下、云端已删的记录回得来`。要带删除过来只有 `pull(force)` 替换式恢复——也因此它是危险操作。
- **媒体路径不跨设备**：照片/录音是 `file://` 落盘路径时，换机后指向不存在的文件；备份不改写媒体。
- **单文件无历史版本**：`push` 直接覆盖远端。

## 实测到的浏览器行为（决定错误文案怎么写）

`tools/out/b8-probe-401-challenge.cjs`（一次性取证脚本）：

```
challenge=false -> 20ms   {"status":401}
challenge=true  -> 8014ms aborted
```

即 Chromium/WebView 收到带 `WWW-Authenticate: Basic` 的 401 时，`fetch()` **不发拒绝也不返回**，一直挂到超时——因为要弹 HTTP 认证框，而交付壳 `MainActivity` 没有 `onReceivedHttpAuthRequest`。后果：密码打错在 App 内表现为「网络错误 / 30s 超时」而不是 401 文案。所以 `netHint()` 里点名「也可能是账号或密码被服务器拒绝（它会要求弹窗认证，App 内弹不出来）」，壳侧修复（`handler.cancel()`）登记待下一次授权构建。桩的 401 默认**不带**挑战头，就是为了让 401 分支能被快速断言测到。
