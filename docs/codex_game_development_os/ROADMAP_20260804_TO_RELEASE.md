# idlewuxia 从当前阶段到发行上线 Roadmap — 2026-08-04

机器权威：`config/production/production_stage_plan.json`。本文件解释施工顺序、交付物和人工 Gate，不替代机器状态。

## 当前状态

- G0、G3：pass。
- G1：pass-with-open-acceptance。
- G2：pass-with-known-unknowns。
- G4：blocked（Save/Observability）。
- G5：blocked（T05-01、COMBAT-002、ASSET-002～010）。
- G6：not-started。
- G7：blocked。
- 总体：`RELEASE_BLOCKED_ACTIVE_REMEDIATION`。

## P0 施工顺序

### Wave 1 — 资产生产前的合同冻结

1. `COMBAT-002A`：**已完成逻辑合同冻结**。当前为 26 技能、16 Buff、7 目标、6 伤害、事件、角色挂点、场景挂点、VFX/SFX 逻辑 ID；不等于资产或表现完成。
2. `ASSET-CONTRACT-001`：**已完成合同冻结**。`asset_contract.json`、Schema、来源/授权/尺寸/帧率/pivot/透明区/预算/hash/fallback/runtime binding 验证链已接入；实际资产槽仍未满足。
3. `VISUAL-STANDARD-001`：**已完成标准冻结**。侧视、约三头身、干净场景、像素渲染、竖屏安全区、44dp 触控、战斗信息不遮挡等规则已配置化；当前产品画面仍需人工验收。

完成标准：配置和样例验证器能拒绝错误视角、错误比例、带人物背景、缺帧、缺授权、超预算与缺逻辑 ID。不得先批量产图再补规则。

### Wave 2 — G5 产品资产与 UI/UX 闭环

1. `ASSET-007` 侧视三头身角色：idle、attack、hurt、control、defeat；左右脚/动作帧人工逐帧检查。
2. `ASSET-008` 干净战斗场景：无 baked character，三尺寸安全区与角色落点通过。
3. `ASSET-009` 打击/VFX/Buff：命中、格挡、闪避、暴击、控制、Buff、胜负，性能预算内可读。
4. `ASSET-010` 音效/BGM：替换 oscillator，占位音频在 production profile 必须 fail。
5. `ASSET-003/004/005/006`：字体、章节地图、NPC 肖像、语义图标形成统一武侠 UI kit。
6. `ASSET-002`：从批准源生成 Android adaptive icon、legacy launcher 与 launch screen，全密度/暗色/圆形 mask 验收。
7. `COMBAT-002B`：将逻辑 ID 绑定到批准资产；禁用 CSS 几何战斗人物和黑灰占位场景 production fallback。
8. `T05-01`：重新跑 11×3；自动 33/33 只是前置条件，最后必须人工逐屏/逐状态/逐动画 PASS。

完成标准：QA-UI-001 自动报告 0 blocker；人工表对 33 个 pair、关键战斗帧和所有 modal 给出签名 verdict；任何 placeholder、错比例、遮挡、不可读或无来源资源都保持 FAIL。

### Wave 3 — G4 运行时生产治理

1. `COMBAT-003`：**已完成运行时能力闭环**。暂停/继续、命令日志、确定性 replay ID、存档恢复和同一 CombatSession 数值模拟已接入；此项不替代正式美术/音频发行验收。
2. `SAVE-001`：**已完成浏览器侧运行时治理闭环**。SaveEnvelope v2、v1→v2 迁移、staging/backup/rollback 四键事务、校验和、损坏回退、未来版本 fail-closed 与跨版本 fixture 已接入；Android 真机断电/容量故障注入和商业回滚演练继续由 `REL-002/REL-003` 承担。
3. `OBS-001`：**已完成浏览器 Runtime 范围**。7 类稳定事件、错误码、战斗 replay ID、build/config/save tags、去敏错误、render performance 字段、状态 delta 与首分歧诊断 replay 已接入；upload 关闭，远端 dashboard/alert 仍属于发行运维范围。
4. `HYGIENE-001`：把旧 idledotshoot 代码/配置、只读参考和活动 Wuxia authority 分层；更新 scope，证明 shipping closure 不变并提供回滚清单。

完成标准：升级/降级/损坏/断电测试可复现，且 telemetry 不泄露敏感数据；活动入口不再需要维护者猜测。

### Wave 4 — G7 Release Candidate

1. `SEC-001`：Android 权限、WebView、CSP/网络、secrets、依赖、隐私、支付/广告后端真实性。
2. `REL-001`：外部安全签名、release APK/AAB、版本号、R8/ProGuard、SBOM、clean rebuild、commit/config/APK hash 追踪。
3. `REL-002`：代表性 Android 真机矩阵；冷/热启动、前后台、离线、存档恢复、内存、CPU/GPU、帧稳定、音频延迟、触控、安全区。
4. `REL-003`：商店材料、分阶段发布、指标/告警、事故响应、回滚包与一次真实演练。

完成标准：签名 release artifact 而非 debug；真机/性能/合规/商店/回滚证据全部绑定同一 commit。任何一项缺失，release verdict 保持 blocked。

## 2026-08-08 ASSET-007 actor reference audit update

- `ASSET-007` remains **open**. The new requirements-only manifest and schema cover both actor logical IDs, the side-view/three-head/alternating-foot policy, runtime mount point and manual evidence requirements.
- The read-only reference archive audit found no eligible transparent side-view actor clip set. Scene PNGs, role UI panels, Lua role definitions and the flat-silhouette fight UI demo are explicitly ineligible; no reference bytes were copied or bound.
- Focused validator and positive/negative tests pass. This is an audit/configuration PASS WITH KNOWN LIMITATIONS, not a production asset pass. The next real dependency is an approved player and enemy actor set, followed by ASSET-008.
- Evidence: `config/wuxia_combat_actor_asset_requirements.json`, `config/wuxia_combat_actor_asset_requirements.schema.json`, `tools/validate-wuxia-combat-actor-asset-requirements.mjs`, `tools/test-wuxia-combat-actor-asset-requirements.mjs`, `docs/codex_game_development_os/ASSET_007_ACTOR_ASSET_REQUIREMENTS_AUDIT_20260808.md`.
- `ASSET-008` reference-backed scene requirements are also registered. The two reference scenes are structurally clean and manually reviewed, but remain reference-only because they are dark/monochrome and lack shipping ownership. The scene rows therefore remain production blocked.
- Evidence: `config/wuxia_combat_scene_asset_requirements.json`, `config/wuxia_combat_scene_asset_requirements.schema.json`, `tools/validate-wuxia-combat-scene-asset-requirements.mjs`, `tools/test-wuxia-combat-scene-asset-requirements.mjs`, `docs/codex_game_development_os/ASSET_008_SCENE_ASSET_REQUIREMENTS_AUDIT_20260808.md`.

## 2026-08-08 ASSET-009 VFX and Buff reference audit update

- `ASSET-009` remains **open / production blocked**. A requirements-only manifest now covers all 28 configured combat cue IDs and all 16 Buff icon IDs. The manifest records the event semantics, player-readable presentation brief, logical runtime policy, reference provenance and manual acceptance evidence required before production binding.
- The reference archive audit found zero frame-addressable VFX candidates under `Anim/FightEffect/`; the 47 files under `Image/UI/SkillUI/` are static menu icons and are not valid target-bound effects. Six 52x54 Buff icon exemplars (`b01`-`b03`, `d01`-`d03`) were manually viewed and hashed, but remain development-only reference bindings with no ownership evidence and no production satisfaction.
- The validator rejects cue-ID drift, event-type drift, unknown or reclassified Buff references, false satisfaction, shipping of reference bytes, and production fallback policy changes. Focused positive/negative tests pass. This is a configuration/audit PASS WITH KNOWN LIMITATIONS, not an art or release pass.
- Evidence: `config/wuxia_combat_vfx_asset_requirements.json`, `config/wuxia_combat_vfx_asset_requirements.schema.json`, `tools/validate-wuxia-combat-vfx-asset-requirements.mjs`, `tools/test-wuxia-combat-vfx-asset-requirements.mjs`, `docs/codex_game_development_os/ASSET_009_VFX_ASSET_REQUIREMENTS_AUDIT_20260808.md`.
- The next dependency remains ASSET-010 audio requirements/audit, followed by approved owned assets and COMBAT-002B. Gate C must still manually fail the current CSS/placeholder route until real actor, scene, VFX, Buff and audio bindings exist.

## 2026-08-09 ASSET-010 audio reference audit update

- `ASSET-010` remains **open / production blocked**. A requirements-only manifest now covers all five configured combat audio cue IDs, their event semantics, logical `combat.audio` mount, OGG/loudness/peak/latency budgets, provenance and manual mix/device evidence.
- The reference archive inventory found 118 files under `Music/Fight/` and 410 music files overall. Four existing overlay MP3 references were hashed and audited (`dao_hit_1.mp3`, `buff.mp3`, `dao_parry_1.mp3`, `biwu_tiaozhan_2.mp3`); they remain development-only. The defeat overlay points to a challenge/music file and is explicitly not accepted as a production defeat SFX.
- The validator rejects unknown or drifted cue/reference bindings, false production satisfaction, competitor MP3 treated as eligible production input, non-OGG policy, synth/oscillator fallback changes, and runtime mount changes. Focused positive/negative tests pass. This is a configuration/audit PASS WITH KNOWN LIMITATIONS, not an audio or release pass.
- Evidence: `config/wuxia_combat_audio_asset_requirements.json`, `config/wuxia_combat_audio_asset_requirements.schema.json`, `tools/validate-wuxia-combat-audio-asset-requirements.mjs`, `tools/test-wuxia-combat-audio-asset-requirements.mjs`, `docs/codex_game_development_os/ASSET_010_AUDIO_ASSET_REQUIREMENTS_AUDIT_20260809.md`.
- The next production dependency is owned/licensed actor, scene, VFX/Buff and OGG input, followed by COMBAT-002B. Manual Gate C and Android latency/mix evidence remain mandatory.

## 2026-08-09 ASSET-011 original-project development binding update

- The first development source is now explicit in `config/wuxia_combat_reference_asset_overlay.json`: `fangzhijianghu-original-project`, user-approved for development only, with shipping and reference-byte transport hard disabled.
- `originalProjectAssets=1` is the localhost-only primary activation query; `referenceAssets=1` remains a compatibility alias. Runtime still consumes logical IDs and never hardcodes a concrete asset path in combat logic.
- Development coverage is 2/2 clean scenes, 16/16 Buff logical rows backed by 6 original-project icons, and 5/5 audio rows backed by 4 original-project MP3s. Actors remain 0/2 and VFX remain 0/28 because the source archive has no eligible side-view actor set or frame-addressable cue family. MP3 remains insufficient for the required production OGG set.
- Focused overlay, schema, source-root and coverage-drift tests pass. Manual 540x960 flow reaches combat with 15/15 steps and console problems 0; strict Gate C remains FAIL because CSS actors, missing authored VFX and missing production OGG evidence are visible/known.
- This is a development binding milestone, not closure of ASSET-007/008/009/010 or COMBAT-002B. The next production dependency is approved actor clips plus authored VFX and OGG replacements, followed by the same three-viewport manual gate.

## 2026-08-09 COMBAT-002B development binding playback update

- `COMBAT-002B` remains **blocked for production**, but the development-only runtime binding path now has a fresh real-browser acceptance record. The active session loaded the original-project scene, applied a configured player Buff, rendered the corresponding logical Buff icons and invoked the configured original-project MP3 through the combat audio mount.
- `src/wuxia-main.js` now reads the authoritative live `CombatSession` event stream for playback and chooses the latest event carrying an audio cue. Surrounding `skill`/`skillResolved` events without audio no longer consume the playback sequence, so a real player action cannot silently lose its hit/Buff sound.
- Manual review of the six screenshots at 540×960, 360×800 and 390×844 passed for development binding and failed the deliberate production Gate C because CSS fighters, reference-only scene/audio, missing authored VFX and missing owned OGG remain visible/known.
- Evidence: `tools/run-wuxia-combat-reference-binding-acceptance.mjs`, `outputs/combat_reference_binding_acceptance_20260809_final/reference_binding_acceptance.json`, `docs/codex_game_development_os/COMBAT_002B_ORIGINAL_PROJECT_DEVELOPMENT_BINDING_20260809.md`.
- This does not advance `ASSET-007`/`ASSET-008`/`ASSET-009`/`ASSET-010` or `COMBAT-002B` to production complete. The next production dependency remains approved actor clips, authored VFX/Buff frames and owned/licensed OGG replacements.

## P1/P2 后续

- `CONTENT-001`：第二章节证明没有章节特例代码。
- `EDITOR-ROI-001`：根据重复生产成本决定脚本工具或编辑器；必须有 diff/undo/validate/preview。
- `REST-REPAIR-001`：按用户要求继续 postponed，不因战斗施工自动恢复。
- 商业化旧占位目录只有在产品需求确认、后端和合规设计后才能启用；当前不得进入武侠 shipping closure。

## 每一 Wave 的三道强制验收

1. Gate A：逐文件/逐配置静态审计、Schema、来源、hash、diff、rollback。
2. Gate B：单元、集成、回归、构建、包内容、性能预算和负例 fail-closed。
3. Gate C：真实设备/浏览器人工体验；逐屏、逐状态、逐动画、逐音频检查。Gate C 最严格，自动化 PASS 不能覆盖人工 FAIL。

## 当前可立即执行的下一批任务

| 顺序 | 任务 | 负责人能力 | 产物 |
|---:|---|---|---|
| 1 | ASSET-CONTRACT-001 | configuration-data-pipeline + asset pipeline | **done**：角色/场景/动画/VFX/音频/UI 资产 Schema、来源、授权、预算、hash 与 runtime binding 合同 |
| 2 | VISUAL-STANDARD-001 | ux-ui + asset pipeline | **done**：竖屏侧视三头身像素武侠验收标准与负例门禁；产品人工视觉仍由 T05-01 承担 |
| 3 | COMBAT-003 | combat-model-and-simulator + runtime + QA | **done**：暂停/继续、保存恢复、命令 replay、200×3 配置场景数值模拟与平衡报告 |
| 4 | ASSET-007/008 首个可玩套装 | asset-content-pipeline | 1 玩家、1 敌人、1 干净场景的完整动作闭环；缺失时继续使用开发期参考绑定，不把参考 bytes 带入 shipping |
| 5 | ASSET-009/010 首个打击闭环 | combat presentation + asset/audio | 命中、格挡、控制、胜负的 VFX/SFX 证据；缺失时登记需求，不伪造 production PASS |
| 6 | COMBAT-005 + COMBAT-002B | HTML runtime + combat + QA | **COMBAT-005 done**：`compare/inattack201/inattack202` 已合法映射真实 CombatSession；**COMBAT-002B blocked**：仍待生产资产、打击表现与真机人工门 |
| 7 | ASSET-002～006 + T05-01 | UI/asset + Android + QA | 全 UI kit、33/33 自动证据与严格人工签名表 |
| 8 | SAVE-001 + OBS-001 + HYGIENE-001 | save + observability + auditor | **SAVE-001、OBS-001 done**；HYGIENE-001 仍需完成，G4 尚未关闭 |
| 9 | SEC/REL-001～003 | release team | 签名 RC、真机、性能、商店、灰度和回滚 |

## 2026-08-04 审计后任务状态

- `COMBAT-002A`：done，配置与运行时能力合同已闭合。
- `COMBAT-003`：done，暂停/继续、存档恢复、确定性命令 replay 与同一运行时数值模拟已通过 focused tests；仍不等于批准资产或发行通过。
- `AUDIT-003`：blocked；完整读取、静态与运行时门已执行，COMBAT-005 已关闭 3 条未授权战斗结果，但人工视觉、10 个必需资产槽和 Release 证据仍未关闭。
- `T05-01`：blocked；最终自动矩阵位于 `outputs/wuxia_visual_matrix/20260804_post_truthful_node_fix/`，但人工视觉明确失败。
- `wuxia:audit:online-standard`：预期失败，2026-08-09 当前实跑为 11 个 P0、3 个 P1；全部属于资产、资产合同和人工视觉，只有真实关闭后才允许转绿。

## 2026-08-08 COMBAT-004 更新

- `COMBAT-004`：done，新增 `wuxia_combat_presentation_contract`，把 2 个角色挂点、2 个场景、28 个视觉 cue、5 个音频 cue、16 个 Buff 图标和 ASSET-007～010 的需求全部纳入同一配置/Schema/验证链。
- 普通结构门禁：PASS；`runtime:combat-presentation:test` 覆盖正例、缺 cue、未知引用和严格生产阻断；结构验证报告当前登记 53 个 production-blocked 绑定。
- 严格生产门禁：BLOCKED（符合预期）；当前无批准的侧视三头身角色、VFX 生产族和自有/授权 OGG，参考场景/音频/Buff 仅限开发覆盖层。
- 下一施工顺序保持：ASSET-007 → ASSET-008 → ASSET-009 → ASSET-010 → COMBAT-002B；任何一项未通过人工 Gate C 都不得宣称上线。

## 2026-08-09 COMBAT-005 章节战斗结果路由更新

- `COMBAT-005`：**done**。`compare`、`inattack201`、`inattack202` 已从章节 Result 通过 Schema 化 policy 唯一映射到真实 `CombatSession`，并按胜利/失败/逃跑终局配置分发后续结果。
- 三条 policy 全部声明允许来源、动作、Encounter、手动回合模式、最大步数、终局 token 和证据来源；缺 policy、错误来源、未知结果或歧义映射均 fail-closed。
- 正例、负例、存档恢复、文本插值和 6×200 局数值模拟通过；三条路线在 360×800、390×844、540×960 完成真实 Edge 人工功能验收，权威矩阵 126 步、0 failure，调参后梦魇额外复跑 42 步、0 failure。
- 已知 `FIRST_SESSION_SIMULATION_MISMATCH` 保持独立，不纳入本项 verdict。
- 这只关闭“3 条未授权 Combat Result”这个 P1 阻断；`COMBAT-002B`、`ASSET-007`～`ASSET-010`、`T05-01` 与发行门仍 blocked。
- 旧审计已同步：Result-token 316/316 为 P3，`runtime_result_token` issue=0；online-standard 剩余 11 P0 + 3 P1 仅属于资产、资产合同和人工视觉，并继续按设计非零退出。
- 证据：`COMBAT_005_RESULT_ROUTING_COMPLETION_20260809.md`、`COMBAT_005_MANUAL_VISUAL_ACCEPTANCE_20260809.md`、`outputs/combat/combat_result_routing_report.json`、`outputs/combat_simulation/combat_simulation_report.json`。

## 2026-08-09 最新变更严格复审与 SAVE-001 更新

- 对 `cc0ab085e3aa9a96c3884290fea0e5350ce968b7` 相对 `e04dfd3ca8bcb6ca7c3532803df07cd099d5a9d9` 的 34 个变更文件重新执行 Standards、Spec、focused runtime 和人工浏览器四层审计。
- 关闭战斗终局“配置 condition 但没有可执行分支仍清空 pending combat”、condition/result 双分发歧义、缺 combat content 仍接受、启动失败遗留 active session，以及拒绝事件伪报 pending side effect 等问题。
- 终局 condition 基数现在也是配置合同：通用 `compete` 允许 0 或 1 个当前满足分支，来源专属 Result 必须恰好 1 个；多满足分支和缺失必填分支均拒绝。两次全预检暴露的空 combat 审计夹具与普通切磋过严终局规则均已修复。
- `compare` 的失败/逃跑配置改为显式空后续结果；胜利、失败、逃跑不再依赖不存在的 `comparelose/comparerunaway` 分支。
- 最新三 Result × 三尺寸真实 Edge 证据位于 `outputs/combat_result_visual/audit_20260809_final_current/`：126 步、0 failure、0 console problem、0 横向溢出帧；18 张启动/终局截图已在最终配置基数上人工逐张检查。功能门通过，生产美术门仍失败。
- `SAVE-001`：**done**。v2 SaveEnvelope、迁移、校验和、staging/backup/rollback、损坏恢复、未来版本拒绝、写入中断和浏览器可见恢复均已验收。权威手册为 `SAVE_001_COMPLETION_AND_RECOVERY_RUNBOOK_20260809.md`。
- `OBS-001` 已完成并由 `OBS_001_COMPLETION_AND_DIAGNOSTIC_RUNBOOK_20260809.md` 接管权威说明。下一治理项是先裁决 `AUDIT-003` 的严格依赖，再施工 `HYGIENE-001`；`SEC-001`、`REL-001`～`REL-003` 依赖顺序不变。项目整体仍是 `RELEASE_BLOCKED`。
