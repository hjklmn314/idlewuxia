# COMBAT-004 — Combat presentation binding readiness and reference provenance

**Date:** 2026-08-08
**Status:** PASS WITH KNOWN LIMITATIONS
**Gate:** G5 (combat presentation preparation)
**Accountable owner:** asset-content-pipeline
**Independent acceptance owner:** qa-bot-regression-engineer / project-and-engine-auditor

## 1. Current state

The combat interpreter and `CombatSession` are already configuration-driven. This task closes the missing presentation-contract layer before production asset bytes are supplied. It does not claim that final character, VFX, or audio art is complete.

The new contract covers:

- 2 actor mount bindings (player and enemy);
- 2 clean-scene bindings;
- all 28 authored visual cue IDs;
- all 5 authored audio cue IDs;
- all 16 authored Buff IDs;
- the four production asset requirements ASSET-007 through ASSET-010.

Each row carries a logical asset ID, production slot, status, development fallback, reference provenance and owning task. A reference overlay can support local development only. It cannot satisfy the shipping registry or the production gate.

## 2. Scope and non-scope

### Included

- `config/wuxia_combat_presentation_contract.json` and its Draft 2020-12 schema;
- coverage and provenance validator;
- positive, negative and strict-production tests;
- preflight registration;
- production task-plan evidence;
- an explicit requirements table for missing actors, scenes, VFX and audio.

### Not included

- no generated or newly authored art/audio bytes;
- no copying of competitor/reference bytes into `public/`, `www/`, Android assets or Git;
- no promotion of reference-only files to shipping ownership;
- no closure of COMBAT-002B, ASSET-007, ASSET-008, ASSET-009 or ASSET-010;
- no claim that the current CSS actor or CSS feedback renderer is production quality.

## 3. Authoritative data chain

```text
config/wuxia_combat_content.json
  -> config/wuxia_combat_presentation_contract.json
  -> config/wuxia_combat_presentation_contract.schema.json
  -> tools/validate-wuxia-combat-presentation-contract.mjs
  -> runtime:combat-presentation:test / validate
  -> production strict gate
```

The validator cross-checks the contract against `wuxia_combat_content.json` and the development-only `wuxia_combat_reference_asset_overlay.json`. It rejects missing cue coverage, unknown IDs, reference binding drift, invalid production policies and (in strict mode) every unresolved production row, fallback and synthesized audio cue.

## 4. Evidence

| Check | Result | Evidence |
|---|---|---|
| Contract/schema and cross-reference validation | PASS | `npm run runtime:combat-presentation:validate` |
| Focused positive/negative/strict tests | PASS | `npm run runtime:combat-presentation:test` |
| Production OS schema | PASS after task-plan status correction | `npm run production:validate` |
| Runtime scope declaration | PASS after the task files are tracked | `npm run scope:validate` |
| Runtime combat replay, simulation and content gates | Re-run required before release handoff | Existing COMBAT-003 focused evidence remains authoritative |

The normal contract result is structurally valid (`valid: true`) with status **`PASS WITH KNOWN LIMITATIONS`** and reports **53 production-blocked rows**. Strict production mode is intentionally `BLOCKED`, because no approved side-view actors, owned VFX family or owned OGG combat audio are present.

## 5. Manual visual acceptance

A fresh real-browser route was run after the contract integration at 540x960 with a fresh evidence context:

- `outputs/combat_manual_browser_flow_20260808_combat004_fresh/real_browser_flow_summary.json`;
- 15 steps, 0 automated interaction failures, final state `STATE_FS_008_MAP_EXPLORE`;
- `outputs/combat_manual_browser_flow_20260808_combat004_fresh/14_early_combat_screen.png` was opened and inspected manually.

The functional screen verdict is **PASS**: both units have readable HP/MP, the configured skill/target controls are visible and tappable, and the route returns to the map after the configured combat result. The final visual/product Gate C verdict remains **FAIL**: the screen uses CSS geometric debug actors and a dark/placeholder scene rather than approved side-view pixel actors and production VFX/audio. This is an explicit production blocker, not a contract-test failure.

This task adds no player-facing rendering code, so it does not downgrade the already recorded functional control evidence. It deliberately preserves the final art failure instead of converting it to a false pass.

## 6. Known limitations and rollback

- Reference scene, audio and Buff icon records are development-only and remain outside the shipping set.
- Actor and VFX rows have no approved reference substitute in the current local archive; their requirements remain open.
- `wuxia_combat_content.json` still contains five `kind: "synth"` audio cues for development fallback. Strict production validation rejects them.
- Rollback is a single commit revert; the runtime combat interpreter and COMBAT-003 snapshot/replay authority are not changed by this task.

## 7. Next work order

1. ASSET-007: supply or approve side-view three-head player/enemy sprites with idle, walk-left, walk-right, attack, hurt, control and defeat clips, including alternating foot phases.
2. ASSET-008: approve clean portrait combat scenes with no baked figures and three-size landing/safe-area evidence.
3. ASSET-009: bind all 28 visual cues and 16 Buff icons to approved pixel VFX/icon records.
4. ASSET-010: replace synth cues with owned/licensed OGG files and measure device latency/mix.
5. COMBAT-002B: run the production profile, real browser three-viewport review and representative Android manual Gate C.

## 8. Verdict

**PASS WITH KNOWN LIMITATIONS.** The binding/provenance contract and fail-closed production gate are complete. The combat product remains `RELEASE_BLOCKED` until the explicitly listed asset and manual visual gates pass.
