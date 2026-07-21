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
| ARCH-001 | P0 | G4 | open | subsystem-domain-architect | 拆分 Runtime 与 UI 巨型模块 |
| T03-01 | P0 | G4 | open | qa-bot-regression-engineer | 358/358 全动作状态断言 |
| SAVE-001 | P1 | G4 | open | save-migration-compatibility | 存档迁移、损坏恢复、回滚 |
| OBS-001 | P1 | G4 | open | analytics-observability-engineer | 运行时事件、日志和回放 |
| UI-ARCH-001 | P0 | G5 | open | ui-interaction-editor | UI 定义、导航和反馈适配器 |
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

1. `ARCH-001`：T03-00 边界已稳定，当前第一项是拆分 Runtime/UI 控制器并建立可测试模块合同。
2. `T03-01`：依赖 T03-00 与 ARCH-001；架构拆分后完成 358/358 全动作状态断言。

`T03-01` 必须等待上述两项完成。所有 G5、G6、G7 工作不得跳过 G4 出口。

ARCH-001 当前进度：ConditionEvaluator、Result preparation、ResultEffectExecutor、NavigationService 与
EntityInteractionService 切片已完成并接入回归门禁；ChapterSession facade 和 UI adapter 仍未完成，详见
`ARCH-001_IMPLEMENTATION_RECORD_20260719.md`。因此任务状态保持 `open`。

2026-07-20 更新：NavigationService 切片 3 已完成并通过真实浏览器手动验收。导航条件和阻断动作已改为 Schema 校验的配置解释，Web/Android 发布闭包为 16 个文件；EntityInteractionService、ChapterSession 与 UI adapter 仍未完成，因此 `ARCH-001` 继续保持 `open`，下一项为 EntityInteractionService。

2026-07-21 更新：EntityInteractionService 切片 4 已完成并通过 540×960、390×844 各 20 步真实浏览器人工验收。实体可见性、选择、动作唯一分支和反馈模板已改为 Schema 校验的配置解释，Web/Android 发布闭包为 17 个文件；ChapterSession 与 UI adapter 仍未完成，因此 `ARCH-001` 继续保持 `open`，下一项为 ChapterSession。

## 状态更新规则

- `done`：所有 acceptance 有当前 commit 绑定证据。
- `ready`：全部依赖已完成，范围和输入已清楚。
- `open`：任务存在但依赖或输入未闭合。
- `blocked`：有明确外部阻断和解除条件。
- `postponed`：产品负责人主动延期，不得自动恢复。
