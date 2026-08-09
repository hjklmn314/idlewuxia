# idlewuxia 全量阅读覆盖账本 — 2026-08-04

## 1. 审计边界

- 唯一施工根：`H:\MyProjectBack\idlewuxia`。
- `G:\codex` 仅是历史证据区，本轮没有写入、同步或作为运行时权威。
- 审计不是文件名抽样：工具逐字节读取全部 Git 跟踪文件和全部未忽略、未跟踪项目文件；JSON 全部实际解析，JavaScript/MJS/CJS 全部执行 `node --check`，SVG 执行根结构检查，二进制记录 SHA-256。
- `public/` 与 Android `res/` 下资源另做磁盘级枚举、尺寸、跟踪状态、忽略规则和 SHA-256 登记。
- 最近五日按 `git log --since=5.days --name-status` 读取全部提交和变更文件，不以当前 diff 代替历史审计。

机器可读入口由 `tools/build-full-release-audit-ledger.mjs --history-head 5114fe99d0d1be19e83880aadd3cdaafb031cc7b` 生成。`history-head` 固定为本轮审计开始时的提交，避免审计修复提交反过来改变“最近五日输入任务”的覆盖基线；当前修复提交和 CI 补丁另在本轮提交记录中追踪：

- `outputs/full_release_audit_20260804/full_file_ledger.csv`
- `outputs/full_release_audit_20260804/resource_ledger.csv`
- `outputs/full_release_audit_20260804/findings.csv`
- `outputs/full_release_audit_20260804/full_release_audit_ledger.json`

`outputs/` 是可再生证据，不进入 Git。工具本身、规则和本报告进入 Git。

## 2. 完整覆盖结果

最终复跑快照：

| 类别 | 文件数 | 字节数 | 文本行数 |
|---|---:|---:|---:|
| Android | 32 | 100,419 | 739 |
| 配置 | 67 | 1,399,072 | 41,807 |
| Markdown | 74 | 529,761 | 10,079 |
| 项目控制 | 2 | 1,504 | 82 |
| 跟踪资源 | 1 | 616 | 10 |
| Runtime 代码 | 30 | 503,665 | 14,264 |
| 工具与测试 | 120 | 1,007,310 | 22,709 |
| **合计** | **326** | **3,542,347** | **89,690** |

326 个正式项目文件均已跟踪或显式暂存；没有把 `node_modules/`、`www/`、`android/app/build/`、`.gradle/`、`outputs/`、浏览器 profile、缓存或临时文件伪装成源代码审计对象。

排除项的处理方式：

| 范围 | 是否逐文件读取 | 理由与替代证据 |
|---|---|---|
| `node_modules/` | 否 | 第三方锁定依赖，以 `package-lock.json`、`npm ci` 和实际门禁为权威。 |
| `www/`、Android Web assets | 不作为源码重复阅读 | 它们由 26 个 shipping source 生成，使用三层逐字节 freshness 检查。 |
| `android/app/build/`、`.gradle/` | 否 | 生成缓存；实际执行 clean-input Android assemble，并检查 APK 条目。 |
| `outputs/` | 不纳入正式源码计数 | 可再生证据；关键报告路径、命令和 verdict 写入受控 Markdown。 |
| `tmp/`、Edge profile | 否 | 临时运行证据，不是产品源。 |
| 被忽略资源 | 逐资源枚举与哈希，不作为产品源 | 共 46 个；35 个是旧射击项目生成 UI，11 个是只读参考截图，全部不在 shipping closure。 |

## 3. 活动发布闭包与历史残留

`config/project_scope.json` 声明 26 个 Web shipping files。活动入口是 `src/wuxia-main.js`，活动 runtime 包含 ChapterSession、CombatSession、条件/结果/交互服务、持久化、UI adapter、资产注册表以及三份发布配置。

仓库中仍存在旧 `idledotshoot` 代码、经济/IAP 占位配置、参考对比工具和历史审计文档。它们已被 `shippingFiles` 白名单隔离，不进入 Web/APK 产品闭包；但这只是发布隔离，不代表它们达到武侠产品完成度。后续 `HYGIENE-001` 必须把活动权威、历史参考和可归档内容做版本化分层，防止维护者误用。

## 4. 最近五日完整提交审计

审计开始基线 `5114fe99d0d1be19e83880aadd3cdaafb031cc7b` 的最近五日窗口内实际只有 2026-08-04 的四个输入提交，共涉及 30 个唯一文件；本轮审计自身的修复提交不反向计入输入基线：

| 提交 | 内容 | 审计结果 |
|---|---|---|
| `0906dafbd0cd4712e7fccef3677ece94ada41757` | 配置驱动战斗核心、Schema、测试与产品向量资源 | 架构方向正确；原实现的公式、Buff/控制、快照、表现资产与手动体验存在缺口，本轮修复或显式阻断。 |
| `7de9ccd480b7e9087c16773b42fd63bd171ab885` | Buff 能力与 effect 能力分离 | 修复有效；本轮补充全能力 probe 和负例。 |
| `ea72276847ca18ac20c3ef883c752b8ac2374274` | Chapter runtime 与战斗视觉状态连接 | 数据链已连通；固定/原型表现仍不等于产品视觉完成。 |
| `5114fe99d0d1be19e83880aadd3cdaafb031cc7b` | 真实玩家回合、UI intent 与浏览器交互 | 手动回合方向正确；本轮修复 root/taunt/冷却/快照和浏览器真实提交语义。 |

## 5. 资源审计结论

- 当前 Git 内可发布产品资源只有 `public/wuxia-brand/icon.svg`，共 616 bytes。
- 角色、干净战斗场景、VFX、中文字体、NPC 肖像、地图材质、交互图标、SFX/BGM 均没有已批准且可发行的文件闭环。
- 27 个本地 Android PNG 是旧射击图标或默认 Capacitor splash；它们曾污染本地 debug APK。已按相对路径迁移至 `H:\MyProjectBack\idlewuxia_quarantine\android_legacy_resources_20260804`，27/27 SHA-256 复核一致，总计 757,433 bytes，并保存 `manifest.csv`。
- 迁移后 `android:resources:validate` 为 PASS；新 APK 不再包含旧 `splash.png`、旧 `product_icon.png` 或旧密度 launcher PNG。
- 其余 46 个忽略资源保持参考/旧生成物身份，未进入产品闭包；不得在没有来源、授权、预算和人工验收的情况下启用。

## 6. 覆盖结论

文件读取与静态结构门完整，但发布结论是 `RELEASE_BLOCKED`。阻断来自 10 个必需资产槽、严格人工视觉失败、G4 的 Save/Observability、以及 G7 的安全、签名、真机、性能、商店和回滚门槛。完整读取不能把缺失产品证据转换成 PASS。

## 2026-08-09 最新变更集增量阅读账本

- 固定点：`e04dfd3ca8bcb6ca7c3532803df07cd099d5a9d9`；被审计提交：`cc0ab085e3aa9a96c3884290fea0e5350ce968b7`。
- 34 个变更文件的完整 diff、项目规则、战斗生产规范、Roadmap、机器生产计划、相关 Runtime/配置/Schema/测试/生成器均已按文件分组完整阅读；详细覆盖、问题、修复和判定在 `LATEST_CHANGESET_STRICT_AUDIT_20260809.md`。
- 本次增量审计不重写 2026-08-04 的 326 文件历史快照，也不把 `outputs/`、`www/`、Android build、浏览器 profile 或参考 bytes 计入正式源码数量。
- 新鲜视觉证据来自 `outputs/combat_result_visual/audit_20260809_final_current/`，而不是复用旧截图；最终配置基数上的 18 张关键帧已经人工逐张复核。
- SAVE-001 的配置、Schema、Runtime、fixtures、验证器、单元测试、浏览器 runner 和恢复/回滚文档作为本次审计新增正式范围；其完成不改变生产资产与 Release Gate 的阻断事实。
- OBS-001 的 `analytics_events.json`、三份 Schema、`runtimeObservability.js`、UI/automation 接线、validator、unit/replay divergence test、Edge runner 与完工手册已逐文件复核；当前事件数、隐私、顺序和 replay 证据来自 `outputs/obs001_browser_acceptance_20260809_final_current/`，不复用旧诊断输出。
- 最终当前 Web shipping closure 为 29 个文件；新增的观测合同和 Runtime 进入运输闭包，三份开发 Schema、测试、runner 与 outputs 仍不进入 APK/Web 产品文件。
