# Idle Wuxia Domain

This context describes the player-visible first-session and chapter runtime reconstructed from evidence. It keeps competitor facts, project presentation, and runtime execution distinct.

## Language

**Evidence Row**:
A sourced claim about competitor behavior, configuration, UI, interaction, or assets with an explicit evidence level.
_Avoid_: Guess, assumed fact

**Chapter Definition**:
The configuration-owned graph of rooms, routes, NPCs, interactables, gates, encounters, rewards, and result tokens for one chapter.
_Avoid_: Hardcoded chapter flow, level script

**Room**:
The smallest traversable competitor map location with exits and present entities.
_Avoid_: Compressed node

**Presentation Node**:
A player-facing grouping of one or more rooms used to make the portrait map readable without changing the underlying room graph.
_Avoid_: Room

**Interaction Action**:
A configured player operation exposed by an NPC or interactable, such as talk, compete, present, use, or pickup.
_Avoid_: Button callback

**Condition Token**:
A stable competitor condition identifier evaluated against player, room, action, or combat-result context.
_Avoid_: UI condition

**Result Token**:
A stable competitor result identifier interpreted by a named result-effect policy.
_Avoid_: UI effect

**Combat Session**:
A pending encounter created by a combat interaction and resolved by an explicit success, failure, or runaway outcome before post-combat results execute.
_Avoid_: Immediate comparewin

**Screen State**:
A named player-visible state with configured information, actions, feedback, and transitions.
_Avoid_: Page index

**Action Route**:
A configuration-owned command from a screen or interaction to a validated state change.
_Avoid_: Hardcoded navigation

**Owned Asset**:
An art, UI, audio, or effect asset cleared for this project and registered to a stable asset identifier.
_Avoid_: Competitor reference asset, untracked placeholder

**Reference Asset**:
A competitor frame or extracted asset used only to analyze composition, timing, hierarchy, and behavior.
_Avoid_: Shipping asset

**Acceptance Evidence**:
A reproducible automated result, real browser capture, real PIE capture, or recorded manual run proving a stated behavior at the target viewport.
_Avoid_: Offline mockup, file-exists check
