# ARCH-001 模块化 Runtime 施工记录

任务：`ARCH-001`

Owner：`subsystem-domain-architect`

独立验收：`qa-bot-regression-engineer`
当前判定：`OPEN — Slice 2A/6 complete`

## 1. 当前现状

本轮按源码顺序完整阅读：

- `src/wuxiaFirstSessionFlow.js`：1,938 行；
- `src/wuxia-main.js`：1,229 行；
- `src/resultExecutionModules.js`：234 行；
- `src/runtimePersistence.js`：162 行；
- `src/dataClone.js`：47 行；
- 7 个直接 Runtime/UI 特征与回归测试，共 1,455 行；
- 当前生产 Roadmap、任务清单、系统架构、追踪矩阵和项目级 `AGENTS.md`。

确认的职责混合：

- Runtime 工厂同时拥有配置索引、Condition 解释、Result 准备与执行、导航、实体生命周期、命令、存档 DTO 和事件；
- UI 控制器同时拥有配置加载、view-model、HTML 生成、DOM 绑定、战斗时间轴、持久化生命周期和自动化 API；
- `resultExecutionModules.js` 与 `runtimePersistence.js` 已是独立模块，但 Result 的事务执行主体仍在 Runtime 工厂；
- 旧 `createFirstSessionRuntime` 是全部测试、浏览器和存档的兼容入口，迁移期间不能破坏。

## 2. 存在问题

1. 条件语义被封装在 Runtime 闭包，无法独立枚举、验证或被后续 ChapterSession 复用。
2. 条件读取定义和运行状态的依赖是隐式闭包，职责边界不清。
3. 巨型迁移若一次完成，任何快照、事件、拒绝原子性或存档差异都难以定位和回滚。
4. 当前 ARCH-001 验收还没有全部满足：ResultEffectExecutor、NavigationService、EntityInteractionService、ChapterSession 和 UI Adapter 尚未完成提取。

## 3. 修改方案

采用六个可独立回滚的纵切：

1. `ConditionEvaluator`；
2. Result preparation / transactional effect executor；
3. NavigationService；
4. EntityInteractionService；
5. ChapterSession + 旧工厂兼容 facade；
6. UI view-model / intent adapter / automation seam。

本轮只完成切片 1。先写模块合同测试并观察缺模块红灯，再实现纯解释器并接入旧 Runtime；不同时修改配置内容、数值或玩家可见文本。

## 4. 修改范围

- 新增 `src/conditionEvaluator.js`；
- 新增 `tools/test-condition-evaluator.mjs`；
- `src/wuxiaFirstSessionFlow.js` 改为委托条件解释；
- `package.json` 将模块合同测试接入 `task:preflight` 与 `wuxia:check:fast`；
- 更新生产子系统登记、Roadmap 证据和本记录。

不修改：

- `config/wuxia_first_session_flow.json`；
- 任何章节、NPC、房间、技能、奖励、战斗或 UI 内容；
- 存档 DTO、事件名称、快照字段；
- Android 运输文件；
- 延期的 `COMBAT-002` / CombatSession。

## 5. 配置变化

产品配置变化：无。

生产治理登记变化：

- `condition-evaluation.stateAuthority` 转为 `src/conditionEvaluator.js`；
- Runtime 仍登记为兼容 monolith，ARCH-001 状态保持 `open`；
- ARCH-001 增加切片 1 的源码、测试和施工记录作为部分证据。

## 6. 代码变化

`createConditionEvaluator()` 的合同：

- 输入：不可变 Condition Lookup、Reward Attribute Map；
- 每次调用显式输入 `player`、`mapMarkers` 和上下文；
- 输出：`accepted/status` 及可解释检查字段；
- 不写玩家、地图、事件或 DOM；
- 不包含具体 NPC、房间、章节或首局动作 ID。

旧 Runtime 继续暴露原有 10 个方法，所有分支判定通过 `evaluateBranch()` 委托给新模块。迁移后 Runtime 从 1,938 行降至 1,814 行。

## 7. 测试方式

TDD 证据：

- 红灯：`ERR_MODULE_NOT_FOUND`，证明测试在模块实现前执行；
- 绿灯：`condition evaluator contract tests: PASS`。

聚焦回归：

- Condition 模块合同：PASS；
- 条件负路径：6/6，`negativeMutationCount=0`；
- Runtime integrity：13/13；
- Choice / Result：10/10；
- Persistence：PASS；
- 首局完整交互：PASS，54 个事件，最终回到地图；
- `wuxia:check:fast`：PASS，内容边界 `high=0`；
- 真实 Edge `interaction_condition_qa`：20 步、0 failures，最终状态 `STATE_FS_008_MAP_EXPLORE`；
- Android sync / Web bundle freshness：12 个运输文件、0 unexpected、0 findings；
- 完整 `task:preflight`：PASS，`trackedFileCount=231`、scope findings=0。

### Slice 2A：Result preparation

- 新增 `src/resultPreparation.js`；
- 将 ResultSet 递归展开、深度/循环检查、Choice 定义校验、SkillConversion 计划、库存变化与物品合成预检移出 Runtime；
- 新增 `inventoryMutation` 策略合同，库存类别、动作名、参数位与堆栈分隔符由配置定义；
- 公共接口接收 Result 定义和玩家快照，只返回准备结果与 projected state，不提交 Runtime mutation；
- 红灯为 `ERR_MODULE_NOT_FOUND`，绿灯为 `result preparation contract tests: PASS`；
- Result preparation 合同、Choice/Result 10/10、Runtime integrity 13/13、条件负路径 6/6、首局交互 54 事件均 PASS；
- `wuxia:check:fast` PASS，358 动作 `highRisk=0`、内容边界 `high=0`；
- 真实 Edge `interaction-contract`：20 步、0 failures，最终状态 `STATE_FS_008_MAP_EXPLORE`；
- Android sync / Web bundle freshness：12 个运输文件、0 unexpected、0 findings；
- 最终基线构建：PASS，`trackedFileCount=233`、`shippingFileCount=12`、0 findings；
- Runtime 从切片 1 后的 1,814 行降至 1,676 行，Result preparation 模块为 265 行；
- Runtime 外部 facade、快照、事件和存档 DTO 未改变。

浏览器第一次运行在 dev-server 未启动时得到 `ERR_CONNECTION_REFUSED`。该次证据保留为
环境诊断；启动服务器并通过 `wuxia:assert:dev-server` 后复跑通过，因此不归类为产品回归。

## 8. 风险

- Result preparation 已独立，但 Effect commit 仍可直接修改多个闭包状态，事务对象尚未独立；
- Navigation 与 Entity 仍共享闭包 Map/Set；
- UI 仍直接调用 Runtime，尚未形成单一 intent adapter；
- JSDoc 提供当前 JavaScript 类型合同，但不是编译期 TypeScript；
- 本切片只证明条件边界，不等于 ARCH-001 完成，更不等于 G4 或上线完成。

## 9. 未完成项

ARCH-001 后续固定顺序：

1. Result preparation 已完成；下一步提取 transactional EffectExecutor；
2. 提取 NavigationService；
3. 提取 EntityInteractionService；
4. 建立 ChapterSession，并保留 `createFirstSessionRuntime` facade；
5. 提取 UI view-model、intent mapper 与 browser automation seam；
6. 全部合同与浏览器回归后，才把 ARCH-001 从 `open` 更新为 `done`；
7. 之后才能开始依赖它的 `T03-01` 358/358 全动作断言。

回滚：

- 从 `wuxiaFirstSessionFlow.js` 移除 `createConditionEvaluator` 委托并恢复原闭包函数；
- 删除新模块与测试；
- 恢复 `package.json` 和生产登记。
