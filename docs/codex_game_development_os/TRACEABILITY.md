# 需求、系统、配置、资产与测试追踪

## 核心追踪矩阵

| 需求 | 程序权威 | 配置权威 | 资产权威 | 验收 | 任务 |
|---|---|---|---|---|---|
| 首局流程 | `chapterSession.js`（`wuxiaFirstSessionFlow.js` 仅兼容 facade） | `wuxia_first_session_flow.json` | AssetRegistry | simulator + interactions | ARCH-001, T03-01 |
| 条件拒绝原子性 | ConditionEvaluator 目标模块 | condition definitions | 无 | negative mutation test | T03-01 |
| 结果真实执行 | `resultExecutionModules.js` | result definitions | feedback IDs | result coverage + state delta | T03-01 |
| 地图/NPC 可达 | Navigation/Entity service 目标模块 | chapter rooms/entities/actions | map/portrait/icon slots | reachability + browser crawl | T03-00 |
| 存档恢复 | `runtimePersistence.js` / SaveService 目标 | persistence contract | 无 | migration/corruption/rollback | SAVE-001 |
| 11 屏 UI | `uiFlowAdapter.js` + `browserAutomationAdapter.js` + `wuxiaDomAdapter.js`（UI-ARCH-001 已完成） | screen + UI experience registry | fonts/map/icons | 当前切片双尺寸回归；完整 33 visual pairs 仍属后续 | T05-01, QA-UI-001 |
| 资产运输 | AssetRegistry resolver 目标模块 | asset registry | owned files | hash/license/budget/APK bytes | T05-02, ASSET-* |
| Android 发布 | build/audit/release tools | identity/web/release contracts | launcher/store assets | signed bundle/device/store | REL-001..003 |
| 战斗/Rest/Repair | CombatSession 目标模块 | combat definitions | combat feedback assets | deterministic combat tests | COMBAT-002 postponed |

## 输入证据到项目产物

| 输入 | 采用内容 | 项目产物 |
|---|---|---|
| OS 2.3.0 ZIP | governance, role, schema, toolchain, stage concepts | project profile, registries, G0-G7 plan |
| OS 合并报告 | PASS WITH KNOWN LIMITATIONS、`.codex-os/temp`、多引擎边界 | deployment + safety report |
| T00-01 文本 | scope/evidence/reproducibility requirements | G0 tasks and baseline commands |
| 旧施工包 | 31 task/R0-R9 history, code/data/resource maps | reconciled current plan, not current truth |
| 当前阶段报告 | T02-04B facts and open work | T03/T05 priorities |
| 当前源码/配置 | real runtime and state authority | subsystem registry and ARCH-001 |
| idledotshoot reference | browser/asset/release patterns | adopt/adapt/reject and QA/asset tasks |

## 证据等级

| 等级 | 含义 | 可支持结论 |
|---|---|---|
| E0 | 文件存在/哈希 | 来源与完整性 |
| E1 | Schema/静态校验 | 结构正确 |
| E2 | 单元/集成/模拟 | 行为合同 |
| E3 | 真实浏览器 DOM/交互 | Web Runtime 可见行为 |
| E4 | 多尺寸截图和独立复核 | UI/UX 视觉验收 |
| E5 | 真机、签名构建、商店/监控 | 发行上线 |

当前项目在不同链路上达到 E1-E3；整体没有达到 E5。

## 变更强制输出

后续每次 Codex 施工必须在完工记录中明确：

1. 当前现状；
2. 存在问题；
3. 修改方案；
4. 修改范围；
5. 配置变化；
6. 代码变化；
7. 测试方式；
8. 风险；
9. 未完成项。

同时记录任务 ID、起止 commit、配置 hash、生成物路径、门禁结果和 rollback 方案。
## QA-UI-001 traceability entry (2026-07-23)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Registry-driven browser surface sweep | `config/production/ui_experience_registry.json` | `tools/run-wuxia-browser-surface-sweep.mjs` | `outputs/wuxia_visual_matrix/20260723_qa_ui_001_final/` | Tool pass; product revise |
| Choice-result modal acceptance | `config/wuxia_browser_modal_probe.json` | `tools/audit-wuxia-choice-result-browser.mjs` | per-viewport screenshot + DOM failure bundles | Blocked by legitimate route |
| 11 screens x 3 viewports | UI registry | browser sweep | sweep report + coverage gaps | T05-01 open |
