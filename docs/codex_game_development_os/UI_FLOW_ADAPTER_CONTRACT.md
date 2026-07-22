# UI Flow Adapter Contract

任务：`ARCH-001 Slice 6`

版本：`idlewuxia.ui_flow_adapter.v1`

## 1. 目的与权威边界

`ChapterSession` 继续是唯一可写游戏状态权威。`UI Flow Adapter` 只把会话快照与屏幕配置组合成可渲染 ViewModel，并把严格类型化 UI Intent 映射为既有 ChapterSession 命令。DOM、浏览器自动化和测试工具不得直接调用领域命令。

链路：

```text
flow config + screen contract
          +
    ChapterSession
          |
          v
 UI Flow Adapter --present()--> DOM renderer
          ^                         |
          |                         v
     typed intent <--------- DOM interaction
          ^
          |
 Browser Automation Adapter
```

## 2. 公共接口

`createUiFlowAdapter({ session, flowContract, screenContract })` 暴露：

- `snapshot()`：返回与内部状态隔离的 ChapterSession 快照。
- `present()`：返回 `stateId`、`screenId`、独立 `screen` 定义、`title`、`step`、`mode` 与独立 `snapshot`。
- `execute(intent)`：校验 Intent 信封并委托唯一 ChapterSession 命令；未知类型、缺字段、多字段或空 ID 均 fail-closed 且零 mutation。

`createBrowserAutomationAdapter({ uiFlowAdapter, render, persistence })` 暴露与浏览器验收工具兼容的命令、快照和存档状态接口。每次命令只调用一次 `uiFlowAdapter.execute()` 并只触发一次 render。

## 3. Intent 数据合同

机器 Schema：`config/wuxia_ui_intent_contract.schema.json`。

| type | 必填载荷 | ChapterSession 命令 |
|---|---|---|
| `dispatchAction` | `actionId` | `dispatch` |
| `selectNode` | `nodeId` | `selectChapterNode` |
| `selectRoom` | `roomId` | `selectChapterRoom` |
| `selectNpc` | `roleId` | `selectChapterNpc` |
| `interactNpc` | `roleId`, `actionType` | `interactWithChapterNpc` |
| `selectInteractable` | `interactableId` | `selectChapterInteractable` |
| `interactInteractable` | `interactableId`, `actionType` | `interactWithChapterInteractable` |
| `resolveChoice` | `optionId` | `resolvePendingChoice` |

Runtime 类型集合、纯空白 ID 拒绝规则与 Schema `$defs` 由合同测试交叉校验；带前后空白但包含有效字符的 ID 保持 Schema/Runtime 一致接受。具体章节、房间、NPC、物件、动作和文案 ID 不进入适配器源码。

## 4. ViewModel 规则

- 当前屏幕优先取会话快照的 `state.screenId`，再取流程 state 定义，最后取屏幕合同默认值。
- 标题、模式、导航和 body 均来自 `wuxia_first_session_screen_contract.json`。
- 房间页标题只按通用 `displayName.zhCN -> displayText.zhCN -> roomId` 规则解析当前选中房间。
- `present()` 的屏幕定义和快照必须深拷贝；调用者修改返回对象不得污染配置或会话。
- 适配器不生成 HTML、不查询 DOM、不写存档、不提交 ResultEffect、不拥有 Combat 时间轴。

## 5. 失败与可观察性

- 未知 Intent：`unsupported_ui_intent`。
- 已知类型但信封非法：`invalid_ui_intent`。
- 会话缺少对应能力：`unsupported_session_command`。
- 上述拒绝不得调用会话命令，也不得写入事件或存档。
- 领域命令结果、事件和拒绝原因保持 ChapterSession 兼容语义。
- 浏览器自动化响应统一包含 `clicked`、`reason`、`intentType`、输入 ID、`text` 与 `automation=true`。

## 6. 测试与发布门禁

- `npm run runtime:ui-flow-adapter:test`：Schema 实际编译、8 类 Intent 映射、非法信封零 mutation、ViewModel 隔离、自动化单通道与 `state.runtime` 旁路禁令。
- `npm run runtime:compatibility:test`：新发布模块不得使用目标旧 WebView 不支持的运行时语法。
- `npm run wuxia:check:fast`：快照、事件、Choice、导航、实体交互、358 动作审计与内容边界回归。
- 真实 Edge `interaction-contract`：540×960 与 390×844 各 20 步，控制台、异常、溢出、顶部导航裁切和状态属性行折行门禁均为零；截图先预热一帧，避免持久化 Chromium 陈旧分块表面。
- 发布闭包：两个适配器进入 Web/Android；Schema 仅作开发期合同，不进入 APK。

## 7. 回滚

Slice 6 必须成组回滚：恢复 `wuxia-main.js` 的旧直接调用和内联自动化 API，删除两个适配器、Intent Schema、合同测试与文档，并同步撤销发布白名单、生产登记和 Roadmap 状态。禁止只删除任一适配器形成双通道或半迁移。

## 8. 已知限制

- `wuxia-main.js` 仍拥有 HTML 生成、DOM 绑定、持久化生命周期与延期 Combat 的展示时间轴；后续由 `UI-ARCH-001` 继续拆分。
- `src/styles.css` 仍包含 dormant legacy shooting CSS；由 `UI-ARCH-001` 单独完成发布样式分包。
- 本切片视觉回归不是 `T05-01` 的 11 屏×3 尺寸 33 格正式矩阵。
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。
