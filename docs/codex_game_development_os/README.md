# Idlewuxia Codex Game Development OS

本目录是 `idlewuxia` 的项目级生产入口。它不是把通用 OS 原包整体复制进仓库，而是把与本项目有关的 HTML/Web、Capacitor、配置驱动、UI/UX、资产、QA 和发布合同组成一个可验证的 Active Overlay。

## 权威顺序

1. `config/project_scope.json`：项目、运输和 Git 范围权威。
2. `config/production/codex_os_project_profile.json`：引擎、工作区、OS 来源和延期边界权威。
3. `config/production/production_stage_plan.json`：G0-G7、31 项任务、依赖和验收权威。
4. `config/production/subsystem_registry.json`：系统边界、状态权威与模块归属。
5. `config/production/ui_experience_registry.json`：11 屏、3 尺寸及玩家反馈合同。
6. `config/production/asset_registry.json`：资产来源、授权、采用和运输资格。
7. `config/production/toolchain_registry.json`：生成、验证、浏览器、构建与发布工具状态。
8. `config/production/schemas/production_os_contract.schema.json`：上述生产配置的 Schema。

生成到 `outputs/production_os/` 的报告只是证据，不是配置权威。

## 文档入口

- [完整部署报告](PROJECT_DEPLOYMENT_REPORT.md)
- [当前项目完整重审计](PROJECT_FULL_REAUDIT.md)
- [系统架构与模块化目标](SYSTEM_ARCHITECTURE.md)
- [游戏体验与 UI/UX](GAME_EXPERIENCE_UI_UX.md)
- [参考项目采用与资产来源](REFERENCE_ADOPTION_AND_ASSET_PROVENANCE.md)
- [程序/配置/资产生产 Roadmap](PROGRAM_CONFIG_ASSET_PRODUCTION_ROADMAP.md)
- [生产阶段任务清单](STAGE_TASK_REGISTER.md)
- [上游文件选择与项目落点](UPSTREAM_SELECTION_CROSSWALK.md)
- [工具删除与执行安全审计](TOOL_SAFETY_AUDIT.md)
- [需求与证据追踪](TRACEABILITY.md)

## 可重复命令

```powershell
npm run production:validate
npm run production:inventory
npm run production:report
npm run task:preflight
npm run wuxia:check:fast
```

`production:inventory` 需要真实 Git 子进程。受限沙箱可能使 `git ls-files` 返回不可用；这种情况必须在正常本地环境重跑，不能把“0 个跟踪文件”当作项目事实。

## 当前正式判断

当前结论是 `PASS WITH KNOWN LIMITATIONS / NOT RELEASE READY`：

- HTML/Capacitor 运行链、证据契约、条件拒绝、结果执行器和 debug APK 链已有可重复证据。
- T03-00 已将旧 13/27 纠偏并关闭：129 个实体可达，10 个实体/24 个动作受控休眠，0 个未裁决；358/358 状态断言、11×3 视觉矩阵、自有资产运行时、签名 Release、真机矩阵和回滚演练仍未完成。
- `COMBAT-002` 与 `CombatSession` 继续延期，除非产品负责人明确解除。
