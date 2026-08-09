# 需求、系统、配置、资产与测试追踪

## 核心追踪矩阵

| 需求 | 程序权威 | 配置权威 | 资产权威 | 验收 | 任务 |
|---|---|---|---|---|---|
| 首局流程 | `chapterSession.js`（`wuxiaFirstSessionFlow.js` 仅兼容 facade） | `wuxia_first_session_flow.json` | AssetRegistry | simulator + interactions | ARCH-001, T03-01 |
| 条件拒绝原子性 | ConditionEvaluator 目标模块 | condition definitions | 无 | negative mutation test | T03-01 |
| 结果真实执行 | `resultExecutionModules.js` | result definitions | feedback IDs | result coverage + state delta | T03-01 |
| 地图/NPC 可达 | Navigation/Entity service 目标模块 | chapter rooms/entities/actions | map/portrait/icon slots | reachability + browser crawl | T03-00 |
| 存档恢复 | `runtimePersistence.js` | `runtime_persistence_contract.json` + contract/envelope Schemas | 无 | schema/checksum/migration/interrupted-write/recovery/rollback + real Edge | SAVE-001 done；REL-002/003 真机与商业回滚 blocked |
| Runtime 可观测与诊断回放 | `runtimeObservability.js` + UI Intent seam | `analytics_events.json` + contract/event/replay Schemas | 无外传；memory-only | schema/data-quality/privacy/replay match+divergence + real Edge 390×844 | OBS-001 done；正式 build ID、真机性能、远端运维归 REL-001/002/003 |
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

## ASSET-008 scene requirements traceability entry (2026-08-08)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Clean scene logical IDs and runtime landing zones | `config/wuxia_combat_scene_asset_requirements.json` + schema | `tools/validate-wuxia-combat-scene-asset-requirements.mjs` | `runtime:combat-scene-assets:validate` | Pass with known limitations; 2 reference-only scene rows |
| Reference binding parity | `config/wuxia_combat_reference_asset_overlay.json` | scene validator | `runtime:combat-scene-assets:test` | Pass; unknown/drifted references rejected |
| No baked player/NPC or HUD pixels | reference scene audit | manual `leitai.png` and `shulin.png` review | `docs/codex_game_development_os/ASSET_008_SCENE_ASSET_REQUIREMENTS_AUDIT_20260808.md` | Structurally Pass; final art quality/ownership still blocked |
| Portrait visual Gate C | scene + actor presentation | fresh browser route | `outputs/combat_manual_browser_flow_20260808_asset007_fresh/14_early_combat_screen.png` | Fail for placeholder product presentation; no false pass |

## COMBAT-004 traceability entry (2026-08-08)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| One logical binding for every combat presentation input | `config/wuxia_combat_presentation_contract.json` + schema | `tools/validate-wuxia-combat-presentation-contract.mjs` | `runtime:combat-presentation:validate` | Pass; 2 actors, 2 scenes, 28 visual cues, 5 audio cues, 16 Buff icons |
| Reference assets remain development-only | `config/wuxia_combat_reference_asset_overlay.json` | `src/assetRegistry.js` + presentation validator | `runtime:combat-reference-overlay:test`, presentation contract test | Pass; reference bytes cannot satisfy shipping |
| Production fallback and oscillator rejection | production profile in presentation contract + asset contract | strict presentation validator and production asset validator | strict test negative cases | Blocked intentionally; 53 bindings still need approved assets |
| Missing production asset requirements | ASSET-007～010 slot contracts | asset pipeline and manual Gate C | `COMBAT_004_PRESENTATION_BINDING_READINESS_20260808.md` | Open; no false completion claim |
| Functional combat presentation route | combat content + presentation contract | `tools/run-wuxia-real-browser-flow.mjs --scenario all-key-screens` | `outputs/combat_manual_browser_flow_20260808_combat004_fresh/14_early_combat_screen.png` and `real_browser_flow_summary.json` | Functional PASS (15/15, 0 failures); visual/product Gate C FAIL for CSS actors and placeholder scene |

## ASSET-009 VFX and Buff requirements traceability entry (2026-08-08)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| All configured visual cue IDs have an authored production requirement | `config/wuxia_combat_vfx_asset_requirements.json` + `config/wuxia_combat_presentation_contract.json` + combat content | `tools/validate-wuxia-combat-vfx-asset-requirements.mjs` | `runtime:combat-vfx-assets:validate` | Pass with known limitations; 28/28 rows are explicitly missing and production blocked |
| Buff semantic IDs have development-only reference bindings | ASSET-009 `buffIcons` + reference overlay bindings | VFX requirements validator | `runtime:combat-vfx-assets:test` | Pass; 16/16 are reference-only, six audited 52x54 exemplars, no reference bytes allowed to ship |
| No invalid VFX reference is treated as production art | `referenceAudit.eligibleVfxCandidates` and ineligible evidence | reference inventory + focused negative tests | `ASSET_009_VFX_ASSET_REQUIREMENTS_AUDIT_20260808.md` | Pass; zero eligible VFX candidates, static Skill UI icons rejected |
| Runtime binding and fallback are configuration governed | `policy.runtimeBindingPolicy` | validator and production presentation policy | ASSET-009 validator output | Pass; logical IDs at `combat.vfx`, development-only fallback, no production CSS satisfaction |
| Manual combat visual quality | VFX/Buff requirements plus presentation contract | fresh browser combat route and manual review | `outputs/combat_manual_browser_flow_20260808_asset009_fresh/14_early_combat_screen.png` | Gate C remains FAIL for current placeholder actor/scene/VFX; no false pass |

## ASSET-010 audio requirements traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| All configured audio cue IDs have an authored production requirement | `config/wuxia_combat_audio_asset_requirements.json` + `config/wuxia_combat_presentation_contract.json` + combat content | `tools/validate-wuxia-combat-audio-asset-requirements.mjs` | `runtime:combat-audio-assets:validate` | Pass with known limitations; 5/5 rows are explicitly reference-only and production blocked |
| Reference overlay parity remains development-only | ASSET-010 `audioCues` + `config/wuxia_combat_reference_asset_overlay.json` | audio requirements validator | `runtime:combat-audio-assets:test` | Pass; 5 logical cues resolve to 4 hashed MP3 exemplars, no reference bytes may ship |
| Production format and fallback policy | ASSET-010 `policy` | validator + presentation production profile | ASSET-010 validator output | Pass; OGG required, synth/oscillator/reference-only paths rejected |
| Loudness, peak and device latency evidence | ASSET-010 budgets and acceptance gate | future audio import/device QA | `ASSET_010_AUDIO_ASSET_REQUIREMENTS_AUDIT_20260809.md` | Open; no owned OGG or Android latency/mix evidence exists |

## ASSET-011 original-project development binding traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Development source is explicit and non-shipping | `sourceProject`, `activation` and `shippingAllowed` in `config/wuxia_combat_reference_asset_overlay.json` | `src/assetRegistry.js`, overlay validator | `ASSET_011_ORIGINAL_PROJECT_DEVELOPMENT_BINDING_20260809.md` | Pass; localhost-only development binding, no bytes in shipping registry |
| Logical coverage does not overclaim missing actors/VFX | `bindingCoverage.actor` and `bindingCoverage.vfx` | overlay semantic validator + focused test | `runtime:combat-reference-overlay:test` | Pass; actors 0/2 and VFX 0/28 remain explicit missing |
| Original-project scene/Buff/audio bindings resolve | overlay `assets[]` and `bindings` | `createReferenceAssetRegistry()` + browser flow | `outputs/asset_original_project_overlay_manual_20260809/14_early_combat_screen.png` | Development PASS; 2 scenes, 16 Buff rows and 5 audio rows resolve; production blocked |

## COMBAT-002B original-project playback traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Live combat event stream drives presentation audio | `config/wuxia_combat_content.json` audio cue map | `src/wuxia-main.js` `syncCombatPlayback()` and `playCombatAudioCue()` | `tools/run-wuxia-combat-reference-binding-acceptance.mjs` | Pass in development; player Buff event invoked configured MP3 binding |
| Buff icon is attached to the mutated runtime unit | combat Buff definitions + overlay `bindings.buffIcons` | `renderCombatRuntime()` + live `CombatSession` snapshot | `outputs/combat_reference_binding_acceptance_20260809_final/02_combat_reference_buff_and_audio_after_skill.png` | Development visual PASS; production art/ownership blocked |
| Production cannot accept the development overlay or fallbacks | presentation production profile and AssetRegistry policy | `tools/validate-wuxia-combat-presentation-contract.mjs`, `src/assetRegistry.js` | `COMBAT_002B_ORIGINAL_PROJECT_DEVELOPMENT_BINDING_20260809.md` | Deliberately BLOCKED until ASSET-007~010 provide approved assets |

## COMBAT-005 configured chapter result routing traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Chapter combat Result uniquely enters a real session | `chapterSystem.combatResultPolicies` + `wuxia_chapter_combat_result_policies.schema.json` | `EntityInteractionService` + `ChapterSession` | `runtime:combat-result-routing:test` | PASS; compare/inattack201/inattack202 mapped |
| Source/action/result ambiguity fails closed | policy allowlists and unique route semantic validator | entity interaction service + flow validator | five focused negative cases | PASS; no mutation on rejected route |
| Terminal outcome controls follow-up results | `outcomeResultTokens` and condition tokens | ChapterSession draft transaction | routing report + runtime integrity | PASS; victory-only results never execute on defeat/runaway |
| Runtime narrative tokens resolve from configuration | `runtimeMutation.textInterpolation` | `runtimeTextInterpolation.js` + ResultEffect/NPC projection | dynamic and fallback assertions; manual screenshots | PASS; no raw `$IN/$S/$N` |
| New encounters use shared formulas and balance gates | combat content + simulation scenarios | CombatSession simulator | `outputs/combat_simulation/combat_simulation_report.json` | PASS; 6×200 runs, all scenario limits pass |
| Portrait functional acceptance | browser evidence route + expected Result/Encounter | real Edge runner `combat-result-route` | `COMBAT_005_MANUAL_VISUAL_ACCEPTANCE_20260809.md` | PASS at 360×800, 390×844, 540×960; production art Gate C remains BLOCKED |
| Known first-session mismatch remains independent | focused report `knownUnrelatedMismatch.scope=separate` | routing test report | `outputs/combat/combat_result_routing_report.json` | Explicitly excluded; not concealed or reclassified |
| Legacy audits consume current combat authority | Result policy + combat content | shared `wuxia-combat-result-audit-policy.mjs`, interaction/result-token audits | 316 P3 rows, 0 P0/P1 result rows; online-standard has no runtime_result_token issue | PASS; remaining online issues are asset/visual only |

## Latest changeset strict re-audit traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Configured combat terminal outcome is truthful and atomic | `chapterSystem.combatResultPolicies` | `ChapterSession.resolvePendingCombat()` + first-session semantic validator | 4 positive / 8 negative routing assertions | PASS; zero/multiple/mixed terminal dispatch fails closed |
| Missing combat content or failed state transition cannot leave a fake accepted session | combat content + flow state registry | `ChapterSession.beginPendingCombat()` | focused missing-content and transition rejection assertions | PASS; no false side effect and active session is released |
| 358-action audit executes combat actions with the same runtime dependency as production | `wuxia_combat_content.json` | `audit-wuxia-fb01-action-state-assertions.mjs` | `runtime:action-state-assertions:test` | PASS 358/358 after the strict audit exposed and repaired the empty-content fixture |
| Generic compete and source-specific combat Results use truthful, distinct outcome cardinalities | action policy `optional_zero_or_one_satisfied`; Result policies `required_exactly_one` | `ChapterSession.resolvePendingCombat()` | flow semantic validator + chapter integration + focused routing | PASS; zero optional branch is legal, zero required or multiple satisfied branches fail closed |
| Development HTTP serving cannot escape the project root | no content configuration | `dev-server-path-policy.mjs` + `dev-server.mjs` | 3 valid + 3 negative path-policy assertions | PASS; encoded traversal, sibling-prefix and malformed URL rejected |
| Fresh combat route remains usable after strict repairs | combat Result policies + encounters | real Edge `combat-result-route` | `outputs/combat_result_visual/audit_20260809_final_current/` | 126/126 functional steps PASS; 18 current start/end frames manually reviewed; production visual Gate C BLOCKED |

## SAVE-001 persistence traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Save contract and envelope are schema-valid and versioned | `runtime_persistence_contract.json` + two Draft 2020-12 Schemas | persistence validator | `runtime:persistence:validate` | PASS; current=2, minReadable=1, contiguous v1→v2 migration |
| Save commit survives interrupted writes without replacing the last valid primary | storage keys and transaction policy | `runtimePersistence.js` staging/verify/backup/primary sequence | focused interrupted-write assertions | PASS |
| Corrupt or malformed primary recovers without silently loading a future version | recovery and compatibility policy | checksum verification and ordered candidate restore | unit suite + Edge recovery route | PASS; future primary fails closed |
| Old v1 save upgrades idempotently and remains available for rollback | migration and rollback policy | migration chain + `prepareRollback()` | v1/future fixtures, unit suite, `SAVE_001_COMPLETION_AND_RECOVERY_RUNBOOK_20260809.md` | PASS in browser; Android release rehearsal remains REL-002/003 |

## OBS-001 observability traceability entry (2026-08-09)

| Requirement | Configuration authority | Runtime/tool authority | Evidence | Verdict |
|---|---|---|---|---|
| Intent/result/rejection/delta/error/performance events have stable semantics | `analytics_events.json` + three Draft 2020-12 Schemas | `runtimeObservability.js` + UI Intent boundary | `runtime:observability:validate` and unit suite | PASS; 7/7 event types and required payloads |
| Events carry build/config/save/module/session/run/replay context | contract build/privacy/state policies | runtime context and Combat replay projection | Node + real Edge diagnostics | PASS; distinct session/run IDs and deterministic config hash |
| First-session replay can locate divergence | 36 configured tracked paths | `exportRuntimeReplay()` + `diagnoseObservedReplay()` | 3-command match; mutated reward diverges at command 2 | PASS; first mismatch category and hashes returned |
| Telemetry failure cannot change gameplay | no content ownership | UI Adapter fail-open observation seam | injected throwing observer regression | PASS; authoritative accepted result unchanged |
| Privacy and data quality are explicit | allowed Intent fields, forbidden fields, memory-only/upload-disabled retention | event emitter quality ledger | 0 missing, 0 privacy, 0 sequence findings in Node and Edge | PASS WITH KNOWN LIMITATIONS; no remote ingestion/dashboard |
| Browser wiring remains visually non-regressive | same screen/config contracts | Edge 390×844 OBS route | `outputs/obs001_browser_acceptance_20260809_final_current/` | Functional PASS and console 0; manual screenshot has no new breakage, overall placeholder art still BLOCKED |
