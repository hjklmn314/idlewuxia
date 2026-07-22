# ARCH-001 Slice 6 手动视觉验收

日期：2026-07-22

任务：`ARCH-001 Slice 6 — UI view-model / intent mapper / browser automation seam`

判定：`PASS WITH KNOWN LIMITATIONS`

## 验收范围

- 真实 Microsoft Edge，经 CDP 驱动项目 `/www/` 发布闭包。
- 场景：`interaction-contract`。
- 540×960：20 个连续可见步骤。
- 390×844：20 个连续可见步骤；人工复核发现状态属性行折行后，先建立失败门禁、再修复窄屏布局并完整重跑。
- 全部最终截图均人工打开检查；不是抽样。
- 最终证据由当前 `src/` 同步到 `www/` 和 Android 内置 Web 目录后生成；`uiFlowAdapter.js` 与 `styles.css` 在三处均逐字节一致。

## 自动观测结果

| 视口 | 步骤 | failures | 控制台问题 | 最终状态 |
|---|---:|---:|---:|---|
| 540×960 | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` |
| 390×844 | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` |

最终机器证据：

- `outputs/arch001_slice6_capture_probe2_540x960/real_browser_flow_summary.json`
- `outputs/arch001_slice6_capture_probe2_390x844/real_browser_flow_summary.json`

摘要 SHA-256：

- 540×960：`83F8E83145AEC88ECEE4FC5C9A2BD51D3FE47CC0A1B31739FF712DC5015D9838`
- 390×844：`9CBF4D2071DFC4035731DF5C4F827C35EEE93E23D5E8E7F040CE6AEC82927E35`

`outputs/` 为本地生成证据，不进入 Git。

## 人工逐帧检查

两尺寸均检查以下 20 帧：开场身世选择、身世结果、标题开始、角色状态、任务确认、任务列表、首次钓鱼、重复钓鱼、重复进度、章节入口、地图初始、方向布局、大门、双向出口、管家选中、管家长文反馈、可切磋状态、战斗进入、战斗时间轴、自动回图。

逐帧结论：

- 无横向溢出、原始 ID、调试占位或乱码产品文案。
- 顶部导航文字可读、不换行，左右按钮均完整位于导航栏内。
- 关键操作始终可见；锁定动作有视觉禁用与需求文本。
- 长 NPC 文本位于可滚动区域，没有覆盖操作区。
- 390×844 的状态页经修复后，7 条属性行最大高度为 19.80px，标签和值均保持单行；540×960 最大为 22px。
- 战斗帧仅证明现有延期展示链未回归，不代表真实 CombatSession 达标。

## 异常复核

复核过程中同时发现了项目布局问题和证据工具问题，均未按“自动 0 failure”直接放行：

1. 390×844 原状态页的精力、气血、内力行高度为 44px，人工判定不合格；新增 `character status row wrapped` 门禁后，修复前真实 Edge 复跑为 1 failure。
2. 加入窄屏状态页专用网格、字号、头像和属性行约束；修复后两尺寸均为 20/20、0 failure。
3. 浏览器工具记录顶部按钮 `top/bottom` 并阻断水平/垂直裁切；最终两尺寸按钮范围均为 `top=8`、`bottom=52`。
4. 一轮 540×960 的第 7 张 PNG 出现 Chromium 合成表面分块重复；该轮作废，工具改为预热一帧后再采集 DOM 与持久化截图。
5. 最终 40 张截图全部重新打开检查；批量查看器显示异常的静态帧又以原图单独打开或以同状态 PNG SHA-256 一致性复核。

最终证据未保留已知视觉缺陷；上述失败轮仅用于证明门禁先红后绿，不作为通过证据。

## 未覆盖范围

- 尚未完成 `T05-01` 的 11 屏×3 尺寸正式矩阵。
- 尚未做 Android 真机、安全区、输入法、性能与无障碍完整验收。
- `UI-ARCH-001` 的 dormant CSS 分包未开始。
- `COMBAT-002` 继续延期。
