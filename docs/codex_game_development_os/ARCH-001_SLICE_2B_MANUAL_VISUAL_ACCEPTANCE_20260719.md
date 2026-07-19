# ARCH-001 Slice 2B 手动视觉验收

验收日期：2026-07-19

验收对象：`ARCH-001 / Slice 2B / ResultEffectExecutor`

结论：`PASS WITH KNOWN LIMITATIONS`

## 环境

- 项目：`H:\MyProjectBack\idlewuxia`
- 页面：`http://127.0.0.1:5187/`
- 浏览器：Codex In-app Browser
- 视口：540×960，竖屏 9:16
- 活动入口：`src/wuxia-main.js`
- 自动实跑证据：`outputs/role_browser_acceptance/interaction_condition_qa/20260719155446`

## 人工检查记录

| 画面/动作 | 人工观察 | 判定 |
|---|---|---|
| 大门房间首屏 | 标题、方向、房间、NPC 与主操作层级明确；无横向溢出；没有展示原始状态/动作/实体 ID | PASS |
| 武馆老管家交谈 | 成功后的长文本反馈在当前屏内可读，超长内容提供明确滚动条；条件不满足按钮为禁用态并显示条件 | PASS |
| 状态页 | 返回、章节入口和未开启入口层级明确；按钮尺寸满足移动端触控；无裁切 | PASS |
| 大门上移至石路 | 房间标题、上下方向、空房提示和“你进入了石路”反馈一致；无横向溢出 | PASS |
| 浏览器控制台 | 0 error，0 warning | PASS |

运输闭包复核发现旧白名单没有包含三个已被 Runtime 导入的模块。该问题在最终验收前已修复为 15 文件闭包；随后已直接打开重新物化的 `http://127.0.0.1:5187/www/`，人工复验石路房间、大门 NPC 选择态与状态页，控制台仍为 0 error/0 warning，本结论现已对物化产物生效。

DOM 定量检查：`innerWidth=540`、`innerHeight=960`、`scrollWidth=540`、`scrollHeight=960`；主要可见按钮高度约 44–118 px。

## 范围边界

本次人工视觉验收证明事务执行器接入后，代表性的房间、NPC 反馈、状态页和移动反馈没有出现可见回归。它不替代 `T05-01` 的 11 屏×3 尺寸完整矩阵，也不证明正式 APK、真机生命周期、资产授权或商业发布已完成。

`COMBAT-002`、Rest/Repair 和真实 CombatSession 按用户要求继续延期，未纳入本次通过范围。
