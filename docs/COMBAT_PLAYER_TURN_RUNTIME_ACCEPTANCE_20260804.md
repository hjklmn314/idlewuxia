# Combat Player-Turn Runtime Acceptance — 2026-08-04

## 1. Current State

The first-session encounter now runs as a real, configuration-driven player combat session.  It no longer reports a precomputed victory while only replaying a fixed event timeline.

The authoritative chain is:

```text
wuxia_combat_content.json
  -> CombatSession (rules, target validation, RNG, buffs, events)
  -> ChapterSession pendingCombat snapshot
  -> UI intent contract
  -> DOM command buttons and combat log
  -> terminal CombatSession result
  -> configured chapter resolution action
```

`CombatSession` is the sole authority for turn ownership, skill availability, targeting, resource cost, cooldowns, status control, escape, outcome, and persistence.  The web UI only requests an action through the typed UI-flow boundary.

## 2. Problem Corrected

The former first-session battle started a real session but immediately called `runToEnd()`.  The browser therefore displayed a timeline after the outcome had already been decided.  It had no truthful player decision, no authoritative target selection, and no safe restore of an active battle after save/load.

This was a functional production defect, not merely a presentation limitation.

## 3. Implemented Solution

- Shipping combat policies use `manual_player_turns`; simulation remains a non-shipping test capability.
- The runtime advances only AI turns until a player-owned unit must decide.
- The command panel is generated from `CombatSession.combatControlState()`, including availability, disabled reason, and config-authoritative target candidates.
- A submitted command is rejected without mutation when the actor is not the current player actor, the skill is unavailable, or targets are invalid.
- Runtime-selected targets (self, random, all targets, lowest-health ally) remain selected by the interpreter.  The UI exposes explicit choices only for `single_enemy` and `single_ally`.
- Terminal resolution is prohibited before `CombatSession.status === "finished"`.  Only terminal outcomes invoke the configured chapter action.
- Active session snapshots now preserve RNG state, queues, event sequence, turn order, buffs, cooldowns, resource state, and action counts.  Loading a save reconstructs the active session deterministically.
- Escape uses the same turn and ownership checks.  A failed escape consumes the current turn; an enemy cannot submit the player escape command.

## 4. Change Scope

| Boundary | Change |
| --- | --- |
| Content policy | `compete` now explicitly declares `runtimeMode: manual_player_turns` and terminal-only auto-resolution. |
| Screen contract | `UI_EarlyCombat` declares `autoResolveOnFinish` and `resultDelayMs`; it does not declare a fake fixed-timeline resolution. |
| Combat runtime | Snapshot restoration, player control state, target validation, queued actions, turn advance, and escape semantics. |
| Chapter runtime | Pending-combat restore, player command dispatch, terminal-only result resolution, and saved live combat control. |
| UI contract | `submitCombatAction` and `attemptCombatRunaway` typed intents, with strict array and string validation. |
| Browser UI | Runtime-generated skill/target/escape commands, live HP/MP/buff state, and authoritative event playback. |
| Verification | Focused positive/negative/resume tests and the combat policy validator. |

## 5. Configuration Changes

- `config/wuxia_first_session_flow.json`
  - `chapterSystem.combatActionPolicies.compete.runtimeMode = "manual_player_turns"`
  - `autoResolveOnFinish = true`, explicitly limited to a terminal result.
- `config/wuxia_first_session_screen_contract.json`
  - `UI_EarlyCombat.combatRuntime` uses `autoResolveOnFinish`, `resultDelayMs`, and `resolutionPolicy: authoritative_combat_result_then_configured_resolution`.
- `config/wuxia_ui_intent_contract.schema.json`
  - Adds strict schemas for `submitCombatAction(unitId, skillId, targetIds[])` and `attemptCombatRunaway(unitId)`.

The concrete unit, skill, target, buff, encounter, VFX cue, and audio cue identifiers remain configuration-owned in `config/wuxia_combat_content.json`; the runtime does not introduce hardcoded content IDs.

## 6. Code Changes

- `src/combatSession.js`: authoritative player-turn APIs, deterministic runtime snapshot hydration, explicit target candidates, queue consumption, and truthful escape progression.
- `src/chapterSession.js`: manual pending-combat lifecycle, restore-on-load, command dispatch, and terminal-only chapter resolution.
- `src/uiFlowAdapter.js`, `src/browserAutomationAdapter.js`, `src/wuxiaDomAdapter.js`: typed intent and DOM boundary plumbing.
- `src/wuxia-main.js`, `src/wuxia.css`: live state rendering and generated combat command presentation.  Floating combat feedback is presentation-only and expires using the configured `floatingTextLifetimeMs`; persisted historical events remain in the log but never permanently cover the field after reload.  These files contain no concrete authored unit or skill identifiers for this feature.
- `tools/validate-wuxia-first-session-flow.mjs`: shipping-policy gate forbidding a simulation combat policy.

## 7. Three-Gate Acceptance

### Gate 1 — Configuration and Authority

Passed:

- `npm.cmd run wuxia:validate:first-session:runtime` — 0 errors, 0 warnings.
- `npm.cmd run runtime:combat-module:audit` — accepted; all 26 authored skills and all 16 authored buffs have probes; unsupported configured types and hardcoded concrete IDs are both empty.

### Gate 2 — State Semantics and Regression

Passed:

- `npm.cmd run runtime:combat-player-turns:test` — player stop, wrong-actor rejection without mutation, invalid-target rejection without mutation, valid action progression, deterministic save/resume.
  It also verifies that `root` blocks the configured escape/movement action without turning a player-owned skill turn into AI control.
- `npm.cmd run runtime:combat-chapter-integration:test` — 9 manual player actions to victory, terminal-only configured resolution, persistence restore, and forced legal runaway path.
- `npm.cmd run runtime:combat-session:test` — configured skill/effect/target/buff coverage.
- `npm.cmd run runtime:combat-attributes:test` — 11 attribute and terminal-state assertions.
- `npm.cmd run runtime:ui-flow-adapter:test` — strict intent contract dispatch.

### Gate 3 — Manual Browser Acceptance

At `393 x 852`, the first-session combat was opened in the browser and visible runtime-generated commands were activated.  The same active combat state was then reloaded at `360 x 800` and `430 x 932`; no action target button was clipped from the visible command grid, and no browser error or warning was recorded.

- The selected command reduced the player MP from `49/49` to `39/49`.
- The enemy HP changed from `217/217` to `210/217`.
- The log displayed the emitted hit and burn events.
- The next enemy response applied visible combat state (`封脉`) and command availability reflected runtime state.
- Floating feedback appears only for the configured duration and is removed on reload or expiry; it no longer permanently obscures the play field.
- Browser console after the interaction had zero errors and zero warnings (informational contract logs only).

This is a **functional combat UI pass**, not an art-direction pass.  The current temporary CSS combat figures, scene treatment, VFX, and audio mix do not meet the separately requested high-quality wuxia pixel-art standard and are not represented as approved final art.

## 8. Risks

- The command panel currently exposes all runtime-available authored skills.  It is truthful and data-driven, but future UX work should group/shortcut skills for a one-hand portrait combat flow without bypassing `CombatSession`.
- The encounter is currently one player actor versus one enemy actor.  The runtime supports configured ally/all-target rules, but party-level portrait interaction needs separate multi-actor visual acceptance.
- VFX and audio are configuration contracts.  They still need authentic asset bindings, device mix/latency checks, and art-direction acceptance.
- Manual browser verification is not a substitute for the deferred complete 11-screen × 3-size visual matrix, physical-device verification, signed release validation, or commercial release gate.

## 9. Unfinished Items

- Expand authored combat content only through versioned schemas and validators; do not infer missing capability types as implemented.
- Complete the deferred `COMBAT-002` real Rest/Repair work and the broader real CombatSession presentation/content pass when explicitly prioritized.
- Replace placeholder combat art with the separately defined wuxia, side-view, three-head-high pixel character and clean scene asset pipeline.  Scene images must not embed characters.
- Run device performance, sound-mix, native APK/AAB signing, and release rollback gates.
