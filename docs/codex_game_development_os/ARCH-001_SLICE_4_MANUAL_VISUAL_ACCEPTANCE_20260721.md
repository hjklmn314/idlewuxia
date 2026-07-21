# ARCH-001 Slice 4 人工视觉与交互验收

任务：`ARCH-001 Slice 4 — EntityInteractionService`

日期：2026-07-21

判定：`PASS WITH KNOWN LIMITATIONS`

## 1. 当前现状

本切片改变实体可用性、NPC/物件选择和动作分支解释，因此不能只用单元测试或静态检查验收。验收使用当前源码重建的 17 文件 Web 发布闭包和真实 Edge。

最终证据目录：

- `outputs/arch001_slice4_entity_interaction_finalreview_20260721_540x960`
- `outputs/arch001_slice4_entity_interaction_finalreview_20260721_390x844`

每个目录包含 20 张逐步截图、JSON 汇总和 Markdown 汇总。输出目录不进入 Git。

## 2. 发现的问题

首次人工逐图打开 40 张截图后发现：

1. 标题页顶部“放置江湖”在 540×960 和 390×844 均被 78px 导航列强制换行；
2. 浏览器工具虽启用 Runtime 事件，却没有把 `console.warn/error`、未捕获异常和 Browser Log 纳入失败条件，旧的“控制台为零”证据不足。

随后 Standards/Spec 双路独立复审又发现两个运行时阻断：

3. 缺少当前房间时，实体归属检查会 fail-open；
4. replacement 指向隐藏实体时会错误回退并复活原实体。

人工复核过程中曾因长图视觉工具的分块预览产生疑似裁切；随后用页面实时布局数据确认 `scrollX=0`、`scrollY=0`、顶部栏 rect 正常，并用原始截图再次复核，不把预览分块当成产品缺陷。

## 3. 修改方案

- 顶部导航列改为 `minmax(96px, auto) / minmax(0, 1fr) / minmax(96px, auto)`；
- 顶部标签增加 `white-space: nowrap`；
- 浏览器 capture 新增 viewport、关键容器 rect/scroll、导航尺寸和活动元素数据；
- 文档横向溢出、导航换行和导航裁切成为每一步硬失败；
- 页面 warning/error/assert、未捕获异常和 Browser Log warning/error 成为整轮硬失败；
- 缺少当前房间、房间对象不匹配和房间外实体统一 fail closed；Runtime 回归证明拒绝除事件外零 mutation；
- replacement 始终先解析，再按最终实体 ID 过滤隐藏；
- 隐藏物件反馈改为配置模板，并通过稳定 `reasonCode=interactable_hidden` 供程序判定。

## 4. 验收范围

两个视口均执行以下 20 步：

1. 开场出生选择；
2. 出身结果；
3. 标题开始；
4. 人物状态；
5. 挂机确认；
6. 挂机任务列表；
7. 第一次挂机领取；
8. 第二次挂机领取；
9. 重复进度合同；
10. 章节入口；
11. 石路地图；
12. 地图方向布局合同；
13. 大门房间；
14. 同方向出口堆叠合同；
15. NPC 选择；
16. NPC 长对话；
17. 可战斗 NPC 选择；
18. Combat 进入；
19. Combat 时间轴或已配置结算；
20. Combat 结算后返回地图并完成实体替换。

## 5. 自动观测结果

| 视口 | 步数 | failures | 页面控制台问题 | 横向溢出 | 导航换行 | 导航裁切 | 终态 |
|---|---:|---:|---:|---:|---:|---:|---|
| 540×960 | 20 | 0 | 0 | 0 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` |
| 390×844 | 20 | 0 | 0 | 0 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` |

Edge 进程自身记录的 task-provider/QQBrowser importer 警告不来自页面 JavaScript，不属于页面控制台；它们保留在 `edgeWarnings`，没有被删除或伪装为页面通过。

## 6. 人工逐图检查结果

最终 40 张截图均逐张打开检查：

- 中文标题、按钮、房间名、NPC 名和反馈可读；
- “放置江湖”保持单行；
- 关键按钮在视口内，无横向溢出；
- 地图出口不重叠；
- NPC 选择态、锁定交谈、可用切磋和 Combat 后实体替换可区分；
- 长对话区域可滚动，顶部导航和实体面板保持可见；
- Combat 双方 HP/MP、伤害、动作名称和日志可读；
- 未出现原始内部 ID 作为主要玩家文案；
- 未出现 Welcome Back、GALAXY、TURRET、Nova Lite、`undefined`、`null` 或问号占位；
- 未发现本切片引入的阻断性对比度、遮挡、截断或不可点击问题。

最终 UI 同步修复后的截图与上一轮已验收证据比较：

- 36/40 张 SHA-256 逐字节一致，人工结论可直接继承；
- 4 张因 Combat 时间轴采样时点不同而变化；
- 变化的 540×960 与 390×844 第 18、19 张已再次以原始分辨率单独打开，均通过；
- 两个视口仍各为 20 步、0 failures、0 page console problems，最终状态均为 `STATE_FS_008_MAP_EXPLORE`。

## 7. 与生产标准的关系

本证据证明 Slice 4 涉及的首局实体交互纵切在两个目标移动视口达到当前生产门禁，但不等于：

- `T05-01` 11 屏×3 尺寸共 33 对完整验收；
- 真机 Android WebView 回归；
- 性能、内存和离线恢复验收；
- 签名 Release AAB/APK；
- 商店、隐私、监控和分阶段发布。

## 8. 风险

- 390×844 状态页窄列仍采用既有紧凑换行；可读但不是本切片重设计目标；
- 真实 CombatSession 仍延期，当前只验证既有配置桥和展示时间轴；
- Edge 进程级环境警告仍存在，但页面日志为零；
- 输出证据不提交 Git，复现依赖当前 commit、命令与浏览器环境。

## 9. 未完成项

下一项是 `ARCH-001 Slice 5 — ChapterSession`。随后才是 UI adapter，完成全部切片后 ARCH-001 才能关闭。

`COMBAT-002`、Rest/Repair 和真实 CombatSession 继续延期。
