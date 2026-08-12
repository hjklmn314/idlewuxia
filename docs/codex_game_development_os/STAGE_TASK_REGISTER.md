# 生产阶段任务清单

机器权威：`config/production/production_stage_plan.json`。本表用于阅读，不应独立修改状态。

| ID | P | Gate | 状态 | Owner | 任务 |
|---|---|---|---|---|---|
| T00-01 | P0 | G0 | done | project-and-engine-auditor | 项目治理、证据与范围基线 |
| T00-02 | P0 | G0 | done | build-deployment-release-engineer | Git、CI 与 Android 身份闭环 |
| PROD-OS-001 | P0 | G0 | done | game-dev-os-orchestrator | Codex OS 2.3.0 项目 Overlay |
| UX-001 | P0 | G1 | done | ui-ux-feedback-designer | 玩家目标与 PSFCD 体验链 |
| TRACE-001 | P0 | G1 | done | documentation-traceability-engineer | 需求到实现和证据追踪 |
| AUDIT-001 | P0 | G2 | done | project-and-engine-auditor | 当前仓库全量重审计 |
| AUDIT-002 | P0 | G2 | done | competitor-module-decomposition | 参考项目采用审计 |
| ASSET-001 | P0 | G2 | done | asset-content-pipeline | 资产来源和运输资格登记 |
| TOOL-001 | P0 | G3 | done | production-toolchain-architect | 生产合同验证和报告工具 |
| CFG-001 | P0 | G3 | done | configuration-data-pipeline | 生产 Schema 与版本化合同 |
| T03-00 | P0 | G4 | done | level-content-designer | 旧 13/27 已纠偏为 129 可达、10 个受控休眠实体与 24 个受控休眠动作；0 未裁决 |
| ARCH-001 | P0 | G4 | done | subsystem-domain-architect | 拆分 Runtime 与 UI 巨型模块 |
| T03-01 | P0 | G4 | done | qa-bot-regression-engineer | 358/358 全动作状态断言 |
| SAVE-001 | P1 | G4 | done | save-migration-compatibility | 存档迁移、损坏恢复、回滚 |
| OBS-001 | P1 | G4 | done | analytics-observability-engineer | 运行时事件、日志和回放 |
| UI-ARCH-001 | P0 | G5 | done | ui-interaction-editor | UI 定义、导航和反馈适配器 |
| QA-UI-001 | P0 | G5 | done | qa-bot-regression-engineer | Browser Surface 与 Modal Sweep |
| T05-01 | P0 | G5 | blocked | qa-bot-regression-engineer | 11 屏×3 尺寸验收；自动功能通过但生产视觉失败 |
| T05-02 | P0 | G5 | done | asset-content-pipeline | AssetRegistry 接入 Runtime |
| ASSET-002 | P1 | G5 | open | asset-content-pipeline | Android 图标与启动页 |
| ASSET-003 | P1 | G5 | open | asset-content-pipeline | 中文字体授权、子集和预算 |
| ASSET-004 | P1 | G5 | open | asset-content-pipeline | 章节地图和节点状态资产 |
| ASSET-005 | P2 | G5 | open | asset-content-pipeline | NPC 肖像系统 |
| ASSET-006 | P2 | G5 | open | asset-content-pipeline | 交互和反馈图标族 |
| ASSET-CONTRACT-001 | P0 | G5 | done | asset-content-pipeline | 角色、场景、动画、VFX、音频统一资产合同 |
| VISUAL-STANDARD-001 | P0 | G5 | done | ui-ux-feedback-designer | 竖屏像素武侠可测视觉标准 |
| COMBAT-002A | P0 | G5 | done | combat-system-designer | 配置驱动战斗逻辑能力闭环 |
| COMBAT-002B | P0 | G5 | blocked | asset-content-pipeline | 战斗逻辑 ID 到批准资产绑定 |
| COMBAT-002 | P1 | G5 | blocked | combat-system-designer | 战斗生产表现总门；Rest/Repair 已拆分延期 |
| COMBAT-003 | P0 | G4 | done | combat-model-and-simulator | 暂停、重播、恢复与模拟一致性 |
| REST-REPAIR-001 | P1 | G5 | postponed | combat-system-designer | 真实 Rest/Repair |
| COMBAT-004 | P0 | G5 | done | combat-system-designer | 手动回合、技能和目标选择 |
| COMBAT-005 | P0 | G5 | done | combat-system-designer | 章节战斗结果路由 |
| ASSET-007 | P0 | G5 | open | asset-content-pipeline | 玩家战斗角色资产 |
| ASSET-008 | P0 | G5 | open | asset-content-pipeline | 敌人和干净战斗场景资产 |
| ASSET-009 | P0 | G5 | open | asset-content-pipeline | 战斗 VFX/Buff 表现资产 |
| ASSET-010 | P0 | G5 | open | asset-content-pipeline | 战斗 SFX/BGM 资产 |
| AUDIT-003 | P0 | G5 | blocked | project-and-engine-auditor | 全代码配置资源与近五日发布前重审计；生产视觉/Android 严格门仍阻断 |
| HYGIENE-001 | P1 | G4 | done | project-and-engine-auditor | 407 tracked files 四类互斥分层，29-file shipping 前后 hash 不变 |
| CONTENT-001 | P1 | G6 | done | modular-feature-framework | 第二章节配置复用认证完成；生产章节内容未激活 |
| EDITOR-ROI-001 | P2 | G6 | done | editor-framework-architect | 选择 JSON 权威＋校验/预览/diff/rollback 脚本工具；专用编辑器延期 |
| SEC-001 | P0 | G7 | done | security-compliance | CSP、Android source/merged 权限、FileProvider、隐私、secret 与依赖边界 |
| REL-001 | P0 | G7 | open | build-deployment-release-engineer | 签名 Release AAB/APK |
| REL-002 | P0 | G7 | open | qa-bot-regression-engineer | 真机、性能、兼容和商店 |
| REL-003 | P0 | G7 | open | release-incident-response | 分阶段发布、监控和回滚 |

## 当前可开工

1. `REL-001`：建立 Release build、R8/ProGuard、SBOM、外部签名输入和 commit/config/artifact 追踪；在 T05-01 blocked 时只能完成工具链，不能标记发行通过。
2. `AUDIT-003`：依赖矛盾已裁决，但其严格 Android/生产视觉门不得用浏览器功能 PASS 代替，继续 blocked。
3. 资产输入不阻断程序/配置工作，但 `ASSET-007`～`010`、`COMBAT-002B` 与 `T05-01` 在批准资产到位前保持 blocked/open。

G4 的 ARCH/T03/COMBAT-003/SAVE/OBS/HYGIENE 已全部完成，当前 Gate 为 pass；G5/G7 的生产视觉和发行门继续独立阻断。

2026-08-09 权威更新：`SAVE-001` 与 `OBS-001` 均已完成浏览器 Runtime 范围。OBS 现提供 7 类版本化事件、36 条状态投影、稳定错误码、Combat replay ID、build/config/save tags、性能样本和可定位首个分歧的诊断回放；远端上传仍禁用。详见 `OBS_001_COMPLETION_AND_DIAGNOSTIC_RUNBOOK_20260809.md`。

ARCH-001 当前进度：ConditionEvaluator、Result preparation、ResultEffectExecutor、NavigationService、
EntityInteractionService、ChapterSession 与 UI Adapter 六个切片均已完成并接入回归门禁，详见
`ARCH-001_IMPLEMENTATION_RECORD_20260719.md`。任务状态为 `done`，但这不代表 G4 或上线完成。

2026-07-20 历史更新：NavigationService 切片 3 已完成并通过真实浏览器手动验收。导航条件和阻断动作已改为 Schema 校验的配置解释，Web/Android 发布闭包当时为 16 个文件；EntityInteractionService、ChapterSession 与 UI adapter 当时仍未完成，因此 `ARCH-001` 当时保持 `open`，下一项为 EntityInteractionService。

2026-07-21 历史更新：EntityInteractionService 切片 4 已完成并通过 540×960、390×844 各 20 步真实浏览器人工验收。实体可见性、选择、动作唯一分支和反馈模板已改为 Schema 校验的配置解释，Web/Android 发布闭包当时为 17 个文件；ChapterSession 与 UI adapter 当时仍未完成，因此 `ARCH-001` 当时保持 `open`，下一项为 ChapterSession。

2026-07-22 Slice 5 历史更新：ChapterSession 切片 5 已完成并通过 540×960、390×844 各 20 步真实 Edge 人工验收。会话状态、命令编排、事件和存档 DTO 已迁移到唯一状态权威 `src/chapterSession.js`，旧工厂缩为兼容 facade；默认旗标改由 Ajv 校验的 `sessionDefaults` 配置驱动。Web/Android 发布闭包当时为 18 个文件。`ARCH-001` 当时保持 `open`，唯一剩余切片为 UI view-model / intent mapper / browser automation seam。

2026-07-22 Slice 6 更新：UI ViewModel、8 类严格 Intent Mapper 与 Browser Automation Adapter 已完成。DOM 与浏览器工具不再直接调用 `state.runtime`；Intent Schema 由 Ajv 实际验证，Web/Android 发布闭包为 20 个文件。540×960 与 390×844 各 20 步真实 Edge 最终验收均 0 failure、0 控制台问题，全部最终截图已人工检查。`ARCH-001` 更新为 `done`；下一 P0 为 `T03-01`。`COMBAT-002` 继续延期。

## 状态更新规则

- `done`：所有 acceptance 有当前 commit 绑定证据。
- `ready`：全部依赖已完成，范围和输入已清楚。
- `open`：任务存在但依赖或输入未闭合。
- `blocked`：有明确外部阻断和解除条件。
- `postponed`：产品负责人主动延期，不得自动恢复。
## 2026-07-23 QA-UI-001 checkpoint

`QA-UI-001` remains `open` with implementation verdict `REVISE / PRODUCT GATE
BLOCKED`. The deterministic tool is enabled, but the modal route is not
reachable from the supported baseline without state injection. `T05-01`
remains open; the six conditional screen/viewport pairs are explicit coverage
gaps. See `QA-UI-001_PREIMPLEMENTATION_AUDIT_20260723.md`,
`QA-UI-001_IMPLEMENTATION_RECORD_20260723.md`, and
`QA-UI-001_MANUAL_VISUAL_ACCEPTANCE_20260723.md`.

## 2026-07-25 QA-UI-001 / T05-01 closure

The prior blocker is closed by the localhost-only, configuration-declared
`tmnpc01a -> tmnpc01b -> tmnpc01c -> tmnpc01d` route in
`config/wuxia_browser_evidence_routes.json`. The real-browser sweep completed
all 30 active screen/viewport pairs, all three `tmnpc01d -> tmchoice01` modal
pairs, and both conditional screens at all three configured viewports with
zero blockers and zero page console problems. The three `UI_EarlyCombat`
pairs remain postponed under `COMBAT-002`; this closure does not waive that
postponement or any release gate. See the 2026-07-25 completion and manual
visual acceptance records.
## Authoritative delta — 2026-08-12 AUDIT-003

The machine-readable task status remains in `config/production/production_stage_plan.json`. This delta records the latest independent re-audit without changing completed task history:

| Task | Current status | Evidence / reason |
|---|---|---|
| `AUDIT-003` | `blocked` | `AUDIT_003_CURRENT_PRODUCTION_STATUS_20260812.md`; Gate A and Gate B pass, but strict production visual and Android acceptance are not complete. |
| `CONTENT-001` | `done` | `CONTENT_001_COMPLETION_RECORD_20260812.md`; isolated schema/foreign-key/runtime/diff/rollback fixture passed. No production story or chapter-specific runtime branch was added. |
| `COMBAT-002` | `blocked` | Runtime/session is complete; production presentation is blocked by ASSET-007–010 and strict manual visual acceptance. |
| `T05-01` | `blocked` | Browser functional matrix is 33/33 with zero console problems, but manual production art review fails and no Android device evidence exists. |
| `REL-001`–`REL-003` | `open` | Signed release, physical-device, store, monitoring and rollback gates remain outstanding. |

The known `FIRST_SESSION_SIMULATION_LIFECYCLE` mismatch remains a separately tracked diagnostic and is excluded from the UI/combat routing verdict. `REST-REPAIR-001` remains postponed by user instruction.

## Authoritative delta — 2026-08-12 CONTENT-001

`CONTENT-001` is now **done** for configuration-only later-chapter reuse. The
test-only package `chapter2_config_fixture` is schema-valid, foreign-key clean,
hash-diffable and rollback-safe. Generic node/room/NPC/interactable/result/
condition/reward/save/combat paths all passed positive and negative assertions;
no chapter-specific source branch was added and no production story was
activated.

Evidence: `config/wuxia_chapter_definition.schema.json`,
`tests/fixtures/chapter_reuse/chapter2_config_fixture.json`,
`tools/test-wuxia-later-chapter-config-reuse.mjs`,
`outputs/content001_chapter_reuse/chapter_reuse_report.json`,
`CONTENT_001_COMPLETION_RECORD_20260812.md`, and
`CONTENT_001_MANUAL_VISUAL_ACCEPTANCE_20260812.md`.

The browser retry passed 33/33 matrix pairs, 6/6 conditional pairs and 3/3
modal probes with zero console problems. Manual review passed changed-route
regression but retained the pre-existing production visual block. `EDITOR-ROI-
001` is complete, so G6 is `pass`; the next serial work is approved combat
asset intake and strict visual acceptance.
