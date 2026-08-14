# COMBAT-002B Top HUD Runtime Implementation — 2026-08-15

## Verdict

`PASS WITH KNOWN LIMITATIONS` for the bounded runtime top-HUD slice.

This record does not close full `COMBAT-002B`, `T05-01`, asset ownership,
device acceptance or release readiness.

## Scope

Implemented the combat top HUD described by the approved UI contract and
connected it to the live HTML `CombatSession` snapshot. The implementation is
limited to:

- encounter context and round number;
- one independent pause/resume target;
- ordered unit tokens driven by `turnOrder` and `turnIndex`;
- current, future and defeated state semantics;
- player/enemy side semantics using shape and label in addition to color;
- runtime bindings for `unitId`, `side`, `displayName`, `alive`, `actorMount` and
  `turnIndex`.

The old bottom duplicate pause control is suppressed while the top-HUD runtime
contract is active.

## Changed artifacts

- `config/wuxia_combat_top_hud.json`
- `config/wuxia_combat_top_hud.schema.json`
- `config/project_scope.json`
- `src/combatTopHud.js`
- `src/wuxia-main.js`
- `src/wuxiaDomAdapter.js`
- `src/wuxia.css`
- `tools/validate-wuxia-combat-top-hud.mjs`
- `tools/test-wuxia-combat-top-hud.mjs`
- `package.json`

The production design contract now points to the runtime contract through
`config/production/ui_neutral_visual_contract.json.combatTopHud.runtimeContract`.

## Runtime data path

```text
config/wuxia_combat_top_hud.json
  -> loadConfig()
  -> renderCombatRuntime()
  -> buildCombatTopHudModel()
  -> renderCombatTopHud()
  -> DOM adapter pause/resume binding
```

The authoritative turn data is not recreated in the UI. The model reads the
live snapshot fields:

```text
pendingCombat.combatSnapshot.turnOrder
pendingCombat.combatSnapshot.turnIndex
pendingCombat.combatSnapshot.playerUnitIds
pendingCombat.combatSnapshot.enemyUnitIds
pendingCombat.combatSnapshot.units
pendingCombat.combatSnapshot.status
pendingCombat.combatSnapshot.paused
```

## Automated evidence

- `npm run runtime:combat-top-hud:validate` — PASS
- `npm run runtime:combat-top-hud:test` — PASS
- `npm run production:ui-neutral` — PASS
- `npm run production:ui-neutral:test` — PASS
- `npm run wuxia:validate:active-entry` — PASS
- `npm run build:web` — PASS, 35 scoped assets
- `npm run web:freshness:test` — PASS
- `run-wuxia-real-browser-flow.mjs --scenario all-key-screens`:
  - 360×800 — 16 steps, 0 failures, 0 page console problems;
  - 390×844 — 16 steps, 0 failures, 0 page console problems;
  - 412×915 — 16 steps, 0 failures, 0 page console problems.

## Manual visual acceptance

The following captures were opened and inspected manually:

- `outputs/combat_top_hud_runtime_20260815_360x800/14_early_combat_screen.png`
- `outputs/combat_top_hud_runtime_20260815_390x844/14_early_combat_screen.png`
- `outputs/combat_top_hud_runtime_20260815_412x915/14_early_combat_screen.png`

Observed PASS conditions:

- context, round and pause are visually separated from the turn-order row;
- one current actor is highlighted;
- next direction is expressed by ordered tokens and arrows;
- player/enemy labels remain visible at all three portrait widths;
- the pause target is at least 44dp and is not duplicated in the command dock;
- no horizontal overflow appeared in the three captures;
- no raw encounter ID was rendered as player-facing text.

Manual production limitations remain:

- field actors are still the previously known CSS/geometric placeholders;
- the scene remains a development/reference or placeholder presentation;
- final owned pixel actors, VFX, audio and animation timing are not complete;
- the 11-screen × 3-viewport strict visual gate is not closed;
- physical Android device acceptance is not covered by this slice.

## Rollback

Rollback is the single commit that introduced this slice. Remove the runtime
contract from `project_scope.json`, revert `src/combatTopHud.js` and the
`wuxia-main.js`/`wuxiaDomAdapter.js`/`wuxia.css` bindings, and remove the two
focused tools/scripts. No save migration is required because the HUD is a pure
presentation adapter and does not mutate combat snapshots.
