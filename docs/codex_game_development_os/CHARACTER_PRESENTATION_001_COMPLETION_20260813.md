# CHARACTER-PRESENTATION-001 Completion Record — 2026-08-13

## 1. Current State

The modular character runtime now reaches the real HTML combat presentation boundary. `CharacterComposer` produces a deterministic layer plan and `CharacterDomRenderer` consumes that plan after the generic screen adapter has presented the combat markup. The active production manifest remains intentionally empty: zero parts, zero compositions, `shippingAllowed=false`. This task creates no artwork and does not display a fake modular character.

Verdict for this task: **PASS WITH KNOWN LIMITATIONS**. The generic renderer, data contract, positive tests and negative tests pass. Product visual acceptance remains **BLOCKED / NOT TESTABLE** because no approved part atlas exists.

## 2. Problems Found

The previous implementation stopped at a logical render plan. It created `PartRegistry` and `CharacterComposer` at startup, but the actual combat DOM never consumed their output. Frame strings also lacked a machine-readable atlas region, so an implementation could not reliably crop a sprite sheet. Calling that state a completed visible character runtime would have been false.

## 3. Proposed Solution

The solution keeps content and program responsibilities separate:

```text
Combat unit visual.compositionId
  -> configured combat state to clip mapping
  -> CharacterComposer logical layer/frame plan
  -> CharacterDomRenderer atlas crop and ordered layer stack
  -> one canonical right-facing source, controlled enemy mirror
```

Character parts now configure atlas dimensions, named 96x96 frame regions, clip playback, per-frame body phases, anchors and logical AssetRegistry IDs. Generic code validates and renders these values. No character name, faction, unit ID or concrete image path is hardcoded in the adapter.

## 4. Change Scope

- Runtime: composer render metadata, DOM renderer, combat presentation hook and pixel-layer CSS.
- Configuration: character manifest/schema version 2 and combat-state-to-clip mapping.
- Tests: composer atlas/region/playback negatives and independent DOM mount/frame-sync/mirror/fail-closed tests.
- Governance: shipping scope, preflight, Roadmap, stage register and traceability.
- Assets: no files added, copied, generated, promoted or approved.

## 5. Configuration Changes

`wuxia_character_compositions.v2` adds:

- `atlas.width` and `atlas.height` for each part;
- named `frameRegions` constrained to 96x96 integer cells;
- `playback=loop|hold-last` for each clip;
- the configured `combatClipByState` map;
- unchanged side-view-only, legless, five-required-part and fail-closed policies.

The live manifest stays at the truthful requirements-only state. Real combat units receive no `compositionId` until approved part atlases and compositions are registered.

## 6. Code Changes

`src/characterDomRenderer.js` mounts a 96x96 layer stack, crops atlas cells, advances one shared frame clock, applies controlled horizontal mirroring and stops old timers when a presentation root changes. `src/wuxia-main.js` emits only configured composition/clip/facing attributes and asks the renderer to mount after DOM presentation. `src/wuxia.css` provides nearest-neighbour layer rendering and configured body-phase transforms; it does not define a concrete character.

## 7. Test Method

Focused tests cover:

- ordered required/optional parts;
- AssetRegistry source resolution;
- atlas region existence, cell size and overflow;
- loop and hold-last playback contracts;
- DOM layer mounting and source crop offsets;
- canonical facing and controlled enemy mirror;
- cross-layer frame and body-phase synchronization;
- unknown composition and invalid document failure paths;
- active manifest zero-asset truthfulness and shipping-scope registration.

Manual browser acceptance for the real target character is not claimable in this task: no approved part pixels exist to inspect. The current product screen therefore remains a known visual failure under T05-01 and COMBAT-002B.

The real-browser sweep was rerun only after the local server was proven reachable. The first infrastructure-only run observed zero screens because no server was listening and is not counted as product evidence. The valid rerun produced 33/33 cases across the 11-screen by three-size matrix, 11/11 observed screens, three modal cases, zero coverage gaps and zero automated blockers. Its report is stored at `outputs/wuxia_visual_matrix/character-presentation-001-20260813/browser_surface_sweep_report.json` and remains an uncommitted evidence artifact.

Manual review then opened the combat screen at compact, baseline and tall portrait sizes, plus the preceding NPC selection and returned-map screens. Functional layout acceptance passed for this limited slice: the combat HUD, action list and return flow were present, readable and did not overlap the two combatants. Product visual acceptance failed at every size: both combatants are still geometric CSS placeholders, the battlefield is a black/grey blockout, no configured modular part stack is mounted, there is no approved sprite animation to inspect, and the pre/post-combat UI remains prototype-grade. This is a strict `BLOCKED` result for T05-01 and COMBAT-002B, not a visual PASS for this adapter task.

## 8. Risks

- No visual quality, silhouette, expression, animation or hit-readability conclusion can be drawn from a code fixture.
- Palette fields are exposed as CSS variables only; an approved palette-mask production contract is still required before recolouring art.
- Character timing is client presentation state; CombatSession remains the sole combat authority.
- The development CSS fighter remains visible until a unit receives a valid composition. It is forbidden as a production substitute by the existing presentation gates.

## 9. Unfinished Items

1. `ASSET-007`: provide approved body, head-base, eyes, mouth and hair atlases plus the six required clips and manual full-frame evidence.
2. Bind the approved composition IDs to configured combat-unit `visual.compositionId` fields.
3. Run three portrait sizes, both facings, every frame and all combat states through manual visual acceptance.
4. Continue ASSET-008/009/010, COMBAT-002B, T05-01 and Release gates without promoting reference-only bytes.
