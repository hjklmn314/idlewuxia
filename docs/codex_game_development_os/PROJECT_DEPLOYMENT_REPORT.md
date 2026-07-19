# Codex Game Development OS 2.3.0 项目部署报告

## 1. Current State

本次采用“只读上游证据 → 项目 Active Overlay → Schema/工具/任务门禁”的三层结构：

```text
Codex Game Development OS v2.3.0 ZIP（仓库外，只读审计）
  -> idlewuxia HTML/Capacitor Active Overlay（仓库内）
  -> config/production + tools + docs（可校验、可回滚）
```

输入证据：

| 输入 | SHA-256 | 处理 |
|---|---|---|
| `Codex_Game_Development_OS_v2.3.0_Unified_Multi_Engine_Multi_Agent.zip` | `22602f79c739cd6f9a50abc6a90654d2a220658276ebc494512b8587f12cc5ad` | 225/225 条目安全解压并读取；无路径穿越、无重复路径 |
| `Codex_Game_Development_OS_v2.3.0_Merge_Report_CN.md` | `d1cfa8c86bf047891e7214301c7f25a5dfc4f3b384897382a98a23ce347e6d43` | UTF-8 全文读取 |
| `pasted-text.txt`（T00-01） | `3778ae31736d9b30de61b7b43e55abd60e9a374b9779a2e9332192f2b0cc6328` | UTF-8 全文读取 |

上游包验证：

- 41 Skills、32 Roles、49 Subsystems、5 Engine Profiles。
- 5/5 starter contract tests 通过。
- HTML Profile 是通用脚手架，不是 `idlewuxia` 运行时证明。
- UE5、Cocos Creator、Godot、Unity 均未激活。

## 2. Problems

重审计确认以下问题不能被旧 `pass` 报告覆盖：

- 当前是运行时纵切，不是完整产品发行状态。
- `src/wuxiaFirstSessionFlow.js` 约 1938 行，仍同时承担状态、条件、结果、NPC/物件、战斗占位和存档 DTO。
- `src/wuxia-main.js` 约 1229 行，仍同时承担 DOM、路由、交互、自动化、持久化初始化和固定战斗播放。
- `src/styles.css` 约 3852 行；武侠样式叠加在较早的射击项目样式之后，旧样式仍进入 12 文件运输闭包。
- 13 个实体、27 个动作不可达；135 个非战斗动作因没有执行模块而隐藏。
- 11 屏×3 尺寸完整视觉矩阵、AssetRegistry 运行时接入、签名 Release、真机和回滚未完成。
- 258 个无歧义旧单来源对象仍由兼容层读取。
- debug APK 有可追踪证据，但不能代表商业发布包。

## 3. Proposed Solution

采用六个项目级权威配置：

- Project Profile：只允许 HTML/Web + Capacitor。
- Subsystem Registry：声明状态归属、程序模块、配置来源和下一任务。
- UI Experience Registry：声明玩家目标、输入、反馈和 33 个视觉验收单元。
- Asset Registry：对每项资产执行来源、授权、采用和运输资格判定。
- Toolchain Registry：声明实际可运行、部分完成、阻断的工具。
- Production Stage Plan：把 G0-G7、31 项任务、依赖与验收条件机器化。

## 4. Change Scope

本次只增加：

- `config/production/` 下生产配置和 Schema；
- `tools/` 下生产合同验证、逐文件完整读取清单和报告生成器；
- `docs/codex_game_development_os/` 下项目生产说明；
- `package.json` 中三个生产命令，并把生产合同验证接入 `task:preflight`。

未修改玩家运行时、FB01 内容和 Android 原生代码；未复制参考项目资源。

## 5. Configuration Changes

生产配置使用版本化 `$schema` 标识。Ajv Draft 2020-12 负责结构验证，项目工具继续验证：

- G0-G7 是否完整；
- 任务 ID、依赖、阶段和循环是否正确；
- 已完成任务是否有证据；
- 11 屏是否与当前 Screen Contract 一致；
- 33 个屏幕/尺寸组合是否匹配；
- 运输资产是否真实存在、大小与 SHA-256 一致；
- 非运输资产是否错误声明 `shippingPath`；
- 系统、工具和资产槽引用的任务是否存在；
- `COMBAT-002` 是否仍处于延期。

## 6. Code Changes

新增工具：

- `tools/validate-production-os.mjs`
- `tools/build-production-evidence-inventory.mjs`
- `tools/generate-production-report.mjs`

生成物位于 `outputs/production_os/`，由 `.gitignore` 排除。工具不删除文件，不写入玩家配置，不复制参考资源。

## 7. Test Method

部署验收至少执行：

```powershell
npm run production:validate
npm run production:inventory
npm run production:report
npm run task:preflight
npm run wuxia:check:fast
```

初始仓库完整读取清单：

- 201 个 Git 已跟踪文件读到 EOF；
- 2,604,916 bytes；
- 197 个全文文本文件，共 71,251 行；
- 4 个二进制文件逐字节读取和哈希；
- 43 个 JSON 全量解析，0 个解析失败；
- 2 个历史 JSON 带 UTF-8 BOM，工具已显式兼容并记录。

## 8. Risks

- 上游只读属性是本地保护，真正来源凭据是 ZIP SHA-256 和验证结果。
- 上游 OS 的 adapter/test 只证明结构，不证明本项目真实运行。
- 参考项目的生成图、字体和原 APK 资产存在混合来源；未逐项确认授权前不得运输。
- 浏览器 smoke、静态规则和 debug APK 均不能替代正式视觉、真机、签名与商店 Gate。
- 当前绝对路径仅用于 Profile 说明和开发机边界，不作为运行时或 CI 输入。

## 9. Unfinished Items

下一施工顺序：

1. `T03-00`：13 个不可达实体、27 个不可达动作逐项裁决。
2. `ARCH-001`：拆分 Runtime 与 UI 巨型模块，同时保持行为兼容。
3. `T03-01`：358/358 全动作前后状态断言。
4. `UI-ARCH-001`、`QA-UI-001`、`T05-01`：UI 适配器和 11×3 视觉门禁。
5. `T05-02` 与 ASSET-002..006：自有资产运行链。
6. G7：签名 Release、真机、商店、监控和回滚。

`COMBAT-002` 与 `CombatSession` 不在当前施工序列。
