# COMBAT-003 完工记录：暂停、重播、存档恢复与数值模拟

日期：2026-08-08
项目：`H:\MyProjectBack\idlewuxia`
结果：`PASS WITH KNOWN LIMITATIONS`

## 1. 当前现状

本任务关闭了战斗运行时的暂停、恢复、确定性命令重播、战斗快照恢复和共享运行时数值模拟链。它不宣称正式战斗美术、音频、真机或发行完成。

已完成的运行时能力：

- `CombatSession.pause()` / `resume()`：暂停是显式运行时状态；暂停期间技能、目标、脱离和队列输入全部 fail-closed。
- `commandLog` / `replayId`：只记录已接受的玩家动作、脱离、暂停和恢复；`replayId` 由 encounter、seed 与命令日志确定计算。
- Save/restore：快照保留 RNG、回合、单位 HP/MP/护盾、Buff、冷却、运行时修正、命令日志和 replay ID；恢复后继续使用同一确定性随机流。
- Replay：`replayCombatSession()` 使用同一份 `CombatSession` 和同一份 `config/wuxia_combat_content.json`，逐条解释命令并复现事件流。
- 数值模拟：`config/wuxia_combat_simulation.json` 定义 3 个场景，每个场景 200 个 seed；报告胜率、回合数与事件数百分位、伤害、治疗、承伤和 replay ID，超过配置边界即失败。

## 2. 存在问题

- 当前手动验收使用 `reference-only-development` 资产叠加层。它能加载参考项目的场景和 Buff/音频文件，但不能进入 shipping bundle。
- 参考战斗场景本身是灰黑调技术底图；角色仍是运行时 CSS 调试表现。它证明逻辑和控制链，不是最终像素美术验收。
- `ASSET-007`～`ASSET-010`、`COMBAT-002B`、正式 `COMBAT-002`、`T05-01`、真机性能、签名 Release、商店和回滚仍未完成。
- 当前重播是确定性状态/事件查看，不是带时间轴编辑能力的回放剪辑器。

## 3. 修改方案

程序只提供通用能力：状态机、命令日志、快照、重播解释器和模拟器；战斗单位、技能、Buff、遭遇、策略、阈值和视觉绑定继续由 JSON 配置提供。参考资源仅通过开发 overlay 的逻辑 ID 绑定，生产 profile 不读取该 overlay。

## 4. 修改范围

| 范围 | 文件 | 作用 |
|---|---|---|
| Definition/Rule | `config/wuxia_combat_content.json` | `rules.replay` 定义 schema、暂停/重播开关、事件上限和确定性策略 |
| Simulation | `config/wuxia_combat_simulation.json` | 场景、遭遇、玩家策略、seed 数量和胜率/回合/事件边界 |
| Schema | `config/wuxia_combat_simulation.schema.json` | 版本、外键、策略枚举与边界校验 |
| Runtime | `src/combatSession.js` | 暂停/恢复、命令日志、replay ID、快照恢复和重播解释器 |
| Chapter | `src/chapterSession.js` | UI-facing pause/resume/replay/stop-replay 命令，不改变结算权威 |
| UI adapter | `src/uiFlowAdapter.js`, `src/browserAutomationAdapter.js`, `src/wuxiaDomAdapter.js`, `src/wuxia-main.js`, `src/wuxia.css` | 真实控制按钮、状态显示、重播只读视图 |
| Tooling | `tools/validate-wuxia-combat-simulation.mjs`, `tools/simulate-wuxia-combat.mjs`, `tools/test-wuxia-combat-replay-pause.mjs`, `tools/test-wuxia-combat-simulation.mjs` | Schema、外键、平衡模拟、暂停/恢复/重播回归 |
| Governance | `config/production/production_stage_plan.json`, `config/production/subsystem_registry.json`, `config/project_scope.json`, `docs/codex_game_development_os/ROADMAP_20260804_TO_RELEASE.md`, `docs/codex_game_development_os/TRACEABILITY.md` | 阶段状态、子系统登记、范围和追踪关系 |

## 5. 配置变化

`rules.replay` 当前为：

```json
{
  "schema": "idlewuxia.combat_replay.v1",
  "allowPause": true,
  "allowReplay": true,
  "maxCommands": 256,
  "maxReplayEvents": 512,
  "saveAuthority": "combat_runtime_snapshot",
  "determinism": "seed-and-command-log"
}
```

数值模拟的 3 个意图是配置明确的：首局积极策略胜利、首局防守策略存活并胜利、武馆伏击的积极策略按当前内容意图失败。阈值不是程序硬编码；模拟器读取同一份战斗内容和同一份运行时公式。

## 6. 代码变化

- 增加暂停状态及暂停期间零突变保护。
- 增加接受命令日志和可重算 replay ID。
- 增加深度快照/恢复校验，包含 RNG、Buff、冷却和命令日志。
- 增加确定性重播 API；重播不替换权威快照。
- 增加 UI intent/schema：`pauseCombat`、`resumeCombat`、`replayCombat`、`stopCombatReplay`。
- 修复 DOM 绑定：暂停/恢复/重播按钮必须在点击时触发，不能在渲染绑定阶段执行。
- 重播只读期间停止自动结算计时器，避免查看重播时跳回地图。

## 7. 测试与手动验收

### Gate 1：自动与静态

- `node --check`：本任务涉及的 Runtime、UI adapter 和工具全部通过。
- `runtime:combat-replay-pause:test`：暂停输入拒绝、恢复、深度快照一致、确定性事件流一致，PASS。
- `runtime:chapter-session:test`、`runtime:ui-flow-adapter:test`、`runtime:persistence:test`，PASS。
- `runtime:combat-chapter-integration:test`、`runtime:combat-player-turns:test`，PASS。
- `runtime:combat-simulation:validate`：3 场景、每场 200 seed，PASS。
- `runtime:combat-simulation:test`：共享运行时、配置场景、平衡边界和 replay ID，PASS。
- `production:validate`、`production:asset-contract`、`production:visual-standard`，PASS；`scope:validate` 在本次新文件提交前暂时显示未跟踪文件，提交后复跑。

### Gate 2：真实浏览器手动验收

脚本：`.codex-os/temp/manual-combat-replay-acceptance.mjs`。执行了真实 Edge CDP 竖屏 540×960 流程：

1. 从首局流程进入 `STATE_FS_009_EARLY_COMBAT / UI_EarlyCombat`。
2. 点击“暂停战斗”，确认权威快照 `paused=true`，等待 150ms 后命令日志长度不变。
3. 点击“继续战斗”，确认 `paused=false`。
4. 用配置技能和目标完成 18 次玩家动作，战斗达到 `finished`。
5. 点击“重播本场”，确认 `replayMode=true`、replay ID 与权威快照一致，且显示“退出重播”。
6. 生成并人工查看截图：
   [combat_replay_pause_manual_20260808.png](H:/MyProjectBack/idlewuxia/outputs/combat_replay_pause_manual_20260808.png)

同一构建的 540×960 首局真实浏览器全流程也通过 15 步，进入并返回 `UI_EarlyCombat`；`failures=[]`、`pageConsoleProblems=[]`：
[real_browser_flow_summary.json](H:/MyProjectBack/idlewuxia/outputs/combat_manual_browser_flow_20260808/real_browser_flow_summary.json)

人工结论：控制、状态、HP/MP、战斗日志、重播 ID 和退出重播入口可见且未溢出；截图中的灰黑场景和 CSS 几何角色被明确判定为开发技术表现，不能作为最终美术通过。

## 8. 风险与回滚

回滚点为本任务提交前的 Git commit。回滚只需还原 `combatSession`、chapter/UI adapter、配置、工具和文档对应提交；不会删除或修改 `fangzhijianghu/`、`outputs/`、Android 构建目录或只读参考资料。

## 9. 未完成项

下一顺序仍为：

1. `ASSET-CONTRACT-001` 的实际资产来源补齐与授权登记（已有合同，仍需生产资产）。
2. `ASSET-007`～`ASSET-010`：玩家、敌人、干净场景、命中/格挡/闪避/控制/Buff/胜负 VFX 与 SFX/BGM。
3. `COMBAT-002B` / `COMBAT-002`：逻辑 ID 绑定批准资产，production profile 禁止 CSS 几何角色、黑灰场景和 oscillator fallback。
4. `T05-01`：11 屏×3 尺寸的自动、控制台和人工视觉/动画/音频矩阵。
5. `SAVE-001`、`OBS-001`、`HYGIENE-001`。
6. 真机触控/性能/音频、Release APK/AAB、签名、商店灰度、监控与回滚演练。
