# REL-001 手动运行与视觉回归验收（2026-08-13）

## 1. 当前现状

本记录验收 `REL-001` 发行工具链施工对当前 HTML/Capacitor 产品界面的级联影响，并复核人工检查过程中发现的现存 UI 缺陷。它不把浏览器自动矩阵等同于产品美术上线验收，也不替代真机、签名 Release APK/AAB 或商店验收。

最终权威浏览器证据位于：

- `outputs/wuxia_visual_matrix/rel001_20260813_visual_accepted/browser_surface_sweep_report.json`
- `outputs/wuxia_visual_matrix/rel001_20260813_visual_accepted/browser_surface_sweep_report.md`
- `outputs/wuxia_visual_matrix/rel001_20260813_visual_accepted/`

## 2. 发现的问题

人工逐图检查发现并复现了三个与自动 PASS 不同层级的问题：

1. `UI_IdleTaskList` 的 CSS 伪元素标题已经被错误转码，玩家看到乱码；原测试只排除另一段旧乱码，形成假阴性。
2. `UI_TitleStart` 没有主体专属布局规则，三种竖屏尺寸的主体标题均从左边界裁切。
3. 360×800 的 `UI_CharacterStatus` 中，长气血值会压入肖像列，可读性不足。

第一次完整运行因开发服务器未启动而得到 `ERR_CONNECTION_REFUSED`；第二次完整运行确认页面可达。修复乱码后的一次 390×844 会话又因固定 10 秒运行时等待上限停留在“正在读取首局流程配置”，同一代码的另外两种尺寸正常。该失败被判为浏览器启动/大配置加载竞态，失败报告均保留，没有改写为产品 PASS。

## 3. 修改方案

- 将任务标题恢复为唯一正确文案“当前可进行的任务”，测试直接断言准确选择器和文案，并拒绝多类常见乱码标记。
- 为标题页增加通用居中、边距、标题和副标题规则，不写入具体章节、NPC 或资产路径。
- 收紧 440px 以下状态页的肖像列和字号，保留角色数据由配置/Runtime 提供的边界。
- 将真实浏览器运行时等待改为可配置合同，默认 30 秒；继续 fail-closed，超过上限仍产生失败截图与报告。
- 每次修复后重新执行浏览器，而不是修改旧截图或只检查 DOM。

## 4. 修改范围

- `src/wuxia.css`
- `tools/run-wuxia-real-browser-flow.mjs`
- `tools/test-wuxia-runtime-integrity.mjs`
- `tools/test-wuxia-ui-architecture.mjs`
- `tools/test-wuxia-browser-surface-sweep.mjs`

没有修改具体章节、NPC、Encounter、战斗数值、奖励或资产配置；没有把参考资产提升为发布资产。

## 5. 配置变化

生产内容配置无变化。浏览器执行器增加 `--runtime-ready-timeout-ms`，也可由 `WUXIA_RUNTIME_READY_TIMEOUT_MS` 提供，默认值为 30000ms。该值只控制验收基础设施等待，不改变游戏运行时状态、内容或玩家时间轴。

## 6. 代码变化

- 修复任务页乱码并扩大可见乱码检测模式。
- 增加标题页主体布局。
- 修复窄屏状态页数值与肖像列碰撞。
- 消除真实浏览器运行器固定 10 秒等待造成的偶发假失败。
- 增加准确文案、布局合同和等待合同回归断言。

## 7. 测试与人工验收

最终自动矩阵结果：

- 11 个活动界面 × 3 个竖屏尺寸 = 33/33；
- 尺寸为 360×800、390×844、412×915；
- observed screens = 11；
- coverage gaps = 0；
- blockers = 0；
- choice modal = 3/3；
- console error/warning、DOM/状态、溢出和交互前后证据均满足注册表合同。

人工检查覆盖最终目录全部 81 张正式截图：45 张主路径、33 张条件路径、3 张弹窗。条件路径前 9 步共 27 张与同尺寸主路径逐字节相同，已以 SHA-256 比对确认；其余 54 张唯一画面均人工打开检查。检查内容包括开场、身世结果、标题、人物状态、挂机确认、任务领取前后、章节入口、地图、NPC 选择/对白/可战状态、战斗、回图、独立 NPC 页面、章节回环和三尺寸选择弹窗。

人工结论分层如下：

- **REL-001 级联回归：PASS。** 本次发行工具链与 UI 修复未破坏入口、主路径、条件路径或弹窗；乱码、标题裁切和窄屏数值遮挡已关闭。
- **布局与交互自动矩阵：PASS。** 最终单次完整运行 33/33、0 blocker。
- **产品视觉上线门：FAIL / BLOCKED。** `UI_EarlyCombat` 仍使用 CSS 几何角色、灰黑占位场景和非最终战斗表现；地图与多处 UI 仍是功能骨架。它们属于 `T05-01`、`COMBAT-002B` 和资产需求链，不能由本次工具链验收越权关闭。

## 8. 风险

- 浏览器截图不能证明 Android 真机安全区、GPU/内存、触控、音频和生命周期表现。
- 最终战斗角色、场景、VFX、音效和 UI 包装尚未获得生产验收；参考项目绑定只可继续开发，不构成授权或发布批准。
- 真实浏览器加载时间受本机资源影响；30 秒上限降低假失败，但没有取消失败门槛。
- 当前不存在正式签名 Release APK/AAB，本记录不得被用作商店发布证明。

## 9. 未完成项

`REL-001`、`T05-01`、`COMBAT-002B` 和 `G7` 保持未完成/阻断。关闭 `REL-001` 仍要求同一干净提交上的外部签名托管、证书指纹、绿色 CI、两次 clean APK/AAB 字节一致、签名验证、R8 mapping、完整 SBOM、artifact manifest，以及真机安装/启动人工验收。`REST-REPAIR-001` 继续 postponed。
