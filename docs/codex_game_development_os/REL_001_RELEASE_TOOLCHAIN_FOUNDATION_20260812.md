# REL-001 可复现发行工具链基础闭环（2026-08-12）

## 1. 当前现状

`REL-001` 的发行工具链已经从占位项推进为可执行、可测试、默认拒绝的实现，但 `REL-001` 任务本身仍为 `open`，项目仍为 `RELEASE_BLOCKED_ACTIVE_REMEDIATION`。

本阶段只证明“发行工具链具备上线级约束能力”，不证明已有正式发行包。当前没有外部签名输入，`T05-01` 仍为 `blocked`，当前提交也必须在推送和 GitHub Actions 成功后才能获得远端与绿色 CI 证明，因此禁止生成或宣称正式 Release APK/AAB。

## 2. 审计发现的问题

施工前的 Android Release 配置存在以下硬缺口：

- `minifyEnabled false`，没有 R8 压缩和资源裁剪；
- 没有外部签名输入合同，也没有缺失签名时的 fail-closed 行为；
- 没有 APK 与 AAB 的统一正式构建链；
- 没有 npm 与 Gradle 合并后的 CycloneDX SBOM；
- 没有 source commit、upstream commit、配置 hash、Web bundle hash、制品 hash、证书指纹和工具版本的统一清单；
- 没有双 clean build 的可复现性检查；
- CI 只验证 Debug，没有发行合同回归；
- 工具登记仍为 `not-yet-implemented`。

## 3. 修改方案

采用“合同与工具链可用、正式发行资格严格阻断”的两层状态：

1. `release:preflight` 在普通开发和 CI 中执行 Schema、R8、签名边界、依赖任务、Git/CI 证明、SBOM、制品与可复现性合同检查。它允许返回 `tooling-pass-release-blocked`，不会把缺少密钥错误描述为工具故障。
2. `release:strict` 只允许在全部生产依赖完成、工作树干净、本地/远端 SHA 相等、绿色 CI SHA 匹配、五项外部签名变量齐全时继续。
3. Gradle `release` 自身再次检查外部签名。绕过 Node 预检直接执行 `assembleRelease` 也会失败。
4. 正式构建执行两次 clean APK/AAB 构建，比较字节 hash；任一不相等即拒绝。
5. APK 用 `apksigner` 验证 v1/v2/v3 和证书 SHA-256，AAB 用 `jarsigner` 与 `keytool` 独立验证同一证书。
6. R8 `mapping.txt` 作为必须保留的发布证据，与 APK/AAB 一起进入制品清单。

## 4. 修改范围

### 配置与 Schema

- `config/production/release_build_contract.json`
- `config/production/schemas/release_build_contract.schema.json`
- `config/production/security_release_contract.json`
- `config/production/toolchain_registry.json`
- `config/production/production_stage_plan.json`

### 代码与构建

- `android/app/build.gradle`
- `android/app/proguard-rules.pro`
- `tools/lib/release-build.mjs`
- `tools/validate-release-build-contract.mjs`
- `tools/test-release-build-contract.mjs`
- `tools/generate-release-sbom.mjs`
- `tools/generate-release-artifact-manifest.mjs`
- `tools/build-android-release.ps1`
- `package.json`
- `.github/workflows/ci.yml`

## 5. 配置变化

发行合同现统一声明：

- applicationId、versionCode、versionName 的唯一来源与一致性检查；
- `T05-01`、`T05-02`、`SEC-001` 三个前置任务；
- R8、resource shrinking、优化 ProGuard 默认规则；
- APK、AAB、R8 mapping 三类正式制品证据；
- 五个只从环境读取的签名/证书变量；
- 14 个必须逐文件 hash 的构建与配置输入；
- 完整 npm/Gradle CycloneDX 1.6 SBOM；
- 两次 clean build 及逐制品字节 hash 比较；
- source/upstream/green-CI/配置/Web/SBOM/制品/签名证书/工具版本追踪。

任何 keystore、密码、别名或证书私钥都不得进入 Git。正式环境只接收：

- `IDLEWUXIA_RELEASE_KEYSTORE`
- `IDLEWUXIA_RELEASE_STORE_PASSWORD`
- `IDLEWUXIA_RELEASE_KEY_ALIAS`
- `IDLEWUXIA_RELEASE_KEY_PASSWORD`
- `IDLEWUXIA_RELEASE_CERT_SHA256`
- `IDLEWUXIA_GREEN_CI_SHA`（绿色 CI 对应的提交证明）

## 6. 代码变化

Gradle Release 现启用 `minifyEnabled true`、`shrinkResources true` 和 `proguard-android-optimize.txt`。Debug 构建不读取正式签名；任何 Release 打包请求缺少四个签名变量时在配置阶段直接失败。

Node 工具负责合同、Schema、任务依赖、工作树/远端/CI 状态、输入文件、SBOM 和制品清单。PowerShell 只负责编排真实 Android clean build、签名检查、两次构建对比和最终清单生成，不拥有任何内容配置或密钥。

## 7. 测试与证据

本阶段已验证：

- Release 合同正例通过；
- R8 关闭、签名明文、依赖未完成、签名缺失、工作树不干净、制品清单缺字段等负例均被拒绝；
- 普通工具预检为 `staticPass=true`、`releaseEligible=false`，静态 finding 为 0；
- 实际解析 `releaseRuntimeClasspath`，SBOM 为 `complete`：npm 105、Gradle 51、合计 156 个组件；
- `release:strict` 在没有发行资格时非零退出；
- 直接执行 Gradle `assembleRelease` 在无签名环境时非零退出，证明双层阻断真实生效；
- Debug/既有运行时与浏览器回归由本任务最终全预检和手动视觉记录继续证明。

生成证据位于 `outputs/release/`，按项目规则不进入 Git。

## 8. 风险

- `T05-01` 人工生产视觉验收未通过，正式发行必须继续阻断；
- 当前没有外部密钥、证书指纹和正式签名所有者交接；
- 当前没有绑定本提交的绿色 GitHub Actions 结果；
- APK/AAB 双 clean build 的字节一致性必须在真实外部签名输入到位后实跑，若 Android/JAR 元数据不稳定必须继续修复，不能降级判定；
- R8 mapping 属于受控发布证据，应与崩溃符号化流程一起安全保存，不得打入 APK 或公开仓库；
- 真机性能、触控、音频、生命周期和商店检查仍属于 `REL-002`；灰度、监控与回滚演练仍属于 `REL-003`。

## 9. 未完成项与下一步

`REL-001` 保持 `open`。关闭它必须同时取得：

1. `T05-01=done`；
2. 外部签名变量和预登记证书 SHA-256；
3. 干净且与远端相等的绿色 CI 提交；
4. 两次 clean build 的 APK/AAB 字节一致；
5. APK v1/v2/v3、AAB 严格签名和证书指纹检查通过；
6. 完整 SBOM、R8 mapping 和最终 artifact manifest；
7. 手动安装/启动视觉检查通过。

在资产生产继续延期、只登记需求的当前约束下，下一可执行工作应进入 `REL-002` 的工具/设备矩阵基础准备，或继续完善 `T05-01` 的非资产交互问题；不得用参考资产把生产视觉门改成通过。`REST-REPAIR-001` 继续 postponed。

## 2026-08-13 手动运行与视觉回归补充

本工具链施工已完成真实浏览器 11 屏×3 尺寸的最终单次完整回归：33/33、3/3 弹窗、0 coverage gap、0 blocker。人工逐图检查关闭了任务标题乱码、标题页左侧裁切、窄屏状态数值与肖像碰撞，并将浏览器运行时等待从硬编码 10 秒改为可配置且默认 30 秒，避免大配置加载造成的基础设施假失败。完整记录见 `REL_001_MANUAL_VISUAL_REGRESSION_20260813.md`。

该结果只证明本次修改的运行与布局级联回归通过。人工仍判定 `UI_EarlyCombat` 的 CSS 几何角色、灰黑占位场景及非最终表现不符合产品上线视觉标准，因此 `T05-01`、`COMBAT-002B`、`REL-001` 与 `G7` 状态均不变，仍禁止宣称正式发行就绪。

## 2026-08-13 GitHub Actions 基础设施回归

提交 `f77345f2a11372f03df13b52c83061a695c2d735` 的首轮远端 Actions 在下载 `gradle-8.2.1-all.zip` 时收到 `Unexpected end of file from server`，失败发生在 Gradle Wrapper 启动阶段，项目编译尚未开始。该失败不能作为代码通过，也不能误归类为项目编译缺陷。

CI 已在 Android Debug 组装前增加最多三次、带递增等待时间的 Gradle Wrapper 引导重试。重试只处理外部下载瞬断；三次均失败时仍保持非零退出，不会吞掉真实编译、测试或资源错误。第二轮远端运行证明重试确实执行，但 GitHub 分发端连续返回一次断流和两次 503，故继续按基础设施失败处理。

Wrapper 分发包由仅供开发环境导航使用的 `all` 包收窄为构建所需的 `bin` 包，下载量由约 184 MB 降为约 123 MB；同时锁定 Gradle 官方公布的 8.2.1 `bin` SHA-256，并把单次网络超时由 10 秒提高到 60 秒。Wrapper JAR 本身也已核对为 Gradle 官方 8.2.1 指纹。绿色 CI SHA 仍由 `IDLEWUXIA_GREEN_CI_SHA` 显式提供，工具不会根据“曾经有网络错误”放宽正式发行门槛。
