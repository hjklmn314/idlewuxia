# 本轮推进报告：skill 瀑布流与 room 导航验收

生成时间：2026-07-05

## 使用的 skill

- `wuxia-project-automation`：按可复现脚本跑 fast check、dev-server 断言。
- `wuxia-system-design`：继续保持状态机 / ActionId / ServerCommand / ViewModel 分离。
- `wuxia-game-planning`：所有第一章 room、NPC、门槛、奖励仍以放置江湖配置证据为准。
- `wuxia-ux-ui-design`：玩家 UI 不再展示证据字段；房间出口变成可点击交互。
- `browser:control-in-app-browser`：使用真实浏览器页面做点击验收。

## 本轮改动

### 1. 房间出口从静态文本变成可点击导航

文件：

- `src/wuxia-main.js`

改动：

- 新增 room lookup 与 room exit button 渲染。
- `fb01_04 大厅` 的 `up/down/left/right` 出口现在都会渲染为可点击按钮。
- 点击跨压缩节点的出口时，会同步切换选中节点和选中房间。
- 例：`fb01_04 大厅 -> up -> fb01_05 长廊` 会把选中节点从 `NODE_FB01_MAIN_HALL` 切到 `NODE_FB01_OWNER_WING`。

### 2. 玩家 UI 隐藏内部证据字段

文件：

- `src/wuxia-main.js`

改动：

- `证据` 行改为仅在 `selectionPresentation.showEvidence=true` 时展示。
- 默认玩家界面不再暴露 source/evidence/debug 字段。

### 3. 删除章节入口重复 ActionId

文件：

- `config/wuxia_first_session_screen_contract.json`

改动：

- `UI_ChapterCardEntry` 删除底部重复的 `primaryText/primaryActionId`。
- 保留章节卡片作为唯一 `ACTION_FS_007_CHAPTER_CARD_ENTRY` 入口。
- 真实点击验收中原先发现同一 ActionId 有两个可见控件，已收口。

### 4. 自动交互测试补 room 导航断言

文件：

- `tools/test-wuxia-first-session-interactions.mjs`

新增断言：

- `fb01_04` 可选。
- `fb01_04` 有出口 `fb01_05`。
- `fb01_05` 可选。
- `fb01_05` 父节点为 `NODE_FB01_OWNER_WING`。
- 选中 `fb01_05` 后 runtime snapshot 的 selected node / selected room 同步更新。

## 自动审计结果

命令：

```powershell
npm.cmd run wuxia:check:fast
```

结果：

- 通过。
- states：11
- actions：32
- chapter1 nodes：7
- chapter1 rooms：45
- validation errors：0
- validation warnings：1
- acceptance issues：0
- interaction test：passed
- interaction events：17
- flow parity findings：8
  - P1：1
  - P2：7

命令：

```powershell
npm.cmd run wuxia:assert:dev-server
```

结果：

- 通过。
- URL：`http://127.0.0.1:5187/?assert=wuxia-dev-server`
- oldPrototypeSignals：0

## 真实浏览器验收

验收路径：

1. 打开 `http://127.0.0.1:5187/?skill-waterfall=20260705b`
2. 选择 `书香门第`
3. 继续到标题
4. 点击开始游戏
5. 进入状态页
6. 打开任务
7. 开始并领取 `池边打鱼`
8. 进入 `我的江湖`
9. 进入第一章地图
10. 选择 `大厅挑战`
11. 点击 `大厅 fb01_04` 的出口 `up -> 长廊 fb01_05`

浏览器验收结果：

- 首屏是 `UI_OpeningStory / STATE_FS_001_OPENING_STORY`。
- 无旧 Nova Lite 离线收益弹窗。
- 无裸 `escapeHtml` 文本。
- 无 `华山/师门` 门派泄漏。
- `fb01_04` 出口按钮存在：`fb01_05 / fb01_03 / fb01_20 / fb01_21`。
- 点击 `fb01_05` 后：
  - selectedNode：`NODE_FB01_OWNER_WING`
  - selectedRoom：`fb01_05`
  - `NODE_FB01_OWNER_WING` 处于选中状态。
  - UI 不显示 `证据` 字段。

截图：

- `outputs/skill_waterfall_acceptance_20260705/real_browser_after_room_exit.png`

## 仍未收口

### P1

- `NODE_FB01_SETTLEMENT_LOOP` 仍不是完整竞品节点证据。
- 当前它是第一章结算/回环项目映射，不能当成放置江湖原始房间节点事实。
- 下一步需要继续追 `mapRoom/mapRole/mapRoleBase` 或从结算脚本证据补齐，否则应从玩家可点主节点里降级。

### P2

以下返回/离开动作仍是项目补充交互，不是竞品事实：

- `ACTION_FS_005_IDLE_TASK_LIST_BACK`
- `ACTION_FS_007_CHAPTER_CARD_ENTRY_BACK`
- `ACTION_FS_008_MAP_EXPLORE_BACK_TO_CHAPTER`
- `ACTION_FS_010_NPC_INTERACTION_BACK_TO_MAP`
- `ACTION_FS_011_CHAPTER_LOOP_STATUS`
- `ACTION_FS_008_MAP_EXPLORE_LEAVE`
- `ACTION_FS_011_CHAPTER_LOOP_LEAVE`

处理原则：

- 可保留为产品可用性策略。
- 必须在 evidence registry / acceptance 里标为 `design_proposal`，不能写成竞品事实。

## 下一轮任务

1. 把 `fb01` 的 45 个 room 做成真实地图 room navigation，而不是只附着在 7 个压缩节点下浏览。
2. 接入 `fb01_npc_interaction_actions.csv`，让房间里的 NPC/物件按钮从配置生成，并绑定 ActionId/ServerCommand。
3. 把 `NODE_FB01_SETTLEMENT_LOOP` 降级或补证据，清掉当前唯一 P1。
4. 为浏览器真实验收增加脚本化截图/点击报告，避免只在聊天里记录。
