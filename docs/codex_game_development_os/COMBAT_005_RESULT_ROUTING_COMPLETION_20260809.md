# COMBAT-005 完工记录：章节 Combat Result 到真实 CombatSession 的配置化闭环

## 1. 当前现状

`compare`、`inattack201`、`inattack202` 三条此前没有合法运行时映射的章节战斗结果，现已通过配置进入真实、可暂停/恢复/重播的 `CombatSession`。动作被接受时只建立 pending combat，不提前写入胜利标记；只有终局结果产生后，才按配置分发胜利、失败或逃跑后续。

本项的工程、配置、数值模拟与三尺寸浏览器功能验收通过。项目整体仍是 `RELEASE_BLOCKED`：生产角色、场景、VFX、Buff 美术、OGG、Android 真机与发布证据不属于本项，继续由 `ASSET-007`～`ASSET-010`、`COMBAT-002B`、`T05-01` 和 `REL-*` 承担。

## 2. 存在问题

施工前存在以下 P0 语义缺口：

1. 三个 `combat` Result 能返回反馈，却没有 Result ID 到 Encounter 的唯一合法映射。
2. 缺少来源 NPC 和动作类型白名单，错误实体可能复用战斗结果。
3. 胜利后续与战斗启动没有事务边界，存在“接受即发奖/写标记”的风险。
4. 失败、逃跑、缺配置和缺 Result 没有完整 fail-closed 负例。
5. 传承文本中的 `$IN`、`$S`、`$N` 会原样泄漏到可见 UI。
6. 新遭遇没有纳入与 Runtime 同公式的批量数值模拟。

## 3. 修改方案

建立 `chapterSystem.combatResultPolicies` 作为唯一映射权威。每个 Result 配置自己的：

- `resultId`；
- `allowedSourceIds` 与 `allowedActionTypes`；
- `encounterId`、`startActionId`、`resolveActionId`；
- `runtimeMode=manual_player_turns` 与 `maxSteps`；
- 胜利/失败/逃跑条件或后续 Result；
- 启动反馈、场景主题、证据来源和终局分发策略。

Runtime 只解释该合同。来源、动作、Encounter、结果或后续 Result 任一缺失、冲突或不合法时都拒绝且不修改玩家状态。文本替换同样由 `runtimeMutation.textInterpolation` 配置提供 token、数据路径、选择映射与 fallback，代码不硬编码人物名字、性别或传承称谓。

## 4. 修改范围

- 配置：首局流程、战斗内容、战斗模拟、浏览器证据路线、生产任务计划及 Schema。
- Runtime：实体交互路由、章节会话终局事务、结果反馈插值、运行时 NPC 投影。
- 工具：配置生成器、Schema/语义验证器、批量模拟筛选、真实浏览器战斗路线。
- 测试：三条正例、五类负例、存档恢复、动态/缺省文本、浏览器证据路由与既有完整性回归。
- 未改动：参考项目源文件、生产资产、Rest/Repair、签名或商店配置。

## 5. 配置变化

1. 新增 `config/wuxia_chapter_combat_result_policies.schema.json`，限制一条来源引用、一组允许动作、真实 Encounter、终局策略和证据字段。
2. `config/wuxia_first_session_flow.json` 新增三条 Result policy：
   - `compare` → `fb01r16_3/custom_caozuo` → `encounter_fb01_capture_yin_quanan` → 胜利条件 `comparewin`；
   - `inattack201` → `fb01r41_1/custom_caozuo` → `encounter_fb01_inner_demon` → 胜利 Result `inattack201`；
   - `inattack202` → `fb01r42_1/custom_caozuo` → `encounter_fb01_nightmare` → 胜利 Result `inattack202`。
3. 战斗内容新增抓捕、心魔、梦魇三套 Encounter 及所需阵营、单位和 AI 定义；数值是项目当前纵切的显式可调配置，不冒充参考项目未知固定值。
4. 文本替换新增 `$N`、`$IN`、`$S` 的配置路径、映射和 fallback。
5. 三个 Encounter 全部进入 `wuxia_combat_simulation.json`，不允许只有运行时路由而没有数值门禁。

## 6. 代码变化

- `EntityInteractionService` 按 Result ID 选择且只允许唯一 policy，验证来源和动作后再建立战斗。
- `ChapterSession` 把 `triggerResultId` 和 `outcomeResultTokens` 写入可保存 pending combat；终局时在草稿上执行配置后续，失败则丢弃草稿并保留 pending combat 供恢复。
- `runtimeTextInterpolation.js` 提供通用、无项目内容硬编码的路径/选择器/fallback 插值。
- `ResultEffectExecutor`、章节 NPC 投影和反馈统一调用插值器，原始 token 不再进入 UI。
- 真实浏览器 runner 增加 `combat-result-route`，校验 live pending combat 的 Result、Encounter、手动回合和终局返回。
- 战斗模拟工具支持单 scenario 聚焦复测，完整报告格式和默认全量行为保持兼容。

## 7. 测试与手动验收

- `runtime:combat-result-routing:test`：4 个正例记录、5 个负例全部通过。
- 正例覆盖三条真实 `CombatSession` 胜利、`inattack201` 存档恢复、动态传承文本与缺省文本。
- 负例覆盖失败不执行胜利结果、逃跑不执行胜利结果、来源白名单、缺 policy、终局缺 Result 的原子拒绝。
- 战斗内容验证：5 阵营、6 单位、26 技能、16 Buff、5 Encounter、4 AI，无 finding。
- 全量模拟：6 个 scenario × 200 seeds，共 1,200 局；全部在各自配置阈值内。梦魇最终胜率 0.845，中位 14 回合，P95 事件 159。
- 旧审计分类器已改为读取同一 Result policy 和 Encounter 权威；focused 审计测试覆盖 3 条正路由与 5 个 fail-closed 负例。最新 Result-token 审计为 316/316 P3、P0=0、P1=0，三条状态均为 `implemented_configured_combat_result_session`。
- `wuxia:audit:online-standard` 仍按设计返回非零，但 `runtime_result_token` issue 已消失；剩余 11 个 P0 和 3 个 P1 全属于生产资产、资产合同或人工视觉，不再包含战斗结果路由。
- 三条路线 × 三尺寸真实 Edge：每条 14 步，权威矩阵 126 步、0 failure；调参后的梦魇又复跑 42 步、0 failure。
- 人工检查了每个尺寸的战斗启动帧和终局帧：无横向溢出、无不可达技能/目标、反馈可读、没有 `$IN/$S/$N` 泄漏。
- 详细记录见 `COMBAT_005_MANUAL_VISUAL_ACCEPTANCE_20260809.md`。

已知的 `FIRST_SESSION_SIMULATION_MISMATCH` 明确保持 `scope=separate`，不计入本 focused suite 的通过，也没有被本项掩盖或伪装成关闭。

## 8. 风险

1. 当前画面仍使用开发期 CSS 几何角色、占位战斗舞台及参考覆盖层，不满足生产美术 Gate C。
2. `inattack202` 的参考固定战斗数值没有可靠证据；当前参数是可追踪、可模拟、可回滚的项目归一化值。
3. 浏览器三尺寸通过不等于 Android 真机触控、性能、音频延迟或生命周期通过。
4. Debug/开发绑定通过不等于生产授权、Release APK/AAB 或商店上线通过。

## 9. 未完成项

1. `ASSET-007`～`ASSET-010`：按需求表提供可授权生产角色、干净场景、VFX/Buff 与 OGG；当前继续用原项目资产推进开发功能，但禁止进入 shipping。
2. `COMBAT-002B`：批准资产绑定、真实打击表现、三尺寸产品视觉和代表性 Android 人工验收。
3. `T05-01`：完整 11 屏 × 3 尺寸产品视觉矩阵。
4. `SAVE-001`、`OBS-001`、`HYGIENE-001`、`SEC-001`、`REL-001`～`REL-003`。
5. `REST-REPAIR-001` 继续 postponed，不因本战斗结果任务自动恢复。
