# ARCH-001 模块化 Runtime 施工记录

任务：`ARCH-001`

Owner：`subsystem-domain-architect`

独立验收：`qa-bot-regression-engineer`
当前判定：`PASS WITH KNOWN LIMITATIONS — Slice 6/6 complete`

## 1. 当前现状

施工起点按源码顺序完整阅读，随后每个切片继续复读受影响模块与测试：

- 原 `src/wuxiaFirstSessionFlow.js`：1,938 行，Slice 5 施工前为 1,088 行，当前为 19 行兼容 facade；
- 当前 `src/chapterSession.js`：1,101 行；
- `src/wuxia-main.js`：1,158 行；
- `src/uiFlowAdapter.js`：88 行；
- `src/browserAutomationAdapter.js`：51 行；
- `src/resultExecutionModules.js`：234 行；
- `src/runtimePersistence.js`：162 行；
- `src/dataClone.js`：47 行；
- Runtime/UI 模块合同、兼容、完整性、交互与浏览器回归测试已全部接入门禁；
- 当前生产 Roadmap、任务清单、系统架构、追踪矩阵和项目级 `AGENTS.md`。

确认的职责混合：

- Runtime 工厂同时拥有配置索引、Condition 解释、Result 准备与执行、导航、实体生命周期、命令、存档 DTO 和事件；
- UI 控制器仍拥有配置加载、HTML 生成、DOM 绑定、战斗时间轴和持久化生命周期；ViewModel、Intent 与自动化 API 已移到独立适配器；
- `resultExecutionModules.js`、`resultPreparation.js`、`resultEffectExecutor.js`、`navigationService.js`、`entityInteractionService.js`、`chapterSession.js` 与 `runtimePersistence.js` 已是独立模块；Result 事务、Navigation、Entity 交互决策和会话状态权威已移出旧 Runtime 工厂；
- 旧 `createFirstSessionRuntime` 已缩为全部测试、浏览器和存档继续使用的兼容入口，本身不再持有状态。

## 2. 存在问题

1. Slice 6 前 UI 直接调用旧 Runtime facade；现已由单一 UI Flow Adapter 收口。
2. `wuxia-main.js` 仍负责 HTML、DOM、持久化生命周期和延期 Combat 展示时间轴，这属于后续 `UI-ARCH-001` 范围。
3. dormant legacy shooting CSS 仍与武侠样式同文件，尚未完成发布样式分包。
4. `T03-01`、`SAVE-001` 与 `OBS-001` 未完成，因此 G4 和上线仍然阻断。

## 3. 修改方案

采用六个可独立回滚的纵切：

1. `ConditionEvaluator`；
2. Result preparation / transactional effect executor；
3. NavigationService；
4. EntityInteractionService；
5. ChapterSession + 旧工厂兼容 facade；
6. UI view-model / intent adapter / automation seam。

当前已完成切片 1、2A、2B、3、4、5 与 6。每个切片都先写模块合同测试并观察红灯，再实现解释器、状态权威或适配器并接入现有 UI；除人工验收发现并修复的顶部标题换行，以及把首局默认旗标从源码迁到等价配置外，没有修改玩家可见文本、数值或具体章节内容。

## 4. 修改范围

- 新增 Condition、Result preparation、ResultEffectExecutor、NavigationService、EntityInteractionService、ChapterSession、UI Flow Adapter 与 Browser Automation Adapter 模块及各自合同测试；
- `src/chapterSession.js` 接管会话状态、事件、存档和事务提交权；`src/wuxiaFirstSessionFlow.js` 仅保留旧工厂名称兼容 facade；
- `package.json` 将模块合同测试接入 `task:preflight` 与 `wuxia:check:fast`；
- 更新生产子系统登记、Roadmap 证据和本记录。

不修改：

- 除 Result、Navigation、Entity Interaction 通用 policy 映射和等价迁移的 `sessionDefaults.initialFlags` 外，不修改 `config/wuxia_first_session_flow.json` 中任何具体内容定义；
- 任何章节、NPC、房间、技能、奖励、战斗或 UI 内容；
- 存档 DTO、事件名称、快照字段；
- Android 原生项目源码；生成的 Web/Android 运输闭包按白名单同步；
- 延期的 `COMBAT-002` / CombatSession。

## 5. 配置变化

产品配置新增通用 `chapterSystem.navigationPolicy`、`chapterSystem.entityInteractionPolicy` 与 `sessionDefaults.initialFlags`；开发配置新增 `wuxia_ui_intent_contract.schema.json`。全部 Schema 均由 Ajv 实际执行，没有修改具体章节、NPC、房间、奖励、UI 文案或数值内容。

生产治理登记变化：

- `chapter-runtime`、`condition-evaluation`、`result-effect-execution`、`chapter-navigation` 与 `chapter-entity-interaction` 的状态权威统一登记为 `src/chapterSession.js`；各无状态服务只拥有对应算法；
- 新增 `chapter-navigation`、`chapter-entity-interaction` 子系统及对应 policy Schema，ChapterSession 默认配置 Schema 进入开发期治理配置；
- Chapter Runtime 登记为 `modularized-v1-stateful-session-with-compatibility-facade`；UI flow adapter 登记为 `modularized-v1-intent-and-view-model-adapters`；
- ARCH-001 已登记全部六个切片的源码、Schema、测试、合同、施工记录和人工视觉证据，状态更新为 `done`。

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

- Result preparation 与 Effect commit 已独立；ChapterSession 是唯一 Runtime 状态权威，Executor 只拥有一次调用期间的隔离草稿；
- Navigation 与实体交互决策已无状态提取；UI 和浏览器自动化通过单一 Intent Adapter 调用 ChapterSession；
- UI HTML/DOM、持久化生命周期、延期 Combat 展示时间轴和 dormant CSS 仍待 `UI-ARCH-001` 继续拆分；
- JSDoc 提供当前 JavaScript 类型合同，但不是编译期 TypeScript；
- ARCH-001 六个边界已完成，但不等于 G4 或上线完成。

## 9. 未完成项

ARCH-001 六个切片已全部完成。下一 P0 为 `T03-01` 358/358 全动作前后状态断言；`SAVE-001`、`OBS-001`、`UI-ARCH-001`、`T05-01`、`T05-02` 与发行门禁仍未完成。

Slice 1 历史回滚（其余切片按各自合同和追加记录独立回滚）：

- 从 `wuxiaFirstSessionFlow.js` 移除 `createConditionEvaluator` 委托并恢复原闭包函数；
- 删除新模块与测试；
- 恢复 `package.json` 和生产登记。

### Slice 2B：Transactional ResultEffectExecutor

- 新增 `src/resultEffectExecutor.js`，将玩家、标记、地图、实体、Choice、章节清算与既有 Combat follow-up 的效果解释集中到一个无 DOM、无事件写入、无持久化写入的事务模块；
- `src/wuxiaFirstSessionFlow.js` 只在 `accepted=true` 时采纳完整 next-state；失败只记录带 `reason/resultId/category/action` 的 rejection，且 `sideEffects=[]`；
- 房间阻挡、NPC、物件、Choice 与延期战斗结果的现有调用链统一走同一事务入口；房间阻挡中的非法后段效果不再伪装成普通 `roomBlocked`；
- 新增 `config/wuxia_runtime_mutation_policy.schema.json`，由 Ajv Draft 2020-12 实际执行；类别、动作、参数位、默认值、列表分隔符、既有 Combat follow-up 与失败策略全部为必填；
- Runtime 从 1,676 行降至 1,355 行，Executor 为 598 行；外部 facade、快照与存档 DTO 保持兼容；
- 修复发布白名单漏掉 `conditionEvaluator.js`、`resultPreparation.js` 与 `resultEffectExecutor.js` 的 P0；Web/APK 产品闭包从错误的 12 文件修正为 15 文件，Schema 保持开发期不运输；
- 模块合同测试覆盖后段失败整条回滚、拒绝副作用为空、缺失属性/武功数值拒绝、成功多域提交与输入不变；
- Runtime integrity 为 15/15，包含真实 NPC branch 后段非法效果回滚，以及房间阻挡事务失败的结构化 rejection；
- 真实 Edge `interaction_condition_qa` 为 20 步、0 failures，最终状态 `STATE_FS_008_MAP_EXPLORE`；
- 暂存态基线构建 PASS：`trackedFileCount=238`、`shippingFileCount=15`、0 findings；
- 540×960 人工视觉验收检查房间首屏、NPC 长文本反馈、状态页与移动结果：无横向溢出、无原始 ID/调试文案、关键操作可见、长文本可滚动、控制台 0 error/0 warning；
- 本切片结论为 `PASS WITH KNOWN LIMITATIONS`，只代表 Slice 2B 达标；ARCH-001、T05-01 与项目发布仍未完成；
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 未施工并继续延期。

### Slice 3：NavigationService

- 新增 `src/navigationService.js`，节点解析、路线分类、房间入口条件映射、活动 NPC 阻断查询与出口可用性成为无状态服务；
- Runtime 不再通过房间 ID 正则拼接 `gorome*`，也不再依赖固定 Result ID `stop`；进入条件动作、目标字段和阻断 Result 动作由 `chapterSystem.navigationPolicy` 配置；
- 新增 `config/wuxia_navigation_policy.schema.json` 并接入 Ajv Draft 2020-12 实际执行；验证器同时检查策略与 Runtime mutation 动作一致、入口条件/阻断结果可解析、房间连接方向唯一且全部互反；
- 原 `createFirstSessionRuntime` facade、存档 DTO、既有事件字段和阻断事务行为保持兼容；`roomSelected`/`roomBlocked` 只增加可观察的 `routeKind`，项目导航桥增加 `navigationOnly`；
- 新增 `tools/test-navigation-service.mjs`，由 `ERR_MODULE_NOT_FOUND` 红灯进入绿灯，并接入 `task:preflight` 与 `wuxia:check:fast`；
- 真实 FB01 Runtime integrity 15/15、首局 54 事件、存档、358 动作审计和发布闭包均通过；Web/Android 发布闭包增至 16 个文件；
- 手动视觉首轮发现 390px 紧凑断点隐藏/截断阻断原因，已修复为全视口换行并提高紧凑出口触控高度；540×960 与 390×844 复验均无横向溢出、无原始 ID、控制台 0 error/0 warning；
- 独立 Standards 首审发现可变配置引用泄漏、缺字段策略未完全失败关闭、方向唯一校验不足、文档状态冲突和阻断反馈对比度/disabled 语义问题；全部修复后，服务输出深拷贝定义，策略完整性由 Runtime 自身再次防守，方向按单方向唯一校验，阻断文本最差对比度提升至 4.56:1，锁定出口使用原生 `disabled`；
- 真实 Edge `/www/` 在 540×960 与 390×844 各执行 12 个可见点击/截图步骤，均为 0 failures，终态截图均经人工打开复核；
- 详细合同见 `NAVIGATION_SERVICE_CONTRACT.md`，人工证据见 `ARCH-001_SLICE_3_MANUAL_VISUAL_ACCEPTANCE_20260720.md`；
- 本切片结论为 `PASS WITH KNOWN LIMITATIONS`。EntityInteractionService、ChapterSession 与 UI adapter 尚未完成，因此 ARCH-001 保持 `open`；
- 下一切片为 EntityInteractionService；`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

### Slice 4：EntityInteractionService

- 新增 `src/entityInteractionService.js`，把动态实体生命周期解析、NPC/物件选择裁决、动作可用性与执行分支预检、配置反馈模板解释提取为无状态服务；
- Runtime 仍是唯一状态、事件、存档和 ResultEffect 提交权威；服务不写状态、不发事件、不触碰 DOM；
- 新增 `chapterSystem.entityInteractionPolicy` 与 `config/wuxia_entity_interaction_policy.schema.json`，可见性字段、对话 actionType、默认叙事 token、排除前缀、全局反馈动作和文案模板全部由配置负责；
- Ajv Draft 2020-12 实际执行 Schema，并额外验证 actionType、可见性字段和反馈映射均能在当前配置解析；
- 修复旧 Runtime 中 availability 与 execution 可能各自选取分支的隐患；现在一次决策产生唯一深拷贝分支，精确分支条件失败时禁止退回默认文案；
- 新增 `tools/test-entity-interaction-service.mjs` 并保留 TDD 红灯 `ERR_MODULE_NOT_FOUND` 证据，随后合同测试转绿；
- `wuxia:check:fast` 通过：358 动作 `highRisk=0`、内容边界 `high=0`、首局 54 事件兼容；
- 浏览器验收工具新增页面 console/error、未捕获异常、Browser Log、横向溢出和顶部导航换行/截断硬门禁；
- 人工视觉首轮发现“放置江湖”顶部标题换行，修复为可伸缩 96px 导航列与不换行标签；540×960、390×844 各 20 步复验均为 0 failures、0 page console problems；
- 最终 UI 同步修复后重新执行 40 张截图；其中 36 张与上一轮逐字节一致，4 张 Combat 时间敏感截图再次以原始分辨率人工复核通过；
- 详细合同见 `ENTITY_INTERACTION_SERVICE_CONTRACT.md`，人工证据见 `ARCH-001_SLICE_4_MANUAL_VISUAL_ACCEPTANCE_20260721.md`；
- 本切片结论为 `PASS WITH KNOWN LIMITATIONS`。ChapterSession 与 UI adapter 尚未完成，因此 ARCH-001 保持 `open`；
- 下一切片为 ChapterSession；`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

Slice 4 回滚必须成组执行：恢复 Runtime/UI 的旧实体解析，删除 `EntityInteractionService`、policy Schema 与合同测试，并同步撤销发布范围和生产登记；禁止只删配置或只删服务形成半迁移状态。

### Slice 5：ChapterSession

- 新增 `src/chapterSession.js`，将状态、旗标、玩家/任务、选中实体、生命周期、地图标记、Pending Choice、既有 Pending Combat 兼容状态、事件与存档 DTO 收口为唯一会话状态权威；
- `src/wuxiaFirstSessionFlow.js` 从 1,088 行缩为 19 行兼容 facade，只委托工厂和摘要；
- 会话创建时深拷贝全部 Definitions 及 `options.initialChapter`，快照中的章节 Definitions 和公共命令返回的 event/result 均与内部状态隔离；
- 默认首局旗标从代码硬编码迁到 `sessionDefaults.initialFlags`，新增 `config/wuxia_chapter_session_defaults.schema.json` 并由 Ajv Draft 2020-12 实际验证，同时与屏幕启动兼容字段交叉校验；
- 新增 `tools/test-chapter-session.mjs`，保留模块缺失、外部定义污染、快照 Definition 泄漏、返回事件泄漏、initialChapter 泄漏和硬编码默认旗标的 RED/复审证据；
- Standards/Spec 首审发现 3 个 P1 状态隔离问题、1 个 P2 治理登记问题和 1 个配置驱动边界问题；修复后两路复审均为 `PASS WITH KNOWN LIMITATIONS`；
- Web/Android 发布闭包从 17 增至 18 个产品文件；www/Android unexpected=0，freshness findings=0；
- 真实 Edge `/www/` 在 540×960、390×844 各执行 20 步，均 0 failures、0 page console problems，终态 `STATE_FS_008_MAP_EXPLORE`；40 张首轮截图逐张人工检查，390×844 异常过渡帧再完整重跑 20 步并复核；
- 详细合同见 `CHAPTER_SESSION_CONTRACT.md`，人工证据见 `ARCH-001_SLICE_5_MANUAL_VISUAL_ACCEPTANCE_20260722.md`；
- 本切片结论为 `PASS WITH KNOWN LIMITATIONS`。只有 UI adapter 尚未完成，因此 ARCH-001 继续保持 `open`；
- 下一切片为 UI view-model / intent mapper / browser automation seam；`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

Slice 5 回滚必须成组执行：恢复旧 `wuxiaFirstSessionFlow.js` 实现，删除 ChapterSession、默认值 Schema、合同测试与合同文档，并同步撤销 Runtime 配置默认值、发布白名单、生产注册、工具分类和 Roadmap 证据；禁止形成双状态权威或半迁移。

### Slice 6：UI Flow Adapter 与 Browser Automation Adapter

- 新增 `src/uiFlowAdapter.js`，把屏幕解析、动态房间标题、独立 ViewModel、8 类严格 Intent 校验与 ChapterSession 命令映射提取为无 DOM 模块；
- 新增 `src/browserAutomationAdapter.js`，浏览器工具与 DOM 使用同一 Intent 通道；自动化命令不再复制领域调用和结果映射；
- `src/wuxia-main.js` 中 `state.runtime` 命中降为 0，控制器只持有 `state.ui`，HTML/DOM 不可绕过适配器直接写领域状态；
- 新增 `config/wuxia_ui_intent_contract.schema.json`，由 Ajv Draft 2020-12 实际编译；Runtime 支持类型、Schema `$defs` 与非空白 ID 规则双向对齐；
- 严格信封拒绝未知类型、空 ID、缺字段和额外字段，拒绝路径不调用 ChapterSession，因而保持零 mutation；
- `present()` 返回的屏幕定义和快照与适配器内部隔离；浏览器命令每次只触发一次 Intent 和一次 render；
- 新增 `tools/test-ui-flow-adapter.mjs`，保留 UI 模块和自动化模块两轮 `ERR_MODULE_NOT_FOUND` 红灯证据，随后 8 类 Intent、Schema、隔离、拒绝和旁路禁令全部转绿；
- `task:preflight`、`wuxia:check:fast` 与旧 WebView 兼容门禁已接入新模块；358 动作仍为 `highRisk=0`，内容边界 `high=0`，首局 54 事件保持兼容；
- Web/Android 发布闭包从 18 增至 20 个产品文件，Schema 仅作开发合同不运输；www/Android unexpected=0，freshness findings=0；
- 浏览器工具增加顶部导航按钮垂直裁切、状态属性行折行和截图预热门禁；人工验收发现的 390×844 状态行折行已先红后绿，Chromium 合成表面分块轮已作废；
- 最终 540×960 与 390×844 各 20 步真实 Edge 均 0 failures、0 控制台问题，终态 `STATE_FS_008_MAP_EXPLORE`；全部 40 张最终截图逐图打开，异常显示帧另做单图或同状态 PNG SHA 复核；
- 详细合同见 `UI_FLOW_ADAPTER_CONTRACT.md`，人工证据见 `ARCH-001_SLICE_6_MANUAL_VISUAL_ACCEPTANCE_20260722.md`；
- 本切片与 ARCH-001 结论均为 `PASS WITH KNOWN LIMITATIONS`；下一 P0 为 `T03-01`，G4 和上线仍未完成；
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

Slice 6 回滚必须成组执行：恢复 `wuxia-main.js` 的旧直接 Runtime 调用和内联自动化 API，删除两个适配器、Intent Schema、合同测试与合同文档，并同步撤销发布白名单、生产登记、Roadmap 状态和浏览器门禁；禁止形成 DOM 与自动化双命令通道。
