# 模块化像素角色需求表（2026-08-13）

## 1. 当前决策

角色采用用户提供参考图中的“只有头和身子”的 Q 版轮廓，但最终输出必须是清晰的像素美术，不复制参考图中的具体人物、界面或资源。仅使用侧视图；敌方朝向由统一右朝向源图做受控水平镜像。场景必须是无角色的干净场景，角色由运行时独立挂载。

本任务只冻结需求、Schema、验证与后续运行时接口，不生成角色图片，不把缺失资产标成完成。

## 2. 必拆基础部件

| 部件 ID | 中文 | 最低首批变体 | 必须独立换装 | 说明 |
|---|---|---:|---|---|
| `body` | 身体 | 8 | 是 | 包含躯干、袖子、整合式手部；不得绘制独立腿部轮廓 |
| `head-base` | 头部底胚 | 4 | 是 | 只含脸型、耳部与肤色基础，不烘焙眼睛、嘴巴、头发 |
| `eyes` | 眼睛 | 8 | 是 | 至少支持 neutral、focused、hurt、defeated 表情 |
| `mouth` | 嘴巴 | 8 | 是 | 至少支持 neutral、attack、hurt、defeated 表情 |
| `hair` | 发型 | 12 | 是 | 独立于头部底胚；含主色与高光换色通道 |

可选层：`headwear`、`face-accessory`、`weapon-rear`、`weapon-front`、`contact-shadow`。装备不得与基础头、脸或身体永久合并，否则不能支持自定义。

## 3. 像素与组合合同

- 逻辑画布：每个部件、每一帧均为 `96×96` 像素透明画布。
- 渲染：nearest-neighbor；只允许整数倍缩放；禁止抗锯齿和亚像素偏移。
- 朝向：源资产只画向右侧视图；敌方通过水平镜像得到向左版本。
- 比例：头部可见高度 / 身体可见高度在 `0.75–1.15`；这是头身二段式，不再使用“几头身”作为验收口径。
- 腿部：禁止形成独立腿或脚的可读轮廓；手部允许整合在身体/袖子层。
- 锚点：`origin`、`head`、`face`、`weapon-main`、`fx-center`、`ground-contact`。
- 所有可组合部件必须共享同一画布、帧序号、帧数、FPS 和锚点集合；换一个眼睛或发型后不得跳帧、漂移或穿插错误。
- 层级从后到前：阴影 → 后置武器 → 身体 → 头底 → 眼睛 → 嘴巴 → 头发 → 头饰 → 面部附件 → 前置武器。

## 4. 动画需求

| Clip | 最低帧数 | 验收重点 |
|---|---:|---|
| `idle` | 4 | 轻微呼吸/身体起伏，脸部与头发不漂移 |
| `move` | 4 | neutral → compress → translate → recover；无左右脚循环 |
| `attack` | 6 | 蓄力、出手、命中停顿、收招；武器锚点稳定 |
| `hurt` | 4 | 受击压缩与后移，脸部 hurt 表情同步 |
| `control` | 4 | 定身/眩晕可读，不依赖场景烘焙效果 |
| `defeat` | 6 | 失衡、下沉、结束停留；不得突然消失 |

不同部件在同一 Clip 必须拥有完全一致的帧数与 FPS。若发型需要二级摆动，只能通过同帧变体或运行时受控偏移实现，不得改变权威帧时间轴。

## 5. 配置与运行时链路

```text
CharacterCompositionDefinition
  -> body/head-base/eyes/mouth/hair logical part IDs
  -> palette channels + optional equipment layers
  -> PartRegistry resolves approved atlases and shared anchors
  -> CharacterComposer builds one actor layer stack
  -> AnimationState selects the same clip/frame for every layer
  -> Combat/UI adapter mounts the composed actor
```

角色身份、门派、NPC 类型、敌人类型只选择配置中的逻辑部件 ID；代码不得按具体人物名硬编码图片路径。每个部件的 `assetId` 必须先解析到获准的 Runtime AssetRegistry `character-part` 记录，帧配置只保存该部件自身的逻辑帧引用。缺失必需部件、未知资产、资产类型错误、帧数或身体阶段不一致、锚点漂移、非侧视、出现独立腿部轮廓或使用非整数缩放时，开发环境报精确配置错误，生产门 fail-closed。

## 6. 人工验收

每套组合至少检查：原始 96×96 放大图、三种竖屏尺寸、玩家向右、敌方向左、六个 Clip 全帧、五个必需部件逐项替换、极端发型与身体搭配、武器前后层、伤害/VFX 遮挡、透明边界与 ground-contact 稳定性。

通过标准是“替换任一基础部件后，角色身份明显变化但轮廓、锚点、动画、表情、武器和碰撞反馈仍正确”。单张静态合成图不能完成验收。

## 7. 当前状态与后续任务

- 需求、Schema 与负例 Gate：完成。
- 角色实际 PNG/WebP 部件：缺失，后续制作。
- Runtime `CharacterComposer` 与 PartRegistry：已实现通用逻辑 ID、AssetRegistry 解析、层序、独立部件帧、共享身体阶段/锚点/时间轴、镜像和负例 fail-closed；当前零部件/零组合，因此该组合器不会伪造或渲染占位角色。
- ASSET-007：继续 open。
- COMBAT-002B / T05-01：继续 blocked。
- 旧原项目资产仅可作为开发期参考/占位；不能凭存在性满足新的模块角色生产合同。

## 8. 版本、迁移与回滚

- 本方向使用 `visual_standard.v2`、`combat_actor_asset_requirements.v2`、`asset_contract.v2` 和 `combat_presentation_contract.v2`；v1 不得与 v2 混用。
- 旧 `walk_left` / `walk_right`、左右脚交替和“三头身全身角色”字段不做静默兼容。导入旧配置时必须先迁移为 `move` 与身体阶段时间轴，并拆成五个必需部件。
- 回滚必须整体回滚配置、Schema、校验器、测试与 Roadmap 证据，不允许只把 JSON 改回 v1 而保留 v2 Runtime 语义。
- 当前不存在角色生产字节，因此本次回滚不涉及删除或替换任何美术源文件。

## 9. 已落地运行时边界

- `config/wuxia_character_compositions.json` 是角色部件与组合的唯一活动配置入口；当前状态为 `requirements-ready-assets-missing`，`parts=[]`、`compositions=[]`、`shippingAllowed=false`。
- `src/characterComposer.js` 只实现部件登记、组合、层序、动画帧同步、调色参数和左右镜像渲染计划，不包含任何具体人物、门派、NPC 或图片路径。
- `src/wuxia-main.js` 在启动时创建 PartRegistry 与 CharacterComposer；无资产时合法启动，有配置错误或不兼容组合时精确报错并 fail-closed。
- 实际 DOM/Canvas 像素层挂载要等批准部件资产进入配置后再启用。不能用 CSS 几何角色来伪造该任务完成。

## 10. 真实浏览器人工验收记录

2026-08-13 使用本地实际运行入口在 `430x820` 竖屏完成首局 12 步流程，证据位于未提交的运行产物 `outputs/manual_visual_character_contract_20260813/`。自动记录为 12/12 截图、流程失败 0、页面控制台问题 0、横向溢出 0；人工逐张打开并检查了 12 张截图。

本次人工结论分为两层：

- **运行与级联回归：PASS**。新增配置可加载，首局可从开场推进到地图和 NPC 交谈，未出现白屏、配置异常、溢出或交互中断。
- **目标角色与产品视觉：BLOCKED / NOT TESTABLE**。当前活动配置明确为零部件、零组合，页面仍显示既有黑灰原型界面，未出现本规范所要求的像素化头身模块角色；因此不得把运行通过解释为角色美术或 T05-01 通过。

只有当批准的五类基础部件进入 AssetRegistry 和组合配置、DOM/Canvas 适配器实际挂载，并完成六个 Clip 全帧与三尺寸人工验收后，才允许解除该视觉阻断。
