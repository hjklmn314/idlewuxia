# AUDIT-003 Current Production Status Re-audit — 2026-08-12

## 1. Authority and verdict

- **Authoritative project:** `H:/MyProjectBack/idlewuxia`
- **Audit baseline commit:** `41a65662f9e147576b6e0ca1a2df0d271d158ae8` (runtime/audit correction commit: `43cb4b8be827ca1ca7732358f08089315aa31563`)
- **Audit scope:** active HTML/Capacitor Wuxia product only. `G:/codex` is historical/evidence storage and is not an implementation source.
- **Audit mode:** three gates in order: Gate A static/contract, Gate B runtime/regression, Gate C real-browser/manual visual and Android acceptance.
- **Audit verdict:** `PASS WITH KNOWN LIMITATIONS` for the audit process and evidence integrity.
- **Product/release verdict:** `RELEASE_BLOCKED_ACTIVE_REMEDIATION`.

The audit does not promote a functional prototype to a release candidate. In particular, the combat state machine is complete and configuration-driven, while the production combat presentation, owned assets, Android device evidence and release artifact gates remain blocked.

## 2. Reading and coverage ledger

The full-release ledger was regenerated from the authoritative worktree after the audit-tool corrections. It read every tracked project file and every present project file in the bounded project scope; generated outputs are evidence, not source authority.

| Coverage item | Result |
|---|---:|
| Tracked files read | 415 |
| Present project files read | 415 |
| Text files / binary files | 410 / 5 |
| Text lines read | 100,498 |
| Project bytes read | 4,170,091 |
| Commits in the previous five-day window | 21 |
| Files touched by that window | 139 |
| Runtime/config/document/tool categories | all covered |
| Resources on disk | 47 |
| Tracked resources / ignored or untracked resources | 1 / 46 |
| JSON parse failures | 0 |
| JavaScript syntax failures | 0 |

Authoritative machine evidence:

- `outputs/full_release_audit_20260804/full_release_audit_ledger.json`
- `outputs/full_release_audit_20260804/full_file_ledger.csv`
- `outputs/full_release_audit_20260804/resource_ledger.csv`
- `outputs/full_release_audit_20260804/findings.csv`

The 46 ignored/untracked resources are not silently promoted to shipping assets. Their provenance and shipping eligibility remain governed by the asset registry and the development-only original-project overlay.

## 3. Gate A — static, schema and boundary audit

### Passed checks

- `npm run production:validate`: pass; 6 production configs, 8 gates, 45 tasks, 13 subsystems, 11 screens, 3 viewports, 33 screen/viewport pairs, 17 tools, 0 schema findings.
- `npm run production:inventory`: pass; 414 files, 97 JSON files, 0 JSON parse failures.
- `npm run wuxia:audit:content-boundary`: strict pass; high-risk hard-coded content boundary findings are 0. Runtime content remains in configuration and the active chapter is enumerated from configuration.
- `npm run audit:p1p2`: 5 pass, 1 gap, 0 errors. The only gap is the known backend/store SKU mapping gap: 24 configured products are still `backend_pending`.
- `npm run wuxia:audit:online-standard`: intentionally non-zero for production reasons only: 11 P0 findings consisting of 10 open production asset slots and one manual visual gate. The previous three false P1 dynamic-template asset findings are removed.
- Evidence-contract, production OS, visual-standard and asset-registry schemas remain valid.

### Audit-tool corrections made in this re-audit

1. `tools/audit-p1p2-open-items.mjs` now evaluates the active entry point. The legacy Boss debug-hook rule is enforced when the legacy shell is active, while the active Wuxia shell passes when no legacy Boss DOM/handler exists.
2. `tools/audit-wuxia-stage-online-standard.mjs` no longer treats runtime template placeholders such as `${escapeHtml(iconUrl)}` and `${escapeHtml(referenceSceneUrl)}` as literal missing files. Logical asset IDs are checked by the production AssetRegistry contract and the reference-overlay validator.

No gameplay behavior, chapter content or combat formula was changed by these corrections. They only remove stale/false audit findings and keep the audit aligned with the active Wuxia entry.

## 4. Gate B — runtime and regression audit

The complete `npm run task:preflight` chain exited successfully. The important runtime results are:

| Runtime area | Result | Evidence |
|---|---|---|
| Config-driven content boundary | PASS; high-risk findings 0 | `npm run wuxia:audit:content-boundary` |
| FB01 action state assertions | PASS; 358/358 | `npm run runtime:action-state-assertions:test` |
| Interaction semantics | PASS; 358 actions, high-risk 0 | `outputs/wuxia_fb01_interaction_coverage/` |
| Result-token runtime coverage | PASS; 316 rows, P0 0, P1 0 | `outputs/wuxia_fb01_result_token_runtime_coverage/` |
| Combat content/module contract | PASS; 26 skills, 16 buffs, 7 selectors, 6 damage types | combat module validators/tests |
| CombatSession mechanics | PASS; positive and negative probes for control, reflect, silence, root, modifiers, true damage, area, ally and taunt | combat session test suite |
| Chapter combat integration/result routing | PASS; configured sessions and fail-closed terminal routing | `runtime:combat-chapter-integration:test`, `runtime:combat-result-routing:test` |
| Replay/pause/save restore | PASS in browser/runtime scope | `COMBAT-003`, `SAVE-001`, `OBS-001` suites |
| Balance simulation | PASS; 6 scenarios × 200 runs | `outputs/combat_simulation/combat_simulation_report.json` |
| Known first-session lifecycle mismatch | **separate tracked limitation** | `FIRST_SESSION_SIMULATION_LIFECYCLE`; excluded from the UI verdict |

The known first-session simulation mismatch is not merged into the current online-standard findings and is not used to mask any combat, chapter or UI failure. It remains explicitly separate as required by the project acceptance policy.

## 5. Gate C — real-browser and manual visual acceptance

The real Edge sweep was rerun with the active registry and the configured 360×800, 390×844 and 412×915 viewports:

- 11 active screens × 3 viewports = 33 active cases.
- Conditional chapter-loop route: 3/3 viewports pass.
- Configured modal route: 3/3 cases pass.
- Observed screens: 11; observed pairs: 33; coverage gaps: 0.
- Page-console errors/warnings: 0.
- Browser flow failures/blockers: 0.
- Report: `outputs/wuxia_visual_matrix/audit_20260812_current/browser_surface_sweep_report.json`.

Manual screenshots were inspected for `UI_EarlyCombat`, `UI_NpcInteraction`, `UI_ChapterLoop` and `UI_CharacterStatus` at the Android baseline viewport. The functional route is usable, but the strict production visual verdict is **FAIL**:

- `UI_EarlyCombat` still renders CSS/geometric placeholder fighters and a dark grey placeholder stage rather than approved side-view, approximately three-head pixel actors and a clean battle scene.
- Authored production VFX, Buff frames and OGG/SFX/BGM are not present; the original-project overlay is development-only and cannot satisfy shipping.
- NPC, chapter and status screens are functionally readable but remain prototype-level UI/art and have not passed the requested production visual bar.
- No physical Android-device touch, audio-latency, performance, cold-start, background/foreground or signed-release evidence exists in this audit.

Therefore, browser functional PASS does not promote `T05-01`, `COMBAT-002B` or `COMBAT-002` to done.

## 6. Domain verdict matrix

| Domain | Current verdict | Why |
|---|---|---|
| Combat runtime | **PASS** | Real deterministic `CombatSession`, config-driven skills/Buffs/targets/damage/control, manual turns, replay/pause/save restore, result routing and simulation are implemented and tested. |
| Combat presentation | **BLOCKED** | Approved side-view actors, clean scene, VFX/Buff and owned OGG audio are missing; current fallback is visible and rejected for production. |
| Chapter runtime | **GENERIC/REUSABLE PASS** | `src/chapterSession.js` resolves `initialChapter` and builds generic maps for nodes, rooms, NPCs, interactables, gates, rewards, conditions and results. |
| Chapter content expansion | **OPEN** | Only the FB01/chapter1 package is authored in the current product config. A later chapter still needs a complete data package and its own validation/evidence; no chapter-specific code branch is required or allowed. |
| UI functional matrix | **PASS** | 33/33 browser cases, conditional routes and modal cases pass with zero console problems. |
| UI production visual quality | **BLOCKED** | Manual art/hierarchy/pixel/asset review is not production-acceptable. |
| Android/release | **BLOCKED** | No signed Release AAB/APK, physical-device matrix, store package, monitoring or rollback rehearsal. |

## 7. Explicit open blockers and owners

1. `ASSET-002`–`ASSET-006`: launcher, fonts, chapter map, NPC portraits and interaction icon family.
2. `ASSET-007`: approved side-view character clips with idle/attack/hurt/control/defeat and alternating-foot animation evidence.
3. `ASSET-008`: clean battle scenes without baked characters or HUD pixels.
4. `ASSET-009`: authored hit/parry/dodge/critical/control/Buff/victory/defeat VFX and Buff icon atlas.
5. `ASSET-010`: owned/licensed OGG SFX/BGM with loudness, peak and device-latency evidence.
6. `COMBAT-002B` and `T05-01`: remain blocked until the above inputs and strict manual visual acceptance are complete.
7. `CONTENT-001` and `EDITOR-ROI-001` are complete; G6 is pass. A player-facing second chapter remains future approved content, not a runtime blocker.
8. `REL-001`–`REL-003`: signing, Release AAB/APK, device/performance, store, observability operations and rollback rehearsal.
9. Known non-P0 gap: 24 IAP product mappings remain `backend_pending`.

The original/reference project may continue to supply development-time scene, Buff and audio bindings through the read-only overlay. It cannot satisfy any production ownership or visual Gate C requirement.

## 8. Why a later chapter is not automatically “done”

Configuration-driven runtime means the same interpreter can consume chapter 2, chapter 3 and later packages without adding `if chapter === ...` code. It does **not** generate the content itself. Each chapter still needs a versioned, schema-valid package containing its rooms, nodes, NPCs, interactables, dialogue/result tokens, conditions, encounters, rewards, combat references, navigation and rollback metadata. The package must be exercised through the generic runtime and pass positive/negative foreign-key, result-routing, save/restore, visual-route and balance checks.

That config-only reuse certification fixture is now complete under
`CONTENT-001`. The follow-on `EDITOR-ROI-001` decision selected a validated
script workflow and deferred a specialized editor until a stable production
chapter corpus and author measurements exist. A real second chapter should
only be authored when its design/content package is approved.

## 9. Next execution order

1. **ASSET-007 → ASSET-010 / COMBAT-002B / T05-01.** Use the original-project overlay for development while the asset requirement tables remain the production source of truth; do not promote reference bytes or CSS fallbacks.
2. **REL-001 → REL-002 → REL-003.** Release build/signing, physical Android acceptance, store/monitoring/rollback.
3. Keep `REST-REPAIR-001` postponed per user instruction; it must not be auto-resumed by combat work.

Every step retains the three-gate rule: static evidence, runtime regression, then strict manual visual/device acceptance. An automated green result never overrides a manual visual FAIL.

## 10. Rollback and traceability

- Tool correction rollback: revert commit `43cb4b8be827ca1ca7732358f08089315aa31563`; no runtime/config content is lost.
- This report, the stage-plan evidence update and future content-fixture evidence are ordinary tracked Markdown/config changes. Generated reports, screenshots, APKs and browser profiles remain ignored outputs.
- The machine authority remains `config/production/production_stage_plan.json`; this report is the current human-readable audit interpretation and does not override task status.

## 11. REL-001 foundation audit update (2026-08-12)

The release toolchain is no longer unimplemented. Schema, R8/resource
shrinking, external-only signing, APK/AAB, complete npm+Gradle SBOM, R8 mapping,
artifact provenance and two-clean-build comparison are implemented and covered
by positive/negative tests. The static contract has zero findings.

This does not alter the production verdict. Strict release correctly fails
before packaging because `T05-01` remains blocked, external signing inputs are
absent and no green-CI binding exists. No signed artifact, device evidence or
store evidence was created. `REL-001` therefore remains `open` and `G7` remains
`blocked`.
