# idlewuxia 战斗模块生产规范与阶段审计（H 盘权威版）

生成日期：2026-08-02  
权威工程根：`H:\MyProjectBack\idlewuxia`  
范围声明：本阶段只修改、构建和验收 H 盘项目；`G:\codex` 不作为本阶段的写入目标。

## 1. 验收结论

本阶段完成的是“配置驱动的战斗核心运行时 + FB01 切磋链路接入”，不是全产品发行完成。核心运行时、配置 Schema、引用校验、确定性模拟、战斗表现事件合同、章节接入和负向回归均已通过；当前 authored content 覆盖 3 个单位、2 个遭遇、26 个技能、16 个 Buff、28 个表现 Cue、5 个音效 Cue。它证明通用能力链可运行，但不等同于已经制作完所有章节、全部 NPC、全部武学和商店/养成内容。

## 2. 权威数据链

```text
config/wuxia_combat_content.json
  -> config/wuxia_combat_content.schema.json (Ajv Draft 2020-12)
  -> src/combatSession.js (通用解释器、状态机、公式和事件)
  -> src/chapterSession.js (NPC compete -> pendingCombat -> outcome branch)
  -> src/wuxia-main.js (时间轴、HP/MP/护盾/Buff/浮字/战斗日志渲染)
  -> build:web -> android:sync -> Android WebView
```

程序只拥有解释器、状态机、校验、目标选择、计算、事件和渲染接口；单位、阵营、属性、派生公式、技能、Buff、遭遇、AI 权重、Cue、音效定义和资产绑定均在配置中。新增单位/技能/Buff/遭遇应只添加配置并通过门禁，不得在运行时代码中新增具体单位分支。

## 3. 当前已实现能力

### 3.1 属性与计算

- 配置公式 AST：`const/ref/add/sub/mul/div/min/max/clamp/round/floor/ceil`；技能效果在扣除资源前完成目标解析，拒绝动作不消耗资源、不启动冷却；终结事件计入 `result.eventCount`，与回放事件数保持一致。
- 基础属性与派生属性：气血、内力、攻击、防御、先手、暴击、闪避、命中、格挡、格挡强度、抗性、穿透、受伤倍率、吸血、韧性。
- 伤害类型：physical、internal、fire、ice、poison、true；每种伤害类型从 `rules.damage.rules` 读取独立防御属性、抗性、暴击/格挡/擦伤能力；支持抗性区间、最低伤害、暴击倍率、格挡倍率、闪避、命中、穿透和可配置擦伤。`true` 伤害明确跳过防御与抗性；所有视觉 Cue 和音频 Cue 默认映射也由 `rules.presentation` 配置，不在解释器中写死具体 Cue ID。
- 资源：MP 消耗、资源回复、冷却；HP、MP、护盾的边界裁剪。

### 3.2 技能与效果

当前解释器通过能力表声明并校验以下技能类型：

`direct_damage`、`elemental_damage`、`multi_hit`、`heal`、`heal_over_time`、`shield`、`control`、`damage_over_time`、`defensive_stance`、`stat_modifier`、`resource`、`cleanse`、`utility`。

效果类型：`damage`、`heal`、`shield`、`applyBuff`、`removeBuff`、`resource`、`statModifier`、`multiHit`。

目标选择：自身、单体敌人、单体友军、最低生命友军、随机敌人、全体敌人、全体友军；带嘲讽时单体敌人优先命中嘲讽目标。

### 3.3 Buff 与战斗状态

- 堆叠策略：stack、refresh、replace、unique 兼容。
- 正/负面状态、持续回合、回合开始/结束周期效果。
- 控制：stun、silence、root、taunt；沉默拒绝非基础技能，定身/眩晕跳过行动。
- 属性修正：加法/乘法；临时 `statModifier` 运行时修正。
- 反射、控制免疫、净化、护盾、持续伤害、持续治疗。
- Buff 抵抗使用目标 tenacity；免疫使用 `immunityTags`。

### 3.4 战斗状态机与 AI

- 确定性种子随机；同 encounter + seed 的事件序列可复现。
- 速度排序 + 种子破同速；回合、行动、冷却、状态 tick、胜负、最大回合/最大事件保护。
- AI 权重策略与玩家队列优先策略均由配置决定。
- `queueAction`、`availableActions`、`attemptRunaway` 用于工具、回放和后续玩家 UI；队列会校验技能是否装备、目标数量/阵营/目标选择器，不能将任意全局技能注入单位。
- FB01 当前产品流程仍使用配置的连续时间轴自动结算策略；它不是已经上线的手动技能面板。

### 3.5 表现与音效事件

每个事件均带 `TimeSeconds/EventType/sourceUnitId/targetUnitId/SkillId/BuffId/CueId/AudioCueId/Value/RawValue/VisualValue/Stack/Duration/EvidenceLevel/WarningCode` 等字段。表现 Cue 配置打击动画、命中冲击、停顿、屏幕震动和颜色；音效 Cue 配置合成波形、频率与时长，运行时按 `rules.presentation.audioCueIds` 绑定音效。浮字使用配置名称/事件短语，不把 `buff_*` 等内部 ID直接显示给玩家。

## 4. 两道审计门槛与最终门槛

### 门槛 A：静态/配置门

```powershell
cd H:\MyProjectBack\idlewuxia
npm.cmd run runtime:combat-content:validate
```

必须同时满足 Ajv Schema 通过、能力类型无未知值、所有 ID 唯一、单位/技能/Buff/遭遇/Cue 引用闭合、目标选择器受支持。

### 门槛 B：运行时/回归门

```powershell
npm.cmd run runtime:combat-session:test
npm.cmd run runtime:combat-attributes:test
npm.cmd run runtime:combat-chapter-integration:test
npm.cmd run runtime:chapter-session:test
npm.cmd run runtime:integrity:test
npm.cmd run runtime:action-state-assertions:test
```

必须覆盖胜利、失败、伤害、治疗、护盾、Buff/DeBuff、持续效果、控制拒绝、根/眩晕跳过、反射、属性临时修正、确定性事件合同和章节 outcome 分支。

### 最终门槛：手动运行与视觉

1. 在 H 工程启动开发服务器，按真实入口进入 FB01。
2. 选择 `武馆老管家 -> 切磋`，确认进入 `UI_EarlyCombat`，画面出现两侧战斗单位、HP/MP、事件浮字和日志。
3. 等待完整事件时间轴结束，确认只由配置的 resolve action 回到地图，且奖励/地图标记通过 outcome 分支产生。
4. 截图检查无空白场景、无重复叠加、HP/MP/护盾变化方向正确、Buff 图标与日志一致。
5. 浏览器控制台必须为 0 error / 0 warning；再执行 `npm.cmd run build:web`、`npm.cmd run android:sync` 和 `npm.cmd run web:freshness`。

## 5. 本阶段测试证据

- `runtime:combat-content:validate`：PASS；3 factions、3 units、26 skills、16 buffs、2 encounters、28 cues、5 audio cues；0 findings。
- `runtime:combat-module:audit`：PASS；逐技能/逐 Buff probe、Schema/运行时引用、支持能力对照和运行时代码具体 ID 硬编码扫描均通过；未编写的通用能力会在 `unAuthoredSupported` 中显式列出。
- `runtime:combat-session:test`：PASS；first-session victory、ambush defeat；advanced mechanics reflect/silence/root/statModifier/true damage/area targeting/ally targeting/lowest-hp ally/taunt/runaway 全部 PASS。
- `runtime:combat-attributes:test`：PASS；派生属性、暴击、吸血、命中/闪避、格挡、抗性/穿透、受伤倍率、真伤绕过、死亡目标保护、全体目标集合校验、终结事件计数全部 PASS。
- `runtime:combat-chapter-integration:test`：PASS；真实 `NPC compete -> combatSnapshot finished -> victory -> configured outcome branch -> map`。
- `runtime:chapter-session:test`：PASS。
- `runtime:first-session-simulator:test`：PASS；mismatches=0。
- `wuxia:validate:first-session:runtime`：PASS；errors=0、warnings=0。
- `runtime:integrity:test`：PASS；包括战斗结果无策略时 fail-closed、存档形状校验和原子回滚。
- `runtime:action-state-assertions:test`：PASS；358/358 actions。
- `task:preflight` 已纳入 `runtime:combat-attributes:test`，因此属性、抗性、穿透、格挡、吸血、真伤和终结事件计数不会再绕过总门禁。
- 旧 `idledotshoot` 的 `validate:combat-mechanics` 与 `validate:presentation-config` 不属于本模块权威门禁；其失败项和边界单独登记在 `docs/COMBAT_VALIDATION_SCOPE_SEPARATION_20260804.md`，不得与武侠 `CombatSession` 结果混报。

机器结果分别写入 H 盘 `outputs/combat/`，仅作为可复现证据，不是产品发布物。

## 6. 未完成边界（不得在报告中误称已上线）

1. 目前只完成首批 authored combat content；完整项目仍需把全章节/全 NPC/全敌人/全武学/全 Boss 转换为相同配置合同，并逐条做数值和表现验收。
2. FB01 当前设计是配置声明的自动战斗时间轴；玩家手动技能面板、目标选择和中途暂停尚未接入产品 UI。`queueAction` 已为工具和后续 UI 提供接口，但不能把它误称为已上线玩家操作。
3. 当前音效为配置驱动合成 Cue 与事件挂载，仍需真实设备听感、混音、音量、静音和性能验收；视觉 Cue 仍需逐屏截图矩阵。
4. 真机回归、性能预算、签名 Release APK/AAB、商店包、崩溃监控和回滚门槛仍未关闭。

## 7. 下一阶段施工顺序

1. 扩充完整 combat content catalog：先建立单位/技能/Buff/遭遇清单，再分批导入；每批必须通过门槛 A/B。
2. 接入 `UI_EarlyCombat` 的配置驱动技能选择/目标选择（不改变现有自动战斗兼容路径），增加中断、暂停、重播和存档恢复。
3. 建立全量数值模拟矩阵：胜率、平均回合、资源曲线、控制命中率、护盾吸收、伤害类型分布和异常状态覆盖。
4. 建立 `AssetRegistry` 的战斗 Cue/角色侧视图/场景挂载闭环，并进行 11 屏×3 尺寸手动视觉验收。
5. 最后才进入真机、性能、签名和 Release Gate。

旧验证器与本模块的范围隔离、失败明细和后续 owner 约束见 `docs/COMBAT_VALIDATION_SCOPE_SEPARATION_20260804.md`。
