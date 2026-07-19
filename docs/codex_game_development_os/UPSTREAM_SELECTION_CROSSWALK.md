# OS 2.3.0 上游文件选择与项目落点

原 ZIP 225/225 文件保留在仓库外的只读审计区。本项目不复制整个 vendor 树，只选择与 HTML/Capacitor 生产有关的合同和方法。

| 上游类型 | 选择 | 项目落点 | 说明 |
|---|---|---|---|
| OS Constitution / AGENTS / Router | 采用原则 | Profile、README、Roadmap | 不覆盖根 `AGENTS.md` |
| HTML/Web engine profile | 适配 | activeEngine + architecture | 通用 profile 没有版本锁和真实 runtime 证明 |
| engine-agnostic runtime contract | 采用 | SYSTEM_ARCHITECTURE | Definition/Rule/Composition/Instance |
| configuration-driven runtime | 采用 | subsystem registry | 程序能力、配置内容 |
| configuration data pipeline | 采用 | production schema + validator | Ajv 2020-12 |
| modular feature framework | 采用 | Feature Package Roadmap | 第二章节验证 |
| asset content pipeline | 采用 | asset registry | provenance/license/hash/budget |
| UI/UX feedback | 采用 | UI experience registry | 11 屏玩家目标、输入、反馈 |
| QA bot regression | 采用 | QA-UI-001/T03-01 | 独立验证、证据包 |
| build/deployment/release | 采用 | G7 | signed build/monitor/rollback |
| UE5/Cocos/Godot/Unity profiles | 排除 | inactiveEngines | 不是本项目 |
| editor framework | 延后 | EDITOR-ROI-001 | 先证明 ROI |
| combat simulator templates | 隔离 | COMBAT-002 postponed | smoke 不等于真实战斗 |
| Python schema validators | 替换实现 | Ajv validator | 避免新增未锁定 Python 环境 |
| safe delete | 不激活 | TOOL_SAFETY_AUDIT | 项目不执行永久删除 |
| generic roadmap | 重排 | G0-G7 + 31 tasks | 以现有 FB01 证据和阻断为起点 |

## 未激活内容

- 多引擎并行适配与 parity gate；
- Cocos/Godot/Unity/UE5 adapter 目录；
- 没有本项目真实需求的商城、签到或 LiveOps 实例模板；
- 任何会扩大临时目录或删除范围的上游工具；
- 任何把结构测试误称为运行时、视觉或发行证明的结论。

## 采用标准

只有同时满足以下条件的上游内容才进入 Active Overlay：

1. 对当前 HTML/Capacitor 项目有直接生产价值；
2. 不覆盖现有项目权威；
3. 能映射到真实源码、配置、资产或 Gate；
4. 有项目级版本、Schema、验证与 rollback；
5. 不把参考内容、占位 adapter 或 smoke 结果伪装为完成。
