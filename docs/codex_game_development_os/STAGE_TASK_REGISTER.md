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
| T03-01 | P0 | G4 | open | qa-bot-regression-engineer | 358/358 全动作状态断言 |
| SAVE-001 | P1 | G4 | open | save-migration-compatibility | 存档迁移、损坏恢复、回滚 |
| OBS-001 | P1 | G4 | open | analytics-observability-engineer | 运行时事件、日志和回放 |
| UI-ARCH-001 | P0 | G5 | done | ui-interaction-editor | UI 定义、导航和反馈适配器 |
| QA-UI-001 | P0 | G5 | open | qa-bot-regression-engineer | Browser Surface 与 Modal Sweep |
| T05-01 | P0 | G5 | open | qa-bot-regression-engineer | 11 屏×3 尺寸验收 |
| T05-02 | P0 | G5 | open | asset-content-pipeline | AssetRegistry 接入 Runtime |
| ASSET-002 | P1 | G5 | open | asset-content-pipeline | Android 图标与启动页 |
| ASSET-003 | P1 | G5 | open | asset-content-pipeline | 中文字体授权、子集和预算 |
| ASSET-004 | P1 | G5 | open | asset-content-pipeline | 章节地图和节点状态资产 |
| ASSET-005 | P2 | G5 | open | asset-content-pipeline | NPC 肖像系统 |
| ASSET-006 | P2 | G5 | open | asset-content-pipeline | 交互和反馈图标族 |
| COMBAT-002 | P1 | G5 | postponed | combat-system-designer | 真实 Rest/Repair 与 CombatSession |
| CONTENT-001 | P1 | G6 | open | modular-feature-framework | 第二章节 Feature Package |
| EDITOR-ROI-001 | P2 | G6 | open | editor-framework-architect | 内容编辑器 ROI 决策 |
| SEC-001 | P0 | G7 | open | security-compliance | 信任边界、隐私和权限 |
| REL-001 | P0 | G7 | open | build-deployment-release-engineer | 签名 Release AAB/APK |
| REL-002 | P0 | G7 | open | qa-bot-regression-engineer | 真机、性能、兼容和商店 |
| REL-003 | P0 | G7 | open | release-incident-response | 分阶段发布、监控和回滚 |

## 当前可开工

1. `T03-01`：T03-00 与 ARCH-001 已完成；当前第一项是建立 358/358 全动作前后状态断言。
2. `SAVE-001`、`OBS-001`：依赖 ARCH-001，仍需分别完成存档恢复/回滚与事件/回放合同。

G4 仍被 `T03-01`、`SAVE-001` 与 `OBS-001` 阻断。所有 G5、G6、G7 工作不得跳过 G4 出口。

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
