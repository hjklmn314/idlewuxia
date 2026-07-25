# T02-02 实施记录：物件交互接受语义与反馈执行状态

## 1. 当前现状

- FeatureId：`T02-02`。
- 阶段：`R2 / P0 / Entity Interaction Runtime`。
- Runtime 权威：`config/wuxia_first_session_flow.json -> createFirstSessionRuntime() -> createChapterSession()`。
- 本项只处理配置物件动作的接受语义、反馈结果和状态变化断言；`COMBAT-002`、Rest/Repair 与真实 `CombatSession` 仍按用户要求延期。
- 重新审计确认：旧报告把“只返回反馈文案”的分支等同于 accepted，无法区分成功叙事、条件拒绝和无执行器动作；旧的 T02-02 已完成描述因此不能作为本次审计证据。

## 2. 问题与判定规则

交互结果现在必须同时声明：

| 字段 | 允许语义 |
| --- | --- |
| `accepted` | 仅表示本次动作是否被接受为可执行结果；条件拒绝、无执行器不接受。 |
| `executionStatus` | `executed`、`rejected`、`deferred`、`unsupported`。 |
| `outcomeKind` | `state_effect`、`narrative_only`、`rejected_feedback`、`pending_combat`。 |
| `stateChanged` | 语义状态是否发生变化；事件日志、选择面板和反馈文本不计入状态变化。 |

“有反馈”不再等于“accepted”：

- 无条件或正向配置的观察型结果可以 `accepted=true / executed / narrative_only / stateChanged=false`，因为配置的文本反馈本身已执行。
- 由配置条件明确表达资源不足、属性不足、容量已满或技能门槛失败的反馈分支，返回 `accepted=false / rejected / rejected_feedback / stateChanged=false`。
- 没有运行时分支的动作返回 `accepted=false / unsupported`。
- 战斗入口仍返回 `deferred`，不在本项实现战斗。

## 3. 修改方案与模块边界

配置链：

`entityInteractionPolicy.execution -> branch.conditionTokens/conditionLookup -> classifyBranchOutcome -> interactionResponse -> UI/log/snapshot`

程序只提供通用解释、状态分类和事务边界；具体拒绝条件 token 由 `entityInteractionPolicy.execution.feedbackRejectionConditionTokens` 配置，未把物件 ID、关卡或技能写进 Runtime。

## 4. 修改范围

- `config/wuxia_entity_interaction_policy.schema.json`：增加执行状态常量、叙事结果常量及反馈拒绝条件契约。
- `config/wuxia_first_session_flow.json`：接入同一执行语义配置和当前来源数据中的拒绝条件 token 集合。
- `config/wuxia_fb01_action_state_assertion_policy.json`：将 accepted 断言升级为状态/结果语义契约，并明确 rejected feedback 的零状态变化规则。
- `src/entityInteractionService.js`：为分支附带条件定义，集中分类 `executed/rejected`、`narrative_only/rejected_feedback/state_effect`。
- `src/chapterSession.js`：NPC/物件统一返回执行状态、结果类型和状态变化；反馈拒绝保持反馈可见但写入 rejected 事件，不提交语义状态。
- `tools/audit-wuxia-t02-02-interaction-semantics.mjs`：配置动作枚举、默认路径与分支夹具审计，并将首局模拟单独登记。
- `tools/test-wuxia-t02-02-interaction-semantics.mjs`：正向叙事结果、负向反馈拒绝、无执行器动作和零状态变化测试。
- `package.json`：新增 T02-02 audit/test 命令，并纳入 `wuxia:check:fast`。

## 5. 配置审计结果

当前配置共有 18 个物件动作定义。审计工具执行了 18 条默认可达动作和 42 条分支夹具探针。

默认可达路径的关键结果：

| 物件动作 | 结果 | 语义 |
| --- | --- | --- |
| `fb01item_14/use` 镜台 | accepted / executed / narrative_only | 观察反馈，无语义状态变化 |
| `fb01item_20/use` 书柜 | accepted / executed / narrative_only | 翻找反馈，无语义状态变化 |
| `fb01item_7/give` 菜地 | rejected / rejected / rejected_feedback | 缺少浇水物品，反馈可见但不接受、不变更状态 |

分支夹具还覆盖了 `fb01item_13`、`fb01item_15`、`fb01item_21`、`fb01item_23`、`fb01item_6`、`fb01item_9` 的条件反馈；所有无状态反馈均被明确标记为 `narrative_only`（合法叙事执行）或 `rejected_feedback`（条件拒绝），不再出现 `accepted=true` 且缺少语义分类的伪执行。

机器报告：`outputs/t02_02_interaction_semantics/t02_02_interaction_semantics_report.json`（忽略目录，不提交）。

## 6. 测试与验收证据

- `npm run runtime:t02-02:interaction-semantics:test`：通过；正向 2 条、负向 5 条、无执行器 1 条；默认路径 `acceptedNoState=2`、`rejectedFeedbackNoState=1`；分支探针全部满足 truthful status。
- `npm run runtime:t02-02:interaction-semantics`：通过；`unsupportedAcceptedCount=0`、verdict=`pass`。
- 负向断言同时比较 `currentState`、玩家、任务、动态实体、地图标记和 pending combat，排除事件日志与选中面板变化。
- 既有 `runtime:condition-negative`、`runtime:integrity:test`、首局交互测试继续作为回归门禁。

## 7. 首局模拟差异隔离

`outputs/idlewuxia_migration/wuxia_first_session_flow_simulation.json` 当前 `mismatches=0`，但历史上曾出现从错误生命周期状态测试战斗交互可用性的差异，记录于 `docs/codex_game_development_os/T03-01_COMPLETION_RECORD_20260723.md`。该问题属于首局/战斗路由链路，不是物件反馈接受语义；报告字段 `relatedFirstSessionSimulation.scope=unrelated_to_T02-02` 且 `excludedFromVerdict=true`，不得用来抬高或降低本项结论。

## 8. 风险、回滚与人工视觉验收

- 风险：`feedbackRejectionConditionTokens` 是当前来源配置的语义映射；新增条件动作必须先更新契约和测试，不能靠字符串猜测。
- 风险：叙事型成功没有状态变化是设计允许项，不应被通用“无变化即失败”门禁误报。
- 回滚：回退本提交即可恢复旧交互返回结构；回滚后必须重新构建 Web bundle 并执行 Android 同步，禁止混用 JS/CSS。
- 人工视觉验收：本项未改变布局、按钮尺寸或导航结构；手动检查代表性地图物件反馈面板，确认镜台/书柜反馈仍显示，菜地缺少物品时显示拒绝反馈且面板刷新，无 console error/warning。完整 11 屏×3 尺寸矩阵仍属于 T05-01，不能由本项替代。

## 9. 未完成项与结论

- `COMBAT-002`、真实 `CombatSession`、Rest/Repair 仍延期。
- 仍需完成 358/358 全动作前后状态断言、T05-01 视觉矩阵、T05-02 自有 AssetRegistry、真机与商业 Release Gate。

本项结论：`PASS WITH KNOWN LIMITATIONS`。T02-02 的交互接受语义已可被配置、Runtime、测试和报告复现；整体产品尚未达到商业发行标准。
