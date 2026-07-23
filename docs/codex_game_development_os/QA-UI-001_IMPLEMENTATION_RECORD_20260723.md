# QA-UI-001 Implementation Record

## Verdict

`REVISE / PRODUCT GATE BLOCKED`.

The deterministic tool contract is implemented and verified. The product
acceptance is not closed: the configured choice-result specimen cannot be
reached from the supported baseline route without injecting runtime state.
This is reported as a blocker, not converted into a false pass.

## Current state

- `tools/run-wuxia-browser-surface-sweep.mjs` is registry-driven and produces
  a 33-case plan, active/postponed separation, real-browser viewport runs,
  coverage gaps, and modal results.
- `tools/run-wuxia-real-browser-flow.mjs` can optionally emit a full DOM
  snapshot alongside state, screen, viewport, console, and screenshot data.
- `tools/audit-wuxia-choice-result-browser.mjs` now records per-viewport
  failure evidence and returns non-zero when the modal cannot be accepted.
- `config/wuxia_browser_modal_probe.json` is the single configured modal
  specimen; it contains no hard-coded shooting content.
- `tools/test-wuxia-browser-surface-sweep.mjs` verifies registry consumption,
  33-case generation, postponed-case accounting, and no shooting identifiers.

## Real run evidence

Run:

```text
npm run wuxia:qa:ui-sweep -- --run-id 20260723_qa_ui_001_final
```

Result: `fail` with four blockers. The three baseline viewport runs each
completed 12 steps with zero flow failures, zero console errors/warnings, and
no overflow. Eight screens were observed; `UI_NpcInteraction` and
`UI_ChapterLoop` remain six explicit coverage gaps. The modal probe failed for
all three viewports with `npc is not in selected room`.

Failure evidence contains screenshot, full `bodyHtml`, state, screen,
viewport, scroll width, and console arrays under:

`outputs/wuxia_visual_matrix/20260723_qa_ui_001_final/modal/`

## Manual visual acceptance

The 36 baseline screenshots (12 steps × three configured viewports) were
visually inspected in representative batches at 360×800, 390×844, and
412×915. Shell, story, status, task, map, NPC card, feedback, and responsive
layout were visually coherent; no clipped control or horizontal overflow was
observed. The three modal failure captures correctly show the map state and
the absence of a falsely rendered choice dialog. Manual verdict is therefore
`PASS` for baseline presentation and `REVISE` for the blocked modal product
path.

## Boundaries and rollback

No combat, Rest/Repair, CombatSession, runtime state injection, or competitor
asset adoption was added. T05-01, T05-02, and COMBAT-002 remain open or
postponed in the authoritative stage plan. Rollback is a code/config/docs
revert to the preceding commit; generated outputs are not tracked.
