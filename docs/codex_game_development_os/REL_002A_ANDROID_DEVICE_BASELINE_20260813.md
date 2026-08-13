# REL-002A Android 设备合同与开发模拟器基线

## 1. 当前现状

REL-002A 已完成；REL-002、REL-001 和 G7 均未完成。当前建立的是 Android 9 / API 28 雷电模拟器上的 development debug 基线，不是真机矩阵、签名 Release APK/AAB、商店验收或发行许可。

权威配置是 `config/android_device_acceptance_contract.json`，Schema 是 `config/android_device_acceptance_contract.schema.json`。合同声明四类环境：一个可用开发模拟器，以及尚无设备证据的低端、参考和现代 Android 真机槽。模拟器 `releaseEligible=false`，三类真机证据缺失会持续阻断 REL-002。

## 2. 审计发现与修复

旧 v1 runner 存在四项不可信行为：运行前递归删除既有证据、使用固定坐标、未验证文本编码、把单个模拟器 debug 结果写成通用 `pass`。旧 2026-07-17 报告中的页面文本已经乱码，但旧断言没有失败。

本次真实 API 28 启动又发现 `Object.hasOwn` 不受旧 WebView 支持，导致游戏初始化中断为空白页。现已增加共享 `languageCompatibility.js`，并把活动 Runtime 中的 `Object.hasOwn`、`String.replaceAll` 和 `Array.at` 调用迁移到兼容实现；兼容边界测试扩展到所有相关模块。该文件已加入 Web/Android shipping closure。

雷电模拟器执行 `svc wifi/data disable` 会让 ADB transport 挂起，因此断网验证改成 root 模拟器支持的“仅阻断应用 UID 出站流量”方式。iptables 规则在断网用例结束和 `finally` 中双重撤销，不会改变宿主或其他应用网络。真实非 root 手机仍使用 Wi-Fi/蜂窝网络能力声明，必须按每个 profile 的能力执行。

## 3. 配置和工具变化

- v2 合同定义设备类别、API/分辨率、可用性、release eligibility、离线能力、截图清单、乱码模式、生命周期时序和两类性能预算。
- Draft 2020-12 Schema 与语义审计禁止：重复 profile、模拟器冒充 release、环境/设备类别错配、缺少三类真机槽、缺证据字段和缺截图。
- 运行器不删除、不覆盖证据目录；输出路径必须是 `outputs/android_device_acceptance/` 下尚不存在的新目录。
- 点击坐标由配置文字 `武学世家` 对应的实时 DOM 按钮边界生成，再由 ADB 执行；不使用固定屏幕比例。
- 每次运行保留 APK/合同 hash、设备属性、启动时序、存档状态、截图、UI tree、logcat、meminfo、gfxinfo 及逐文件 SHA-256。
- 正式证据必须使用 `--require-clean-revision`，并在创建证据目录前证明工作树干净、本地 HEAD 已推送且与 upstream 完全一致；报告同时记录源码 HEAD 和 upstream。
- 自动 runner 只能输出 `automated-pass-manual-pending`。人工验收单独记录，不能由工具自证。

## 4. 自动验收结果

最终 development emulator 基线必须在 clean-commit APK 上重新生成，正式目录为：

`outputs/android_device_acceptance/rel002a_formal_20260813/`

该目录只允许由已经推送且与远端一致的 clean commit 生成；若修订版、工作树或 upstream 不满足条件，runner 在创建目录前直接失败。

验收项目：

1. 冷启动并清空旧存档；
2. 安装后显式恢复被设备用户态禁用的测试包，再执行生命周期用例；
3. 通过配置文字定位并点击出生选项；
4. 存档写入；
5. 后台/前台恢复；
6. 锁屏/解锁恢复；
7. 应用 UID 断网、强停、离线存档恢复；
8. Android 返回键后重启；
9. 强停后恢复；
10. crash/ANR/JavaScript/network error 模式为 0；
11. 开发模拟器预算内的冷/热启动、PSS、Java heap 和 gfx frame 采样。

开发模拟器预算与发行真机预算严格分离。前者只用于发现回归；它不会放宽或代替后者。

## 5. 手动视觉验收

人工逐张检查最终 7 张设备截图：开场、选择后、后台恢复、锁屏恢复、断网恢复、返回键恢复、强停恢复。

功能视觉门的检查点：

- 页面不是空白页或错误页；
- 中文无乱码、替换字符和截断；
- 选择按钮完整可见且触控结果正确；
- 状态恢复后仍是同一来源结果页；
- 无横向溢出、系统弹窗、黑屏或意外 Launcher；
- 上下安全区未遮挡内容。

人工结论只代表该 API 28 模拟器上的功能视觉回归。当前灰黑原型视觉仍不符合生产像素武侠美术标准，不能关闭 T05-01 或 COMBAT-002B。

最终七图逐张签名与功能／美术双结论记录在
`REL_002A_MANUAL_DEVICE_VISUAL_ACCEPTANCE_20260813.md`。功能视觉为 PASS，产品美术为 FAIL / BLOCKED。

## 6. 上线阻断与下一任务

REL-002 继续 open，至少还缺：

- 三台真实 Android 手机：低端 API 26–28、参考 API 29–32、现代 API 33–35；
- 签名 Release artifact，而非 debug APK；
- 每台真机的冷/热启动、CPU/GPU、内存、稳定帧、触控、安全区、前后台、离线、存档恢复；
- 真机音频延迟与主观音质；
- 断电、低存储和容量故障注入；
- 商店截图、政策清单和设备兼容声明。

REL-001 仍因生产视觉、外部签名和发行来源证明被阻断。REL-003 的商店、灰度、监控与回滚也未开始闭环。`REST-REPAIR-001` 继续按用户要求延期。

## 7. 风险与回滚

兼容层是通用能力，不含单位、章节、技能或 UI 内容硬编码。回滚时应同时回滚兼容层、活动调用点、project scope 和 Web/APK 产物，不能只删除单个 helper。设备 runner 的失败目录保留为诊断历史；正式证据永不覆盖，清理时只允许按项目临时/失败证据策略送入回收站。
