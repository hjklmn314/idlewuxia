# COMBAT-005 手动视觉与交互验收 — 2026-08-09

## 验收结论

- 战斗结果路由功能与竖屏可用性：`PASS`。
- 生产美术/音频 Gate C：`FAIL / BLOCKED`，按项目规范单独保留，不冒充本项通过。
- 项目上线：`RELEASE_BLOCKED`。

## 验收对象

| Result | NPC / 动作 | Encounter | 360×800 | 390×844 | 540×960 |
|---|---|---|---|---|---|
| `compare` | `fb01r16_3/custom_caozuo` | `encounter_fb01_capture_yin_quanan` | PASS | PASS | PASS |
| `inattack201` | `fb01r41_1/custom_caozuo` | `encounter_fb01_inner_demon` | PASS | PASS | PASS |
| `inattack202` | `fb01r42_1/custom_caozuo` | `encounter_fb01_nightmare` | PASS（调参后复跑） | PASS（调参后复跑） | PASS（调参后复跑） |

权威证据根：`outputs/combat_result_visual/final_20260809/`。`compare/360x800_retry` 是首次并行运行环境未就绪后的顺序复跑结果；产品判定只采用成功复跑。梦魇只采用 `*_tuned` 目录作为最终参数证据。

## 人工检查清单

每个 Result、每个尺寸均人工打开并检查战斗启动帧与终局帧：

1. 路由进入 `STATE_FS_009_EARLY_COMBAT`，不是反馈占位页。
2. pending combat 的 `triggerResultId`、`encounterId`、手动回合状态与配置一致。
3. 技能列表在 360、390、540 宽度可滚动，操作按钮和目标选择可达。
4. 角色信息、血/内力、Buff、回合与战斗反馈没有横向裁切或互相遮挡。
5. 胜利后返回地图，胜利专属 Result 只在胜利时执行。
6. 失败/逃跑没有写入胜利标记。
7. `inattack201` 终局显示“传人战胜了自己的心魔”；`inattack202` NPC 显示“无名少女”，文本使用“传人/其”，没有 `$IN`、`$S`、`$N` 原始 token。
8. 浏览器 runner 每条路线 14 步、0 failure；权威 9 组共 126 步，调参后梦魇额外 42 步、0 failure。

## 代表性证据

- `compare/360x800_retry/12_combat_result_start_compare.png`
- `compare/360x800_retry/14_combat_result_resolved_compare.png`
- `compare/390x844/12_combat_result_start_compare.png`
- `compare/540x960/14_combat_result_resolved_compare.png`
- `inattack201/360x800/12_combat_result_start_inattack201.png`
- `inattack201/390x844/14_combat_result_resolved_inattack201.png`
- `inattack201/540x960/14_combat_result_resolved_inattack201.png`
- `inattack202/360x800_tuned/12_combat_result_start_inattack202.png`
- `inattack202/390x844_tuned/14_combat_result_resolved_inattack202.png`
- `inattack202/540x960_tuned/14_combat_result_resolved_inattack202.png`

每个证据目录同时保留 `real_browser_flow_summary.json`。浏览器 profile 是临时运行数据，不属于产品或正式证据，将在报告完成后定向清理；截图、summary、测试报告保留。

## 人工否决的生产项

当前战斗画面仍有以下生产阻断：

- CSS 几何角色，不是已批准的侧视三头身像素武侠动画；
- 黑灰/开发期战斗舞台，不是最终干净场景；
- 缺少逐 cue 的生产 VFX 与完整 Buff 美术；
- 开发参考 MP3/回退不能替代自有或授权 OGG 与真机混音/延迟证据。

因此本报告只签署“真实战斗路由、交互、文本、终局语义和三尺寸可用性”，不签署 `COMBAT-002B`、`T05-01` 或项目发行完成。

## 2026-08-09 严格修复后重新验收

- 当前权威证据根：`outputs/combat_result_visual/audit_20260809_final_current/`；旧 `final_20260809` 与 `audit_20260809_postreview` 只保留为历史记录，不替代最终配置基数后的复验。
- 顺序运行真实 Edge 的 `compare`、`inattack201`、`inattack202` 三条配置路线，覆盖 360×800、390×844、540×960，共 9 个 run、126 个交互步骤。
- 自动事实：failure=0、console error/warning=0、bad route/state match=0、horizontal overflow frame=0；全部终局返回地图状态。
- 人工事实：逐张打开 9 张启动帧与 9 张终局帧，检查技能滚动、目标、HP/MP、Buff、结果文案、长文滚动和返回地图；未见 raw token、控件不可达、横向裁切或结果遮挡。
- 严格生产视觉判定仍为 `FAIL / BLOCKED`：人物是 CSS 几何占位，舞台不是批准的干净像素场景，正式 VFX/Buff/OGG 尚未形成资产闭环。该失败继续阻止 `COMBAT-002B`、`T05-01` 和发行，不被功能 PASS 覆盖。
