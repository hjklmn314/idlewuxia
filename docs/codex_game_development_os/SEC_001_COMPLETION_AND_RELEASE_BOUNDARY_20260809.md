# SEC-001 完工记录与发行边界 — 2026-08-09

## 1. 当前现状

`SEC-001` 已在当前离线优先 HTML/Capacitor 客户端范围内完成，状态为 `PASS WITH KNOWN LIMITATIONS`。它关闭权限、CSP、FileProvider、客户端 secret、观测隐私、未激活外部 SDK 和生产依赖 allowlist；不替代签名 Release、SBOM、真机故障注入、商店隐私表或真实回滚演练。项目整体仍为 `RELEASE_BLOCKED_ACTIVE_REMEDIATION`。

## 2. 审计发现并修复的问题

- `index.html` 没有 Content Security Policy。
- Android source manifest 声明 `INTERNET`，但当前 shipping Runtime 只读取同源打包配置，观测 upload 为 disabled，且没有激活网络服务。
- FileProvider 使用 `<external-path path="."/>`，暴露范围远大于当前需要。
- Gradle 会在任意 `google-services.json` 出现时自动应用 Google Services，存在未审计服务被意外激活的路径。
- 原有门禁只审计 source manifest，没有验证依赖合并后的真实 Android manifest。
- 安全状态没有版本化合同，权限、隐私、外部服务和依赖边界只能靠人工记忆。

## 3. 修改方案

- 新增 `security_release_contract.json` 与 Draft 2020-12 Schema。
- 为 HTML 增加 11 条 CSP directive；script 仅允许 self，禁止 object/base/form，connect 仅 self。
- 保留 `style-src 'unsafe-inline'` 的唯一例外：当前配置驱动角色配色、进度宽度和安全区使用运行时 CSS 变量/inline style；脚本仍不允许 inline/eval。
- source manifest 移除普通 Android 权限；保留 Launcher Activity 为唯一项目主动 exported component。
- FileProvider 只允许应用私有 `files/shared/` 与 `cache/shared/`。
- 移除按文件存在自动应用 Google Services 的 Gradle 逻辑。
- 同时审计 source manifest 和 Gradle merged manifest；AndroidX ProfileInstaller receiver 只有在 `android.permission.DUMP` 保护下才允许 exported。
- 以高置信 secret pattern、禁止 secret 文件名、runtime dependency allowlist 和外部 SDK token 建立 fail-closed Gate。

## 4. 配置与程序变化

配置权威：

- `config/production/security_release_contract.json`
- `config/production/schemas/security_release_contract.schema.json`

工具：

- `tools/lib/security-release.mjs`
- `tools/validate-security-release-contract.mjs`
- `tools/test-security-release-contract.mjs`

CI 在 Android debug assemble 后执行 `npm run security:audit:android-merged`，防止库依赖合并出未批准权限或公开组件。

## 5. 自动验证

- Security Schema：PASS。
- CSP directives：11。
- source Android permissions：0。
- source exported components：1（`.MainActivity`）。
- FileProvider elements：`files-path`、`cache-path`，均限定 `shared/`。
- runtime dependencies：`@capacitor/android`、`@capacitor/core`，无广告、支付、登录或统计 SDK。
- activated external services：0。
- secret scan：159 files，0 finding（包含本任务新增合同、Schema、工具与完工记录）。
- analytics：`technical_no_pii`、memory-only、upload disabled、512 events cap。
- `npm audit --omit=dev`：0 info/low/moderate/high/critical vulnerability；4 production、105 total dependency records。
- Security negative tests：未批准权限、external path、嵌入 secret、inline script、merged INTERNET、无保护 exported receiver 均能拒绝。

## 6. Android 构建与真实合并清单

执行 `:app:assembleDebug --no-daemon --stacktrace`：BUILD SUCCESSFUL，62 tasks（26 executed、36 up-to-date）。

Debug APK：

- 路径：`android/app/build/outputs/apk/debug/app-debug.apk`
- bytes：3,822,519
- SHA-256：`224DDF200BEAC51A72569D58B98DDE9601CC1AC20CBE91FA7058F03450050760`

merged manifest：

- 普通危险/网络权限：0。
- 自动生成的 app-signature permission：`com.idlewuxia.app.debug.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`，允许。
- exported Activity：`com.idlewuxia.app.MainActivity`。
- AndroidX `ProfileInstallReceiver`：exported，但由 `android.permission.DUMP` 保护，按明确合同允许。
- `allowBackup=false`、`fullBackupContent=false`、`usesCleartextTraffic=false`。

这是 debug 构建安全证据，不是签名 Release 验收。

## 7. 浏览器人工视觉与交互验收

在真实 Edge 390×844、启用新 CSP 后运行当前 Runtime：

- 14 条观测事件、3 条 replay command。
- console error/warning：0。
- data-quality finding：0。
- 页面可见、开始按钮存在、交互未被 CSP 阻断。
- 截图：`outputs/security/sec001_browser_csp_acceptance/01_observability_wired_title_screen.png`。

人工检查结论：CSP/安全修改的可见功能为 PASS；页面仍是占位视觉，艺术上线门继续 FAIL/BLOCKED。安全 PASS 不覆盖 T05-01/COMBAT-002B。

## 8. 全量级联回归与上线门

- `npm run task:preflight`：完整执行结束，exit 0；覆盖 413 个 tracked files、29 个 shipping files、358 个动作、持久化/观测/战斗/资源合同/UI sweep/Android identity/证据和首局 Runtime。
- workspace hygiene：active authority 29、dormant legacy 50、reference-only 15、shared governance 319；active→legacy import 0，findings 0。
- security source/merged manifest Gate：均 PASS，findings 0。
- `npm run wuxia:audit:online-standard`：按预期 exit 1；不是安全回归，而是 14 个仍开放的上线阻断（11 P0、3 P1），领域为 asset 3、asset_contract 10、manual_visual 1。
- 因此本任务只能关闭 SEC-001 客户端安全范围，不能把项目或 G7 误报为可发行。

## 9. 清理与回滚

- Edge profile 共 202 files、13,540,263 bytes，已按清单送入 Windows 回收站。
- 清理记录：`outputs/workspace_cleanup/SEC_001_20260809_profile_cleanup_manifest.json`。
- 端口 5187 listener：0。
- `outputs/`、APK、www、Android build 和 profile 不提交 Git。

回滚顺序：

1. revert SEC-001 提交；
2. 恢复 source manifest 权限/FileProvider/Gradle/CSP 文件；
3. `npm run android:sync`；
4. clean assemble 并重新审计 merged manifest；
5. 禁止只回滚校验器而保留未受控配置。

## 10. 已知限制和下一项

- Release build 当前仍 `minifyEnabled false`，没有外部安全签名、SBOM 和 artifact provenance，归 `REL-001`。
- 没有 Android 真机网络/前后台/存储/性能/触控/音频故障注入，归 `REL-002`。
- 没有商店隐私声明、年龄/地区法律确认、灰度监控和真实回滚演练，归 `REL-003`。
- 支付/广告配置属于 dormant legacy，不在 shipping；未来激活必须先建立服务端验证、同意、区域政策与独立安全复审。

判定：`SEC-001` **PASS WITH KNOWN LIMITATIONS**；G7 仍 **blocked**。
