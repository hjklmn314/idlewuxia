# 游戏体验与 UI/UX 生产合同

## 玩家主目标

玩家在首局必须连续理解五件事：

1. 我是谁、世界发生了什么。
2. 离线/任务给了我什么，前后状态如何变化。
3. 我现在在哪、能去哪里、为什么不能去。
4. NPC 或物件动作是否可用，执行后真实改变了什么。
5. 本轮章节进展是什么，下一步是什么，状态是否保存。

## PSFCD 五流

| Flow | 当前来源 | 上线标准 |
|---|---|---|
| Player Intent | 11 屏按钮、地图节点、NPC/物件动作 | 每个可见动作有唯一 intent ID |
| State | ChapterSession snapshot | UI 不直接改领域状态 |
| Feedback | 日志、按钮状态、delta、拒绝原因 | 关键反馈在一次交互内可见 |
| Content | Screen/Flow/Asset 配置 | 无具体章节硬编码 |
| Data/Evidence | event、截图、DOM、console、state | 可重放、可定位到构建与配置 |

## 11 屏体验链

机器权威在 `config/production/ui_experience_registry.json`。11 屏依次覆盖：

- 开场故事；
- 标题开始；
- 开局身份结果；
- 角色状态；
- 离线确认；
- 离线任务列表；
- 章节卡；
- 地图探索；
- NPC 交互；
- 早期战斗；
- 章节循环返回。

早期战斗屏仍保留在体验合同中，但验收状态标记为 `postponed`；不得用固定时间轴自动胜利替代正式体验验收。

## 三尺寸矩阵

| ID | 尺寸 | 目的 |
|---|---:|---|
| android-compact | 360×800 | 紧凑 Android，验证高度压力 |
| android-baseline | 390×844 | 当前主要视觉基线 |
| android-tall | 412×915 | 高屏 Android，验证布局扩展 |

33 个组合每个都必须保存：

- 截图；
- DOM 关键节点与可见性；
- computed style；
- 横向/纵向 overflow；
- console error/warning；
- 输入前状态、intent、结果和输入后状态；
- 构建 commit、配置 hash、viewport 和 DPR。

运行 `npm run production:ui-matrix` 会从 UI Registry 自动生成 33 条证据义务。该生成器只负责计划和 drift 检查，不会把“已生成 case”误报为“浏览器已经验收”。

## UI 工具链

参考项目的 browser surface/modal 工具提供了可采用的工程模式：

- CDP 启动与页面等待；
- 响应式 viewport probe；
- screenshot + DOM + runtime state 失败证据包；
- modal 打开、关闭和遮挡检测；
- 非零退出码阻断。

不得直接复制其中的射击 UI 选择器、文案、rail/tab、combat canvas 或 style IDs。`QA-UI-001` 必须以本项目 Screen Registry 和 intent IDs 为输入，禁止把 11 个屏写死在测试程序中。

## UI 架构问题

- `wuxia-main.js` 仍负责配置驱动 HTML 生成和延期 Combat 播放编排；DOM、事件绑定、移动布局和持久化生命周期已由 `wuxiaDomAdapter.js` 统一拥有。状态命令、UI view-model 与浏览器自动化入口仍分别下沉到 `ChapterSession`、`uiFlowAdapter` 和 `browserAutomationAdapter`。
- `wuxia.css` 已与 `legacy-shooting.css` 分包，后者不进入 Wuxia shipping closure。
- 当前浏览器运行证明不是 33 组合的完整矩阵。
- 反馈虽已有拒绝原因和结果日志，但 358 动作尚未全部绑定 before/after assertion。

## 上线验收

UI/UX Gate 只有在以下条件全部满足时才为 PASS：

- 33/33 组合通过；
- 0 console error，0 console warning；
- 0 严重 overflow、遮挡、不可点击或焦点丢失；
- 所有拒绝动作零 mutation 且原因可见；
- 所有接受动作具备真实 delta 或明确声明的 narrative-only 结果；
- 返回、刷新、后台恢复和存档恢复保持当前任务；
- 颜色、字体、触控尺寸和文本对比度满足移动端可读性；
- 视觉证据由独立 QA 复核，不由实现者单独签字。
## 2026-07-23 acceptance update

The first-session baseline is visually coherent at 360x800, 390x844, and
412x915 after the compact status-row breakpoint correction. Browser evidence
now records the complete diagnostic bundle (screenshot, DOM, state, viewport,
console, overflow). `UI_NpcInteraction` and `UI_ChapterLoop` are conditional
surfaces and remain coverage gaps until reached through legitimate configured
conditions. The configured choice-result probe currently reports the same
route blocker at all three viewports; no dialog is fabricated.

## 2026-08-14 UI/UX 边界与中性 UI 图合同

后续 UI 生产以 `config/production/ui_neutral_visual_contract.json` 为中性布局与交互基线，以 `config/production/visual_standard.json` 为视觉边界。中性图只能证明区域、层级、状态和触控目标，不得含有具体角色、章节、NPC、技能、奖励、品牌或未授权资产；它明确是 `shipping: false` 的设计证据。

战斗屏 `UI_EarlyCombat` 必须提供单位绑定 HP/MP、Buff/控制、行动顺序、技能与目标选择、暂停/重播和可见结果差异；章节屏 `UI_MapExplore` 必须提供当前房间、可达路线、节点状态、条件原因、奖励来源和唯一下一步动作。两者均不得把业务状态写入 UI 脚本或用颜色作为唯一状态信号。

本次艺术方向概念板与人工判定见 `UI_COMBAT_LEVEL_ART_DIRECTION_EXAMPLE_20260814.md`：概念方向通过，生产资产阻断。它不改变当前 `T05-01`、`COMBAT-002B` 和发行门状态。

## 2026-08-15 屏幕边界纠偏

上一版把关卡路径、节点详情和战斗界面合成一张长图，现审计为
`REJECTED AS SCREEN COMPOSITION`。这不是可接受的“竖屏信息密度”，而是
把三个玩家目标和多个下一步动作同时暴露，破坏导航上下文与状态归属。

后续体验必须遵循：

```text
UI_MapExplore(route)
 -> node-detail
 -> UI_EarlyCombat(combat)
 -> UI_ChapterLoop(result)
 -> UI_MapExplore(route)
```

route、node-detail、combat、result 都是独立模式；任何模式不得持久携带
另一模式的完整地图、节点奖励面板、单位卡、技能卡或战斗反馈堆栈。当前
node-detail 允许暂时作为 `UI_MapExplore` 的瞬态状态，但其边界已进入
`ui_neutral_visual_contract.json` 的 `screenSeparation`，不能借此把三屏重新合并。
