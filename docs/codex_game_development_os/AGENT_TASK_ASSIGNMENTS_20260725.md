# 智能体任务分派记录 — 2026-07-25

## 主控决定

当前先建立验收制度，不直接接受 ASSET-002 的实现。ASSET-002 之前的构建尝试已发现 Android 资源阻断，必须经过独立审计后重新施工。

## 分派表

| Task ID | 智能体 | 工作内容 | 修改权限 | 状态 | Gate 1 | Gate 2 | 最终人工 |
|---|---|---|---|---|---|---|
| GOV-001 | project-lead | 建立施工、审计、回滚和手动验收规范 | 规范/配置/Markdown | accepted | qa-bot-regression-engineer | project-lead | project-lead |
| AUDIT-AGENT-001 | governance-audit-agent | 审计现有治理和追踪缺口 | 只读 | assigned | qa-bot-regression-engineer | project-lead | project-lead |
| ASSET-002-AUDIT | asset002-audit-agent | 审计 Android 资源、构建阻断和 provenance | 只读 | assigned | qa-bot-regression-engineer | project-lead | project-lead |
| QA-GATE-001 | qa-gate-agent | 设计两道门 QA 证据矩阵 | 只读 | assigned | qa-bot-regression-engineer | project-lead | project-lead |
| ASSET-002 | asset-content-pipeline-agent | 生产 Android 图标、Adaptive Icon、启动页 | 任务范围内代码/资源/配置 | blocked | qa-bot-regression-engineer | project-lead | project-lead |

## 统一交接要求

所有智能体必须按 [AGENT_WORK_AND_TWO_GATE_ACCEPTANCE_STANDARD_20260725.md](H:/MyProjectBack/idlewuxia/docs/codex_game_development_os/AGENT_WORK_AND_TWO_GATE_ACCEPTANCE_STANDARD_20260725.md) 的 YAML 交接格式返回；未包含失败项、风险、回滚和未完成项的交接视为无效。

## 当前禁止事项

- 禁止把 Android 生成物、APK、`www/` 或 outputs 提交到 Git。
- 禁止复制参考项目或竞品二进制资源。
- 禁止在 Gate 1 前将任务标记 done。
- 禁止在主控手动验收前推送。
- 禁止因 ASSET-002 修改 UI、战斗、存档或商业系统。
