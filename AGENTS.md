# AGENTS.md

This project is a data-driven wuxia idle RPG prototype built from competitor research, Python combat simulation, and Unreal Engine 5 implementation.

Current main prototype workspace:

```text
H:\MyProjectBack\idlewuxia
```

Primary workspace:

```text
G:\codex\武侠掌门放置挂机
```

## GitHub synchronization policy

Canonical repository: `https://github.com/hjklmn314/idlewuxia.git`.

- At the start of every task, run `git status -sb`. When the tree is clean,
  run `git pull --ff-only origin main` before reading or changing project
  files. If the tree is dirty or the pull cannot fast-forward, stop and report
  the exact state instead of stashing, resetting, rebasing, or overwriting
  user work.
- At the end of every task, run the relevant project validation, inspect
  `git status` and `git diff`, stage only files that belong to that task,
  create an intentional commit, and push the current branch to `origin`.
- Never use force push. Never stage `fangzhijianghu/`, `outputs/`, `www/`,
  generated Android assets/build folders, APKs, databases, competitor
  reference captures, generated media, caches, or unrelated local changes.
- The public repository contains development code, configuration, build
  scripts, native project text files, and related Markdown only. Local
  competitor evidence remains outside Git even when runtime configuration
  records its source paths.

Unreal project:

```text
H:\MyProjectBack\WuXiaProject
```

## 0. Current Working State - 2026-07-10 idlewuxia Data-Driven Predev Gate

This block supersedes older process notes whenever work targets the
`H:\MyProjectBack\idlewuxia` prototype. Future development must start from
evidence and config contracts before code or UI work.

- Chapters, maps, rooms, routes, NPCs, enemies, story text, rewards, gates,
  interactables, asset references, UI copy, and tuning values belong in JSON
  or generated data tables first. Code owns interpreters, routers, state
  machines, validation, rendering, and reusable module seams.
- Before adding a feature, inspect the active runtime files and the relevant
  restored competitor Lua/config rows. Record whether each conclusion is
  `lua_confirmed`, `config_confirmed`, `cross_source_confirmed`,
  `reverse_tested`, `design_proposal`, or `unknown`.
- Do not claim competitor parity from video layout alone. Recordings are
  UI/layout reference; competitor code/config is the behavior source.
- Do not hide unresolved competitor semantics by converting them to zero or
  arbitrary copy. Unknown mechanics stay in audit outputs until a Lua/config
  or reverse-test evidence row closes them.
- Do not put concrete IDs such as a specific chapter, NPC, reward, skill, Buff,
  or asset path into runtime code unless the code is a migration shim with an
  explicit audit reason.
- Mandatory current commands:
  `npm run task:preflight`,
  `npm run baseline:build`,
  `npm run wuxia:check:fast`,
  `npm run wuxia:predev:analysis`, and
  `npm run wuxia:tasks:skill-waterfall`.
- `config\project_scope.json` is the R0 source of truth for the active HTML
  entry, runtime configuration closure, development-only reference files,
  tracked path categories, and exact web shipping allowlist. Any new tracked
  path category or shipping file must be declared there in the same change.
- `config\android_identity_contract.json` is the only Android identity source
  of truth. Capacitor, Gradle, Java/test packages, Android string resources,
  mobile-shell validation, and APK audit must match it. Run
  `npm run android:identity` after any Android identity or path change.
- `npm run wuxia:validate:first-session:runtime` is the portable repository
  gate and must not require ignored competitor files. The existing
  `npm run wuxia:validate:first-session` remains the stronger development
  evidence gate on machines that hold the local evidence archive.
- Before a release push, run `npm run baseline:verify` on a clean tree. The
  generated baseline artifacts remain under ignored
  `outputs\project_baseline`; do not commit them.
- After pushing, run `npm run baseline:verify:remote` and confirm local HEAD
  equals the configured upstream commit.
- Current predev output:
  `outputs\wuxia_predev_analysis_package_20260710`.

### 2026-07-12 Role-Based Real-Browser Acceptance

- Browser acceptance is owned by explicit role contracts in
  `config\wuxia_browser_acceptance_role_agents.json`. The active roles are
  functional QA, interaction/condition QA, combat presentation QA, mobile
  UX/UI QA, competitor evidence QA, and release audit.
- Each role must run from `tools\run-wuxia-role-browser-acceptance.mjs
  --role <roleId>` and retain its own real 540x960 browser screenshots and
  `role_browser_acceptance_summary.json` under
  `outputs\role_browser_acceptance\<roleId>`. Role contracts are validated by
  `tools\validate-wuxia-browser-acceptance-role-agents.mjs`.
- Browser roles run serially. Concurrent Edge runs are invalid infrastructure
  evidence, not product failures or passes.
- Visual acceptance is exhaustive: generate
  `outputs\wuxia_visual_browser_inventory_20260712\visual_browser_acceptance_inventory.csv`
  from a real-browser deep route, then require UX/UI and art-direction review
  for every screenshot. An unreviewed screenshot is a release blocker; sample
  screenshots never certify the remaining screens.
- Do not report a release pass from a single deep route. The current
  completeness audit remains blocking until every visible FB01 action is
  browser-covered or intentionally hidden with Lua/config evidence.

### 2026-07-11 Interaction-State Regression Gate

- The reusable first-session runtime now interprets restored `门派等于/不等于`
  and `可传承玩家标记` conditions. It stores inheritable markers on the
  player model and renders unavailable NPC actions with their configuration
  requirement rather than silently accepting a fallback branch.
- Repeatable hangup actions must use
  `responseModel.taskCounterDeltas.completedClicks`; never place a fixed
  `completedClicks` value in `taskPatch`, because that resets repeated work.
- `mobileLayout` in `config\wuxia_first_session_screen_contract.json` is the
  source for portrait reference size, content width, touch minimum, and the
  four safe-area insets. `wuxia:validate:first-session` checks it together
  with `viewport-fit=cover`.
- Use the real-browser interaction regression after any work touching room
  navigation, task state, NPC action availability, or combat playback:
  `node tools\run-wuxia-real-browser-flow.mjs --scenario interaction-contract
  --out-dir outputs\wuxia_interaction_contract_<date>`.
  The 2026-07-11 result is 19 steps / 0 failures: repeated pool fishing is
  visibly `2` claims and `401/1000` experience; two same-direction gate exits
  have no overlapping DOM rectangles; the config timeline advances from two
  events with defender HP `100/100` to four events with `72/100`.
- This gate is local real-browser DOM/runtime regression only. It does not
  certify visual art quality or replace manual Android/iOS acceptance.

### 2026-07-10 Skill-Waterfall Architecture + Visible Combat Route

- Added project domain language in `CONTEXT.md` and the generated development
  framework package in
  `outputs\wuxia_development_framework_package_20260710`.
- The framework package contains current completion, module architecture,
  configuration, interaction, screen experience, art asset, competitor
  evidence, and next-task matrices. Its status is
  `framework_ready_product_blocked`, not product complete.
- Restored competitor combat ordering is now explicit:
  `compete -> pending combat -> result -> comparewin/failure/runaway branch`.
  `comparewin` must never evaluate true without combat-result context.
- The policy is data-driven through
  `chapterSystem.combatActionPolicies.compete`; runtime code interprets it
  without old-steward or chapter-specific IDs.
- Real browser acceptance:
  `outputs\skill_waterfall_acceptance_20260710_all_key_screens_visible_compete_v2`.
  Result: 16 visible steps, 0 failures, 0 automation dispatches, final state
  `STATE_FS_011_CHAPTER_LOOP_RETURN`.
- Current skill-waterfall gate result: 6 pass, 2 fail. The remaining failed
  gates are `GATE_PRODUCT_VISUAL_PARITY` and
  `GATE_COMBAT_PRODUCT_PRESENTATION`. Do not claim online/product readiness
  until every first-session screen has competitor evidence, target/actual
  540x960 captures, owned asset replacements, and no readability/layout
  blocker.
- Interaction evidence is now split correctly by scope in
  `outputs\wuxia_fb01_browser_interaction_crawl`: 358 imported action rows,
  218 with an fb01 room placement, and 140 outside the active fb01 room
  package. At the latest run, 27 of the 218 fb01 actions have real-browser
  click evidence, 1 has a verified route-blocked record, and 190 remain
  pending. Runtime direct preflight is explicitly diagnostic only and never
  counts as browser acceptance.
- The same crawl identifies 140 fb01 actions with `global_feedback_only` or
  no configured executor. These are not feature-complete merely because they
  show a button and log line; close them through evidence-backed, config-bound
  transaction/combat/modal executors or hide them by scoped configuration.
- The reusable real-browser runner now has an `entity-actions` scenario:
  `node tools\run-wuxia-real-browser-flow.mjs --scenario entity-actions
  --room-id <room> --entity-id <id> --entity-kind npc|interactable
  --interaction-actions <action>`. Run state-mutating actions in a fresh
  scenario, because a confirmed result may replace/hide the source entity.
- `tools\build-wuxia-fb01-browser-crawl-batches.mjs` derives visible room
  routes from the screen contract's `defaultRoomId` and room graph. The batch
  runner checks every hop against the rendered room ID; a configured
  `stop/gorome*` transition is recorded as `blocked_by_configured_route_gate`,
  never as a successful interaction click.
- `tools\\build-wuxia-fb01-route-unlock-plans.mjs` derives prerequisite chains
  for configured route gates. It distinguishes `executable_config_bound` from
  `reverse_tested_action_bound` and `action_binding_evidence_required`; do not
  promote a fallback runtime action into Lua evidence. The first plan is in
  `outputs\\wuxia_fb01_route_unlock_plans`: Zhao instructor activation uses a
  real-browser `talk -> fb01r02_1 visible` probe, while the two `comparewin`
  guard clears remain config/Lua-bound.
- The route-unlock runner has verified that same plan in one local browser
  session: `fb01r02_1b talk -> fb01r02_1 compete -> fb01r02_2 compete ->
  fb01_03`. Its final DOM state is `UI_MapExplore`, room `fb01_03`, with no
  failures. This is recorded as `routeUnlockFlowsPassed=1` separately from
  isolated action-click coverage; it is local browser automation evidence, not
  human manual acceptance.
- Still open: full fb01 real-browser interaction evidence, executor closure,
  owned art/motion/audio kit, product combat presentation, server login/sync
  and purchase verification adapters, output cache hygiene, and next-chapter
  config importer.

## 0. Current Working State - 2026-06-28 Chapter 1 ActionRouter Gate Bridge Real PIE Accepted

This block supersedes all earlier 2026-06-27 notes about FrontHall combat
attributes, runtime_slim's former built-in example active skills, and the
ungated login-to-chapter-one route. It also supersedes the earlier 2026-06-28
state where the progression gate package existed but UE/ClientRuntime did not
yet have an explicit ActionRouter bridge contract, UE SourceData sync, or real
PIE click-through acceptance.

- Updated tools:
  `tools\build_fb01_quest_and_front_hall_runtime_binding_20260627.py`,
  `tools\simulate_fb01_front_hall_runtime_binding_20260627.py`,
  `tools\simulate_combat_mvp.py`,
  `tools\build_login_to_chapter1_complete_flow_20260627.py`, and
  `tools\build_project_runtime_contract_index_20260627.py`.
- New chapter pacing tools:
  `tools\build_chapter1_progression_gate_package_20260628.py` and
  `tools\simulate_chapter1_progression_gate_20260628.py`.
- New ActionRouter bridge tools:
  `tools\build_chapter1_action_router_gate_bridge_20260628.py` and
  `tools\simulate_chapter1_action_router_gate_bridge_20260628.py`.
- New UE sync/audit tools:
  `tools\sync_chapter1_action_router_gate_bridge_to_ue_20260628.py` and
  `tools\audit_ue_chapter1_action_router_gate_sync_20260628.py`.
- New real PIE acceptance tools:
  `tools\build_ue_chapter1_gate_pie_acceptance_scripts_20260628.py` and
  `tools\audit_ue_chapter1_gate_pie_acceptance_20260628.py`.
- New chapter pacing package:
  `outputs\chapter1_progression_gate_package_20260628`.
- New ActionRouter bridge package:
  `outputs\chapter1_action_router_gate_bridge_20260628`.
- New evidence output:
  `outputs\fb01_quest_runtime_binding_20260627\front_hall_attribute_build_audit.csv`.
- FrontHall NPC combat attrs now use `config_curve_bound_partial_v1`:
  restored `PlayerAttr.lua` formula structure plus
  `battle_const.csv`, `base_skill_lv_attr_conf.csv`,
  `prep_skill_lv_attr_conf.csv`, `prep_skill_quality_conf.csv`, and
  `skill_res.csv`.
- Runtime duel no longer injects default `waveCrashingSand` /
  `BlazeRebirth` skills. Empty left/right active skill fields now mean no
  active skills. fb01 FrontHall smoke is driven by `jibenquanjiao` auto-zhao
  from chapter NPC skill slots.
- Latest FrontHall smoke:
  `status=pass`, `binding_status=curve_bound_partial`, `events=4`,
  `damage_events=1`, `warning_count=0`, winner=`right`, time=`2.1`.
- Latest login-to-chapter1 smoke:
  `status=pass`, `flow_count=24`, `binding_count=8`,
  `blocking_pending_count=1`, final state=`UI_EarlyCombat`.
- Latest chapter-one progression gate smoke:
  `status=pass`, `case_count=3`, `failure_count=0`.
  `exp=0` FrontHall attempt is blocked; after five task `10001` clicks the
  player has `1000` exp / `1000` pot and the minimum attempt gate passes; after
  ten clicks the player has `2000` exp / `2000` pot and the recommended-ready
  gate passes.
- Latest chapter-one ActionRouter gate smoke:
  `status=pass`, `case_count=2`, `failure_count=0`.
  `ACT_CH1_SELECT_NODE_FRONT_HALL` routes `exp=0` to `UI_IdleTaskList` through
  `ROUTE_CH1_FRONT_HALL_BLOCKED_TO_IDLE`, and routes `exp=1000` plus five
  task `10001` clicks to `UI_EarlyCombat`.
- ActionRouter bridge outputs:
  `4` action routes, `6` gate evaluator rows, and `9` focused-runtime-test
  fb01 QuestAction queue rows. The `9` low-confidence QuestActions are not
  main-flow blockers; they remain evidence/audit debt for focused dispatcher
  tests.
- UE SourceData sync:
  `outputs\chapter1_action_router_gate_bridge_20260628` was copied to
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\Chapter1ActionRouterGate`.
  `Config\WuxiaDemoContract.json` now has
  `chapter1_action_router_gate_bridge.relative_dir =
  Wuxia/SourceData/Chapter1ActionRouterGate`, and
  `level_flow.node_click_gate_mode = data_driven_action_router`.
- Latest UE SourceData sync audit:
  `outputs\ue_chapter1_action_router_gate_sync_20260628\ue_chapter1_action_router_gate_sync_summary.json`
  has `status=pass`, `error_count=0`, `routes=4`, `gates=6`,
  `low_confidence_queue_rows=9`.
- Latest real PIE gate and first-session acceptance:
  `outputs\ue_chapter1_gate_pie_acceptance_20260628\chapter1_gate_real_pie_acceptance_audit.json`
  has `status=pass`, `error_count=0`, `case_count=2`, and
  `first_session_case_count=2`.
  - `chapter1_gate_exp0_fixed`: real PIE selects `NODE_FB01_FrontHall`,
    hits `ROUTE_CH1_FRONT_HALL_SELECT` /
    `GATE_FB01_FRONT_HALL_BLOCK_NAKED_ATTEMPT`, blocks with
    `ERR_EXP_NOT_ENOUGH|ERR_CLICK_COUNT_NOT_ENOUGH`, and stays on `Map`.
  - `chapter1_gate_exp1000_fixed`: the same node/gate passes at
    `runtime_player_exp=1000` and routes to `UI_EarlyCombat` / `Combat`.
  - `first_session_to_fs008_map`: seven real PIE Enter inputs advance the
    data-driven first-session flow to `FS_008_MAP_EXPLORE` /
    `UI_MapExplore`, with `CmdSelectChapterNode` as the current server command.
  - `first_session_to_fs009_combat`: eight real PIE Enter inputs advance to
    `FS_009_EARLY_COMBAT` / `UI_EarlyCombat`, with `CmdStartCombatPreview`.
- UE C++ now contains a generic ActionRouter/GateEvaluator bridge in
  `AWuxiaLevelFlowInputActor`. It reads generated SourceData and writes PIE
  acceptance fields; it must remain generic. Concrete node ids, task ids,
  thresholds, and target screens belong in CSV/JSON or authored UE assets.
- Top-level runtime contract index:
  `status=pass`, `11` contracts, `error_count=0`.
- Validators passed:
  `fb01_quest_runtime_binding` `6 checks / 0 errors`,
  `login_to_chapter1_complete_flow` `21 checks / 0 errors`,
  `chapter1_progression_gate_package` `34 checks / 0 errors`,
  `chapter1_action_router_gate_bridge` `36 checks / 0 errors`,
  `project_runtime_contract_index` `14 checks / 0 errors`.
- Honest remaining blocker:
  `PARTIAL_FRONT_HALL_RUNTIME_SLIM_BINDING` now means equipment, meridian,
  normal/battle buffs, exact NPC-only overrides, and any chapter-specific
  active-zhao evidence are still missing. It no longer means base/prep
  attribute curves are absent.
- Flow implication:
  A level-1 player loses immediately to the level-15 FrontHall NPC under the
  restored curve-bound stats. Chapter-one progression must therefore gate or
  pace the player through idle/quest growth before this challenge. The new
  progression gate package encodes that as client-config runtime data. The
  `1000` / `2000` exp FrontHall gates are project pacing policies until the
  exact exp-to-level, skill-upgrade, equipment, meridian, and buff chains are
  restored and reverse-tested.
- UE implication:
  Concrete node ids, gate ids, ViewModel bindings, VisualCue ids, and request
  payloads now live in generated CSV/JSON. UE C++ should implement only a
  generic ActionRouter/GateEvaluator and should not hardcode `NODE_FB01_FrontHall`,
  task `10001`, or the `1000` / `2000` exp thresholds.
- Honest UE limitation:
  Functional real PIE click-through is accepted, but visual quality is still
  prototype-level. `FS_008_MAP_EXPLORE` and `FS_009_EARLY_COMBAT` are readable
  and data-driven, yet not product-grade art direction: final CommonUI skin,
  high-fidelity unit presentation, Niagara hit/jump-text polish, audio, and
  market-quality transitions are still pending.

### 2026-06-28 V5 Chapter-One Map/Combat UI Polish

- New generator:
  `tools\build_ue_first_session_screen_layout_v5_chapter1_polish_20260628.py`.
- New audit:
  `tools\audit_ue_first_session_v5_chapter1_polish_20260628.py`.
- Generated package:
  `outputs\ue_first_session_screen_layout_v5_chapter1_polish_20260628`.
- Synced UE SourceData:
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout`.
- This was a data-only UI/layout update. No C++ changed, so UBA build was not
  required for this pass.
- V5 replaced only `UI_MapExplore` and `UI_EarlyCombat`; the other nine
  first-session screens remain from the prior V4 package.
- Real PIE outputs:
  `outputs\ue_first_session_v5_chapter1_polish_pie_20260628`.
- Latest V5 visual/runtime audit:
  `outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_chapter1_polish_audit.json`
  has `status=pass`, `error_count=0`.
- `FS_008_MAP_EXPLORE` now shows a clearer portrait chapter map: chapter title,
  route panel, node states, selected-node detail, explicit gate text, reward
  preview, and primary entry action.
- `FS_009_EARLY_COMBAT` now shows a clearer early-combat presentation: unit
  plates, HP/MP bars, Buff slots, unit placeholders, impact line, damage jump
  text, skill banner, event text, and recover/flee actions.
- Honest remaining limitation: V5 is still built from data-driven
  Border/TextBlock/Button primitives, not final CommonUI art assets, authored
  materials, Niagara systems, animations, audio, or real character models.
  It is a better functional/visual acceptance baseline, not final product art.

## 0. Historical State - 2026-06-27 fb01 NPC Interaction Runtime Smoke Added

This block supersedes the earlier state that only generated the fb01 NPC
interaction adapter.

- New package:
  `outputs\fb01_npc_interaction_runtime_20260627`.
- New tool:
  `tools\simulate_fb01_npc_interaction_runtime_20260627.py`.
- The runtime smoke executes restored fb01 branch result bundles through:
  `NpcInteractionAction -> QuestActionResolver -> ClientRuntimeState`.
- Exhaustive resolver trace:
  `109` fb01 branch routes traced, `0` execution errors.
- Smoke cases:
  `4` cases, `4` pass:
  `SMOKE_FB01_GATE_TALK`, `SMOKE_FB01_FRONT_HALL_COMPAREWIN`,
  `SMOKE_FB01_GIFT_REWARD`, and `SMOKE_FB01_SKILL_PROGRESS`.
- Smoke final state demonstrates actual state deltas:
  `map_flags=1`, `npc_states=3`, `inventory=1`, `attributes=2`,
  `skill_progress=1`, `narrative=4`.
- All-branch warnings: `18`. These are not execution failures. They are
  explicit evidence gaps for `bainian` / `bainianweituo` / `zhengji*`
  runtime semantics and non-numeric item/crafting deltas such as
  `hecheng114 -> chunjie20celue`.
- `outputs\login_to_chapter1_complete_flow_20260627` was rebuilt. It now has
  `pending_binding_rows=4`, `blocking_pending_rows=1`; the info row is
  `INFO_FB01_NPC_INTERACTION_RUNTIME_SMOKE`.
- Top-level runtime contract index now has `9` contracts and includes
  `fb01_npc_interaction_runtime`; audit has `error_count=0`.
- Validators passed:
  `fb01_npc_interaction_runtime` `4 checks / 0 errors`,
  `login_to_chapter1_complete_flow` `21 checks / 0 errors`,
  `project_runtime_contract_index` `12 checks / 0 errors`.
- Honest limitation: UE/ClientRuntime has not yet consumed these runtime tables.
  Do not claim the in-engine UI/action router is complete until the same tables
  are synced into UE and a real action-router smoke passes.
- Remaining blocking gap from that run was superseded on 2026-06-28 by
  `config_curve_bound_partial_v1`; see the current state block above for the
  narrower remaining equipment/meridian/buff/NPC override gap.
- Report:
  `本轮推进报告_fb01NPC交互运行时与完整流程回写_20260627.md`.

## 0. Historical State - 2026-06-27 fb01 NPC Interaction Adapter and Basic Auto-Zhao FrontHall Binding Added

This block supersedes the earlier state that only had fb01 QuestAction
semantics and a FrontHall active-skill smoke.

- New package:
  `outputs\fb01_npc_interaction_adapter_20260627`.
- New tool:
  `tools\build_fb01_npc_interaction_adapter_20260627.py`.
- The adapter maps `116` restored fb01 NPC role/base rows into `322`
  interaction actions and `109` condition/result branches.
- Branch result references now link to QuestAction semantics with
  `missing_result_ref_count=0`. The important implementation detail is that
  NPC branches use short result IDs such as `text27`, while
  `chapter1_results.csv` rows use `rlt_text27`; the adapter indexes both.
- Interaction counts:
  `Talk=108`, `Present=79`, `Compete=66`, `Kill=60`, `Sale=2`,
  `Apprentice=3`, `PassiveOrStateOnly=4`.
- FrontHall runtime_slim binding no longer uses unrelated example active skills.
  `left_active_skills` and `right_active_skills` are empty because basic
  fb01 skills have no active_zhao evidence. The duel is now driven by
  `jibenquanjiao` auto_zhao from the NPC skill slots.
- FrontHall smoke still passes:
  `outputs\fb01_quest_runtime_binding_20260627\front_hall_runtime_smoke_summary.json`
  has `status=pass`, `events=8`, `damage_events=5`, `warning_count=0`;
  the event trace includes `jibenquanjiao1/2/3/4` auto_zhao events.
- `outputs\login_to_chapter1_complete_flow_20260627` was rebuilt and now has
  `pending_binding_rows=4`, `blocking_pending_rows=1`; the remaining blocker
  is still `PARTIAL_FRONT_HALL_RUNTIME_SLIM_BINDING`.
- Top-level runtime contract index now has `8` contracts and includes
  `fb01_npc_interaction_adapter`; audit has `error_count=0`.
- Validators passed:
  `fb01_quest_runtime_binding` `7 checks / 0 errors`,
  `fb01_npc_interaction_adapter` `7 checks / 0 errors`,
  `login_to_chapter1_complete_flow` `19 checks / 0 errors`,
  `project_runtime_contract_index` `11 checks / 0 errors`.
- Historical limitation superseded on 2026-06-28: FrontHall NPC attrs now use
  restored PlayerAttr/base-prep curve evidence, with equipment/meridian/buff
  channels still explicitly missing.
- Report:
  `本轮推进报告_fb01NPC交互适配与基础拳脚战斗绑定_20260627.md`.
- Next closures from this historical block were partly completed by the
  2026-06-28 curve-bound attribute pass.

## 0. Historical State - 2026-06-27 fb01 Quest Semantics and FrontHall Runtime Binding Added

This block supersedes the earlier 2026-06-27 note that still treated
`PENDING_FRONT_HALL_RUNTIME_SLIM_BINDING` and
`PENDING_FB01_RESULT_SEMANTIC_OTHER` as unaddressed blockers.

- New package:
  `outputs\fb01_quest_runtime_binding_20260627`.
- New tools:
  `tools\build_fb01_quest_and_front_hall_runtime_binding_20260627.py` and
  `tools\simulate_fb01_front_hall_runtime_binding_20260627.py`.
- `fb01` result semantics now map `421` result rows into explicit
  `QuestActionType` values. The previous `127` broad `other` rows are no
  longer unmapped; `UnknownQuestAction=0`.
- `9` low-confidence/special rows still require focused runtime tests. Do not
  present these as fully reverse-engineered competitor dispatcher behavior.
- `ENC_FB01_FrontHallTrial` now has an executable partial `runtime_slim` input
  under
  `outputs\fb01_quest_runtime_binding_20260627\runtime_slim_mirror_input`.
- FrontHall smoke passed:
  `outputs\fb01_quest_runtime_binding_20260627\front_hall_runtime_smoke_summary.json`
  has `status=pass`, `events=8`, `damage_events=5`, `warning_count=0`.
- Historical limitation superseded on 2026-06-28: combat attrs now use
  `config_curve_bound_partial_v1`, and runtime_slim duel mode no longer
  injects default active skills for empty chapter skill fields.
- `outputs\login_to_chapter1_complete_flow_20260627` was rebuilt. It now has
  `pending_binding_rows=4` and `blocking_pending_rows=1`; the remaining blocker
  is `PARTIAL_FRONT_HALL_RUNTIME_SLIM_BINDING`.
- Top-level runtime contract index now has `7` contracts and includes
  `fb01_quest_runtime_binding`; audit has `error_count=0`.
- Validators passed:
  `fb01_quest_runtime_binding` `7 checks / 0 errors`,
  `login_to_chapter1_complete_flow` `17 checks / 0 errors`,
  `project_runtime_contract_index` `10 checks / 0 errors`.
- Report:
  `本轮推进报告_fb01语义与前厅战斗绑定_20260627.md`.
- Next closures from this historical block were narrowed on 2026-06-28 to
  equipment/meridian/buff/NPC override inputs plus the `9` QuestAction rows
  that still require focused runtime validation.

## 0. Current Working State - 2026-06-27 Login-To-Chapter1 Complete Flow Contract Added

This block supersedes any workflow that treats first-session UI demo data as
the whole product flow.

- New data-driven package:
  `outputs\login_to_chapter1_complete_flow_20260627`.
- New tools:
  `tools\build_login_to_chapter1_complete_flow_20260627.py` and
  `tools\simulate_login_to_chapter1_complete_flow_20260627.py`.
- The package joins account/session login, first-session recorded route,
  hangup task/reward, fb01 room graph, fb01 role/base data, fb01
  condition/result rows, and chapter-one mainline gates.
- Recording evidence is interaction-order evidence only. Restored Lua/config is
  the gameplay source of truth.
- Generated counts: `24` state-flow rows, `8` data bindings, `11` UI states,
  `6` competitor code/config modules, `4` pending audit rows.
- Smoke passed:
  `outputs\login_to_chapter1_complete_flow_20260627\smoke\login_to_chapter1_smoke_summary.json`
  has `status=pass`, `flow_count=24`, `binding_count=8`,
  `server_login_present=true`, and `server_gameplay_api_used=false`.
- Planning validator passed with `15 checks / 0 errors`.
- Top-level runtime contract index now has `6` contracts and includes
  `login_to_chapter1_complete_flow`; validator passed with `9 checks / 0 errors`.
- Honest blocking gaps for "fully replicate competitor flow":
  `PENDING_FRONT_HALL_RUNTIME_SLIM_BINDING` and
  `PENDING_FB01_RESULT_SEMANTIC_OTHER`.
- Do not claim complete competitor replication until
  `ENC_FB01_FrontHallTrial` has real runtime_slim battle input and the `127`
  broad `other` fb01 result rows are mapped to evidence-backed QuestAction
  semantics.
- Report:
  `本轮推进报告_登录到第一章完整流程契约_20260627.md`.

## 0. Current Working State - 2026-06-27 Server Validation and Purchase Boundary Added

This block supersedes any older note implying that the current server should
calculate gameplay, rewards, combat, skills, Buffs, or UI state.

- Server validation is required, but the current boundary is account/security/
  sync/purchase only.
- Allowed server APIs in the new contract:
  `Login`, `RefreshSession`, `SyncSave`, `SyncCheckpoint`, `VerifyPurchase`,
  and `QueryEntitlements`.
- Explicitly rejected APIs in the current architecture:
  `GameplayResolveReward` and `GameplaySimulateCombat`.
- Purchase validation is server-authoritative. The client must send platform,
  product, transaction, receipt, and client order data to `VerifyPurchase`; only
  the server may grant paid entitlements after receipt verification and
  idempotency ledger checks.
- Generated package:
  `outputs\server_validation_purchase_contract_20260627`.
- Smoke passed:
  `outputs\server_validation_purchase_contract_20260627\purchase_validation_smoke\purchase_validation_summary.json`
  has `status=pass`, `case_count=5`, `failure_count=0`, `granted_count=1`,
  `rejected_count=3`, `already_granted_count=1`, and
  `server_does_not_decide_gameplay=true`.
- First-session map route was fixed in
  `tools\build_first_session_mvc_ue5_package_20260626.py`. `FS_008_MAP_EXPLORE`
  now selects `NODE_FB01_FrontHall`, the first available combat node, instead of
  entering combat from story node `NODE_FB01_Gate`.
- Client runtime smoke now reports `warning_count=0`; selected combat source is
  `NODE_FB01_FrontHall`, `NodeType=Combat`,
  `EncounterId=ENC_FB01_FrontHallTrial`.
- Top-level runtime contract index is generated at
  `outputs\project_runtime_contract_index_20260627`. It registers
  `login_to_chapter1_complete_flow`, `first_session_mvc_ue5`,
  `competitor_config_flow_spine`, `hangup_award_class_index`,
  `client_runtime_sync`, and `server_validation_purchase`.
- Project runtime contract index audit passed with `contract_count=6`,
  `server_api_count=8`, and `error_count=0`; planning validator passed with
  `9 checks / 0 errors`.
- Report:
  `本轮推进报告_Server校验购买与首局路由修复_20260627.md`.
- Next required closures: expose `VerifyPurchase`/`QueryEntitlements` through a
  data-driven account/shop ViewModel, finish `fb01` NPC condition/result/reward
  parsing, and replace `runtime_slim_pending_binding` for
  `NODE_FB01_FrontHall` with a real runtime_slim battle input.

## 0. Current Working State - 2026-06-27 Real PIE Acceptance Chain Fixed

This block supersedes the 2026-06-26 note that real PIE automation could not
start PIE.

- `tools\run_ue_real_pie_screenshot.py` now waits for a fresh editor-ready
  AssetRegistry log marker before pressing `Alt+P`.
- The window fallback no longer accepts a Windows File Explorer window merely
  because its title contains `WuXiaProject`; it requires an Unreal/虚幻 editor
  title as well.
- Post-PIE key/click actions now run in normal LogPlayLevel-verified PIE mode,
  not only in `--require-pie-report` mode.
- Real PIE start capture passed:
  `outputs\first_session_real_pie_start_fix_20260627_r3\first_session_ready_gate_r3_summary.json`,
  `status=ok`, `verified_by=LogPlayLevel`, screenshot
  `first_session_ready_gate_r3_real_pie.png`.
- Real PIE Space input advanced the first-session flow:
  `outputs\first_session_real_pie_key_flow_20260627\first_session_space_advance_real_pie.png`
  shows the second screen, and runtime state reached `FS_002_TITLE_START`.
- Real PIE multi-step input advanced to the task screen:
  `outputs\first_session_real_pie_multistep_20260627\first_session_space_4_steps_real_pie.png`.
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowRuntime_20260626.json`
  reports `current_step_id=FS_005_IDLE_TASK_LIST`,
  `current_screen_id=UI_IdleTaskList`, and
  `current_server_command=CmdClaimIdleReward`.
- Real PIE first-chapter flow now reaches:
  - `FS_007_CHAPTER_CARD_ENTRY` with screenshot
    `outputs\first_session_real_pie_chapter_entry_20260627\first_session_space_6_steps_real_pie.png`;
  - `FS_008_MAP_EXPLORE` with screenshot
    `outputs\first_session_real_pie_map_explore_20260627\first_session_space_7_steps_real_pie.png`;
  - `FS_009_EARLY_COMBAT` with screenshot
    `outputs\first_session_real_pie_early_combat_20260627\first_session_space_8_steps_real_pie.png`.
- Honest scope: the real PIE validation chain is now usable, but current
  first-session visuals are still scaffold-quality flat UI. Do not claim
  product-grade CommonUI/art/animation quality until fresh real PIE captures
  show the final authored UI, transitions, first-chapter node screen, and
  EarlyCombat presentation.

## 0. Current Working State - 2026-06-26 FirstSession ViewModel Binding Runtime Connected

This block supersedes earlier first-session UI/runtime claims when they
conflict.

- `UWuxiaFirstSessionRootWidget` now loads the generated ViewModel binding CSV
  from the MVC/UE5 contract package instead of treating the first-session UI as
  only a static generated layout.
- Source data:
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionMVCUE5\first_session_view_model_binding.csv`.
  Current binding count: `52`.
- The binding path is resolved from
  `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json`
  `first_session.mvc_ue5_relative_dir` and
  `first_session.mvc_ue5_view_model_binding_file`.
- The root widget runtime report now includes loaded binding count, active
  binding count, resolved ViewModel fields, and unresolved binding count:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionRootWidgetRuntimeLayout_20260626.json`.
- Latest commandlet smoke:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionRuntimeLayoutSmoke_20260626.json`
  has `status=pass`, `generated_widget_count=6`,
  `loaded_view_model_binding_from_csv=true`, `view_model_binding_count=52`,
  `active_view_model_binding_count=3`, and
  `unresolved_view_model_binding_count=1`.
- UBA build passed for this change:
  `WuXiaProjectEditor Win64 Development ... -NoLiveCoding -WaitMutex -NoHotReloadFromIDE -UBA`,
  `Result: Succeeded`, `6` actions.
- Hardcode scan on the changed RootWidget runtime files and smoke script found
  no concrete content IDs matching
  `FS_00*`, `Cmd*`, `VCUE_*`, `Ally_01`, `Enemy_01`, or fixed runtime combat
  case IDs.
- A real PIE screenshot automation attempt was made at
  `outputs\first_session_viewmodel_binding_real_pie_20260626`, but it failed:
  the editor opened and loaded the map, yet the log proves PIE never started.
  This is not accepted as visual validation.
- Honest scope: this is a data-contract/runtime-binding closure. It is not
  product-grade CommonUI/UMG skin, real PIE visual acceptance, Niagara jump
  text completion, or first-chapter playable presentation completion. Real PIE
  visual acceptance remains mandatory before claiming the user-facing flow is
  done.

## 0. Current Working State - 2026-06-26 FirstSession MVC Runtime Connected

This block supersedes earlier first-session claims when they conflict.

- The FirstSession MVC/UE5 source package is generated at
  `outputs\first_session_mvc_ue5_contract_20260626` and synced into the UE
  project at
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionMVCUE5`.
- `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json` points
  `first_session.mvc_ue5_relative_dir` to `Wuxia/SourceData/FirstSessionMVCUE5`
  and declares the action route, server command, ViewModel binding, VisualCue,
  presentation, and acceptance files.
- UE C++ now prefers the MVC/UE5 contract in `AWuxiaFirstSessionFlowActor`.
  It reads `first_session_mvc_ue5_contract.json`, builds Step/Screen snapshots
  from `primary_flow`, reads `first_session_action_route.csv`, and advances via
  `ActionId -> ServerCommand -> NextStep` instead of only legacy linear
  `AdvanceStep`.
- UBA build passed after this runtime change:
  `Build.bat WuXiaProjectEditor Win64 Development ... -NoLiveCoding -WaitMutex -NoHotReloadFromIDE -UBA`.
  UBT reported `Unreal Build Accelerator local executor`, 29 actions, and
  `Result: Succeeded`.
- UE commandlet smoke passed:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowSmoke_20260626.json`
  has `status=pass`, `schema=wuxia.first_session.mvc_ue5_contract.v1`,
  `step_count=11`, and `screen_count=11`.
- Runtime report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowRuntime_20260626.json`
  has `route_count=11`, `granted_state_count=5`, current step
  `FS_005_IDLE_TASK_LIST`, current action
  `ACT_FS_005_IDLE_TASK_LIST_TAP_CLAIM_OR_BACK`, and server command
  `CmdClaimIdleReward`.
- Hardcode scan on the changed FirstSession C++ sources found no concrete
  content IDs such as `FS_00*`, `UI_*`, `Cmd*`, `VCUE_*`, `Ally_01`,
  `Enemy_01`, or fixed runtime combat case IDs. Content is coming from
  CSV/JSON.
- Honest scope: this is now an executable data-driven first-session runtime
  route, not final product visual quality. Real PIE visual acceptance still
  must be rerun after ViewModel binding, CommonUI styling, EarlyCombat unit HUD,
  Buff icons, Niagara jump text, and first-chapter node detail are connected.

## 0. Current Working State - 2026-06-26 FirstSession MVC/UE5 Contract Synced

This block supersedes any claim that the first-session flow is only a static
`AdvanceStep` page sequence.

- Project skills from `G:\codex\codex-skill-pack` are now installed under
  `C:\Users\kallery\.codex\skills` and should be used for this project:
  `wuxia-game-planning`, `wuxia-system-design`, `wuxia-ux-ui-design`,
  `wuxia-art-direction`, `wuxia-packaging-design`,
  `wuxia-combat-presentation`, `wuxia-ue5-implementation-qa`, and
  `wuxia-project-automation`.
- New G-side contract package:
  `outputs\first_session_mvc_ue5_contract_20260626`.
  It converts the competitor-recorded first-session flow, the 7-node chapter-one
  package, and the V4 screen layout into data-driven MVC/server/client inputs.
- Generated files include:
  `first_session_mvc_ue5_contract.json`,
  `first_session_action_route.csv`,
  `first_session_server_command.csv`,
  `first_session_view_model_binding.csv`,
  `first_session_visual_cue_contract.csv`,
  `first_session_ue5_presentation_contract.csv`,
  `first_session_acceptance_gate.csv`,
  `first_session_model_state_schema.csv`,
  `first_session_chapter1_level_nodes.csv`, and `evidence_registry.csv`.
- Counts: `11` first-session steps, `7` chapter-one nodes, `11` action routes,
  `11` server commands, `52` ViewModel bindings, and `14` VisualCue rows.
- Data-level validation passed:
  planning validation `status=ok`, `21` checks, `0` errors;
  server-flow smoke `status=pass`, `11` trace rows, `0` hard failures;
  contract audit `status=pass`, `86` checks, `0` errors, `0` warnings.
- UE sync is applied to:
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionMVCUE5`.
  `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json` now points
  `first_session.mvc_ue5_relative_dir` to
  `Wuxia/SourceData/FirstSessionMVCUE5` and includes the action route, server
  command, ViewModel binding, VisualCue, presentation, and acceptance file
  names.
- Important honest scope: this is a source-data/architecture contract and
  deterministic server-flow smoke, **not** final product visual completion.
  UE still needs a generic ActionRouter, prototype server-command adapter,
  ViewModel-driven CommonUI binding, VisualCue/Niagara lookup, and fresh real
  PIE acceptance after those are consumed.
- Do not ship or reuse competitor art directly. Competitor frames remain
  internal evidence for flow, hierarchy, pacing, and interaction only.

## 0. Current Working State - 2026-06-25 Competitor First-Session Recording Package

This block supersedes any vague "first session / chapter one is playable" claims
when they conflict.

- The 2026-06-24 competitor recording was sampled at 1 fps through Windows Media
  Player foreground capture after browser/video decoding proved unreliable.
  Evidence frames are stored under:
  `outputs\competitor_recording_flow_20260625\wmp_frames_1fps`.
- The recording flow has been converted into a data package:
  `outputs\competitor_recording_first_session_package_20260625`.
  Current counts are: `11` evidence flow rows, `11` first-session steps, `10`
  UI states, `4` idle-task seed rows, `2` chapter-card rows, and `7`
  acceptance rows.
- UE source data has been synced to:
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionCSV`.
  Synced files are `DT_FirstSessionStepSeed.csv`,
  `DT_FirstSessionUiStateSeed.csv`, `DT_FirstSessionIdleTaskSeed.csv`,
  `DT_FirstSessionChapterCardSeed.csv`,
  `DT_FirstSessionAcceptanceSeed.csv`, and
  `first_session_runtime_package.json`.
- `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json` now has a
  `first_session` block with schema
  `wuxia.first_session.recording_package.v1`,
  `active_step_id=FS_001_OPENING_STORY`,
  `active_start_state=UI_OpeningStory`,
  `source_data_relative_dir=Wuxia/SourceData/FirstSessionCSV`,
  `requires_widget_binding=true`, and
  `requires_real_pie_acceptance=true`.
- Important scope: this is a recording-evidence and source-data handoff, **not**
  a UE product-flow completion. UE still needs a FirstSession loader/row schema,
  CommonUI/UMG state binding, map/status/task/card/combat routing, and real PIE
  acceptance from opening story to early combat.
- 2026-06-25 follow-up: `tools\build_competitor_recording_first_session_package.py`
  was fixed to add the missing `UI_ChapterLoop` state. The package now validates
  with `11` flow steps and `11` UI states. The corrected FirstSessionCSV was
  synced into H:
  `DT_FirstSessionStepSeed.csv=11`,
  `DT_FirstSessionUiStateSeed.csv=11`,
  `DT_FirstSessionIdleTaskSeed.csv=4`,
  `DT_FirstSessionChapterCardSeed.csv=2`,
  `DT_FirstSessionAcceptanceSeed.csv=7`.
- New G-side validation and binding tools:
  `tools\validate_first_session_package.py`,
  `tools\build_ue_first_session_binding_package.py`, and
  `tools\sync_first_session_binding_package_to_ue.py`.
  Current binding output is:
  `outputs\ue_first_session_binding_20260625`.
- Binding sync is **not yet applied to H**. The generated H-sync step was blocked
  by current Codex approval/usage limits. Therefore
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionBinding`
  and `Content\Python\validate_wuxia_first_session_source_data.py` may still be
  absent until the sync command can run successfully. Do not claim FirstSession
  CommonUI binding is present in UE.
- 2026-06-26 continuation: binding sync is now applied to H and validated.
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionBinding`
  contains `first_session_state_machine.csv`,
  `first_session_transition_matrix.csv`,
  `first_session_commonui_screen_contract.csv`, and
  `first_session_ue_binding_contract.json`.
  `H:\MyProjectBack\WuXiaProject\Content\Python\validate_wuxia_first_session_source_data.py`
  exists and reports `status=pass`.
- New FirstSession runtime scaffold compiled with UBA:
  `AWuxiaFirstSessionFlowActor`, `UWuxiaFirstSessionRootWidget`, and
  `FWuxiaFirstSession*Snapshot` structs. The actor reads
  `WuxiaDemoContract.json -> first_session -> binding_relative_dir /
  binding_contract_file`, then loads `first_session_ue_binding_contract.json`.
  It does not hardcode specific story, task, chapter-card, or combat content in
  C++.
- `create_wuxia_first_session_flow_runtime.py` created `12` Widget Blueprint
  shells under `/Game/Wuxia/UI/FirstSession` and placed
  `FS_FirstSessionFlowController` in `/Game/Wuxia/Maps/L_LevelFlowDemo`.
- `smoke_wuxia_first_session_flow_runtime.py` passed. Evidence:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowSmoke_20260626.json`.
  It verifies `flow_actor_count=1`, JSON load succeeds, `step_count=11`,
  `screen_count=11`, and runtime advances from `FS_001_OPENING_STORY` through
  `FS_005_IDLE_TASK_LIST`.
- Important scope update: this is **compiled runtime/data smoke**, not final PIE
  visual/product acceptance. The generated Widget Blueprints are shells; they
  still need authored CommonUI layouts, mobile visual design, and real PIE
  player-flow validation.
- 2026-06-26 continuation: FirstSession screen-specific layout v2 is now synced
  to UE at
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout`.
  It contains `first_session_screen_layout_contract.json`,
  `first_session_screen_layout_widgets.csv`, and `manifest.json`.
  Counts: `11` recording-driven screens, `127` generic widget rows.
- `UWuxiaFirstSessionRootWidget` is now a generic JSON layout interpreter for
  FirstSession screens. It reads
  `WuxiaDemoContract.json -> first_session -> layout_relative_dir /
  layout_contract_file`, filters rows by `CurrentScreenId`, and rebuilds the
  visible `CanvasPanel` children. C++ must remain generic here: no concrete
  first-session copy, action-label mapping, skill IDs, unit IDs, node IDs, or
  final art paths.
- UBA build passed after the v2 runtime change:
  `Build.bat WuXiaProjectEditor Win64 Development ... -UBA`.
- Real floating PIE evidence, not commandlet/offline render:
  `outputs\ue_first_session_screen_layout_v2_pie_fix_20260626`.
  Verified steps:
  `FS_005_IDLE_TASK_LIST` (`UI_IdleTaskList`),
  `FS_008_MAP_EXPLORE` (`UI_MapExplore`), and
  `FS_009_EARLY_COMBAT` (`UI_EarlyCombat`).
  Latest H-side reports:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowRuntime_20260626.json`
  and
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionRootWidgetRuntimeLayout_20260626.json`.
- Current honest scope: this is a data-driven, real-PIE-playable first-session
  shell from opening/story through idle task and first chapter entry. It is not
  yet product-grade art. The gray map/stage background and placeholder combat
  blocks must be replaced by project-owned vertical mobile UI art, authored
  CommonUI widgets, unit-bound combat presentation, and real visual assets.
- 2026-06-26 V3 update: FirstSession layout now uses
  `wuxia.ue.first_session.screen_layout.v3` from
  `outputs\ue_first_session_screen_layout_v3_competitor_flow_20260626`, synced
  to the same UE `FirstSessionScreenLayout` folder. It uses a 1080x1920 logical
  canvas to compensate the current PIE DPI scale and render full-screen in the
  540x960 floating PIE window. Counts: `11` screens, `138` rows, `11`
  data-driven `Button` rows with `Interaction=AdvanceStep`.
- Mouse interaction policy is tightened: while `UWuxiaFirstSessionRootWidget`
  exists, actor-level global left-click advance is disabled; mouse advance must
  come from JSON-created Button hit zones. Keyboard Space/Enter remains for QA.
- V3 real PIE evidence:
  `outputs\ue_first_session_screen_layout_v3_pie_20260626`.
  Verified:
  `first_session_v3_step5_fullscreen_real_pie.png`,
  `first_session_v3_step8_map_spacing_fix_real_pie.png`, and
  `first_session_v3_click_to_title_real_pie.png`. The click test advanced from
  `FS_001_OPENING_STORY` to `FS_002_TITLE_START` through a data-driven Button.
- 2026-06-26 V4 quality update: FirstSession layout now uses
  `wuxia.ue.first_session.screen_layout.v4_premium`, generated from
  `tools\build_ue_first_session_screen_layout_v4_premium_20260626.py`.
  It keeps the competitor recording sequence but upgrades presentation with
  project-owned vertical mobile UI composition: chapter node cards, selected
  node detail, reward preview, clearer title/task/combat-entry structure, and
  data-driven Button hit zones.
- V4 UE source data is synced to
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout`.
  Counts: `11` screens, `218` widget rows.
- Runtime C++ remains generic. Latest hardcode audit over
  `UWuxiaFirstSessionRootWidget` and `AWuxiaFirstSessionFlowActor` has no hits
  for concrete action IDs, unit IDs, skill IDs, runtime-slim case IDs, or
  screen copy such as `前厅试手` / `池边打鱼` / `武侠掌门`.
- V4 real PIE evidence:
  `outputs\ue_first_session_screen_layout_v4_premium_pie_20260626`.
  Verified:
  `first_session_v4_map_real_pie.png`,
  `first_session_v4_combat_entry_real_pie.png`, and
  `first_session_v4_click_to_title_real_pie.png`.
  The click test advanced to `FS_002_TITLE_START` through data-driven Button
  rows. Lightweight visual audit passed:
  `outputs\first_session_v4_visual_quality_audit_20260626\visual_quality_audit.json`.
- Do not use competitor frames or art as shippable content. They are internal
  evidence for flow, pacing, UI state, and implementation requirements only.

## 0. Current Working State - 2026-06-24 UE Chapter 1 LevelFlow Synced

This block supersedes older first-chapter / LevelFlow sync status lines when
they conflict.

- `outputs\fzjh_chapter1_vertical_package_20260623` is now synced into the UE
  project source-data folder:
  `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\LevelSeedCSV`.
- `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json` now points
  LevelFlow at `CH_FZJH_FB01`, keeps the boss node configured as
  `NODE_FB01_ZhangFeng`, and fixes the runtime-slim playback label to
  `LVNODE_NODE_FB01_ZhangFeng`.
- Default real PIE now starts on the map: `auto_request_preview_on_begin_play`
  is `false` and `expected_view` is `Map`. Click `张风挑战` / use the input
  flow to enter combat; do not use an automatic combat jump as the normal
  human-acceptance entry.
- UE commandlet import/build/smoke passed after the sync:
  `import_wuxia_level_seed_content.py`,
  `create_wuxia_level_flow_demo.py`, and
  `smoke_wuxia_level_flow_demo.py`.
- Fixed timeline application evidence:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFixedBattleTimelineApply_20260620.json`.
  It reports `case_id=RuntimeSlim_WaveVsNpc10_seed20260619`,
  `fixed_playback_actor=AC_LevelFlow_FixedCombatPlayback`, `event_count=44`,
  and `fixed_node=LVNODE_NODE_FB01_ZhangFeng`.
- Latest smoke evidence:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaLevelFlowSmoke_20260617.json`.
  After applying the fixed timeline it reports `node_count=7`, `edge_count=8`,
  `nodes_with_combat_playtest=3`,
  `fixed_combat_playback_actor_count=1`, and `fixed_playback_event_count=44`.
  The last H-side smoke rerun after the timeline-unit audit patch is still
  pending because the UE commandlet escalation was blocked by current Codex
  usage limits. Do not claim final strict smoke pass until it is rerun.
- `create_wuxia_level_flow_demo.py` no longer writes test HP/MP values
  `1200/100` into the combat units. Unit HP/MP now comes from
  `WuxiaDemoContract.json` `demo_units`; the smoke script checks those values
  against the contract. Missing or invalid `max_hp/max_mp` is now a build-time
  script error, not a silent fallback to demo values.
- G-side audit command:
  `python tools\audit_ue_chapter1_level_flow_sync.py`.
  Latest strict output: `outputs\ue_chapter1_level_flow_audit_20260624`,
  `28` checks, `3` failures. The failures are stale Enemy_01 unit mismatch
  warnings from the last smoke JSON; rerun
  `运行UE第一章LevelFlow同步导入构建烟测_20260624.bat` when H/UE command
  execution is available.
- Important scope: this is an editor commandlet/data smoke pass, **not** final
  real PIE visual acceptance. Do not claim product-quality first-chapter UX
  until real PIE shows the first-chapter map, node selection, boss transition,
  unit-bound HUD, damage/skill/Buff cues, and chapter UI clearly in the editor
  viewport or captured PIE output.

## 0. Current Working State - 2026-06-24 Runtime Formula Closure Pass

This block supersedes older `runtime_slim` formula-warning status lines when
they conflict.

- `tools\simulate_combat_mvp.py` now mirrors the competitor
  `FightFormula:calSkillDamageAttrCorrectionFactor` entry path for active
  damage `damageClass` rows. It loads `skill_res.csv`,
  `skill_damage_attr_conf.csv`, and `npc_resistance_conf.csv`, applies the
  documented clamp formula, and tries to read the target parry skill's
  `zhaoJiaDefDamageClass` / `zhaoJiaDefDamageParam`.
- This is **not** a full damage-class closure yet. Current exported
  `npc_attr_conf.csv` rows do not expose a resistance class/source for
  `getSkillAtkResistance` / `getSkillDefResistance`, so the simulator emits
  `damage_class_dependency_missing` instead of the old generic
  `damageClass ... correction factor 1` warning.
- Latest formula audit output:
  `outputs\runtime_slim_formula_warning_closure_20260624`.
  The sample duel still has 4 warnings: active hit/dodge policy, damage-class
  dependency missing, crit policy, active parry policy. `dexCondSkill` and
  `augment1Num` remain auto-closed in this pass.
- Verification commands that passed:
  `python -m py_compile tools\simulate_combat_mvp.py`,
  `python -m py_compile tools\audit_runtime_slim_formula_warnings.py`,
  `python tools\audit_runtime_slim_p1_debt.py --out-dir outputs\runtime_slim_p1_binding_audit_20260624_formula_verify`,
  `python tools\audit_runtime_slim_p2_p3_debt.py --out-dir outputs\runtime_slim_p2_p3_binding_audit_20260624_formula_verify`,
  and two `runtime_slim` duels written under
  `outputs\runtime_slim_formula_warning_closure_20260624`.
- Do not mark crit, active hit/dodge, active parry, or damage-class resistance
  as solved until the missing Lua/config evidence or reverse-test evidence is
  attached. The damage-class formula itself is now bound; the resistance inputs
  are still pending.

## 1. Current Working State - 2026-06-23 Chapter 1 Seed Ready, H Sync Blocked

This block supersedes older level-flow and first-chapter status lines when they
conflict.

- **2026-06-23 later update: first-chapter executable package is now generated
  locally.** Use `outputs\fzjh_chapter1_vertical_package_20260623` as the
  canonical G-drive first-chapter package for planning/runtime import. It
  contains a 7-node portrait package for `fb01` / `CH_FZJH_FB01`: nodes,
  edges, mainline gates, side/hangup entries, reward table, UI states,
  acceptance matrix, evidence-to-project mapping, UE LevelFlow CSVs, runtime
  JSON, manifest, and README. The 7-node map remains a `design_proposal`
  compression of the competitor's 45-room chapter, not a claim that the
  competitor shipped exactly seven nodes.
- **2026-06-23 later update: P1 `runtime_slim` pending binding rows are
  landed in the simulator.** The audit output is
  `outputs\runtime_slim_p1_binding_audit_20260623`. It covers all 10 P1 rows
  from `outputs\effect_binding_next_actions_20260623`: AttributeModifier
  additive/multiplicative, DamageRecordMarker, and ResourceModifier. Result:
  `10` cases executed, `7` fully `ok`, `3`
  `bound_with_value_source_warning`, `0` errors.
- The remaining P1 caveat is deliberately narrow: `YSBJ1`, `ZSDJBJ1`, and
  `HSXGBJ` now bind to the correct attribute-modifier channel, but their
  `effectReturn0/effectReturn1Add` numeric source is not proven by Lua/config
  evidence yet. They must keep the `effect_return_value_source` warning until
  reverse-test evidence identifies the return-slot value. Do not silently turn
  these rows into `0` or treat them as confirmed balance values.
- `runtime_slim` now has concrete paths for multiplicative attr modifiers,
  additive attr modifiers, record-damage windows, HP damage accumulation into
  record windows, and neili/MP cost modifiers. P2/P3 actions from
  `effect_binding_next_actions_20260623` are partially advanced in the next
  update block: P2 auto-zhao guard rules are executable; P3 state parity remains
  state-event-only until its dependent systems exist.
- **2026-06-23 later update 2: P2/P3 binding audit advanced.**
  `tools\audit_runtime_slim_p2_p3_debt.py` now audits five follow-up rows:
  effectType `19` forced auto dodge, effectType `20` forced auto parry,
  effectType `11` passive-zhao base attack state, effectType `15` weapon
  unmount state, and effectType `17` weapon switch state. Result:
  `outputs\runtime_slim_p2_p3_binding_audit_20260623`, `5` cases, `2` ok,
  `3` state-event-only, `0` errors. The P2 rows are active auto-zhao combat
  behavior; the P3 rows are intentionally visible state markers until weapon
  inventory/prepared-skill and passive-zhao pool systems exist.
- `tools\sync_fzjh_chapter1_vertical_package_to_ue.py` is prepared and
  dry-run validated for syncing `outputs\fzjh_chapter1_vertical_package_20260623`
  into `H:\MyProjectBack\WuXiaProject`. It copies the three LevelSeed CSVs plus
  `chapter1_level_flow_package.json` and patches `WuxiaDemoContract.json` to
  `CH_FZJH_FB01` / `NODE_FB01_ZhangFeng`. The actual H-drive write is **not
  completed** in this run because Codex escalation was rejected by the current
  usage/approval limit. Do not claim UE is synced until that command succeeds.

- The active UE contract on H was confirmed to still point at
  `CH_NewbieVillage` and auto-request `NODE_OldShrine`. That is the reason PIE
  was still entering the old sample flow instead of the competitor-derived
  first chapter.
- New data-driven first-chapter spec:
  `configs\ue_chapter1_level_seed_spec_v1.json`.
- Generated UE-ready first-chapter seed package:
  `outputs\ue_chapter1_level_seed_20260623`.
  It contains LevelSeed CSVs (`1` chapter, `7` nodes, `7` encounters), PCG
  point/edge/area CSVs (`7`/`8`/`3`), a contract patch, and a local acceptance
  audit.
- First-chapter node compression is explicitly marked `design_proposal`.
  Competitor facts remain `config_confirmed` and are bridged through
  `chapter1_evidence_bridge.csv`; do not describe the 7-node portrait map as
  the competitor's original 45-room layout.
- Sync tool prepared but not executed because H-drive access was blocked by the
  current Codex approval/usage limit:
  `tools\sync_ue_chapter1_level_seed_to_project.py`.
  When H access is available, run it with `--ue-root H:\MyProjectBack\WuXiaProject`,
  then import level seeds, rebuild `L_LevelFlowDemo`, run UBA/commandlet checks,
  and finish with real PIE 540x960 screenshots.
- Latest local automation combat-profile audit:
  `outputs\agent_automation_runs\20260623_092659`, `13` tasks started,
  `13` ok, `0` failed, `0` skipped.
- Local first-chapter acceptance audit:
  `outputs\ue_chapter1_level_seed_20260623\chapter1_local_acceptance_audit.json`,
  status `ok`, issues `0`.
- This is **not yet a real PIE acceptance** for first chapter. Do not claim the
  first chapter is in-engine accepted until the generated CSVs and contract
  patch are synchronized into H, UE DataTables are imported, `L_LevelFlowDemo`
  is rebuilt, and real PIE screenshots/video show the `CH_FZJH_FB01` map and
  `NODE_FB01_ZhangFeng` combat path.

## 0. Current Working State - 2026-06-22 Product HUD Cleanup Accepted In Real PIE

This block supersedes older visual-acceptance claims when they conflict.

- The brown bottom `Skill / Event / Warning` panel shown in the user's real PIE
  recording is now removed from the product HUD path. Combat feedback belongs
  to the bound unit plate, Buff icon, jump-number cue, and authored mobile HUD.
- `tools\run_ue_product_hud_cleanup_acceptance_20260622.py --execute`
  completed with `status=ok`: staged C++ was synchronized to the H-drive UE
  project, the UE target was built through the UBA-gated path, product
  presentation and active `runtime_slim` demo commandlets passed, current phase
  audit passed, and three fresh real PIE 540x960 frames passed the product
  visual pixel gate.
- Latest acceptance summary:
  `outputs\ue_product_hud_cleanup_acceptance_20260622\summary.json`.
- Latest clean real PIE frames after fixing capture tooltip pollution:
  `outputs\ue_real_pie_capture_20260622_tooltip_free`.
- `tools\run_ue_real_pie_screenshot.py` now parks the mouse on the PIE window
  chrome before every capture and records `cursor_position` for each frame, so
  editor/content-browser tooltips do not pollute acceptance screenshots.
- Current status is **functional acceptance**, not final shipped art. The real
  PIE frame is readable and no longer shows the forbidden debug panel, but it
  still uses placeholder unit silhouettes, simple color-band staging, early
  unit plates, and non-final jump-number/VFX styling. Do not call it final
  product quality until authored CommonUI skin, Niagara number style, unit
  art/animation, hit feedback, sound, and first playable encounter polish are
  completed and verified in real PIE.
- The planning workflow is project-local at
  `.codex\skills\wuxia-game-planning`. It covers systems, numerical design,
  mobile UI, quest/script, level design, competitor evidence, and acceptance.
- Competitor chapter-one evidence package:
  `outputs\fzjh_chapter1_planning_audit_20260622`; validation passes 847 checks.
- Chapter-one project adaptation plan:
  `outputs\fzjh_chapter1_planning_audit_20260622\chapter1_project_adaptation_plan.md`.
- Latest project automation combat-profile audit:
  `outputs\agent_automation_runs\20260623_011718`, `13` tasks started,
  `13` ok, `0` failed, `0` skipped. This run covers UI/image contracts,
  UE CSV schema validation, `runtime_slim` smoke, duel smoke, numeric audit,
  effect dispatcher evidence, governance indexes, UE timeline generation,
  current phase audit, and visual acceptance readiness.
- Historical effect binding next-action list:
  `outputs\effect_binding_next_actions_20260623`. It originally contained 19
  pending binding rows grouped into 9 actions. As of the later 2026-06-23
  update, the 10 P1 runtime/balance rows are implemented and audited in
  `outputs\runtime_slim_p1_binding_audit_20260623`; the remaining unresolved
  rows are P2 combat-resolution rows = 3 (forced auto dodge/parry) and P3 state
  parity rows = 6 (weapon switch/unmount and passive-zhao pool modifier), plus
  the value-source warning on three P1 `effectReturn*` rows.
- Legacy UI generators from 2026-06-20 and Product Stage V2 are compatibility
  redirects to the canonical product generator. They must not reintroduce
  global status, skill, event, or Warning panels.
- Latest read-only hardcoding audit:
  `outputs\ue_hardcoded_content_audit_20260622_product_hud_cleanup`;
  high `0`, medium `193`, low `17`.

## 0. Latest Verified State - 2026-06-22 Full runtime_slim PIE Battle

This block supersedes older status lines below when they conflict.

### HP Playback Diagnosis

- The previous screenshot that stopped at `1379 / 2400` was running
  `RuntimeSlim_BlazeRebirth_single`, a single-skill semantic smoke case.
- That case contains exactly `1021` HP damage:
  `1` direct damage plus `1020` BuffDamage. Therefore the correct final HP is
  `2400 - 1021 = 1379`. The visible `animation ends end` message means the
  one-skill timeline finished; it was not an HP bar update failure.
- Single-skill runtime_slim timelines must not be used as full-battle
  acceptance cases.

### Current Full-Battle PIE Evidence

- Default active combat case:
  `RuntimeSlim_WaveVsNpc10_seed20260619`.
- Data-driven selector:
  `configs\ue_active_combat_demo_20260622.json`.
- UE timeline:
  `outputs\ue_runtime_slim_timeline_20260622\RuntimeSlim_WaveVsNpc10_seed20260619_ue_timeline.json`.
- The full timeline contains `44` events, multiple combat rounds, and an
  explicit `battle_end` event.
- Real PIE multi-frame evidence:
  `outputs\ue_real_pie_full_runtime_demo_20260622`.
- Real PIE final evidence:
  `outputs\ue_real_pie_full_runtime_demo_final_20260622\full_runtime_demo_final_real_pie.png`.
  The left unit reaches `0 / 13200`, and the timeline reports
  `Battle ends: winner=right`.
- Real PIE audit:
  `outputs\ue_pie_audit_full_runtime_demo_final_20260622\summary.json`,
  status `ok`, checks `18`, errors `0`.

### Remaining End-State Defect

- The final PIE frame still displays `PLAYING 4.90s / 4.60s active 12` after
  `battle_end`. HP playback is complete, but playback state and held cue
  cleanup are not finalized.
- Required generic framework fix:
  non-loop timelines should clamp at `TotalDuration`, clear active held
  events/cues, stop playback immediately, and expose `COMPLETE` to the HUD.
- Do not report this end-state cleanup as complete until it has been changed,
  built with UBA, and verified in a new real PIE capture.

## 0. Latest Verified State - 2026-06-21 DataAsset Stage V6

This block supersedes older status lines below when they conflict.

### UE / Data-Driven Presentation

- Recommended authoring route for the current project:
  `CSV/JSON source of truth -> UE DataAsset/DataTable generated cache -> Framework Actors consume soft references`.
  This is the active compromise between Lyra-style UE assets and mobile-game table iteration.
- UE C++ must stay as framework capability only. Concrete skills, Buffs, demo units, stage layout, cue colors, UI timing, and asset choices belong in JSON/CSV, DataTable, DataAsset, Blueprint, or level instances.
- `UWuxiaCombatVisualCueDataAsset` remains the VisualCue registry for playback. On 2026-06-21 the JSON importer was extended so `MatchType=CueId` imports correctly, in addition to `EventType`, `SourceRef`, and `Policy`.
- UBA build passed after the importer change:
  `WuXiaProjectEditor Win64 Development`, using `Unreal Build Accelerator local executor`.
- DataAsset stage v6 source package:
  `outputs\ue_dataasset_stage_v6_20260621`.
  It generated `dataasset_stage_v6_source.json`, `visual_cue_rules_v6.json`, and `apply_wuxia_dataasset_stage_v6.py`.
- UE commandlet apply evidence:
  `outputs\ue_dataasset_stage_v6_commandlet_20260621\apply_dataasset_stage_v6_20260621.json`, status `ok`, returncode `0`.
- UE saved v6 report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaDataAssetStageV6_20260621.json`, status `ok`.
  It imported `32` VisualCue rules into `/Game/Wuxia/Data/Combat/DA_CombatVisualCue_FZJHSeed`, rebuilt `L_LevelFlowDemo`, reapplied `Fixed_VenomVsIron_seed12100_20260621`, and created `VIS_DataAssetStageV6_*` stage actors.
- Latest real PIE evidence, captured from a live floating PIE window:
  `outputs\ue_real_pie_capture_20260621_dataasset_stage_v6\dataasset_stage_v6_real_pie_real_pie.png`.
- Latest real PIE report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json`, `world_type=PIE`, `current_view=Combat`, `selected_combat_case=Fixed_VenomVsIron_seed12100_20260621`, `visible_combat_hud_count=1`, `tiny_label_count=0`, `back_facing_label_count=0`.
- Latest PIE report audit:
  `outputs\ue_pie_acceptance_report_audit_20260621_dataasset_stage_v6`, status `ok`, checks `18`, errors `0`.
- Latest product visual screenshot audit:
  `outputs\ue_product_visual_acceptance_20260621_dataasset_stage_v6`, status `ok`.
  Metrics from real PIE include `blackish_ratio=0.046429`, `colorful_ratio=0.123769`, `red_hp_pixels=3124`, `blue_mp_pixels=6422`, `green_buff_pixels=3255`, and `purple_poison_pixels=1855`.
- Latest current phase audit:
  `outputs\current_phase_acceptance_20260621_dataasset_stage_v6`, checks `53`, errors `0`, warnings `0`.
- Latest hardcoding audit:
  `outputs\ue_hardcoded_content_audit_20260621_dataasset_stage_v6`, status `ok`, high findings `0`, total findings `208`.
  Remaining findings are medium/low and mostly editor spawn sites, visual literals, debug text fallback, and preview numeric helpers.
- Visual caveat remains: v6 is a real PIE-readable data-driven presentation pass, not final shipped art. It still uses placeholder meshes/materials; final character art, CommonUI skin polish, Niagara authored systems, animation, and sound need dedicated content work.

### Competitor / runtime_slim

- Runtime numeric audit artifact:
  `outputs\runtime_slim_numeric_semantics_audit_20260621_scale_policy`.
- Runtime scale policy artifact:
  `outputs\runtime_slim_scale_policy_20260621_final`.
- Numeric audit rows checked: `9`; remaining `high_risk_scale=0`; `resolved_resource_delta_neili=2`; `do_not_bind_as_damage=2`.
- `NLMPJ14P1` and `NLMPJ14P2` are explicitly classified as `resource_delta_neili` with runtime action `do_not_bind_as_damage`, based on effectType `120`, `neili#0#0`, `BuffEffect120.lua`, and RolePop/evidence text `内力-$Bfd` / `额外消去了$Bfd点内力`.
- `dynamicArg1=153` is therefore a fixed neili/MP resource amount, not a direct HP damage multiplier. This closes the immediate `153000` HP-damage misread risk for those two rows, but does not mean the full formula dispatcher is complete. Neili/MP resource lanes still need runtime_slim binding.

## 0.1 Previous Verified State - 2026-06-21 Fixed VenomVsIron PIE

This block is previous evidence. The DataAsset Stage V6 block above supersedes it when they conflict.

### UE / PIE

- Latest fixed battle timeline candidate:
  `outputs\fixed_battle_venom_vs_iron_20260621\Fixed_VenomVsIron_seed12100_20260621_ue_timeline.json`.
  It is `U_VENOM_NEEDLE` vs `U_IRON_PALM`, seed `12100`, event_count `92`, with explicit `unit_setup`, `source_unit_id`, `target_unit_id`, `raw_value`, and `visual_value`.
- Important scope: this fixed battle is still a deterministic MVP playback sample for UE validation. It is not a full runtime_slim competitor-formula battle.
- The previous poison tick conversion bug is fixed in the generated timeline: all `39` `BuffDamage` events now carry non-zero values.
- UE contract now points to `Fixed_VenomVsIron_seed12100_20260621`, with demo units `Shen Qing` and `Han Zhen`.
- UE apply evidence:
  `outputs\ue_apply_fixed_venom_vs_iron_20260621\apply_fixed_venom_vs_iron_20260621.json`, status `ok`, returncode `0`.
- UE saved apply report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFixedBattleTimelineApply_20260620.json`, case `Fixed_VenomVsIron_seed12100_20260621`, events `92`, unit plates configured, unit cue components configured, vertical HUD assigned, visual cue assigned.
- Latest real PIE evidence, captured from a live floating PIE window:
  `outputs\ue_real_pie_capture_20260621_fixed_venom_vs_iron\fixed_venom_vs_iron_real_pie_real_pie.png`.
- Latest real PIE report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json`, `world_type=PIE`, `current_view=Combat`, `selected_combat_case=Fixed_VenomVsIron_seed12100_20260621`, `tiny_label_count=0`, `back_facing_label_count=0`.
- Latest PIE report audit:
  `outputs\ue_pie_acceptance_report_audit_20260621_fixed_venom_vs_iron`, status `ok`, checks `18`, errors `0`.
- Latest product visual screenshot audit:
  `outputs\ue_product_visual_acceptance_20260621_fixed_venom_vs_iron`, status `ok`.
- Latest current phase audit:
  `outputs\current_phase_acceptance_20260621_fixed_venom_vs_iron_rerun`, checks `53`, errors `0`, warnings `0`.
- Visual caveat remains: this passes real PIE readability and data-contract gates, but it is not final shipped art. Units are still placeholder shapes and the HUD/VFX still need final CommonUI/Niagara art direction.

### Competitor / runtime_slim

- `runtime_slim` is still the evidence-first competitor mirror engine path; do not treat the fixed VenomVsIron sample as a formula-complete replacement.
- Numeric semantics audit:
  `outputs\runtime_slim_numeric_semantics_audit_20260621_fixed_venom_vs_iron`, rows `9`, high risk `2`.
  High risk remains `BlazeRebirth` / `NLMPJ14P1` and `NLMPJ14P2`; `dynamicArg1=153` needs a scale policy before it can be bound as direct damage.

## 0.2 Previous Verified State - 2026-06-21 Product Stage v5

This block supersedes older status lines below when they conflict.

### UE / PIE

- Latest real PIE evidence, captured from a live floating PIE window at 540x960:
  `outputs\ue_real_pie_capture_20260621_product_stage_v5\level_flow_product_stage_v5_real_pie.png`.
- Latest real PIE report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json`, `world_type=PIE`, `current_view=Combat`, `visible_combat_hud_count=1`, `level_flow_hud_visible=false`.
- Latest functional PIE audit:
  `outputs\ue_pie_acceptance_report_audit_20260621_stage_v5`, status `ok`, checks `18`, errors `0`.
- Latest current phase audit:
  `outputs\current_phase_acceptance_20260621_stage_v5`, checks `53`, errors `0`, warnings `0`.
- Latest product visual screenshot audit:
  `outputs\ue_product_visual_acceptance_20260621_stage_v5_r2`, status `ok`.
  It checks portrait resolution, HP/MP visibility, warm skill banner pixels, Buff/poison color pixels, non-graybox dominance, and empty top-band symptoms against the real PIE screenshot.
- Product stage v5 commandlet evidence:
  `outputs\ue_product_stage_v5_commandlet_20260621\apply_product_stage_v5_20260621.json`, status `ok`, returncode `0`.
- Product stage application report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaProductStageV3_20260621.json`, status `ok`.
  It created/updated `VIS_ProductStage_BaseInk`, `VIS_ProductStage_FarMistBand`, `VIS_ProductStage_CenterLane`, `VIS_ProductStage_GoldSpine`, source/target accent ribbons, Buff/poison ribbons, vignette strips, and unit shadow discs.
- The active stage is no longer the previous exposed gray checker floor in real PIE. `VIS_LevelFlow_Floor` is covered with the stage base material and `VIS_LevelFlow_CombatFloor` uses the stage floor material.
- The active combat HUD and unit plates are visible and unit-bound in real PIE. HP/MP loss, Buff text, poison/Buff color cues, and skill banner are present.
- Visual caveat: this is a product-structure and validation pass, not final shipped art. Units are still shaped placeholders, Niagara emitters are still placeholder systems, and real production-quality character/background/UI art remains a TA/UI art task.
- UBA build was attempted after this pass but was blocked by Codex approval/usage limits before execution. Do not mark a new C++ build as passed for 2026-06-21. No UE C++ source was intentionally changed in this product-stage pass.

### Audits

- Hardcoding audit:
  `outputs\ue_hardcoded_content_audit_20260621_stage_v5`, high `0`, total findings `208` (`medium=191`, `low=17`).
- Product visual audit:
  `outputs\ue_product_visual_acceptance_20260621_stage_v5_r2\product_visual_acceptance.json`, status `ok`.
- Runtime/UE current phase audit:
  `outputs\current_phase_acceptance_20260621_stage_v5`, `53/53`.

### Competitor / runtime_slim

- Latest runtime gap closure used this pass:
  `outputs\runtime_slim_gap_closure_20260621_product_presentation`.
- `effectType` evidence registry rows: `457`; remaining semantic unknown rows after closure: `0`.
- Effect binding queue: `19` rows remain evidence-resolved but not fully bound to runtime_slim; `8` are `P0_bind_runtime_slim`.
- Formula warning queue: `6` rows remain; `P0_runtime_formula_policy=3`, `P1_reverse_test_required=1`, `P2_closed_or_monitor=2`.
- Current warning counts are still `active_hit_dodge=1`, `active_parry=1`, `crit=2`, `damageClass_correction=2`.
- Numeric semantics audit:
  `outputs\runtime_slim_numeric_semantics_audit_20260621_stage_v5`, rows `9`, high risk `2`.
  High risk remains `BlazeRebirth` / `NLMPJ14P1` and `NLMPJ14P2`, where `dynamicArg1=153` must not be treated as confirmed direct damage multiplier.

## 0.3 Previous Verified State - 2026-06-20 v5

This block supersedes older status lines below when they conflict.

### UE / PIE

- UBA build passed after the latest LevelFlow HUD visibility fix:
  `WuXiaProjectEditor Win64 Development -NoLiveCoding`.
- `WBP_CombatRoot` and `WBP_CombatUnitPlate` are no longer empty shells for the active flow. They were authored by the JSON-to-WidgetTree importer and saved through UE commandlet evidence:
  `outputs\ue_authored_combat_widget_commandlets_20260620\apply_authored_combat_widgets_v3_readable.json`.
- The duplicate native `BindWidget` / generated Blueprint variable bug was fixed by keeping imported widgets non-variable by default.
- Real PIE evidence, not offline render:
  `outputs\ue_real_pie_capture_20260620_v5_hide_level_flow_hud\level_flow_v5_hide_level_flow_hud_real_pie.png`.
- Real PIE report:
  `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json`, `world_type=PIE`, `current_view=Combat`, `visible_combat_hud_count=1`, `level_flow_hud_visible=false`.
- PIE acceptance audit with the real screenshot passed:
  `outputs\ue_pie_acceptance_report_audit_20260620_v5_hide_level_flow_hud`, `18/18`.
- Current visual status: **functional but not product-quality**. The latest real PIE screenshot shows unit-bound HP/MP, Buff text, HP loss, damage numbers, and no LevelFlow node HUD overlay in Combat view. It still has prototype stage art, placeholder units, and a simple combat HUD skin. Do not call it final art or final UX.
- Playback is slowed through contract data, not hardcoded `PlayRate=1.0`:
  `fixed_battle.playback_settings.primary_play_rate=0.38`, `fixed_play_rate=0.38`.
- Unit plate draw size is now contract-driven through `combat_stage.unit_plate.draw_size=[460,168]`.

### Audits

- Current phase audit:
  `outputs\current_phase_acceptance_20260620_v5_hide_level_flow_hud`, `53/53`, errors `0`.
- Hardcoding audit:
  `outputs\ue_hardcoded_content_audit_20260620_v5_hide_level_flow_hud`, high `0`, total findings `208` (`medium=191`, `low=17`).
- Vertical stage policy audit:
  `outputs\ue_vertical_stage_policy_audit_20260620_after_widget_import`, `13/13`, errors `0`.

### Competitor / runtime_slim

- Latest runtime gap closure:
  `outputs\runtime_slim_gap_closure_20260620_v5_hide_level_flow_hud`.
- `effectType` registry rows: `457`; remaining semantic unknown rows: `0`.
- Important caveat: `19` semantics are evidence-resolved but still need runtime binding. They must remain warnings until bound.
- `effectType=211` / `MulNeiliCost` now has a runtime_slim event path for `neili_cost_multiplier_delta`; validated by `outputs\runtime_slim_duel_v5_buwutianxia_neili_cost.json`.
- Formula warnings still present: `active_hit_dodge=1`, `active_parry=1`, `crit=2`, `damageClass_correction=2`.
- Runtime numeric semantic audit still has 2 high-risk rows:
  `BlazeRebirth` / `NLMPJ14P1` and `NLMPJ14P2`, where `dynamicArg1=153` must not be treated as confirmed direct damage multiplier.
- Remaining known runtime_slim warning after 211 binding: `effectType=101` with `plusPoint` is not mapped to a confirmed attribute field yet and must stay visible as `attribute_modifier_unmapped_param`.

## 1. Mission

Turn restored competitor Lua/config/resource data into:

1. Queryable and auditable combat data.
2. A Python combat simulator that can use restored mirror inputs.
3. An Unreal Engine 5 demo with data-driven level nodes, combat playback, CommonUI HUD, and Niagara visual cues.
4. A production-ready design path for mobile app, Android/iOS, and later TikTok mini-game validation.

## 2. Non-Negotiable Rules

1. Do not present inferred mechanics as confirmed competitor logic.
2. Every guessed or reverse-engineered mechanic must carry evidence fields such as `EvidenceLevel`, `Confidence`, `SourceLua`, and `ReverseTestStatus`.
3. Missing or unknown combat effects must emit warnings. Never silently convert unknown effects to 0.
4. Do not claim Unreal code is valid unless it has compiled after the latest source change.
5. Do not claim a UE visual feature is accepted unless it has been verified in real Unreal PIE runtime state.
6. Competitor art/resources are internal research placeholders only unless licensing is resolved.
7. Prefer data-driven soft references over hardcoded asset paths.
8. Keep every major step reproducible through scripts, CSV/JSON outputs, and a short report.
9. UE C++ builds must use UBA by default. Do not add `-NoUBA` unless the user explicitly approves a temporary fallback after a UBA failure is reported.
10. C++ must provide capabilities, APIs, validation, and runtime bindings only. Do not put concrete gameplay actor IDs, case IDs, unit IDs, node IDs, balancing values, or demo parameters in C++ defaults; set them in level instances, Blueprint/DataAsset authoring, CSV/JSON data, or editor scripts.
11. Treat hardcoded content as a build-quality issue. Any C++ `ConstructorHelpers`, concrete gameplay skill ID, concrete unit ID, concrete encounter ID, final asset path, or final visual style in runtime code must be removed or explicitly marked debug-only.
12. Real UE visual acceptance must be based on fresh PIE/runtime evidence. Offline deterministic screenshots are diagnostics only.

## 2.1 UE Data-Driven Coding Standard

Use these terms consistently:

- **Framework Actor**: C++ Actor or component that exposes a small, stable interface and owns generic runtime behavior.
- **Authoring Asset**: Blueprint, DataAsset, DataTable, CSV/JSON seed, or level instance that owns concrete content.
- **Presentation Contract**: data that maps combat/runtime events to CommonUI, Niagara, material, sound, camera, and animation references.

Allowed in C++:

- Component creation for a Framework Actor.
- Runtime state machines, deterministic playback, validation, import helpers, event routing, and data parsing.
- `TSubclassOf`, `TObjectPtr`, `TSoftObjectPtr`, `FSoftObjectPath`, `FPrimaryAssetId`, row names, and editable properties that are assigned by Authoring Assets.
- Debug-only fallback behavior when disabled by default and clearly named as fallback/debug.

Not allowed in C++ runtime code:

- `ConstructorHelpers` for final meshes, materials, widgets, Niagara systems, or sounds.
- Concrete skill IDs such as `AS_*`, runtime case IDs such as `RuntimeSlim_*`, unit IDs such as `Ally_01` / `Enemy_01`, node IDs, encounter IDs, or balancing values.
- Final UI layout, colors, font sizes, text templates, Buff icons, VFX choices, and combat presentation timing.
- Hidden actor class defaults for generated gameplay objects. Actor classes must be supplied by Blueprint, level instance, DataAsset, DataTable, or editor config.

Editor scripts are allowed to spawn actors and write maps, but playable demo content must be traceable to an Authoring Asset or external config. Import destination paths such as `/Game/Wuxia/Data/...` are tool configuration, not gameplay logic; they still belong in a shared config module when a script graduates from prototype to production.

Preferred Unreal seams:

- C++ Framework Actor -> editable `TSubclassOf` / `TSoftObjectPtr` / DataTable references.
- Runtime timeline -> UE playback actor through a single data contract.
- Combat event -> Presentation Contract -> CommonUI/Niagara/animation.
- Level seed row -> Level Director -> Node/edge Actor classes supplied by data.

Hardcoding audit:

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\audit_ue_hardcoded_content.py --out-dir outputs\ue_hardcoded_content_audit_YYYYMMDD
```

High findings are mandatory review items. A finding can be closed by moving content to an Authoring Asset, marking it debug-only, or documenting why it is a framework constant rather than content.

Latest hardcoding audit status:

```text
outputs\ue_hardcoded_content_audit_20260620_after_finish_contract_refactor_verify
high = 0
remaining findings = 207
high findings remain closed as of the last verified audit
remaining medium classes = balancing_numeric_literal, visual_numeric_literal, spawn_actor_from_script, actor_class_default_static
```

## 3. Current Architecture

### Data Restoration

Important outputs:

```text
outputs\fzjh_full_system_restore_20260612\fzjh_restored_query.sqlite
outputs\fzjh_combat_mirror_inputs_20260614
outputs\fzjh_combat_semantic_indexes_20260617
outputs\combat_engine_schema_v2_runtime_slim
```

Core restored tables:

- `mirror_active_zhao`
- `mirror_active_zhao_comb`
- `mirror_active_zhao_hurt`
- `mirror_buff_adder`
- `mirror_buff_effect`
- `mirror_buff_damage`
- `mirror_base_skill_lv_attr_conf`
- `mirror_prep_skill_lv_attr_conf`
- `mirror_npc_attr_conf`

### Python Simulation

Main simulator:

```text
tools\simulate_combat_mvp.py
```

Current engines:

- MVP handmade config mode.
- `runtime_slim` restored mirror input mode.

Resolved numeric semantic issue:

- `runtime_slim` can substitute expressions such as `hurtGrow=-dynamicArg1`.
- `BlazeRebirth` `NLMPJ14P1` / `NLMPJ14P2` no longer count as direct attack multipliers. `dynamicArg1=153` is classified as `resource_delta_neili` and must be routed to a neili/MP resource lane.

Remaining runtime issue:

- The neili/MP resource lane is not fully bound yet.
- Active hit/dodge, active parry, crit, and damageClass correction still need formula dispatcher work.

### Unreal Engine

Project path:

```text
H:\MyProjectBack\WuXiaProject
```

Important source areas:

```text
Source\WuXiaProject\Public\Combat
Source\WuXiaProject\Private\Combat
Source\WuXiaProject\Public\World
Source\WuXiaProject\Private\World
Source\WuXiaProject\Public\UI
Source\WuXiaProject\Private\UI
```

Important content areas:

```text
Content\Wuxia\Data
Content\Wuxia\Maps
Content\Wuxia\SourceData
Content\Wuxia\UI\Vertical
Content\Wuxia\FX\Combat
Content\Python
```

Current maps:

- `/Game/Wuxia/Maps/L_LevelFlowDemo`
- `/Game/Wuxia/Maps/L_CombatPreview`

Current UE status:

- UE C++ has compiled after the latest CommonUI/Niagara C++ changes with UBA enabled.
- `WBP_CombatHud_Playtest` exists and is assigned to `AC_LevelFlow_CombatPlayback`.
- `NS_CombatDamageNumber` exists as a minimal placeholder Niagara asset.
- `L_LevelFlowDemo` has a fixed orthographic map camera and a separate combat preview camera.
- `AC_LevelFlow_CombatPlayback` is the normal single-skill Playtest playback actor.
- `AC_LevelFlow_FixedCombatPlayback` now uses a `runtime_slim` exported timeline as the formal fixed playback path.
- Latest fixed UE timeline evidence is `RuntimeSlim_WaveVsNpc10_seed20260619` rebuilt on 2026-06-20 with 35 events from `outputs\runtime_slim_gap_closure_20260620\RuntimeSlim_WaveVsNpc10_after_closure_ue_timeline.json`. Current formula warnings are runtime-side policy warnings only: `active_hit_dodge`, `active_parry`, `crit`, and `damageClass_correction`.
- Old `Fixed_VenomVsIron_seed12100` / 92-event references are historical only. Do not use them as current status or acceptance evidence.
- `AC_LevelFlow_CombatPlayback` and `AC_LevelFlow_FixedCombatPlayback` are now bound to `/Game/Wuxia/UI/Vertical/WBP_CombatRoot`.
- `AC_LevelFlow_CombatUnit_Ally_01` and `AC_LevelFlow_CombatUnit_Enemy_01` now use `/Game/Wuxia/UI/Vertical/WBP_CombatUnitPlate` for unit-bound overhead UI.
- `AC_LevelFlow_CombatUnit_Ally_01` and `AC_LevelFlow_CombatUnit_Enemy_01` now have `UWuxiaCombatCueComponent` configured for Niagara cues and with native TextRender fallback disabled. Current smoke evidence reports `niagara_enabled_count=2` and `native_text_fallback_enabled_count=0`.
- Final 9:16 CommonUI skin contract is generated in `outputs\ue_final_visual_pass_20260619` and copied into `Content\Wuxia\SourceData\FinalVisualPass`.
- Current runtime HUD has a larger vertical CommonUI-style fallback skin marked by `FinalVerticalCommonUISkin_20260619`. UE commandlet cannot edit protected WidgetTree internals, so authored Widget Blueprint layout remains an editor/designer step rather than a commandlet-generated graph.
- Final Niagara jump-number data path is bound through `FWuxiaCombatVisualCueRule` plus C++ Niagara user parameters: `DamageValue`, `CueMagnitude`, `CueEventCode`, `CueCritical`, `CueBlocked`, `CueDodged`, `CueDuration`, and `CueColor`.
- `bSpawnNativeTextFallback` is disabled by default for unit cue components; native TextRender is debug-only.
- Runtime timelines must distinguish `raw_max_hp`/`raw_value` from `visual_max_hp`/`visual_value`. Competitor NPC raw HP such as `999999` is valid data, but it is not suitable for human visual acceptance unless scaled for preview.
- `outputs\ue_vertical_combat_ui_contract_20260619` is the current 9:16 CommonUI/widget/event visual contract. It is a landing contract, not final art.
- `outputs\ue_vertical_ui_scaffold_20260619` generates the UE Python commandlet script for the first 9:16 UI/FX asset scaffold.
- Latest UE asset scaffold evidence: `H:\MyProjectBack\WuXiaProject\Saved\WuxiaVerticalUIScaffoldReport_20260619.json`, status `ok`.
- Current generated UE scaffold assets:
  - `Content\Wuxia\UI\Vertical\WBP_CombatRoot`
  - `Content\Wuxia\UI\Vertical\WBP_CombatUnitPlate`
  - `Content\Wuxia\UI\Vertical\WBP_CombatFloatingTextLayer`
  - `Content\Wuxia\UI\Vertical\WBP_CombatBuffIcon`
  - `Content\Wuxia\UI\Vertical\WBP_CombatSkillBanner`
  - `Content\Wuxia\UI\Vertical\WBP_LevelFlowScreen`
  - `Content\Wuxia\UI\Vertical\WBP_LevelNodeCard`
  - `Content\Wuxia\FX\Combat\NS_CombatDamageNumber`
  - `Content\Wuxia\FX\Combat\NS_CombatDotNumber`
  - `Content\Wuxia\FX\Combat\NS_CombatBuffAdd`
  - `Content\Wuxia\FX\Combat\NS_CombatBuffPulse`
- Latest FinalVisualPass UE import evidence: `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFinalVisualPass_20260619.json`, status `ok`, `imported_visual_cue_rules=9`, warnings `0`.
- Latest automated pixel/readability evidence from `outputs\ue_visual_pixel_acceptance_20260619` is historical deterministic timeline evidence only. It must not be used as final UX acceptance because the user-provided real PIE video diverged from it.
- Latest real PIE combat-view evidence: `outputs\ue_real_pie_capture_20260620_combat_view_auto_hud_evidence\level_flow_combat_view_auto_hud_evidence_real_pie.png`, with `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json` reporting `current_view=Combat`, `visible_combat_hud_count=1`, `debug_screen_hud_active=false`, and `active_hud_class=/Script/Engine.HUD`.
- Latest PIE viewport acceptance gate: `outputs\ue_pie_viewport_acceptance_20260620_combat_view_auto_hud_evidence`, checks `18`, errors `0`.
- Latest visual readiness audit: `outputs\ue_visual_acceptance_readiness_20260620_after_real_pie_hud_evidence`, status `ok`, errors `0`, warnings `0`, checks `48`.
- Latest current-phase audit with UE reports required: `outputs\current_phase_acceptance_20260620_after_high_refactor_vertical_stage_recheck`, checks `48`, errors `0`, warnings `0`.
- Latest agent runner evidence: `outputs\agent_automation_runs\20260619_213317`, started `13`, ok `13`, failed `0`. The runner calls `tools\audit_current_phase_runtime_ue.py --require-ue-reports` and `tools\audit_ue_visual_acceptance_readiness.py` in the combat profile.
- Real UE visual acceptance is now PIE-only. Deterministic timeline renders and commandlet smoke checks are auxiliary diagnostics, not final visual acceptance.
- PIE acceptance report path: `H:\MyProjectBack\WuXiaProject\Saved\WuxiaPieAcceptance_Latest.json`.
- Automated real PIE capture command: `python tools\run_ue_real_pie_screenshot.py --capture-target pie-window --pie-width 540 --pie-height 960 --rhi d3d11 --require-pie-report --expected-view Combat`.
- Final PIE acceptance gate must use a fresh editor-play viewport screenshot or the screenshot produced by the automated real PIE capture: `python tools\run_ue_pie_viewport_acceptance_gate.py --out-dir outputs\ue_pie_viewport_acceptance_YYYYMMDD --screenshot <fresh_real_pie_png>`.
- `L_LevelFlowDemo` writes the PIE acceptance report only when played in PIE with the generated level configuration. If the editor was already open while C++ or map assets were regenerated, restart Unreal Editor or reopen the map before judging the result.
- Product UX warning: the current real PIE screenshot is a functional/debug combat proof, not a finished 9:16 vertical mobile scene. It still needs authored CommonUI layout polish, final unit art/animation, final Niagara number style, and battle-stage art before it can be called product-quality.
- The vertical stage cleanup is now applied to the H-drive project. Policy evidence: `outputs\ue_vertical_stage_policy_audit_20260620_topdown\summary.json`, checks `13`, errors `0`.
- Real floating New Editor Window PIE capture is supported at 540x960 through `tools\run_ue_real_pie_screenshot.py --capture-target pie-window --rhi d3d11`. D3D11 is the automation default because the current RTX 2070 Super / driver 560.94 produced a confirmed D3D12 GPU hang.
- Latest real 9:16 PIE evidence: `outputs\ue_real_pie_capture_20260620_topdown_9x16_d3d11\level_flow_topdown_9x16_d3d11_real_pie.png`. The floor fills the portrait viewport and the debug backdrop is gone, but unit placement and authored UI are still not product-ready, so visual acceptance remains failed.
- `WBP_CombatRoot` and `WBP_CombatUnitPlate` are currently empty Blueprint shells; the visible layout still comes from C++ runtime fallback code. A generic editor-only JSON-to-WidgetTree importer is staged in `outputs\ue_widget_layout_importer_20260620`, with two data-driven layouts in `outputs\ue_authored_combat_widgets_20260620`. UBA compilation is still required before this importer can be executed.
- Latest resolved effect evidence registry: `outputs\runtime_slim_gap_closure_20260620_v2\effectType_evidence_registry_resolved_v2.csv`. It preserves the original 19 semantic-unknown classifications, resolves their semantics from Lua class evidence, and keeps all 19 runtime bindings visible as pending work.

Blueprint policy:

- Use Blueprint only as a thin authoring and assembly layer: editable level nodes, encounter bindings, Widget Blueprint composition, animation hooks, Niagara asset references, and designer-facing debug toggles.
- Keep combat formulas, Buff dispatch, runtime timeline conversion, data validation, state machines, and deterministic playback logic in Python/C++.
- Do not build complex combat logic in Blueprint graphs. If a graph becomes hard to read, move the logic to C++ and expose a small Blueprint-callable API.
- Complex Blueprint graphs are acceptable only for visual sequencing prototypes and must be replaceable by data-driven C++/Niagara/CommonUI bindings before production.

## 4. Verification Commands

### Python runtime_slim smoke

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\simulate_combat_mvp.py --engine runtime_slim --runtime-slim-skills waveCrashingSand,BlazeRebirth --runtime-slim-attacker-attack 1000 --runtime-slim-target-defense 300 --runtime-slim-json-out outputs\runtime_slim_engine_20260617\wave_blaze_summary.json --runtime-slim-out-dir outputs\runtime_slim_engine_20260617
```

### UE 12-case smoke loop

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\run_ue_combat_playtest_smoke_loop.py
```

### Rebuild combat semantic indexes

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_fzjh_combat_semantic_indexes.py
```

### UE C++ build

Close Unreal Editor first if Live Coding or loaded DLLs block the build.

```powershell
& 'H:\programfiles\UE_5.7\Engine\Build\BatchFiles\Build.bat' WuXiaProjectEditor Win64 Development 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -NoLiveCoding
```

### Rebuild LevelFlow demo map

```powershell
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='H:\MyProjectBack\WuXiaProject\Content\Python\create_wuxia_level_flow_demo.py' -unattended -nop4
```

### Smoke LevelFlow demo map

```powershell
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='H:\MyProjectBack\WuXiaProject\Content\Python\smoke_wuxia_level_flow_demo.py' -unattended -nop4
```

This commandlet smoke is not final visual acceptance. Final visual/interaction acceptance must come from a real PIE run and `tools\audit_ue_pie_acceptance_report.py`.

### Apply vertical Combat stage cleanup

This is the current prepared fix for the real PIE black-block / debug-stage failure. It must be run against the H-drive UE project before judging the next PIE image.

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\apply_ue_vertical_combat_stage_cleanup_20260620.py
python tools\audit_ue_vertical_stage_policy.py --out-dir outputs\ue_vertical_stage_policy_audit_YYYYMMDD
```

Or use the wrapper:

```text
运行UE_竖屏Combat舞台清理与PIE验收_20260620.bat
```

Expected policy gate:

```text
show_static_fighter_markers = false
show_static_hp_bars = false
show_world_text_labels = false
spawn_native_text_cues = false
Combat camera projection = Orthographic
```

### Audit real PIE acceptance

Run PIE in `/Game/Wuxia/Maps/L_LevelFlowDemo`, then run:

```powershell
cd /d G:\codex\姝︿緺鎺岄棬鏀剧疆鎸傛満
python tools\audit_ue_pie_acceptance_report.py --out-dir outputs\ue_pie_acceptance_20260619_after_pie
```

Expected acceptance conditions:

- `world_type` is `PIE`.
- Map view has zero visible combat HUD widgets.
- Combat view has a visible combat HUD widget.
- Node labels are camera-facing and not tiny.
- Report status is `ok`.

### Validate UE DataTable CSV schema

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\validate_ue_datatable_csv_schema.py
```

Expected current result: 18 checked, 18 ok, 0 problems.

### Build vertical combat UI contract

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_ue_vertical_combat_ui_contract.py
```

Current output:

```text
outputs\ue_vertical_combat_ui_contract_20260619
combat_ui_widget_contract.csv
combat_visual_event_contract.csv
combat_visual_acceptance_gates.csv
ue_vertical_combat_ui_contract.json
```

### Build and install vertical UE UI scaffold

Generate the script package first:

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_ue_vertical_ui_scaffold_package.py
```

Then run the generated script through UnrealEditor-Cmd:

```powershell
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='G:\codex\武侠掌门放置挂机\outputs\ue_vertical_ui_scaffold_20260619\create_wuxia_vertical_ui_scaffold.py' -unattended -nop4
```

Current expected evidence:

```text
H:\MyProjectBack\WuXiaProject\Saved\WuxiaVerticalUIScaffoldReport_20260619.json
status = ok
widgets = 7
niagara = 4
contract_copied = 6
```

### Build and install final visual pass

```powershell
python tools\build_ue_final_visual_pass.py
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='G:\codex\武侠掌门放置挂机\outputs\ue_final_visual_pass_20260619\apply_wuxia_final_visual_pass.py' -unattended -nop4
```

Current result:

```text
H:\MyProjectBack\WuXiaProject\Saved\WuxiaFinalVisualPass_20260619.json
status = ok
imported_visual_cue_rules = 9
warnings = 0
```

### Build automated visual pixel acceptance

```powershell
python tools\build_ue_visual_pixel_acceptance.py
```

Current result:

```text
outputs\ue_visual_pixel_acceptance_20260619\wuxia_vertical_combat_acceptance.png
status = ok
size = 720 x 1280
all pixel/readability checks = true
source = deterministic_timeline_render
ue_automation_screenshot_supported = false
```

### Audit UE visual acceptance readiness

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\audit_ue_visual_acceptance_readiness.py --out-dir outputs\ue_visual_acceptance_readiness_20260619_final_visual_pass
```

Current result:

```text
status = ok
error_count = 0
warning_count = 0
check_count = 48
engineering_visual_chain_ready = true
product_visual_complete = false
note = engineering chain only; real PIE still shows graybox map/combat presentation and must not be treated as final UX
```

### Apply runtime_slim timeline to UE

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_ue_runtime_slim_timeline.py
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='H:\MyProjectBack\WuXiaProject\Content\Python\apply_wuxia_fixed_battle_timeline.py' -unattended -nop4
& 'H:\programfiles\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' 'H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject' -run=pythonscript -script='G:\codex\武侠掌门放置挂机\outputs\ue_content_import_scripts\smoke_wuxia_level_flow_demo.py' -unattended -nop4
```

Current smoke evidence:

```text
fixed_playback_event_count = 35
fixed_playback_event_counts = SkillStart 4, Damage 7, BuffAdd 9, BuffEffect 9, BuffDamage 1, Warning 5
runtime_timeline_case_id = RuntimeSlim_WaveVsNpc10_seed20260619
cue_component_binding = niagara_enabled_count 2, native_text_fallback_enabled_count 0
warnings = 0
contract_path = H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json
timeline_copy = H:\MyProjectBack\WuXiaProject\Saved\WuxiaSourceData\FixedBattle\ActiveCombatTimeline_ue.json
real_pie_screenshot = outputs\ue_real_pie_capture_20260620_combat_view_auto_hud_evidence\level_flow_combat_view_auto_hud_evidence_real_pie.png
real_pie_acceptance = WuxiaPieAcceptance_Latest, world_type PIE, status ok, current_view Combat
visual_acceptance_status = link works, but product UX still fails; current PIE image remains graybox/debug and must be improved before final acceptance
```

### Build effect dispatcher evidence

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_fzjh_effect_dispatcher_evidence.py
```

This upgrades `unknown/effectType` rows from config-pattern inference to Lua evidence using `FightBuff.Constants`, `EffectFactory`, `ActiveEffect`, and `BuffEffect<N>.lua` files.

### Build combat governance indexes

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_combat_governance_indexes.py
```

Current output:

```text
outputs\combat_governance_indexes_20260619
effectType_evidence_registry.csv = 457 rows
combat_formula_index.csv = 58 rows
mechanic_value_index.csv = 15 rows
```

### Build runtime_slim UE timeline

```powershell
cd /d G:\codex\武侠掌门放置挂机
python tools\build_ue_runtime_slim_timeline.py
```

Current output:

```text
outputs\runtime_slim_gap_closure_20260620\RuntimeSlim_WaveVsNpc10_after_closure_ue_timeline.json
events = 35
Enemy_01 raw_max_hp = 14960
Enemy_01 visual_max_hp = 14960
warnings = active_hit_dodge, active_parry, crit, damageClass_correction
```

## 5. Required Agent Skill Protocol

This section adapts useful rules from `G:\UE5 Project\WeAreDefender\Agent.md` and `H:\MyProjectBack\WuXiaProject\UE5 Skills.md` to this project. Do not copy another project's status or assumptions into this workspace.

Before every non-trivial task:

1. Identify active task domains from the skill map below.
2. Read this `AGENTS.md` and any matching local/system Codex skill before editing.
3. Inspect the relevant source/config/data/report files first; do not act from memory.
4. Check whether Blueprint or asset truth requires an Unreal Editor export, commandlet, DataAsset dump, or real PIE evidence.
5. For broad edits, check source status or at least scope touched files before changing them.

Before finishing every task:

1. Re-check the active skill domains and hard-stop rules.
2. Confirm no `.uasset` / `.umap` was directly parsed or edited as text.
3. Confirm runtime/editor module separation was preserved.
4. Confirm concrete content stayed in CSV/JSON, DataAsset, DataTable, Blueprint, or level instances rather than C++ defaults.
5. Report exactly what was validated, what was not validated, and which evidence paths prove it.

Use this result format for substantive work:

```text
Done:
- ...

Changed:
- ...

Validation:
- Build:
- Tests/scripts:
- Real PIE:
- Not run:

Remaining risks:
- ...
```

Never say a build, Blueprint verification, cook, package, real PIE test, or visual acceptance passed unless that exact validation actually ran and succeeded.

### UE5 Skill Areas Needed For This Project

Use these skill areas from `UE5 Skills.md` when the task touches Unreal:

- Project Discovery: `.uproject`, modules, plugins, maps, Config, dump availability.
- Unreal C++ Gameplay: Framework Actors, components, subsystems, combat playback, validation APIs.
- Blueprint Dump Analysis: only from exported JSON/Markdown/DOT, commandlet output, or pasted Blueprint node data; never raw binary assets.
- Blueprint Export Tooling: create or run UE export scripts when Blueprint behavior is needed but no dump exists.
- Editor Plugin / Commandlet: DataAsset/DataTable importers, level rebuild scripts, validation reports, asset registry scans.
- Python Automation: source-of-truth CSV/JSON generation, report builds, guarded UE commandlets, real PIE capture orchestration.
- DataAsset / DataTable: skills, Buffs, VisualCue rules, level nodes, encounters, growth curves, balance data.
- UI / UMG / CommonUI: combat HUD, unit plates, Buff icons, skill banner, view-model style state display.
- Niagara / Technical Art: damage numbers, Buff pulses, hit cues, mobile-friendly emitter parameters.
- Asset Safety: no direct `.uasset` text editing; generate reports before mass changes; let Unreal write Unreal assets.
- Build and Compile Fix: UBT/UHT/module dependency work; use UBA by default.
- Config: maps, mobile renderer, input, plugins, project settings.
- Performance: Tick, widget churn, sync loads, Niagara cost, material complexity, mobile device budgets.
- Validation and Reporting: scripts, commandlet logs, JSON reports, screenshot/pixel audits, real PIE proof.

### Unreal Hard Stops

Stop and ask before deleting or moving many assets, rewriting large Blueprint graphs, changing save formats, migrating engine version, changing core module names, or replacing the runtime data contract. Prefer a report-first tool over direct bulk asset edits.

## 5.1 Required Agent Roles

### Competitor Restore Agent

Responsibilities:

- Maintain APK/Lua/config/resource inventory.
- Rebuild `fzjh_restored_query.sqlite`.
- Track encrypted/missing/unknown files.
- Never guess combat logic without marking inference.

Skills needed:

- Lua table parsing.
- SQLite schema/view design.
- Android/adb/Frida basics.
- Evidence tagging.

### Combat Formula Agent

Responsibilities:

- Read FightFormula, HurtDegree, BuffEffect, BuffAdder, BuffDamage.
- Classify opcodes and formulas.
- Build formula/effect semantic indexes.
- Explain balance impact.

Skills needed:

- Combat math.
- Reverse-engineering discipline.
- Statistical validation.
- Warning/audit design.

### Runtime Slim Engine Agent

Responsibilities:

- Maintain `tools\simulate_combat_mvp.py`.
- Convert mirror inputs into executable events.
- Keep MVP baseline comparable.
- Emit contribution tables and warnings.

Skills needed:

- Python simulation architecture.
- Deterministic random/seeding.
- CSV/JSON schema handling.
- Batch regression and reporting.

### Unreal C++ Integration Agent

Responsibilities:

- Maintain UE C++ structs, DataTables, Actors, and import libraries.
- Keep CSV headers aligned with `FTableRowBase` fields.
- Run UBT after source changes.
- Expose design-time fields to Blueprint.

Skills needed:

- UE C++.
- DataTable import pipeline.
- Editor scripting.
- Build/debug workflow.

### CommonUI/Niagara Presentation Agent

Responsibilities:

- Build `WBP_CombatHud_Playtest`.
- Build Niagara damage number and cue systems.
- Route combat events to HUD and FX.
- Remove hardcoded TextRender from final presentation.

Skills needed:

- CommonUI.
- UMG widget architecture.
- Niagara user parameters.
- Lyra-style UI/FX separation.

### Level/Editor Tools Agent

Responsibilities:

- Build LevelFlow nodes, edges, encounters, and editor utilities.
- Make manual PIE testing ergonomic.
- Support node selection, preview, rewards, unlocks, and validation.

Skills needed:

- UE Actor design.
- Blueprint-exposed APIs.
- Details panel friendliness.
- Level generation scripts.

### QA Automation Agent

Responsibilities:

- Keep one-command smoke tests.
- Produce screenshots, JSON summaries, and failure reports.
- Validate Python and UE outputs stay aligned.

Skills needed:

- PowerShell/Python automation.
- Unreal commandlet usage.
- Screenshot/pixel/actor-count checks.
- Report generation.

### Technical Art / Mobile Performance Agent

Responsibilities:

- Define mobile-friendly render settings.
- Keep VFX lightweight.
- Manage LOD, material complexity, and device profiles.
- Replace competitor assets with shippable art.

Skills needed:

- Unreal mobile renderer.
- Niagara optimization.
- Material authoring.
- Asset budget management.

### Documentation / Producer Agent

Responsibilities:

- Keep progress reports readable.
- Maintain plans and acceptance criteria.
- Separate done, partial, blocked, and inferred.

Skills needed:

- Technical writing.
- Project planning.
- Risk tracking.
- QA checklist design.

## 6. Definition of Done

### Data task done

- Source files identified.
- Output CSV/JSON/SQLite generated.
- Counts reported.
- Unknown/inferred rows marked.
- Repro command documented.

### Python simulator task done

- Deterministic command exists.
- JSON/CSV output exists.
- Warnings are explicit.
- Regression or smoke result is reported.
- No missing mechanic silently becomes 0.

### Unreal C++ task done

- Code is synced to `H:\MyProjectBack\WuXiaProject`.
- UBT build passed after latest change using UBA unless an explicit fallback was approved.
- Any needed asset binding is documented.
- A commandlet or manual PIE verification path exists.

### Unreal visual task done

- Asset exists in Content.
- Actor or DataAsset references it.
- It is visible and readable in real PIE.
- Debug-only fallback is disabled by default.

## 7. Current Blocking Items

1. UE commandlet cannot reliably author protected WidgetTree internals in this environment. For FirstSession, the current accepted workaround is a generic runtime JSON layout builder in `UWuxiaFirstSessionRootWidget`: C++ builds only common widget types from `Content\Wuxia\SourceData\FirstSessionCommonUILayout`, while positions, text defaults, colors, and binding names remain data-driven. This is not final product skin, but it prevents empty shell widgets in PIE.
2. Niagara cue parameters are bound and validated, but the emitter graph/art itself still needs a technical-art pass in the Niagara editor.
3. `UnrealEditor-Cmd` remains invalid for final visual acceptance. The automated real-PIE path is now `tools\run_ue_real_pie_screenshot.py`: it launches full `UnrealEditor.exe`, starts PIE through the editor shortcut, verifies PIE from the v2 runtime report or `LogPlayLevel`, captures the live editor window, and then closes the session. Deterministic timeline rendering is auxiliary only.
4. `runtime_slim` still emits formula warnings for active hit/dodge, active parry, crit, and damageClass correction. `dexCondSkill` and `augment1Num` are closed in the 2026-06-20 duel output.
5. `buff_effect` semantics are no longer treated as complete just because a row has a label. Current 2026-06-20 evidence pass has `manual_effect_rows=0`, but 19 effect rows still need simulator binding after evidence-backed semantic classification.
6. Competitor art is internal research material only and must be replaced or remade for shipping.
7. The H-drive vertical Combat cleanup patch is prepared but not applied. Do not mark the black-block/graybox Combat view fixed until `运行UE_竖屏Combat舞台清理与PIE验收_20260620.bat` has produced a fresh real PIE screenshot and it is visually checked.

## 8. Recommended Next Order

1. Author the real `WBP_CombatRoot` / `WBP_CombatUnitPlate` WidgetTree in the editor from `Content\Wuxia\SourceData\FinalVisualPass`, keeping C++ as binding/state logic only.
2. Apply the vertical Combat cleanup patch to the H-drive UE project, rebuild the map, and capture a fresh real PIE screenshot.
3. Author the Niagara emitter graphs for damage, DoT, BuffAdd, and BuffPulse using the already-bound cue user parameters.
4. Use `tools\run_ue_real_pie_screenshot.py` plus `tools\audit_ue_pie_acceptance_report.py`; no final green result without a fresh screenshot whose session is proven to be real PIE.
5. Patch runtime_slim formula warnings in this order: active hit/dodge, active parry, damageClass correction, crit.
6. Bind evidence-backed BuffEffect semantics into runtime_slim next, especially `effectType=11` passive/base-attack mode and `effectType=150` recordDamage windows.
7. Add fixed acceptance duels beyond `RuntimeSlim_WaveVsNpc10_seed20260619`: poison needle vs iron palm, fast sword vs iron palm, and control vs poison.
8. Keep the old mirror viewer as a debug view only; put product presentation effort into UE.

## 9. Project Automation Skill

Project-specific Codex skill:

```text
.codex\skills\wuxia-project-automation
```

Primary runner:

```powershell
python .codex\skills\wuxia-project-automation\scripts\parallel_wuxia_agent_runner.py --profile combat --workers 4
```

One-click wrapper:

```text
运行Agent自动化并行检查.bat
```

Profiles:

- `quick`: parallel schema + runtime_slim smoke.
- `combat`: quick plus runtime numeric audit, semantic indexes, and effect dispatcher evidence.
- `full --include-ue`: combat plus serial UE smoke loop.

Rules:

- Run non-UE data checks in parallel.
- Keep UE build, UE commandlets, H-drive sync, adb, and Frida capture serial.
- Treat every task as failed unless it has an exit code, log file, and report row.

## 10. 2026-06-21 ResourceDelta Status

- `BlazeRebirth` / `NLMPJ14P1` / `NLMPJ14P2` is now classified as `resource_delta_neili` in the G-drive runtime_slim chain.
- Python outputs show 2 `ResourceDelta` events and 306 total neili/MP delta; these rows are not HP damage and must not drive HP bars.
- UE DataAsset source package exists at `outputs\ue_dataasset_stage_v7_resource_lane_20260621`.
- H-drive UE source edits for `EWuxiaCombatPreviewEventType::ResourceDelta`, unit MP delta application, playback routing, and HUD/floating cue text are not applied because the current Codex approval/usage gate rejected H-drive source modification.
- Do not mark ResourceDelta as PIE-accepted until the H-drive patch is applied, UBA build passes, and a real PIE screenshot/video proves MP/neili cue visibility without HP damage.

## 11. 2026-06-26 FirstSession Runtime Layout Status

- FirstSession binding source data is synced to `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionBinding`.
- FirstSession CommonUI-style layout source data is synced to `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionCommonUILayout`.
- `UWuxiaFirstSessionRootWidget` now has a generic JSON-driven runtime layout path. It reads `first_session_commonui_layout_contract.json` and creates the Root canvas, backdrop, and named text widgets at runtime.
- UBA build passed after this change: `WuXiaProjectEditor Win64 Development`.
- Runtime layout commandlet smoke passed:
  - `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionRuntimeLayoutSmoke_20260626.json`
  - `generated_layout_from_json=true`
  - required text bindings are present: step title, screen, primary action, requirement, acceptance, input hint.
- Flow commandlet smoke still passes:
  - `H:\MyProjectBack\WuXiaProject\Saved\WuxiaFirstSessionFlowSmoke_20260626.json`
  - 11 steps / 11 screens loaded
  - verified progression from `FS_001_OPENING_STORY` through `FS_005_IDLE_TASK_LIST`.
- FirstSession input bridge is now in place:
  - `UWuxiaFirstSessionRootWidget` handles Space / Enter / left mouse while it is the CommonUI leaf widget.
  - `AWuxiaFirstSessionFlowActor` passes itself to the root widget and gives it keyboard focus after creating it.
- Real PIE smoke evidence exists:
  - Initial FirstSession overlay screenshot: `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_real_pie_capture_20260626\first_session_real_pie.png`
  - After Space input screenshot: `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_real_pie_capture_inputbridge_20260626\first_session_inputbridge_real_pie.png`
  - Runtime report after Space reaches `FS_002_TITLE_START`.
- This is still not final product UI. It proves real PIE visibility and one-step input progression, but the current layout is still a dark debug card over the gray LevelFlow map and must be replaced with proper 9:16 first-session art/UI.

## 12. 2026-06-27 Competitor Config Flow Spine Status

- First chapter work must not be driven by UI-only demo routes. The current source-of-truth bridge is now:
  - `G:\codex\武侠掌门放置挂机\outputs\competitor_config_flow_spine_20260627\flow_spine_runtime.json`
  - `G:\codex\武侠掌门放置挂机\outputs\competitor_config_flow_spine_20260627\system_flow.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\competitor_config_flow_spine_20260627\evidence_registry.csv`
- Generator:
  - `python tools\build_competitor_config_flow_spine_20260627.py`
- Audit status:
  - generator audit: `pass`
  - planning validator: 161 checks / 0 errors
- Preserved competitor scope:
  - original fb01 rooms: 45
  - project portrait adapter nodes: 7
  - system flow rows: 12
  - reward pacing rows: 183
  - evidence rows: 84
  - first-session hangup reward bindings: 16
- Mainline gates are evidence-backed: entry, old housekeeper, Zhao coach, Zhou coach, Zhang Feng.
- Early hangup entries preserve competitor fields: unlock role exp, unlock map, click CD, click limit, click award class, and auto award class.
- `flow_spine_runtime.json` now includes `hangup_reward_resolution`, which points to the expanded HangUpTask reward class package and Lua-backed reward formulas.
- Four original rooms are intentionally left as review debt instead of guessed mapping:
  - `fb01_30`, `fb01_40`, `fb01_41`, `fb01_42`
- Next UE work must bind map node selection and early combat through `flow_spine_runtime.json`. Any standalone demo constant path for first chapter flow is now debt.
- `tools\simulate_first_session_mvc_flow_20260626.py` reads the flow spine for legacy MVC smoke state and preserves competitor reward class fields such as `click_award_class=100012`.
- `tools\simulate_first_session_client_runtime_flow_20260627.py` expands the first reward class through `hangup_reward_resolution`; `HANGUP_10001` click reward is now evidence-backed as `exp +200` and `pot +200`.
- Current honest flow warnings after the flow-spine smoke:
  - `route_selects_non_combat_node_but_enters_combat:NODE_FB01_Gate`
  - `runtime_slim_timeline_must_be_bound_before_final_pie`
- Do not mark first chapter flow complete until the default map route selects a valid combat/BossCombat node or explicitly passes through node detail/NPC interaction before combat.

## 13. 2026-06-27 Client Runtime / Server Sync Boundary

- Project server boundary is now explicit: server only handles Login, SyncSave, and SyncCheckpoint.
- Gameplay flow is client-runtime/config driven:
  - first-session action routing
  - chapter node gates
  - idle/hangup reward classes
  - NPC interaction routing
  - combat preview trigger
  - ViewModel and VisualCue routing
- New source-of-truth package:
  - `G:\codex\武侠掌门放置挂机\outputs\client_runtime_sync_contract_20260627\client_runtime_sync_contract.json`
  - `G:\codex\武侠掌门放置挂机\outputs\client_runtime_sync_contract_20260627\client_action_route.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\client_runtime_sync_contract_20260627\server_sync_contract.csv`
- New tools:
  - `python tools\build_client_runtime_sync_contract_20260627.py`
  - `python tools\simulate_first_session_client_runtime_flow_20260627.py`
- Validation:
  - client runtime contract: pass
  - planning validator: 22 checks / 0 errors
  - client runtime smoke: pass
  - server APIs used by smoke: `Login`, `SyncSave`, `SyncCheckpoint`
  - first-session reward bindings included in contract: 16
  - first idle click reward expands to `1000121 exp +200` and `1000122 pot +200`; server only syncs the local save result.
- Compatibility note:
  - `first_session_server_command.csv` still exists because older UE sync scripts reference the filename.
  - Its `Authority` is now `client_config_runtime`, not `server_authoritative`.
  - Treat that file as a legacy-named runtime command table until UE sync scripts are renamed.
- Remaining flow debt:
  - `NODE_FB01_Gate` is a Story node but current first-session demo route enters combat from it.
  - Fix by routing Gate to node detail/NPC interaction first, or by selecting a valid Combat/BossCombat node from flow spine.

## 14. 2026-06-27 HangUpTask Reward Class Expansion

- New generator:
  - `python tools\build_hangup_award_class_index_20260627.py`
- New source-of-truth package:
  - `G:\codex\武侠掌门放置挂机\outputs\hangup_award_class_index_20260627\hangup_award_runtime.json`
  - `G:\codex\武侠掌门放置挂机\outputs\hangup_award_class_index_20260627\hangup_award_rows.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\hangup_award_class_index_20260627\hangup_task_reward_binding.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\hangup_award_class_index_20260627\first_session_hangup_reward_binding.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\hangup_award_class_index_20260627\hangup_reward_formula.csv`
- Competitor evidence sources:
  - `res/script/HangUpTask/hangUpTaskConfig.lua`
  - `res/script/HangUpTask/hangUpTaskRewardConfig.lua`
  - `res/script/HangUpTask/hangUpTaskConst.lua`
  - `src/app/models/Task2/TaskRewardFactory.lua`
  - `src/app/models/Task2/PlayerHangUpTaskReward.lua`
  - `src/app/models/Task2/PlayerHangUpTask.lua`
  - `src/app/models/Task2/HangUpReward/CalHangUpTaskRewards.lua`
- Confirmed reward semantics:
  - `awardType=1` means `exp`.
  - `awardType=2` means `pot`.
  - `awardType=3` means `money`.
  - `awardNumType=0` means fixed `baseAward`.
  - `awardNumType=1` means per-second formula using `kongfu`, `luck`, `inheritAddition`, `shiSiZhenAddition`, and `yaShiAddition`.
- Audit:
  - 12 HangUpTask rows
  - 55 reward rows
  - 23 award classes
  - 56 task/reward bindings
  - 16 first-session bindings
  - 0 missing award classes
  - 0 unknown reward type rows
- Server boundary remains unchanged: gameplay reward resolution is local config runtime; server only stores the synced save/checkpoint.

## 15. 2026-06-28 FirstSession V5 Chapter-One Map/Combat UI Polish

- New generator:
  - `python tools\build_ue_first_session_screen_layout_v5_chapter1_polish_20260628.py`
- New audit:
  - `python tools\audit_ue_first_session_v5_chapter1_polish_20260628.py`
- One-command acceptance wrapper:
  - `python tools\run_ue_first_session_v5_chapter1_acceptance_20260628.py`
  - `python tools\run_ue_first_session_v5_chapter1_acceptance_20260628.py --skip-pie`
- Source-of-truth package:
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_screen_layout_v5_chapter1_polish_20260628\first_session_screen_layout_contract.json`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_screen_layout_v5_chapter1_polish_20260628\first_session_screen_layout_widgets.csv`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_screen_layout_v5_chapter1_polish_20260628\manifest.json`
- Synced UE SourceData:
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\first_session_screen_layout_contract.json`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\first_session_screen_layout_widgets.csv`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\manifest.json`
- V5 replaces only:
  - `UI_MapExplore`
  - `UI_EarlyCombat`
- Real PIE acceptance, not offline render:
  - `first_session_v5_fs008_map`: pass, runtime at `FS_008_MAP_EXPLORE / UI_MapExplore`, command `CmdSelectChapterNode`, no runtime error.
  - `first_session_v5_fs009_combat`: pass, runtime at `FS_009_EARLY_COMBAT / UI_EarlyCombat`, command `CmdStartCombatPreview`, no runtime error.
- Acceptance evidence:
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_fs008_map_t03000ms_real_pie.png`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_fs009_combat_t03000ms_real_pie.png`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_chapter1_polish_audit.json`
- Audit result:
  - status: `pass`
  - error count: `0`
  - layout widgets: `244`
  - forbidden player-facing debug words: none found
- Acceptance wrapper result:
  - `--skip-pie` against the current real PIE evidence: `pass`
  - combined output: `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_chapter1_acceptance_summary.json`
- Competitor consistency follow-up:
  - New audit: `python tools\audit_first_session_competitor_vs_ue_v5_20260628.py`
  - Sources compared: competitor recording flow, competitor config flow spine, client action route, and UE V5 layout widgets.
  - Result after fix: `pass`, `issue_count=0`.
  - Fixed high-risk issue: removed hardcoded combat result copy from `UI_EarlyCombat` (`-35`, `受到 35 点伤害`, `闪避失败`).
  - Replacement bindings:
    - `CombatTimeline.LatestFloatingText`
    - `CombatTimeline.LatestResultText`
    - `CombatTimeline.RecentEvents`
  - Fresh real PIE FS009 screenshot was captured after syncing the corrected UE SourceData:
    - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v5_chapter1_polish_pie_20260628\first_session_v5_fs009_combat_t03000ms_real_pie.png`
- Current status:
  - This is a real PIE-readable 9:16 UI baseline for chapter-one map and early combat.
  - It is not final product-grade art yet. CommonUI style assets, Niagara jump text, real unit art, Buff icons, hit effects, audio, and chapter art packaging remain open work.
  - Combat result display is now an event-binding placeholder. It must be connected to runtime_slim CombatTimeline before claiming real combat playback.
- Do not mark chapter-one first-session UI complete until the same real PIE acceptance covers character creation, idle/hangup rewards, map exploration, combat playback, and NPC interaction in one continuous run.

## 16. 2026-06-28 FirstSession V6 CommonUI-Flow Correction

- User rejected the V5 screen as gray-box quality. That rejection is valid.
- Current correction moved FirstSession from simple `Border/TextBlock/Button` gray-box rows toward a CommonUI-flow data contract:
  - `Screen -> ComponentId -> StyleToken -> MotionCue -> ActionRoute`
- New generator:
  - `python tools\build_ue_first_session_screen_layout_v6_commonui_flow_20260628.py`
- New audit:
  - `python tools\audit_first_session_v6_commonui_flow_20260628.py`
- New source package:
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_screen_layout_v6_commonui_flow_20260628`
- New real PIE evidence:
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v6_commonui_flow_pie_20260628\first_session_v6_fs008_map_t03000ms_real_pie.png`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v6_commonui_flow_pie_20260628\first_session_v6_fs009_combat_t03000ms_real_pie.png`
- C++ generic capability added:
  - `FWuxiaFirstSessionLayoutWidgetRow::AssetPath`
  - `WidgetType=Image`
  - data-driven `UTexture2D` load via `AssetPath`
- UBA build:
  - command: `Build.bat WuXiaProjectEditor Win64 Development H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject -UBA`
  - result: `Succeeded`
- V6 audit result:
  - status: `pass`
  - error count: `0`
  - widget count: `224`
  - component count: `224`
  - style token count: `9`
  - motion cue count: `4`
- Synced UE SourceData:
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\first_session_screen_layout_contract.json`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\first_session_screen_layout_widgets.csv`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\commonui_style_tokens.csv`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\commonui_motion_cues.csv`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\FirstSessionScreenLayout\first_session_commonui_component_contract.csv`
- Honest status:
  - V6 is an improved, real PIE-running CommonUI-flow baseline.
  - V6 is still not final product-grade UI.
  - It still uses the C++ data interpreter for runtime construction.
  - It still needs real Widget Blueprint/CommonUI Style assets, runtime_slim CombatTimeline binding, Niagara, unit animation, Buff icons, and full chapter-one interactive flow.
- Do not claim product-grade combat until real PIE shows unit-bound HP change, Buff update, target-bound floating text, and skill rhythm from runtime_slim events.

## 17. 2026-06-28 FS008 Evidence Correction

- User flagged that the V6 `UI_MapExplore` selected-node detail card did not match competitor content. The flag was correct.
- Wrong FS008 player-facing copy removed:
  - `前厅试手`
  - `进入武馆前厅，观察基础招式与早期战斗节奏`
  - `门槛：经验 1000 · 池边打鱼 5 次`
  - `奖励：经验 / 潜能 / 武学线索`
- FS008 now follows the competitor recording frame:
  - top: `状态 / 石路 / 离开`
  - description: `你走在一条石板路上，前面就是大门了。`
  - exits: `大门`, `石路`
  - present NPC/interactable: `车夫`
  - bottom exploration log from the recording frame
- Evidence:
  - `G:\codex\武侠掌门放置挂机\outputs\competitor_recording_flow_20260625\wmp_frames_1fps\frame_450s.png`
  - `G:\codex\武侠掌门放置挂机\outputs\ue_first_session_v6_evidence_fix_pie_20260628\first_session_v6_fs008_map_evidence_fix3_t03000ms_real_pie.png`
- Audit:
  - `python tools\audit_first_session_v6_commonui_flow_20260628.py`
  - status: `pass`
  - error count: `0`
- UE Content cleanup:
  - Do not sync helper CSV files such as `commonui_style_tokens.csv`, `commonui_motion_cues.csv`, or `first_session_commonui_component_contract.csv` directly into UE Content, because they trigger DataTable import dialogs and pollute real PIE screenshots.
  - Keep helper CSVs in G output packages; sync only runtime-required layout JSON/widgets unless a proper UE import pipeline is explicitly run.
- Remaining debt:
  - `大门` and `车夫` still need distinct ActionRoute bindings. Do not keep all room interactions as generic `AdvanceStep`.

## 18. 2026-06-28 FS008 ActionRoute + Code/Config Audit

- User requested line-by-line code/config audit against competitor evidence and continuation of the next step.
- New audit:
  - `python tools\audit_first_session_code_config_vs_competitor_20260628.py`
  - output: `outputs\first_session_code_config_vs_competitor_audit_20260628\iteration_fix_task_list.csv`
  - current result: `fail`, 3 high tasks.
- New data patch:
  - `python tools\patch_first_session_fs008_action_routes_20260628.py`
  - output: `outputs\first_session_fs008_action_routes_20260628\first_session_action_route.csv`
  - added:
    - `ACT_FS_008_MAP_EXPLORE_ENTER_GATE`
    - `ACT_FS_008_MAP_EXPLORE_TALK_COACHMAN`
- UE generic C++ capability added:
  - `FWuxiaFirstSessionLayoutWidgetRow::ActionId`
  - `UWuxiaFirstSessionActionButton`
  - `Interaction=ExecuteAction` calls `AWuxiaFirstSessionFlowActor::ExecuteActionById(ActionId)`.
  - `RoutesByStepId` now keeps the first route for a StepId so extra same-step ActionRoutes do not override the primary route.
- V6 layout:
  - widget count: `220`
  - `BTN_GateExit` -> `ACT_FS_008_MAP_EXPLORE_ENTER_GATE`
  - `BTN_Coachman` -> `ACT_FS_008_MAP_EXPLORE_TALK_COACHMAN`
- UBA build:
  - command: `Build.bat WuXiaProjectEditor Win64 Development H:\MyProjectBack\WuXiaProject\WuXiaProject.uproject -UBA`
  - result: `Succeeded`
- Real PIE evidence:
  - PIE started successfully in retry/click runs, verified by `LogPlayLevel`.
  - automation did not reach FS008; latest click run reached `03/11`.
  - screenshots:
    - `outputs\first_session_fs008_action_route_real_pie_20260628_retry\fs008_action_route_retry_t03000ms_real_pie.png`
    - `outputs\first_session_fs008_action_route_real_pie_20260628_click2\fs008_action_route_click2_t03000ms_real_pie.png`
- Current blocking tasks:
  - `fb01_01/01a/01b/01c` are still over-compressed into one `NODE_FB01_Gate`; add room-level ViewModel or sub-node state.
  - CSV files under UE Content trigger the editor source-file import dialog during PIE; move source data or change extension/loading path.
  - PIE multi-screen acceptance must click by current ScreenId/ActionRoute/CTA instead of fixed coordinates.
- Do not claim login-to-FS008 continuous PIE acceptance is complete until a fresh real PIE run reaches FS008 and validates the new `大门` / `车夫` ActionIds.

## 19. 2026-06-28 FirstSession Real PIE 11/11 Closure

- Fresh real PIE mouse acceptance is now complete for the current FirstSession flow.
- Final evidence:
  - `outputs\first_session_sequence_pie_20260628_full_mouse_to_11\first_session_full_mouse_to_11_t03000ms_real_pie.png`
  - `outputs\first_session_sequence_pie_20260628_full_mouse_to_11\first_session_full_mouse_to_11_summary.json`
- Final runtime state:
  - `current_step_id=FS_011_CHAPTER_LOOP_RETURN`
  - `current_screen_id=UI_ChapterLoop`
  - `trace_count=11`
  - `last_error=""`
- Full traced server-command chain:
  - `CmdAcknowledgeOpening`
  - `CmdCreateDefaultCharacter`
  - `CmdOpenIdleTaskEntry`
  - `CmdStartIdleTask`
  - `CmdClaimIdleReward`
  - `CmdOpenGrowthHub`
  - `CmdEnterChapter`
  - `CmdSelectChapterNode`
  - `CmdStartCombatPreview`
  - `CmdNpcInteraction`
  - `CmdContinueChapterLoop`
- UE Content CSV popup mitigation:
  - FirstSession runtime files should use `.wcsv` when they are loaded directly by the runtime CSV reader.
  - Do not place helper `.csv` files under UE Content unless they are meant for explicit DataTable import.
- Tooling:
  - `tools\run_ue_real_pie_screenshot.py` supports `--post-pie-click-sequence`.
  - Current mouse acceptance coordinates include the PIE title-bar offset. Next improvement should click by `ScreenId + WidgetName/ActionId` instead of handwritten coordinates.
- C++ runtime UI input fix:
  - Generated FirstSession buttons use `OnPressed` as the single action entry.
  - Generated buttons set mouse/touch/press methods to down/press semantics.
  - Generated buttons contain a config-sized `USpacer` to stabilize hit geometry.
- Remaining debt:
  - Visual quality is still not product grade.
  - `fb01_01 / fb01_01a / fb01_01b / fb01_01c` are still over-compressed into the current map flow.
  - `FS_009_EARLY_COMBAT` is still a flow/combat placeholder and must be connected to runtime_slim combat playback before claiming full battle quality.

## 20. 2026-06-29 fb01 Seven-Node Room Chain Package

- User asked to continue from the broken point and keep following competitor config/code flow rather than only UI mockups.
- New generator:
  - `tools\build_fb01_room_chain_package_20260629.py`
  - output: `outputs\fb01_room_chain_package_20260629`
- New smoke test:
  - `tools\simulate_fb01_room_chain_20260629.py`
  - result: `status=pass`, `node_count=7`, `edge_count=8`, `route_count=7`, `missing_flags=[]`.
- Planning package validator:
  - `python C:\Users\kallery\.codex\skills\wuxia-game-planning\scripts\validate_planning_package.py --package outputs\fb01_room_chain_package_20260629`
  - result: `status=ok`, `check_count=17`, `error_count=0`.
- UE SourceData sync:
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\Chapter1RoomFlow`
  - synced files:
    - `fb01_room_nodes.csv`
    - `fb01_room_edges.csv`
    - `fb01_room_action_routes.csv`
    - `fb01_room_rewards.csv`
    - `fb01_room_runtime_contract.json`
    - `evidence_registry.csv`
    - `acceptance.csv`
    - `audit_summary.json`
- Seven project nodes:
  - `NODE_FB01_OUTER_GATE`
  - `NODE_FB01_FRONT_YARD`
  - `NODE_FB01_MAIN_HALL`
  - `NODE_FB01_OWNER_WING`
  - `NODE_FB01_TRAINING_FIELDS`
  - `NODE_FB01_BACKYARD_WORK`
  - `NODE_FB01_SETTLEMENT_LOOP`
- Evidence status:
  - main flags `mapbj2/mapbj4/mapbj5/mapbj1` are represented.
  - original competitor room graph remains in `outputs\fzjh_chapter1_planning_audit_20260622\chapter1_level_nodes.csv`.
  - the 7-node layout is a project portrait compression, not the restored competitor room count.
- Current remaining debt:
  - UE runtime must read `Chapter1RoomFlow` and replace the old demo node layout.
  - combat nodes must launch runtime_slim playback, not debug panels.
  - branch nodes must open product CommonUI node detail.
  - no player-facing completion claim until fresh real PIE screenshot/video shows readable node UI and click-through behavior.

## 21. 2026-06-29 fb01 UE LevelSeed + RuntimeSlim Event Chain Closure

- Continued from the seven-node package and synced the compressed fb01 room chain into UE LevelSeed data.
- New generator:
  - `tools\build_ue_level_seed_from_fb01_room_chain_20260629.py`
  - output: `outputs\ue_level_seed_from_fb01_room_chain_20260629`
- Synced UE source data:
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\LevelSeedCSV`
  - `H:\MyProjectBack\WuXiaProject\Content\Wuxia\SourceData\Chapter1RoomFlow`
- Updated UE contract:
  - `H:\MyProjectBack\WuXiaProject\Config\WuxiaDemoContract.json`
  - `active_chapter_id=CH_FZJH_FB01`
  - `pie_acceptance.auto_request_preview_node_id=NODE_FB01_MAIN_HALL`
  - demo unit data now matches the runtime_slim timeline units: `waveCrashingSand` vs `BlazeRebirth`.
- UE commandlet chain:
  - `import_wuxia_level_seed_content.py`: success.
  - `create_wuxia_level_flow_demo.py`: success.
  - `apply_wuxia_fixed_battle_timeline.py`: fixed path resolution and success.
  - `smoke_wuxia_level_flow_demo.py`: success.
- Important fix:
  - `H:\MyProjectBack\WuXiaProject\Content\Python\apply_wuxia_fixed_battle_timeline.py` no longer depends first on the external Chinese workspace path, which Unreal commandlets mojibaked.
  - The script now prefers the project-local cache: `Saved\WuxiaSourceData\FixedBattle\ActiveCombatTimeline_ue.json`.
- Latest structural smoke:
  - report: `H:\MyProjectBack\WuXiaProject\Saved\WuxiaLevelFlowSmoke_20260617.json`
  - `node_count=7`
  - `edge_count=8`
  - `nodes_with_combat_playtest=1`
  - `initial_playback_event_count=44`
  - `fixed_playback_event_count=44`
  - `post_preview_playback_event_count=44`
  - gameplay/data warnings: `[]`
- Real PIE acceptance status:
  - attempted: `python tools\run_ue_real_pie_screenshot.py --map /Game/Wuxia/Maps/L_LevelFlowDemo ...`
  - output: `outputs\real_pie_acceptance_20260629_fb01_chain_map_probe\fb01_chain_map_probe_summary.json`
  - result: failed before visual capture because no visible Unreal Editor main window appeared.
  - tool improvement: `tools\run_ue_real_pie_screenshot.py` now supports `--attach-existing-editor` so acceptance can use an already visible WuXiaProject editor window instead of launching a new editor process.
  - Do not claim player-facing visual completion from this commandlet smoke. The next task must be a fresh real PIE run from an already visible editor window or a repaired editor-launch automation path.
- Current completed scope:
  - fb01 7-node source package exists.
  - UE LevelFlow map now has 7 data-driven fb01 nodes.
  - `NODE_FB01_MAIN_HALL` is bound to runtime_slim fixed battle case `RuntimeSlim_WaveVsNpc10_seed20260619`.
  - Fixed timeline binding has 44 events and no data-contract mismatch warnings.
- Current remaining debt:
  - real PIE screenshot/video still blocked by editor window launch automation.
  - visual quality remains unaccepted until the user can open PIE and see readable 9:16 node UI plus combat stage.
  - branch nodes still need product CommonUI detail screens and action routing beyond structural data.

## 22. 2026-06-30 Real PIE Combat Entry + Acceptance Tool Repair

- Continued the fb01 UE LevelFlow acceptance chain.
- Fixed `tools\run_ue_real_pie_screenshot.py`:
  - recognizes Chinese UE editor title `虚幻编辑器`;
  - adds `--attach-window-handle` for explicit HWND attach when Win32 enumeration cannot see the editor window;
  - fixes explicit-HWND attach state being cleared before the wait loop.
- Fixed default selected node drift:
  - added generic `InitialSelectedNodeId` to `AWuxiaLevelFlowInputActor`;
  - `BeginPlay` now selects the configured node before falling back to sorted index 0;
  - `WuxiaDemoContract.json` sets `pie_acceptance.initial_selected_node_id=NODE_FB01_MAIN_HALL`;
  - `create_wuxia_level_flow_demo.py` writes the configured initial selected node.
- UBA build:
  - `WuXiaProjectEditor Win64 Development -UBA`: succeeded.
- UE commandlet sequence after rebuild:
  - `create_wuxia_level_flow_demo.py`: success.
  - `apply_wuxia_fixed_battle_timeline.py`: success, 44 events.
  - `smoke_wuxia_level_flow_demo.py`: success, `node_count=7`, `edge_count=8`, `initial/fixed/post_preview_event_count=44`, warnings `0`.
- Real PIE state acceptance:
  - UE Remote Python `editor_request_begin_play()` successfully entered PIE.
  - PIE Map report: `world_type=PIE`, `current_view=Map`, `selected_node_id=NODE_FB01_MAIN_HALL`, `selected_combat_case=RuntimeSlim_WaveVsNpc10_seed20260619`.
  - PIE Combat report after `RequestSelectedNodePreview()`: `current_view=Combat`, `visible_combat_hud_count=1`, `combat_hud_with_content_count=2`, `playback_actor_count=2`.
  - archived report: `outputs\real_pie_acceptance_20260630_remote_begin_play\WuxiaPieAcceptance_Combat_Latest.json`.
- Visual screenshot status:
  - `outputs\real_pie_acceptance_20260630_remote_begin_play\fb01_combat_remote_pie_highres.png` exists, but it only captures the 3D scene and does not include CommonUI/HUD.
  - Windows desktop screenshot and UE UI automation screenshot are not yet reliable in the current automation session.
  - Therefore visual/product acceptance is still not passed, even though real PIE state has reached Combat.
- Current remaining debt:
  - implement a reliable real PIE UI screenshot/video capture path that includes CommonUI/HUD;
  - route `NODE_FB01_MAIN_HALL` through data-driven ActionRouter instead of relying on direct preview calls;
  - improve product presentation: unit-bound HP/MP, Buff icon, jump text, skill rhythm, and hide debug/test UI from player view.

## 23. Current Working State - 2026-06-30 fb01 ActionRouter Bridge Fixed, Combat Visual Blocked By FirstSession Overlay

This block supersedes any claim that the current UE combat view is visually accepted. Real PIE state acceptance and real window capture are now required; offline or commandlet images are diagnostics only.

- Added `tools/capture_window_by_hwnd.py` for real Windows HWND screenshots of the UE editor/PIE window.
- Added `tools/build_fb01_room_action_router_bridge_20260630.py`.
- Generated `outputs/fb01_room_action_router_bridge_20260630` from the restored fb01 7-node room-chain package.
- Synced the generated bridge into UE SourceData under `Chapter1RoomFlowActionRouterBridge` and updated `WuxiaDemoContract.json` to read it.
- Real PIE validation after the bridge switch now resolves `NODE_FB01_MAIN_HALL` as:
  - `route=ROUTE_ACT_CH1_SELECT_MAIN_HALL`
  - `gate=pass`
  - `next=UI_EarlyCombat`
  - `view=Combat`
- Remaining blocker: FirstSession RootWidget still overlays Combat in real PIE because it is added at viewport Z order 60 and the LevelFlow/Combat view switch does not yet hide it.
- Required next C++ fix, pending H: write/build approval availability:
  - Add configurable `bHideFirstSessionHudInCombatView` to `AWuxiaLevelFlowInputActor`.
  - Hide `AWuxiaFirstSessionFlowActor::RootWidget` when entering Combat and restore it when returning to Map.
  - Build with UBA and re-run real PIE window screenshot acceptance.
- Current visual status: not accepted. Combat HUD exists but is partially obscured by FirstSession UI; this must not be represented as product-level quality.

## 24. Current Working State - 2026-06-30 FirstSession Combat Overlay Fixed In Real PIE

This block updates section 23: the fb01 main-hall ActionRouter bridge and the FirstSession overlay blocker are now fixed in a compiled UE build.

- C++ changed generically in `AWuxiaLevelFlowInputActor`:
  - `bHideFirstSessionHudInCombatView = true`.
  - `ShowCombatView()` collapses `AWuxiaFirstSessionFlowActor::RootWidget`.
  - `ShowMapView()` restores the FirstSession RootWidget.
  - No concrete node, skill, Buff, reward, or asset IDs were hardcoded in runtime C++ for this fix.
- Built with UBA:
  - `WuXiaProjectEditor Win64 Development ... -UBA`
  - Result: `Succeeded`.
- Real PIE validation after the patch:
  - `selected=NODE_FB01_MAIN_HALL`
  - `view=Combat`
  - `route=ROUTE_ACT_CH1_SELECT_MAIN_HALL`
  - `gate=pass`
  - `next=UI_EarlyCombat`
  - `WuxiaPieAcceptance_AfterFirstSessionHidePatch.json` status is `ok`.
- Real window screenshot evidence:
  - `outputs/real_pie_acceptance_20260630_remote_begin_play/fb01_combat_after_firstsession_hide_patch_printwindow.png`.
- Current visual status: the blocker is fixed, but the demo is still not product-level. Units, stage, Buff icons, Niagara jump text, and CommonUI visual polish remain the next major work.
