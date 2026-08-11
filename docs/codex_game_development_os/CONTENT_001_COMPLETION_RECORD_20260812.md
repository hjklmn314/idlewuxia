# CONTENT-001 Configuration-Only Later-Chapter Reuse Certification

Date: 2026-08-12
Task: `CONTENT-001`
Owner: `modular-feature-framework`
Authority: `config/production/production_stage_plan.json`

## Verdict

**PASS for generic runtime reuse, with an explicit non-production-content limitation.**

The same generic `ChapterSession` runtime loaded a second chapter package from
`options.initialChapter`. The fixture exercised node, room, NPC, dialogue,
interactable, condition, result, reward, encounter and combat routing without a
chapter-specific branch in runtime code. Configuration diff, content hashing and
rollback were verified. No chapter-two production story was invented or activated.

This closes the CONTENT-001 acceptance contract. It does **not** close
`EDITOR-ROI-001`, `ASSET-007`–`ASSET-010`, `COMBAT-002B`, `T05-01`, or any
release gate. `REST-REPAIR-001` remains postponed by user instruction.

## Scope and non-scope

In scope:

- a schema-validated, isolated chapter package;
- generic Definition/Rule/Composition/Runtime Instance boundaries;
- foreign-key and result/condition semantic checks;
- positive and negative interaction execution;
- chapter identity through save/export/restore;
- configured Encounter routing into the existing real CombatSession;
- deterministic configuration diff and rollback hash evidence;
- browser regression and manual visual inspection of the unchanged UI routes.

Out of scope:

- authoring a player-facing second-chapter story;
- adding new production rooms, NPCs, rewards or encounters to the active game;
- changing combat formulas or presentation assets;
- claiming production visual quality or Android/release readiness.

## Production/runtime changes

| Area | File | Change |
|---|---|---|
| Contract | `config/wuxia_chapter_definition.schema.json` | Added the engine-neutral chapter package schema for nodes, rooms, NPCs, interactables, gates, rewards, result lookup and condition lookup. |
| Fixture | `tests/fixtures/chapter_reuse/chapter2_config_fixture.json` | Added a test-only second chapter package. It is not loaded by the production entrypoint. |
| Regression tool | `tools/test-wuxia-later-chapter-config-reuse.mjs` | Added Ajv validation, foreign-key checks, branch/result category checks, hash diff/rollback checks and runtime assertions. |
| NPM entrypoint | `package.json` | Added `npm run runtime:chapter-config-reuse:test`. |

No file in `src/` was changed. The existing generic entrypoint remains
`src/chapterSession.js:createChapterSession({ initialChapter })`; no
`if (chapterId === ...)` or equivalent chapter-specific runtime branch was
added.

## Evidence

The authoritative machine-readable result is:

`outputs/content001_chapter_reuse/chapter_reuse_report.json`

The fixture hash and rollback evidence are:

- original fixture: `9ab54b19af4fdafac25e610b911d72762b12afdf5f8ba9166cb34c6fad4e4d33`;
- changed configuration: `a48ce3223f9ed8458e21e26deb14fbcd8f0806c88acbb28b259ceb0cc91e159c`;
- rollback hash: equal to the original fixture hash.

The runtime assertions passed for:

1. generic node and room selection;
2. NPC dialogue accepted with `outcomeKind=narrative_only` and
   `stateChanged=false`;
3. interactable reward accepted with a real `experience +5` state delta;
4. a failed experience condition rejected without mutating player state;
5. save/export and restore preserving `chapter2_config_fixture` identity and
   state;
6. configured `compete` routing into `encounter_ch2_config_fixture` and
   `STATE_FS_009_EARLY_COMBAT`.

The test was run through both the direct Node command and the NPM command:

```text
npm run runtime:chapter-config-reuse:test  PASS
npm run runtime:chapter-session:test       PASS
npm run runtime:combat-chapter-integration:test PASS
npm run runtime:combat-result-routing:test PASS
npm run wuxia:audit:content-boundary -- --strict PASS
```

## Acceptance interpretation

“A second chapter is added” is satisfied here as an isolated, reproducible
configuration fixture used to certify the reusable content contract. It is
deliberately not treated as a shipped story chapter. A real production chapter
must later provide an approved content package and its own provenance, balance,
UI, asset and manual acceptance evidence; that work is not silently folded into
this task.

## Known limitations and follow-up

- The browser functional sweep is green, but the production visual gate remains
  blocked by reference/CSS combat actors, placeholder stage art, missing authored
  VFX and missing owned/licensed OGG assets.
- The first sweep attempt was invalidated because the local dev server was
  stopped before all viewport workers completed. The authoritative retry kept
  the server alive for the whole run and is recorded in
  `CONTENT_001_MANUAL_VISUAL_ACCEPTANCE_20260812.md`.
- `G6` remains `not-started` until `EDITOR-ROI-001` is complete; finishing
  CONTENT-001 alone must not advance the gate.
