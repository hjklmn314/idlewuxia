# Combat Validation Scope Separation

日期：2026-08-04  
权威工程：`H:\MyProjectBack\idlewuxia`  
写入边界：本记录只属于 H 盘项目；`G:\codex` 不作为源码或配置写入目标。

## 目的

本记录把“武侠战斗核心”门禁与旧的 `idledotshoot` 首次战斗/塔防遗留门禁分开，避免把不属于当前模块的失败结果误判成武侠战斗运行时失败，也避免把旧门禁误报成产品完成。

## 结论

当前武侠战斗权威门禁为：

```powershell
cd H:\MyProjectBack\idlewuxia
npm.cmd run runtime:combat-content:validate
npm.cmd run runtime:combat-module:audit
npm.cmd run runtime:combat-session:test
npm.cmd run runtime:combat-attributes:test
npm.cmd run runtime:combat-chapter-integration:test
```

以上门禁分别覆盖 Schema/引用、能力矩阵、确定性战斗、属性与计算、章节 outcome 接入；截至本记录生成时均通过。

## 旧门禁的真实范围

### `validate:combat-mechanics`

脚本：`tools/validate-combat-mechanics-parity.mjs`  
实际读取：`src/main.js`、`config/original_economy_constants.json`、`config/original_ui_unlocks.json` 以及 `apk_contents/focused_game_monetization/game_web/index-DINbkGXA.linebreak.js`。

它检查的是旧 `idledotshoot` 的 DOT 生成、炮塔、无人机、真空吸附器和 projectile 逻辑，不读取 `config/wuxia_combat_content.json`，也不调用 `src/combatSession.js`。因此它不是武侠战斗模块的权威门禁。

2026-08-04 实跑结果：36 checks，14 passed，22 failed，0 warnings。失败项全部集中在上述旧模块的 `originalDotCapacity`、`originalDotSpawnBatch`、`maintainOriginalDotPopulation`、`spawnProjectile`、`updateProjectiles`、`syncShooters`、`updateTurretShooters`、`drawOriginalTurrets`、`syncCollectorUnits`、`updateCollectorUnits`、`drawCollectorUnits`、`syncVacuumUnits`、`updateVacuumUnits`、`drawVacuumUnits`。原始结果保存在：

- `outputs/combat_mechanics_parity_report_20260702.json`
- `outputs/combat_mechanics_parity_report_20260702.md`

这 22 项不应被重写成武侠 `CombatSession` 的修复任务；若未来继续维护旧 `idledotshoot` 产品，应单独建立旧项目的 owner、范围和回归计划。

### `validate:presentation-config`

脚本：`tools/validate-presentation-config.mjs`  
它检查旧项目 `src/main.js` 中 DOT、Boss、projectile、drone、vacuum、turret 的 `presentation_runtime_tuning.json` 读取方式，不检查武侠 `visualCues`/`audioCues` 或 `rules.presentation`。

2026-08-04 实跑结果：17 checks，9 passed，8 failed。失败项为旧项目的 `themePresentation`、`drawDots`、`drawBoss`、DOT durability、`drawProjectiles`、`drawCollectorUnits`、`drawVacuumUnits`、`drawOriginalTurretUnit`。原始结果保存在：

- `outputs/presentation_config_validation_report.json`
- `outputs/presentation_config_validation_report.md`

它与武侠战斗 Cue 合同是两个不同配置域，不能用来证明或否定 `src/combatSession.js` 的技能/Buff/表现能力。

### `validate:combat-presentation` 与 `validate:combat-readability`

这两个脚本同样面向旧项目的塔防表现事件/伤害来源，目前各自输出无 findings；该 PASS 只说明旧域样本没有新增静态问题，不等于武侠战斗视觉已达到上线标准。

## 防止误用

1. 武侠战斗报告必须引用 `outputs/combat/` 下的 `combat_module_audit.json`、`combat_session_test_report.json`、`combat_attribute_test_report.json` 和 `combat_chapter_integration_report.json`。
2. `npm run check:legacy-novalite` 会串行执行旧门禁，其中的失败不得覆盖武侠门禁结果；运行该命令时必须把旧域报告单独登记。
3. 武侠战斗当前仍有产品边界： authored content 只有 3 个单位、2 个遭遇、26 个技能、16 个 Buff；手动技能面板、真机听感/性能、正式签名 Release APK/AAB 和最终艺术视觉门禁尚未关闭。
4. 任何新增武侠单位、技能、Buff、遭遇或 Cue 必须先改配置与 Schema，再通过武侠门禁；不得为了让旧门禁变绿而向 `src/combatSession.js` 加入旧项目具体 ID 或逻辑。

