# 程序、配置、资产生产到发行 Roadmap

机器权威：`config/production/production_stage_plan.json`。本文件解释执行顺序和阶段出口。

## 当前结论

当前位于 G4，G0-G3 已建立可重复的治理、体验、审计和工具合同。项目不是 Release Ready。

`T03-00` 已完成：

- 旧 13/27 经配置化嵌套结果遍历纠偏为 129 可达实体、10 个受控休眠实体与 24 个受控休眠动作；
- 每个剩余不可达实体均有 `intentional_dormant` 决策、模块所有者、激活来源和启用前置条件；
- 未裁决实体与动作均为 0；
- 不在此任务中实现 COMBAT-002。

`ARCH-001` 已关闭并已为动作断言提供可测试模块边界；当前第一项为 `T03-01`。

### 2026-07-22 当前施工位置

- ARCH-001 的 Condition、Result preparation、Transactional EffectExecutor、NavigationService、EntityInteractionService、ChapterSession 与 UI Flow Adapter 六个切片均已完成；
- `src/chapterSession.js` 已接管唯一会话状态权威，旧 `wuxiaFirstSessionFlow.js` 仅保留兼容 facade；`src/uiFlowAdapter.js` 与 `src/browserAutomationAdapter.js` 已切断 DOM/自动化对 Runtime 的直接调用；Web/Android 运输闭包为 20 个产品文件；
- ChapterSession 的定义、初始章节、快照、事件、命令结果和存档边界已完成隔离，配置默认旗标具备 Schema、Ajv 校验和双来源一致性门禁；
- 两个移动视口真实 Edge 交互与人工视觉复核通过，但只覆盖本切片回归，不替代 G5 的 11 屏×3 尺寸和 Android 真机验收；
- ARCH-001 已在全量回归、双尺寸真实浏览器复验和独立复审后关闭；下一 P0 施工项为 `T03-01`：358/358 动作 before/after 状态断言；
- COMBAT-002、Rest/Repair 与真实 CombatSession 继续延期。

## 阶段总览

| Gate | 目标 | 程序 | 配置 | 资产 | 出口 |
|---|---|---|---|---|---|
| G0 | 治理基线 | baseline/Git/CI | project scope/profile | 运输边界 | 可复现、可回滚 |
| G1 | 玩家体验 | intent/feedback contract | UI experience | asset needs | 目标、输入、反馈完整 |
| G2 | 全量审计 | runtime/tool audit | data reachability | provenance | 事实/推断/未知分离 |
| G3 | 工具链 | validator/generator | Schema/version | registry seed | 0 contract findings |
| G4 | 模块化 Runtime | session/services/events/save | definitions/rules/composition | logical IDs only | 358/358 assertions |
| G5 | 产品与呈现 | UI adapter/browser QA | 11-screen definitions | owned asset system | 33/33 visual pass |
| G6 | 扩展生产 | generic feature packages | second chapter | reusable packs | 无章节硬编码 |
| G7 | 发布运营 | signed build/monitor/rollback | release config | store assets | 正式 PASS |

## G4：模块化运行时

施工顺序：

1. `ARCH-001` Characterization Tests 与通用服务提取（已完成）。
2. `T03-01` 358/358 动作 before/after assertion。
3. `SAVE-001` 存档迁移、损坏恢复、回滚。
4. `OBS-001` intent/result/delta 事件和回放。

G4 上线级出口：

- 0 个未裁决不可达内容；
- 358/358 动作有 availability/dispatch/delta 证明；
- 拒绝动作 mutation=0；
- 通用模块不出现具体 NPC、房间、章节、技能 ID；
- 存档升级和降级路径有测试；
- 事件可重放首局路径。

## G5：产品体验和资产

施工顺序：

1. `UI-ARCH-001` 分离 UI definition、navigation、interaction、feedback adapter。
2. `QA-UI-001` 建立项目化 Browser Surface/Modal Sweep。
3. `T05-02` AssetRegistry 运行时和 Build Gate。
4. ASSET-002..006 生产自有资产。
5. `T05-01` 11 屏×3 尺寸完整验收。

G5 出口：

- 33/33 screenshot + DOM + computed style + overflow + console + state delta；
- 0 console error/warning；
- 0 未批准运输资产；
- 资产 package budget 通过；
- dormant 射击 CSS 不再进入武侠运输包；
- Android adaptive icon 和 launch screen 通过真机检查。

`COMBAT-002` 仍为 postponed。只有产品负责人明确解除后，才建立真实 CombatSession、Rest/Repair 资源消耗和结果差异。

## G6：规模化内容生产

- 用第二章节证明 Definition/Rule/Composition/Instance 可复用。
- 新章节只新增 Feature Package/config/assets，不新增章节 ID 分支。
- 统计内容制作时间、重复修改和错误类型后再决定编辑器。
- 编辑器只有在 ROI 成立时才做，并必须有 Schema、diff、undo、preview、validation。

## G7：发行上线部署

### Release Candidate

- clean commit 构建；
- production validate、preflight、fast gate、33/33 visual、device matrix 全通过；
- Web bundle、Android bundle 和 commit/config hash 可追踪；
- keystore/secret 不进入仓库；
- 生成签名 AAB 或 release APK，而非 development debug。

### 商店与设备

- Android 权限最小化；
- 目标 Android/WebView 版本和代表设备；
- 安装、升级、卸载重装、后台恢复、离线、存档损坏、低存储；
- 启动、内存、长时运行和崩溃；
- 商店名称、图标、截图、隐私和内容分级。

### 分阶段发布

- internal → closed → staged production；
- 预设 crash/startup/save/progression 阈值；
- 达阈值自动停止扩量；
- 具有上一稳定版本、配置回滚或 hotfix 路径；
- 完成一次回滚演练并保存时间线和决策证据。

## 任务状态

完整 31 项任务、依赖、Owner、验收和证据在生产配置中。运行：

```powershell
npm run production:report
```

## 2026-07-23 T03-01 completion update

`T03-01` is now `done` in the machine-authoritative production plan. The new configuration-driven action-state contract executes all 358 FB01 actions through isolated public `ChapterSession` fixtures and proves:

- 358/358 availability, dispatch, and semantic before/after assertions;
- rejected actions have zero semantic mutation;
- accepted actions have a declared state delta, narrative-only feedback, pending-choice transition, or pending-combat transition;
- dynamic entities reached through nested configured results are materialized only in in-memory fixtures;
- resource validation is performed before availability is exposed, so availability and dispatch cannot disagree on insufficient inventory/crafting branches.

Evidence and tools:

- `config/wuxia_fb01_action_state_assertion_policy.json`
- `config/wuxia_fb01_action_state_assertion.schema.json`
- `tools/audit-wuxia-fb01-action-state-assertions.mjs`
- `tools/test-wuxia-fb01-action-state-assertions.mjs`
- `docs/codex_game_development_os/T03-01_COMPLETION_RECORD_20260723.md`

G4 remains blocked by `SAVE-001` and `OBS-001`. `COMBAT-002` (including Rest/Repair and real `CombatSession`) remains postponed. The next non-postponed P0 is `UI-ARCH-001`, but it must not be treated as a release declaration; T05-01, T05-02, real-device, signed-release, performance, store, rollout, and rollback gates remain open.

会生成当前 Gate、完整任务表、下一批非延期 P0 和资产 disposition。
