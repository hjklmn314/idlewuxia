# ARCH-001 Slice 3 手动视觉验收

任务：`ARCH-001 / Slice 3 / NavigationService`

日期：2026-07-20

结论：`PASS WITH KNOWN LIMITATIONS`

## 1. 验收对象

- 真实发布入口：`http://127.0.0.1:5187/www/`；
- 发布源：`www` 构建产物，而非源码文件直开或测试桩；
- Android 同步：Capacitor `android/app/src/main/assets/public`；
- 运输闭包：16 个产品文件，13 个直接复制、3 个 Shipping 清洗转换；
- `www` 与 Android：16/16 产品文件匹配，2 个平台文件，0 unexpected，0 freshness findings。

本 Markdown 只记录验收事实；截图属于本地浏览器会话证据，不提交 `outputs/`、`www/` 或 Android 生成物。

最终复审同时使用项目真实 Edge/CDP 工具对两个视口各执行 12 个可见 DOM 点击/截图步骤：540×960 为 12/12、0 failures，390×844 为 12/12、0 failures。两组终态截图均由人工打开查看，而非只读取自动报告。

## 2. 手动路径

在真实 in-app Browser 中执行，不使用 DOM 直写或 Runtime 直接调用替代玩家点击：

1. 进入 `UI_MapExplore / STATE_FS_008_MAP_EXPLORE`；
2. 核对大门上方出口显示“武馆老管家拦住了你”，并处于 disabled/`aria-disabled=true`；
3. 点击可用的“下 石路”，确认标题和当前房间变为石路、日志显示“你进入了石路”；
4. 点击“上 大门”，确认返回大门、选中实体清空、日志显示“你进入了大门”；
5. 点击武馆老管家，确认人物面板、交谈条件和切磋操作仍正常；
6. 点击状态，确认进入“我的江湖”；沿返回与章节入口重新进入金牛武馆，确认仍恢复大门和阻断出口；
7. 分别在 540×960 与 390×844 复验阻断反馈、布局、溢出和控制台。

## 3. 首轮发现与修复

首轮 390×844 验收发现：

- `@media (max-width: 390px)` 在浏览器实际 visual viewport 为 390.20px 时未命中；
- 紧凑规则把 `.wuxia-room-direction em` 隐藏，标准视口又以单行 ellipsis 截断关键阻断原因；
- 触控高度在浏览器浮点换算下贴近 44px 下界。

修复：

- 紧凑断点扩大到 400px，覆盖常见缩放和分数 CSS 像素；
- 阻断原因在全部视口改为正常换行，不再隐藏或 ellipsis；
- 紧凑出口最小高度提高到 46px，锁定出口为 64px；
- 阻断原因改为高对比深色、加粗 11–12px 文本；锁定出口增加原生 `disabled`，与 `aria-disabled=true` 一致且不再绑定为可执行控件；
- 重新执行 `android:sync` 后再进行最终验收，旧缓存通过带版本查询的发布 URL 排除。
- `run-wuxia-real-browser-flow.mjs` 增加正整数 viewport 参数，避免 390×844 复验依赖手工改脚本；非法尺寸启动前失败关闭。

## 4. 最终视觉结果

| 检查 | 540×960 | 390×844 |
|---|---:|---:|
| 页面/状态 | `UI_MapExplore / STATE_FS_008_MAP_EXPLORE` | 同左 |
| 阻断出口可见且 disabled | PASS | PASS |
| “武馆老管家拦住了你”完整渲染 | PASS | PASS |
| 阻断文本位于按钮边界内 | PASS | PASS |
| 页面横向溢出 | 0 | 0 |
| Stage 横向溢出 | 0 | 0 |
| 原始 `fb01/NODE_/ACTION_FS_/gorome` 泄漏 | 0 | 0 |
| debug/trace/undefined/null 文案 | 0 | 0 |
| 控制台 error/warning | 0 / 0 | 0 / 0 |
| Edge 可见点击/截图步骤 | 12/12 | 12/12 |
| Edge 流程 failures | 0 | 0 |

视觉判断：房间标题、方向、当前房间、人物入口和阻断原因层级清晰；关键操作在首屏可见；紧凑视口不再牺牲失败原因。

## 5. 自动化交叉证据

- NavigationService 合同：PASS；
- Runtime integrity：15/15；
- 首局完整交互：PASS，54 events，最终回到地图；
- 存档：PASS；
- 首局配置/导航 Schema：0 error / 0 warning；
- 358 个交互动作：`highRisk=0`；
- 数据驱动边界：`high=0`；
- Web/Android freshness：0 findings。

## 6. 已知限制

- 这不是 `T05-01` 的 11 屏×3 尺寸完整视觉矩阵；
- 未做真机 Android 触控与系统安全区验收；
- APK 仍是 development debug，不是签名商业 Release；
- EntityInteractionService、ChapterSession、UI adapter 和 AssetRegistry 仍未完成；
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 按要求延期。

因此本文件只批准 ARCH-001 Slice 3，不批准 ARCH-001 整体、G4、T05-01 或上线发行。
