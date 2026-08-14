# Idlewuxia UI/UX Boundary and Neutral UI Standard — 2026-08-14

## Status

`PASS WITH KNOWN LIMITATIONS` for the contract and design-definition slice.
This document defines the UI/UX boundary, the content-neutral wireframe image
standard and the approved Wuxia art direction for later implementation. It
does not claim that the current HTML prototype already meets the visual bar,
and it does not turn the concept example into shipping art.

The machine-readable authority is:

- `config/production/ui_neutral_visual_contract.json`
- `config/production/schemas/ui_neutral_visual_contract.schema.json`
- `config/production/visual_standard.json`
- `config/wuxia_ui_intent_contract.schema.json`
- `config/production/ui_experience_registry.json`

The generated art example is a design reference only. It remains outside the
shipping closure and must not be copied into `www`, Android, or a release APK.

## 1. Known facts, assumptions, unknowns and conflicts

### Known facts

- The active product is the portrait HTML/JavaScript + Capacitor Wuxia game in
  `H:\MyProjectBack\idlewuxia`.
- The product is a hybrid idle RPG, chapter exploration game and turn-based
  combat experience, not the historical shooting prototype and not the UE5
  project.
- The existing runtime already has a screen contract, UI intent Schema,
  ChapterSession, action routing and real-browser evidence tooling.
- The existing visual standard requires side-view-only modular characters,
  head/body construction, no separate leg silhouette, clean scenes without
  baked characters, integer pixel rendering, portrait safe areas and 44dp
  touch targets.
- The existing combat runtime exposes unit-bound HP/MP, Buff state, event
  feedback, skill selection, target selection and replay/pause contracts.
- The current browser combat view is functionally usable but still displays
  development geometry and placeholder scene treatment. That is a product-art
  failure, not a reason to weaken the new standard.

### Assumptions

- The target baseline remains portrait Android at 360x800, 390x844 and
  412x915, with 390x844 as the design reference.
- A final character is a compact side-profile figure made from independently
  replaceable `body`, `head-base`, `eyes`, `mouth` and `hair` layers. The body
  carries the silhouette; no independent legs are shown.
- The neutral UI image is a layout/interaction proof. It deliberately does
  not use final character art, scene art, chapter copy, item icons or branded
  textures.
- The art example may show a complete visual direction, but it remains a
  concept reference until approved source bytes, ownership, hashes and runtime
  bindings exist.

### Unknowns that remain open

- The final project-owned pixel character atlas and animation frames are not
  supplied yet.
- The final clean chapter map and combat scene atlases are not supplied yet.
- Final font licensing, OGG ownership, VFX atlas ownership and device audio
  latency remain open under ASSET-003 and ASSET-007 through ASSET-010.
- The current product has not passed the complete 11-screen × 3-viewport
  human visual matrix.

### Resolved conflicts

- `config/visual_style_contract.json` is a legacy Nova Lite/old shooting-style
  contract. It is retained as historical evidence and is not the authority for
  new Wuxia UI work.
- `config/production/visual_standard.json` and the new neutral UI contract are
  the active Wuxia visual authorities.
- Competitor screenshots may inform hierarchy, pacing and information density;
  they are not a source of shippable art or a reason to copy old rails, tabs,
  labels or visual assets.

## 2. UI/UX boundary

### Runtime owns capability

Runtime code owns reusable behavior:

- screen mounting and unmounting;
- ViewModel projection;
- navigation and back-stack restoration;
- input routing and focus priority;
- command dispatch;
- precondition evaluation;
- state mutation;
- event and feedback ordering;
- save/replay/restore;
- responsive layout calculation;
- accessibility semantics;
- asset lookup by logical ID.

Runtime code must not own concrete chapter names, NPC copy, reward numbers,
skill names, item art paths, visual colors for a specific content row or a
specific node's branch behavior.

### Configuration owns content and presentation choices

Configuration owns:

- `ScreenId`, `ViewModel` binding keys and `ActionId`;
- chapter, room, route, node and NPC content;
- labels and localization keys;
- button order and visibility conditions;
- combat unit, skill, Buff, target and result definitions;
- logical asset IDs, visual Cue IDs and audio Cue IDs;
- state-specific copy, reward data and locked-state reasons;
- art theme tokens, component variants and transition Cue IDs.

Every visible control must be traceable as:

```text
ScreenId
  -> ViewModel field
  -> ActionId / intent type
  -> precondition
  -> command or local transition
  -> expected state change
  -> visual/audio feedback
  -> evidence record
```

### UI is not the game state

The DOM or widget tree is a projection. It may not directly mutate player,
chapter, combat, reward, save or inventory state. An accepted interaction must
produce a domain delta or a declared narrative/navigation transition. A
rejected interaction must produce zero domain mutation and an explainable
reason.

### What belongs in the UI layer

The UI layer may own:

- layout and responsive reflow;
- visual hierarchy;
- semantic labels;
- focus and touch affordances;
- animation and transition playback;
- screen-local selection state;
- visual feedback composition;
- modal lifecycle;
- accessibility presentation.

The UI layer may not own:

- chapter progression decisions;
- combat damage or Buff calculations;
- reward calculation;
- save writes;
- hard-coded asset paths;
- hidden bypasses for locked actions;
- automatic victory or result acceptance.

## 3. Portrait composition boundary

Every portrait screen uses the same high-level zones, with screen-specific
composition supplied by configuration:

| Zone | Baseline | Responsibility | Failure condition |
|---|---:|---|---|
| System safe top | 16dp minimum | notch/status-bar clearance | title or control touches system chrome |
| Context header | 56dp minimum | back, title, current context, optional utility | player cannot tell where they are |
| Primary stage | at least 34% of usable height | combat actors, route map or scene | stage is decorative but does not support the goal |
| Context detail | 112dp minimum | selected unit/node/NPC state and next action | selection has no consequence or explanation |
| Action dock | 64dp minimum | primary action and immediate result feedback | CTA is hidden, too small or ambiguous |
| System safe bottom | 16dp minimum | gesture/home-indicator clearance | bottom control is clipped or unsafe |

The layout uses a 4dp base grid, 16dp outer padding, 12dp section gaps and
8dp control gaps. The layout may reflow vertically, but it may not create
horizontal scrolling. Long lists may scroll only inside their explicit list
zone.

### Combat screen boundary

The combat screen must make these facts readable without opening another page:

- whose turn or action is pending;
- each unit's identity and side;
- HP and MP current/max values;
- Buff/debuff/control state attached to the correct unit;
- selected skill and legal target;
- the immediate combat result;
- pause/replay affordance when enabled;
- the next available action or terminal result.

Actors and their status cards share a data identity. A status bar may never be
visually detached from the unit it represents. Damage, heal, block, miss,
control and Buff feedback must be anchored to the source or target unit and
must not cover the actor, status bar or action controls.

### Chapter/level screen boundary

The chapter screen must make these facts readable without guessing:

- current room or node;
- available routes and direction;
- selected node or room;
- locked state and the exact requirement reason;
- NPC/interactable presence;
- available interaction;
- expected reward or progression result;
- one clear next action.

Locked nodes may not be rendered as unexplained disabled decoration. A blocked
route must show a human-readable reason and preserve a stable back or retry
path.

## 4. UI-neutral image standard

The neutral image is the pre-art gate. It answers “does the screen work?”
before anyone debates “is the art beautiful?”. It is intentionally not a
production screenshot.

### Neutral image must contain

- portrait canvas at 1170×2532, mapped down through integer scaling;
- safe-area boundary;
- named semantic zones, not chapter or character names;
- neutral grayscale surfaces only;
- placeholder boxes for actors, scenes, icons and feedback;
- explicit primary, secondary, back and disabled controls;
- selected, locked, loading, empty and error examples;
- visible focus ring and touch bounds;
- a small state/intent annotation strip outside the player-facing frame.

### Neutral image must not contain

- final character art;
- a named NPC or chapter;
- a real reward, item or skill icon;
- baked character pixels in a scene slot;
- final logo or commercial branding;
- competitor asset fragments;
- a raw runtime ID in the player-facing portion;
- any debug panel that could be mistaken for a product UI;
- decorative FX that hides a state transition.

The annotation strip is evidence metadata only. It is never part of a shipped
screen and must be cropped out of product exports.

### Neutral component requirements

| Component | Required data | Required states |
|---|---|---|
| Screen frame | ScreenId, title, navigation, safe area | default, loading, error, empty |
| State card | label, value, state, delta, source field | default, positive delta, negative delta, locked, unknown |
| Primary action | ActionId, label, enabled, expected state, feedback Cue | enabled, pressed, disabled, pending, success, failure |
| Combat unit card | unitId, identity, HP/MP, Buffs, actor mount | active, hurt, controlled, defeated |
| Chapter node card | nodeId, route state, requirements, rewards, entry ActionId | available, selected, completed, locked, blocked |
| Feedback stack | event/source/target IDs, text, visual/audio Cues | queued, visible, dismissed, replayed |

### Neutral image acceptance

The neutral image passes only when:

1. Every zone has a stable slot ID and a visible bounding box.
2. The primary action is visually dominant and reaches 44dp.
3. Locked and error states explain themselves without color alone.
4. The layout survives 360×800, 390×844 and 412×915 without horizontal overflow.
5. The selected unit/node and the resulting state change are obvious.
6. The image contains no final-art claim.

## 5. Final Wuxia visual direction

The final UI is not a generic dark UI with Chinese text pasted on top. It is
a controlled Wuxia pixel language:

- side-profile modular characters with a compact head/body silhouette;
- no front, back, three-quarter or isometric character view;
- clean scene layers with actors mounted at runtime;
- ink-navy and lacquer-black structural surfaces;
- warm rice-paper detail surfaces;
- jade-blue primary actions;
- cinnabar for danger, injury and destructive actions;
- old-gold for reward, selection and important progression;
- charcoal-ink linework with restrained paper grain;
- pixel edges rendered by nearest-neighbor filtering and integer scale;
- high contrast before texture; texture must never lower readability;
- visual emphasis through silhouette, value, line weight and state shape, not
  color alone.

### Combat visual language

- Stage: clean, layered, atmospheric background with actor landing zones.
- Unit card: compact, unit-bound and readable above the stage.
- Target selection: a clear target ring or frame, never a hidden cursor.
- Action dock: skill cards grouped by intent, with cost, target mode and
  disabled reason visible on demand.
- Feedback: short, anchored, high-contrast and event-backed.
- Critical hit: shape change plus scale/pulse, not only a red number.
- Block/parry: shield shape and sharp stop beat.
- Heal: jade rising particles and upward number motion.
- Poison/debuff: subdued cinnabar/green haze plus an icon and text label.
- Victory/failure: distinct full-screen state treatment with a stable next
  action; no automatic route jump that hides the result.

### Chapter visual language

- Route map: parchment or ink-map surface with strong route direction and node
  state shapes.
- Available node: open ring and jade/gold accent.
- Selected node: larger framed marker and detail card.
- Completed node: filled seal plus route completion line.
- Locked node: closed seal plus visible requirement text.
- NPC/interactable: side-profile marker or neutral icon mounted in the scene,
  never baked into the background asset.
- Detail panel: current location, next action, route requirement and reward
  preview.
- Bottom action: one dominant CTA; secondary actions remain subordinate.

## 6. Typography, touch and accessibility boundaries

- Body text: at least 14px at the reference viewport.
- Screen title: at least 18px.
- Numeric combat values: tabular figures, minimum 16px.
- Primary CTA: minimum 44dp hit area, 8dp separation from neighbors.
- Text contrast: minimum 4.5:1 for normal text.
- Color is never the only signal for locked, error, Buff or selection states.
- Focus must remain visible for keyboard, switch and accessibility navigation.
- Reduced-motion mode replaces motion with a stable state emphasis.
- Chinese localization must tolerate at least 30% expansion without clipping or
  horizontal overflow.
- Text must not be rotated, mirrored or placed over high-frequency pixels.

## 7. Data and interaction contract

The neutral image and final UI both use this binding model:

```text
ScreenId
  -> ViewModel
  -> ComponentId
  -> binding keys
  -> ActionId / intent type
  -> precondition
  -> state command
  -> state delta
  -> feedback event
  -> visual/audio Cue IDs
```

An accepted action must show a real state delta or a declared narrative/
navigation transition within the feedback budget. A rejected action must have
zero domain mutation, an explainable reason and a recoverable path.

The UI must not hard-code:

- a specific chapter;
- a specific node or room;
- a specific NPC;
- a specific skill or Buff;
- a specific reward number;
- a concrete image, audio or font path.

## 8. Evidence and manual review

Every UI milestone requires:

- the neutral wireframe image;
- a combat example;
- a chapter/level example;
- 360×800, 390×844 and 412×915 screenshots;
- DOM/runtime state evidence;
- console and overflow results;
- input before/after state;
- manual review of layout, hierarchy, readability, touch targets, feedback,
  motion, asset binding and release boundary.

Automated checks can prove structure, Schema, dimensions, overflow and state
records. They cannot prove art quality, final asset ownership, device frame
stability, audio latency or release readiness.

The independent acceptance owner remains QA/release review. The person who
implements a screen cannot be its only visual approver.

## 9. Current verdict and next work

The contract-definition slice is complete and suitable for implementation.
The current product visual slice remains blocked because the prototype still
uses development geometry and reference-only presentation bindings.

Next work:

1. Use the neutral image contract as the layout gate for UI revisions.
2. Bind original/reference project assets only in development mode where the
   existing contracts permit it.
3. Fill missing production asset requirements for characters, clean scenes,
   VFX, Buff icons, fonts and audio; do not invent ownership.
4. Re-run the affected screens through the 11-screen × 3-viewport matrix.
5. Require a human visual PASS before closing `COMBAT-002B` or `T05-01`.

The complete art example is linked from the companion record:

[UI combat + chapter art direction example](UI_COMBAT_LEVEL_ART_DIRECTION_EXAMPLE_20260814.md)
