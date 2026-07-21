# EntityInteractionService 合同

任务：`ARCH-001 Slice 4`

版本：`idlewuxia.entity_interaction_service.v1`

配置版本：`idlewuxia.entity_interaction_policy.v1`

## 1. 玩家目标与体验链

玩家目标是在当前房间看见真实可交互实体，选择 NPC 或物件，并且只触发当前状态允许的动作。

| PSFCD | 本切片责任 |
|---|---|
| Player | 选择当前房间的 NPC/物件并发出动作意图 |
| State | Runtime 持有房间、隐藏、添加、替换和选中状态 |
| Feedback | 配置模板、实体文案、条件拒绝原因和 Result 副作用反馈 |
| Control | 选择实体、选择动作；Choice 未完成时仍由 Runtime 拒绝其他命令 |
| Data | 实体、动作、分支、可见性、Combat policy 与反馈模板均来自配置 |

本服务不直接渲染反馈。它只返回可用性、命中分支、条件检查、执行类型和配置反馈，Runtime 再生成兼容事件，UI 再渲染事件。

## 2. 状态与职责边界

唯一可写状态权威仍是 `createFirstSessionRuntime`。本服务是无状态解释器。

本服务负责：

- 合并房间静态实体、动态添加实体、替换实体和隐藏实体；
- 判断 NPC/物件是否存在、是否属于当前房间、物件是否可见；
- 依据 action definition、branch hint、ConditionEvaluator 和 Combat policy 裁决动作；
- 保证可用性检查和实际执行准备使用同一个分支；
- 生成配置驱动的 NPC/物件 fallback 反馈；
- 对外返回深拷贝，禁止调用方修改配置定义。

本服务不得负责：

- 写玩家、房间、实体生命周期、选中状态或标记；
- 写事件、存档、DOM 或浏览器自动化对象；
- 提交 ResultEffect；
- 启动或结算 CombatSession；
- 内置具体章节、房间、NPC、物件或动作 ID；
- 内置产品文案或具体 actionType。

## 3. 输入合同

`createEntityInteractionService(dependencies)` 接受：

| 输入 | 含义 |
|---|---|
| `npcLookup` | 不可变 NPC Definition Lookup |
| `interactableLookup` | 不可变物件 Definition Lookup |
| `entityInteractionPolicy` | 可见性、分支路由和反馈模板策略 |
| `combatActionPolicies` | 动作到既有 Combat 过渡策略的配置映射 |
| `branchEnabled` | ResultPreparation 提供的首局启用判定 |
| `evaluateBranch` | ConditionEvaluator 提供的条件解释 |
| `branchRequiresChoice` | ResultPreparation 提供的 Choice 识别 |
| `validateBranch` | ResultPreparation 提供的执行前验证 |

每次调用显式输入 Runtime 上下文：

- 当前房间和房间 ID；
- `hiddenEntityIds`；
- `addedEntityIdsByRoom`；
- `replacementEntityById`；
- 实体与动作类型。

## 4. 输出合同

### 4.1 `activeEntityIdsForRoom(room, lifecycle)`

返回去重且稳定排序的活动实体 ID。解析顺序是：

1. 房间 `encounterIds`；
2. 房间 `interactableIds`；
3. 当前房间动态添加实体；
4. 对每项应用 replacement；
5. 过滤隐藏和重复实体。

### 4.2 选择裁决

- `inspectNpcSelection(context)`
- `inspectInteractableSelection(context)`

成功返回 `accepted=true` 和深拷贝实体；失败返回稳定 `reason`，需要机器判定时同时返回 `reasonCode`。未知、缺少当前房间、房间对象与当前房间 ID 不一致、房间外、隐藏或 policy 未配置均 fail closed。

replacement 必须先解析为最终实体 ID，再按最终 ID 过滤隐藏；隐藏 replacement 不得回退并“复活”原实体。

### 4.3 动作裁决

- `inspectNpcAction({ npc, actionType })`
- `inspectInteractableAction({ item, actionType })`

主要字段：

| 字段 | 含义 |
|---|---|
| `visible` | UI 是否应暴露动作 |
| `available` | 当前状态是否允许执行 |
| `reason` | 稳定拒绝原因 |
| `checks` | ConditionEvaluator 检查明细 |
| `conditionTokens` | 命中或失败分支条件 |
| `branch` | 深拷贝的唯一执行准备分支 |
| `executionKind` | `result` 或 `combat` |
| `combatPolicy` | 深拷贝的既有 Combat 过渡配置 |
| `feedbackLines` | 配置模板产生的预反馈 |
| `evidenceLevel` | 不高于输入证据的来源等级 |

精确 action hint 分支一旦存在但条件失败，禁止回退到无条件或默认文案分支。未路由的 Combat Result 必须隐藏并拒绝。需要 Choice 的分支必须先通过 ResultPreparation。

## 5. 配置合同

配置位于 `chapterSystem.entityInteractionPolicy`，Schema 为
`config/wuxia_entity_interaction_policy.schema.json`。

配置负责：

- 物件可见性字段和值；
- 隐藏物件玩家反馈模板；
- 对话 actionType；
- 默认叙事条件 token；
- 不得进入普通对话路由的条件前缀；
- NPC 全局动作反馈模板及其读取字段；
- 物件描述与无反应模板；
- fail-closed 策略。

运行时不允许将这些值重新硬编码。验证器使用 Ajv Draft 2020-12 实际执行 Schema，并验证 actionType 与可见性字段能在当前配置中解析。

## 6. 命令链

```text
UI intent
  -> Runtime pending-choice guard
  -> EntityInteractionService selection/action inspection
  -> ConditionEvaluator / ResultPreparation preflight
  -> Runtime records rejection
     OR Runtime invokes ResultEffectExecutor transaction
     OR Runtime enters configured postponed-combat bridge
  -> Runtime commits state and event
  -> snapshot
  -> UI adapter/render
```

任何拒绝路径都不得调用 ResultEffectExecutor，也不得改变选中实体、玩家数据、实体生命周期或存档。

## 7. 兼容性

- 公共 Runtime facade 方法不变；
- 快照字段不变；
- 事件名称和既有字段不变；
- 存档 DTO 不变；
- Combat 自动时间轴保持现状，本切片不解除 `COMBAT-002` 延期；
- UI 仍通过现有 Runtime facade 工作，UI Adapter 属于 Slice 6。

## 8. 测试与验收

最低门禁：

1. 服务合同测试：生命周期、选择、隐藏、条件分支、默认对话、Combat 路由、反馈模板、配置隔离、缺 policy 失败关闭；
2. Runtime integrity：拒绝零 mutation、未路由 Combat 隐藏、快照深拷贝；
3. 物件条件负路径：availability 与 execution 分支一致；
4. 首局 54 事件交互回归；
5. Ajv Schema 与语义验证；
6. `wuxia:check:fast` 与 `task:preflight`；
7. Edge `interaction-contract` 在 540×960、390×844 两个尺寸实跑；
8. 本任务生成的每张截图人工打开复核。

## 9. 回滚

按一个 Slice 回滚：

- 从 Runtime 移除 `createEntityInteractionService` 委托；
- 恢复原闭包的实体/动作裁决；
- 删除服务、合同测试、policy Schema 和 `entityInteractionPolicy`；
- 恢复 `package.json`、项目范围和生产登记。

回滚不迁移存档，因为本切片没有改变 DTO。
