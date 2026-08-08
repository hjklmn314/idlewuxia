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
| 战斗逻辑与运行时回放 | `src/combatSession.js` / `src/chapterSession.js` | `config/wuxia_combat_content.json` + `config/wuxia_combat_simulation.json` | development reference overlay；production 仍需 ASSET-007～010 | pause/replay/save restore + shared-runtime simulation | COMBAT-002A, COMBAT-003 |
| 战斗表现/Rest/Repair | CombatSession presentation adapter | combat definitions | approved combat feedback assets | strict visual/device gates | COMBAT-002B/COMBAT-002 blocked；REST-REPAIR-001 postponed |

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

## QA-UI-001 / T05-01 closure entry (2026-07-25)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Tangmen NPC replacement route | `config/wuxia_browser_evidence_routes.json` | `src/browserEvidenceRoute.js`, `tools/audit-wuxia-choice-result-browser.mjs` | `outputs/wuxia_visual_matrix/20260725_qa_ui_001_tmnpc01d_final/modal/` | Pass; 3/3 modal viewports |
| UI_NpcInteraction and UI_ChapterLoop | `config/production/ui_experience_registry.json` + configured action IDs | `tools/run-wuxia-real-browser-flow.mjs --scenario chapter-loop-screens` | `outputs/wuxia_visual_matrix/20260725_qa_ui_001_tmnpc01d_final/conditional/` | Pass; 6/6 active conditional pairs |
| Active UI matrix | UI registry | `tools/run-wuxia-browser-surface-sweep.mjs` | `outputs/wuxia_visual_matrix/20260725_qa_ui_001_tmnpc01d_final/browser_surface_sweep_report.json` | Pass; 30 active pairs, 0 gaps, 0 blockers |
| Unrelated first-session simulation mismatch | T03-01 historical diagnostic | sweep `validationScope.knownUnrelatedMismatches` | validation report field `FIRST_SESSION_SIMULATION_LIFECYCLE` | Tracked separately; excluded from verdict |

## T02-02 traceability entry (2026-07-25)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Truthful interactable acceptance semantics | `config/wuxia_first_session_flow.json -> chapterSystem.entityInteractionPolicy.execution` | `src/entityInteractionService.js`, `src/chapterSession.js` | `tools/audit-wuxia-t02-02-interaction-semantics.mjs`, `tools/test-wuxia-t02-02-interaction-semantics.mjs` | Pass; 0 accepted unsupported, narrative-only and rejected-feedback separated |
| Feedback-only configured actions | `feedbackRejectionConditionActions`, `feedbackRejectionConditionTokens` | `classifyBranchOutcome()` + `interactionResponse()` | `outputs/t02_02_interaction_semantics/t02_02_interaction_semantics_report.json` | Pass; default 2 executed narrative-only, 1 rejected feedback |
| First-session simulation separation | existing simulator report | T02-02 audit report `relatedFirstSessionSimulation` | `outputs/idlewuxia_migration/wuxia_first_session_flow_simulation.json` and T03-01 record | Excluded from T02-02 verdict |

## ASSET-007 actor requirements traceability entry (2026-08-08)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Player and enemy logical actor requirements | `config/wuxia_combat_actor_asset_requirements.json` + schema | `tools/validate-wuxia-combat-actor-asset-requirements.mjs` | `runtime:combat-actor-assets:validate` | Pass with known limitations; exactly 2 rows, both truthfully missing |
| Reference archive eligibility | `referenceAudit` in the requirements manifest | read-only archive inventory and manual image review | `docs/codex_game_development_os/ASSET_007_ACTOR_ASSET_REQUIREMENTS_AUDIT_20260808.md` | No eligible side-view actor set; no bytes copied or bound |
| Negative production and shipping semantics | `sourcePolicy` and `acceptanceGate` | focused negative tests | `runtime:combat-actor-assets:test` | Pass; false satisfaction and reference shipping are rejected |
| Manual visual diagnosis | current combat presentation route | manual browser screenshot review | `outputs/combat_manual_browser_flow_20260808_combat004_fresh/14_early_combat_screen.png` | Gate C remains FAIL for CSS actors/placeholder art; blocker is visible and not masked |

## COMBAT-004 traceability entry (2026-08-08)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| One logical binding for every combat presentation input | `config/wuxia_combat_presentation_contract.json` + schema | `tools/validate-wuxia-combat-presentation-contract.mjs` | `runtime:combat-presentation:validate` | Pass; 2 actors, 2 scenes, 28 visual cues, 5 audio cues, 16 Buff icons |
| Reference assets remain development-only | `config/wuxia_combat_reference_asset_overlay.json` | `src/assetRegistry.js` + presentation validator | `runtime:combat-reference-overlay:test`, presentation contract test | Pass; reference bytes cannot satisfy shipping |
| Production fallback and oscillator rejection | production profile in presentation contract + asset contract | strict presentation validator and production asset validator | strict test negative cases | Blocked intentionally; 53 bindings still need approved assets |
| Missing production asset requirements | ASSET-007～010 slot contracts | asset pipeline and manual Gate C | `COMBAT_004_PRESENTATION_BINDING_READINESS_20260808.md` | Open; no false completion claim |
| Functional combat presentation route | combat content + presentation contract | `tools/run-wuxia-real-browser-flow.mjs --scenario all-key-screens` | `outputs/combat_manual_browser_flow_20260808_combat004_fresh/14_early_combat_screen.png` and `real_browser_flow_summary.json` | Functional PASS (15/15, 0 failures); visual/product Gate C FAIL for CSS actors and placeholder scene |
