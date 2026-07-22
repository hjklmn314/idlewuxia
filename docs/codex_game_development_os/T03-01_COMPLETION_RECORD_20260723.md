# T03-01 Completion Record: FB01 Action Before/After State Assertions

## 1. Current state

T03-01 is complete at the runtime-contract level. The assertion harness executed every configured FB01 action through an isolated public `ChapterSession` fixture:

- 358/358 actions asserted;
- 334 reachable actions and 24 intentional dormant-entity fixture actions;
- 198 accepted actions with a declared state delta, narrative feedback, pending choice, or pending combat transition;
- 160 rejected actions with zero semantic mutation;
- 0 selection failures, 0 availability/dispatch mismatches, and 0 findings.

Combat resolution remains postponed. A configured combat action is only asserted up to the declared pending-combat transition; this task does not implement `CombatSession`, Rest, or Repair.

## 2. Problems found during TDD

The first RED run found three real contract defects:

1. Reachability proofs can describe entities introduced by nested configured results, but a fresh test session did not materialize those entities for selection.
2. Combat interaction availability was tested from the wrong lifecycle state and exposed a state-transition mismatch.
3. Result preparation could reject an inventory/crafting action after the availability service had already reported `available=true`.

## 3. Solution

The action-state contract now uses one isolated fixture per action:

```text
flow config + reachability proof
  -> isolated ChapterSession
  -> node/room/entity selection
  -> availability snapshot
  -> public interaction command
  -> semantic before/after snapshot
  -> accepted/rejected delta assertion
```

Unreachable entities are attached only inside the in-memory fixture; active project configuration is not changed. The harness is data-driven and does not contain concrete NPC, room, chapter, skill, or result IDs.

`EntityInteractionService` now validates every executable branch with the configured result-preparation contract before exposing it as available. This keeps availability and dispatch fail-closed and prevents resource-cost actions from advertising a false executable state.

## 4. Changed files

- `config/wuxia_fb01_action_state_assertion_policy.json`
- `config/wuxia_fb01_action_state_assertion.schema.json`
- `src/entityInteractionService.js`
- `tools/audit-wuxia-fb01-action-state-assertions.mjs`
- `tools/test-wuxia-fb01-action-state-assertions.mjs`
- `package.json`
- `config/production/subsystem_registry.json`
- `config/production/production_stage_plan.json`

Generated JSON/CSV reports remain under `outputs/t03_01_action_state_assertions/` and are not Git shipping inputs.

## 5. Configuration and module contract

The policy declares:

- expected action count;
- fixture lifecycle state and flags;
- synthetic attachment policy for intentional dormant entities;
- semantic snapshot fields excluded from mutation comparison;
- accepted, rejected, narrative-only, combat-pending, and choice-pending outcome rules.

The implementation owns only generic fixture construction, session routing, snapshot normalization, and assertion logic. Concrete content remains in `config/wuxia_first_session_flow.json`.

## 6. Verification

```powershell
npm run runtime:entity-interaction-service:test
npm run runtime:action-state-assertions:test
npm run production:validate
npm run production:test
```

All commands passed. The independent audit command is:

```powershell
npm run wuxia:audit:fb01-action-state
```

Its report is `outputs/t03_01_action_state_assertions/action_state_assertions.json`.

## 7. Known limitations and next work

- G4 remains blocked by `SAVE-001` and `OBS-001`.
- `COMBAT-002` remains explicitly postponed, including Rest/Repair and real combat resolution.
- Full 11-screen x 3-viewport visual acceptance remains T05-01.
- Runtime AssetRegistry integration remains T05-02.
- Real-device, signed release, performance, store, rollout, and rollback gates remain open.
