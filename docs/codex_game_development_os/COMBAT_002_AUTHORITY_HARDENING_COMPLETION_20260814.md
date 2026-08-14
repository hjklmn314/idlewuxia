# COMBAT-002 configuration authority hardening completion — 2026-08-14

Verdict: **COMBAT-002 functional/configuration/runtime scope PASS; COMBAT-002B production presentation scope BLOCKED; project RELEASE_BLOCKED.**

This record supersedes historical statements that the real `CombatSession` itself is postponed. It does not supersede or waive the approved-asset, product-art, Android-device, signed-release, store, monitoring, or rollback gates.

## 1. Current state

- `H:\MyProjectBack\idlewuxia` is the sole source and Git authority. No G-drive project content was changed.
- Combat content is interpreted from `config/wuxia_combat_content.json` through `src/combatSession.js`; chapter/NPC result routing enters the same runtime.
- The authored contract contains 5 factions, 6 units, 26 skills, 16 Buffs, 5 encounters, 2 rewards, 4 AI policies, 28 logical visual cues and 5 logical audio cues.
- Runtime coverage includes 13 skill kinds, 8 effect kinds, 7 target modes, 6 damage types, 4 stack policies and stun/silence/root/taunt control semantics.
- `COMBAT-003`, `COMBAT-004` and `COMBAT-005` remain complete. `REST-REPAIR-001` remains postponed by explicit user instruction.

## 2. Problems found

The re-audit found nine authority defects that the previous green tests did not prove:

1. A player could omit the explicit target of a `single_enemy` or `single_ally` skill.
2. A caller could inject targets into runtime-owned `random_enemy`, `lowest_hp_ally`, `self`, `all_enemies` or `all_allies` selection.
3. Random-enemy targeting did not obey an active taunt.
4. Seeded initiative ties consumed random values inside `Array.sort`, making the event order dependent on the host sort implementation.
5. AI weight `0` was converted to weight `1`, and omitted weights silently used a hard-coded fallback.
6. Restored snapshots clamped invalid HP/MP/event/command/order state instead of rejecting corruption.
7. Runtime semantic validation could accept missing or unsupported critical fields when standalone JSON-Schema validation was not invoked first.
8. Unused `roundStartEffects` and `roundEndEffects` keys created false configuration authority.
9. The presentation contract retained every unit, but the browser view rendered only the first enemy in a multi-unit encounter.

## 3. Solution

- Player-owned targeting and runtime-owned targeting now have separate, fail-closed command rules.
- Runtime-owned random targeting applies the same taunt filter as explicit targeting.
- Equal-initiative groups receive one deterministic seeded key per unit before sorting; the comparator no longer mutates RNG state.
- AI policies declare `defaultWeight`; cumulative numeric selection preserves true zero weight without expanding weighted arrays.
- Snapshot restore validates exact ranges, identities, living order, event sequence and command references before creating a session.
- Runtime semantic validation now enforces turn order, derived/base attribute separation, skills/effects/targets, stack policies and AI defaults independently of Ajv.
- The Web presentation renders data-driven player/enemy rosters and fighter parties for every configured unit ID.
- The real-browser runner captures the first accepted player action and records player/enemy counts, unit IDs, rendered fighter IDs, legal skill buttons and explicit-target buttons.

## 4. Change scope

Changed production/runtime surfaces:

- `src/combatSession.js`
- `src/wuxia-main.js`
- `src/wuxia.css`
- `config/wuxia_combat_content.json`
- `config/wuxia_combat_content.schema.json`

Changed verification/tooling surfaces:

- `tools/test-wuxia-combat-authority-hardening.mjs`
- `tools/test-wuxia-combat-session.mjs`
- `tools/simulate-wuxia-combat.mjs`
- `tools/run-wuxia-real-browser-flow.mjs`
- `package.json`

Changed governance surfaces:

- `config/production/production_stage_plan.json`
- this completion record and the current Roadmap/audit pointers.

No image, animation, VFX or audio asset was generated. Development continues to use the declared original-project/reference overlay only where its contracts allow it.

## 5. Configuration changes

- Combat content version is `combat-core-3-authority-hardening`.
- `rules.turnOrder` and the replay contract are required and schema-validated.
- Every AI policy declares a non-negative `defaultWeight`; `player_safe` deliberately uses zero.
- Unsupported or incomplete skills, effects, Buff stack policies and derived-attribute collisions are rejected.
- The unused round-effect keys were removed rather than pretending to be implemented authority.
- `COMBAT-002` is `done` and depends on `COMBAT-002A`. Approved presentation assets remain owned by the separate blocked task `COMBAT-002B`.

## 6. Code changes

- `submitPlayerAction` rejects a missing explicit target with `target_required` and zero state mutation.
- Runtime-owned selectors reject caller target injection with `runtime_target_override_forbidden`.
- Taunt, zero AI weights and equal-speed seeded ordering are deterministic and directly asserted.
- Corrupt snapshots fail before state construction; invalid data is never silently normalized into a valid save.
- Multi-unit encounter presentation preserves every configured unit from `CombatSession` snapshot to status roster and on-field fighter party.
- The simulator submits explicit targets only for `player_select`; it no longer overrides runtime-owned selection.

## 7. Test and manual acceptance

Focused runtime gates pass:

- combat content/schema validation;
- module audit;
- core session and 1-vs-2 roster coverage;
- attribute/formula assertions;
- new authority-hardening positive/negative tests;
- production semantics;
- manual player turns;
- replay/pause/restore;
- chapter integration and result routing;
- result-audit policy;
- UI-flow and UI-architecture regression;
- 6 configured balance scenarios × 200 runs, all within configured limits.

The known unrelated `FIRST_SESSION_SIMULATION_MISMATCH` remains explicitly `scope=separate`; it is neither hidden nor counted as a COMBAT-002 failure.

Fresh real Edge evidence is under `outputs/combat_002_authority_acceptance_20260814_v4/`:

| Viewport | Flow | Console problems | Horizontal overflow | Combat units/fighters | First player action |
|---|---:|---:|---:|---|---|
| 360×800 | 16/16 | 0 | 0 | 1 player + 1 enemy; 2/2 rendered | captured; state remained combat |
| 393×852 | 16/16 | 0 | 0 | 1 player + 1 enemy; 2/2 rendered | captured; state remained combat |
| 430×932 | 16/16 | 0 | 0 | 1 player + 1 enemy; 2/2 rendered | captured; state remained combat |

Human functional review of all six combat screenshots passes: HP/MP/Buff state, actor identity, 17 currently legal skill buttons, 7 explicit-target buttons, first-action state mutation and return-to-map are visible and usable at all three sizes. The 1-vs-2 authored encounter is additionally asserted as a three-unit presentation roster by the focused session test.

Human product-art review deliberately fails: the visible CSS/geometric fighters, dark placeholder stage, development-only reference bindings, missing authored VFX and missing owned/licensed OGG are not shippable. This failure belongs to `COMBAT-002B`/`T05-01`, not to the generic combat interpreter.

## 8. Risks

- A browser functional PASS is not an Android physical-device or release-artifact PASS.
- The current visual composition remains below the approved product standard.
- The current three-size manual path proves the configured first-session 1-vs-1 battle. Multi-unit DOM generation is generic and regression-tested, but a product-authored reachable 1-vs-2 chapter route has not received a separate browser screenshot.
- Current audio/VFX evidence uses logical bindings and development references; it cannot satisfy production ownership, mix, latency or performance gates.
- Signed Release APK/AAB, external signing custody, physical-device performance, store rollout and real rollback evidence remain absent.

## 9. Unfinished items

The next serial production work is unchanged:

1. `ASSET-007`–`ASSET-010`: fill the existing requirement tables with approved side-view modular character parts, clean scenes, authored VFX/Buff frames and owned/licensed OGG. Do not generate or falsely approve missing assets.
2. `COMBAT-002B`: bind those approved assets and pass the strict three-size browser plus representative Android human presentation/audio gate.
3. `T05-01`: complete the full 11-screen × 3-size product visual matrix.
4. `REL-001`–`REL-003`: signed reproducible Release artifacts, physical-device performance/compatibility, store rollout, monitoring and rollback rehearsal.
5. Keep `REST-REPAIR-001` postponed until the product owner explicitly resumes it.
