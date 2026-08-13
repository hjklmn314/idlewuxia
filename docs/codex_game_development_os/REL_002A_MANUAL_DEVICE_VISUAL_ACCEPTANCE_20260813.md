# REL-002A 手工设备视觉验收（2026-08-13）

## 1. 验收对象

- 证据目录：`outputs/android_device_acceptance/rel002a_formal_20260813/`
- 源码提交：`bba5cf6328a6fa4af59cf96116e3484d3165abc1`
- APK：`outputs/idlewuxia-debug.apk`
- APK SHA-256：`1c33f5fd487bfb07d6a1bf73dd353bd70a39c56dcaafcee5e11702b58314db47`
- 环境：Android 9 / API 28 开发模拟器，1080×1920，density 280；`releaseEligible=false`。

## 2. 逐图人工检查

| 截图 | 可见状态 | 功能视觉结论 | 产品美术结论 |
|---|---|---|---|
| `00_cold_start.png` | 出生来源四选一 | 中文完整，无乱码、溢出、空白、错误页、系统弹窗；四个按钮可见 | FAIL：灰黑原型，无批准像素武侠界面与角色 |
| `01_player_action.png` | 武学世家选择结果 | 选择反馈、正文和继续按钮完整，无截断 | FAIL：同上 |
| `02_background_foreground.png` | 前后台恢复 | 恢复到同一结果页，布局未漂移 | FAIL：同上 |
| `03_lock_unlock.png` | 锁屏恢复 | 恢复到同一结果页，无黑屏或 Launcher | FAIL：同上 |
| `04_offline_restore.png` | 应用级断网恢复 | 存档结果可见，无网络错误页 | FAIL：同上 |
| `05_android_back_relaunch.png` | 返回键后重启 | 恢复到同一结果页，安全区无阻挡 | FAIL：同上 |
| `06_force_stop_relaunch.png` | 强停后重启 | 恢复到同一结果页，无空白或异常弹窗 | FAIL：同上 |

## 3. 双结论

- REL-002A 功能视觉回归：**PASS**。七张设备截图均由人工逐张检查；它们证明开发模拟器上的中文渲染、输入结果和生命周期恢复没有可见功能退化。
- 产品视觉／发行美术：**FAIL / BLOCKED**。当前画面没有用户确认的侧视无腿模块角色、独立头/身体/眼睛/嘴巴/发型、干净场景和正式 UI 资产。因此 T05-01、COMBAT-002B、ASSET-007、REL-001、REL-002 与 G7 均不能关闭。

自动 runner 的 `automated-pass-manual-pending` 保持不改；本文件是独立人工签名层，避免工具自证。真机矩阵、签名 Release APK/AAB、音频、性能和商店验收仍完全缺失。

## 4. 级联复核

人工检查没有发现开场输入、状态持久化、前后台、锁屏、离线、返回键或强停恢复的可见级联回归。新模块化角色方向仅更新配置合同与需求表，本轮没有替换这些截图中的任何资源，也没有把灰黑原型误标为美术通过。
