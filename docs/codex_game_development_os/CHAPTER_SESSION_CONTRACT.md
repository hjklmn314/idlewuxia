# ChapterSession 模块合同

任务：`ARCH-001 / Slice 5`

Owner：`subsystem-domain-architect`

独立验收：`qa-bot-regression-engineer`

当前判定：`implemented; ARCH-001 remains open until Slice 6 UI adapter`

## 1. 当前现状

`src/chapterSession.js` 是章节会话唯一可写状态权威。它从配置定义和可选存档种子创建一个独立会话实例，编排已经拆出的 Condition、Result、Navigation 与 Entity 服务，并对外提供稳定的命令、查询、事件和存档 DTO。

`src/wuxiaFirstSessionFlow.js` 只保留旧名称兼容层：

- `createFirstSessionRuntime()` 委托 `createChapterSession()`；
- `summarizeFirstSessionContract()` 委托 `summarizeChapterSessionContract()`；
- 兼容层不持有状态、不解释配置、不写事件。

## 2. 输入合同

`createChapterSession(definitions, options)` 接收：

- `definitions`：状态、动作、玩家种子、章节 Definition/Rule/Composition；
- `definitions.sessionDefaults.initialFlags`：未提供存档或显式 options 时的配置默认旗标；
- `options.initialState`：初始状态覆盖；
- `options.initialFlags`：初始旗标；
- `options.initialPlayer`：测试或受控启动玩家种子；
- `options.initialSaveState`：既有 `idlewuxia.first_session_runtime_save.v1` DTO。

旗标初始化优先级固定为：兼容存档 `flags` > `options.initialFlags` > `definitions.sessionDefaults.initialFlags` > 空数组。具体旗标值只能来自配置或存档。

创建时对 `definitions` 深拷贝。实例不保留调用者可变配置引用，外部热改、测试夹具复用或异步加载不能改写已运行会话的动作语义。

## 3. 公共接口

查询：

- `snapshot()`：返回脱离内部状态的玩家/UI 快照；
- `exportSaveState()`：返回既有 v1 存档 DTO。

命令：

- `dispatch(actionId)`；
- `selectChapterNode(nodeId)`；
- `selectChapterRoom(roomId)`；
- `selectChapterNpc(roleId)`；
- `interactWithChapterNpc(roleId, actionType)`；
- `selectChapterInteractable(interactableId)`；
- `interactWithChapterInteractable(interactableId, actionType)`；
- `resolvePendingChoice(optionId)`；
- `resolvePendingCombat(outcome)`。

本切片没有新增、删除或重命名公共字段。`resolvePendingCombat` 仅保留现有延期兼容链，不代表真实 CombatSession 已实现。

## 4. 状态所有权

ChapterSession 独占以下可变状态：

- 当前流程状态、旗标、玩家状态和任务状态；
- 选中节点、房间、NPC 与物件；
- 隐藏、动态加入和替换实体；
- 地图标记；
- Pending Choice 与现有 Pending Combat 兼容状态；
- 会话事件列表。

无状态服务只能返回裁决或事务草稿。只有 ChapterSession 可以采纳裁决、提交草稿并追加事件。

## 5. 原子性与失败关闭

- 未知命令、条件失败、未知定义、不可达房间/实体和无执行分支必须拒绝；
- 结果准备或事务执行失败时，不提交玩家、地图、实体、任务和选择状态；
- 拒绝可以追加结构化拒绝事件，但不得产生游戏状态变化；
- `snapshot()`、事件和 `exportSaveState()` 均返回深拷贝，调用者不能反向修改会话。

## 6. 配置驱动边界

代码只提供索引、解释、编排、原子提交和快照能力。具体章节、房间、NPC、物件、动作、条件、结果、奖励、文本和资源逻辑 ID 继续由 `config/wuxia_first_session_flow.json` 负责。

本模块禁止增加具体章节 ID、房间 ID、NPC ID、技能 ID 或奖励 ID 分支。原先写死在 Runtime 的首局默认旗标已迁移到 `sessionDefaults.initialFlags`，并由 `config/wuxia_chapter_session_defaults.schema.json` 实际校验；验证器同时要求它与旧屏幕启动兼容字段一致，防止双来源漂移。

## 7. 兼容与持久化

- 旧工厂与直接 ChapterSession 的相同命令序列必须得到逐字段一致的返回值、事件和存档；
- 存档 `$schema`、字段、恢复校验和 `runtimePersistence` 的自动 flush 行为不变；
- 本切片不是 `SAVE-001`：不新增迁移链、中断写恢复或跨版本降级；
- 本切片不是 `OBS-001`：不声明新的分析事件 Schema 或回放协议。

## 8. 测试与验收

TDD 证据：

- 首次执行 `tools/test-chapter-session.mjs` 得到 `ERR_MODULE_NOT_FOUND`；
- 定义隔离测试首次执行得到 `actual=external_state / expected=result`；
- 配置默认旗标测试首次执行得到 `actual=new_install_or_new_save / expected=configured_start`；
- Standards/Spec 独立复审另外复现了 chapter snapshot Definition 引用、`options.initialChapter` 引用和命令返回 event 引用可反向污染内部会话；三类复审用例并入合同测试后全部转绿；
- 实现独立定义快照后合同测试转绿。

模块合同至少验证：公共接口白名单、状态转移、节点选择、快照隔离、存档往返、外部定义隔离、旧工厂逐命令兼容。

发布前还必须通过现有 persistence、runtime integrity、choice、first-session、WebView、全量门禁、真实浏览器交互和人工视觉检查。

## 9. 风险、回滚与未完成项

已知限制：

- 模块仍是 JavaScript + JSDoc/测试合同，不是编译期 TypeScript；
- `wuxia-main.js` 仍直接调用 Runtime，UI view-model/intent adapter/automation seam 属于 Slice 6；
- 真实 CombatSession、Rest/Repair 继续延期；
- `SAVE-001`、`OBS-001`、358/358 动作证明和 11 屏乘 3 尺寸验收未完成。

回滚必须成组执行：恢复旧 `wuxiaFirstSessionFlow.js` 实现，删除 `chapterSession.js` 和合同测试，并同步撤销 package 门禁、项目发布白名单、生产注册与 Roadmap 证据。禁止只删除兼容层或只删除新状态权威形成半迁移状态。
