# 治理与两道门审计报告 — 2026-07-25

## 结论

当前治理基线：`REVISE`。本轮先建立规则，不进入 ASSET-002 正式施工。

## 已确认事实

- `config/production/production_stage_plan.json` 是当前生产计划机器权威。
- `production:validate` 只证明结构、依赖、文件存在和 done evidence，不证明独立审计、手动验收、影响面、哈希或回滚。
- `STAGE_TASK_REGISTER.md` 与生产计划存在 T03-01、T05-02 状态不同步，不能作为第二个权威来源。
- 浏览器自动化证据不能替代逐张手动视觉验收；computed-style、DOM/state、设备矩阵必须按实际产物核对。
- ASSET-002 当前阻断：清洁仓库缺少可复现的 Android 资源链、API22 fallback、资源生成器、平台资产 provenance 和设备视觉证据；旧 PNG 属于本地 stale/template 资源，不能运输。
- 当前本地 HEAD `3e15361` 超前远端 `61857d8`，且存在未提交 Android 修改；本轮不得覆盖、重置或擅自暂存这些修改。

## 已建立的治理合同

- `config/production/agent_work_policy.json`
- `config/production/agent_work_policy.schema.json`
- `tools/validate-agent-work-policy.mjs`
- `tools/test-agent-work-policy.mjs`
- `AGENT_WORK_AND_TWO_GATE_ACCEPTANCE_STANDARD_20260725.md`
- `AGENT_TASK_ASSIGNMENTS_20260725.md`

## 两道门和最终人工验收

1. Gate 1：独立 QA 工程证据门。
2. Gate 2：主控独立严格审计门。
3. Gate 2 后：主控最终手动验收所有相关系统、配置、资源和截图。

只有三者全部 PASS 才能将任务标记为 `accepted`。本轮政策工具测试已通过；ASSET-002 仍是 `blocked`。

## 需要后续治理施工的任务

- GOV-002：Gate 1 证据运行器和状态/哈希检查。
- GOV-003：Gate 2 严格复核运行器和人工验收登记。
- GOV-004：无级联影响图与关联系统回归检查。
- GOV-005：统一 handoff、manual signoff 和 completion record 模板。
- GOV-006：生产计划、Stage Register、Subsystem nextTask 一致性门禁。
- GOV-007：修复现有 T03-01/T05-02 状态冲突并明确唯一权威。
